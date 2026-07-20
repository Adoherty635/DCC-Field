const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin, requireProjectAccess } = require('../middleware/auth');
const { notify } = require('../services/notify');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router({ mergeParams: true });

router.get('/', requireAuth, requireProjectAccess(db), (req, res) => {
  const rows = db
    .prepare('SELECT * FROM colors WHERE project_id = ? ORDER BY created_at ASC')
    .all(req.project.id);
  res.json(rows);
});

router.post('/', requireAuth, requireAdmin, requireProjectAccess(db), asyncHandler(async (req, res) => {
  const { manufacturer, name, code, hex, sheen, location_note } = req.body || {};
  if (!name && !code) return res.status(400).json({ error: 'name or code required' });

  const info = db
    .prepare(
      `INSERT INTO colors (project_id, manufacturer, name, code, hex, sheen, location_note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(req.project.id, manufacturer || '', name || '', code || '', hex || '', sheen || '', location_note || '');

  const color = db.prepare('SELECT * FROM colors WHERE id = ?').get(info.lastInsertRowid);

  await notify(req.project.crew_id, 'color', `Color added to ${req.project.name}: ${name || code}`, req.project.id);

  res.status(201).json(color);
}));

router.patch('/:colorId', requireAuth, requireAdmin, requireProjectAccess(db), (req, res) => {
  const existing = db.prepare('SELECT * FROM colors WHERE id = ? AND project_id = ?').get(req.params.colorId, req.project.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const { manufacturer, name, code, hex, sheen, location_note } = req.body || {};

  db.prepare(
    `UPDATE colors SET manufacturer = ?, name = ?, code = ?, hex = ?, sheen = ?, location_note = ? WHERE id = ?`
  ).run(
    manufacturer !== undefined ? manufacturer : existing.manufacturer,
    name !== undefined ? name : existing.name,
    code !== undefined ? code : existing.code,
    hex !== undefined ? hex : existing.hex,
    sheen !== undefined ? sheen : existing.sheen,
    location_note !== undefined ? location_note : existing.location_note,
    existing.id
  );

  const updated = db.prepare('SELECT * FROM colors WHERE id = ?').get(existing.id);
  res.json(updated);
});

router.delete('/:colorId', requireAuth, requireAdmin, requireProjectAccess(db), (req, res) => {
  db.prepare('DELETE FROM colors WHERE id = ? AND project_id = ?').run(req.params.colorId, req.project.id);
  res.json({ ok: true });
});

module.exports = router;
