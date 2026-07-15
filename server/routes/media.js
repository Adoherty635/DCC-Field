const express = require('express');
const path = require('path');
const db = require('../db');
const config = require('../config');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function loadPhotoWithAccess(req, res) {
  const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(req.params.photoId);
  if (!photo) {
    res.status(404).end();
    return null;
  }
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(photo.project_id);
  if (!project) {
    res.status(404).end();
    return null;
  }
  if (req.session.role !== 'admin' && project.crew_id !== req.session.userId) {
    res.status(403).end();
    return null;
  }
  return photo;
}

router.get('/:photoId/full', requireAuth, (req, res) => {
  const photo = loadPhotoWithAccess(req, res);
  if (!photo) return;
  res.sendFile(path.join(config.uploadsPath, photo.file_path));
});

router.get('/:photoId/thumb', requireAuth, (req, res) => {
  const photo = loadPhotoWithAccess(req, res);
  if (!photo) return;
  res.sendFile(path.join(config.uploadsPath, photo.thumb_path));
});

module.exports = router;
