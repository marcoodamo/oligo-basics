import importlib
import os

from fastapi.testclient import TestClient

from app.repositories.parsed_documents import ParsedDocumentRepository


def setup_test_app(tmp_path):
    os.environ["PARSER_DB_PATH"] = str(tmp_path / "parsed.db")
    os.environ.pop("DATABASE_URL", None)
    import app.main as main_module
    importlib.reload(main_module)
    return TestClient(main_module.app)


def test_get_parsed_document_returns_persisted_json(tmp_path):
    client = setup_test_app(tmp_path)
    repo = ParsedDocumentRepository()

    document_id = "doc-1"
    canonical = {"schema_version": "1.0", "parsing": {"status": "success"}}
    repo.upsert(
        document_id=document_id,
        filename="file.pdf",
        hash_sha256="hash",
        schema_version="1.0",
        parser_version="legacy",
        status="success",
        model_name="lar",
        model_confidence=0.9,
        warnings=[],
        missing_fields=[],
        canonical=canonical,
    )

    response = client.get(f"/documents/{document_id}/parsed")
    assert response.status_code == 200
    assert response.json() == canonical
