# Content-Type Relations Overview

## İlişki Tipleri

Strapi 5'te 4 farklı ilişki tipi bulunur:

### 1. One-to-One (Bire-Bir)
Bir kayıt sadece bir diğer kayıtla ilişkilidir.

**Örnek:** Her kullanıcının bir profili vardır.
```
User (1) ←→ (1) Profile
```

### 2. One-to-Many (Bire-Çok)
Bir kayıt birden fazla kayıtla ilişkilidir.

**Örnek:** Bir yazar birden fazla makale yazabilir.
```
Author (1) ←→ (N) Articles
```

### 3. Many-to-One (Çoka-Bir)
Birden fazla kayıt bir kayıtla ilişkilidir.

**Örnek:** Birden fazla makale bir kategoriye aittir.
```
Articles (N) ←→ (1) Category
```

### 4. Many-to-Many (Çoka-Çok)
Birden fazla kayıt birden fazla kayıtla ilişkilidir.

**Örnek:** Makaleler birden fazla etikete sahip olabilir, etiketler birden fazla makalede kullanılabilir.
```
Articles (N) ←→ (N) Tags
```

## Content-Type Builder'da İlişki Kurma

### Admin Panel'den İlişki Ekleme

1. **Content-Type Builder**'a gidin
2. İlişki eklemek istediğiniz Content Type'ı seçin
3. "Add another field" butonuna tıklayın
4. "Relation" field type'ını seçin
5. İlişki tipini ve hedef Content Type'ı belirleyin

### Schema.json Üzerinden İlişki Tanımlama

```json
{
  "kind": "collectionType",
  "collectionName": "articles",
  "info": {
    "singularName": "article",
    "pluralName": "articles",
    "displayName": "Article"
  },
  "attributes": {
    "title": {
      "type": "string"
    },
    "author": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::author.author",
      "inversedBy": "articles"
    },
    "categories": {
      "type": "relation",
      "relation": "manyToMany",
      "target": "api::category.category",
      "inversedBy": "articles"
    }
  }
}
```

## İlişki Özellikleri

### relation
İlişki tipini belirtir:
- `oneToOne`
- `oneToMany`
- `manyToOne`
- `manyToMany`

### target
Hedef Content Type'ın API ID'si:
```
"target": "api::author.author"
```

Format: `api::{pluralName}.{singularName}`

### inversedBy
Karşı taraftaki field adı (opsiyonel):
```json
// Article model
"author": {
  "type": "relation",
  "relation": "manyToOne",
  "target": "api::author.author",
  "inversedBy": "articles"  // Author'daki field adı
}

// Author model
"articles": {
  "type": "relation",
  "relation": "oneToMany",
  "target": "api::article.article",
  "mappedBy": "author"  // Article'daki field adı
}
```

### mappedBy
Karşı taraftaki field adını belirtir (inversedBy'ın tersi):

## Best Practices

### 1. İsimlendirme
- **Tekil ilişkiler** için tekil isim: `author`, `category`
- **Çoğul ilişkiler** için çoğul isim: `articles`, `tags`

### 2. Bidirectional (Çift Yönlü) İlişkiler
Her iki tarafta da ilişki tanımlayın:
```javascript
// Article -> Author (many-to-one)
"author": { "inversedBy": "articles" }

// Author -> Articles (one-to-many)
"articles": { "mappedBy": "author" }
```

### 3. Performance
- Gereksiz populate kullanmayın
- Sadece ihtiyacınız olan field'ları select edin
- Deep populate'ten kaçının (maksimum 2-3 seviye)

### 4. Veri Bütünlüğü
- Orphan kayıtları düzenli temizleyin
- Silme işlemlerinde cascade davranışını düşünün
- Required ilişkiler kullanırken dikkatli olun

## Örnek Senaryolar

### Blog Sistemi
```
Author (1) ←→ (N) Articles
Article (N) ←→ (1) Category
Article (N) ←→ (N) Tags
Article (1) ←→ (N) Comments
User (1) ←→ (N) Comments
```

### E-commerce
```
Category (1) ←→ (N) Products
Product (N) ←→ (N) Tags
Product (1) ←→ (N) Reviews
User (1) ←→ (N) Orders
Order (N) ←→ (N) Products
```

### Social Media
```
User (1) ←→ (N) Posts
Post (1) ←→ (N) Comments
User (N) ←→ (N) User (Followers/Following)
Post (N) ←→ (N) Tags
```

## Sık Karşılaşılan Hatalar

### 1. Circular Dependency
```javascript
// YANLIŞ
// A modeli B'yi populate ediyor
// B modeli A'yı populate ediyor
// Sonsuz döngü!

// DOĞRU
// Sadece gerekli yönde populate yapın
// Veya populate depth'i sınırlandırın
```

### 2. N+1 Query Problem
```javascript
// YANLIŞ - Her article için ayrı query
const articles = await strapi.db.query('api::article.article').findMany();
for (const article of articles) {
  article.author = await strapi.db.query('api::author.author').findOne({
    where: { id: article.author.id }
  });
}

// DOĞRU - Tek query ile populate
const articles = await strapi.db.query('api::article.article').findMany({
  populate: { author: true }
});
```

### 3. Yanlış İlişki Tipi
```javascript
// Her kullanıcının birden fazla profili olabilir mi? HAYIR!
// Many-to-One YANLIŞ
"profile": {
  "relation": "manyToOne"  // YANLIŞ
}

// One-to-One DOĞRU
"profile": {
  "relation": "oneToOne"  // DOĞRU
}
```

## İleri Seviye Konular

- Polymorphic Relations (Strapi 5'te sınırlı destek)
- Self Relations (User -> User ilişkisi gibi)
- Circular Relations yönetimi
- Cascade Delete stratejileri

Bu konular için [REFERENCE.md](REFERENCE.md) dosyasına bakın.

## Kaynaklar

- [Official Strapi Relations Docs](https://docs.strapi.io/dev-docs/backend-customization/models#relations)
- [Populate Guide](02-populate-guide.md)
- [Relation Examples](03-relation-examples.md)
