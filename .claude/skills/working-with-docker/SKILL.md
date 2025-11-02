---
name: working-with-docker
description: Comprehensive Docker and Docker Compose documentation covering Dockerfile best practices, multi-stage builds, Docker Compose orchestration, networking, volumes, health checks, and production deployment. Use when containerizing applications, creating Dockerfiles, setting up multi-container environments with PostgreSQL/Strapi/Express, or deploying to production with Docker.
---

# Docker & Docker Compose Expert

Docker reference for containerization and orchestration of Claude Agent UI.

## What This Skill Covers

- **Dockerfile**: Best practices, multi-stage builds, optimization
- **Docker Compose**: Multi-container orchestration
- **Networking**: Container communication
- **Volumes**: Data persistence
- **Health Checks**: Service readiness
- **Production**: Deployment, security, monitoring

## Quick Reference

### Common Tasks

**Dockerfile Best Practices**
→ See [docs/01-dockerfile-basics.md](docs/01-dockerfile-basics.md)

**Docker Compose Setup**
→ See [docs/02-docker-compose.md](docs/02-docker-compose.md)

**Production Deployment**
→ See [docs/03-production-deployment.md](docs/03-production-deployment.md)

---

## For Migration Project

### Full Stack Deployment

From [docs/02-docker-compose.md](docs/02-docker-compose.md):

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: claude_agent_ui
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DATABASE_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready"]
      interval: 10s

  strapi:
    build: ./backend
    ports:
      - "1337:1337"
    depends_on:
      postgres:
        condition: service_healthy

  express:
    build: .
    ports:
      - "3001:3001"
    environment:
      STRAPI_URL: http://strapi:1337
    depends_on:
      - strapi

volumes:
  postgres_data:
```

### Dockerfile Example (Strapi)

```dockerfile
FROM node:20-alpine AS build
WORKDIR /opt/app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /opt/app
COPY --from=build /opt/app/node_modules ./node_modules
COPY --from=build /opt/app/dist ./dist
COPY --from=build /opt/app/public ./public
COPY --from=build /opt/app/package.json ./
ENV NODE_ENV=production
EXPOSE 1337
CMD ["npm", "run", "start"]
```

---

## Key Concepts

### Health Checks

Ensure services start in correct order:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:1337/_health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

### Dependencies

```yaml
depends_on:
  postgres:
    condition: service_healthy  # Wait for health check
```

### Volumes

```yaml
volumes:
  postgres_data:              # Named volume (persistent)
  - ./uploads:/app/uploads    # Bind mount (development)
```

---

## Common Commands

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild images
docker-compose up --build

# Execute command
docker-compose exec strapi bash
```

---

## Best Practices

1. **Use multi-stage builds** for smaller images
2. **Implement health checks** for all services
3. **Use named volumes** for data persistence
4. **Set restart policies** (`unless-stopped`)
5. **Don't run as root** in containers
6. **Use .dockerignore** to exclude files
7. **Cache dependencies** in layers
8. **Set resource limits** in production
9. **Use secrets** for sensitive data
10. **Enable logging** properly

---

## Resources

- **Docker Docs**: https://docs.docker.com/
- **Compose Docs**: https://docs.docker.com/compose/

---

## Tips

- **Health checks prevent cascade failures**
- **Named volumes persist across recreates**
- **Use Alpine images** for smaller size
- **Multi-stage builds** reduce final image size
- **`.dockerignore`** is like `.gitignore`
