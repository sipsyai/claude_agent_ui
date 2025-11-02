---
name: working-with-typescript
description: Comprehensive TypeScript documentation covering type system, generics, utility types, interfaces, tsconfig configuration, and integration with Node.js/React. Use when writing TypeScript code, configuring tsconfig.json, defining types and interfaces, using generics, applying utility types like Partial/Pick/Omit, or troubleshooting type errors.
---

# TypeScript Expert

Comprehensive TypeScript reference for type-safe development with Node.js and React.

## What This Skill Covers

- **Fundamentals**: Type annotations, inference, basic types
- **Type System**: Interfaces, type aliases, unions, intersections
- **Advanced Types**: Generics, conditional types, mapped types
- **Utility Types**: Partial, Pick, Omit, Record, ReturnType
- **Configuration**: tsconfig.json, compiler options, project setup
- **Integration**: TypeScript with Node.js, Express, React

## Quick Reference

### Common Tasks

**TypeScript Basics**
→ See [docs/01-typescript-basics.md](docs/01-typescript-basics.md)

**Configuring tsconfig.json**
→ See [docs/03-tsconfig.md](docs/03-tsconfig.md)

**Using Generics**
→ See [docs/05-generics.md](docs/05-generics.md)

**Utility Types (Partial, Pick, Omit)**
→ See [docs/06-utility-types.md](docs/06-utility-types.md)

---

## Documentation Index

### 🚀 Getting Started

- [TypeScript Fundamentals](docs/01-typescript-basics.md) - Type annotations, inference, basic types, functions, classes
- [tsconfig.json Configuration](docs/03-tsconfig.md) - Compiler options, module resolution, strict mode

### ⚡ Type System

- [Generics](docs/05-generics.md) - Generic functions, classes, interfaces, constraints
- [Utility Types](docs/06-utility-types.md) - Partial, Pick, Omit, Record, ReturnType, and more

---

## How to Use This Skill

### Migration Context (Express + Strapi)

For the Claude Agent UI migration:

1. **Phase 1: Setup** → Read docs 03 (tsconfig.json)
2. **Phase 2: Type Definitions** → Read docs 01 (basics), 06 (utility types)
3. **Phase 3: Generic Functions** → Read docs 05 (generics)
4. **Phase 4: Integration** → Apply types to Express routes and Strapi client

### Example Workflows

**Starting a new TypeScript project:**
1. Read [tsconfig.md](docs/03-tsconfig.md) for configuration
2. Read [TypeScript Basics](docs/01-typescript-basics.md) for fundamentals
3. Set up strict mode and path aliases

**Defining data models:**
1. Read [TypeScript Basics](docs/01-typescript-basics.md) for interfaces
2. Read [Utility Types](docs/06-utility-types.md) for DTOs (Pick, Omit)
3. Use Partial for update operations

**Creating reusable functions:**
1. Read [Generics](docs/05-generics.md) for type parameters
2. Apply generics to API functions
3. Use constraints for type safety

---

## TypeScript for Migration Project

### Strapi Client Types

```typescript
// From utility-types.md
interface StrapiData<T> {
  id: number;
  attributes: T;
}

interface StrapiResponse<T> {
  data: StrapiData<T> | StrapiData<T>[];
  meta?: {
    pagination?: {
      page: number;
      pageSize: number;
    };
  };
}

// Agent types
interface AgentAttributes {
  name: string;
  systemPrompt: string;
  tools: string[];
  enabled: boolean;
}

type Agent = AgentAttributes & { id: number };
```

### DTO Patterns

```typescript
// Create DTOs (omit id, timestamps)
type CreateDTO<T> = Omit<T, "id" | "createdAt" | "updatedAt">;

// Update DTOs (partial without id)
type UpdateDTO<T> = Partial<Omit<T, "id" | "createdAt" | "updatedAt">>;

type CreateAgentDTO = CreateDTO<Agent>;
type UpdateAgentDTO = UpdateDTO<Agent>;
```

### Express Route Types

```typescript
// Generic request handler
import { Request, Response } from "express";

interface TypedRequest<T> extends Request {
  body: T;
}

async function createAgent(
  req: TypedRequest<CreateAgentDTO>,
  res: Response
) {
  const agentData = req.body; // Typed!
  // ...
}
```

---

## tsconfig.json Examples

### For Node.js (Express Backend)

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
  "exclude": ["node_modules", "dist"]
}
```

### For React (Vite Frontend)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "jsx": "react-jsx",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "strict": true
  },
  "include": ["src"]
}
```

---

## Common Patterns

### Type Guards

```typescript
function isUser(obj: any): obj is User {
  return typeof obj === "object" && "id" in obj && "name" in obj;
}

if (isUser(data)) {
  console.log(data.name); // TypeScript knows it's User
}
```

### Discriminated Unions

```typescript
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function handleResult<T>(result: Result<T>) {
  if (result.success) {
    console.log(result.data); // TypeScript knows data exists
  } else {
    console.error(result.error); // TypeScript knows error exists
  }
}
```

### Mapped Types

```typescript
type Nullable<T> = {
  [K in keyof T]: T[K] | null;
};

type ReadonlyPartial<T> = {
  readonly [K in keyof T]?: T[K];
};
```

---

## Best Practices

1. **Enable strict mode** in tsconfig.json
2. **Avoid `any`** - use `unknown` if type is truly unknown
3. **Use utility types** for DTOs (Pick, Omit, Partial)
4. **Leverage type inference** - don't over-annotate
5. **Use interfaces for objects** - better for extension
6. **Use type aliases for unions** - cleaner syntax
7. **Enable `noImplicitAny`** - catch missing types
8. **Use generics** for reusable code
9. **Define DTOs separately** - keep types organized
10. **Use const assertions** - preserve literal types

---

## Troubleshooting

### Common Issues

**Type 'X' is not assignable to type 'Y'**
→ Check that all required properties exist and types match

**Property 'X' does not exist on type 'Y'**
→ Add the property to the interface or use optional chaining (`?.`)

**Cannot find module**
→ Check `paths` in tsconfig.json or install type definitions (`@types/package`)

**Implicit 'any' type**
→ Add type annotations or enable type inference

**Circular dependency**
→ Extract shared types to separate files

---

## Additional Resources

For the latest TypeScript documentation:
**https://www.typescriptlang.org/docs/**

All examples in this skill are based on **TypeScript 5.x**.

---

## Tips

- **Use TypeScript from day one** - easier than migrating later
- **Don't fight the compiler** - it's trying to help
- **Read error messages carefully** - they're usually specific
- **Use IDE autocomplete** - let TypeScript guide you
- **Start strict, relax if needed** - opposite is harder
