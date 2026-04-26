# Tiered AI 🧠

**A Multi-Level Educational Platform**

Tiered AI is a full-stack application that breaks down complex technical concepts using a unique **'Cognitive Tier' learning approach**. Whether you need an "Explain Like I'm 5" (ELI5) summary, an Intermediate overview, or an Expert-level deep dive, Tiered AI dynamically adjusts its explanations to match your desired comprehension level.

## 🚀 Tech Stack

### Frontend

- **Vanilla JavaScript, HTML5, CSS3** (leveraging Grid and Flexbox for layout).
- **Marked.js**: Robust Markdown parsing.
- **KaTeX**: High-performance LaTeX math rendering.
- **Highlight.js**: Syntax highlighting for code blocks.

### Backend

- **FastAPI (Python)**: High-performance, async-ready web framework.
- **Uvicorn**: Lightning-fast ASGI server.
- **Docker-ready**: Containerization support for seamless deployment.

### AI Integration

- **OpenRouter API**: Powered by the cutting-edge **Gopenrouter/free** model.
- **BYOK (Bring Your Own Key) Architecture**: Offers flexible deployment and usage options.

## ✨ Key Features

- **Dual-Mode Operation**: Seamlessly switch between the **Native Backend Mode** (using a centralized server key) and the **Client-Side BYOK Mode** (Developer mode, utilizing the user's provided key).
- **Professional Rendering**: Integrated LaTeX and Markdown support ensures scientific accuracy and readability for complex formulas and structured documents.
- **Responsive, Flipping-Card UI**: An engaging, interactive user interface that enhances the learning experience across all devices.
- **Environment-Aware Configuration**: Automatic switching between local development and production environments.

## 🏗️ Architecture Flow

```text
[ Client (Browser) ]
      │
      ├─(BYOK Mode)──────────────┐
      │                          ▼
      ├─(Native Mode)─► [ FastAPI Backend ]
                                 │
                                 ▼
                        [ OpenRouter API ]
                                 │
                                 ▼
                       [ Gemini 2.0 Flash ]
```

## 🛠️ Installation & Setup

### 1. Backend Setup (Native Mode)

Navigate to the `backend` directory:

```bash
cd backend
```

Create and activate a Python virtual environment:

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

Install the required dependencies:

```bash
pip install -r requirements.txt
```

Set up your environment variables by creating a `.env` file in the `backend` directory:

```env
# backend/.env
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

Run the backend server:

```bash
uvicorn main:app --reload --port 8000
```

### 2. Frontend Setup

Navigate to the `frontend` directory:

```bash
cd frontend
```

Serve the frontend using a local web server. You can use Python's built-in `http.server`:

```bash
python -m http.server 8080
```

Open your browser and navigate to `http://localhost:8080`.

_Note: You can also use extensions like "Live Server" in VS Code to run the frontend._
