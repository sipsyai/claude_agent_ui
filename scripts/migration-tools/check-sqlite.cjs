const Database = require('better-sqlite3');

const db = new Database('backend/.tmp/data.db', { readonly: true });

console.log('=== SQLite Database Inspection ===\n');

// Get all tables
const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).all();
console.log('Tables:', tables.map(t => t.name).join(', '));
console.log('');

// Check each important table
const checkTable = (tableName) => {
  try {
    const count = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
    console.log(`${tableName}: ${count.count} rows`);

    if (count.count > 0) {
      const sample = db.prepare(`SELECT * FROM ${tableName} LIMIT 1`).get();
      console.log(`  Sample columns:`, Object.keys(sample).join(', '));
    }
  } catch (error) {
    console.log(`${tableName}: Error - ${error.message}`);
  }
};

console.log('=== Row Counts ===');
checkTable('agents');
checkTable('skills');
checkTable('mcp_servers');
checkTable('tasks');
checkTable('agents_skills_links');
checkTable('agents_mcp_servers_links');

db.close();
