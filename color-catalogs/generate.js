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

// Adobe Swatch Exchange (.ase): a flat sequence of blocks — group start
// (0xC001), group end (0xC002), and color entries (0x0001). Benjamin
// Moore's export wraps every single color in its own (unnamed) group
// rather than grouping by family, so we only need the color blocks.
function parseAse(buf) {
  const blockCount = buf.readUInt32BE(8);
  let offset = 12;
  const swatches = [];

  for (let i = 0; i < blockCount; i++) {
    const blockType = buf.readUInt16BE(offset);
    const blockLen = buf.readUInt32BE(offset + 2);
    const blockStart = offset + 6;

    if (blockType === 0x0001) {
      let p = blockStart;
      const nameLen = buf.readUInt16BE(p); // includes null terminator
      p += 2;
      let name = '';
      for (let j = 0; j < (nameLen - 1) * 2; j += 2) {
        name += String.fromCharCode(buf.readUInt16BE(p + j));
      }
      p += nameLen * 2;

      const colorModel = buf.subarray(p, p + 4).toString('ascii');
      p += 4;

      if (colorModel === 'RGB ') {
        const r = buf.readFloatBE(p);
        const g = buf.readFloatBE(p + 4);
        const b = buf.readFloatBE(p + 8);
        const hex = '#' + [r, g, b]
          .map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0'))
          .join('');
        swatches.push({ name, hex });
      }
    }

    offset += 6 + blockLen;
  }
  return swatches;
}

function buildBenjaminMoore() {
  const buf = fs.readFileSync(path.join(__dirname, 'source', 'benjamin-moore.ase'));
  const raw = parseAse(buf);

  // Names are "<code> <name>", e.g. "2000-70 Voile Pink".
  const codeNamePattern = /^(\d[\d-]*\d)\s+(.+)$/;
  const out = [];
  for (const { name, hex } of raw) {
    const m = name.match(codeNamePattern);
    if (!m) {
      console.warn('  skipping unrecognized entry (no "#### Name" pattern):', name);
      continue;
    }
    out.push({ code: m[1], name: m[2], hex });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));

  fs.writeFileSync(path.join(outDir, 'benjamin-moore.json'), JSON.stringify(out));
  console.log(`Benjamin Moore: wrote ${out.length} colors.`);
}

buildSherwinWilliams();
buildBenjaminMoore();
