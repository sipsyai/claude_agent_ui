#!/usr/bin/env python3
"""
Generate documentation for all migration tasks
"""

TASKS = {
    "02-postgresql-setup": {
        "name": "PostgreSQL Schema & Configuration",
        "emoji": "🗄️",
        "time": "1 day",
        "deps": ["01"],
        "skills": ["working-with-postgresql", "working-with-typescript"],
        "primary_skill": "working-with-postgresql",
        "deliverables": ["schema.sql", "indexes.sql", "seed-data.sql", "postgresql.conf", "pg_hba.conf"],
        "test": "psql -d claude_agent_ui -f schema.sql"
    },
    "03-strapi-initialization": {
        "name": "Strapi Project Initialization",
        "emoji": "📦",
        "time": "0.5 day",
        "deps": ["02"],
        "skills": ["strapi-expert", "working-with-typescript"],
        "primary_skill": "strapi-expert",
        "deliverables": ["backend/ directory", "database.ts", "Admin user"],
        "test": "cd backend && npm run develop"
    },
    "04-content-types-creation": {
        "name": "Strapi Content Types Creation",
        "emoji": "🏗️",
        "time": "1 day",
        "deps": ["03"],
        "skills": ["strapi-expert", "working-with-typescript"],
        "primary_skill": "strapi-expert",
        "deliverables": ["agent schema.json", "skill schema.json", "mcp-server schema.json", "task schema.json"],
        "test": "Create test agent in Strapi admin panel"
    },
    "05-typescript-types-definition": {
        "name": "TypeScript Types Definition",
        "emoji": "📝",
        "time": "1 day",
        "deps": ["04"],
        "skills": ["working-with-typescript"],
        "primary_skill": "working-with-typescript",
        "deliverables": ["types/agent.types.ts", "types/strapi.types.ts", "types/dto.types.ts", "types/sse.types.ts"],
        "test": "npm run typecheck"
    },
    "06-strapi-client-service": {
        "name": "Strapi Client Service",
        "emoji": "🔌",
        "time": "1 day",
        "deps": ["05"],
        "skills": ["working-with-express-nodejs", "working-with-typescript"],
        "primary_skill": "working-with-express-nodejs",
        "deliverables": ["strapi-client.ts", "Response transformers", "LRU cache"],
        "test": "npm run test:strapi-client"
    },
    "07-express-routes-refactor": {
        "name": "Express Routes Refactoring",
        "emoji": "🛣️",
        "time": "1.5 days",
        "deps": ["06"],
        "skills": ["working-with-express-nodejs", "working-with-typescript"],
        "primary_skill": "working-with-express-nodejs",
        "deliverables": ["manager.routes.ts", "execution.routes.ts", "middleware/", "validators/"],
        "test": "npm run build && npm start"
    },
    "08-data-migration-script": {
        "name": "Data Migration Script",
        "emoji": "🔄",
        "time": "1 day",
        "deps": ["07"],
        "skills": ["working-with-postgresql", "working-with-typescript"],
        "primary_skill": "working-with-postgresql",
        "deliverables": ["migrate-sqlite-to-postgres.ts", "SQLite backup", "Migration report"],
        "test": "npm run migrate && npm run validate-migration"
    },
    "09-frontend-api-update": {
        "name": "Frontend API Client Update",
        "emoji": "🖥️",
        "time": "1.5 days",
        "deps": ["08"],
        "skills": ["working-with-typescript", "working-with-express-nodejs"],
        "primary_skill": "working-with-typescript",
        "deliverables": ["api.ts (dual endpoints)", "Environment variables", "Component updates"],
        "test": "npm run dev → Test UI"
    },
    "10-docker-deployment-setup": {
        "name": "Docker Deployment Setup",
        "emoji": "🐳",
        "time": "2 days",
        "deps": ["09"],
        "skills": ["working-with-docker", "strapi-expert", "working-with-express-nodejs"],
        "primary_skill": "working-with-docker",
        "deliverables": ["docker-compose.yml (5 services)", "Dockerfiles", "nginx.conf", "deploy.sh"],
        "test": "docker-compose up -d && docker-compose ps"
    },
    "11-testing-validation": {
        "name": "Testing & Validation",
        "emoji": "✅",
        "time": "1 day",
        "deps": ["10"],
        "skills": ["All skills"],
        "primary_skill": "All skills",
        "deliverables": ["E2E test suite", "Performance benchmarks", "Security audit", "Documentation"],
        "test": "npm run test:e2e && npm run test:performance"
    }
}

def generate_readme(task_id, task_info):
    deps_str = ", ".join([f"Task {d}" for d in task_info["deps"]]) if task_info["deps"] else "None (Starting task)"
    skills_str = ", ".join(task_info["skills"])
    deliverables_str = "\n".join([f"{i+1}. **{d}**" for i, d in enumerate(task_info["deliverables"])])

    return f"""# Task {task_id[-2:]}: {task_info['name']} {task_info['emoji']}

**Status:** 🔴 Not Started
**Priority:** Critical
**Estimated Time:** {task_info['time']}
**Dependencies:** {deps_str}

---

## 📋 Overview

{task_info['name']} task for Claude Agent UI migration.

## 🎯 Goals

Complete {task_info['name'].lower()} as specified in migration analysis documents.

## 👤 Skill Assignments

**Primary:** {task_info['primary_skill']} (Lead)
**Support:** {", ".join([s for s in task_info['skills'] if s != task_info['primary_skill']])}

## 📚 Key References

- `../../analyses/migration_analysis.md`
- `../../analyses/postgresql-analysis.md`
- `../../analyses/typescript-analysis.md`
- `../../analyses/express-analysis.md`
- `../../analyses/docker-analysis.md`
- `../../analyses/strapi_analysis.md`

## 📝 Deliverables

{deliverables_str}

## ✅ Verification

```bash
{task_info['test']}
```

## 🔗 Dependencies

**Upstream:** {deps_str}
**Downstream:** See dependency chain in main README

---

**Created:** 2025-10-31
**Skills:** {skills_str}
"""

def generate_checklist(task_id, task_info):
    return f"""# Task {task_id[-2:]}: {task_info['name']} - Checklist

## 🎯 Pre-Task Setup
- [ ] Review relevant analysis documents
- [ ] Ensure previous task (Task {task_info['deps'][0] if task_info['deps'] else 'None'}) is completed
- [ ] Check all dependencies are met

## 📦 Implementation
- [ ] Read task README thoroughly
- [ ] Review REFERENCES.md for detailed guidance
- [ ] Implement all deliverables
- [ ] Test each component individually

## 🧪 Testing
- [ ] Run verification script: `./verification.sh`
- [ ] Run project build: `npm run build`
- [ ] Run project start: `npm start`
- [ ] Verify all functionality works

## ✅ Completion
- [ ] All deliverables completed
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Move folder to `../completed_tasks/`
- [ ] Update main project tracker
- [ ] Ready for next task

---

**Completion Criteria:** All items checked ✅
"""

def generate_references(task_id, task_info):
    return f"""# Task {task_id[-2:]}: {task_info['name']} - References

## 📚 Primary Documentation

### Analysis Documents
- **Migration Analysis:** `../../analyses/migration_analysis.md`
- **PostgreSQL Analysis:** `../../analyses/postgresql-analysis.md`
- **TypeScript Analysis:** `../../analyses/typescript-analysis.md`
- **Express Analysis:** `../../analyses/express-analysis.md`
- **Docker Analysis:** `../../analyses/docker-analysis.md`
- **Strapi Analysis:** `../../analyses/strapi_analysis.md`

## 🔗 Task Files
- Task README: `./README.md`
- Task Checklist: `./CHECKLIST.md`
- Verification Script: `./verification.sh`

## 👤 Skills Involved
{chr(10).join([f"- {skill}" for skill in task_info['skills']])}

---

**Last Updated:** 2025-10-31
"""

def generate_verification(task_id, task_info):
    return f"""#!/bin/bash

echo "Verifying Task {task_id[-2:]}: {task_info['name']}..."

# Add verification logic here
{task_info['test']}

echo "✅ Task {task_id[-2:]} verification complete!"
"""

import os

base_path = "/c/Users/Ali/Documents/Projects/claude_agent_ui/.claude/Project/Tasks"

for task_id, task_info in TASKS.items():
    task_path = os.path.join(base_path, task_id)

    # Generate README
    with open(os.path.join(task_path, "README.md"), "w") as f:
        f.write(generate_readme(task_id, task_info))

    # Generate CHECKLIST
    with open(os.path.join(task_path, "CHECKLIST.md"), "w") as f:
        f.write(generate_checklist(task_id, task_info))

    # Generate REFERENCES
    with open(os.path.join(task_path, "REFERENCES.md"), "w") as f:
        f.write(generate_references(task_info))

    # Generate verification
    with open(os.path.join(task_path, "verification.sh"), "w") as f:
        f.write(generate_verification(task_id, task_info))

print("✅ All task documentation generated successfully!")
