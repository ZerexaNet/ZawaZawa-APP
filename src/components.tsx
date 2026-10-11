import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from './api';
import { errMsg, toast, useAnnouncement, useAuth, useSettings, THEME_STYLES } from './store';
import type { Comment, NotificationItem, Video, Announcement } from './types';
import { asArray } from './types';
import { fmtCount, timeAgo, gravatar, coverFallbacks } from './lib/utils';
import { I, type IconName } from './icons';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

export const Avatar = ({ name, size = 32, url, email }: { name: string; size?: number; url?: string; email?: string }) => (
  <img
    className="avatar"
    width={size} height={size}
    src={url || (email ? gravatar(email, size) : `https://www.gravatar.com/avatar/0?d=mp&s=${size}`)}
    alt={name}
    loading="lazy"
    referrerPolicy="no-referrer"
  />
);

export function VerBadge({ badge, label }: { badge?: string | null; label?: string | null }) {
  if (!badge || badge === 'none') return null;
  const cls = badge === 'blue' ? 'blue' : badge === 'green' ? 'green' : badge === 'yellow' ? 'yellow' : 'pink';
  return <span className={`badge-v ${cls}`} title={label || badge}>{label || (badge === 'blue' ? '蓝V' : badge === 'yellow' ? '黄V' : badge === 'pink' ? '粉V' : '认证')}</span>;
}

export function UserLink({ name, uid, badge, label, size = 20, url, email }: { name: string; uid?: string; badge?: string | null; label?: string | null; size?: number; url?: string; email?: string }) {
  return (
    <span className="flex" style={{ gap: 4, minWidth: 0 }}>
      <Avatar name={name} size={size} url={url} email={email} />
      {uid ? (
        <Link to={`/user/${uid}`} style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name} <VerBadge badge={badge} label={label} />
        </Link>
      ) : (
        <span style={{ fontSize: 13 }}>{name} <VerBadge badge={badge} label={label} /></span>
      )}
    </span>
  );
}

/** 封面：R2 直链优先，加载失败时自动逐档回退（最后兜底后端 S3 代理） */
export function Cover({ src, alt = '', className, style }: { src?: string | null; alt?: string; className?: string; style?: CSSProperties }) {
  const chain = useMemo(() => coverFallbacks(src || null), [src]);
  const [idx, setIdx] = useState(0);
  if (!chain.length) return null;
  return (
    <img
      src={chain[idx]}
      alt={alt}
      className={className}
      style={style}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setIdx((i) => (i < chain.length - 1 ? i + 1 : i))}
    />
  );
}

export function VideoCard({ v, compact }: { v: Video; compact?: boolean }) {
  const cover = v.cover_url || v.external_cover_url || '';
  return (
    <Link to={`/video/${v.id}`} className="vcard">
      <div className="cover">
        {cover ? <Cover src={cover} alt={v.title} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>暂无封面</div>}
        {v.duration ? <span className="dur">{Math.floor(v.duration / 60)}:{String(v.duration % 60).padStart(2, '0')}</span> : null}
        {v.status === 'pending_review' && <span style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(217,119,6,.9)', color: '#fff', fontSize: 11, padding: '1px 8px', borderRadius: 8 }}>审核中</span>}
      </div>
      <div className="meta">
        <div className="title">{v.title}</div>
        <div className="sub">
          <Avatar name={v.author_username || '匿名'} size={size_20} url={v.author_gravatar_url} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.author_username} <VerBadge badge={v.author_verification_badge} label={v.author_verification_label} /></span>
        </div>
        {!compact && (
          <div className="stats">
            <span><I name="play" size={13} filled /> {fmtCount(v.views)}</span>
            <span><I name="heart" size={13} filled /> {fmtCount(v.likes)}</span>
            <span><I name="chat" size={13} /> {fmtCount((v as never as { comment_count?: number }).comment_count)}</span>
            {v.confusion_count ? <span><I name="help" size={13} /> {fmtCount(v.confusion_count)}</span> : null}
          </div>
        )}
      </div>
    </Link>
  );
}
const size_20 = 20;

export function Loading() { return <div className="spinner" />; }
export function Empty({ text = '空空如也', desc, icon = 'inbox' }: { text?: string; desc?: string; icon?: IconName }) {
  return <div className="empty"><div className="big" style={{ color: 'var(--ink-3)' }}><I name={icon} size={40} /></div>{text}{desc && <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>{desc}</div>}</div>;
}

export function Modal({ title, onClose, children, foot, wide }: { title: string; onClose: () => void; children: ReactNode; foot?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-mask" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={wide ? { maxWidth: 760 } : undefined}>
        <div className="modal-head">{title}<button className="modal-close" onClick={onClose}>×</button></div>
        <div className="modal-body">{children}</div>
        {foot && <div className="modal-foot">{foot}</div>}
      </div>
    </div>
  );
}

export function Confirm({ title = '确认操作？', text, onOk, onClose, danger, okText = '确认' }: { title?: string; text: string; onOk: () => void; onClose: () => void; danger?: boolean; okText?: string }) {
  return (
    <Modal title={title} onClose={onClose} foot={
      <>
        <button className="btn" onClick={onClose}>取消</button>
        <button className={'btn ' + (danger ? 'btn-danger' : 'btn-primary')} onClick={() => { onOk(); onClose(); }}>{okText}</button>
      </>
    }>
      <div style={{ fontSize: 14, color: 'var(--ink-2)' }}>{text}</div>
    </Modal>
  );
}

export function Markdown({ text }: { text: string }) {
  const html = useMemo(() => {
    const raw = marked.parse(text || '', { async: false }) as string;
    return DOMPurify.sanitize(raw, { ADD_ATTR: ['target'] });
  }, [text]);
  return <div className="md" dangerouslySetInnerHTML={{ __html: html }} />;
}

// ============ 顶栏 ============
export function TopBar() {
  const nav = useNavigate();
  const { user, logout } = useAuth();
  const { theme, setTheme, style, setStyle } = useSettings();
  const [q, setQ] = useState('');
  const [styleOpen, setStyleOpen] = useState(false);
  const styleRef = useRef<HTMLDivElement>(null);
  const [userMenu, setUserMenu] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [msgUnread, setMsgUnread] = useState(0);
  const [ann, setAnn] = useState<Announcement | null>(null);
  const { seen, markSeen } = useAnnouncement();
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const loadNotifs = () => {
    if (!user) return;
    api.notifications(10).then((d) => {
      const items = asArray<NotificationItem>(d);
      setNotifs(items);
      setUnread(items.filter((n) => !Number(n.is_read)).length);
    }).catch(() => {});
    api.messagesSummary().then((d) => setMsgUnread(d.totalUnread || 0)).catch(() => {});
  };

  useEffect(() => { loadNotifs(); }, [user?.id]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenu(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (styleRef.current && !styleRef.current.contains(e.target as Node)) setStyleOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // 公告弹窗（未读的第一条）
  useEffect(() => {
    if (!user) return;
    api.announcements(10).then((list) => {
      const active = list.filter((a) => a.is_active !== false && !seen.includes(a.id));
      if (active.length) setAnn(active[0]);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const submitSearch = () => {
    if (q.trim()) nav(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  const notifLink = (n: NotificationItem): string => {
    if (n.related_video_id) return `/video/${n.related_video_id}`;
    if (n.related_content_type === 'article' && n.related_article_id) return `/article/${(n as never as { related_article_id?: string }).related_article_id}`;
    if (n.related_user?.id) return `/user/${n.related_user.id}`;
    return '/messages';
  };

  return (
    <>
      <header className="topbar">
        <Link to="/" className="logo"><span className="dot" />ZawaZawa</Link>
        <div className="searchbox">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
            placeholder="搜索视频、用户…"
          />
          <button onClick={submitSearch}>搜索</button>
        </div>
        <div className="spacer" />
        <button className="btn btn-sm btn-ghost" title="主题" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          <I name={theme === 'dark' ? 'sun' : 'moon'} size={17} />
        </button>
        <div className="dropdown" ref={styleRef}>
          <button className="btn btn-sm btn-ghost" title="界面风格" onClick={() => setStyleOpen(!styleOpen)}>
            <I name="grid" size={17} />
          </button>
          {styleOpen && (
            <div className="dropdown-menu">
              {THEME_STYLES.map((s) => (
                <div
                  key={s.id}
                  className="dd-item"
                  style={style === s.id ? { color: 'var(--accent)' } : undefined}
                  onClick={() => { setStyle(s.id); setStyleOpen(false); }}
                >
                  <I name="check" size={14} style={{ visibility: style === s.id ? 'visible' : 'hidden' }} /> {s.label}
                </div>
              ))}
            </div>
          )}
        </div>
        {user ? (
          <>
            <button className="btn btn-sm btn-primary" onClick={() => nav('/upload')}><I name="upload" size={15} /> 投稿</button>
            <div className="dropdown" ref={notifRef}>
              <button className="btn btn-sm btn-ghost" onClick={() => { setNotifOpen(!notifOpen); loadNotifs(); }} style={{ position: 'relative' }}>
                <I name="bell" size={17} />{unread > 0 && <span style={{ position: 'absolute', top: -4, right: -4, background: 'var(--err)', color: '#fff', borderRadius: 10, fontSize: 10, padding: '0 5px' }}>{unread}</span>}
              </button>
              {notifOpen && (
                <div className="dropdown-menu" style={{ width: 320, maxHeight: 420, overflow: 'auto' }}>
                  <div style={{ padding: '10px 14px', fontWeight: 700, borderBottom: '1px solid var(--line)' }}>通知</div>
                  {notifs.length === 0 && <div style={{ padding: 16, color: 'var(--ink-3)', fontSize: 13 }}>暂无通知</div>}
                  {notifs.map((n) => (
                    <div
                      key={n.id}
                      className={'notif-item dd-item' + (Number(n.is_read) ? '' : ' unread')}
                      onClick={() => { setNotifOpen(false); nav(notifLink(n)); }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="n-content">{n.content}</div>
                        <div className="n-time">{timeAgo(n.created_at as string)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Link to="/messages" style={{ position: 'relative' }}>
              <button className="btn btn-sm btn-ghost" style={{ position: 'relative' }}><I name="mail" size={17} />{msgUnread > 0 && <span style={{ position: 'absolute', top: -4, right: -4, background: 'var(--err)', color: '#fff', borderRadius: 10, fontSize: 10, padding: '0 5px' }}>{msgUnread}</span>}</button>
            </Link>
            <div className="dropdown" ref={userMenuRef}>
              <button onClick={() => setUserMenu(!userMenu)}>
                <Avatar name={user.username} size={30} email={user.email as string} />
              </button>
              {userMenu && (
                <div className="dropdown-menu">
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)' }}>
                    <div style={{ fontWeight: 700 }}>{user.username} <VerBadge badge={user.verification_badge} label={user.verification_label} /></div>
                    <div className="muted">ID: {user.uid}</div>
                  </div>
                  <div className="dd-item" onClick={() => { setUserMenu(false); nav('/profile'); }}><I name="user" size={15} /> 我的主页</div>
                  <div className="dd-item" onClick={() => { setUserMenu(false); nav('/me'); }}><I name="gear" size={15} /> 个人中心</div>
                  <div className="dd-item" onClick={() => { setUserMenu(false); nav('/history'); }}><I name="clock" size={15} /> 历史记录</div>
                  <div className="dd-item" onClick={() => { setUserMenu(false); nav('/favorites'); }}><I name="star" size={15} /> 我的收藏</div>
                  <div className="dd-item" onClick={() => { setUserMenu(false); nav('/collections'); }}><I name="folder" size={15} /> 我的合集</div>
                  <div className="dd-item" onClick={() => { setUserMenu(false); nav('/coins'); }}><I name="coin" size={15} /> 积分签到</div>
                  <div className="dd-item" onClick={() => { setUserMenu(false); nav('/membership'); }}><I name="flower" size={15} /> 会员中心</div>
                  {['admin', 'video_moderation', 'content_review'].includes(String(user.role)) && (
                    <div className="dd-item" onClick={() => { setUserMenu(false); nav('/admin'); }}><I name="shield" size={15} /> 管理后台</div>
                  )}
                  <div className="dd-item" style={{ color: 'var(--err)' }} onClick={async () => { setUserMenu(false); await logout(); toast('已退出登录'); }}><I name="logout" size={15} /> 退出登录</div>
                </div>
              )}
            </div>
          </>
        ) : (
          <button className="btn btn-sm" onClick={() => nav('/login')}>登录</button>
        )}
      </header>
      {ann && (
        <Modal
          title={ann.title}
          onClose={() => { markSeen(ann.id); api.announcementRead(ann.id).catch(() => {}); setAnn(null); }}
          foot={<button className="btn btn-primary" onClick={() => { markSeen(ann.id); api.announcementRead(ann.id).catch(() => {}); setAnn(null); }}>知道了</button>}
        >
          <Markdown text={ann.content} />
        </Modal>
      )}
    </>
  );
}

// ============ 移动端底部导航 ============
export function BottomNav() {
  const { user } = useAuth();
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const h = () => setPath(window.location.pathname);
    window.addEventListener('popstate', h);
    const mo = new MutationObserver(h);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { window.removeEventListener('popstate', h); mo.disconnect(); };
  }, []);
  const items = [
    { to: '/', icon: 'home', label: '推荐' },
    { to: '/search', icon: 'search', label: '搜索' },
    { to: user ? '/upload' : '/login', icon: 'plus', label: '投稿', center: true },
    { to: user ? '/messages' : '/login', icon: 'mail', label: '消息', badge: true },
    { to: user ? '/me' : '/login', icon: 'user', label: '我的' },
  ];
  return (
    <nav className="bottomnav">
      {items.map((it) => (
        <Link key={it.label} to={it.to} className={path.startsWith(it.to) && it.to !== '/' ? 'active' : path === it.to ? 'active' : ''}>
          <span className="icon"><I name={it.icon as IconName} size={20} /></span>{it.label}
        </Link>
      ))}
    </nav>
  );
}

// ============ 评论列表（视频/专栏/动态通用） ============
export function CommentSection({ targetType, targetId }: { targetType: 'video' | 'article' | 'dynamic'; targetId: string }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [comments, setComments] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const limit = 20;

  const load = async (reset = false) => {
    if (reset) setOffset(0);
    setLoading(true);
    try {
      const off = reset ? 0 : offset;
      const d = await api.comments(targetType, targetId, limit, off);
      const arr = asArray<Comment>(d);
      const t = (d as { total?: number })?.total ?? arr.length;
      setTotal(t);
      setComments((prev) => (reset ? arr : [...prev, ...arr]));
      setOffset(off + arr.length);
    } catch (e) {
      toast(errMsg(e, '评论加载失败'), 'err');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(true); }, [targetId, targetType]);

  const submit = async () => {
    if (!user) { nav('/login'); return; }
    const t = (replyTo ? `@${replyTo.username || replyTo.uid} ` : '') + text.trim();
    if (!t) return;
    try {
      await api.commentPost(targetType, targetId, t, replyTo?.id || null);
      setText('');
      setReplyTo(null);
      void load(true);
    } catch (e) {
      toast(errMsg(e), 'err');
    }
  };

  const like = async (c: Comment) => {
    if (!user) { nav('/login'); return; }
    try {
      const r = await api.commentLike(targetType, c.id);
      setComments((prev) => prev.map((x) => (x.id === c.id ? { ...x, liked: !x.liked, like_count: r.like_count ?? (x.like_count || 0) + (r.liked ? 1 : -1) } : x)));
    } catch (e) { toast(errMsg(e), 'err'); }
  };

  const [translations, setTranslations] = useState<Record<string, string>>({});
  const translate = async (c: Comment) => {
    if (translations[c.id]) { setTranslations((p) => { const n = { ...p }; delete n[c.id]; return n; }); return; }
    try {
      const r = await api.translate(c.content, 'zh');
      setTranslations((p) => ({ ...p, [c.id]: r.translated_text || c.content }));
    } catch (e) { toast(errMsg(e, '翻译失败'), 'err'); }
  };

  const del = async (c: Comment) => {
    if (!user) return;
    try {
      await api.commentDelete(targetType, c.id);
      setComments((prev) => prev.filter((x) => x.id !== c.id && x.parent_id !== c.id));
      toast('已删除');
    } catch (e) { toast(errMsg(e), 'err'); }
  };

  const canDel = (c: Comment) =>
    user && (String(c.author_id || c.uid) === String(user.id || user.uid) || ['admin', 'video_moderation', 'content_review'].includes(String(user.role || '')));

  const roots = comments.filter((c) => !c.parent_id);
  const byParent = (pid: string) => comments.filter((c) => c.parent_id === pid);

  const renderComment = (c: Comment) => (
    <div className="comment" key={c.id}>
      <Avatar name={c.username || '匿名'} size={34} url={c.gravatar_url} />
      <div className="c-body">
        <div className="c-head">
          <span className="c-name">{c.username || '匿名'}</span>
          <VerBadge badge={c.verification_badge} label={c.verification_label} />
          <span>{timeAgo(c.created_at as string)}</span>
          {c.ip_location && <span style={{ fontSize: 11 }}>· {c.ip_location}</span>}
          {c.pending && <span className="tag" style={{ color: 'var(--warn)' }}>待审核</span>}
        </div>
        <div className="c-text">{c.content}</div>
        {translations[c.id] && (
          <div className="c-text" style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 10px', marginTop: 6, fontSize: 13, color: 'var(--ink-2)' }}>
            <span className="muted" style={{ fontSize: 11 }}><I name="globe" size={11} /> 翻译：</span>{translations[c.id]}
          </div>
        )}
        <div className="c-actions">
          <button className={c.liked ? 'liked' : ''} onClick={() => like(c)}><I name="heart" size={13} filled={!!c.liked} /> {fmtCount(c.like_count)}</button>
          {user && <button onClick={() => { setReplyTo(c); }}>回复</button>}
          {user && <button onClick={() => translate(c)}>{translations[c.id] ? '隐藏翻译' : '翻译'}</button>}
          {canDel(c) && <button style={{ color: 'var(--err)' }} onClick={() => del(c)}>删除</button>}
        </div>
        {byParent(c.id).length > 0 && (
          <div className="replies">{byParent(c.id).map(renderComment)}</div>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <div className="section-title"><I name="chat" size={16} /> 评论 {total > 0 && <span className="muted">{fmtCount(total)}</span>}</div>
      {user ? (
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <Avatar name={user.username} size={36} email={user.email as string} />
          <div style={{ flex: 1 }}>
            {replyTo && (
              <div className="flex between" style={{ background: 'var(--bg)', borderRadius: 8, padding: '4px 10px', fontSize: 12, marginBottom: 6 }}>
                <span>回复 @{replyTo.username || replyTo.uid}</span>
                <button className="btn btn-sm btn-ghost" onClick={() => setReplyTo(null)}>取消</button>
              </div>
            )}
            <textarea
              className="field"
              style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 12px', background: 'var(--bg)', color: 'var(--ink)', minHeight: 44 }}
              placeholder="发表你的评论…"
              value={text}
              maxLength={1000}
              onChange={(e) => setText(e.target.value)}
            />
            <div style={{ textAlign: 'right' }}>
              <button className="btn btn-primary btn-sm" disabled={!text.trim()} onClick={submit}>发表评论</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="notice-banner">
          <Link to="/login">登录</Link> 后可参与评论讨论
        </div>
      )}
      {loading && comments.length === 0 ? <Loading /> : roots.length === 0 ? <Empty text="还没有评论，来抢沙发" icon="chat" /> : roots.map(renderComment)}
      {!loading && comments.length < total && (
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button className="btn btn-sm" onClick={() => load()}>加载更多</button>
        </div>
      )}
    </div>
  );
}

// ============ 通用：带加载的列表 hook ============
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fn().then((d) => alive && setData(d)).catch((e) => alive && setError(errMsg(e))).finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, loading, error, reload: () => setData(null) };
}
