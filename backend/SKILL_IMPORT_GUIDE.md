# Skill Import Guide - SKILL.md Dosyalarını İçe Aktarma

## Özet

Strapi Skill sistemi artık SKILL.md dosyalarını doğrudan import edebilir. Hem tek dosya hem de klasör bazlı toplu import desteklenir.

## Import Yöntemleri

### 1. İçerikten Import (Content-based)
SKILL.md içeriğini doğrudan request body'de gönderme.

**Endpoint:** `POST /api/skills/import`

**Request Body:**
```json
{
  "content": "---\nname: my-skill\n...",
  "overwrite": false
}
```

**Örnek:**
```bash
curl -X POST http://localhost:1337/api/skills/import \
  -H "Content-Type: application/json" \
  -d '{
    "content": "---\nname: example-skill\ndescription: Example skill for testing\n---\n\n# Example Skill\n\nSkill content here...",
    "overwrite": false
  }'
```

**Yanıt:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "example-skill",
    "description": "Example skill for testing",
    ...
  },
  "warnings": []
}
```

---

### 2. Dosya Yolundan Import (File-based)
Sunucudaki bir SKILL.md dosyasını import etme.

**Endpoint:** `POST /api/skills/import-file`

**Request Body:**
```json
{
  "filePath": "/path/to/SKILL.md",
  "overwrite": false
}
```

**Örnek:**
```bash
curl -X POST http://localhost:1337/api/skills/import-file \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "C:/Users/Ali/Documents/Projects/skills/my-skill/SKILL.md",
    "overwrite": false
  }'
```

**Yanıt:**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "my-skill",
    ...
  }
}
```

---

### 3. Klasör Import (Directory-based)
Bir klasördeki tüm skill'leri toplu olarak import etme.

**Endpoint:** `POST /api/skills/import-directory`

**Request Body:**
```json
{
  "dirPath": "/path/to/skills/directory",
  "overwrite": false
}
```

**Klasör Yapısı:**
```
skills/
├── skill-one/
│   └── SKILL.md
├── skill-two/
│   └── SKILL.md
└── skill-three/
    └── SKILL.md
```

**Örnek:**
```bash
curl -X POST http://localhost:1337/api/skills/import-directory \
  -H "Content-Type: application/json" \
  -d '{
    "dirPath": "C:/Users/Ali/Documents/Projects/skills",
    "overwrite": false
  }'
```

**Yanıt:**
```json
{
  "success": true,
  "results": [
    {
      "name": "skill-one",
      "result": {
        "success": true,
        "skill": { "id": 3, "name": "skill-one", ... }
      }
    },
    {
      "name": "skill-two",
      "result": {
        "success": true,
        "skill": { "id": 4, "name": "skill-two", ... }
      }
    },
    {
      "name": "skill-three",
      "result": {
        "success": false,
        "error": "Missing required field: description"
      }
    }
  ],
  "summary": {
    "total": 3,
    "successful": 2,
    "failed": 1
  }
}
```

---

## Parametreler

### `overwrite` (opsiyonel, default: `false`)

Aynı isimdeki skill zaten varsa ne yapılacağını belirler:

- **`false`**: Hata döner, mevcut skill korunur
- **`true`**: Mevcut skill güncellenir, veriler üzerine yazılır

**Örnek:**
```bash
# Üzerine yazma
curl -X POST http://localhost:1337/api/skills/import-file \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "/path/to/SKILL.md",
    "overwrite": true
  }'
```

---

## SKILL.md Format

Import edilecek SKILL.md dosyası Claude Agent SDK formatında olmalıdır:

```markdown
---
name: skill-name
description: What the skill does and when to use it
version: "1.0.0"
category: testing
mode: false
model: sonnet
experience_score: 85
license: MIT
allowed-tools: Read, Bash, Grep
mcp_tools:
  playwright:
    - browser_snapshot
    - browser_click
  filesystem:
    - read_file
training_history:
  - date: "2025-11-01T00:00:00Z"
    score_before: 70
    score_after: 85
    mode: real_execution
    issues_found:
      - "[Major] Issue description"
    corrections_made: true
    execution_success: true
    test_case: "Test case description"
---

# Skill Title

Markdown content here...

## Usage

Instructions...
```

---

## Field Mapping

Import sırasında SKILL.md frontmatter alanları Strapi field'larına şu şekilde eşlenir:

| SKILL.md Frontmatter | Strapi Field | Notlar |
|---------------------|--------------|--------|
| `name` | `name` | **Gerekli**, unique |
| `description` | `description` | **Gerekli** |
| `displayName` | `displayName` | Yoksa `name` kullanılır |
| `version` | `version` | Default: "1.0.0" |
| `mode` | `mode` | Default: false |
| `model` | `model` | Default: "inherit" |
| `disable-model-invocation` | `disableModelInvocation` | Default: false |
| `license` | `license` | |
| `experience_score` | `experienceScore` | Default: 0 |
| `category` | `category` | Default: "custom" |
| `isPublic` | `isPublic` | Default: true |
| `allowed-tools` | `allowedTools` | String (csv) veya array |
| `mcp_tools` / `mcp-tools` | `mcpServers` + `mcpTools` | Object → relations |
| `training_history` | `trainingHistory` | Array of objects |
| (markdown body) | `content` | |

---

## MCP Tools Resolution

`mcp_tools` frontmatter field'ı Strapi'deki MCP Server ve Tool relations'a dönüştürülür:

**SKILL.md:**
```yaml
mcp_tools:
  playwright:
    - browser_snapshot
    - browser_click
  filesystem:
    - read_file
```

**Strapi'de:**
- `mcpServers`: playwright, filesystem server'larının ID'leri
- `mcpTools`: belirtilen tool'ların ID'leri

**Önemli:**
- Server ve tool'lar **Strapi database'de önceden mevcut olmalı**
- Bulunamayanlar için warning döner ama import devam eder
- MCP tools boş bırakılabilir

---

## Hata Yönetimi

### Başarılı Import
```json
{
  "success": true,
  "data": { ... },
  "warnings": [
    "MCP tools specified but no matching servers/tools found in database"
  ]
}
```

### Hatalı Import
```json
{
  "success": false,
  "error": "Missing required field: name"
}
```

### Yaygın Hatalar

| Hata | Çözüm |
|------|-------|
| `Invalid SKILL.md format: Missing YAML frontmatter` | Dosya `---` delimiterleri ile başlamalı |
| `Invalid YAML frontmatter` | YAML syntax hatası, girinti kontrolü yapın |
| `Missing required field: name` | Frontmatter'da `name` field'ı zorunlu |
| `Missing required field: description` | Frontmatter'da `description` field'ı zorunlu |
| `Skill with name "..." already exists` | `overwrite: true` kullanın veya ismi değiştirin |
| `File not found` | Dosya yolu doğru mu kontrol edin |

---

## Kullanım Senaryoları

### Senaryo 1: Claude SDK'dan Migration
`.claude/skills/` klasöründeki tüm skill'leri import etme:

```bash
curl -X POST http://localhost:1337/api/skills/import-directory \
  -H "Content-Type: application/json" \
  -d '{
    "dirPath": "/Users/username/.claude/skills",
    "overwrite": false
  }'
```

### Senaryo 2: Yedekten Geri Yükleme
Export edilmiş skill'leri tekrar import etme:

```bash
# 1. Export (önceden yapılmış)
curl http://localhost:1337/api/skills/1/download > backup.md

# 2. Import
curl -X POST http://localhost:1337/api/skills/import-file \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "/path/to/backup.md",
    "overwrite": true
  }'
```

### Senaryo 3: API'den Programmatic Import
Node.js ile:

```javascript
const fs = require('fs');
const axios = require('axios');

const skillContent = fs.readFileSync('./my-skill/SKILL.md', 'utf-8');

const response = await axios.post('http://localhost:1337/api/skills/import', {
  content: skillContent,
  overwrite: false
});

console.log('Import result:', response.data);
```

### Senaryo 4: Batch Import Script
Bash script ile toplu import:

```bash
#!/bin/bash

SKILLS_DIR="/path/to/skills"
API_URL="http://localhost:1337/api/skills/import-file"

for skill_dir in "$SKILLS_DIR"/*; do
  if [ -d "$skill_dir" ] && [ -f "$skill_dir/SKILL.md" ]; then
    skill_path="$skill_dir/SKILL.md"
    echo "Importing: $skill_path"

    curl -X POST "$API_URL" \
      -H "Content-Type: application/json" \
      -d "{\"filePath\": \"$skill_path\", \"overwrite\": false}"

    echo ""
  fi
done
```

---

## Test

Test dosyası ile import denemesi:

```bash
# 1. Test dosyası oluştur
cat > test-skill.md << 'EOF'
---
name: test-skill
description: Test skill for import functionality
version: "1.0.0"
category: testing
---

# Test Skill

This is a test skill.
EOF

# 2. Import et
curl -X POST http://localhost:1337/api/skills/import-file \
  -H "Content-Type: application/json" \
  -d "{\"filePath\": \"$(pwd)/test-skill.md\", \"overwrite\": false}"

# 3. Kontrol et
curl http://localhost:1337/api/skills?filters[name][\$eq]=test-skill
```

---

## Performans

### Tek Dosya Import
- **Süre:** ~100-200ms
- **Veritabanı:** 1-3 query (skill + MCP relations)

### Klasör Import (100 skill)
- **Süre:** ~10-20 saniye
- **Veritabanı:** Her skill için 1-3 query
- **Paralel işlem:** Hayır (sıralı işlenir)

### Optimizasyon İpuçları
- Büyük toplu importlarda batch'ler halinde gönderin
- `overwrite: false` ile önce dry-run yapın
- MCP relation'ları önceden database'de hazırlayın

---

## Güvenlik

### Dosya Yolu Güvenliği
- **Sandboxing yok**: Backend server'ın erişebildiği her dosyayı okuyabilir
- **Production:** File-based import'u devre dışı bırakın veya path validation ekleyin
- **Önerilen:** Sadece content-based import kullanın

### Auth/Permission
Şu anda tüm import endpoint'leri **public** (auth: false).

**Production için:**
```typescript
// custom-routes.ts
{
  method: 'POST',
  path: '/skills/import-file',
  handler: 'skill.importFile',
  config: {
    auth: true,  // ✅ Auth gerekli
    policies: ['admin::isAdmin']  // ✅ Sadece admin
  }
}
```

---

## Troubleshooting

### YAML Parse Hatası
```
Error: Invalid YAML frontmatter: bad indentation
```

**Çözüm:** YAML girinti tab değil space kullanmalı, nested object'lerde 2 space.

### MCP Tools Bulunamıyor
```
Warning: MCP tools specified but no matching servers/tools found
```

**Çözüm:**
1. MCP Server ve Tool'ları önce Strapi'de oluşturun
2. İsimlerin tam olarak eşleştiğinden emin olun (case-sensitive)

### Overwrite Çalışmıyor
```
Error: Skill with name "..." already exists
```

**Çözüm:** Request body'de `"overwrite": true` kullanın (string değil boolean).

---

## Gelecek Özellikler (TODO)

- [ ] Additional files import (REFERENCE.md, EXAMPLES.md)
- [ ] ZIP archive import
- [ ] Import preview/dry-run mode
- [ ] Import validation warnings
- [ ] Async bulk import (job queue)
- [ ] Import history tracking
- [ ] Rollback support

---

## Referanslar

- [Skill Schema Update](./SKILL_SCHEMA_UPDATE.md)
- [Claude Agent SDK Documentation](../claude_agent_sdk_docs/)
- [Strapi Custom Routes](https://docs.strapi.io/dev-docs/backend-customization/routes)

---

**Oluşturulma Tarihi:** 2025-11-01
**Versiyon:** 1.0.0
**Yazar:** Claude Code
