# Deployment

**Source:** https://docs.strapi.io/cms/deployment
**Downloaded:** 2025-10-31

---

# Deployment | Strapi 5 Documentation

## Deployment

> **Page summary:**
> Deployment options cover hardware/software prerequisites, environment variable setup, and building the admin panel before launch.

Strapi provides many deployment options for your project or application. Your Strapi applications can be deployed on traditional hosting servers or your preferred hosting provider.

### Strapi Cloud

You can use [Strapi Cloud](/cloud/intro) to quickly deploy and host your project.

**Tip:** Use the [data management system](/cms/features/data-management) to transfer data between Strapi instances.

---

## General Guidelines

### Hardware and Software Requirements

Before installing Strapi, the following requirements must be installed:

- **Node.js**: Only Active LTS or Maintenance LTS versions (currently `v20` and `v22`)
- **Node.js package manager**: npm (v6+), yarn, or pnpm
- **Python**: If using SQLite database
- **Standard build tools**: `build-essentials` package on Debian-based systems

#### Hardware Specifications

| Hardware | Recommended | Minimum |
|----------|-------------|---------|
| CPU | 2+ cores | 1 core |
| Memory | 4GB+ | 2GB |
| Disk | 32GB+ | 8GB |

#### Supported Databases

| Database | Recommended | Minimum |
|----------|-------------|---------|
| MySQL | 8.0 | 8.0 |
| MariaDB | 10.6 | 10.5 |
| PostgreSQL | 14.0 | 12.0 |
| SQLite | 3 | 3 |

#### Supported Operating Systems

| OS | Recommended | Minimum |
|----|-------------|---------|
| Ubuntu (LTS) | 22.04 | 20.04 |
| Debian | 11.x | 10.x |
| CentOS/RHEL | 9.x | 8.x |
| macOS | 11.0 | 10.15 |
| Windows Desktop | 11 | 10 |
| Windows Server | 2022 | 2019 |

---

### Application Configuration

#### 1. Configure

Use environment variables to configure your application:

```javascript
// /config/server.js
module.exports = ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
});
```

Edit the `.env` file or set variables in your deployment platform:

```
HOST=10.0.0.1
PORT=1338
```

#### 2. Build the Admin Panel

Build your admin panel for production:

**Using yarn:**
```bash
NODE_ENV=production yarn build
```

**Using npm:**
```bash
NODE_ENV=production npm run build
```

**On Windows:**
```bash
npm install cross-env
```

Then in `package.json`:
```json
"build:win": "cross-env NODE_ENV=production npm run build"
```

Run:
```bash
npm run build:win
```

#### 3. Launch the Server

Run the server with production settings:

**Using yarn:**
```bash
NODE_ENV=production yarn start
```

**Using npm:**
```bash
NODE_ENV=production npm run start
```

**On Windows:**
In `package.json`:
```json
"start:win": "cross-env NODE_ENV=production npm start"
```

Run:
```bash
npm run start:win
```

**Caution:** We highly recommend using [pm2](https://github.com/Unitech/pm2/) to manage your process.

#### Custom server.js

If you need a `server.js` file:

```javascript
// path: ./server.js
const strapi = require('@strapi/strapi');
strapi.createStrapi(/* {...} */).start();
```

**Caution:** For TypeScript projects, provide the `distDir` option.

---

## Additional Resources

The [integrations page](https://strapi.io/integrations) includes deployment guides for:

- [Deploy Strapi on AWS](https://strapi.io/integrations/aws)
- [Deploy Strapi on Azure](https://strapi.io/integrations/azure)
- [Deploy Strapi on DigitalOcean](https://strapi.io/integrations/digital-ocean)
- [Deploy Strapi on Heroku](https://strapi.io/integrations/heroku)

Community-maintained guides in the [Strapi Forum](https://forum.strapi.io/c/community-guides/28):

- [Proxying with Caddy](https://forum.strapi.io/t/caddy-proxying-with-strapi/)
- [Proxying with HAProxy](https://forum.strapi.io/t/haproxy-proxying-with-strapi/)
- [Proxying with NGinx](https://forum.strapi.io/t/nginx-proxing-with-strapi/)
- [Using PM2 process manager](https://forum.strapi.io/t/how-to-use-pm2-process-manager-with-strapi/)

### Multi-tenancy

For multi-tenancy options, see the [comprehensive guide](https://strapi.io/blog/multi-tenancy-in-strapi-a-comprehensive-guide) on the Strapi Blog.

---

**Tags:** database deployment, deployment, project creation, hosting provider, hosting server
