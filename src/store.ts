import { create } from 'zustand';
import type { User } from './types';
import { setToken, onAuthError, api } from './api';

const USER_KEY = 'zawa_user';

interface AuthState {
  user: User | null;
  loading: boolean;
  authMsg: string | null;
  setUser: (u: User | null) => void;
  bootstrap: () => Promise<void>;
  logout: (silent?: boolean) => Promise<void>;
  clearAuthMsg: () => void;
  isAdmin: () => boolean;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: (() => {
    try {
      const raw = sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  })(),
  loading: false,
  authMsg: null,
  setUser: (u) => {
    set({ user: u });
    try {
      if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
      else {
        localStorage.removeItem(USER_KEY);
        sessionStorage.removeItem(USER_KEY);
      }
    } catch { /* ignore */ }
  },
  bootstrap: async () => {
    if (!get().user) return;
    set({ loading: true });
    try {
      const u = await api.me();
      get().setUser(u);
    } catch {
      // 401 已由 onAuthError 处理
    } finally {
      set({ loading: false });
    }
  },
  logout: async (silent) => {
    try { await api.logout(); } catch { /* ignore */ }
    setToken(null);
    get().setUser(null);
    if (!silent) window.dispatchEvent(new CustomEvent('zawa:logout'));
  },
  clearAuthMsg: () => set({ authMsg: null }),
  isAdmin: () => {
    const r = String(get().user?.role || '');
    return ['admin', 'video_moderation', 'content_review'].includes(r);
  },
}));

onAuthError((msg) => {
  const { user, setUser, logout } = useAuth.getState();
  if (user) {
    setUser(null);
    void logout(true);
  }
  useAuth.setState({ authMsg: msg });
});

// ============ Toast ============
interface ToastItem { id: number; text: string; kind: 'ok' | 'err' }
interface ToastState {
  toasts: ToastItem[];
  push: (text: string, kind?: 'ok' | 'err') => void;
  remove: (id: number) => void;
}

let toastId = 1;
export const useToast = create<ToastState>((set) => ({
  toasts: [],
  push: (text, kind = 'ok') => {
    const id = toastId++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, kind }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3200);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function toast(text: string, kind: 'ok' | 'err' = 'ok') {
  useToast.getState().push(text, kind);
}

export function errMsg(e: unknown, fallback = '操作失败'): string {
  if (e && typeof e === 'object') {
    const o = e as { message?: string; code?: string };
    if (o.message) {
      const known: Record<string, string> = {
        video_not_found: '视频不存在',
        video_moderation: '视频正在审核',
        account_not_found: '账号不存在',
        account_banned: '账号已被封禁',
        email_verification_required: '请先完成邮箱验证',
        video_not_owned: '无权操作该视频',
        title_required: '标题不能为空',
        source_url_required: '请提供视频来源链接',
        invalid_code: '验证码不正确',
        geetest_verification_failed: '人机验证失败，请重试',
        turnstile_verification_failed: '人机验证失败，请重试',
        comment_too_long: '评论太长',
        content_required: '内容不能为空',
        message_too_long: '消息太长',
        message_content_required: '消息不能为空',
        ticket_content_required: '工单内容不能为空',
        ticket_not_owned: '无权操作该工单',
        already_ended: '投票已结束',
        not_logged_in: '请先登录',
        forbidden: '没有操作权限',
      };
      return known[o.code || ''] || o.message;
    }
  }
  return fallback;
}

// ============ 设置 ============
export type ThemeStyle = 'default' | 'metro' | 'material';
export const THEME_STYLES: { id: ThemeStyle; label: string }[] = [
  { id: 'default', label: '默认（官网）' },
  { id: 'metro', label: 'Win8 磁贴' },
  { id: 'material', label: 'Material 3' },
];

interface SettingsState {
  theme: 'light' | 'dark';
  style: ThemeStyle;
  setTheme: (t: 'light' | 'dark') => void;
  setStyle: (s: ThemeStyle) => void;
}

export const useSettings = create<SettingsState>((set) => ({
  theme: ((): 'light' | 'dark' => {
    const saved = localStorage.getItem('zawa_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  })(),
  style: ((): ThemeStyle => {
    const saved = localStorage.getItem('zawa_theme_style');
    if (saved === 'default' || saved === 'metro' || saved === 'material') return saved;
    return 'default';
  })(),
  setTheme: (t) => {
    set({ theme: t });
    localStorage.setItem('zawa_theme', t);
    applyTheme(t, useSettings.getState().style);
  },
  setStyle: (s) => {
    set({ style: s });
    localStorage.setItem('zawa_theme_style', s);
    applyTheme(useSettings.getState().theme, s);
  },
}));

export function applyTheme(theme: 'light' | 'dark', style: ThemeStyle = 'default') {
  document.documentElement.dataset.theme = theme;
  if (style === 'default') delete document.documentElement.dataset.themeStyle;
  else document.documentElement.dataset.themeStyle = style;
}

// ============ 公告 ============
interface AnnouncementState {
  seen: string[]; // 已读公告 id
  markSeen: (id: string) => void;
}

export const useAnnouncement = create<AnnouncementState>((set) => ({
  seen: JSON.parse(localStorage.getItem('zawa_ann_seen') || '[]'),
  markSeen: (id) =>
    set((s) => {
      const seen = s.seen.includes(id) ? s.seen : [...s.seen, id].slice(-20);
      localStorage.setItem('zawa_ann_seen', JSON.stringify(seen));
      return { seen };
    }),
}));
