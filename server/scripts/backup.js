const fs = require('fs');
const path = require('path');
const db = require('../db');
const config = require('../config');

const KEEP = 14;
const backupDir = path.join(path.dirname(config.dbPath), 'backups');

async function run() {
  fs.mkdirSync(backupDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(backupDir, `app-${stamp}.db`);

  await db.backup(dest);
  console.log(`Backup written: ${dest}`);

  const files = fs
    .readdirSync(backupDir)
    .filter((f) => f.startsWith('app-') && f.endsWith('.db'))
    .sort();

  const excess = files.length - KEEP;
  if (excess > 0) {
    for (const file of files.slice(0, excess)) {
      fs.unlinkSync(path.join(backupDir, file));
      console.log(`Removed old backup: ${file}`);
    }
  }
}

run().catch((err) => {
  console.error('Backup failed:', err);
  process.exit(1);
});
