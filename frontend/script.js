const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.protocol === "file:";

const NATIVE_BACKEND_URL = isLocal 
    ? "http://127.0.0.1:8000/generate" 
    : "https://tiered-app-backend.onrender.com/generate";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const SYSTEM_INSTRUCTION =
  "You are a JSON-only API. Escape all backslashes in LaTeX formulas (use \\\\ instead of \\). Use $ for inline math and $$ for block math. Return ONLY the JSON object with keys: eli5, intermediate, expert.";

const STORAGE_KEYS = {
  mode: "tiered_mode",
  apiKey: "tiered_openrouter_api_key",
  payload: "tiered_cached_payload",
  renderedPayload: "tiered_rendered_payload",
  flips: "tiered_flipped_cards",
  success: "tiered_success_visible",
};

const questionInput = document.getElementById("questionInput");
const generateBtn = document.getElementById("generateBtn");
const statusText = document.getElementById("statusText");
const successText = document.getElementById("successText");
const modeFlag = document.getElementById("modeFlag");
const gearBtn = document.getElementById("gearBtn");
const settingsPopup = document.getElementById("settingsPopup");
const nativeModeToggle = document.getElementById("nativeModeToggle");
const developerModeToggle = document.getElementById("developerModeToggle");
const apiKeyInput = document.getElementById("apiKeyInput");

const cardMap = {
  eli5: {
    card: document.querySelector('.answer-card[data-tier="eli5"]'),
    answer: document.getElementById("eli5Answer"),
  },
  intermediate: {
    card: document.querySelector('.answer-card[data-tier="intermediate"]'),
    answer: document.getElementById("intermediateAnswer"),
  },
  expert: {
    card: document.querySelector('.answer-card[data-tier="expert"]'),
    answer: document.getElementById("expertAnswer"),
  },
};

function getDefaultFlips() {
  return { eli5: false, intermediate: false, expert: false };
}

function setStatus(message = "", isError = false) {
  statusText.textContent = message;
  statusText.style.color = isError ? "#ff9f9f" : "#ffcf86";
}

function showSuccess(visible) {
  successText.classList.toggle("hidden", !visible);
  sessionStorage.setItem(STORAGE_KEYS.success, visible ? "1" : "0");
}

function saveFlips(flips) {
  sessionStorage.setItem(STORAGE_KEYS.flips, JSON.stringify(flips));
}

function readFlips() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEYS.flips)) || getDefaultFlips();
  } catch (_err) {
    return getDefaultFlips();
  }
}

function applyCardState(payload, flips) {
  Object.keys(cardMap).forEach((tier) => {
    cardMap[tier].answer.innerHTML = payload?.[tier] || "";
    cardMap[tier].card.classList.toggle("flipped", Boolean(flips[tier] && payload?.[tier]));
  });
}

function resetCards() {
  Object.keys(cardMap).forEach((tier) => {
    cardMap[tier].answer.innerHTML = "";
    cardMap[tier].card.classList.remove("flipped");
  });
  saveFlips(getDefaultFlips());
}

function clearSessionForFreshRun() {
  sessionStorage.removeItem(STORAGE_KEYS.payload);
  sessionStorage.removeItem(STORAGE_KEYS.renderedPayload);
  sessionStorage.removeItem(STORAGE_KEYS.flips);
  sessionStorage.removeItem(STORAGE_KEYS.success);
  resetCards();
  showSuccess(false);
}

function getMode() {
  return localStorage.getItem(STORAGE_KEYS.mode) || "native";
}

function applyModeUI() {
  const mode = getMode();
  nativeModeToggle.checked = mode === "native";
  developerModeToggle.checked = mode === "developer";
  apiKeyInput.disabled = mode === "native";
  modeFlag.textContent =
    mode === "developer"
      ? "Mode: Developer (BYOK direct OpenRouter)"
      : "Mode: Native (Render backend key)";
}

function cleanAIResponse(rawText) {
  return rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
}

function normalizeJsonString(raw) {
  const trimmed = raw.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fencedMatch) {
    return fencedMatch[1].trim();
  }
  return cleanAIResponse(trimmed);
}

function extractFirstJsonObject(raw) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    return raw;
  }
  return raw.slice(start, end + 1);
}

function normalizePayloadKeys(data) {
  if (!data || typeof data !== "object") {
    return data;
  }

  const normalized = {};
  for (const [key, value] of Object.entries(data)) {
    const cleanedKey = key.toLowerCase().replace(/[\s_-]/g, "");
    if (cleanedKey === "eli5") {
      normalized.eli5 = value;
    } else if (cleanedKey === "intermediate") {
      normalized.intermediate = value;
    } else if (cleanedKey === "expert") {
      normalized.expert = value;
    }
  }
  return normalized;
}

function parseModelContent(content) {
  if (typeof content === "string") {
    const normalized = normalizeJsonString(content);
    const jsonCandidate = extractFirstJsonObject(normalized);
    return normalizePayloadKeys(JSON.parse(jsonCandidate));
  }
  return normalizePayloadKeys(content);
}

function validatePayload(data) {
  const keys = ["eli5", "intermediate", "expert"];
  if (!data || typeof data !== "object") {
    throw new Error("Invalid response shape.");
  }
  for (const key of keys) {
    if (data[key] === undefined || data[key] === null) {
      throw new Error("Model response must include all required keys.");
    }
  }

  function valueToDisplayText(value) {
    if (typeof value === "string") {
      return value.trim();
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    if (Array.isArray(value)) {
      return value.map((item) => valueToDisplayText(item)).filter(Boolean).join("\n");
    }
    if (value && typeof value === "object") {
      const preferredKeys = ["text", "content", "answer", "explanation", "summary", "body"];
      for (const key of preferredKeys) {
        if (key in value) {
          const preferred = valueToDisplayText(value[key]);
          if (preferred) {
            return preferred;
          }
        }
      }

      const lines = Object.entries(value)
        .map(([key, nested]) => {
          const nestedText = valueToDisplayText(nested);
          return nestedText ? `**${key}:** ${nestedText}` : "";
        })
        .filter(Boolean);

      if (lines.length > 0) {
        return lines.join("\n\n");
      }

      return JSON.stringify(value, null, 2);
    }
    return "";
  }

  return {
    eli5: valueToDisplayText(data.eli5),
    intermediate: valueToDisplayText(data.intermediate),
    expert: valueToDisplayText(data.expert),
  };
}

function buildFriendlyErrorPayload() {
  return {
    eli5: "Sorry, I could not parse the AI response this time. Please click Generate again.",
    intermediate:
      "The response format was malformed and could not be rendered safely. Please try once more.",
    expert:
      "Parsing failed due to malformed JSON/LaTeX escaping from the model output. Regenerate to retry.",
  };
}

function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return String(text).replace(/[&<>"']/g, (char) => map[char]);
}

function renderContent(text) {
  const safeText =
    typeof text === "string" ? text : text === undefined || text === null ? "" : JSON.stringify(text);
  if (typeof marked === "undefined") {
    return `<p>${escapeHtml(safeText)}</p>`;
  }

  marked.setOptions({
    gfm: true,
    breaks: true,
  });

  const html = marked.parse(safeText || "");
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;

  if (typeof hljs !== "undefined") {
    wrapper.querySelectorAll("pre code").forEach((block) => hljs.highlightElement(block));
  }

  if (typeof renderMathInElement === "function") {
    renderMathInElement(wrapper, {
      throwOnError: false,
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
      ],
    });
  }

  return wrapper.innerHTML;
}

function processAIResponse(rawContent) {
  const cleaned = rawContent.replace(/```json/gi, "").replace(/```/g, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (_firstError) {
    const escapedBackslashes = cleaned.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
    parsed = JSON.parse(escapedBackslashes);
  }
  const data = validatePayload(normalizePayloadKeys(parsed));
  return renderPayload(data);
}

function renderPayload(payload) {
  return {
    eli5: renderContent(payload.eli5),
    intermediate: renderContent(payload.intermediate),
    expert: renderContent(payload.expert),
  };
}

async function generateNative(question, url) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });

  if (!response.ok) {
    throw new Error(`Backend request failed (${response.status}).`);
  }

  return validatePayload(await response.json());
}

async function generateDeveloper(question, url) {
  const apiKey = localStorage.getItem(STORAGE_KEYS.apiKey);
  if (!apiKey) {
    throw new Error("Save your OpenRouter API key in settings for Developer Mode.");
  }

  const body = {
    model: "openrouter/free",
    messages: [
      { role: "system", content: SYSTEM_INSTRUCTION },
      { role: "user", content: question },
    ],
    temperature: 0.5,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter request failed (${response.status}).`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    try {
      return processAIResponse(content);
    } catch (_parseError) {
      return renderPayload(buildFriendlyErrorPayload());
    }
  }
  try {
    return renderPayload(validatePayload(parseModelContent(content)));
  } catch (_parseError) {
    return renderPayload(buildFriendlyErrorPayload());
  }
}

function restoreFromSession() {
  const renderedRaw = sessionStorage.getItem(STORAGE_KEYS.renderedPayload);
  if (!renderedRaw) {
    const legacyRaw = sessionStorage.getItem(STORAGE_KEYS.payload);
    if (!legacyRaw) {
      resetCards();
      showSuccess(false);
      return;
    }

    try {
      const legacyPayload = JSON.parse(legacyRaw);
      const renderedPayload = renderPayload(legacyPayload);
      sessionStorage.setItem(STORAGE_KEYS.renderedPayload, JSON.stringify(renderedPayload));
      const flips = readFlips();
      applyCardState(renderedPayload, flips);
      showSuccess(sessionStorage.getItem(STORAGE_KEYS.success) === "1");
      return;
    } catch (_err) {
      clearSessionForFreshRun();
      return;
    }
  }

  try {
    const payload = JSON.parse(renderedRaw);
    const flips = readFlips();
    applyCardState(payload, flips);
    showSuccess(sessionStorage.getItem(STORAGE_KEYS.success) === "1");
  } catch (_err) {
    resetCards();
    clearSessionForFreshRun();
  }
}

function handleReloadReset() {
  const navEntry = performance.getEntriesByType("navigation")[0];
  if (navEntry && navEntry.type === "reload") {
    clearSessionForFreshRun();
  }
}

gearBtn.addEventListener("click", () => {
  settingsPopup.classList.toggle("hidden");
});

document.addEventListener("click", (event) => {
  const clickedInside =
    settingsPopup.contains(event.target) || gearBtn.contains(event.target);
  if (!clickedInside) {
    settingsPopup.classList.add("hidden");
  }
});

nativeModeToggle.addEventListener("change", () => {
  if (nativeModeToggle.checked) {
    localStorage.setItem(STORAGE_KEYS.mode, "native");
    applyModeUI();
  }
});

developerModeToggle.addEventListener("change", () => {
  if (developerModeToggle.checked) {
    localStorage.setItem(STORAGE_KEYS.mode, "developer");
    applyModeUI();
  }
});

apiKeyInput.addEventListener("input", () => {
  localStorage.setItem(STORAGE_KEYS.apiKey, apiKeyInput.value.trim());
});

Object.keys(cardMap).forEach((tier) => {
  cardMap[tier].card.addEventListener("click", () => {
    const payload = sessionStorage.getItem(STORAGE_KEYS.renderedPayload);
    if (!payload) {
      return;
    }
    const flips = readFlips();
    flips[tier] = true;
    saveFlips(flips);
    cardMap[tier].card.classList.add("flipped");
  });
});

generateBtn.addEventListener("click", async () => {
  const question = questionInput.value.trim();
  if (!question) {
    setStatus("Please enter a question first.", true);
    return;
  }

  setStatus("Generating answer...");
  showSuccess(false);
  sessionStorage.removeItem(STORAGE_KEYS.payload);
  sessionStorage.removeItem(STORAGE_KEYS.renderedPayload);
  resetCards();

  try {
    const mode = getMode();
    const isNativeMode = mode === "native";
    // Switcher logic
    const url = isNativeMode ? NATIVE_BACKEND_URL : OPENROUTER_URL;
    const renderedPayload =
      isNativeMode
        ? renderPayload(await generateNative(question, url))
        : await generateDeveloper(question, url);

    sessionStorage.setItem(STORAGE_KEYS.renderedPayload, JSON.stringify(renderedPayload));
    saveFlips(getDefaultFlips());
    applyCardState(renderedPayload, getDefaultFlips());
    showSuccess(true);
    setStatus("");
  } catch (error) {
    setStatus(error.message || "Something went wrong.", true);
    showSuccess(false);
  }
});

window.addEventListener("pageshow", () => {
  restoreFromSession();
});

function init() {
  handleReloadReset();
  applyModeUI();
  const savedKey = localStorage.getItem(STORAGE_KEYS.apiKey) || "";
  apiKeyInput.value = savedKey;
  restoreFromSession();
}

init();
