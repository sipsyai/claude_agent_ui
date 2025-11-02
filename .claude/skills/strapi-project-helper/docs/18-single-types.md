# Single Types

Single Types, Strapi'de yalnızca tek bir entry içeren content type'lardır. Homepage, About Page, Site Settings gibi tekil içerikler için kullanılır.

## İçindekiler

1. [Single Type Nedir?](#single-type-nedir)
2. [Ne Zaman Kullanılır?](#ne-zaman-kullanılır)
3. [Oluşturma](#oluşturma)
4. [CRUD İşlemleri](#crud-işlemleri)
5. [Yaygın Kullanım Alanları](#yaygın-kullanım-alanları)
6. [Best Practices](#best-practices)
7. [Örnekler](#örnekler)

## Single Type Nedir?

### Tanım

Single Type, yalnızca **tek bir entry** içerebilen content type'lardır. Collection Type'ın aksine birden fazla kayıt oluşturamazsınız.

### Collection Type ile Farklar

| Özellik | Single Type | Collection Type |
|---------|-------------|-----------------|
| Entry Sayısı | **1** | Sınırsız |
| Kullanım | Homepage, About | Articles, Products |
| İsim | Tekil (Homepage) | Çoğul (Articles) |
| API | `/api/homepage` | `/api/articles` |
| Endpoint | GET, PUT | GET, POST, PUT, DELETE |
| ID | Yok | Var (1, 2, 3...) |

### API Endpoint Farkı

**Single Type:**
```
GET    /api/homepage        # Entry'yi getir
PUT    /api/homepage        # Entry'yi güncelle
DELETE Not available        # Silme yok!
POST   Not available        # Oluşturma yok!
```

**Collection Type:**
```
GET    /api/articles        # Tüm entry'leri getir
GET    /api/articles/1      # ID=1 olan entry'yi getir
POST   /api/articles        # Yeni entry oluştur
PUT    /api/articles/1      # ID=1 olan entry'yi güncelle
DELETE /api/articles/1      # ID=1 olan entry'yi sil
```

## Ne Zaman Kullanılır?

### Kullanım Alanları

Single Type'ı şu durumlarda kullanmalısınız:

1. **Sayfalar**
   - Homepage
   - About Page
   - Contact Page
   - Privacy Policy
   - Terms of Service

2. **Ayarlar**
   - Site Settings (site adı, logo, sosyal medya)
   - SEO Settings (meta tags, site description)
   - Theme Settings (renkler, font)
   - Email Settings (SMTP ayarları)

3. **Global İçerik**
   - Header (navigation, logo)
   - Footer (copyright, links)
   - Announcement Bar
   - Cookie Banner

4. **Tekil Veriler**
   - Company Info (adres, telefon, email)
   - Hero Section (ana sayfa hero)
   - Newsletter Settings

### Collection Type mu, Single Type mi?

**Sorular:**

1. **Bu içerikten birden fazla olacak mı?**
   - Evet → Collection Type
   - Hayır → Single Type

2. **Her entry benzersiz mi?**
   - Evet (farklı blog yazıları) → Collection Type
   - Hayır (tek bir about page) → Single Type

**Örnekler:**

```javascript
// Collection Type (birden fazla)
Articles       // Her article farklı
Products       // Her product farklı
Team Members   // Birden fazla üye

// Single Type (sadece bir tane)
Homepage       // Sadece bir ana sayfa
About Page     // Sadece bir hakkında sayfası
Site Settings  // Sadece bir ayar seti
```

## Oluşturma

### Admin Panel'den Oluşturma

**Adım 1: Content-Type Builder'ı Açın**
```
Admin Panel → Content-Type Builder → Create new single type
```

**Adım 2: İsim Belirleyin**
```javascript
Display name: Homepage
API ID (singular): homepage
```

**Not:** Single Type'larda plural (çoğul) isim olmaz!

**Adım 3: Field'ları Ekleyin**

Homepage için örnek field'lar:

```javascript
- title (Text)
- hero (Component - Hero section)
- features (Component - Repeatable - Feature cards)
- seo (Component - SEO metadata)
```

**Adım 4: Kaydedin ve Sunucuyu Yeniden Başlatın**

Strapi, schema değişikliklerinden sonra otomatik restart ister.

### Programatik Oluşturma

**Dosya: `src/api/homepage/content-types/homepage/schema.json`**

```json
{
  "kind": "singleType",
  "collectionName": "homepage",
  "info": {
    "singularName": "homepage",
    "pluralName": "homepage",
    "displayName": "Homepage",
    "description": "Homepage content"
  },
  "options": {
    "draftAndPublish": false
  },
  "pluginOptions": {},
  "attributes": {
    "title": {
      "type": "string",
      "required": true
    },
    "description": {
      "type": "text"
    },
    "hero": {
      "type": "component",
      "repeatable": false,
      "component": "sections.hero"
    },
    "features": {
      "type": "component",
      "repeatable": true,
      "component": "sections.feature"
    },
    "seo": {
      "type": "component",
      "repeatable": false,
      "component": "shared.seo"
    }
  }
}
```

**Not:** `"kind": "singleType"` önemli!

## CRUD İşlemleri

### Read (Okuma)

Single Type'da ID yok, direkt content type adıyla erişilir.

**API Endpoint:**
```
GET /api/homepage?populate=*
```

**Response:**
```json
{
  "data": {
    "id": 1,
    "attributes": {
      "title": "Welcome to My Site",
      "description": "...",
      "hero": {
        "headline": "Build Something Amazing",
        "subtitle": "...",
        "image": {...}
      },
      "features": [
        {
          "title": "Fast",
          "description": "...",
          "icon": "..."
        },
        {
          "title": "Secure",
          "description": "...",
          "icon": "..."
        }
      ],
      "seo": {
        "metaTitle": "Homepage",
        "metaDescription": "..."
      }
    }
  },
  "meta": {}
}
```

**Controller Kullanımı:**

```javascript
// src/api/homepage/controllers/homepage.js

module.exports = {
  async find(ctx) {
    const entity = await strapi.entityService.findMany('api::homepage.homepage', {
      populate: {
        hero: {
          populate: ['image']
        },
        features: {
          populate: ['icon']
        },
        seo: true
      }
    });

    return entity;
  }
};
```

### Update (Güncelleme)

**API Endpoint:**
```
PUT /api/homepage
```

**Request Body:**
```json
{
  "data": {
    "title": "Updated Homepage Title",
    "description": "New description"
  }
}
```

**Controller:**

```javascript
async update(ctx) {
  const { data } = ctx.request.body;

  const entity = await strapi.entityService.update('api::homepage.homepage', 1, {
    data,
    populate: ['hero', 'features', 'seo']
  });

  return entity;
}
```

**Not:** ID her zaman `1`'dir!

### Create & Delete

Single Type'larda **create ve delete endpoint'leri yoktur!**

Entry, admin panel'den ilk defa content eklediğinizde otomatik oluşturulur.

## Yaygın Kullanım Alanları

### 1. Homepage

**Schema:**
```json
{
  "kind": "singleType",
  "collectionName": "homepage",
  "info": {
    "singularName": "homepage",
    "pluralName": "homepage",
    "displayName": "Homepage"
  },
  "attributes": {
    "hero": {
      "type": "component",
      "repeatable": false,
      "component": "sections.hero"
    },
    "features": {
      "type": "component",
      "repeatable": true,
      "component": "sections.feature"
    },
    "testimonials": {
      "type": "component",
      "repeatable": true,
      "component": "sections.testimonial"
    },
    "cta": {
      "type": "component",
      "repeatable": false,
      "component": "sections.call-to-action"
    },
    "seo": {
      "type": "component",
      "repeatable": false,
      "component": "shared.seo"
    }
  }
}
```

### 2. Site Settings

**Schema:**
```json
{
  "kind": "singleType",
  "collectionName": "site_settings",
  "info": {
    "singularName": "site-setting",
    "pluralName": "site-settings",
    "displayName": "Site Settings"
  },
  "attributes": {
    "siteName": {
      "type": "string",
      "required": true,
      "default": "My Site"
    },
    "logo": {
      "type": "media",
      "multiple": false,
      "allowedTypes": ["images"]
    },
    "favicon": {
      "type": "media",
      "multiple": false,
      "allowedTypes": ["images"]
    },
    "social": {
      "type": "component",
      "repeatable": false,
      "component": "shared.social-links"
    },
    "footer": {
      "type": "component",
      "repeatable": false,
      "component": "shared.footer"
    },
    "maintenance": {
      "type": "boolean",
      "default": false
    },
    "maintenanceMessage": {
      "type": "text"
    }
  }
}
```

### 3. About Page

**Schema:**
```json
{
  "kind": "singleType",
  "collectionName": "about_page",
  "info": {
    "singularName": "about-page",
    "pluralName": "about-page",
    "displayName": "About Page"
  },
  "attributes": {
    "title": {
      "type": "string",
      "required": true
    },
    "content": {
      "type": "richtext",
      "required": true
    },
    "teamSection": {
      "type": "component",
      "repeatable": false,
      "component": "sections.team"
    },
    "historyTimeline": {
      "type": "component",
      "repeatable": true,
      "component": "sections.timeline-item"
    },
    "values": {
      "type": "component",
      "repeatable": true,
      "component": "sections.value"
    },
    "seo": {
      "type": "component",
      "repeatable": false,
      "component": "shared.seo"
    }
  }
}
```

### 4. Contact Page

**Schema:**
```json
{
  "kind": "singleType",
  "collectionName": "contact_page",
  "info": {
    "singularName": "contact-page",
    "pluralName": "contact-page",
    "displayName": "Contact Page"
  },
  "attributes": {
    "title": {
      "type": "string",
      "default": "Get in Touch"
    },
    "description": {
      "type": "text"
    },
    "email": {
      "type": "email",
      "required": true
    },
    "phone": {
      "type": "string"
    },
    "address": {
      "type": "text"
    },
    "mapEmbed": {
      "type": "text"
    },
    "officeHours": {
      "type": "component",
      "repeatable": false,
      "component": "shared.office-hours"
    },
    "seo": {
      "type": "component",
      "repeatable": false,
      "component": "shared.seo"
    }
  }
}
```

### 5. Global Header/Footer

**Header Single Type:**
```json
{
  "kind": "singleType",
  "collectionName": "header",
  "info": {
    "singularName": "header",
    "pluralName": "header",
    "displayName": "Header"
  },
  "attributes": {
    "logo": {
      "type": "media",
      "multiple": false,
      "allowedTypes": ["images"]
    },
    "navigation": {
      "type": "component",
      "repeatable": true,
      "component": "shared.nav-item"
    },
    "ctaButton": {
      "type": "component",
      "repeatable": false,
      "component": "shared.button"
    }
  }
}
```

**Footer Single Type:**
```json
{
  "kind": "singleType",
  "collectionName": "footer",
  "info": {
    "singularName": "footer",
    "pluralName": "footer",
    "displayName": "Footer"
  },
  "attributes": {
    "copyrightText": {
      "type": "string",
      "default": "© 2024 All Rights Reserved"
    },
    "footerLinks": {
      "type": "component",
      "repeatable": true,
      "component": "shared.link"
    },
    "socialLinks": {
      "type": "component",
      "repeatable": false,
      "component": "shared.social-links"
    },
    "newsletterText": {
      "type": "text"
    }
  }
}
```

## Best Practices

### 1. İsimlendirme

```javascript
// ✅ DOĞRU - Açıklayıcı, tekil
Homepage
SiteSettings
AboutPage
ContactPage

// ❌ YANLIŞ - Çoğul veya belirsiz
Homepages  // Çoğul kullanmayın!
Settings   // Çok genel
Page       // Belirsiz
```

### 2. Draft & Publish

Single Type'larda genellikle draft mode'a gerek yoktur:

```json
{
  "options": {
    "draftAndPublish": false
  }
}
```

Çünkü:
- Zaten tek entry var
- Değişiklikler doğrudan production'a yansısın istenir
- Draft için versiyonlama daha uygundur

**İstisna:** Büyük revizyonlar için draft kullanılabilir.

### 3. Component Kullanımı

Single Type'larda component kullanımı önerilir:

```javascript
// ✅ İYİ - Component ile organize
Homepage:
  - hero (Component)
  - features (Component - Repeatable)
  - testimonials (Component - Repeatable)
  - seo (Component)

// ❌ KÖTÜ - Tüm field'lar direkt
Homepage:
  - heroTitle
  - heroSubtitle
  - heroImage
  - heroButtonText
  - heroButtonLink
  - feature1Title
  - feature1Description
  - feature1Icon
  - feature2Title
  ... (50+ field)
```

### 4. SEO Component

Her Single Type'a SEO component'i ekleyin:

```json
{
  "seo": {
    "type": "component",
    "repeatable": false,
    "component": "shared.seo"
  }
}
```

**SEO Component Yapısı:**
```json
{
  "collectionName": "components_shared_seos",
  "info": {
    "displayName": "SEO"
  },
  "attributes": {
    "metaTitle": {
      "type": "string",
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
    "canonicalURL": {
      "type": "string"
    }
  }
}
```

### 5. Validation

Kritik field'lara validation ekleyin:

```json
{
  "email": {
    "type": "email",
    "required": true
  },
  "phone": {
    "type": "string",
    "regex": "^[0-9]{10,15}$"
  },
  "url": {
    "type": "string",
    "regex": "^https?://.*"
  }
}
```

### 6. Default Values

Mantıklı default değerler atayın:

```json
{
  "siteName": {
    "type": "string",
    "default": "My Site"
  },
  "copyrightYear": {
    "type": "integer",
    "default": 2024
  },
  "maintenance": {
    "type": "boolean",
    "default": false
  }
}
```

## Örnekler

### Frontend Kullanımı (React)

**Homepage:**
```javascript
import { useState, useEffect } from 'react';

function Homepage() {
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:1337/api/homepage?populate=deep')
      .then(res => res.json())
      .then(data => {
        setPage(data.data.attributes);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {/* Hero Section */}
      <section className="hero">
        <h1>{page.hero.headline}</h1>
        <p>{page.hero.subtitle}</p>
        <img
          src={page.hero.image.data.attributes.url}
          alt={page.hero.headline}
        />
      </section>

      {/* Features */}
      <section className="features">
        {page.features.map((feature, index) => (
          <div key={index} className="feature">
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="cta">
        <h2>{page.cta.title}</h2>
        <a href={page.cta.link}>{page.cta.buttonText}</a>
      </section>
    </div>
  );
}

export default Homepage;
```

**Site Settings:**
```javascript
import { useState, useEffect } from 'react';

function useSiteSettings() {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    fetch('http://localhost:1337/api/site-setting?populate=*')
      .then(res => res.json())
      .then(data => setSettings(data.data.attributes));
  }, []);

  return settings;
}

// Layout component'inde kullanım
function Layout({ children }) {
  const settings = useSiteSettings();

  if (!settings) return <div>Loading...</div>;

  return (
    <div>
      <header>
        <img src={settings.logo.data.attributes.url} alt={settings.siteName} />
        <h1>{settings.siteName}</h1>
      </header>

      <main>{children}</main>

      <footer>
        <p>{settings.footer.copyrightText}</p>
        <div className="social-links">
          {settings.social.links.map(link => (
            <a key={link.platform} href={link.url}>
              {link.platform}
            </a>
          ))}
        </div>
      </footer>
    </div>
  );
}
```

**Next.js SSG with Single Type:**
```javascript
// pages/index.js
export async function getStaticProps() {
  const res = await fetch('http://localhost:1337/api/homepage?populate=deep');
  const data = await res.json();

  return {
    props: {
      homepage: data.data.attributes
    },
    revalidate: 60 // Revalidate every 60 seconds
  };
}

export default function Home({ homepage }) {
  return (
    <div>
      <h1>{homepage.hero.headline}</h1>
      <p>{homepage.hero.subtitle}</p>
      {/* ... */}
    </div>
  );
}
```

### Controller Örnekleri

**Custom Find Method:**
```javascript
// src/api/homepage/controllers/homepage.js

module.exports = {
  async find(ctx) {
    // Maintenance mode kontrolü
    const settings = await strapi.entityService.findMany('api::site-setting.site-setting');

    if (settings.maintenance) {
      return ctx.send({
        message: settings.maintenanceMessage || 'Site under maintenance'
      }, 503);
    }

    // Normal response
    const entity = await strapi.entityService.findMany('api::homepage.homepage', {
      populate: {
        hero: {
          populate: ['image', 'button']
        },
        features: {
          populate: ['icon']
        },
        testimonials: {
          populate: ['avatar', 'user']
        },
        seo: {
          populate: ['ogImage']
        }
      }
    });

    return entity;
  }
};
```

**Custom Update with Validation:**
```javascript
async update(ctx) {
  const { data } = ctx.request.body;

  // Validation
  if (data.email && !isValidEmail(data.email)) {
    return ctx.badRequest('Invalid email format');
  }

  if (data.phone && !isValidPhone(data.phone)) {
    return ctx.badRequest('Invalid phone format');
  }

  // Update
  const entity = await strapi.entityService.update('api::contact-page.contact-page', 1, {
    data,
    populate: ['officeHours', 'seo']
  });

  return entity;
}
```

## Lifecycle Hooks

**Dosya: `src/api/site-setting/content-types/site-setting/lifecycles.js`**

```javascript
module.exports = {
  async afterUpdate(event) {
    const { result } = event;

    // Cache'i temizle
    await strapi.cache.del('site-settings');

    // Maintenance mode açıldıysa email gönder
    if (result.maintenance) {
      await strapi.plugins['email'].services.email.send({
        to: 'admin@example.com',
        subject: 'Site Maintenance Mode Enabled',
        text: `Maintenance mode has been enabled. Message: ${result.maintenanceMessage}`
      });
    }

    // Frontend'i rebuild et (Next.js ISR trigger)
    if (process.env.REBUILD_WEBHOOK) {
      await fetch(process.env.REBUILD_WEBHOOK, {
        method: 'POST'
      });
    }
  }
};
```

## Kaynaklar

- [Strapi Single Types](https://docs.strapi.io/user-docs/content-type-builder/creating-new-content-type#creating-a-single-type)
- [Single Type Schema](https://docs.strapi.io/dev-docs/backend-customization/models#single-types)
- [Entity Service API](https://docs.strapi.io/dev-docs/api/entity-service)
