# Motadata Service Creator API Skill

Automate service creation and custom field management in Motadata ServiceOps platform using Python REST API.

## When to Use This Skill

Use when the user wants to:
- Create service categories in Motadata
- Create services in Motadata
- Import multiple services from CSV file
- Bulk create categories and services
- Add custom form fields (text input, textarea, dropdown) to service catalogs
- Bulk add custom fields to existing services from CSV
- **Analyze and convert user-provided CSV to Motadata-compatible format**
- **Fix CSV formatting issues (improper quoting, comma handling)**

## Files Available

**Service & Category Management:**
- `create_category.py` - Create a single service category
- `import_services.py` - Import categories and services from CSV (auto-creates missing categories, publishes immediately)
- `services_import.csv` - CSV file with categories and services to import

**Form Field Management:**
- `add_text_field.py` - Add text input fields (single-line or multi-line)
- `add_dropdown_field.py` - Add dropdown (select) fields
- `add_form_field.py` - Unified script to add fields and list existing fields
- `add_fields_from_csv.py` - Bulk add custom fields to services from CSV

## Quick Start

### 1. Create Single Category

```bash
cd .claude/skills/motadata-service-creator-api
python create_category.py "IT Support" "IT support and technical assistance"
```

### 2. Bulk Import Services from CSV

```bash
cd .claude/skills/motadata-service-creator-api
python import_services.py
```

**CSV Format (services_import.csv):**
```csv
Service Name,Custom Fields
Email Yönetimi,"Talep Türü: dropdown(option1,option2); Email: text"
```

### 3. Add Text Field to Service

```bash
# Single-line text
python add_text_field.py 67 "Full Name" "Enter your full name"

# Multi-line textarea
python add_text_field.py 67 "Comments" "Enter comments" False True

# List all fields
python add_form_field.py 67 list
```

### 4. Add Dropdown Field to Service

```bash
python add_dropdown_field.py 67 "Priority" "Low,Medium,High,Critical"
```

### 5. Bulk Add Custom Fields from CSV

```bash
# Single service
python add_fields_from_csv.py "Email Yönetimi"

# All services (takes 5-10 minutes for 86 services)
python add_fields_from_csv.py all
```

## CSV Format Details

**Service Import CSV:**
```csv
Service Category,Service Name,Service Description
IT Support,Email Management,Email and mailbox management services
```

**Custom Fields CSV:**
```csv
Service Name,Custom Fields
Service1,"Field1: text; Field2: dropdown(opt1,opt2,opt3)"
```

**Field Format:**
- `Field Name: text` - Text input
- `Field Name: dropdown(option1,option2)` - Dropdown with options
- Multiple fields separated by `;`

## Credentials

All credentials in `.env` file:
```bash
MOTADATA_URL=https://themarmara.serviceops.ai/
MOTADATA_CLIENT_ID=api-client
MOTADATA_CLIENT_SECRET=xxx
MOTADATA_USERNAME=user
MOTADATA_PASSWORD=pass
```

## Key Features

**Service Management:**
- ✅ Auto-creates missing categories
- ✅ Services created as 'published' (ready to use immediately)
- ✅ UTF-8 Turkish character support
- ✅ Auto-truncates long descriptions (max 1000 chars)

**Field Management:**
- ✅ Text input (single-line and multi-line)
- ✅ Dropdown fields with custom options
- ✅ Bulk add fields from CSV
- ✅ Auto-finds service IDs by name
- ✅ Skips duplicate fields

## CSV Format Conversion

If your CSV has improper formatting (fields not quoted, commas in values causing parsing errors), use this Python snippet to auto-fix:

```bash
cd .claude/skills/motadata-service-creator-api
python -c "
import csv
from pathlib import Path

input_csv = 'your_file.csv'
output_csv = 'services_import.csv'

# Read with manual parsing
with open(input_csv, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Parse: split only on first comma
data = []
for line in lines[1:]:  # Skip header
    if not line.strip():
        continue
    comma_idx = line.find(',')
    if comma_idx == -1:
        continue
    service_name = line[:comma_idx]
    custom_fields = line[comma_idx+1:].strip()
    data.append({'Service Name': service_name, 'Custom Fields': custom_fields})

# Write with proper quoting
with open(output_csv, 'w', encoding='utf-8', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=['Service Name', 'Custom Fields'], quoting=csv.QUOTE_ALL)
    writer.writeheader()
    writer.writerows(data)

print(f'Fixed CSV written to: {output_csv}')
"
```

**What it does:**
- Reads improperly formatted CSV
- Splits only on first comma (service name vs custom fields)
- Writes properly quoted CSV with `QUOTE_ALL`
- Handles Turkish characters (UTF-8)
- Prevents comma-related parsing errors

## Common Issues

**Field already exists:** Normal if running multiple times. Script skips duplicates.

**Service not found:** Verify service name matches exactly (case-sensitive).

**Reserved field name:** Some names like "Department", "Status" are reserved. Use alternatives.

**Slow processing:** Expected for bulk operations (86 services = ~600 API calls, 5-10 minutes).

**CSV parsing errors:** Use the CSV format conversion script above to fix quoting issues.

## Python Dependencies

```bash
pip install requests
```

No other dependencies needed!
