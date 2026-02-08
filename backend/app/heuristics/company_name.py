from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional


@dataclass
class CompanyNameGuess:
    name: Optional[str]
    confidence: float
    snippet: Optional[str]


LABEL_PATTERNS = [
    r"raz[aã]o\s+social\s*[:\-]\s*(.+)",
    r"cliente\s*[:\-]\s*(.+)",
    r"comprador\s*[:\-]\s*(.+)",
    r"destinat[aá]rio\s*[:\-]\s*(.+)",
    r"nome\s+fantasia\s*[:\-]\s*(.+)",
]


def guess_company_name(text: str) -> CompanyNameGuess:
    if not text:
        return CompanyNameGuess(None, 0.0, None)

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    header = "\n".join(lines[:20])

    for pattern in LABEL_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            candidate = _clean_name(match.group(1))
            if candidate:
                return CompanyNameGuess(candidate, 0.75, match.group(0)[:120])

    # Try header uppercase lines
    for line in lines[:10]:
        if len(line) > 5 and line.isupper() and _looks_like_company(line):
            return CompanyNameGuess(_clean_name(line), 0.5, line)

    # Try line before CNPJ
    for idx, line in enumerate(lines):
        if "cnpj" in line.lower() and idx > 0:
            candidate = _clean_name(lines[idx - 1])
            if candidate:
                return CompanyNameGuess(candidate, 0.4, lines[idx - 1])

    return CompanyNameGuess(None, 0.0, None)


def suggest_model_name(name: Optional[str]) -> str:
    if name:
        slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
        if slug:
            return slug[:40]
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return f"custom-{timestamp}"


def _clean_name(value: str) -> Optional[str]:
    if not value:
        return None
    cleaned = re.sub(r"\s+", " ", value).strip()
    cleaned = re.sub(r"^(cnpj|cpf)\s*[:\-]?", "", cleaned, flags=re.IGNORECASE).strip()
    return cleaned if len(cleaned) >= 3 else None


def _looks_like_company(line: str) -> bool:
    return bool(re.search(r"\b(ltda|s\.a\.|sa|eireli|me)\b", line.lower()))
