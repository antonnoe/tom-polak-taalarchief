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
const INK = [31, 34, 39, 255];
const WHITE = [255, 255, 255, 255];

function drawIcon(maskable) {
  return (x, y, size) => {
    const s = size;
    const pad = maskable ? s * 0.18 : s * 0.10;     // safe-zone bij maskable
    // gele achtergrond
    let col = YELLOW;
    // witte dossard in het midden
    const a = pad, b = s - pad;
    if (x > a && x < b && y > a && y < b) {
      const inner = s * 0.04;
      if (x > a + inner && x < b - inner && y > a + inner && y < b - inner) col = WHITE;
      else col = INK; // rand
    }
    return col;
  };
}

const dir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(dir, { recursive: true });
for (const sz of [192, 512]) {
  fs.writeFileSync(path.join(dir, `icon-${sz}.png`), png(sz, drawIcon(false)));
  fs.writeFileSync(path.join(dir, `icon-${sz}-maskable.png`), png(sz, drawIcon(true)));
}
console.log('OK — placeholder iconen geschreven naar icons/');
