import requests


API_BASE_URL = "http://127.0.0.1:8000"
REQUEST_TIMEOUT = 180

# UI display and upload rules. The API remains responsible for enforcing these.
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_DISTANCE = 0.35
SUPPORTED_EXTENSIONS = {".md", ".txt", ".pdf", ".pptx"}


def _request(method: str, path: str, **kwargs) -> dict:
    url = f"{API_BASE_URL}{path}"

    try:
        response = requests.request(
            method,
            url,
            timeout=REQUEST_TIMEOUT,
            **kwargs,
        )
    except requests.RequestException as error:
        raise RuntimeError(
            "The Studyspace API is unavailable at "
            f"{API_BASE_URL}. Start it in another PowerShell terminal with "
            "`.\\.venv\\Scripts\\python.exe -m uvicorn api:app --host "
            "127.0.0.1 --port 8000`, then check http://127.0.0.1:8000/health."
        ) from error

    if not response.ok:
        try:
            detail = response.json().get("detail", response.text)
        except ValueError:
            detail = response.text

        raise RuntimeError(f"API error ({response.status_code}): {detail}")

    return response.json()


def get_workspace_summary() -> dict:
    return _request("GET", "/api/v1/documents")


def get_sample_documents() -> list[dict]:
    return _request("GET", "/api/v1/sample-documents")["documents"]


def add_sample_document(filename: str) -> dict:
    from urllib.parse import quote

    return _request("POST", f"/api/v1/sample-documents/{quote(filename, safe='')}")


def upload_document(filename: str, content: bytes) -> dict:
    return _request(
        "POST",
        "/api/v1/documents/upload",
        files={"file": (filename, content)},
    )


def delete_document(document_hash: str) -> dict:
    return _request(
        "DELETE",
        f"/api/v1/documents/{document_hash}",
    )


def answer_question(question: str) -> tuple[str, list[dict]]:
    result = _request(
        "POST",
        "/api/v1/ask",
        json={"question": question, "top_k": 5},
    )

    # Keep the evidence shape the current UI already knows how to display.
    hits = []
    for item in result["evidence"]:
        hits.append(
            {
                "id": item["id"],
                "text": item["text"],
                "distance": item["distance"],
                "accepted": item["accepted"],
                "metadata": {
                    "source": item["source"],
                    "section": item["section"],
                    "page_number": item["page"],
                    "slide_number": item["slide"],
                },
            }
        )

    return result["answer"], hits
