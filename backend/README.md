# Strapi Backend - Claude Agent UI

**Version:** 5.30.0
**Database:** SQLite (temporary) → PostgreSQL (planned)
**Status:** ✅ Initialized

---

## 📋 Overview

This is the Strapi 5 backend for Claude Agent UI, providing:
- Auto-generated REST API for CRUD operations
- Admin panel for content management
- PostgreSQL database connection (once Windows service conflict is resolved)
- TypeScript support

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run develop

# Build for production
npm run build

# Start production server
npm start
```

The admin panel will be available at: **http://localhost:1337/admin**

---

## 📁 Project Structure

```
backend/
├── config/              # Configuration files
│   ├── admin.ts        # Admin panel config
│   ├── database.ts     # Database connection
│   ├── middlewares.ts  # CORS and middleware config
│   └── server.ts       # Server settings
├── src/
│   ├── api/            # API endpoints (will be created in Task 04)
│   ├── components/     # Reusable components
│   ├── extensions/     # Plugin extensions
│   └── index.ts        # Entry point
├── public/             # Static files
├── .tmp/               # SQLite database (temporary)
└── package.json
```

---

## ⚙️ Configuration

### Database

**Current:** SQLite (`.tmp/data.db`)
**Planned:** PostgreSQL on port 5433

The PostgreSQL configuration is ready in `config/database.ts` but commented out due to a conflict with a Windows PostgreSQL service running on port 5432.

To switch to PostgreSQL:
1. Ensure Windows PostgreSQL service is stopped or use a different port
2. Uncomment PostgreSQL configuration in `config/database.ts`
3. Comment out SQLite configuration
4. Restart Strapi

### Environment Variables

Create a `.env` file with:

```env
# Server
HOST=0.0.0.0
PORT=1337

# Database (PostgreSQL - when ready)
DATABASE_HOST=127.0.0.1
DATABASE_PORT=5433
DATABASE_NAME=claude_agent_ui
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=your_secure_password_here

# Security (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
STRAPI_APP_KEYS=key1,key2,key3,key4
STRAPI_API_TOKEN_SALT=your_salt_here
STRAPI_ADMIN_JWT_SECRET=your_secret_here
STRAPI_TRANSFER_TOKEN_SALT=your_salt_here
```

---

## 🔧 Known Issues

### PostgreSQL Connection Issue

**Problem:** Windows has a native PostgreSQL service running on port 5432, conflicting with the Docker container.

**Symptoms:**
- `password authentication failed for user "postgres"` error
- Node.js pg client cannot connect to Docker PostgreSQL
- Connections go to Windows service instead of Docker container

**Diagnosis:**
```bash
# Check what's listening on port 5432
netstat -ano | findstr :5432

# You'll see multiple PIDs - one is Docker, one is Windows service
```

**Solutions:**

1. **Stop Windows PostgreSQL Service** (requires admin rights):
   ```bash
   # Find the service name
   sc query type=service state=all | findstr /i "postgres"

   # Stop it
   net stop postgresql-x64-16
   ```

2. **Use Different Port** (current approach):
   - Docker PostgreSQL is on port 5433
   - Update database.ts to use port 5433
   - This is already configured in the commented PostgreSQL section

3. **Use SQLite** (current temporary solution):
   - Works immediately
   - Good for development and testing
   - Will migrate to PostgreSQL later

---

## 📚 Next Steps

**Task 04:** Create Content Types
- Agent content type
- Skill content type
- MCP Server content type
- Task content type

**Task 05:** Define TypeScript types

**Task 06:** Create Strapi client service

---

## 🛠️ Useful Commands

```bash
# Generate TypeScript types
npm run strapi ts:generate-types

# Create a new API
npm run strapi generate

# Check Strapi version
npm run strapi version

# Console (interactive)
npm run strapi console
```

---

## 📖 Documentation

- [Strapi 5 Documentation](https://docs.strapi.io)
- [REST API Reference](https://docs.strapi.io/cms/rest-api)
- [Document Service API](https://docs.strapi.io/cms/document-service-api)
- [TypeScript in Strapi](https://docs.strapi.io/cms/typescript)

---

**Created:** 2025-10-31 (Task 03)
**Last Updated:** 2025-10-31
