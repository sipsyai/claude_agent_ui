# Database Configuration

**Source:** https://docs.strapi.io/cms/configurations/database
**Downloaded:** 2025-10-31

---

# Database Configuration

> The `/config/database.js|ts` file defines connections, clients, and pooling for supported databases like SQLite, MySQL, and PostgreSQL.

## Supported Databases

| Database | Recommended | Minimum |
|----------|-------------|---------|
| MySQL | 8.4 | 8.0 |
| MariaDB | 11.4 | 10.3 |
| PostgreSQL | 17.0 | 14.0 |
| SQLite | 3 | 3 |

**Important:** Strapi does not support MongoDB or NoSQL databases, nor "Cloud Native" databases like Amazon Aurora or Google Cloud SQL. Applications should not connect to pre-existing databases or Strapi v3 databases, as this may result in data loss.

## Configuration Structure

The `/config/database.js|ts` file accepts two main objects:

- `connection` - Database configuration options passed to Knex.js
- `settings` - Strapi-specific database settings

### Connection Configuration Object

| Parameter | Description | Type | Default |
|-----------|-------------|------|---------|
| `client` | Database client (`sqlite`, `postgres`, `mysql`) | String | Required |
| `connection` | Database connection information | Object | Required |
| `debug` | Show database exchanges and errors | Boolean | `false` |
| `useNullAsDefault` | Use NULL as default value (SQLite only) | Boolean | `true` |
| `pool` | Database pooling options | Object | — |
| `acquireConnectionTimeout` | Connection timeout in milliseconds | Integer | `60000` |

#### Connection Parameters

| Parameter | Description | Type |
|-----------|-------------|------|
| `connectionString` | Database connection string (overrides other properties) | String |
| `host` | Database hostname | String |
| `port` | Database port | Integer |
| `database` / `filename` | Database name or SQLite filename | String |
| `user` | Connection username | String |
| `password` | Connection password | String |
| `timezone` | Default timezone behavior | String |
| `schema` | Default database schema (PostgreSQL only) | String |
| `ssl` | SSL connection configuration | Boolean or Object |

#### Database Pooling Options

| Parameter | Description | Type | Default |
|-----------|-------------|------|---------|
| `min` | Minimum database connections | Integer | `2` |
| `max` | Maximum database connections | Integer | `10` |
| `acquireTimeoutMillis` | Connection attempt timeout (ms) | Integer | `60000` |
| `createTimeoutMillis` | Create query timeout (ms) | Integer | `30000` |
| `destroyTimeoutMillis` | Destroy query timeout (ms) | Integer | `5000` |
| `idleTimeoutMillis` | Free connection destruction time (ms) | Integer | `30000` |
| `reapIntervalMillis` | Idle connection check interval (ms) | Integer | `1000` |
| `createRetryIntervalMillis` | Failed create retry delay (ms) | Integer | `200` |
| `afterCreate` | Custom connection callback | Function | — |

**Docker Note:** Set pool `min` to `0` since Docker kills idle connections.

### Settings Configuration Object

| Parameter | Description | Type | Default |
|-----------|-------------|------|---------|
| `forceMigration` | Enable/disable forced database migration | Boolean | `true` |
| `runMigrations` | Enable/disable startup migrations | Boolean | `true` |

## Configuration Examples

### PostgreSQL

```javascript
module.exports = ({ env }) => ({
  connection: {
    client: 'postgres',
    connection: {
      connectionString: env('DATABASE_URL'),
      host: env('DATABASE_HOST', '127.0.0.1'),
      port: env.int('DATABASE_PORT', 5432),
      database: env('DATABASE_NAME', 'strapi'),
      user: env('DATABASE_USERNAME', 'strapi'),
      password: env('DATABASE_PASSWORD', 'strapi'),
      schema: env('DATABASE_SCHEMA', 'public'),
      ssl: env.bool('DATABASE_SSL', false) && {
        rejectUnauthorized: env.bool('DATABASE_SSL_SELF', false),
      },
    },
    pool: {
      min: env.int('DATABASE_POOL_MIN', 2),
      max: env.int('DATABASE_POOL_MAX', 10)
    },
    debug: false,
  },
});
```

### MySQL/MariaDB

```javascript
module.exports = ({ env }) => ({
  connection: {
    client: 'mysql',
    connection: {
      host: env('DATABASE_HOST', '127.0.0.1'),
      port: env.int('DATABASE_PORT', 3306),
      database: env('DATABASE_NAME', 'strapi'),
      user: env('DATABASE_USERNAME', 'strapi'),
      password: env('DATABASE_PASSWORD', 'strapi'),
      ssl: {
        rejectUnauthorized: env.bool('DATABASE_SSL_SELF', false),
      },
    },
    debug: false,
  },
});
```

### SQLite (JavaScript)

```javascript
module.exports = ({ env }) => ({
  connection: {
    client: 'sqlite',
    connection: {
      filename: env('DATABASE_FILENAME', '.tmp/data.db'),
    },
    useNullAsDefault: true,
    debug: false,
  },
});
```

### SQLite (TypeScript)

```typescript
import path from 'path';

export default ({ env }) => ({
  connection: {
    client: 'sqlite',
    connection: {
      filename: path.join(
        __dirname,
        '..',
        '..',
        env('DATABASE_FILENAME', path.join('.tmp', 'data.db'))
      ),
    },
    useNullAsDefault: true,
  },
});
```

## Configuration in Database

### Get Settings

```javascript
const pluginStore = strapi.store({
  environment: strapi.config.environment,
  type: 'plugin',
  name: 'users-permissions',
});

await pluginStore.get({ key: 'grant' });
```

Parameters: `environment` (string), `type` (string), `name` (string), `key` (string, required)

### Set Settings

```javascript
const pluginStore = strapi.store({
  environment: strapi.config.environment,
  type: 'plugin',
  name: 'users-permissions'
});

await pluginStore.set({
  key: 'grant',
  value: { /* data */ }
});
```

## Environment Variables

### MySQL/MariaDB (.env)

```
DATABASE_CLIENT=mysql
DATABASE_HOST=127.0.0.1
DATABASE_PORT=3306
DATABASE_NAME=strapi
DATABASE_USERNAME=strapi
DATABASE_PASSWORD=strapi
DATABASE_SSL=false
```

### PostgreSQL (.env)

```
DATABASE_CLIENT=postgres
DATABASE_HOST=127.0.0.1
DATABASE_PORT=5432
DATABASE_NAME=strapi
DATABASE_USERNAME=strapi
DATABASE_PASSWORD=strapi
DATABASE_SSL=false
```

### SQLite (.env)

```
DATABASE_CLIENT=sqlite
DATABASE_FILENAME=.tmp/data.db
```

## Database Connection String

The `connectionString` property:
- Overrides other connection properties like `host` and `port`
- Can be disabled by setting it to an empty string: `''`
- Commonly used with managed database solutions

## Database Installation

### SQLite

SQLite is the recommended default for local development.

**Quick Start Command:**

```bash
yarn create strapi-app my-project --quickstart
# or
npx create-strapi-app@latest my-project --quickstart
```

**Manual Installation:**

```bash
yarn add better-sqlite3
# or
npm install better-sqlite3
```

### PostgreSQL

When connecting to PostgreSQL, database users require SCHEMA permissions. To grant these to a new user:

```sql
CREATE USER my_strapi_db_user WITH PASSWORD 'password';
\c my_strapi_db_name admin_user
GRANT ALL ON SCHEMA public TO my_strapi_db_user;
```

## SSL Configuration

For self-signed certificates with PostgreSQL:

```javascript
ssl: {
  ca: fs.readFileSync(`${__dirname}/path/to/ca-certificate.crt`).toString(),
}
```
