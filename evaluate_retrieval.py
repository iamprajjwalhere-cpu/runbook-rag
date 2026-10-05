import json
from pathlib import Path

from retrieve import UNIT_COLLECTION, search_collection


PROJECT_DIR = Path(__file__).resolve().parent
EVALUATION_FILE = PROJECT_DIR / "data" / "eval_questions.json"


def main():
    questions = json.loads(EVALUATION_FILE.read_text(encoding="utf-8"))

    if not questions:
        raise ValueError("The evaluation file contains no questions.")

    hits_at_3 = 0
    reciprocal_rank_total = 0.0

    for item in questions:
        question = item["question"]
        relevant_ids = set(item["relevant_unit_ids"])

        results = search_collection(
            UNIT_COLLECTION,
            question,
            top_k=3,
        )

        matching_ranks = [
            rank
            for rank, result in enumerate(results, start=1)
            if result["id"] in relevant_ids
        ]

        if matching_ranks:
            first_relevant_rank = matching_ranks[0]
            hits_at_3 += 1
            reciprocal_rank_total += 1 / first_relevant_rank
            rank_label = str(first_relevant_rank)
        else:
            rank_label = "not in top 3"

        returned_ids = ", ".join(result["id"] for result in results)

        print(f"\nQuestion: {question}")
        print(f"Expected ID(s): {', '.join(sorted(relevant_ids))}")
        print(f"Returned IDs: {returned_ids}")
        print(f"First relevant rank: {rank_label}")

    question_count = len(questions)
    hit_rate = hits_at_3 / question_count
    mean_reciprocal_rank = reciprocal_rank_total / question_count

    print("\n--- Retrieval metrics ---")
    print(f"Hit@3: {hits_at_3}/{question_count} ({hit_rate:.1%})")
    print(f"MRR: {mean_reciprocal_rank:.3f}")


if __name__ == "__main__":
    main()