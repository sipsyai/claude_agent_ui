# Strapi Documentation for Claude Agent UI Migration

**Downloaded:** 2025-10-31
**Purpose:** Migration reference for Strapi + PostgreSQL integration

---

## 📚 Documentation Index

### 🔴 Kritik Öncelikli (Essential for Migration)

| # | Dosya | Başlık | Kullanım |
|---|-------|--------|----------|
| 01 | `01-quick-start.md` | Quick Start Guide | İlk setup ve proje oluşturma |
| 02 | `02-installation.md` | Installation | CLI ve Docker kurulumu |
| 03 | `03-project-structure.md` | Project Structure | Klasör yapısı ve organizasyon |
| 04 | `04-content-type-builder.md` | Content Type Builder | Agent, Skill, MCP Server tanımlama |
| 05 | `05-content-manager.md` | Content Manager | İçerik yönetimi ve admin panel |
| 06 | `06-rest-api.md` | REST API | API endpoints ve kullanımı |
| 07 | `07-document-service-api.md` | Document Service API | CRUD operations (backend) |
| 08 | `08-database-configuration.md` | Database Configuration | PostgreSQL bağlantısı |
| 09 | `09-environment-variables.md` | Environment Variables | .env configuration |
| 10 | `10-backend-customization.md` | Backend Customization | Custom controllers & services |

---

### 🟡 Orta Öncelikli (Recommended for Development)

| # | Dosya | Başlık | Kullanım |
|---|-------|--------|----------|
| 11 | `11-document-concept.md` | Document Concept | Strapi 5 document yapısı |
| 12 | `12-lifecycle-functions.md` | Lifecycle Functions | Register, bootstrap, destroy hooks |
| 13 | `13-typescript-introduction.md` | TypeScript Introduction | TypeScript entegrasyonu |
| 14 | `14-typescript-configuration.md` | TypeScript Configuration | tsconfig.json ayarları |
| 15 | `15-api-tokens.md` | API Tokens | Express → Strapi authentication |
| 16 | `16-users-permissions.md` | Users & Permissions | JWT, roles, permissions |
| 17 | `17-server-configuration.md` | Server Configuration | Host, port, CORS, proxy |
| 18 | `18-middlewares.md` | Middlewares | Security, CORS, compression |
| 19 | `19-deployment.md` | Deployment | Production build & deploy |

---

## 🎯 Kullanım Senaryoları

### Faz 1: Setup (Gün 1-2)
**Okuyun:**
- `01-quick-start.md` - İlk proje oluşturma
- `02-installation.md` - CLI kurulumu
- `03-project-structure.md` - Dosya yapısını anlama
- `08-database-configuration.md` - PostgreSQL bağlantısı
- `09-environment-variables.md` - Environment setup

### Faz 2: Content Types (Gün 3)
**Okuyun:**
- `04-content-type-builder.md` - Agent, Skill, MCP Server modelleri
- `05-content-manager.md` - Admin panel kullanımı
- `11-document-concept.md` - Document yapısı

### Faz 3: API Integration (Gün 4-5)
**Okuyun:**
- `06-rest-api.md` - REST endpoints
- `07-document-service-api.md` - Backend CRUD
- `10-backend-customization.md` - Custom controllers
- `15-api-tokens.md` - Authentication

### Faz 4: Security & Deploy (Gün 6-8)
**Okuyun:**
- `16-users-permissions.md` - User management
- `17-server-configuration.md` - Server setup
- `18-middlewares.md` - CORS, security
- `19-deployment.md` - Production deploy

---

## 💡 Hızlı Referanslar

### Agent Content Type Oluşturma
→ `04-content-type-builder.md` (Sayfa: Creating Content-types manually)

### PostgreSQL Bağlantısı
→ `08-database-configuration.md` (Sayfa: PostgreSQL Configuration)

### REST API Kullanımı
→ `06-rest-api.md` (Sayfa: Request Examples)

### Custom Controller Yazma
→ `10-backend-customization.md` (Sayfa: Controllers & Services)

### JWT Configuration
→ `16-users-permissions.md` (Sayfa: JWT Configuration)

### CORS Ayarları
→ `18-middlewares.md` (Sayfa: cors middleware)

### Production Build
→ `19-deployment.md` (Sayfa: Build the Admin Panel)

---

## 📖 Nasıl Kullanılır?

1. **Sıralı Okuma:** Numaralara göre sırayla oku (01'den 19'a)
2. **İhtiyaç Bazlı:** Yukarıdaki kullanım senaryolarına göre okumaya öncelik ver
3. **Referans:** Hızlı Referanslar bölümünden spesifik konuları bul
4. **Arama:** Her dosya içinde Ctrl+F ile arama yap

---

## 🔗 Orijinal Kaynaklar

Tüm dokümantasyon şuradan alınmıştır:
**https://docs.strapi.io/cms/intro**

---

## 📝 Notlar

- Tüm dosyalar markdown formatındadır
- Kod örnekleri hem JavaScript hem TypeScript içerir
- Her dosyanın başında source URL'i belirtilmiştir
- API endpoint'ler ve konfigürasyon örnekleri eksiksiz dahil edilmiştir

---

**Proje:** Claude Agent UI - Strapi Migration
**Hedef:** Express + SQLite → Strapi + PostgreSQL (Hybrid Architecture)
**Dokümantasyon Versiyonu:** Strapi 5
