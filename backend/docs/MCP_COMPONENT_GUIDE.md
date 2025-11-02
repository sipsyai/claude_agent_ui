# MCP Configuration Component Guide

## 📋 Overview

MCP (Model Context Protocol) configuration has been refactored into **relation-based components** for centralized management with per-agent/skill customization.

**Created**: 2025-11-01
**Updated**: 2025-11-01
**Strapi Version**: 5.30.0
**Affected Content Types**: Agent, Skill

---

## 🎯 What Changed

### Old Approach (Direct Relation)

```
Agent/Skill
  └── mcpServers (relation) → MCP Server Collection
        └── mcpTools (relation) → MCP Tool Collection
```

**Problems:**
- No per-agent/skill customization
- Cannot enable/disable specific tools per agent
- No tool-specific permissions per agent
- All-or-nothing approach

### New Approach (Component-based Relation)

```
Agent/Skill
  └── mcpConfig (component, repeatable)
        ├── mcpServer (relation to MCP Server) ← Centralized
        ├── enabled (boolean)
        ├── customArgs/Env (JSON) - Override server defaults
        └── selectedTools (component, repeatable)
              ├── mcpTool (relation to MCP Tool) ← Centralized
              ├── enabled (boolean)
              ├── permissions (JSON)
              └── customConfig (JSON)
```

**Benefits:**
✅ Centralized MCP Server & Tool management
✅ Per-agent/skill customization (enable/disable, permissions)
✅ Tool-specific configurations per agent
✅ Server argument/env overrides
✅ Flexible tool selection
✅ Best of both worlds (shared + custom)

---

## 📦 Component Structure

### 1. `mcp.tool-selection` Component

**Purpose**: Select and configure MCP tools from the centralized MCP Tool collection

**Location**: `src/components/mcp/tool-selection.json`

**Fields**:
```json
{
  "mcpTool": "relation (oneToOne to api::mcp-tool.mcp-tool)",
  "enabled": "boolean (default: true)",
  "permissions": "json (tool-specific permissions)",
  "customConfig": "json (custom configuration overrides)"
}
```

**Key Feature**: Uses **relation** to MCP Tool collection, not embedded data

**Example**:
```json
{
  "mcpTool": 5,  // ID of the MCP Tool in the collection
  "enabled": true,
  "permissions": {
    "maxFileSize": 10485760,
    "allowedExtensions": [".txt", ".md", ".json"]
  },
  "customConfig": {
    "timeout": 5000
  }
}
```

---

### 2. `mcp.server-selection` Component

**Purpose**: Select MCP servers from the centralized MCP Server collection with tool selections

**Location**: `src/components/mcp/server-selection.json`

**Fields**:
```json
{
  "mcpServer": "relation (oneToOne to api::mcp-server.mcp-server, required)",
  "enabled": "boolean (default: true)",
  "customArgs": "json (override server command args)",
  "customEnv": "json (override server environment variables)",
  "customStartupTimeout": "integer (1000-300000ms)",
  "selectedTools": "component (mcp.tool-selection, repeatable)",
  "metadata": "json (additional metadata)"
}
```

**Key Feature**: Uses **relation** to MCP Server collection + nested tool selections

**Example**:
```json
{
  "mcpServer": 3,  // ID of the MCP Server in the collection
  "enabled": true,
  "customArgs": ["-y", "@modelcontextprotocol/server-filesystem", "/custom/path"],
  "customEnv": {
    "NODE_ENV": "production",
    "LOG_LEVEL": "debug"
  },
  "customStartupTimeout": 45000,
  "selectedTools": [
    {
      "mcpTool": 5,
      "enabled": true,
      "permissions": {"maxFileSize": 10485760}
    },
    {
      "mcpTool": 6,
      "enabled": false  // Disable write_file for this agent
    }
  ],
  "metadata": {
    "configuredBy": "admin",
    "configuredAt": "2025-11-01"
  }
}
```

---

## 🔄 Migration Guide

### Step 1: Build Strapi

```bash
cd backend
npm run build
```

### Step 2: Start Strapi

```bash
npm run develop
```

Wait for Strapi to start successfully.

### Step 3: Run Agent MCP Migration

```bash
curl -X POST http://localhost:1337/api/agents/migrate-mcp
```

**Expected Output**:
```json
{
  "success": true,
  "message": "MCP migration completed",
  "results": {
    "total": 9,
    "migrated": 5,
    "skipped": 4,
    "errors": []
  }
}
```

### Step 4: Run Skill MCP Migration

```bash
curl -X POST http://localhost:1337/api/skills/migrate-mcp
```

**Expected Output**:
```json
{
  "success": true,
  "message": "MCP migration completed",
  "results": {
    "total": 12,
    "migrated": 8,
    "skipped": 4,
    "errors": []
  }
}
```

---

## 📊 Before & After Comparison

### Agent Schema - Before

```json
{
  "mcpServers": {
    "type": "relation",
    "relation": "manyToMany",
    "target": "api::mcp-server.mcp-server"
  }
}
```

### Agent Schema - After

```json
{
  "mcpConfig": {
    "type": "component",
    "repeatable": true,
    "component": "shared.mcp-server-config",
    "description": "Embedded MCP server configurations"
  },
  "mcpServers": {
    "type": "relation",
    "relation": "manyToMany",
    "target": "api::mcp-server.mcp-server",
    "description": "Legacy: For backward compatibility"
  }
}
```

---

## 🚀 Usage Examples

### Creating an Agent with MCP Config

**Admin Panel:**
1. Go to Content Manager → Agent → Create
2. Fill basic fields (name, description, etc.)
3. Scroll to "MCP Config" section
4. Click "Add an entry"
5. **Select MCP Server** from dropdown (e.g., "Filesystem Server" - ID: 3)
6. Configure server overrides (optional):
   - Custom Args: `["-y", "@modelcontextprotocol/server-filesystem", "/custom/path"]`
   - Custom Env: `{"LOG_LEVEL": "debug"}`
   - Custom Startup Timeout: `45000`
7. Click "Add a component to Selected Tools"
8. **Select MCP Tool** from dropdown (filtered by selected server):
   - Choose "read_file" (ID: 5)
   - Set enabled: `true`
   - Set permissions: `{"maxFileSize": 10485760}`
9. Add more tools as needed
10. Save

**Key Difference**: You're **selecting** from existing MCP Servers and Tools, not creating new ones.

**API Request:**
```javascript
POST /api/agents

{
  "data": {
    "name": "FileSystemAgent",
    "slug": "filesystem-agent",
    "systemPrompt": "You are a file system agent...",
    "enabled": true,
    "mcpConfig": [
      {
        "mcpServer": 3,  // ID of existing MCP Server
        "enabled": true,
        "customArgs": ["-y", "@modelcontextprotocol/server-filesystem", "/custom/path"],
        "customEnv": {
          "LOG_LEVEL": "debug"
        },
        "customStartupTimeout": 45000,
        "selectedTools": [
          {
            "mcpTool": 5,  // ID of existing MCP Tool (read_file)
            "enabled": true,
            "permissions": {
              "maxFileSize": 10485760
            }
          },
          {
            "mcpTool": 6,  // ID of existing MCP Tool (write_file)
            "enabled": false
          }
        ]
      }
    ]
  }
}
```

### Querying Agent with MCP Config

```javascript
GET /api/agents?populate[mcpConfig][populate][mcpServer]=*&populate[mcpConfig][populate][selectedTools][populate][mcpTool]=*

// Response
{
  "data": {
    "id": 1,
    "attributes": {
      "name": "FileSystemAgent",
      "slug": "filesystem-agent",
      "mcpConfig": [
        {
          "id": 1,
          "enabled": true,
          "customArgs": ["-y", "@modelcontextprotocol/server-filesystem", "/custom/path"],
          "customEnv": {
            "LOG_LEVEL": "debug"
          },
          "mcpServer": {
            "data": {
              "id": 3,
              "attributes": {
                "name": "Filesystem Server",
                "command": "npx",
                "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"],
                "transport": "stdio"
              }
            }
          },
          "selectedTools": [
            {
              "id": 1,
              "enabled": true,
              "permissions": {"maxFileSize": 10485760},
              "mcpTool": {
                "data": {
                  "id": 5,
                  "attributes": {
                    "name": "read_file",
                    "description": "Read file contents"
                  }
                }
              }
            }
          ]
        }
      ]
    }
  }
}
```

---

## ✅ Best Practices

### 1. Create Centralized MCP Servers and Tools First

**✅ Good Workflow:**
1. Create MCP Server entries in the MCP Server collection
2. Create MCP Tool entries in the MCP Tool collection
3. Link tools to their parent servers
4. **Then** select servers/tools in Agent/Skill configs

**❌ Avoid:**
- Don't use the legacy `mcpServers` many-to-many relation
- Don't duplicate server/tool definitions across agents

### 2. Use Server Selections with Custom Overrides

Select a centralized server and override only what's needed per agent:

```javascript
{
  "mcpConfig": [
    {
      "mcpServer": 3,  // Select from MCP Server collection
      "enabled": true,
      "customArgs": ["-y", "@modelcontextprotocol/server-filesystem", "/agent-specific-path"],
      "customEnv": {
        "LOG_LEVEL": "debug"  // Override for this agent only
      }
    }
  ]
}
```

### 3. Select Only Needed Tools Per Agent

Not all agents need all tools from a server. Be selective:

```javascript
{
  "mcpConfig": [
    {
      "mcpServer": 3,  // Filesystem server
      "selectedTools": [
        {
          "mcpTool": 5,  // read_file - enabled
          "enabled": true
        },
        {
          "mcpTool": 6,  // write_file - disabled for safety
          "enabled": false
        }
        // list_directory tool not included = not available to this agent
      ]
    }
  ]
}
```

### 4. Use Tool Permissions for Fine-Grained Control

```javascript
{
  "selectedTools": [
    {
      "mcpTool": 5,  // read_file
      "enabled": true,
      "permissions": {
        "maxFileSize": 10485760,  // 10MB limit
        "allowedExtensions": [".txt", ".md", ".json"],
        "deniedPaths": ["/etc", "/var", "/.ssh"]
      },
      "customConfig": {
        "timeout": 5000,
        "encoding": "utf-8"
      }
    }
  ]
}
```

### 5. Reuse Servers Across Agents with Different Tool Sets

```javascript
// Agent 1: Read-only filesystem access
{
  "mcpConfig": [
    {
      "mcpServer": 3,
      "selectedTools": [
        {"mcpTool": 5, "enabled": true}  // read_file only
      ]
    }
  ]
}

// Agent 2: Full filesystem access
{
  "mcpConfig": [
    {
      "mcpServer": 3,
      "selectedTools": [
        {"mcpTool": 5, "enabled": true},  // read_file
        {"mcpTool": 6, "enabled": true},  // write_file
        {"mcpTool": 7, "enabled": true}   // delete_file
      ]
    }
  ]
}
```

### 6. Use Metadata for Agent-Specific Notes

```javascript
{
  "mcpConfig": [
    {
      "mcpServer": 3,
      "metadata": {
        "configuredBy": "admin@example.com",
        "configuredAt": "2025-11-01",
        "purpose": "Production agent with restricted file access",
        "reviewDate": "2025-12-01"
      }
    }
  ]
}
```

---

## 🔍 Comparison: Legacy vs Relation-Based Components

| Feature | Legacy Direct Relation | Relation-Based Components (NEW) |
|---------|------------------------|--------------------------------|
| **Architecture** | `Agent → mcpServers (many-to-many)` | `Agent → mcpConfig (component) → mcpServer (relation)` |
| **Customization** | None (all-or-nothing) | Full per-agent control |
| **Tool Selection** | All tools from server | Select specific tools per agent |
| **Server Overrides** | Not possible | Custom args, env, timeout per agent |
| **Tool Permissions** | Global only | Per-agent, per-tool permissions |
| **Enable/Disable** | Server-level only | Server + individual tool level |
| **Populate Complexity** | Medium | Higher (nested populate) |
| **Data Duplication** | No | Minimal (only overrides stored) |
| **Centralized Management** | Yes | Yes (servers/tools in collections) |
| **Per-Agent Flexibility** | No | Yes (each agent customizes) |
| **Best For** | Simple shared servers | Production with fine-grained control |

**Key Advantage**: Relation-based components give you **centralized server/tool management** + **per-agent customization**.

---

## 🔧 Troubleshooting

### Issue: Migration skipped some agents

**Reason**: Agents already have `mcpConfig` or no `mcpServers` relation.

**Solution**: Check the migration results. Skipped items are expected if:
- Agent already has `mcpConfig`
- Agent has no `mcpServers` relations

### Issue: Tools not showing in mcpConfig

**Reason**: MCP Server had no tools in the relation.

**Solution**: Tools are migrated from `mcpServer.mcpTools` relation. If server has no tools, the `tools` array will be empty. Add tools manually in Admin Panel.

### Issue: Cannot see mcpConfig in Admin Panel

**Reason**: Admin Panel cache or build issue.

**Solution**:
```bash
npm run build
```

Then refresh browser with Ctrl+Shift+R.

---

## 📈 Performance Considerations

### Legacy Approach (Direct Many-to-Many)

```javascript
// Multiple joins across many-to-many tables
const agent = await strapi.entityService.findOne('api::agent.agent', id, {
  populate: {
    mcpServers: {
      populate: {
        mcpTools: true
      }
    }
  }
});

// Database queries:
// 1. Get agent
// 2. Get mcp_servers via agents_mcpServers_links junction table
// 3. Get mcp_tools via mcpServers_mcpTools_links junction table
// Result: Multiple joins, but NO per-agent customization
```

### New Approach (Relation-Based Components)

```javascript
// Component + nested relations
const agent = await strapi.entityService.findOne('api::agent.agent', id, {
  populate: {
    mcpConfig: {
      populate: {
        mcpServer: true,
        selectedTools: {
          populate: {
            mcpTool: true
          }
        }
      }
    }
  }
});

// Database queries:
// 1. Get agent with mcpConfig component data
// 2. Get related mcpServer records
// 3. Get selectedTools component data with mcpTool relations
// Result: More queries, but WITH per-agent customization + overrides
```

**Trade-off**: Slightly more complex queries, but you gain:
- Per-agent server configuration (customArgs, customEnv)
- Per-agent tool selection (not forced to use all tools)
- Per-tool permissions and customization
- Enable/disable tools individually per agent

**Recommendation**: The flexibility and control are worth the minimal query overhead.

---

## 🎨 Admin Panel UI

### Legacy UI (Direct Relation)

```
Agent Edit Page
├── Basic Fields
├── MCP Servers (Multi-Select Dropdown)
│   └── Select multiple servers
│   └── No customization options
│   └── All tools included (no selection)
└── (No per-agent configuration)
```

**Problem**: All-or-nothing approach with no customization.

### New UI (Relation-Based Components)

```
Agent Edit Page
├── Basic Fields
├── MCP Config (Repeatable Component)
│   └── [Server Config 1]
│       ├── MCP Server (Dropdown - Select from MCP Server collection)
│       ├── Enabled (Toggle)
│       ├── Custom Args (JSON) - Override server defaults
│       ├── Custom Env (JSON) - Override environment variables
│       ├── Custom Startup Timeout (Number)
│       ├── Metadata (JSON)
│       └── Selected Tools (Repeatable Component)
│           ├── [Tool 1]
│           │   ├── MCP Tool (Dropdown - Select from MCP Tool collection)
│           │   ├── Enabled (Toggle)
│           │   ├── Permissions (JSON)
│           │   └── Custom Config (JSON)
│           ├── [Tool 2]
│           │   ├── MCP Tool (Dropdown)
│           │   ├── Enabled (Toggle)
│           │   └── ...
│           └── [+ Add tool selection]
│   └── [+ Add server config]
└── MCP Servers (Legacy - kept for backward compatibility)
```

**Benefits**:
- Select servers from dropdown (centralized management)
- Select specific tools per server per agent
- Override server settings per agent
- Enable/disable at server and tool level

---

## 🔄 Backward Compatibility

**Both approaches work simultaneously:**

1. **New Component-based**: Use `mcpConfig` for new agents/skills
2. **Legacy Relation-based**: Existing `mcpServers` relations still work

**Migration is optional but recommended** for:
- Better performance
- Self-contained configs
- Easier customization per agent/skill

---

## 📝 Next Steps

1. ✅ Run migration for Agents
2. ✅ Run migration for Skills
3. ✅ Verify in Admin Panel
4. ⏳ Update frontend to use `mcpConfig`
5. ⏳ Gradually phase out `mcpServers` relation
6. ⏳ Remove migration endpoints (after all data migrated)

---

## 📚 Resources

- [Strapi Components Guide](../../../.claude/skills/strapi-project-helper/docs/19-components.md)
- [MCP Protocol Documentation](https://modelcontextprotocol.io)
- [Agent Schema Changes](./AGENT_SCHEMA_CHANGES.md)

---

## 🎉 Summary

✅ **Created**: 2 new relation-based components:
   - `mcp.tool-selection` - Select tools from MCP Tool collection
   - `mcp.server-selection` - Select servers from MCP Server collection with tool selections

✅ **Updated**: Agent and Skill schemas with `mcpConfig` (relation-based component)

✅ **Architecture**: Hybrid approach
   - MCP Servers and Tools stored in centralized collections
   - Agents/Skills select and customize via relation-based components

✅ **Flexibility**: Full per-agent/skill control
   - Select specific tools per agent (not all-or-nothing)
   - Override server args, env, timeout per agent
   - Set tool permissions per agent
   - Enable/disable at server and tool level

✅ **Centralized Management**:
   - Update MCP Server once, affects all agents using it
   - Update MCP Tool once, affects all agents using it
   - But each agent can still override/customize

✅ **Backward Compatible**: Legacy `mcpServers` relation still available

MCP configuration is now centralized + customizable! 🚀
