const multer = require('multer');

// Deliberately not "any file type" — an unrestricted upload that gets served
// back to a browser is a stored-XSS risk (e.g. an uploaded HTML or SVG file
// executing script in the app's own origin). This list covers what a
// painting contractor actually attaches (renderings, spec sheets, plans)
// while keeping served content safe.
const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

// Safe to render inline in a browser tab; anything else forces a download
// instead, so it can't execute or render unexpectedly in the app's origin.
const INLINE_SAFE_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/gif',
]);

const uploadDoc = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 20 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      return cb(new Error('That file type is not supported. Use PDF, an image, or a Word/Excel file.'));
    }
    cb(null, true);
  },
});

module.exports = uploadDoc;
module.exports.INLINE_SAFE_MIMES = INLINE_SAFE_MIMES;
