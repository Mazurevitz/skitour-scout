/**
 * Generate RGBA PNG icons for Tauri
 * Run with: node scripts/create-icons.mjs
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.join(__dirname, '..', 'src-tauri', 'icons');

// Ensure icons directory exists
fs.mkdirSync(iconsDir, { recursive: true });

// CRC32 implementation
let crc32Table = null;
function getCrc32Table() {
  if (crc32Table) return crc32Table;
  crc32Table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crc32Table[i] = c;
  }
  return crc32Table;
}

function crc32(data) {
  let crc = 0xffffffff;
  const table = getCrc32Table();
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xff];
  }
  return crc ^ 0xffffffff;
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
  const crcVal = crc32(crcData);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crcVal >>> 0, 0);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function createRGBAPng(size) {
  // PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR data - RGBA (colorType = 6)
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);  // width
  ihdrData.writeUInt32BE(size, 4);  // height
  ihdrData.writeUInt8(8, 8);         // bit depth
  ihdrData.writeUInt8(6, 9);         // color type (RGBA)
  ihdrData.writeUInt8(0, 10);        // compression
  ihdrData.writeUInt8(0, 11);        // filter
  ihdrData.writeUInt8(0, 12);        // interlace

  // Create raw image data (RGBA - 4 bytes per pixel)
  const rawData = [];
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.45;

  for (let y = 0; y < size; y++) {
    rawData.push(0); // filter byte for each row
    for (let x = 0; x < size; x++) {
      // Calculate distance from center for circular shape
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Default: transparent
      let r = 0, g = 0, b = 0, a = 0;

      // Inside the circle
      if (dist <= radius) {
        // Blue background (#2563eb)
        r = 37; g = 99; b = 235; a = 255;

        // Draw white mountain triangle
        const topY = size * 0.25;
        const bottomY = size * 0.7;

        if (y >= topY && y <= bottomY) {
          const progress = (y - topY) / (bottomY - topY);
          const halfBase = (size * 0.3) * progress;
          const leftEdge = cx - halfBase;
          const rightEdge = cx + halfBase;

          if (x >= leftEdge && x <= rightEdge) {
            // Snow cap (top 30%)
            if (y < topY + (bottomY - topY) * 0.35) {
              r = 255; g = 255; b = 255;
            } else {
              // Mountain body (light gray)
              r = 226; g = 232; b = 240;
            }
          }
        }

        // Anti-aliasing at edge
        if (dist > radius - 2) {
          const edgeFade = (radius - dist) / 2;
          a = Math.round(255 * Math.max(0, Math.min(1, edgeFade)));
        }
      }

      rawData.push(r, g, b, a);
    }
  }

  // Compress
  const compressed = zlib.deflateSync(Buffer.from(rawData));

  // Build PNG
  const chunks = [
    createChunk('IHDR', ihdrData),
    createChunk('IDAT', compressed),
    createChunk('IEND', Buffer.alloc(0)),
  ];

  return Buffer.concat([signature, ...chunks]);
}

// Generate icons
const sizes = [
  { name: 'icon.png', size: 512 },
  { name: '32x32.png', size: 32 },
  { name: '128x128.png', size: 128 },
  { name: '128x128@2x.png', size: 256 },
];

for (const { name, size } of sizes) {
  const png = createRGBAPng(size);
  fs.writeFileSync(path.join(iconsDir, name), png);
  console.log(`Created ${name} (${size}x${size}) - RGBA`);
}

// Create placeholder .icns and .ico (empty files as placeholders)
fs.writeFileSync(path.join(iconsDir, 'icon.icns'), Buffer.alloc(0));
fs.writeFileSync(path.join(iconsDir, 'icon.ico'), Buffer.alloc(0));

console.log('\nRGBA icons created in src-tauri/icons/');
