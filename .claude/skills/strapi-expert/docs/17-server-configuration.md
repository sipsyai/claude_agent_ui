# Server Configuration

**Source:** https://docs.strapi.io/cms/configurations/server
**Downloaded:** 2025-10-31

---

# Server Configuration

> The `/config/server` file manages host, port, URL, proxy, cron, and more; changes require rebuilding.

The `/config/server.js` file defines server configuration for a Strapi application.

## Important Notice

Changes to `server.js` require rebuilding the admin panel. After modifications, run `yarn build` or `npm run build`.

## Available Options

| Parameter | Description | Type | Default |
|-----------|-------------|------|---------|
| `host` ❗️ | Host name | string | `localhost` |
| `port` ❗️ | Server port | integer | `1337` |
| `app.keys` ❗️ | Session keys for middleware | array of strings | `undefined` |
| `socket` | Socket listening option | string \| integer | `/tmp/nginx.socket` |
| `emitErrors` | Enable error emission to Koa | boolean | `false` |
| `url` | Public server URL | string | `''` |
| `proxy.global` | Proxy agent for external requests | string | — |
| `proxy.fetch` | Proxy for `strapi.fetch` requests | string \| ProxyAgent.Options | — |
| `proxy.http` | Proxy for HTTP requests | string | — |
| `proxy.https` | Proxy for HTTPS requests | string | — |
| `proxy.koa` | Trust proxy header fields | boolean | `false` |
| `cron.enabled` | Enable/disable CRON jobs | boolean | `false` |
| `cron.tasks` | Declare CRON jobs | object | — |
| `dirs.public` | Public folder path | string | `./public` |
| `http.serverOptions` | HTTP server options | http.serverOptions | — |
| `transfer.remote.enabled` | Enable transfer feature | boolean | `true` |
| `logger.startup.enabled` | Show startup message | boolean | `true` |
| `logger.updates.enabled` | Show update notifications | boolean | `true` |

## Minimal Configuration

### JavaScript

```javascript
module.exports = ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  app: {
    keys: env.array('APP_KEYS'),
  },
});
```

### TypeScript

```typescript
export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  app: {
    keys: env.array('APP_KEYS'),
  },
});
```

## Full Configuration Example

### JavaScript

```javascript
module.exports = ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  app: {
    keys: env.array('APP_KEYS'),
  },
  socket: '/tmp/nginx.socket',
  emitErrors: false,
  url: env('PUBLIC_URL', 'https://api.example.com'),
  proxy: { koa: env.bool('IS_PROXIED', true) },
  cron: {
    enabled: env.bool('CRON_ENABLED', false),
  },
  transfer: {
    remote: {
      enabled: false,
    },
  },
  logger: {
    updates: {
      enabled: false,
    },
    startup: {
      enabled: false,
    },
  },
});
```

### TypeScript

```typescript
export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  app: {
    keys: env.array('APP_KEYS'),
  },
  socket: '/tmp/nginx.socket',
  emitErrors: false,
  url: env('PUBLIC_URL', 'https://api.example.com'),
  proxy: { koa: env.bool('IS_PROXIED', true) },
  cron: {
    enabled: env.bool('CRON_ENABLED', false),
  },
  transfer: {
    remote: {
      enabled: false,
    },
  },
  logger: {
    updates: {
      enabled: false,
    },
    startup: {
      enabled: false,
    },
  },
});
```

## Keep-Alive Configuration

For outgoing HTTP calls, pass a keep-alive agent to your HTTP client. Example with `agentkeepalive` and Axios:

```javascript
const { HttpsAgent } = require('agentkeepalive');
const axios = require('axios');
const agent = new HttpsAgent();
axios.get('https://example.com', { httpsAgent: agent });
```

---

**Tags:** app keys, base configuration, configuration, cron job, host, port
