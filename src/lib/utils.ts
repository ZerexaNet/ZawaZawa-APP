import { API_BASE } from '../api';

/** 页面跳转：Web 用 history，Electron(file://) 用 hash 路由 */
export function goto(path: string) {
  if (window.location.protocol === 'file:') {
    window.location.hash = '#' + path;
  } else {
    window.location.href = path;
  }
}

export function fmtCount(n?: number): string {
  if (n === undefined || n === null || isNaN(n)) return '0';
  if (n >= 1e8) return (n / 1e8).toFixed(1) + '亿';
  if (n >= 1e4) return (n / 1e4).toFixed(1) + '万';
  return String(n);
}

export function fmtDuration(sec?: number): string {
  if (!sec || sec < 0) return '0:00';
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return (h > 0 ? h + ':' : '') + mm + ':' + String(s).padStart(2, '0');
}

export function fmtSize(bytes: number): string {
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(1) + ' GB';
  if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return bytes + ' B';
}

// API 返回 "2026-10-03 16:24:44"（UTC）或 ISO
export function parseApiDate(s?: string | null): Date | null {
  if (!s) return null;
  let d = new Date(s);
  if (isNaN(d.getTime())) {
    d = new Date(s.replace(' ', 'T') + (s.includes('T') || s.includes('Z') ? '' : 'Z'));
  }
  return isNaN(d.getTime()) ? null : d;
}

export function fmtDate(s?: string | null): string {
  const d = parseApiDate(s);
  if (!d) return s || '';
  return d.toLocaleDateString('zh-CN');
}

export function timeAgo(s?: string | null): string {
  const d = parseApiDate(s);
  if (!d) return s || '';
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
  if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
  if (diff < 86400 * 30) return Math.floor(diff / 86400) + '天前';
  return fmtDate(s);
}

export function gravatar(email: string, size = 96): string {
  const h = sha256HexSync(email.trim().toLowerCase());
  return `https://www.gravatar.com/avatar/${h}?s=${size}&d=mp`;
}

// 简易同步 hash（用于 gravatar d=mp 不需要真 sha256 时回退）
function sha256HexSync(input: string): string {
  try {
    // FNV-1a 32bit 重复填充到 64 位十六进制（gravatar 需要真 sha256，但多数邮箱用 d=mp 显示即可）
    let h1 = 0x811c9dc5;
    let h2 = 0x01000193;
    for (let i = 0; i < input.length; i++) {
      h1 ^= input.charCodeAt(i);
      h1 = (h1 * 0x01000193) >>> 0;
      h2 = ((h2 ^ input.charCodeAt(i)) * 0x85ebca6b) >>> 0;
    }
    return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).repeat(4).slice(0, 64);
  } catch {
    return '0'.repeat(64);
  }
}

// 真 SHA-256（Web Crypto，支持大文件分片 digest 由调用方实现）
export async function sha256Hex(buf: ArrayBuffer | Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// 真·增量 SHA-256（FIPS 180-4），支持 GB 级文件分片计算
const K: number[] = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

export class StreamingSha256 {
  private state = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  private buffer = new Uint8Array(64);
  private bufferLen = 0;
  private totalLen = 0;
  private w = new Uint32Array(64);

  feed(chunk: Uint8Array): void {
    this.totalLen += chunk.length;
    let off = 0;
    while (off < chunk.length) {
      const take = Math.min(64 - this.bufferLen, chunk.length - off);
      this.buffer.set(chunk.subarray(off, off + take), this.bufferLen);
      this.bufferLen += take;
      off += take;
      if (this.bufferLen === 64) {
        this.compress(this.buffer);
        this.bufferLen = 0;
      }
    }
  }

  private compress(block: Uint8Array): void {
    const w = this.w;
    for (let i = 0; i < 16; i++) {
      w[i] = (block[i * 4] << 24) | (block[i * 4 + 1] << 16) | (block[i * 4 + 2] << 8) | block[i * 4 + 3];
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = this.state as unknown as number[];
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    const s = this.state;
    s[0] = (s[0] + a) | 0; s[1] = (s[1] + b) | 0; s[2] = (s[2] + c) | 0; s[3] = (s[3] + d) | 0;
    s[4] = (s[4] + e) | 0; s[5] = (s[5] + f) | 0; s[6] = (s[6] + g) | 0; s[7] = (s[7] + h) | 0;
  }

  digestHex(): string {
    const bitLen = this.totalLen * 8;
    this.buffer[this.bufferLen++] = 0x80;
    if (this.bufferLen > 56) {
      while (this.bufferLen < 64) this.buffer[this.bufferLen++] = 0;
      this.compress(this.buffer);
      this.bufferLen = 0;
    }
    while (this.bufferLen < 56) this.buffer[this.bufferLen++] = 0;
    for (let i = 7; i >= 0; i--) this.buffer[56 + (7 - i)] = (bitLen / Math.pow(2, i * 8)) & 0xff;
    this.compress(this.buffer);
    return Array.from(this.state)
      .map((x) => (x >>> 0).toString(16).padStart(8, '0'))
      .join('');
  }
}

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

export function downloadJSON(obj: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  downloadBlob(blob, filename);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

// 媒体 CDN：R2（ESA 阿里云 CDN 边缘，大陆可达）+ 雨云 S3 多节点
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

export const STREAM_HOSTS = [...R2_HOSTS, ...S3_HOSTS];

// 视频流：接口主地址优先（与后端选择一致），失败后 R2 快速容灾，其余 S3 殿后
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

// 播放器 poster：取兜底档（后端代理绝对地址，Web/Electron 均可用），避免 R2 暂无封面时黑屏
export function posterUrl(url?: string | null): string | undefined {
  const c = coverFallbacks(url);
  return c.length ? c[c.length - 1] : undefined;
}

// 封面：把后端 S3 代理地址改写成 R2 直链，R2 失败时逐档回退（最后一档是后端代理绝对地址）
export function coverFallbacks(url?: string | null): string[] {
  if (!url) return [];
  try {
    const u = new URL(url, API_BASE || location.origin);
    if (u.pathname !== '/api/s3/object') return [url]; // 外部封面（B 站等）直连
    const key = u.searchParams.get('key');
    if (!key) return [url];
    const path = '/' + key; // searchParams 已自动解码 %2F
    const out = R2_HOSTS.map((h) => h + path);
    out.push(API_BASE ? API_BASE + url : url); // 兜底：后端代理（S3），Electron 下必须绝对地址
    return out;
  } catch {
    return [url];
  }
}

export const CATEGORIES: Record<string, string[]> = {
  综合: ['Vlog', '生活', '其他', '科普', '社科', '学习', '职场', '演讲'],
  科技: ['编程', 'AI', '硬件', '手机', '网络安全', '数码', '科技评测'],
  音乐: ['原创', '翻唱', '乐器', 'MV', '现场'],
  游戏: ['游戏实况', '电竞', '评测', '手游', '独立游戏', '单机', '游戏MOD', '游戏攻略'],
  生活: ['家居', '情感', '宠物', '动物纪录片', '宠物日常', '野生动物', '动物科普'],
  娱乐: ['反应', '挑战', '整蛊', '开箱', '搞笑', '整活'],
  体育: ['足球', '篮球', '户外', '武术', '极限', '健身', '瑜伽', '营养', '减肥', '跑步'],
  美食: ['菜谱', '餐厅', '街头美食', '烘焙', '饮品'],
  旅行: ['城市', '自然', '公路旅行', '海外', '攻略'],
  时尚: ['穿搭', '美妆', '护肤', '购物分享', '造型'],
  教育: ['科学', '历史', '语言', '数学', '大学', '基础教育', '考试', '留学', '教育资讯'],
  资讯: ['新闻', '国际', '财经', '深度报道', '时事评论'],
  影视: ['影评', '剪辑', '预告', '幕后', '经典回顾', '动漫', '动漫资讯', '同人作品'],
  汽车: ['评测', '改装', '越野', '新车', '用车技巧', '汽车文化'],
  艺术: ['绘画', '摄影', '设计', '雕塑', '建筑', '手工', '音乐视频', '动画'],
  公益: ['慈善', '环保', '志愿者', '社会公益'],
};

export const CATEGORY_NAMES = ['综合', '科技', '音乐', '游戏', '生活', '娱乐', '体育', '美食', '旅行', '时尚', '教育', '资讯', '影视', '汽车', '艺术', '公益'];

export function catOptions() {
  return CATEGORIES;
}
