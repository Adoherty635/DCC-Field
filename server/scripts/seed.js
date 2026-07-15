const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('../db');
const { defaultPrefsFor } = require('../constants');

const BCRYPT_COST = 12;

function randomPassword() {
  return crypto.randomBytes(9).toString('base64').replace(/[/+=]/g, '').slice(0, 10);
}

function createUser({ username, display_name, short_name, role, chip_color }) {
  const password = randomPassword();
  const password_hash = bcrypt.hashSync(password, BCRYPT_COST);
  const info = db
    .prepare(
      `INSERT INTO users (username, password_hash, display_name, short_name, role, chip_color, active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`
    )
    .run(username, password_hash, display_name, short_name, role, chip_color);

  const userId = info.lastInsertRowid;
  const insertPref = db.prepare(
    `INSERT INTO alert_prefs (user_id, category, enabled) VALUES (?, ?, ?)`
  );
  for (const pref of defaultPrefsFor(role)) {
    insertPref.run(userId, pref.category, pref.enabled);
  }

  return { username, password, userId };
}

function seed() {
  const existing = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (existing > 0) {
    console.log('Users already exist — skipping seed.');
    return;
  }

  const seeds = [
    { username: 'alex', display_name: 'Alex', short_name: 'Alex', role: 'admin', chip_color: '#22262B' },
    { username: 'rmpp', display_name: 'Rocky Mountain Pro Painters', short_name: 'RMPP', role: 'crew', chip_color: '#C7791B' },
    { username: 'lucas', display_name: 'Lucas Fine Finishes', short_name: 'Lucas', role: 'crew', chip_color: '#2F7A55' },
    { username: 'quali', display_name: 'Qualipaint', short_name: 'Quali', role: 'crew', chip_color: '#5B4FBF' },
  ];

  console.log('Seeding users. TEMPORARY PASSWORDS (shown once — save them now):');
  console.log('----------------------------------------------------------------');
  for (const s of seeds) {
    const { username, password } = createUser(s);
    console.log(`  ${username.padEnd(10)} ${password}`);
  }
  console.log('----------------------------------------------------------------');
  console.log('Change these via the Team screen after first login.');
}

seed();
