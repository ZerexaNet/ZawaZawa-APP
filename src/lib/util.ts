// formatting & misc utils

export function fmtViews(n?: number): string {
  if (!n && n !== 0) return '0';
  if (n < 10000) return String(n);
  if (n < 100000000) return (n / 10000).toFixed(n < 100000 ? 1 : 0).replace(/\.0$/, '') + '万';
  return (n / 100000000).toFixed(1).replace(/\.0$/, '') + '亿';
}
export function fmtNum(n?: number): string {
  if (n === undefined || n === null) return '0';
  return n.toLocaleString('zh-CN');
}

/** API 时间格式 "2026-10-03 16:24:44"（按北京时间解释） */
export function parseApiTime(s?: string | null): Date | null {
  if (!s) return null;
  let d: Date;
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(s)) {
    d = new Date(s.replace(' ', 'T') + '+08:00');
  } else if (/^\d{10}$/.test(s)) {
    d = new Date(Number(s) * 1000);
  } else if (/^\d{13}$/.test(s)) {
    d = new Date(Number(s));
  } else {
    d = new Date(s);
  }
  return isNaN(d.getTime()) ? null : d;
}

export function timeAgo(s?: string | null): string {
  const d = parseApiTime(s);
  if (!d) return s || '';
  const now = Date.now();
  const diff = Math.max(0, (now - d.getTime()) / 1000);
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400 / 7)} 周前`;
  const ds = d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  return ds;
}

export function fmtDateTime(s?: string | null): string {
  const d = parseApiTime(s);
  if (!d) return s || '';
  return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function fmtDate(s?: string | null): string {
  const d = parseApiTime(s);
  if (!d) return s || '';
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function fmtDuration(sec?: number): string {
  if (!sec || sec <= 0) return '';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  const mm = String(m).padStart(2, '0'), ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}
export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  const mm = String(m).padStart(2, '0'), sss = String(ss).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${sss}` : `${m}:${sss}`;
}

export function fmtBytes(n?: number): string {
  if (!n && n !== 0) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = Number(n);
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function initials(name?: string): string {
  if (!name) return '?';
  return name.slice(0, 1).toUpperCase();
}

export function fallbackAvatar(name?: string): string {
  // 稳定的本地生成头像（data URI SVG），避免外部 gravatar 请求
  if (!name) return '';
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const palettes: [string, string][] = [
    ['#4f378b', '#8b5cf6'], ['#1d4ed8', '#60a5fa'], ['#0e7490', '#22d3ee'],
    ['#15803d', '#4ade80'], ['#b45309', '#fbbf24'], ['#be123c', '#fb7185'],
    ['#6d28d9', '#c4b5fd'], ['#0369a1', '#38bdf8'],
  ];
  const [c1, c2] = palettes[h % palettes.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="72" height="72" fill="url(#g)"/><text x="36" y="45" font-family="sans-serif" font-size="32" font-weight="600" fill="#fff" text-anchor="middle">${initials(name)}</text></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

export function avatarUrl(u: { gravatar_url?: string; avatar_url?: string; username?: string } | null | undefined, size = 72): string {
  if (!u) return fallbackAvatar(undefined);
  const url = u.gravatar_url || u.avatar_url || '';
  // gravatar 带尺寸参数
  if (url && url.includes('gravatar') && !url.includes('s=')) {
    return url + (url.includes('?') ? '&' : '?') + `s=${size * 2}&d=mp`;
  }
  return url || fallbackAvatar(u.username);
}

/** SHA-256 hex（用于秒传校验） */
export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ---------- 流式 SHA-256（大文件分块计算，内存占用恒定 ~8MB/块） ---------- */
const K256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

export class Sha256 {
  private h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  private w = new Uint32Array(64);
  private block = new Uint8Array(64);
  private blen = 0;
  private total = 0;

  update(chunk: Uint8Array) {
    this.total += chunk.length;
    let off = 0;
    if (this.blen > 0) {
      const take = Math.min(64 - this.blen, chunk.length);
      this.block.set(chunk.subarray(0, take), this.blen);
      this.blen += take;
      off = take;
      if (this.blen < 64) return;
      this.process(this.block, 0);
      this.blen = 0;
    }
    for (; off + 64 <= chunk.length; off += 64) this.process(chunk, off);
    if (off < chunk.length) {
      this.block.set(chunk.subarray(off), 0);
      this.blen = chunk.length - off;
    }
  }

  private process(b: Uint8Array, off: number) {
    const w = this.w;
    for (let i = 0; i < 16; i++) {
      w[i] = (b[off + i * 4] << 24) | (b[off + i * 4 + 1] << 16) | (b[off + i * 4 + 2] << 8) | b[off + i * 4 + 3];
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    const h = this.h;
    let [a, b2, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K256[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b2) ^ (a & c) ^ (b2 & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b2; b2 = a; a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b2) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
  }

  hex(): string {
    const h = this.h;
    const bitsLo = (((this.total & 0x1FFFFFFF) << 3) >>> 0) >>> 0;
    const bitsHi = Math.floor(this.total / 0x20000000);
    const rem = this.blen;
    // 补齐 1 个 0x80 + 长度（64bit 大端）
    const padLen = (64 - ((rem + 9) % 64)) % 64;
    const pad = new Uint8Array(padLen + 9);
    pad[0] = 0x80;
    const dv = new DataView(pad.buffer);
    dv.setUint32(pad.length - 8, bitsHi);
    dv.setUint32(pad.length - 4, bitsLo);
    this.update(pad);
    return [...h].map(x => x.toString(16).padStart(8, '0')).join('');
  }
}

/** 分块计算文件 SHA-256（不会把整个文件读进内存） */
export async function sha256File(file: File, chunkSize = 8 * 1024 * 1024, onProgress?: (frac: number) => void): Promise<string> {
  const h = new Sha256();
  let off = 0;
  while (off < file.size) {
    const end = Math.min(file.size, off + chunkSize);
    const ab = await file.slice(off, end).arrayBuffer();
    h.update(new Uint8Array(ab));
    off = end;
    onProgress?.(off / file.size);
    await new Promise(r => setTimeout(r, 0)); // 让出主线程，保持 UI 响应
  }
  return h.hex();
}

/* ---------- 媒体容灾链（与旧版客户端一致：接口主地址 → R2 → 雨云 S3） ---------- */
const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? '';
export const R2_HOSTS = [
  'https://bsbucket.video.hkmc.online',
  'https://bucket.video.hkmc.online',
  'https://eobucket.video.hkmc.online',
];
// S3 容灾顺序（大陆网络视角）：上海 → 港澳 → 悉尼（海外殿后）
export const S3_HOSTS = [
  'https://zerexa-video-1.cn-sh1.rains3.com',
  'https://zerexa-video-1.cn-hk-1.rains3.com',
  'https://zerexa-video-sy.cn-sy1.rains3.com',
  'https://zerexa-video-1.cn-sy1.rains3.com',
];

export function streamFallbacks(url?: string): string[] {
  if (!url) return [];
  try {
    const u = new URL(url, API_BASE || location.origin);
    if (!u.pathname.startsWith('/videos/')) return [url];
    const path = u.pathname + u.search;
    const out = [url];
    for (const h of [...R2_HOSTS, ...S3_HOSTS]) {
      const cand = h + path;
      if (!out.includes(cand)) out.push(cand);
    }
    return out;
  } catch {
    return [url];
  }
}

export function coverFallbacks(url?: string | null): string[] {
  if (!url) return [];
  try {
    const u = new URL(url, API_BASE || location.origin);
    if (u.pathname !== '/api/s3/object') return [url]; // 外部封面（B 站等）直连
    const key = u.searchParams.get('key');
    if (!key) return [url];
    const out: string[] = [];
    for (const h of R2_HOSTS) out.push(`${h}/${key}`);
    out.push(url); // 最后一档：后端代理
    return out;
  } catch {
    return [url];
  }
}

/** 页面跳转：Web 用 history，Electron(file://) 用 hash 路由 */
export function goto(path: string) {
  if (window.location.protocol === 'file:') {
    window.location.hash = '#' + path;
  } else {
    window.location.href = path;
  }
}

export function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      return true;
    } catch {
      return false;
    }
  }
}

export function debounce<T extends (...a: any[]) => void>(fn: T, ms: number): T {
  let t: any;
  return ((...a: any[]) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  }) as T;
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
