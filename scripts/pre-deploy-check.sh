#!/bin/bash
# ============================================================
# Claude Agent UI - Pre-Deployment Checks
# Validates environment and prerequisites before deployment
# ============================================================

set -e

echo "🔍 Running pre-deployment checks..."

# Check Docker version
echo "1. Checking Docker version..."
docker --version || { echo "❌ Docker not installed"; exit 1; }
docker-compose --version || { echo "❌ Docker Compose not installed"; exit 1; }

# Validate environment file
echo "2. Validating environment variables..."
if [ ! -f .env ]; then
    echo "❌ .env file not found"
    echo "💡 Copy .env.example to .env and fill in the values"
    exit 1
fi

# Check required secrets
echo "3. Checking secrets..."
source .env

[ -z "$POSTGRES_PASSWORD" ] && echo "❌ POSTGRES_PASSWORD not set" && exit 1
[ -z "$ANTHROPIC_API_KEY" ] && echo "❌ ANTHROPIC_API_KEY not set" && exit 1
[ -z "$STRAPI_JWT_SECRET" ] && echo "❌ STRAPI_JWT_SECRET not set" && exit 1
[ -z "$STRAPI_APP_KEYS" ] && echo "❌ STRAPI_APP_KEYS not set" && exit 1

# Check disk space
echo "4. Checking disk space..."
AVAILABLE=$(df . | awk 'NR==2 {print $4}')
if [ "$AVAILABLE" -lt 10485760 ]; then  # 10GB in KB
    echo "⚠️  Low disk space (< 10GB available)"
fi

# Validate Docker Compose file
echo "5. Validating docker-compose.yml..."
docker-compose config > /dev/null || { echo "❌ Invalid docker-compose.yml"; exit 1; }

echo "✅ All pre-deployment checks passed!"
