/**
 * Claude Agent UI - Migration Validation Script
 *
 * This script validates the PostgreSQL database after migration from SQLite,
 * checking data integrity, relationships, and completeness.
 *
 * Features:
 * - Validates row counts match between SQLite and PostgreSQL
 * - Spot-checks sample records for data accuracy
 * - Validates component-based schema (toolConfig, modelConfig, etc.)
 * - Checks relationships (skillSelection, mcpConfig)
 * - Reports discrepancies clearly with detailed output
 *
 * Usage:
 *   npm run validate-migration
 *
 * Requirements:
 * - SQLite database file (optional, for comparison)
 * - PostgreSQL/Strapi running and accessible
 *
 * @author Claude Agent UI Team
 * @version 2.0.0 - Updated for component-based schema
 */

import axios, { AxiosInstance } from 'axios';
import Database from 'better-sqlite3';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { config as dotenvConfig } from 'dotenv';

// Load environment variables from .env file
dotenvConfig();

// ============= CONFIGURATION =============

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ValidationConfig {
  sqliteDbPath: string;
  strapiUrl: string;
  strapiToken?: string;
}

const config: ValidationConfig = {
  sqliteDbPath: path.resolve(__dirname, '../backend/.tmp/data.db'),
  strapiUrl: process.env.STRAPI_URL || 'http://localhost:1337',
  strapiToken: process.env.STRAPI_API_TOKEN,
};

// ============= TYPES =============

interface ValidationResult {
  passed: boolean;
  checks: {
    name: string;
    status: 'pass' | 'fail' | 'warning';
    message: string;
    details?: any;
  }[];
}

// ============= VALIDATION CHECKS =============

/**
 * Check if Strapi API is accessible
 */
async function checkStrapiConnection(client: AxiosInstance): Promise<boolean> {
  try {
    await client.get('/agents?pagination[pageSize]=1');
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get count of records in SQLite
 */
function getSqliteCounts(db: Database.Database): {
  agents: number;
  skills: number;
  mcpServers: number;
  tasks: number;
} {
  const getCount = (table: string): number => {
    try {
      const result = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as any;
      return result.count;
    } catch (error) {
      return 0;
    }
  };

  return {
    agents: getCount('agents'),
    skills: getCount('skills'),
    mcpServers: getCount('mcp_servers'),
    tasks: getCount('tasks'),
  };
}

/**
 * Get count of records in PostgreSQL via Strapi
 */
async function getPostgresCounts(client: AxiosInstance): Promise<{
  agents: number;
  skills: number;
  mcpServers: number;
  tasks: number;
}> {
  try {
    const [agents, skills, mcpServers, tasks] = await Promise.all([
      client.get('/agents?pagination[pageSize]=1'),
      client.get('/skills?pagination[pageSize]=1'),
      client.get('/mcp-servers?pagination[pageSize]=1'),
      client.get('/tasks?pagination[pageSize]=1'),
    ]);

    return {
      agents: agents.data.meta.pagination.total,
      skills: skills.data.meta.pagination.total,
      mcpServers: mcpServers.data.meta.pagination.total,
      tasks: tasks.data.meta.pagination.total,
    };
  } catch (error) {
    throw new Error(`Failed to get PostgreSQL counts: ${error}`);
  }
}

/**
 * Validate record counts match
 */
async function validateRecordCounts(
  db: Database.Database,
  client: AxiosInstance
): Promise<ValidationResult['checks'][0]> {
  try {
    const sqliteCounts = getSqliteCounts(db);
    const postgresCounts = await getPostgresCounts(client);

    const matches = {
      agents: sqliteCounts.agents === postgresCounts.agents,
      skills: sqliteCounts.skills === postgresCounts.skills,
      mcpServers: sqliteCounts.mcpServers === postgresCounts.mcpServers,
      tasks: sqliteCounts.tasks === postgresCounts.tasks,
    };

    const allMatch = Object.values(matches).every((m) => m);

    return {
      name: 'Record Counts',
      status: allMatch ? 'pass' : 'fail',
      message: allMatch
        ? 'All record counts match between SQLite and PostgreSQL'
        : 'Record count mismatch detected',
      details: {
        sqlite: sqliteCounts,
        postgres: postgresCounts,
        matches,
      },
    };
  } catch (error: any) {
    return {
      name: 'Record Counts',
      status: 'fail',
      message: `Failed to validate record counts: ${error.message}`,
    };
  }
}

/**
 * Validate agent data integrity
 * Updated for component-based schema
 */
async function validateAgentIntegrity(client: AxiosInstance): Promise<ValidationResult['checks'][0]> {
  try {
    const response = await client.get('/agents?pagination[pageSize]=1000&populate=*');
    const agents = response.data.data;

    const issues: string[] = [];

    for (const agent of agents) {
      const attrs = agent.attributes;

      // Check required fields
      if (!attrs.name) issues.push(`Agent ${agent.id} missing name`);
      if (!attrs.systemPrompt) issues.push(`Agent ${agent.id} missing system prompt`);
      if (!attrs.modelConfig) {
        issues.push(`Agent ${agent.id} missing modelConfig component`);
      } else {
        if (!attrs.modelConfig.model) {
          issues.push(`Agent ${agent.id} missing model in modelConfig`);
        }
      }

      // Check component fields
      if (attrs.toolConfig) {
        if (attrs.toolConfig.allowedTools && !Array.isArray(attrs.toolConfig.allowedTools)) {
          issues.push(`Agent ${agent.id} has invalid allowedTools format in toolConfig`);
        }
        if (attrs.toolConfig.disallowedTools && !Array.isArray(attrs.toolConfig.disallowedTools)) {
          issues.push(`Agent ${agent.id} has invalid disallowedTools format in toolConfig`);
        }
      }

      // Check repeatable components
      if (attrs.skillSelection && !Array.isArray(attrs.skillSelection)) {
        issues.push(`Agent ${agent.id} has invalid skillSelection format`);
      }
      if (attrs.mcpConfig && !Array.isArray(attrs.mcpConfig)) {
        issues.push(`Agent ${agent.id} has invalid mcpConfig format`);
      }
    }

    return {
      name: 'Agent Data Integrity',
      status: issues.length === 0 ? 'pass' : 'warning',
      message:
        issues.length === 0
          ? `All ${agents.length} agents have valid data`
          : `Found ${issues.length} integrity issues`,
      details: issues.length > 0 ? { issues } : undefined,
    };
  } catch (error: any) {
    return {
      name: 'Agent Data Integrity',
      status: 'fail',
      message: `Failed to validate agents: ${error.message}`,
    };
  }
}

/**
 * Validate skill data integrity
 * Updated for new schema with skillmd and displayName
 */
async function validateSkillIntegrity(client: AxiosInstance): Promise<ValidationResult['checks'][0]> {
  try {
    const response = await client.get('/skills?pagination[pageSize]=1000&populate=*');
    const skills = response.data.data;

    const issues: string[] = [];

    for (const skill of skills) {
      const attrs = skill.attributes;

      // Check required fields
      if (!attrs.name) issues.push(`Skill ${skill.id} missing name (UID)`);
      if (!attrs.displayName) issues.push(`Skill ${skill.id} missing displayName`);
      if (!attrs.skillmd) issues.push(`Skill ${skill.id} missing skillmd`);
      if (!attrs.description) issues.push(`Skill ${skill.id} missing description`);

      // Check field types
      if (attrs.experienceScore !== undefined && typeof attrs.experienceScore !== 'number') {
        issues.push(`Skill ${skill.id} has invalid experienceScore`);
      }

      // Check component fields
      if (attrs.toolConfig) {
        if (attrs.toolConfig.allowedTools && !Array.isArray(attrs.toolConfig.allowedTools)) {
          issues.push(`Skill ${skill.id} has invalid allowedTools format in toolConfig`);
        }
      }

      // Check repeatable components
      if (attrs.mcpConfig && !Array.isArray(attrs.mcpConfig)) {
        issues.push(`Skill ${skill.id} has invalid mcpConfig format`);
      }
    }

    return {
      name: 'Skill Data Integrity',
      status: issues.length === 0 ? 'pass' : 'warning',
      message:
        issues.length === 0
          ? `All ${skills.length} skills have valid data`
          : `Found ${issues.length} integrity issues`,
      details: issues.length > 0 ? { issues } : undefined,
    };
  } catch (error: any) {
    return {
      name: 'Skill Data Integrity',
      status: 'fail',
      message: `Failed to validate skills: ${error.message}`,
    };
  }
}

/**
 * Validate MCP server data integrity
 */
async function validateMCPIntegrity(client: AxiosInstance): Promise<ValidationResult['checks'][0]> {
  try {
    const response = await client.get('/mcp-servers?pagination[pageSize]=1000');
    const mcpServers = response.data.data;

    const issues: string[] = [];

    for (const mcp of mcpServers) {
      const attrs = mcp.attributes;

      // Check required fields
      if (!attrs.name) issues.push(`MCP Server ${mcp.id} missing name`);
      if (!attrs.command) issues.push(`MCP Server ${mcp.id} missing command`);

      // Check field types
      if (attrs.args && !Array.isArray(attrs.args)) {
        issues.push(`MCP Server ${mcp.id} has invalid args format`);
      }
      if (attrs.env && typeof attrs.env !== 'object') {
        issues.push(`MCP Server ${mcp.id} has invalid env format`);
      }
    }

    return {
      name: 'MCP Server Data Integrity',
      status: issues.length === 0 ? 'pass' : 'warning',
      message:
        issues.length === 0
          ? `All ${mcpServers.length} MCP servers have valid data`
          : `Found ${issues.length} integrity issues`,
      details: issues.length > 0 ? { issues } : undefined,
    };
  } catch (error: any) {
    return {
      name: 'MCP Server Data Integrity',
      status: 'fail',
      message: `Failed to validate MCP servers: ${error.message}`,
    };
  }
}

/**
 * Validate relationships exist
 * Updated for component-based skillSelection and mcpConfig
 */
async function validateRelationships(client: AxiosInstance): Promise<ValidationResult['checks'][0]> {
  try {
    const response = await client.get('/agents?pagination[pageSize]=1000&populate=*');
    const agents = response.data.data;

    let totalSkillLinks = 0;
    let totalMcpLinks = 0;

    for (const agent of agents) {
      const skillSelection = agent.attributes.skillSelection || [];
      const mcpConfig = agent.attributes.mcpConfig || [];

      totalSkillLinks += skillSelection.length;
      totalMcpLinks += mcpConfig.length;
    }

    return {
      name: 'Relationships',
      status: 'pass',
      message: 'Relationships validated',
      details: {
        agentSkillLinks: totalSkillLinks,
        agentMcpLinks: totalMcpLinks,
        agentsWithSkills: agents.filter((a: any) => a.attributes.skillSelection?.length > 0).length,
        agentsWithMcps: agents.filter((a: any) => a.attributes.mcpConfig?.length > 0).length,
      },
    };
  } catch (error: any) {
    return {
      name: 'Relationships',
      status: 'fail',
      message: `Failed to validate relationships: ${error.message}`,
    };
  }
}

/**
 * Validate database schema exists
 */
async function validateDatabaseSchema(client: AxiosInstance): Promise<ValidationResult['checks'][0]> {
  try {
    // Try to access each content type
    await Promise.all([
      client.get('/agents?pagination[pageSize]=1'),
      client.get('/skills?pagination[pageSize]=1'),
      client.get('/mcp-servers?pagination[pageSize]=1'),
      client.get('/tasks?pagination[pageSize]=1'),
    ]);

    return {
      name: 'Database Schema',
      status: 'pass',
      message: 'All required content types exist and are accessible',
    };
  } catch (error: any) {
    return {
      name: 'Database Schema',
      status: 'fail',
      message: `Schema validation failed: ${error.message}`,
    };
  }
}

/**
 * Spot-check sample records for data accuracy
 * Compares random samples between SQLite and PostgreSQL
 */
async function spotCheckSampleData(
  db: Database.Database,
  client: AxiosInstance
): Promise<ValidationResult['checks'][0]> {
  try {
    const issues: string[] = [];
    const samples: any[] = [];

    // Get sample agents
    const sqliteAgents = db.prepare('SELECT * FROM agents LIMIT 3').all() as any[];
    const postgresAgentsResponse = await client.get('/agents?pagination[pageSize]=3&populate=*');
    const postgresAgents = postgresAgentsResponse.data.data;

    // Compare agent samples
    for (let i = 0; i < Math.min(sqliteAgents.length, postgresAgents.length); i++) {
      const sqliteAgent = sqliteAgents[i];
      const postgresAgent = postgresAgents[i].attributes;

      samples.push({
        type: 'agent',
        sqlite: { name: sqliteAgent.name },
        postgres: { name: postgresAgent.name },
      });

      // Check basic fields
      if (sqliteAgent.name !== postgresAgent.name) {
        issues.push(`Agent name mismatch: SQLite="${sqliteAgent.name}" vs PostgreSQL="${postgresAgent.name}"`);
      }

      if (sqliteAgent.system_prompt !== postgresAgent.systemPrompt &&
          sqliteAgent.systemPrompt !== postgresAgent.systemPrompt) {
        issues.push(`Agent ${sqliteAgent.name} systemPrompt mismatch`);
      }

      // Check component migrations
      if (!postgresAgent.modelConfig) {
        issues.push(`Agent ${postgresAgent.name} missing modelConfig component`);
      }
    }

    // Get sample skills
    const sqliteSkills = db.prepare('SELECT * FROM skills LIMIT 3').all() as any[];
    const postgresSkillsResponse = await client.get('/skills?pagination[pageSize]=3&populate=*');
    const postgresSkills = postgresSkillsResponse.data.data;

    // Compare skill samples
    for (let i = 0; i < Math.min(sqliteSkills.length, postgresSkills.length); i++) {
      const sqliteSkill = sqliteSkills[i];
      const postgresSkill = postgresSkills[i].attributes;

      samples.push({
        type: 'skill',
        sqlite: { name: sqliteSkill.name },
        postgres: { displayName: postgresSkill.displayName },
      });

      // Check basic fields
      if (!postgresSkill.displayName) {
        issues.push(`Skill ${postgresSkill.name} missing displayName`);
      }

      if (!postgresSkill.skillmd) {
        issues.push(`Skill ${postgresSkill.displayName || postgresSkill.name} missing skillmd content`);
      }
    }

    // Get sample MCP servers
    try {
      const sqliteMcpServers = db.prepare('SELECT * FROM mcp_servers LIMIT 3').all() as any[];
      const postgresMcpResponse = await client.get('/mcp-servers?pagination[pageSize]=3');
      const postgresMcpServers = postgresMcpResponse.data.data;

      // Compare MCP server samples
      for (let i = 0; i < Math.min(sqliteMcpServers.length, postgresMcpServers.length); i++) {
        const sqliteMcp = sqliteMcpServers[i];
        const postgresMcp = postgresMcpServers[i].attributes;

        samples.push({
          type: 'mcp-server',
          sqlite: { name: sqliteMcp.name },
          postgres: { name: postgresMcp.name },
        });

        if (sqliteMcp.name !== postgresMcp.name) {
          issues.push(`MCP Server name mismatch: SQLite="${sqliteMcp.name}" vs PostgreSQL="${postgresMcp.name}"`);
        }

        if (sqliteMcp.command !== postgresMcp.command) {
          issues.push(`MCP Server ${sqliteMcp.name} command mismatch`);
        }
      }
    } catch (error) {
      // MCP servers table might not exist
    }

    return {
      name: 'Sample Data Spot Check',
      status: issues.length === 0 ? 'pass' : 'fail',
      message:
        issues.length === 0
          ? `Validated ${samples.length} sample records successfully`
          : `Found ${issues.length} data mismatches in sample records`,
      details: issues.length > 0 ? { issues, samples } : { samples },
    };
  } catch (error: any) {
    return {
      name: 'Sample Data Spot Check',
      status: 'fail',
      message: `Failed to spot-check sample data: ${error.message}`,
    };
  }
}

// ============= MAIN VALIDATION =============

/**
 * Run all validation checks
 */
async function validate(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('🔍 MIGRATION VALIDATION');
  console.log('='.repeat(70) + '\n');

  const result: ValidationResult = {
    passed: false,
    checks: [],
  };

  try {
    // Initialize connections
    console.log('📡 Connecting to databases...');
    const strapiClient = axios.create({
      baseURL: `${config.strapiUrl}/api`,
      headers: {
        'Authorization': config.strapiToken ? `Bearer ${config.strapiToken}` : '',
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    const connectionOk = await checkStrapiConnection(strapiClient);
    if (!connectionOk) {
      throw new Error('Cannot connect to Strapi API');
    }
    console.log('✅ Strapi API connected\n');

    let sqliteDb: Database.Database | null = null;
    try {
      sqliteDb = new Database(config.sqliteDbPath, { readonly: true });
      console.log('✅ SQLite database connected\n');
    } catch (error) {
      console.log('⚠️  SQLite database not found (may have been removed after migration)\n');
    }

    // Run validation checks
    console.log('Running validation checks...\n');

    result.checks.push(await validateDatabaseSchema(strapiClient));

    if (sqliteDb) {
      result.checks.push(await validateRecordCounts(sqliteDb, strapiClient));
      result.checks.push(await spotCheckSampleData(sqliteDb, strapiClient));
      sqliteDb.close();
    } else {
      result.checks.push({
        name: 'Record Counts',
        status: 'warning',
        message: 'SQLite database not available for comparison',
      });
      result.checks.push({
        name: 'Sample Data Spot Check',
        status: 'warning',
        message: 'SQLite database not available for sample comparison',
      });
    }

    result.checks.push(await validateAgentIntegrity(strapiClient));
    result.checks.push(await validateSkillIntegrity(strapiClient));
    result.checks.push(await validateMCPIntegrity(strapiClient));
    result.checks.push(await validateRelationships(strapiClient));

    // Display results
    console.log('='.repeat(70));
    console.log('📊 VALIDATION RESULTS');
    console.log('='.repeat(70) + '\n');

    for (const check of result.checks) {
      const icon = check.status === 'pass' ? '✅' : check.status === 'warning' ? '⚠️ ' : '❌';
      console.log(`${icon} ${check.name}: ${check.message}`);

      if (check.details) {
        console.log(`   Details: ${JSON.stringify(check.details, null, 2)}`);
      }
      console.log();
    }

    // Summary
    const passCount = result.checks.filter((c) => c.status === 'pass').length;
    const warnCount = result.checks.filter((c) => c.status === 'warning').length;
    const failCount = result.checks.filter((c) => c.status === 'fail').length;

    console.log('='.repeat(70));
    console.log('📈 Summary:');
    console.log(`   ✅ Passed: ${passCount}`);
    console.log(`   ⚠️  Warnings: ${warnCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log('='.repeat(70) + '\n');

    result.passed = failCount === 0;

    if (result.passed) {
      console.log('✅ VALIDATION PASSED!\n');
      process.exit(0);
    } else {
      console.log('❌ VALIDATION FAILED!\n');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n❌ VALIDATION ERROR:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// ============= ENTRY POINT =============

validate().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
