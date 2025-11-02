# Task 01: Infrastructure Setup - Checklist

## 🎯 Pre-Task Setup
- [ ] Review docker-analysis.md (Sections 3, 7, 8)
- [ ] Review postgresql-analysis.md (Section 4)
- [ ] Ensure Docker Desktop is running
- [ ] Verify Docker Compose version (v2+)

## 📦 Docker Compose Configuration
- [ ] Create `docker-compose.yml` in project root
- [ ] Add PostgreSQL service definition
  - [ ] Image: postgres:16-alpine
  - [ ] Container name: claude-postgres
  - [ ] Environment variables from .env
  - [ ] Port mapping: 5432:5432
  - [ ] Volume: postgres_data:/var/lib/postgresql/data
  - [ ] Health check configured
  - [ ] Restart policy: unless-stopped
- [ ] Add network definition (app-network, bridge driver)
- [ ] Add volume definition (postgres_data, local driver)

## 🔒 Environment Configuration
- [ ] Create `.env.example` with all required variables:
  - [ ] POSTGRES_USER
  - [ ] POSTGRES_PASSWORD
  - [ ] POSTGRES_DB
  - [ ] DATABASE_HOST
  - [ ] DATABASE_PORT
- [ ] Add .env to .gitignore
- [ ] Document all environment variables

## 🔐 Secrets Generation
- [ ] Create `scripts/generate-secrets.sh`
  - [ ] Generate random password for PostgreSQL (32 chars)
  - [ ] Generate JWT secret (64 chars)
  - [ ] Generate admin JWT secret (64 chars)
  - [ ] Generate API token salt (32 chars)
  - [ ] Write secrets to .env file
- [ ] Make script executable: `chmod +x scripts/generate-secrets.sh`
- [ ] Test script execution

## 🧪 Testing & Verification
- [ ] Run `docker-compose config` (validates syntax)
- [ ] Run `./scripts/generate-secrets.sh`
- [ ] Verify .env file created with all secrets
- [ ] Run `docker-compose up -d postgres`
- [ ] Check container status: `docker-compose ps`
- [ ] Verify health check: `docker inspect --format='{{.State.Health.Status}}' claude-postgres`
- [ ] Test PostgreSQL connection:
  ```bash
  docker-compose exec postgres psql -U postgres -d postgres -c "SELECT version();"
  ```
- [ ] Test from host:
  ```bash
  psql -h localhost -U postgres -d postgres -c "SELECT 1;"
  ```

## 📝 Documentation Updates
- [ ] Update project root README.md:
  - [ ] Add "Quick Start" section
  - [ ] Add prerequisites (Docker, Docker Compose)
  - [ ] Add setup instructions
  - [ ] Add environment variables documentation
- [ ] Create scripts/README.md documenting all scripts

## ✅ Final Verification
- [ ] All checklist items completed
- [ ] Run `./verification.sh` successfully
- [ ] Docker Compose logs show no errors
- [ ] PostgreSQL accepting connections
- [ ] No warnings in container logs

## 🎉 Task Completion
- [ ] Mark task status as COMPLETED in README.md
- [ ] Run `npm run build` (should complete successfully)
- [ ] Run `npm start` (application starts)
- [ ] Move folder to `../completed_tasks/01-infrastructure-setup/`
- [ ] Update main project tracking document
- [ ] Notify team/document completion
- [ ] Ready to proceed to Task 02

---

**Completion Criteria:** All items checked ✅
**Estimated Time:** 1 day
**Actual Time:** ___ hours
