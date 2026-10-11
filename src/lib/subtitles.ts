// 字幕解析：VTT / SRT / ASS
export interface Cue {
  start: number;
  end: number;
  text: string;
}

function parseTime(srt: string): number {
  const m = srt.trim().match(/(\d+):(\d{1,2}):(\d{1,2})[,.](\d{1,3})/);
  if (!m) return 0;
  return (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4].padEnd(3, '0')) / 1000;
}

export function parseSrt(text: string): Cue[] {
  const cues: Cue[] = [];
  const blocks = text.replace(/\r/g, '').split(/\n\n+/);
  for (const b of blocks) {
    const lines = b.split('\n');
    let timeIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('-->')) { timeIdx = i; break; }
    }
    if (timeIdx < 0) continue;
    const [s, e] = lines[timeIdx].split('-->');
    const body = lines.slice(timeIdx + 1).join('\n').replace(/<[^>]+>/g, '');
    if (body.trim()) cues.push({ start: parseTime(s), end: parseTime(e), text: body.trim() });
  }
  return cues;
}

export function parseVtt(text: string): Cue[] {
  const body = text.replace(/^WEBVTT[^\n]*\n/, '');
  return parseSrt(body);
}

export function parseAss(text: string): Cue[] {
  const cues: Cue[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('Dialogue:')) continue;
    const parts = line.slice(9).split(',');
    if (parts.length < 10) continue;
    const start = parseTime(parts[1]);
    const end = parseTime(parts[2]);
    const textContent = parts.slice(9).join(',').replace(/\{[^}]*\}/g, '').replace(/\\N/g, '\n').trim();
    if (textContent) cues.push({ start, end, text: textContent });
  }
  return cues;
}

export function parseSubtitle(text: string, ext?: string): Cue[] {
  const t = text.trim();
  if (ext === 'vtt' || t.startsWith('WEBVTT')) return parseVtt(t);
  if (ext === 'ass' || t.includes('[Events]')) return parseAss(t);
  return parseSrt(t);
}

export function activeCue(cues: Cue[], t: number): Cue | null {
  for (const c of cues) {
    if (t >= c.start && t < c.end) return c;
  }
  return null;
}

/** 把服务端字幕 URL 转成本站可访问地址（/api/s3/object?key=... 或外部直链） */
export function resolveSubUrl(url?: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url, location.origin);
    return u.toString();
  } catch {
    return null;
  }
}

export async function fetchSubtitles(url: string): Promise<Cue[]> {
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error('字幕加载失败 ' + r.status);
  const text = await r.text();
  const ext = (url.split('.').pop() || '').toLowerCase();
  return parseSubtitle(text, ext);
}
