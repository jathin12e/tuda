// Regenerates the PNG app icons in public/icons (run with `npm run icons`).
// Pure Node, no dependencies: draws a simple gold fountain glyph on navy.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(body));
  return Buffer.concat([head, body, tail]);
}

function encodePng(size, pixels) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Glyph geometry in unit coordinates: [polyline points, half thickness].
const BASE_Y = 0.72;
const strokes = [];

function arc(endX, height) {
  const points = [];
  const cx = (0.5 + endX) / 2;
  const half = Math.abs(endX - 0.5) / 2;
  for (let i = 0; i <= 28; i++) {
    const x = 0.5 + ((endX - 0.5) * i) / 28;
    const t = (x - cx) / half;
    points.push([x, BASE_Y - height * (1 - t * t)]);
  }
  strokes.push([points, 0.0175]);
}

strokes.push([[[0.5, BASE_Y], [0.5, 0.24]], 0.0175]);
arc(0.32, 0.42);
arc(0.68, 0.42);
arc(0.2, 0.34);
arc(0.8, 0.34);
strokes.push([[[0.16, 0.772], [0.84, 0.772]], 0.0155]);

function distanceToSegment(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function insideGlyph(u, v) {
  for (const [points, half] of strokes) {
    for (let i = 0; i < points.length - 1; i++) {
      if (distanceToSegment(u, v, points[i], points[i + 1]) <= half) return true;
    }
  }
  return false;
}

const mix = (a, b, t) => Math.round(a + (b - a) * t);
const NAVY_IN = [0x12, 0x35, 0x6b];
const NAVY_OUT = [0x04, 0x0f, 0x22];
const GOLD = [0xe3, 0xc0, 0x6d];
const SAMPLES = 3;

function render(size) {
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          if (insideGlyph((x + (sx + 0.5) / SAMPLES) / size, (y + (sy + 0.5) / SAMPLES) / size)) hits++;
        }
      }
      const coverage = hits / (SAMPLES * SAMPLES);
      const radial = Math.min(1, Math.hypot((x + 0.5) / size - 0.5, (y + 0.5) / size - 0.38) / 0.75);
      const offset = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) {
        pixels[offset + c] = mix(mix(NAVY_IN[c], NAVY_OUT[c], radial), GOLD[c], coverage);
      }
      pixels[offset + 3] = 255;
    }
  }
  return encodePng(size, pixels);
}

fs.mkdirSync(outDir, { recursive: true });
for (const [name, size] of [
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
]) {
  fs.writeFileSync(path.join(outDir, name), render(size));
  console.log(`wrote ${name} (${size}x${size})`);
}
