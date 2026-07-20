const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('../db');
const sessionStore = require('../db/sessionStore');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { ALERT_CATEGORIES, defaultPrefsFor } = require('../constants');

const router = express.Router();
const BCRYPT_COST = 12;

function randomPassword() {
  return crypto.randomBytes(9).toString('base64').replace(/[/+=]/g, '').slice(0, 10);
}

function slugUsername(displayName) {
  const base = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'crew';
  let candidate = base;
  let n = 1;
  const exists = db.prepare('SELECT 1 FROM users WHERE username = ?');
  while (exists.get(candidate)) {
    n += 1;
    candidate = `${base}${n}`;
  }
  return candidate;
}

function withPrefs(user) {
  const rows = db.prepare('SELECT category, enabled FROM alert_prefs WHERE user_id = ?').all(user.id);
  const prefs = {};
  for (const cat of ALERT_CATEGORIES) prefs[cat] = 0;
  for (const row of rows) prefs[row.category] = row.enabled;
  return {
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    short_name: user.short_name,
    role: user.role,
    chip_color: user.chip_color,
    phone: user.phone,
    active: !!user.active,
    alert_prefs: prefs,
  };
}

router.get('/', requireAuth, requireAdmin, (req, res) => {
  const users = db.prepare('SELECT * FROM users ORDER BY role DESC, display_name ASC').all();
  res.json(users.map(withPrefs));
});

router.post('/', requireAuth, requireAdmin, (req, res) => {
  const { display_name, short_name, chip_color, phone, role } = req.body || {};
  if (!display_name) return res.status(400).json({ error: 'display_name required' });

  const nextRole = role === 'admin' ? 'admin' : 'crew';

  const username = slugUsername(display_name);
  const password = randomPassword();
  const password_hash = bcrypt.hashSync(password, BCRYPT_COST);

  const info = db
    .prepare(
      `INSERT INTO users (username, password_hash, display_name, short_name, role, chip_color, phone, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
    )
    .run(username, password_hash, display_name, short_name || display_name, nextRole, chip_color || '#5B4FBF', phone || null);

  const userId = info.lastInsertRowid;
  const insertPref = db.prepare('INSERT INTO alert_prefs (user_id, category, enabled) VALUES (?, ?, ?)');
  for (const pref of defaultPrefsFor(nextRole)) insertPref.run(userId, pref.category, pref.enabled);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  res.status(201).json({ ...withPrefs(user), temp_password: password });
});

router.patch('/:id', requireAuth, requireAdmin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });

  const { display_name, short_name, chip_color, phone, active, alert_prefs } = req.body || {};

  db.prepare(
    `UPDATE users SET display_name = ?, short_name = ?, chip_color = ?, phone = ?, active = ? WHERE id = ?`
  ).run(
    display_name ?? user.display_name,
    short_name ?? user.short_name,
    chip_color ?? user.chip_color,
    phone !== undefined ? phone : user.phone,
    active !== undefined ? (active ? 1 : 0) : user.active,
    user.id
  );

  if (active === false) {
    sessionStore.invalidateUser(user.id);
  }

  if (alert_prefs && typeof alert_prefs === 'object') {
    const upsert = db.prepare(
      `INSERT INTO alert_prefs (user_id, category, enabled) VALUES (?, ?, ?)
       ON CONFLICT(user_id, category) DO UPDATE SET enabled = excluded.enabled`
    );
    for (const category of ALERT_CATEGORIES) {
      if (category in alert_prefs) {
        upsert.run(user.id, category, alert_prefs[category] ? 1 : 0);
      }
    }
  }

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  res.json(withPrefs(updated));
});

router.post('/:id/reset-password', requireAuth, requireAdmin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });

  const password = randomPassword();
  const password_hash = bcrypt.hashSync(password, BCRYPT_COST);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(password_hash, user.id);

  sessionStore.invalidateUser(user.id);

  res.json({ temp_password: password });
});

module.exports = router;
