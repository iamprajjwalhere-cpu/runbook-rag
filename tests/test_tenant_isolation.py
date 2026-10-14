"""Regression tests for the workspace vector-store tenant boundary."""

import unittest
import uuid

import chromadb

from workspace_rag import (  # noqa: E402
    get_collection,
    normalize_tenant_id,
    search_workspace,
    tenant_collection_name,
)


class TenantIsolationTests(unittest.TestCase):
    def setUp(self):
        self.client = chromadb.Client()
        unique = uuid.uuid4().hex[:10]
        self.tenant_a = f"tenant_a_{unique}"
        self.tenant_b = f"tenant_b_{unique}"
        self.collection_a = get_collection(self.tenant_a, client=self.client)
        self.collection_b = get_collection(self.tenant_b, client=self.client)

        self.collection_a.add(
            ids=["a-private"],
            documents=["Tenant A handbook passage"],
            embeddings=[[1.0, 0.0]],
            metadatas=[{"tenant_id": self.tenant_a, "source": "a.md"}],
        )
        self.collection_b.add(
            ids=["b-private"],
            documents=["Tenant B confidential passage"],
            embeddings=[[1.0, 0.0]],
            metadatas=[{"tenant_id": self.tenant_b, "source": "b.md"}],
        )

    def test_tenant_a_search_cannot_return_tenant_b_collection_data(self):
        hits = search_workspace(
            "handbook",
            tenant_id=self.tenant_a,
            query_embedding=[1.0, 0.0],
            client=self.client,
        )

        self.assertEqual([hit["id"] for hit in hits], ["a-private"])
        self.assertTrue(all(hit["metadata"]["tenant_id"] == self.tenant_a for hit in hits))

    def test_query_prefilter_blocks_foreign_record_even_if_misplaced_in_collection(self):
        self.collection_a.add(
            ids=["misplaced-b-record"],
            documents=["A foreign tenant record accidentally placed in A's collection"],
            embeddings=[[1.0, 0.0]],
            metadatas=[{"tenant_id": self.tenant_b, "source": "b.md"}],
        )

        hits = search_workspace(
            "handbook",
            tenant_id=self.tenant_a,
            query_embedding=[1.0, 0.0],
            client=self.client,
        )

        self.assertEqual([hit["id"] for hit in hits], ["a-private"])
        self.assertNotIn("misplaced-b-record", {hit["id"] for hit in hits})

    def test_below_cutoff_candidate_is_hidden_unless_diagnostics_are_requested(self):
        self.collection_a.add(
            ids=["weak-match"],
            documents=["A passage with a different meaning"],
            embeddings=[[0.0, 1.0]],
            metadatas=[{"tenant_id": self.tenant_a, "source": "a.md"}],
        )

        normal_hits = search_workspace(
            "project",
            tenant_id=self.tenant_a,
            query_embedding=[1.0, 0.0],
            client=self.client,
        )
        diagnostic_candidates = search_workspace(
            "project",
            tenant_id=self.tenant_a,
            query_embedding=[1.0, 0.0],
            include_rejected=True,
            client=self.client,
        )

        self.assertEqual(normal_hits, [])
        weak_match = next(item for item in diagnostic_candidates if item["id"] == "weak-match")
        self.assertFalse(weak_match["accepted"])

    def test_each_tenant_gets_a_distinct_opaque_collection(self):
        self.assertNotEqual(
            tenant_collection_name(self.tenant_a),
            tenant_collection_name(self.tenant_b),
        )
        self.assertEqual(self.collection_a.metadata["tenant_id"], self.tenant_a)
        self.assertEqual(self.collection_b.metadata["tenant_id"], self.tenant_b)

    def test_invalid_tenant_identifiers_are_rejected(self):
        for invalid in ("", "  ", "tenant/a", "x" * 129, None):
            with self.subTest(tenant_id=invalid):
                with self.assertRaises(ValueError):
                    normalize_tenant_id(invalid)

    def test_tenant_scope_is_required_by_search_api(self):
        with self.assertRaises(TypeError):
            search_workspace("question")


if __name__ == "__main__":
    unittest.main()
