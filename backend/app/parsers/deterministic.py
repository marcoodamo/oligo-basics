"""
Deterministic parsers using regex patterns.
Extracts: CNPJ, IE, emails, phones, dates, monetary values, quantities.
"""

import re
from typing import List, Dict, Tuple, Optional
from datetime import datetime


class DeterministicParser:
    """Parser using regex patterns for structured data extraction."""
    
    # CNPJ patterns: XX.XXX.XXX/XXXX-XX or 14 digits
    CNPJ_PATTERN = re.compile(
        r'\b(\d{2}[.\s]?\d{3}[.\s]?\d{3}[/\s]?\d{4}[-\s]?\d{2})\b'
    )
    
    # IE (Inscrição Estadual) - various formats by state
    IE_PATTERN = re.compile(
        r'\b(?:I\.?E\.?|INSCR(?:IÇÃO)?\.?\s*ESTADUAL|IE)\s*[:\s]*(\d{2,3}[.\s]?\d{3}[.\s]?\d{3}[.\s]?\d{0,4}[-.\s]?\d{0,2})\b',
        re.IGNORECASE
    )
    
    # Email pattern
    EMAIL_PATTERN = re.compile(
        r'\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b',
        re.IGNORECASE
    )
    
    # Phone patterns: Brazilian formats
    PHONE_PATTERN = re.compile(
        r'\b(?:\+?55\s?)?(?:\(?\d{2}\)?[\s.-]?)?\d{4,5}[-.\s]?\d{4}\b'
    )
    
    # Date patterns: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, YYYY-MM-DD
    DATE_PATTERNS = [
        # DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
        (re.compile(r'\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b'), 'dmy'),
        # YYYY-MM-DD (ISO)
        (re.compile(r'\b(\d{4})-(\d{2})-(\d{2})\b'), 'ymd'),
        # Written dates: "15 de Janeiro de 2024"
        (re.compile(
            r'\b(\d{1,2})\s+(?:de\s+)?(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+(?:de\s+)?(\d{4})\b',
            re.IGNORECASE
        ), 'written'),
    ]
    
    MONTH_MAP = {
        'janeiro': 1, 'fevereiro': 2, 'março': 3, 'marco': 3,
        'abril': 4, 'maio': 5, 'junho': 6, 'julho': 7,
        'agosto': 8, 'setembro': 9, 'outubro': 10,
        'novembro': 11, 'dezembro': 12
    }
    
    # Monetary value patterns
    # pt-BR: R$ 1.234,56 or 1.234,56
    # en-US: $ 1,234.56 or 1,234.56
    MONETARY_PATTERNS = [
        # R$ with pt-BR format
        (re.compile(r'R\$\s*([\d.,]+(?:\d{2})?)', re.IGNORECASE), 'BRL', 'pt-BR'),
        # USD with en-US format
        (re.compile(r'(?:US\$|USD)\s*([\d.,]+)', re.IGNORECASE), 'USD', 'en-US'),
        # $ alone (could be USD)
        (re.compile(r'\$\s*([\d.,]+)', re.IGNORECASE), 'USD', 'en-US'),
        # Generic with comma as decimal (pt-BR): 1.234,56
        (re.compile(r'\b(\d{1,3}(?:\.\d{3})*,\d{2})\b'), None, 'pt-BR'),
        # Generic with period as decimal (en-US): 1,234.56
        (re.compile(r'\b(\d{1,3}(?:,\d{3})*\.\d{2})\b'), None, 'en-US'),
    ]
    
    # Quantity patterns: number + unit
    QUANTITY_PATTERN = re.compile(
        r'\b(\d+(?:[.,]\d+)?)\s*(kg|g|ton|toneladas?|un|unid(?:ade)?s?|pç|peça|pc|l|lt|litros?|ml|m|metros?|cx|caixa|saco|sc|fardo)\b',
        re.IGNORECASE
    )
    
    # Order number patterns
    ORDER_NUMBER_PATTERNS = [
        re.compile(r'(?:pedido|ordem|order|po|p\.o\.|purchase\s*order)\s*(?:n[°º]?\.?|#|:)?\s*([A-Z0-9-]+)', re.IGNORECASE),
        re.compile(r'(?:n[°º]?\.?\s*(?:do\s*)?pedido|order\s*(?:no?\.?|#))\s*:?\s*([A-Z0-9-]+)', re.IGNORECASE),
    ]
    
    # CEP (Brazilian ZIP code)
    CEP_PATTERN = re.compile(r'\b(\d{5}[-.\s]?\d{3})\b')
    
    # UF (Brazilian state abbreviation)
    UF_PATTERN = re.compile(
        r'\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b'
    )
    
    # Payment terms patterns (Brazilian formats)
    PAYMENT_TERMS_PATTERNS = [
        # Pattern: "Condicoes de Pagamento: 060 100,00%" or "Cond. Pgto: 030"
        re.compile(
            r'(?:condi[cç][oõ]es?\s*(?:de\s*)?pagamento|cond\.?\s*p(?:a)?g(?:to)?\.?)\s*[:\s]*(\d{2,3})\s*(?:dias?)?\s*(?:[\d,]+%)?',
            re.IGNORECASE
        ),
        # Pattern: "Prazo: 30 dias" or "Prazo de pagamento: 60 DDL"
        re.compile(
            r'prazo\s*(?:de\s*pagamento)?\s*[:\s]*(\d{2,3})\s*(?:dias?|DDL|DDFF)',
            re.IGNORECASE
        ),
        # Pattern: "30 DDL", "60 DDFF", "28 dias"
        re.compile(
            r'\b(\d{2,3})\s*(?:DDL|DDFF|dias?\s*(?:da\s*)?(?:data\s*)?(?:de\s*)?(?:fatura|emiss[aã]o|vencimento)?)',
            re.IGNORECASE
        ),
    ]
    
    # Payment days pattern: "Dias de Pagamento: 05-20" or "dias 5 e 20"
    PAYMENT_DAYS_PATTERN = re.compile(
        r'dias?\s*(?:de\s*)?(?:pagamento|pgto\.?)?\s*[:\s]*(\d{1,2})[-,\s]*(?:e\s*|ou\s*)?(\d{1,2})',
        re.IGNORECASE
    )
    
    # Bank transfer confirmation: "via depósito bancário?: SIM"
    BANK_TRANSFER_PATTERN = re.compile(
        r'dep[oó]sito\s*banc[aá]rio\??\s*[:\s]*(SIM|N[AÃ]O)',
        re.IGNORECASE
    )

    def __init__(self):
        pass
    
    def extract_cnpjs(self, text: str) -> List[str]:
        """Extract and normalize CNPJs from text."""
        matches = self.CNPJ_PATTERN.findall(text)
        normalized = []
        for match in matches:
            # Remove all non-digits
            digits = re.sub(r'\D', '', match)
            if len(digits) == 14:
                normalized.append(digits)
        return list(set(normalized))
    
    def extract_ies(self, text: str) -> List[str]:
        """Extract Inscrição Estadual numbers."""
        matches = self.IE_PATTERN.findall(text)
        normalized = []
        for match in matches:
            # Remove all non-digits
            digits = re.sub(r'\D', '', match)
            if len(digits) >= 8:  # IE has at least 8 digits
                normalized.append(digits)
        return list(set(normalized))
    
    def extract_emails(self, text: str) -> List[str]:
        """Extract email addresses."""
        matches = self.EMAIL_PATTERN.findall(text)
        return list(set([m.lower() for m in matches]))
    
    def extract_phones(self, text: str) -> List[str]:
        """Extract phone numbers."""
        matches = self.PHONE_PATTERN.findall(text)
        normalized = []
        for match in matches:
            # Normalize: remove all non-digits except +
            digits = re.sub(r'[^\d+]', '', match)
            if len(digits) >= 10:  # At least 10 digits for valid phone
                normalized.append(digits)
        return list(set(normalized))
    
    def extract_dates(self, text: str) -> List[Dict[str, str]]:
        """Extract and normalize dates to ISO format."""
        results = []
        
        for pattern, fmt in self.DATE_PATTERNS:
            matches = pattern.findall(text)
            for match in matches:
                try:
                    if fmt == 'dmy':
                        day, month, year = match
                        iso_date = f"{year}-{int(month):02d}-{int(day):02d}"
                    elif fmt == 'ymd':
                        year, month, day = match
                        iso_date = f"{year}-{month}-{day}"
                    elif fmt == 'written':
                        day, month_name, year = match
                        month = self.MONTH_MAP.get(month_name.lower(), 0)
                        if month:
                            iso_date = f"{year}-{month:02d}-{int(day):02d}"
                        else:
                            continue
                    else:
                        continue
                    
                    # Validate date
                    datetime.strptime(iso_date, '%Y-%m-%d')
                    results.append({
                        'original': ''.join(match) if isinstance(match, tuple) else match,
                        'iso': iso_date
                    })
                except (ValueError, TypeError):
                    continue
        
        # Remove duplicates
        seen = set()
        unique = []
        for r in results:
            if r['iso'] not in seen:
                seen.add(r['iso'])
                unique.append(r)
        
        return unique
    
    def extract_monetary_values(self, text: str) -> List[Dict]:
        """Extract monetary values and normalize to decimal."""
        results = []
        
        for pattern, currency, locale in self.MONETARY_PATTERNS:
            matches = pattern.findall(text)
            for match in matches:
                try:
                    value = self._normalize_monetary_value(match, locale)
                    if value is not None:
                        results.append({
                            'original': match,
                            'value': value,
                            'currency': currency
                        })
                except (ValueError, TypeError):
                    continue
        
        return results
    
    def _normalize_monetary_value(self, value_str: str, locale: str) -> Optional[float]:
        """Normalize monetary string to float."""
        if locale == 'pt-BR':
            # 1.234,56 -> 1234.56
            normalized = value_str.replace('.', '').replace(',', '.')
        else:  # en-US
            # 1,234.56 -> 1234.56
            normalized = value_str.replace(',', '')
        
        try:
            return float(normalized)
        except ValueError:
            return None
    
    def extract_quantities(self, text: str) -> List[Dict]:
        """Extract quantities with units."""
        matches = self.QUANTITY_PATTERN.findall(text)
        results = []
        
        unit_map = {
            'kg': 'KG', 'g': 'G', 'ton': 'TON', 'tonelada': 'TON', 'toneladas': 'TON',
            'un': 'UN', 'unid': 'UN', 'unidade': 'UN', 'unidades': 'UN',
            'pç': 'PC', 'peça': 'PC', 'pc': 'PC',
            'l': 'L', 'lt': 'L', 'litro': 'L', 'litros': 'L', 'ml': 'ML',
            'm': 'M', 'metro': 'M', 'metros': 'M',
            'cx': 'CX', 'caixa': 'CX', 'saco': 'SC', 'sc': 'SC', 'fardo': 'FD'
        }
        
        for qty, unit in matches:
            # Normalize quantity
            qty_normalized = float(qty.replace(',', '.'))
            unit_normalized = unit_map.get(unit.lower(), unit.upper())
            
            results.append({
                'quantity': qty_normalized,
                'unit': unit_normalized,
                'original': f"{qty} {unit}"
            })
        
        return results
    
    def extract_order_numbers(self, text: str) -> List[str]:
        """Extract order/PO numbers."""
        results = []
        for pattern in self.ORDER_NUMBER_PATTERNS:
            matches = pattern.findall(text)
            results.extend(matches)
        return list(set(results))
    
    def extract_ceps(self, text: str) -> List[str]:
        """Extract CEP (Brazilian ZIP codes)."""
        matches = self.CEP_PATTERN.findall(text)
        return list(set([re.sub(r'\D', '', m) for m in matches]))
    
    def extract_ufs(self, text: str) -> List[str]:
        """Extract UF (Brazilian state codes)."""
        matches = self.UF_PATTERN.findall(text)
        return list(set(matches))
    
    def extract_payment_terms(self, text: str) -> Dict:
        """
        Extract Brazilian payment terms information.
        
        Returns a dict with:
        - days: number of days (e.g., 60)
        - payment_days: list of specific payment days (e.g., [5, 20])
        - bank_transfer: whether bank transfer is required
        - original: the original text matched
        - interpretation: human-readable interpretation
        """
        result = {
            'days': None,
            'payment_days': [],
            'bank_transfer': None,
            'original': None,
            'interpretation': None
        }
        
        # Extract payment days (e.g., 060, 30 DDL)
        for pattern in self.PAYMENT_TERMS_PATTERNS:
            match = pattern.search(text)
            if match:
                days_str = match.group(1)
                result['days'] = int(days_str)
                result['original'] = match.group(0).strip()
                break
        
        # Extract specific payment days (e.g., dias 05-20)
        days_match = self.PAYMENT_DAYS_PATTERN.search(text)
        if days_match:
            day1 = int(days_match.group(1))
            day2 = int(days_match.group(2)) if days_match.group(2) else None
            result['payment_days'] = [day1]
            if day2:
                result['payment_days'].append(day2)
        
        # Check for bank transfer
        bank_match = self.BANK_TRANSFER_PATTERN.search(text)
        if bank_match:
            result['bank_transfer'] = bank_match.group(1).upper() == 'SIM'
        
        # Generate interpretation
        if result['days']:
            interpretation_parts = [f"{result['days']} dias após fatura"]
            if result['payment_days']:
                days_str = " ou ".join([str(d) for d in result['payment_days']])
                interpretation_parts.append(f"pagamento nos dias {days_str}")
            if result['bank_transfer']:
                interpretation_parts.append("via depósito bancário")
            result['interpretation'] = ", ".join(interpretation_parts)
        
        return result
    
    def parse_all(self, text: str) -> Dict:
        """Run all parsers and return consolidated results."""
        return {
            'cnpjs': self.extract_cnpjs(text),
            'ies': self.extract_ies(text),
            'emails': self.extract_emails(text),
            'phones': self.extract_phones(text),
            'dates': self.extract_dates(text),
            'monetary_values': self.extract_monetary_values(text),
            'quantities': self.extract_quantities(text),
            'order_numbers': self.extract_order_numbers(text),
            'ceps': self.extract_ceps(text),
            'ufs': self.extract_ufs(text),
            'payment_terms': self.extract_payment_terms(text),
            'raw_text': text
        }


# Singleton instance
parser = DeterministicParser()
