# Sample Order Data

Place your sample order PDFs here for testing.

## Expected File

- `estilos_pedidos.zip` - ZIP file containing various PDF order formats

## Usage

The batch processing script will read from this directory:

```bash
cd backend
python -m scripts.run_on_dataset --zip ../data/estilos_pedidos.zip
```
