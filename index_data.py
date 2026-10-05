from pathlib import Path

import chromadb

from gemini_client import embed_texts
from ingest import load_all_chunks
from knowledge_units import load_knowledge_units


PROJECT_DIR = Path(__file__).resolve().parent
CHROMA_DIR = PROJECT_DIR / "chroma_db"

CHUNK_COLLECTION = "runbook_chunks"
UNIT_COLLECTION = "knowledge_units"

chroma_client = chromadb.PersistentClient(path=str(CHROMA_DIR))


def rebuild_collection(
    name: str,
    records: list[dict[str, str]],
    documents: list[str],
) -> int:
    """Embed records and rebuild one Chroma collection."""
    if not records:
        raise ValueError(f"No records provided for collection: {name}")

    if len(records) != len(documents):
        raise ValueError("Each record must have one document to embed.")

    ids = [record["id"] for record in records]
    if len(ids) != len(set(ids)):
        raise ValueError(f"Duplicate IDs found in collection: {name}")

    # Create vectors before replacing the old collection.
    embeddings = embed_texts(documents)

    if len(embeddings) != len(records):
        raise ValueError("Gemini did not return one embedding per record.")

    existing_names = {
    collection.name
    for collection in chroma_client.list_collections()
}
    if name in existing_names:
        chroma_client.delete_collection(name=name)

    collection = chroma_client.create_collection(
        name=name,
        metadata={"hnsw:space": "cosine"},
    )

    metadatas = [
        {
            key: value
            for key, value in record.items()
            if key not in {"id", "text"}
        }
        for record in records
    ]

    collection.add(
        ids=ids,
        documents=documents,
        embeddings=embeddings,
        metadatas=metadatas,
    )

    return collection.count()


def main() -> None:
    # Skip the Source-only sections; they aren't useful retrieval passages.
    chunks = [
        chunk
        for chunk in load_all_chunks()
        if chunk["section"].casefold() != "source"
    ]
    units = load_knowledge_units()

    chunk_documents = [chunk["text"] for chunk in chunks]

    unit_documents = [
        f"Topic: {unit['topic']}\n"
        f"Type: {unit['unit_type']}\n"
        f"{unit['text']}"
        for unit in units
    ]

    chunk_count = rebuild_collection(
        CHUNK_COLLECTION,
        chunks,
        chunk_documents,
    )
    unit_count = rebuild_collection(
        UNIT_COLLECTION,
        units,
        unit_documents,
    )

    print(f"Indexed {chunk_count} baseline chunks.")
    print(f"Indexed {unit_count} knowledge units.")
    print(f"Chroma database saved at: {CHROMA_DIR}")


if __name__ == "__main__":
    main()