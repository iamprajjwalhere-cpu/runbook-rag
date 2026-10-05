import json
from pathlib import Path

from gemini_client import embed_texts
from retrieve import (
    CHUNK_COLLECTION,
    UNIT_COLLECTION,
    chroma_client,
    search_collection,
)


PROJECT_DIR = Path(__file__).resolve().parent
EVALUATION_FILE = PROJECT_DIR / "data" / "eval_questions.json"


def first_matching_rank(results, is_relevant):
    for rank, result in enumerate(results, start=1):
        if is_relevant(result):
            return rank

    return None


def main():
    questions = json.loads(EVALUATION_FILE.read_text(encoding="utf-8"))

    if not questions:
        raise ValueError("The evaluation file contains no questions.")

    unit_collection = chroma_client.get_collection(name=UNIT_COLLECTION)

    summary = {
        "knowledge_units": {"hits": 0, "reciprocal_rank_total": 0.0},
        "baseline_chunks": {"hits": 0, "reciprocal_rank_total": 0.0},
    }

    for item in questions:
        question = item["question"]
        relevant_unit_ids = set(item["relevant_unit_ids"])

        # Read the source locations for the expected knowledge units.
        expected_units = unit_collection.get(
            ids=sorted(relevant_unit_ids),
            include=["metadatas"],
        )

        expected_locations = {
            (metadata.get("source"), metadata.get("section"))
            for metadata in expected_units["metadatas"]
            if metadata
        }

        # Embed once, then use the same vector to query both collections.
        query_embedding = embed_texts([question])[0]

        unit_results = search_collection(
            UNIT_COLLECTION,
            question,
            top_k=3,
            query_embedding=query_embedding,
        )
        chunk_results = search_collection(
            CHUNK_COLLECTION,
            question,
            top_k=3,
            query_embedding=query_embedding,
        )

        unit_rank = first_matching_rank(
            unit_results,
            lambda result: result["id"] in relevant_unit_ids,
        )

        chunk_rank = first_matching_rank(
            chunk_results,
            lambda result: (
                result["metadata"].get("source"),
                result["metadata"].get("section"),
            ) in expected_locations,
        )

        if unit_rank is not None:
            summary["knowledge_units"]["hits"] += 1
            summary["knowledge_units"]["reciprocal_rank_total"] += 1 / unit_rank

        if chunk_rank is not None:
            summary["baseline_chunks"]["hits"] += 1
            summary["baseline_chunks"]["reciprocal_rank_total"] += 1 / chunk_rank

        unit_ids = ", ".join(result["id"] for result in unit_results)
        chunk_sections = ", ".join(
            result["metadata"].get("section", "unknown")
            for result in chunk_results
        )

        print(f"\nQuestion: {question}")
        print(f"Expected unit IDs: {', '.join(sorted(relevant_unit_ids))}")
        print(f"Unit top-3: {unit_ids}")
        print(f"Baseline chunk top-3 sections: {chunk_sections}")
        print(f"First relevant unit rank: {unit_rank or 'not in top 3'}")
        print(f"First relevant chunk rank: {chunk_rank or 'not in top 3'}")

    question_count = len(questions)

    print("\n--- Retrieval comparison ---")
    for label, key in [
        ("Knowledge units", "knowledge_units"),
        ("Baseline chunks", "baseline_chunks"),
    ]:
        hits = summary[key]["hits"]
        mrr = summary[key]["reciprocal_rank_total"] / question_count

        print(f"{label}:")
        print(f"  Hit@3: {hits}/{question_count} ({hits / question_count:.1%})")
        print(f"  MRR: {mrr:.3f}")


if __name__ == "__main__":
    main()