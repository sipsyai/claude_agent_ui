# Express.js & Node.js Documentation Index

**Created:** 2025-10-31
**Purpose:** Express.js API development reference
**Project:** Claude Agent UI Migration

---

## 📚 Essential Documentation

| # | File | Topic | Use Case |
|---|------|-------|----------|
| 01 | `01-express-basics.md` | Getting Started | Setup, routing, basics |
| 02 | `02-middleware.md` | Middleware Patterns | Custom middleware, error handling |
| 03 | `03-sse-streaming.md` | Server-Sent Events | Real-time streaming for Claude |
| 04 | `04-integration-patterns.md` | API Integration | Strapi client, dual APIs |

---

## 🎯 Migration Usage

### For Hybrid Architecture (Express + Strapi)
1. `01-express-basics.md` - Express fundamentals
2. `02-middleware.md` - CORS, error handling
3. `03-sse-streaming.md` - Agent execution streaming
4. `04-integration-patterns.md` - Strapi integration

**Goal:** SSE streaming preserved in Express while CRUD moves to Strapi
