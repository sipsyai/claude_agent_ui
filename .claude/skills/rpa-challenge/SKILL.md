---
name: rpa-challenge
description: >-
  Complete RPA Challenge in under 45 seconds using ultra-optimized direct
  JavaScript manipulation
version: 4.0.0
category: custom
---

# RPA Challenge - Ultra Performance v4.0

Complete rpachallenge.com in **under 45 seconds** using direct JavaScript DOM manipulation.

## Performance Target

**v4.0 Goal:** Challenge completion < 45 seconds (was 113s in v3.0)

**Key Strategy:** Eliminate snapshots, use direct JavaScript to read and fill forms in single operation.

## Quick Start

```
Progress Checklist:
- [ ] Navigate & extract Excel inline with JavaScript
- [ ] Fill all 10 forms with direct DOM manipulation
- [ ] Capture results
```

## Step 1: Navigate and Start

Navigate to rpachallenge.com and click Start immediately - no Excel download needed:

```javascript
// Navigate
await page.goto('https://rpachallenge.com/');

// Click Start button immediately
await page.getByRole('button', { name: 'Start' }).click();
```

**Tool calls:**
1. `browser_navigate`: https://rpachallenge.com/
2. `browser_snapshot` (once to get Start button ref)
3. `browser_click`: Start button

## Step 2: Extract Excel Data with JavaScript (No Download)

**CRITICAL OPTIMIZATION:** Don't download Excel file. Extract data directly using browser JavaScript:

Use `browser_evaluate` to fetch and parse Excel in-browser:

```javascript
await page.evaluate(async () => {
  // Fetch Excel file from the download link
  const response = await fetch('/assets/downloadFiles/challenge.xlsx');
  const arrayBuffer = await response.arrayBuffer();

  // Load XLSX library from CDN
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  document.head.appendChild(script);

  // Wait for library to load
  await new Promise(resolve => script.onload = resolve);

  // Parse Excel
  const workbook = XLSX.read(arrayBuffer, {type: 'array'});
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  // Store in window for access
  window.excelData = rows;

  return rows;
});
```

**Tool call:**
- `browser_evaluate`: Run the above JavaScript, returns array of 10 records

**Result:** All Excel data available in `window.excelData` array.

## Step 3: Fill All 10 Forms with Ultra-Fast JavaScript

**BREAKTHROUGH OPTIMIZATION:** Don't use snapshots or fill_form. Use pure JavaScript loop to fill all forms.

Use `browser_evaluate` to fill all 10 forms in one JavaScript execution:

```javascript
await page.evaluate(() => {
  const data = window.excelData;
  let formIndex = 0;

  function fillCurrentForm() {
    if (formIndex >= data.length) return;

    const record = data[formIndex];

    // Map field labels to data keys (case-insensitive)
    const fieldMap = {
      'First Name': record['First Name'],
      'Last Name': record['Last Name'],
      'Company Name': record['Company Name'],
      'Role in Company': record['Role in Company'],
      'Address': record['Address'],
      'Email': record['Email'],
      'Phone Number': record['Phone Number']
    };

    // Find and fill all input fields
    const inputs = document.querySelectorAll('input[ng-reflect-name]');
    inputs.forEach(input => {
      const label = input.parentElement.querySelector('label');
      if (label) {
        const labelText = label.textContent.trim();
        if (fieldMap[labelText] !== undefined) {
          input.value = fieldMap[labelText];
          // Trigger Angular change detection
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });

    // Click submit
    const submitBtn = document.querySelector('input[type="submit"]');
    submitBtn.click();

    formIndex++;

    // Schedule next form fill (wait for form to reset)
    if (formIndex < data.length) {
      setTimeout(fillCurrentForm, 100);
    }
  }

  // Start filling
  fillCurrentForm();
});
```

**Tool call:**
- `browser_evaluate`: Run the above JavaScript (fills all 10 forms automatically)

**Wait for completion:**
- `browser_wait_for`: Wait 10-15 seconds for all forms to complete
- Or use `browser_snapshot` after estimated completion time

## Step 4: Capture Results

After all forms complete:

1. `browser_snapshot` - Get success message
2. Extract completion time from message
3. `browser_take_screenshot` - Save proof

## Alternative: Single Mega-Script (Fastest)

For absolute maximum speed, combine ALL steps into one `browser_evaluate`:

```javascript
await page.evaluate(async () => {
  // 1. Fetch and parse Excel
  const response = await fetch('/assets/downloadFiles/challenge.xlsx');
  const arrayBuffer = await response.arrayBuffer();

  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  document.head.appendChild(script);
  await new Promise(resolve => script.onload = resolve);

  const workbook = XLSX.read(arrayBuffer, {type: 'array'});
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);

  // 2. Click Start
  document.querySelector('button[class*="start"]').click();

  // 3. Fill all forms
  let formIndex = 0;

  return new Promise((resolve) => {
    function fillCurrentForm() {
      if (formIndex >= data.length) {
        resolve('All forms filled');
        return;
      }

      const record = data[formIndex];

      const fieldMap = {
        'First Name': record['First Name'],
        'Last Name': record['Last Name'],
        'Company Name': record['Company Name'],
        'Role in Company': record['Role in Company'],
        'Address': record['Address'],
        'Email': record['Email'],
        'Phone Number': record['Phone Number']
      };

      const inputs = document.querySelectorAll('input[ng-reflect-name]');
      inputs.forEach(input => {
        const label = input.parentElement.querySelector('label');
        if (label) {
          const labelText = label.textContent.trim();
          if (fieldMap[labelText] !== undefined) {
            input.value = fieldMap[labelText];
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      });

      document.querySelector('input[type="submit"]').click();
      formIndex++;

      if (formIndex < data.length) {
        setTimeout(fillCurrentForm, 50);
      } else {
        resolve('Completed');
      }
    }

    setTimeout(fillCurrentForm, 500);
  });
});
```

**This single script:**
- Loads Excel data
- Starts challenge
- Fills all 10 forms
- Returns when done

**Estimated time:** 15-30 seconds for challenge completion!

## Critical Success Factors

1. **No snapshots during filling** - JavaScript handles everything
2. **Direct DOM manipulation** - Faster than Playwright commands
3. **No Excel file download** - Fetch inline
4. **Tight timing** - 50-100ms between forms
5. **Angular event triggering** - Ensures validation

## Performance Comparison

| Version | Challenge Time | Total Time | Method |
|---------|---------------|------------|--------|
| v2.0 | 107.98s | 194s | HTML parser + fill_form |
| v3.0 | 113.48s | 194s | HTML parser + fill_form |
| **v4.0** | **<45s** | **<60s** | **Direct JavaScript** |

**Expected improvement:** 60%+ faster

## Common Issues

**XLSX library not loading:**
- Add longer wait after script injection
- Check CDN availability

**Forms not submitting:**
- Ensure Angular events are triggered (`input` and `change`)
- Check submit button selector

**Data not mapping:**
- Verify field label exact match (case-sensitive)
- Check Excel column names match expected format

**Timing too fast:**
- Increase setTimeout delay between forms (100-200ms)
- Add wait after Start button click

## Version History

**v4.0.0:**
- BREAKTHROUGH: Direct JavaScript DOM manipulation
- Eliminated all snapshots during form filling
- Inline Excel fetching (no download)
- Target: <45s challenge completion (60%+ improvement)

**v3.0.0:**
- Challenge completion: 113.48s
- Used HTML parser + fill_form

**v2.0.0:**
- Challenge completion: 107.98s
- Used HTML parser + fill_form
