# Production Deployment with Docker

**Topic:** Best Practices for Production
**Created:** 2025-10-31

---

## Production docker-compose.yml

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: claude-postgres
    environment:
      POSTGRES_DB: ${DATABASE_NAME}
      POSTGRES_USER: ${DATABASE_USERNAME}
      POSTGRES_PASSWORD: ${DATABASE_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - app-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DATABASE_USERNAME}"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 1G

  strapi:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: claude-strapi
    environment:
      DATABASE_CLIENT: postgres
      DATABASE_HOST: postgres
      DATABASE_PORT: 5432
      DATABASE_NAME: ${DATABASE_NAME}
      DATABASE_USERNAME: ${DATABASE_USERNAME}
      DATABASE_PASSWORD: ${DATABASE_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
      ADMIN_JWT_SECRET: ${ADMIN_JWT_SECRET}
      NODE_ENV: production
    ports:
      - "1337:1337"
    volumes:
      - ./backend/public:/opt/app/public
      - ./backend/uploads:/opt/app/public/uploads
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - app-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:1337/_health"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 1G

  express:
    build:
      context: .
      dockerfile: Dockerfile.express
    container_name: claude-express
    environment:
      NODE_ENV: production
      PORT: 3001
      STRAPI_URL: http://strapi:1337
      STRAPI_API_TOKEN: ${STRAPI_API_TOKEN}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    ports:
      - "3001:3001"
    depends_on:
      strapi:
        condition: service_healthy
    networks:
      - app-network
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    container_name: claude-frontend
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - strapi
      - express
    networks:
      - app-network
    restart: unless-stopped

networks:
  app-network:
    driver: bridge

volumes:
  postgres_data:
    driver: local
```

## Security Best Practices

### 1. Don't Run as Root

```dockerfile
FROM node:20-alpine
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs
```

### 2. Use Secrets for Sensitive Data

```yaml
services:
  strapi:
    secrets:
      - db_password
      - jwt_secret

secrets:
  db_password:
    file: ./secrets/db_password.txt
  jwt_secret:
    file: ./secrets/jwt_secret.txt
```

### 3. Limit Container Capabilities

```yaml
services:
  express:
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
```

### 4. Read-Only Root Filesystem

```yaml
services:
  express:
    read_only: true
    tmpfs:
      - /tmp
      - /app/logs
```

## Logging Configuration

```yaml
services:
  strapi:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## Backup Strategy

```bash
# Backup PostgreSQL
docker exec claude-postgres pg_dump \
  -U postgres \
  -d claude_agent_ui \
  > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup volumes
docker run --rm \
  -v postgres_data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/postgres_data_$(date +%Y%m%d).tar.gz /data
```

## Monitoring with Health Checks

```bash
# Check service health
docker-compose ps

# View health status
docker inspect --format='{{.State.Health.Status}}' claude-strapi

# Follow logs
docker-compose logs -f --tail=100
```

## Resource Management

```yaml
services:
  strapi:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 1G
```

## Zero-Downtime Deployment

```bash
# Build new images
docker-compose build

# Start new containers without stopping old ones
docker-compose up -d --no-deps --build strapi

# Health check will ensure smooth transition
```

## Environment Variables Management

```bash
# Use .env file
DATABASE_PASSWORD=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 32)
ADMIN_JWT_SECRET=$(openssl rand -base64 32)

# Or use Docker secrets
echo "my_secure_password" | docker secret create db_password -
```

## Commands

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Scale services
docker-compose up -d --scale express=3

# Update specific service
docker-compose up -d --no-deps --build strapi

# Stop all services
docker-compose down

# Stop and remove volumes (DANGER)
docker-compose down -v

# Restart service
docker-compose restart strapi

# Execute command
docker-compose exec strapi npm run strapi admin:reset-user-password admin@example.com

# View resource usage
docker stats
```

## Production Checklist

- ✅ Use specific image tags (not `latest`)
- ✅ Set restart policies (`unless-stopped`)
- ✅ Configure health checks for all services
- ✅ Set resource limits (CPU, memory)
- ✅ Use named volumes for persistence
- ✅ Configure logging with rotation
- ✅ Don't run containers as root
- ✅ Use secrets for sensitive data
- ✅ Enable automatic backups
- ✅ Set up monitoring
- ✅ Use `.dockerignore`
- ✅ Enable HTTPS/TLS
- ✅ Configure proper networking
- ✅ Test disaster recovery
