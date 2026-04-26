import json
import os
from typing import Any, Dict

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


from pathlib import Path

env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)
loaded_key = os.getenv("OPENROUTER_API_KEY")
print(f"Loaded Key: {loaded_key[:5]}..." if loaded_key else "Loaded Key: None")


OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
SYSTEM_INSTRUCTION = (
    "Return strictly JSON with keys: eli5, intermediate, expert. No other text."
)


app = FastAPI(title="Tiered AI Backend")

allowed_str = os.getenv("ALLOWED_ORIGINS", "*")

if allowed_str == "*":
    origins = ["*"]
else:
    origins = [o.strip() for o in allowed_str.split(",") if o.strip()]
    # Allow 'null' origin so that opening index.html via file:// works
    if "null" not in origins:
        origins.append("null")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class GenerateRequest(BaseModel):
    question: str


def extract_json_payload(response_json: Dict[str, Any]) -> Dict[str, Any]:
    try:
        content = response_json["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise HTTPException(status_code=502, detail="Unexpected OpenRouter response") from exc

    if isinstance(content, str):
        cleaned = content.replace("```json", "").replace("```", "").strip()
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        candidate = cleaned[start : end + 1] if start != -1 and end != -1 and end >= start else cleaned
        try:
            parsed = json.loads(candidate)
        except Exception as exc:
            raise HTTPException(status_code=502, detail="Model did not return valid JSON") from exc
    elif isinstance(content, dict):
        parsed = content
    else:
        raise HTTPException(status_code=502, detail="Invalid model content type")

    required_keys = {"eli5", "intermediate", "expert"}
    if set(parsed.keys()) != required_keys:
        raise HTTPException(
            status_code=502,
            detail="Model response JSON keys mismatch",
        )
    return parsed


@app.post("/generate")
async def generate_answer(payload: GenerateRequest) -> Dict[str, Any]:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY is not set")

    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    request_body = {
        "model": "openrouter/free",
        "messages": [
            {"role": "system", "content": SYSTEM_INSTRUCTION},
            {"role": "user", "content": question},
        ],
        "temperature": 0.5,
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=45.0) as client:
        try:
            response = await client.post(OPENROUTER_URL, headers=headers, json=request_body)
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            detail = f"OpenRouter error: {exc.response.status_code}"
            raise HTTPException(status_code=502, detail=detail) from exc
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail="OpenRouter request failed") from exc

    response_json = response.json()
    return extract_json_payload(response_json)
