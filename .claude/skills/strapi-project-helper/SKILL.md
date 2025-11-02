---
name: strapi-project-helper
description: Strapi proje dokümantasyonu ve yardımcısı. Content-Type Builder best practices, Collection Types, Single Types, Components (shared/non-shared), ilişkiler, custom controllers/services, database queries/filters, file upload ve media yönetimi konularında detaylı bilgi ve kod örnekleri sağlar. Strapi ile ilgili sorularda, API geliştirmede, content type oluştururken, veritabanı sorgularında veya dosya yükleme işlemlerinde kullanın.
allowed-tools: Read, Grep, Glob
---

# Strapi Project Helper

Bu skill, Strapi projenizde en çok kullanılan konularda detaylı dokümantasyon ve hazır kod örnekleri sağlar. Sadece dokümanlara bakarak sorularınızı cevaplayabilir.

## Kapsanan Konular

### 1. Content-Type Builder & Best Practices
- Content-Type Builder kullanımı
- Field type seçimi ve best practices
- İsimlendirme kuralları
- Validation ve güvenlik
- Performans optimizasyonu
- Yaygın hatalar ve çözümleri

### 2. Collection Types
- Collection Type nedir ve ne zaman kullanılır
- Oluşturma ve yapılandırma
- Field tipleri (Text, Number, Date, Media, JSON, UID)
- CRUD işlemleri
- Lifecycle hooks
- Draft & Publish mode
- Gerçek proje örnekleri (Blog, E-commerce)

### 3. Single Types
- Single Type nedir ve ne zaman kullanılır
- Collection Type ile farklar
- Kullanım alanları (Homepage, Settings, About)
- API endpoint farkları
- Component kullanımı
- Best practices

### 4. Components
- Component nedir ve avantajları
- Shared vs Non-Shared components
- Repeatable components
- Dynamic Zones
- Nested components
- Component library örnekleri
- Frontend rendering

### 5. Content-Type Relations (İlişkiler)
- One-to-Many ilişkiler
- Many-to-Many ilişkiler
- One-to-One ilişkiler
- Populate kullanımı
- İlişkili veri sorgulama

### 6. Custom Controllers & Services
- Custom endpoint oluşturma
- Business logic yazma
- Service katmanı kullanımı
- Controller-Service-Route yapısı
- Policy ve middleware entegrasyonu

### 7. Database Queries & Filters
- Filtreleme (eq, ne, lt, gt, contains, etc.)
- Sıralama (sort)
- Pagination (page, pageSize, start, limit)
- Complex queries
- Populate ve select kullanımı

### 8. File Upload & Media
- Dosya yükleme
- Media library kullanımı
- Upload provider yapılandırması
- Resim işleme
- Dosya validasyonu

## Dokümantasyon İndeksi

### Content-Type Builder & Best Practices
- [Content-Type Builder Best Practices](docs/16-content-type-builder-best-practices.md) - Field seçimi, isimlendirme, validation, güvenlik ve performans

### Collection Types
- [Collection Types Guide](docs/17-collection-types.md) - Collection type oluşturma, field tipleri, CRUD işlemleri ve örnekler

### Single Types
- [Single Types Guide](docs/18-single-types.md) - Single type kullanımı, Collection Type farkları ve yaygın kullanım senaryoları

### Components
- [Components Guide](docs/19-components.md) - Shared/non-shared components, repeatable, dynamic zones ve component library

### Content-Type Relations
- [Relations Overview](docs/01-relations-overview.md) - İlişki tipleri ve kullanım alanları
- [Populate Guide](docs/02-populate-guide.md) - İlişkili veriyi sorgulama

### Custom Controllers & Services
- [Custom Routes](docs/04-custom-routes.md) - Route tanımlama ve yapılandırma
- [Controllers Guide](docs/05-controllers-guide.md) - Controller yazma ve best practices
- [Services Guide](docs/06-services-guide.md) - Service katmanı ve business logic

### Database Queries & Filters
- [Advanced Filters](docs/09-advanced-filters.md) - Complex filtering ve operators

### File Upload & Media
- [Upload API](docs/14-upload-api.md) - Programatik dosya yükleme

## Örnek Kod Dizini

### Content-Type Examples
- [examples/content-types/blog-system.json](examples/content-types/blog-system.json) - Tam blog sistemi
- [examples/content-types/ecommerce-system.json](examples/content-types/ecommerce-system.json) - E-commerce yapısı
- [examples/content-types/single-types-examples.json](examples/content-types/single-types-examples.json) - Single Type örnekleri

### Component Examples
- [examples/components/reusable-components.json](examples/components/reusable-components.json) - Hazır component kütüphanesi

## Kaynaklar

Tüm bilgiler Strapi 5 resmi dokümantasyonundan derlenmiştir:
- https://docs.strapi.io/cms/intro
- https://docs.strapi.io/dev-docs/intro
- https://docs.strapi.io/user-docs/content-type-builder
