# Docker Compose

**Topic:** Multi-Container Orchestration
**Created:** 2025-10-31

---

## Docker Compose for Claude Agent UI

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:16-alpine
    container_name: claude-postgres
    environment:
      POSTGRES_DB: ${DATABASE_NAME}
      POSTGRES_USER: ${DATABASE_USERNAME}
      POSTGRES_PASSWORD: ${DATABASE_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DATABASE_USERNAME}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # Strapi CMS
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
      APP_KEYS: ${APP_KEYS}
      API_TOKEN_SALT: ${API_TOKEN_SALT}
    ports:
      - "1337:1337"
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - ./backend/public:/opt/app/public
      - ./backend/uploads:/opt/app/public/uploads
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:1337/_health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

  # Express Custom API
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
      - strapi
    restart: unless-stopped

  # Frontend (Optional)
  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    container_name: claude-frontend
    environment:
      VITE_STRAPI_URL: http://localhost:1337/api
      VITE_EXPRESS_URL: http://localhost:3001/api
    ports:
      - "80:80"
    depends_on:
      - strapi
      - express
    restart: unless-stopped

volumes:
  postgres_data:
```

## Key Concepts

### Service Definition

```yaml
services:
  service-name:
    image: image:tag           # Pre-built image
    # OR
    build:                      # Build from Dockerfile
      context: ./path
      dockerfile: Dockerfile
    container_name: name        # Container name
    environment:                # Environment variables
      KEY: value
    env_file:                   # Load from file
      - .env
    ports:                      # Port mapping
      - "host:container"
    volumes:                    # Volume mounts
      - volume_name:/path
      - ./local:/container
    depends_on:                 # Service dependencies
      - other-service
    healthcheck:                # Health checking
      test: ["CMD", "curl", "-f", "http://localhost"]
      interval: 30s
    restart: unless-stopped     # Restart policy
```

### Health Checks

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U postgres"]  # PostgreSQL
  # OR
  test: ["CMD", "curl", "-f", "http://localhost:1337/_health"]  # HTTP
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 30s
```

### Dependencies

```yaml
depends_on:
  postgres:
    condition: service_healthy  # Wait for health check
```

### Networks

```yaml
networks:
  app-network:
    driver: bridge

services:
  service1:
    networks:
      - app-network
```

### Volumes

```yaml
volumes:
  postgres_data:           # Named volume
    driver: local

services:
  postgres:
    volumes:
      - postgres_data:/var/lib/postgresql/data  # Named volume
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql  # Bind mount
```

## Common Commands

```bash
# Start all services
docker-compose up

# Start in detached mode
docker-compose up -d

# Build images
docker-compose build

# Build and start
docker-compose up --build

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# View logs
docker-compose logs

# Follow logs
docker-compose logs -f service-name

# Execute command in service
docker-compose exec service-name bash

# View running services
docker-compose ps

# Restart service
docker-compose restart service-name
```

## Environment Variables

Create `.env` file:

```env
# Database
DATABASE_NAME=claude_agent_ui
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=secure_password

# Strapi
JWT_SECRET=your_jwt_secret
ADMIN_JWT_SECRET=your_admin_jwt_secret
APP_KEYS=key1,key2,key3,key4
API_TOKEN_SALT=your_api_token_salt

# Express
STRAPI_API_TOKEN=your_strapi_api_token
ANTHROPIC_API_KEY=your_anthropic_key
```

Load in docker-compose.yml:

```yaml
services:
  strapi:
    env_file:
      - .env
```

## Production Tips

1. **Use health checks** for proper startup order
2. **Set restart policies** (`unless-stopped` or `always`)
3. **Use named volumes** for data persistence
4. **Set resource limits** (memory, CPU)
5. **Use networks** for service isolation
6. **Don't expose ports** unnecessarily
7. **Use secrets** for sensitive data
8. **Enable logging** with proper drivers
