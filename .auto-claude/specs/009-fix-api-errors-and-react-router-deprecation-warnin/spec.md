# Specification: Fix API Errors and React Router Deprecation Warnings

## Overview

This task addresses critical API errors preventing the Dashboard and Flows pages from functioning properly, along with React Router v7 migration warnings. The dashboard fails to load key statistics and flow data due to three distinct backend API issues (500 Internal Server Error on stats endpoint, 404 Not Found on executions endpoint, and 403 Forbidden on flows endpoints), while the frontend generates deprecation warnings related to React Router v6→v7 migration. The fixes involve both backend endpoint implementation/debugging and frontend React Router v7 future flags configuration.

## Workflow Type

**Type**: bug_fix

**Rationale**: Multiple non-breaking bugs are preventing core features (Dashboard, Flows pages) from functioning. The task requires both backend API fixes (missing/failing endpoints) and frontend deprecation warnings resolution. This is a pure bug-fix workflow with clear error patterns and acceptance criteria.

## Task Scope

### Services Involved
- **Main (Frontend)** (primary) - React/TypeScript frontend consuming Flow APIs, displays Dashboard and Flows pages
- **Backend API** (integration) - Strapi-based REST API at `http://localhost:3001` providing flow management endpoints

### This Task Will:
- [ ] Fix `GET /api/flows/stats/global` endpoint (currently returning 500 Internal Server Error)
- [ ] Implement or fix `GET /api/flows/executions/recent?limit=10` endpoint (currently returning 404 Not Found)
- [ ] Fix `GET /api/flows` endpoint authorization issues (currently returning 403 Forbidden)
- [ ] Resolve React Router v7 deprecation warnings by enabling v7 future flags
- [ ] Add proper error handling to prevent console spam from polling failures
- [ ] Verify Dashboard and Flows pages load successfully without errors

### Out of Scope:
- Full React Router v7 migration (upgrade to v7 itself)
- Backend authentication system redesign (fix existing auth layer)
- Comprehensive refactoring of API calls (targeted error fixes only)
- Template creation feature (`POST /api/flows/templates/web-scraper/create` slug validation)

## Service Context

### Main (Frontend)

**Tech Stack:**
- Language: TypeScript
- Framework: React 18+
- Build Tool: Vite
- Styling: Tailwind CSS
- State Management: React Context API
- HTTP Client: axios (inferred from error traces)
- Router: React Router v6.x

**Key Directories:**
- `src/pages/` - Page components (DashboardPage.tsx, FlowsPage.tsx)
- `src/api/` - API client functions (flow-api.ts)
- `src/components/` - Reusable components

**Entry Point:** `src/main.tsx` (or `src/main.jsx` depending on project setup)

**How to Run:**
```bash
npm run dev
```
This starts the Vite development server, typically accessible at http://localhost:5173

**Ports:**
- Frontend: 5173 (Vite dev server)
- Backend: 3001 (API server)

**Environment Setup:**
- Frontend runs on `http://localhost:5173` (Vite dev)
- Backend API at `http://localhost:3001`
- React StrictMode enabled (causes intentional double-invocation of effects in dev)

### Backend API (Strapi)

**Location:** `/api/` endpoints at `http://localhost:3001`

**API Base URL:** `http://localhost:3001`

**Key Endpoints Involved:**
- `GET /api/flows/stats/global` - Returns global flow statistics (FAILING: 500)
- `GET /api/flows/executions/recent?limit=10` - Returns recent executions (FAILING: 404)
- `GET /api/flows` or `GET /api/flows?isActive=true&pageSize=5` - Returns flow list (FAILING: 403)
- `POST /api/flows/templates/web-scraper/create` - Creates flow from template (FAILING: 400 Bad Request)

## Files to Modify

| File | Service | What to Change |
|------|---------|---------------|
| `src/pages/DashboardPage.tsx` | Frontend | Add error handling to useEffect hooks (lines 162-164) that call API endpoints; optionally add loading states |
| `src/pages/FlowsPage.tsx` | Frontend | Add error handling to useEffect hooks and polling mechanism (lines 118, 143, 157-158); implement exponential backoff for polling |
| `src/api/flow-api.ts` | Frontend | Add error handling to API client functions (getGlobalFlowStats, getRecentExecutions, getFlows) |
| `src/main.tsx` or `src/App.tsx` | Frontend | Enable React Router v7 future flags in BrowserRouter configuration |
| Backend: Flow Stats Controller | Backend | Debug/fix `/api/flows/stats/global` endpoint implementation (500 error indicates logic bug) |
| Backend: Executions Routes | Backend | Implement missing `/api/flows/executions/recent` endpoint (404 indicates route not defined) |
| Backend: Flow Routes Auth Middleware | Backend | Fix authorization checks on `/api/flows` endpoints (403 indicates auth/permission issue) |

## Files to Reference

These files show patterns to follow:

| File | Pattern to Copy |
|------|----------------|
| `src/api/flow-api.ts` | Error handling patterns for axios API calls (if any exist); authentication token passing |
| `src/pages/DashboardPage.tsx` | How useEffect hooks are structured for data loading; parallel API calls pattern |
| `src/pages/FlowsPage.tsx` | Polling mechanism implementation; cleanup functions in useEffect |
| `src/components/` | How errors are displayed in existing components (loading states, error messages) |

## Patterns to Follow

### API Error Handling Pattern

From `src/api/flow-api.ts` and error traces:

**Current Pattern (No Error Handling):**
```typescript
// These calls lack error handling:
export const getGlobalFlowStats = () => apiClient.get('/flows/stats/global');
export const getRecentExecutions = (limit?: number) =>
  apiClient.get('/flows/executions/recent', { params: { limit } });
export const getFlows = (params?: FlowQueryParams) =>
  apiClient.get('/flows', { params });
```

**Improved Pattern (With Error Handling):**
```typescript
// Add try-catch or error handling in components:
const fetchFlows = async () => {
  try {
    setLoading(true);
    const response = await getFlows({ isActive: true, pageSize: 5 });
    setFlows(response.data);
  } catch (error) {
    console.error('Failed to fetch flows:', error);
    setError(error.message);
    // Don't re-throw; allow UI to show error state
  } finally {
    setLoading(false);
  }
};
```

**Key Points:**
- Catch errors at component level, not API layer
- Log errors without throwing to prevent component unmounting
- Store error state in React state for UI display
- Prevent polling from continuously firing errors with exponential backoff

### React Router v7 Migration Pattern

From React Router documentation:

**Current (v6):**
```typescript
<BrowserRouter>
  <Routes>
    {/* routes */}
  </Routes>
</BrowserRouter>
```

**Improved (v7 Compatible):**
```typescript
<BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
  <Routes>
    {/* routes */}
  </Routes>
</BrowserRouter>
```

**Key Points:**
- `v7_startTransition`: Wraps state updates in React.startTransition
- `v7_relativeSplatPath`: Changes how relative paths resolve in splat routes
- These flags are future-compatible and recommended even in v6

### Effect Cleanup and Polling Pattern

From `src/pages/FlowsPage.tsx` lines 157-158:

**Current Pattern (Problematic Polling):**
```typescript
useEffect(() => {
  const intervalId = setInterval(() => {
    getFlows(); // Continuously fails, spams console with 403 errors
  }, POLLING_INTERVAL);
  // Missing cleanup!
}, []);
```

**Improved Pattern (Exponential Backoff):**
```typescript
useEffect(() => {
  let intervalId: number | null = null;
  let retryCount = 0;
  const MAX_RETRIES = 3;
  const BASE_DELAY = 5000; // 5 seconds
  const MAX_DELAY = 30000; // 30 seconds

  const scheduleNextPoll = (delayMs: number) => {
    if (intervalId) clearInterval(intervalId);
    intervalId = window.setInterval(poll, delayMs);
  };

  const poll = async () => {
    try {
      setLoading(true);
      const response = await getFlows();
      setFlows(response.data);
      retryCount = 0; // Reset on success
      // Continue polling at base interval after success
      scheduleNextPoll(BASE_DELAY);
    } catch (error) {
      retryCount++;
      console.warn(`Polling failed (attempt ${retryCount}):`, error);
      if (retryCount >= MAX_RETRIES) {
        setError('Failed to load flows');
        if (intervalId) clearInterval(intervalId);
        return; // Stop polling after max retries
      }
      // Calculate exponential backoff delay for next attempt
      const nextDelay = Math.min(
        BASE_DELAY * Math.pow(2, retryCount - 1),
        MAX_DELAY
      );
      scheduleNextPoll(nextDelay);
    } finally {
      setLoading(false);
    }
  };

  // Initial poll
  poll();

  // Cleanup function
  return () => {
    if (intervalId) clearInterval(intervalId);
  };
}, []);
```

**Key Points:**
- Always include cleanup function to clear interval
- Recalculate exponential backoff delay after each failed attempt
- Stop polling after max retries to prevent infinite retry loops
- Reset retry count and delay on successful requests
- Use helper function `scheduleNextPoll` to manage interval rescheduling
- Store interval ID and clear it properly in cleanup

## Requirements

### Functional Requirements

1. **Dashboard Statistics Loading**
   - Description: Dashboard page displays global flow statistics without errors
   - Acceptance: GET `/api/flows/stats/global` returns 200 OK with valid statistics data, no 500 errors in console

2. **Dashboard Recent Executions Loading**
   - Description: Dashboard page displays recent flow executions without errors
   - Acceptance: GET `/api/flows/executions/recent?limit=10` returns 200 OK with execution list, no 404 errors in console

3. **Dashboard Active Flows Loading**
   - Description: Dashboard page displays active flows without authorization errors
   - Acceptance: GET `/api/flows?isActive=true&pageSize=5` returns 200 OK with flow list, no 403 errors in console

4. **Flows Page Loading**
   - Description: Flows page loads and displays flows list without errors
   - Acceptance: GET `/api/flows` returns 200 OK with flows data, no 403 errors on initial load or polling

5. **Error Handling in Polling**
   - Description: Polling mechanism in FlowsPage doesn't spam console with repeated errors
   - Acceptance: Initial 403 error shows once, subsequent polls respect exponential backoff, no console spam

6. **React Router v7 Compatibility**
   - Description: No React Router v7 deprecation warnings in console
   - Acceptance: BrowserRouter configured with future flags, warnings gone, no v7 deprecation messages

### Edge Cases

1. **StrictMode Double-Invocation** - React StrictMode intentionally runs effects twice in dev; ensure API calls are idempotent (use cleanup functions to prevent duplicate actual requests)
2. **Network Errors During Polling** - Implement exponential backoff so repeated 403/404 errors don't spam console continuously
3. **Missing Auth Token** - If 403 errors are due to missing/expired tokens, ensure auth middleware/token passing is correct
4. **Backend Endpoint Missing (404)** - If `/api/flows/executions/recent` doesn't exist on backend, must implement the route
5. **Backend Logic Failure (500)** - If `/api/flows/stats/global` throws 500, debug backend controller for null reference, DB query issues, or aggregation bugs

## Implementation Notes

### DO
- Follow error handling pattern from existing components (if any implement try-catch)
- Add loading and error states to DashboardPage and FlowsPage
- Use exponential backoff for polling to prevent error spam
- Enable React Router v7 future flags in main routing configuration
- Verify auth token is being passed correctly to backend (check Authorization headers)
- Test with `npm run dev` and check browser console for errors
- Keep changes minimal and targeted (don't refactor entire API layer)
- Clean up intervals and timers in useEffect cleanup functions

### DON'T
- Don't ignore errors at API layer; handle them in components
- Don't remove React StrictMode (it's correct behavior for finding bugs)
- Don't implement full React Router v7 upgrade (only enable future flags)
- Don't change polling interval excessively; use exponential backoff instead
- Don't make assumptions about backend implementation; debug actual errors first
- Don't modify database schemas or migrations (only API logic)
- Don't add new dependencies; work with existing axios/React Router setup

## Development Environment

### Start Services

```bash
# Frontend dev server
npm run dev

# Backend (if running locally, ensure Strapi is started separately)
# Assuming Strapi runs on port 1337 or 3001
```

### Service URLs
- Frontend: http://localhost:5173 (Vite dev server)
- Backend API: http://localhost:3001/api

### Required Environment Variables
- `NODE_ENV`: Set to 'development' (from .env)
- Backend API base URL: http://localhost:3001 (hardcoded or in axios config)
- Auth tokens: May be needed if 403 errors are due to missing credentials

### Browser Tools
- React DevTools: Install for debugging component state
- Network Tab: Monitor API calls and error responses
- Console: Check for error messages and warnings

## Success Criteria

The task is complete when:

1. [ ] Dashboard page loads without API errors in console
2. [ ] Global stats endpoint (`/api/flows/stats/global`) returns 200 OK
3. [ ] Recent executions endpoint (`/api/flows/executions/recent`) returns 200 OK
4. [ ] Flows endpoint (`/api/flows`) returns 200 OK without 403 errors
5. [ ] FlowsPage polling doesn't spam console with repeated errors
6. [ ] React Router v7 deprecation warnings are gone from console
7. [ ] No 500, 404, or 403 errors for core API endpoints
8. [ ] Existing tests still pass
9. [ ] New functionality verified via browser (Dashboard/Flows pages load cleanly)
10. [ ] Error handling gracefully displays messages instead of breaking UI

## QA Acceptance Criteria

**CRITICAL**: These criteria must be verified by the QA Agent before sign-off.

### Unit Tests
| Test | File | What to Verify |
|------|------|----------------|
| Flow API Error Handling | `src/api/flow-api.test.ts` (if exists) | getFlows, getGlobalFlowStats, getRecentExecutions handle errors correctly |
| Dashboard Error State | `src/pages/DashboardPage.test.tsx` (if exists) | Component displays error messages when APIs fail |
| FlowsPage Polling | `src/pages/FlowsPage.test.tsx` (if exists) | Polling cleanup, exponential backoff, retry logic work correctly |

### Integration Tests
| Test | Services | What to Verify |
|------|----------|----------------|
| Dashboard ↔ Backend | Frontend ↔ API | Dashboard calls all three endpoints and displays data without errors |
| FlowsPage ↔ Backend | Frontend ↔ API | FlowsPage initial load and polling work without 403 errors |
| Auth Token Passing | Frontend ↔ API | Authorization headers included in requests (if required) |

### End-to-End Tests
| Flow | Steps | Expected Outcome |
|------|-------|------------------|
| Load Dashboard | 1. Navigate to Dashboard page 2. Wait for data to load | Dashboard displays stats, recent executions, and active flows without errors |
| Verify Stats Loading | 1. Open browser Network tab 2. Reload Dashboard | GET `/api/flows/stats/global` returns 200 (not 500) |
| Verify Executions Loading | 1. Check Network tab | GET `/api/flows/executions/recent` returns 200 (not 404) |
| Verify Flows Loading | 1. Check Network tab | GET `/api/flows` returns 200 (not 403) |
| Test FlowsPage Polling | 1. Navigate to Flows page 2. Wait for polling 3. Check console | No repeated 403 errors; polling respects exponential backoff |
| Verify Router Warnings Gone | 1. Open browser console 2. Look for warnings | No React Router v7 deprecation warnings present |

### Browser Verification (Critical)
| Page/Component | URL | Checks |
|----------------|-----|--------|
| Dashboard Page | `http://localhost:5173/dashboard` (or similar) | ✓ Page loads without errors ✓ Global stats display ✓ Recent executions display ✓ Active flows display ✓ No error messages ✓ No console errors |
| Flows Page | `http://localhost:5173/flows` (or similar) | ✓ Page loads without errors ✓ Flows list displays ✓ Polling active without error spam ✓ No 403 errors repeating in console |
| Console Check | Browser DevTools Console | ✓ No 500 errors ✓ No 404 errors ✓ No 403 errors ✓ No React Router warnings ✓ No unhandled promise rejections |

### QA Sign-off Requirements
- [ ] Dashboard page renders successfully without API errors
- [ ] All three flow-related API endpoints return 200 OK (not 403/404/500)
- [ ] FlowsPage polling works without console spam
- [ ] React Router v7 deprecation warnings are completely gone
- [ ] No regressions in existing functionality (other pages still work)
- [ ] Error messages display gracefully if backend errors persist
- [ ] No unhandled promise rejections in console
- [ ] Code follows established React/TypeScript patterns
- [ ] No security vulnerabilities introduced (auth headers passed correctly)

## Implementation Priority

**Fix Order (by impact):**
1. **React Router v7 Future Flags** (Quick win, removes warnings immediately)
2. **403 Authorization Errors** (Blocks Dashboard entirely; fix auth/permissions)
3. **404 Not Found Error** (Implement missing endpoint or fix route)
4. **500 Internal Server Error** (Debug backend stats logic)
5. **Polling Error Handling** (Add exponential backoff to reduce spam)

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| Backend endpoints not implemented | Medium | Critical - Dashboard won't load | Backend developer must implement routes; document API contracts |
| Auth token not being passed | Medium | Critical - 403 errors continue | Verify Authorization header in Network tab; check token storage |
| Changes break other pages | Low | High - Regression | Test all pages after changes; verify existing tests pass |
| Polling causes memory leaks | Low | Medium - Performance issue | Always clear intervals in cleanup functions; test with DevTools |
| Incomplete error handling | Medium | Medium - Poor UX | Display user-friendly error messages; don't let errors crash app |

