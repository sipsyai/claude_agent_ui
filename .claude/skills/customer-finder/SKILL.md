---
name: customer-finder
description: >-
  Find 30 B2B customers in Turkey for industrial dust filters using Chrome
  DevTools
version: 5.0.0
category: custom
---

# Customer Finder v5.0 - Chrome DevTools Edition

Find 30 B2B customers in Turkey for **MOLICLEN Multi Clean Dust Filter** systems.

**Target:** Un/yem/çimento/boya/plastik/ahşap/deterjan fabrikaları

**Performance:** <5 min for 30 leads

**Primary Tool:** Chrome DevTools MCP

## Quick Start

```
Workflow:
- [ ] Navigate to ISO 500 using Chrome DevTools
- [ ] Extract 40-50 companies from table
- [ ] Visit top 10 websites for contact details
- [ ] Generate CSV with 30 companies
- [ ] Create Turkish summary report
```

## Step 1: Scrape ISO 500

**Navigate and extract:**

1. Navigate: mcp__chrome-devtools__navigate_page to https://www.iso500.org.tr
2. Take snapshot: mcp__chrome-devtools__take_snapshot
3. Click "Tüm Listeyi Gör": mcp__chrome-devtools__click
4. Change dropdown to 100: mcp__chrome-devtools__click
5. Extract: Company name, sector, city from table
6. Filter: Cement, Food, Paint, Plastic, Wood, Chemical sectors

## Step 2: Prioritize

**Select best 30 from extracted list:**
- Priority A: ISO 500 top 100 + perfect sector match
- Priority B: ISO 500 top 200 + good sector match  
- Priority C: ISO 500 top 500 + acceptable match

## Step 3: Enrich Top 10

**Visit websites for contact details:**

For each of top 10 companies:
- mcp__chrome-devtools__new_page
- mcp__chrome-devtools__navigate_page to company site
- mcp__chrome-devtools__take_snapshot
- Extract: phone, email, address
- If not found: use info@[domain]
- mcp__chrome-devtools__close_page
- Time limit: 30 sec per site

## Step 4: Generate CSV

**Use Bash:**

```bash
cat > temp/customer_leads_30.csv << 'CSVEOF'
Company,Sector,Phone,Email,Website,City,Source,Priority,Notes
"Company 1","Cement","+90 XXX","info@company1.com","company1.com.tr","Istanbul","ISO 500 #50","A","Notes"
...
CSVEOF
```

**Requirements:**
- Exactly 30 rows
- Columns: Company,Sector,Phone,Email,Website,City,Source,Priority,Notes
- Priority: 10+ A, 10+ B, remainder C

## Step 5: Turkish Summary

**Create temp/musteri_raporu.md:**

```markdown
# Müşteri Bulma Sonuçları - 30 Türk Üretici

**Tarih:** [Date]
**Toplam:** 30 şirket
**Süre:** [X] dakika

## Öncelik
- A (Sıcak): [X] şirket
- B (Ilık): [X] şirket
- C (Kalifiye): [X] şirket

## Sektör
- Çimento: [X]
- Gıda: [X]
- Boya: [X]
- Plastik: [X]
- Ahşap: [X]
- Deterjan: [X]

## Top 10
1. [Company] - [Sector] - [City]
...

## Dosyalar
- temp/customer_leads_30.csv
```

## Performance Tips

**DO:**
- ✅ Chrome DevTools for ISO 500 scraping
- ✅ Extract 40-50, filter to best 30
- ✅ Visit only top 10 websites
- ✅ Generate CSV immediately

**DON'T:**
- ❌ Visit all 30 websites (too slow)
- ❌ Individual sector searches
- ❌ Wait >30 sec per website

## Common Issues

**Slow website:** Skip after 30 sec
**No contact info:** Use info@[domain]
**Not enough companies:** Include Priority C
**CSV <30:** Lower filter threshold

## Success Criteria

- ✅ Exactly 30 companies in CSV
- ✅ 8+ Priority A leads
- ✅ <5 min execution
- ✅ temp/customer_leads_30.csv created
- ✅ temp/musteri_raporu.md created
- ✅ Contact details for 10+ companies

## Technical Notes

**Tools:** navigate_page, take_snapshot, click, new_page, close_page

**Data Sources:**
- iso500.org.tr (primary)
- Company websites (contact enrichment)

---

**Version History:**
- v5.0.0: Chrome DevTools edition, 30-customer focus, Turkish reports
- v4.0.0: WebSearch 100-customer mode
- v3.0.0: Multi-source
- v2.0.0: Structured
- v1.0.0: Basic

**v4→v5 Changes:**
- ⚡ 100→30 customers (<5 min)
- ⚡ WebSearch→Chrome DevTools
- ⚡ Single source (ISO 500)
- ⚡ Turkish summary report
- ⚡ Top 10 enrichment only
- ⚡ Sequential scraping
