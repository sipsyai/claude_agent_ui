# Docker & Deployment Architecture Analysis

## Overview

The Claude Agent UI uses Docker Compose to orchestrate a multi-service architecture with two configuration files:
- `docker-compose.yml` - Production configuration with resource limits and security hardening
- `docker-compose.dev.yml` - Development overrides with hot-reload and debugging support

The stack consists of 4 containerized services, 2 custom networks, and 5 persistent volumes.

---

## Architecture Components

### Services (4 Total)

1. **PostgreSQL Database** - Data persistence layer
2. **Strapi CMS** - Headless CMS providing REST API for data management
3. **Express Backend** - Business logic, SSE streaming, and Claude SDK integration
4. **Frontend (Nginx)** - React SPA with Nginx reverse proxy

### Networks (2 Total)

1. **backend** - PostgreSQL ↔ Strapi ↔ Express communication
2. **frontend** - Frontend ↔ Strapi ↔ Express communication

### Volumes (5 Total)

**Critical (Must be backed up)**:
- `postgres_data` - PostgreSQL database files
- `strapi_uploads` - User-uploaded files and media

**Ephemeral (Can be regenerated)**:
- `strapi_cache` - Strapi build cache
- `express_cache` - Express application cache
- `nginx_cache` - Nginx static file cache

---

## Service Detailed Analysis

## 1. PostgreSQL Database

**Image**: `postgres:16-alpine`
**Container Name**: `claude-postgres`
**Internal Port**: 5432
**Exposed Port**: 5433 (configurable via `POSTGRES_PORT`)

### Environment Variables

```yaml
POSTGRES_DB: claude_agent_ui (default)
POSTGRES_USER: postgres (default)
POSTGRES_PASSWORD: Required (no default)
POSTGRES_INITDB_ARGS: "--encoding=UTF8 --locale=en_US.UTF-8"
PGDATA: /var/lib/postgresql/data/pgdata
```

### Volume Mounts

```yaml
postgres_data → /var/lib/postgresql/data        # Data persistence
./database/init → /docker-entrypoint-initdb.d   # Initialization scripts (read-only)
./database/backups → /backups                   # Backup storage
./logs/postgres → /var/log/postgresql           # Log files
```

### Health Check

```yaml
Test: pg_isready -U postgres -d claude_agent_ui
Interval: 10s
Timeout: 5s
Retries: 5
Start Period: 10s
```

**Purpose**: Ensures database is ready before starting dependent services

### Resource Limits

```yaml
Limits:
  CPUs: 2
  Memory: 1GB

Reservations:
  CPUs: 0.5
  Memory: 256MB
```

### Logging Configuration

```yaml
Driver: json-file
Max Size: 10MB per file
Max Files: 3
Total Log Size: ~30MB
Labels: service=postgres
```

### Networks

- Connected to: `backend`
- Not accessible from: `frontend` (isolated for security)

### Restart Policy

`unless-stopped` - Automatically restarts except when manually stopped

---

## 2. Strapi CMS

**Build Context**: `./backend`
**Dockerfile**: `backend/Dockerfile`
**Build Target**: `production` (production) / `development` (dev override)
**Container Name**: `claude-strapi`
**Internal Port**: 1337
**Exposed Port**: 1337 (configurable via `STRAPI_PORT`)

### Build Arguments

```yaml
NODE_VERSION: 20
BUILD_DATE: ${BUILD_DATE}
VCS_REF: ${VCS_REF}
```

### Environment Variables

#### Node Configuration
```yaml
NODE_ENV: production (default)
HOST: 0.0.0.0
PORT: 1337
```

#### Database Configuration
```yaml
DATABASE_CLIENT: postgres
DATABASE_HOST: postgres          # Container name
DATABASE_PORT: 5432
DATABASE_NAME: claude_agent_ui
DATABASE_USERNAME: postgres
DATABASE_PASSWORD: Required
DATABASE_SSL: false (default)
```

#### Strapi Security Secrets (All Required)
```yaml
APP_KEYS: Required - App signing keys (comma-separated)
API_TOKEN_SALT: Required - API token salt
ADMIN_JWT_SECRET: Required - Admin JWT signing secret
TRANSFER_TOKEN_SALT: Required - Transfer token salt
JWT_SECRET: Required - User JWT signing secret
```

#### Application Configuration
```yaml
STRAPI_CORS_ORIGIN: http://localhost:5173,http://localhost:3001
ADMIN_PATH: /admin (default)
MAX_FILE_SIZE: 52428800 (50MB default)
```

### Volume Mounts

```yaml
strapi_uploads → /opt/app/public/uploads    # User uploads (persistent)
strapi_cache → /opt/app/.cache              # Build cache (ephemeral)
./backend/config → /opt/app/config          # Configuration (read-only)
./logs/strapi → /opt/app/logs               # Application logs
```

### Health Check

```yaml
Test: wget --no-verbose --tries=1 --spider http://localhost:1337/_health
Interval: 30s
Timeout: 10s
Retries: 3
Start Period: 60s
```

**Start Period**: 60s to allow database initialization and migrations

### Dependencies

```yaml
postgres:
  condition: service_healthy
```

**Flow**: PostgreSQL must be healthy before Strapi starts

### Resource Limits

```yaml
Limits:
  CPUs: 2
  Memory: 1GB

Reservations:
  CPUs: 0.5
  Memory: 512MB
```

### Logging Configuration

```yaml
Driver: json-file
Max Size: 10MB per file
Max Files: 3
Labels: service=strapi
```

### Networks

- Connected to: `backend`, `frontend`
- **Bridge Service**: Connects database backend to application frontend

### Development Overrides (docker-compose.dev.yml)

```yaml
Build Target: development
Environment:
  NODE_ENV: development
  STRAPI_LOG_LEVEL: debug

Volumes:
  ./backend → /opt/app (delegated)        # Hot reload
  /opt/app/node_modules                   # Prevent overwrite

Ports:
  1337:1337                               # Main port
  9229:9229                               # Node.js debugger

Command: npm run develop                  # Strapi development mode
```

**Features**:
- Hot module reloading
- Debug port exposed
- Source code mounted for live editing
- Development mode with admin panel

---

## 3. Express Backend

**Build Context**: `.` (project root)
**Dockerfile**: `Dockerfile.express`
**Build Target**: `production` (production) / `development` (dev override)
**Container Name**: `claude-express`
**Internal Port**: 3001
**Exposed Port**: 3001 (configurable via `EXPRESS_PORT`)

### Build Arguments

```yaml
NODE_VERSION: 20
BUILD_DATE: ${BUILD_DATE}
VCS_REF: ${VCS_REF}
```

### Environment Variables

#### Node Configuration
```yaml
NODE_ENV: production (default)
HOST: 0.0.0.0
PORT: 3001
```

#### Service Integration
```yaml
STRAPI_URL: http://strapi:1337        # Internal container name
STRAPI_API_TOKEN: Required            # Strapi API authentication
```

#### Claude SDK Configuration
```yaml
ANTHROPIC_API_KEY: Required           # Claude API access
```

#### Application Configuration
```yaml
LOG_LEVEL: info (default)
LOG_FORMAT: json (default)
MAX_WORKERS: 4 (default)
REQUEST_TIMEOUT: 300000 (5 minutes)
CORS_ORIGIN: http://localhost:5173
```

### Volume Mounts

```yaml
./logs/express → /app/logs          # Application logs
express_cache → /app/.cache         # Application cache (ephemeral)
```

### Health Check

```yaml
Test: wget --no-verbose --tries=1 --spider http://localhost:3001/health
Interval: 30s
Timeout: 10s
Retries: 3
Start Period: 30s
```

### Dependencies

```yaml
strapi:
  condition: service_healthy
```

**Flow**: Strapi must be healthy before Express starts (requires API access)

### Resource Limits

```yaml
Limits:
  CPUs: 2
  Memory: 1GB

Reservations:
  CPUs: 0.5
  Memory: 512MB
```

### Logging Configuration

```yaml
Driver: json-file
Max Size: 10MB per file
Max Files: 3
Labels: service=express
```

### Networks

- Connected to: `backend`, `frontend`
- **API Gateway**: Handles frontend requests and Strapi communication

### Development Overrides (docker-compose.dev.yml)

```yaml
Build Target: development
Environment:
  NODE_ENV: development
  LOG_LEVEL: debug

Volumes:
  ./src → /app/src (delegated)            # Hot reload
  /app/node_modules                       # Prevent overwrite

Ports:
  3001:3001                               # Main port
  9230:9230                               # Node.js debugger

Command: npm run dev                      # Nodemon for hot reload
```

**Features**:
- Nodemon auto-restart on file changes
- Debug port exposed
- Source code mounted for live editing
- Detailed debug logging

---

## 4. Frontend (React + Nginx)

**Build Context**: `.` (project root)
**Dockerfile**: `Dockerfile.frontend`
**Build Target**: `production` (production) / `development` (dev override)
**Container Name**: `claude-frontend`
**Internal Ports**: 80 (HTTP), 443 (HTTPS)
**Exposed Ports**: Configurable via `FRONTEND_HTTP_PORT`, `FRONTEND_HTTPS_PORT`

### Build Arguments

```yaml
NODE_VERSION: 20
VITE_STRAPI_URL: http://localhost:1337/api
VITE_EXPRESS_URL: http://localhost:3001/api
```

**Note**: Build-time environment variables baked into React bundle

### Volume Mounts

```yaml
./nginx/nginx.conf → /etc/nginx/nginx.conf     # Main nginx config (read-only)
./nginx/conf.d → /etc/nginx/conf.d             # Server blocks (read-only)
nginx_cache → /var/cache/nginx                 # Nginx cache (ephemeral)
./logs/nginx → /var/log/nginx                  # Access/error logs
./ssl → /etc/nginx/ssl                         # SSL certificates (read-only)
```

### Health Check

```yaml
Test: wget --no-verbose --tries=1 --spider http://localhost:80/health
Interval: 30s
Timeout: 10s
Retries: 3
Start Period: 10s
```

**Fast Start**: Frontend has minimal dependencies, starts quickly

### Dependencies

```yaml
strapi:
  condition: service_healthy
express:
  condition: service_healthy
```

**Flow**: Both backend services must be healthy before frontend starts

### Resource Limits

```yaml
Limits:
  CPUs: 1
  Memory: 256MB

Reservations:
  CPUs: 0.25
  Memory: 64MB
```

**Note**: Smallest resource footprint - static file serving is lightweight

### Logging Configuration

```yaml
Driver: json-file
Max Size: 10MB per file
Max Files: 3
Labels: service=frontend
```

### Networks

- Connected to: `frontend`
- Not connected to: `backend` (no direct database access)

### Development Overrides (docker-compose.dev.yml)

```yaml
Build Target: development
Environment:
  VITE_STRAPI_URL: http://localhost:1337/api
  VITE_EXPRESS_URL: http://localhost:3001/api

Volumes:
  . → /app (delegated)                    # Hot reload
  /app/node_modules                       # Prevent overwrite

Ports:
  5173:5173                               # Vite dev server
  24678:24678                             # Vite HMR (Hot Module Replacement)

Command: npm run dev -- --host 0.0.0.0    # Vite development mode
```

**Features**:
- Vite dev server with instant HMR
- Source code mounted for live editing
- Separate HMR WebSocket port

---

## Network Architecture

### Backend Network

**Driver**: bridge
**Name**: `claude-backend`

**Connected Services**:
- postgres
- strapi
- express

**Purpose**: Isolates database communication from public access

**Security Benefits**:
- PostgreSQL not accessible from frontend
- Backend-only service communication
- Reduced attack surface

### Frontend Network

**Driver**: bridge
**Name**: `claude-frontend`

**Connected Services**:
- frontend
- strapi
- express

**Purpose**: Enables frontend ↔ API communication

**Access Pattern**:
```
Browser → Frontend (Nginx)
          ↓
          Strapi API (CMS data)
          ↓
          Express API (Business logic, SSE)
```

### Network Topology Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Network                        │
│                                                             │
│  ┌──────────┐         ┌──────────┐         ┌──────────┐   │
│  │ Frontend │────────▶│  Strapi  │────────▶│ Express  │   │
│  │ (Nginx)  │◀────────│  (CMS)   │◀────────│  (API)   │   │
│  └──────────┘         └──────────┘         └──────────┘   │
│                             │                     │         │
└─────────────────────────────┼─────────────────────┼─────────┘
                              │                     │
┌─────────────────────────────┼─────────────────────┼─────────┐
│                     Backend Network              │         │
│                             │                     │         │
│                       ┌─────▼─────┐               │         │
│                       │ Strapi    │◀──────────────┘         │
│                       │  (CMS)    │                         │
│                       └─────┬─────┘                         │
│                             │                               │
│                       ┌─────▼─────┐                         │
│                       │PostgreSQL │                         │
│                       │ Database  │                         │
│                       └───────────┘                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key Points**:
- Strapi and Express are "bridge" services (connected to both networks)
- PostgreSQL is isolated in backend network only
- Frontend is isolated in frontend network only

---

## Volume Management

### postgres_data

**Type**: Named volume (local driver)
**Name**: `claude-postgres-data`
**Mount**: `/var/lib/postgresql/data`
**Priority**: **CRITICAL - Must be backed up regularly**

**Contents**:
- PostgreSQL database files (pgdata)
- All application data (agents, skills, tasks, chat history)
- Strapi content types and relations

**Backup Strategy**:
```bash
# Create backup
docker exec claude-postgres pg_dump -U postgres claude_agent_ui > backup.sql

# Restore backup
docker exec -i claude-postgres psql -U postgres claude_agent_ui < backup.sql
```

### strapi_uploads

**Type**: Named volume (local driver)
**Name**: `claude-strapi-uploads`
**Mount**: `/opt/app/public/uploads`
**Priority**: **HIGH - Should be backed up**

**Contents**:
- User-uploaded files
- Agent/skill attachments
- Media library assets
- File references from database

**Backup Strategy**:
```bash
# Create tar archive
docker run --rm -v claude-strapi-uploads:/data -v $(pwd):/backup \
  alpine tar czf /backup/strapi-uploads-backup.tar.gz -C /data .

# Restore from archive
docker run --rm -v claude-strapi-uploads:/data -v $(pwd):/backup \
  alpine tar xzf /backup/strapi-uploads-backup.tar.gz -C /data
```

### strapi_cache

**Type**: Named volume (local driver)
**Name**: `claude-strapi-cache`
**Mount**: `/opt/app/.cache`
**Priority**: **LOW - Ephemeral**

**Contents**:
- Strapi build cache
- Admin UI build artifacts
- Temporary compilation files

**Can be safely deleted**: Yes - Regenerated on next build

### express_cache

**Type**: Named volume (local driver)
**Name**: `claude-express-cache`
**Mount**: `/app/.cache`
**Priority**: **LOW - Ephemeral**

**Contents**:
- Express application cache
- LRU cache for Strapi client (in-memory, but could persist)

**Can be safely deleted**: Yes

### nginx_cache

**Type**: Named volume (local driver)
**Name**: `claude-nginx-cache`
**Mount**: `/var/cache/nginx`
**Priority**: **LOW - Ephemeral**

**Contents**:
- Nginx response cache
- Proxy cache (if configured)
- FastCGI cache (if configured)

**Can be safely deleted**: Yes

---

## Service Startup Order

### Dependency Chain

```
1. PostgreSQL
   ├─ Health Check: pg_isready
   └─ Start Period: 10s
        ↓
2. Strapi
   ├─ Depends on: postgres (healthy)
   ├─ Health Check: /_health endpoint
   ├─ Start Period: 60s (allows migrations)
   └─ Runs database migrations
        ↓
3. Express
   ├─ Depends on: strapi (healthy)
   ├─ Health Check: /health endpoint
   └─ Start Period: 30s
        ↓
4. Frontend
   ├─ Depends on: strapi (healthy), express (healthy)
   ├─ Health Check: /health endpoint
   └─ Start Period: 10s (static files only)
```

### Startup Timeline (Typical)

```
0s   - PostgreSQL starts
10s  - PostgreSQL healthy
10s  - Strapi starts
70s  - Strapi healthy (migrations + warmup)
70s  - Express starts
100s - Express healthy
100s - Frontend starts
110s - Frontend healthy

Total Startup Time: ~110 seconds (cold start with migrations)
Subsequent Starts: ~30 seconds (no migrations needed)
```

### Health Check Details

#### Why Health Checks Matter

Without health checks:
- Services would start before dependencies are ready
- Express would crash trying to connect to unhealthy Strapi
- Frontend would serve 502 errors from unhealthy backends

With health checks:
- Docker waits for each service to be truly ready
- Graceful startup with proper initialization
- Reliable service availability

#### Health Check Intervals

```yaml
PostgreSQL:
  Interval: 10s  (frequent, database is critical)

Strapi:
  Interval: 30s  (moderate, allows for warmup)

Express:
  Interval: 30s  (moderate, stable once running)

Frontend:
  Interval: 30s  (static files, very stable)
```

---

## Resource Allocation

### Total Resource Limits (Maximum Usage)

```
CPUs: 7 (2 + 2 + 2 + 1)
Memory: 3.25 GB (1 + 1 + 1 + 0.25)
```

### Total Resource Reservations (Guaranteed)

```
CPUs: 1.75 (0.5 + 0.5 + 0.5 + 0.25)
Memory: 1.344 GB (256 + 512 + 512 + 64 MB)
```

### Resource Allocation by Service

| Service    | CPU Limit | CPU Reserved | Memory Limit | Memory Reserved | Priority |
|------------|-----------|--------------|--------------|-----------------|----------|
| PostgreSQL | 2         | 0.5          | 1 GB         | 256 MB          | High     |
| Strapi     | 2         | 0.5          | 1 GB         | 512 MB          | High     |
| Express    | 2         | 0.5          | 1 GB         | 512 MB          | High     |
| Frontend   | 1         | 0.25         | 256 MB       | 64 MB           | Low      |

### Scaling Considerations

**Current Limits (Single Host)**:
- Minimum Server: 2 vCPU, 2 GB RAM
- Recommended: 4 vCPU, 4 GB RAM
- Production: 8 vCPU, 8 GB RAM

**Horizontal Scaling**:
- Frontend: Easily scalable (stateless nginx)
- Express: Scalable with load balancer (session-less)
- Strapi: Requires shared database and upload storage
- PostgreSQL: Single instance (consider managed DB for HA)

---

## Environment Variable Management

### Required Secrets (Must be set in .env)

```bash
# PostgreSQL
POSTGRES_PASSWORD=<strong-password>

# Strapi Security
STRAPI_APP_KEYS=<key1>,<key2>,<key3>,<key4>
STRAPI_API_TOKEN_SALT=<random-salt>
STRAPI_ADMIN_JWT_SECRET=<secret>
STRAPI_TRANSFER_TOKEN_SALT=<salt>
STRAPI_JWT_SECRET=<secret>

# Express Integration
STRAPI_API_TOKEN=<api-token>
ANTHROPIC_API_KEY=<claude-api-key>
```

### Optional Configuration

```bash
# Port Mapping
POSTGRES_PORT=5433
STRAPI_PORT=1337
EXPRESS_PORT=3001
FRONTEND_HTTP_PORT=80
FRONTEND_HTTPS_PORT=443

# Database
POSTGRES_DB=claude_agent_ui
POSTGRES_USER=postgres

# Application
NODE_ENV=production
LOG_LEVEL=info
CORS_ORIGIN=http://localhost:5173
MAX_FILE_SIZE=52428800
```

### Build-Time Variables

```bash
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
VCS_REF=$(git rev-parse --short HEAD)
```

**Purpose**: Docker image metadata for tracking deployments

---

## Security Considerations

### Network Isolation

✅ **Implemented**:
- PostgreSQL only on backend network
- Frontend only on frontend network
- Strapi/Express bridge both networks

❌ **Not Implemented** (Future):
- Network encryption (TLS between services)
- Network policies (firewall rules)

### Secret Management

✅ **Implemented**:
- Required secrets validation (fail-fast)
- Environment variable injection
- No secrets in Dockerfiles

❌ **Not Implemented** (Future):
- Docker secrets (swarm mode)
- External secret managers (Vault, AWS Secrets Manager)
- Secret rotation policies

### Port Exposure

**Production**:
- PostgreSQL: 5433 (should be firewalled externally)
- Strapi: 1337 (internal API only, firewall externally)
- Express: 3001 (internal API only, firewall externally)
- Frontend: 80/443 (publicly accessible)

**Development**:
- All ports exposed for debugging
- Debug ports: 9229 (Strapi), 9230 (Express)
- HMR port: 24678 (Vite)

### File Permissions

**Read-Only Mounts**:
```yaml
./backend/config:/opt/app/config:ro
./database/init:/docker-entrypoint-initdb.d:ro
./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
./nginx/conf.d:/etc/nginx/conf.d:ro
./ssl:/etc/nginx/ssl:ro
```

**Purpose**: Prevent container processes from modifying host files

### Container Security

✅ **Implemented**:
- Resource limits (prevent resource exhaustion)
- Health checks (detect compromised services)
- Restart policies (automatic recovery)

❌ **Not Implemented** (Future):
- Non-root users in containers
- Read-only root filesystems
- AppArmor/SELinux profiles
- Image vulnerability scanning

---

## Logging Strategy

### Centralized Logging Configuration

All services use the same logging configuration:
```yaml
logging:
  driver: json-file
  options:
    max-size: 10m
    max-file: 3
    labels: service=<service-name>
```

**Total Log Storage**: ~120 MB (4 services × 30 MB each)

### Log Locations

#### Container Logs (STDOUT/STDERR)
```bash
# View logs
docker logs claude-postgres
docker logs claude-strapi
docker logs claude-express
docker logs claude-frontend

# Follow logs
docker logs -f claude-strapi

# Tail last 100 lines
docker logs --tail 100 claude-express
```

#### Application Logs (Volume Mounts)
```
./logs/postgres/     - PostgreSQL logs
./logs/strapi/       - Strapi application logs
./logs/express/      - Express application logs
./logs/nginx/        - Nginx access/error logs
```

### Log Rotation

**Container Logs**:
- Managed by Docker
- 3 files × 10 MB = 30 MB per service
- Automatic rotation when max-size reached

**Application Logs**:
- Application-managed (via winston/pino)
- Should implement rotation (e.g., winston-daily-rotate-file)

### Production Logging Best Practices

**Recommended Improvements**:
1. **Centralized Log Aggregation**:
   - ELK Stack (Elasticsearch, Logstash, Kibana)
   - Grafana Loki
   - CloudWatch Logs (AWS)

2. **Log Shipping**:
   - Fluentd/Fluent Bit
   - Vector
   - Logstash

3. **Structured Logging**:
   - Already implemented (LOG_FORMAT=json)
   - Enables easy parsing and querying

---

## Deployment Scenarios

### 1. Development Environment

**Command**:
```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

**Features**:
- Hot module reloading (all services)
- Debug ports exposed
- Source code mounted
- Verbose logging
- Local database data

**Limitations**:
- Not suitable for production
- No SSL/TLS
- Debug ports are security risks
- Performance overhead from file watchers

---

### 2. Production Environment

**Command**:
```bash
docker-compose up -d
```

**Features**:
- Production builds (optimized)
- Resource limits enforced
- Health checks active
- Automatic restarts
- Persistent data volumes

**Recommended Additions**:
- Nginx SSL termination
- Load balancer (Traefik, Nginx)
- Database backups (cron job)
- Monitoring (Prometheus + Grafana)
- Log aggregation
- Firewall rules

---

### 3. CI/CD Pipeline

**Build Stage**:
```bash
# Set build-time variables
export BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
export VCS_REF=$(git rev-parse --short HEAD)

# Build images
docker-compose build

# Tag images
docker tag claude-agent-ui_strapi:latest registry.example.com/claude-strapi:${VCS_REF}
```

**Test Stage**:
```bash
# Start test environment
docker-compose -f docker-compose.yml -f docker-compose.test.yml up -d

# Run integration tests
docker-compose exec express npm test

# Cleanup
docker-compose down -v
```

**Deploy Stage**:
```bash
# Push images
docker-compose push

# Deploy to production (via SSH/k8s/etc)
ssh production-server "docker-compose pull && docker-compose up -d"
```

---

## Backup & Recovery

### Full System Backup

```bash
#!/bin/bash
# backup.sh - Full system backup script

BACKUP_DIR="./backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# 1. Backup PostgreSQL database
docker exec claude-postgres pg_dump -U postgres claude_agent_ui | gzip > "$BACKUP_DIR/postgres.sql.gz"

# 2. Backup Strapi uploads
docker run --rm -v claude-strapi-uploads:/data -v "$BACKUP_DIR":/backup \
  alpine tar czf /backup/strapi-uploads.tar.gz -C /data .

# 3. Backup environment file
cp .env "$BACKUP_DIR/.env.backup"

# 4. Backup docker-compose files
cp docker-compose.yml docker-compose.dev.yml "$BACKUP_DIR/"

# 5. Backup Nginx configs
tar czf "$BACKUP_DIR/nginx-config.tar.gz" nginx/

echo "Backup completed: $BACKUP_DIR"
```

### Restore from Backup

```bash
#!/bin/bash
# restore.sh - Restore from backup

BACKUP_DIR=$1

if [ -z "$BACKUP_DIR" ]; then
  echo "Usage: ./restore.sh <backup-directory>"
  exit 1
fi

# 1. Stop services
docker-compose down

# 2. Restore PostgreSQL
gunzip < "$BACKUP_DIR/postgres.sql.gz" | docker exec -i claude-postgres psql -U postgres claude_agent_ui

# 3. Restore Strapi uploads
docker run --rm -v claude-strapi-uploads:/data -v "$BACKUP_DIR":/backup \
  alpine tar xzf /backup/strapi-uploads.tar.gz -C /data

# 4. Restore environment
cp "$BACKUP_DIR/.env.backup" .env

# 5. Restart services
docker-compose up -d

echo "Restore completed from: $BACKUP_DIR"
```

### Automated Backup Schedule

**Cron Job** (daily at 2 AM):
```cron
0 2 * * * /path/to/backup.sh && find /path/to/backups -mtime +30 -delete
```

**Retention Policy**:
- Daily backups: Keep 30 days
- Weekly backups: Keep 12 weeks
- Monthly backups: Keep 12 months

---

## Monitoring & Health Checks

### Health Check Endpoints

| Service    | Endpoint                        | Expected Response       |
|------------|---------------------------------|-------------------------|
| PostgreSQL | `pg_isready` (internal command) | Connection ready        |
| Strapi     | `http://localhost:1337/_health` | HTTP 200 OK             |
| Express    | `http://localhost:3001/health`  | HTTP 200 OK             |
| Frontend   | `http://localhost:80/health`    | HTTP 200 OK (or 404)    |

### Service Status Monitoring

**Check All Services**:
```bash
docker-compose ps
```

**Expected Output**:
```
NAME              STATUS           PORTS
claude-postgres   Up (healthy)     0.0.0.0:5433->5432/tcp
claude-strapi     Up (healthy)     0.0.0.0:1337->1337/tcp
claude-express    Up (healthy)     0.0.0.0:3001->3001/tcp
claude-frontend   Up (healthy)     0.0.0.0:80->80/tcp
```

### Resource Usage Monitoring

**Real-time Stats**:
```bash
docker stats
```

**Expected Output**:
```
CONTAINER        CPU %    MEM USAGE / LIMIT     NET I/O
claude-postgres  2.50%    256MiB / 1GiB         1MB / 500KB
claude-strapi    5.00%    512MiB / 1GiB         5MB / 2MB
claude-express   3.00%    400MiB / 1GiB         10MB / 8MB
claude-frontend  0.10%    64MiB / 256MiB        100KB / 50KB
```

### Production Monitoring Stack

**Recommended Tools**:

1. **Prometheus** - Metrics collection
2. **Grafana** - Visualization dashboards
3. **cAdvisor** - Container metrics
4. **Node Exporter** - Host metrics
5. **Alertmanager** - Alerting

**Example Metrics to Track**:
- Container health status
- CPU/Memory usage
- Disk I/O
- Network traffic
- Database connections
- API response times
- Error rates
- Log error counts

---

## Troubleshooting Guide

### Common Issues

#### 1. PostgreSQL Not Starting

**Symptom**: `postgres` service exits immediately

**Possible Causes**:
- Missing `POSTGRES_PASSWORD` environment variable
- Corrupted data volume
- Port 5432 already in use

**Solution**:
```bash
# Check environment
docker-compose config | grep POSTGRES_PASSWORD

# Check port
lsof -i :5432

# Reset volume (⚠️ DESTRUCTIVE)
docker-compose down -v
docker volume rm claude-postgres-data
docker-compose up -d postgres
```

---

#### 2. Strapi Migration Errors

**Symptom**: Strapi exits with "Migration failed"

**Possible Causes**:
- Database not initialized
- Schema conflicts
- Missing secrets

**Solution**:
```bash
# Check Strapi logs
docker logs claude-strapi --tail 100

# Reset Strapi (⚠️ DESTRUCTIVE)
docker-compose down
docker volume rm claude-strapi-cache
docker-compose up -d strapi

# Check database connection
docker-compose exec strapi npm run strapi db:query -- "SELECT 1"
```

---

#### 3. Express Can't Connect to Strapi

**Symptom**: Express logs show "ECONNREFUSED" errors

**Possible Causes**:
- Strapi not healthy
- Wrong `STRAPI_URL` configuration
- Network misconfiguration
- Missing `STRAPI_API_TOKEN`

**Solution**:
```bash
# Check Strapi health
docker-compose ps strapi

# Test connectivity from Express container
docker-compose exec express curl http://strapi:1337/_health

# Check environment
docker-compose exec express env | grep STRAPI

# Restart Express
docker-compose restart express
```

---

#### 4. Frontend Shows 502 Bad Gateway

**Symptom**: Nginx returns 502 errors

**Possible Causes**:
- Express/Strapi not healthy
- Nginx misconfiguration
- Proxy timeout

**Solution**:
```bash
# Check backend health
docker-compose ps

# Test Express directly
curl http://localhost:3001/health

# Check Nginx logs
docker logs claude-frontend --tail 50

# Test Nginx config
docker-compose exec frontend nginx -t

# Reload Nginx
docker-compose exec frontend nginx -s reload
```

---

#### 5. Out of Disk Space

**Symptom**: Services crash with disk errors

**Solution**:
```bash
# Check Docker disk usage
docker system df

# Clean up unused resources
docker system prune -a --volumes

# Check volume sizes
docker system df -v

# Remove old logs
rm -rf ./logs/*/*.log.old
```

---

#### 6. Memory Exhaustion

**Symptom**: Services killed by OOM

**Solution**:
```bash
# Check current limits
docker-compose config | grep -A5 resources

# Increase limits (edit docker-compose.yml)
# services.strapi.deploy.resources.limits.memory: 2G

# Apply changes
docker-compose up -d

# Monitor usage
docker stats
```

---

## Performance Optimization

### Database Optimization

**PostgreSQL Configuration** (add to postgres service):
```yaml
command:
  - postgres
  - -c
  - shared_buffers=256MB
  - -c
  - effective_cache_size=1GB
  - -c
  - maintenance_work_mem=64MB
  - -c
  - checkpoint_completion_target=0.9
  - -c
  - wal_buffers=16MB
  - -c
  - default_statistics_target=100
  - -c
  - random_page_cost=1.1
  - -c
  - effective_io_concurrency=200
  - -c
  - work_mem=4MB
  - -c
  - min_wal_size=1GB
  - -c
  - max_wal_size=4GB
```

### Nginx Caching

**Add to nginx.conf**:
```nginx
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=1g inactive=60m;

server {
  location /api/ {
    proxy_cache api_cache;
    proxy_cache_valid 200 5m;
    proxy_cache_use_stale error timeout updating;
    add_header X-Cache-Status $upstream_cache_status;
  }
}
```

### Build Optimization

**Multi-stage Dockerfile Best Practices**:
- Use `.dockerignore` to exclude unnecessary files
- Minimize layers (combine RUN commands)
- Use BuildKit for better caching
- Pin dependencies for reproducible builds

---

## Migration from Development to Production

### Checklist

- [ ] Generate strong secrets for all `_SECRET` variables
- [ ] Configure SSL certificates for HTTPS
- [ ] Set up database backups
- [ ] Configure log aggregation
- [ ] Set up monitoring and alerting
- [ ] Restrict port exposure (firewall rules)
- [ ] Enable rate limiting on APIs
- [ ] Configure CORS for production domains
- [ ] Review resource limits for workload
- [ ] Set up CI/CD pipeline
- [ ] Document runbooks for common issues
- [ ] Test disaster recovery procedures

---

## Key Architectural Decisions

### 1. Two-Network Design
**Decision**: Separate backend and frontend networks
**Rationale**: Security isolation - database not accessible from public network
**Trade-off**: Increased complexity vs improved security

### 2. Named Volumes vs Bind Mounts
**Decision**: Named volumes for persistent data, bind mounts for logs/config
**Rationale**: Volumes are Docker-managed (better performance, easier backups)
**Trade-off**: Harder to locate on filesystem vs easier management

### 3. Health Check Dependencies
**Decision**: Strict startup order with health checks
**Rationale**: Prevents cascading failures during startup
**Trade-off**: Slower startup time vs reliability

### 4. Resource Limits
**Decision**: Conservative limits (2 CPU, 1GB RAM per main service)
**Rationale**: Prevent resource exhaustion, enable multi-tenant hosting
**Trade-off**: May need tuning for high-load scenarios

### 5. Development Overrides
**Decision**: Separate docker-compose.dev.yml file
**Rationale**: DRY principle - override only what's different
**Trade-off**: Must remember `-f` flag vs simpler single-file setup

---

## Summary

### Infrastructure Components

- **Services**: 4 (PostgreSQL, Strapi, Express, Frontend)
- **Networks**: 2 (backend, frontend)
- **Volumes**: 5 (2 critical, 3 ephemeral)
- **Health Checks**: 4 (all services monitored)
- **Resource Limits**: Configured for all services
- **Logging**: Centralized JSON logs with rotation

### Key Features

✅ **Production-Ready**:
- Health checks with dependencies
- Resource limits and reservations
- Automatic restart policies
- Structured logging
- Network isolation

✅ **Developer-Friendly**:
- Hot module reloading
- Debug port exposure
- Source code mounting
- Separate dev configuration

✅ **Operational**:
- Backup/restore scripts
- Health monitoring endpoints
- Comprehensive logging
- Troubleshooting guide

### Recommendations for Future Improvements

1. **High Availability**:
   - PostgreSQL replication (master-slave)
   - Express horizontal scaling with load balancer
   - Strapi horizontal scaling with shared storage

2. **Security Hardening**:
   - Non-root container users
   - Read-only root filesystems
   - Secret management (Docker secrets / Vault)
   - Network encryption (mTLS between services)

3. **Observability**:
   - Prometheus metrics exporter
   - Grafana dashboards
   - Distributed tracing (Jaeger)
   - Error tracking (Sentry)

4. **Automation**:
   - Automated database backups to S3/GCS
   - Automated SSL certificate renewal (Let's Encrypt)
   - Infrastructure as Code (Terraform/Pulumi)
   - GitOps deployment (ArgoCD/Flux)

5. **Performance**:
   - Redis caching layer
   - CDN for static assets
   - Database query optimization
   - Connection pooling (PgBouncer)

---

*Analysis completed: January 2, 2026*
*Configuration files analyzed: docker-compose.yml, docker-compose.dev.yml*
*Services documented: 4*
*Networks documented: 2*
*Volumes documented: 5*
