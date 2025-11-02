# Backend Customization

**Source:** https://docs.strapi.io/cms/backend-customization
**Downloaded:** 2025-10-31

---

# Backend Customization

## Overview

The Strapi back end is an HTTP server built on [Koa](https://koajs.com/), a JavaScript framework. It processes requests through multiple layers before returning responses.

### Disambiguation: Strapi Back End

Strapi consists of two distinct parts:

- **Back-end**: An HTTP server that handles requests, manages database interactions, and performs CRUD operations on content
- **Front-end**: The admin panel, a graphical interface for content management

This documentation focuses exclusively on the back-end component.

## Request Flow

When a request reaches the Strapi back end, it follows this sequence:

1. **Request Reception**: The server receives an incoming request
2. **Global Middlewares**: Request passes through global middlewares in sequential order
3. **Routing**: Request matches a route (Strapi auto-generates routes for content-types)
4. **Route Policies & Middlewares**: Policies validate access; middlewares can modify the request
5. **Controllers & Services**: Controllers execute logic; services provide reusable business logic
6. **Models & Document Service**: Interaction with data models and the Document Service handles database operations
7. **Document Service Middlewares**: Optional control layer before Query Engine processes data
8. **Response**: Server returns a response, traveling back through middlewares

### Middleware Behavior

Global and route middlewares include an async `await next()` callback:

- **With `await next()`**: Request continues through all back-end layers
- **Without `await next()`**: Response returns immediately, bypassing core elements

## Key Layers

| Component | Purpose |
|-----------|---------|
| Routes | Define API endpoints |
| Policies | Validate and authorize access |
| Controllers | Execute endpoint logic |
| Services | Reusable business logic |
| Models | Content structure representation |
| Document Service | Data interaction layer |

## Important Notes

All customizations in this section apply to the REST API only. GraphQL customizations are documented separately in the GraphQL plugin documentation.
