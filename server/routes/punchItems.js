const express = require('express');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const db = require('../db');
const config = require('../config');
const upload = require('../middleware/upload');
const { requireAuth, requireAdmin, requireProjectAccess } = require('../middleware/auth');
const { saveImage } = require('../services/imageStorage');
const { notify } = require('../services/notify');
const { getAdminUserIds } = require('../services/recipients');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router({ mergeParams: true });

function itemSelect() {
  return `SELECT punch_items.*, users.display_name AS author_name, users.short_name AS author_short_name,
                  users.chip_color AS author_chip_color
           FROM punch_items JOIN users ON users.id = punch_items.author_id`;
}

function safeFileName(name) {
  return name.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'project';
}

router.get('/', requireAuth, requireProjectAccess(db), (req, res) => {
  const rows = db.prepare(`${itemSelect()} WHERE project_id = ? ORDER BY punch_items.created_at ASC`).all(req.project.id);
  res.json(rows);
});

function loadItemFile(req, res, column) {
  const item = db.prepare('SELECT * FROM punch_items WHERE id = ? AND project_id = ?').get(req.params.itemId, req.project.id);
  if (!item || !item[column]) {
    res.status(404).end();
    return null;
  }
  return item;
}

router.get('/:itemId/photo', requireAuth, requireProjectAccess(db), (req, res) => {
  const item = loadItemFile(req, res, 'file_path');
  if (!item) return;
  if (item.mime) res.setHeader('Content-Type', item.mime);
  res.sendFile(path.join(config.uploadsPath, item.file_path));
});

router.get('/:itemId/photo/thumb', requireAuth, requireProjectAccess(db), (req, res) => {
  const item = loadItemFile(req, res, 'thumb_path');
  if (!item) return;
  res.sendFile(path.join(config.uploadsPath, item.thumb_path));
});

// Anyone on the project can add or edit an item (matches Orders/Notes),
// same as the free-text punch list field this list sits alongside — only
// deleting is admin-only.
router.post('/', requireAuth, requireProjectAccess(db), upload.single('photo'), asyncHandler(async (req, res) => {
  const description = (req.body.description || '').trim();
  if (!description && !req.file) {
    return res.status(400).json({ error: 'description or photo required' });
  }
  if (req.file && req.file.mimetype && req.file.mimetype.startsWith('video/')) {
    return res.status(400).json({ error: 'Only images are allowed for punch list photos' });
  }

  let file_path = null;
  let thumb_path = null;
  let mime = null;
  if (req.file) {
    const saved = await saveImage(req.file.buffer);
    file_path = saved.file_path;
    thumb_path = saved.thumb_path;
    mime = saved.mime;
  }

  const project = req.project;
  const info = db
    .prepare(`INSERT INTO punch_items (project_id, author_id, description, file_path, thumb_path, mime) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(project.id, req.session.userId, description, file_path, thumb_path, mime);

  const actor = db.prepare('SELECT short_name FROM users WHERE id = ?').get(req.session.userId);
  const text = `${actor.short_name} added a punch list item on ${project.name}`;
  if (req.session.role === 'admin') {
    await notify(project.crew_id, 'note', text, project.id);
  } else {
    for (const adminId of getAdminUserIds()) {
      await notify(adminId, 'note', text, project.id);
    }
  }

  const item = db.prepare(`${itemSelect()} WHERE punch_items.id = ?`).get(info.lastInsertRowid);
  res.status(201).json(item);
}));

router.patch('/:itemId', requireAuth, requireProjectAccess(db), upload.single('photo'), asyncHandler(async (req, res) => {
  const item = db.prepare('SELECT * FROM punch_items WHERE id = ? AND project_id = ?').get(req.params.itemId, req.project.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  if (req.file && req.file.mimetype && req.file.mimetype.startsWith('video/')) {
    return res.status(400).json({ error: 'Only images are allowed for punch list photos' });
  }

  const nextDescription = req.body.description !== undefined ? req.body.description.trim() : item.description;

  let file_path = item.file_path;
  let thumb_path = item.thumb_path;
  let mime = item.mime;
  if (req.file) {
    const saved = await saveImage(req.file.buffer);
    const oldFiles = [item.file_path, item.thumb_path];
    file_path = saved.file_path;
    thumb_path = saved.thumb_path;
    mime = saved.mime;
    for (const p of oldFiles) {
      if (p) fs.unlink(path.join(config.uploadsPath, p), () => {});
    }
  }

  db.prepare('UPDATE punch_items SET description = ?, file_path = ?, thumb_path = ?, mime = ? WHERE id = ?')
    .run(nextDescription, file_path, thumb_path, mime, item.id);

  const updated = db.prepare(`${itemSelect()} WHERE punch_items.id = ?`).get(item.id);
  res.json(updated);
}));

router.delete('/:itemId', requireAuth, requireAdmin, requireProjectAccess(db), (req, res) => {
  const item = db.prepare('SELECT * FROM punch_items WHERE id = ? AND project_id = ?').get(req.params.itemId, req.project.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM punch_items WHERE id = ?').run(item.id);
  for (const p of [item.file_path, item.thumb_path]) {
    if (p) fs.unlink(path.join(config.uploadsPath, p), () => {});
  }
  res.json({ ok: true });
});

// Any project member can download — same access as viewing the list itself.
// The list stays fully editable after this; nothing here is one-time-use.
router.get('/pdf', requireAuth, requireProjectAccess(db), (req, res) => {
  const project = req.project;
  const items = db.prepare(`${itemSelect()} WHERE project_id = ? ORDER BY punch_items.created_at ASC`).all(project.id);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFileName(project.name)}-punch-list.pdf"`);

  const doc = new PDFDocument({ margin: 40 });
  doc.on('error', (err) => {
    console.error('[punch-pdf] error:', err.message);
    res.destroy(err);
  });
  doc.pipe(res);

  doc.fontSize(18).fillColor('#000').text(`${project.name} — Punch List`);
  doc.fontSize(10).fillColor('#666').text(`Generated ${new Date().toLocaleDateString()}`);
  doc.moveDown(1);
  doc.fillColor('#000');

  if (!items.length) {
    doc.fontSize(12).text('No punch list items yet.');
  }

  const imageSize = 120;
  const rowGap = 16;
  const pageBottom = doc.page.height - doc.page.margins.bottom;

  items.forEach((item) => {
    const textX = doc.page.margins.left + imageSize + 16;
    const textWidth = doc.page.width - doc.page.margins.right - textX;
    const description = item.description || '(no description)';

    // pdfkit doesn't auto-paginate images, so the row height has to be
    // worked out up front to decide whether it needs a fresh page.
    const descHeight = doc.heightOfString(description, { width: textWidth });
    const rowHeight = Math.max(imageSize, descHeight + 20);

    if (doc.y + rowHeight > pageBottom) {
      doc.addPage();
    }

    const rowTop = doc.y;

    if (item.file_path) {
      try {
        doc.image(path.join(config.uploadsPath, item.file_path), doc.page.margins.left, rowTop, {
          fit: [imageSize, imageSize],
        });
      } catch (err) {
        doc.fontSize(9).fillColor('#999').text('(image unavailable)', doc.page.margins.left, rowTop, { width: imageSize });
        doc.fillColor('#000');
      }
    }

    doc.fontSize(11).text(description, textX, rowTop, { width: textWidth });
    const when = new Date(item.created_at.replace(' ', 'T') + 'Z').toLocaleDateString();
    doc.fontSize(9).fillColor('#666').text(`${item.author_short_name} · ${when}`, textX, rowTop + descHeight + 6, { width: textWidth });
    doc.fillColor('#000');

    doc.y = rowTop + rowHeight + rowGap;
  });

  doc.end();
});

module.exports = router;
