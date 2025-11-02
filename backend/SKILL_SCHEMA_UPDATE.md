# Skill Schema Update - Claude Agent SDK Uyumluluğu

## Özet

Strapi Skill content type'ı Claude Agent SDK dokümantasyonuna tam uyumlu hale getirildi. Tüm veriler Strapi'de saklanacak şekilde yapılandırıldı.

## Yapılan Değişiklikler

### 1. SkillFile Component Oluşturuldu
- **Konum:** `src/components/skill/skill-file.json`
- **Amaç:** REFERENCE.md, EXAMPLES.md, TROUBLESHOOTING.md gibi ek dosyaları Strapi'de saklamak
- **Alanlar:**
  - `filename`: Dosya adı (UPPERCASE.md formatında)
  - `content`: Markdown içeriği

### 2. Skill Schema Güncellemeleri
- **Konum:** `src/api/skill/content-types/skill/schema.json`

#### Yeni Alanlar:
- `mode` (boolean): Mode command özelliği
- `model` (enum): Tercih edilen Claude modeli (haiku, sonnet, opus, inherit)
- `disableModelInvocation` (boolean): Otomatik çağrıyı devre dışı bırakma
- `license` (string): Lisans bilgisi
- `trainingHistory` (JSON): Eğitim geçmişi kayıtları
- `additionalFiles` (component): SkillFile component'leri (repeatable)

#### Yeni İlişkiler:
- `mcpTools` (many-to-many): MCP Tool'ları
- `mcpServers` (many-to-many): MCP Server'ları

#### Güncellemeler:
- `name` maxLength: 100 → 64 (SDK spesifikasyonu)
- `category` enum'a eklenenler: "browser-automation", "testing"
- `allowedTools`: DEPRECATED olarak işaretlendi (backward compatibility için tutuldu)
- Tüm alanlara description'lar eklendi

### 3. Migration Script
- **Konum:** `database/migrations/2025.11.01.00.00.00.update-skill-schema-for-claude-sdk.js`
- **Görevleri:**
  - Mevcut skill verilerini kontrol eder
  - Yeni alanlar için default değerler atar
  - 64 karakterden uzun isimleri uyarır
  - Rollback desteği içerir

### 4. Skill Service Genişletildi
- **Konum:** `src/api/skill/services/skill.ts`
- **Yeni Metodlar:**
  - `findWithMcpRelations(id)`: MCP ilişkileriyle beraber skill'i getirir
  - `formatMcpToolsForFrontmatter()`: MCP yapısını Claude SDK formatına dönüştürür
  - `generateSkillMdContent(skill)`: YAML frontmatter + markdown oluşturur
  - `exportToSkillMd(id)`: Skill'i SKILL.md formatında export eder
- **Bağımlılık:** js-yaml paketi eklendi

### 5. Skill Controller Genişletildi
- **Konum:** `src/api/skill/controllers/skill.ts`
- **Yeni Endpoint'ler:**
  - `GET /api/skills/:id/export`: JSON formatında export
  - `GET /api/skills/:id/download`: SKILL.md dosyası olarak indir
  - `GET /api/skills/:id/download-archive`: ZIP arşivi (TODO)

### 6. Custom Routes Eklendi
- **Konum:** `src/api/skill/routes/skill.ts`
- Export endpoint'leri için custom route'lar eklendi
- Default Strapi routes korundu

### 7. Validation Utilities
- **Konum:** `src/api/skill/utils/validation.ts`
- **Fonksiyonlar:**
  - `validateSkillName()`: Claude SDK kurallarına göre isim validasyonu
  - `validateDescription()`: Açıklama validasyonu
  - `validateVersion()`: Semantic versioning kontrolü
  - `validateTrainingHistory()`: Eğitim geçmişi validasyonu
  - `validateSkill()`: Tam skill objesi validasyonu

## Kullanım

### 1. Migration'ı Çalıştırma

Migration Strapi başlatıldığında otomatik olarak çalışacaktır. Manuel çalıştırmak isterseniz:

```bash
cd backend
npm run strapi migrations:run
```

### 2. Skill Export Etme

#### JSON Formatında:
```bash
GET http://localhost:1337/api/skills/1/export
```

Yanıt:
```json
{
  "data": {
    "frontmatter": {
      "name": "my-skill",
      "description": "...",
      "mcp_tools": {
        "playwright": ["browser_snapshot", "browser_click"]
      }
    },
    "content": "---\nname: my-skill\n...",
    "additionalFiles": [
      {
        "filename": "REFERENCE.md",
        "content": "..."
      }
    ]
  }
}
```

#### Dosya Olarak İndirme:
```bash
GET http://localhost:1337/api/skills/1/download
```

SKILL.md dosyası indirilir.

### 3. Strapi Admin'de Kullanım

1. **Skills** content type'ını açın
2. Yeni alan grupları göreceksiniz:
   - **Claude SDK Fields**: mode, model, disableModelInvocation
   - **MCP Relations**: mcpTools, mcpServers
   - **Additional Files**: additionalFiles component
3. **Additional Files** bölümünden ek markdown dosyaları ekleyebilirsiniz
4. **MCP Tools/Servers** seçimlerini yapabilirsiniz

### 4. Programatik Kullanım

```typescript
// Service kullanımı
const skillService = strapi.service('api::skill.skill');

// MCP ilişkileriyle skill getir
const skill = await skillService.findWithMcpRelations(1);

// Export
const exported = await skillService.exportToSkillMd(1);
console.log(exported.content); // SKILL.md içeriği
console.log(exported.additionalFiles); // Ek dosyalar
```

## Claude Agent SDK Uyumluluğu

### SKILL.md Frontmatter Formatı

```yaml
---
name: skill-name
description: What it does and when to use it
allowed-tools: Read, Bash, Grep
mcp_tools:
  playwright:
    - browser_snapshot
    - browser_click
  filesystem:
    - read_file
version: "1.0.0"
mode: false
model: sonnet
experience_score: 85
license: MIT
training_history:
  - date: "2025-01-30T00:00:00Z"
    score_before: 70
    score_after: 85
    mode: real_execution
    issues_found:
      - "[Major] Issue description"
    corrections_made: true
    execution_success: true
---

# Skill Content

Main markdown documentation...
```

## Yeni Özellikler

### 1. MCP Integration
- Skill'ler artık MCP Tool ve Server'larla doğrudan ilişkilendirilebilir
- Export sırasında otomatik olarak Claude SDK formatına dönüştürülür
- Strapi admin panelinden görsel olarak yönetilebilir

### 2. Additional Files
- REFERENCE.md, EXAMPLES.md gibi ek dosyalar Strapi'de saklanır
- Component-based yapı ile esnek yönetim
- Export sırasında dahil edilir

### 3. Training History
- Skill'in gelişim geçmişi izlenebilir
- Score takibi (before/after)
- Issue tracking
- Test case kayıtları

### 4. Validation
- Claude SDK kurallarına uygun validasyon
- Kullanıcı dostu hata mesajları
- Warning/error ayrımı

## Migration Notları

### Mevcut Veriler
- Mevcut skill kayıtları korunacak
- Yeni alanlar default değerlerle doldurulacak
- `allowedTools` JSON field backward compatibility için tutuldu

### İsim Uzunluğu Uyarısı
Eğer 64 karakterden uzun skill isimleri varsa migration sırasında uyarı verecektir. Bu skill'leri manuel olarak yeniden adlandırmalısınız.

### MCP Relations
- Başlangıçta boş olacak
- Manuel olarak Strapi admin'den doldurulmalı
- Veya API üzerinden programatik olarak güncellenebilir

## Paket Bağımlılıkları

Yüklenen yeni paketler:
- `js-yaml`: YAML frontmatter serialization
- `@types/js-yaml`: TypeScript tipleri

## Dosya Yapısı

```
backend/
├── src/
│   ├── api/
│   │   └── skill/
│   │       ├── content-types/
│   │       │   └── skill/
│   │       │       └── schema.json (✨ Güncellendi)
│   │       ├── controllers/
│   │       │   └── skill.ts (✨ Güncellendi)
│   │       ├── services/
│   │       │   └── skill.ts (✨ Güncellendi)
│   │       ├── routes/
│   │       │   └── skill.ts (✨ Güncellendi)
│   │       └── utils/
│   │           └── validation.ts (✨ Yeni)
│   └── components/
│       └── skill/
│           └── skill-file.json (✨ Yeni)
└── database/
    └── migrations/
        └── 2025.11.01.00.00.00.update-skill-schema-for-claude-sdk.js (✨ Yeni)
```

## Sonraki Adımlar

1. **Strapi'yi yeniden başlatın:**
   ```bash
   cd backend
   npm run develop
   ```

2. **Admin panelde yeni alanları kontrol edin:**
   - Skills → Edit
   - Yeni alan gruplarını görmelisiniz

3. **Mevcut skill'leri güncelleyin:**
   - MCP Tool/Server ilişkilendirmelerini yapın
   - Additional files ekleyin
   - Training history doldurun

4. **Export'u test edin:**
   ```bash
   curl http://localhost:1337/api/skills/1/export
   ```

## Sorun Giderme

### Migration Çalışmıyor
```bash
# Migration'ları temizle ve yeniden çalıştır
npm run strapi migrations:reset
npm run strapi migrations:run
```

### Schema Değişiklikleri Yansımıyor
```bash
# Strapi cache'ini temizle
rm -rf .cache
rm -rf build
npm run develop
```

### Export Endpoint Çalışmıyor
- Strapi'nin tamamen yeniden başlatıldığından emin olun
- Routes dosyasının düzgün yüklendiğini kontrol edin
- Browser console'da hata olup olmadığına bakın

## Referanslar

- [Claude Agent SDK Documentation](../claude_agent_sdk_docs/)
- [Strapi Components](https://docs.strapi.io/dev-docs/backend-customization/models#components)
- [Strapi Custom Routes](https://docs.strapi.io/dev-docs/backend-customization/routes)

---

**Oluşturulma Tarihi:** 2025-11-01
**Versiyon:** 1.0.0
**Yazar:** Claude Code
