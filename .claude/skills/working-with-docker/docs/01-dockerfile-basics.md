# Dockerfile Best Practices

**Topic:** Building Optimized Docker Images
**Created:** 2025-10-31

---

## Basic Dockerfile Structure

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

## Multi-Stage Build (Strapi)

```dockerfile
# Build stage
FROM node:20-alpine AS build
WORKDIR /opt/app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
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

## Multi-Stage Build (Express)

```dockerfile
# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

## Frontend (React/Vite) with Nginx

```dockerfile
# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage with Nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## .dockerignore

```
node_modules
npm-debug.log
.env
.env.local
dist
build
.git
.gitignore
README.md
.vscode
.idea
coverage
.DS_Store
*.log
```

## Best Practices

### 1. Use Multi-Stage Builds
- Smaller final images
- Separate build and runtime dependencies
- Better security

### 2. Optimize Layer Caching
```dockerfile
# ❌ Bad - invalidates cache on any file change
COPY . .
RUN npm install

# ✅ Good - cache dependencies separately
COPY package*.json ./
RUN npm ci
COPY . .
```

### 3. Use Alpine Images
```dockerfile
# ❌ Large image (~900MB)
FROM node:20

# ✅ Smaller image (~150MB)
FROM node:20-alpine
```

### 4. Run as Non-Root User
```dockerfile
FROM node:20-alpine
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs
WORKDIR /app
```

### 5. Use Specific Image Tags
```dockerfile
# ❌ Bad - unpredictable
FROM node:latest

# ✅ Good - reproducible
FROM node:20-alpine
```

### 6. Minimize Layers
```dockerfile
# ❌ Bad - multiple layers
RUN apt-get update
RUN apt-get install -y curl
RUN apt-get clean

# ✅ Good - single layer
RUN apt-get update && \
    apt-get install -y curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
```

### 7. Use npm ci Instead of npm install
```dockerfile
# ❌ Bad - slower, less reproducible
RUN npm install

# ✅ Good - faster, reproducible
RUN npm ci --only=production
```

### 8. Set NODE_ENV
```dockerfile
ENV NODE_ENV=production
```

## Common Commands

```bash
# Build image
docker build -t my-app:latest .

# Build with specific Dockerfile
docker build -f Dockerfile.express -t my-express-api .

# Run container
docker run -p 3001:3001 my-app:latest

# Run with environment variables
docker run -p 3001:3001 -e NODE_ENV=production my-app

# Run with volume
docker run -p 3001:3001 -v $(pwd)/uploads:/app/uploads my-app

# View logs
docker logs container-name

# Execute command in container
docker exec -it container-name sh
```

## Health Checks in Dockerfile

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node healthcheck.js || exit 1
```

## Resource Limits (via docker run)

```bash
docker run \
  --memory="512m" \
  --cpus="1.0" \
  -p 3001:3001 \
  my-app
```
