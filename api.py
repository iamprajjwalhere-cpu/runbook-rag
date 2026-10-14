from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from workspace_rag import (
    MAX_UPLOAD_BYTES,
    SUPPORTED_EXTENSIONS,
    answer_workspace_question,
    delete_document,
    ingest_upload,
    list_documents,
    workspace_unit_count,
)


# Local prototype scope. Later, derive this from the signed-in user's identity.
LOCAL_TENANT_ID = "local_demo_workspace"

app = FastAPI(
    title="Runbook RAG API",
    description="Document ingestion and evidence-grounded question answering.",
    version="0.1.0",
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
        result = ingest_upload(
            filename,
            content,
            tenant_id=LOCAL_TENANT_ID,
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    return result

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