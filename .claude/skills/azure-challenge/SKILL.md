---
name: azure-challenge
description: Azure RPA OCR v16 - YYYY-MM-DD date format support added
version: 16.0.0
category: custom
---

# Azure RPA OCR v16.0 - Enhanced Date Format Support

Complete https://rpachallengeocr.azurewebsites.net/ in <90s using battle-tested OCR patterns.

## v15 to v16 Critical Improvement

**v15 Problem:**
- OCR didn't handle YYYY-MM-DD date format (e.g., "2019-06-01")
- Only supported "Jun 30, 2019" and similar text formats  
- Agent would miss dates in ISO format

**v16 Solution:**
- Added YYYY-MM-DD pattern: `r'(\d{4}-\d{2}-\d{2})'`
- Parse "2019-06-01" to "01-06-2019" (DD-MM-YYYY)
- Maintains all proven v15 patterns
- Multiple format priority: ISO, slash, text formats

**Confirmed working on:**
- Invoice #284210: "2019-06-01" → "01-06-2019" ✓
- Invoice #284212: "2019-06-01" → "01-06-2019" ✓
- Company: "Aenean LLC" extracted correctly ✓
- Total Due: All amounts extracted ✓
- Filtering: 6/12 past-due invoices ✓

## v14 to v15 Critical Improvement (Previous)

**v14 Problem:**
- OCR failed to extract invoice numbers (missing # prefix pattern)
- Date extraction used wrong format (YYYY-MM-DD instead of DD-MM-YYYY)
- Company name included INVOICE text contamination
- Agent wasted time with trial-and-error on regex patterns

**v15 Solution (from successful 2nd attempt):**
- Invoice number pattern: `r'#\\s*(\\d+)'` - captures `#11577` to `11577`
- Date format: Parse "Jun 30, 2019" to "30-06-2019" (DD-MM-YYYY)
- Company extraction: Skip INVOICE line, find Corp./LLC/Inc. pattern
- Multiple format handling: Try various date formats
- No guessing: Exact working code embedded

## Performance Targets

| Metric | v14 Target | v15 Target |
|--------|------------|------------|
| Duration | <90s | <90s |
| OCR accuracy | Unknown | 100% |
| First attempt | No | Yes |

## Workflow

```
Progress Checklist:
- [ ] Step 1: Setup environment
- [ ] Step 2: Navigate and start challenge
- [ ] Step 3: Extract all 12 rows (3 pages)
- [ ] Step 4: Create CSV and download invoices
- [ ] Step 5: Run proven OCR script
- [ ] Step 6: Upload result
```

## Step 1: Environment Setup

```bash
pip install pytesseract pillow --quiet && mkdir -p temp
```

## Step 2: Navigate and Start

### 2.1 Navigate
```
mcp__playwright__browser_navigate("https://rpachallengeocr.azurewebsites.net/")
```

### 2.2 Click START
```
mcp__playwright__browser_click(element: "START button", ref: "e36")
```

## Step 3: Extract All Pages

### Pattern: Snapshot, Extract, Click

**Page 1:** Take snapshot, Extract data, Click page 2
**Page 2:** Extract data, Click page 3
**Page 3:** Extract data

### 3.1 Page 1 Snapshot
```
mcp__playwright__browser_snapshot()
```

### 3.2 Extraction Code (ALL pages)

```javascript
() => {
  const rows = Array.from(document.querySelectorAll('tbody tr'));
  return rows.map(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length >= 4) {
      return {
        id: cells[1].textContent.trim(),
        dueDate: cells[2].textContent.trim(),
        invoiceUrl: cells[3].querySelector('a')?.getAttribute('href') || ''
      };
    }
    return null;
  }).filter(r => r !== null);
}
```

### 3.3 Click Page 2/3
Use browser_click tool (NOT JavaScript):
```
mcp__playwright__browser_click(element: "page 2 button", ref: "<ref>")
```

## Step 4: Create CSV + Download Invoices

### 4.1 Create data.csv

```bash
cat > temp/data.csv <<'EOF'
ID,DueDate,InvoiceURL
{row1_id},{row1_dueDate},{row1_invoiceUrl}
...
EOF
```

### 4.2 Download invoices

```bash
cd temp && curl --parallel --parallel-max 12 \
  https://rpachallengeocr.azurewebsites.net/invoices/{file1}.jpg -o {file1}.jpg \
  ...
```

## Step 5: Proven OCR Script

**CRITICAL: Use EXACT code - proven from successful execution**

```bash
cat > temp/azure_ocr_v16.py <<'EOFPYTHON'
import pytesseract
from PIL import Image
import csv
import re
from datetime import datetime

pytesseract.pytesseract.tesseract_cmd = r'C:/Program Files/Tesseract-OCR/tesseract.exe'

def extract_invoice_number(text):
    patterns = [
        r'#\s*(\d+)',  # PROVEN: #11577, #284232
        r'Invoice\s*#?\s*:?\s*(\d+)',
        r'Invoice\s*Number\s*:?\s*(\d+)',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1)
    return ""

def extract_date(text):
    # v16: Added YYYY-MM-DD pattern for "2019-06-01" format
    patterns = [
        r'(\d{4}-\d{2}-\d{2})',  # NEW: ISO format YYYY-MM-DD
        r'Date:\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})',
        r'((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})',
        r'(\d{1,2}/\d{1,2}/\d{4})'
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            date_str = match.group(1)
            try:
                # v16: Added %Y-%m-%d format parser
                for fmt in ['%Y-%m-%d', '%b %d, %Y', '%B %d, %Y', '%m/%d/%Y', '%b. %d, %Y']:
                    try:
                        dt = datetime.strptime(date_str, fmt)
                        return dt.strftime('%d-%m-%Y')  # CRITICAL: DD-MM-YYYY
                    except:
                        continue
            except:
                pass
    return ""

def extract_company(text):
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    for i, line in enumerate(lines):
        if i < 5 and len(line) > 3:
            if line.upper() == "INVOICE":
                continue
            if re.search(r'(Corp\.|LLC|Inc\.|Ltd\.|Corporation)', line, re.IGNORECASE):
                company = re.sub(r'\s*INVOICE\s*$', '', line, flags=re.IGNORECASE)
                return company.strip()
    return ""

def extract_total(text):
    lines = text.split('\n')
    lines.reverse()
    patterns = [
        r'Total:\s*\$?\s*([\d,]+\.?\d*)',
        r'Total\s*\$?\s*([\d,]+\.?\d*)',
        r'Amount\s*Due\s*:?\s*\$?\s*([\d,]+\.?\d*)',
    ]
    for line in lines[:15]:
        for pattern in patterns:
            match = re.search(pattern, line, re.IGNORECASE)
            if match:
                total = match.group(1).replace(',', '')
                try:
                    float(total)
                    return total
                except:
                    pass
    return ""

def process_invoice(image_path):
    try:
        img = Image.open(image_path)
        text = pytesseract.image_to_string(img)
        return {
            'InvoiceNo': extract_invoice_number(text),
            'InvoiceDate': extract_date(text),
            'CompanyName': extract_company(text),
            'TotalDue': extract_total(text)
        }
    except:
        return {'InvoiceNo': '', 'InvoiceDate': '', 'CompanyName': '', 'TotalDue': ''}

with open('data.csv', 'r') as f:
    reader = csv.DictReader(f)
    data_rows = list(reader)

results = []
today = datetime.now().date()

for row in data_rows:
    invoice_file = row['InvoiceURL'].split('/')[-1]
    try:
        due_date = datetime.strptime(row['DueDate'], '%d-%m-%Y').date()
    except:
        continue
    if due_date > today:
        continue
    ocr_data = process_invoice(invoice_file)
    results.append({
        'ID': row['ID'],
        'DueDate': row['DueDate'],
        'InvoiceNo': ocr_data['InvoiceNo'],
        'InvoiceDate': ocr_data['InvoiceDate'],
        'CompanyName': ocr_data['CompanyName'],
        'TotalDue': ocr_data['TotalDue']
    })

with open('result.csv', 'w', newline='') as f:
    if results:
        writer = csv.DictWriter(f, fieldnames=['ID', 'DueDate', 'InvoiceNo', 'InvoiceDate', 'CompanyName', 'TotalDue'])
        writer.writeheader()
        writer.writerows(results)
    else:
        f.write('ID,DueDate,InvoiceNo,InvoiceDate,CompanyName,TotalDue\n')

print(f"Processed: {len(data_rows)}, Filtered: {len(results)}")
EOFPYTHON

cd temp && python azure_ocr_v16.py
```

**Key improvements:**
1. Invoice number: `#\s*(\d+)` pattern extracts after #
2. Date: Parse "Jun 30, 2019" to "30-06-2019" (DD-MM-YYYY)
3. Company: Skip INVOICE line, clean suffix
4. Total: Reverse search from bottom

## Step 6: Upload Result

### 6.1 Snapshot
```
mcp__playwright__browser_snapshot()
```

### 6.2 Click file input
```
mcp__playwright__browser_click(element: "file input", ref: "<ref>")
```

### 6.3 Upload file
```
mcp__playwright__browser_file_upload(paths: ["C:/Users/Ali/Documents/Projects/claude_agent_ui/temp/result.csv"])
```

Then click submit.

## Critical Success Factors

### 1. OCR Pattern Priority
The `#\s*(\d+)` pattern MUST be first:
- `#11577` to `11577`
- `#284232` to `284232`

### 2. Date Format
Input: "Jun 30, 2019"
Output: "30-06-2019" (DD-MM-YYYY)

Critical: Challenge expects DD-MM-YYYY, NOT YYYY-MM-DD!

### 3. Company Name Cleaning
- Skip INVOICE header
- Find Corp./LLC/Inc./Ltd. pattern
- Remove INVOICE suffix

### 4. Proven Code
OCR script is proven from actual successful execution. Do not modify regex patterns.

## Common Issues

**Issue:** InvoiceDate empty for "2019-06-01" format
- **Fix (v16):** Added `(\d{4}-\d{2}-\d{2})` pattern and `%Y-%m-%d` parser

**Issue:** InvoiceNo empty
- **Fix:** Ensure # pattern is first

**Issue:** InvoiceDate empty
- **Fix:** Check date format

**Issue:** CompanyName has INVOICE suffix
- **Fix:** Use re.sub to clean

**Issue:** Challenge fails with correct data
- **Fix:** Verify DD-MM-YYYY format

## Why v15 Will Succeed

1. Battle-tested OCR patterns embedded
2. DD-MM-YYYY enforced, company name cleaned
3. No regex guessing
4. <90s target maintained

Expected: 100% first-attempt OCR success

## v16 Validation Results

From user report:
- ✓ Invoice numbers: #284210, #284212 extracted
- ✓ Dates converted: "2019-06-01" → "01-06-2019"
- ✓ Company: "Aenean LLC" extracted
- ✓ Total Due: All amounts extracted
- ✓ Filtering: 6/12 past-due invoices correct
