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
  const rows = req.session.role === 'admin'
    ? db.prepare(`${noteSelect()} WHERE project_id = ? ORDER BY notes.created_at ASC`).all(req.project.id)
    : db.prepare(`${noteSelect()} WHERE project_id = ? AND visibility = 'everyone' ORDER BY notes.created_at ASC`).all(req.project.id);
  res.json(rows);
});

router.post('/', requireAuth, requireProjectAccess(db), asyncHandler(async (req, res) => {
  const { body, visibility } = req.body || {};
  if (!body || !body.trim()) return res.status(400).json({ error: 'body required' });

  // Only admins may post an admin-only note — crew-authored notes always
  // default to 'everyone' regardless of what's sent.
  const noteVisibility = req.session.role === 'admin' && visibility === 'admin' ? 'admin' : 'everyone';

  const info = db
    .prepare(`INSERT INTO notes (project_id, author_id, body, visibility) VALUES (?, ?, ?, ?)`)
    .run(req.project.id, req.session.userId, body, noteVisibility);

  const project = req.project;
  // An admin-only note has nothing to notify the crew about — they can't see it.
  if (noteVisibility === 'everyone') {
    if (req.session.role === 'admin') {
      await notify(project.crew_id, 'note', `Note on ${project.name}`, project.id);
    } else {
      for (const adminId of getAdminUserIds()) {
        await notify(adminId, 'note', `Note on ${project.name}`, project.id);
      }
    }
  }

  const note = db.prepare(`${noteSelect()} WHERE notes.id = ?`).get(info.lastInsertRowid);
  res.status(201).json(note);
}));

// First request translates and caches; later requests are instant for everyone.
router.post('/:noteId/translate', requireAuth, requireProjectAccess(db), asyncHandler(async (req, res) => {
  const note = db.prepare('SELECT * FROM notes WHERE id = ? AND project_id = ?').get(req.params.noteId, req.project.id);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  if (note.visibility === 'admin' && req.session.role !== 'admin') {
    return res.status(404).json({ error: 'Note not found' });
  }

  if (note.body_es) return res.json({ body_es: note.body_es });

  const translated = await translateToSpanish(note.body);
  if (translated === null) {
    return res.status(503).json({ error: 'Translation unavailable' });
  }

  db.prepare('UPDATE notes SET body_es = ? WHERE id = ?').run(translated, note.id);
  res.json({ body_es: translated });
}));

// Anyone on the project can edit any note (matches Orders), same as adding
// one — deleting is admin-only, same as everywhere else in the app.
router.patch('/:noteId', requireAuth, requireProjectAccess(db), (req, res) => {
  const note = db.prepare('SELECT * FROM notes WHERE id = ? AND project_id = ?').get(req.params.noteId, req.project.id);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  if (note.visibility === 'admin' && req.session.role !== 'admin') {
    return res.status(404).json({ error: 'Note not found' });
  }

  const { body, visibility } = req.body || {};
  if (body !== undefined && !body.trim()) return res.status(400).json({ error: 'body required' });

  const nextBody = body !== undefined ? body : note.body;
  const bodyChanged = nextBody !== note.body;
  // Only an admin editor may change visibility; a crew editor leaves it as-is.
  const nextVisibility = req.session.role === 'admin' && (visibility === 'admin' || visibility === 'everyone')
    ? visibility
    : note.visibility;

  db.prepare('UPDATE notes SET body = ?, body_es = ?, visibility = ? WHERE id = ?').run(
    nextBody,
    bodyChanged ? null : note.body_es, // stale translation would no longer match
    nextVisibility,
    note.id
  );

  const updated = db.prepare(`${noteSelect()} WHERE notes.id = ?`).get(note.id);
  res.json(updated);
});

router.delete('/:noteId', requireAuth, requireAdmin, requireProjectAccess(db), (req, res) => {
  db.prepare('DELETE FROM notes WHERE id = ? AND project_id = ?').run(req.params.noteId, req.project.id);
  res.json({ ok: true });
});

module.exports = router;
