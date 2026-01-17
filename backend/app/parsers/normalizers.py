"""
Data normalizers for order fields.
"""

import re
from typing import Optional, Tuple
from datetime import datetime


def normalize_cnpj(cnpj: str) -> Optional[str]:
    """Normalize CNPJ to 14 digits only."""
    if not cnpj:
        return None
    digits = re.sub(r'\D', '', cnpj)
    if len(digits) == 14:
        return digits
    return None


def normalize_date(date_str: str) -> Optional[str]:
    """Normalize date to ISO format (YYYY-MM-DD)."""
    if not date_str:
        return None
    
    # Already ISO format
    if re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
        return date_str
    
    # Try DD/MM/YYYY
    patterns = [
        (r'^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$', 'dmy'),
        (r'^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$', 'ymd'),
    ]
    
    for pattern, fmt in patterns:
        match = re.match(pattern, date_str.strip())
        if match:
            try:
                if fmt == 'dmy':
                    day, month, year = match.groups()
                    iso = f"{year}-{int(month):02d}-{int(day):02d}"
                else:
                    year, month, day = match.groups()
                    iso = f"{year}-{int(month):02d}-{int(day):02d}"
                # Validate
                datetime.strptime(iso, '%Y-%m-%d')
                return iso
            except ValueError:
                continue
    
    return None


def normalize_monetary_value(value_str: str, locale: str = 'pt-BR') -> Optional[float]:
    """
    Normalize monetary string to float.
    
    Args:
        value_str: String like "1.234,56" (pt-BR) or "1,234.56" (en-US)
        locale: 'pt-BR' or 'en-US'
    
    Returns:
        Float value or None if invalid
    """
    if not value_str:
        return None
    
    # Remove currency symbols
    cleaned = re.sub(r'[R$US\$€£¥\s]', '', value_str, flags=re.IGNORECASE)
    
    if locale == 'pt-BR':
        # 1.234,56 -> 1234.56
        cleaned = cleaned.replace('.', '').replace(',', '.')
    else:  # en-US
        # 1,234.56 -> 1234.56
        cleaned = cleaned.replace(',', '')
    
    try:
        return float(cleaned)
    except ValueError:
        return None


def normalize_quantity(qty_str: str) -> Tuple[Optional[float], Optional[str]]:
    """
    Parse quantity string into value and unit.
    
    Args:
        qty_str: String like "3000 KG" or "0,5 TON"
    
    Returns:
        Tuple of (quantity, unit) or (None, None)
    """
    if not qty_str:
        return None, None
    
    # Pattern: number + optional unit
    pattern = re.compile(
        r'(\d+(?:[.,]\d+)?)\s*(kg|g|ton|toneladas?|un|unid(?:ade)?s?|pç|peça|pc|l|lt|litros?|ml|m|metros?|cx|caixa|saco|sc|fardo)?',
        re.IGNORECASE
    )
    
    match = pattern.search(qty_str)
    if match:
        qty, unit = match.groups()
        qty_float = float(qty.replace(',', '.'))
        
        # Normalize unit
        unit_map = {
            'kg': 'KG', 'g': 'G', 'ton': 'TON', 'tonelada': 'TON', 'toneladas': 'TON',
            'un': 'UN', 'unid': 'UN', 'unidade': 'UN', 'unidades': 'UN',
            'pç': 'PC', 'peça': 'PC', 'pc': 'PC',
            'l': 'L', 'lt': 'L', 'litro': 'L', 'litros': 'L', 'ml': 'ML',
            'm': 'M', 'metro': 'M', 'metros': 'M',
            'cx': 'CX', 'caixa': 'CX', 'saco': 'SC', 'sc': 'SC', 'fardo': 'FD'
        }
        
        unit_normalized = unit_map.get(unit.lower(), unit.upper()) if unit else None
        return qty_float, unit_normalized
    
    return None, None


def normalize_phone(phone: str) -> Optional[str]:
    """Normalize phone to digits only (optionally with country code)."""
    if not phone:
        return None
    digits = re.sub(r'[^\d+]', '', phone)
    if len(digits) >= 10:
        return digits
    return None


def normalize_cep(cep: str) -> Optional[str]:
    """Normalize CEP to 8 digits."""
    if not cep:
        return None
    digits = re.sub(r'\D', '', cep)
    if len(digits) == 8:
        return digits
    return None


def infer_currency(text: str) -> Optional[str]:
    """Infer currency from text patterns."""
    text_lower = text.lower()
    
    if 'r$' in text_lower or 'real' in text_lower or 'brl' in text_lower:
        return 'BRL'
    if 'us$' in text_lower or 'usd' in text_lower or 'dolar' in text_lower or 'dólar' in text_lower:
        return 'USD'
    if 'eur' in text_lower or '€' in text:
        return 'EUR'
    
    return None
