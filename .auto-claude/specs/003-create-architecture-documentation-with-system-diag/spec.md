# Create architecture documentation with system diagrams

## Overview

The project has a complex hybrid architecture (React + Express + Strapi + PostgreSQL + Claude SDK + MCP) but lacks visual documentation showing how components interact. The README mentions this architecture but doesn't provide diagrams for data flow, service communication, or deployment topology.

## Rationale

New developers and contributors need to understand the system architecture before making changes. The current project involves streaming SSE connections, MCP protocol interactions, and multi-service communication that aren't immediately obvious from code alone.

---
*This spec was created from ideation and is pending detailed specification.*
