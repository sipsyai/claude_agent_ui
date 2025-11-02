# Populate Guide - İlişkili Veri Sorgulama

## Populate Nedir?

Populate, ilişkili verileri ana sorgu ile birlikte getirmenizi sağlar. SQL'deki JOIN işlemine benzer.

## Temel Kullanım

### 1. Tek İlişki Populate (Simple)

```javascript
// REST API
GET /api/articles?populate=*

// Document Service API
const articles = await strapi.documents('api::article.article').findMany({
  populate: '*'
});
```

**Not:** `populate=*` tüm first-level ilişkileri getirir (deep populate yapmaz).

### 2. Spesifik Field Populate

```javascript
// REST API
GET /api/articles?populate[0]=author&populate[1]=category

// Document Service API
const articles = await strapi.documents('api::article.article').findMany({
  populate: ['author', 'category']
});
```

### 3. Nested Populate (Derinlemesine)

```javascript
// REST API
GET /api/articles?populate[author][populate][0]=avatar

// Document Service API
const articles = await strapi.documents('api::article.article').findMany({
  populate: {
    author: {
      populate: ['avatar']
    }
  }
});
```

## Gelişmiş Populate

### 1. Select ile Sadece İstenen Field'ları Getirme

```javascript
// Document Service API
const articles = await strapi.documents('api::article.article').findMany({
  populate: {
    author: {
      fields: ['name', 'email']  // Sadece name ve email
    }
  }
});

// REST API
GET /api/articles?populate[author][fields][0]=name&populate[author][fields][1]=email
```

### 2. Populate ile Filtreleme

```javascript
// Sadece aktif kategorileri populate et
const articles = await strapi.documents('api::article.article').findMany({
  populate: {
    categories: {
      filters: {
        active: true
      }
    }
  }
});

// REST API
GET /api/articles?populate[categories][filters][active][$eq]=true
```

### 3. Populate ile Sıralama

```javascript
// Yorumları tarihe göre sırala
const articles = await strapi.documents('api::article.article').findMany({
  populate: {
    comments: {
      sort: ['createdAt:desc']
    }
  }
});

// REST API
GET /api/articles?populate[comments][sort][0]=createdAt:desc
```

### 4. Populate ile Limit

```javascript
// Sadece ilk 5 yorumu getir
const articles = await strapi.documents('api::article.article').findMany({
  populate: {
    comments: {
      limit: 5,
      sort: ['createdAt:desc']
    }
  }
});

// REST API
GET /api/articles?populate[comments][limit]=5&populate[comments][sort][0]=createdAt:desc
```

## Deep Populate (Çok Seviyeli)

### 2 Seviye Derinlik

```javascript
const articles = await strapi.documents('api::article.article').findMany({
  populate: {
    author: {
      populate: ['avatar', 'profile']
    },
    comments: {
      populate: ['user']
    }
  }
});
```

### 3 Seviye Derinlik

```javascript
const articles = await strapi.documents('api::article.article').findMany({
  populate: {
    author: {
      populate: {
        avatar: {
          populate: ['formats']
        }
      }
    },
    comments: {
      populate: {
        user: {
          populate: ['profile']
        }
      }
    }
  }
});
```

**⚠️ Dikkat:** Deep populate performans sorunlarına yol açabilir. Maksimum 2-3 seviye önerilir.

## Kompleks Populate Senaryoları

### Senaryo 1: Blog Post Detayı

```javascript
// Makale + Yazar (avatar ile) + Kategoriler + Son 10 Yorum (kullanıcı bilgileri ile)
const article = await strapi.documents('api::article.article').findOne({
  documentId: 'abc123',
  populate: {
    author: {
      fields: ['name', 'bio'],
      populate: ['avatar']
    },
    categories: {
      fields: ['name', 'slug']
    },
    tags: {
      fields: ['name']
    },
    comments: {
      limit: 10,
      sort: ['createdAt:desc'],
      populate: {
        user: {
          fields: ['username', 'avatar']
        }
      }
    },
    coverImage: true
  }
});
```

### Senaryo 2: E-commerce Ürün Listesi

```javascript
// Ürünler + Kategori + İlk 3 Resim + Ortalama Rating
const products = await strapi.documents('api::product.product').findMany({
  populate: {
    category: {
      fields: ['name']
    },
    images: {
      limit: 3,
      sort: ['order:asc']
    },
    reviews: {
      fields: ['rating'],
      limit: 100  // Ortalama hesaplamak için
    },
    variants: {
      fields: ['sku', 'price', 'stock']
    }
  }
});
```

### Senaryo 3: Social Media Post

```javascript
// Post + Kullanıcı + Yorumlar + Beğeniler
const posts = await strapi.documents('api::post.post').findMany({
  populate: {
    user: {
      fields: ['username', 'displayName'],
      populate: ['profilePicture']
    },
    comments: {
      sort: ['createdAt:desc'],
      limit: 5,
      populate: {
        user: {
          fields: ['username', 'displayName']
        }
      }
    },
    likes: {
      fields: ['user'],  // Sadece user ID'leri
      limit: 1000  // Beğeni sayısını almak için
    },
    media: true
  }
});
```

## REST API Populate Syntax

### Basit Populate
```
/api/articles?populate=*
/api/articles?populate[0]=author&populate[1]=category
```

### Nested Populate
```
/api/articles?populate[author][populate][0]=avatar
```

### Field Selection
```
/api/articles?populate[author][fields][0]=name&populate[author][fields][1]=email
```

### Filtreleme ile Populate
```
/api/articles?populate[comments][filters][approved][$eq]=true
```

### Sıralama ile Populate
```
/api/articles?populate[comments][sort][0]=createdAt:desc
```

### Kombinasyon
```
/api/articles?populate[author][fields][0]=name&populate[author][populate][0]=avatar&populate[comments][sort][0]=createdAt:desc&populate[comments][limit]=10
```

## Performance Best Practices

### 1. Sadece İhtiyacınız Olanı Populate Edin

```javascript
// KÖTÜ - Tüm ilişkileri getir
populate: '*'

// İYİ - Sadece gerekenleri getir
populate: ['author', 'category']
```

### 2. Field Selection Kullanın

```javascript
// KÖTÜ - Tüm field'lar
populate: { author: true }

// İYİ - Sadece gerekli field'lar
populate: {
  author: {
    fields: ['name', 'email']
  }
}
```

### 3. Limit Kullanın

```javascript
// KÖTÜ - Binlerce yorum getirilebilir
populate: { comments: true }

// İYİ - Maksimum 10 yorum
populate: {
  comments: {
    limit: 10
  }
}
```

### 4. Deep Populate'ten Kaçının

```javascript
// KÖTÜ - 4 seviye derinlik
populate: {
  author: {
    populate: {
      profile: {
        populate: {
          settings: {
            populate: ['preferences']
          }
        }
      }
    }
  }
}

// İYİ - Maksimum 2-3 seviye
populate: {
  author: {
    populate: ['profile']
  }
}
```

## Custom Populate Middleware

Bazı durumlarda populate'i middleware ile özelleştirmek isteyebilirsiniz:

```javascript
// src/api/article/middlewares/populate-defaults.js
module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    // Eğer populate belirtilmemişse default populate kullan
    if (!ctx.query.populate) {
      ctx.query.populate = {
        author: {
          fields: ['name', 'email'],
          populate: ['avatar']
        },
        category: {
          fields: ['name', 'slug']
        }
      };
    }

    await next();
  };
};
```

## Sık Karşılaşılan Hatalar

### 1. Circular Populate

```javascript
// HATA - Sonsuz döngü
// Article -> Author -> Articles -> Author -> ...
const articles = await strapi.documents('api::article.article').findMany({
  populate: {
    author: {
      populate: {
        articles: {  // Tekrar article'lara dönüyor!
          populate: ['author']
        }
      }
    }
  }
});

// ÇÖZÜM - Döngüyü kırın
const articles = await strapi.documents('api::article.article').findMany({
  populate: {
    author: {
      fields: ['name', 'email']  // articles'ı populate etme
    }
  }
});
```

### 2. N+1 Query Problemi

```javascript
// KÖTÜ - Her article için ayrı query
const articles = await strapi.documents('api::article.article').findMany();
for (const article of articles) {
  article.author = await strapi.documents('api::author.author').findOne({
    documentId: article.author.id
  });
}

// İYİ - Tek query ile populate
const articles = await strapi.documents('api::article.article').findMany({
  populate: ['author']
});
```

### 3. Over-fetching

```javascript
// KÖTÜ - Tüm field'ları getir
populate: {
  author: true  // Tüm author field'ları
}

// İYİ - Sadece gerekenleri getir
populate: {
  author: {
    fields: ['name', 'avatar']
  }
}
```

## TypeScript ile Populate

```typescript
import type { Article } from '../../../types/generated/contentTypes';

// Type-safe populate
const articles = await strapi.documents('api::article.article').findMany({
  populate: {
    author: {
      fields: ['name', 'email'] as const,
      populate: ['avatar']
    }
  }
}) as Article[];
```

## Populate ile Aggregation

```javascript
// Yorum sayısını hesapla
const articles = await strapi.documents('api::article.article').findMany({
  populate: {
    comments: {
      count: true  // Sadece sayıyı getir
    }
  }
});

// Ortalama rating hesapla
const products = await strapi.db.query('api::product.product').findMany({
  populate: {
    reviews: {
      fields: ['rating']
    }
  }
});

products.forEach(product => {
  const ratings = product.reviews.map(r => r.rating);
  product.averageRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
});
```

## Kaynaklar

- [Relations Overview](01-relations-overview.md)
- [Relation Examples](03-relation-examples.md)
- [Query Basics](08-query-basics.md)
- [Official Strapi Populate Docs](https://docs.strapi.io/dev-docs/api/rest/populate-select)
