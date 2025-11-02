# Docker Deployment Guide

## Overview

This document provides comprehensive instructions for deploying Claude Agent UI using Docker.

## Architecture

The application consists of 4 containerized services:

1. **PostgreSQL** (Database) - Port 5433
2. **Strapi** (CMS/Data Layer) - Port 1337
3. **Express** (Business Logic/SSE) - Port 3001
4. **Frontend** (React + Nginx) - Ports 80/443

## Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- At least 10GB free disk space
- 4GB RAM minimum

## Quick Start

### 1. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env and fill in required values
nano .env
```

Required environment variables:
- `POSTGRES_PASSWORD` - PostgreSQL password
- `STRAPI_APP_KEYS` - Strapi app keys (comma-separated)
- `STRAPI_API_TOKEN_SALT` - API token salt
- `STRAPI_ADMIN_JWT_SECRET` - Admin JWT secret
- `STRAPI_TRANSFER_TOKEN_SALT` - Transfer token salt
- `STRAPI_JWT_SECRET` - JWT secret
- `STRAPI_API_TOKEN` - API token for Express
- `ANTHROPIC_API_KEY` - Anthropic API key

### 2. Generate Secrets

```bash
# Run the secrets generation script
bash scripts/generate-secrets.sh
```

Copy the generated secrets to your `.env` file.

### 3. Deploy

```bash
# Run deployment script
bash scripts/deploy.sh
```

Or manually:

```bash
# Build and start all services
docker-compose up -d --build

# Check status
docker-compose ps
```

## Development Mode

For local development with hot reload:

```bash
# Start in development mode
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Or just specific services
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up postgres strapi
```

## Service Access

After deployment:

- **Frontend**: http://localhost:80
- **Strapi Admin**: http://localhost:1337/admin
- **Express API**: http://localhost:3001/api
- **PostgreSQL**: localhost:5433

## Common Commands

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f strapi
docker-compose logs -f express
```

### Restart Services

```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart strapi
```

### Stop Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: data loss)
docker-compose down -v
```

### Rebuild Services

```bash
# Rebuild specific service
docker-compose build --no-cache strapi

# Rebuild all
docker-compose build --no-cache
```

## Backup & Restore

### Create Backup

```bash
# Run backup script
bash scripts/backup-postgres.sh

# Or manually
docker-compose exec postgres pg_dump -U postgres claude_agent_ui > backup.sql
```

### Restore Backup

```bash
# Restore from backup
docker-compose exec -T postgres psql -U postgres claude_agent_ui < backup.sql
```

## Health Checks

All services have health checks configured:

```bash
# Check service health
docker-compose ps

# Check specific service health endpoint
curl http://localhost:1337/_health  # Strapi
curl http://localhost:3001/health   # Express
curl http://localhost:80/health     # Frontend
```

## Troubleshooting

### Service Won't Start

1. Check logs:
   ```bash
   docker-compose logs [service-name]
   ```

2. Verify environment variables:
   ```bash
   docker-compose config
   ```

3. Check disk space:
   ```bash
   df -h
   ```

### Database Connection Issues

1. Verify PostgreSQL is running:
   ```bash
   docker-compose ps postgres
   ```

2. Test connection:
   ```bash
   docker-compose exec postgres pg_isready -U postgres
   ```

3. Check connection from Strapi:
   ```bash
   docker-compose exec strapi npm run strapi console
   ```

### Port Conflicts

If ports are already in use, modify in `.env`:

```bash
POSTGRES_PORT=5434
STRAPI_PORT=1338
EXPRESS_PORT=3002
FRONTEND_HTTP_PORT=8080
```

### Clear Everything and Start Fresh

```bash
# Stop all containers
docker-compose down

# Remove all volumes (WARNING: data loss)
docker-compose down -v

# Remove all images
docker-compose down --rmi all

# Start fresh
docker-compose up -d --build
```

## Production Deployment

### Security Hardening

1. Use strong passwords for all services
2. Enable HTTPS with SSL certificates
3. Configure firewall rules
4. Use Docker secrets instead of environment variables
5. Enable rate limiting in nginx

### SSL/HTTPS Setup

1. Obtain SSL certificates (Let's Encrypt recommended)
2. Place certificates in `./ssl/` directory
3. Uncomment HTTPS server block in `nginx/conf.d/default.conf`
4. Update environment variables:
   ```bash
   FRONTEND_HTTPS_PORT=443
   ```

### Monitoring

Set up monitoring with:
- Docker stats: `docker stats`
- Logs aggregation: ELK stack or similar
- Health check monitoring
- Performance metrics

## Maintenance

### Update Application

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
bash scripts/deploy.sh
```

### Scale Services

```bash
# Scale Express workers
docker-compose up -d --scale express=3
```

### View Resource Usage

```bash
# Real-time stats
docker stats

# Service-specific
docker stats claude-strapi claude-express
```

## Support

For issues or questions:
- Check logs: `docker-compose logs`
- Review health checks: `docker-compose ps`
- Verify configuration: `docker-compose config`

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Strapi Documentation](https://docs.strapi.io/)
- [Nginx Documentation](https://nginx.org/en/docs/)
