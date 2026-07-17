const express = require('express');
const path = require('path');
const db = require('../db');
const config = require('../config');
const { requireAuth } = require('../middleware/auth');
const { INLINE_SAFE_MIMES } = require('../middleware/uploadDoc');

const router = express.Router();

function loadDocWithAccess(req, res) {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.docId);
  if (!doc) {
    res.status(404).end();
    return null;
  }
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(doc.project_id);
  if (!project) {
    res.status(404).end();
    return null;
  }
  if (req.session.role !== 'admin' && project.crew_id !== req.session.userId) {
    res.status(403).end();
    return null;
  }
  return doc;
}

router.get('/:docId/full', requireAuth, (req, res) => {
  const doc = loadDocWithAccess(req, res);
  if (!doc) return;

  const disposition = INLINE_SAFE_MIMES.has(doc.mime) ? 'inline' : 'attachment';
  const filename = (doc.original_name || 'document').replace(/"/g, '');
  if (doc.mime) res.setHeader('Content-Type', doc.mime);
  res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
  res.sendFile(path.join(config.uploadsPath, doc.file_path));
});

router.get('/:docId/thumb', requireAuth, (req, res) => {
  const doc = loadDocWithAccess(req, res);
  if (!doc) return;
  if (!doc.thumb_path) return res.status(404).end();
  res.sendFile(path.join(config.uploadsPath, doc.thumb_path));
});

module.exports = router;
