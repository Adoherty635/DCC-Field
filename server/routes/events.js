const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { notify } = require('../services/notify');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

function eventSelect() {
  return `SELECT events.*, projects.name AS project_name, users.short_name AS crew_short_name,
                  users.chip_color AS crew_chip_color
           FROM events
           JOIN projects ON projects.id = events.project_id
           JOIN users ON users.id = events.crew_id`;
}

router.get('/', requireAuth, (req, res) => {
  const { month } = req.query; // "YYYY-MM"
  const params = [];
  let where = '1=1';
  if (month) {
    where += ` AND strftime('%Y-%m', events.date) = ?`;
    params.push(month);
  }
  if (req.session.role !== 'admin') {
    where += ' AND events.crew_id = ?';
    params.push(req.session.userId);
  } else if (req.query.crew_id) {
    where += ' AND events.crew_id = ?';
    params.push(req.query.crew_id);
  }

  const rows = db
    .prepare(`${eventSelect()} WHERE ${where} ORDER BY events.date ASC, events.time_label ASC`)
    .all(...params);
  res.json(rows);
});

router.post('/', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { project_id, date, time_label, title } = req.body || {};
  if (!project_id || !date || !title) {
    return res.status(400).json({ error: 'project_id, date, and title required' });
  }

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(project_id);
  if (!project) return res.status(400).json({ error: 'Invalid project' });

  const info = db
    .prepare(
      `INSERT INTO events (project_id, crew_id, date, time_label, title) VALUES (?, ?, ?, ?, ?)`
    )
    .run(project_id, project.crew_id, date, time_label || '', title);

  await notify(project.crew_id, 'schedule', `Scheduled: ${title} — ${project.name} on ${date}`, project.id);

  const event = db.prepare(`${eventSelect()} WHERE events.id = ?`).get(info.lastInsertRowid);
  res.status(201).json(event);
}));

router.patch('/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (existing.auto_type) {
    return res.status(400).json({ error: 'Job start/end dates are edited from the project page, not here' });
  }

  const { project_id, date, time_label, title } = req.body || {};
  const nextProjectId = project_id !== undefined ? project_id : existing.project_id;

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(nextProjectId);
  if (!project) return res.status(400).json({ error: 'Invalid project' });

  db.prepare(
    `UPDATE events SET project_id = ?, crew_id = ?, date = ?, time_label = ?, title = ? WHERE id = ?`
  ).run(
    nextProjectId,
    project.crew_id,
    date !== undefined ? date : existing.date,
    time_label !== undefined ? time_label : existing.time_label,
    title !== undefined ? title : existing.title,
    existing.id
  );

  const updated = db.prepare(`${eventSelect()} WHERE events.id = ?`).get(existing.id);
  res.json(updated);
}));

router.delete('/:id', requireAuth, requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (existing.auto_type) {
    return res.status(400).json({ error: 'Job start/end dates are cleared from the project page, not here' });
  }
  db.prepare('DELETE FROM events WHERE id = ?').run(existing.id);
  res.json({ ok: true });
});

module.exports = router;
