from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from fastapi.middleware.cors import CORSMiddleware

from workspace_rag import (
    MAX_UPLOAD_BYTES,
    SUPPORTED_EXTENSIONS,
    answer_workspace_question,
    delete_document,
    ingest_upload,
    list_documents,
    workspace_unit_count,
)

STUDY_SAMPLES_DIR = Path(__file__).resolve().parent / "data" / "study_samples"

# Local prototype scope. The API owns this value; callers do not supply it.
LOCAL_TENANT_ID = "local_demo_workspace"

app = FastAPI(
    title="Studyspace API",
    description="Course material ingestion and source-grounded study assistance.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
)


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    top_k: int = Field(default=5, ge=1, le=10)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/v1/documents")
def get_documents():
    documents = list_documents(tenant_id=LOCAL_TENANT_ID)
    return {
        "documents": documents,
        "document_count": len(documents),
        "passage_count": workspace_unit_count(tenant_id=LOCAL_TENANT_ID),
    }


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
