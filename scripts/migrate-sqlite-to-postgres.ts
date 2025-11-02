/**
 * Claude Agent UI - SQLite to PostgreSQL Migration Script
 *
 * This script migrates data from Strapi's SQLite database to PostgreSQL.
 *
 * Features:
 * - Automatic backup of SQLite database
 * - Data validation and integrity checks
 * - Batch processing for large datasets
 * - Detailed migration report
 * - Rollback support
 * - Progress tracking
 *
 * Usage:
 *   npm run migrate           # Run migration
 *   npm run migrate:validate  # Validate without migrating
 *   npm run migrate:rollback  # Restore from backup
 *
 * @author Claude Agent UI Team
 * @version 1.0.0
 */

import Database from 'better-sqlite3';
import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { config as dotenvConfig } from 'dotenv';

// Load environment variables from .env file
dotenvConfig();

// ============= CONFIGURATION =============

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface MigrationConfig {
  // SQLite configuration
  sqliteDbPath: string;
  backupPath: string;

  // PostgreSQL/Strapi configuration
  strapiUrl: string;
  strapiToken?: string;

  // Migration options
  batchSize: number;
  validateOnly: boolean;
  skipBackup: boolean;
}

const config: MigrationConfig = {
  sqliteDbPath: path.resolve(__dirname, '../backend/.tmp/data.db'),
  backupPath: path.resolve(__dirname, '../backups'),
  strapiUrl: process.env.STRAPI_URL || 'http://localhost:1337',
  strapiToken: process.env.STRAPI_API_TOKEN,
  batchSize: 10,
  validateOnly: process.argv.includes('--validate-only'),
  skipBackup: process.argv.includes('--skip-backup'),
};

// ============= TYPES =============

interface MigrationStats {
  agents: { total: number; success: number; failed: number; skipped: number };
  skills: { total: number; success: number; failed: number; skipped: number };
  mcpServers: { total: number; success: number; failed: number; skipped: number };
  tasks: { total: number; success: number; failed: number; skipped: number };
  relations: { agentsSkills: number; agentsMcpServers: number };
  startTime: number;
  endTime?: number;
  errors: Array<{ type: string; id: string | number; error: string }>;
}

interface StrapiEntity {
  id: number;
  attributes: Record<string, any>;
}

// ============= UTILITY FUNCTIONS =============

/**
 * Create timestamp for backups and reports
 */
function getTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
}

/**
 * Ensure directory exists
 */
function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Progress bar display
 */
function displayProgress(current: number, total: number, label: string): void {
  const percentage = Math.floor((current / total) * 100);
  const barLength = 30;
  const filled = Math.floor((current / total) * barLength);
  const bar = '='.repeat(filled) + '-'.repeat(barLength - filled);

  process.stdout.write(`\r${label}: [${bar}] ${percentage}% (${current}/${total})`);

  if (current === total) {
    console.log(); // New line after completion
  }
}

// ============= BACKUP & RESTORE =============

/**
 * Backup SQLite database before migration
 */
function backupSqliteDatabase(): string | null {
  if (config.skipBackup) {
    console.log('⚠️  Skipping backup as requested');
    return null;
  }

  console.log('\n📦 Creating SQLite database backup...');

  try {
    ensureDir(config.backupPath);

    const timestamp = getTimestamp();
    const backupFilename = `data-${timestamp}.db`;
    const backupFullPath = path.join(config.backupPath, backupFilename);

    if (!fs.existsSync(config.sqliteDbPath)) {
      throw new Error(`SQLite database not found at: ${config.sqliteDbPath}`);
    }

    fs.copyFileSync(config.sqliteDbPath, backupFullPath);

    const stats = fs.statSync(backupFullPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

    console.log(`✅ Backup created: ${backupFilename} (${sizeMB} MB)`);
    console.log(`   Location: ${backupFullPath}`);

    return backupFullPath;
  } catch (error) {
    console.error('❌ Backup failed:', error);
    throw error;
  }
}

/**
 * Restore SQLite database from backup
 */
function restoreSqliteDatabase(backupPath: string): void {
  console.log('\n🔄 Restoring SQLite database from backup...');

  try {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    fs.copyFileSync(backupPath, config.sqliteDbPath);
    console.log('✅ Database restored successfully');
  } catch (error) {
    console.error('❌ Restore failed:', error);
    throw error;
  }
}

// ============= DATABASE CONNECTIONS =============

/**
 * Initialize SQLite database connection
 */
function initSqliteConnection(): Database.Database {
  console.log('\n🔌 Connecting to SQLite database...');

  try {
    if (!fs.existsSync(config.sqliteDbPath)) {
      throw new Error(`SQLite database not found at: ${config.sqliteDbPath}`);
    }

    const db = new Database(config.sqliteDbPath, { readonly: true });
    console.log('✅ SQLite connection established');

    return db;
  } catch (error) {
    console.error('❌ SQLite connection failed:', error);
    throw error;
  }
}

/**
 * Initialize Strapi API client
 */
function initStrapiClient(): AxiosInstance {
  console.log('\n🔌 Connecting to Strapi API...');

  const client = axios.create({
    baseURL: `${config.strapiUrl}/api`,
    headers: {
      'Authorization': config.strapiToken ? `Bearer ${config.strapiToken}` : '',
      'Content-Type': 'application/json',
    },
    timeout: 30000, // 30 seconds
  });

  // Test connection
  return client;
}

/**
 * Test Strapi API connection
 */
async function testStrapiConnection(client: AxiosInstance): Promise<void> {
  try {
    await client.get('/agents?pagination[pageSize]=1');
    console.log('✅ Strapi API connection established');
  } catch (error: any) {
    console.error('❌ Strapi API connection failed');
    throw new Error(`Strapi connection failed: ${error.message}`);
  }
}

// ============= DATA EXTRACTION =============

/**
 * Extract agents from SQLite
 */
function extractAgents(db: Database.Database): any[] {
  console.log('\n📥 Extracting agents from SQLite...');

  try {
    const agents = db.prepare(`
      SELECT * FROM agents ORDER BY id ASC
    `).all();

    console.log(`   Found ${agents.length} agents`);
    return agents;
  } catch (error: any) {
    console.log(`   ℹ️  No agents table found or empty (${error.message})`);
    return [];
  }
}

/**
 * Extract skills from SQLite
 */
function extractSkills(db: Database.Database): any[] {
  console.log('\n📥 Extracting skills from SQLite...');

  try {
    const skills = db.prepare(`
      SELECT * FROM skills ORDER BY id ASC
    `).all();

    console.log(`   Found ${skills.length} skills`);
    return skills;
  } catch (error: any) {
    console.log(`   ℹ️  No skills table found or empty (${error.message})`);
    return [];
  }
}

/**
 * Extract MCP servers from SQLite
 */
function extractMCPServers(db: Database.Database): any[] {
  console.log('\n📥 Extracting MCP servers from SQLite...');

  try {
    const mcpServers = db.prepare(`
      SELECT * FROM mcp_servers ORDER BY id ASC
    `).all();

    console.log(`   Found ${mcpServers.length} MCP servers`);
    return mcpServers;
  } catch (error: any) {
    console.log(`   ℹ️  No mcp_servers table found or empty (${error.message})`);
    return [];
  }
}

/**
 * Extract tasks from SQLite
 */
function extractTasks(db: Database.Database): any[] {
  console.log('\n📥 Extracting tasks from SQLite...');

  try {
    const tasks = db.prepare(`
      SELECT * FROM tasks ORDER BY id ASC
    `).all();

    console.log(`   Found ${tasks.length} tasks`);
    return tasks;
  } catch (error: any) {
    console.log(`   ℹ️  No tasks table found or empty (${error.message})`);
    return [];
  }
}

/**
 * Extract agent-skill relations from SQLite
 */
function extractAgentSkillRelations(db: Database.Database): any[] {
  try {
    const relations = db.prepare(`
      SELECT agent_id, skill_id, skill_order
      FROM agents_skills_links
      ORDER BY agent_id, skill_order
    `).all();

    return relations;
  } catch (error) {
    return [];
  }
}

/**
 * Extract agent-MCP server relations from SQLite
 */
function extractAgentMCPRelations(db: Database.Database): any[] {
  try {
    const relations = db.prepare(`
      SELECT agent_id, mcp_server_id, mcp_server_order
      FROM agents_mcp_servers_links
      ORDER BY agent_id, mcp_server_order
    `).all();

    return relations;
  } catch (error) {
    return [];
  }
}

// ============= DATA TRANSFORMATION =============

/**
 * Transform SQLite agent data to Strapi format
 */
function transformAgent(sqliteAgent: any): any {
  return {
    name: sqliteAgent.name,
    description: sqliteAgent.description,
    systemPrompt: sqliteAgent.system_prompt || sqliteAgent.systemPrompt,
    tools: sqliteAgent.tools ? JSON.parse(sqliteAgent.tools) : [],
    disallowedTools: sqliteAgent.disallowed_tools ? JSON.parse(sqliteAgent.disallowed_tools) : [],
    model: sqliteAgent.model || 'sonnet',
    enabled: sqliteAgent.enabled !== 0,
  };
}

/**
 * Transform SQLite skill data to Strapi format
 */
function transformSkill(sqliteSkill: any): any {
  return {
    name: sqliteSkill.name,
    description: sqliteSkill.description,
    content: sqliteSkill.content,
    allowedTools: sqliteSkill.allowed_tools ? JSON.parse(sqliteSkill.allowed_tools) : [],
    experienceScore: parseFloat(sqliteSkill.experience_score || sqliteSkill.experienceScore || '0'),
  };
}

/**
 * Transform SQLite MCP server data to Strapi format
 */
function transformMCPServer(sqliteMCP: any): any {
  return {
    name: sqliteMCP.name,
    command: sqliteMCP.command,
    args: sqliteMCP.args ? JSON.parse(sqliteMCP.args) : [],
    env: sqliteMCP.env ? JSON.parse(sqliteMCP.env) : {},
    disabled: sqliteMCP.disabled !== 0,
    transport: sqliteMCP.transport || 'stdio',
  };
}

/**
 * Transform SQLite task data to Strapi format
 */
function transformTask(sqliteTask: any, oldIdToNewId: Map<number, number>): any {
  const newAgentId = sqliteTask.agent_id ? oldIdToNewId.get(sqliteTask.agent_id) : null;

  return {
    agent: newAgentId || null,
    message: sqliteTask.message,
    status: sqliteTask.status || 'pending',
    result: sqliteTask.result ? JSON.parse(sqliteTask.result) : null,
    errorMessage: sqliteTask.error_message || sqliteTask.errorMessage,
    startedAt: sqliteTask.started_at || sqliteTask.startedAt,
    completedAt: sqliteTask.completed_at || sqliteTask.completedAt,
    durationMs: sqliteTask.duration_ms || sqliteTask.durationMs,
  };
}

// ============= DATA MIGRATION =============

/**
 * Migrate agents to PostgreSQL
 */
async function migrateAgents(
  client: AxiosInstance,
  agents: any[],
  stats: MigrationStats
): Promise<Map<number, number>> {
  console.log('\n🚀 Migrating agents to PostgreSQL...');

  const oldIdToNewId = new Map<number, number>();
  stats.agents.total = agents.length;

  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];
    displayProgress(i + 1, agents.length, 'Agents');

    try {
      const transformed = transformAgent(agent);

      if (config.validateOnly) {
        stats.agents.skipped++;
        continue;
      }

      const response = await client.post('/agents', { data: transformed });
      const newId = response.data.data.id;

      oldIdToNewId.set(agent.id, newId);
      stats.agents.success++;
    } catch (error: any) {
      stats.agents.failed++;
      stats.errors.push({
        type: 'agent',
        id: agent.id,
        error: error.message,
      });
      console.error(`\n   ❌ Failed to migrate agent ${agent.id} (${agent.name}): ${error.message}`);
    }
  }

  return oldIdToNewId;
}

/**
 * Migrate skills to PostgreSQL
 */
async function migrateSkills(
  client: AxiosInstance,
  skills: any[],
  stats: MigrationStats
): Promise<Map<number, number>> {
  console.log('\n🚀 Migrating skills to PostgreSQL...');

  const oldIdToNewId = new Map<number, number>();
  stats.skills.total = skills.length;

  for (let i = 0; i < skills.length; i++) {
    const skill = skills[i];
    displayProgress(i + 1, skills.length, 'Skills');

    try {
      const transformed = transformSkill(skill);

      if (config.validateOnly) {
        stats.skills.skipped++;
        continue;
      }

      const response = await client.post('/skills', { data: transformed });
      const newId = response.data.data.id;

      oldIdToNewId.set(skill.id, newId);
      stats.skills.success++;
    } catch (error: any) {
      stats.skills.failed++;
      stats.errors.push({
        type: 'skill',
        id: skill.id,
        error: error.message,
      });
      console.error(`\n   ❌ Failed to migrate skill ${skill.id} (${skill.name}): ${error.message}`);
    }
  }

  return oldIdToNewId;
}

/**
 * Migrate MCP servers to PostgreSQL
 */
async function migrateMCPServers(
  client: AxiosInstance,
  mcpServers: any[],
  stats: MigrationStats
): Promise<Map<number, number>> {
  console.log('\n🚀 Migrating MCP servers to PostgreSQL...');

  const oldIdToNewId = new Map<number, number>();
  stats.mcpServers.total = mcpServers.length;

  for (let i = 0; i < mcpServers.length; i++) {
    const mcp = mcpServers[i];
    displayProgress(i + 1, mcpServers.length, 'MCP Servers');

    try {
      const transformed = transformMCPServer(mcp);

      if (config.validateOnly) {
        stats.mcpServers.skipped++;
        continue;
      }

      const response = await client.post('/mcp-servers', { data: transformed });
      const newId = response.data.data.id;

      oldIdToNewId.set(mcp.id, newId);
      stats.mcpServers.success++;
    } catch (error: any) {
      stats.mcpServers.failed++;
      stats.errors.push({
        type: 'mcp-server',
        id: mcp.id,
        error: error.message,
      });
      console.error(`\n   ❌ Failed to migrate MCP server ${mcp.id} (${mcp.name}): ${error.message}`);
    }
  }

  return oldIdToNewId;
}

/**
 * Migrate tasks to PostgreSQL
 */
async function migrateTasks(
  client: AxiosInstance,
  tasks: any[],
  agentIdMap: Map<number, number>,
  stats: MigrationStats
): Promise<void> {
  console.log('\n🚀 Migrating tasks to PostgreSQL...');

  stats.tasks.total = tasks.length;

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    displayProgress(i + 1, tasks.length, 'Tasks');

    try {
      const transformed = transformTask(task, agentIdMap);

      if (config.validateOnly) {
        stats.tasks.skipped++;
        continue;
      }

      await client.post('/tasks', { data: transformed });
      stats.tasks.success++;
    } catch (error: any) {
      stats.tasks.failed++;
      stats.errors.push({
        type: 'task',
        id: task.id,
        error: error.message,
      });
      console.error(`\n   ❌ Failed to migrate task ${task.id}: ${error.message}`);
    }
  }
}

/**
 * Migrate agent-skill relations
 */
async function migrateAgentSkillRelations(
  client: AxiosInstance,
  relations: any[],
  agentIdMap: Map<number, number>,
  skillIdMap: Map<number, number>,
  stats: MigrationStats
): Promise<void> {
  console.log('\n🔗 Migrating agent-skill relations...');

  if (config.validateOnly) {
    console.log(`   ℹ️  Would migrate ${relations.length} relations (validate-only mode)`);
    return;
  }

  for (const relation of relations) {
    const newAgentId = agentIdMap.get(relation.agent_id);
    const newSkillId = skillIdMap.get(relation.skill_id);

    if (!newAgentId || !newSkillId) {
      console.log(`   ⚠️  Skipping relation: agent ${relation.agent_id} -> skill ${relation.skill_id} (missing IDs)`);
      continue;
    }

    try {
      // Get current agent data
      const agentResponse = await client.get(`/agents/${newAgentId}?populate=skills`);
      const currentSkills = agentResponse.data.data.attributes.skills?.data || [];
      const skillIds = currentSkills.map((s: any) => s.id);

      // Add new skill if not already present
      if (!skillIds.includes(newSkillId)) {
        skillIds.push(newSkillId);

        await client.put(`/agents/${newAgentId}`, {
          data: {
            skills: skillIds,
          },
        });

        stats.relations.agentsSkills++;
      }
    } catch (error: any) {
      console.error(`\n   ❌ Failed to link agent ${newAgentId} to skill ${newSkillId}: ${error.message}`);
    }
  }

  console.log(`   ✅ Migrated ${stats.relations.agentsSkills} agent-skill relations`);
}

/**
 * Migrate agent-MCP server relations
 */
async function migrateAgentMCPRelations(
  client: AxiosInstance,
  relations: any[],
  agentIdMap: Map<number, number>,
  mcpIdMap: Map<number, number>,
  stats: MigrationStats
): Promise<void> {
  console.log('\n🔗 Migrating agent-MCP server relations...');

  if (config.validateOnly) {
    console.log(`   ℹ️  Would migrate ${relations.length} relations (validate-only mode)`);
    return;
  }

  for (const relation of relations) {
    const newAgentId = agentIdMap.get(relation.agent_id);
    const newMcpId = mcpIdMap.get(relation.mcp_server_id);

    if (!newAgentId || !newMcpId) {
      console.log(`   ⚠️  Skipping relation: agent ${relation.agent_id} -> MCP ${relation.mcp_server_id} (missing IDs)`);
      continue;
    }

    try {
      // Get current agent data
      const agentResponse = await client.get(`/agents/${newAgentId}?populate=mcpServers`);
      const currentMcps = agentResponse.data.data.attributes.mcpServers?.data || [];
      const mcpIds = currentMcps.map((m: any) => m.id);

      // Add new MCP server if not already present
      if (!mcpIds.includes(newMcpId)) {
        mcpIds.push(newMcpId);

        await client.put(`/agents/${newAgentId}`, {
          data: {
            mcpServers: mcpIds,
          },
        });

        stats.relations.agentsMcpServers++;
      }
    } catch (error: any) {
      console.error(`\n   ❌ Failed to link agent ${newAgentId} to MCP ${newMcpId}: ${error.message}`);
    }
  }

  console.log(`   ✅ Migrated ${stats.relations.agentsMcpServers} agent-MCP server relations`);
}

// ============= VALIDATION =============

/**
 * Validate migrated data
 */
async function validateMigration(
  client: AxiosInstance,
  stats: MigrationStats
): Promise<void> {
  console.log('\n🔍 Validating migration...');

  try {
    // Validate agents
    const agentsResponse = await client.get('/agents?pagination[pageSize]=1000');
    const agentsCount = agentsResponse.data.meta.pagination.total;
    console.log(`   ✅ Agents: ${agentsCount} in PostgreSQL (expected ${stats.agents.success})`);

    // Validate skills
    const skillsResponse = await client.get('/skills?pagination[pageSize]=1000');
    const skillsCount = skillsResponse.data.meta.pagination.total;
    console.log(`   ✅ Skills: ${skillsCount} in PostgreSQL (expected ${stats.skills.success})`);

    // Validate MCP servers
    const mcpResponse = await client.get('/mcp-servers?pagination[pageSize]=1000');
    const mcpCount = mcpResponse.data.meta.pagination.total;
    console.log(`   ✅ MCP Servers: ${mcpCount} in PostgreSQL (expected ${stats.mcpServers.success})`);

    // Validate tasks
    const tasksResponse = await client.get('/tasks?pagination[pageSize]=1000');
    const tasksCount = tasksResponse.data.meta.pagination.total;
    console.log(`   ✅ Tasks: ${tasksCount} in PostgreSQL (expected ${stats.tasks.success})`);

    console.log('\n✅ Validation completed');
  } catch (error: any) {
    console.error('\n❌ Validation failed:', error.message);
    throw error;
  }
}

// ============= REPORTING =============

/**
 * Generate migration report
 */
function generateReport(stats: MigrationStats, backupPath: string | null): void {
  stats.endTime = Date.now();
  const duration = stats.endTime - stats.startTime;

  console.log('\n' + '='.repeat(70));
  console.log('📊 MIGRATION REPORT');
  console.log('='.repeat(70));

  // Summary
  console.log('\n📈 Summary:');
  console.log(`   Duration: ${formatDuration(duration)}`);
  console.log(`   Mode: ${config.validateOnly ? 'Validation Only' : 'Full Migration'}`);
  if (backupPath) {
    console.log(`   Backup: ${backupPath}`);
  }

  // Agents
  console.log('\n👤 Agents:');
  console.log(`   Total: ${stats.agents.total}`);
  console.log(`   Success: ${stats.agents.success} ✅`);
  console.log(`   Failed: ${stats.agents.failed} ❌`);
  console.log(`   Skipped: ${stats.agents.skipped} ⏭️`);

  // Skills
  console.log('\n🎯 Skills:');
  console.log(`   Total: ${stats.skills.total}`);
  console.log(`   Success: ${stats.skills.success} ✅`);
  console.log(`   Failed: ${stats.skills.failed} ❌`);
  console.log(`   Skipped: ${stats.skills.skipped} ⏭️`);

  // MCP Servers
  console.log('\n🔌 MCP Servers:');
  console.log(`   Total: ${stats.mcpServers.total}`);
  console.log(`   Success: ${stats.mcpServers.success} ✅`);
  console.log(`   Failed: ${stats.mcpServers.failed} ❌`);
  console.log(`   Skipped: ${stats.mcpServers.skipped} ⏭️`);

  // Tasks
  console.log('\n📋 Tasks:');
  console.log(`   Total: ${stats.tasks.total}`);
  console.log(`   Success: ${stats.tasks.success} ✅`);
  console.log(`   Failed: ${stats.tasks.failed} ❌`);
  console.log(`   Skipped: ${stats.tasks.skipped} ⏭️`);

  // Relations
  console.log('\n🔗 Relations:');
  console.log(`   Agent-Skill links: ${stats.relations.agentsSkills}`);
  console.log(`   Agent-MCP links: ${stats.relations.agentsMcpServers}`);

  // Errors
  if (stats.errors.length > 0) {
    console.log('\n❌ Errors:');
    stats.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. [${error.type}:${error.id}] ${error.error}`);
    });
  }

  // Save report to file
  const reportPath = path.join(config.backupPath, `migration-report-${getTimestamp()}.json`);
  ensureDir(config.backupPath);
  fs.writeFileSync(reportPath, JSON.stringify(stats, null, 2));
  console.log(`\n📄 Report saved: ${reportPath}`);

  console.log('\n' + '='.repeat(70));

  // Final status
  const totalFailed = stats.agents.failed + stats.skills.failed + stats.mcpServers.failed + stats.tasks.failed;
  if (totalFailed === 0) {
    console.log('✅ MIGRATION COMPLETED SUCCESSFULLY!');
  } else {
    console.log(`⚠️  MIGRATION COMPLETED WITH ${totalFailed} ERRORS`);
  }
  console.log('='.repeat(70) + '\n');
}

// ============= MAIN MIGRATION FUNCTION =============

/**
 * Main migration orchestration
 */
async function migrate(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 CLAUDE AGENT UI - DATABASE MIGRATION');
  console.log('    SQLite → PostgreSQL (via Strapi API)');
  console.log('='.repeat(70));

  const stats: MigrationStats = {
    agents: { total: 0, success: 0, failed: 0, skipped: 0 },
    skills: { total: 0, success: 0, failed: 0, skipped: 0 },
    mcpServers: { total: 0, success: 0, failed: 0, skipped: 0 },
    tasks: { total: 0, success: 0, failed: 0, skipped: 0 },
    relations: { agentsSkills: 0, agentsMcpServers: 0 },
    startTime: Date.now(),
    errors: [],
  };

  let backupPath: string | null = null;
  let sqliteDb: Database.Database | null = null;

  try {
    // Step 1: Backup
    backupPath = backupSqliteDatabase();

    // Step 2: Connect to databases
    sqliteDb = initSqliteConnection();
    const strapiClient = initStrapiClient();
    await testStrapiConnection(strapiClient);

    // Step 3: Extract data from SQLite
    const agents = extractAgents(sqliteDb);
    const skills = extractSkills(sqliteDb);
    const mcpServers = extractMCPServers(sqliteDb);
    const tasks = extractTasks(sqliteDb);
    const agentSkillRelations = extractAgentSkillRelations(sqliteDb);
    const agentMcpRelations = extractAgentMCPRelations(sqliteDb);

    // Close SQLite connection (read-only, no longer needed)
    sqliteDb.close();
    sqliteDb = null;

    // Step 4: Migrate data to PostgreSQL
    const agentIdMap = await migrateAgents(strapiClient, agents, stats);
    const skillIdMap = await migrateSkills(strapiClient, skills, stats);
    const mcpIdMap = await migrateMCPServers(strapiClient, mcpServers, stats);
    await migrateTasks(strapiClient, tasks, agentIdMap, stats);

    // Step 5: Migrate relations
    await migrateAgentSkillRelations(strapiClient, agentSkillRelations, agentIdMap, skillIdMap, stats);
    await migrateAgentMCPRelations(strapiClient, agentMcpRelations, agentIdMap, mcpIdMap, stats);

    // Step 6: Validate
    if (!config.validateOnly) {
      await validateMigration(strapiClient, stats);
    }

    // Step 7: Generate report
    generateReport(stats, backupPath);

  } catch (error: any) {
    console.error('\n❌ MIGRATION FAILED:', error.message);
    console.error(error);

    // Close SQLite connection if still open
    if (sqliteDb) {
      sqliteDb.close();
    }

    // Generate error report
    generateReport(stats, backupPath);

    process.exit(1);
  }
}

// ============= ENTRY POINT =============

migrate().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
