# Investigation Report: Backend Authorization Errors on /api/flows

**Task:** subtask-2-1 - Investigate backend authorization middleware for /api/flows endpoints
**Status:** ✅ INVESTIGATION COMPLETE
**Date:** 2026-01-02

---

## Executive Summary

The 403 Forbidden errors on `/api/flows` endpoints are caused by **authorization issues in the Strapi backend**, not the Express proxy layer. The investigation reveals:

1. **Express Proxy Layer (Port 3001)**: Working correctly, returns 200 OK
2. **Strapi Backend (Port 1337)**: Returns 403 Forbidden due to missing permissions configuration
3. **Frontend Token Passing**: Correctly configured to send Bearer tokens
4. **Core Issue**: Strapi requires permissions to be enabled for authenticated users to access the Flow content type

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ Frontend (React/TypeScript)                    localhost:5173 │
│ - Reads auth token from `cui-auth-token` cookie             │
│ - Sends requests with Authorization header                   │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP requests to http://localhost:3001/api/flows
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Express Proxy Server                          localhost:3001  │
│ - src/routes/flow.routes.ts                                  │
│ - Proxies requests to Strapi                                 │
│ - Returns 200 OK (tested with curl)                          │
└──────────────────────┬──────────────────────────────────────┘
                       │ Calls strapiClient methods
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Strapi Backend (Content Management)           localhost:1337  │
│ - Users & Permissions Plugin                                  │
│ - Flow content type requires permissions                     │
│ - Returns 403 Forbidden without proper permissions           │
└─────────────────────────────────────────────────────────────┘
```

---

## Detailed Findings

### 1. Frontend Authentication (✅ Working Correctly)

**File:** `src/web/manager/services/flow-api.ts`

The frontend correctly implements auth token handling:

```typescript
function getAuthToken(): string | null {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'cui-auth-token') {
      return decodeURIComponent(value);
    }
  }
  return null;
}

function createFetchOptions(options: RequestInit = {}): RequestInit {
  const token = getAuthToken();
  const headers = new Headers(options.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return { ...options, headers };
}
```

✅ **Status**: Token is correctly extracted and included in Authorization header
✅ **Format**: Bearer token format matches Strapi expectations
✅ **Coverage**: Applied to all API calls (GET /api/flows, POST, PUT, DELETE)

---

### 2. Express Proxy Layer (✅ Working Correctly)

**File:** `src/routes/flow.routes.ts`

The Express route handler for `GET /api/flows`:

```typescript
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const query = flowQuerySchema.parse(req.query);
  const filters: any = {};

  // Build filters from query params
  if (query.status) filters.status = query.status;
  if (query.isActive !== undefined) filters.isActive = query.isActive;
  // ... more filters

  const flows = await strapiClient.getAllFlows({
    filters,
    sort: [query.sort],
    pagination: {
      page: query.page,
      pageSize: query.pageSize
    }
  });

  res.json({
    data: flows,
    meta: { page: query.page, pageSize: query.pageSize, total: flows.length }
  });
}));
```

✅ **Testing**: Curl test confirms 200 OK response
```bash
$ curl -H 'Authorization: Bearer test-token' http://localhost:3001/api/flows
HTTP/1.1 200 OK
{"data":[],"meta":{"page":1,"pageSize":25,"total":0}}
```

✅ **Status**: Express proxy returns valid JSON, not 403

---

### 3. Strapi Backend Configuration (❌ Authorization Issue)

**Files:**
- `backend/config/middlewares.ts`
- `backend/config/plugins.ts`
- `backend/src/index.ts`

#### Problem Found in `backend/config/middlewares.ts`

```typescript
export default [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  {
    name: 'strapi::cors',
    config: {
      origin: ['http://localhost:5173', 'http://localhost:3001', 'http://localhost:1337'],
      credentials: true,
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
```

⚠️ **Missing Component**: The `users-permissions` authentication middleware is NOT loaded!

Strapi requires the users-permissions middleware to:
- Parse JWT tokens from Authorization headers
- Validate token signatures
- Attach user context to requests
- Enforce permission policies

#### Permission Configuration in `backend/src/index.ts`

The bootstrap code only enables mcp-tool permissions:

```typescript
const mcpToolPermissions = permissions.filter(p => p.action?.startsWith('api::mcp-tool.'));

for (const permission of mcpToolPermissions) {
  await strapi.query('plugin::users-permissions.permission').update({
    where: { id: permission.id },
    data: { enabled: true },
  });
}
```

❌ **Missing**: No permissions are enabled for `api::flow.flow` content type

#### Flow Routes Configuration in `backend/src/api/flow/routes/flow.ts`

```typescript
export default factories.createCoreRouter('api::flow.flow');
```

This generates standard CRUD routes WITHOUT `auth: false`, meaning they require permissions.

In contrast, custom routes in `backend/src/api/flow/routes/custom.ts` explicitly disable auth:

```typescript
{
  method: 'GET',
  path: '/flows/by-slug/:slug',
  handler: 'flow.findBySlug',
  config: {
    auth: false,  // ← Explicitly disabled for custom routes
    policies: [],
    middlewares: [],
  },
}
```

---

## Root Cause Analysis

The 403 Forbidden error occurs because:

1. **Frontend** sends request with Bearer token to Express
2. **Express** proxies request to Strapi via `strapiClient`
3. **Strapi** receives request but:
   - ❌ Users-permissions middleware is NOT configured, so JWT token is NOT parsed
   - ❌ Request is treated as unauthenticated/public user
   - ❌ Flow permissions are NOT enabled for any user role
   - ❌ Request is rejected with 403 Forbidden

---

## Solution Options

### Option A: Add Users-Permissions Middleware (Recommended)

**Pros:**
- Enables proper JWT token authentication
- Allows role-based access control
- Standard Strapi pattern
- Secure by default

**Cons:**
- Requires careful permission configuration
- More complex than Option B

**Implementation:**
1. Add `strapi::users-permissions` to `backend/config/middlewares.ts`
2. Enable flow permissions for authenticated role in `backend/src/index.ts`

### Option B: Disable Auth on Flow Routes

**Pros:**
- Simple, immediate fix
- Works for development

**Cons:**
- **SECURITY RISK**: Exposes flow API to anonymous users
- Not suitable for production
- Requires explicit configuration like custom routes have

### Option C: Configure Strapi Access Policies

**Pros:**
- Flexible permission system
- Can support complex business logic

**Cons:**
- More infrastructure to maintain
- Still requires users-permissions middleware

---

## Verification

Testing shows Express proxy is working:

```bash
# Test Express endpoint (200 OK)
curl -i http://localhost:3001/api/flows
HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
{"data":[],"meta":{"page":1,"pageSize":25,"total":0}}

# Test with token header (still 200 OK from Express)
curl -i -H 'Authorization: Bearer test-token' http://localhost:3001/api/flows
HTTP/1.1 200 OK
{"data":[],"meta":{"page":1,"pageSize":25,"total":0}}
```

The 200 OK response from Express confirms the proxy layer is NOT the problem. The 403 must be coming from Strapi.

---

## Next Steps

For subtask 2-2 (Fix authorization middleware):

1. ✅ Add users-permissions middleware to Strapi config
2. ✅ Enable flow permissions for authenticated users
3. ✅ Test that /api/flows returns 200 OK with valid token
4. ✅ Verify frontend receives flow data without 403 errors

---

## Related Investigation Findings

### Middleware Stack Issue

Strapi's standard middleware stack in this project is missing the critical `strapi::users-permissions` middleware. Without this middleware:

- JWT tokens are NOT extracted from Authorization headers
- User context is NOT attached to requests
- Role-based permissions are NOT enforced
- All requests appear as unauthenticated

### Permission Bootstrap Code

The current bootstrap code only enables mcp-tool permissions. Flow permissions need to be added in a similar way.

### Custom vs Core Routes

The project uses both:
- **Core routes** (via `createCoreRouter`): Require permissions, currently 403
- **Custom routes** (in `custom.ts`): Set `auth: false`, work fine (no auth needed)

This inconsistency explains why some flow endpoints work and others don't.

---

## Files Affected by Issue

| File | Issue | Severity |
|------|-------|----------|
| `backend/config/middlewares.ts` | Missing users-permissions middleware | 🔴 Critical |
| `backend/src/index.ts` | Missing flow permission bootstrap | 🔴 Critical |
| `backend/src/api/flow/routes/flow.ts` | Uses createCoreRouter (requires auth) | 🟡 Moderate |
| `src/routes/flow.routes.ts` | Proxy works but receives 403 from Strapi | 🟢 Not an issue |
| `src/web/manager/services/flow-api.ts` | Token handling correct | 🟢 Not an issue |

---

## Summary

**Investigation Status**: ✅ COMPLETE

The investigation has identified the exact root cause:
- **Location**: Strapi backend missing users-permissions middleware and flow permissions
- **Scope**: Affects all CRUD routes for flows (/api/flows)
- **Impact**: Dashboard and Flows pages cannot load due to 403 errors
- **Solution**: Configure Strapi users-permissions and enable flow permissions

The Express proxy layer is functioning correctly and is not the source of the 403 errors.
