# Architecture Documentation

Welcome to the Claude Agent UI architecture documentation. This guide provides comprehensive visual documentation of the system's architecture, helping you understand how all components interact.

## 🎯 Quick Start

**New to the project?** Start here:

1. **[System Overview](./01-system-overview.md)** - Understand the big picture (5 min read)
2. **[Data Flow](./02-data-flow.md)** - See how data moves through the system (10 min read)
3. **[Components](./04-components.md)** - Explore the service and component structure (8 min read)

**Working on deployment?** Check out [Deployment Architecture](./03-deployment.md)

**Need to understand a specific flow?** See [Sequence Diagrams](./05-sequences.md)

---

## 📚 Documentation Index

### [1. System Architecture Overview](./01-system-overview.md)
**What you'll learn:** High-level view of all major components and their interactions

The foundational diagram showing:
- 8 major system components (React Frontend, Nginx, Express, Strapi, PostgreSQL, Claude SDK, MCP Servers, External APIs)
- Docker network topology (frontend/backend separation)
- Communication protocols (HTTP/REST, SSE, JSON-RPC)
- Security boundaries and isolation

**Best for:** Getting oriented with the system architecture, understanding service boundaries, onboarding new developers.

---

### [2. Data Flow Architecture](./02-data-flow.md)
**What you'll learn:** How data flows through the system in different scenarios

Four critical data flow patterns:
1. **Agent Execution Flow** - Real-time SSE streaming from Claude SDK
2. **CRUD Operations Flow** - Data persistence through Strapi with caching
3. **MCP Tool Invocation Flow** - External tool integration via MCP protocol
4. **Chat/Conversation Flow** - Interactive chat sessions with streaming

**Best for:** Understanding request/response cycles, debugging data flow issues, optimizing performance, implementing new features.

---

### [3. Docker Deployment Architecture](./03-deployment.md)
**What you'll learn:** Container orchestration, networking, and operational considerations

Comprehensive deployment documentation:
- Production deployment topology (4 containers, 2 networks, 5 volumes)
- Network architecture with security segmentation
- Volume management and backup strategies
- Development vs production configurations
- Health checks and monitoring
- Resource allocation and tuning
- Operational procedures (startup, backup/restore, troubleshooting)

**Best for:** DevOps tasks, deployment configuration, infrastructure debugging, capacity planning, disaster recovery.

---

### [4. Component Architecture](./04-components.md)
**What you'll learn:** Detailed component structure across all layers

Three component layers documented:
1. **Express Service Layer** - 26 services organized into 8 categories (Core AI, Data Layer, MCP Integration, Chat, Skills, Infrastructure, Utilities, Training)
2. **Frontend Component Hierarchy** - 48+ React components organized by feature (Agent, Skill, Chat, UI, Forms)
3. **Strapi Content Types** - 7 content types with complete ERD showing relationships

**Best for:** Understanding service responsibilities, finding the right component to modify, understanding data models, planning new features.

---

### [5. Sequence Diagrams](./05-sequences.md)
**What you'll learn:** Step-by-step interactions for critical operations

Four key operational flows:
1. **Agent Creation and Execution** - Complete lifecycle from configuration to task execution
2. **MCP Server Connection and Tool Discovery** - Server initialization and tool discovery with 3-tier config
3. **Skill Management Flow** - Database to filesystem synchronization
4. **Real-time SSE Communication** - Streaming architecture with keep-alive and reconnection

**Best for:** Understanding temporal flow, debugging complex interactions, implementing similar features, troubleshooting issues.

---

## 🏗️ System Architecture Summary

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                      Web Browser (Client)                    │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontend Container (Nginx + React SPA)                      │
│  • Vite + React 18 + TypeScript                             │
│  • Tailwind CSS + Radix UI                                   │
│  • Real-time SSE connections                                 │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/REST + SSE
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Express Container (Business Logic)                          │
│  • 26 services (AI, MCP, Chat, Skills, Infrastructure)      │
│  • Claude SDK integration                                    │
│  • SSE streaming engine                                      │
│  • MCP protocol handler                                      │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Strapi Container (Data Layer)                               │
│  • Headless CMS with REST API                               │
│  • 7 content types (Agent, Skill, MCP Server, etc.)         │
│  • LRU caching layer                                         │
└────────────────────────┬────────────────────────────────────┘
                         │ SQL
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  PostgreSQL Container (Data Storage)                         │
│  • PostgreSQL 16 (Alpine)                                    │
│  • Persistent volumes with backups                           │
│  • Health checks configured                                  │
└─────────────────────────────────────────────────────────────┘

External Integrations:
├─ Anthropic API (Claude models via SDK)
├─ MCP Servers (stdio/sse/http/sdk transports)
└─ Filesystem (.mcp.json, .claude/, skills/)
```

### Technology Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, Radix UI, EventSource (SSE) |
| **Backend** | Node.js 20, Express, TypeScript, Claude Agent SDK |
| **Data Layer** | Strapi 4.x, PostgreSQL 16 |
| **Infrastructure** | Docker, Docker Compose, Nginx |
| **AI/ML** | Anthropic Claude API, Claude SDK |
| **Protocols** | REST, SSE (Server-Sent Events), JSON-RPC (MCP) |

---

## 🔑 Key Architectural Patterns

### 1. **Hybrid Multi-Service Architecture**
The system uses a specialized architecture where:
- **Strapi** handles all database CRUD operations (data layer)
- **Express** implements business logic, AI integration, and streaming
- **Separation of concerns** enables independent scaling and maintenance

### 2. **Real-Time Streaming with SSE**
Server-Sent Events power real-time features:
- Agent execution streaming (live output from Claude)
- Chat message streaming
- Task execution updates
- Health monitoring

### 3. **Three-Tier MCP Configuration**
MCP servers are discovered using a flexible hierarchy:
1. **Project-level** (`.mcp.json` file-based configuration)
2. **Agent-level** (agent-specific MCP server associations)
3. **Skill-level** (skill-specific tool requirements)

### 4. **Service-Oriented Design**
Express backend organized into focused service modules:
- **Core AI Services** - Claude SDK, model routing, response parsing
- **Data Layer** - Centralized Strapi client with LRU caching
- **MCP Integration** - Tool discovery and execution
- **Infrastructure** - Config, health, logging, error handling

### 5. **Docker Network Segmentation**
Two-tier network for security:
- **Frontend Network** - Nginx, Express, Strapi (public-facing)
- **Backend Network** - PostgreSQL, Strapi, Express (database isolation)

---

## 🚀 Common Development Scenarios

### Adding a New API Endpoint
1. Read [Data Flow Architecture](./02-data-flow.md) to understand request patterns
2. Review [Component Architecture](./04-components.md) to find relevant services
3. Check [Sequence Diagrams](./05-sequences.md) for similar flows
4. Implement following existing patterns in `src/routes/`

### Integrating a New MCP Server
1. Understand the flow in [Data Flow: MCP Tool Invocation](./02-data-flow.md#3-mcp-tool-invocation-flow)
2. Review [Sequence Diagrams: MCP Server Connection](./05-sequences.md#2-mcp-server-connection-and-tool-discovery)
3. Add configuration to `.mcp.json` or Strapi
4. Test discovery via `/api/mcp/servers` endpoint

### Debugging SSE Streaming Issues
1. Review [Data Flow: Agent Execution](./02-data-flow.md#1-agent-execution-flow-with-sse-streaming)
2. Check [Sequence Diagrams: Real-time SSE](./05-sequences.md#4-real-time-sse-communication)
3. Verify SSE headers in Express route
4. Check EventSource connection in browser DevTools

### Modifying Database Schema
1. Review [Component Architecture: Strapi Content Types](./04-components.md#3-strapi-content-types--relationships)
2. Update Strapi schema in `strapi/src/api/`
3. Run Strapi rebuild to generate new API
4. Update TypeScript types in frontend

### Deploying to Production
1. Review [Deployment Architecture](./03-deployment.md) completely
2. Configure environment variables per documentation
3. Follow operational procedures for startup
4. Set up monitoring and health checks
5. Configure backup strategy for persistent volumes

---

## 📊 Performance Considerations

### Caching Strategy
- **Strapi Client**: LRU cache with 500-item limit, 5-minute TTL
- **Express Cache**: In-memory caching for agent configs
- **Nginx Cache**: Static asset caching with appropriate headers

### Resource Limits
- **PostgreSQL**: 256M-1G memory, 0.5-2 CPU cores
- **Strapi**: 512M-1G memory, 0.5-2 CPU cores
- **Express**: 512M-1G memory, 0.5-2 CPU cores
- **Frontend**: 64M-256M memory, 0.25-1 CPU cores

See [Deployment Architecture](./03-deployment.md) for detailed tuning guidance.

---

## 🔒 Security Architecture

### Network Isolation
- **Frontend network**: Public-facing services (Nginx, Express, Strapi)
- **Backend network**: Database isolation (PostgreSQL accessible only to Strapi/Express)
- **No direct database access** from frontend or external services

### Authentication & Authorization
- Strapi admin authentication for CMS access
- API key authentication for Anthropic API
- MCP server authentication per transport type
- Environment-based secrets management

### Data Protection
- Database credentials in `.env` (not committed)
- API keys stored in environment variables
- Sensitive data in PostgreSQL with backup encryption
- Health check endpoints expose minimal information

---

## 🧪 Testing Strategy

### Unit Testing
- Service layer tests for Express services
- Component tests for React components
- Strapi content type validation

### Integration Testing
- API endpoint tests (Express → Strapi → Database)
- SSE streaming tests
- MCP tool invocation tests

### End-to-End Testing
- Agent creation and execution flows
- Skill synchronization
- Chat session management

---

## 📖 Additional Resources

### Project Documentation
- [Main README](../../README.md) - Project overview and setup
- [.auto-claude/](../../.auto-claude/) - Auto-Claude task specifications

### External Documentation
- [Anthropic Claude SDK](https://github.com/anthropics/anthropic-sdk-typescript)
- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
- [Strapi Documentation](https://docs.strapi.io/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)

---

## 🤝 Contributing

When contributing to this project:

1. **Understand the architecture** - Read relevant documentation sections first
2. **Follow existing patterns** - Review [Component Architecture](./04-components.md) for code organization
3. **Maintain consistency** - Match the style and patterns of similar components
4. **Update documentation** - Keep architecture docs in sync with code changes
5. **Test thoroughly** - Verify changes don't break existing flows

---

## 📝 Documentation Maintenance

This documentation is generated and maintained as part of the project's development workflow. If you notice:

- **Outdated diagrams** - Mermaid diagrams that don't reflect current code
- **Missing components** - New services or components not documented
- **Broken links** - Links that don't work
- **Unclear explanations** - Sections that need clarification

Please update the relevant documentation file or open an issue.

---

## 💡 Quick Tips

**For visual learners:** All documents include Mermaid diagrams that render in GitHub/GitLab

**For code explorers:** Each document links to relevant source files in the codebase

**For system administrators:** Focus on [Deployment Architecture](./03-deployment.md)

**For frontend developers:** Start with [Components](./04-components.md) → Frontend section

**For backend developers:** Review [Components](./04-components.md) → Express section + [Data Flow](./02-data-flow.md)

**For DevOps engineers:** [Deployment](./03-deployment.md) + [System Overview](./01-system-overview.md)

---

**Last Updated:** 2026-01-02
**Documentation Version:** 1.0
**System Version:** See [package.json](../../package.json)
