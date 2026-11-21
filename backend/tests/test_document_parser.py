import json
import os
import sys
import tempfile
import types
import unittest
from contextlib import contextmanager
from datetime import date
from unittest.mock import MagicMock, patch

_TMP_STORAGE = tempfile.mkdtemp(prefix="mediclaim_test_storage_")
os.environ["STORAGE_DIR"] = _TMP_STORAGE

# Allow running unit tests in environments without psycopg2 installed
if "psycopg2" not in sys.modules:
    try:
        import psycopg2  # noqa: F401
    except ImportError:
        fake_psycopg2 = types.ModuleType("psycopg2")
        fake_extras = types.ModuleType("psycopg2.extras")
        fake_extras.RealDictCursor = object
        fake_pool = types.ModuleType("psycopg2.pool")
        fake_pool.ThreadedConnectionPool = object
        sys.modules["psycopg2"] = fake_psycopg2
        sys.modules["psycopg2.extras"] = fake_extras
        sys.modules["psycopg2.pool"] = fake_pool

from app.schemas.uploads import ParsedDocumentPayload
from app.services import document_parser, storage_service


class TestStorageService(unittest.TestCase):
    def test_save_read_delete_and_path_traversal_guard(self):
        key = "documents/pat_123/test_rx.pdf"
        raw = b"%PDF-1.4 hello world"
        storage_service.save_document_bytes(key, raw)
        self.assertEqual(storage_service.read_document_bytes(key), raw)
        self.assertTrue(storage_service.delete_document_bytes(key))
        self.assertIsNone(storage_service.read_document_bytes(key))

        with self.assertRaises(ValueError):
            storage_service.save_document_bytes("../../etc/passwd", b"bad")


class TestMandatoryGeminiParser(unittest.TestCase):
    def test_missing_api_key_fails_with_exact_user_message(self):
        mock_conn = MagicMock()

        @contextmanager
        def fake_get_db():
            yield mock_conn

        with (
            patch("app.services.document_parser.GEMINI_API_KEY", ""),
            patch("app.services.document_parser.get_db", fake_get_db),
        ):
            res = document_parser.run_parse_and_update_document(
                document_uuid="11111111-1111-1111-1111-111111111111",
                content_bytes=b"%PDF-1.4 fake",
                mime_type="application/pdf",
                filename="discharge.pdf",
            )

        self.assertEqual(res["ocrStatus"], "failed")
        self.assertEqual(res["failureMessage"], "Failed to extract data, upload anyway")
        self.assertIsNone(res["extractedData"])

    def test_gemini_structured_extraction_success(self):
        gemini_payload = {
            "documentType": "discharge_summary",
            "title": "Appendicitis Discharge Summary",
            "documentDate": "2015-11-03",
            "provider": "Sion Government Hospital",
            "organization": "Sion Government Hospital",
            "confidence": 0.96,
            "prescriptions": [],
            "vaccinations": [],
            "allergies": [],
            "conditions": [
                {
                    "conditionName": "Appendicitis",
                    "status": "resolved",
                    "severity": "moderate",
                    "onsetDate": "2015-11-03",
                    "resolvedDate": "2015-11-05",
                    "provider": "Sion Government Hospital",
                    "notes": "Laparoscopic appendectomy with two nights in hospital.",
                }
            ],
            "medications": [],
            "reports": [],
            "warnings": [],
        }

        fake_response = MagicMock()
        fake_response.raise_for_status.return_value = None
        fake_response.json.return_value = {
            "candidates": [
                {"content": {"parts": [{"text": json.dumps(gemini_payload)}]}}
            ]
        }

        fake_client = MagicMock()
        fake_client.__enter__.return_value.post.return_value = fake_response

        with (
            patch("app.services.document_parser.GEMINI_API_KEY", "test-key"),
            patch("app.services.document_parser.httpx.Client", return_value=fake_client),
        ):
            parsed = document_parser.parse_document_with_gemini(
                content_bytes=b"%PDF-1.4 sample",
                mime_type="application/pdf",
            )

        self.assertEqual(parsed.documentType, "discharge_summary")
        self.assertEqual(parsed.documentDate, date(2015, 11, 3))
        self.assertEqual(len(parsed.conditions), 1)
        self.assertEqual(parsed.conditions[0].conditionName, "Appendicitis")
        self.assertEqual(parsed.conditions[0].status, "resolved")
        self.assertEqual(parsed.conditions[0].provider, "Sion Government Hospital")

    def test_gemini_empty_extraction_returns_failed_message(self):
        empty_payload = {
            "documentType": "other",
            "confidence": 0.0,
            "prescriptions": [],
            "vaccinations": [],
            "allergies": [],
            "conditions": [],
            "medications": [],
            "reports": [],
            "warnings": ["Blurry image"],
        }
        fake_response = MagicMock()
        fake_response.raise_for_status.return_value = None
        fake_response.json.return_value = {
            "candidates": [
                {"content": {"parts": [{"text": json.dumps(empty_payload)}]}}
            ]
        }
        fake_client = MagicMock()
        fake_client.__enter__.return_value.post.return_value = fake_response
        mock_conn = MagicMock()

        @contextmanager
        def fake_get_db():
            yield mock_conn

        with (
            patch("app.services.document_parser.GEMINI_API_KEY", "test-key"),
            patch("app.services.document_parser.httpx.Client", return_value=fake_client),
            patch("app.services.document_parser.get_db", fake_get_db),
        ):
            res = document_parser.run_parse_and_update_document(
                document_uuid="11111111-1111-1111-1111-111111111111",
                content_bytes=b"\x89PNG\r\n",
                mime_type="image/png",
                filename="blurry.png",
            )

        self.assertEqual(res["ocrStatus"], "failed")
        self.assertEqual(res["failureMessage"], "Failed to extract data, upload anyway")


class TestCommitParsedDocument(unittest.TestCase):
    def test_commit_persists_all_record_types_and_links_document_id(self):
        doc_uuid = "11111111-1111-1111-1111-111111111111"
        pat_uuid = "22222222-2222-2222-2222-222222222222"
        user_uuid = "33333333-3333-3333-3333-333333333333"

        verified_payload = ParsedDocumentPayload(
            documentType="discharge_summary",
            title="Appendicitis",
            documentDate=date(2015, 11, 3),
            provider="Sion Government Hospital",
            organization="Sion Government Hospital",
            confidence=0.95,
            conditions=[{
                "conditionName": "Appendicitis",
                "status": "resolved",
                "onsetDate": "2015-11-03",
                "provider": "Sion Government Hospital",
                "notes": "Laparoscopic appendectomy with two nights in hospital.",
            }],
            vaccinations=[{
                "vaccineName": "Measles vaccine",
                "doseNumber": 1,
                "administeredDate": "1995-02-10",
                "provider": "Primary Health Centre",
                "notes": "Single dose at nine months.",
            }],
            reports=[{
                "reportName": "Birth record",
                "reportType": "other",
                "reportDate": "1994-05-12",
                "provider": "Government Maternity Hospital",
                "conclusion": "Birth weight 3.1 kg. No complications.",
                "labResults": [],
            }],
        )

        mock_conn = MagicMock()
        mock_conn.execute.return_value.fetchone.return_value = {
            "id": doc_uuid,
            "patient_id": pat_uuid,
            "title": "Appendicitis",
            "original_filename": "appendicitis_discharge.pdf",
            "mime_type": "application/pdf",
            "file_size_bytes": 54321,
            "extracted_payload": None,
        }

        @contextmanager
        def fake_get_db():
            yield mock_conn

        with (
            patch("app.services.document_parser.get_db", fake_get_db),
            patch("app.services.records_service.get_db", fake_get_db),
            patch("app.services.audit_service.get_db", fake_get_db),
        ):
            result = document_parser.commit_parsed_document(
                document_id=f"doc_{doc_uuid}",
                patient_profile_id=f"pat_{pat_uuid}",
                user_id=f"usr_{user_uuid}",
                actor_name="Test User",
                override_payload=verified_payload,
            )

        self.assertEqual(result["ocrStatus"], "completed")
        self.assertEqual(result["fileUrl"], f"/api/v1/documents/doc_{doc_uuid}/content")
        self.assertEqual(result["createdCount"], 3)
        self.assertEqual(len(result["createdRecords"]["conditions"]), 1)
        self.assertEqual(len(result["createdRecords"]["vaccinations"]), 1)
        self.assertEqual(len(result["createdRecords"]["reports"]), 1)

        # Verify document_id was written on every clinical_records INSERT
        insert_calls = [
            call for call in mock_conn.execute.call_args_list
            if "INSERT INTO clinical_records" in call.args[0]
        ]
        self.assertEqual(len(insert_calls), 3)
        for call in insert_calls:
            self.assertIn("document_id", call.args[0])
            self.assertEqual(call.args[1][-1], doc_uuid)


if __name__ == "__main__":
    unittest.main()
