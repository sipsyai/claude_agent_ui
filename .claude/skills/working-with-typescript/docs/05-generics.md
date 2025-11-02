# TypeScript Generics

**Topic:** Generic Types and Functions
**Created:** 2025-10-31

---

## Generic Functions

```typescript
// Generic function
function identity<T>(arg: T): T {
  return arg;
}

// Usage
let output1 = identity<string>("hello"); // string
let output2 = identity<number>(42); // number
let output3 = identity("hello"); // Type inferred

// Multiple type parameters
function pair<T, U>(first: T, second: U): [T, U] {
  return [first, second];
}

pair<string, number>("age", 25);
pair("age", 25); // Types inferred
```

## Generic Interfaces

```typescript
interface Box<T> {
  value: T;
}

let stringBox: Box<string> = { value: "hello" };
let numberBox: Box<number> = { value: 42 };

// Generic interface with methods
interface Repository<T> {
  getById(id: string): T | undefined;
  getAll(): T[];
  create(item: T): T;
  update(id: string, item: T): T;
  delete(id: string): boolean;
}

class UserRepository implements Repository<User> {
  // Implementation
}
```

## Generic Classes

```typescript
class DataStore<T> {
  private data: T[] = [];

  add(item: T): void {
    this.data.push(item);
  }

  get(index: number): T | undefined {
    return this.data[index];
  }

  getAll(): T[] {
    return [...this.data];
  }
}

const stringStore = new DataStore<string>();
stringStore.add("hello");

const numberStore = new DataStore<number>();
numberStore.add(42);
```

## Generic Constraints

```typescript
// Constraint with extends
interface Lengthwise {
  length: number;
}

function logLength<T extends Lengthwise>(arg: T): void {
  console.log(arg.length);
}

logLength("hello"); // OK
logLength([1, 2, 3]); // OK
// logLength(42); // Error: number doesn't have length

// Using type parameter in constraints
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

let obj = { a: 1, b: 2, c: 3 };
getProperty(obj, "a"); // OK
// getProperty(obj, "d"); // Error
```

## Generic Type Aliases

```typescript
type Result<T> = { success: true; data: T } | { success: false; error: string };

function fetchUser(id: string): Result<User> {
  // ...
}

type Nullable<T> = T | null;
type ReadonlyArray<T> = readonly T[];

let users: Nullable<User[]> = null;
let ids: ReadonlyArray<number> = [1, 2, 3];
```

## Default Type Parameters

```typescript
interface Response<T = any> {
  data: T;
  status: number;
}

// T defaults to any
let response1: Response = { data: "hello", status: 200 };

// Explicit type
let response2: Response<User> = { data: user, status: 200 };
```

## Generic Utility Functions

```typescript
// Array operations
function firstElement<T>(arr: T[]): T | undefined {
  return arr[0];
}

function lastElement<T>(arr: T[]): T | undefined {
  return arr[arr.length - 1];
}

// Object operations
function keys<T extends object>(obj: T): (keyof T)[] {
  return Object.keys(obj) as (keyof T)[];
}

// Filtering with type predicate
function filter<T>(arr: T[], predicate: (item: T) => boolean): T[] {
  return arr.filter(predicate);
}
```

## Practical Examples

```typescript
// API Response wrapper
interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}

async function fetchData<T>(url: string): Promise<ApiResponse<T>> {
  const response = await fetch(url);
  const data = await response.json();
  return {
    data,
    status: response.status
  };
}

// Usage
const users = await fetchData<User[]>("/api/users");
const user = await fetchData<User>("/api/users/1");

// State management
type State<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

function createState<T>(): State<T> {
  return {
    data: null,
    loading: false,
    error: null
  };
}

const userState = createState<User>();
const postsState = createState<Post[]>();
```
