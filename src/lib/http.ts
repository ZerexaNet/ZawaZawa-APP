// Lightweight fetch-based HTTP client for the ZawaZawa API.
// Auth: session cookie (credentials: include) — same as the official web client.
// Extra headers: X-Turnstile-Token for captcha-gated auth flows.

const BASE = (import.meta as any).env?.VITE_API_BASE ?? '';

export class ApiError extends Error {
  code: string;
  status: number;
  data: any;
  constructor(message: string, status: number, code = '', data: any = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

export interface ReqOpts {
  token?: string;
  captchaToken?: string;
  signal?: AbortSignal;
  raw?: boolean; // return Response (for binary)
  form?: boolean; // send FormData (do not set json content-type)
  textType?: string; // send string body as raw text with this Content-Type (e.g. 'application/xml')
  retries?: number;
}

export async function request<T = any>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET',
  body?: any,
  opts: ReqOpts = {}
): Promise<T> {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.captchaToken) headers['X-Turnstile-Token'] = opts.captchaToken;
  const isRawText = !!opts.textType && typeof body === 'string';
  if (body !== undefined) {
    if (opts.form || body instanceof FormData) {
      if (!(body instanceof FormData)) throw new Error('form=true requires FormData');
    } else if (isRawText) {
      headers['Content-Type'] = opts.textType!;
    } else {
      headers['Content-Type'] = 'application/json';
    }
  }

  const doFetch = async (): Promise<Response> =>
    fetch(url, {
      method,
      headers,
      credentials: 'include',
      body: body === undefined ? undefined : opts.form || body instanceof FormData ? body : isRawText ? body : JSON.stringify(body),
      signal: opts.signal,
    });

  let res: Response;
  const retries = opts.retries ?? 0;
  for (let attempt = 0; ; attempt++) {
    try {
      res = await doFetch();
      break;
    } catch (e: any) {
      if (e?.name === 'AbortError') throw e;
      if (attempt < retries) continue;
      throw new ApiError('网络错误，请检查连接', 0, 'NETWORK', e);
    }
  }

  if (opts.raw) return res as any;

  if (res.status === 204) return null as any;
  const text = await res.text();
  let data: any = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }

  if (!res.ok) {
    const msg = (data && (data.detail || data.message || data.error)) || `请求失败 (${res.status})`;
    const code = (data && data.code) || (data && data.error) || '';
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent('zzw:unauthorized'));
      const e = new ApiError(typeof msg === 'string' ? msg : '未登录或会话已过期', 401, code, data);
      (e as any).status = 401;
      throw e;
    }
    if (res.status === 403 && (code === 'ACCOUNT_BANNED' || /封禁|BAN/i.test(String(msg)))) {
      window.dispatchEvent(new CustomEvent('zzw:banned', { detail: data }));
      throw new ApiError('账号已被封禁：' + msg, 403, code, data);
    }
    if (res.status === 451) {
      throw new ApiError('该内容在当前地区被限制播放 (451)', 451, code, data);
    }
    throw new ApiError(typeof msg === 'string' ? msg : JSON.stringify(msg), res.status, code, data);
  }
  return data as T;
}

// ---- helpers ----
export const http = {
  get: <T = any>(p: string, opts: ReqOpts = {}) => request<T>(p, 'GET', undefined, opts),
  post: <T = any>(p: string, body?: any, opts: ReqOpts = {}) => request<T>(p, 'POST', body, opts),
  put: <T = any>(p: string, body?: any, opts: ReqOpts = {}) => request<T>(p, 'PUT', body, opts),
  delete: <T = any>(p: string, opts: ReqOpts = {}) => request<T>(p, 'DELETE', undefined, opts),
};

export function qs(params: Record<string, any>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** Normalize list endpoints that sometimes return T[] and sometimes {items: T[]}. */
export function asList<T = any>(data: any): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.videos)) return data.videos;
  if (Array.isArray(data.users)) return data.users;
  if (Array.isArray(data.data)) return data.data;
  return [data];
}
export function asTotal(data: any, fallback: number): number {
  if (!data) return fallback;
  if (typeof data.total === 'number') return data.total;
  return fallback;
}
