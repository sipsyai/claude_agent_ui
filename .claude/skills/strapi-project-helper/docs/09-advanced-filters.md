# Advanced Filters - Gelişmiş Filtreleme

## Filter Operators

Strapi 5'te kullanabileceğiniz tüm filter operator'ları:

### Karşılaştırma Operatörleri

#### $eq - Eşittir
```javascript
// title = "Hello World"
filters: {
  title: { $eq: "Hello World" }
}

// REST API
/api/articles?filters[title][$eq]=Hello World
```

#### $ne - Eşit Değil
```javascript
// status != "draft"
filters: {
  status: { $ne: "draft" }
}
```

#### $lt - Küçüktür
```javascript
// price < 100
filters: {
  price: { $lt: 100 }
}
```

#### $lte - Küçük veya Eşit
```javascript
// price <= 100
filters: {
  price: { $lte: 100 }
}
```

#### $gt - Büyüktür
```javascript
// views > 1000
filters: {
  views: { $gt: 1000 }
}
```

#### $gte - Büyük veya Eşit
```javascript
// rating >= 4.5
filters: {
  rating: { $gte: 4.5 }
}
```

### String Operatörleri

#### $contains - İçerir (case-sensitive)
```javascript
// title içinde "javascript" kelimesi var
filters: {
  title: { $contains: "javascript" }
}
```

#### $containsi - İçerir (case-insensitive)
```javascript
// title içinde "JAVASCRIPT" veya "javascript" var
filters: {
  title: { $containsi: "javascript" }
}
```

#### $startsWith - İle Başlar
```javascript
// title "How to" ile başlıyor
filters: {
  title: { $startsWith: "How to" }
}
```

#### $endsWith - İle Bitiyor
```javascript
// title "?" ile bitiyor
filters: {
  title: { $endsWith: "?" }
}
```

### Array Operatörleri

#### $in - Dizide Var
```javascript
// status "published" veya "draft"
filters: {
  status: { $in: ["published", "draft"] }
}
```

#### $notIn - Dizide Yok
```javascript
// status "deleted" veya "archived" değil
filters: {
  status: { $notIn: ["deleted", "archived"] }
}
```

### Null Check Operatörleri

#### $null - Null mu?
```javascript
// publishedAt null
filters: {
  publishedAt: { $null: true }
}

// publishedAt null değil
filters: {
  publishedAt: { $notNull: true }
}
```

### Between Operatörü

```javascript
// price 50 ile 100 arasında
filters: {
  price: {
    $gte: 50,
    $lte: 100
  }
}

// createdAt son 7 gün içinde
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

filters: {
  createdAt: {
    $gte: sevenDaysAgo.toISOString()
  }
}
```

## Mantıksal Operatörler

### $and - VE Operatörü
```javascript
// published VE featured
filters: {
  $and: [
    { publishedAt: { $notNull: true } },
    { featured: { $eq: true } }
  ]
}
```

### $or - VEYA Operatörü
```javascript
// title'da "javascript" VAR VEYA category "programming"
filters: {
  $or: [
    { title: { $containsi: "javascript" } },
    { category: { name: { $eq: "programming" } } }
  ]
}
```

### $not - DEĞİL Operatörü
```javascript
// status "draft" DEĞİL
filters: {
  $not: {
    status: { $eq: "draft" }
  }
}
```

## İlişkili Veriyi Filtreleme

### One-to-Many İlişkilerde Filtreleme

```javascript
// Author'un adı "John" olan makaleler
const articles = await strapi.documents('api::article.article').findMany({
  filters: {
    author: {
      name: { $eq: "John Doe" }
    }
  }
});

// REST API
/api/articles?filters[author][name][$eq]=John Doe
```

### Many-to-Many İlişkilerde Filtreleme

```javascript
// "javascript" etiketine sahip makaleler
const articles = await strapi.documents('api::article.article').findMany({
  filters: {
    tags: {
      name: { $eq: "javascript" }
    }
  }
});
```

### Deep Relation Filtering

```javascript
// Author'un country'si "USA" olan makaleler
const articles = await strapi.documents('api::article.article').findMany({
  filters: {
    author: {
      profile: {
        country: { $eq: "USA" }
      }
    }
  }
});
```

## Kompleks Filter Senaryoları

### Senaryo 1: Blog Search

```javascript
// Başlık veya içerikte arama + published + kategori
const searchTerm = "javascript";
const category = "tutorial";

const articles = await strapi.documents('api::article.article').findMany({
  filters: {
    $and: [
      {
        $or: [
          { title: { $containsi: searchTerm } },
          { content: { $containsi: searchTerm } },
          { tags: { name: { $containsi: searchTerm } } }
        ]
      },
      { publishedAt: { $notNull: true } },
      { category: { slug: { $eq: category } } }
    ]
  },
  populate: ['author', 'category', 'tags'],
  sort: ['publishedAt:desc']
});

// REST API
/api/articles?filters[$and][0][$or][0][title][$containsi]=javascript&filters[$and][0][$or][1][content][$containsi]=javascript&filters[$and][1][publishedAt][$notNull]=true&filters[$and][2][category][slug][$eq]=tutorial
```

### Senaryo 2: E-commerce Filtering

```javascript
// Fiyat aralığı + kategori + stokta var + rating >= 4
const products = await strapi.documents('api::product.product').findMany({
  filters: {
    $and: [
      { price: { $gte: 50, $lte: 200 } },
      { category: { slug: { $eq: "electronics" } } },
      { stock: { $gt: 0 } },
      { averageRating: { $gte: 4 } }
    ]
  },
  populate: ['category', 'images'],
  sort: ['price:asc']
});
```

### Senaryo 3: Date Range Filtering

```javascript
// Son 30 günde oluşturulan makaleler
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

const articles = await strapi.documents('api::article.article').findMany({
  filters: {
    createdAt: {
      $gte: thirtyDaysAgo.toISOString()
    }
  }
});

// Bu ay publish edilen makaleler
const startOfMonth = new Date();
startOfMonth.setDate(1);
startOfMonth.setHours(0, 0, 0, 0);

const endOfMonth = new Date();
endOfMonth.setMonth(endOfMonth.getMonth() + 1);
endOfMonth.setDate(0);
endOfMonth.setHours(23, 59, 59, 999);

const articles = await strapi.documents('api::article.article').findMany({
  filters: {
    publishedAt: {
      $gte: startOfMonth.toISOString(),
      $lte: endOfMonth.toISOString()
    }
  }
});
```

### Senaryo 4: User-Specific Content

```javascript
// Kullanıcının kendi makaleleri VEYA featured makaleler
const userId = ctx.state.user.id;

const articles = await strapi.documents('api::article.article').findMany({
  filters: {
    $or: [
      { author: { id: { $eq: userId } } },
      {
        $and: [
          { featured: { $eq: true } },
          { publishedAt: { $notNull: true } }
        ]
      }
    ]
  }
});
```

### Senaryo 5: Multi-Tag Filtering

```javascript
// Hem "javascript" HEM "react" etiketlerine sahip makaleler
const requiredTags = ["javascript", "react"];

const articles = await strapi.documents('api::article.article').findMany({
  filters: {
    $and: requiredTags.map(tag => ({
      tags: {
        name: { $eq: tag }
      }
    }))
  }
});
```

## Dynamic Filter Building

### Filter Builder Utility

```javascript
// src/api/article/utils/filter-builder.js
module.exports = {
  buildSearchFilter(searchTerm, fields) {
    if (!searchTerm) return {};

    return {
      $or: fields.map(field => ({
        [field]: { $containsi: searchTerm }
      }))
    };
  },

  buildDateRangeFilter(field, startDate, endDate) {
    const filter = {};

    if (startDate) {
      filter.$gte = new Date(startDate).toISOString();
    }

    if (endDate) {
      filter.$lte = new Date(endDate).toISOString();
    }

    return { [field]: filter };
  },

  buildPriceRangeFilter(minPrice, maxPrice) {
    const filter = {};

    if (minPrice !== undefined) {
      filter.$gte = minPrice;
    }

    if (maxPrice !== undefined) {
      filter.$lte = maxPrice;
    }

    return { price: filter };
  },

  buildCategoryFilter(categories) {
    if (!categories || categories.length === 0) return {};

    return {
      category: {
        slug: { $in: categories }
      }
    };
  },

  combineFilters(...filters) {
    const validFilters = filters.filter(f => Object.keys(f).length > 0);

    if (validFilters.length === 0) return {};
    if (validFilters.length === 1) return validFilters[0];

    return { $and: validFilters };
  }
};
```

### Kullanım:

```javascript
// Controller'da
const filterBuilder = require('../utils/filter-builder');

module.exports = createCoreController('api::article.article', ({ strapi }) => ({
  async find(ctx) {
    const { search, minPrice, maxPrice, categories, startDate, endDate } = ctx.query;

    const filters = filterBuilder.combineFilters(
      filterBuilder.buildSearchFilter(search, ['title', 'content']),
      filterBuilder.buildPriceRangeFilter(minPrice, maxPrice),
      filterBuilder.buildCategoryFilter(categories),
      filterBuilder.buildDateRangeFilter('publishedAt', startDate, endDate)
    );

    const articles = await strapi.documents('api::article.article').findMany({
      filters,
      populate: ['author', 'category'],
      sort: ['publishedAt:desc']
    });

    return ctx.send({ data: articles });
  }
}));
```

## REST API Filter Examples

### Basit Filter
```
/api/articles?filters[title][$eq]=Hello World
```

### Çoklu Filter
```
/api/articles?filters[title][$containsi]=javascript&filters[publishedAt][$notNull]=true
```

### İlişkili Veri Filter
```
/api/articles?filters[author][name][$eq]=John Doe
```

### OR Operatörü
```
/api/articles?filters[$or][0][title][$containsi]=javascript&filters[$or][1][title][$containsi]=typescript
```

### AND Operatörü
```
/api/articles?filters[$and][0][featured]=true&filters[$and][1][publishedAt][$notNull]=true
```

### Kompleks Query
```
/api/articles?filters[$and][0][$or][0][title][$containsi]=javascript&filters[$and][0][$or][1][content][$containsi]=javascript&filters[$and][1][publishedAt][$notNull]=true&filters[$and][2][category][slug][$eq]=tutorial
```

## Performance Tips

### 1. Index Kullanın
```javascript
// Frequently filtered fields için index ekleyin
// src/api/article/content-types/article/schema.json
{
  "attributes": {
    "status": {
      "type": "enumeration",
      "enum": ["draft", "published", "archived"],
      "index": true  // ← Index ekle
    }
  }
}
```

### 2. Limit Kullanın
```javascript
// Her zaman limit belirtin
filters: { /* ... */ },
pagination: {
  page: 1,
  pageSize: 25
}
```

### 3. Select Kullanın
```javascript
// Sadece gerekli field'ları seçin
filters: { /* ... */ },
fields: ['title', 'slug', 'publishedAt']
```

### 4. Deep Filtering'den Kaçının
```javascript
// KÖTÜ - 3 seviye deep filtering
filters: {
  author: {
    profile: {
      settings: {
        notifications: { $eq: true }
      }
    }
  }
}

// İYİ - Daha flat yapı
filters: {
  author: {
    notificationsEnabled: { $eq: true }
  }
}
```

## Common Mistakes

### 1. Case Sensitivity
```javascript
// YANLIŞ - Case-sensitive
filters: {
  title: { $contains: "javascript" }  // "JavaScript" bulamaz
}

// DOĞRU - Case-insensitive
filters: {
  title: { $containsi: "javascript" }  // "JavaScript" da bulur
}
```

### 2. Date Formatting
```javascript
// YANLIŞ
filters: {
  createdAt: { $gte: "2024-01-01" }
}

// DOĞRU - ISO String kullan
filters: {
  createdAt: { $gte: new Date("2024-01-01").toISOString() }
}
```

### 3. Null vs Undefined
```javascript
// YANLIŞ
filters: {
  publishedAt: null  // Çalışmaz
}

// DOĞRU
filters: {
  publishedAt: { $null: true }
}
```

## TypeScript ile Filtering

```typescript
import type { Article } from '../../../types/generated/contentTypes';

interface ArticleFilters {
  title?: { $containsi: string };
  publishedAt?: { $notNull: boolean };
  category?: {
    slug: { $eq: string };
  };
}

const filters: ArticleFilters = {
  title: { $containsi: "javascript" },
  publishedAt: { $notNull: true },
  category: {
    slug: { $eq: "tutorial" }
  }
};

const articles = await strapi.documents('api::article.article').findMany({
  filters
}) as Article[];
```

## Kaynaklar

- [Query Basics](08-query-basics.md)
- [Pagination & Sorting](10-pagination-sorting.md)
- [Query Performance](11-query-performance.md)
- [Official Strapi Filters Docs](https://docs.strapi.io/dev-docs/api/rest/filters-locale-publication)
