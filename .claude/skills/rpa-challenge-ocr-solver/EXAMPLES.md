# Examples - RPA Challenge OCR Solver

Comprehensive usage examples for the RPA Challenge OCR Solver skill.

## Table of Contents

- [Basic Usage](#basic-usage)
- [Custom Configuration](#custom-configuration)
- [Debugging Failed Attempts](#debugging-failed-attempts)
- [Custom Regex Patterns](#custom-regex-patterns)
- [Performance Optimization](#performance-optimization)

---

## Basic Usage

### Example 1: Simple Execution

The most straightforward way to solve the challenge:

```python
from scripts.challenge_solver import RPAChallengeSolver
import asyncio

async def main():
    solver = RPAChallengeSolver()
    result = await solver.run()

    if result['success']:
        print("=" * 50)
        print("🎉 CHALLENGE COMPLETED SUCCESSFULLY!")
        print("=" * 50)
        print(f"⏱️  Time elapsed: {result['elapsed_time']:.2f} seconds")
        print(f"📊 Total invoices: {result['records_processed']}")
        print(f"✅ Uploaded records: {result['records_filtered']}")
        print(f"📄 CSV saved to: {result['csv_path']}")
    else:
        print("❌ Challenge failed!")
        for error in result['errors']:
            print(f"   - {error}")

asyncio.run(main())
```

**Output**:
```
==================================================
🎉 CHALLENGE COMPLETED SUCCESSFULLY!
==================================================
⏱️  Time elapsed: 28.45 seconds
📊 Total invoices: 10
✅ Uploaded records: 7
📄 CSV saved to: ./challenge_output/result.csv
```

---

## Custom Configuration

### Example 2: High-Performance Setup

For faster execution with more parallelism:

```python
from scripts.challenge_solver import RPAChallengeSolver
import asyncio

async def main():
    solver = RPAChallengeSolver(
        max_parallel_downloads=10,   # More concurrent downloads
        timeout=110,                  # Tighter deadline
        headless=True,                # Faster browser mode
        output_dir='./fast_run'
    )

    print("🚀 Starting high-performance run...")
    result = await solver.run()

    print(f"\n⚡ Completed in {result['elapsed_time']:.2f}s")
    print(f"   Target: < 110s | Margin: {110 - result['elapsed_time']:.2f}s")

asyncio.run(main())
```

---

### Example 3: Debugging Mode

For troubleshooting with visible browser and verbose logging:

```python
from scripts.challenge_solver import RPAChallengeSolver
import asyncio
import logging

# Enable detailed logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

async def main():
    solver = RPAChallengeSolver(
        headless=False,               # Show browser
        timeout=300,                  # No rush, allow debugging
        output_dir='./debug_output'
    )

    # Enable step-by-step mode
    solver.debug_mode = True

    result = await solver.run()

    # Detailed error analysis
    if not result['success']:
        print("\n🔍 DEBUGGING INFORMATION:")
        print(f"Errors encountered: {len(result['errors'])}")
        for i, error in enumerate(result['errors'], 1):
            print(f"\n{i}. {error}")

asyncio.run(main())
```

---

### Example 4: Using Configuration File

Load settings from external config:

**config.json**:
```json
{
  "max_parallel_downloads": 8,
  "pdf_parser": "pdfplumber",
  "timeout": 115,
  "headless": true,
  "output_dir": "./production_run",
  "date_format": "%m/%d/%Y"
}
```

**Python script**:
```python
import json
import asyncio
from scripts.challenge_solver import RPAChallengeSolver

async def main():
    # Load configuration
    with open('config.json') as f:
        config = json.load(f)

    solver = RPAChallengeSolver(**config)
    result = await solver.run()

    print(f"Success: {result['success']}")

asyncio.run(main())
```

---

## Debugging Failed Attempts

### Example 5: Analyzing Extraction Failures

Test invoice extraction independently:

```python
from scripts.invoice_processor import extract_invoice_data
import os

def test_invoice_extraction(invoice_dir='./challenge_output'):
    """Test extraction on all downloaded invoices"""

    pdf_files = [f for f in os.listdir(invoice_dir) if f.endswith('.pdf')]

    print(f"Testing {len(pdf_files)} invoice(s)...\n")

    for pdf_file in pdf_files:
        pdf_path = os.path.join(invoice_dir, pdf_file)
        print(f"📄 {pdf_file}")

        try:
            data = extract_invoice_data(pdf_path)

            # Check for missing fields
            missing = [k for k, v in data.items() if not v]
            if missing:
                print(f"   ⚠️  Missing fields: {', '.join(missing)}")
            else:
                print(f"   ✅ All fields extracted")

            # Display extracted data
            for field, value in data.items():
                print(f"      {field}: {value}")

        except Exception as e:
            print(f"   ❌ Extraction failed: {e}")

        print()

# Run test
test_invoice_extraction()
```

**Output**:
```
Testing 10 invoice(s)...

📄 invoice_0.pdf
   ✅ All fields extracted
      InvoiceNumber: INV-001
      InvoiceDate: 01/10/2024
      CompanyName: Acme Corporation
      TotalDue: 1,250.00

📄 invoice_1.pdf
   ⚠️  Missing fields: CompanyName
      InvoiceNumber: INV-002
      InvoiceDate: 01/12/2024
      CompanyName:
      TotalDue: 850.50
```

---

### Example 6: CSV Validation Testing

Validate CSV before submitting:

```python
from scripts.challenge_solver import RPAChallengeSolver
import pandas as pd

def validate_csv_detailed(csv_path):
    """Detailed CSV validation with helpful error messages"""

    solver = RPAChallengeSolver()

    print(f"🔍 Validating {csv_path}...\n")

    # Load CSV
    try:
        df = pd.read_csv(csv_path)
        print(f"✅ CSV loaded successfully ({len(df)} rows)")
    except Exception as e:
        print(f"❌ Cannot load CSV: {e}")
        return False

    # Check columns
    expected_cols = ['ID', 'DueDate', 'InvoiceNumber', 'InvoiceDate', 'CompanyName', 'TotalDue']
    if list(df.columns) != expected_cols:
        print(f"❌ Column mismatch!")
        print(f"   Expected: {expected_cols}")
        print(f"   Got: {list(df.columns)}")
        return False
    print(f"✅ Columns correct")

    # Check for missing values
    missing = df.isnull().sum()
    if missing.any():
        print(f"⚠️  Missing values detected:")
        for col, count in missing[missing > 0].items():
            print(f"   - {col}: {count} missing")
    else:
        print(f"✅ No missing values")

    # Check ID order
    if not df['ID'].astype(int).is_monotonic_increasing:
        print(f"❌ IDs not in ascending order")
        return False
    print(f"✅ IDs in correct order")

    # Check date formats
    try:
        pd.to_datetime(df['DueDate'], format='%m/%d/%Y')
        pd.to_datetime(df['InvoiceDate'], format='%m/%d/%Y')
        print(f"✅ Date formats correct")
    except Exception as e:
        print(f"❌ Date format error: {e}")
        return False

    print(f"\n🎉 CSV validation passed!")
    return True

# Test
validate_csv_detailed('./challenge_output/result.csv')
```

---

## Custom Regex Patterns

### Example 7: Invoice Format Variations

Handle different invoice layouts:

```python
import re

# Standard patterns
PATTERNS_STANDARD = {
    'invoice_number': r'Invoice\s*#?\s*:?\s*(\S+)',
    'invoice_date': r'Date\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
    'company_name': r'(?:Company|Bill To)\s*:?\s*([A-Za-z0-9\s&.,]+)',
    'total_due': r'Total\s*Due\s*:?\s*\$?\s*([\d,]+\.?\d{0,2})'
}

# Alternative patterns for different formats
PATTERNS_ALT = {
    'invoice_number': r'(?:Invoice|Inv\.?)\s*(?:Number|No\.?|#)\s*:?\s*(\S+)',
    'invoice_date': r'(?:Invoice\s+)?Date\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
    'company_name': r'(?:Bill\s+To|Customer|Client)\s*:?\s*\n?\s*([A-Za-z0-9\s&.,\'-]+)',
    'total_due': r'(?:Total|Amount)\s*(?:Due|Payable)\s*:?\s*\$?\s*([\d,]+\.?\d{0,2})'
}

def extract_with_fallback(text):
    """Try standard patterns, fall back to alternatives"""

    result = {}

    for field, pattern in PATTERNS_STANDARD.items():
        match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)

        if match:
            result[field] = match.group(1).strip()
        else:
            # Try alternative pattern
            alt_match = re.search(PATTERNS_ALT[field], text, re.IGNORECASE | re.MULTILINE)
            if alt_match:
                result[field] = alt_match.group(1).strip()
            else:
                result[field] = ''

    return result

# Test on sample text
sample_invoice = """
    INVOICE

    Invoice Number: INV-2024-001
    Date: 01/15/2024

    Bill To:
    Acme Corporation
    123 Main St

    Description          Qty    Price
    Consulting Services   10    $125.00

    Subtotal:                   $1,250.00
    Tax:                        $   62.50
    Total Due:                  $1,312.50
"""

data = extract_with_fallback(sample_invoice)
print(data)
# Output: {'invoice_number': 'INV-2024-001', 'invoice_date': '01/15/2024', ...}
```

---

### Example 8: Testing Regex on Sample Invoices

Validate patterns before running challenge:

```python
import re
from pathlib import Path

def test_regex_patterns(sample_pdf_dir='./samples'):
    """Test regex patterns on sample invoices"""

    from scripts.invoice_processor import extract_with_pdfplumber, parse_invoice_fields

    sample_pdfs = list(Path(sample_pdf_dir).glob('*.pdf'))

    print(f"Testing regex on {len(sample_pdfs)} sample invoice(s)...\n")

    for pdf_path in sample_pdfs:
        print(f"📄 {pdf_path.name}")

        # Extract text
        text = extract_with_pdfplumber(str(pdf_path))

        # Parse fields
        fields = parse_invoice_fields(text)

        # Validate
        success = all(v for v in fields.values())

        if success:
            print(f"   ✅ All fields matched")
        else:
            print(f"   ⚠️  Some fields missing")

        for field, value in fields.items():
            status = "✓" if value else "✗"
            print(f"      [{status}] {field}: {value or 'NOT FOUND'}")

        print()

# Run before challenge
test_regex_patterns('./sample_invoices')
```

---

## Performance Optimization

### Example 9: Benchmarking Each Step

Measure performance to identify bottlenecks:

```python
import asyncio
import time
from scripts.challenge_solver import RPAChallengeSolver

class BenchmarkedSolver(RPAChallengeSolver):
    """Solver with performance tracking"""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.timings = {}

    async def run(self):
        """Run with detailed timing"""

        total_start = time.time()

        # Initialize browser
        start = time.time()
        await self.initialize_browser()
        self.timings['browser_init'] = time.time() - start

        # Extract table
        start = time.time()
        table_data = await self.extract_table_data()
        self.timings['table_extraction'] = time.time() - start

        # Download invoices
        start = time.time()
        invoice_urls = [row['invoice_url'] for row in table_data]
        pdf_paths = await self.download_invoices(invoice_urls)
        self.timings['download_invoices'] = time.time() - start

        # Process invoices
        start = time.time()
        records = await self.process_invoices(pdf_paths, table_data)
        self.timings['process_invoices'] = time.time() - start

        # Filter records
        start = time.time()
        filtered = self.filter_by_due_date(records)
        self.timings['filter_records'] = time.time() - start

        # Build CSV
        start = time.time()
        csv_path = self.build_csv(filtered, './result.csv')
        self.timings['build_csv'] = time.time() - start

        # Upload
        start = time.time()
        success = await self.upload_csv(csv_path)
        self.timings['upload_csv'] = time.time() - start

        self.timings['total'] = time.time() - total_start

        return {
            'success': success,
            'timings': self.timings,
            'records_processed': len(records),
            'records_filtered': len(filtered)
        }

async def main():
    solver = BenchmarkedSolver(headless=True)
    result = await solver.run()

    print("\n📊 PERFORMANCE BREAKDOWN")
    print("=" * 50)

    for step, duration in result['timings'].items():
        percentage = (duration / result['timings']['total']) * 100
        print(f"{step:.<30} {duration:>6.2f}s ({percentage:>5.1f}%)")

    print("=" * 50)

asyncio.run(main())
```

**Output**:
```
📊 PERFORMANCE BREAKDOWN
==================================================
browser_init..................   2.34s ( 8.2%)
table_extraction..............   1.12s ( 3.9%)
download_invoices.............   6.78s (23.8%)
process_invoices..............  12.45s (43.7%)
filter_records................   0.23s ( 0.8%)
build_csv.....................   0.89s ( 3.1%)
upload_csv....................   2.11s ( 7.4%)
total.........................  28.47s (100.0%)
==================================================
```

---

### Example 10: Optimized Production Run

Apply all optimizations for fastest execution:

```python
import asyncio
from scripts.challenge_solver import RPAChallengeSolver

async def production_run():
    """Fully optimized challenge run"""

    solver = RPAChallengeSolver(
        max_parallel_downloads=12,    # Maximum parallelism
        pdf_parser='pdfplumber',      # Fastest parser
        timeout=110,                   # Tight deadline
        headless=True,                 # No GUI overhead
        output_dir='/tmp/challenge'    # Fast tmpfs if available
    )

    print("🚀 Starting optimized production run...")
    print("⚙️  Configuration:")
    print(f"   - Parallel downloads: 12")
    print(f"   - PDF parser: pdfplumber")
    print(f"   - Headless mode: enabled")
    print(f"   - Timeout: 110s\n")

    result = await solver.run()

    if result['success']:
        margin = 120 - result['elapsed_time']
        print(f"\n✅ SUCCESS! Completed in {result['elapsed_time']:.2f}s")
        print(f"   Time remaining: {margin:.2f}s")

        if result['elapsed_time'] < 30:
            print("   🏆 EXCELLENT PERFORMANCE!")
        elif result['elapsed_time'] < 60:
            print("   👍 GOOD PERFORMANCE")
    else:
        print(f"\n❌ FAILED after {result['elapsed_time']:.2f}s")
        for error in result['errors']:
            print(f"   - {error}")

asyncio.run(production_run())
```

---

## Integration Examples

### Example 11: Claude Code Integration

Use the skill from Claude Code conversation:

**User**: "Solve the RPA Challenge OCR for me"

**Claude** (using this skill):
```
I'll solve the RPA Challenge OCR using the rpa-challenge-ocr-solver skill.

[Executes skill automatically]

✅ Challenge completed successfully in 27.8 seconds!

Summary:
- Extracted data from 10 invoices
- Filtered to 7 records with passed/today due dates
- Generated and uploaded CSV with exact formatting
- Completed well under the 120-second limit

The challenge has been solved!
```

---

This covers the most common usage scenarios. For API details, see [REFERENCE.md](REFERENCE.md).
