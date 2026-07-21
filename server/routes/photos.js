const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const db = require('../db');
const config = require('../config');
const upload = require('../middleware/upload');
const { requireAuth, requireAdmin, requireProjectAccess } = require('../middleware/auth');
const { notifyBatched } = require('../services/notify');
const { getAdminUserIds } = require('../services/recipients');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router({ mergeParams: true });

const KIND_TO_CATEGORY = { picture: 'photo', receipt: 'receipt' };
const KIND_LABEL = { picture: 'photo', receipt: 'receipt' };

const VIDEO_EXT_BY_MIME = {
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
};

async function saveImage(buffer) {
  const id = crypto.randomBytes(16).toString('hex');
  const fileName = `${id}.jpg`;
  const thumbName = `${id}_thumb.jpg`;

  await sharp(buffer)
    .rotate()
    .resize({ width: 1600, withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toFile(path.join(config.uploadsPath, fileName));

  await sharp(buffer)
    .rotate()
    .resize({ width: 400, withoutEnlargement: true })
    .jpeg({ quality: 75 })
    .toFile(path.join(config.uploadsPath, thumbName));

  return { media_type: 'image', file_path: fileName, thumb_path: thumbName, mime: 'image/jpeg' };
}

// Videos aren't processed by sharp — stored as-is, no thumbnail. The grid
// shows a generic video tile instead of an image thumb for these.
function saveVideo(buffer, mimetype) {
  const id = crypto.randomBytes(16).toString('hex');
  const ext = VIDEO_EXT_BY_MIME[mimetype] || '';
  const fileName = `${id}${ext}`;
  fs.writeFileSync(path.join(config.uploadsPath, fileName), buffer);
  return { media_type: 'video', file_path: fileName, thumb_path: null, mime: mimetype };
}

function photoSelect() {
  return `SELECT photos.*, users.display_name AS author_name, users.short_name AS author_short_name,
                  users.chip_color AS author_chip_color
           FROM photos JOIN users ON users.id = photos.author_id`;
}

router.get('/', requireAuth, requireProjectAccess(db), (req, res) => {
  const kind = req.query.kind;
  let rows;
  if (kind) {
    rows = db
      .prepare(`${photoSelect()} WHERE project_id = ? AND kind = ? ORDER BY photos.created_at DESC`)
      .all(req.project.id, kind);
  } else {
    rows = db
      .prepare(`${photoSelect()} WHERE project_id = ? ORDER BY photos.created_at DESC`)
      .all(req.project.id);
  }
  res.json(rows);
});

router.post('/', requireAuth, requireProjectAccess(db), upload.array('files', 20), asyncHandler(async (req, res) => {
  const kind = req.body.kind || 'picture';
  if (!['picture', 'receipt'].includes(kind)) {
    return res.status(400).json({ error: 'Invalid kind' });
  }
  if (!req.files || !req.files.length) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const caption = (req.body.caption || '').trim() || null;
  const project = req.project;
  const saved = [];
  const insert = db.prepare(
    `INSERT INTO photos (project_id, author_id, kind, media_type, file_path, thumb_path, mime, caption)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const file of req.files) {
    const isVideo = file.mimetype && file.mimetype.startsWith('video/');
    const { media_type, file_path, thumb_path, mime } = isVideo
      ? saveVideo(file.buffer, file.mimetype)
      : await saveImage(file.buffer);
    const info = insert.run(project.id, req.session.userId, kind, media_type, file_path, thumb_path, mime, caption);
    saved.push(db.prepare(`${photoSelect()} WHERE photos.id = ?`).get(info.lastInsertRowid));
  }

  const category = KIND_TO_CATEGORY[kind];
  const itemLabel = KIND_LABEL[kind];
  const actor = db.prepare('SELECT short_name FROM users WHERE id = ?').get(req.session.userId);

  if (req.session.role === 'admin') {
    notifyBatched(project.crew_id, category, project.id, actor.short_name, itemLabel);
  } else {
    for (const adminId of getAdminUserIds()) {
      notifyBatched(adminId, category, project.id, actor.short_name, itemLabel);
    }
  }

  res.status(201).json(saved);
}));

router.patch('/:photoId', requireAuth, requireAdmin, requireProjectAccess(db), (req, res) => {
  const photo = db.prepare('SELECT * FROM photos WHERE id = ? AND project_id = ?').get(req.params.photoId, req.project.id);
  if (!photo) return res.status(404).json({ error: 'Not found' });

  const { caption } = req.body || {};
  db.prepare('UPDATE photos SET caption = ? WHERE id = ?').run(caption !== undefined ? (caption || null) : photo.caption, photo.id);

  const updated = db.prepare(`${photoSelect()} WHERE photos.id = ?`).get(photo.id);
  res.json(updated);
});

router.delete('/:photoId', requireAuth, requireAdmin, requireProjectAccess(db), (req, res) => {
  const photo = db.prepare('SELECT * FROM photos WHERE id = ? AND project_id = ?').get(req.params.photoId, req.project.id);
  if (!photo) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM photos WHERE id = ?').run(photo.id);
  for (const p of [photo.file_path, photo.thumb_path]) {
    if (p) fs.unlink(path.join(config.uploadsPath, p), () => {});
  }
  res.json({ ok: true });
});

module.exports = router;
