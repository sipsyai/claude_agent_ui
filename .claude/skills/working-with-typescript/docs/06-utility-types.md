# TypeScript Utility Types

**Topic:** Built-in Type Transformations
**Created:** 2025-10-31

---

## Partial<T>

Makes all properties optional:

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

type PartialUser = Partial<User>;
// { id?: number; name?: string; email?: string }

function updateUser(id: number, updates: Partial<User>) {
  // Can update any subset of properties
}

updateUser(1, { name: "Alice" }); // OK
updateUser(1, { email: "alice@example.com" }); // OK
```

## Required<T>

Makes all properties required:

```typescript
interface Config {
  host?: string;
  port?: number;
}

type RequiredConfig = Required<Config>;
// { host: string; port: number }
```

## Readonly<T>

Makes all properties readonly:

```typescript
interface Point {
  x: number;
  y: number;
}

type ReadonlyPoint = Readonly<Point>;
// { readonly x: number; readonly y: number }

const point: ReadonlyPoint = { x: 10, y: 20 };
// point.x = 5; // Error!
```

## Pick<T, K>

Pick specific properties:

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  password: string;
}

type UserPublic = Pick<User, "id" | "name" | "email">;
// { id: number; name: string; email: string }

type UserCredentials = Pick<User, "email" | "password">;
// { email: string; password: string }
```

## Omit<T, K>

Omit specific properties:

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  password: string;
}

type UserWithoutPassword = Omit<User, "password">;
// { id: number; name: string; email: string }

type CreateUserDTO = Omit<User, "id">;
// { name: string; email: string; password: string }
```

## Record<K, T>

Create object type with specific keys and value type:

```typescript
type Role = "admin" | "user" | "guest";

type Permissions = Record<Role, string[]>;
// { admin: string[]; user: string[]; guest: string[] }

const permissions: Permissions = {
  admin: ["read", "write", "delete"],
  user: ["read", "write"],
  guest: ["read"]
};

// Dictionary pattern
type UserMap = Record<string, User>;
const users: UserMap = {
  "user1": { id: 1, name: "Alice" },
  "user2": { id: 2, name: "Bob" }
};
```

## Exclude<T, U>

Exclude types from union:

```typescript
type Status = "pending" | "approved" | "rejected" | "cancelled";

type ActiveStatus = Exclude<Status, "cancelled">;
// "pending" | "approved" | "rejected"

type NumberOrString = number | string | boolean;
type OnlyNumbers = Exclude<NumberOrString, string | boolean>;
// number
```

## Extract<T, U>

Extract types from union:

```typescript
type Status = "pending" | "approved" | "rejected" | "cancelled";

type FinalStatus = Extract<Status, "approved" | "rejected">;
// "approved" | "rejected"

type Primitive = string | number | boolean | null | undefined;
type StringOrNumber = Extract<Primitive, string | number>;
// string | number
```

## NonNullable<T>

Remove null and undefined:

```typescript
type MaybeString = string | null | undefined;

type DefiniteString = NonNullable<MaybeString>;
// string

function processValue(value: NonNullable<string | null>) {
  // value is guaranteed to be string, not null
  console.log(value.toUpperCase());
}
```

## ReturnType<T>

Extract return type of function:

```typescript
function getUser() {
  return { id: 1, name: "Alice" };
}

type User = ReturnType<typeof getUser>;
// { id: number; name: string }

async function fetchData() {
  return { data: [], status: 200 };
}

type FetchResult = ReturnType<typeof fetchData>;
// Promise<{ data: any[]; status: number }>
```

## Parameters<T>

Extract parameter types:

```typescript
function createUser(name: string, age: number, email: string) {
  // ...
}

type CreateUserParams = Parameters<typeof createUser>;
// [string, number, string]

const params: CreateUserParams = ["Alice", 30, "alice@example.com"];
createUser(...params);
```

## Awaited<T>

Unwrap Promise type:

```typescript
type PromiseUser = Promise<User>;
type UnwrappedUser = Awaited<PromiseUser>;
// User

async function fetchUser(): Promise<User> {
  // ...
}

type FetchedUser = Awaited<ReturnType<typeof fetchUser>>;
// User
```

## Practical Combinations

```typescript
// Create DTO from entity (omit id, timestamps)
type CreateDTO<T> = Omit<T, "id" | "createdAt" | "updatedAt">;

interface Agent {
  id: string;
  name: string;
  systemPrompt: string;
  createdAt: Date;
  updatedAt: Date;
}

type CreateAgentDTO = CreateDTO<Agent>;
// { name: string; systemPrompt: string }

// Partial update type
type UpdateDTO<T> = Partial<Omit<T, "id" | "createdAt" | "updatedAt">>;

type UpdateAgentDTO = UpdateDTO<Agent>;
// { name?: string; systemPrompt?: string }

// API Response type
type ApiResponse<T> = {
  data: T;
  status: number;
  message?: string;
};

type UserResponse = ApiResponse<User>;
type UsersResponse = ApiResponse<User[]>;

// Readonly entity
type ReadonlyEntity<T> = Readonly<Required<T>>;

type ImmutableUser = ReadonlyEntity<User>;
```

## Real-World Example (Strapi Integration)

```typescript
// Strapi response format
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
      pageCount: number;
      total: number;
    };
  };
}

// Transform Strapi response
type TransformStrapi<T> = T extends { attributes: infer A }
  ? A & { id: number }
  : never;

// Agent interface
interface AgentAttributes {
  name: string;
  systemPrompt: string;
  tools: string[];
  enabled: boolean;
}

type Agent = TransformStrapi<StrapiData<AgentAttributes>>;
// { name: string; systemPrompt: string; tools: string[]; enabled: boolean; id: number }

// Create/Update DTOs
type CreateAgentDTO = Omit<AgentAttributes, never>; // All fields required
type UpdateAgentDTO = Partial<AgentAttributes>; // All fields optional
```
