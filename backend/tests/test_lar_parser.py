from pathlib import Path

from app.pipeline.runner import build_default_runner
from app.pipeline.types import ParseInput


def test_lar_pdf_parsing():
    pdf_path = Path(__file__).resolve().parents[2] / "arquivos" / "1885367 Lar.PDF"
    if not pdf_path.exists():
        return

    runner = build_default_runner()
    result = runner.run(
        ParseInput(
            input_type="pdf",
            raw_input=pdf_path.read_bytes(),
            source_name=pdf_path.name,
            model_override="lar",
        )
    )

    payload = result.result
    assert payload["customer"]["tax_id"]
    assert payload["customer"]["name"]
    assert payload["order"]["order_number"]
    assert payload["order"]["issue_date"] == "2026-01-14"
    assert payload["order"]["currency"].upper() in {"BRL", "USD", "EUR", "UNKNOWN"}
    assert payload["items"]
    assert payload["parsing"]["status"] in {"success", "partial"}


def test_lar_delivery_splits():
    pdf_path = Path(__file__).resolve().parents[2] / "arquivos" / "1885354 Lar.PDF"
    if not pdf_path.exists():
        return

    runner = build_default_runner()
    result = runner.run(
        ParseInput(
            input_type="pdf",
            raw_input=pdf_path.read_bytes(),
            source_name=pdf_path.name,
            model_override="lar",
        )
    )

    items = result.result.get("items", [])
    delivery_dates = {item.get("delivery_date") for item in items if item.get("delivery_date")}
    assert len(items) >= 6
    assert len(delivery_dates) > 1
    assert result.has_multiple_dates
    assert all(item.get("delivery_date") for item in items)
