import { create } from 'zustand';
import { auth, users, messages } from '../lib/api';
import type { User } from '../lib/types';
import { goto } from '../lib/util';

interface AuthState {
  user: User | null;
  loading: boolean;
  banned: boolean;
  msgUnread: number;
  setBanned: (b: boolean) => void;
  setMsgUnread: (n: number) => void;
  refreshUnread: () => Promise<void>;
  bootstrap: () => Promise<void>;
  setUser: (u: User | null) => void;
  login: (identifier: string, password: string, geetest?: string, turnstileToken?: string) => Promise<User>;
  logout: () => Promise<void>;
}

const LS_USER = 'zzw:user';

function readCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(LS_USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const useAuth = create<AuthState>((set, get) => ({
  user: readCachedUser(),
  loading: true,
  banned: false,
  msgUnread: 0,
  setBanned: b => set({ banned: b }),
  setMsgUnread: n => set({ msgUnread: n }),
  refreshUnread: async () => {
    try {
      const s: any = await messages.summary();
      const n = Number(s?.totalUnread ?? s?.total_unread ?? 0);
      set({ msgUnread: n });
    } catch { /* ignore */ }
  },
  bootstrap: async () => {
    try {
      const u: any = await users.me();
      const user = u?.user ?? u;
      set({ user, loading: false });
      if (user) {
        localStorage.setItem(LS_USER, JSON.stringify(user));
        get().refreshUnread();
        // 定期刷新未读数（浏览器 setInterval 返回 number，必须用 clearInterval）
        if ((get() as any)._timer) { clearInterval((get() as any)._timer); (get() as any)._timer = 0; }
        (get() as any)._timer = window.setInterval(() => {
          if (!document.hidden) get().refreshUnread();
        }, 60000);
      }
    } catch (e: any) {
      if (e?.status === 401 || e?.status === 0) {
        set({ user: null, loading: false });
        localStorage.removeItem(LS_USER);
      } else {
        set({ loading: false });
      }
    }
  },
  setUser: u => {
    set({ user: u });
    if (u) localStorage.setItem(LS_USER, JSON.stringify(u));
    else localStorage.removeItem(LS_USER);
  },
  login: async (identifier, password, geetest, turnstileToken) => {
    const opts: any = {};
    if (turnstileToken) opts.captchaToken = turnstileToken;
    const r: any = await auth.login({ identifier, password, geetest }, opts);
    const user = r?.user ?? r?.data;
    if (!user) throw new Error('登录响应缺少用户信息');
    get().setUser(user);
    await get().refreshUnread();
    return user;
  },
  logout: async () => {
    try { await auth.logout(); } catch { /* ignore */ }
    if ((get() as any)._timer) { clearInterval((get() as any)._timer); (get() as any)._timer = 0; }
    set({ user: null, msgUnread: 0 });
    localStorage.removeItem(LS_USER);
  },
}));

// 全局 401 / 403 拦截
// 注意：Electron file:// 下 location.href='/login' 会变成 file:///login，必须走 goto()
const onLoginPage = () =>
  window.location.protocol === 'file:'
    ? location.hash.startsWith('#/login')
    : ['/login', '/register'].includes(location.pathname);

window.addEventListener('zzw:unauthorized', () => {
  const st = useAuth.getState();
  if (st.user) {
    st.setUser(null);
    if (!onLoginPage()) {
      goto('/login?next=' + encodeURIComponent(location.pathname + location.search));
    }
  }
});
window.addEventListener('zzw:banned', () => {
  useAuth.getState().setBanned(true);
  useAuth.getState().setUser(null);
  if (!onLoginPage()) {
    goto('/login?authError=' + encodeURIComponent('账号已被封禁'));
  }
});
