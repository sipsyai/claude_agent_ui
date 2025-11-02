# Collection Types

Collection Types, Strapi'de birden fazla entry içerebilen content type'lardır. Blog yazıları, ürünler, kullanıcılar gibi birden fazla kaydınız varsa Collection Type kullanmalısınız.

## İçindekiler

1. [Collection Type Nedir?](#collection-type-nedir)
2. [Oluşturma](#oluşturma)
3. [Field Tipleri](#field-tipleri)
4. [İlişkiler](#ilişkiler)
5. [CRUD İşlemleri](#crud-işlemleri)
6. [Gelişmiş Özellikler](#gelişmiş-özellikler)
7. [Best Practices](#best-practices)
8. [Örnek Projeler](#örnek-projeler)

## Collection Type Nedir?

### Tanım

Collection Type, aynı yapıya sahip birden fazla kaydı (entry) saklayabilen veri modelleridir.

### Ne Zaman Kullanılır?

Collection Type kullanmanız gereken durumlar:

- **Blog Yazıları**: Birden fazla article
- **Ürünler**: Birden fazla product
- **Kullanıcılar**: Birden fazla user
- **Kategoriler**: Birden fazla category
- **Yorumlar**: Birden fazla comment

### Single Type ile Fark

| Özellik | Collection Type | Single Type |
|---------|----------------|-------------|
| Entry Sayısı | Birden fazla | Tek |
| Kullanım | Articles, Products | Homepage, About |
| API Endpoint | `/api/articles` | `/api/homepage` |
| Çoğul/Tekil | Çoğul (Articles) | Tekil (Homepage) |

## Oluşturma

### Admin Panel'den Oluşturma

**Adım 1: Content-Type Builder'ı Açın**
```
Admin Panel → Content-Type Builder → Create new collection type
```

**Adım 2: İsim ve Ayarları Belirleyin**
```javascript
Display name: Article
API ID (singular): article
API ID (plural): articles
```

**Adım 3: Field'ları Ekleyin**

İhtiyacınıza göre field'ları ekleyin (aşağıda detaylı anlatılacak).

**Adım 4: Kaydedin**

Değişiklikler otomatik olarak `src/api/article/content-types/article/schema.json` dosyasına yazılır.

### Programatik Oluşturma

Schema dosyasını manuel oluşturabilirsiniz:

**Dosya: `src/api/article/content-types/article/schema.json`**

```json
{
  "kind": "collectionType",
  "collectionName": "articles",
  "info": {
    "singularName": "article",
    "pluralName": "articles",
    "displayName": "Article",
    "description": "Blog articles"
  },
  "options": {
    "draftAndPublish": true
  },
  "pluginOptions": {},
  "attributes": {
    "title": {
      "type": "string",
      "required": true
    },
    "content": {
      "type": "richtext",
      "required": true
    },
    "slug": {
      "type": "uid",
      "targetField": "title"
    }
  }
}
```

## Field Tipleri

### 1. Text Fields

#### Short Text
```javascript
{
  "title": {
    "type": "string",
    "required": true,
    "minLength": 3,
    "maxLength": 100
  }
}

// Örnek kullanım:
// - title
// - name
// - headline
```

#### Long Text
```javascript
{
  "description": {
    "type": "text",
    "maxLength": 500
  }
}

// Örnek kullanım:
// - description
// - excerpt
// - summary
```

#### Rich Text
```javascript
{
  "content": {
    "type": "richtext",
    "required": true
  }
}

// Örnek kullanım:
// - article content
// - page content
// - product description (HTML ile)
```

### 2. Number Fields

```javascript
{
  "price": {
    "type": "decimal",
    "min": 0
  },
  "quantity": {
    "type": "integer",
    "default": 0,
    "min": 0
  },
  "rating": {
    "type": "float",
    "min": 0,
    "max": 5
  }
}
```

### 3. Date/Time Fields

```javascript
{
  "publishedAt": {
    "type": "datetime"
  },
  "eventDate": {
    "type": "date"
  },
  "openingTime": {
    "type": "time"
  }
}
```

### 4. Boolean

```javascript
{
  "isPublished": {
    "type": "boolean",
    "default": false
  },
  "isFeatured": {
    "type": "boolean",
    "default": false
  }
}
```

### 5. Enumeration

```javascript
{
  "status": {
    "type": "enumeration",
    "enum": ["draft", "published", "archived"],
    "default": "draft"
  }
}
```

### 6. Media

```javascript
{
  "featuredImage": {
    "type": "media",
    "multiple": false,
    "required": false,
    "allowedTypes": ["images"]
  },
  "gallery": {
    "type": "media",
    "multiple": true,
    "allowedTypes": ["images", "videos"]
  }
}
```

### 7. UID (Unique Identifier)

```javascript
{
  "slug": {
    "type": "uid",
    "targetField": "title",
    "required": true
  }
}

// Otomatik olarak title'dan slug oluşturulur
// "My First Article" → "my-first-article"
```

### 8. JSON

```javascript
{
  "metadata": {
    "type": "json"
  }
}

// Örnek değer:
{
  "seo": {
    "title": "...",
    "description": "..."
  },
  "custom": {
    "field1": "value1"
  }
}
```

## İlişkiler

### One-to-Many

Bir author'ın birden fazla article'ı olabilir.

**Articles Schema:**
```json
{
  "attributes": {
    "author": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "plugin::users-permissions.user",
      "inversedBy": "articles"
    }
  }
}
```

**Users Schema:**
```json
{
  "attributes": {
    "articles": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::article.article",
      "mappedBy": "author"
    }
  }
}
```

### Many-to-Many

Bir article birden fazla category'de olabilir, bir category birden fazla article içerebilir.

**Articles Schema:**
```json
{
  "attributes": {
    "categories": {
      "type": "relation",
      "relation": "manyToMany",
      "target": "api::category.category",
      "inversedBy": "articles"
    }
  }
}
```

**Categories Schema:**
```json
{
  "attributes": {
    "articles": {
      "type": "relation",
      "relation": "manyToMany",
      "target": "api::article.article",
      "mappedBy": "categories"
    }
  }
}
```

### One-to-One

Bir user'ın bir profile'ı vardır.

**Users Schema:**
```json
{
  "attributes": {
    "profile": {
      "type": "relation",
      "relation": "oneToOne",
      "target": "api::profile.profile",
      "inversedBy": "user"
    }
  }
}
```

## CRUD İşlemleri

### Create (Oluşturma)

**API Endpoint:**
```
POST /api/articles
```

**Request Body:**
```json
{
  "data": {
    "title": "My First Article",
    "content": "Article content...",
    "isPublished": true,
    "author": 1,
    "categories": [1, 2, 3]
  }
}
```

**Controller Kullanımı:**
```javascript
// src/api/article/controllers/article.js

async create(ctx) {
  const { data } = ctx.request.body;

  const article = await strapi.entityService.create('api::article.article', {
    data,
    populate: ['author', 'categories']
  });

  return article;
}
```

### Read (Okuma)

**Get All (Tümünü Getir):**
```
GET /api/articles?populate=*
```

**Get One (Tek Kayıt):**
```
GET /api/articles/1?populate=*
```

**Filtering:**
```
GET /api/articles?filters[isPublished][$eq]=true&populate=author
```

**Controller:**
```javascript
async find(ctx) {
  const articles = await strapi.entityService.findMany('api::article.article', {
    filters: {
      isPublished: true
    },
    populate: ['author', 'categories', 'featuredImage'],
    sort: { publishedAt: 'desc' },
    pagination: {
      page: 1,
      pageSize: 10
    }
  });

  return articles;
}
```

### Update (Güncelleme)

**API Endpoint:**
```
PUT /api/articles/1
```

**Request Body:**
```json
{
  "data": {
    "title": "Updated Title",
    "isPublished": true
  }
}
```

**Controller:**
```javascript
async update(ctx) {
  const { id } = ctx.params;
  const { data } = ctx.request.body;

  const article = await strapi.entityService.update('api::article.article', id, {
    data,
    populate: ['author', 'categories']
  });

  return article;
}
```

### Delete (Silme)

**API Endpoint:**
```
DELETE /api/articles/1
```

**Controller:**
```javascript
async delete(ctx) {
  const { id } = ctx.params;

  const article = await strapi.entityService.delete('api::article.article', id);

  return article;
}
```

## Gelişmiş Özellikler

### 1. Draft & Publish

Draft mode ile içerikleri yayınlamadan önce taslak olarak saklayın.

**Schema:**
```json
{
  "options": {
    "draftAndPublish": true
  }
}
```

**Kullanım:**
```javascript
// Taslak oluştur
await strapi.entityService.create('api::article.article', {
  data: {
    title: "Draft Article",
    publishedAt: null // null = draft
  }
});

// Yayınla
await strapi.entityService.update('api::article.article', id, {
  data: {
    publishedAt: new Date()
  }
});
```

### 2. Lifecycle Hooks

Entry oluşturma, güncelleme, silme işlemlerinde otomatik işlemler yapın.

**Dosya: `src/api/article/content-types/article/lifecycles.js`**

```javascript
module.exports = {
  // Entry oluşturulmadan önce
  async beforeCreate(event) {
    const { data } = event.params;

    // Slug otomatik oluştur
    if (!data.slug && data.title) {
      data.slug = data.title.toLowerCase().replace(/\s+/g, '-');
    }
  },

  // Entry oluşturulduktan sonra
  async afterCreate(event) {
    const { result } = event;

    // Email gönder
    await strapi.plugins['email'].services.email.send({
      to: 'admin@example.com',
      subject: 'New Article Created',
      text: `${result.title} has been created.`
    });
  },

  // Entry güncellenmeden önce
  async beforeUpdate(event) {
    const { data } = event.params;

    // UpdatedAt otomatik set et
    data.updatedAt = new Date();
  },

  // Entry silindikten sonra
  async afterDelete(event) {
    const { result } = event;

    // İlişkili dosyaları temizle
    if (result.featuredImage) {
      await strapi.plugins['upload'].services.upload.remove(result.featuredImage);
    }
  }
};
```

### 3. Custom Fields

Özel field tanımlayabilirsiniz.

**Örnek: Color Picker**
```json
{
  "themeColor": {
    "type": "string",
    "regex": "^#[0-9A-Fa-f]{6}$",
    "default": "#000000"
  }
}
```

### 4. Validation

Field validation ekleyin.

```javascript
// src/api/article/content-types/article/schema.json
{
  "attributes": {
    "email": {
      "type": "email",
      "required": true,
      "unique": true
    },
    "website": {
      "type": "string",
      "regex": "^https?://.*"
    },
    "age": {
      "type": "integer",
      "min": 18,
      "max": 120
    }
  }
}
```

## Best Practices

### 1. İsimlendirme

```javascript
// ✅ DOĞRU
Collection Type: "Articles" (çoğul)
Singular: "article"
Plural: "articles"

// ❌ YANLIŞ
Collection Type: "Article" (tekil)
```

### 2. Slug Kullanımı

Her collection type için slug field'ı ekleyin:

```json
{
  "slug": {
    "type": "uid",
    "targetField": "title",
    "required": true
  }
}
```

### 3. Timestamps

Otomatik timestamps için:

```json
{
  "options": {
    "timestamps": true
  }
}
```

Bu otomatik olarak `createdAt` ve `updatedAt` field'larını ekler.

### 4. Default Values

Mantıklı default değerler atayın:

```json
{
  "isPublished": {
    "type": "boolean",
    "default": false
  },
  "viewCount": {
    "type": "integer",
    "default": 0
  },
  "status": {
    "type": "enumeration",
    "enum": ["draft", "published", "archived"],
    "default": "draft"
  }
}
```

### 5. Private Fields

Hassas bilgileri private yapın:

```json
{
  "apiKey": {
    "type": "string",
    "private": true
  }
}
```

### 6. Populate Dikkatli Kullanın

Performance için sadece gerekli ilişkileri populate edin:

```javascript
// ❌ KÖTÜ - Her şeyi populate et
await strapi.entityService.findMany('api::article.article', {
  populate: '*'
});

// ✅ İYİ - Sadece gerekli olanları
await strapi.entityService.findMany('api::article.article', {
  populate: ['author', 'featuredImage']
});
```

## Örnek Projeler

### Blog Sistemi

**Articles Collection:**
```json
{
  "kind": "collectionType",
  "collectionName": "articles",
  "info": {
    "singularName": "article",
    "pluralName": "articles",
    "displayName": "Article"
  },
  "options": {
    "draftAndPublish": true,
    "timestamps": true
  },
  "attributes": {
    "title": {
      "type": "string",
      "required": true,
      "minLength": 3,
      "maxLength": 100
    },
    "slug": {
      "type": "uid",
      "targetField": "title",
      "required": true
    },
    "excerpt": {
      "type": "text",
      "maxLength": 255
    },
    "content": {
      "type": "richtext",
      "required": true
    },
    "featuredImage": {
      "type": "media",
      "multiple": false,
      "allowedTypes": ["images"]
    },
    "author": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "plugin::users-permissions.user",
      "inversedBy": "articles"
    },
    "categories": {
      "type": "relation",
      "relation": "manyToMany",
      "target": "api::category.category",
      "inversedBy": "articles"
    },
    "tags": {
      "type": "relation",
      "relation": "manyToMany",
      "target": "api::tag.tag",
      "inversedBy": "articles"
    },
    "viewCount": {
      "type": "integer",
      "default": 0,
      "min": 0
    },
    "isPublished": {
      "type": "boolean",
      "default": false
    },
    "seo": {
      "type": "component",
      "repeatable": false,
      "component": "shared.seo"
    }
  }
}
```

### E-Commerce Ürünleri

**Products Collection:**
```json
{
  "kind": "collectionType",
  "collectionName": "products",
  "info": {
    "singularName": "product",
    "pluralName": "products",
    "displayName": "Product"
  },
  "options": {
    "draftAndPublish": true
  },
  "attributes": {
    "name": {
      "type": "string",
      "required": true
    },
    "slug": {
      "type": "uid",
      "targetField": "name"
    },
    "description": {
      "type": "richtext"
    },
    "price": {
      "type": "decimal",
      "required": true,
      "min": 0
    },
    "salePrice": {
      "type": "decimal",
      "min": 0
    },
    "stock": {
      "type": "integer",
      "default": 0,
      "min": 0
    },
    "sku": {
      "type": "string",
      "unique": true
    },
    "images": {
      "type": "media",
      "multiple": true,
      "allowedTypes": ["images"]
    },
    "category": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::category.category",
      "inversedBy": "products"
    },
    "tags": {
      "type": "relation",
      "relation": "manyToMany",
      "target": "api::tag.tag"
    },
    "isActive": {
      "type": "boolean",
      "default": true
    },
    "isFeatured": {
      "type": "boolean",
      "default": false
    }
  }
}
```

### Event Yönetimi

**Events Collection:**
```json
{
  "kind": "collectionType",
  "collectionName": "events",
  "info": {
    "singularName": "event",
    "pluralName": "events",
    "displayName": "Event"
  },
  "attributes": {
    "title": {
      "type": "string",
      "required": true
    },
    "slug": {
      "type": "uid",
      "targetField": "title"
    },
    "description": {
      "type": "richtext"
    },
    "startDate": {
      "type": "datetime",
      "required": true
    },
    "endDate": {
      "type": "datetime",
      "required": true
    },
    "location": {
      "type": "string"
    },
    "capacity": {
      "type": "integer",
      "min": 1
    },
    "registeredCount": {
      "type": "integer",
      "default": 0,
      "min": 0
    },
    "isOnline": {
      "type": "boolean",
      "default": false
    },
    "meetingLink": {
      "type": "string"
    },
    "status": {
      "type": "enumeration",
      "enum": ["upcoming", "ongoing", "completed", "cancelled"],
      "default": "upcoming"
    },
    "organizer": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "plugin::users-permissions.user"
    }
  }
}
```

## API Örnekleri

### Frontend Kullanımı (React)

**Articles Listesi:**
```javascript
import { useState, useEffect } from 'react';

function ArticlesList() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:1337/api/articles?populate=*')
      .then(res => res.json())
      .then(data => {
        setArticles(data.data);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {articles.map(article => (
        <div key={article.id}>
          <h2>{article.attributes.title}</h2>
          <p>{article.attributes.excerpt}</p>
          <img
            src={article.attributes.featuredImage.data?.attributes.url}
            alt={article.attributes.title}
          />
        </div>
      ))}
    </div>
  );
}
```

**Article Detayı:**
```javascript
function ArticleDetail({ slug }) {
  const [article, setArticle] = useState(null);

  useEffect(() => {
    fetch(`http://localhost:1337/api/articles?filters[slug][$eq]=${slug}&populate=*`)
      .then(res => res.json())
      .then(data => setArticle(data.data[0]));
  }, [slug]);

  if (!article) return <div>Loading...</div>;

  return (
    <article>
      <h1>{article.attributes.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: article.attributes.content }} />
      <p>Author: {article.attributes.author.data.attributes.username}</p>
    </article>
  );
}
```

## Kaynaklar

- [Strapi Collection Types](https://docs.strapi.io/user-docs/content-type-builder/creating-new-content-type)
- [Schema Documentation](https://docs.strapi.io/dev-docs/backend-customization/models)
- [Entity Service API](https://docs.strapi.io/dev-docs/api/entity-service)
