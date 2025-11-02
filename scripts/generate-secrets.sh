#!/bin/bash
# ============================================================
# Claude Agent UI - Secrets Generation Script
# Generates secure random secrets for .env file
# ============================================================

echo "🔐 Generating secrets for .env file..."
echo ""

echo "# ============================================================"
echo "# Strapi Secrets (add these to your .env file)"
echo "# ============================================================"
echo "STRAPI_APP_KEYS=$(openssl rand -base64 32),$(openssl rand -base64 32),$(openssl rand -base64 32),$(openssl rand -base64 32)"
echo "STRAPI_API_TOKEN_SALT=$(openssl rand -base64 32)"
echo "STRAPI_ADMIN_JWT_SECRET=$(openssl rand -base64 32)"
echo "STRAPI_TRANSFER_TOKEN_SALT=$(openssl rand -base64 32)"
echo "STRAPI_JWT_SECRET=$(openssl rand -base64 32)"
echo "STRAPI_API_TOKEN=$(openssl rand -base64 32)"
echo ""
echo "# ============================================================"
echo "# PostgreSQL Password"
echo "# ============================================================"
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32)"
echo ""
echo "# ============================================================"
echo "# Optional: Redis Password"
echo "# ============================================================"
echo "REDIS_PASSWORD=$(openssl rand -base64 32)"
echo ""
echo "⚠️  IMPORTANT: Save these secrets securely!"
echo "⚠️  Add them to your .env file before deployment"
