// 生成 256x256 PNG 并封装为 ICO（Vista+ PNG-in-ICO 格式）
const fs = require('fs');
const zlib = require('zlib');

const S = 256;
const px = Buffer.alloc(S * S * 4); // RGBA

const BG = [0x10, 0x10, 0x14];
const FG = [0xff, 0x54, 0x70];

function put(x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= S || y >= S) return;
  const i = (y * S + x) * 4;
  // alpha over
  const ai = a / 255;
  px[i] = Math.round(r * ai + px[i] * (1 - ai));
  px[i + 1] = Math.round(g * ai + px[i + 1] * (1 - ai));
  px[i + 2] = Math.round(b * ai + px[i + 2] * (1 - ai));
  px[i + 3] = Math.min(255, px[i + 3] + Math.round(a * (1 - px[i + 3] / 255)));
}

const R = 56; // 圆角半径
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    // 圆角矩形判定
    const inCorner =
      (x < R && y < R && (x - R) ** 2 + (y - R) ** 2 > R * R) ||
      (x >= S - R && y < R && (x - (S - 1 - R)) ** 2 + (y - R) ** 2 > R * R) ||
      (x < R && y >= S - R && (x - R) ** 2 + (y - (S - 1 - R)) ** 2 > R * R) ||
      (x >= S - R && y >= S - R && (x - (S - 1 - R)) ** 2 + (y - (S - 1 - R)) ** 2 > R * R);
    if (!inCorner) put(x, y, BG[0], BG[1], BG[2], 255);
  }
}

// 圆环
const cx = 128, cy = 128, ringR = 78, ringW = 18;
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const d = Math.hypot(x - cx, y - cy);
    if (Math.abs(d - ringR) <= ringW / 2) {
      const t = 1 - Math.abs(d - ringR) / (ringW / 2); // 边缘抗锯齿
      put(x, y, FG[0], FG[1], FG[2], Math.round(255 * Math.max(0, t)));
    }
  }
}

// 播放三角
const t1 = [cx - 26, cy - 44], t2 = [cx - 26, cy + 44], t3 = [cx + 52, cy];
function inTri(x, y, a, b, c) {
  const s1 = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
  const s2 = (c[0] - b[0]) * (y - b[1]) - (c[1] - b[1]) * (x - b[0]);
  const s3 = (a[0] - c[0]) * (y - c[1]) - (a[1] - c[1]) * (x - c[0]);
  const neg = s1 < 0 || s2 < 0 || s3 < 0;
  const pos = s1 > 0 || s2 > 0 || s3 > 0;
  return !(neg && pos);
}
// 膨胀三角（模拟描边厚度），用采样
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    if (inTri(x, y, t1, t2, t3)) put(x, y, FG[0], FG[1], FG[2], 255);
  }
}

// ---- PNG 编码 ----
function crc32(buf) {
  let c, table = crc32.table;
  if (!table) {
    table = crc32.table = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, cr]);
}
const raw = Buffer.alloc(S * (S * 4 + 1));
for (let y = 0; y < S; y++) {
  raw[y * (S * 4 + 1)] = 0; // filter none
  px.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4);
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', (() => { const b = Buffer.alloc(13); b.writeUInt32BE(S, 0); b.writeUInt32BE(S, 4); b[8] = 8; b[9] = 6; return b; })()),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

// ---- ICO 封装 ----
const icoHeader = Buffer.alloc(6);
icoHeader.writeUInt16LE(0, 0); // reserved
icoHeader.writeUInt16LE(1, 2); // type: icon
icoHeader.writeUInt16LE(1, 4); // count
const entry = Buffer.alloc(16);
entry[0] = 0; // width 256 → 0
entry[1] = 0; // height 256 → 0
entry[2] = 0; // colors
entry[3] = 0; // reserved
entry.writeUInt16LE(1, 4); // planes
entry.writeUInt16LE(32, 6); // bpp
entry.writeUInt32LE(png.length, 8); // size
entry.writeUInt32LE(22, 12); // offset
fs.writeFileSync('build/icon.ico', Buffer.concat([icoHeader, entry, png]));
fs.writeFileSync('build/icon-256.png', png);
console.log('icon.ico written:', 22 + png.length, 'bytes');
