# Studyspace web app

The React frontend for Studyspace, a local study notebook for source-grounded chat, citation inspection, concept maps, spaced-repetition flashcards, quizzes, revision guides, and learning progress.

## Run it locally

From the project root, start the FastAPI service in one terminal:

```powershell
.\.venv\Scripts\python.exe -m uvicorn api:app --host 127.0.0.1 --port 8000
```

In a second terminal:

```powershell
Set-Location .\frontend
npm install
npm run dev
```

Open the local URL printed by Vite. The API must remain running while using the app.

## Quality checks

```powershell
npm run lint
npm run test
npm run build
```

Flashcard review dates and learning activity are stored in the current browser. They are not synced to an account or another device.
