const express = require('express');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const sessionStore = require('../db/sessionStore');
const { requireAuth } = require('../middleware/auth');
const { ALERT_CATEGORIES } = require('../constants');

const router = express.Router();
const BCRYPT_COST = 12;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again later.' },
});

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    short_name: user.short_name,
    role: user.role,
    chip_color: user.chip_color,
  };
}

router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = db
    .prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE AND active = 1')
    .get(username);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Login failed' });
    req.session.userId = user.id;
    req.session.role = user.role;
    req.session.cookie.maxAge = 90 * 24 * 60 * 60 * 1000; // 90 days
    res.json({ user: publicUser(user) });
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!user || !user.active) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const prefRows = db
    .prepare('SELECT category, enabled FROM alert_prefs WHERE user_id = ?')
    .all(user.id);
  const prefs = {};
  for (const cat of ALERT_CATEGORIES) prefs[cat] = 0;
  for (const row of prefRows) prefs[row.category] = row.enabled;

  res.json({ user: publicUser(user), alert_prefs: prefs });
});

router.post('/change-password', requireAuth, (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Current and new password required' });
  }
  if (new_password.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!user || !bcrypt.compareSync(current_password, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const password_hash = bcrypt.hashSync(new_password, BCRYPT_COST);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(password_hash, user.id);

  // Other devices/sessions logged into this account now need the new
  // password — but keep this session (the one making the change) alive.
  sessionStore.invalidateUser(user.id, req.sessionID);

  res.json({ ok: true });
});

module.exports = router;
