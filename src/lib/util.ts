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
