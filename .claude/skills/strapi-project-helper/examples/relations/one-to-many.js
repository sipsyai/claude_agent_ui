/**
 * ONE-TO-MANY RELATIONSHIP EXAMPLES
 *
 * Örnek: Author (1) ←→ (N) Articles
 * Bir yazar birden fazla makale yazabilir
 */

// ============================================
// SCHEMA DEFINITION
// ============================================

// Author Schema (src/api/author/content-types/author/schema.json)
const authorSchema = {
  "kind": "collectionType",
  "collectionName": "authors",
  "info": {
    "singularName": "author",
    "pluralName": "authors",
    "displayName": "Author"
  },
  "attributes": {
    "name": {
      "type": "string",
      "required": true
    },
    "email": {
      "type": "email",
      "required": true,
      "unique": true
    },
    "bio": {
      "type": "text"
    },
    // ONE-TO-MANY: Bir author'un birden fazla article'ı var
    "articles": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::article.article",
      "mappedBy": "author"  // Article'daki field adı
    }
  }
};

// Article Schema (src/api/article/content-types/article/schema.json)
const articleSchema = {
  "kind": "collectionType",
  "collectionName": "articles",
  "info": {
    "singularName": "article",
    "pluralName": "articles",
    "displayName": "Article"
  },
  "attributes": {
    "title": {
      "type": "string",
      "required": true
    },
    "content": {
      "type": "richtext"
    },
    // MANY-TO-ONE: Bir article'ın bir author'u var
    "author": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::author.author",
      "inversedBy": "articles"  // Author'daki field adı
    }
  }
};

// ============================================
// CREATE OPERATIONS
// ============================================

// 1. Yeni article oluştur ve mevcut author'a bağla
async function createArticleWithAuthor() {
  const article = await strapi.documents('api::article.article').create({
    data: {
      title: "My First Article",
      content: "Article content...",
      author: "author-document-id-123"  // Author'un documentId'si
    }
  });

  console.log('Article created:', article);
  return article;
}

// 2. Author ve article'ları birlikte oluştur
async function createAuthorWithArticles() {
  // Önce author oluştur
  const author = await strapi.documents('api::author.author').create({
    data: {
      name: "John Doe",
      email: "john@example.com",
      bio: "Software developer and writer"
    }
  });

  // Sonra article'ları oluştur
  const article1 = await strapi.documents('api::article.article').create({
    data: {
      title: "Article 1",
      content: "Content 1",
      author: author.documentId
    }
  });

  const article2 = await strapi.documents('api::article.article').create({
    data: {
      title: "Article 2",
      content: "Content 2",
      author: author.documentId
    }
  });

  return { author, articles: [article1, article2] };
}

// ============================================
// READ OPERATIONS (POPULATE)
// ============================================

// 3. Author'u article'ları ile birlikte getir
async function getAuthorWithArticles(authorId) {
  const author = await strapi.documents('api::author.author').findOne({
    documentId: authorId,
    populate: {
      articles: {
        fields: ['title', 'publishedAt'],
        sort: ['publishedAt:desc']
      }
    }
  });

  console.log('Author:', author.name);
  console.log('Articles:', author.articles.length);
  return author;
}

// 4. Article'ı author bilgisi ile getir
async function getArticleWithAuthor(articleId) {
  const article = await strapi.documents('api::article.article').findOne({
    documentId: articleId,
    populate: {
      author: {
        fields: ['name', 'email']
      }
    }
  });

  console.log('Article:', article.title);
  console.log('Author:', article.author.name);
  return article;
}

// 5. Belirli author'un tüm article'larını getir
async function getArticlesByAuthor(authorId) {
  const articles = await strapi.documents('api::article.article').findMany({
    filters: {
      author: {
        documentId: { $eq: authorId }
      }
    },
    populate: ['author'],
    sort: ['publishedAt:desc']
  });

  return articles;
}

// 6. Author'ların article sayıları ile listesi
async function getAuthorsWithArticleCount() {
  const authors = await strapi.documents('api::author.author').findMany({
    populate: {
      articles: {
        fields: ['id']  // Sadece ID'leri getir
      }
    }
  });

  return authors.map(author => ({
    name: author.name,
    articleCount: author.articles.length
  }));
}

// ============================================
// UPDATE OPERATIONS
// ============================================

// 7. Article'ın author'unu değiştir
async function changeArticleAuthor(articleId, newAuthorId) {
  const article = await strapi.documents('api::article.article').update({
    documentId: articleId,
    data: {
      author: newAuthorId
    }
  });

  return article;
}

// 8. Author'un bilgilerini güncelle (article'lar etkilenmez)
async function updateAuthor(authorId, data) {
  const author = await strapi.documents('api::author.author').update({
    documentId: authorId,
    data: {
      name: data.name,
      bio: data.bio
    }
  });

  return author;
}

// ============================================
// DELETE OPERATIONS
// ============================================

// 9. Article sil (author etkilenmez)
async function deleteArticle(articleId) {
  await strapi.documents('api::article.article').delete({
    documentId: articleId
  });

  console.log('Article deleted');
}

// 10. Author sil (article'ları da sil)
async function deleteAuthorAndArticles(authorId) {
  // Önce author'un article'larını bul
  const articles = await strapi.documents('api::article.article').findMany({
    filters: {
      author: {
        documentId: { $eq: authorId }
      }
    }
  });

  // Article'ları sil
  for (const article of articles) {
    await strapi.documents('api::article.article').delete({
      documentId: article.documentId
    });
  }

  // Author'u sil
  await strapi.documents('api::author.author').delete({
    documentId: authorId
  });

  console.log(`Deleted author and ${articles.length} articles`);
}

// ============================================
// REST API EXAMPLES
// ============================================

/**
 * GET - Author'u article'ları ile birlikte getir
 * GET /api/authors/:id?populate=articles
 */

/**
 * GET - Article'ı author ile birlikte getir
 * GET /api/articles/:id?populate=author
 */

/**
 * GET - Belirli author'un article'ları
 * GET /api/articles?filters[author][documentId][$eq]=author-id-123
 */

/**
 * POST - Yeni article oluştur ve author'a bağla
 * POST /api/articles
 * Body:
 * {
 *   "data": {
 *     "title": "My Article",
 *     "content": "Content...",
 *     "author": "author-id-123"
 *   }
 * }
 */

/**
 * PUT - Article'ın author'unu değiştir
 * PUT /api/articles/:id
 * Body:
 * {
 *   "data": {
 *     "author": "new-author-id-456"
 *   }
 * }
 */

// ============================================
// ADVANCED EXAMPLES
// ============================================

// 11. En çok article yazan author'ları getir
async function getTopAuthors(limit = 10) {
  const authors = await strapi.documents('api::author.author').findMany({
    populate: {
      articles: {
        fields: ['id']
      }
    }
  });

  return authors
    .map(author => ({
      name: author.name,
      articleCount: author.articles.length
    }))
    .sort((a, b) => b.articleCount - a.articleCount)
    .slice(0, limit);
}

// 12. Author'un son X article'ını getir
async function getAuthorRecentArticles(authorId, limit = 5) {
  const author = await strapi.documents('api::author.author').findOne({
    documentId: authorId,
    populate: {
      articles: {
        limit: limit,
        sort: ['publishedAt:desc'],
        filters: {
          publishedAt: { $notNull: true }
        }
      }
    }
  });

  return author.articles;
}

// 13. Hiç article'ı olmayan author'ları getir
async function getAuthorsWithoutArticles() {
  const authors = await strapi.documents('api::author.author').findMany({
    populate: {
      articles: {
        fields: ['id']
      }
    }
  });

  return authors.filter(author => author.articles.length === 0);
}

module.exports = {
  createArticleWithAuthor,
  createAuthorWithArticles,
  getAuthorWithArticles,
  getArticleWithAuthor,
  getArticlesByAuthor,
  getAuthorsWithArticleCount,
  changeArticleAuthor,
  updateAuthor,
  deleteArticle,
  deleteAuthorAndArticles,
  getTopAuthors,
  getAuthorRecentArticles,
  getAuthorsWithoutArticles
};
