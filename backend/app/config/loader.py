"""
Configuration loader for mappings and company identifiers.
"""

import os
import yaml
from typing import Dict, List, Optional
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

# Default paths
DEFAULT_CONFIG_DIR = Path(__file__).parent.parent.parent / "config"


class ConfigLoader:
    """Loads and manages configuration files."""
    
    _instance = None
    _mappings: Optional[Dict] = None
    _my_company: Optional[Dict] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if self._mappings is None:
            self.reload()
    
    def reload(self):
        """Reload all configurations."""
        self._load_mappings()
        self._load_my_company()
    
    def _load_mappings(self):
        """Load mappings.yaml configuration."""
        mappings_path = os.getenv("MAPPINGS_PATH", DEFAULT_CONFIG_DIR / "mappings.yaml")
        
        try:
            with open(mappings_path, 'r', encoding='utf-8') as f:
                self._mappings = yaml.safe_load(f) or {}
            logger.info(f"Loaded mappings from {mappings_path}")
        except FileNotFoundError:
            logger.warning(f"Mappings file not found: {mappings_path}")
            self._mappings = self._default_mappings()
        except Exception as e:
            logger.error(f"Error loading mappings: {e}")
            self._mappings = self._default_mappings()
    
    def _load_my_company(self):
        """Load my_company.yaml configuration."""
        my_company_path = os.getenv("MY_COMPANY_CONFIG_PATH", DEFAULT_CONFIG_DIR / "my_company.yaml")
        
        try:
            with open(my_company_path, 'r', encoding='utf-8') as f:
                self._my_company = yaml.safe_load(f) or {}
            logger.info(f"Loaded my_company config from {my_company_path}")
        except FileNotFoundError:
            logger.warning(f"My company config not found: {my_company_path}")
            self._my_company = self._default_my_company()
        except Exception as e:
            logger.error(f"Error loading my_company config: {e}")
            self._my_company = self._default_my_company()
    
    def _default_mappings(self) -> Dict:
        """Return default mappings if file not found."""
        return {
            "payment_terms": {
                "30 dias": "30D",
                "28 DDL": "28DDL",
                "30 DDL": "30DDL",
                "45 dias": "45D",
                "60 dias": "60D",
                "a vista": "AVISTA",
                "à vista": "AVISTA",
                "100% antecipado": "ANT",
            },
            "shipping_methods": {
                "CIF": "CIF",
                "FOB": "FOB",
                "cif": "CIF",
                "fob": "FOB",
            },
            "currencies": {
                "DOLAR": "USD",
                "DOLLAR": "USD",
                "DÓLAR": "USD",
                "USD": "USD",
                "US$": "USD",
                "$": "USD",
                "REAL": "BRL",
                "REAIS": "BRL",
                "BRL": "BRL",
                "R$": "BRL",
                "EURO": "EUR",
                "EUR": "EUR",
                "€": "EUR",
            },
        }
    
    def _default_my_company(self) -> Dict:
        """Return default my_company config if file not found."""
        return {
            "identifiers": {
                "cnpjs": [],
                "names": ["OLIGO BASICS", "OLIGO BÁSICS", "OLIGOBASICS"],
            }
        }
    
    @property
    def payment_terms(self) -> Dict[str, str]:
        """Get payment terms mappings."""
        return self._mappings.get("payment_terms", {})
    
    @property
    def shipping_methods(self) -> Dict[str, str]:
        """Get shipping method mappings."""
        return self._mappings.get("shipping_methods", {})
    
    @property
    def currencies(self) -> Dict[str, str]:
        """Get currency mappings."""
        return self._mappings.get("currencies", {})
    
    @property
    def my_company_cnpjs(self) -> List[str]:
        """Get list of company CNPJs."""
        identifiers = self._my_company.get("identifiers", {})
        return identifiers.get("cnpjs", [])
    
    @property
    def my_company_names(self) -> List[str]:
        """Get list of company names."""
        identifiers = self._my_company.get("identifiers", {})
        return identifiers.get("names", [])
    
    def is_my_company_cnpj(self, cnpj: str) -> bool:
        """Check if CNPJ belongs to our company."""
        # Normalize CNPJ for comparison
        import re
        normalized = re.sub(r'\D', '', cnpj)
        return normalized in [re.sub(r'\D', '', c) for c in self.my_company_cnpjs]
    
    def is_my_company_name(self, name: str) -> bool:
        """Check if name matches our company."""
        name_lower = name.lower()
        for company_name in self.my_company_names:
            if company_name.lower() in name_lower:
                return True
        return False
    
    def map_payment_terms(self, terms: str) -> Optional[str]:
        """Map payment terms string to code."""
        if not terms:
            return None
        
        terms_lower = terms.lower().strip()
        for key, code in self.payment_terms.items():
            if key.lower() in terms_lower or terms_lower in key.lower():
                return code
        return None
    
    def map_shipping_method(self, method: str) -> Optional[str]:
        """Map shipping method string to code."""
        if not method:
            return None
        
        method_upper = method.upper().strip()
        return self.shipping_methods.get(method_upper) or self.shipping_methods.get(method.lower())
    
    def map_currency(self, currency: str) -> Optional[str]:
        """Map currency string to standard code."""
        if not currency:
            return None
        
        currency_upper = currency.upper().strip()
        return self.currencies.get(currency_upper) or self.currencies.get(currency)


# Singleton instance
config = ConfigLoader()
