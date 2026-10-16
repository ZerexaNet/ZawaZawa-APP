import React, { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { useToast } from '../store/toast';
import { I } from './icons';
import { Avatar, IconBtn, Menu, Dialog, ConfirmHost, ToastHost, Loading } from './ui';
import { announcements, messages } from '../lib/api';
import type { Announcement, Notification } from '../lib/types';
import { timeAgo } from '../lib/util';

const NOTIF_ICONS: Record<string, string> = {
  follow: 'userPlus', like: 'heart', favorite: 'bookmark', coin: 'coin',
  comment: 'message', reply: 'reply', mention: 'reply', share: 'share',
  article: 'newspaper', ticket: 'ticket', verification: 'award', report: 'flag',
  audit: 'shield', system: 'info',
};

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, loading, bootstrap, logout, msgUnread, refreshUnread } = useAuth();
  const toast = useToast(s => s.push);
  const nav = useNavigate();
  const loc = useLocation();
  const [q, setQ] = useState('');

  /* 通知 */
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const openNotif = useCallback(async () => {
    setNotifOpen(true);
    setNotifLoading(true);
    try {
      const d: any = await messages.notifications(15);
      const items: Notification[] = Array.isArray(d) ? d : d?.items || [];
      setNotifs(items);
      refreshUnread();
    } catch { /* ignore */ } finally { setNotifLoading(false); }
  }, [refreshUnread]);
  const onNotifClick = (n: Notification) => {
    setNotifOpen(false);
    if (n.related_content_type === 'video' && n.related_video_id) nav(`/video/${n.related_video_id}`);
    else if (n.related_content_type === 'article') nav(`/article/${n.related_video_id}`);
    else if (n.related_user?.username) nav(`/user/${n.related_user.id || n.related_user.username}`);
    else nav('/messages');
  };

  /* 公告 */
  const [announce, setAnnounce] = useState<Announcement[]>([]);
  const [announceOpen, setAnnounceOpen] = useState(false);
  useEffect(() => {
    announcements.unread(5).then((d: any) => {
      const items = Array.isArray(d) ? d : d?.items || [];
      if (items.length) { setAnnounce(items); setAnnounceOpen(true); }
    }).catch(() => { });
  }, []);

  /* 登录态引导 */
  useEffect(() => { bootstrap(); }, [bootstrap]);

  /* 移动端底部导航 */
  const bnItems = [
    { to: '/', icon: 'home', label: '首页' },
    { to: '/trending', icon: 'flame', label: '热门' },
    { to: '/upload', icon: 'upload', label: '发布', fab: !!user },
    { to: '/messages', icon: 'message', label: '消息', badge: msgUnread },
    { to: user ? '/me' : '/login', icon: 'user', label: '我的' },
  ];

  /* 桌面侧栏 */
  const railItems = [
    { to: '/', icon: 'home', label: '首页' },
    { to: '/trending', icon: 'flame', label: '热门' },
    { to: '/referendums', icon: 'poll', label: '公投' },
    { to: '/confusion', icon: 'question', label: '何意味' },
    { to: '/membership', icon: 'crown', label: '会员' },
  ];

  return (
    <div className="app">
      {/* ===== 顶栏（液态玻璃） ===== */}
      <header className="appbar" style={{ marginLeft: loc.pathname.startsWith('/admin') ? 0 : undefined }}>
        <Link className="appbar-brand" to="/">
          <span className="brand-logo">Z</span>
          <span className="clamp1">ZawaZawa</span>
        </Link>
        <form
          className="appbar-search"
          onSubmit={e => {
            e.preventDefault();
            if (q.trim()) { nav(`/search?q=${encodeURIComponent(q.trim())}`); }
          }}
          style={{ display: 'none' }}
        >
          <I className="search-icon" name="search" size={18} />
          <input
            placeholder="搜索视频、用户…"
            value={q}
            onChange={e => setQ(e.target.value)}
            style={{
              width: '100%', height: 40, borderRadius: 999,
              border: '1px solid var(--md-outline-variant)',
              background: 'var(--glass-1)', padding: '0 16px 0 40px',
              color: 'var(--md-on-surface)',
            }}
          />
        </form>
        <span className="spacer" />
        {user ? (
          <>
            <IconBtn name="search" label="搜索" onClick={() => nav('/search')} />
            <div style={{ position: 'relative' }}>
              <IconBtn name="bell" label="通知" onClick={openNotif} />
            </div>
            <IconBtn name="message" label="消息" onClick={() => nav('/messages')}>
              {msgUnread > 0 && <span className="badge-dot">{msgUnread > 99 ? '99+' : msgUnread}</span>}
            </IconBtn>
            <Menu
              trigger={
                <span className="row" style={{ cursor: 'pointer', gap: 8 }} onClick={e => e.stopPropagation()}>
                  <Avatar user={user} size={34} />
                </span>
              }
              items={[
                { label: user.username, icon: 'user', onClick: () => nav('/me') },
                { label: '我的主页', icon: 'film', onClick: () => nav(`/user/${user.id}`) },
                { label: '观看历史', icon: 'history', onClick: () => nav('/history') },
                { label: '我的收藏', icon: 'bookmark', onClick: () => nav('/favorites') },
                { label: '我的合集', icon: 'folder', onClick: () => nav('/collections') },
                { label: '发动态', icon: 'send', onClick: () => nav('/post-new') },
                { label: '写专栏', icon: 'newspaper', onClick: () => nav('/upload?article=new') },
                { label: '会员', icon: 'crown', onClick: () => nav('/membership') },
                { label: '认证', icon: 'award', onClick: () => nav('/verification') },
                ...(user.role && ['admin', 'video_moderation', 'content_review'].includes(user.role)
                  ? [{ label: '管理后台', icon: 'shield', onClick: () => nav('/admin') }]
                  : []),
                'sep',
                { label: '退出登录', icon: 'logout', danger: true, onClick: async () => { await logout(); toast('已退出登录', 'info'); nav('/'); } },
              ]}
            />
          </>
        ) : (
          <Link to="/login" className="btn btn--tonal btn--sm">登录</Link>
        )}
      </header>

      {/* ===== 桌面侧栏 ===== */}
      <nav className="navrail">
        {railItems.map(it => (
          <NavLink key={it.to} to={it.to} end={it.to === '/'} className={({ isActive }) => `nr-item ${isActive ? 'active' : ''}`}>
            <I name={it.icon} size={22} />
            <span className="nr-label">{it.label}</span>
          </NavLink>
        ))}
        <div className="nr-sep" />
        {user && (
          <>
            <NavLink to="/upload" className={({ isActive }) => `nr-item ${isActive ? 'active' : ''}`}>
              <I name="upload" size={22} />
              <span className="nr-label">发布</span>
            </NavLink>
            <NavLink to="/following" className={({ isActive }) => `nr-item ${isActive ? 'active' : ''}`}>
              <I name="users" size={22} />
              <span className="nr-label">关注流</span>
            </NavLink>
          </>
        )}
      </nav>

      {/* ===== 主内容 ===== */}
      <main className="app-main">{children}</main>

      {/* ===== 页脚 ===== */}
      <footer className="footer">
        <div className="f-links">
          <Link to="/legal/tos">服务条款</Link>
          <Link to="/legal/privacy">隐私政策</Link>
          <Link to="/referendums">社区公投</Link>
          <a href="https://www.zawa.uk" target="_blank" rel="noreferrer">官网</a>
        </div>
        <div>ZawaZawa 客户端 · Google M3 + Liquid Glass · 基于 ZawaZawa 开放 API</div>
      </footer>

      {/* ===== 移动端底部导航 ===== */}
      <nav className="bottomnav">
        {bnItems.map(it => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.to === '/'}
            className={({ isActive }) => `bn-item ${isActive ? 'active' : ''}`}
            style={it.fab ? { display: 'grid', placeItems: 'center' } : undefined}
          >
            {it.fab ? (
              <span className="bn-fab" onClick={e => { if (!user) { e.preventDefault(); nav('/login'); } }}><I name="plus" size={26} /></span>
            ) : (
              <>
                <span className="bn-pill" />
                <span style={{ position: 'relative' }}><I name={it.icon} size={22} />
                  {(it as any).badge ? <span className="badge-dot" style={{ border: 'none' }}>{(it as any).badge > 99 ? '99+' : (it as any).badge}</span> : null}
                </span>
                <span className="bn-label">{it.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ===== 通知弹层 ===== */}
      <Dialog open={notifOpen} onClose={() => setNotifOpen(false)} title="通知" className="notif-panel">
        {notifLoading ? <Loading /> : notifs.length === 0 ? (
          <div className="empty" style={{ padding: '24px' }}><I name="bell" size={24} className="muted" /><span className="muted">暂无通知</span></div>
        ) : (
          notifs.map((n, i) => (
            <div key={n.id || i} className={`notif-item ${!n.is_read ? 'unread' : ''}`} onClick={() => onNotifClick(n)}>
              <span className="n-ic"><I name={NOTIF_ICONS[n.type || ''] || 'info'} size={17} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="n-t clamp2">{n.content}</div>
                <div className="n-time">{timeAgo(n.created_at)}</div>
              </div>
            </div>
          ))
        )}
      </Dialog>

      {/* ===== 公告弹窗 ===== */}
      <Dialog
        open={announceOpen}
        onClose={() => setAnnounceOpen(false)}
        title={<span className="row" style={{ gap: 8 }}><I name="megaphone" size={18} /> 平台公告</span>}
        actions={<button className="btn btn--filled" onClick={() => { setAnnounceOpen(false); announcements.markRead().catch(() => { }); }}>我知道了</button>}
      >
        <div className="announce-list">
          {announce.map(a => (
            <div className="announce-item card" key={a.id}>
              <div className="a-title">{a.title}</div>
              <div className="a-body">{a.content}</div>
            </div>
          ))}
        </div>
      </Dialog>

      <ToastHost />
      <ConfirmHost />
      {loading && !user && null}
    </div>
  );
}
