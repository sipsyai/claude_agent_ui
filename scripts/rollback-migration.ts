/**
 * Claude Agent UI - Migration Rollback Script
 *
 * This script helps rollback the database migration by:
 * - Restoring SQLite database from backup
 * - Switching Strapi configuration back to SQLite
 * - Cleaning up PostgreSQL data (optional)
 *
 * Usage:
 *   npm run rollback-migration [backup-filename]
 *
 * @author Claude Agent UI Team
 * @version 1.0.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as readline from 'readline';

// ============= CONFIGURATION =============

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface RollbackConfig {
  sqliteDbPath: string;
  backupPath: string;
  databaseConfigPath: string;
}

const config: RollbackConfig = {
  sqliteDbPath: path.resolve(__dirname, '../backend/.tmp/data.db'),
  backupPath: path.resolve(__dirname, '../backups'),
  databaseConfigPath: path.resolve(__dirname, '../backend/config/database.ts'),
};

// ============= UTILITY FUNCTIONS =============

/**
 * Ask user for confirmation
 */
function askQuestion(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * List available backups
 */
function listBackups(): string[] {
  if (!fs.existsSync(config.backupPath)) {
    return [];
  }

  const files = fs.readdirSync(config.backupPath);
  return files
    .filter((f) => f.startsWith('data-') && f.endsWith('.db'))
    .sort()
    .reverse(); // Most recent first
}

/**
 * Display available backups
 */
function displayBackups(backups: string[]): void {
  console.log('\n📦 Available backups:\n');

  if (backups.length === 0) {
    console.log('   No backups found');
    return;
  }

  backups.forEach((backup, index) => {
    const backupPath = path.join(config.backupPath, backup);
    const stats = fs.statSync(backupPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    const date = new Date(stats.mtime).toLocaleString();

    console.log(`   ${index + 1}. ${backup}`);
    console.log(`      Size: ${sizeMB} MB`);
    console.log(`      Date: ${date}`);
    console.log();
  });
}

/**
 * Restore SQLite database from backup
 */
function restoreSqliteDatabase(backupFilename: string): void {
  const backupFullPath = path.join(config.backupPath, backupFilename);

  if (!fs.existsSync(backupFullPath)) {
    throw new Error(`Backup file not found: ${backupFullPath}`);
  }

  console.log('\n🔄 Restoring SQLite database...');
  console.log(`   From: ${backupFullPath}`);
  console.log(`   To: ${config.sqliteDbPath}`);

  // Backup current database if it exists
  if (fs.existsSync(config.sqliteDbPath)) {
    const currentBackup = path.join(
      config.backupPath,
      `data-before-rollback-${Date.now()}.db`
    );
    fs.copyFileSync(config.sqliteDbPath, currentBackup);
    console.log(`   ℹ️  Current database backed up to: ${currentBackup}`);
  }

  // Restore from backup
  fs.copyFileSync(backupFullPath, config.sqliteDbPath);
  console.log('✅ Database restored successfully');
}

/**
 * Update Strapi database configuration to use SQLite
 */
function updateDatabaseConfig(): void {
  console.log('\n🔧 Updating Strapi database configuration...');

  if (!fs.existsSync(config.databaseConfigPath)) {
    console.log('   ⚠️  Database config file not found, skipping...');
    return;
  }

  const currentConfig = fs.readFileSync(config.databaseConfigPath, 'utf-8');

  // Check if already using SQLite
  if (currentConfig.includes("client: 'sqlite'") && !currentConfig.includes("// client: 'sqlite'")) {
    console.log('   ℹ️  Already configured for SQLite');
    return;
  }

  // Backup current config
  const configBackup = config.databaseConfigPath.replace('.ts', '.backup.ts');
  fs.writeFileSync(configBackup, currentConfig);
  console.log(`   ℹ️  Current config backed up to: ${configBackup}`);

  // Update config to use SQLite
  let newConfig = currentConfig;

  // Comment out PostgreSQL configuration
  newConfig = newConfig.replace(
    /client: 'postgres',/g,
    "// client: 'postgres',"
  );
  newConfig = newConfig.replace(
    /connection: \{[\s\S]*?host:/g,
    '// connection: {\n    //   host:'
  );

  // Uncomment SQLite configuration
  newConfig = newConfig.replace(
    /\/\/ client: 'sqlite',/g,
    "client: 'sqlite',"
  );

  fs.writeFileSync(config.databaseConfigPath, newConfig);
  console.log('✅ Database configuration updated to SQLite');
}

/**
 * Display rollback instructions
 */
function displayInstructions(): void {
  console.log('\n' + '='.repeat(70));
  console.log('📋 NEXT STEPS');
  console.log('='.repeat(70) + '\n');

  console.log('1. Restart Strapi to apply the configuration changes:');
  console.log('   cd backend && npm run develop\n');

  console.log('2. Verify Strapi is using SQLite:');
  console.log('   - Check the console output for database connection');
  console.log('   - Access the Strapi admin panel at http://localhost:1337/admin');
  console.log('   - Verify your data is present\n');

  console.log('3. If you want to clean up PostgreSQL data:');
  console.log('   - Connect to PostgreSQL');
  console.log('   - Drop the database: DROP DATABASE claude_agent_ui;');
  console.log('   - Recreate it: CREATE DATABASE claude_agent_ui;\n');

  console.log('='.repeat(70) + '\n');
}

// ============= MAIN ROLLBACK FUNCTION =============

/**
 * Main rollback orchestration
 */
async function rollback(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('⏪ CLAUDE AGENT UI - MIGRATION ROLLBACK');
  console.log('='.repeat(70));

  try {
    // Step 1: List available backups
    const backups = listBackups();
    displayBackups(backups);

    if (backups.length === 0) {
      console.log('\n❌ No backups found. Cannot rollback.');
      console.log('   Backup location: ' + config.backupPath);
      process.exit(1);
    }

    // Step 2: Select backup
    let backupFilename: string;

    // Check if backup filename provided as argument
    if (process.argv[2]) {
      backupFilename = process.argv[2];
      if (!backups.includes(backupFilename)) {
        console.log(`\n❌ Backup file not found: ${backupFilename}`);
        process.exit(1);
      }
    } else {
      // Ask user to select backup
      const answer = await askQuestion(
        '\nSelect backup number to restore (or "q" to quit): '
      );

      if (answer.toLowerCase() === 'q') {
        console.log('\nRollback cancelled.');
        process.exit(0);
      }

      const index = parseInt(answer) - 1;
      if (isNaN(index) || index < 0 || index >= backups.length) {
        console.log('\n❌ Invalid backup number');
        process.exit(1);
      }

      backupFilename = backups[index];
    }

    // Step 3: Confirm rollback
    console.log(`\n⚠️  You are about to rollback to: ${backupFilename}`);
    console.log('   This will:');
    console.log('   - Restore the SQLite database from backup');
    console.log('   - Update Strapi configuration to use SQLite');
    console.log('   - Require Strapi restart');
    console.log('\n   NOTE: PostgreSQL data will NOT be deleted automatically.');

    const confirm = await askQuestion('\nAre you sure you want to continue? (yes/no): ');

    if (confirm.toLowerCase() !== 'yes') {
      console.log('\nRollback cancelled.');
      process.exit(0);
    }

    // Step 4: Restore database
    restoreSqliteDatabase(backupFilename);

    // Step 5: Update configuration
    updateDatabaseConfig();

    // Step 6: Display instructions
    displayInstructions();

    console.log('✅ ROLLBACK COMPLETED SUCCESSFULLY!\n');

  } catch (error: any) {
    console.error('\n❌ ROLLBACK FAILED:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// ============= ENTRY POINT =============

rollback().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
