// Writes QR code PNGs and SVGs for the live URL and the tap-point links.  node tools/qr.mjs
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
const qrcode = createRequire(import.meta.url)('./vendor/qrcode.js');

const BASE = 'https://visilean-bhargav.github.io/ataraxia/';
const targets = { 'ataraxia-home': BASE, 'ataraxia-tap-coaster': BASE + '?tap=coaster', 'ataraxia-tap-poster': BASE + '?tap=poster' };

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };

for (const [name, url] of Object.entries(targets)) {
  const qr = qrcode(0, 'M'); qr.addData(url); qr.make();
  const n = qr.getModuleCount(), quiet = 4, scale = 24, size = (n + quiet * 2) * scale;
  const raw = Buffer.alloc((size + 1) * size, 255);           // 8-bit greyscale, one filter byte per row
  for (let y = 0; y < size; y++) {
    raw[y * (size + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const mx = Math.floor(x / scale) - quiet, my = Math.floor(y / scale) - quiet;
      if (mx >= 0 && my >= 0 && mx < n && my < n && qr.isDark(my, mx)) raw[y * (size + 1) + 1 + x] = 0x0e;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 0;
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
  writeFileSync(new URL(`../qr/${name}.png`, import.meta.url), png);
  let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) d += `M${x + quiet} ${y + quiet}h1v1h-1z`;
  writeFileSync(new URL(`../qr/${name}.svg`, import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + quiet * 2} ${n + quiet * 2}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#0e2328"/></svg>\n`);
  console.log(name, url, n + ' modules', size + 'px');
}
