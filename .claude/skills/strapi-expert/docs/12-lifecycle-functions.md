# Lifecycle Functions

**Source:** https://docs.strapi.io/cms/configurations/functions
**Downloaded:** 2025-10-31

---

# Lifecycle Functions

> The `./src/index.js` file includes global register, bootstrap and destroy functions for dynamic and logic-based configurations.

The functions can be synchronous, asynchronous, or return a promise.

## Synchronous Function

**JavaScript:**
```javascript
module.exports = {
  register() {
    // some sync code
  },
  bootstrap() {
    // some sync code
  },
  destroy() {
    // some sync code
  }
};
```

**TypeScript:**
```typescript
export default {
  register() {
    // some sync code
  },
  bootstrap() {
    // some sync code
  },
  destroy() {
    // some sync code
  }
};
```

## Asynchronous Function

**JavaScript:**
```javascript
module.exports = {
  async register() {
    // some async code
  },
  async bootstrap() {
    // some async code
  },
  async destroy() {
    // some async code
  }
};
```

**TypeScript:**
```typescript
export default {
  async register() {
    // some async code
  },
  async bootstrap() {
    // some async code
  },
  async destroy() {
    // some async code
  }
};
```

## Function Returning a Promise

**JavaScript:**
```javascript
module.exports = {
  register() {
    return new Promise(/* some code */);
  },
  bootstrap() {
    return new Promise(/* some code */);
  },
  destroy() {
    return new Promise(/* some code */);
  }
};
```

**TypeScript:**
```typescript
export default {
  register() {
    return new Promise(/* some code */);
  },
  bootstrap() {
    return new Promise(/* some code */);
  },
  destroy() {
    return new Promise(/* some code */);
  }
};
```

## Register

The `register` function executes before application initialization. Use it to:

- Extend plugins
- Extend content-types programmatically
- Load environment variables
- Register custom fields for the current Strapi application
- Register custom providers for the Users & Permissions plugin

> The register function runs at startup before any setup, providing no access to database, routes, or backend server elements.

## Bootstrap

The `bootstrap` function runs at every server start, after Strapi setup completes. Use it to:

- Create an admin user if one doesn't exist
- Populate the database with essential data
- Declare custom conditions for Role-Based Access Control (RBAC)

You have access to the `strapi` object during this phase. Interactive exploration is available via `yarn strapi console` or `npm run strapi console`.

## Destroy

The `destroy` function runs before application shutdown. Use it to gracefully:

- Stop running services
- Clean up plugin actions (close connections, remove listeners, etc.)

**Tags:** additional configuration, asynchronous function, bootstrap function, configuration, destroy function, lifecycle function, register function, synchronous function
