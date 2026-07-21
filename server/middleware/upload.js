const multer = require('multer');

const ALLOWED_VIDEO_MIMES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

const upload = multer({
  storage: multer.memoryStorage(),
  // Raised from the old image-only 20MB to accommodate video clips from a
  // phone camera; images still get compressed down after upload regardless.
  limits: { fileSize: 100 * 1024 * 1024, files: 20 },
  fileFilter: (req, file, cb) => {
    const isImage = file.mimetype && file.mimetype.startsWith('image/');
    const isVideo = ALLOWED_VIDEO_MIMES.has(file.mimetype);
    if (!isImage && !isVideo) {
      return cb(new Error('Only image or video uploads are allowed'));
    }
    cb(null, true);
  },
});

module.exports = upload;
