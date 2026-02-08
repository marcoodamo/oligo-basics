from __future__ import annotations

from typing import Dict

from .runner import build_default_runner
from .types import ParseInput


_default_runner = None


def _get_runner():
    global _default_runner
    if _default_runner is None:
        _default_runner = build_default_runner()
    return _default_runner


def parse_order_with_pipeline(
    input_data: bytes | str,
    input_type: str = "text",
    source_name: str | None = None,
    model_override: str | None = None,
) -> Dict:
    runner = _get_runner()
    canonical = runner.run(
        ParseInput(
            input_type=input_type,
            raw_input=input_data,
            source_name=source_name,
            model_override=model_override,
        )
    )

    return {
        "result": canonical.result,
        "warnings": canonical.warnings,
        "document_type": canonical.document_type,
        "split_orders": canonical.split_orders,
        "has_multiple_dates": canonical.has_multiple_dates,
    }
