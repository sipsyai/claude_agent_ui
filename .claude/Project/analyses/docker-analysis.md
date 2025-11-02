# Docker Deployment Analysis - Claude Agent UI
## Comprehensive Container Orchestration Strategy

**Project:** Claude Agent UI - Strapi & PostgreSQL Migration
**Stack:** PostgreSQL + Strapi + Express + React Frontend
**Date:** 2025-01-31
**Purpose:** Production-ready Docker deployment analysis and implementation guide

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Complete Docker Compose Configuration](#complete-docker-compose-configuration)
4. [Multi-Stage Dockerfiles](#multi-stage-dockerfiles)
5. [Health Checks & Dependencies](#health-checks--dependencies)
6. [Volume Management & Persistence](#volume-management--persistence)
7. [Networking & Port Configuration](#networking--port-configuration)
8. [Environment Configuration](#environment-configuration)
9. [Production Deployment Best Practices](#production-deployment-best-practices)
10. [Security Hardening](#security-hardening)
11. [Performance Optimization](#performance-optimization)
12. [Monitoring & Logging](#monitoring--logging)
13. [Backup & Recovery](#backup--recovery)
14. [CI/CD Integration](#cicd-integration)
15. [Troubleshooting Guide](#troubleshooting-guide)

---

## Executive Summary

### Deployment Goals

This Docker deployment strategy provides:

- ✅ **Complete containerization** of all services (PostgreSQL, Strapi, Express, Frontend)
- ✅ **Production-ready configuration** with health checks, restart policies, and resource limits
- ✅ **Multi-stage builds** for optimized image sizes and security
- ✅ **Persistent data storage** with proper volume management
- ✅ **Service orchestration** with correct dependency management
- ✅ **Security hardening** with non-root users, secrets management, and network isolation
- ✅ **Observability** with logging, monitoring, and health checks
- ✅ **Scalability** with horizontal scaling support and load balancing

### Key Metrics

| Metric | Target | Description |
|--------|--------|-------------|
| Build Time | < 5 min | Multi-stage Docker builds |
| Startup Time | < 30s | All services healthy |
| Image Size | < 500MB | Per service (optimized) |
| Memory Usage | < 2GB | Total stack |
| Availability | 99.9% | With proper health checks |

---

## Architecture Overview

### Container Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Network (bridge)                  │
│                                                              │
│  ┌────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │   PostgreSQL   │  │     Strapi       │  │   Express   │ │
│  │   Port: 5432   │◄─│   Port: 1337     │◄─│ Port: 3001  │ │
│  │   Volume: DB   │  │   Volume: Media  │  │   Stateless │ │
│  └────────────────┘  └──────────────────┘  └─────────────┘ │
│          │                    │                     │        │
│          │                    │                     │        │
│  ┌───────┴────────────────────┴─────────────────────┘       │
│  │                                                            │
│  │              ┌──────────────────┐                        │
│  └──────────────│    Frontend      │                        │
│                 │   (Nginx)        │                        │
│                 │   Port: 80/443   │                        │
│                 │   Volume: Static │                        │
│                 └──────────────────┘                        │
│                          │                                   │
└──────────────────────────┼───────────────────────────────────┘
                           │
                    ┌──────▼───────┐
                    │    Users     │
                    │  (Internet)  │
                    └──────────────┘
```

### Service Dependencies

```mermaid
graph TD
    A[PostgreSQL] -->|Ready| B[Strapi]
    B -->|API Available| C[Express]
    B -->|API Available| D[Frontend]
    C -->|Execution API| D
```

### Volume Strategy

| Service | Volume | Purpose | Backup Priority |
|---------|--------|---------|----------------|
| PostgreSQL | `postgres_data` | Database persistence | **Critical** |
| Strapi | `strapi_uploads` | Media files | High |
| Strapi | `strapi_cache` | Cache data | Low (ephemeral) |
| Nginx | `nginx_cache` | Static file cache | Low (ephemeral) |
| Logs | `logs` | Centralized logging | Medium |

---

## Complete Docker Compose Configuration

### Production Docker Compose (v3.8)

```yaml
version: '3.8'

# ============================================================
# SERVICES DEFINITION
# ============================================================

services:

  # ----------------------------------------------------------
  # PostgreSQL Database
  # ----------------------------------------------------------
  postgres:
    image: postgres:16-alpine
    container_name: claude-postgres
    restart: unless-stopped

    # Environment variables
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-claude_agent_ui}
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}
      POSTGRES_INITDB_ARGS: "--encoding=UTF8 --locale=en_US.UTF-8"
      PGDATA: /var/lib/postgresql/data/pgdata

    # Port mapping (only expose internally in production)
    ports:
      - "${POSTGRES_PORT:-5432}:5432"

    # Volume mounts
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init:/docker-entrypoint-initdb.d:ro
      - ./database/backups:/backups
      - ./logs/postgres:/var/log/postgresql

    # Health check
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-claude_agent_ui}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

    # Resource limits
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 256M

    # Logging
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
        labels: "service=postgres"

    # Networks
    networks:
      - backend

  # ----------------------------------------------------------
  # Strapi CMS (Data Layer)
  # ----------------------------------------------------------
  strapi:
    build:
      context: ./backend
      dockerfile: Dockerfile
      target: production
      args:
        NODE_VERSION: 20
        BUILD_DATE: ${BUILD_DATE}
        VCS_REF: ${VCS_REF}

    container_name: claude-strapi
    restart: unless-stopped

    # Environment variables
    environment:
      # Node environment
      NODE_ENV: ${NODE_ENV:-production}
      HOST: 0.0.0.0
      PORT: 1337

      # Database configuration
      DATABASE_CLIENT: postgres
      DATABASE_HOST: postgres
      DATABASE_PORT: 5432
      DATABASE_NAME: ${POSTGRES_DB:-claude_agent_ui}
      DATABASE_USERNAME: ${POSTGRES_USER:-postgres}
      DATABASE_PASSWORD: ${POSTGRES_PASSWORD}
      DATABASE_SSL: ${DATABASE_SSL:-false}

      # Strapi secrets (MUST be set in .env)
      APP_KEYS: ${STRAPI_APP_KEYS:?STRAPI_APP_KEYS is required}
      API_TOKEN_SALT: ${STRAPI_API_TOKEN_SALT:?STRAPI_API_TOKEN_SALT is required}
      ADMIN_JWT_SECRET: ${STRAPI_ADMIN_JWT_SECRET:?STRAPI_ADMIN_JWT_SECRET is required}
      TRANSFER_TOKEN_SALT: ${STRAPI_TRANSFER_TOKEN_SALT:?STRAPI_TRANSFER_TOKEN_SALT is required}
      JWT_SECRET: ${STRAPI_JWT_SECRET:?STRAPI_JWT_SECRET is required}

      # CORS configuration
      STRAPI_CORS_ORIGIN: ${CORS_ORIGIN:-http://localhost:5173,http://localhost:3001}

      # Admin configuration
      ADMIN_PATH: ${STRAPI_ADMIN_PATH:-/admin}

      # File upload
      MAX_FILE_SIZE: ${MAX_FILE_SIZE:-52428800}

    # Port mapping
    ports:
      - "${STRAPI_PORT:-1337}:1337"

    # Volume mounts
    volumes:
      - strapi_uploads:/opt/app/public/uploads
      - strapi_cache:/opt/app/.cache
      - ./backend/config:/opt/app/config:ro
      - ./logs/strapi:/opt/app/logs

    # Health check
    healthcheck:
      test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:1337/_health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

    # Dependencies
    depends_on:
      postgres:
        condition: service_healthy

    # Resource limits
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M

    # Logging
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
        labels: "service=strapi"

    # Networks
    networks:
      - backend
      - frontend

  # ----------------------------------------------------------
  # Express Backend (Business Logic)
  # ----------------------------------------------------------
  express:
    build:
      context: .
      dockerfile: Dockerfile.express
      target: production
      args:
        NODE_VERSION: 20
        BUILD_DATE: ${BUILD_DATE}
        VCS_REF: ${VCS_REF}

    container_name: claude-express
    restart: unless-stopped

    # Environment variables
    environment:
      # Node environment
      NODE_ENV: ${NODE_ENV:-production}
      HOST: 0.0.0.0
      PORT: 3001

      # Strapi connection
      STRAPI_URL: http://strapi:1337
      STRAPI_API_TOKEN: ${STRAPI_API_TOKEN:?STRAPI_API_TOKEN is required}

      # Anthropic API
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:?ANTHROPIC_API_KEY is required}

      # Logging
      LOG_LEVEL: ${LOG_LEVEL:-info}
      LOG_FORMAT: ${LOG_FORMAT:-json}

      # Performance
      MAX_WORKERS: ${MAX_WORKERS:-4}
      REQUEST_TIMEOUT: ${REQUEST_TIMEOUT:-300000}

      # CORS
      CORS_ORIGIN: ${CORS_ORIGIN:-http://localhost:5173}

    # Port mapping
    ports:
      - "${EXPRESS_PORT:-3001}:3001"

    # Volume mounts
    volumes:
      - ./logs/express:/app/logs
      - express_cache:/app/.cache

    # Health check
    healthcheck:
      test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

    # Dependencies
    depends_on:
      strapi:
        condition: service_healthy

    # Resource limits
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M

    # Logging
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
        labels: "service=express"

    # Networks
    networks:
      - backend
      - frontend

  # ----------------------------------------------------------
  # Frontend (React + Nginx)
  # ----------------------------------------------------------
  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
      target: production
      args:
        NODE_VERSION: 20
        VITE_STRAPI_URL: ${VITE_STRAPI_URL:-http://localhost:1337/api}
        VITE_EXPRESS_URL: ${VITE_EXPRESS_URL:-http://localhost:3001/api}

    container_name: claude-frontend
    restart: unless-stopped

    # Port mapping
    ports:
      - "${FRONTEND_HTTP_PORT:-80}:80"
      - "${FRONTEND_HTTPS_PORT:-443}:443"

    # Volume mounts
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - nginx_cache:/var/cache/nginx
      - ./logs/nginx:/var/log/nginx
      - ./ssl:/etc/nginx/ssl:ro

    # Health check
    healthcheck:
      test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

    # Dependencies
    depends_on:
      strapi:
        condition: service_healthy
      express:
        condition: service_healthy

    # Resource limits
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 256M
        reservations:
          cpus: '0.25'
          memory: 64M

    # Logging
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
        labels: "service=frontend"

    # Networks
    networks:
      - frontend

  # ----------------------------------------------------------
  # Redis Cache (Optional - for session storage)
  # ----------------------------------------------------------
  redis:
    image: redis:7-alpine
    container_name: claude-redis
    restart: unless-stopped

    # Command
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}

    # Port mapping (internal only)
    expose:
      - "6379"

    # Volume mounts
    volumes:
      - redis_data:/data
      - ./logs/redis:/var/log/redis

    # Health check
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

    # Resource limits
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
        reservations:
          cpus: '0.1'
          memory: 64M

    # Logging
    logging:
      driver: "json-file"
      options:
        max-size: "5m"
        max-file: "2"

    # Networks
    networks:
      - backend

# ============================================================
# VOLUMES DEFINITION
# ============================================================

volumes:
  # PostgreSQL data (Critical - Must be backed up)
  postgres_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ${DATA_PATH:-./data}/postgres

  # Strapi uploads (High priority backup)
  strapi_uploads:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ${DATA_PATH:-./data}/strapi/uploads

  # Strapi cache (Ephemeral)
  strapi_cache:
    driver: local

  # Express cache (Ephemeral)
  express_cache:
    driver: local

  # Nginx cache (Ephemeral)
  nginx_cache:
    driver: local

  # Redis data (Optional)
  redis_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ${DATA_PATH:-./data}/redis

# ============================================================
# NETWORKS DEFINITION
# ============================================================

networks:
  # Backend network (PostgreSQL, Strapi, Express, Redis)
  backend:
    driver: bridge
    ipam:
      driver: default
      config:
        - subnet: 172.20.0.0/16
    driver_opts:
      com.docker.network.bridge.name: br-claude-backend

  # Frontend network (Frontend, Strapi, Express)
  frontend:
    driver: bridge
    ipam:
      driver: default
      config:
        - subnet: 172.21.0.0/16
    driver_opts:
      com.docker.network.bridge.name: br-claude-frontend
```

### Development Docker Compose Override

Create `docker-compose.dev.yml` for development:

```yaml
version: '3.8'

services:
  postgres:
    ports:
      - "5432:5432"  # Expose for local development
    volumes:
      - ./database/dev-data:/var/lib/postgresql/data  # Local development data

  strapi:
    build:
      target: development  # Use development stage
    environment:
      NODE_ENV: development
      STRAPI_LOG_LEVEL: debug
    volumes:
      - ./backend:/opt/app:delegated  # Hot reload
      - /opt/app/node_modules  # Prevent overwriting
    ports:
      - "1337:1337"
      - "9229:9229"  # Node.js debugger
    command: npm run develop  # Strapi development mode

  express:
    build:
      target: development
    environment:
      NODE_ENV: development
      LOG_LEVEL: debug
    volumes:
      - ./src:/app/src:delegated
      - /app/node_modules
    ports:
      - "3001:3001"
      - "9230:9230"  # Node.js debugger
    command: npm run dev  # Nodemon for hot reload

  frontend:
    build:
      target: development
    volumes:
      - ./frontend:/app:delegated
      - /app/node_modules
    ports:
      - "5173:5173"  # Vite dev server
      - "24678:24678"  # Vite HMR
    command: npm run dev
    environment:
      VITE_STRAPI_URL: http://localhost:1337/api
      VITE_EXPRESS_URL: http://localhost:3001/api
```

Usage:
```bash
# Development mode
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Production mode
docker-compose up -d
```

---

## Multi-Stage Dockerfiles

### 1. Strapi Dockerfile (backend/Dockerfile)

```dockerfile
# ============================================================
# Base Stage - Common dependencies
# ============================================================
FROM node:20-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc6-compat \
    vips-dev \
    && ln -sf python3 /usr/bin/python

# Set working directory
WORKDIR /opt/app

# Copy package files
COPY package*.json ./

# ============================================================
# Dependencies Stage - Install all dependencies
# ============================================================
FROM base AS dependencies

# Install all dependencies (including devDependencies)
RUN npm ci --legacy-peer-deps

# ============================================================
# Development Stage - For local development
# ============================================================
FROM base AS development

# Copy node_modules from dependencies stage
COPY --from=dependencies /opt/app/node_modules ./node_modules

# Copy application code
COPY . .

# Create strapi user
RUN addgroup -g 1001 -S strapi && \
    adduser -S strapi -u 1001 && \
    chown -R strapi:strapi /opt/app

# Switch to non-root user
USER strapi

# Expose port
EXPOSE 1337

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:1337/_health || exit 1

# Development command
CMD ["npm", "run", "develop"]

# ============================================================
# Build Stage - Build production assets
# ============================================================
FROM base AS builder

# Copy node_modules from dependencies stage
COPY --from=dependencies /opt/app/node_modules ./node_modules

# Copy application code
COPY . .

# Set NODE_ENV to production for build
ENV NODE_ENV=production

# Build Strapi admin panel
RUN npm run build

# ============================================================
# Production Dependencies Stage - Install only production dependencies
# ============================================================
FROM base AS production-dependencies

# Install only production dependencies
RUN npm ci --omit=dev --legacy-peer-deps && \
    npm cache clean --force

# ============================================================
# Production Stage - Final optimized image
# ============================================================
FROM node:20-alpine AS production

# Install runtime dependencies only
RUN apk add --no-cache \
    vips \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /opt/app

# Copy production dependencies
COPY --from=production-dependencies /opt/app/node_modules ./node_modules

# Copy built application
COPY --from=builder /opt/app/dist ./dist
COPY --from=builder /opt/app/build ./build
COPY --from=builder /opt/app/public ./public
COPY --from=builder /opt/app/config ./config
COPY --from=builder /opt/app/database ./database
COPY package*.json ./

# Create directories for uploads and cache
RUN mkdir -p /opt/app/public/uploads /opt/app/.cache

# Create non-root user
RUN addgroup -g 1001 -S strapi && \
    adduser -S strapi -u 1001 && \
    chown -R strapi:strapi /opt/app

# Switch to non-root user
USER strapi

# Set environment
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=1337

# Expose port
EXPOSE 1337

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:1337/_health || exit 1

# Labels for metadata
LABEL maintainer="your-email@example.com" \
      version="1.0.0" \
      description="Strapi CMS for Claude Agent UI"

# Start Strapi
CMD ["npm", "run", "start"]
```

### 2. Express Dockerfile (Dockerfile.express)

```dockerfile
# ============================================================
# Base Stage
# ============================================================
FROM node:20-alpine AS base

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && ln -sf python3 /usr/bin/python

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# ============================================================
# Dependencies Stage
# ============================================================
FROM base AS dependencies

# Install all dependencies
RUN npm ci

# ============================================================
# Development Stage
# ============================================================
FROM base AS development

# Copy node_modules
COPY --from=dependencies /app/node_modules ./node_modules

# Copy source code
COPY src ./src
COPY scripts ./scripts

# Create non-root user
RUN addgroup -g 1001 -S express && \
    adduser -S express -u 1001 && \
    chown -R express:express /app

USER express

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["npm", "run", "dev"]

# ============================================================
# Builder Stage
# ============================================================
FROM base AS builder

# Copy node_modules
COPY --from=dependencies /app/node_modules ./node_modules

# Copy source code
COPY src ./src
COPY scripts ./scripts
COPY tsconfig.json ./

# Build TypeScript
RUN npm run build

# ============================================================
# Production Dependencies Stage
# ============================================================
FROM base AS production-dependencies

# Install only production dependencies
RUN npm ci --omit=dev && \
    npm cache clean --force

# ============================================================
# Production Stage
# ============================================================
FROM node:20-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    dumb-init \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy production dependencies
COPY --from=production-dependencies /app/node_modules ./node_modules

# Copy built application
COPY --from=builder /app/dist ./dist
COPY package*.json ./

# Create directories
RUN mkdir -p /app/logs /app/.cache

# Create non-root user
RUN addgroup -g 1001 -S express && \
    adduser -S express -u 1001 && \
    chown -R express:express /app

USER express

# Set environment
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3001

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Labels
LABEL maintainer="your-email@example.com" \
      version="1.0.0" \
      description="Express Backend for Claude Agent UI"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start Express
CMD ["node", "dist/index.js"]
```

### 3. Frontend Dockerfile (Dockerfile.frontend)

```dockerfile
# ============================================================
# Base Stage
# ============================================================
FROM node:20-alpine AS base

WORKDIR /app

# Copy package files
COPY package*.json ./

# ============================================================
# Dependencies Stage
# ============================================================
FROM base AS dependencies

# Install all dependencies
RUN npm ci

# ============================================================
# Development Stage
# ============================================================
FROM base AS development

# Copy node_modules
COPY --from=dependencies /app/node_modules ./node_modules

# Copy source code
COPY . .

# Expose Vite dev server port
EXPOSE 5173 24678

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5173 || exit 1

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ============================================================
# Builder Stage
# ============================================================
FROM base AS builder

# Build arguments for environment variables
ARG VITE_STRAPI_URL
ARG VITE_EXPRESS_URL

# Set build-time environment variables
ENV VITE_STRAPI_URL=${VITE_STRAPI_URL} \
    VITE_EXPRESS_URL=${VITE_EXPRESS_URL}

# Copy node_modules
COPY --from=dependencies /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build production assets
RUN npm run build

# ============================================================
# Production Stage - Nginx
# ============================================================
FROM nginx:1.25-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    curl \
    && rm -rf /var/cache/apk/*

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf

# Create nginx cache directory
RUN mkdir -p /var/cache/nginx && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /usr/share/nginx/html

# Create health check endpoint
RUN echo '<!DOCTYPE html><html><body>OK</body></html>' > /usr/share/nginx/html/health

# Switch to non-root user
USER nginx

# Expose ports
EXPOSE 80 443

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:80/health || exit 1

# Labels
LABEL maintainer="your-email@example.com" \
      version="1.0.0" \
      description="Frontend for Claude Agent UI"

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

### Nginx Configuration (nginx/nginx.conf)

```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    # Performance
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 50M;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript
               application/json application/javascript application/xml+rss
               application/rss+xml font/truetype font/opentype
               application/vnd.ms-fontobject image/svg+xml;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Include site configurations
    include /etc/nginx/conf.d/*.conf;
}
```

### Nginx Site Configuration (nginx/conf.d/default.conf)

```nginx
# Cache configuration
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=100m inactive=60m use_temp_path=off;

# Rate limiting
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=sse_limit:10m rate=5r/s;

# Upstream definitions
upstream strapi {
    server strapi:1337 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

upstream express {
    server express:3001 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

# HTTP Server
server {
    listen 80;
    server_name _;

    # Root directory
    root /usr/share/nginx/html;
    index index.html;

    # Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "OK\n";
        add_header Content-Type text/plain;
    }

    # Strapi API proxy
    location /api/strapi/ {
        limit_req zone=api_limit burst=20 nodelay;

        rewrite ^/api/strapi/(.*) /$1 break;
        proxy_pass http://strapi;

        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Express API proxy (including SSE)
    location /api/express/ {
        rewrite ^/api/express/(.*) /$1 break;
        proxy_pass http://express;

        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE specific settings
        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;
        proxy_cache off;

        # Extended timeouts for SSE
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;

        # Rate limiting for SSE endpoints
        limit_req zone=sse_limit burst=5 nodelay;
    }

    # Static files with caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # React Router - SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Deny access to hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
}

# HTTPS Server (optional - requires SSL certificates)
# server {
#     listen 443 ssl http2;
#     server_name your-domain.com;
#
#     ssl_certificate /etc/nginx/ssl/cert.pem;
#     ssl_certificate_key /etc/nginx/ssl/key.pem;
#
#     # SSL configuration
#     ssl_protocols TLSv1.2 TLSv1.3;
#     ssl_ciphers HIGH:!aNULL:!MD5;
#     ssl_prefer_server_ciphers on;
#
#     # ... rest of configuration same as HTTP server ...
# }
```

---

## Health Checks & Dependencies

### Health Check Strategy

#### 1. PostgreSQL Health Check

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U postgres -d claude_agent_ui"]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 10s
```

**What it checks:**
- Database is accepting connections
- Specified database exists
- PostgreSQL process is running

#### 2. Strapi Health Check

Create health endpoint in Strapi:

```javascript
// backend/src/api/health/routes/health.js
module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/_health',
      handler: 'health.check',
      config: {
        auth: false,
      },
    },
  ],
};

// backend/src/api/health/controllers/health.js
module.exports = {
  async check(ctx) {
    try {
      // Check database connection
      await strapi.db.connection.raw('SELECT 1');

      ctx.body = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'connected',
      };
    } catch (error) {
      ctx.status = 503;
      ctx.body = {
        status: 'error',
        error: error.message,
      };
    }
  },
};
```

Docker health check:
```yaml
healthcheck:
  test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:1337/_health || exit 1"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 60s
```

#### 3. Express Health Check

```typescript
// src/routes/health.routes.ts
import express from 'express';
import { strapiClient } from '../services/strapi-client';

const router = express.Router();

router.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      strapi: 'unknown',
      anthropic: 'unknown',
    },
  };

  try {
    // Check Strapi connection
    await strapiClient.getAllAgents();
    health.checks.strapi = 'connected';
  } catch (error) {
    health.checks.strapi = 'disconnected';
    health.status = 'degraded';
  }

  // Check Anthropic API key exists
  health.checks.anthropic = process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing';

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

export default router;
```

Docker health check:
```yaml
healthcheck:
  test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 30s
```

#### 4. Frontend (Nginx) Health Check

```yaml
healthcheck:
  test: ["CMD-SHELL", "curl -f http://localhost:80/health || exit 1"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 10s
```

### Dependency Management

#### Depends_on with Conditions

```yaml
services:
  strapi:
    depends_on:
      postgres:
        condition: service_healthy  # Wait for PostgreSQL to be healthy

  express:
    depends_on:
      strapi:
        condition: service_healthy  # Wait for Strapi to be healthy

  frontend:
    depends_on:
      strapi:
        condition: service_healthy
      express:
        condition: service_healthy
```

#### Custom Wait Script (Alternative)

For more complex startup logic:

```bash
#!/bin/sh
# scripts/wait-for-services.sh

set -e

host="$1"
port="$2"
shift 2
cmd="$@"

echo "Waiting for $host:$port..."

until nc -z "$host" "$port"; do
  >&2 echo "$host:$port is unavailable - sleeping"
  sleep 1
done

>&2 echo "$host:$port is up - executing command"
exec $cmd
```

Usage in Dockerfile:
```dockerfile
COPY scripts/wait-for-services.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/wait-for-services.sh

CMD ["wait-for-services.sh", "postgres", "5432", "npm", "run", "start"]
```

---

## Volume Management & Persistence

### Volume Strategy Overview

| Volume Type | Purpose | Backup | Lifecycle |
|-------------|---------|--------|-----------|
| Named Volumes | Production data | **Critical** | Persistent |
| Bind Mounts | Development code | Not needed | Ephemeral |
| tmpfs Mounts | Sensitive data | Not applicable | Ephemeral |

### 1. PostgreSQL Data Volume

```yaml
volumes:
  postgres_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /var/lib/docker/volumes/claude-postgres
```

**Backup Strategy:**

```bash
#!/bin/bash
# scripts/backup-postgres.sh

BACKUP_DIR="/backups/postgres"
CONTAINER_NAME="claude-postgres"
DB_NAME="claude_agent_ui"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Dump database
docker exec -t "$CONTAINER_NAME" pg_dump -U postgres "$DB_NAME" > \
  "$BACKUP_DIR/backup_$TIMESTAMP.sql"

# Compress backup
gzip "$BACKUP_DIR/backup_$TIMESTAMP.sql"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: backup_$TIMESTAMP.sql.gz"
```

**Restore Strategy:**

```bash
#!/bin/bash
# scripts/restore-postgres.sh

BACKUP_FILE=$1
CONTAINER_NAME="claude-postgres"
DB_NAME="claude_agent_ui"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup_file.sql.gz>"
  exit 1
fi

# Decompress if needed
if [[ $BACKUP_FILE == *.gz ]]; then
  gunzip -c "$BACKUP_FILE" | docker exec -i "$CONTAINER_NAME" psql -U postgres "$DB_NAME"
else
  docker exec -i "$CONTAINER_NAME" psql -U postgres "$DB_NAME" < "$BACKUP_FILE"
fi

echo "Restore completed"
```

### 2. Strapi Uploads Volume

```yaml
volumes:
  strapi_uploads:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /var/lib/docker/volumes/claude-strapi/uploads
```

**Backup Strategy:**

```bash
#!/bin/bash
# scripts/backup-strapi-uploads.sh

BACKUP_DIR="/backups/strapi"
VOLUME_PATH="/var/lib/docker/volumes/claude-strapi/uploads"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Tar and compress uploads
tar -czf "$BACKUP_DIR/uploads_$TIMESTAMP.tar.gz" -C "$VOLUME_PATH" .

# Keep only last 30 days
find "$BACKUP_DIR" -name "uploads_*.tar.gz" -mtime +30 -delete

echo "Uploads backup completed: uploads_$TIMESTAMP.tar.gz"
```

### 3. Development Bind Mounts

```yaml
# docker-compose.dev.yml
services:
  strapi:
    volumes:
      - ./backend:/opt/app:delegated  # Hot reload
      - /opt/app/node_modules  # Preserve node_modules
      - /opt/app/.cache  # Preserve cache

  express:
    volumes:
      - ./src:/app/src:delegated
      - /app/node_modules

  frontend:
    volumes:
      - ./frontend:/app:delegated
      - /app/node_modules
```

**Performance Options:**

- `delegated`: Host writes are prioritized (faster for macOS/Windows)
- `cached`: Container writes are prioritized
- `consistent`: Strict consistency (slowest, default)

### 4. Automated Backup with Cron

```bash
#!/bin/bash
# scripts/setup-cron-backup.sh

# Add to crontab
(crontab -l 2>/dev/null; echo "0 2 * * * /path/to/scripts/backup-postgres.sh") | crontab -
(crontab -l 2>/dev/null; echo "0 3 * * * /path/to/scripts/backup-strapi-uploads.sh") | crontab -

echo "Cron jobs added:"
crontab -l
```

### 5. Volume Inspection & Management

```bash
# List all volumes
docker volume ls

# Inspect volume
docker volume inspect postgres_data

# Check volume size
docker system df -v

# Prune unused volumes (DANGEROUS!)
docker volume prune -f

# Backup volume to tar
docker run --rm -v postgres_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/postgres_data_backup.tar.gz -C /data .

# Restore volume from tar
docker run --rm -v postgres_data:/data -v $(pwd):/backup alpine \
  tar xzf /backup/postgres_data_backup.tar.gz -C /data
```

---

## Networking & Port Configuration

### Network Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Host Network                         │
│                                                          │
│  Ports Exposed:                                         │
│  - 80/443 (Frontend)                                    │
│  - 1337 (Strapi - Optional)                            │
│  - 3001 (Express - Optional)                            │
│  - 5432 (PostgreSQL - Dev Only)                        │
└─────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          │                               │
┌─────────▼────────────┐    ┌─────────────▼────────────┐
│  Frontend Network    │    │   Backend Network        │
│  (172.21.0.0/16)    │    │   (172.20.0.0/16)       │
│                      │    │                          │
│  - Frontend (Nginx)  │    │  - PostgreSQL (internal) │
│  - Strapi (API)      │    │  - Strapi (API)         │
│  - Express (API)     │    │  - Express (API)        │
│                      │    │  - Redis (internal)     │
└──────────────────────┘    └─────────────────────────┘
```

### Port Configuration Matrix

| Service | Internal Port | External Port (Dev) | External Port (Prod) | Protocol |
|---------|---------------|---------------------|----------------------|----------|
| PostgreSQL | 5432 | 5432 | - (Internal only) | TCP |
| Strapi | 1337 | 1337 | 1337 (Optional) | HTTP |
| Express | 3001 | 3001 | 3001 (Optional) | HTTP/SSE |
| Frontend | 80 | 80 | 80 | HTTP |
| Frontend | 443 | - | 443 | HTTPS |
| Redis | 6379 | - | - (Internal only) | TCP |

### Network Security Best Practices

#### 1. Production Port Exposure

```yaml
# Production configuration - Minimal port exposure
services:
  postgres:
    # No ports exposed - internal only
    expose:
      - "5432"

  strapi:
    # Only expose if direct access needed
    # Comment out in production if using reverse proxy
    # ports:
    #   - "1337:1337"
    expose:
      - "1337"

  express:
    # Only expose if direct access needed
    # ports:
    #   - "3001:3001"
    expose:
      - "3001"

  frontend:
    # Only service exposed to internet
    ports:
      - "80:80"
      - "443:443"
```

#### 2. Network Isolation

```yaml
networks:
  # Backend network - sensitive services
  backend:
    driver: bridge
    internal: false  # Set to true for complete isolation
    ipam:
      config:
        - subnet: 172.20.0.0/16
    driver_opts:
      com.docker.network.bridge.enable_icc: "true"
      com.docker.network.bridge.enable_ip_masquerade: "true"

  # Frontend network - public-facing
  frontend:
    driver: bridge
    ipam:
      config:
        - subnet: 172.21.0.0/16
```

#### 3. Service-to-Service Communication

Services communicate using **service names** as DNS:

```typescript
// Express connecting to Strapi
const STRAPI_URL = process.env.STRAPI_URL || 'http://strapi:1337';

// Frontend connecting to APIs (through Nginx proxy)
const STRAPI_API = '/api/strapi';  // Proxied by Nginx
const EXPRESS_API = '/api/express';  // Proxied by Nginx
```

#### 4. Firewall Rules (Optional)

```bash
#!/bin/bash
# scripts/setup-firewall.sh

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Deny direct access to backend services from internet
sudo ufw deny 1337/tcp
sudo ufw deny 3001/tcp
sudo ufw deny 5432/tcp

# Enable firewall
sudo ufw enable
```

### Load Balancing (Production)

For high-availability deployments:

```yaml
# docker-compose.prod.yml with multiple Express instances
services:
  express_1:
    <<: *express-service
    container_name: claude-express-1

  express_2:
    <<: *express-service
    container_name: claude-express-2

  express_3:
    <<: *express-service
    container_name: claude-express-3

  # Nginx as load balancer
  frontend:
    volumes:
      - ./nginx/nginx-lb.conf:/etc/nginx/nginx.conf:ro
```

Nginx load balancer configuration:

```nginx
upstream express_backend {
    least_conn;  # Load balancing method

    server express_1:3001 weight=1 max_fails=3 fail_timeout=30s;
    server express_2:3001 weight=1 max_fails=3 fail_timeout=30s;
    server express_3:3001 weight=1 max_fails=3 fail_timeout=30s;

    keepalive 32;
}

location /api/express/ {
    proxy_pass http://express_backend;
    # ... rest of proxy configuration
}
```

---

## Environment Configuration

### Environment File Structure

```
project/
├── .env                      # Main environment file (not committed)
├── .env.example              # Template for environment variables
├── .env.development          # Development overrides
├── .env.production           # Production overrides
└── .env.local                # Local overrides (not committed)
```

### 1. Main Environment File (.env)

```bash
# ============================================================
# MAIN ENVIRONMENT CONFIGURATION
# ============================================================

# Environment
NODE_ENV=production
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
VCS_REF=$(git rev-parse --short HEAD)

# Data paths
DATA_PATH=./data

# ============================================================
# POSTGRESQL CONFIGURATION
# ============================================================

POSTGRES_DB=claude_agent_ui
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password_here_change_me
POSTGRES_PORT=5432

# ============================================================
# STRAPI CONFIGURATION
# ============================================================

STRAPI_PORT=1337
STRAPI_ADMIN_PATH=/admin

# Strapi secrets (GENERATE THESE!)
# Use: openssl rand -base64 32
STRAPI_APP_KEYS=key1,key2,key3,key4
STRAPI_API_TOKEN_SALT=generate_random_salt_here
STRAPI_ADMIN_JWT_SECRET=generate_random_secret_here
STRAPI_TRANSFER_TOKEN_SALT=generate_random_salt_here
STRAPI_JWT_SECRET=generate_random_secret_here

# Strapi API token (for Express to connect)
STRAPI_API_TOKEN=generate_api_token_from_strapi_admin

# Database configuration
DATABASE_SSL=false
MAX_FILE_SIZE=52428800

# ============================================================
# EXPRESS CONFIGURATION
# ============================================================

EXPRESS_PORT=3001
LOG_LEVEL=info
LOG_FORMAT=json
MAX_WORKERS=4
REQUEST_TIMEOUT=300000

# ============================================================
# ANTHROPIC API
# ============================================================

ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ============================================================
# FRONTEND CONFIGURATION
# ============================================================

FRONTEND_HTTP_PORT=80
FRONTEND_HTTPS_PORT=443

VITE_STRAPI_URL=http://localhost:1337/api
VITE_EXPRESS_URL=http://localhost:3001/api

# ============================================================
# REDIS CONFIGURATION (Optional)
# ============================================================

REDIS_PASSWORD=your_redis_password_here

# ============================================================
# CORS CONFIGURATION
# ============================================================

CORS_ORIGIN=http://localhost:5173,http://localhost:80,https://yourdomain.com

# ============================================================
# MONITORING (Optional)
# ============================================================

# Sentry
SENTRY_DSN=
SENTRY_ENVIRONMENT=production

# Datadog
DD_API_KEY=
DD_SITE=datadoghq.com
```

### 2. Environment Template (.env.example)

```bash
# Copy this file to .env and fill in the values

# ============================================================
# POSTGRESQL
# ============================================================
POSTGRES_DB=claude_agent_ui
POSTGRES_USER=postgres
POSTGRES_PASSWORD=CHANGE_ME
POSTGRES_PORT=5432

# ============================================================
# STRAPI
# ============================================================
STRAPI_PORT=1337

# Generate these with: openssl rand -base64 32
STRAPI_APP_KEYS=GENERATE_ME
STRAPI_API_TOKEN_SALT=GENERATE_ME
STRAPI_ADMIN_JWT_SECRET=GENERATE_ME
STRAPI_TRANSFER_TOKEN_SALT=GENERATE_ME
STRAPI_JWT_SECRET=GENERATE_ME
STRAPI_API_TOKEN=GENERATE_ME

# ============================================================
# EXPRESS
# ============================================================
EXPRESS_PORT=3001
ANTHROPIC_API_KEY=sk-ant-CHANGE_ME

# ============================================================
# FRONTEND
# ============================================================
VITE_STRAPI_URL=http://localhost:1337/api
VITE_EXPRESS_URL=http://localhost:3001/api
```

### 3. Secrets Generation Script

```bash
#!/bin/bash
# scripts/generate-secrets.sh

echo "Generating secrets for .env file..."
echo ""

echo "# Strapi Secrets (add these to your .env file)"
echo "STRAPI_APP_KEYS=$(openssl rand -base64 32),$(openssl rand -base64 32),$(openssl rand -base64 32),$(openssl rand -base64 32)"
echo "STRAPI_API_TOKEN_SALT=$(openssl rand -base64 32)"
echo "STRAPI_ADMIN_JWT_SECRET=$(openssl rand -base64 32)"
echo "STRAPI_TRANSFER_TOKEN_SALT=$(openssl rand -base64 32)"
echo "STRAPI_JWT_SECRET=$(openssl rand -base64 32)"
echo ""
echo "# PostgreSQL Password"
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32)"
echo ""
echo "# Redis Password"
echo "REDIS_PASSWORD=$(openssl rand -base64 32)"
echo ""
echo "⚠️  Save these secrets securely!"
```

### 4. Docker Secrets (Production Alternative)

For enhanced security in production:

```yaml
# docker-compose.prod.yml with secrets
version: '3.8'

secrets:
  postgres_password:
    file: ./secrets/postgres_password.txt
  strapi_jwt_secret:
    file: ./secrets/strapi_jwt_secret.txt
  anthropic_api_key:
    file: ./secrets/anthropic_api_key.txt

services:
  postgres:
    secrets:
      - postgres_password
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password

  strapi:
    secrets:
      - postgres_password
      - strapi_jwt_secret
    environment:
      DATABASE_PASSWORD_FILE: /run/secrets/postgres_password
      JWT_SECRET_FILE: /run/secrets/strapi_jwt_secret

  express:
    secrets:
      - anthropic_api_key
    environment:
      ANTHROPIC_API_KEY_FILE: /run/secrets/anthropic_api_key
```

### 5. Environment Validation Script

```typescript
// scripts/validate-env.ts
import { z } from 'zod';

const envSchema = z.object({
  // PostgreSQL
  POSTGRES_DB: z.string().min(1),
  POSTGRES_USER: z.string().min(1),
  POSTGRES_PASSWORD: z.string().min(8),

  // Strapi
  STRAPI_APP_KEYS: z.string().min(1),
  STRAPI_API_TOKEN_SALT: z.string().min(16),
  STRAPI_ADMIN_JWT_SECRET: z.string().min(16),
  STRAPI_JWT_SECRET: z.string().min(16),

  // Anthropic
  ANTHROPIC_API_KEY: z.string().regex(/^sk-ant-/),
});

try {
  envSchema.parse(process.env);
  console.log('✅ Environment variables validated successfully');
} catch (error) {
  console.error('❌ Environment validation failed:');
  console.error(error.errors);
  process.exit(1);
}
```

---

## Production Deployment Best Practices

### 1. Pre-Deployment Checklist

```bash
#!/bin/bash
# scripts/pre-deploy-check.sh

echo "🔍 Running pre-deployment checks..."

# Check Docker version
echo "1. Checking Docker version..."
docker --version || { echo "❌ Docker not installed"; exit 1; }
docker-compose --version || { echo "❌ Docker Compose not installed"; exit 1; }

# Validate environment file
echo "2. Validating environment variables..."
if [ ! -f .env ]; then
    echo "❌ .env file not found"
    exit 1
fi

# Check required secrets
echo "3. Checking secrets..."
source .env
[ -z "$POSTGRES_PASSWORD" ] && echo "❌ POSTGRES_PASSWORD not set" && exit 1
[ -z "$ANTHROPIC_API_KEY" ] && echo "❌ ANTHROPIC_API_KEY not set" && exit 1
[ -z "$STRAPI_JWT_SECRET" ] && echo "❌ STRAPI_JWT_SECRET not set" && exit 1

# Check disk space
echo "4. Checking disk space..."
AVAILABLE=$(df / | awk 'NR==2 {print $4}')
if [ "$AVAILABLE" -lt 10485760 ]; then  # 10GB in KB
    echo "❌ Insufficient disk space (< 10GB available)"
    exit 1
fi

# Validate Docker Compose file
echo "5. Validating docker-compose.yml..."
docker-compose config > /dev/null || { echo "❌ Invalid docker-compose.yml"; exit 1; }

# Check ports availability
echo "6. Checking port availability..."
for port in 80 443 1337 3001 5432; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        echo "⚠️  Port $port is already in use"
    fi
done

echo "✅ All pre-deployment checks passed!"
```

### 2. Deployment Script

```bash
#!/bin/bash
# scripts/deploy.sh

set -e

echo "🚀 Starting deployment..."

# Run pre-deployment checks
./scripts/pre-deploy-check.sh

# Backup existing data
echo "📦 Creating backup..."
./scripts/backup-postgres.sh
./scripts/backup-strapi-uploads.sh

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# Build images
echo "🔨 Building Docker images..."
docker-compose build --no-cache --parallel

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose down

# Start new containers
echo "▶️  Starting new containers..."
docker-compose up -d

# Wait for health checks
echo "🏥 Waiting for services to be healthy..."
timeout 300 bash -c 'until docker-compose ps | grep -q "(healthy)"; do sleep 5; done'

# Run database migrations
echo "🗄️  Running database migrations..."
docker-compose exec -T strapi npm run strapi:migrate

# Verify deployment
echo "✅ Verifying deployment..."
./scripts/verify-deployment.sh

echo "🎉 Deployment completed successfully!"
```

### 3. Blue-Green Deployment

```bash
#!/bin/bash
# scripts/blue-green-deploy.sh

set -e

CURRENT_ENV=$(docker-compose ps --services | grep -c "blue" && echo "blue" || echo "green")
NEW_ENV=$([ "$CURRENT_ENV" = "blue" ] && echo "green" || echo "blue")

echo "Current environment: $CURRENT_ENV"
echo "Deploying to: $NEW_ENV"

# Start new environment
docker-compose -f docker-compose.$NEW_ENV.yml up -d

# Wait for health checks
timeout 300 bash -c "until docker-compose -f docker-compose.$NEW_ENV.yml ps | grep -q \"(healthy)\"; do sleep 5; done"

# Run smoke tests
./scripts/smoke-test.sh $NEW_ENV

# Switch traffic (update nginx upstream)
./scripts/switch-traffic.sh $NEW_ENV

# Monitor for 5 minutes
echo "Monitoring new environment for 5 minutes..."
sleep 300

# Check for errors
ERROR_COUNT=$(docker-compose -f docker-compose.$NEW_ENV.yml logs --tail=100 | grep -c "ERROR" || true)
if [ "$ERROR_COUNT" -gt 10 ]; then
    echo "❌ Too many errors detected, rolling back..."
    ./scripts/switch-traffic.sh $CURRENT_ENV
    docker-compose -f docker-compose.$NEW_ENV.yml down
    exit 1
fi

# Shutdown old environment
echo "✅ Deployment successful, shutting down old environment..."
docker-compose -f docker-compose.$CURRENT_ENV.yml down

echo "🎉 Blue-green deployment completed!"
```

### 4. Zero-Downtime Deployment Strategy

```yaml
# docker-compose.yml with rolling updates
version: '3.8'

services:
  express:
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
        failure_action: rollback
        monitor: 60s
        order: start-first
      rollback_config:
        parallelism: 1
        delay: 5s
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
```

### 5. Monitoring & Alerting

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  # Prometheus for metrics
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    networks:
      - backend

  # Grafana for visualization
  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
    ports:
      - "3000:3000"
    networks:
      - backend

  # Node Exporter
  node-exporter:
    image: prom/node-exporter:latest
    container_name: node-exporter
    ports:
      - "9100:9100"
    networks:
      - backend

volumes:
  prometheus_data:
  grafana_data:
```

### 6. Automated Deployment with CI/CD

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches:
      - main
    tags:
      - 'v*'

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Login to Docker Registry
        uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}

      - name: Build and push images
        run: |
          docker-compose build
          docker-compose push

      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd /opt/claude-agent-ui
            git pull origin main
            docker-compose pull
            docker-compose up -d
            docker-compose exec -T strapi npm run strapi:migrate

      - name: Health check
        run: |
          sleep 30
          curl -f https://yourdomain.com/health || exit 1

      - name: Notify on failure
        if: failure()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## Security Hardening

### 1. Docker Security Best Practices

#### Run as Non-Root User

All Dockerfiles include:

```dockerfile
# Create non-root user
RUN addgroup -g 1001 -S appuser && \
    adduser -S appuser -u 1001 && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser
```

#### Read-Only Root Filesystem

```yaml
services:
  strapi:
    read_only: true
    tmpfs:
      - /tmp
      - /opt/app/.cache
    volumes:
      - strapi_uploads:/opt/app/public/uploads:rw
```

#### Security Options

```yaml
services:
  strapi:
    security_opt:
      - no-new-privileges:true
      - seccomp:unconfined
      - apparmor:docker-default
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
```

### 2. Network Security

```yaml
networks:
  backend:
    driver: bridge
    driver_opts:
      com.docker.network.bridge.enable_icc: "false"  # Disable inter-container communication
      com.docker.network.bridge.enable_ip_masquerade: "true"
    ipam:
      config:
        - subnet: 172.20.0.0/16
          gateway: 172.20.0.1
```

### 3. Secrets Management

```bash
# Initialize Docker Swarm (required for secrets)
docker swarm init

# Create secrets
echo "my_postgres_password" | docker secret create postgres_password -
echo "my_jwt_secret" | docker secret create jwt_secret -

# Use secrets in docker-compose.yml
services:
  postgres:
    secrets:
      - postgres_password
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password
```

### 4. SSL/TLS Configuration

```nginx
# nginx/conf.d/ssl.conf
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL certificates
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
    ssl_prefer_server_ciphers on;

    # SSL session cache
    ssl_session_cache shared:SSL:50m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # OCSP stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/nginx/ssl/chain.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # ... rest of configuration
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

### 5. Environment Variable Protection

```bash
# Set restrictive permissions on .env file
chmod 600 .env

# Add to .gitignore
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
echo ".env.production" >> .gitignore

# Encrypt sensitive files (optional)
# Install git-crypt
git-crypt init
echo ".env filter=git-crypt diff=git-crypt" >> .gitattributes
git-crypt add-gpg-user your-gpg-key-id
```

### 6. Image Scanning

```bash
# Scan images for vulnerabilities
docker scan claude-strapi:latest
docker scan claude-express:latest
docker scan claude-frontend:latest

# Use Trivy for comprehensive scanning
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image claude-strapi:latest
```

### 7. Security Auditing Script

```bash
#!/bin/bash
# scripts/security-audit.sh

echo "🔒 Running security audit..."

# Check for exposed ports
echo "1. Checking exposed ports..."
docker-compose ps --format json | jq -r '.[].Ports' | grep "0.0.0.0:5432" && \
  echo "⚠️  PostgreSQL port exposed to public internet"

# Check for privileged containers
echo "2. Checking for privileged containers..."
docker-compose config | grep "privileged: true" && \
  echo "⚠️  Privileged containers found"

# Check for containers running as root
echo "3. Checking for root users..."
for container in $(docker-compose ps -q); do
  USER=$(docker inspect --format='{{.Config.User}}' $container)
  if [ -z "$USER" ] || [ "$USER" = "root" ]; then
    NAME=$(docker inspect --format='{{.Name}}' $container)
    echo "⚠️  Container $NAME running as root"
  fi
done

# Check SSL certificate expiry
echo "4. Checking SSL certificate expiry..."
if [ -f ./ssl/fullchain.pem ]; then
  EXPIRY=$(openssl x509 -enddate -noout -in ./ssl/fullchain.pem | cut -d= -f2)
  echo "SSL certificate expires: $EXPIRY"
fi

# Check for weak passwords
echo "5. Checking for weak passwords in .env..."
if grep -q "POSTGRES_PASSWORD=password" .env; then
  echo "❌ Weak PostgreSQL password detected"
fi

echo "✅ Security audit completed"
```

---

## Performance Optimization

### 1. Resource Limits & Reservations

```yaml
services:
  postgres:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
          pids: 100
        reservations:
          cpus: '0.5'
          memory: 256M
    # Additional PostgreSQL tuning
    environment:
      POSTGRES_SHARED_BUFFERS: 256MB
      POSTGRES_EFFECTIVE_CACHE_SIZE: 1GB
      POSTGRES_MAINTENANCE_WORK_MEM: 64MB
      POSTGRES_CHECKPOINT_COMPLETION_TARGET: 0.9
      POSTGRES_WAL_BUFFERS: 16MB
      POSTGRES_DEFAULT_STATISTICS_TARGET: 100
      POSTGRES_RANDOM_PAGE_COST: 1.1
      POSTGRES_EFFECTIVE_IO_CONCURRENCY: 200
      POSTGRES_WORK_MEM: 4MB
      POSTGRES_MIN_WAL_SIZE: 1GB
      POSTGRES_MAX_WAL_SIZE: 4GB
```

### 2. Caching Strategy

#### Nginx Caching

```nginx
# nginx/conf.d/cache.conf
# Proxy cache configuration
proxy_cache_path /var/cache/nginx/api
    levels=1:2
    keys_zone=api_cache:10m
    max_size=100m
    inactive=60m
    use_temp_path=off;

# Static file caching
location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    access_log off;
}

# API response caching
location /api/strapi/agents {
    proxy_cache api_cache;
    proxy_cache_valid 200 5m;
    proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
    proxy_cache_background_update on;
    proxy_cache_lock on;
    add_header X-Cache-Status $upstream_cache_status;

    proxy_pass http://strapi;
}
```

#### Redis Caching (Optional)

```typescript
// src/services/redis-cache.service.ts
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

export class CacheService {
  async get<T>(key: string): Promise<T | null> {
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async set(key: string, value: any, ttl: number = 300): Promise<void> {
    await redis.setex(key, ttl, JSON.stringify(value));
  }

  async del(key: string): Promise<void> {
    await redis.del(key);
  }

  async flush(): Promise<void> {
    await redis.flushdb();
  }
}

export const cacheService = new CacheService();
```

### 3. Connection Pooling

#### PostgreSQL Connection Pool

```typescript
// backend/config/database.ts
export default ({ env }) => ({
  connection: {
    client: 'postgres',
    connection: {
      host: env('DATABASE_HOST', 'postgres'),
      port: env.int('DATABASE_PORT', 5432),
      database: env('DATABASE_NAME', 'claude_agent_ui'),
      user: env('DATABASE_USERNAME', 'postgres'),
      password: env('DATABASE_PASSWORD'),
      ssl: env.bool('DATABASE_SSL', false),
      // Connection pool configuration
      pool: {
        min: env.int('DATABASE_POOL_MIN', 2),
        max: env.int('DATABASE_POOL_MAX', 10),
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
      },
    },
    debug: env.bool('DATABASE_DEBUG', false),
  },
});
```

### 4. Docker Build Optimization

```dockerfile
# Use BuildKit for faster builds
# docker build --build-arg BUILDKIT_INLINE_CACHE=1

# Enable BuildKit caching
ENV DOCKER_BUILDKIT=1

# Layer caching optimization
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

# Multi-stage build with caching
FROM base AS builder
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=cache,target=/app/.cache \
    npm run build
```

### 5. Image Size Optimization

```bash
#!/bin/bash
# scripts/optimize-images.sh

echo "📦 Optimizing Docker images..."

# Build with compression
docker-compose build --compress

# Remove dangling images
docker image prune -f

# Analyze image layers
docker history claude-strapi:latest --human --format "table {{.CreatedBy}}\t{{.Size}}"
docker history claude-express:latest --human --format "table {{.CreatedBy}}\t{{.Size}}"
docker history claude-frontend:latest --human --format "table {{.CreatedBy}}\t{{.Size}}"

# Use dive for detailed analysis
docker run --rm -it \
  -v /var/run/docker.sock:/var/run/docker.sock \
  wagoodman/dive:latest claude-strapi:latest

echo "✅ Image optimization analysis complete"
```

### 6. Performance Monitoring

```typescript
// src/middleware/performance.middleware.ts
import { Request, Response, NextFunction } from 'express';

export function performanceMonitor(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;

    // Log slow requests
    if (duration > 1000) {
      console.warn(`Slow request: ${req.method} ${req.path} took ${duration}ms`);
    }

    // Expose metrics
    res.setHeader('X-Response-Time', `${duration}ms`);
  });

  next();
}
```

---

## Monitoring & Logging

### 1. Centralized Logging with ELK Stack

```yaml
# docker-compose.logging.yml
version: '3.8'

services:
  # Elasticsearch
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    container_name: elasticsearch
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
      - xpack.security.enabled=false
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    ports:
      - "9200:9200"
    networks:
      - logging

  # Logstash
  logstash:
    image: docker.elastic.co/logstash/logstash:8.11.0
    container_name: logstash
    volumes:
      - ./logging/logstash/pipeline:/usr/share/logstash/pipeline
      - ./logs:/logs:ro
    ports:
      - "5000:5000/tcp"
      - "5000:5000/udp"
      - "9600:9600"
    environment:
      LS_JAVA_OPTS: "-Xmx256m -Xms256m"
    networks:
      - logging
    depends_on:
      - elasticsearch

  # Kibana
  kibana:
    image: docker.elastic.co/kibana/kibana:8.11.0
    container_name: kibana
    ports:
      - "5601:5601"
    environment:
      ELASTICSEARCH_HOSTS: http://elasticsearch:9200
    networks:
      - logging
    depends_on:
      - elasticsearch

volumes:
  elasticsearch_data:

networks:
  logging:
    driver: bridge
```

### 2. Logstash Pipeline Configuration

```ruby
# logging/logstash/pipeline/logstash.conf
input {
  file {
    path => "/logs/express/*.log"
    type => "express"
    codec => json
  }

  file {
    path => "/logs/strapi/*.log"
    type => "strapi"
    codec => json
  }

  file {
    path => "/logs/nginx/access.log"
    type => "nginx_access"
    codec => plain
  }

  file {
    path => "/logs/postgres/*.log"
    type => "postgres"
    codec => plain
  }
}

filter {
  if [type] == "nginx_access" {
    grok {
      match => { "message" => "%{COMBINEDAPACHELOG}" }
    }
    date {
      match => [ "timestamp" , "dd/MMM/yyyy:HH:mm:ss Z" ]
    }
  }

  if [type] == "express" or [type] == "strapi" {
    json {
      source => "message"
    }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "claude-agent-ui-%{type}-%{+YYYY.MM.dd}"
  }

  stdout {
    codec => rubydebug
  }
}
```

### 3. Application Logging Configuration

```typescript
// src/utils/logger.ts
import winston from 'winston';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'express-api' },
  transports: [
    // Console logging
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),

    // File logging
    new winston.transports.File({
      filename: '/app/logs/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: '/app/logs/combined.log',
      maxsize: 10485760,
      maxFiles: 10,
    }),
  ],
});

// Stream for Morgan HTTP logging
export const httpLogStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};
```

### 4. Health Check Endpoints

```typescript
// src/routes/monitoring.routes.ts
import express from 'express';
import os from 'os';

const router = express.Router();

// Basic health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// Detailed health check
router.get('/health/detailed', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    system: {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      loadAverage: os.loadavg(),
    },
    process: {
      pid: process.pid,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
    },
    checks: {
      database: 'unknown',
      strapi: 'unknown',
      redis: 'unknown',
    },
  };

  // Check database connection
  try {
    await strapiClient.getAllAgents();
    health.checks.strapi = 'connected';
  } catch (error) {
    health.checks.strapi = 'disconnected';
    health.status = 'degraded';
  }

  res.json(health);
});

// Readiness probe
router.get('/ready', async (req, res) => {
  try {
    await strapiClient.getAllAgents();
    res.status(200).send('Ready');
  } catch (error) {
    res.status(503).send('Not ready');
  }
});

// Liveness probe
router.get('/live', (req, res) => {
  res.status(200).send('Alive');
});

// Metrics endpoint (Prometheus format)
router.get('/metrics', (req, res) => {
  const metrics = `
# HELP nodejs_memory_usage_bytes Memory usage in bytes
# TYPE nodejs_memory_usage_bytes gauge
nodejs_memory_usage_rss ${process.memoryUsage().rss}
nodejs_memory_usage_heap_total ${process.memoryUsage().heapTotal}
nodejs_memory_usage_heap_used ${process.memoryUsage().heapUsed}

# HELP nodejs_uptime_seconds Process uptime in seconds
# TYPE nodejs_uptime_seconds gauge
nodejs_uptime_seconds ${process.uptime()}

# HELP nodejs_cpu_usage CPU usage
# TYPE nodejs_cpu_usage gauge
nodejs_cpu_user ${process.cpuUsage().user}
nodejs_cpu_system ${process.cpuUsage().system}
  `.trim();

  res.set('Content-Type', 'text/plain');
  res.send(metrics);
});

export default router;
```

### 5. Prometheus Configuration

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  # Express metrics
  - job_name: 'express'
    static_configs:
      - targets: ['express:3001']
    metrics_path: '/metrics'

  # Node exporter
  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']

  # PostgreSQL exporter
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  # Nginx metrics
  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx-exporter:9113']
```

### 6. Grafana Dashboards

```json
{
  "dashboard": {
    "title": "Claude Agent UI - Overview",
    "panels": [
      {
        "title": "HTTP Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])"
          }
        ]
      },
      {
        "title": "Response Time (p95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m])"
          }
        ]
      },
      {
        "title": "Memory Usage",
        "targets": [
          {
            "expr": "nodejs_memory_usage_heap_used"
          }
        ]
      }
    ]
  }
}
```

---

## Backup & Recovery

### 1. Automated Backup Solution

```bash
#!/bin/bash
# scripts/automated-backup.sh

set -e

BACKUP_ROOT="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

echo "🔄 Starting automated backup at $TIMESTAMP..."

# Create backup directories
mkdir -p "$BACKUP_ROOT/postgres"
mkdir -p "$BACKUP_ROOT/strapi"
mkdir -p "$BACKUP_ROOT/configs"

# 1. PostgreSQL Database Backup
echo "1. Backing up PostgreSQL..."
docker exec claude-postgres pg_dumpall -U postgres | \
  gzip > "$BACKUP_ROOT/postgres/full_backup_$TIMESTAMP.sql.gz"

# 2. Strapi Uploads Backup
echo "2. Backing up Strapi uploads..."
tar -czf "$BACKUP_ROOT/strapi/uploads_$TIMESTAMP.tar.gz" \
  -C /var/lib/docker/volumes/claude-strapi/uploads .

# 3. Configuration Backup
echo "3. Backing up configurations..."
tar -czf "$BACKUP_ROOT/configs/config_$TIMESTAMP.tar.gz" \
  .env \
  docker-compose.yml \
  nginx/nginx.conf \
  nginx/conf.d/

# 4. Docker Volumes Backup
echo "4. Backing up Docker volumes..."
docker run --rm \
  -v postgres_data:/data \
  -v "$BACKUP_ROOT/volumes:/backup" \
  alpine tar czf "/backup/postgres_volume_$TIMESTAMP.tar.gz" -C /data .

# 5. Upload to S3 (optional)
if [ -n "$AWS_S3_BUCKET" ]; then
  echo "5. Uploading to S3..."
  aws s3 sync "$BACKUP_ROOT" "s3://$AWS_S3_BUCKET/backups/$(date +%Y/%m/%d)/"
fi

# 6. Cleanup old backups
echo "6. Cleaning up old backups..."
find "$BACKUP_ROOT" -type f -name "*.gz" -mtime +$RETENTION_DAYS -delete

# 7. Verify backups
echo "7. Verifying backups..."
if [ -f "$BACKUP_ROOT/postgres/full_backup_$TIMESTAMP.sql.gz" ]; then
  SIZE=$(stat -f%z "$BACKUP_ROOT/postgres/full_backup_$TIMESTAMP.sql.gz" 2>/dev/null || stat -c%s "$BACKUP_ROOT/postgres/full_backup_$TIMESTAMP.sql.gz")
  if [ "$SIZE" -lt 1024 ]; then
    echo "❌ Backup file is too small, may be corrupted!"
    exit 1
  fi
fi

echo "✅ Backup completed successfully at $TIMESTAMP"

# Send notification
./scripts/notify.sh "✅ Backup completed: $TIMESTAMP"
```

### 2. Point-in-Time Recovery (PITR)

```bash
#!/bin/bash
# scripts/pitr-setup.sh

# Enable PostgreSQL WAL archiving for PITR
cat > ./database/postgresql.conf <<EOF
# WAL configuration for PITR
wal_level = replica
archive_mode = on
archive_command = 'test ! -f /backups/wal_archive/%f && cp %p /backups/wal_archive/%f'
max_wal_senders = 3
wal_keep_size = 1GB
EOF

# Create WAL archive directory
mkdir -p /backups/wal_archive

# Restart PostgreSQL with new configuration
docker-compose restart postgres

echo "✅ PITR setup complete"
```

### 3. Disaster Recovery Plan

```bash
#!/bin/bash
# scripts/disaster-recovery.sh

set -e

BACKUP_FILE=$1
RECOVERY_TIME=$2

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup_file> [recovery_time]"
  echo "Example: $0 /backups/postgres/full_backup_20250131_120000.sql.gz"
  echo "         $0 /backups/postgres/full_backup_20250131_120000.sql.gz '2025-01-31 12:30:00'"
  exit 1
fi

echo "🚨 Starting disaster recovery..."
echo "Backup file: $BACKUP_FILE"
[ -n "$RECOVERY_TIME" ] && echo "Recovery time: $RECOVERY_TIME"

# 1. Stop all services
echo "1. Stopping all services..."
docker-compose down

# 2. Backup current state (just in case)
echo "2. Backing up current state..."
EMERGENCY_BACKUP="/backups/emergency_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$EMERGENCY_BACKUP"
docker run --rm -v postgres_data:/data -v "$EMERGENCY_BACKUP:/backup" alpine \
  tar czf /backup/postgres_emergency.tar.gz -C /data .

# 3. Remove current database volume
echo "3. Removing current database volume..."
docker volume rm postgres_data || true

# 4. Recreate volume
echo "4. Recreating volume..."
docker volume create postgres_data

# 5. Start PostgreSQL
echo "5. Starting PostgreSQL..."
docker-compose up -d postgres

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
sleep 10

# 6. Restore database
echo "6. Restoring database..."
if [[ $BACKUP_FILE == *.gz ]]; then
  gunzip -c "$BACKUP_FILE" | docker exec -i claude-postgres psql -U postgres
else
  docker exec -i claude-postgres psql -U postgres < "$BACKUP_FILE"
fi

# 7. Point-in-time recovery (if specified)
if [ -n "$RECOVERY_TIME" ]; then
  echo "7. Performing point-in-time recovery to $RECOVERY_TIME..."
  cat > /tmp/recovery.conf <<EOF
restore_command = 'cp /backups/wal_archive/%f %p'
recovery_target_time = '$RECOVERY_TIME'
recovery_target_action = 'promote'
EOF
  docker cp /tmp/recovery.conf claude-postgres:/var/lib/postgresql/data/
  docker-compose restart postgres
  rm /tmp/recovery.conf
fi

# 8. Restore Strapi uploads
echo "8. Restoring Strapi uploads..."
UPLOADS_BACKUP="${BACKUP_FILE%_*}_uploads.tar.gz"
if [ -f "$UPLOADS_BACKUP" ]; then
  docker volume rm strapi_uploads || true
  docker volume create strapi_uploads
  docker run --rm -v strapi_uploads:/data -v "$(dirname $UPLOADS_BACKUP):/backup" alpine \
    tar xzf "/backup/$(basename $UPLOADS_BACKUP)" -C /data
else
  echo "⚠️  Uploads backup not found: $UPLOADS_BACKUP"
fi

# 9. Start all services
echo "9. Starting all services..."
docker-compose up -d

# Wait for services to be healthy
echo "Waiting for services to be healthy..."
timeout 300 bash -c 'until docker-compose ps | grep -q "(healthy)"; do sleep 5; done'

# 10. Run integrity checks
echo "10. Running integrity checks..."
docker exec claude-postgres psql -U postgres claude_agent_ui -c "SELECT COUNT(*) FROM agents;"
docker exec claude-postgres psql -U postgres claude_agent_ui -c "SELECT COUNT(*) FROM skills;"

# 11. Verify application functionality
echo "11. Verifying application functionality..."
curl -f http://localhost:3001/health || echo "⚠️  Express health check failed"
curl -f http://localhost:1337/_health || echo "⚠️  Strapi health check failed"

echo "✅ Disaster recovery completed!"
echo ""
echo "Emergency backup saved to: $EMERGENCY_BACKUP"
echo "Please verify the system functionality manually."
```

### 4. Continuous Backup with WAL Shipping

```yaml
# docker-compose.backup.yml
version: '3.8'

services:
  # WAL-G for continuous backup
  wal-g:
    image: wal-g/wal-g:latest
    container_name: wal-g
    environment:
      AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
      AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
      AWS_REGION: ${AWS_REGION}
      WALG_S3_PREFIX: s3://your-bucket/postgres-backups
      PGHOST: postgres
      PGPORT: 5432
      PGUSER: postgres
      PGPASSWORD: ${POSTGRES_PASSWORD}
      PGDATABASE: claude_agent_ui
    volumes:
      - postgres_data:/var/lib/postgresql/data:ro
    networks:
      - backend
    command: wal-push
```

---

## CI/CD Integration

### Complete GitHub Actions Workflow

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
    tags: ['v*']
  pull_request:
    branches: [main, develop]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  # ============================================================
  # Testing Job
  # ============================================================
  test:
    name: Run Tests
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_PASSWORD: test_password
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linting
        run: npm run lint

      - name: Run unit tests
        run: npm run test:unit

      - name: Run integration tests
        env:
          DATABASE_URL: postgresql://postgres:test_password@localhost:5432/test_db
        run: npm run test:integration

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

  # ============================================================
  # Build Job
  # ============================================================
  build:
    name: Build Docker Images
    runs-on: ubuntu-latest
    needs: test
    if: github.event_name != 'pull_request'

    permissions:
      contents: read
      packages: write

    strategy:
      matrix:
        service: [strapi, express, frontend]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-${{ matrix.service }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha,prefix={{branch}}-

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          file: Dockerfile.${{ matrix.service }}
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            BUILD_DATE=${{ github.event.head_commit.timestamp }}
            VCS_REF=${{ github.sha }}

  # ============================================================
  # Security Scan Job
  # ============================================================
  security:
    name: Security Scan
    runs-on: ubuntu-latest
    needs: build

    strategy:
      matrix:
        service: [strapi, express, frontend]

    steps:
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-${{ matrix.service }}:${{ github.sha }}
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy results to GitHub Security
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'

  # ============================================================
  # Deploy to Staging
  # ============================================================
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: [build, security]
    if: github.ref == 'refs/heads/develop'
    environment:
      name: staging
      url: https://staging.yourdomain.com

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup SSH
        uses: webfactory/ssh-agent@v0.8.0
        with:
          ssh-private-key: ${{ secrets.STAGING_SSH_KEY }}

      - name: Deploy to staging server
        run: |
          ssh -o StrictHostKeyChecking=no ${{ secrets.STAGING_USER }}@${{ secrets.STAGING_HOST }} << 'EOF'
            cd /opt/claude-agent-ui
            git pull origin develop
            docker-compose pull
            docker-compose up -d
            docker-compose exec -T strapi npm run strapi:migrate
          EOF

      - name: Health check
        run: |
          sleep 30
          curl -f https://staging.yourdomain.com/health || exit 1

      - name: Notify Slack
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Staging deployment completed'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
        if: always()

  # ============================================================
  # Deploy to Production
  # ============================================================
  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: [build, security]
    if: startsWith(github.ref, 'refs/tags/v')
    environment:
      name: production
      url: https://yourdomain.com

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup SSH
        uses: webfactory/ssh-agent@v0.8.0
        with:
          ssh-private-key: ${{ secrets.PRODUCTION_SSH_KEY }}

      - name: Create backup
        run: |
          ssh ${{ secrets.PRODUCTION_USER }}@${{ secrets.PRODUCTION_HOST }} \
            'cd /opt/claude-agent-ui && ./scripts/backup-postgres.sh'

      - name: Deploy to production server
        run: |
          ssh ${{ secrets.PRODUCTION_USER }}@${{ secrets.PRODUCTION_HOST }} << 'EOF'
            cd /opt/claude-agent-ui
            git fetch --tags
            git checkout ${{ github.ref_name }}
            docker-compose pull
            docker-compose up -d --no-deps --build
            docker-compose exec -T strapi npm run strapi:migrate
          EOF

      - name: Health check
        run: |
          sleep 30
          curl -f https://yourdomain.com/health || exit 1

      - name: Smoke tests
        run: |
          curl -f https://yourdomain.com/api/express/health
          curl -f https://yourdomain.com/api/strapi/agents

      - name: Create GitHub Release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ github.ref_name }}
          release_name: Release ${{ github.ref_name }}
          draft: false
          prerelease: false

      - name: Notify Slack
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Production deployment completed: ${{ github.ref_name }}'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
        if: always()
```

---

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. PostgreSQL Connection Issues

**Symptom:** Strapi cannot connect to PostgreSQL

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check PostgreSQL logs
docker-compose logs postgres

# Test connection manually
docker exec -it claude-postgres psql -U postgres -d claude_agent_ui

# Verify environment variables
docker exec claude-strapi env | grep DATABASE

# Solution: Wait for PostgreSQL to be healthy
docker-compose up -d postgres
docker-compose exec postgres pg_isready -U postgres
```

#### 2. Port Already in Use

**Symptom:** Error: "bind: address already in use"

```bash
# Find process using port
lsof -i :3001
netstat -tulpn | grep :3001

# Kill process
kill -9 <PID>

# Or change port in .env
echo "EXPRESS_PORT=3002" >> .env
```

#### 3. Volume Permission Issues

**Symptom:** Permission denied errors

```bash
# Fix volume permissions
docker-compose down
sudo chown -R 1001:1001 ./data/strapi
sudo chown -R 999:999 ./data/postgres

# Or recreate volumes
docker volume rm postgres_data strapi_uploads
docker-compose up -d
```

#### 4. Out of Memory

**Symptom:** Containers being killed (OOMKilled)

```bash
# Check memory usage
docker stats

# Increase memory limits in docker-compose.yml
services:
  strapi:
    deploy:
      resources:
        limits:
          memory: 2G

# Or increase Docker Desktop memory allocation
```

#### 5. Build Failures

**Symptom:** Docker build fails

```bash
# Clear build cache
docker builder prune -af

# Rebuild without cache
docker-compose build --no-cache

# Check Dockerfile syntax
docker-compose config
```

### Diagnostic Commands

```bash
#!/bin/bash
# scripts/diagnose.sh

echo "🔍 Running diagnostics..."

echo "1. Docker version:"
docker --version
docker-compose --version

echo "2. Container status:"
docker-compose ps

echo "3. Container health:"
docker-compose ps --format json | jq -r '.[].Health'

echo "4. Resource usage:"
docker stats --no-stream

echo "5. Network info:"
docker network ls
docker network inspect claude-backend

echo "6. Volume info:"
docker volume ls
docker volume inspect postgres_data

echo "7. Recent logs:"
docker-compose logs --tail=50

echo "8. Environment variables:"
docker-compose config

echo "9. Port mappings:"
docker-compose ps --format "table {{.Name}}\t{{.Ports}}"

echo "✅ Diagnostics complete"
```

---

## Conclusion

This comprehensive Docker deployment analysis provides:

✅ **Complete containerization** with production-ready Docker Compose configuration
✅ **Multi-stage Dockerfiles** for optimized build times and image sizes
✅ **Health checks** for all services with proper dependency management
✅ **Volume management** with backup and recovery strategies
✅ **Network isolation** with proper security configurations
✅ **Environment management** with secrets and configuration templates
✅ **Production best practices** including monitoring, logging, and CI/CD
✅ **Security hardening** with non-root users and SSL/TLS
✅ **Performance optimization** with caching and resource limits
✅ **Disaster recovery** with automated backups and PITR

### Quick Start Commands

```bash
# Development mode
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Production mode
docker-compose up -d

# With monitoring
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d

# Full stack (production + monitoring + logging)
docker-compose \
  -f docker-compose.yml \
  -f docker-compose.monitoring.yml \
  -f docker-compose.logging.yml \
  up -d
```

---

**Author:** Claude Agent
**Version:** 1.0
**Last Updated:** 2025-01-31
**License:** MIT
