const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const heicConvert = require('heic-convert');
const config = require('../config');

// Saves an image buffer as a full-size JPEG plus a thumbnail. Falls back to
// heic-convert (a bundled WASM decoder, no system library dependency) when
// sharp can't decode the source — iPhone HEIC/HEIF photos fail here in some
// deployed environments where libvips has no working heif codec plugin
// (seen in production as "No decoding plugin installed for this
// compression format"), even though the same code works fine locally.
async function saveImage(buffer, { maxWidth = 1600, thumbWidth = 400, quality = 82, thumbQuality = 75 } = {}) {
  const id = crypto.randomBytes(16).toString('hex');
  const fileName = `${id}.jpg`;
  const thumbName = `${id}_thumb.jpg`;

  let source = buffer;
  try {
    await sharp(source).rotate().resize({ width: maxWidth, withoutEnlargement: true }).jpeg({ quality })
      .toFile(path.join(config.uploadsPath, fileName));
  } catch (err) {
    source = await heicConvert({ buffer, format: 'JPEG', quality: 0.92 });
    await sharp(source).rotate().resize({ width: maxWidth, withoutEnlargement: true }).jpeg({ quality })
      .toFile(path.join(config.uploadsPath, fileName));
  }

  await sharp(source).rotate().resize({ width: thumbWidth, withoutEnlargement: true }).jpeg({ quality: thumbQuality })
    .toFile(path.join(config.uploadsPath, thumbName));

  return { file_path: fileName, thumb_path: thumbName, mime: 'image/jpeg' };
}

module.exports = { saveImage };
