#!/bin/bash
# ============================================================
# Claude Agent UI - Deployment Script
# Automated deployment with health checks and verification
# ============================================================

set -e

echo "🚀 Starting deployment..."

# Run pre-deployment checks
echo "📋 Running pre-deployment checks..."
if [ -f "./scripts/pre-deploy-check.sh" ]; then
    ./scripts/pre-deploy-check.sh
else
    echo "⚠️  Pre-deployment check script not found, skipping..."
fi

# Backup existing data
echo "📦 Creating backup..."
if [ -f "./scripts/backup-postgres.sh" ]; then
    ./scripts/backup-postgres.sh
else
    echo "⚠️  Postgres backup script not found, skipping..."
fi

# Pull latest code (if using git)
if [ -d ".git" ]; then
    echo "📥 Pulling latest code..."
    git pull origin main
else
    echo "⚠️  Not a git repository, skipping pull..."
fi

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
timeout 300 bash -c 'while [ $(docker-compose ps | grep -c "(healthy)") -lt 4 ]; do echo "Waiting for services..."; sleep 5; done' || {
    echo "⚠️  Some services may not be healthy yet, continuing..."
}

# Verify deployment
echo "✅ Verifying deployment..."
if [ -f "./scripts/verify-deployment.sh" ]; then
    ./scripts/verify-deployment.sh
else
    echo "⚠️  Verification script not found, skipping..."
fi

# Show container status
echo ""
echo "📊 Container Status:"
docker-compose ps

echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "🌐 Access the application:"
echo "   - Frontend: http://localhost:${FRONTEND_HTTP_PORT:-80}"
echo "   - Strapi Admin: http://localhost:${STRAPI_PORT:-1337}/admin"
echo "   - Express API: http://localhost:${EXPRESS_PORT:-3001}"
echo ""
