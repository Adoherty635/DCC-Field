const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin, requireProjectAccess } = require('../middleware/auth');
const { notify } = require('../services/notify');
const { getAdminUserIds } = require('../services/recipients');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router({ mergeParams: true });

async function notifyOrderChange(req, verb) {
  const project = req.project;
  if (req.session.role === 'admin') {
    await notify(project.crew_id, 'order', `Order ${verb} on ${project.name}`, project.id);
  } else {
    for (const adminId of getAdminUserIds()) {
      await notify(adminId, 'order', `Order ${verb} on ${project.name}`, project.id);
    }
  }
}

router.get('/', requireAuth, requireProjectAccess(db), (req, res) => {
  const rows = db
    .prepare(
      `SELECT orders.*, users.display_name AS author_name, users.short_name AS author_short_name,
              users.chip_color AS author_chip_color
       FROM orders JOIN users ON users.id = orders.author_id
       WHERE project_id = ? ORDER BY order_date DESC, orders.created_at DESC`
    )
    .all(req.project.id);
  res.json(rows);
});

router.post('/', requireAuth, requireProjectAccess(db), asyncHandler(async (req, res) => {
  const { order_date, body } = req.body || {};
  if (!order_date || !body) return res.status(400).json({ error: 'order_date and body required' });

  const info = db
    .prepare(
      `INSERT INTO orders (project_id, author_id, order_date, body) VALUES (?, ?, ?, ?)`
    )
    .run(req.project.id, req.session.userId, order_date, body);

  await notifyOrderChange(req, 'added');

  const order = db
    .prepare(
      `SELECT orders.*, users.display_name AS author_name, users.short_name AS author_short_name,
              users.chip_color AS author_chip_color
       FROM orders JOIN users ON users.id = orders.author_id WHERE orders.id = ?`
    )
    .get(info.lastInsertRowid);

  res.status(201).json(order);
}));

router.patch('/:orderId', requireAuth, requireProjectAccess(db), asyncHandler(async (req, res) => {
  const { order_date, body } = req.body || {};
  const existing = db
    .prepare('SELECT * FROM orders WHERE id = ? AND project_id = ?')
    .get(req.params.orderId, req.project.id);
  if (!existing) return res.status(404).json({ error: 'Order not found' });

  db.prepare(
    `UPDATE orders SET order_date = ?, body = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(order_date ?? existing.order_date, body ?? existing.body, existing.id);

  await notifyOrderChange(req, 'updated');

  const order = db
    .prepare(
      `SELECT orders.*, users.display_name AS author_name, users.short_name AS author_short_name,
              users.chip_color AS author_chip_color
       FROM orders JOIN users ON users.id = orders.author_id WHERE orders.id = ?`
    )
    .get(existing.id);
  res.json(order);
}));

router.delete('/:orderId', requireAuth, requireAdmin, requireProjectAccess(db), (req, res) => {
  db.prepare('DELETE FROM orders WHERE id = ? AND project_id = ?').run(req.params.orderId, req.project.id);
  res.json({ ok: true });
});

module.exports = router;
