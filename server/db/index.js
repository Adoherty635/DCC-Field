const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('../config');

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
fs.mkdirSync(config.uploadsPath, { recursive: true });

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
// Without this, a write that collides with another in-flight write fails
// immediately (SQLITE_BUSY) instead of waiting briefly for the lock to clear.
db.pragma('busy_timeout = 5000');

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
ensureColumn('projects', 'punch_list', "TEXT NOT NULL DEFAULT ''");
ensureColumn('colors', 'product', 'TEXT');
ensureColumn('notes', 'visibility', "TEXT NOT NULL DEFAULT 'everyone' CHECK (visibility IN ('admin', 'everyone'))");
ensureColumn('photos', 'media_type', "TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video'))");
ensureColumn('photos', 'mime', 'TEXT');
ensureColumn('photos', 'caption', 'TEXT');

// SQLite can't ALTER a CHECK constraint in place — a database created before
// 'punch_list' was a valid documents.category needs the table rebuilt (data
// preserved) to accept it. No-ops once already rebuilt.
function ensureDocumentsCategoryIncludesPunchList() {
  const table = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'documents'").get();
  if (!table || table.sql.includes('punch_list')) return;

  db.transaction(() => {
    db.exec('ALTER TABLE documents RENAME TO documents_old');
    db.exec(`
      CREATE TABLE documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        author_id INTEGER NOT NULL REFERENCES users(id),
        category TEXT NOT NULL CHECK (category IN ('scope', 'rendering', 'punch_list')),
        file_path TEXT NOT NULL,
        thumb_path TEXT,
        original_name TEXT,
        mime TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    db.exec('INSERT INTO documents SELECT * FROM documents_old');
    db.exec('DROP TABLE documents_old');
    db.exec('CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id, category)');
  })();
}

ensureDocumentsCategoryIncludesPunchList();

// Videos don't get a generated thumbnail, so thumb_path needs to allow NULL —
// SQLite can't drop a NOT NULL constraint in place, so rebuild the table.
// Uses explicit column lists (not SELECT *) since ensureColumn above may have
// already appended media_type/mime/caption after the original columns, and a
// positional SELECT * would shuffle values into the wrong columns.
function ensurePhotosThumbPathNullable() {
  const table = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'photos'").get();
  if (!table || !/thumb_path\s+TEXT\s+NOT\s+NULL/i.test(table.sql)) return;

  db.transaction(() => {
    db.exec('ALTER TABLE photos RENAME TO photos_old');
    db.exec(`
      CREATE TABLE photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        author_id INTEGER NOT NULL REFERENCES users(id),
        kind TEXT NOT NULL CHECK (kind IN ('picture','receipt','rendering')),
        media_type TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
        file_path TEXT NOT NULL,
        thumb_path TEXT,
        mime TEXT,
        caption TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    db.exec(`
      INSERT INTO photos (id, project_id, author_id, kind, media_type, file_path, thumb_path, mime, caption, created_at)
      SELECT id, project_id, author_id, kind, media_type, file_path, thumb_path, mime, caption, created_at FROM photos_old
    `);
    db.exec('DROP TABLE photos_old');
    db.exec('CREATE INDEX IF NOT EXISTS idx_photos_project ON photos(project_id, kind)');
  })();
}

ensurePhotosThumbPathNullable();

// One-time migration: the old single scope_doc_* columns and the
// photos(kind='rendering') rows are superseded by the documents table
// (which supports multiple files per project and non-image types like
// PDFs). Copy anything old forward into it, guarded so it only runs once.
function migrateLegacyDocuments() {
  const projectsWithScopeDoc = db
    .prepare('SELECT * FROM projects WHERE scope_doc_path IS NOT NULL')
    .all();
  if (projectsWithScopeDoc.length) {
    const alreadyMigrated = new Set(
      db.prepare("SELECT project_id FROM documents WHERE category = 'scope'").all().map((r) => r.project_id)
    );
    const fallbackAuthor = db.prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1").get();
    const insertScope = db.prepare(
      `INSERT INTO documents (project_id, author_id, category, file_path, original_name, mime)
       VALUES (?, ?, 'scope', ?, ?, ?)`
    );
    for (const p of projectsWithScopeDoc) {
      if (alreadyMigrated.has(p.id)) continue;
      insertScope.run(p.id, fallbackAuthor ? fallbackAuthor.id : p.crew_id, p.scope_doc_path, p.scope_doc_name, p.scope_doc_mime);
    }
  }

  const renderingPhotos = db.prepare("SELECT * FROM photos WHERE kind = 'rendering'").all();
  if (renderingPhotos.length) {
    const alreadyMigrated = new Set(
      db.prepare("SELECT file_path FROM documents WHERE category = 'rendering'").all().map((r) => r.file_path)
    );
    const insertRendering = db.prepare(
      `INSERT INTO documents (project_id, author_id, category, file_path, thumb_path, mime)
       VALUES (?, ?, 'rendering', ?, ?, 'image/jpeg')`
    );
    for (const r of renderingPhotos) {
      if (alreadyMigrated.has(r.file_path)) continue;
      insertRendering.run(r.project_id, r.author_id, r.file_path, r.thumb_path);
    }
  }
}

migrateLegacyDocuments();

module.exports = db;
