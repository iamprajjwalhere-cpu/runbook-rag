import unittest
from io import BytesIO
from unittest.mock import patch

from fastapi import HTTPException, UploadFile

from api import LOCAL_TENANT_ID, upload_document


class UploadApiTests(unittest.TestCase):
    def test_supported_document_is_sent_to_ingestion_for_server_tenant(self):
        with patch("api.ingest_upload", return_value={"document_hash": "abc", "passage_count": 2}) as ingest:
            response = upload_document(UploadFile(filename="lecture.md", file=BytesIO(b"Binary search needs sorted input.")))

        self.assertEqual(response["document_hash"], "abc")
        ingest.assert_called_once_with("lecture.md", b"Binary search needs sorted input.", tenant_id=LOCAL_TENANT_ID)

    def test_unsupported_extension_is_rejected_before_ingestion(self):
        with patch("api.ingest_upload") as ingest:
            with self.assertRaises(HTTPException) as error:
                upload_document(UploadFile(filename="lecture.exe", file=BytesIO(b"not a study document")))

        self.assertEqual(error.exception.status_code, 415)
        ingest.assert_not_called()

    def test_upload_size_limit_is_enforced_before_ingestion(self):
        with patch("api.MAX_UPLOAD_BYTES", 8), patch("api.ingest_upload") as ingest:
            with self.assertRaises(HTTPException) as error:
                upload_document(UploadFile(filename="lecture.txt", file=BytesIO(b"123456789")))

        self.assertEqual(error.exception.status_code, 413)
        ingest.assert_not_called()


if __name__ == "__main__":
    unittest.main()
