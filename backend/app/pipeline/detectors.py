from __future__ import annotations

import re
from typing import Any, Dict, List, Protocol

from .types import ModelDetection, ModelDefinition, ParseContext


class ModelDetector(Protocol):
    def detect(self, context: ParseContext, models: List[ModelDefinition]) -> ModelDetection:
        raise NotImplementedError


class RuleBasedModelDetector:
    def detect(self, context: ParseContext, models: List[ModelDefinition]) -> ModelDetection:
        raw_text = context.raw_text.lower()
        header_text = "\n".join(context.raw_text.splitlines()[:20]).lower()
        deterministic_cnpjs = set(
            (context.deterministic_data.get("customer_cnpjs") or [])
            + (context.deterministic_data.get("cnpjs") or [])
        )

        best: ModelDetection | None = None
        fallback_model_id = None

        for model in models:
            if not model.enabled or model.status != "active":
                continue

            if model.model_id == "generic" or model.detection.get("fallback"):
                fallback_model_id = model.model_id

            detection = model.detection or {}
            keywords = [str(k).lower() for k in detection.get("keywords", []) if k]
            names = [str(n).lower() for n in detection.get("customer_names", []) if n]
            cnpjs = [str(c) for c in detection.get("customer_cnpjs", []) if c]
            header_regex = [str(r) for r in detection.get("header_regex", []) if r]
            required_fields = [str(f).lower() for f in detection.get("required_fields", []) if f]

            score = 0
            max_score = (
                (2 if keywords else 0)
                + (2 if names else 0)
                + (3 if cnpjs else 0)
                + (2 if header_regex else 0)
                + len(required_fields) * 1
            )
            reasons: List[str] = []
            evidence: List[Dict[str, Any]] = []

            keyword_matches = [keyword for keyword in keywords if keyword and keyword in raw_text]
            if keyword_matches:
                score += 2
                for keyword in keyword_matches:
                    reasons.append(f"keyword:{keyword}")
                    evidence.append({"type": "keyword", "value": keyword, "score": 2})

            name_matches = [name for name in names if name and name in raw_text]
            if name_matches:
                score += 2
                for name in name_matches:
                    reasons.append(f"name:{name}")
                    evidence.append({"type": "name", "value": name, "score": 2})

            cnpj_matches = [cnpj for cnpj in cnpjs if cnpj and cnpj in deterministic_cnpjs]
            if cnpj_matches:
                score += 3
                for cnpj in cnpj_matches:
                    reasons.append(f"cnpj:{cnpj}")
                    evidence.append({"type": "cnpj", "value": cnpj, "score": 3})

            header_matches = []
            for regex in header_regex:
                try:
                    if re.search(regex, header_text, re.IGNORECASE):
                        header_matches.append(regex)
                except re.error:
                    continue
            if header_matches:
                score += 2
                for regex in header_matches:
                    reasons.append(f"header_regex:{regex}")
                    evidence.append({"type": "header_regex", "value": regex, "score": 2})

            matched_required = _match_required_fields(raw_text, required_fields)
            for field in matched_required:
                score += 1
                reasons.append(f"required_field:{field}")
                evidence.append({"type": "required_field", "value": field, "score": 1})

            if score <= 0:
                continue

            confidence = min(1.0, score / max(max_score, 1))
            detection_result = ModelDetection(
                model_id=model.model_id,
                confidence=confidence,
                reasons=reasons,
                evidence=evidence,
            )

            if best is None or detection_result.confidence > best.confidence:
                best = detection_result

        if best:
            return best

        fallback_id = fallback_model_id or (models[0].model_id if models else "unknown")
        return ModelDetection(
            model_id=fallback_id,
            confidence=0.0,
            reasons=["no_match"],
            evidence=[{"type": "fallback", "value": fallback_id, "score": 0}],
        )


def _match_required_fields(raw_text: str, required_fields: List[str]) -> List[str]:
    matched: List[str] = []
    for field in required_fields:
        if field and field in raw_text:
            matched.append(field)
    return matched
