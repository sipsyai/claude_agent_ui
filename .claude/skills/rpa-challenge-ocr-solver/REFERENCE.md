# API Reference - RPA Challenge OCR Solver

Complete API documentation for the RPA Challenge OCR Solver skill.

## Table of Contents

- [RPAChallengeSolver Class](#rpachallengesolver-class)
- [InvoiceProcessor Module](#invoiceprocessor-module)
- [Playwright MCP Integration](#playwright-mcp-integration)
- [Data Structures](#data-structures)
- [Configuration Options](#configuration-options)

---

## RPAChallengeSolver Class

Main orchestrator for the RPA Challenge OCR workflow.

### Constructor

```python
RPAChallengeSolver(
    max_parallel_downloads: int = 5,
    pdf_parser: str = 'pdfplumber',
    timeout: int = 115,
    headless: bool = True,
    output_dir: str = './challenge_output'
)
```

**Parameters**:
- `max_parallel_downloads` (int): Number of concurrent invoice downloads (default: 5, recommended: 5-10)
- `pdf_parser` (str): PDF extraction method - `'pdfplumber'` or `'pytesseract'` (default: `'pdfplumber'`)
- `timeout` (int): Maximum execution time in seconds before aborting (default: 115)
- `headless` (bool): Run browser in headless mode for better performance (default: True)
- `output_dir` (str): Directory for downloaded invoices and CSV output (default: `'./challenge_output'`)

**Example**:
```python
solver = RPAChallengeSolver(
    max_parallel_downloads=8,
    timeout=110,
    headless=False  # Set True in production
)
```

---

### Methods

#### `async run()`

Executes the complete challenge workflow.

**Returns**: `dict` with results

```python
{
    'success': bool,
    'elapsed_time': float,
    'records_processed': int,
    'records_filtered': int,
    'csv_path': str,
    'errors': list
}
```

**Raises**:
- `TimeoutError`: If execution exceeds configured timeout
- `ValidationError`: If CSV validation fails
- `PlaywrightError`: If browser automation fails

**Example**:
```python
result = await solver.run()
if result['success']:
    print(f"✓ Completed in {result['elapsed_time']:.2f}s")
    print(f"✓ Processed {result['records_processed']} invoices")
    print(f"✓ Uploaded {result['records_filtered']} records")
else:
    print(f"✗ Failed: {result['errors']}")
```

---

#### `async initialize_browser()`

Initializes Playwright browser and navigates to challenge page.

**Returns**: `None`

**Side Effects**: Sets `self.browser_session` and navigates to URL

**Example**:
```python
await solver.initialize_browser()
# Browser is now ready at rpachallengeocr.azurewebsites.net
```

---

#### `async extract_table_data()`

Extracts all rows from the challenge table.

**Returns**: `list[dict]` - List of table row dictionaries

```python
[
    {
        'id': '1',
        'due_date': '01/15/2024',
        'description': 'Invoice for services',
        'invoice_url': 'https://...'
    },
    ...
]
```

**Raises**:
- `ExtractionError`: If table structure is unexpected

**Example**:
```python
table_rows = await solver.extract_table_data()
print(f"Found {len(table_rows)} invoices")
```

---

#### `async download_invoices(invoice_urls: list)`

Downloads multiple invoices in parallel.

**Parameters**:
- `invoice_urls` (list[str]): List of invoice download URLs

**Returns**: `list[str]` - Paths to downloaded files

**Example**:
```python
urls = [row['invoice_url'] for row in table_rows]
pdf_paths = await solver.download_invoices(urls)
# Returns: ['./challenge_output/invoice_0.pdf', './challenge_output/invoice_1.pdf', ...]
```

---

#### `async process_invoices(pdf_paths: list, table_data: list)`

Extracts data from invoices and merges with table data.

**Parameters**:
- `pdf_paths` (list[str]): Paths to downloaded invoice PDFs
- `table_data` (list[dict]): Table row data from `extract_table_data()`

**Returns**: `list[dict]` - Combined records

```python
[
    {
        'ID': '1',
        'DueDate': '01/15/2024',
        'InvoiceNumber': 'INV-001',
        'InvoiceDate': '01/10/2024',
        'CompanyName': 'Acme Corp',
        'TotalDue': '1,250.00'
    },
    ...
]
```

**Example**:
```python
records = await solver.process_invoices(pdf_paths, table_rows)
```

---

#### `filter_by_due_date(records: list)`

Filters records to include only past or today's due dates.

**Parameters**:
- `records` (list[dict]): All extracted records

**Returns**: `list[dict]` - Filtered records

**Example**:
```python
filtered = solver.filter_by_due_date(all_records)
print(f"Filtered from {len(all_records)} to {len(filtered)} records")
```

---

#### `build_csv(records: list, output_path: str)`

Generates CSV file with exact formatting required by challenge.

**Parameters**:
- `records` (list[dict]): Filtered records to include in CSV
- `output_path` (str): Path where CSV should be saved

**Returns**: `str` - Absolute path to created CSV

**Raises**:
- `ValidationError`: If CSV doesn't meet format requirements

**Example**:
```python
csv_path = solver.build_csv(filtered_records, './result.csv')
solver.validate_csv(csv_path)  # Throws if invalid
```

---

#### `validate_csv(csv_path: str)`

Validates CSV meets challenge requirements.

**Parameters**:
- `csv_path` (str): Path to CSV file

**Returns**: `bool` - True if valid

**Raises**:
- `ValidationError`: With detailed message about what's wrong

**Validation Checks**:
- Column names and order match exactly
- No missing required fields
- Rows in same order as table
- Date formats correct
- No extra whitespace

**Example**:
```python
try:
    solver.validate_csv('./result.csv')
    print("✓ CSV is valid")
except ValidationError as e:
    print(f"✗ CSV validation failed: {e}")
```

---

#### `async upload_csv(csv_path: str)`

Uploads CSV file to complete the challenge.

**Parameters**:
- `csv_path` (str): Absolute path to CSV file

**Returns**: `bool` - True if upload succeeded

**Example**:
```python
success = await solver.upload_csv('/absolute/path/to/result.csv')
if success:
    print("✓ Challenge completed!")
```

---

## InvoiceProcessor Module

Utilities for extracting data from invoice PDFs.

### Functions

#### `extract_invoice_data(pdf_path: str, method: str = 'pdfplumber')`

Extracts structured data from an invoice PDF.

**Parameters**:
- `pdf_path` (str): Path to invoice PDF file
- `method` (str): Extraction method - `'pdfplumber'` or `'pytesseract'` (default: `'pdfplumber'`)

**Returns**: `dict`

```python
{
    'InvoiceNumber': 'INV-001',
    'InvoiceDate': '01/10/2024',
    'CompanyName': 'Acme Corporation',
    'TotalDue': '1,250.00'
}
```

**Example**:
```python
from scripts.invoice_processor import extract_invoice_data

data = extract_invoice_data('./invoice_0.pdf')
print(f"Invoice: {data['InvoiceNumber']}, Total: ${data['TotalDue']}")
```

---

#### `extract_with_pdfplumber(pdf_path: str)`

Fast PDF text extraction (recommended).

**Parameters**:
- `pdf_path` (str): Path to PDF file

**Returns**: `str` - Extracted text

**Performance**: ~0.5-1s per invoice

**Example**:
```python
from scripts.invoice_processor import extract_with_pdfplumber

text = extract_with_pdfplumber('./invoice.pdf')
# Returns full text content
```

---

#### `extract_with_ocr(pdf_path: str)`

OCR-based extraction for image PDFs (slower).

**Parameters**:
- `pdf_path` (str): Path to PDF file

**Returns**: `str` - Extracted text

**Performance**: ~5-10s per invoice

**Requirements**:
- `pytesseract` installed
- Tesseract OCR engine installed on system

**Example**:
```python
from scripts.invoice_processor import extract_with_ocr

text = extract_with_ocr('./scanned_invoice.pdf')
```

---

#### `parse_invoice_fields(text: str)`

Parses invoice fields from extracted text using regex.

**Parameters**:
- `text` (str): Raw text from PDF

**Returns**: `dict` - Structured invoice data

**Regex Patterns**:
```python
PATTERNS = {
    'invoice_number': r'Invoice\s*#?\s*:?\s*(\S+)',
    'invoice_date': r'Date\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
    'company_name': r'(?:Company|Bill To)\s*:?\s*([A-Za-z0-9\s&.,]+)',
    'total_due': r'Total\s*Due\s*:?\s*\$?\s*([\d,]+\.?\d{0,2})'
}
```

**Example**:
```python
from scripts.invoice_processor import parse_invoice_fields

text = extract_with_pdfplumber('./invoice.pdf')
fields = parse_invoice_fields(text)
```

---

## Playwright MCP Integration

### Required MCP Tools

The skill uses these Playwright MCP tools:

#### `browser_navigate(url: str)`

Navigate to challenge page.

```python
await browser_navigate("https://rpachallengeocr.azurewebsites.net/")
```

---

#### `browser_snapshot()`

Capture page accessibility snapshot.

**Returns**: Structured page representation

```python
snapshot = await browser_snapshot()
# Use snapshot to locate elements
```

---

#### `browser_click(element: str, ref: str)`

Click an element on the page.

**Parameters**:
- `element` (str): Human-readable description
- `ref` (str): Element reference from snapshot

```python
await browser_click(
    element="Start button",
    ref="button#start"
)
```

---

#### `browser_evaluate(function: str)`

Execute JavaScript in page context.

**Parameters**:
- `function` (str): JavaScript function as string

**Returns**: Function return value

```python
table_data = await browser_evaluate("""
() => {
    const rows = Array.from(document.querySelectorAll('table tbody tr'));
    return rows.map(row => ({
        id: row.cells[0].innerText,
        dueDate: row.cells[1].innerText,
        invoiceLink: row.querySelector('a').href
    }));
}
""")
```

---

#### `browser_file_upload(paths: list[str])`

Upload file(s) via file chooser.

**Parameters**:
- `paths` (list[str]): Absolute paths to files

```python
await browser_file_upload(
    paths=["/absolute/path/to/result.csv"]
)
```

---

## Data Structures

### TableRow

```python
{
    'id': str,           # Row ID (e.g., "1")
    'due_date': str,     # Due date (e.g., "01/15/2024")
    'description': str,  # Description text
    'invoice_url': str   # URL to download invoice
}
```

### InvoiceData

```python
{
    'InvoiceNumber': str,   # e.g., "INV-001"
    'InvoiceDate': str,     # e.g., "01/10/2024"
    'CompanyName': str,     # e.g., "Acme Corporation"
    'TotalDue': str         # e.g., "1,250.00"
}
```

### ChallengeRecord

```python
{
    'ID': str,              # From table
    'DueDate': str,         # From table
    'InvoiceNumber': str,   # From invoice
    'InvoiceDate': str,     # From invoice
    'CompanyName': str,     # From invoice
    'TotalDue': str         # From invoice
}
```

---

## Configuration Options

### Environment Variables

```bash
# Optional: Override default settings
export RPA_CHALLENGE_HEADLESS=true
export RPA_CHALLENGE_TIMEOUT=110
export RPA_CHALLENGE_MAX_DOWNLOADS=8
export RPA_CHALLENGE_OUTPUT_DIR=/tmp/challenge
```

### Config File

Create `config.json` in project root:

```json
{
  "challenge_url": "https://rpachallengeocr.azurewebsites.net/",
  "max_parallel_downloads": 8,
  "pdf_parser": "pdfplumber",
  "timeout_seconds": 115,
  "headless": true,
  "output_directory": "./challenge_output",
  "retry_attempts": 3,
  "download_timeout": 10,
  "date_format": "%m/%d/%Y"
}
```

**Load config**:
```python
import json

with open('config.json') as f:
    config = json.load(f)

solver = RPAChallengeSolver(**config)
```

---

## Error Classes

### `TimeoutError`

Raised when challenge exceeds time limit.

```python
try:
    await solver.run()
except TimeoutError as e:
    print(f"Challenge timed out: {e}")
```

### `ValidationError`

Raised when CSV validation fails.

```python
try:
    solver.validate_csv('./result.csv')
except ValidationError as e:
    print(f"CSV invalid: {e}")
    # e.details contains list of validation errors
```

### `ExtractionError`

Raised when unable to extract data from invoice.

```python
try:
    data = extract_invoice_data('./invoice.pdf')
except ExtractionError as e:
    print(f"Extraction failed: {e}")
```

### `PlaywrightError`

Raised when browser automation fails.

```python
try:
    await browser_click(element="Button", ref="btn_ref")
except PlaywrightError as e:
    print(f"Browser error: {e}")
```

---

## Performance Tuning

### Recommended Settings by Invoice Count

| Invoices | max_parallel_downloads | timeout | Expected Time |
|----------|------------------------|---------|---------------|
| 5-10     | 5                      | 115s    | 20-30s        |
| 10-20    | 8                      | 115s    | 35-50s        |
| 20-30    | 10                     | 110s    | 50-70s        |
| 30+      | 12                     | 110s    | 70-100s       |

### Memory Usage

- **Per Invoice**: ~5-10 MB
- **Peak Usage** (20 invoices): ~200-300 MB
- **Browser Overhead**: ~100-150 MB

### CPU Usage

- **pdfplumber**: Low CPU, I/O bound
- **pytesseract**: High CPU, compute bound
- **Parallel downloads**: Moderate CPU, network bound
