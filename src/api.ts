// ZawaZawa API 客户端 —— 覆盖全部文档端点 + 线上隐藏端点
import type {
  Announcement, Article, AuditItem, CaptchaConfig, Collection, Comment, CoinsInfo, Conversation,
  Danmaku, DirectThread, FavoriteEntry, HistoryEntry, InboxMessage, Membership, ModerationComment,
  NotificationItem, Post, Referendum, ReportItem, Subtitle, Ticket, TicketMessage, User, Video,
  VerificationRequest,
} from './types';
import { asArray } from './types';

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const TOKEN_KEY = 'zawa_token';

// API base：Web 部署同域留空；Electron 构建注入 VITE_API_BASE 指向真实域
export const API_BASE: string = ((import.meta as unknown as { env: Record<string, string | undefined> }).env?.VITE_API_BASE) || '';
const BASE = API_BASE;
export function url(path: string): string {
  if (BASE && path.startsWith('/')) return BASE + path;
  return path;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string | null) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

interface ReqOpts {
  method?: string;
  body?: unknown;
  formData?: FormData;
  headers?: Record<string, string>;
  raw?: boolean; // 返回 Response（用于文件上传 PUT）
  signal?: AbortSignal;
}

let authErrorHandler: ((msg: string) => void) | null = null;
export function onAuthError(fn: ((msg: string) => void) | null) {
  authErrorHandler = fn;
}

export async function req<T = unknown>(path: string, opts: ReqOpts = {}): Promise<T> {
  const headers: Record<string, string> = { ...(opts.headers || {}) };
  if (!opts.formData && !opts.raw && opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const resp = await fetch(url(path), {
    method: opts.method || (opts.body !== undefined || opts.formData ? 'POST' : 'GET'),
    headers,
    credentials: 'include',
    body: opts.formData || (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    signal: opts.signal,
  });

  if (opts.raw) {
    if (!resp.ok) throw await toError(resp);
    return resp as unknown as T;
  }

  let data: unknown = null;
  const ct = resp.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    try { data = await resp.json(); } catch { data = null; }
  } else {
    const text = await resp.text();
    if (text) { try { data = JSON.parse(text); } catch { data = { raw: text }; } }
  }

  if (!resp.ok) throw await toError(resp, data);
  return data as T;
}

async function toError(resp: Response, preloaded?: unknown): Promise<ApiError> {
  let msg = `${resp.status} ${resp.statusText}`;
  let code = String(resp.status);
  let data = preloaded;
  if (data === undefined) {
    try {
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('application/json')) data = await resp.clone().json();
      else {
        const t = await resp.clone().text();
        if (t && t.length < 500) { try { data = JSON.parse(t); } catch { data = { message: t }; } }
      }
    } catch { /* ignore */ }
  }
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (typeof d.error === 'string') { code = d.error; msg = typeof d.message === 'string' ? d.message : d.error; }
    else if (typeof d.message === 'string') msg = d.message;
  }
  if (resp.status === 401) {
    setToken(null);
    try { const u = sessionStorage.getItem('zawa_user'); if (u) sessionStorage.removeItem('zawa_user'); } catch { /* ignore */ }
    if (authErrorHandler) authErrorHandler(msg || '登录已过期，请重新登录');
  }
  return new ApiError(msg || '请求失败', code, resp.status);
}

const Q = (p: string) => encodeURIComponent(p);

export const api = {
  // ============ 系统 ============
  ping: () => req<{ pong: boolean }>('/api/ping'),
  legal: (type: 'tos' | 'privacy') => req<{ title?: string; content?: string; type?: string; [k: string]: unknown }>(`/api/legal/${type}`),

  // ============ 认证 ============
  captchaConfig: () => req<CaptchaConfig>('/api/auth/captcha-config'),
  usernameAvailable: (username: string, excludeId?: string, registration = false) =>
    req<{ available: boolean; reason?: string }>(`/api/auth/username-available?username=${Q(username)}${excludeId ? `&exclude_id=${Q(excludeId)}` : ''}${registration ? '&registration=1' : ''}`),
  login: (identifier: string, password: string, geetest?: string, turnstileToken?: string) =>
    req<{ success: boolean; token: string; user: User }>('/api/auth/login', {
      body: { identifier, password, ...(geetest ? { geetest } : {}), ...(turnstileToken ? { turnstileToken } : {}) },
      headers: turnstileToken ? { 'X-Turnstile-Token': turnstileToken } : undefined,
    }),
  clientLogin: (username: string, password: string, geetest?: string) =>
    req<{ success: boolean; token: string; user: User }>('/login_api', { body: { username, password, ...(geetest ? { geetest } : {}) } }),
  register: (username: string, email: string, password: string, geetest?: string, turnstileToken?: string) =>
    req<{ success: boolean; requires_email_verification?: boolean; message?: string }>('/api/auth/register', {
      body: { username, email, password, ...(geetest ? { geetest } : {}), ...(turnstileToken ? { turnstileToken } : {}) },
      headers: turnstileToken ? { 'X-Turnstile-Token': turnstileToken } : undefined,
    }),
  logout: () => req<{ success: boolean }>('/api/auth/logout', { method: 'POST' }),
  verifyEmail: (identifier: string, email: string, code: string, turnstileToken?: string) =>
    req<{ success: boolean }>('/api/auth/verify-email', {
      body: { identifier, email, code },
      headers: turnstileToken ? { 'X-Turnstile-Token': turnstileToken } : undefined,
    }),
  forgotSendCode: (email: string) => req<{ success: boolean }>('/api/auth/forgot-password/send-code', { body: { email } }),
  forgotReset: (email: string, code: string, password: string) =>
    req<{ success: boolean }>('/api/auth/forgot-password', { body: { email, code, password } }),
  deactivate: (confirmed: boolean, confirmText: string) =>
    req<{ success: boolean; requires_email_verification?: boolean; masked_email?: string; expires_at?: number }>('/api/auth/deactivate', {
      body: { confirmed, confirmText },
    }),
  deactivateConfirm: (code: string) => req<{ success: boolean }>('/api/auth/deactivate/confirm', { body: { code } }),
  exportData: () =>
    req<unknown>('/api/users/me/export', { headers: { Accept: 'application/json' } }),
  me: () => req<User>('/api/users/me'),

  // ============ 用户 ============
  userPublic: (userId: string) =>
    req<{ user: User; videos?: Video[]; [k: string]: unknown }>(`/api/users/${Q(userId)}`),
  changeUsername: (username: string) => req<{ username: string }>('/api/users/me/username', { method: 'PUT', body: { username } }),
  changeBio: (bio: string) => req<{ bio: string }>('/api/users/me/bio', { method: 'PUT', body: { bio } }),
  myVideos: (limit = 20, offset = 0) => req<Video[] | { items: Video[] }>(`/api/users/me/videos?limit=${limit}&offset=${offset}`),
  myArticles: (limit = 20, offset = 0) => req<Article[] | { items: Article[] }>(`/api/users/me/articles?limit=${limit}&offset=${offset}`),
  userArticles: (userId: string, limit = 20, offset = 0) =>
    req<Article[] | { items: Article[] }>(`/api/users/${Q(userId)}/articles?limit=${limit}&offset=${offset}`),
  myDynamics: (limit = 20, offset = 0) => req<Post[] | { items: Post[] }>(`/api/users/me/dynamics?limit=${limit}&offset=${offset}`),
  userDynamics: (userId: string, limit = 20, offset = 0) =>
    req<Post[] | { items: Post[] }>(`/api/users/${Q(userId)}/dynamics?limit=${limit}&offset=${offset}`),
  myFollowers: (limit = 20, offset = 0) => req<User[] | { items: User[] }>(`/api/users/me/followers?limit=${limit}&offset=${offset}`),
  userFollowers: (userId: string, limit = 20, offset = 0) =>
    req<User[] | { items: User[] }>(`/api/users/${Q(userId)}/followers?limit=${limit}&offset=${offset}`),
  myFollowing: (limit = 20, offset = 0) => req<User[] | { items: User[] }>(`/api/users/me/following?limit=${limit}&offset=${offset}`),
  follow: (userId: string) => req<{ following: boolean; follower_count?: number }>(`/api/users/${Q(userId)}/follow`, { method: 'POST' }),
  unfollow: (userId: string) => req<{ following: boolean; follower_count?: number }>(`/api/users/${Q(userId)}/follow`, { method: 'DELETE' }),
  followStatus: (userId: string) => req<{ following: boolean; follower_count?: number }>(`/api/users/${Q(userId)}/follow-status`),
  block: (userId: string) => req<{ success?: boolean }>(`/api/users/${Q(userId)}/block`, { method: 'POST' }),
  unblock: (userId: string) => req<{ success?: boolean }>(`/api/users/${Q(userId)}/block`, { method: 'DELETE' }),
  blocklist: (limit = 50, offset = 0) => req<User[] | { items: User[] }>(`/api/users/me/blocks?limit=${limit}&offset=${offset}`),
  favorites: (limit = 20, offset = 0) => req<FavoriteEntry[] | { items: FavoriteEntry[] }>(`/api/users/me/favorites?limit=${limit}&offset=${offset}`),
  history: (limit = 30, offset = 0) => req<HistoryEntry[] | { items: HistoryEntry[] }>(`/api/users/me/history?limit=${limit}&offset=${offset}`),
  historySettings: (enabled: boolean) => req<unknown>('/api/users/me/history/settings', { method: 'PUT', body: { enabled } }),
  historyClear: () => req<{ success: boolean }>('/api/users/me/history', { method: 'DELETE' }),
  historyRemove: (historyId: string) => req<{ success: boolean }>(`/api/users/me/history/${Q(historyId)}`, { method: 'DELETE' }),

  // ============ 视频 ============
  videos: (p: { category?: string; sort?: string; limit?: number; offset?: number; exclude?: string } = {}) => {
    const sp = new URLSearchParams();
    if (p.category) sp.set('category', p.category);
    if (p.sort) sp.set('sort', p.sort);
    if (p.limit) sp.set('limit', String(p.limit));
    if (p.offset) sp.set('offset', String(p.offset));
    if (p.exclude) sp.set('exclude', p.exclude);
    return req<Video[] | { items: Video[] }>(`/api/videos?${sp.toString()}`);
  },
  trending: (limit = 24) => req<Video[] | { items: Video[] }>(`/api/videos/trending?limit=${limit}`),
  video: (id: string) => req<Video>(`/api/videos/${Q(id)}`),
  videoUpdate: (id: string, body: { title?: string; description?: string; category?: string; source_url?: string }) =>
    req<{ moderation_warning?: string; moderation_opinion?: string; [k: string]: unknown }>(`/api/videos/${Q(id)}`, { method: 'PUT', body }),
  videoDelete: (id: string) => req<{ success: boolean }>(`/api/videos/${Q(id)}`, { method: 'DELETE' }),
  videoLike: (id: string) => req<{ liked: boolean; likes?: number }>(`/api/videos/${Q(id)}/like`, { method: 'POST' }),
  videoUnliked: (id: string) => req<{ liked: boolean }>(`/api/videos/${Q(id)}/like`, { method: 'GET' }),
  videoFav: (id: string) => req<{ favorited: boolean }>(`/api/videos/${Q(id)}/favorite`, { method: 'POST' }),
  videoUnfav: (id: string) => req<{ favorited: boolean }>(`/api/videos/${Q(id)}/favorite`, { method: 'DELETE' }),
  videoFavCheck: (id: string) => req<{ favorited: boolean }>(`/api/videos/${Q(id)}/favorite`),
  videoConfused: (id: string) => req<{ confused: boolean }>(`/api/videos/${Q(id)}/confused`),
  videoConfuse: (id: string) => req<{ confused: boolean; confusion_count?: number }>(`/api/videos/${Q(id)}/confusion`, { method: 'POST' }),
  watchReport: (id: string, watchSeconds: number, videoSeconds: number) =>
    req<{ success?: boolean; recorded?: boolean }>(`/api/videos/${Q(id)}/watch`, { body: { watch_seconds: watchSeconds, video_seconds: videoSeconds } }),
  videoReport: (id: string, reason: string, details?: string) =>
    req<{ success?: boolean }>(`/api/videos/${Q(id)}/report`, { body: { reason, ...(details ? { details } : {}) } }),
  coin: (id: string) => req<{ success?: boolean; coins?: number }>(`/api/videos/${Q(id)}/coin`, { method: 'POST' }),
  recommend: (excludeId?: string, limit = 12) =>
    req<Video[]>(`/api/recommend?${excludeId ? `exclude=${Q(excludeId)}&` : ''}limit=${limit}`),
  confusionBoard: (p: { page?: number; per_page?: number; range?: string; start?: string; end?: string } = {}) => {
    const sp = new URLSearchParams();
    sp.set('page', String(p.page || 1));
    sp.set('per_page', String(p.per_page || 20));
    if (p.range) sp.set('range', p.range);
    if (p.start) sp.set('start', p.start);
    if (p.end) sp.set('end', p.end);
    return req<{ videos: Video[]; total: number; total_pages?: number; page?: number; [k: string]: unknown }>(`/api/heyiwei?${sp.toString()}`);
  },
  search: (q: string) =>
    req<{ videos?: Video[]; users?: User[] }>(`/api/search?q=${Q(q)}`),
  quickImport: (sourceUrl: string, category: string) =>
    req<{ success?: boolean; status?: string }>(`/api/videos/quick-import`, { body: { source_url: sourceUrl, category } }),

  // 弹幕
  danmaku: (id: string, limit = 300, offset = 0) =>
    req<Danmaku[] | { items: Danmaku[] }>(`/api/videos/${Q(id)}/danmaku?limit=${limit}&offset=${offset}`),
  danmakuSend: (id: string, body: { content: string; time_sec: number; color?: string; mode?: string; fontsize?: number }) =>
    req<{ success?: boolean; id?: string }>(`/api/videos/${Q(id)}/danmaku`, { body }),
  danmakuImport: (id: string, xml: string) =>
    req<{ imported: number }>(`/api/videos/${Q(id)}/danmaku/import`, {
      method: 'POST',
      body: xml,
      headers: { 'Content-Type': 'application/xml' },
    }),
  danmakuXml: (id: string) => fetch(url(`/api/videos/${Q(id)}/danmaku.xml`), { credentials: 'include' }).then(async (r) => {
    if (!r.ok) throw new ApiError('弹幕导出失败', String(r.status), r.status);
    return r.text();
  }),

  // 字幕
  subtitles: (id: string) => req<Subtitle[]>(`/api/videos/${Q(id)}/subtitles`),
  subtitleUpload: (id: string, file: File, language: string, label?: string) => {
    const fd = new FormData();
    fd.append('subtitle', file);
    fd.append('language', language);
    if (label) fd.append('label', label);
    return req<Subtitle | { success?: boolean }>(`/api/videos/${Q(id)}/subtitles`, { formData: fd });
  },
  subtitleDelete: (id: string, subId: string) =>
    req<{ success?: boolean }>(`/api/videos/${Q(id)}/subtitles/${Q(subId)}`, { method: 'DELETE' }),
  aiSubtitle: (id: string) => req<{ job?: { id?: string; status?: string; [k: string]: unknown }; subtitle?: Subtitle | null }>(`/api/videos/${Q(id)}/ai-subtitles`, { method: 'POST' }),
  aiSubtitleStatus: (id: string) =>
    req<{ job?: { id?: string; status?: string; error?: string; [k: string]: unknown }; subtitle?: Subtitle | null }>(`/api/videos/${Q(id)}/ai-subtitles/status`),

  // 封面 / 替换源
  coverUpdate: (id: string, file: File | Blob, contentType: string) => {
    const name = file instanceof File ? file.name : 'cover.jpg';
    const key = `covers/${id}/${name.replace(/[^\w.\-]/g, '_')}`;
    return binaryPut(`/api/videos/upload/proxy-put?key=${Q(key)}`, file, contentType || 'image/jpeg', '封面上传失败')
      .then(() => api.coverSetKey(id, key));
  },
  coverSetKey: (id: string, coverKey: string) =>
    req<{ success?: boolean; cover_key?: string; cover_url?: string }>(`/api/videos/${Q(id)}/cover-update-key`, { body: { cover_key: coverKey } }),
  reupload: (id: string, file: File | Blob, contentType: string) => {
    const name = file instanceof File ? file.name : 'source.mp4';
    const key = `videos/${id}/source${extOf(name)}`;
    return binaryPut(`/api/videos/upload/proxy-put?key=${Q(key)}`, file, contentType || 'video/mp4', '视频替换失败')
      .then(() => ({ success: true, key }));
  },

  // ============ 上传 ============
  uploadCheckHash: (hash: string) =>
    req<{ exists: boolean; existingVideoId?: string }>('/api/videos/upload/check-hash', { body: { hash } }),
  uploadInitiate: (filename: string, contentType: string, direct: boolean) =>
    req<{ uploadId: string; key: string; videoId: string; directUpload?: boolean; putUrl?: string }>(
      '/api/videos/upload/initiate', { body: { filename, contentType, direct } }),
  uploadPresignPart: (key: string, uploadId: string, partNumber: number) =>
    req<{ url: string }>(`/api/videos/upload/presign-part?key=${Q(key)}&uploadId=${Q(uploadId)}&partNumber=${partNumber}`),
  uploadPresignSingle: (key: string, uploadId: string) =>
    req<{ url: string }>(`/api/videos/upload/presign-single?key=${Q(key)}&uploadId=${Q(uploadId)}`),
  uploadComplete: (body: {
    uploadId: string; key: string; videoId: string;
    parts: { PartNumber: number; ETag: string }[];
    title: string; description?: string; category: string; source_url?: string; file_hash?: string;
  }) => req<Video | { id?: string; status?: string }>(`/api/videos/upload/complete`, { body }),
  uploadCancel: (uploadId: string, key?: string) =>
    req<{ success?: boolean }>(`/api/videos/upload/cancel?uploadId=${Q(uploadId)}${key ? `&key=${Q(key)}` : ''}`, { method: 'POST' }),
  uploadProxyPut: (key: string, file: Blob, contentType: string, onProgress?: (pct: number) => void, signal?: AbortSignal) =>
    new Promise<{ success: boolean }>((resolve, reject) => {
      // 用 XHR 支持上传进度
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/videos/upload/proxy-put?key=${Q(key)}`);
      xhr.withCredentials = true;
      const token = getToken();
      if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
      xhr.setRequestHeader('Content-Type', contentType);
      if (onProgress) xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve({ success: true }) : reject(new ApiError('上传失败', String(xhr.status), xhr.status)));
      xhr.onerror = () => reject(new ApiError('上传失败（网络错误）', 'network', 0));
      if (signal) signal.addEventListener('abort', () => { xhr.abort(); reject(new ApiError('已取消', 'aborted', 0)); });
      xhr.send(file);
    }),

  // ============ 评论 ============
  comments: (targetType: 'video' | 'article' | 'dynamic', targetId: string, limit = 30, offset = 0) =>
    req<Comment[] | { items: Comment[]; total?: number }>(`/api/${targetType === 'video' ? 'videos' : targetType === 'article' ? 'articles' : 'dynamics'}/${Q(targetId)}/comments?limit=${limit}&offset=${offset}`),
  commentPost: (targetType: 'video' | 'article' | 'dynamic', targetId: string, content: string, parentId?: string | null) =>
    req<Comment | { id?: string }>(`/api/${targetType === 'video' ? 'videos' : targetType === 'article' ? 'articles' : 'dynamics'}/${Q(targetId)}/comments`, {
      body: { content, ...(parentId ? { parent_id: parentId } : {}) },
    }),
  commentLike: (targetType: 'video' | 'article' | 'dynamic', commentId: string) =>
    req<{ liked: boolean; like_count?: number }>(`/api/${targetType === 'video' ? 'videos' : targetType === 'article' ? 'articles' : 'dynamics'}/content-comments/${Q(commentId)}/like`, { method: 'POST' }),
  commentDelete: (targetType: 'video' | 'article' | 'dynamic', commentId: string) =>
    req<{ success?: boolean }>(`/api/${targetType === 'video' ? 'videos' : targetType === 'article' ? 'articles' : 'dynamics'}/content-comments/${Q(commentId)}`, { method: 'DELETE' }),
  translate: (text: string, targetLang = 'zh') =>
    req<{ translated_text: string }>('/api/comments/translate', { body: { text, target_lang: targetLang } }),

  // ============ 合集 ============
  myCollections: () => req<Collection[] | { items: Collection[] }>('/api/users/me/collections'),
  collectionCreate: (title: string, description?: string) =>
    req<Collection | { id: string }>('/api/collections', { body: { title, ...(description ? { description } : {}) } }),
  collectionDetail: (id: string) => req<Collection>(`/api/collections/${Q(id)}`),
  collectionAddItem: (id: string, videoId: string, partTitle?: string, sortOrder?: number) =>
    req<{ success?: boolean }>(`/api/collections/${Q(id)}/items`, { body: { video_id: videoId, ...(partTitle ? { part_title: partTitle } : {}), ...(sortOrder !== undefined ? { sort_order: sortOrder } : {}) } }),
  collectionRemoveItem: (id: string, videoId: string) =>
    req<{ success?: boolean }>(`/api/collections/${Q(id)}/items/${Q(videoId)}`, { method: 'DELETE' }),

  // ============ 动态 ============
  postDynamic: (content: string, videoId?: string, images: File[] = []) =>
    images.length > 0
      ? (() => {
          const fd = new FormData();
          fd.append('content', content);
          if (videoId) fd.append('video_id', videoId);
          images.forEach((f) => fd.append('images', f));
          return req<Post | { item?: Post; pending_review?: boolean }>(`/api/dynamics`, { formData: fd });
        })()
      : req<Post | { item?: Post; pending_review?: boolean }>(`/api/dynamics`, { body: { content, ...(videoId ? { video_id: videoId } : {}) } }),
  dynamicDelete: (id: string) => req<{ success?: boolean }>(`/api/dynamics/${Q(id)}`, { method: 'DELETE' }),
  dynamicLike: (id: string) => req<{ liked: boolean; like_count?: number }>(`/api/dynamics/${Q(id)}/like`, { method: 'POST' }),
  followingFeed: (limit = 20, offset = 0) =>
    req<Post[] | { items: (Post & { follow_user?: User; video?: Video | null })[]; total?: number }>(`/api/feed/following?limit=${limit}&offset=${offset}`),

  // ============ 专栏 ============
  homeArticles: (limit = 8) => req<Article[]>(`/api/articles?limit=${limit}`),
  articlePost: (title: string, content: string, images: File[], coverIndex = 0, cover?: File | null) => {
    const fd = new FormData();
    fd.append('title', title);
    fd.append('content', content);
    images.forEach((img) => fd.append('images', img));
    if (cover) fd.append('cover', cover);
    if (coverIndex >= 0) fd.append('cover_index', String(coverIndex));
    return req<Article | { id?: string; pending_review?: boolean }>(`/api/articles`, { formData: fd });
  },
  articleDetail: (id: string) => req<Article>(`/api/articles/${Q(id)}`),
  articleEdit: (id: string, title: string, content: string, images: File[], coverIndex = -1, cover?: File | null) => {
    const fd = new FormData();
    fd.append('title', title);
    fd.append('content', content);
    images.forEach((img) => fd.append('images', img));
    if (coverIndex >= 0) fd.append('cover_index', String(coverIndex));
    if (cover) fd.append('cover', cover);
    return req<Article | { id?: string }>(`/api/articles/${Q(id)}`, { method: 'PUT', formData: fd });
  },
  articleDelete: (id: string) => req<{ success?: boolean }>(`/api/articles/${Q(id)}`, { method: 'DELETE' }),

  // ============ 公告 ============
  announcements: (limit = 20) => req<Announcement[]>(`/api/announcements?limit=${limit}`),
  announcementsAll: (limit = 50) => req<Announcement[]>(`/api/announcements/all?limit=${limit}`),
  announcementRead: (id?: string) => req<{ success?: boolean }>(`/api/announcements/read`, { body: id ? { id } : {} }),

  // ============ 公投 ============
  referendums: (limit = 20) => req<Referendum[]>(`/api/referendums?limit=${limit}`),
  referendum: (id: string) => req<Referendum>(`/api/referendums/${Q(id)}`),
  referendumRespond: (id: string, optionId: string, textAnswer?: string) =>
    req<{ success?: boolean }>(`/api/referendums/${Q(id)}/responses`, { body: { option_id: optionId, ...(textAnswer ? { text_answer: textAnswer } : {}) } }),

  // ============ 积分 ============
  coins: () => req<CoinsInfo>(`/api/coins/balance`),
  checkin: () => req<{ success?: boolean; reward?: number }>('/api/coins/checkin', { method: 'POST' }),

  // ============ 消息 ============
  messagesSummary: () => req<{ totalUnread: number }>('/api/messages/summary'),
  inbox: () => req<InboxMessage[]>('/api/messages/inbox'),
  inboxRead: (id?: string) => req<{ success?: boolean }>('/api/messages/inbox/read', { method: 'POST', body: id ? { id } : {} }),
  conversations: () => req<Conversation[]>('/api/messages/conversations'),
  direct: (userId: string) => req<DirectThread>(`/api/messages/direct/${Q(userId)}`),
  directSend: (userId: string, content: string) => req<{ id?: string }>(`/api/messages/direct/${Q(userId)}`, { body: { content } }),
  directRead: (userId: string) => req<{ success?: boolean }>(`/api/messages/direct/${Q(userId)}/read`, { method: 'POST' }),
  notifications: (limit = 10) => req<NotificationItem[]>(`/api/notifications?limit=${limit}`),
  newConversation: (targetUsername: string) => {
    // 通过搜索定位可发起私信的用户
    return api.search(targetUsername).then((r) => r.users ?? []);
  },

  // ============ 工单 ============
  myTickets: () => req<Ticket[]>('/api/tickets'),
  ticketDetail: (id: string) => req<Ticket>(`/api/tickets/${Q(id)}`),
  ticketCreate: (subject: string, content: string, images: File[]) => {
    const fd = new FormData();
    fd.append('subject', subject);
    fd.append('content', content);
    images.forEach((img) => fd.append('images', img));
    return req<Ticket | { id?: string }>('/api/tickets', { formData: fd });
  },
  ticketReply: (id: string, content: string, images: File[]) => {
    const fd = new FormData();
    fd.append('content', content);
    images.forEach((img) => fd.append('images', img));
    return req<TicketMessage | { id?: string; image_urls?: string[] }>(`/api/tickets/${Q(id)}/reply`, { formData: fd });
  },
  ticketReopen: (id: string) => req<{ success?: boolean }>(`/api/tickets/${Q(id)}/reopen`, { method: 'POST' }),

  // ============ 认证 ============
  verificationStatus: () => req<{ latest_request?: VerificationRequest | null; requests?: VerificationRequest[] }>(`/api/verifications/me`),
  verificationApply: (body: {
    badge_type: string; org_type?: string; org_name?: string; eligibility_type?: string;
    external_platform?: string; follower_count?: number; reason?: string;
  }, materials: File[], certificationLetter?: File | null) => {
    const fd = new FormData();
    Object.entries(body).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') fd.append(k, String(v)); });
    materials.forEach((f) => fd.append('materials', f));
    if (certificationLetter) fd.append('certification_letter', certificationLetter);
    return req<VerificationRequest | { id?: string }>('/api/verifications', { formData: fd });
  },
  verificationDraft: (id: string, body: Record<string, string | number>, materials: File[], certificationLetter?: File | null) => {
    const fd = new FormData();
    Object.entries(body).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') fd.append(k, String(v)); });
    materials.forEach((f) => fd.append('materials', f));
    if (certificationLetter) fd.append('certification_letter', certificationLetter);
    return req<{ item?: VerificationRequest }>(`/api/verifications/${Q(id)}`, { method: 'PUT', formData: fd });
  },

  // ============ 会员 ============
  membership: () => req<Membership>('/api/membership'),
  membershipCheckout: (plan: string, paymentMethod: string) =>
    req<{ url?: string; session_id?: string; invoice_url?: string; [k: string]: unknown }>('/api/membership/checkout', {
      body: { plan, payment_method: paymentMethod },
    }),
  membershipCheckoutConfirm: (sessionId?: string) =>
    req<{ active?: boolean }>('/api/membership/checkout/confirm', { method: 'POST', body: sessionId ? { session_id: sessionId } : undefined }),
  membershipCheckoutCancel: () => req<unknown>('/api/membership/checkout/cancel', { method: 'POST' }),
  membershipPortal: () => req<{ url?: string }>('/api/membership/portal'),

  // ============ 分享 ============
  shorten: (url: string, targetType: string, targetId: string) =>
    req<{ short_url?: string }>(`/api/shorten`, { body: { url, target_type: targetType, target_id: targetId } }),
  shareTrack: (targetType: string, targetId: string, channel: string) =>
    req<{ success?: boolean }>(`/api/share/track`, { body: { target_type: targetType, target_id: targetId, channel } }),
  recommendNotInterested: (videoId: string) =>
    req<{ success?: boolean }>(`/api/recommend/not-interested`, { body: { video_id: videoId } }),

  // ============ 管理员 ============
  adminUsers: (q?: string, limit = 50, offset = 0) =>
    req<User[] | { items: User[]; total?: number; total_all?: number }>(`/api/admin/users?${q ? `q=${Q(q)}&` : ''}limit=${limit}&offset=${offset}`),
  adminUserStatus: (id: string, status: string, reason?: string) =>
    req<{ status: string; ban_reason?: string }>(`/api/admin/users/${Q(id)}/status`, { method: 'PUT', body: { status, ...(reason ? { reason } : {}) } }),
  adminUserRole: (id: string, role: string) =>
    req<{ role: string }>(`/api/admin/users/${Q(id)}/role`, { method: 'PUT', body: { role } }),
  adminUserPermissions: (id: string, permission: string, granted: boolean) =>
    req<{ permissions?: string[] }>(`/api/admin/users/${Q(id)}/permissions`, { method: 'PUT', body: { permission, granted } }),
  adminUserRemoveReviewer: (id: string) => req<{ success?: boolean }>(`/api/admin/users/${Q(id)}/content-review`, { method: 'DELETE' }),
  adminUserPurgeVideos: (id: string) => req<{ purged?: number }>(`/api/admin/users/${Q(id)}/videos/unapproved`, { method: 'DELETE' }),
  adminVideos: (limit = 50, offset = 0) => req<Video[] | { items: Video[]; total?: number }>(`/api/admin/videos?limit=${limit}&offset=${offset}`),
  adminVideoGeoBlock: (id: string, geoBlock: string | null) =>
    req<{ geo_block: string | null }>(`/api/admin/videos/${Q(id)}/geo-block`, { method: 'PUT', body: { geo_block: geoBlock } }),
  auditList: () => req<AuditItem[] | { items: AuditItem[]; total?: number }>(`/api/admin/audit/list`),
  auditClaim: (itemId: string, itemType: string) =>
    req<{ success?: boolean }>(`/api/admin/audit/claim`, { body: { item_id: itemId, item_type: itemType } }),
  auditDecide: (body: { item_id: string; item_type: string; status: string; reason?: string; geo_block?: string | null }) =>
    req<{ success?: boolean }>(`/api/admin/audit/review`, {
      body: {
        ...body,
        // 与官方实现一致：视频类型附带 video_id
        video_id: body.item_type === 'video' ? body.item_id : undefined,
      },
    }),
  auditReport: () => req<Record<string, unknown>>(`/api/admin/audit/report`),
  adminReports: () => req<ReportItem[] | { items: ReportItem[] }>(`/api/admin/reports`),
  reportReview: (id: string, action: string, note?: string) =>
    req<{ success?: boolean }>(`/api/admin/reports/${Q(id)}/review`, { method: 'POST', body: { action, ...(note ? { note } : {}) } }),
  commentsModeration: () => req<ModerationComment[] | { items: ModerationComment[] }>(`/api/admin/comments/moderation`),
  commentReview: (id: string, action: string, opinion?: string) =>
    req<{ success?: boolean }>(`/api/admin/comments/${Q(id)}/review`, { method: 'POST', body: { action, ...(opinion ? { opinion } : {}) } }),
  adminVerifications: () => req<VerificationRequest[] | { items: VerificationRequest[] }>(`/api/admin/verifications`),
  verificationDraftUpdate: (id: string, body: Record<string, string | number>) => {
    const fd = new FormData();
    Object.entries(body).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') fd.append(k, String(v)); });
    return req<{ item?: VerificationRequest }>(`/api/admin/verifications/${Q(id)}`, { method: 'PUT', formData: fd });
  },
  verificationReview: (id: string, action: string, note?: string, label?: string) =>
    req<{ success?: boolean }>(`/api/admin/verifications/${Q(id)}/review`, { method: 'POST', body: { action, ...(note ? { note } : {}), ...(label ? { label } : {}) } }),
  adminTickets: () => req<Ticket[] | { items: Ticket[] }>(`/api/admin/tickets`),
  adminTicketClaim: (id: string) => req<{ success?: boolean }>(`/api/admin/tickets/${Q(id)}/claim`, { method: 'POST' }),
  adminTicketReply: (id: string, content: string) => {
    const fd = new FormData();
    fd.append('content', content);
    return req<TicketMessage | { id?: string }>(`/api/admin/tickets/${Q(id)}/reply`, { formData: fd });
  },
  adminTicketClose: (id: string, note?: string) => req<{ success?: boolean }>(`/api/admin/tickets/${Q(id)}/close`, { method: 'POST', body: note ? { note } : {} }),
  adminTicketReopen: (id: string) => req<{ success?: boolean }>(`/api/admin/tickets/${Q(id)}/reopen`, { method: 'POST' }),
  adminAnnouncementCreate: (title: string, content: string, isActive = true) =>
    req<Announcement | { id?: string }>('/api/admin/announcements', { body: { title, content, is_active: isActive } }),
  adminAnnouncementUpdate: (id: string, body: { title?: string; content?: string; is_active?: boolean }) =>
    req<{ success?: boolean }>(`/api/admin/announcements/${Q(id)}`, { method: 'PUT', body }),
  adminAnnouncementDelete: (id: string) => req<{ success?: boolean }>(`/api/admin/announcements/${Q(id)}`, { method: 'DELETE' }),
  adminReferendums: () => req<Referendum[]>(`/api/admin/referendums`),
  adminReferendumCreate: (body: { title: string; description?: string; status?: string; allow_text?: boolean; options: { label: string }[] }) =>
    req<Referendum | { id?: string }>('/api/admin/referendums', { body }),
  adminReferendumUpdate: (id: string, body: Record<string, unknown>) => req<{ success?: boolean }>(`/api/admin/referendums/${Q(id)}`, { method: 'PUT', body }),
  adminReferendumResults: (id: string) =>
    req<{ referendum?: Record<string, unknown>; options?: { id?: string; label: string; vote_count: number }[]; text_responses?: { text?: string; username?: string; created_at?: string }[]; total?: number; [k: string]: unknown }>(`/api/admin/referendums/${Q(id)}/results`),
  adminReferendumExport: (id: string) => `/api/admin/referendums/${Q(id)}/export`,
  adminSendMessage: (userId: string, title: string, content: string, broadcast = false) =>
    req<{ sent?: boolean; broadcast?: boolean }>('/api/admin/messages/send', { body: { user_id: userId, title, content, broadcast } }),
};

async function binaryPut(path: string, file: Blob, contentType: string, errMsg: string): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': contentType };
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const r = await fetch(url(path), { method: 'POST', headers, credentials: 'include', body: file });
  if (!r.ok) {
    let d: Record<string, unknown> | null = null;
    try { d = (await r.json()) as Record<string, unknown>; } catch { /* ignore */ }
    throw new ApiError((d?.message as string) || errMsg, (d?.error as string) || String(r.status), r.status);
  }
}

function extOf(name: string): string {
  const m = name.match(/(\.[a-zA-Z0-9]{1,10})$/);
  return m ? m[1].toLowerCase() : '.mp4';
}

export { asArray };
