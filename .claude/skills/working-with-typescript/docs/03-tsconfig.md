# TypeScript Configuration (tsconfig.json)

**Topic:** Compiler Configuration
**Created:** 2025-10-31

---

## Basic tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Essential Compiler Options

### Target & Module

```json
{
  "compilerOptions": {
    "target": "ES2020",        // Output JavaScript version
    "module": "commonjs",       // Module system (commonjs, esnext, es2020)
    "lib": ["ES2020"],         // Standard library to include
    "moduleResolution": "node"  // How to resolve modules
  }
}
```

### Output Configuration

```json
{
  "compilerOptions": {
    "outDir": "./dist",              // Output directory
    "rootDir": "./src",              // Input directory
    "declaration": true,             // Generate .d.ts files
    "declarationMap": true,          // Sourcemaps for .d.ts
    "sourceMap": true,               // Generate .js.map files
    "removeComments": true,          // Remove comments in output
    "noEmit": false                  // Don't emit output (type-checking only)
  }
}
```

### Strict Type Checking

```json
{
  "compilerOptions": {
    "strict": true,  // Enable all strict type-checking options

    // Or enable individually:
    "noImplicitAny": true,              // Error on implicit 'any'
    "strictNullChecks": true,           // null and undefined handling
    "strictFunctionTypes": true,        // Function type checking
    "strictBindCallApply": true,        // Strict bind/call/apply
    "strictPropertyInitialization": true, // Class property initialization
    "noImplicitThis": true,             // Error on implicit 'this'
    "alwaysStrict": true                // Emit "use strict"
  }
}
```

### Module Resolution

```json
{
  "compilerOptions": {
    "baseUrl": "./",
    "paths": {
      "@/*": ["src/*"],
      "@models/*": ["src/models/*"],
      "@services/*": ["src/services/*"]
    },
    "typeRoots": ["./node_modules/@types", "./types"],
    "types": ["node", "jest"]
  }
}
```

### Additional Checks

```json
{
  "compilerOptions": {
    "noUnusedLocals": true,           // Error on unused local variables
    "noUnusedParameters": true,       // Error on unused parameters
    "noImplicitReturns": true,        // Error on missing return
    "noFallthroughCasesInSwitch": true, // Error on switch fallthrough
    "noUncheckedIndexedAccess": true  // Stricter indexed access
  }
}
```

### Interop & Compatibility

```json
{
  "compilerOptions": {
    "esModuleInterop": true,            // Better CommonJS/ES6 interop
    "allowSyntheticDefaultImports": true, // Allow default imports from modules with no default export
    "resolveJsonModule": true,          // Import .json files
    "isolatedModules": true,            // Each file is a separate module
    "skipLibCheck": true,               // Skip type checking of .d.ts files
    "forceConsistentCasingInFileNames": true // Case-sensitive imports
  }
}
```

## For Node.js Projects

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.spec.ts"]
}
```

## For React Projects (Vite)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

## For Express + Strapi (Claude Agent UI)

```json
{
  "extends": "@strapi/typescript-utils/tsconfigs/server",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./",
    "baseUrl": "./",
    "paths": {
      "~/*": ["./*"]
    },
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"]
  },
  "include": [
    "./",
    "./**/*.ts",
    "./**/*.js",
    "src/**/*.json"
  ],
  "exclude": [
    "node_modules",
    "build",
    "dist",
    ".cache",
    ".tmp"
  ]
}
```

## Include/Exclude Patterns

```json
{
  "include": [
    "src/**/*",           // All files in src
    "types/**/*"          // Type declarations
  ],
  "exclude": [
    "node_modules",       // Dependencies
    "dist",               // Output
    "**/*.spec.ts",       // Test files
    "**/*.test.ts",
    "**/__tests__/**"
  ]
}
```

## Project References

For monorepo or multi-project setup:

```json
{
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "declarationMap": true
  },
  "references": [
    { "path": "../shared" },
    { "path": "../backend" }
  ]
}
```

## Watch Options

```json
{
  "watchOptions": {
    "watchFile": "useFsEvents",
    "watchDirectory": "useFsEvents",
    "fallbackPolling": "dynamicPriority",
    "synchronousWatchDirectory": true,
    "excludeDirectories": ["**/node_modules", "_build"]
  }
}
```

## Common Presets

### Strict Preset
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### Performance Preset
```json
{
  "compilerOptions": {
    "skipLibCheck": true,
    "incremental": true,
    "tsBuildInfoFile": "./.tsbuildinfo"
  }
}
```

## Tips

1. **Start with `strict: true`** - Enable all strict checks
2. **Use `skipLibCheck: true`** - Faster compilation
3. **Enable `incremental`** - Faster rebuilds
4. **Use path mapping** - Clean imports (`@/components`)
5. **Separate configs** - tsconfig.build.json, tsconfig.test.json
