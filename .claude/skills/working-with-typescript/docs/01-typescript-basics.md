# TypeScript Fundamentals

**Topic:** Getting Started with TypeScript
**Created:** 2025-10-31

---

## What is TypeScript?

TypeScript is a strongly typed superset of JavaScript that compiles to plain JavaScript. It adds:
- Static type checking
- Enhanced IDE support
- Modern JavaScript features
- Better refactoring tools

## Type Annotations

```typescript
// Basic type annotations
let name: string = "Alice";
let age: number = 30;
let isActive: boolean = true;

// Arrays
let numbers: number[] = [1, 2, 3];
let strings: Array<string> = ["a", "b"];

// Functions
function greet(name: string): string {
  return `Hello, ${name}!`;
}

// Arrow functions
const add = (a: number, b: number): number => a + b;

// Optional parameters
function log(message: string, userId?: number): void {
  console.log(message, userId);
}

// Default parameters
function createUser(name: string, role: string = "user"): void {
  // ...
}
```

## Type Inference

TypeScript can infer types automatically:

```typescript
let message = "Hello"; // inferred as string
let count = 42; // inferred as number

const numbers = [1, 2, 3]; // inferred as number[]

function double(x: number) {
  return x * 2; // return type inferred as number
}
```

## Objects

```typescript
// Object type annotation
let user: { name: string; age: number } = {
  name: "Bob",
  age: 25
};

// Optional properties
let config: { host: string; port?: number } = {
  host: "localhost"
};

// Readonly properties
let point: { readonly x: number; readonly y: number } = {
  x: 10,
  y: 20
};
// point.x = 5; // Error!
```

## Union Types

```typescript
// Union types
let id: string | number;
id = "abc123";
id = 123;

// Type narrowing with typeof
function printId(id: string | number) {
  if (typeof id === "string") {
    console.log(id.toUpperCase());
  } else {
    console.log(id.toFixed(2));
  }
}
```

## Literal Types

```typescript
// String literal types
let direction: "north" | "south" | "east" | "west";
direction = "north"; // OK
// direction = "up"; // Error!

// Numeric literal types
let diceRoll: 1 | 2 | 3 | 4 | 5 | 6;

// Boolean literal
let success: true = true;
```

## Type Aliases

```typescript
type ID = string | number;
type Point = { x: number; y: number };
type Status = "pending" | "approved" | "rejected";

let userId: ID = "user_123";
let coords: Point = { x: 0, y: 0 };
let taskStatus: Status = "pending";
```

## Interfaces

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  age?: number; // optional
  readonly createdAt: Date; // readonly
}

const user: User = {
  id: 1,
  name: "Alice",
  email: "alice@example.com",
  createdAt: new Date()
};

// Extending interfaces
interface Admin extends User {
  role: string;
  permissions: string[];
}
```

## Classes

```typescript
class Animal {
  private name: string;
  protected species: string;
  public age: number;

  constructor(name: string, species: string, age: number) {
    this.name = name;
    this.species = species;
    this.age = age;
  }

  public makeSound(): void {
    console.log("Some sound");
  }

  protected getName(): string {
    return this.name;
  }
}

class Dog extends Animal {
  constructor(name: string, age: number) {
    super(name, "Dog", age);
  }

  public bark(): void {
    console.log(`${this.getName()} says Woof!`);
  }
}
```

## Enums

```typescript
enum Direction {
  Up,
  Down,
  Left,
  Right
}

let dir: Direction = Direction.Up;

// String enums
enum Status {
  Pending = "PENDING",
  Approved = "APPROVED",
  Rejected = "REJECTED"
}

let status: Status = Status.Pending;
```

## Any, Unknown, Never

```typescript
// any - avoid if possible
let anything: any = "hello";
anything = 123;
anything.whatever(); // No type checking

// unknown - safer than any
let uncertain: unknown = "hello";
if (typeof uncertain === "string") {
  console.log(uncertain.toUpperCase()); // OK after check
}

// never - for functions that never return
function throwError(message: string): never {
  throw new Error(message);
}

function infiniteLoop(): never {
  while (true) {}
}
```

## Best Practices

1. **Enable strict mode** in tsconfig.json
2. **Avoid `any`** - use `unknown` if type is truly unknown
3. **Use type inference** when obvious
4. **Prefer interfaces** for object shapes
5. **Use const assertions** for literal types
6. **Enable noImplicitAny** compiler option

```typescript
// Good
const config = {
  host: "localhost",
  port: 3000
} as const; // Literal types preserved

// Bad
let config: any = { host: "localhost", port: 3000 };
```
