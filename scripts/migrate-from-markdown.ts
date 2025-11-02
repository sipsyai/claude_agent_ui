/**
 * Claude Agent UI - Markdown to Strapi Migration Script
 *
 * Migrates agents, skills, MCP servers, and tasks from old project to Strapi PostgreSQL
 *
 * Usage:
 *   npm run migrate:markdown <source-path> [--with-tasks]
 *   npm run migrate:markdown "C:/Users/Ali/Documents/Projects/claude_agent_ui - Copy/.claude"
 *   npm run migrate:markdown "C:/Users/Ali/Documents/Projects/claude_agent_ui - Copy/.claude" --with-tasks
 *
 * @author Claude Agent UI Team
 * @version 1.1.0
 */

import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { config as dotenvConfig } from 'dotenv';
import matter from 'gray-matter';

// Load environment variables
dotenvConfig();

// ============= CONFIGURATION =============

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface MigrationConfig {
  sourcePath: string;
  strapiUrl: string;
  strapiToken?: string;
}

// Parse command line arguments
const args = process.argv.slice(2);
const sourcePath = args.find((arg) => !arg.startsWith('--')) || path.resolve(__dirname, '../.claude');
const includeTasks = args.includes('--with-tasks');

const config: MigrationConfig = {
  sourcePath,
  strapiUrl: process.env.STRAPI_URL || 'http://localhost:1337',
  strapiToken: process.env.STRAPI_API_TOKEN,
};

// ============= TYPES =============

interface AgentFrontmatter {
  name: string;
  description: string;
  tools?: string;
  model?: string;
}

interface SkillFrontmatter {
  name: string;
  description: string;
  'allowed-tools'?: string;
  allowed_tools?: string;
  experience_score?: number;
  training_history?: any[];
  mcp_tools?: Record<string, string[]>;
}

interface MigrationStats {
  agents: { total: number; success: number; failed: number };
  skills: { total: number; success: number; failed: number };
  mcpServers: { total: number; success: number; failed: number };
  tasks: { total: number; success: number; failed: number };
  errors: Array<{ type: string; name: string; error: string }>;
  startTime: number;
  endTime?: number;
}

// ============= UTILITY FUNCTIONS =============

/**
 * Parse tools string or array to array
 */
function parseTools(toolsInput?: string | string[]): string[] {
  if (!toolsInput) return [];
  if (Array.isArray(toolsInput)) return toolsInput;
  if (typeof toolsInput === 'string') {
    return toolsInput.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
  }
  return [];
}

/**
 * Read and parse markdown file with frontmatter
 */
function parseMarkdownFile(filePath: string): { data: any; content: string } {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  return matter(fileContent);
}

// ============= STRAPI CLIENT =============

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
    timeout: 30000,
  });

  return client;
}

/**
 * Test Strapi connection
 */
async function testStrapiConnection(client: AxiosInstance): Promise<void> {
  try {
    await client.get('/agents?pagination[pageSize]=1');
    console.log('✅ Strapi API connected');
  } catch (error: any) {
    throw new Error(`Strapi connection failed: ${error.message}`);
  }
}

// ============= AGENTS MIGRATION =============

/**
 * Find all agent markdown files
 */
function findAgentFiles(sourcePath: string): string[] {
  const agentsDir = path.join(sourcePath, 'agents');
  if (!fs.existsSync(agentsDir)) {
    console.log(`⚠️  Agents directory not found: ${agentsDir}`);
    return [];
  }

  return fs.readdirSync(agentsDir)
    .filter((file) => file.endsWith('.md'))
    .map((file) => path.join(agentsDir, file));
}

/**
 * Transform agent markdown to Strapi format
 */
function transformAgent(data: AgentFrontmatter, content: string): any {
  return {
    name: data.name,
    description: data.description || '',
    systemPrompt: content.trim(),
    tools: parseTools(data.tools),
    disallowedTools: [],
    model: data.model || 'sonnet',
    enabled: true,
  };
}

/**
 * Migrate agents from markdown files
 */
async function migrateAgents(
  client: AxiosInstance,
  sourcePath: string,
  stats: MigrationStats
): Promise<void> {
  console.log('\n📥 Finding agent files...');
  const agentFiles = findAgentFiles(sourcePath);
  stats.agents.total = agentFiles.length;
  console.log(`   Found ${agentFiles.length} agent files`);

  if (agentFiles.length === 0) return;

  console.log('\n🚀 Migrating agents...');

  for (const filePath of agentFiles) {
    const fileName = path.basename(filePath);
    try {
      const { data, content } = parseMarkdownFile(filePath);
      const transformed = transformAgent(data as AgentFrontmatter, content);

      console.log(`   Migrating: ${transformed.name}`);

      await client.post('/agents', { data: transformed });
      stats.agents.success++;
    } catch (error: any) {
      stats.agents.failed++;
      stats.errors.push({
        type: 'agent',
        name: fileName,
        error: error.message,
      });
      console.error(`   ❌ Failed: ${fileName} - ${error.message}`);
    }
  }

  console.log(`✅ Agents migrated: ${stats.agents.success}/${stats.agents.total}`);
}

// ============= SKILLS MIGRATION =============

/**
 * Find all skill SKILL.md files
 */
function findSkillFiles(sourcePath: string): Array<{ dir: string; file: string }> {
  const skillsDir = path.join(sourcePath, 'skills');
  if (!fs.existsSync(skillsDir)) {
    console.log(`⚠️  Skills directory not found: ${skillsDir}`);
    return [];
  }

  const skillDirs = fs.readdirSync(skillsDir)
    .filter((name) => fs.statSync(path.join(skillsDir, name)).isDirectory());

  const skillFiles: Array<{ dir: string; file: string }> = [];

  for (const dir of skillDirs) {
    const skillFile = path.join(skillsDir, dir, 'SKILL.md');
    if (fs.existsSync(skillFile)) {
      skillFiles.push({ dir, file: skillFile });
    }
  }

  return skillFiles;
}

/**
 * Transform skill markdown to Strapi format
 */
function transformSkill(data: SkillFrontmatter, content: string): any {
  const allowedTools = data['allowed-tools'] || data.allowed_tools || '';

  // Truncate description to 1024 chars max
  const description = (data.description || '').substring(0, 1024);

  // Convert name to kebab-case (lowercase with hyphens only)
  const name = data.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-');

  // Generate displayName from name if not present
  const displayName = name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .substring(0, 200);

  return {
    name: name,
    displayName: displayName,
    description: description,
    content: content.trim(),
    allowedTools: parseTools(allowedTools),
    experienceScore: data.experience_score || 0,
  };
}

/**
 * Migrate skills from markdown files
 */
async function migrateSkills(
  client: AxiosInstance,
  sourcePath: string,
  stats: MigrationStats
): Promise<void> {
  console.log('\n📥 Finding skill files...');
  const skillFiles = findSkillFiles(sourcePath);
  stats.skills.total = skillFiles.length;
  console.log(`   Found ${skillFiles.length} skill files`);

  if (skillFiles.length === 0) return;

  console.log('\n🚀 Migrating skills...');

  for (const { dir, file } of skillFiles) {
    try {
      const { data, content } = parseMarkdownFile(file);
      const transformed = transformSkill(data as SkillFrontmatter, content);

      console.log(`   Migrating: ${transformed.name}`);

      await client.post('/skills', { data: transformed });
      stats.skills.success++;
    } catch (error: any) {
      stats.skills.failed++;
      stats.errors.push({
        type: 'skill',
        name: dir,
        error: error.message,
      });
      console.error(`   ❌ Failed: ${dir} - ${error.message}`);
    }
  }

  console.log(`✅ Skills migrated: ${stats.skills.success}/${stats.skills.total}`);
}

// ============= MCP SERVERS MIGRATION =============

/**
 * Find .mcp.json file
 */
function findMcpConfig(sourcePath: string): string | null {
  const parentDir = path.dirname(sourcePath);
  const mcpFile = path.join(parentDir, '.mcp.json');
  return fs.existsSync(mcpFile) ? mcpFile : null;
}

/**
 * Transform MCP server config to Strapi format
 */
function transformMcpServer(name: string, serverConfig: any): any {
  return {
    name: name,
    description: `MCP Server: ${name}`,
    command: serverConfig.command || 'npx',
    args: Array.isArray(serverConfig.args) ? serverConfig.args : [],
    env: serverConfig.env || {},
    disabled: serverConfig.disabled || false,
    transport: serverConfig.type || 'stdio',
  };
}

/**
 * Migrate MCP servers from .mcp.json
 */
async function migrateMcpServers(
  client: AxiosInstance,
  sourcePath: string,
  stats: MigrationStats
): Promise<void> {
  console.log('\n📥 Finding MCP server configuration...');
  const mcpFile = findMcpConfig(sourcePath);

  if (!mcpFile) {
    console.log('   No .mcp.json found - skipping MCP servers');
    return;
  }

  try {
    const mcpConfig = JSON.parse(fs.readFileSync(mcpFile, 'utf-8'));
    const servers = mcpConfig.mcpServers || {};
    const serverNames = Object.keys(servers);
    stats.mcpServers.total = serverNames.length;
    console.log(`   Found ${serverNames.length} MCP servers`);

    if (serverNames.length === 0) return;

    console.log('\n🚀 Migrating MCP servers...');

    for (const name of serverNames) {
      try {
        const transformed = transformMcpServer(name, servers[name]);
        console.log(`   Migrating: ${transformed.name}`);

        await client.post('/mcp-servers', { data: transformed });
        stats.mcpServers.success++;
      } catch (error: any) {
        stats.mcpServers.failed++;
        stats.errors.push({
          type: 'mcp-server',
          name: name,
          error: error.message,
        });
        console.error(`   ❌ Failed: ${name} - ${error.message}`);
      }
    }

    console.log(`✅ MCP servers migrated: ${stats.mcpServers.success}/${stats.mcpServers.total}`);
  } catch (error: any) {
    console.error(`   ❌ Failed to read .mcp.json: ${error.message}`);
  }
}

// ============= TASKS MIGRATION =============

/**
 * Find tasks.json file
 */
function findTasksFile(): string | null {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  const tasksFile = path.join(homeDir, '.cui', 'tasks.json');
  return fs.existsSync(tasksFile) ? tasksFile : null;
}

/**
 * Get agent ID by name
 */
async function getAgentIdByName(client: AxiosInstance, agentName: string): Promise<number | null> {
  try {
    const response = await client.get(`/agents?filters[name][$eq]=${agentName}`);
    if (response.data?.data?.length > 0) {
      return response.data.data[0].id;
    }
  } catch (error) {
    // Agent not found
  }
  return null;
}

/**
 * Transform task to Strapi format
 */
async function transformTask(client: AxiosInstance, task: any): Promise<any | null> {
  // Find agent ID
  const agentId = await getAgentIdByName(client, task.agentId || task.agentName);

  if (!agentId) {
    throw new Error(`Agent not found: ${task.agentId || task.agentName}`);
  }

  return {
    agent: agentId,
    message: task.userPrompt || task.description || task.name || 'No message',
    status: task.status || 'completed',
    result: task.result || null,
    error: task.error || null,
    startedAt: task.startedAt || task.createdAt || null,
    completedAt: task.completedAt || task.finishedAt || null,
    executionTime: task.executionTime || null,
    tokensUsed: task.tokensUsed || 0,
    cost: task.cost || 0,
    metadata: {
      taskType: task.taskType,
      permissionMode: task.permissionMode,
      directory: task.directory,
      inputValues: task.inputValues,
    },
  };
}

/**
 * Migrate tasks from tasks.json (limit to last N tasks)
 */
async function migrateTasks(
  client: AxiosInstance,
  stats: MigrationStats,
  limitTasks: number = 50
): Promise<void> {
  console.log('\n📥 Finding tasks file...');
  const tasksFile = findTasksFile();

  if (!tasksFile) {
    console.log('   No tasks.json found - skipping tasks');
    return;
  }

  try {
    const tasksData = JSON.parse(fs.readFileSync(tasksFile, 'utf-8'));
    const allTasks = Array.isArray(tasksData) ? tasksData : [];

    // Limit to last N completed tasks
    const completedTasks = allTasks
      .filter((t) => t.status === 'completed' || t.status === 'failed')
      .slice(0, limitTasks);

    stats.tasks.total = completedTasks.length;
    console.log(`   Found ${allTasks.length} total tasks, migrating last ${completedTasks.length} completed tasks`);

    if (completedTasks.length === 0) return;

    console.log('\n🚀 Migrating tasks...');

    for (const task of completedTasks) {
      try {
        const transformed = await transformTask(client, task);

        if (transformed) {
          console.log(`   Migrating task: ${task.name || task.id}`);
          await client.post('/tasks', { data: transformed });
          stats.tasks.success++;
        }
      } catch (error: any) {
        stats.tasks.failed++;
        stats.errors.push({
          type: 'task',
          name: task.id || task.name || 'unknown',
          error: error.message,
        });
        console.error(`   ❌ Failed: ${task.name || task.id} - ${error.message}`);
      }
    }

    console.log(`✅ Tasks migrated: ${stats.tasks.success}/${stats.tasks.total}`);
  } catch (error: any) {
    console.error(`   ❌ Failed to read tasks.json: ${error.message}`);
  }
}

// ============= MAIN =============

/**
 * Main migration function
 */
async function migrate(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 MARKDOWN TO STRAPI MIGRATION');
  console.log('='.repeat(70));
  console.log(`\nSource: ${config.sourcePath}`);

  const stats: MigrationStats = {
    agents: { total: 0, success: 0, failed: 0 },
    skills: { total: 0, success: 0, failed: 0 },
    mcpServers: { total: 0, success: 0, failed: 0 },
    tasks: { total: 0, success: 0, failed: 0 },
    errors: [],
    startTime: Date.now(),
  };

  try {
    // Check source path exists
    if (!fs.existsSync(config.sourcePath)) {
      throw new Error(`Source path not found: ${config.sourcePath}`);
    }

    // Connect to Strapi
    const strapiClient = initStrapiClient();
    await testStrapiConnection(strapiClient);

    // Migrate agents
    await migrateAgents(strapiClient, config.sourcePath, stats);

    // Migrate skills
    await migrateSkills(strapiClient, config.sourcePath, stats);

    // Migrate MCP servers
    await migrateMcpServers(strapiClient, config.sourcePath, stats);

    // Migrate tasks (optional)
    if (includeTasks) {
      await migrateTasks(strapiClient, stats, 50);
    } else {
      console.log('\n⏭️  Skipping tasks migration (use --with-tasks to include)');
    }

    // Summary
    stats.endTime = Date.now();
    const duration = ((stats.endTime - stats.startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(70));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(70));
    console.log(`\n⏱️  Duration: ${duration}s`);
    console.log(`\n👤 Agents: ${stats.agents.success}/${stats.agents.total} successful`);
    console.log(`🎯 Skills: ${stats.skills.success}/${stats.skills.total} successful`);
    console.log(`🔌 MCP Servers: ${stats.mcpServers.success}/${stats.mcpServers.total} successful`);
    if (includeTasks) {
      console.log(`📋 Tasks: ${stats.tasks.success}/${stats.tasks.total} successful`);
    }

    if (stats.errors.length > 0) {
      console.log(`\n❌ Errors (${stats.errors.length}):`);
      stats.errors.forEach((err, i) => {
        console.log(`   ${i + 1}. [${err.type}] ${err.name}: ${err.error}`);
      });
    }

    console.log('\n' + '='.repeat(70));

    const totalFailed = stats.agents.failed + stats.skills.failed + stats.mcpServers.failed + stats.tasks.failed;
    if (totalFailed === 0) {
      console.log('✅ MIGRATION COMPLETED SUCCESSFULLY!');
    } else {
      console.log(`⚠️  MIGRATION COMPLETED WITH ${totalFailed} ERRORS`);
    }

    console.log('='.repeat(70) + '\n');

  } catch (error: any) {
    console.error('\n❌ MIGRATION FAILED:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// ============= ENTRY POINT =============

migrate().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
