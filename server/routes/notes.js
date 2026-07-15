const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin, requireProjectAccess } = require('../middleware/auth');
const { notify } = require('../services/notify');
const { getAdminUserIds } = require('../services/recipients');
const { translateToSpanish } = require('../services/translate');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router({ mergeParams: true });

function noteSelect() {
  return `SELECT notes.*, users.display_name AS author_name, users.short_name AS author_short_name,
                  users.chip_color AS author_chip_color
           FROM notes JOIN users ON users.id = notes.author_id`;
}

router.get('/', requireAuth, requireProjectAccess(db), (req, res) => {
  const rows = db
    .prepare(`${noteSelect()} WHERE project_id = ? ORDER BY notes.created_at ASC`)
    .all(req.project.id);
  res.json(rows);
});

router.post('/', requireAuth, requireProjectAccess(db), asyncHandler(async (req, res) => {
  const { body } = req.body || {};
  if (!body || !body.trim()) return res.status(400).json({ error: 'body required' });

  const info = db
    .prepare(`INSERT INTO notes (project_id, author_id, body) VALUES (?, ?, ?)`)
    .run(req.project.id, req.session.userId, body);

  const project = req.project;
  if (req.session.role === 'admin') {
    await notify(project.crew_id, 'note', `Note on ${project.name}`, project.id);
  } else {
    for (const adminId of getAdminUserIds()) {
      await notify(adminId, 'note', `Note on ${project.name}`, project.id);
    }
  }

  const note = db.prepare(`${noteSelect()} WHERE notes.id = ?`).get(info.lastInsertRowid);
  res.status(201).json(note);
}));

// First request translates and caches; later requests are instant for everyone.
router.post('/:noteId/translate', requireAuth, requireProjectAccess(db), asyncHandler(async (req, res) => {
  const note = db.prepare('SELECT * FROM notes WHERE id = ? AND project_id = ?').get(req.params.noteId, req.project.id);
  if (!note) return res.status(404).json({ error: 'Note not found' });

  if (note.body_es) return res.json({ body_es: note.body_es });

  const translated = await translateToSpanish(note.body);
  if (translated === null) {
    return res.status(503).json({ error: 'Translation unavailable' });
  }

  db.prepare('UPDATE notes SET body_es = ? WHERE id = ?').run(translated, note.id);
  res.json({ body_es: translated });
}));

router.delete('/:noteId', requireAuth, requireAdmin, requireProjectAccess(db), (req, res) => {
  db.prepare('DELETE FROM notes WHERE id = ? AND project_id = ?').run(req.params.noteId, req.project.id);
  res.json({ ok: true });
});

module.exports = router;
