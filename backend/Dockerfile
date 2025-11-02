# ============================================================
# Strapi Dockerfile - Multi-Stage Build
# Claude Agent UI - Strapi CMS
# ============================================================

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
    wget \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /opt/app

# Copy production dependencies
COPY --from=production-dependencies /opt/app/node_modules ./node_modules

# Copy built application
COPY --from=builder /opt/app/dist ./dist
COPY --from=builder /opt/app/public ./public
COPY --from=builder /opt/app/config ./config
COPY --from=builder /opt/app/database ./database
COPY package*.json ./

# Create directories for uploads and cache
RUN mkdir -p /opt/app/public/uploads /opt/app/.cache /opt/app/logs

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
LABEL maintainer="claude-agent-ui@anthropic.com" \
      version="1.0.0" \
      description="Strapi CMS for Claude Agent UI"

# Start Strapi
CMD ["npm", "run", "start"]
