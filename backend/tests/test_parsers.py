"""
Unit tests for deterministic parsers.
"""

import pytest
from app.parsers import DeterministicParser
from app.parsers.normalizers import (
    normalize_cnpj,
    normalize_date,
    normalize_monetary_value,
    normalize_quantity,
)


class TestCNPJParser:
    """Tests for CNPJ extraction and normalization."""
    
    def test_cnpj_with_formatting(self):
        parser = DeterministicParser()
        text = "CNPJ: 12.345.678/0001-90"
        result = parser.extract_cnpjs(text)
        assert "12345678000190" in result
    
    def test_cnpj_without_formatting(self):
        parser = DeterministicParser()
        text = "CNPJ 12345678000190"
        result = parser.extract_cnpjs(text)
        assert "12345678000190" in result
    
    def test_cnpj_with_spaces(self):
        parser = DeterministicParser()
        text = "CNPJ: 12 345 678 0001 90"
        result = parser.extract_cnpjs(text)
        assert "12345678000190" in result
    
    def test_multiple_cnpjs(self):
        parser = DeterministicParser()
        text = """
        Fornecedor: 11.111.111/0001-11
        Cliente: 22.222.222/0002-22
        """
        result = parser.extract_cnpjs(text)
        assert len(result) == 2
        assert "11111111000111" in result
        assert "22222222000222" in result
    
    def test_normalize_cnpj(self):
        assert normalize_cnpj("12.345.678/0001-90") == "12345678000190"
        assert normalize_cnpj("12345678000190") == "12345678000190"
        assert normalize_cnpj("123") is None  # Invalid
        assert normalize_cnpj("") is None


class TestDateParser:
    """Tests for date extraction and normalization."""
    
    def test_date_dd_mm_yyyy_slash(self):
        parser = DeterministicParser()
        text = "Data: 15/01/2024"
        result = parser.extract_dates(text)
        assert any(d['iso'] == "2024-01-15" for d in result)
    
    def test_date_dd_mm_yyyy_dash(self):
        parser = DeterministicParser()
        text = "Emissão: 05-12-2023"
        result = parser.extract_dates(text)
        assert any(d['iso'] == "2023-12-05" for d in result)
    
    def test_date_iso_format(self):
        parser = DeterministicParser()
        text = "Date: 2024-01-20"
        result = parser.extract_dates(text)
        assert any(d['iso'] == "2024-01-20" for d in result)
    
    def test_normalize_date(self):
        assert normalize_date("15/01/2024") == "2024-01-15"
        assert normalize_date("2024-01-15") == "2024-01-15"
        assert normalize_date("05-12-2023") == "2023-12-05"
        assert normalize_date("invalid") is None


class TestMonetaryParser:
    """Tests for monetary value extraction."""
    
    def test_brl_format(self):
        parser = DeterministicParser()
        text = "Total: R$ 1.234,56"
        result = parser.extract_monetary_values(text)
        assert any(v['value'] == 1234.56 and v['currency'] == 'BRL' for v in result)
    
    def test_usd_format(self):
        parser = DeterministicParser()
        text = "Price: US$ 1,234.56"
        result = parser.extract_monetary_values(text)
        assert any(v['value'] == 1234.56 and v['currency'] == 'USD' for v in result)
    
    def test_dollar_sign(self):
        parser = DeterministicParser()
        text = "Amount: $ 999.99"
        result = parser.extract_monetary_values(text)
        assert any(v['value'] == 999.99 for v in result)
    
    def test_normalize_brl(self):
        assert normalize_monetary_value("1.234,56", "pt-BR") == 1234.56
        assert normalize_monetary_value("10,00", "pt-BR") == 10.0
    
    def test_normalize_usd(self):
        assert normalize_monetary_value("1,234.56", "en-US") == 1234.56
        assert normalize_monetary_value("10.00", "en-US") == 10.0


class TestQuantityParser:
    """Tests for quantity extraction."""
    
    def test_quantity_kg(self):
        parser = DeterministicParser()
        text = "3000 KG de produto"
        result = parser.extract_quantities(text)
        assert any(q['quantity'] == 3000 and q['unit'] == 'KG' for q in result)
    
    def test_quantity_decimal(self):
        parser = DeterministicParser()
        text = "0,5 TON"
        result = parser.extract_quantities(text)
        assert any(q['quantity'] == 0.5 and q['unit'] == 'TON' for q in result)
    
    def test_normalize_quantity(self):
        qty, unit = normalize_quantity("3000 kg")
        assert qty == 3000.0
        assert unit == "KG"
        
        qty, unit = normalize_quantity("0,5 ton")
        assert qty == 0.5
        assert unit == "TON"


class TestEmailParser:
    """Tests for email extraction."""
    
    def test_simple_email(self):
        parser = DeterministicParser()
        text = "Contact: john@example.com"
        result = parser.extract_emails(text)
        assert "john@example.com" in result
    
    def test_email_with_subdomain(self):
        parser = DeterministicParser()
        text = "Email: pedidos@compras.empresa.com.br"
        result = parser.extract_emails(text)
        assert "pedidos@compras.empresa.com.br" in result
    
    def test_multiple_emails(self):
        parser = DeterministicParser()
        text = "CC: a@test.com, b@test.com"
        result = parser.extract_emails(text)
        assert len(result) == 2


class TestPhoneParser:
    """Tests for phone extraction."""
    
    def test_phone_with_ddd(self):
        parser = DeterministicParser()
        text = "Tel: (11) 98765-4321"
        result = parser.extract_phones(text)
        assert len(result) > 0
    
    def test_phone_international(self):
        parser = DeterministicParser()
        text = "+55 11 98765-4321"
        result = parser.extract_phones(text)
        assert len(result) > 0


class TestParseAll:
    """Integration tests for parse_all method."""
    
    def test_complete_order_text(self):
        parser = DeterministicParser()
        text = """
        PEDIDO DE COMPRA Nº 12345
        Data: 15/01/2024
        
        COMPRADOR:
        Empresa ABC Ltda
        CNPJ: 12.345.678/0001-90
        Email: compras@abc.com
        Tel: (11) 3333-4444
        
        ITENS:
        1. Produto X - 500 KG - R$ 10,50/kg
        2. Produto Y - 1000 KG - R$ 8,75/kg
        
        Total: R$ 14.000,00
        Pagamento: 30 dias
        Frete: CIF
        """
        
        result = parser.parse_all(text)
        
        assert len(result['cnpjs']) == 1
        assert result['cnpjs'][0] == "12345678000190"
        assert len(result['emails']) == 1
        assert len(result['dates']) >= 1
        assert len(result['quantities']) >= 2
        assert len(result['monetary_values']) >= 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
