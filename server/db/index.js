const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('../config');

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
fs.mkdirSync(config.uploadsPath, { recursive: true });

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// Additive migrations for databases created before a column existed —
// CREATE TABLE IF NOT EXISTS above only helps on brand-new databases.
function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn('projects', 'scope_doc_path', 'TEXT');
ensureColumn('projects', 'scope_doc_name', 'TEXT');
ensureColumn('projects', 'scope_doc_mime', 'TEXT');
ensureColumn('projects', 'start_date', 'TEXT');
ensureColumn('projects', 'end_date', 'TEXT');
ensureColumn('events', 'auto_type', 'TEXT');

module.exports = db;
