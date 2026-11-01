import json
import unittest
from unittest.mock import patch

from workspace_rag import build_study_tool


HITS = [
    {
        "id": "evidence-1",
        "accepted": True,
        "text": "Binary search repeatedly halves the sorted search interval.",
        "metadata": {"source": "algorithms.pdf", "section": "Binary search", "page_number": 2, "slide_number": None},
    }
]


class StudyToolTests(unittest.TestCase):
    def generate(self, response, **kwargs):
        with patch("workspace_rag.search_workspace", return_value=HITS), patch(
            "workspace_rag._generate_text", return_value=response
        ) as generate_text:
            result, hits = build_study_tool(
                "binary search",
                tool="quiz",
                tenant_id="test-tenant",
                count=3,
                **kwargs,
            )
        return result, hits, generate_text

    def test_true_false_quiz_is_normalized_to_two_options(self):
        result, hits, _ = self.generate(
            json.dumps({"title": "Binary search", "questions": [{"question": "Binary search halves the interval.", "answer": True, "explanation": "It discards half each step.", "evidence_ids": ["evidence-1"]}] * 3}),
            quiz_format="true_false",
        )
        self.assertEqual(hits, HITS)
        self.assertEqual(result["questions"][0]["options"], ["True", "False"])
        self.assertEqual(result["questions"][0]["answer_index"], 0)
        self.assertEqual(result["quiz_format"], "true_false")

    def test_short_answer_keeps_reference_answer_and_only_known_citations(self):
        result, _, _ = self.generate(
            json.dumps({"title": "Binary search", "questions": [{"question": "What does each iteration do?", "answer": "It halves the sorted search interval.", "explanation": "This gives logarithmic time.", "evidence_ids": ["evidence-1", "foreign-id"]}] * 3}),
            quiz_format="short_answer",
        )
        item = result["questions"][0]
        self.assertEqual(item["answer_text"], "It halves the sorted search interval.")
        self.assertEqual(item["evidence_ids"], ["evidence-1"])

    def test_difficulty_is_included_in_generation_prompt(self):
        result, _, generate_text = self.generate(
            json.dumps({"title": "Binary search", "questions": [{"question": "Q?", "options": ["A", "B", "C", "D"], "answer_index": 0, "explanation": "Because.", "evidence_ids": ["evidence-1"]}] * 3}),
            difficulty="hard",
        )
        self.assertIsNotNone(result)
        self.assertIn("Difficulty: hard", generate_text.call_args.args[0])

    def test_invalid_quiz_format_is_rejected(self):
        with self.assertRaises(ValueError):
            build_study_tool("topic", tool="quiz", tenant_id="test-tenant", quiz_format="essay")


if __name__ == "__main__":
    unittest.main()
