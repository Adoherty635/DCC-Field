const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin, requireProjectAccess } = require('../middleware/auth');
const { notify } = require('../services/notify');
const { getAdminUserIds } = require('../services/recipients');
const { translateToSpanish } = require('../services/translate');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

function withCounts(project) {
  const counts = db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM photos WHERE project_id = ? AND kind IN ('picture','rendering')) AS pictures,
        (SELECT COUNT(*) FROM notes WHERE project_id = ?) AS notes,
        (SELECT COUNT(*) FROM colors WHERE project_id = ?) AS colors,
        (SELECT COUNT(*) FROM orders WHERE project_id = ?) AS orders,
        (SELECT COUNT(*) FROM photos WHERE project_id = ? AND kind = 'receipt') AS receipts`
    )
    .get(project.id, project.id, project.id, project.id, project.id);

  const nextEvent = db
    .prepare(
      `SELECT date, time_label, title FROM events
       WHERE project_id = ? AND date >= date('now')
       ORDER BY date ASC, time_label ASC LIMIT 1`
    )
    .get(project.id);

  const crew = db.prepare('SELECT id, display_name, short_name, chip_color FROM users WHERE id = ?').get(project.crew_id);

  return { ...project, counts, next_event: nextEvent || null, crew };
}

router.get('/', requireAuth, (req, res) => {
  let rows;
  if (req.session.role === 'admin') {
    if (req.query.crew_id) {
      rows = db.prepare('SELECT * FROM projects WHERE crew_id = ? ORDER BY created_at DESC').all(req.query.crew_id);
    } else {
      rows = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
    }
  } else {
    rows = db
      .prepare('SELECT * FROM projects WHERE crew_id = ? ORDER BY created_at DESC')
      .all(req.session.userId);
  }
  res.json(rows.map(withCounts));
});

router.post('/', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { name, client, address, crew_id, scope } = req.body || {};
  if (!name || !crew_id) return res.status(400).json({ error: 'name and crew_id required' });

  const crew = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'crew'").get(crew_id);
  if (!crew) return res.status(400).json({ error: 'Invalid crew' });

  const scopeText = scope || '';
  const scope_es = scopeText ? await translateToSpanish(scopeText) : '';

  const info = db
    .prepare(
      `INSERT INTO projects (name, client, address, crew_id, scope, scope_es) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(name, client || '', address || '', crew_id, scopeText, scope_es);

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(info.lastInsertRowid);

  await notify(crew_id, 'project', `New project: ${name}`, project.id);

  res.status(201).json(withCounts(project));
}));

router.get('/:id', requireAuth, requireProjectAccess(db), (req, res) => {
  res.json(withCounts(req.project));
});

router.patch('/:id', requireAuth, requireAdmin, requireProjectAccess(db), asyncHandler(async (req, res) => {
  const { name, client, address, status, scope, crew_id } = req.body || {};
  const project = req.project;

  const next = {
    name: name !== undefined ? name : project.name,
    client: client !== undefined ? client : project.client,
    address: address !== undefined ? address : project.address,
    status: status !== undefined ? status : project.status,
    crew_id: crew_id !== undefined ? crew_id : project.crew_id,
  };

  let scope_es = project.scope_es;
  const scopeChanged = scope !== undefined && scope !== project.scope;
  const nextScope = scope !== undefined ? scope : project.scope;

  if (scopeChanged) {
    scope_es = nextScope ? await translateToSpanish(nextScope) : '';
  }

  db.prepare(
    `UPDATE projects SET name = ?, client = ?, address = ?, status = ?, crew_id = ?, scope = ?, scope_es = ? WHERE id = ?`
  ).run(next.name, next.client, next.address, next.status, next.crew_id, nextScope, scope_es, project.id);

  const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(project.id);

  if (scopeChanged) {
    await notify(updated.crew_id, 'scope', `Scope of work updated on ${updated.name}`, updated.id);
  }

  res.json(withCounts(updated));
}));

module.exports = router;
