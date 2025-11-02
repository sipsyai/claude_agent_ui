---
name: movie-challenge
description: >-
  Complete RPA Challenge Movie Search with sentiment analysis using browser
  automation
version: 2.0.0
category: custom
---

# RPA Challenge: Movie Search (v2.0.0)

Automate the Movie Search sentiment analysis challenge at rpachallenge.com.

## ⚠️ Challenge Availability

**Important**: The direct URL `rpachallenge.com/movieSearch` returns 404. Instead:
1. Navigate to `https://rpachallenge.com`
2. Click "Movie Search" link in the navigation menu

## Challenge Overview

**Goal**: Analyze movie reviews and classify them as positive or negative using sentiment analysis.

**Requirements**:
- Add 3 movies to your list (via search or popular movies button)
- For each movie, read and classify all reviews as positive/negative
- Submit assessments for scoring

## Quick Start

```
Progress Checklist:
- [ ] Navigate to rpachallenge.com and find Movie Search
- [ ] Load 3 movies (click "GET POPULAR MOVIES")
- [ ] For each movie, analyze all reviews
- [ ] Classify reviews as positive/negative
- [ ] Submit results
```

## Step 1: Navigate to Challenge

**Navigate to main site:**
```javascript
await page.goto('https://rpachallenge.com');
```

**Click Movie Search link:**
```javascript
await page.click('[href="/movieSearch"]');
// Or use text: await page.getByText('Movie Search').click();
```

**Wait for page load:**
```javascript
await page.waitForSelector('button:has-text("GET POPULAR MOVIES")');
```

## Step 2: Load 3 Movies

**Click button to get popular movies:**
```javascript
await page.click('button:has-text("GET POPULAR MOVIES")');
// XPath alternative: //button[2]
```

**Verify movies loaded:**
Take snapshot to confirm 3 movies appear in your movie list.

## Step 3: Analyze Reviews for Each Movie

**For each movie (repeat 3 times):**

1. **Click movie to view reviews:**
```javascript
// Click first movie in list
await page.click('.movie-item:nth-child(1)');
```

2. **Extract all review texts:**
```javascript
const reviews = await page.$$eval('.review-text', elements =>
    elements.map(el => el.textContent.trim())
);
```

3. **Classify each review:**

**Simple sentiment analysis approach:**
```javascript
function classifySentiment(reviewText) {
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful',
                          'fantastic', 'love', 'best', 'perfect', 'outstanding'];
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'worst',
                          'hate', 'disappointing', 'poor', 'boring', 'waste'];

    const text = reviewText.toLowerCase();
    const positiveCount = positiveWords.filter(word => text.includes(word)).length;
    const negativeCount = negativeWords.filter(word => text.includes(word)).length;

    // Simple scoring: more positive words = positive, more negative = negative
    return positiveCount > negativeCount ? 'positive' : 'negative';
}
```

**Note**: Original challenge uses Azure Text Analytics API with threshold 0.5. For automation without external API, use simple keyword-based classifier above.

4. **Mark reviews as positive/negative:**

For each review, click the appropriate classification button.

```javascript
// Example: Mark first review as positive
await page.click('.review:nth-child(1) .positive-button');

// Example: Mark second review as negative
await page.click('.review:nth-child(2) .negative-button');
```

## Step 4: Submit and Complete

**After classifying all reviews for all movies:**

```javascript
await page.click('button:has-text("Submit")');
```

**Wait for success message:**
```javascript
await page.waitForSelector('.success-message, .congratulations');
```

**Take screenshot of final score:**
```javascript
await page.screenshot({path: 'movie-challenge-complete.png'});
```

## Key XPath Expressions

From GitHub documentation (G1ANT tutorial):
- **GET POPULAR MOVIES button**: `//button[2]`
- **Movie items**: Locate via `.movie-item` or similar class
- **Review text**: Typically in elements with `.review-text` or similar

## Sentiment Analysis Details

**Azure API approach (original):**
- Score range: 0 to 1
- Score > 0.5 = positive review
- Score ≤ 0.5 = negative review
- Values near 0.5 = neutral/indeterminate

**Simplified keyword approach (for automation):**
- Count positive keywords
- Count negative keywords
- Higher count determines classification

## Common Issues

**Issue 1: Direct URL 404**
- **Fix**: Navigate to main site first, then click "Movie Search" menu link

**Issue 2: HTTP/HTTPS Mixed Content Error**
- **Symptom**: `Mixed Content: The page at 'https://rpachallenge.com/movieSearch' was loaded over HTTPS, but requested an insecure resource`
- **Cause**: Backend service uses HTTP endpoint
- **Fix**: Page may still function; proceed with automation or try HTTP version of main site

**Issue 3: Backend Service Unavailable**
- **Symptom**: `Http failure response for http://uipath509.westeurope.cloudapp.azure.com...`
- **Cause**: External sentiment API not responding
- **Fix**: Use local keyword-based classification instead

## Critical Success Factors

1. **Navigate correctly**: Don't use direct `/movieSearch` URL - use menu navigation
2. **Wait for elements**: Use `waitForSelector` before interacting
3. **Simple classification**: Don't rely on external APIs - use keyword matching
4. **Systematic approach**: Process each movie completely before moving to next
5. **Verify at each step**: Take snapshots to confirm movies loaded, reviews visible, etc.

## Performance Tips

- Single snapshot per major step (not after every click)
- Batch review classification when possible
- Use CSS selectors over XPath for speed

## Expected Execution Time

With proper navigation: **2-5 minutes** (depending on review count per movie)
