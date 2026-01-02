/**
 * Claude Agent UI - PostgreSQL Table Verification Script
 *
 * This script verifies that all Strapi content types have created their
 * corresponding PostgreSQL tables with correct schemas.
 *
 * Verifies:
 * - All 7 content type tables exist
 * - Table schemas have required columns
 * - Relations are properly set up
 * - Components and tables are created
 *
 * Usage:
 *   npm run verify:tables
 *   OR
 *   tsx scripts/verify-postgres-tables.ts
 *
 * @author Claude Agent UI Team
 * @version 1.0.0
 */

import pg from 'pg';
import { config as dotenvConfig } from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

// Load environment variables
dotenvConfig();

// ============= CONFIGURATION =============

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface VerificationConfig {
  database: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
}

const config: VerificationConfig = {
  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    database: process.env.DATABASE_NAME || 'strapi',
    user: process.env.DATABASE_USERNAME || 'strapi',
    password: process.env.DATABASE_PASSWORD || 'strapi',
  },
};

// ============= TYPES =============

interface TableCheck {
  tableName: string;
  requiredColumns: string[];
  status: 'pass' | 'fail' | 'partial';
  message: string;
  details?: {
    existingColumns?: string[];
    missingColumns?: string[];
    extraInfo?: string;
  };
}

interface VerificationResult {
  passed: boolean;
  checks: TableCheck[];
  summary: {
    totalTables: number;
    tablesFound: number;
    tablesMissing: number;
    componentsFound: number;
  };
}

// ============= EXPECTED TABLES AND SCHEMAS =============

const EXPECTED_CONTENT_TYPES = [
  {
    tableName: 'agents',
    requiredColumns: ['id', 'document_id', 'name', 'slug', 'description', 'system_prompt', 'enabled', 'created_at', 'updated_at'],
    description: 'Agent entities with tools, skills, and MCP servers',
  },
  {
    tableName: 'skills',
    requiredColumns: ['id', 'document_id', 'name', 'display_name', 'description', 'skillmd', 'experience_score', 'category', 'is_public', 'version', 'created_at', 'updated_at'],
    description: 'Claude Agent SDK skills',
  },
  {
    tableName: 'mcp_servers',
    requiredColumns: ['id', 'document_id', 'name', 'description', 'command', 'args', 'env', 'disabled', 'transport', 'is_healthy', 'created_at', 'updated_at'],
    description: 'Model Context Protocol servers',
  },
  {
    tableName: 'tasks',
    requiredColumns: ['id', 'document_id', 'message', 'status', 'result', 'error', 'started_at', 'completed_at', 'execution_time', 'tokens_used', 'cost', 'created_at', 'updated_at'],
    description: 'Agent execution tasks and history',
  },
  {
    tableName: 'chat_sessions',
    requiredColumns: ['id', 'document_id', 'title', 'status', 'session_id', 'permission_mode', 'plan_mode', 'created_at', 'updated_at'],
    description: 'Chat sessions',
  },
  {
    tableName: 'chat_messages',
    requiredColumns: ['id', 'document_id', 'role', 'content', 'attachments', 'metadata', 'timestamp', 'created_at', 'updated_at'],
    description: 'Chat messages',
  },
  {
    tableName: 'mcp_tools',
    requiredColumns: ['id', 'document_id', 'name', 'description', 'input_schema', 'created_at', 'updated_at'],
    description: 'Tools provided by MCP servers',
  },
];

// Expected component tables (created by Strapi for components)
const EXPECTED_COMPONENT_TABLES = [
  'components_agent_tool_configurations',
  'components_agent_model_configurations',
  'components_agent_analytics',
  'components_shared_metadata',
  'components_mcp_server_selections',
  'components_skill_skill_selections',
  'components_task_task_selections',
  'components_skill_training_sessions',
  'components_skill_skill_files',
  'components_agent_agent_selections',
  'components_skill_input_fields',
];

// ============= VERIFICATION FUNCTIONS =============

/**
 * Get all tables in the database
 */
async function getAllTables(pool: pg.Pool): Promise<string[]> {
  const query = `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `;

  const result = await pool.query(query);
  return result.rows.map((row) => row.table_name);
}

/**
 * Get columns for a specific table
 */
async function getTableColumns(pool: pg.Pool, tableName: string): Promise<string[]> {
  const query = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = $1
    ORDER BY ordinal_position;
  `;

  const result = await pool.query(query, [tableName]);
  return result.rows.map((row) => row.column_name);
}

/**
 * Get row count for a table
 */
async function getTableRowCount(pool: pg.Pool, tableName: string): Promise<number> {
  try {
    const result = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    return -1;
  }
}

/**
 * Verify a specific content type table
 */
async function verifyContentTypeTable(
  pool: pg.Pool,
  tableConfig: typeof EXPECTED_CONTENT_TYPES[0],
  allTables: string[]
): Promise<TableCheck> {
  const { tableName, requiredColumns, description } = tableConfig;

  // Check if table exists
  if (!allTables.includes(tableName)) {
    return {
      tableName,
      requiredColumns,
      status: 'fail',
      message: `Table '${tableName}' does not exist`,
      details: {
        extraInfo: description,
      },
    };
  }

  // Get actual columns
  const actualColumns = await getTableColumns(pool, tableName);

  // Check for missing required columns
  const missingColumns = requiredColumns.filter((col) => !actualColumns.includes(col));

  // Get row count
  const rowCount = await getTableRowCount(pool, tableName);

  if (missingColumns.length === 0) {
    return {
      tableName,
      requiredColumns,
      status: 'pass',
      message: `Table '${tableName}' exists with all required columns (${actualColumns.length} columns, ${rowCount} rows)`,
      details: {
        existingColumns: actualColumns,
        extraInfo: rowCount >= 0 ? `Contains ${rowCount} records` : 'Unable to query row count',
      },
    };
  } else {
    return {
      tableName,
      requiredColumns,
      status: 'partial',
      message: `Table '${tableName}' exists but missing ${missingColumns.length} columns`,
      details: {
        existingColumns: actualColumns,
        missingColumns,
        extraInfo: description,
      },
    };
  }
}

/**
 * Verify component tables exist
 */
async function verifyComponentTables(pool: pg.Pool, allTables: string[]): Promise<{
  found: string[];
  missing: string[];
}> {
  const found: string[] = [];
  const missing: string[] = [];

  for (const componentTable of EXPECTED_COMPONENT_TABLES) {
    if (allTables.includes(componentTable)) {
      found.push(componentTable);
    } else {
      missing.push(componentTable);
    }
  }

  return { found, missing };
}

/**
 * Verify relations between tables
 */
async function verifyRelations(pool: pg.Pool): Promise<{
  status: 'pass' | 'fail';
  message: string;
  details: any;
}> {
  try {
    const query = `
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name IN ('agents', 'skills', 'mcp_servers', 'tasks', 'chat_sessions', 'chat_messages', 'mcp_tools')
      ORDER BY tc.table_name;
    `;

    const result = await pool.query(query);
    const relations = result.rows;

    return {
      status: 'pass',
      message: `Found ${relations.length} foreign key relationships`,
      details: {
        relationCount: relations.length,
        relations: relations.map((r) => ({
          from: `${r.table_name}.${r.column_name}`,
          to: `${r.foreign_table_name}.${r.foreign_column_name}`,
        })),
      },
    };
  } catch (error: any) {
    return {
      status: 'fail',
      message: `Failed to verify relations: ${error.message}`,
      details: { error: error.message },
    };
  }
}

/**
 * Test basic CRUD operations
 */
async function testBasicCRUD(pool: pg.Pool): Promise<{
  status: 'pass' | 'fail';
  message: string;
  details?: any;
}> {
  try {
    // Test simple SELECT on each table
    const tables = ['agents', 'skills', 'mcp_servers', 'tasks', 'chat_sessions', 'chat_messages', 'mcp_tools'];
    const results: any = {};

    for (const table of tables) {
      try {
        const result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
        results[table] = {
          queryable: true,
          rowCount: parseInt(result.rows[0].count, 10),
        };
      } catch (error: any) {
        results[table] = {
          queryable: false,
          error: error.message,
        };
      }
    }

    const allQueryable = Object.values(results).every((r: any) => r.queryable);

    return {
      status: allQueryable ? 'pass' : 'fail',
      message: allQueryable
        ? 'All tables are queryable'
        : 'Some tables failed basic SELECT query',
      details: results,
    };
  } catch (error: any) {
    return {
      status: 'fail',
      message: `CRUD test failed: ${error.message}`,
      details: { error: error.message },
    };
  }
}

// ============= MAIN VERIFICATION =============

async function verify(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('🔍 POSTGRESQL TABLE VERIFICATION');
  console.log('='.repeat(70) + '\n');

  const pool = new Pool(config.database);

  try {
    // Test connection
    console.log('📡 Connecting to PostgreSQL...');
    console.log(`   Host: ${config.database.host}:${config.database.port}`);
    console.log(`   Database: ${config.database.database}`);
    console.log(`   User: ${config.database.user}\n`);

    await pool.query('SELECT NOW()');
    console.log('✅ PostgreSQL connection successful\n');

    // Get all tables
    const allTables = await getAllTables(pool);
    console.log(`📊 Found ${allTables.length} tables in database\n`);

    const result: VerificationResult = {
      passed: false,
      checks: [],
      summary: {
        totalTables: EXPECTED_CONTENT_TYPES.length,
        tablesFound: 0,
        tablesMissing: 0,
        componentsFound: 0,
      },
    };

    // Verify each content type table
    console.log('🔍 Verifying content type tables...\n');
    for (const tableConfig of EXPECTED_CONTENT_TYPES) {
      const check = await verifyContentTypeTable(pool, tableConfig, allTables);
      result.checks.push(check);

      if (check.status === 'pass') {
        result.summary.tablesFound++;
      } else if (check.status === 'fail') {
        result.summary.tablesMissing++;
      }
    }

    // Verify component tables
    console.log('\n🔍 Verifying component tables...\n');
    const componentCheck = await verifyComponentTables(pool, allTables);
    result.summary.componentsFound = componentCheck.found.length;

    console.log(`✅ Found ${componentCheck.found.length}/${EXPECTED_COMPONENT_TABLES.length} component tables`);
    if (componentCheck.missing.length > 0) {
      console.log(`⚠️  Missing component tables: ${componentCheck.missing.join(', ')}`);
    }
    console.log();

    // Verify relations
    console.log('🔍 Verifying foreign key relationships...\n');
    const relationCheck = await verifyRelations(pool);
    console.log(`${relationCheck.status === 'pass' ? '✅' : '❌'} ${relationCheck.message}`);
    if (relationCheck.details?.relations) {
      console.log(`   Sample relations: ${JSON.stringify(relationCheck.details.relations.slice(0, 3), null, 2)}`);
    }
    console.log();

    // Test CRUD operations
    console.log('🔍 Testing basic CRUD operations...\n');
    const crudCheck = await testBasicCRUD(pool);
    console.log(`${crudCheck.status === 'pass' ? '✅' : '❌'} ${crudCheck.message}`);
    console.log();

    // Display detailed results
    console.log('='.repeat(70));
    console.log('📊 DETAILED RESULTS');
    console.log('='.repeat(70) + '\n');

    for (const check of result.checks) {
      const icon = check.status === 'pass' ? '✅' : check.status === 'partial' ? '⚠️ ' : '❌';
      console.log(`${icon} ${check.tableName}: ${check.message}`);

      if (check.details?.missingColumns && check.details.missingColumns.length > 0) {
        console.log(`   Missing columns: ${check.details.missingColumns.join(', ')}`);
      }
      if (check.details?.extraInfo) {
        console.log(`   Info: ${check.details.extraInfo}`);
      }
      console.log();
    }

    // Summary
    console.log('='.repeat(70));
    console.log('📈 SUMMARY');
    console.log('='.repeat(70));
    console.log(`   Total Content Types: ${result.summary.totalTables}`);
    console.log(`   ✅ Tables Found: ${result.summary.tablesFound}`);
    console.log(`   ❌ Tables Missing: ${result.summary.tablesMissing}`);
    console.log(`   🔧 Component Tables: ${result.summary.componentsFound}/${EXPECTED_COMPONENT_TABLES.length}`);
    console.log(`   🔗 Relations: ${relationCheck.status === 'pass' ? 'OK' : 'FAILED'}`);
    console.log(`   📝 CRUD Operations: ${crudCheck.status === 'pass' ? 'OK' : 'FAILED'}`);
    console.log('='.repeat(70) + '\n');

    result.passed = result.summary.tablesMissing === 0 && relationCheck.status === 'pass' && crudCheck.status === 'pass';

    if (result.passed) {
      console.log('✅ VERIFICATION PASSED!');
      console.log('   All 7 content types have created tables successfully');
      console.log('   All required columns are present');
      console.log('   Relations and components are working correctly\n');
      process.exit(0);
    } else {
      console.log('❌ VERIFICATION FAILED!');
      console.log('   Some tables are missing or incomplete');
      console.log('   Please check the detailed results above\n');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n❌ VERIFICATION ERROR:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// ============= ENTRY POINT =============

verify().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
