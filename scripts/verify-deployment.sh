#!/bin/bash
# ============================================================
# Claude Agent UI - Deployment Verification
# Verifies that all services are running correctly
# ============================================================

set -e

echo "🔍 Verifying deployment..."

# Load environment variables
source .env

# Check PostgreSQL
echo "1. Checking PostgreSQL..."
docker-compose exec -T postgres pg_isready -U ${POSTGRES_USER:-postgres} || { echo "❌ PostgreSQL not ready"; exit 1; }

# Check Strapi health
echo "2. Checking Strapi..."
curl -f -s -o /dev/null http://localhost:${STRAPI_PORT:-1337}/_health || { echo "❌ Strapi not responding"; exit 1; }

# Check Express health
echo "3. Checking Express..."
curl -f -s -o /dev/null http://localhost:${EXPRESS_PORT:-3001}/health || { echo "❌ Express not responding"; exit 1; }

# Check Frontend
echo "4. Checking Frontend..."
curl -f -s -o /dev/null http://localhost:${FRONTEND_HTTP_PORT:-80}/health || { echo "❌ Frontend not responding"; exit 1; }

# Check logs for errors
echo "5. Checking for errors in logs..."
ERROR_COUNT=$(docker-compose logs --tail=50 | grep -i "error\|fatal\|exception" | wc -l || true)
if [ "$ERROR_COUNT" -gt 5 ]; then
    echo "⚠️  Found $ERROR_COUNT error messages in recent logs"
    echo "💡 Run 'docker-compose logs' to investigate"
fi

echo "✅ All services verified successfully!"
