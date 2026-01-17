"""
Batch processing script for order parsing.
Runs on a ZIP file containing multiple PDFs.

Usage:
    python -m scripts.run_on_dataset --zip data/estilos_pedidos.zip
"""

import argparse
import json
import os
import sys
import zipfile
from pathlib import Path
from typing import Dict, List
import logging

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.graph import parse_order

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def process_zip(zip_path: str, output_dir: str) -> Dict:
    """
    Process all PDFs in a ZIP file.
    
    Args:
        zip_path: Path to the ZIP file
        output_dir: Directory to save output JSON files
    
    Returns:
        Statistics dictionary
    """
    stats = {
        "total": 0,
        "success": 0,
        "failed": 0,
        "with_cnpj": 0,
        "with_items": 0,
        "with_order_number": 0,
        "errors": [],
    }
    
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    with zipfile.ZipFile(zip_path, 'r') as zf:
        # Get all PDF files
        pdf_files = [f for f in zf.namelist() if f.lower().endswith('.pdf')]
        stats["total"] = len(pdf_files)
        
        logger.info(f"Found {len(pdf_files)} PDF files in {zip_path}")
        
        for pdf_name in pdf_files:
            logger.info(f"Processing: {pdf_name}")
            
            try:
                # Read PDF content
                pdf_bytes = zf.read(pdf_name)
                
                # Parse order
                result = parse_order(pdf_bytes, input_type="pdf")
                parsed = result.get("result", {})
                
                # Generate output filename
                output_name = Path(pdf_name).stem + ".json"
                output_file = output_path / output_name
                
                # Save result
                output_data = {
                    "source_file": pdf_name,
                    "document_type": result.get("document_type", "unknown"),
                    "warnings": result.get("warnings", []),
                    "order": parsed.get("order", {}),
                    "lines": parsed.get("lines", []),
                }
                
                with open(output_file, 'w', encoding='utf-8') as f:
                    json.dump(output_data, f, indent=2, ensure_ascii=False)
                
                # Update stats
                stats["success"] += 1
                
                order = parsed.get("order", {})
                sell_to = order.get("sell_to", {})
                
                if sell_to.get("cnpj"):
                    stats["with_cnpj"] += 1
                
                if parsed.get("lines"):
                    stats["with_items"] += 1
                
                if order.get("customer_order_number"):
                    stats["with_order_number"] += 1
                
                logger.info(f"  ✓ Saved to {output_file}")
                
            except Exception as e:
                logger.error(f"  ✗ Error processing {pdf_name}: {e}")
                stats["failed"] += 1
                stats["errors"].append({
                    "file": pdf_name,
                    "error": str(e)
                })
    
    return stats


def print_stats(stats: Dict):
    """Print processing statistics."""
    print("\n" + "=" * 50)
    print("BATCH PROCESSING RESULTS")
    print("=" * 50)
    print(f"Total files:         {stats['total']}")
    print(f"Successful:          {stats['success']}")
    print(f"Failed:              {stats['failed']}")
    print("-" * 50)
    print(f"With CNPJ detected:  {stats['with_cnpj']}")
    print(f"With items detected: {stats['with_items']}")
    print(f"With order number:   {stats['with_order_number']}")
    
    if stats['errors']:
        print("\nErrors:")
        for err in stats['errors']:
            print(f"  - {err['file']}: {err['error']}")
    
    print("=" * 50)


def main():
    parser = argparse.ArgumentParser(description="Process order PDFs from a ZIP file")
    parser.add_argument(
        "--zip",
        required=True,
        help="Path to ZIP file containing PDFs"
    )
    parser.add_argument(
        "--output",
        default="outputs",
        help="Output directory for JSON files (default: outputs)"
    )
    
    args = parser.parse_args()
    
    if not os.path.exists(args.zip):
        print(f"Error: ZIP file not found: {args.zip}")
        sys.exit(1)
    
    stats = process_zip(args.zip, args.output)
    print_stats(stats)
    
    # Save stats
    stats_file = Path(args.output) / "_stats.json"
    with open(stats_file, 'w') as f:
        json.dump(stats, f, indent=2)
    print(f"\nStats saved to {stats_file}")


if __name__ == "__main__":
    main()
