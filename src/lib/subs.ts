// VTT / SRT / ASS 字幕解析（简化版，覆盖常见格式）
export interface Cue {
  start: number;
  end: number;
  text: string;
}

function tsToSec(ts: string): number {
  // 00:01:23.456 or 01:23.456 or 23.45
  const parts = ts.trim().split(':').map(parseFloat);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

export function parseSubtitles(text: string): Cue[] {
  const src = text.replace(/^\uFEFF/, '');
  const cues: Cue[] = [];
  if (/WEBVTT/i.test(src)) {
    const blocks = src.replace(/WEBVTT.*?$/im, '').split(/\r?\n\r?\n/);
    for (const b of blocks) {
      const lines = b.split(/\r?\n/).filter(Boolean);
      const idx = lines.findIndex(l => l.includes('-->'));
      if (idx < 0) continue;
      const [a, c] = lines[idx].split('-->');
      const start = tsToSec(a);
      const end = tsToSec(c);
      const body = lines.slice(idx + 1).join('\n').replace(/<[^>]+>/g, '');
      if (body) cues.push({ start, end: Math.max(end, start + 1), text: body });
    }
  } else {
    // SRT / 纯文本时间轴
    const blocks = src.split(/\r?\n\r?\n/);
    for (const b of blocks) {
      const lines = b.split(/\r?\n/).filter(Boolean);
      const idx = lines.findIndex(l => /-->/.test(l));
      if (idx < 0) continue;
      const line = lines[idx];
      const m = line.match(/([\d:,.]+)\s*-->\s*([\d:,.]+)/);
      if (!m) continue;
      const start = tsToSec(m[1].replace(',', '.'));
      const end = tsToSec(m[2].replace(',', '.'));
      const body = lines.slice(idx + 1).join('\n').replace(/<[^>]+>/g, '');
      if (body) cues.push({ start, end: Math.max(end, start + 1), text: body });
    }
  }
  // ASS/SSA 时间行 "Dialogue: 0,0:00:01.00,0:00:03.00,..."
  if (!cues.length && /Dialogue:/m.test(src)) {
    for (const line of src.split(/\r?\n/)) {
      const m = line.match(/^Dialogue:\s*\d+,\s*([\d:,.]+),\s*([\d:,.]+),.*?[,)]\s*([^\d].*)$/);
      if (m) {
        const start = tsToSec(m[1].replace(',', '.'));
        const end = tsToSec(m[2].replace(',', '.'));
        let body = (m[3] || '').replace(/\{[^}]*\}/g, '').trim();
        if (body && body !== 'N/A') cues.push({ start, end: Math.max(end, start + 1), text: body });
      }
    }
  }
  cues.sort((a, b) => a.start - b.start);
  return cues;
}

export function activeCue(cues: Cue[], t: number): Cue | null {
  if (!cues.length) return null;
  let lo = 0, hi = cues.length - 1, ans: Cue | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const c = cues[mid];
    if (c.start <= t && t < c.end) { ans = c; break; }
    if (c.start > t) hi = mid - 1; else lo = mid + 1;
  }
  return ans;
}
