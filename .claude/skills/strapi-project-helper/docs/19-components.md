# Components

Components, Strapi'de yeniden kullanılabilir field gruplarıdır. İçerik yapılarını düzenlemek, tekrarı önlemek ve tutarlılığı sağlamak için kullanılır.

## İçindekiler

1. [Component Nedir?](#component-nedir)
2. [Shared vs Non-Shared Components](#shared-vs-non-shared-components)
3. [Repeatable Components](#repeatable-components)
4. [Dynamic Zones](#dynamic-zones)
5. [Component Oluşturma](#component-oluşturma)
6. [Kullanım Örnekleri](#kullanım-örnekleri)
7. [Best Practices](#best-practices)
8. [Yaygın Component'ler](#yaygın-componentler)

## Component Nedir?

### Tanım

Component, birden fazla field'ın gruplandırılmasıyla oluşturulan **yeniden kullanılabilir veri yapılarıdır**.

### Neden Component?

**Component Olmadan:**
```javascript
// Articles Content Type
{
  "seoTitle": "string",
  "seoDescription": "text",
  "seoKeywords": "string",
  "ogTitle": "string",
  "ogDescription": "text",
  "ogImage": "media",
  "twitterTitle": "string",
  "twitterDescription": "text"
}

// Products Content Type
{
  "seoTitle": "string",
  "seoDescription": "text",
  "seoKeywords": "string",
  "ogTitle": "string",
  "ogDescription": "text",
  "ogImage": "media",
  "twitterTitle": "string",
  "twitterDescription": "text"
}
```

**Component İle:**
```javascript
// SEO Component (tek tanım)
Component: shared.seo {
  "metaTitle": "string",
  "metaDescription": "text",
  "keywords": "string",
  "ogTitle": "string",
  "ogDescription": "text",
  "ogImage": "media",
  "twitterTitle": "string",
  "twitterDescription": "text"
}

// Articles Content Type
{
  "seo": {
    "type": "component",
    "component": "shared.seo"
  }
}

// Products Content Type
{
  "seo": {
    "type": "component",
    "component": "shared.seo"
  }
}
```

### Avantajları

1. **DRY (Don't Repeat Yourself)**: Aynı field'ları tekrar tanımlamazsınız
2. **Tutarlılık**: Tüm content type'larda aynı yapı kullanılır
3. **Kolay Güncelleme**: Component'i güncelleyin, her yerde etkili olur
4. **Organize**: İçerik yapısı daha düzenli ve okunabilir
5. **Nested Structure**: Component içinde component kullanılabilir

## Shared vs Non-Shared Components

### Shared Components

**Tanım:** Birden fazla content type'da kullanılabilir.

**Klasör:** `src/components/shared/`

**Ne Zaman Kullanılır:**
- SEO metadata (her content type'da ortak)
- Address (kullanıcı, şirket, mağaza)
- Social links (header, footer, profil)
- Media with caption (blog, products, gallery)

**Örnek:**
```javascript
// shared.seo component
// Articles, Products, Pages... tümünde kullanılabilir

Articles:
  - seo (Component: shared.seo)

Products:
  - seo (Component: shared.seo)

Pages:
  - seo (Component: shared.seo)
```

### Non-Shared Components

**Tanım:** Sadece belirli bir content type'da kullanılır.

**Klasör:** `src/components/[content-type-name]/`

**Ne Zaman Kullanılır:**
- Content type'a özel yapılar
- Sadece bir yerde kullanılan field grupları

**Örnek:**
```javascript
// article.body component
// Sadece Articles'da kullanılır

Articles:
  - body (Component: article.body)

// Başka hiçbir content type bu component'i kullanamaz
```

### Karşılaştırma

| Özellik | Shared | Non-Shared |
|---------|--------|------------|
| Kullanım Yeri | Birden fazla content type | Tek content type |
| Klasör | `components/shared/` | `components/[name]/` |
| Örnek | SEO, Address, Social | Article.Body, Product.Specs |
| Esneklik | Yüksek | Düşük |
| Organize | Global | Spesifik |

### Seçim Rehberi

```javascript
// ✅ Shared kullanın:
- SEO metadata
- Address (adres bilgisi)
- Contact info (telefon, email)
- Social media links
- Button (CTA button)
- Image with caption
- Video embed

// ✅ Non-Shared kullanın:
- Article-specific body structure
- Product technical specifications
- Event registration details
- Custom unique structures
```

## Repeatable Components

### Tanım

Repeatable components, aynı component'ten **birden fazla instance** eklemenize olanak tanır.

### Repeatable vs Non-Repeatable

**Non-Repeatable (Tek):**
```javascript
{
  "seo": {
    "type": "component",
    "repeatable": false,  // Sadece 1 tane
    "component": "shared.seo"
  }
}

// Admin'de: Tek bir SEO form
```

**Repeatable (Çoklu):**
```javascript
{
  "features": {
    "type": "component",
    "repeatable": true,  // Birden fazla eklenebilir
    "component": "sections.feature"
  }
}

// Admin'de: "Add another Feature" butonu
```

### Kullanım Alanları

```javascript
// Repeatable components için ideal kullanım:
- Features (özellik listesi)
- Testimonials (müşteri yorumları)
- FAQ items (soru-cevap)
- Team members (ekip üyeleri)
- Gallery items (galeri elemanları)
- Steps (adım adım rehber)
- Timeline items (zaman çizelgesi)
```

### Örnek

**Feature Component:**
```json
{
  "collectionName": "components_sections_features",
  "info": {
    "displayName": "Feature",
    "icon": "star"
  },
  "attributes": {
    "title": {
      "type": "string",
      "required": true
    },
    "description": {
      "type": "text"
    },
    "icon": {
      "type": "media",
      "multiple": false,
      "allowedTypes": ["images"]
    }
  }
}
```

**Homepage'de Kullanımı:**
```json
{
  "attributes": {
    "features": {
      "type": "component",
      "repeatable": true,
      "component": "sections.feature"
    }
  }
}
```

**Admin'de Görünüm:**
```
Features:
  [1] Feature
      - title: "Fast Performance"
      - description: "Lightning fast load times"
      - icon: [image]
  [2] Feature
      - title: "Secure"
      - description: "Bank-level security"
      - icon: [image]
  [3] Feature
      - title: "Scalable"
      - description: "Grows with your business"
      - icon: [image]

  [+ Add another Feature]
```

## Dynamic Zones

### Tanım

Dynamic Zones, **farklı component'leri istediğiniz sırayla eklemenize** olanak tanır. Esneklik açısından en güçlü özelliktir.

### Repeatable Component vs Dynamic Zone

**Repeatable Component:**
```javascript
// Sadece Feature component'i eklenebilir
features: [
  Feature { title: "...", description: "..." },
  Feature { title: "...", description: "..." },
  Feature { title: "...", description: "..." }
]
```

**Dynamic Zone:**
```javascript
// Farklı component'ler karışık sırayla eklenebilir
content: [
  Hero { headline: "...", image: "..." },
  Features { items: [...] },
  Testimonials { quotes: [...] },
  Gallery { images: [...] },
  CallToAction { button: "..." }
]
```

### Kullanım Alanları

```javascript
// Dynamic Zone ideal kullanım senaryoları:
- Page Builder (sayfa oluşturucu)
- Flexible article content (makale içeriği)
- Landing page sections (landing sayfası bölümleri)
- Custom layouts (özel düzenler)
```

### Oluşturma

**Admin Panel:**
```
1. Content-Type Builder → Select content type
2. Add field → Dynamic Zone
3. Field name: "content"
4. Select allowed components:
   ✅ sections.hero
   ✅ sections.features
   ✅ sections.testimonials
   ✅ sections.gallery
   ✅ sections.cta
```

**Schema:**
```json
{
  "attributes": {
    "content": {
      "type": "dynamiczone",
      "components": [
        "sections.hero",
        "sections.features",
        "sections.testimonials",
        "sections.gallery",
        "sections.cta"
      ]
    }
  }
}
```

### API Response

```json
{
  "data": {
    "attributes": {
      "content": [
        {
          "__component": "sections.hero",
          "id": 1,
          "headline": "Welcome",
          "subtitle": "Build something great"
        },
        {
          "__component": "sections.features",
          "id": 2,
          "items": [
            { "title": "Fast", "description": "..." },
            { "title": "Secure", "description": "..." }
          ]
        },
        {
          "__component": "sections.cta",
          "id": 3,
          "buttonText": "Get Started",
          "buttonLink": "/signup"
        }
      ]
    }
  }
}
```

### Frontend Rendering

**React Örneği:**
```javascript
function PageContent({ content }) {
  return (
    <div>
      {content.map((section, index) => {
        switch (section.__component) {
          case 'sections.hero':
            return <HeroSection key={index} {...section} />;

          case 'sections.features':
            return <FeaturesSection key={index} {...section} />;

          case 'sections.testimonials':
            return <TestimonialsSection key={index} {...section} />;

          case 'sections.gallery':
            return <GallerySection key={index} {...section} />;

          case 'sections.cta':
            return <CTASection key={index} {...section} />;

          default:
            return null;
        }
      })}
    </div>
  );
}
```

## Component Oluşturma

### Admin Panel'den

**Adım 1: Component Oluştur**
```
Content-Type Builder → Components → Create new component
```

**Adım 2: Category Seçin**
```
Category: shared (birden fazla yerde kullanılacaksa)
Category: sections (sayfa bölümleri için)
Category: forms (form elemanları için)
```

**Adım 3: İsim Verin**
```
Display name: SEO
Name: seo
```

**Adım 4: Field'ları Ekleyin**

SEO component örneği:
```javascript
Fields:
  - metaTitle (Text)
  - metaDescription (Text)
  - keywords (Text)
  - ogImage (Media)
```

### Programatik Oluşturma

**Dosya: `src/components/shared/seo.json`**

```json
{
  "collectionName": "components_shared_seos",
  "info": {
    "displayName": "SEO",
    "icon": "search",
    "description": "SEO metadata for content"
  },
  "options": {},
  "attributes": {
    "metaTitle": {
      "type": "string",
      "required": true,
      "maxLength": 60
    },
    "metaDescription": {
      "type": "text",
      "maxLength": 160
    },
    "keywords": {
      "type": "string"
    },
    "ogImage": {
      "type": "media",
      "multiple": false,
      "allowedTypes": ["images"]
    },
    "ogTitle": {
      "type": "string",
      "maxLength": 60
    },
    "ogDescription": {
      "type": "text",
      "maxLength": 160
    },
    "canonicalURL": {
      "type": "string"
    },
    "noIndex": {
      "type": "boolean",
      "default": false
    }
  }
}
```

### Content Type'a Ekleme

**Schema'ya ekleyin:**
```json
{
  "attributes": {
    "seo": {
      "type": "component",
      "repeatable": false,
      "component": "shared.seo"
    }
  }
}
```

## Kullanım Örnekleri

### 1. SEO Component

**Component Tanımı:**
```json
// src/components/shared/seo.json
{
  "collectionName": "components_shared_seos",
  "info": {
    "displayName": "SEO"
  },
  "attributes": {
    "metaTitle": { "type": "string", "maxLength": 60 },
    "metaDescription": { "type": "text", "maxLength": 160 },
    "keywords": { "type": "string" },
    "ogImage": { "type": "media", "multiple": false }
  }
}
```

**Kullanımı:**
```json
// Articles, Products, Pages...
{
  "seo": {
    "type": "component",
    "repeatable": false,
    "component": "shared.seo"
  }
}
```

**Frontend:**
```javascript
function SEOHead({ seo }) {
  return (
    <Head>
      <title>{seo.metaTitle}</title>
      <meta name="description" content={seo.metaDescription} />
      <meta name="keywords" content={seo.keywords} />
      <meta property="og:title" content={seo.metaTitle} />
      <meta property="og:description" content={seo.metaDescription} />
      <meta property="og:image" content={seo.ogImage.url} />
    </Head>
  );
}
```

### 2. Address Component

**Component:**
```json
// src/components/shared/address.json
{
  "collectionName": "components_shared_addresses",
  "info": {
    "displayName": "Address"
  },
  "attributes": {
    "street": { "type": "string" },
    "city": { "type": "string" },
    "state": { "type": "string" },
    "zipCode": { "type": "string" },
    "country": { "type": "string", "default": "USA" },
    "latitude": { "type": "float" },
    "longitude": { "type": "float" }
  }
}
```

**Kullanımı:**
```json
// Users, Companies, Stores...
{
  "address": {
    "type": "component",
    "repeatable": false,
    "component": "shared.address"
  }
}
```

### 3. Button Component

**Component:**
```json
// src/components/shared/button.json
{
  "collectionName": "components_shared_buttons",
  "info": {
    "displayName": "Button"
  },
  "attributes": {
    "text": { "type": "string", "required": true },
    "url": { "type": "string", "required": true },
    "variant": {
      "type": "enumeration",
      "enum": ["primary", "secondary", "outline"],
      "default": "primary"
    },
    "openInNewTab": { "type": "boolean", "default": false },
    "icon": { "type": "string" }
  }
}
```

**Frontend:**
```javascript
function Button({ button }) {
  return (
    <a
      href={button.url}
      className={`btn btn-${button.variant}`}
      target={button.openInNewTab ? '_blank' : '_self'}
      rel={button.openInNewTab ? 'noopener noreferrer' : ''}
    >
      {button.icon && <Icon name={button.icon} />}
      {button.text}
    </a>
  );
}
```

### 4. Hero Section Component

**Component:**
```json
// src/components/sections/hero.json
{
  "collectionName": "components_sections_heroes",
  "info": {
    "displayName": "Hero"
  },
  "attributes": {
    "headline": { "type": "string", "required": true },
    "subtitle": { "type": "text" },
    "backgroundImage": {
      "type": "media",
      "multiple": false,
      "allowedTypes": ["images"]
    },
    "button": {
      "type": "component",
      "repeatable": false,
      "component": "shared.button"
    },
    "alignment": {
      "type": "enumeration",
      "enum": ["left", "center", "right"],
      "default": "center"
    }
  }
}
```

**Kullanımı:**
```json
// Homepage, Landing Pages...
{
  "hero": {
    "type": "component",
    "repeatable": false,
    "component": "sections.hero"
  }
}
```

### 5. Feature List Component

**Feature Item Component:**
```json
// src/components/sections/feature.json
{
  "collectionName": "components_sections_features",
  "info": {
    "displayName": "Feature"
  },
  "attributes": {
    "title": { "type": "string", "required": true },
    "description": { "type": "text" },
    "icon": {
      "type": "media",
      "multiple": false,
      "allowedTypes": ["images"]
    }
  }
}
```

**Homepage'de Repeatable Kullanımı:**
```json
{
  "features": {
    "type": "component",
    "repeatable": true,
    "component": "sections.feature"
  }
}
```

**Frontend:**
```javascript
function FeaturesSection({ features }) {
  return (
    <section className="features">
      <div className="grid">
        {features.map((feature, index) => (
          <div key={index} className="feature-card">
            <img src={feature.icon.url} alt={feature.title} />
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

### 6. Nested Components

Component içinde component kullanımı:

**Card Component:**
```json
// src/components/shared/card.json
{
  "collectionName": "components_shared_cards",
  "info": {
    "displayName": "Card"
  },
  "attributes": {
    "title": { "type": "string" },
    "description": { "type": "text" },
    "image": {
      "type": "media",
      "multiple": false
    },
    "button": {
      "type": "component",
      "repeatable": false,
      "component": "shared.button"  // Nested component!
    }
  }
}
```

**Homepage'de Kullanımı:**
```json
{
  "cards": {
    "type": "component",
    "repeatable": true,
    "component": "shared.card"
  }
}
```

**API Response:**
```json
{
  "cards": [
    {
      "title": "Card 1",
      "description": "...",
      "image": {...},
      "button": {
        "text": "Learn More",
        "url": "/learn-more",
        "variant": "primary"
      }
    }
  ]
}
```

## Best Practices

### 1. Shared vs Non-Shared Seçimi

```javascript
// ✅ Shared kullanın:
shared.seo            // Her content type'da kullanılır
shared.address        // Users, Companies, Stores
shared.button         // Her yerde kullanılır
shared.social-links   // Header, Footer, Profile

// ✅ Non-Shared kullanın:
article.body          // Sadece Articles'da
product.specs         // Sadece Products'ta
event.registration    // Sadece Events'te
```

### 2. Component Kategori İsimlendirme

```javascript
// Önerilen kategori isimleri:
shared/     // Global, her yerde kullanılabilir
sections/   // Sayfa bölümleri (Hero, Features, CTA)
forms/      // Form elemanları (Input, Select, Checkbox)
layout/     // Layout elemanları (Header, Footer, Sidebar)
media/      // Medya elemanları (Gallery, Video, Image)
```

### 3. Component İsimlendirme

```javascript
// ✅ DOĞRU - Açıklayıcı, tek sorumluluk
shared.seo
shared.address
shared.button
sections.hero
sections.feature
sections.testimonial

// ❌ YANLIŞ - Çok genel veya belirsiz
shared.data
shared.info
shared.component1
sections.section
```

### 4. Field Sayısı

```javascript
// ✅ İDEAL - 3-8 field
Component: shared.button {
  text: string
  url: string
  variant: enum
  openInNewTab: boolean
}

// ❌ ÇOK FAZLA - Component'i böl
Component: shared.card {
  title: string
  subtitle: string
  description: text
  shortDescription: text
  longDescription: richtext
  image1: media
  image2: media
  image3: media
  buttonText: string
  buttonUrl: string
  buttonVariant: enum
  ... (20+ field)
}

// ✅ ÇÖZÜM - Nested component kullan
Component: shared.card {
  title: string
  description: text
  image: media
  button: component (shared.button)
}
```

### 5. Repeatable Kullanımı

```javascript
// ✅ Repeatable kullanın:
- Features (birden fazla özellik)
- Testimonials (birden fazla yorum)
- FAQ items (birden fazla soru)
- Gallery items (birden fazla resim)

// ✅ Non-Repeatable kullanın:
- SEO (tek bir SEO metadata)
- Hero (tek bir hero section)
- Contact info (tek bir iletişim bilgisi)
- Settings (tek bir ayar grubu)
```

### 6. Dynamic Zone Dikkatli Kullanın

```javascript
// ✅ İYİ - Sayfa builder için
Homepage:
  content: DynamicZone [
    sections.hero,
    sections.features,
    sections.testimonials,
    sections.cta
  ]

// ❌ KÖTÜ - Basit yapılar için gereksiz
Article:
  content: DynamicZone [
    article.text,
    article.image,
    article.video
  ]

// Yerine Rich Text veya Component kullanın
Article:
  content: RichText (daha basit ve hızlı)
```

### 7. Validation Ekleyin

```json
{
  "metaTitle": {
    "type": "string",
    "required": true,
    "minLength": 10,
    "maxLength": 60
  },
  "metaDescription": {
    "type": "text",
    "maxLength": 160
  },
  "url": {
    "type": "string",
    "regex": "^https?://.*"
  }
}
```

### 8. Default Values

```json
{
  "variant": {
    "type": "enumeration",
    "enum": ["primary", "secondary", "outline"],
    "default": "primary"
  },
  "openInNewTab": {
    "type": "boolean",
    "default": false
  },
  "alignment": {
    "type": "enumeration",
    "enum": ["left", "center", "right"],
    "default": "center"
  }
}
```

## Yaygın Component'ler

### Kullanıma Hazır Component Örnekleri

**1. SEO Component**
```json
shared.seo {
  metaTitle, metaDescription, keywords, ogImage, canonicalURL
}
```

**2. Address Component**
```json
shared.address {
  street, city, state, zipCode, country, latitude, longitude
}
```

**3. Button Component**
```json
shared.button {
  text, url, variant, openInNewTab, icon
}
```

**4. Social Links Component**
```json
shared.social-links {
  facebook, twitter, instagram, linkedin, youtube
}
```

**5. Hero Section**
```json
sections.hero {
  headline, subtitle, backgroundImage, button, alignment
}
```

**6. Feature Card**
```json
sections.feature {
  title, description, icon
}
```

**7. Testimonial**
```json
sections.testimonial {
  quote, author, avatar, rating, company
}
```

**8. Call-to-Action**
```json
sections.cta {
  title, description, button, backgroundImage
}
```

**9. FAQ Item**
```json
sections.faq-item {
  question, answer
}
```

**10. Gallery Item**
```json
media.gallery-item {
  image, caption, altText
}
```

## Kaynaklar

- [Strapi Components](https://docs.strapi.io/user-docs/content-type-builder/creating-new-content-type#creating-a-component)
- [Dynamic Zones](https://docs.strapi.io/user-docs/content-type-builder/creating-new-content-type#creating-a-dynamic-zone)
- [Component Schema](https://docs.strapi.io/dev-docs/backend-customization/models#components)
