// Regenerates client/public/color-catalogs/*.json from the source swatch
// files in color-catalogs/source/. Run with: node color-catalogs/generate.js
//
// Adobe Color Swatch (.aco) format: an optional version-1 block (no names)
// followed by a version-2 block (RGB + UTF-16BE name) — Photoshop writes
// both for backward compatibility. We only need the named version-2 block.
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'client', 'public', 'color-catalogs');
fs.mkdirSync(outDir, { recursive: true });

function parseAco(buf) {
  const v1Count = buf.readUInt16BE(2);
  const v1BlockSize = 4 + v1Count * 10;
  const v2sig = buf.readUInt16BE(v1BlockSize);
  if (v2sig !== 2) throw new Error('Expected a version-2 (named) block in this .aco file');
  const v2count = buf.readUInt16BE(v1BlockSize + 2);

  let offset = v1BlockSize + 4;
  const swatches = [];
  for (let i = 0; i < v2count; i++) {
    const colorSpace = buf.readUInt16BE(offset);
    const c1 = buf.readUInt16BE(offset + 2);
    const c2 = buf.readUInt16BE(offset + 4);
    const c3 = buf.readUInt16BE(offset + 6);
    offset += 10;

    const nameLen = buf.readUInt32BE(offset); // includes null terminator
    offset += 4;
    let name = '';
    for (let j = 0; j < (nameLen - 1) * 2; j += 2) {
      name += String.fromCharCode(buf.readUInt16BE(offset + j));
    }
    offset += nameLen * 2;

    if (colorSpace !== 0) continue; // 0 = RGB; skip CMYK/Lab/etc. entries if present
    const hex = '#' + [c1, c2, c3].map((v) => Math.round(v / 257).toString(16).padStart(2, '0')).join('');
    swatches.push({ name, hex });
  }
  return swatches;
}

function buildSherwinWilliams() {
  const buf = fs.readFileSync(path.join(__dirname, 'source', 'sherwin-williams.aco'));
  const raw = parseAco(buf);

  const codeNamePattern = /^(.+?)\s*\((SW\s*\d+)\)$/;
  const out = [];
  for (const { name, hex } of raw) {
    const m = name.match(codeNamePattern);
    if (!m) {
      console.warn('  skipping unrecognized entry (no "Name (SW ####)" pattern):', name);
      continue;
    }
    out.push({ code: m[2], name: m[1], hex });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));

  fs.writeFileSync(path.join(outDir, 'sherwin-williams.json'), JSON.stringify(out));
  console.log(`Sherwin-Williams: wrote ${out.length} colors.`);
}

buildSherwinWilliams();
