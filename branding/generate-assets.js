// Regenerates client/public logo/icon assets from branding/logo-source.png.
// Run with: node branding/generate-assets.js
//
// Expects the source to be a navy-on-transparent lockup (icon + wordmark),
// with the icon living in the left portion of the image. If a new logo
// file replaces logo-source.png with a different layout, the crop box
// below may need adjusting.
const sharp = require('sharp');
const path = require('path');

const SRC = path.join(__dirname, 'logo-source.png');
const outDir = path.join(__dirname, '..', 'client', 'public');
const iconsDir = path.join(outDir, 'icons');

async function main() {
  // Full lockup (icon + wordmark), navy on transparent — for light backgrounds.
  await sharp(SRC).toFile(path.join(outDir, 'logo-navy.png'));

  // Just the circular mark, cropped, navy on transparent — for compact spots
  // (header badge, login badge, app icons). Adjust if the source changes.
  const crop = { left: 36, top: 26, width: 151, height: 150 };
  await sharp(SRC).extract(crop).toFile(path.join(outDir, 'mark-navy.png'));

  // App icons: mark on a white square (so it reads on any home-screen wallpaper).
  const markBuffer = await sharp(SRC).extract(crop).toBuffer();
  for (const size of [192, 512]) {
    await sharp({
      create: { width: size, height: size, channels: 4, background: '#ffffff' },
    })
      .composite([{ input: await sharp(markBuffer).resize(Math.round(size * 0.82)).toBuffer(), gravity: 'center' }])
      .png()
      .toFile(path.join(iconsDir, `icon-${size}.png`));
  }

  await sharp({
    create: { width: 180, height: 180, channels: 4, background: '#ffffff' },
  })
    .composite([{ input: await sharp(markBuffer).resize(148).toBuffer(), gravity: 'center' }])
    .png()
    .toFile(path.join(iconsDir, 'apple-touch-icon.png'));

  console.log('Branding assets regenerated in client/public/.');
}

main().catch((err) => { console.error(err); process.exit(1); });
