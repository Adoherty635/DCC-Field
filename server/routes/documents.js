const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const db = require('../db');
const config = require('../config');
const { requireAuth, requireAdmin, requireProjectAccess } = require('../middleware/auth');
const uploadDoc = require('../middleware/uploadDoc');
const { notify } = require('../services/notify');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router({ mergeParams: true });

const EXT_BY_MIME = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/gif': '.gif',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};

const CATEGORY_TO_NOTIFY = { scope: 'scope', rendering: 'color' };

function documentSelect() {
  return `SELECT documents.*, users.display_name AS author_name, users.short_name AS author_short_name,
                  users.chip_color AS author_chip_color
           FROM documents JOIN users ON users.id = documents.author_id`;
}

async function saveUpload(file) {
  const isImage = file.mimetype.startsWith('image/');
  const ext = EXT_BY_MIME[file.mimetype] || '';
  const id = crypto.randomBytes(16).toString('hex');

  if (!isImage) {
    const fileName = `${id}${ext}`;
    fs.writeFileSync(path.join(config.uploadsPath, fileName), file.buffer);
    return { file_path: fileName, thumb_path: null };
  }

  const fileName = `${id}.jpg`;
  const thumbName = `${id}_thumb.jpg`;
  await sharp(file.buffer).rotate().resize({ width: 2000, withoutEnlargement: true }).jpeg({ quality: 88 })
    .toFile(path.join(config.uploadsPath, fileName));
  await sharp(file.buffer).rotate().resize({ width: 400, withoutEnlargement: true }).jpeg({ quality: 75 })
    .toFile(path.join(config.uploadsPath, thumbName));
  return { file_path: fileName, thumb_path: thumbName };
}

router.get('/', requireAuth, requireProjectAccess(db), (req, res) => {
  const { category } = req.query;
  const rows = category
    ? db.prepare(`${documentSelect()} WHERE project_id = ? AND category = ? ORDER BY documents.created_at DESC`).all(req.project.id, category)
    : db.prepare(`${documentSelect()} WHERE project_id = ? ORDER BY documents.created_at DESC`).all(req.project.id);
  res.json(rows);
});

router.post(
  '/',
  requireAuth,
  requireAdmin,
  requireProjectAccess(db),
  uploadDoc.array('files', 20),
  asyncHandler(async (req, res) => {
    const { category } = req.body;
    if (!['scope', 'rendering'].includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }
    if (!req.files || !req.files.length) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const project = req.project;
    const insert = db.prepare(
      `INSERT INTO documents (project_id, author_id, category, file_path, thumb_path, original_name, mime)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    const saved = [];
    for (const file of req.files) {
      const { file_path, thumb_path } = await saveUpload(file);
      const info = insert.run(project.id, req.session.userId, category, file_path, thumb_path, file.originalname, file.mimetype);
      saved.push(db.prepare(`${documentSelect()} WHERE documents.id = ?`).get(info.lastInsertRowid));
    }

    const label = category === 'scope' ? 'Scope document' : 'Rendering';
    const plural = req.files.length > 1 ? 's' : '';
    await notify(project.crew_id, CATEGORY_TO_NOTIFY[category], `${label}${plural} added to ${project.name}`, project.id);

    res.status(201).json(saved);
  })
);

router.delete('/:docId', requireAuth, requireAdmin, requireProjectAccess(db), (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND project_id = ?').get(req.params.docId, req.project.id);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM documents WHERE id = ?').run(doc.id);
  for (const p of [doc.file_path, doc.thumb_path]) {
    if (p) fs.unlink(path.join(config.uploadsPath, p), () => {});
  }
  res.json({ ok: true });
});

module.exports = router;
