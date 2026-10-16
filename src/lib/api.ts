// Complete ZawaZawa API surface — every documented endpoint + discovered extras.
import { http, qs } from './http';
import type { ReqOpts } from './http';

/* ================= Auth ================= */
export const auth = {
  captchaConfig: () => http.get('/api/auth/captcha-config'),
  register: (b: { username: string; email: string; password: string; geetest?: string }, opts: ReqOpts = {}) =>
    http.post('/api/auth/register', b, opts),
  login: (b: { identifier: string; password: string; geetest?: string }, opts: ReqOpts = {}) =>
    http.post('/api/auth/login', b, opts),
  clientLogin: (b: { username: string; password: string }) => http.post('/login_api', b), // 免验证码客户端登录
  logout: () => http.post('/api/auth/logout'),
  me: () => http.get('/api/users/me'),
  // 邮箱验证（注册时已发送验证码，此处提交 code 完成验证）
  verifyEmail: (identifier: string, email: string, code: string, opts: ReqOpts = {}) =>
    http.post('/api/auth/verify-email', { identifier, email, code }, opts),
  // 忘记密码
  forgotSendCode: (email: string, opts: ReqOpts = {}) =>
    http.post('/api/auth/forgot-password/send-code', { email }, opts),
  forgotReset: (b: { email: string; code: string; password: string }) =>
    http.post('/api/auth/forgot-password', b),
  // 注销账号
  deactivate: (confirmed: boolean, confirmText: string) =>
    http.post('/api/auth/deactivate', { confirmed, confirmText }),
  deactivateConfirm: (code: string, opts: ReqOpts = {}) =>
    http.post('/api/auth/deactivate/confirm', { code }, opts),
  // GDPR 数据导出
  export: (opts: ReqOpts = {}) => http.get('/api/users/me/export', { raw: true, ...opts }),
};

/* ================= Users ================= */
export const users = {
  me: () => http.get('/api/users/me'),
  public: (id: string) => http.get(`/api/users/${id}`),
  updateUsername: (username: string) => http.put('/api/users/me/username', { username }),
  checkUsername: (username: string, excludeId?: string, registration = false) =>
    http.get(`/api/users/check-username${qs({ username, exclude_id: excludeId, registration })}`),
  updateBio: (bio: string) => http.put('/api/users/me/bio', { bio }),
  // follow
  follow: (id: string) => http.post(`/api/users/${id}/follow`),
  unfollow: (id: string) => http.delete(`/api/users/${id}/follow`),
  following: (limit = 20, offset = 0) => http.get(`/api/users/me/following${qs({ limit, offset })}`),
  followers: (limit = 20, offset = 0) => http.get(`/api/users/me/followers${qs({ limit, offset })}`),
  userFollowing: (id: string, limit = 20, offset = 0) => http.get(`/api/users/${id}/following${qs({ limit, offset })}`),
  userFollowers: (id: string, limit = 20, offset = 0) => http.get(`/api/users/${id}/followers${qs({ limit, offset })}`),
  followStatus: (id: string) => http.get(`/api/users/${id}/follow-status`),
  // block
  block: (id: string) => http.post(`/api/users/${id}/block`),
  unblock: (id: string) => http.delete(`/api/users/${id}/block`),
  blocks: (limit = 20, offset = 0) => http.get(`/api/users/me/blocks${qs({ limit, offset })}`),
  // content
  userVideos: (id: string, limit = 24, offset = 0) => http.get(`/api/users/${id}/videos${qs({ limit, offset })}`),
  userArticles: (id: string, limit = 24, offset = 0) => http.get(`/api/users/${id}/articles${qs({ limit, offset })}`),
  userPosts: (id: string, limit = 24, offset = 0) => http.get(`/api/users/${id}/posts${qs({ limit, offset })}`),
  meVideos: (limit = 24, offset = 0) => http.get(`/api/users/me/videos${qs({ limit, offset })}`),
  meArticles: (limit = 24, offset = 0) => http.get(`/api/users/me/articles${qs({ limit, offset })}`),
  mePosts: (limit = 24, offset = 0) => http.get(`/api/users/me/posts${qs({ limit, offset })}`),
  meFavorites: (limit = 24, offset = 0) => http.get(`/api/users/me/favorites${qs({ limit, offset })}`),
  meCollections: (limit = 50, offset = 0) => http.get(`/api/users/me/collections${qs({ limit, offset })}`),
  // following feed
  followingFeed: (limit = 20, offset = 0) => http.get(`/api/feed/following${qs({ limit, offset })}`),
};

/* ================= Videos ================= */
export const videos = {
  list: (p: { category?: string; sort?: string; limit?: number; offset?: number; exclude?: string } = {}) =>
    http.get(`/api/videos${qs(p)}`),
  trending: (p: { limit?: number; offset?: number } = {}) => http.get(`/api/videos/trending${qs(p)}`),
  detail: (id: string) => http.get(`/api/videos/${id}`),
  search: (q: string, limit = 30) => http.get(`/api/search${qs({ q, limit })}`),
  update: (id: string, b: { title?: string; description?: string; category?: string; source_url?: string }) =>
    http.put(`/api/videos/${id}`, b),
  remove: (id: string) => http.delete(`/api/videos/${id}`),
  recommend: (exclude?: string, limit = 12) => http.get(`/api/recommend${qs({ exclude, limit })}`),
  notInterested: (videoId: string) => http.post(`/api/recommend/not-interested`, { video_id: videoId }),
  // like / favorite / coin / confusion
  like: (id: string) => http.post(`/api/videos/${id}/like`),
  unlike: (id: string) => http.delete(`/api/videos/${id}/like`),
  liked: (id: string) => http.get(`/api/videos/${id}/liked`),
  favorite: (id: string) => http.post(`/api/videos/${id}/favorite`),
  unfavorite: (id: string) => http.delete(`/api/videos/${id}/favorite`),
  favorited: (id: string) => http.get(`/api/videos/${id}/favorited`),
  coin: (id: string) => http.post(`/api/videos/${id}/coin`),
  confusion: (id: string) => http.post(`/api/videos/${id}/confusion`),
  confused: (id: string) => http.get(`/api/videos/${id}/confused`),
  confusionBoard: (p: { page?: number; per_page?: number; range?: string; start?: string; end?: string } = {}) =>
    http.get(`/api/heyiwei${qs(p)}`),
  // watch
  watchReport: (id: string, watchSeconds: number, videoSeconds: number) =>
    http.post(`/api/videos/${id}/watch`, { watch_seconds: watchSeconds, video_seconds: videoSeconds }),
  // report (举报)
  report: (id: string, reason: string, details?: string) =>
    http.post(`/api/videos/${id}/report`, { reason, details }),
  // danmaku
  danmakuList: (id: string, limit = 200, offset = 0) => http.get(`/api/videos/${id}/danmaku${qs({ limit, offset })}`),
  danmakuSend: (id: string, b: { content: string; time_sec?: number; color?: string; mode?: string; fontsize?: number }) =>
    http.post(`/api/videos/${id}/danmaku`, b),
  danmakuXml: (id: string) => http.get(`/api/videos/${id}/danmaku.xml`),
  danmakuImport: (id: string, xml: string) =>
    http.post(`/api/videos/${id}/danmaku/import`, xml, { textType: 'application/xml' }),
  // subtitles
  subtitles: (id: string) => http.get(`/api/videos/${id}/subtitles`),
  subtitleUpload: (id: string, form: FormData) => http.post(`/api/videos/${id}/subtitles`, form, { form: true }),
  subtitleRemove: (id: string, subId: string) => http.delete(`/api/videos/${id}/subtitles/${subId}`),
  aiSubtitles: (id: string) => http.post(`/api/videos/${id}/ai-subtitles`),
  aiSubtitleStatus: (id: string) => http.get(`/api/videos/${id}/ai-subtitles/status`),
  // cover
  coverUpload: (id: string, form: FormData) => http.post(`/api/videos/${id}/cover`, form, { form: true }),
  coverUpdateKey: (id: string, coverKey: string) => http.post(`/api/videos/${id}/cover-update-key`, { cover_key: coverKey }),
  // reupload (替换视频源文件)
  reupload: (id: string, form: FormData) => http.post(`/api/videos/${id}/reupload`, form, { form: true }),
  // comments（列表/发布按父内容 ID；点赞/删除是扁平路由，仅按评论 ID）
  comments: (id: string, limit = 20, offset = 0) => http.get(`/api/videos/${id}/comments${qs({ limit, offset })}`),
  commentPost: (id: string, content: string, parentId?: string) =>
    http.post(`/api/videos/${id}/comments`, { content, parent_id: parentId }),
  commentLike: (commentId: string) => http.post(`/api/comments/${commentId}/like`),
  commentDelete: (commentId: string) => http.delete(`/api/content-comments/${commentId}`),
  // share / shorten
  shorten: (url: string, targetType: string, targetId: string) =>
    http.post('/api/shorten', { url, target_type: targetType, target_id: targetId }),
  shareTrack: (targetType: string, targetId: string, channel: string) =>
    http.post('/api/share/track', { target_type: targetType, target_id: targetId, channel }),
};

/* ================= Upload ================= */
export const upload = {
  checkHash: (hash: string) => http.post('/api/videos/upload/check-hash', { hash }),
  init: (b: { filename: string; contentType: string; direct?: boolean }) =>
    http.post('/api/videos/upload/init', b),
  presignPart: (key: string, uploadId: string, partNumber: number) =>
    http.get(`/api/videos/upload/presign-part${qs({ key, uploadId, partNumber })}`),
  presignSingle: (b: { filename: string; contentType: string }) =>
    http.post('/api/videos/upload/presign-single', b),
  complete: (b: {
    uploadId: string; key: string; videoId: string;
    parts: { PartNumber: number; ETag: string }[];
    title: string; description?: string; category?: string; source_url?: string; file_hash?: string;
  }) => http.post('/api/videos/upload/complete', b),
  cancel: (uploadId: string) => http.post('/api/videos/upload/cancel', { uploadId }),
  finalize: (b: Record<string, any>) => http.post('/api/videos/upload/finalize', b),
  /** proxy PUT — 服务端代传（S3 直传 CORS 失败时的兜底） */
  proxyPut: (key: string, blob: Blob | File, contentType: string) =>
    fetch(`/api/videos/upload/proxy-put${qs({ key })}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': contentType || 'application/octet-stream' },
      body: blob,
    }).then(r => r.ok ? r.json().catch(() => ({})) : Promise.reject(new Error(`proxy-put failed: ${r.status}`))),
  quickImport: (b: { source_url: string; category?: string; title?: string }) =>
    http.post('/api/videos/quick-import', b),
  /** PUT 分片/整文件到预签名 URL，返回 ETag */
  putToPresigned: async (url: string, blob: Blob, signal?: AbortSignal): Promise<string> => {
    const res = await fetch(url, { method: 'PUT', body: blob, signal });
    if (!res.ok) throw new Error(`presigned PUT failed: ${res.status}`);
    return (res.headers.get('ETag') || res.headers.get('etag') || '').replace(/"/g, '') || '';
  },
};

/* ================= Articles ================= */
export const articles = {
  homeLatest: (limit = 4) => http.get(`/api/articles${qs({ limit })}`),
  detail: (id: string) => http.get(`/api/articles/${id}`),
  create: (form: FormData) => http.post('/api/articles', form, { form: true }),
  edit: (id: string, form: FormData) => http.put(`/api/articles/${id}`, form, { form: true }),
  remove: (id: string) => http.delete(`/api/articles/${id}`),
  comments: (id: string, limit = 20, offset = 0) => http.get(`/api/articles/${id}/comments${qs({ limit, offset })}`),
  commentPost: (id: string, content: string, parentId?: string) =>
    http.post(`/api/articles/${id}/comments`, { content, parent_id: parentId }),
  commentLike: (commentId: string) => http.post(`/api/comments/${commentId}/like`),
  commentDelete: (commentId: string) => http.delete(`/api/content-comments/${commentId}`),
};

/* ================= Posts (动态) ================= */
export const posts = {
  create: (b: { content: string; image_urls?: string[] }) => http.post('/api/dynamics', b),
  list: (limit = 20, offset = 0) => http.get(`/api/dynamics${qs({ limit, offset })}`),
  userList: (id: string, limit = 20, offset = 0) => http.get(`/api/users/${id}/dynamics${qs({ limit, offset })}`),
  remove: (id: string) => http.delete(`/api/dynamics/${id}`),
  like: (id: string) => http.post(`/api/dynamics/${id}/like`),
  comments: (id: string, limit = 20, offset = 0) => http.get(`/api/dynamics/${id}/comments${qs({ limit, offset })}`),
  commentPost: (id: string, content: string) => http.post(`/api/dynamics/${id}/comments`, { content }),
};

/* ================= Collections (合集) ================= */
export const collections = {
  create: (b: { title: string; description?: string }) => http.post('/api/collections', b),
  detail: (id: string) => http.get(`/api/collections/${id}`),
  update: (id: string, b: { title?: string; description?: string }) => http.put(`/api/collections/${id}`, b),
  remove: (id: string) => http.delete(`/api/collections/${id}`),
  addItem: (id: string, b: { video_id: string; part_title?: string; sort_order?: number }) =>
    http.post(`/api/collections/${id}/items`, b),
  removeItem: (id: string, itemId: string) => http.delete(`/api/collections/${id}/items/${itemId}`),
  reorder: (id: string, items: { video_id: string; sort_order: number }[]) =>
    http.put(`/api/collections/${id}/items`, { items }),
};

/* ================= Comments (shared / translate) ================= */
export const comments = {
  translate: (text: string, targetLang = 'en') => http.post('/api/comments/translate', { text, target_lang: targetLang }),
};

/* ================= Announcements ================= */
export const announcements = {
  unread: (limit = 10) => http.get(`/api/announcements${qs({ limit })}`),
  all: (limit = 20) => http.get(`/api/announcements/all${qs({ limit })}`),
  markRead: (id?: string) => http.post('/api/announcements/read', id ? { id } : {}),
};

/* ================= Referendums (公投) ================= */
export const referendums = {
  active: () => http.get('/api/referendums'),
  detail: (id: string) => http.get(`/api/referendums/${id}`),
  respond: (id: string, b: { option_id: string; text_answer?: string }) =>
    http.post(`/api/referendums/${id}/responses`, b),
};

/* ================= Coins (积分) ================= */
export const coins = {
  balance: () => http.get('/api/coins/balance'),
  checkin: () => http.post('/api/coins/checkin'),
};

/* ================= History (观看历史) ================= */
export const history = {
  list: (limit = 24, offset = 0) => http.get(`/api/users/me/history${qs({ limit, offset })}`),
  clear: () => http.delete('/api/users/me/history'),
  removeEntry: (historyId: string) => http.delete(`/api/users/me/history/${historyId}`),
  settings: (enabled: boolean) => http.put('/api/users/me/history/settings', { enabled }),
};

/* ================= Messages ================= */
export const messages = {
  summary: () => http.get('/api/messages/summary'),
  inbox: (limit = 30, offset = 0) => http.get(`/api/messages/inbox${qs({ limit, offset })}`),
  inboxRead: (id?: string) => http.post('/api/messages/inbox/read', id ? { id } : {}),
  // 私信
  conversations: (limit = 30) => http.get(`/api/messages/conversations${qs({ limit })}`),
  direct: (userId: string, limit = 50) => http.get(`/api/messages/direct/${userId}${qs({ limit })}`),
  directSend: (userId: string, content: string) => http.post(`/api/messages/direct/${userId}`, { content }),
  directRead: (userId: string) => http.post(`/api/messages/direct/${userId}/read`),
  // 通知
  notifications: (limit = 10) => http.get(`/api/notifications${qs({ limit })}`),
  // 工单
  tickets: (limit = 20, offset = 0) => http.get(`/api/tickets${qs({ limit, offset })}`),
  ticket: (id: string) => http.get(`/api/tickets/${id}`),
  ticketCreate: (b: { subject: string; content: string }) => http.post('/api/tickets', b),
  ticketReply: (id: string, form: FormData) => http.post(`/api/tickets/${id}/reply`, form, { form: true }),
  ticketReopen: (id: string) => http.post(`/api/tickets/${id}/reopen`),
};

/* ================= Verification (认证) ================= */
export const verifications = {
  me: () => http.get('/api/verifications/me'),
  apply: (form: FormData) => http.post('/api/verifications', form, { form: true }),
  updateDraft: (id: string, form: FormData) => http.put(`/api/verifications/${id}`, form, { form: true }),
};

/* ================= Legal ================= */
export const legal = {
  doc: (type: 'tos' | 'privacy' | string) => http.get(`/api/legal/${type}`),
};

/* ================= Membership (会员 / Pink V) ================= */
export const membership = {
  status: () => http.get('/api/membership'),
  checkout: (plan: string, paymentMethod: string) => http.post('/api/membership/checkout', { plan, payment_method: paymentMethod }),
  checkoutCancel: (sessionId: string) => http.post('/api/membership/checkout/cancel', { session_id: sessionId }),
  checkoutConfirm: (sessionId: string) => http.post('/api/membership/checkout/confirm', { session_id: sessionId }),
  portal: () => http.post('/api/membership/portal'),
};

/* ================= Admin ================= */
export const admin = {
  // users
  users: (p: { search?: string; status?: string; role?: string; limit?: number; offset?: number } = {}) =>
    http.get(`/api/admin/users${qs(p)}`),
  userStatus: (id: string, status: string, reason?: string) =>
    http.put(`/api/admin/users/${id}/status`, { status, reason }),
  userRole: (id: string, role: string) => http.put(`/api/admin/users/${id}/role`, { role }),
  userPermissions: (id: string, permission: string, granted: boolean) =>
    http.put(`/api/admin/users/${id}/permissions`, { permission, granted }),
  removeContentReviewer: (id: string) => http.delete(`/api/admin/users/${id}/content-reviewer`),
  purgeUserFailedVideos: (id: string) => http.post(`/api/admin/users/${id}/purge-failed-videos`),
  // videos
  videos: (p: { status?: string; search?: string; limit?: number; offset?: number } = {}) =>
    http.get(`/api/admin/videos${qs(p)}`),
  geoBlock: (id: string, geoBlock: string | null) => http.put(`/api/admin/videos/${id}/geo-block`, { geo_block: geoBlock }),
  coversMissing: (limit = 50) => http.get(`/api/admin/covers/missing${qs({ limit })}`),
  coverSync: (id: string) => http.post(`/api/admin/videos/${id}/cover-sync`),
  // audit
  auditList: (p: { status?: string; limit?: number; offset?: number } = {}) =>
    http.get(`/api/admin/audit/list${qs(p)}`),
  auditClaim: (b: { item_id: string; item_type: string }) => http.post('/api/admin/audit/claim', b),
  auditReview: (b: { item_id: string; item_type: string; video_id?: string; status: 'approved' | 'rejected'; reason?: string; geo_block?: string | null }) =>
    http.post('/api/admin/audit/review', b),
  auditReport: () => http.get('/api/admin/audit/report'),
  // reports (举报)
  reports: (p: { status?: string; limit?: number; offset?: number } = {}) =>
    http.get(`/api/admin/reports${qs(p)}`),
  reportReview: (id: string, b: { action: string; note?: string }) =>
    http.post(`/api/admin/reports/${id}/review`, b),
  // comment moderation
  commentsPending: (limit = 50, offset = 0) => http.get(`/api/admin/comments/moderation${qs({ limit, offset })}`),
  commentReview: (id: string, b: { action: string; opinion?: string }) =>
    http.post(`/api/admin/comments/${id}/review`, b),
  // verification reviews
  verifications: (limit = 50, offset = 0) => http.get(`/api/admin/verifications${qs({ limit, offset })}`),
  verificationUpdate: (id: string, form: FormData) => http.put(`/api/admin/verifications/${id}`, form, { form: true }),
  verificationReview: (id: string, b: { action: string; note?: string; label?: string }) =>
    http.post(`/api/admin/verifications/${id}/review`, b),
  // tickets
  tickets: (p: { status?: string; limit?: number; offset?: number } = {}) =>
    http.get(`/api/admin/tickets${qs(p)}`),
  ticket: (id: string) => http.get(`/api/admin/tickets/${id}`),
  ticketClaim: (id: string) => http.post(`/api/admin/tickets/${id}/claim`),
  ticketClose: (id: string, note?: string) => http.post(`/api/admin/tickets/${id}/close`, { note }),
  ticketReopen: (id: string) => http.post(`/api/admin/tickets/${id}/reopen`),
  ticketReply: (id: string, form: FormData) => http.post(`/api/admin/tickets/${id}/reply`, form, { form: true }),
  // announcements (admin)
  announcementsAll: (limit = 50) => http.get(`/api/admin/announcements${qs({ limit })}`),
  announcementCreate: (b: { title: string; content: string; is_active?: boolean }) =>
    http.post('/api/admin/announcements', b),
  announcementUpdate: (id: string, b: { title?: string; content?: string; is_active?: boolean }) =>
    http.put(`/api/admin/announcements/${id}`, b),
  announcementDelete: (id: string) => http.delete(`/api/admin/announcements/${id}`),
  // referendums (admin)
  referendumsAll: (limit = 50) => http.get(`/api/admin/referendums${qs({ limit })}`),
  referendumCreate: (b: { title: string; description?: string; status?: string; allow_text?: boolean; options: { label: string; text?: string }[] }) =>
    http.post('/api/admin/referendums', b),
  referendumUpdate: (id: string, b: any) => http.put(`/api/admin/referendums/${id}`, b),
  referendumResults: (id: string) => http.get(`/api/admin/referendums/${id}/results`),
  referendumExport: (id: string) => `/api/admin/referendums/${id}/export`, // 直接 <a href> 下载 CSV
  // messages (admin)
  sendMessage: (b: { user_id: string; title: string; content: string; broadcast?: boolean }) =>
    http.post('/api/admin/messages/send', b),
};
