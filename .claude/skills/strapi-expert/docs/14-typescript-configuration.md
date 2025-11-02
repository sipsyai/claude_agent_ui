# TypeScript Configuration

**Source:** https://docs.strapi.io/cms/configurations/typescript
**Downloaded:** 2025-10-31

---

# TypeScript Configuration

> "TypeScript configuration explains the project's tsconfig files, output directories, and an optional
> `config/typescript.js|ts`"

TypeScript-enabled Strapi projects maintain a specific project structure and handle configuration through `tsconfig.json` files.

## Project Structure and TypeScript-Specific Configuration Files

TypeScript-enabled applications include dedicated folders and configuration files:

| Location | Purpose |
|----------|---------|
| `./dist` directory (application root) | Compilation location for project JavaScript source code |
| `build` directory (`./dist`) | Compiled administration panel JavaScript; created on first build command |
| `tsconfig.json` (application root) | Manages TypeScript compilation for the server |
| `tsconfig.json` (`./src/admin/`) | Manages TypeScript compilation for the admin panel |

## Strapi-Specific Configuration for TypeScript

⚠️ **Note:** This feature is experimental and might have issues or break some features.

Strapi generates types based on your project structure. To prevent manually generating types after each server restart, create an optional `config/typescript.js|ts` configuration file.

### Configuration Parameters

| Parameter | Description | Type | Default |
|-----------|-------------|------|---------|
| `autogenerate` | Enable/disable automatic types generation on server restart | Boolean | `false` |

### Example Configuration

**JavaScript (`./config/typescript.js`):**
```javascript
module.exports = ({ env }) => ({
  autogenerate: true,
});
```

**TypeScript (`./config/typescript.ts`):**
```typescript
export default ({ env }) => ({
  autogenerate: true,
});
```

---

### Related Topics
- [TypeScript Introduction](/cms/typescript)
- [TypeScript Development](/cms/typescript/development)
- [Project Structure](/cms/project-structure)
