# Services Guide - Business Logic Katmanı

## Service Nedir?

Service, business logic'i içeren ve controller'lar tarafından kullanılan katmandır. Controller'lar HTTP request/response ile ilgilenirken, Service'ler iş mantığını yürütür.

## Neden Service Kullanmalıyız?

1. **Separation of Concerns**: Controller'dan business logic'i ayırır
2. **Reusability**: Service'ler farklı yerlerden çağrılabilir
3. **Testability**: Business logic'i izole test edilebilir
4. **Maintainability**: Kod daha düzenli ve bakımı kolay

## Service Yapısı

### Dosya Konumu
```
src/api/{api-name}/services/{service-name}.js
```

### Temel Service Şablonu

```javascript
// src/api/article/services/article.js
const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::article.article', ({ strapi }) => ({
  // Custom method
  async customMethod(params) {
    // Business logic here
    const result = await strapi.documents('api::article.article').findMany(params);
    return result;
  }
}));
```

## Custom Service Methods

### 1. Publish/Unpublish Logic

```javascript
module.exports = createCoreService('api::article.article', ({ strapi }) => ({
  async publish(documentId) {
    // Get article
    const article = await strapi.documents('api::article.article').findOne({
      documentId,
      populate: ['author']
    });

    if (!article) {
      throw new Error('Article not found');
    }

    // Update article
    const published = await strapi.documents('api::article.article').update({
      documentId,
      data: {
        publishedAt: new Date(),
        status: 'published'
      }
    });

    // Send notification
    await strapi.service('api::notification.notification').sendEmail({
      to: article.author.email,
      subject: 'Article Published',
      body: `Your article "${article.title}" has been published!`
    });

    // Log activity
    strapi.log.info(`Article published: ${article.title}`);

    return published;
  },

  async unpublish(documentId) {
    return await strapi.documents('api::article.article').update({
      documentId,
      data: {
        publishedAt: null,
        status: 'draft'
      }
    });
  }
}));
```

### 2. View Count Logic

```javascript
module.exports = createCoreService('api::article.article', ({ strapi }) => ({
  async incrementViews(documentId) {
    const article = await strapi.documents('api::article.article').findOne({
      documentId
    });

    if (!article) {
      throw new Error('Article not found');
    }

    return await strapi.documents('api::article.article').update({
      documentId,
      data: {
        views: (article.views || 0) + 1
      }
    });
  },

  async getMostViewed(limit = 10) {
    return await strapi.documents('api::article.article').findMany({
      filters: {
        publishedAt: { $notNull: true }
      },
      sort: ['views:desc'],
      pagination: { limit }
    });
  }
}));
```

### 3. Search Logic

```javascript
module.exports = createCoreService('api::article.article', ({ strapi }) => ({
  async search(query, filters = {}) {
    if (!query || query.length < 3) {
      throw new Error('Search query must be at least 3 characters');
    }

    const searchFilters = {
      $and: [
        {
          $or: [
            { title: { $containsi: query } },
            { content: { $containsi: query } },
            { excerpt: { $containsi: query } }
          ]
        },
        { publishedAt: { $notNull: true } }
      ]
    };

    // Merge with additional filters
    if (Object.keys(filters).length > 0) {
      searchFilters.$and.push(filters);
    }

    return await strapi.documents('api::article.article').findMany({
      filters: searchFilters,
      populate: ['author', 'category', 'tags'],
      sort: ['publishedAt:desc']
    });
  }
}));
```

### 4. Related Articles Logic

```javascript
module.exports = createCoreService('api::article.article', ({ strapi }) => ({
  async getRelated(documentId, limit = 5) {
    // Get current article
    const article = await strapi.documents('api::article.article').findOne({
      documentId,
      populate: ['category', 'tags']
    });

    if (!article) {
      throw new Error('Article not found');
    }

    // Find related articles
    const tagIds = article.tags?.map(tag => tag.documentId) || [];

    const related = await strapi.documents('api::article.article').findMany({
      filters: {
        $and: [
          { documentId: { $ne: documentId } },  // Exclude current
          { publishedAt: { $notNull: true } },
          {
            $or: [
              { category: { documentId: { $eq: article.category?.documentId } } },
              { tags: { documentId: { $in: tagIds } } }
            ]
          }
        ]
      },
      populate: ['author', 'category'],
      pagination: { limit }
    });

    return related;
  }
}));
```

### 5. Statistics Logic

```javascript
module.exports = createCoreService('api::article.article', ({ strapi }) => ({
  async getStats() {
    // Total count
    const total = await strapi.db.query('api::article.article').count();

    // Published count
    const published = await strapi.db.query('api::article.article').count({
      where: {
        publishedAt: { $notNull: true }
      }
    });

    // Views sum
    const viewsResult = await strapi.db.connection.raw(`
      SELECT SUM(views) as total_views
      FROM articles
      WHERE published_at IS NOT NULL
    `);

    const totalViews = viewsResult[0]?.[0]?.total_views || 0;

    // Average views
    const averageViews = published > 0 ? Math.round(totalViews / published) : 0;

    return {
      total,
      published,
      drafts: total - published,
      totalViews,
      averageViews
    };
  }
}));
```

## Service'leri Kullanma

### Controller'dan Service Çağırma

```javascript
// Controller
module.exports = createCoreController('api::article.article', ({ strapi }) => ({
  async publish(ctx) {
    const { id } = ctx.params;

    try {
      // Service'i çağır
      const article = await strapi.service('api::article.article').publish(id);

      return ctx.send({
        data: article,
        message: 'Article published successfully'
      });
    } catch (err) {
      return ctx.badRequest(err.message);
    }
  },

  async search(ctx) {
    const { query, category } = ctx.query;

    try {
      const filters = category ? { category: { slug: { $eq: category } } } : {};
      const results = await strapi.service('api::article.article').search(query, filters);

      return ctx.send({
        data: results,
        meta: {
          count: results.length
        }
      });
    } catch (err) {
      return ctx.badRequest(err.message);
    }
  }
}));
```

### Başka Service'ten Service Çağırma

```javascript
// Notification Service
module.exports = createCoreService('api::notification.notification', ({ strapi }) => ({
  async notifyArticlePublished(articleId) {
    // Article service'ini çağır
    const article = await strapi.service('api::article.article').findOne(articleId);

    // Send email
    await this.sendEmail({
      to: article.author.email,
      subject: 'Article Published',
      body: `Your article "${article.title}" is now live!`
    });
  }
}));
```

### Lifecycle Hook'tan Service Çağırma

```javascript
// src/api/article/content-types/article/lifecycles.js
module.exports = {
  async afterCreate(event) {
    const { result } = event;

    // Service'i çağır
    await strapi.service('api::notification.notification').notifyArticleCreated(
      result.documentId
    );
  }
};
```

## Best Practices

### 1. Single Responsibility

Her service method tek bir iş yapmalı:

```javascript
// KÖTÜ
async createAndPublishArticle(data) {
  const article = await strapi.documents('api::article.article').create({ data });
  await this.publish(article.documentId);
  await this.sendNotification(article);
  await this.updateStats();
  return article;
}

// İYİ
async createArticle(data) {
  return await strapi.documents('api::article.article').create({ data });
}

async publish(documentId) {
  // Only publish logic
}
```

### 2. Error Handling

Her zaman error handling yapın:

```javascript
async publish(documentId) {
  try {
    const article = await strapi.documents('api::article.article').findOne({
      documentId
    });

    if (!article) {
      throw new Error('Article not found');
    }

    if (article.publishedAt) {
      throw new Error('Article already published');
    }

    return await strapi.documents('api::article.article').update({
      documentId,
      data: {
        publishedAt: new Date(),
        status: 'published'
      }
    });
  } catch (err) {
    strapi.log.error('Publish error:', err);
    throw err;
  }
}
```

### 3. Reusable Helper Methods

Yardımcı metodlar oluşturun:

```javascript
module.exports = createCoreService('api::article.article', ({ strapi }) => ({
  // Helper method
  async findByDocumentId(documentId, populate = []) {
    const article = await strapi.documents('api::article.article').findOne({
      documentId,
      populate
    });

    if (!article) {
      throw new Error('Article not found');
    }

    return article;
  },

  // Main methods use helper
  async publish(documentId) {
    const article = await this.findByDocumentId(documentId, ['author']);
    // ... publish logic
  },

  async incrementViews(documentId) {
    const article = await this.findByDocumentId(documentId);
    // ... increment views
  }
}));
```

### 4. Validation

Service'lerde validation yapın:

```javascript
async createArticle(data) {
  // Validate
  if (!data.title || data.title.length < 5) {
    throw new Error('Title must be at least 5 characters');
  }

  if (!data.content || data.content.length < 100) {
    throw new Error('Content must be at least 100 characters');
  }

  // Create
  return await strapi.documents('api::article.article').create({ data });
}
```

## TypeScript ile Service

```typescript
// src/api/article/services/article.ts
import { factories } from '@strapi/strapi';

interface PublishOptions {
  notify?: boolean;
  featured?: boolean;
}

export default factories.createCoreService('api::article.article', ({ strapi }) => ({
  async publish(documentId: string, options: PublishOptions = {}) {
    const { notify = true, featured = false } = options;

    const article = await strapi.documents('api::article.article').update({
      documentId,
      data: {
        publishedAt: new Date(),
        status: 'published',
        featured
      }
    });

    if (notify) {
      await strapi.service('api::notification.notification').sendEmail({
        // ...
      });
    }

    return article;
  }
}));
```

## Kaynaklar

- [Controllers Guide](05-controllers-guide.md)
- [Custom Routes](04-custom-routes.md)
- [Lifecycle Functions](12-lifecycle-functions.md)
- [Official Strapi Services Docs](https://docs.strapi.io/dev-docs/backend-customization/services)
