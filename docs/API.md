# Studyspace API

FastAPI owns the local workspace and exposes interactive documentation at `http://127.0.0.1:8000/docs` while the service is running. The current prototype uses one server-configured local tenant; it does not provide accounts or production multi-tenant access control.

## Routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness check |
| `GET` | `/api/v1/documents` | List indexed documents and passage totals |
| `GET` | `/api/v1/documents/{document_hash}/preview` | Preview document passages |
| `POST` | `/api/v1/documents/upload` | Upload and index a supported study document |
| `DELETE` | `/api/v1/documents/{document_hash}` | Remove a document and its indexed passages |
| `GET` | `/api/v1/sample-documents` | List bundled study samples |
| `POST` | `/api/v1/sample-documents/{filename}` | Add a bundled sample to the notebook |
| `POST` | `/api/v1/search` | Semantic search over indexed passages |
| `POST` | `/api/v1/ask` | Answer a question and return its evidence |
| `POST` | `/api/v1/ask/stream` | Stream an answer and evidence events |
| `POST` | `/api/v1/study-atlas` | Build a source-linked concept map |
| `POST` | `/api/v1/study-tools/generate` | Generate flashcards or quizzes |
| `POST` | `/api/v1/study-guide/generate` | Create a revision guide |

## Generate practice material

`POST /api/v1/study-tools/generate` accepts a topic, selected source hashes, item count, quiz style, and difficulty. Quiz style is `multiple_choice`, `true_false`, or `short_answer`; difficulty is `easy`, `medium`, or `hard`.

```json
{
  "topic": "binary search",
  "tool": "quiz",
  "count": 5,
  "quiz_format": "true_false",
  "difficulty": "medium",
  "selected_document_hashes": ["document-hash"]
}
```

All generated study content is constrained to retrieved passages and returns evidence IDs for source inspection. The browser UI stores review scheduling locally; the API does not currently persist user-specific review state.
