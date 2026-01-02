# Add JSDoc documentation for backend services

## Overview

The src/services directory contains 29 service files with 65+ exported functions, classes, and interfaces. Most lack proper JSDoc documentation. Critical services like ClaudeSdkService, MCPService, and strapiClient have minimal inline documentation, making it difficult for developers to understand function parameters, return types, and usage patterns.

## Rationale

Backend services are the core of the application. Developers frequently need to understand how services interact with Claude SDK, Strapi, and MCP servers. Without JSDoc, developers must read implementation details to understand function behavior.

---
*This spec was created from ideation and is pending detailed specification.*
