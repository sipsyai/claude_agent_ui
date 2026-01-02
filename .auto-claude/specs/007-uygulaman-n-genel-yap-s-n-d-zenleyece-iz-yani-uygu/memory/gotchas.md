# Gotchas & Pitfalls

Things to watch out for in this codebase.

## [2026-01-02 14:11]
In Express routers, static routes like /templates must be defined BEFORE dynamic routes like /:id to avoid the dynamic route capturing requests meant for the static route (e.g., 'templates' being treated as an ID)

_Context: flow.routes.ts - Template routes were initially added after :id routes causing routing conflicts_
