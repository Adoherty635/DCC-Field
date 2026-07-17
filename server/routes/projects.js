const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const config = require('../config');
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
        (SELECT COUNT(*) FROM photos WHERE project_id = ? AND kind = 'picture') AS pictures,
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

// Keeps "Start"/"End" calendar events in sync with a project's dates —
// creates, moves, or removes them as start_date/end_date change, without
// touching manually-added events (those have auto_type = NULL).
function syncProjectEvents(project) {
  const upsert = (date, autoType, title) => {
    const existing = db
      .prepare('SELECT id FROM events WHERE project_id = ? AND auto_type = ?')
      .get(project.id, autoType);

    if (!date) {
      if (existing) db.prepare('DELETE FROM events WHERE id = ?').run(existing.id);
      return;
    }

    if (existing) {
      db.prepare('UPDATE events SET date = ?, crew_id = ?, title = ? WHERE id = ?').run(
        date,
        project.crew_id,
        title,
        existing.id
      );
    } else {
      db.prepare(
        `INSERT INTO events (project_id, crew_id, date, time_label, title, auto_type) VALUES (?, ?, ?, '', ?, ?)`
      ).run(project.id, project.crew_id, date, title, autoType);
    }
  };

  upsert(project.start_date, 'start', 'Job start');
  upsert(project.end_date, 'end', 'Job end');
}

// Every event tied to a project — auto or manually scheduled — should
// always belong to whichever crew currently owns the project, so a
// reassignment moves the whole calendar picture, not just the auto events.
function reassignProjectEvents(projectId, crewId) {
  db.prepare('UPDATE events SET crew_id = ? WHERE project_id = ?').run(crewId, projectId);
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
  const { name, client, address, crew_id, scope, start_date, end_date } = req.body || {};
  if (!name || !crew_id) return res.status(400).json({ error: 'name and crew_id required' });

  const crew = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'crew'").get(crew_id);
  if (!crew) return res.status(400).json({ error: 'Invalid crew' });

  const scopeText = scope || '';
  const scope_es = scopeText ? await translateToSpanish(scopeText) : '';

  const info = db
    .prepare(
      `INSERT INTO projects (name, client, address, crew_id, scope, scope_es, start_date, end_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(name, client || '', address || '', crew_id, scopeText, scope_es, start_date || null, end_date || null);

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(info.lastInsertRowid);
  syncProjectEvents(project);

  await notify(crew_id, 'project', `New project: ${name}`, project.id);

  res.status(201).json(withCounts(project));
}));

router.get('/:id', requireAuth, requireProjectAccess(db), (req, res) => {
  res.json(withCounts(req.project));
});

router.patch('/:id', requireAuth, requireAdmin, requireProjectAccess(db), asyncHandler(async (req, res) => {
  const { name, client, address, status, scope, crew_id, start_date, end_date } = req.body || {};
  const project = req.project;

  const crewChanged = crew_id !== undefined && String(crew_id) !== String(project.crew_id);
  if (crewChanged) {
    const crew = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'crew'").get(crew_id);
    if (!crew) return res.status(400).json({ error: 'Invalid crew' });
  }

  const next = {
    name: name !== undefined ? name : project.name,
    client: client !== undefined ? client : project.client,
    address: address !== undefined ? address : project.address,
    status: status !== undefined ? status : project.status,
    crew_id: crew_id !== undefined ? crew_id : project.crew_id,
    start_date: start_date !== undefined ? (start_date || null) : project.start_date,
    end_date: end_date !== undefined ? (end_date || null) : project.end_date,
  };

  let scope_es = project.scope_es;
  const scopeChanged = scope !== undefined && scope !== project.scope;
  const nextScope = scope !== undefined ? scope : project.scope;

  if (scopeChanged) {
    scope_es = nextScope ? await translateToSpanish(nextScope) : '';
  }

  db.prepare(
    `UPDATE projects SET name = ?, client = ?, address = ?, status = ?, crew_id = ?, scope = ?, scope_es = ?,
            start_date = ?, end_date = ? WHERE id = ?`
  ).run(
    next.name, next.client, next.address, next.status, next.crew_id, nextScope, scope_es,
    next.start_date, next.end_date, project.id
  );

  const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(project.id);

  if (crewChanged) {
    reassignProjectEvents(updated.id, updated.crew_id);
  }
  syncProjectEvents(updated);

  if (scopeChanged) {
    await notify(updated.crew_id, 'scope', `Scope of work updated on ${updated.name}`, updated.id);
  }
  if (crewChanged) {
    await notify(updated.crew_id, 'project', `Project reassigned to your crew: ${updated.name}`, updated.id);
  }

  res.json(withCounts(updated));
}));

// Punch list is editable by both admin and crew (unlike scope), so this is
// deliberately separate from the admin-only PATCH /:id above.
router.patch('/:id/punch-list', requireAuth, requireProjectAccess(db), asyncHandler(async (req, res) => {
  const { punch_list } = req.body || {};
  if (punch_list === undefined) return res.status(400).json({ error: 'punch_list required' });

  const project = req.project;
  db.prepare('UPDATE projects SET punch_list = ? WHERE id = ?').run(punch_list, project.id);
  const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(project.id);

  if (req.session.role === 'admin') {
    await notify(project.crew_id, 'note', `Punch list updated on ${project.name}`, project.id);
  } else {
    for (const adminId of getAdminUserIds()) {
      await notify(adminId, 'note', `Punch list updated on ${project.name}`, project.id);
    }
  }

  res.json(withCounts(updated));
}));

router.delete('/:id', requireAuth, requireAdmin, requireProjectAccess(db), (req, res) => {
  const project = req.project;

  const photoFiles = db.prepare('SELECT file_path, thumb_path FROM photos WHERE project_id = ?').all(project.id);
  const docFiles = db.prepare('SELECT file_path, thumb_path FROM documents WHERE project_id = ?').all(project.id);

  db.prepare('DELETE FROM projects WHERE id = ?').run(project.id);

  for (const row of [...photoFiles, ...docFiles]) {
    for (const p of [row.file_path, row.thumb_path]) {
      if (p) fs.unlink(path.join(config.uploadsPath, p), () => {});
    }
  }

  res.json({ ok: true });
});

module.exports = router;
