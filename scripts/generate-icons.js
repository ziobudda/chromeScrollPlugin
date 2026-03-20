const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function uint32BE(n) {
  return Buffer.from([(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]);
}

function crc32(buf) {
  const table = [];
  for (let i = 0; i < 256; i++) {
    let v = i;
    for (let j = 0; j < 8; j++) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1;
    table[i] = v;
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type);
  const crcBuf = Buffer.concat([typeBytes, data]);
  return Buffer.concat([uint32BE(data.length), typeBytes, data, uint32BE(crc32(crcBuf))]);
}

function createPNG(size, r, g, b) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = chunk('IHDR', Buffer.concat([
    uint32BE(size), uint32BE(size),
    Buffer.from([8, 2, 0, 0, 0])
  ]));
  const rowBytes = 1 + size * 3;
  const raw = Buffer.alloc(size * rowBytes);
  for (let y = 0; y < size; y++) {
    raw[y * rowBytes] = 0;
    for (let x = 0; x < size; x++) {
      const i = y * rowBytes + 1 + x * 3;
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b;
    }
  }
  const idat = chunk('IDAT', zlib.deflateSync(raw));
  const iend = chunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);
}

const iconsDir = path.join(__dirname, '..', 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

[16, 48, 128].forEach(size => {
  // #a78bfa = RGB(167, 139, 250) — matches the accent color used in popup and overlay
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), createPNG(size, 167, 139, 250));
  console.log('Created icon' + size + '.png');
});
