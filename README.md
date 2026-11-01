# Studyspace

A local, source-grounded study notebook for students. Add lecture notes, readings, and slides, then ask questions and inspect the passages behind each answer.

## What it does

- Ingest Markdown, plain text, text-based PDF, and PowerPoint files.
- Extract page and slide locations where available.
- Create Gemini embeddings and store searchable passages in a local ChromaDB workspace.
- Answer questions from retrieved material with citations, and abstain when the evidence is too weak.
- Try the bundled Binary Search study note or upload your own course material.

## Run locally on Windows

### 1. Install the Python dependencies

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

### 2. Add your Gemini API key

Copy `.env.example` to `.env`, open `.env`, and add your Gemini API key. Keep `.env` private; it is excluded from Git.

### 3. Start the API

Open a PowerShell terminal in the project root and run the API:

```powershell
.\.venv\Scripts\python.exe -m uvicorn api:app --reload --host 127.0.0.1 --port 8000
```

Keep this terminal running.

### 4. Start the web app

Open a second terminal:

```powershell
Set-Location .\frontend
npm install
npm run dev
```

Open the local address Vite prints, usually `http://localhost:5173`.

## Demo flow

1. Open **My notebook** and add the sample Binary Search note, or upload a lecture PDF/PPTX.
2. Open **Study chat** and ask a question grounded in the source.
3. Expand the cited source passages to show where the answer came from.

Example questions for the sample note:

- Why does binary search require sorted input?
- What is the loop invariant in the iterative algorithm?
- Why is its running time O(log n)?
- What changes when we need the first matching occurrence?

## Project structure

```text
api.py                       FastAPI endpoints for upload, retrieval, and deletion
workspace_rag.py             Parsing, indexing, retrieval, and grounded answers
frontend/                    React interface
app.py                       Streamlit fallback interface
api_client.py                Streamlit-to-API client
data/study_samples/          Student-facing sample study material
data/runbooks/               Legacy SRE retrieval experiment; not served by the study app
```

## Current scope

This is a single-workspace study prototype. It does not yet have accounts, multiple notebooks, cloud storage, or user-specific data separation. Study activity and spaced-repetition schedules are stored in the browser. Scanned PDF OCR is not included.

## Deploy

The repository includes a Render Blueprint and Dockerfile for deploying the React app and FastAPI as one web service. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for steps and free-plan data limits. Keep `GEMINI_API_KEY` in Render's secret settings; never commit it.

The earlier SRE retrieval benchmark remains separate from the student-facing sample library. Its reported score measures that small benchmark set only; it does not measure answer correctness or retrieval quality on student materials.
