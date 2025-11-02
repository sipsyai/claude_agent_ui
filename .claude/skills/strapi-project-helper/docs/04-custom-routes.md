# Custom Routes - Özel Endpoint Tanımlama

## Route Nedir?

Route, HTTP endpoint'lerini controller action'larına bağlayan tanımlardır. Strapi'de her Content Type için otomatik route'lar oluşturulur, ancak özel route'lar da tanımlayabilirsiniz.

## Route Dosya Konumu

```
src/api/{api-name}/routes/
├── {content-type}.js    (default routes)
└── custom-routes.js     (custom routes)
```

## Default Routes

Strapi otomatik olarak CRUD route'ları oluşturur:

```
GET    /api/articles        (find)
GET    /api/articles/:id    (findOne)
POST   /api/articles        (create)
PUT    /api/articles/:id    (update)
DELETE /api/articles/:id    (delete)
```

## Custom Route Oluşturma

### Temel Yapı

```javascript
// src/api/article/routes/custom-article.js
module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/articles/featured',
      handler: 'article.findFeatured',
      config: {
        policies: [],
        middlewares: []
      }
    }
  ]
};
```

### Route Özellikleri

- **method**: HTTP method (GET, POST, PUT, DELETE, PATCH)
- **path**: URL path
- **handler**: Controller method (`controller-name.method-name`)
- **config**: Opsiyonel yapılandırma
  - **policies**: Policy'ler (authorization, validation)
  - **middlewares**: Middleware'ler
  - **auth**: Authentication ayarı (false = public)

## Custom Route Örnekleri

### 1. Publish/Unpublish Endpoints

```javascript
// src/api/article/routes/custom-article.js
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
    },
    {
      method: 'PUT',
      path: '/articles/:id/unpublish',
      handler: 'article.unpublish'
    }
  ]
};
```

Controller:
```javascript
// src/api/article/controllers/article.js
module.exports = createCoreController('api::article.article', ({ strapi }) => ({
  async publish(ctx) {
    const { id } = ctx.params;
    const article = await strapi.service('api::article.article').publish(id);
    return ctx.send({ data: article });
  },

  async unpublish(ctx) {
    const { id } = ctx.params;
    const article = await strapi.service('api::article.article').unpublish(id);
    return ctx.send({ data: article });
  }
}));
```

### 2. Search Endpoint

```javascript
module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/articles/search',
      handler: 'article.search',
      config: {
        auth: false  // Public endpoint
      }
    }
  ]
};
```

### 3. Bulk Operations

```javascript
module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/articles/bulk-publish',
      handler: 'article.bulkPublish'
    },
    {
      method: 'POST',
      path: '/articles/bulk-delete',
      handler: 'article.bulkDelete'
    }
  ]
};
```

### 4. Statistics Endpoint

```javascript
module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/articles/stats',
      handler: 'article.stats',
      config: {
        policies: ['admin::isAdmin']  // Sadece admin
      }
    }
  ]
};
```

### 5. File Upload Endpoint

```javascript
module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/articles/:id/upload-cover',
      handler: 'article.uploadCover'
    }
  ]
};
```

### 6. Related Content Endpoint

```javascript
module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/articles/:id/related',
      handler: 'article.getRelated',
      config: {
        auth: false
      }
    }
  ]
};
```

## Route Parameters

### URL Parameters

```javascript
// Route
{
  path: '/articles/:id/comments/:commentId',
  handler: 'article.getComment'
}

// Controller
async getComment(ctx) {
  const { id, commentId } = ctx.params;
  // id = article ID
  // commentId = comment ID
}
```

### Query Parameters

```javascript
// GET /api/articles/search?q=javascript&category=tutorial

async search(ctx) {
  const { q, category } = ctx.query;
  // q = "javascript"
  // category = "tutorial"
}
```

### Request Body

```javascript
// POST /api/articles with body { "title": "...", "content": "..." }

async create(ctx) {
  const { title, content } = ctx.request.body;
}
```

## Authentication & Authorization

### Public Endpoint (No Auth Required)

```javascript
{
  method: 'GET',
  path: '/articles/public',
  handler: 'article.findPublic',
  config: {
    auth: false  // Public
  }
}
```

### Authenticated Endpoint (Login Required)

```javascript
{
  method: 'POST',
  path: '/articles',
  handler: 'article.create',
  config: {
    // auth: true (default)
  }
}
```

### Admin Only Endpoint

```javascript
{
  method: 'DELETE',
  path: '/articles/bulk-delete',
  handler: 'article.bulkDelete',
  config: {
    policies: ['admin::isAdmin']
  }
}
```

## Policies

Policy'ler route'lara guard eklemenizi sağlar.

### Custom Policy Oluşturma

```javascript
// src/api/article/policies/is-owner.js
module.exports = async (policyContext, config, { strapi }) => {
  const { id } = policyContext.params;
  const userId = policyContext.state.user.id;

  const article = await strapi.documents('api::article.article').findOne({
    documentId: id,
    populate: ['author']
  });

  if (article.author.id !== userId) {
    return false;  // Forbidden
  }

  return true;  // Allow
};
```

### Policy Kullanma

```javascript
{
  method: 'PUT',
  path: '/articles/:id',
  handler: 'article.update',
  config: {
    policies: ['is-owner']  // Sadece owner güncelleyebilir
  }
}
```

### Birden Fazla Policy

```javascript
{
  method: 'DELETE',
  path: '/articles/:id',
  handler: 'article.delete',
  config: {
    policies: [
      'is-authenticated',
      'is-owner',
      'admin::has-permission'
    ]
  }
}
```

## Middlewares

Middleware'ler request/response'u manipüle edebilir.

### Custom Middleware

```javascript
// src/api/article/middlewares/log-request.js
module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    const start = Date.now();

    await next();

    const duration = Date.now() - start;
    strapi.log.info(`${ctx.method} ${ctx.url} - ${duration}ms`);
  };
};
```

### Middleware Kullanma

```javascript
{
  method: 'GET',
  path: '/articles',
  handler: 'article.find',
  config: {
    middlewares: ['log-request']
  }
}
```

## Kompleks Route Örnekleri

### E-commerce Endpoints

```javascript
module.exports = {
  routes: [
    // Product actions
    {
      method: 'POST',
      path: '/products/:id/add-to-cart',
      handler: 'product.addToCart'
    },
    {
      method: 'PUT',
      path: '/products/:id/update-stock',
      handler: 'product.updateStock',
      config: {
        policies: ['admin::isAdmin']
      }
    },
    {
      method: 'GET',
      path: '/products/:id/reviews',
      handler: 'product.getReviews',
      config: {
        auth: false
      }
    },
    {
      method: 'POST',
      path: '/products/:id/reviews',
      handler: 'product.addReview'
    }
  ]
};
```

### Blog Endpoints

```javascript
module.exports = {
  routes: [
    // Public endpoints
    {
      method: 'GET',
      path: '/articles/featured',
      handler: 'article.findFeatured',
      config: {
        auth: false
      }
    },
    {
      method: 'GET',
      path: '/articles/by-category/:slug',
      handler: 'article.findByCategory',
      config: {
        auth: false
      }
    },
    {
      method: 'GET',
      path: '/articles/:id/related',
      handler: 'article.getRelated',
      config: {
        auth: false
      }
    },

    // Authenticated endpoints
    {
      method: 'POST',
      path: '/articles/:id/like',
      handler: 'article.like'
    },
    {
      method: 'POST',
      path: '/articles/:id/bookmark',
      handler: 'article.bookmark'
    },

    // Author endpoints
    {
      method: 'PUT',
      path: '/articles/:id/publish',
      handler: 'article.publish',
      config: {
        policies: ['is-owner']
      }
    },

    // Admin endpoints
    {
      method: 'GET',
      path: '/articles/stats',
      handler: 'article.stats',
      config: {
        policies: ['admin::isAdmin']
      }
    }
  ]
};
```

## Route Naming Convention

### RESTful Pattern

```javascript
// Collection
GET    /articles           (list)
POST   /articles           (create)

// Single item
GET    /articles/:id       (read)
PUT    /articles/:id       (update)
DELETE /articles/:id       (delete)

// Actions
POST   /articles/:id/publish
POST   /articles/:id/like
GET    /articles/:id/related

// Filters
GET    /articles/featured
GET    /articles/popular
GET    /articles/recent
```

## Best Practices

### 1. Descriptive Path Names

```javascript
// İYİ
GET /articles/featured
GET /articles/search
POST /articles/:id/publish

// KÖTÜ
GET /articles/get-featured
GET /articles/do-search
POST /articles/:id/do-publish
```

### 2. Proper HTTP Methods

```javascript
// İYİ
GET    /articles           (read)
POST   /articles           (create)
PUT    /articles/:id       (update)
DELETE /articles/:id       (delete)

// KÖTÜ
POST /articles/get         (should be GET)
GET /articles/create       (should be POST)
```

### 3. Version Your API

```javascript
{
  path: '/v1/articles',
  handler: 'article.find'
}
```

### 4. Rate Limiting

```javascript
{
  method: 'POST',
  path: '/articles/search',
  handler: 'article.search',
  config: {
    middlewares: ['rate-limit']
  }
}
```

## Testing Routes

```javascript
// Test with curl
curl -X GET http://localhost:1337/api/articles/featured

// With auth token
curl -X PUT http://localhost:1337/api/articles/123/publish \
  -H "Authorization: Bearer YOUR_TOKEN"

// With body
curl -X POST http://localhost:1337/api/articles/bulk-publish \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ids": ["id1", "id2", "id3"]}'
```

## Kaynaklar

- [Controllers Guide](05-controllers-guide.md)
- [Services Guide](06-services-guide.md)
- [Policies & Middlewares](07-policies-middlewares.md)
- [Official Strapi Routes Docs](https://docs.strapi.io/dev-docs/backend-customization/routes)
