# Environment Variables Configuration

**Source:** https://docs.strapi.io/cms/configurations/environment
**Downloaded:** 2025-10-31

---

# Environment Variables Configuration

> Strapi provides specific environment variable names that can be defined in an environment file like `.env` to make variables available throughout your code.

## Strapi's Environment Variables

The following environment variables are available in Strapi:

| Setting | Description | Type | Default |
|---------|-------------|------|---------|
| `STRAPI_TELEMETRY_DISABLED` | Disable telemetry data transmission to Strapi | Boolean | `false` |
| `STRAPI_LICENSE` | Enterprise Edition license key | String | `undefined` |
| `NODE_ENV` | Application environment type; `production` enables specific behaviors | String | `'development'` |
| `BROWSER` | Auto-open admin panel after startup | Boolean | `true` |
| `ENV_PATH` | Path to environment variables file | String | `'./.env'` |
| `STRAPI_PLUGIN_I18N_INIT_LOCALE_CODE` | Default locale for i18n feature | String | `'en'` |
| `STRAPI_ENFORCE_SOURCEMAPS` | Force bundler to emit source-maps for debugging | Boolean | `false` |
| `FAST_REFRESH` | Enable Fast Refresh for admin panel development | Boolean | `true` |
| `HOST` | Server listening address | String | `0.0.0.0` |
| `PORT` | Server port | Number | `1337` |
| `APP_KEYS` | Comma-separated keys for signing cookies | String | `auto-generated` |
| `API_TOKEN_SALT` | Salt for API token creation | String | `auto-generated` |
| `ADMIN_JWT_SECRET` | JWT secret for admin panel | String | `auto-generated` |
| `JWT_SECRET` | JWT secret for Users & Permissions | String | `auto-generated` |
| `TRANSFER_TOKEN_SALT` | Salt for Data Management transfer tokens | String | `auto-generated` |
| `DATABASE_CLIENT` | Database client type | String | `sqlite` |
| `DATABASE_FILENAME` | SQLite database file location | String | `.tmp/data.db` |

**Tip:** Prefix variables with `STRAPI_ADMIN_` to expose them to the admin frontend.

## Example .env File

```
# Server
HOST=0.0.0.0
PORT=1337

# Secrets
APP_KEYS=appkeyvalue1,appkeyvalue2,appkeyvalue3,appkeyvalue4
API_TOKEN_SALT=anapitokensaltvalue
ADMIN_JWT_SECRET=youradminjwtsecret
TRANSFER_TOKEN_SALT=transfertokensaltvalue
ENCRYPTION_KEY=yourencryptionkey

# Database
DATABASE_CLIENT=sqlite
DATABASE_HOST=
DATABASE_PORT=
DATABASE_NAME=
DATABASE_USERNAME=
DATABASE_PASSWORD=
DATABASE_SSL=false
DATABASE_FILENAME=.tmp/data.db
```

### Authentication & Session Configuration

```
# Admin authentication
ADMIN_JWT_SECRET=your-admin-secret-key
ADMIN_COOKIE_DOMAIN=yourdomain.com

# Users & Permissions JWT
JWT_SECRET=your-content-api-secret-key

# Session management
UP_JWT_MANAGEMENT=refresh
UP_SESSIONS_ACCESS_TTL=604800
UP_SESSIONS_MAX_REFRESH_TTL=2592000
UP_SESSIONS_IDLE_REFRESH_TTL=604800
UP_SESSIONS_HTTPONLY=false
UP_SESSIONS_COOKIE_NAME=strapi_up_refresh
UP_SESSIONS_COOKIE_SAMESITE=lax
UP_SESSIONS_COOKIE_PATH=/
UP_SESSIONS_COOKIE_SECURE=false
```

## Environment Configurations

Create environment-specific configurations using the naming pattern `./config/env/{environment}/{filename}`. These merge with base configurations in `./config` and override defaults based on `NODE_ENV`.

### Example Configuration Structure

**Base configuration:**
```javascript
// ./config/server.js
module.exports = {
  host: '127.0.0.1',
};
```

**Production override:**
```javascript
// ./config/env/production/server.js
module.exports = ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
});
```

### Running with Different Environments

```bash
yarn start                                    # uses host 127.0.0.1
NODE_ENV=production yarn start                # uses HOST from .env (defaults to 0.0.0.0)
HOST=10.0.0.1 NODE_ENV=production yarn start  # uses specified host
```

An `env()` utility retrieves and casts environment variable values to different data types. Reference the dedicated guide for implementation details.
