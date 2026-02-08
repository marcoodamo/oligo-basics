import importlib
import os

from fastapi.testclient import TestClient


def setup_test_app(tmp_path):
    os.environ["PARSER_DB_PATH"] = str(tmp_path / "models.db")
    os.environ.pop("DATABASE_URL", None)
    import app.main as main_module
    importlib.reload(main_module)
    return TestClient(main_module.app)


def test_model_create_and_detect(tmp_path):
    client = setup_test_app(tmp_path)

    payload = {
        "name": "acme",
        "display_name": "ACME LTDA",
        "detection_rules": {
            "keywords": ["acme"],
            "customer_names": ["ACME LTDA"],
            "customer_cnpjs": [],
            "header_regex": [],
            "required_fields": ["cnpj"],
        },
        "mapping_config": {
            "fields": [
                {"source": "order.customer_order_number", "target": "order.order_number"}
            ],
            "item_fields": [],
        },
    }

    response = client.post("/models", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "acme"
    assert body["current_version"]["version"] == "v1"

    detect = client.post("/models/detect/text", json={"text": "Pedido ACME LTDA CNPJ"})
    assert detect.status_code == 200
    assert detect.json()["model_name"] == "acme"


def test_model_update_creates_new_version(tmp_path):
    client = setup_test_app(tmp_path)

    payload = {
        "name": "beta",
        "display_name": "BETA",
        "detection_rules": {"keywords": ["beta"]},
        "mapping_config": {"fields": [], "item_fields": []},
    }
    response = client.post("/models", json=payload)
    assert response.status_code == 200

    update = client.put(
        "/models/beta",
        json={
            "detection_rules": {"keywords": ["beta", "novo"]},
        },
    )
    assert update.status_code == 200
    assert update.json()["current_version"]["version"] == "v2"
