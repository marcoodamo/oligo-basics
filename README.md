# Order Parser MVP

Platform to parse purchase orders (PDFs/text) and generate normalized JSON for Microsoft Dynamics 365 Business Central Sales Order pre-filling.

## Features

- ✅ **PDF Upload** - Extract text from PDF orders using pdfplumber
- ✅ **Text Paste** - Process pasted order text directly
- ✅ **Deterministic Parsing** - Regex-based extraction for CNPJ, IE, dates, emails, phones, currency values
- ✅ **LLM Extraction** - LangChain + OpenAI to fill remaining fields
- ✅ **Anti-hallucination** - LLM only extracts what's present, returns null otherwise
- ✅ **Supplier Detection** - Distinguishes your company from the customer
- ✅ **Normalized Output** - JSON matching Business Central Sales Order schema
- ✅ **Docker Ready** - Single command deployment

## Quick Start

### Prerequisites

- Docker & Docker Compose
- OpenAI API Key

### Setup

1. **Clone and navigate to the project:**
   ```bash
   cd oligobaisc
   ```

2. **Create `.env` file:**
   ```bash
   cp .env.example .env
   # Edit .env and add your OpenAI API key
   ```

3. **Configure your company identifiers** (optional but recommended):
   
   Edit `backend/config/my_company.yaml` and add your company's CNPJs and names. This helps distinguish your company (supplier) from the customer in orders.

4. **Run with Docker Compose:**
   ```bash
   docker compose up --build
   ```

5. **Access the application:**
   - **Frontend:** http://localhost:5173
   - **Backend API:** http://localhost:8000

## API Endpoints

### Health Check

```bash
curl http://localhost:8000/health
```

**Response:**
```json
{"status": "healthy"}
```

### Parse PDF

```bash
curl -X POST http://localhost:8000/parse \
  -F "file=@order.pdf"
```

### Parse Text

```bash
curl -X POST http://localhost:8000/parse/text \
  -H "Content-Type: application/json" \
  -d '{"text": "PEDIDO DE COMPRA Nº 12345\nCNPJ: 12.345.678/0001-90\n..."}'
```

### Response Format

```json
{
  "order": {
    "customer_order_number": "12345",
    "order_date": "2024-01-15",
    "requested_delivery_date": null,
    "promised_delivery_date": null,
    "billing_date": null,
    "currency_code": "BRL",
    "payment_terms_code": "30D",
    "payment_method_code": null,
    "company_bank_account_code": null,
    "shipping_method_code": "CIF",
    "sell_to": {
      "name": "Cliente ABC Ltda",
      "cnpj": "12345678000190",
      "ie": null,
      "phone": "11987654321",
      "email": "compras@cliente.com",
      "contact": "João Silva"
    },
    "bill_to": {
      "address": "Rua Example",
      "number": "123",
      "complement": null,
      "district": "Centro",
      "city": "São Paulo",
      "state": "SP",
      "zip": "01234567",
      "country": "Brasil"
    },
    "ship_to": {
      "address": null,
      "number": null,
      "complement": null,
      "district": null,
      "city": null,
      "state": null,
      "zip": null,
      "country": null
    },
    "notes": null
  },
  "lines": [
    {
      "customer_order_item_no": "1",
      "item_reference_no": "PROD-001",
      "description": "Produto Example",
      "quantity": 1000.0,
      "unit_of_measure": "KG",
      "unit_price_excl_vat": 15.50
    }
  ],
  "warnings": [],
  "document_type": "purchase_order"
}
```

## Batch Processing

Process multiple PDFs from a ZIP file:

```bash
# First, start the backend locally or enter the container
cd backend
pip install -r requirements.txt

# Run batch processing
python -m scripts.run_on_dataset --zip ../data/estilos_pedidos.zip --output ../outputs
```

This generates:
- Individual JSON files in `/outputs/`
- Statistics file `_stats.json`

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | Yes | - | OpenAI API key |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | OpenAI model to use |
| `OCR_ENABLED` | No | `false` | Enable OCR for image PDFs |

### Mappings (`backend/config/mappings.yaml`)

Configure how raw text values map to Business Central codes:

```yaml
payment_terms:
  "30 dias": "30D"
  "à vista": "AVISTA"

shipping_methods:
  "CIF": "CIF"
  "FOB": "FOB"

currencies:
  "R$": "BRL"
  "US$": "USD"
```

### Company Identifiers (`backend/config/my_company.yaml`)

Configure your company's identifiers to prevent confusion with customer data:

```yaml
identifiers:
  cnpjs:
    - "12345678000190"
  names:
    - "OLIGO BASICS"
    - "OLIGO BÁSICS"
```

## Running Tests

```bash
cd backend
pip install -r requirements.txt
python -m pytest tests/ -v
```

## Project Structure

```
oligobaisc/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app
│   │   ├── schemas/          # Pydantic models
│   │   ├── parsers/          # Regex parsers
│   │   ├── extractors/       # PDF & LLM extractors
│   │   ├── graph/            # LangGraph workflow
│   │   └── config/           # Config loader
│   ├── config/               # YAML configurations
│   ├── scripts/              # Batch processing
│   └── tests/                # Unit tests
├── frontend/
│   └── src/
│       ├── App.jsx           # Main React component
│       └── index.css         # Styles
├── data/                     # Sample PDFs (place estilos_pedidos.zip here)
├── outputs/                  # Generated JSON outputs
├── docker-compose.yml
└── .env.example
```

## Pipeline Architecture

```
Input (PDF/Text)
       │
       ▼
┌─────────────────────────────────────────────────────┐
│                   LangGraph Workflow                 │
├─────────────────────────────────────────────────────┤
│  1. Ingest         → Extract text from PDF          │
│  2. Deterministic  → Regex: CNPJ, dates, emails...  │
│  3. Classifier     → Determine document type        │
│  4. LLM Extractor  → OpenAI fills remaining fields  │
│  5. Normalize      → Validate & normalize output    │
└─────────────────────────────────────────────────────┘
       │
       ▼
JSON Output (Business Central schema)
```

## Future Enhancements

- [ ] OCR support for image-based PDFs
- [ ] Business Central API integration
- [ ] Batch upload via frontend
- [ ] Confidence scores per field
- [ ] Custom field mapping UI

## License

MIT
