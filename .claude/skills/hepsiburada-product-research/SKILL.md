---
name: hepsiburada-product-research
description: Use when the user needs to search, filter, analyze products on Hepsiburada.com including price comparison, stock status, and detailed product information
allowed-tools:
  - WebFetch
  - WebSearch
  - Read
  - Write
  - Bash
mcp-tools:
  - playwright
experience_score: 94
training_history:
  - date: "2025-01-30T00:00:00Z"
    score_before: 80
    score_after: 94
    mode: real_execution
    issues_found:
      - "[Major] Search query refinement guidance incomplete - doesn't mention that abbreviated product names (e.g., 'zfold 7') need full official names ('galaxy z fold 7')"
      - "[Minor] No guidance on handling MCP 'response exceeds maximum tokens' error (60k+ token pages)"
      - "[Cosmetic] Price extraction example could be more explicit about calculation steps"
    corrections_made: true
    execution_success: true
    test_case: "Search 'samsung zfold 7' - refined to full name 'samsung galaxy z fold 7', extracted 15 Z Fold products with prices 104K-116K TL, ratings 4.4-4.7★"
  - date: "2025-01-30T23:55:00Z"
    score_before: 69
    score_after: 80
    mode: user_feedback
    issues_found:
      - "[Critical] WebFetch doesn't work - Hepsiburada blocks it, but documentation insisted on WebFetch-first approach"
      - "[Critical] Search returns wrong product category - 'nvidia 4090' returned laptops instead of graphics cards, needs Turkish category keywords"
    corrections_made: true
    execution_success: true
    test_case: "User feedback: WebFetch blocked, search quality issue with generic terms"
  - date: "2025-01-30T23:45:00Z"
    score_before: 55
    score_after: 69
    mode: real_execution
    issues_found:
      - "[Major] Skipped WebFetch primary method - went directly to Playwright (violates documented fallback strategy)"
      - "[Major] Price extraction struggled multiple times - installment pattern (10 x AMOUNT TL) not explicitly documented"
      - "[Minor] Output format doesn't match documented table format (provided summary instead)"
      - "[Minor] Stock/delivery status not extracted (optional field, documentation exists)"
      - "[Minor] Review count not extracted (documentation correct, implementation skipped it)"
      - "[Cosmetic] URL construction bug - double domain prefix (link.href already contains full URL)"
    corrections_made: true
    execution_success: true
    test_case: "Search 'nvidia 4090' - extracted 14 RTX 4090 laptops with prices 136K-220K TL, ratings, price analysis"
  - date: "2025-01-30T22:30:00Z"
    score_before: 29
    score_after: 55
    mode: real_execution
    issues_found:
      - "[Major] Documented CSS selectors outdated - actual structure uses ul[class*='productList'] li article"
      - "[Major] Missing selector fallback strategy documentation (wildcard → regex)"
      - "[Minor] Stock/delivery status extraction not included in standard flow"
      - "[Minor] Output format differs from documented markdown table"
      - "[Cosmetic] Review count selector requires regex, not direct element selector"
    corrections_made: true
    execution_success: true
    test_case: "Search iPhone 15 - extracted 10 products with prices, ratings, review counts"
  - date: "2025-01-30T20:15:00Z"
    score_before: 12
    score_after: 29
    mode: documentation_only
    issues_found:
      - "Missing concrete CSS selector examples for product cards"
      - "No example output format template"
      - "JSON-LD extraction not detailed"
      - "Turkish terms mixed without glossary"
    corrections_made: true
    execution_success: false
  - date: "2025-01-22T19:45:00Z"
    score_before: 0
    score_after: 12
    mode: documentation_only
    issues_found:
      - "Missing WebFetch failure detection method"
      - "No URL structure examples for search and filtering"
      - "Missing implementation details for filtering (URL parameters, interactive methods)"
      - "No HTML parsing guidance or CSS selectors provided"
      - "Insufficient error handling documentation"
      - "No expected output examples for queries"
    corrections_made: true
    execution_success: false
---

# Hepsiburada Product Research Skill

This skill enables comprehensive product research on Hepsiburada.com (Turkish e-commerce platform), including searching, filtering, price comparison, and stock analysis.

## Instructions

1. **Browser Automation**: Use **Playwright MCP tool** to retrieve Hepsiburada pages
   - Hepsiburada blocks automated WebFetch requests, so Playwright is required
   - Navigate to search URLs and use interactive browsing

2. **Search Query Refinement** (IMPORTANT):
   - ⚠️ **Problem**: Generic or abbreviated searches may return wrong product categories
   - **Example Issues**:
     * Searching "nvidia 4090" returns gaming laptops instead of graphics cards
     * Searching "samsung zfold 7" returns generic Samsung phones (422 results, no Z Fold phones)
   - **Solution A - Add Turkish category keywords** to narrow results:
     * For graphics cards: Add **"ekran kartı"** → "nvidia 4090 ekran kartı"
     * For laptops: Add **"laptop"** → "asus laptop"
     * For phones: Add **"cep telefonu"** → "iphone 15 cep telefonu"
   - **Solution B - Use complete/official product names**:
     * Use full model names: "samsung zfold 7" → "samsung galaxy z fold 7" (23 correct results)
     * Include brand-specific prefixes: "zfold" → "galaxy z fold"
     * Avoid abbreviations unless testing first
   - **Category Keywords Reference**:
     * Graphics Card: "ekran kartı"
     * Laptop: "laptop" or "dizüstü bilgisayar"
     * Desktop: "masaüstü bilgisayar"
     * Phone: "cep telefonu" or "telefon"
     * Tablet: "tablet"
     * Monitor: "monitör"
     * Keyboard: "klavye"
     * Mouse: "mouse" or "fare"
     * Headphones: "kulaklık"
     * Processor/CPU: "işlemci"
     * RAM: "ram bellek"
   - **When to refine**: If search results don't match expected product type, add category keyword and re-search

3. **Product Search**:
   - Navigate to hepsiburada.com and search for requested products
   - URL structure: `https://www.hepsiburada.com/ara?q={search_term}`
   - Extract product titles, prices, ratings, and URLs
   - Parse filter options (marka, fiyat aralığı, değerlendirme puanı, kargo, vb.)
   - Key elements to extract (use hierarchy of selectors with fallback):
     * Product cards: `ul[class*="productList"] li article` (primary structure as of 2025)
     * Product title: `a[title]` attribute within article, or `link.getAttribute('title')`
     * Price: Try multiple approaches in order:
       1. **Installment price pattern** (most common): Extract from text like "Peşin fiyatına 10 x 19.959 TL"
          - Regex: `/(\d+)\s*x\s*([\d.]+(?:,\d+)?)\s*TL/`
          - **Important**: This shows the monthly installment amount, multiply by installment count for total price
          - Example calculation: "Peşin fiyatına 10 x 19.959 TL"
            * installments = 10
            * monthlyPrice = 19.959 → remove thousand separator → 19,959 (as decimal: 19959.00)
            * totalPrice = 10 × 19,959 = 199,590 TL
       2. `[data-test-id="price-current-price"]` if available (for non-installment displays)
       3. Any element with `[class*="price"]` containing "TL" without "x" or "fiyatına"
       4. Regex fallback: `/(\d+[.,]\d+(?:[.,]\d+)?\s*TL)/` on article.textContent
     * Rating: `[class*="rating"]` elements, extract numeric value with `.replace(/[^\d,]/g, '')`
     * Review count: Regex pattern `/(\d+)\s*değerlendirme/i` on article text content
     * Product URL: `article querySelector('a')?.href`
       - **Warning**: `link.href` already contains full URL (including domain), don't prepend domain again
       - Clean URL by removing query params: `url.split('?')[0]`
     * Stock/Delivery status: Extract from delivery info elements or "Bugün kargoda" / "Yarın kargoda" text

3. **Filtering**:
   - Apply user-requested filters (price range, brand, rating, etc.)
   - Filter methods:
     * URL parameters: Add query params like `&fiyat=500-1000` for price range
     * Interactive filtering: Use playwright to click filter checkboxes/options
     * Brand filter example: Look for brand filter section and select desired brands
   - Navigate through filtered results (pagination: check for "sonraki sayfa" or page numbers)
   - Extract relevant product data from filtered results

4. **Analysis Tasks**:
   - **Price Comparison**: Compare prices across similar products, identify best deals
   - **Stock Status**: Check product availability (stokta var/yok)
   - **Price Trends**: If historical data available, note price changes
   - **Rating Analysis**: Compare ratings and review counts

5. **Output Format**:
   - **Preferred format**: Markdown table (for easy scanning and comparison)
   - Alternative: Clear numbered list or structured summary (acceptable when table is impractical)
   - Example table format:
     ```
     | Product Name | Price | Rating | Stock | Link |
     |--------------|-------|--------|-------|------|
     | iPhone 15    | 45,999₺ | 4.5★ (230) | ✓ In Stock | [View] |
     ```
   - Example summary format (acceptable):
     ```
     Top 5 Best Deals:
     1. Product Name - Price (Rating) [Link]
     2. ...

     Price Analysis: Lowest X TL, Highest Y TL, Average Z TL
     ```
   - Save detailed results to file if requested
   - Always highlight: best deals (lowest price), best-rated products, and availability status

## Example Queries

- "Hepsiburada'da iPhone 15 ara ve fiyatları karşılaştır"
  * Expected: List of iPhone 15 models with prices, ratings, and links
- "500-1000 TL arası laptop'ları bul ve filtrele"
  * Expected: Filtered laptop listings within price range with specs
- "Samsung televizyon modellerini stok durumlarıyla listele"
  * Expected: Samsung TV models with stock status (stokta/tükendi)
- "En yüksek puanlı kablosuz kulaklıkları göster"
  * Expected: Wireless headphones sorted by rating (4.5+ stars)

## Technical Notes

- **Playwright required**: Hepsiburada blocks WebFetch, use Playwright MCP for all requests
- **Rate limiting**: Be respectful of site resources, don't make excessive requests (wait 1-2s between requests)
- **Data extraction**: Parse HTML carefully, Hepsiburada's structure may change
  * **Selector Strategy Hierarchy** (use in order):
    1. Try specific selectors first (data-test-id attributes)
    2. Use wildcard class selectors `[class*="keyword"]` for dynamic class names
    3. Fallback to regex extraction on text content
    4. Parse structured JSON-LD if available
  * **Handling Dynamic Classes**: Hepsiburada uses generated class names (e.g., `productCard-module_article__HJ97o`). Use wildcards: `[class*="productCard"]` or `article[class*="product"]`
  * **JSON-LD extraction**: Search for `<script type="application/ld+json">` tags containing product data (Product, AggregateRating, Offer schemas)
  * **Regex Extraction**: When selectors fail, extract from text with patterns like `/(\d+[.,]\d+\s*TL)/` for prices, `/(\d+)\s*değerlendirme/i` for reviews
- **Currency**: All prices in Turkish Lira (TL/₺)
- **Error Handling**:
  * Network errors: Retry up to 3 times with exponential backoff
  * Parsing errors: Log issue, skip malformed entries, continue with valid data
  * Selector failures: Use fallback strategy (specific → wildcard → regex → JSON-LD)
  * No results: Inform user, suggest alternative search terms or adding category keywords
  * Wrong product category: Add Turkish category keyword (e.g., "ekran kartı" for graphics cards)
  * Rate limiting (429): Wait 10-30 seconds before retry

## Troubleshooting Common Issues

1. **Wrong product category returned**: Add Turkish category keyword or use full product names (see step 2)
   - Example: "nvidia 4090" → "nvidia 4090 ekran kartı" for graphics cards
   - Example: "samsung zfold 7" → "samsung galaxy z fold 7" for specific models
2. **No products found**: Check if site structure changed, try alternative selector: `document.querySelectorAll('article')` or `ul li a[href*="/p-"]`
3. **Prices not extracting**: Use regex fallback on article.textContent to find TL amounts
4. **Dynamic class names**: Always use wildcard selectors `[class*="..."]` instead of exact class names
5. **Rate limiting**: Wait 30-60 seconds between requests with Playwright
6. **MCP tool "response exceeds maximum tokens" error**:
   - **Problem**: Hepsiburada search pages contain large amounts of HTML (60k+ tokens)
   - **Solution**: Don't use `browser_navigate` or `browser_snapshot` directly for search results
   - **Workaround**: Use `browser_evaluate` with JavaScript to extract only needed data:
     ```javascript
     // Navigate first (ignore response)
     await navigate_page(url);
     await sleep(2);

     // Then extract specific data with evaluate
     const data = await browser_evaluate(() => {
       const products = [];
       document.querySelectorAll('article').forEach(article => {
         // Extract only what you need
       });
       return products;
     });
     ```

## Common Filters on Hepsiburada

- Marka (Brand)
- Fiyat aralığı (Price range)
- Değerlendirme puanı (Rating)
- Kargo seçenekleri (Shipping options)
- Satıcı (Seller)
- Ürün durumu (Product condition: yeni/ikinci el)

## Analysis Capabilities

1. **Price Comparison**: Sort by price, find cheapest/best value
2. **Stock Analysis**: Identify available vs out-of-stock items
3. **Rating-based Ranking**: Sort by customer ratings
4. **Deal Detection**: Identify discounts and special offers
5. **Multi-criteria Comparison**: Balance price, rating, and availability

## Turkish Terms Glossary

- **Ara**: Search
- **Marka**: Brand
- **Fiyat aralığı**: Price range
- **Değerlendirme puanı**: Rating score
- **Kargo**: Shipping/Delivery
- **Satıcı**: Seller
- **Stokta var**: In stock
- **Tükendi**: Out of stock
- **Ürün durumu**: Product condition
- **Yeni**: New
- **İkinci el**: Second-hand/Used
- **Sonraki sayfa**: Next page
