from pathlib import Path
import hmac
import json
import os
import secrets
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from fastapi.middleware.cors import CORSMiddleware

from workspace_rag import (
    MAX_UPLOAD_BYTES,
    SUPPORTED_EXTENSIONS,
    answer_workspace_question,
    build_study_atlas,
    build_study_guide,
    build_study_tool,
    delete_document,
    get_document_preview,
    ingest_upload,
    list_documents,
    search_workspace,
    stream_workspace_answer,
    workspace_unit_count,
)

STUDY_SAMPLES_DIR = Path(__file__).resolve().parent / "data" / "study_samples"
load_dotenv(Path(__file__).resolve().parent / ".env")

OWNER_PASSWORD = os.getenv("STUDYSPACE_OWNER_PASSWORD", "")
SESSION_SECRET = os.getenv("STUDYSPACE_SESSION_SECRET") or secrets.token_urlsafe(48)
AUTH_CONFIGURED = len(OWNER_PASSWORD) >= 20 and len(os.getenv("STUDYSPACE_SESSION_SECRET", "")) >= 32
IS_RENDER = os.getenv("RENDER", "").lower() == "true"

# Local prototype scope. The API owns this value; callers do not supply it.
LOCAL_TENANT_ID = "local_demo_workspace"

app = FastAPI(
    title="Studyspace API",
    description="Course material ingestion and source-grounded study assistance.",
    version="0.1.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def require_owner_session(request: Request, call_next):
    """Fail closed for every API endpoint except health and login bootstrap."""
    path = request.url.path
    open_api_paths = {
        "/api/v1/auth/status",
        "/api/v1/auth/login",
        "/api/v1/auth/logout",
    }
    if (path == "/api/v1" or path.startswith("/api/v1/")) and path not in open_api_paths and request.method != "OPTIONS":
        if not AUTH_CONFIGURED:
            return JSONResponse(
                status_code=503,
                content={"detail": "Owner access is not configured. Set the Studyspace password and session secret."},
            )
        if not request.session.get("owner_authenticated"):
            return JSONResponse(status_code=401, content={"detail": "Sign in to access this private notebook."})

        # SameSite cookies block normal cross-site POSTs; this Origin check adds
        # an explicit browser-side CSRF barrier for state-changing requests.
        if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
            origin = request.headers.get("origin")
            if origin:
                allowed_origins = {
                    "http://localhost:5173",
                    "http://127.0.0.1:5173",
                    os.getenv("RENDER_EXTERNAL_URL", "").rstrip("/"),
                }
                request_origin = f"{request.url.scheme}://{request.headers.get('host', '')}".rstrip("/")
                if origin.rstrip("/") not in allowed_origins and origin.rstrip("/") != request_origin:
                    return JSONResponse(status_code=403, content={"detail": "Request origin is not allowed."})
    return await call_next(request)


# Session middleware wraps the API guard so the guard can validate the signed,
# HttpOnly cookie before any protected endpoint runs.
app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET,
    session_cookie="studyspace_session",
    max_age=60 * 60 * 24 * 7,
    same_site="lax",
    https_only=IS_RENDER,
)


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    top_k: int = Field(default=5, ge=1, le=10)
    selected_document_hashes: list[str] | None = Field(default=None, max_length=50)
    mode: Literal["simple", "exam", "deep", "steps"] = "exam"
    history: list[dict[str, str]] = Field(default_factory=list, max_length=8)


class OwnerLoginRequest(BaseModel):
    password: str = Field(min_length=1, max_length=256)


class StudyAtlasRequest(BaseModel):
    topic: str = Field(min_length=1, max_length=500)
    selected_document_hashes: list[str] | None = Field(default=None, max_length=50)


class StudyToolRequest(BaseModel):
    topic: str = Field(min_length=1, max_length=500)
    tool: Literal["flashcards", "quiz"]
    count: int = Field(default=5, ge=3, le=10)
    quiz_format: Literal["multiple_choice", "true_false", "short_answer"] = "multiple_choice"
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    selected_document_hashes: list[str] | None = Field(default=None, max_length=50)


class StudyGuideRequest(BaseModel):
    topic: str = Field(min_length=1, max_length=500)
    selected_document_hashes: list[str] | None = Field(default=None, max_length=50)


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    selected_document_hashes: list[str] | None = Field(default=None, max_length=50)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/v1/auth/status")
def auth_status(request: Request):
    return {"authenticated": bool(request.session.get("owner_authenticated")), "configured": AUTH_CONFIGURED}


@app.post("/api/v1/auth/login")
def owner_login(request: Request, payload: OwnerLoginRequest):
    if not AUTH_CONFIGURED:
        raise HTTPException(
            status_code=503,
            detail="Owner access is not configured. Add STUDYSPACE_OWNER_PASSWORD (20+ characters) and STUDYSPACE_SESSION_SECRET (32+ characters) in the service environment.",
        )
    if not hmac.compare_digest(payload.password, OWNER_PASSWORD):
        raise HTTPException(status_code=401, detail="That password did not match.")
    request.session.clear()
    request.session["owner_authenticated"] = True
    return {"authenticated": True}


@app.post("/api/v1/auth/logout")
def owner_logout(request: Request):
    request.session.clear()
    return {"authenticated": False}


@app.get("/api/v1/documents")
def get_documents():
    documents = list_documents(tenant_id=LOCAL_TENANT_ID)
    return {
        "documents": documents,
        "document_count": len(documents),
        "passage_count": workspace_unit_count(tenant_id=LOCAL_TENANT_ID),
    }


@app.post("/api/v1/search")
def global_search(request: SearchRequest):
    query = request.query.strip()
    if not query:
        raise HTTPException(status_code=422, detail="Search text cannot be blank.")
    hits = search_workspace(
        query,
        tenant_id=LOCAL_TENANT_ID,
        top_k=8,
        include_rejected=True,
        selected_document_hashes=request.selected_document_hashes,
    )
    return {
        "query": query,
        "results": [
            {
                "id": hit["id"],
                "text": hit["text"],
                "distance": hit["distance"],
                "accepted": hit["accepted"],
                "source": hit["metadata"].get("source"),
                "section": hit["metadata"].get("section"),
                "page": hit["metadata"].get("page_number"),
                "slide": hit["metadata"].get("slide_number"),
            }
            for hit in hits
        ],
    }


@app.get("/api/v1/documents/{document_hash}/preview")
def preview_document(document_hash: str):
    preview = get_document_preview(document_hash, tenant_id=LOCAL_TENANT_ID)
    if not preview["passages"]:
        raise HTTPException(status_code=404, detail="Document not found.")
    return preview


@app.get("/api/v1/sample-documents")
def get_sample_documents():
    """List bundled study notes available for one-click demo loading."""
    return {
        "documents": [
            {"filename": path.name, "title": path.stem.replace("_", " ").title()}
            for path in sorted(STUDY_SAMPLES_DIR.glob("*.md"))
        ]
    }


@app.post("/api/v1/sample-documents/{filename}", status_code=201)
def add_sample_document(filename: str):
    """Index one bundled study note using the normal upload pipeline."""
    safe_name = Path(filename).name
    if safe_name != filename or not safe_name.lower().endswith(".md"):
        raise HTTPException(status_code=404, detail="Sample document not found.")
    path = STUDY_SAMPLES_DIR / safe_name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Sample document not found.")
    try:
        return ingest_upload(safe_name, path.read_bytes(), tenant_id=LOCAL_TENANT_ID)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post("/api/v1/documents/upload", status_code=201)
def upload_document(file: UploadFile = File(...)):
    filename = Path(file.filename or "upload").name
    extension = Path(filename).suffix.lower()

    if extension not in SUPPORTED_EXTENSIONS:
        supported = ", ".join(sorted(SUPPORTED_EXTENSIONS))
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type. Supported types: {supported}",
        )

    content = file.file.read(MAX_UPLOAD_BYTES + 1)

    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit.",
        )

    try:
        return ingest_upload(
            filename,
            content,
            tenant_id=LOCAL_TENANT_ID,
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post("/api/v1/ask")
def ask(request: AskRequest):
    question = request.question.strip()

    if not question:
        raise HTTPException(status_code=422, detail="Question cannot be blank.")

    answer, hits = answer_workspace_question(
        question,
        tenant_id=LOCAL_TENANT_ID,
        top_k=request.top_k,
        selected_document_hashes=request.selected_document_hashes,
    )

    evidence = []
    for hit in hits:
        metadata = hit["metadata"]
        evidence.append(
            {
                "id": hit["id"],
                "text": hit["text"],
                "distance": hit["distance"],
                "accepted": hit.get("accepted", True),
                "source": metadata.get("source"),
                "section": metadata.get("section"),
                "page": metadata.get("page_number"),
                "slide": metadata.get("slide_number"),
            }
        )

    return {
        "question": question,
        "answer": answer,
        "evidence": evidence,
    }


@app.post("/api/v1/ask/stream")
def ask_stream(request: AskRequest):
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=422, detail="Question cannot be blank.")

    def event_stream():
        try:
            for event in stream_workspace_answer(
                question,
                tenant_id=LOCAL_TENANT_ID,
                selected_document_hashes=request.selected_document_hashes,
                mode=request.mode,
                history=request.history,
                top_k=request.top_k,
            ):
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        except Exception as error:
            yield f"data: {json.dumps({'type': 'error', 'message': str(error)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/v1/study-atlas")
def create_study_atlas(request: StudyAtlasRequest):
    topic = request.topic.strip()
    if not topic:
        raise HTTPException(status_code=422, detail="Topic cannot be blank.")

    atlas, hits = build_study_atlas(
        topic,
        tenant_id=LOCAL_TENANT_ID,
        selected_document_hashes=request.selected_document_hashes,
    )
    evidence = []
    for hit in hits:
        metadata = hit["metadata"]
        evidence.append(
            {
                "id": hit["id"],
                "text": hit["text"],
                "distance": hit["distance"],
                "accepted": hit["accepted"],
                "source": metadata.get("source"),
                "section": metadata.get("section"),
                "page": metadata.get("page_number"),
                "slide": metadata.get("slide_number"),
            }
        )

    return {"topic": topic, "atlas": atlas, "evidence": evidence}


@app.post("/api/v1/study-tools/generate")
def generate_study_tool(request: StudyToolRequest):
    topic = request.topic.strip()
    if not topic:
        raise HTTPException(status_code=422, detail="Topic cannot be blank.")

    generated, hits = build_study_tool(
        topic,
        tool=request.tool,
        count=request.count,
        quiz_format=request.quiz_format,
        difficulty=request.difficulty,
        tenant_id=LOCAL_TENANT_ID,
        selected_document_hashes=request.selected_document_hashes,
    )
    evidence = []
    for hit in hits:
        metadata = hit["metadata"]
        evidence.append({
            "id": hit["id"],
            "text": hit["text"],
            "distance": hit["distance"],
            "accepted": hit["accepted"],
            "source": metadata.get("source"),
            "section": metadata.get("section"),
            "page": metadata.get("page_number"),
            "slide": metadata.get("slide_number"),
        })
    return {"topic": topic, "study_tool": generated, "evidence": evidence}


@app.post("/api/v1/study-guide/generate")
def generate_study_guide_endpoint(request: StudyGuideRequest):
    topic = request.topic.strip()
    if not topic:
        raise HTTPException(status_code=422, detail="Topic cannot be blank.")

    guide, hits = build_study_guide(
        topic,
        tenant_id=LOCAL_TENANT_ID,
        selected_document_hashes=request.selected_document_hashes,
    )
    evidence = []
    for hit in hits:
        metadata = hit["metadata"]
        evidence.append({
            "id": hit["id"],
            "text": hit["text"],
            "distance": hit["distance"],
            "accepted": hit["accepted"],
            "source": metadata.get("source"),
            "section": metadata.get("section"),
            "page": metadata.get("page_number"),
            "slide": metadata.get("slide_number"),
        })
    return {"topic": topic, "study_guide": guide, "evidence": evidence}


@app.delete("/api/v1/documents/{document_hash}")
def remove_document(document_hash: str):
    documents = list_documents(tenant_id=LOCAL_TENANT_ID)
    exists = any(
        document["document_hash"] == document_hash
        for document in documents
    )

    if not exists:
        raise HTTPException(status_code=404, detail="Document not found.")

    delete_document(document_hash, tenant_id=LOCAL_TENANT_ID)
    return {"deleted": True, "document_hash": document_hash}


# In production, serve the built React app and API from one origin. During local
# development the Vite dev server runs separately, so this mount is optional.
FRONTEND_DIST = Path(__file__).resolve().parent / "frontend" / "dist"
if FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
