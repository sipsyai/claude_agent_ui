---
name: working-with-strapi
description: Provides comprehensive Strapi 5 documentation covering content types, REST API, database configuration, TypeScript integration, authentication, and deployment. Use when working with Strapi projects, creating content types, configuring databases (PostgreSQL, MySQL), setting up REST APIs, implementing authentication and permissions, or deploying Strapi applications.
---

# Strapi 5 Expert

Comprehensive Strapi 5 documentation for building, configuring, and deploying Strapi applications.

## What This Skill Covers

- **Project Setup**: Installation, project structure, environment configuration
- **Content Types**: Creating and managing collection types and single types
- **API Development**: REST API, Document Service API, custom controllers
- **Database**: PostgreSQL, MySQL, MariaDB, SQLite configuration
- **TypeScript**: Full TypeScript integration and configuration
- **Authentication**: API tokens, JWT, users & permissions, roles
- **Security**: CORS, middlewares, content security policies
- **Deployment**: Production builds, server configuration, hosting

## Quick Reference

### Common Tasks

**Creating Content Types**
→ See [docs/04-content-type-builder.md](docs/04-content-type-builder.md)

**Setting Up PostgreSQL**
→ See [docs/08-database-configuration.md](docs/08-database-configuration.md)

**Using REST API**
→ See [docs/06-rest-api.md](docs/06-rest-api.md)

**Configuring JWT Authentication**
→ See [docs/16-users-permissions.md](docs/16-users-permissions.md)

**Setting Up CORS**
→ See [docs/18-middlewares.md](docs/18-middlewares.md)

**Production Deployment**
→ See [docs/19-deployment.md](docs/19-deployment.md)

**Custom Controllers & Services**
→ See [docs/10-backend-customization.md](docs/10-backend-customization.md)

**TypeScript Configuration**
→ See [docs/13-typescript-introduction.md](docs/13-typescript-introduction.md) and [docs/14-typescript-configuration.md](docs/14-typescript-configuration.md)

---

## Documentation Index

### 🚀 Setup & Installation

**Getting Started**
- [Quick Start Guide](docs/01-quick-start.md) - Create first Strapi project, understand basics
- [Installation](docs/02-installation.md) - CLI installation, Docker setup, system requirements
- [Project Structure](docs/03-project-structure.md) - Folder organization, file locations

**Configuration**
- [Database Configuration](docs/08-database-configuration.md) - PostgreSQL, MySQL, MariaDB, SQLite setup
- [Environment Variables](docs/09-environment-variables.md) - .env configuration, security keys

---

### 📦 Content Types & Management

**Content Type System**
- [Content Type Builder](docs/04-content-type-builder.md) - Create collection types, single types, define fields and relations
- [Content Manager](docs/05-content-manager.md) - Manage content via admin panel, CRUD operations
- [Document Concept](docs/11-document-concept.md) - Strapi 5's document-based architecture

---

### 🔌 API Development

**API Usage**
- [REST API](docs/06-rest-api.md) - Auto-generated endpoints, filtering, pagination, population
- [Document Service API](docs/07-document-service-api.md) - Backend CRUD operations (findMany, findOne, create, update, delete)
- [Backend Customization](docs/10-backend-customization.md) - Custom controllers, services, routes, policies

**Advanced Backend**
- [Lifecycle Functions](docs/12-lifecycle-functions.md) - Register, bootstrap, destroy hooks for initialization

---

### 💻 TypeScript Integration

**TypeScript Setup**
- [TypeScript Introduction](docs/13-typescript-introduction.md) - Enable TypeScript in Strapi projects
- [TypeScript Configuration](docs/14-typescript-configuration.md) - tsconfig.json setup, type generation

---

### 🔐 Authentication & Security

**Authentication**
- [API Tokens](docs/15-api-tokens.md) - Generate and use API tokens for external services
- [Users & Permissions](docs/16-users-permissions.md) - End-user authentication, JWT configuration, roles, permissions

**Security Configuration**
- [Server Configuration](docs/17-server-configuration.md) - Host, port, URL, proxy settings
- [Middlewares](docs/18-middlewares.md) - CORS, security headers, compression, body parsing

---

### 🚢 Deployment

**Production Deployment**
- [Deployment Guide](docs/19-deployment.md) - Build admin panel, server setup, hardware requirements, hosting providers

---

## How to Use This Skill

### Finding Specific Information

1. **Start with Quick Reference** above for common tasks
2. **Browse by topic** using the Documentation Index
3. **Search documentation files** using grep:
   ```bash
   grep -r "your search term" docs/
   ```

### Reading Documentation

All documentation files include:
- Complete examples in both JavaScript and TypeScript
- Code snippets ready to use
- Configuration examples with detailed explanations
- Links to related topics

### Example Workflows

**Setting up a new Strapi project with PostgreSQL:**
1. Read [Quick Start](docs/01-quick-start.md) for project creation
2. Read [Database Configuration](docs/08-database-configuration.md) for PostgreSQL setup
3. Read [Environment Variables](docs/09-environment-variables.md) for .env configuration

**Creating a REST API for a content type:**
1. Read [Content Type Builder](docs/04-content-type-builder.md) to create your content type
2. Read [REST API](docs/06-rest-api.md) to understand auto-generated endpoints
3. Read [Backend Customization](docs/10-backend-customization.md) if you need custom logic

**Implementing authentication:**
1. Read [Users & Permissions](docs/16-users-permissions.md) for JWT setup
2. Read [API Tokens](docs/15-api-tokens.md) for service-to-service authentication
3. Read [Middlewares](docs/18-middlewares.md) for CORS configuration

**Deploying to production:**
1. Read [Server Configuration](docs/17-server-configuration.md) for production settings
2. Read [Middlewares](docs/18-middlewares.md) for security configuration
3. Read [Deployment](docs/19-deployment.md) for build and hosting

---

## Additional Resources

For original documentation and updates, visit:
**https://docs.strapi.io/cms/intro**

All documentation in this skill is based on **Strapi 5**.

---

## Tips

- **Always specify Strapi version**: This skill covers Strapi 5 (latest)
- **Check prerequisites**: Node.js v20/v22, npm v6+, database installed
- **Use TypeScript**: Full TypeScript support available, highly recommended
- **Test locally first**: Always test configurations in development before production
- **Rebuild after config changes**: Run `npm run build` after modifying server.js or admin config
