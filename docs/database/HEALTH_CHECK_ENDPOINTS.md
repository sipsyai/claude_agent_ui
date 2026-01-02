# Health Check Endpoints

This document describes the health check endpoints available in the Claude Agent UI system. These endpoints are used by Docker health checks, monitoring systems, and load balancers to verify service health and database connectivity.

## Overview

The system provides comprehensive health checks at multiple layers:

1. **Strapi Backend** - Database connectivity and connection pool health
2. **Express Backend** - Service health and Strapi connectivity
3. **Frontend Nginx** - Static file serving health

## Strapi Health Endpoints

### Primary Health Check: `GET /_health`

**URL:** `http://localhost:1337/_health`

**Purpose:** Validates database connectivity and returns connection pool statistics.

**Response (Healthy):**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-02T10:30:00.000Z",
  "uptime": 3600,
  "database": {
    "connected": true,
    "responseTime": 5
  },
  "pool": {
    "numUsed": 2,
    "numFree": 8,
    "numPendingAcquires": 0,
    "numPendingCreates": 0
  },
  "responseTime": 10
}
```

**Response (Unhealthy):**
```json
{
  "status": "unhealthy",
  "timestamp": "2026-01-02T10:30:00.000Z",
  "uptime": 3600,
  "database": {
    "connected": false,
    "responseTime": 0,
    "error": "Connection timeout"
  },
  "pool": {
    "numUsed": 0,
    "numFree": 0,
    "numPendingAcquires": 0,
    "numPendingCreates": 0
  },
  "responseTime": 5000
}
```

**Status Codes:**
- `200 OK` - Service is healthy, database is connected
- `503 Service Unavailable` - Service is unhealthy, database connection failed

**Used By:**
- Docker Compose health check (see `docker-compose.yml`)
- Kubernetes readiness probes
- Load balancers
- Monitoring systems

---

### Readiness Check: `GET /_health/ready`

**URL:** `http://localhost:1337/_health/ready`

**Purpose:** Kubernetes-style readiness probe. Returns 200 only if the service is ready to accept traffic (database is accessible).

**Response (Ready):**
```json
{
  "status": "ready",
  "timestamp": "2026-01-02T10:30:00.000Z"
}
```

**Response (Not Ready):**
```json
{
  "status": "not_ready",
  "timestamp": "2026-01-02T10:30:00.000Z",
  "error": "Database connection failed"
}
```

**Status Codes:**
- `200 OK` - Service is ready to accept requests
- `503 Service Unavailable` - Service is not ready

**Use Case:** Kubernetes readiness probes to control traffic routing during:
- Rolling deployments
- Database maintenance
- Service startup

---

### Liveness Check: `GET /_health/live`

**URL:** `http://localhost:1337/_health/live`

**Purpose:** Kubernetes-style liveness probe. Returns 200 if the process is alive.

**Response:**
```json
{
  "status": "alive",
  "timestamp": "2026-01-02T10:30:00.000Z",
  "uptime": 3600
}
```

**Status Codes:**
- `200 OK` - Process is alive

**Use Case:** Kubernetes liveness probes to detect deadlocked or crashed processes.

---

## Express Health Endpoints

### Primary Health Check: `GET /health`

**URL:** `http://localhost:3001/health`

**Purpose:** Validates Express service health and checks Strapi connectivity (including database).

**Response (Healthy):**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-02T10:30:00.000Z",
  "uptime": 3600,
  "services": {
    "express": {
      "status": "healthy"
    },
    "strapi": {
      "status": "healthy",
      "database": {
        "connected": true,
        "responseTime": 5
      },
      "pool": {
        "numUsed": 2,
        "numFree": 8,
        "numPendingAcquires": 0,
        "numPendingCreates": 0
      },
      "responseTime": 10
    }
  }
}
```

**Response (Degraded):**
```json
{
  "status": "degraded",
  "timestamp": "2026-01-02T10:30:00.000Z",
  "uptime": 3600,
  "services": {
    "express": {
      "status": "healthy"
    },
    "strapi": {
      "status": "unreachable",
      "error": "fetch failed",
      "database": {
        "connected": false
      }
    }
  }
}
```

**Status Codes:**
- `200 OK` - All services are healthy
- `503 Service Unavailable` - One or more services are degraded or unhealthy

**Used By:**
- Docker Compose health check (see `docker-compose.yml`)
- Monitoring systems
- Load balancers

---

## Docker Health Check Configuration

### Strapi Service

```yaml
healthcheck:
  test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:1337/_health || exit 1"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 60s
```

**Configuration:**
- Checks every 30 seconds
- 10 second timeout per check
- 3 retries before marking unhealthy
- 60 second grace period on startup

### Express Service

```yaml
healthcheck:
  test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 30s
```

**Configuration:**
- Checks every 30 seconds
- 10 second timeout per check
- 3 retries before marking unhealthy
- 30 second grace period on startup

---

## Connection Pool Metrics

The health check endpoints provide real-time connection pool statistics:

### Pool Metrics Explained

| Metric | Description | Healthy Range |
|--------|-------------|---------------|
| `numUsed` | Active connections currently executing queries | 0 - `max` (10) |
| `numFree` | Idle connections available in the pool | 0 - `max` (10) |
| `numPendingAcquires` | Requests waiting for a connection | 0 - 5 (warning if > 5) |
| `numPendingCreates` | Connections being created | 0 - 2 (warning if > 2) |

### Pool Health Indicators

**Healthy Pool:**
- `numFree` > 0 (connections available)
- `numPendingAcquires` = 0 (no waiting requests)
- `numUsed` + `numFree` ≥ `pool.min` (2)

**Warning Signs:**
- `numPendingAcquires` > 5 (connection starvation)
- `numFree` = 0 and `numUsed` = `max` (pool exhausted)
- `numPendingCreates` > 2 (connection creation issues)

**Critical Issues:**
- `database.connected` = false (database unreachable)
- `database.responseTime` > 1000ms (slow queries)
- All pool metrics = 0 (pool not initialized)

---

## Testing Health Checks

### Manual Testing

**Test Strapi Health:**
```bash
# Primary health check
curl -i http://localhost:1337/_health

# Readiness check
curl -i http://localhost:1337/_health/ready

# Liveness check
curl -i http://localhost:1337/_health/live
```

**Test Express Health:**
```bash
curl -i http://localhost:3001/health
```

### Docker Health Check Status

**View health status:**
```bash
docker ps
# Look for "(healthy)" or "(unhealthy)" in the STATUS column

# Detailed health check logs
docker inspect claude-strapi | jq '.[0].State.Health'
docker inspect claude-express | jq '.[0].State.Health'
```

**Force health check:**
```bash
docker exec claude-strapi wget --spider http://localhost:1337/_health
docker exec claude-express wget --spider http://localhost:3001/health
```

---

## Monitoring Integration

### Prometheus Metrics

The health check endpoints can be scraped for monitoring:

```yaml
scrape_configs:
  - job_name: 'strapi'
    metrics_path: '/_health'
    static_configs:
      - targets: ['localhost:1337']

  - job_name: 'express'
    metrics_path: '/health'
    static_configs:
      - targets: ['localhost:3001']
```

### Alerting Rules

**Example alerts based on health check data:**

```yaml
groups:
  - name: database_health
    rules:
      - alert: DatabaseDisconnected
        expr: database_connected == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database connection lost"

      - alert: HighPendingAcquires
        expr: pool_pending_acquires > 5
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Connection pool starvation detected"

      - alert: SlowDatabaseQueries
        expr: database_response_time > 1000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Database queries are slow"
```

---

## Troubleshooting

### Health Check Fails

**Symptoms:** 503 status code, `status: "unhealthy"`

**Common Causes:**
1. **Database not running**
   ```bash
   docker ps | grep postgres
   docker logs claude-postgres
   ```

2. **Connection pool exhausted**
   - Check `numPendingAcquires` metric
   - Review slow queries
   - Increase `pool.max` if needed

3. **Network issues**
   - Verify Docker network configuration
   - Check firewall rules
   - Test connectivity: `docker exec claude-strapi nc -zv postgres 5432`

### Readiness Check Fails

**Symptoms:** 503 status from `/_health/ready`

**Actions:**
1. Check database connectivity
2. Verify migrations have run
3. Check database logs for errors
4. Wait for startup period to complete

### High Response Time

**Symptoms:** `responseTime` > 100ms consistently

**Actions:**
1. Check database server load
2. Review connection pool settings
3. Analyze slow query logs
4. Consider increasing pool size

---

## Related Documentation

- [Connection Pool Verification](./CONNECTION_POOL_VERIFICATION.md) - Pool configuration details
- [PostgreSQL Rollback Procedures](./POSTGRES_ROLLBACK_PROCEDURES.md) - Database recovery
- [Backup Procedures](./BACKUP_PROCEDURES.md) - Backup and restore (if available)

---

## Implementation Details

### Strapi Health Check Controller

**Location:** `backend/src/api/health/controllers/health.ts`

**Key Features:**
- Database connectivity test using `SELECT 1` query
- Real-time connection pool statistics
- Error handling with detailed error messages
- Response time tracking

### Express Health Check Route

**Location:** `src/server.ts` (setupRoutes method)

**Key Features:**
- Multi-layer health check (Express + Strapi + Database)
- 5-second timeout for Strapi checks
- Graceful degradation (returns 503 if Strapi is down)
- Comprehensive error logging

---

**Last Updated:** 2026-01-02
**PostgreSQL Migration:** Completed
**Health Check Version:** 1.0
