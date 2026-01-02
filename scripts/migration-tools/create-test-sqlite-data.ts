/**
 * Create Test SQLite Database for Migration Testing
 *
 * This script creates a test SQLite database with sample data that mimics
 * the old schema structure, allowing us to test the migration to PostgreSQL.
 *
 * Usage:
 *   tsx scripts/migration-tools/create-test-sqlite-data.ts
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const DB_PATH = path.resolve(__dirname, '../../backend/.tmp/data.db');
const BACKUP_DIR = path.resolve(__dirname, '../../database/backups');

// Ensure directories exist
function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Create test database
function createTestDatabase(): Database.Database {
  ensureDir(path.dirname(DB_PATH));

  // Remove existing database if it exists
  if (fs.existsSync(DB_PATH)) {
    console.log('⚠️  Existing database found, creating backup...');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupPath = path.join(BACKUP_DIR, `pre-test-${timestamp}.db`);
    ensureDir(BACKUP_DIR);
    fs.copyFileSync(DB_PATH, backupPath);
    console.log(`✅ Backup created: ${backupPath}`);
    fs.unlinkSync(DB_PATH);
  }

  const db = new Database(DB_PATH);
  console.log(`📦 Created new test database: ${DB_PATH}`);

  return db;
}

// Create schema (old SQLite schema structure)
function createSchema(db: Database.Database): void {
  console.log('\n📋 Creating schema...');

  // Agents table
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      system_prompt TEXT NOT NULL,
      tools TEXT,  -- JSON array
      disallowed_tools TEXT,  -- JSON array
      model TEXT DEFAULT 'sonnet',
      enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Skills table
  db.exec(`
    CREATE TABLE IF NOT EXISTS skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      content TEXT,  -- Will be renamed to skillmd
      allowed_tools TEXT,  -- JSON array
      experience_score REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // MCP Servers table
  db.exec(`
    CREATE TABLE IF NOT EXISTS mcp_servers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      command TEXT NOT NULL,
      args TEXT,  -- JSON array
      env TEXT,  -- JSON object
      transport TEXT DEFAULT 'stdio',
      disabled INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tasks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending',
      agent_id INTEGER,
      error_message TEXT,
      duration_ms INTEGER,
      input_tokens INTEGER,
      output_tokens INTEGER,
      total_cost REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (agent_id) REFERENCES agents(id)
    )
  `);

  // Agent-Skill relationships
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents_skills_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id INTEGER NOT NULL,
      skill_id INTEGER NOT NULL,
      FOREIGN KEY (agent_id) REFERENCES agents(id),
      FOREIGN KEY (skill_id) REFERENCES skills(id)
    )
  `);

  // Agent-MCP Server relationships
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents_mcp_servers_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id INTEGER NOT NULL,
      mcp_server_id INTEGER NOT NULL,
      FOREIGN KEY (agent_id) REFERENCES agents(id),
      FOREIGN KEY (mcp_server_id) REFERENCES mcp_servers(id)
    )
  `);

  console.log('✅ Schema created');
}

// Insert test data
function insertTestData(db: Database.Database): void {
  console.log('\n📝 Inserting test data...');

  // Insert agents
  const insertAgent = db.prepare(`
    INSERT INTO agents (name, description, system_prompt, tools, disallowed_tools, model, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const agents = [
    {
      name: 'code-reviewer',
      description: 'Expert code review agent',
      system_prompt: 'You are an expert code reviewer. Analyze code for quality, security, and best practices.',
      tools: JSON.stringify(['Read', 'Grep', 'Glob']),
      disallowed_tools: JSON.stringify(['Bash', 'Write']),
      model: 'sonnet',
      enabled: 1,
    },
    {
      name: 'test-writer',
      description: 'Automated test generation agent',
      system_prompt: 'You are a test automation expert. Generate comprehensive test suites.',
      tools: JSON.stringify(['Read', 'Write', 'Glob']),
      disallowed_tools: JSON.stringify([]),
      model: 'sonnet',
      enabled: 1,
    },
    {
      name: 'doc-generator',
      description: 'Documentation generation agent',
      system_prompt: 'You are a technical documentation expert. Create clear, comprehensive documentation.',
      tools: JSON.stringify(['Read', 'Write', 'Glob', 'Grep']),
      disallowed_tools: JSON.stringify(['Bash']),
      model: 'opus',
      enabled: 1,
    },
  ];

  agents.forEach((agent, index) => {
    insertAgent.run(
      agent.name,
      agent.description,
      agent.system_prompt,
      agent.tools,
      agent.disallowed_tools,
      agent.model,
      agent.enabled
    );
    console.log(`  ✓ Created agent: ${agent.name}`);
  });

  // Insert skills
  const insertSkill = db.prepare(`
    INSERT INTO skills (name, description, content, allowed_tools, experience_score)
    VALUES (?, ?, ?, ?, ?)
  `);

  const skills = [
    {
      name: 'code-review',
      description: 'Expert code review and analysis skill',
      content: `# Code Review Skill

You are an expert code reviewer. Analyze code for:
- Code quality and maintainability
- Security vulnerabilities
- Performance issues
- Best practices compliance

Provide detailed feedback with specific recommendations.`,
      allowed_tools: JSON.stringify(['Read', 'Grep', 'Glob']),
      experience_score: 85.5,
    },
    {
      name: 'test-generation',
      description: 'Automated test suite generation',
      content: `# Test Generation Skill

You are a test automation expert. Generate comprehensive tests:
- Unit tests with high coverage
- Integration tests for key flows
- Edge case testing
- Test data generation

Follow testing best practices and frameworks.`,
      allowed_tools: JSON.stringify(['Read', 'Write', 'Glob']),
      experience_score: 78.3,
    },
    {
      name: 'api-documentation',
      description: 'API documentation generation',
      content: `# API Documentation Skill

You are an API documentation specialist. Create:
- Clear endpoint descriptions
- Request/response examples
- Authentication details
- Error handling documentation

Use OpenAPI/Swagger format when applicable.`,
      allowed_tools: JSON.stringify(['Read', 'Write', 'Grep']),
      experience_score: 92.7,
    },
  ];

  skills.forEach((skill, index) => {
    insertSkill.run(
      skill.name,
      skill.description,
      skill.content,
      skill.allowed_tools,
      skill.experience_score
    );
    console.log(`  ✓ Created skill: ${skill.name}`);
  });

  // Insert MCP servers
  const insertMCP = db.prepare(`
    INSERT INTO mcp_servers (name, command, args, env, transport, disabled)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const mcpServers = [
    {
      name: 'filesystem',
      command: 'npx',
      args: JSON.stringify(['-y', '@modelcontextprotocol/server-filesystem', '/tmp']),
      env: JSON.stringify({}),
      transport: 'stdio',
      disabled: 0,
    },
    {
      name: 'postgres',
      command: 'npx',
      args: JSON.stringify(['-y', '@modelcontextprotocol/server-postgres']),
      env: JSON.stringify({ DATABASE_URL: 'postgresql://localhost:5432/testdb' }),
      transport: 'stdio',
      disabled: 0,
    },
  ];

  mcpServers.forEach((mcp, index) => {
    insertMCP.run(
      mcp.name,
      mcp.command,
      mcp.args,
      mcp.env,
      mcp.transport,
      mcp.disabled
    );
    console.log(`  ✓ Created MCP server: ${mcp.name}`);
  });

  // Insert tasks
  const insertTask = db.prepare(`
    INSERT INTO tasks (name, description, status, agent_id, error_message, duration_ms, input_tokens, output_tokens, total_cost)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tasks = [
    {
      name: 'Review API implementation',
      description: 'Review the new REST API endpoints',
      status: 'completed',
      agent_id: 1,
      error_message: null,
      duration_ms: 45000,
      input_tokens: 1200,
      output_tokens: 800,
      total_cost: 0.025,
    },
    {
      name: 'Generate unit tests',
      description: 'Generate unit tests for user service',
      status: 'completed',
      agent_id: 2,
      error_message: null,
      duration_ms: 32000,
      input_tokens: 900,
      output_tokens: 1500,
      total_cost: 0.032,
    },
    {
      name: 'Document authentication flow',
      description: 'Create documentation for OAuth2 flow',
      status: 'failed',
      agent_id: 3,
      error_message: 'Missing authentication configuration',
      duration_ms: 5000,
      input_tokens: 500,
      output_tokens: 100,
      total_cost: 0.008,
    },
  ];

  tasks.forEach((task, index) => {
    insertTask.run(
      task.name,
      task.description,
      task.status,
      task.agent_id,
      task.error_message,
      task.duration_ms,
      task.input_tokens,
      task.output_tokens,
      task.total_cost
    );
    console.log(`  ✓ Created task: ${task.name}`);
  });

  // Insert agent-skill relationships
  const insertAgentSkill = db.prepare(`
    INSERT INTO agents_skills_links (agent_id, skill_id) VALUES (?, ?)
  `);

  const agentSkillLinks = [
    { agent_id: 1, skill_id: 1 },  // code-reviewer -> code-review
    { agent_id: 2, skill_id: 2 },  // test-writer -> test-generation
    { agent_id: 3, skill_id: 3 },  // doc-generator -> api-documentation
    { agent_id: 1, skill_id: 2 },  // code-reviewer -> test-generation (multi-skill)
  ];

  agentSkillLinks.forEach((link) => {
    insertAgentSkill.run(link.agent_id, link.skill_id);
  });
  console.log(`  ✓ Created ${agentSkillLinks.length} agent-skill relationships`);

  // Insert agent-MCP server relationships
  const insertAgentMCP = db.prepare(`
    INSERT INTO agents_mcp_servers_links (agent_id, mcp_server_id) VALUES (?, ?)
  `);

  const agentMCPLinks = [
    { agent_id: 1, mcp_server_id: 1 },  // code-reviewer -> filesystem
    { agent_id: 2, mcp_server_id: 1 },  // test-writer -> filesystem
    { agent_id: 3, mcp_server_id: 2 },  // doc-generator -> postgres
  ];

  agentMCPLinks.forEach((link) => {
    insertAgentMCP.run(link.agent_id, link.mcp_server_id);
  });
  console.log(`  ✓ Created ${agentMCPLinks.length} agent-MCP server relationships`);
}

// Display database statistics
function displayStats(db: Database.Database): void {
  console.log('\n📊 Database Statistics:');

  const tables = ['agents', 'skills', 'mcp_servers', 'tasks', 'agents_skills_links', 'agents_mcp_servers_links'];

  tables.forEach((table) => {
    const result = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
    console.log(`  ${table}: ${result.count} records`);
  });
}

// Main execution
async function main(): Promise<void> {
  console.log('🚀 Creating test SQLite database for migration testing\n');
  console.log('='.repeat(60));

  try {
    const db = createTestDatabase();
    createSchema(db);
    insertTestData(db);
    displayStats(db);

    db.close();

    console.log('\n' + '='.repeat(60));
    console.log('✅ Test database created successfully!');
    console.log(`\n📍 Location: ${DB_PATH}`);
    console.log('\n📝 Next steps:');
    console.log('  1. Run migration: npm run migrate');
    console.log('  2. Validate migration: npm run validate-migration');
    console.log('  3. Check results in PostgreSQL');
  } catch (error) {
    console.error('\n❌ Error creating test database:', error);
    process.exit(1);
  }
}

main();
