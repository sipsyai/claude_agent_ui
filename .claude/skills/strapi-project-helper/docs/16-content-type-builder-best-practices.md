# Content-Type Builder Best Practices

Content-Type Builder, Strapi'nin görsel arayüzü üzerinden content type'larınızı oluşturmanıza olanak tanır. Bu dokümanda, content type oluştururken dikkat edilmesi gereken en iyi pratikler ve önemli noktalar açıklanmıştır.

## İçindekiler

1. [Temel Kavramlar](#temel-kavramlar)
2. [İsimlendirme Kuralları](#isimlendirme-kuralları)
3. [Field Type Seçimi](#field-type-seçimi)
4. [İlişki Tasarımı](#ilişki-tasarımı)
5. [Performans Optimizasyonu](#performans-optimizasyonu)
6. [Güvenlik](#güvenlik)
7. [Yaygın Hatalar](#yaygın-hatalar)

## Temel Kavramlar

### Content-Type Nedir?

Content-Type, verilerinizin yapısını tanımlayan şablonlardır. Her content-type bir veritabanı tablosuna karşılık gelir.

**İki Ana Tip Vardır:**

1. **Collection Type**: Birden fazla entry içerebilir (Örn: Articles, Products, Users)
2. **Single Type**: Tek bir entry içerir (Örn: Homepage, About Page, Settings)

### Content-Type Builder'a Erişim

```
Admin Panel → Content-Type Builder → Create new collection type
```

## İsimlendirme Kuralları

### ✅ Doğru İsimlendirme

**Collection Types için:**
- Çoğul isim kullanın: `Articles`, `Products`, `Categories`
- PascalCase kullanın: `BlogPosts`, `UserProfiles`
- Anlamlı ve açıklayıcı olun

**Single Types için:**
- Tekil isim kullanın: `Homepage`, `AboutPage`, `SiteSettings`
- Amaçını açıkça belirtin

**Field İsimleri için:**
- camelCase kullanın: `firstName`, `publishedAt`, `featuredImage`
- Kısa ama açıklayıcı olun
- Veritabanı anahtar kelimelerinden kaçının: `order`, `group`, `type`

### ❌ Yanlış İsimlendirme

```javascript
// YANLIŞ - tekil isim
Collection Type: "Article"

// YANLIŞ - snake_case
Field: "first_name"

// YANLIŞ - rezerve kelimeler
Field: "type", "order", "group"

// YANLIŞ - çok genel
Collection Type: "Data", "Items", "Stuff"
```

### ✅ Doğru Örnekler

```javascript
// DOĞRU
Collection Type: "Articles"
Fields:
  - title (Text)
  - slug (UID)
  - content (Rich Text)
  - publishedAt (DateTime)
  - author (Relation)
  - categories (Relation)
  - featuredImage (Media)
```

## Field Type Seçimi

### Text vs Rich Text vs Markdown

**Text (Short Text)**
- Başlıklar, isimler için
- Max 255 karakter
- HTML içermez

```javascript
// Kullanım Alanları:
- title
- name
- slug (UID olarak kullanılabilir)
- email
```

**Long Text**
- Açıklama, özet için
- Düz metin, HTML yok
- Sınırsız karakter

```javascript
// Kullanım Alanları:
- description
- excerpt
- metaDescription
```

**Rich Text**
- HTML formatında içerik
- Editör ile düzenlenebilir
- Blog yazıları, sayfalar için

```javascript
// Kullanım Alanları:
- content (Blog post içeriği)
- pageContent
- productDescription (HTML gerekiyorsa)
```

**Markdown**
- Markdown formatı
- Developer-friendly
- Daha hafif

### Number vs Integer vs BigInteger

**Number (Float)**
- Ondalıklı sayılar
- Fiyat, oran, yüzde

```javascript
// Örnek:
price: 29.99
rating: 4.5
discountPercentage: 15.5
```

**Integer**
- Tam sayılar
- Sayaçlar, ID'ler

```javascript
// Örnek:
viewCount: 1250
likes: 42
quantity: 5
```

**BigInteger**
- Çok büyük sayılar
- Telefon numaraları
- Tracking ID'ler

```javascript
// Örnek:
phoneNumber: 905551234567
trackingId: 1234567890123456789
```

### DateTime vs Date vs Time

**DateTime**
- Tam tarih ve saat
- Yayınlanma, güncelleme tarihleri

```javascript
// Örnek:
publishedAt: "2024-01-15T10:30:00.000Z"
createdAt: "2024-01-15T10:30:00.000Z"
```

**Date**
- Sadece tarih
- Doğum günleri, etkinlik tarihleri

```javascript
// Örnek:
birthDate: "1990-05-20"
eventDate: "2024-12-31"
```

**Time**
- Sadece saat
- Açılış/kapanış saatleri

```javascript
// Örnek:
openingTime: "09:00:00"
closingTime: "18:00:00"
```

### Boolean

- Evet/Hayır durumları
- Varsayılan değer belirleyin

```javascript
// Örnekler:
isPublished: true
isFeatured: false
isActive: true
allowComments: true
```

### Enumeration (Enum)

- Sabit seçenekler
- Durum, kategori, tip için

```javascript
// Örnek:
status: ['draft', 'published', 'archived']
priority: ['low', 'medium', 'high']
role: ['admin', 'editor', 'viewer']
```

### Media (Single vs Multiple)

**Single Media**
- Profil fotoğrafı
- Featured image
- Logo

**Multiple Media**
- Galeri
- Çoklu görseller
- Ekler

```javascript
// Content-Type tanımı:
featuredImage: Media (Single)
gallery: Media (Multiple)
attachments: Media (Multiple)
```

### JSON Field

- Esnek veri yapıları
- Karmaşık objeler
- Ayarlar, metadata

```javascript
// Örnek kullanım:
metadata: {
  seo: {
    title: "...",
    description: "...",
    keywords: ["..."]
  },
  social: {
    ogImage: "...",
    twitterCard: "..."
  }
}

settings: {
  notifications: true,
  theme: "dark",
  language: "tr"
}
```

## İlişki Tasarımı

### One-to-Many vs Many-to-Many

**One-to-Many Kullanın:**
- Bir author'ın birden fazla article'ı var
- Bir category'nin birden fazla product'ı var
- Hiyerarşik ilişkiler

**Many-to-Many Kullanın:**
- Bir article birden fazla tag'e sahip
- Bir product birden fazla category'de
- Çok yönlü ilişkiler

### İlişki İsimlendirme

```javascript
// ✅ DOĞRU
Articles:
  - author (Relation to User)
  - categories (Relation to Categories)
  - tags (Relation to Tags)

// ❌ YANLIŞ
Articles:
  - user (belirsiz)
  - cat (kısaltma kullanmayın)
  - relation1 (anlamsız)
```

### Bidirectional vs Unidirectional

**Bidirectional (İki Yönlü)**
- Her iki taraftan da erişim
- Populate kolaylığı
- Önerilen

```javascript
// Articles → Author (author field)
// Users → Articles (articles field)
```

**Unidirectional (Tek Yönlü)**
- Sadece bir taraftan erişim
- Daha basit
- İlişki az kullanılacaksa

## Performans Optimizasyonu

### 1. UID Field için slug Kullanımı

```javascript
// ✅ DOĞRU
title: "My First Article"
slug: "my-first-article" (UID attached to title)

// URL: /articles/my-first-article
```

**Avantajları:**
- SEO dostu
- Unique constraint
- Otomatik oluşturulur

### 2. Required Fields

Sadece gerçekten gerekli field'ları required yapın:

```javascript
// ✅ Mantıklı Required Fields
title: required
content: required
slug: required

// ❌ Gereksiz Required
description: required (optional olabilir)
publishedAt: required (otomatik olabilir)
```

### 3. Default Values

Uygun field'lara default değer atayın:

```javascript
// Örnekler:
isPublished: false (default)
viewCount: 0 (default)
status: 'draft' (default)
createdAt: now (default)
```

### 4. Index Kullanımı

Sık sorgulanan field'ları index'leyin:

```javascript
// Database index eklenmesi gereken field'lar:
- slug (unique index)
- email (unique index)
- status (index)
- publishedAt (index)
- authorId (foreign key index - otomatik)
```

**Not:** Strapi Admin Panel'den index ekleyemezsiniz, migration file ile eklemelisiniz.

### 5. Lazy Loading için Component Kullanımı

Büyük yapıları component olarak ayırın:

```javascript
// ❌ YANLIŞ - Tüm SEO field'ları article'da
Articles:
  - seoTitle
  - seoDescription
  - seoKeywords
  - ogTitle
  - ogDescription
  - ogImage
  - twitterTitle
  - twitterDescription

// ✅ DOĞRU - SEO component
Articles:
  - seo (Component: SeoMeta)

SeoMeta Component:
  - title
  - description
  - keywords
  - ogTitle
  - ogDescription
  - ogImage
```

## Güvenlik

### 1. Private Fields

Hassas bilgileri private yapın:

```javascript
// Admin Panel → Content-Type Builder → Field → Advanced Settings
password: private
apiKey: private
secret: private
```

### 2. Required + Validation

Veri bütünlüğü için validation ekleyin:

```javascript
// Email field:
- Type: Email
- Required: true
- Unique: true

// URL field:
- Type: Text
- Required: false
- RegEx: ^https?://.*
```

### 3. Minimum/Maximum

Sayısal değerlere sınır koyun:

```javascript
// Rating field:
- Type: Number
- Min: 1
- Max: 5

// Age field:
- Type: Integer
- Min: 18
- Max: 120
```

## Yaygın Hatalar

### 1. Çok Fazla Field

```javascript
// ❌ YANLIŞ - 50+ field
Articles:
  - title
  - subtitle
  - excerpt
  - content
  - seoTitle
  - seoDescription
  - seoKeywords
  - ogTitle
  - ogDescription
  - ... (40 more fields)

// ✅ DOĞRU - Component ile organize edin
Articles:
  - title
  - content
  - seo (Component)
  - social (Component)
  - author (Relation)
  - categories (Relation)
```

### 2. Yanlış İlişki Tipi

```javascript
// ❌ YANLIŞ - Many-to-Many yerine One-to-Many
Articles → Categories (Many-to-One)
// Bir article sadece bir category'ye ait olabilir

// ✅ DOĞRU
Articles → Categories (Many-to-Many)
// Bir article birden fazla category'de olabilir
```

### 3. Slug Olmadan URL

```javascript
// ❌ YANLIŞ
URL: /articles/123

// ✅ DOĞRU
title: "My Article"
slug: "my-article" (UID)
URL: /articles/my-article
```

### 4. Rich Text Yerine Text

```javascript
// ❌ YANLIŞ - HTML içerik için Text
content: Text field
// HTML tag'leri escape edilir

// ✅ DOĞRU
content: Rich Text
// HTML doğru şekilde render edilir
```

### 5. JSON Yerine Ayrı Field'lar

```javascript
// ❌ YANLIŞ - Her dil için ayrı field
titleEN: Text
titleTR: Text
titleDE: Text
contentEN: Rich Text
contentTR: Rich Text
contentDE: Rich Text

// ✅ DOĞRU - i18n plugin kullanın veya JSON
localizations: JSON
{
  "en": { "title": "...", "content": "..." },
  "tr": { "title": "...", "content": "..." },
  "de": { "title": "...", "content": "..." }
}
```

## Best Practices Özet

### ✅ Yapılması Gerekenler

1. **İsimlendirme**
   - Collection Type: Çoğul, PascalCase
   - Single Type: Tekil, PascalCase
   - Fields: camelCase

2. **Field Types**
   - Doğru field type seçin
   - Required sadece gerekli field'lar için
   - Default değerler atayın

3. **İlişkiler**
   - Bidirectional kullanın
   - Açıklayıcı isimler verin
   - Doğru ilişki tipini seçin

4. **Performans**
   - UID field'ları kullanın (slug)
   - Component ile organize edin
   - Index'leri planlayın

5. **Güvenlik**
   - Hassas field'ları private yapın
   - Validation ekleyin
   - Min/Max değerleri belirleyin

### ❌ Yapılmaması Gerekenler

1. Rezerve kelimeler kullanmayın
2. snake_case kullanmayın
3. Çok fazla field eklemeyin (component kullanın)
4. Her field'ı required yapmayın
5. Yanlış field type seçmeyin
6. İlişki isimlerini kısaltmayın
7. Slug olmadan URL oluşturmayın

## Örnek: Blog Content-Type

```javascript
// Collection Type: Articles

{
  "displayName": "Article",
  "singularName": "article",
  "pluralName": "articles",
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
      "required": false,
      "allowedTypes": ["images"]
    },
    "publishedAt": {
      "type": "datetime"
    },
    "isPublished": {
      "type": "boolean",
      "default": false
    },
    "viewCount": {
      "type": "integer",
      "default": 0,
      "min": 0
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
    "seo": {
      "type": "component",
      "repeatable": false,
      "component": "shared.seo"
    }
  }
}
```

## Kaynaklar

- [Strapi Content-Type Builder](https://docs.strapi.io/user-docs/content-type-builder)
- [Schema Documentation](https://docs.strapi.io/dev-docs/backend-customization/models)
- [Relations Guide](https://docs.strapi.io/dev-docs/backend-customization/models#relations)
