#!/usr/bin/env node
/* make-icons.js — genereert PLACEHOLDER PNG-iconen (gele dossard).
 * Claude Design vervangt deze later. Reproduceerbaar: node scripts/make-icons.js
 * Geen dependencies: eigen mini-PNG-encoder via zlib.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function png(size, draw) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter byte
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = draw(x, y, size);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const YELLOW = [255, 212, 0, 255];
const INK    = [31, 34, 39, 255];
const WHITE  = [255, 255, 255, 255];
const ROUGE  = [218, 41, 28, 255];
const VERT   = [0, 150, 63, 255];

// Rastert hetzelfde motief als icons/favicon.svg (64x64-coördinaten):
// geel vlak · 4 rode stippen · witte plaat met asfalt-rand · zwart kruis · groene balk.
// De gele rand bloeit tot de rand (veilig voor maskable).
function drawIcon() {
  const inRect = (u, v, x, y, w, h) => u >= x && u <= x + w && v >= y && v <= y + h;
  const inDisc = (u, v, cx, cy, r) => (u - cx) ** 2 + (v - cy) ** 2 <= r * r;
  return (x, y, size) => {
    const u = (x + 0.5) * 64 / size;
    const v = (y + 0.5) * 64 / size;
    let col = YELLOW;
    // rode stippen
    if (inDisc(u, v, 32, 10.9, 2.7) || inDisc(u, v, 32, 53.1, 2.7) ||
        inDisc(u, v, 10.9, 32, 2.7) || inDisc(u, v, 53.1, 32, 2.7)) col = ROUGE;
    // witte plaat met asfalt-rand
    if (inRect(u, v, 16, 16, 32, 32)) {
      col = (u < 17.4 || u > 46.6 || v < 17.4 || v > 46.6) ? INK : WHITE;
    }
    // zwart kruis
    if (inRect(u, v, 22.4, 20.5, 19.2, 5.1) || inRect(u, v, 29.1, 20.5, 5.8, 19.2)) col = INK;
    // groene balk
    if (inRect(u, v, 23.7, 42.6, 16.6, 3.2)) col = VERT;
    return col;
  };
}

const dir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(dir, { recursive: true });

// PNG-set: manifest (192/512, maskable any), favicon-32, apple-touch-icon (180).
const draw = drawIcon();
fs.writeFileSync(path.join(dir, 'icon-192.png'), png(192, draw));
fs.writeFileSync(path.join(dir, 'icon-512.png'), png(512, draw));
fs.writeFileSync(path.join(dir, 'favicon-32.png'), png(32, draw));
fs.writeFileSync(path.join(dir, 'apple-touch-icon.png'), png(180, draw));

// Vector favicon — exact het motief uit de Claude Design-handoff.
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#FFD400"/>
  <g fill="#DA291C">
    <circle cx="32" cy="10.9" r="2.7"/><circle cx="32" cy="53.1" r="2.7"/>
    <circle cx="10.9" cy="32" r="2.7"/><circle cx="53.1" cy="32" r="2.7"/>
  </g>
  <rect x="16" y="16" width="32" height="32" rx="3.2" fill="#ffffff" stroke="#1f2227" stroke-width="1.4"/>
  <rect x="22.4" y="20.5" width="19.2" height="5.1" fill="#1f2227"/>
  <rect x="29.1" y="20.5" width="5.8" height="19.2" fill="#1f2227"/>
  <rect x="23.7" y="42.6" width="16.6" height="3.2" rx="1.6" fill="#00963F"/>
</svg>
`;
fs.writeFileSync(path.join(dir, 'favicon.svg'), faviconSvg);

console.log('OK — placeholder iconen geschreven naar icons/ (icon-192/512, favicon-32, apple-touch-icon, favicon.svg)');
