# Middlewares Configuration

**Source:** https://docs.strapi.io/cms/configurations/middlewares
**Downloaded:** 2025-10-31

---

# Middlewares Configuration

> **Page Summary:** `/config/middlewares` orders global middleware, enables custom names or resolves, and exposes built-in configuration options.

## Different Types of Middlewares

Strapi supports three middleware concepts:

- **Global middlewares** are configured for the entire Strapi server application
- **Route middlewares** have limited scope and are configured at the route level
- **Document Service middlewares** apply to the Document Service API

The `./config/middlewares.js` file defines all global middlewares applied by the Strapi server.

## Loading Order

The `./config/middlewares.js` file exports an array where order controls middleware execution:

```javascript
module.exports = [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  'strapi::cors',
  'global::my-custom-node-module',
  {
    name: 'my-custom-node-module',
    config: { foo: 'bar' }
  },
  {
    resolve: '../some-dir/custom-middleware',
    config: { foo: 'bar' }
  },
  {
    name: 'strapi::poweredBy',
    config: { poweredBy: 'Some awesome company' }
  },
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public'
];
```

## Naming Conventions

| Type | Origin | Convention |
|------|--------|-----------|
| Internal | Built-in middlewares | `strapi::middleware-name` |
| Application-level | `./src/middlewares` folder | `global::middleware-name` |
| API-level | `./src/api/[api-name]/middlewares` | `api::api-name.middleware-name` |
| Plugin | `strapi-server.js` | `plugin::plugin-name.middleware-name` |
| External | npm modules or local | No convention |

## Optional Configuration

| Parameter | Description | Type |
|-----------|-------------|------|
| `config` | Define or override middleware configuration | Object |
| `resolve` | Path to middleware folder | String |

## Key Internal Middlewares

### body

Based on koa-body for parsing request bodies.

**Example:**

```javascript
{
  name: 'strapi::body',
  config: {
    jsonLimit: '3mb',
    formLimit: '10mb',
    textLimit: '256kb',
    encoding: 'gbk'
  }
}
```

### compression

Based on koa-compress for response compression.

**Example:**

```javascript
{
  name: 'strapi::compression',
  config: { br: false }
}
```

### cors

Cross-origin resource sharing middleware.

**Example:**

```javascript
{
  name: 'strapi::cors',
  config: {
    origin: [
      'https://example.com',
      'https://subdomain.example.com'
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
    headers: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
    keepHeaderOnError: true
  }
}
```

**Function-based origin:**

```typescript
{
  name: 'strapi::cors',
  config: {
    origin: (ctx): string | string[] => {
      const origin = ctx.request.header.origin;
      if (origin === 'http://localhost:3000') {
        return origin;
      }
      return '';
    }
  }
}
```

### security

Security middleware based on koa-helmet.

**Example for AWS S3:**

```javascript
{
  name: 'strapi::security',
  config: {
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'connect-src': ["'self'", 'https:'],
        'img-src': [
          "'self'",
          'data:',
          'blob:',
          'market-assets.strapi.io',
          'yourBucketName.s3.yourRegion.amazonaws.com'
        ],
        'media-src': [
          "'self'",
          'data:',
          'blob:',
          'market-assets.strapi.io',
          'yourBucketName.s3.yourRegion.amazonaws.com'
        ],
        upgradeInsecureRequests: null
      }
    }
  }
}
```

### session

Cookie-based sessions using koa-session.

**Example:**

```javascript
{
  name: 'strapi::session',
  config: {
    rolling: true,
    renew: true
  }
}
```

### poweredBy

Adds `X-Powered-By` header.

**Example:**

```javascript
{
  name: 'strapi::poweredBy',
  config: {
    poweredBy: 'Some Awesome Company <example.com>'
  }
}
```

### query

Query parser based on qs library.

**Example:**

```javascript
{
  name: 'strapi::query',
  config: {
    arrayLimit: 50,
    depth: 10
  }
}
```

### public

Static file serving middleware.

**Example:**

```javascript
{
  name: 'strapi::public',
  config: {
    defer: true,
    index: env('INDEX_PATH', 'index-dev.html')
  }
}
```

### ip

IP filter middleware based on koa-ip.

**Example:**

```javascript
{
  name: 'strapi::ip',
  config: {
    whitelist: ['192.168.0.*', '192.168.1.*', '123.123.123.123'],
    blacklist: ['1.116.*.*', '103.54.*.*']
  }
}
```

---

**Tags:** configuration, middlewares, global middlewares, CORS, security, compression
