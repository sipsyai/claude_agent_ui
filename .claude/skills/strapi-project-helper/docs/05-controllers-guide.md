# Custom Controllers Guide

## Controller Nedir?

Controller, HTTP request'leri handle eden ve response dönen fonksiyonlardır. Strapi'de her Content Type için otomatik controller'lar oluşturulur, ancak custom controller'lar yazarak bu davranışı özelleştirebilirsiniz.

## Controller Yapısı

### Dosya Konumu
```
src/api/{api-name}/controllers/{controller-name}.js
```

### Temel Controller Şablonu

```javascript
// src/api/article/controllers/article.js
const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::article.article', ({ strapi }) => ({
  // Custom action
  async customAction(ctx) {
    try {
      // Business logic
      const data = await strapi.service('api::article.article').customMethod();

      return ctx.send({
        data,
        message: 'Success'
      });
    } catch (err) {
      ctx.badRequest('An error occurred', { error: err.message });
    }
  }
}));
```

## Default Controller Actions Override

Strapi'nin default CRUD action'larını override edebilirsiniz:

### 1. find() - Liste Getirme

```javascript
module.exports = createCoreController('api::article.article', ({ strapi }) => ({
  async find(ctx) {
    // Sadece publish edilmiş makaleleri getir
    ctx.query = {
      ...ctx.query,
      filters: {
        ...ctx.query.filters,
        publishedAt: { $notNull: true }
      }
    };

    // Default find'ı çağır
    const { data, meta } = await super.find(ctx);

    // Response'u özelleştir
    return {
      data,
      meta,
      customField: 'Custom value'
    };
  }
}));
```

### 2. findOne() - Tekil Kayıt Getirme

```javascript
module.exports = createCoreController('api::article.article', ({ strapi }) => ({
  async findOne(ctx) {
    const { id } = ctx.params;

    // View count artır
    await strapi.service('api::article.article').incrementViewCount(id);

    // Default findOne'ı çağır
    const response = await super.findOne(ctx);

    return response;
  }
}));
```

### 3. create() - Yeni Kayıt Oluşturma

```javascript
module.exports = createCoreController('api::article.article', ({ strapi }) => ({
  async create(ctx) {
    // Gelen user'ı otomatik author olarak ayarla
    ctx.request.body.data = {
      ...ctx.request.body.data,
      author: ctx.state.user.id,
      publishedAt: null  // Draft olarak oluştur
    };

    // Default create'i çağır
    const response = await super.create(ctx);

    // Email notification gönder
    await strapi.service('api::notification.notification').sendEmail({
      to: 'admin@example.com',
      subject: 'New Article Created',
      body: `New article created: ${response.data.title}`
    });

    return response;
  }
}));
```

### 4. update() - Kayıt Güncelleme

```javascript
module.exports = createCoreController('api::article.article', ({ strapi }) => ({
  async update(ctx) {
    const { id } = ctx.params;

    // Permission check
    const article = await strapi.documents('api::article.article').findOne({
      documentId: id
    });

    if (article.author.id !== ctx.state.user.id) {
      return ctx.forbidden('You can only edit your own articles');
    }

    // Update işlemini yap
    const response = await super.update(ctx);

    // Log tut
    await strapi.service('api::audit-log.audit-log').create({
      action: 'update',
      entity: 'article',
      entityId: id,
      user: ctx.state.user.id
    });

    return response;
  }
}));
```

### 5. delete() - Kayıt Silme

```javascript
module.exports = createCoreController('api::article.article', ({ strapi }) => ({
  async delete(ctx) {
    const { id } = ctx.params;

    // Soft delete kullan
    const response = await strapi.documents('api::article.article').update({
      documentId: id,
      data: {
        deletedAt: new Date(),
        isDeleted: true
      }
    });

    return ctx.send({
      data: response,
      message: 'Article soft deleted'
    });
  }
}));
```

## Custom Actions (Yeni Endpoint'ler)

### 1. Basit Custom Action

```javascript
module.exports = createCoreController('api::article.article', ({ strapi }) => ({
  async publish(ctx) {
    const { id } = ctx.params;

    const article = await strapi.documents('api::article.article').update({
      documentId: id,
      data: {
        publishedAt: new Date(),
        status: 'published'
      }
    });

    return ctx.send({
      data: article,
      message: 'Article published successfully'
    });
  }
}));
```

Route tanımı:
```javascript
// src/api/article/routes/article.js
module.exports = {
  routes: [
    {
      method: 'PUT',
      path: '/articles/:id/publish',
      handler: 'article.publish',
      config: {
        policies: [],
        middlewares: []
      }
    }
  ]
};
```

### 2. Search Endpoint

```javascript
module.exports = createCoreController('api::article.article', ({ strapi }) => ({
  async search(ctx) {
    const { query } = ctx.query;

    if (!query) {
      return ctx.badRequest('Query parameter is required');
    }

    const articles = await strapi.documents('api::article.article').findMany({
      filters: {
        $or: [
          { title: { $containsi: query } },
          { content: { $containsi: query } },
          { tags: { name: { $containsi: query } } }
        ],
        publishedAt: { $notNull: true }
      },
      populate: ['author', 'category'],
      sort: ['publishedAt:desc']
    });

    return ctx.send({
      data: articles,
      meta: {
        query,
        count: articles.length
      }
    });
  }
}));
```

### 3. Bulk Operations

```javascript
module.exports = createCoreController('api::article.article', ({ strapi }) => ({
  async bulkPublish(ctx) {
    const { ids } = ctx.request.body;

    if (!ids || !Array.isArray(ids)) {
      return ctx.badRequest('ids array is required');
    }

    const results = await Promise.all(
      ids.map(id =>
        strapi.documents('api::article.article').update({
          documentId: id,
          data: {
            publishedAt: new Date(),
            status: 'published'
          }
        })
      )
    );

    return ctx.send({
      data: results,
      meta: {
        published: results.length
      }
    });
  }
}));
```

### 4. File Upload Endpoint

```javascript
module.exports = createCoreController('api::article.article', ({ strapi }) => ({
  async uploadCover(ctx) {
    const { id } = ctx.params;
    const { files } = ctx.request;

    if (!files || !files.cover) {
      return ctx.badRequest('Cover image is required');
    }

    // Upload file
    const uploadedFiles = await strapi.plugins.upload.services.upload.upload({
      data: {
        refId: id,
        ref: 'api::article.article',
        field: 'coverImage'
      },
      files: files.cover
    });

    // Update article
    const article = await strapi.documents('api::article.article').update({
      documentId: id,
      data: {
        coverImage: uploadedFiles[0].id
      }
    });

    return ctx.send({
      data: article,
      message: 'Cover image uploaded successfully'
    });
  }
}));
```

## Context (ctx) Kullanımı

### Request Data
```javascript
// Query parameters
const { page, limit } = ctx.query;

// URL parameters
const { id } = ctx.params;

// Request body
const { title, content } = ctx.request.body;

// Files
const { files } = ctx.request;

// Headers
const token = ctx.request.headers.authorization;
```

### User Authentication
```javascript
// Current user
const user = ctx.state.user;

if (!user) {
  return ctx.unauthorized('You must be logged in');
}

// User ID
const userId = ctx.state.user.id;
```

### Response Methods
```javascript
// Success response
ctx.send({ data: result });

// Created (201)
ctx.created({ data: newResource });

// No Content (204)
ctx.noContent();

// Bad Request (400)
ctx.badRequest('Invalid input');

// Unauthorized (401)
ctx.unauthorized('Login required');

// Forbidden (403)
ctx.forbidden('Access denied');

// Not Found (404)
ctx.notFound('Resource not found');

// Internal Server Error (500)
ctx.internalServerError('Something went wrong');
```

## Error Handling

### Try-Catch Pattern

```javascript
module.exports = createCoreController('api::article.article', ({ strapi }) => ({
  async customAction(ctx) {
    try {
      const result = await strapi.service('api::article.article').complexOperation();

      return ctx.send({
        data: result
      });
    } catch (err) {
      strapi.log.error('Error in customAction:', err);

      return ctx.internalServerError('An error occurred', {
        error: err.message
      });
    }
  }
}));
```

### Validation

```javascript
module.exports = createCoreController('api::article.article', ({ strapi }) => ({
  async create(ctx) {
    const { title, content } = ctx.request.body.data;

    // Validate
    if (!title || title.length < 5) {
      return ctx.badRequest('Title must be at least 5 characters');
    }

    if (!content || content.length < 100) {
      return ctx.badRequest('Content must be at least 100 characters');
    }

    // Proceed with creation
    return super.create(ctx);
  }
}));
```

## Sanitization & Transformation

### Input Sanitization

```javascript
const sanitize = require('sanitize-html');

module.exports = createCoreController('api::article.article', ({ strapi }) => ({
  async create(ctx) {
    // Sanitize HTML content
    ctx.request.body.data.content = sanitize(ctx.request.body.data.content, {
      allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
      allowedAttributes: {
        'a': ['href']
      }
    });

    return super.create(ctx);
  }
}));
```

### Response Transformation

```javascript
module.exports = createCoreController('api::article.article', ({ strapi }) => ({
  async find(ctx) {
    const { data, meta } = await super.find(ctx);

    // Transform response
    const transformedData = data.map(article => ({
      ...article,
      readTime: calculateReadTime(article.content),
      excerpt: article.content.substring(0, 200) + '...'
    }));

    return {
      data: transformedData,
      meta
    };
  }
}));
```

## Best Practices

### 1. Service Katmanını Kullan
```javascript
// KÖTÜ - Business logic controller'da
async create(ctx) {
  // Lots of business logic here...
}

// İYİ - Business logic service'te
async create(ctx) {
  const result = await strapi.service('api::article.article').createArticle(
    ctx.request.body.data
  );
  return ctx.send({ data: result });
}
```

### 2. Validation Middleware Kullan
```javascript
// Policy/Middleware olarak ayır
async create(ctx) {
  // Validation ayrı bir policy'de olmalı
  return super.create(ctx);
}
```

### 3. Error Handling
```javascript
// Her zaman try-catch kullan
async customAction(ctx) {
  try {
    // ...
  } catch (err) {
    strapi.log.error(err);
    return ctx.internalServerError();
  }
}
```

### 4. Response Consistency
```javascript
// Tutarlı response formatı kullan
return ctx.send({
  data: result,
  meta: {
    timestamp: new Date()
  }
});
```

## TypeScript ile Controller

```typescript
// src/api/article/controllers/article.ts
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::article.article', ({ strapi }) => ({
  async customAction(ctx) {
    const result = await strapi.service('api::article.article').customMethod();

    return ctx.send({
      data: result
    });
  }
}));
```

## Kaynaklar

- [Services Guide](06-services-guide.md)
- [Custom Routes](04-custom-routes.md)
- [Policies & Middlewares](07-policies-middlewares.md)
- [Official Strapi Controllers Docs](https://docs.strapi.io/dev-docs/backend-customization/controllers)
