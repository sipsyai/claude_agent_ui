/**
 * ADVANCED FILTERING EXAMPLES
 *
 * Bu dosya Strapi 5'te kullanabileceğiniz tüm filtering örneklerini içerir
 */

// ============================================
// BASİT FİLTRELER
// ============================================

// 1. Exact match (eşittir)
async function findArticleByTitle(title) {
  const articles = await strapi.documents('api::article.article').findMany({
    filters: {
      title: { $eq: title }
    }
  });
  return articles;
}

// 2. Not equal (eşit değil)
async function findNonDraftArticles() {
  const articles = await strapi.documents('api::article.article').findMany({
    filters: {
      status: { $ne: 'draft' }
    }
  });
  return articles;
}

// 3. Greater than / Less than
async function findExpensiveProducts(minPrice, maxPrice) {
  const products = await strapi.documents('api::product.product').findMany({
    filters: {
      price: {
        $gte: minPrice,
        $lte: maxPrice
      }
    }
  });
  return products;
}

// 4. Contains (içerir - case insensitive)
async function searchArticles(searchTerm) {
  const articles = await strapi.documents('api::article.article').findMany({
    filters: {
      title: { $containsi: searchTerm }
    }
  });
  return articles;
}

// 5. Starts with / Ends with
async function findArticlesByPrefix(prefix) {
  const articles = await strapi.documents('api::article.article').findMany({
    filters: {
      title: { $startsWith: prefix }
    }
  });
  return articles;
}

// ============================================
// ARRAY FİLTRELERİ
// ============================================

// 6. In array (dizide var)
async function findArticlesByStatus(statusList) {
  const articles = await strapi.documents('api::article.article').findMany({
    filters: {
      status: { $in: statusList }  // ['published', 'featured']
    }
  });
  return articles;
}

// 7. Not in array (dizide yok)
async function excludeArchivedArticles() {
  const articles = await strapi.documents('api::article.article').findMany({
    filters: {
      status: { $notIn: ['archived', 'deleted'] }
    }
  });
  return articles;
}

// ============================================
// NULL CHECK
// ============================================

// 8. Null check
async function findDraftArticles() {
  const articles = await strapi.documents('api::article.article').findMany({
    filters: {
      publishedAt: { $null: true }  // Yayınlanmamış
    }
  });
  return articles;
}

// 9. Not null check
async function findPublishedArticles() {
  const articles = await strapi.documents('api::article.article').findMany({
    filters: {
      publishedAt: { $notNull: true }  // Yayınlanmış
    }
  });
  return articles;
}

// ============================================
// MANTIKSAL OPERATÖRLER
// ============================================

// 10. AND operatörü
async function findFeaturedPublishedArticles() {
  const articles = await strapi.documents('api::article.article').findMany({
    filters: {
      $and: [
        { featured: { $eq: true } },
        { publishedAt: { $notNull: true } },
        { status: { $eq: 'published' } }
      ]
    }
  });
  return articles;
}

// 11. OR operatörü
async function findArticlesByMultipleCriteria(searchTerm) {
  const articles = await strapi.documents('api::article.article').findMany({
    filters: {
      $or: [
        { title: { $containsi: searchTerm } },
        { content: { $containsi: searchTerm } },
        { tags: { name: { $containsi: searchTerm } } }
      ]
    }
  });
  return articles;
}

// 12. NOT operatörü
async function findNonFeaturedArticles() {
  const articles = await strapi.documents('api::article.article').findMany({
    filters: {
      $not: {
        featured: { $eq: true }
      }
    }
  });
  return articles;
}

// ============================================
// İLİŞKİLİ VERİ FİLTRELEME
// ============================================

// 13. Relation filter (tek seviye)
async function findArticlesByAuthor(authorName) {
  const articles = await strapi.documents('api::article.article').findMany({
    filters: {
      author: {
        name: { $eq: authorName }
      }
    },
    populate: ['author']
  });
  return articles;
}

// 14. Deep relation filter (çok seviye)
async function findArticlesByAuthorCountry(country) {
  const articles = await strapi.documents('api::article.article').findMany({
    filters: {
      author: {
        profile: {
          country: { $eq: country }
        }
      }
    }
  });
  return articles;
}

// 15. Many-to-Many relation filter
async function findArticlesByTag(tagName) {
  const articles = await strapi.documents('api::article.article').findMany({
    filters: {
      tags: {
        name: { $eq: tagName }
      }
    },
    populate: ['tags']
  });
  return articles;
}

// ============================================
// TARİH FİLTRELEME
// ============================================

// 16. Date range filter
async function findArticlesInDateRange(startDate, endDate) {
  const articles = await strapi.documents('api::article.article').findMany({
    filters: {
      publishedAt: {
        $gte: new Date(startDate).toISOString(),
        $lte: new Date(endDate).toISOString()
      }
    }
  });
  return articles;
}

// 17. Son 7 gün
async function findRecentArticles(days = 7) {
  const date = new Date();
  date.setDate(date.getDate() - days);

  const articles = await strapi.documents('api::article.article').findMany({
    filters: {
      publishedAt: {
        $gte: date.toISOString()
      }
    },
    sort: ['publishedAt:desc']
  });
  return articles;
}

// 18. Bu ay
async function findArticlesThisMonth() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const articles = await strapi.documents('api::article.article').findMany({
    filters: {
      publishedAt: {
        $gte: startOfMonth.toISOString(),
        $lte: endOfMonth.toISOString()
      }
    }
  });
  return articles;
}

// ============================================
// KOMPLEKS FİLTRELER
// ============================================

// 19. E-commerce product search
async function searchProducts(filters) {
  const {
    search,
    category,
    minPrice,
    maxPrice,
    minRating,
    inStock,
    tags
  } = filters;

  const queryFilters = { $and: [] };

  // Search in name and description
  if (search) {
    queryFilters.$and.push({
      $or: [
        { name: { $containsi: search } },
        { description: { $containsi: search } }
      ]
    });
  }

  // Category filter
  if (category) {
    queryFilters.$and.push({
      category: {
        slug: { $eq: category }
      }
    });
  }

  // Price range
  if (minPrice || maxPrice) {
    const priceFilter = {};
    if (minPrice) priceFilter.$gte = minPrice;
    if (maxPrice) priceFilter.$lte = maxPrice;
    queryFilters.$and.push({ price: priceFilter });
  }

  // Rating filter
  if (minRating) {
    queryFilters.$and.push({
      averageRating: { $gte: minRating }
    });
  }

  // Stock filter
  if (inStock) {
    queryFilters.$and.push({
      stock: { $gt: 0 }
    });
  }

  // Tags filter
  if (tags && tags.length > 0) {
    queryFilters.$and.push({
      tags: {
        name: { $in: tags }
      }
    });
  }

  const products = await strapi.documents('api::product.product').findMany({
    filters: queryFilters.$and.length > 0 ? queryFilters : {},
    populate: ['category', 'images', 'tags']
  });

  return products;
}

// 20. Blog advanced search
async function advancedBlogSearch(params) {
  const {
    query,           // Arama terimi
    author,          // Yazar ID
    categories,      // Kategori ID'leri (array)
    tags,            // Tag'ler (array)
    featured,        // Featured mi?
    publishedAfter,  // Bu tarihten sonra
    publishedBefore, // Bu tarihten önce
    minViews         // Minimum görüntülenme
  } = params;

  const filters = { $and: [] };

  // Text search
  if (query) {
    filters.$and.push({
      $or: [
        { title: { $containsi: query } },
        { content: { $containsi: query } },
        { excerpt: { $containsi: query } }
      ]
    });
  }

  // Author filter
  if (author) {
    filters.$and.push({
      author: {
        documentId: { $eq: author }
      }
    });
  }

  // Categories filter
  if (categories && categories.length > 0) {
    filters.$and.push({
      categories: {
        documentId: { $in: categories }
      }
    });
  }

  // Tags filter
  if (tags && tags.length > 0) {
    filters.$and.push({
      tags: {
        name: { $in: tags }
      }
    });
  }

  // Featured filter
  if (featured !== undefined) {
    filters.$and.push({
      featured: { $eq: featured }
    });
  }

  // Date range
  if (publishedAfter || publishedBefore) {
    const dateFilter = {};
    if (publishedAfter) {
      dateFilter.$gte = new Date(publishedAfter).toISOString();
    }
    if (publishedBefore) {
      dateFilter.$lte = new Date(publishedBefore).toISOString();
    }
    filters.$and.push({ publishedAt: dateFilter });
  }

  // Views filter
  if (minViews) {
    filters.$and.push({
      views: { $gte: minViews }
    });
  }

  // Always filter published articles
  filters.$and.push({
    publishedAt: { $notNull: true }
  });

  const articles = await strapi.documents('api::article.article').findMany({
    filters: filters.$and.length > 0 ? filters : {},
    populate: ['author', 'categories', 'tags', 'coverImage'],
    sort: ['publishedAt:desc']
  });

  return articles;
}

// ============================================
// DYNAMİC FİLTER BUİLDER
// ============================================

// 21. Reusable filter builder
class FilterBuilder {
  constructor() {
    this.filters = { $and: [] };
  }

  // Exact match
  equals(field, value) {
    this.filters.$and.push({ [field]: { $eq: value } });
    return this;
  }

  // Contains (case-insensitive)
  contains(field, value) {
    this.filters.$and.push({ [field]: { $containsi: value } });
    return this;
  }

  // Greater than / Less than
  range(field, min, max) {
    const rangeFilter = {};
    if (min !== undefined) rangeFilter.$gte = min;
    if (max !== undefined) rangeFilter.$lte = max;
    this.filters.$and.push({ [field]: rangeFilter });
    return this;
  }

  // In array
  in(field, values) {
    this.filters.$and.push({ [field]: { $in: values } });
    return this;
  }

  // Not null
  notNull(field) {
    this.filters.$and.push({ [field]: { $notNull: true } });
    return this;
  }

  // Relation filter
  relation(field, relationField, value) {
    this.filters.$and.push({
      [field]: {
        [relationField]: { $eq: value }
      }
    });
    return this;
  }

  // Build final filter
  build() {
    return this.filters.$and.length > 0 ? this.filters : {};
  }
}

// Kullanım:
async function useFilterBuilder() {
  const filters = new FilterBuilder()
    .contains('title', 'javascript')
    .notNull('publishedAt')
    .range('views', 100, 1000)
    .relation('author', 'name', 'John Doe')
    .build();

  const articles = await strapi.documents('api::article.article').findMany({
    filters
  });

  return articles;
}

// ============================================
// REST API ÖRNEKLER
// ============================================

/**
 * Simple filter
 * GET /api/articles?filters[title][$eq]=Hello World
 */

/**
 * Contains filter
 * GET /api/articles?filters[title][$containsi]=javascript
 */

/**
 * Range filter
 * GET /api/products?filters[price][$gte]=50&filters[price][$lte]=200
 */

/**
 * OR filter
 * GET /api/articles?filters[$or][0][title][$containsi]=javascript&filters[$or][1][content][$containsi]=javascript
 */

/**
 * Relation filter
 * GET /api/articles?filters[author][name][$eq]=John Doe
 */

/**
 * Complex filter
 * GET /api/articles?filters[$and][0][publishedAt][$notNull]=true&filters[$and][1][featured]=true&filters[$and][2][author][name][$eq]=John
 */

module.exports = {
  findArticleByTitle,
  findNonDraftArticles,
  findExpensiveProducts,
  searchArticles,
  findArticlesByPrefix,
  findArticlesByStatus,
  excludeArchivedArticles,
  findDraftArticles,
  findPublishedArticles,
  findFeaturedPublishedArticles,
  findArticlesByMultipleCriteria,
  findNonFeaturedArticles,
  findArticlesByAuthor,
  findArticlesByAuthorCountry,
  findArticlesByTag,
  findArticlesInDateRange,
  findRecentArticles,
  findArticlesThisMonth,
  searchProducts,
  advancedBlogSearch,
  FilterBuilder,
  useFilterBuilder
};
