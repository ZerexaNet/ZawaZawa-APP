import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { users, coins, history, auth } from '../lib/api';
import type { Article, Post, Video } from '../lib/types';
import { VideoCard } from '../components/VideoCard';
import { Avatar, Btn, Loading, Spinner, Switch, Tabs, VBadge, confirmDialog, useInfinite, Empty } from '../components/ui';
import { I } from '../components/icons';
import { useAuth } from '../store/auth';
import { useToast, errMsg } from '../store/toast';
import { asList } from '../lib/http';
import { download, fmtDateTime, fmtNum, timeAgo } from '../lib/util';

type TabKey = 'videos' | 'articles' | 'posts';

export default function Profile() {
  const nav = useNavigate();
  const { user, logout } = useAuth();
  const toast = useToast(s => s.push);

  const [tab, setTab] = useState<TabKey>('videos');
  const [items, setItems] = useState<any[]>([]);
  const [coin, setCoin] = useState<any>(null);
  const [histEnabled, setHistEnabled] = useState(true);
  const [checkinBusy, setCheckinBusy] = useState(false);

  const loadCoin = useCallback(() => {
    coins.balance().then(d => setCoin(d)).catch(() => { });
  }, []);
  useEffect(() => {
    if (!user) { nav('/login'); return; }
    loadCoin();
    // 尝试读取历史设置（GET 不受支持时保持默认开启）
    fetch('/api/users/me/history/settings', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(s => { if (s && typeof s.enabled === 'boolean') setHistEnabled(s.enabled); })
      .catch(() => { });
  }, [user, nav, loadCoin]);

  const loadTab = useCallback(async (reset = false) => {
    if (!user) return false;
    const offset = reset ? 0 : items.length;
    try {
      const d: any = tab === 'videos'
        ? await users.meVideos(24, offset)
        : tab === 'articles' ? await users.meArticles(24, offset) : await users.mePosts(24, offset);
      const list = asList(d);
      setItems(prev => reset ? list : [...prev, ...list.filter(x => !prev.some(p => p.id === x.id))]);
      return list.length > 0;
    } catch { return false; }
  }, [user, tab, items.length]);

  const inf = useInfinite(loadTab, [user?.id, tab]);
  useEffect(() => { setItems([]); }, [tab]);

  const doCheckin = async () => {
    setCheckinBusy(true);
    try {
      const r: any = await coins.checkin();
      setCoin(r ?? { ...coin, checkedIn: true });
      toast(`签到成功！积分 ${r?.balance ?? ''}`.replace('undefined', ''), 'success');
    } catch (e: any) { toast(errMsg(e), 'error'); }
    finally { setCheckinBusy(false); }
  };

  const toggleHistory = async (v: boolean) => {
    setHistEnabled(v);
    try {
      await history.settings(v);
      toast(v ? '已开启观看历史' : '已关闭观看历史', 'success');
    } catch (e: any) { setHistEnabled(!v); toast(errMsg(e), 'error'); }
  };

  const exportData = async () => {
    try {
      const res = await auth.export();
      const blob = await res.blob();
      download(`zerexa-data-${user?.id}.json`, blob);
      toast('数据已开始下载', 'success');
    } catch (e: any) { toast(errMsg(e, '导出失败'), 'error'); }
  };

  const delVideo = async (v: Video) => {
    const ok = await confirmDialog({ title: '删除视频', message: `确定删除「${v.title}」吗？此操作不可恢复。`, okText: '删除', danger: true });
    if (!ok) return;
    try {
      await import('../lib/api').then(m => m.videos.remove(v.id));
      setItems(prev => prev.filter(x => x.id !== v.id));
      toast('已删除', 'success');
    } catch (e: any) { toast(errMsg(e), 'error'); }
  };

  const delArticle = async (a: Article) => {
    const ok = await confirmDialog({ title: '删除专栏', message: `确定删除「${a.title}」吗？`, okText: '删除', danger: true });
    if (!ok) return;
    try {
      await import('../lib/api').then(m => m.articles.remove(a.id));
      setItems(prev => prev.filter(x => x.id !== a.id));
      toast('已删除', 'success');
    } catch (e: any) { toast(errMsg(e), 'error'); }
  };

  const delPost = async (p: Post) => {
    const ok = await confirmDialog({ title: '删除动态', message: '确定删除这条动态吗？', okText: '删除', danger: true });
    if (!ok) return;
    try {
      await import('../lib/api').then(m => m.posts.remove(p.id));
      setItems(prev => prev.filter(x => x.id !== p.id));
      toast('已删除', 'success');
    } catch (e: any) { toast(errMsg(e), 'error'); }
  };

  if (!user) return <Loading />;

  const tabs = [
    { key: 'videos' as TabKey, label: '我的视频', icon: 'film' },
    { key: 'articles' as TabKey, label: '我的专栏', icon: 'newspaper' },
    { key: 'posts' as TabKey, label: '我的动态', icon: 'message' },
  ];

  return (
    <div className="page fade-in">
      <div className="card profile-head">
        <Link to={`/user/${user.id}`}><Avatar user={user} size={92} className="avatar--xl" /></Link>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="row" style={{ gap: 8 }}>
            <h1 style={{ font: 'var(--text-headline-sm)' }}>{user.username}</h1>
            <VBadge badge={user.verification_badge} label={user.verification_label} size={20} />
            {user.role && user.role !== 'user' && <span className="status-tag status-tag--open">{user.role}</span>}
          </div>
          <div className="muted small" style={{ marginTop: 6 }}>UID {user.uid || user.id} · 加入于 {fmtDateTime(user.created_at)}</div>
          <div className="profile-stats">
            <div className="ps"><b>{fmtNum(user.follower_count)}</b><span>粉丝</span></div>
            <div className="ps"><b>{fmtNum(user.following_count)}</b><span>关注</span></div>
            <div className="ps"><b>{fmtNum(user.video_count)}</b><span>视频</span></div>
          </div>
        </div>
        <div className="col" style={{ gap: 8 }}>
          <Btn variant="filled" size="sm" onClick={() => nav('/upload')}><I name="upload" size={15} /> 发布视频</Btn>
          <div className="row" style={{ gap: 8 }}>
            <Btn variant="tonal" size="sm" onClick={() => nav('/upload?article=new')}><I name="newspaper" size={15} /> 写专栏</Btn>
            <Btn variant="tonal" size="sm" onClick={() => nav('/post-new')}><I name="send" size={15} /> 发动态</Btn>
          </div>
        </div>
      </div>

      <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        {/* 积分卡 */}
        <div className="card" style={{ padding: 18 }}>
          <div className="row row--between" style={{ marginBottom: 10 }}>
            <h3 className="row" style={{ gap: 8, font: 'var(--text-title-md)' }}><I name="coin" size={18} style={{ color: 'var(--md-warning)' }} /> 积分</h3>
            <span className="row" style={{ gap: 6, font: 'var(--text-label-lg)' }}>
              <I name="zap" size={14} /> {coin?.balance ?? 0}
            </span>
          </div>
          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            <Btn variant={coin?.checkedIn ? 'tonal' : 'filled'} size="sm" onClick={doCheckin} disabled={checkinBusy || !!coin?.checkedIn}>
              {checkinBusy ? <Spinner size={14} /> : <I name="check" size={15} />} {coin?.checkedIn ? '今日已签到' : '每日签到'}
            </Btn>
            <span className="muted small">每天签到获得积分，积分可用作平台激励</span>
          </div>
        </div>

        {/* 历史设置 */}
        <div className="card" style={{ padding: 18 }}>
          <div className="row row--between" style={{ marginBottom: 10 }}>
            <h3 className="row" style={{ gap: 8, font: 'var(--text-title-md)' }}><I name="history" size={18} /> 观看历史</h3>
            <Switch checked={histEnabled} onChange={toggleHistory} label="记录观看历史" />
          </div>
          <div className="row" style={{ gap: 8 }}>
            <Btn variant="tonal" size="sm" onClick={() => nav('/history')}><I name="clock" size={15} /> 查看历史</Btn>
            <Btn variant="danger-text" size="sm" onClick={async () => {
              const ok = await confirmDialog({ title: '清空历史', message: '确定清空全部观看历史吗？', okText: '清空', danger: true });
              if (!ok) return;
              try { await history.clear(); toast('历史已清空', 'success'); } catch (e: any) { toast(errMsg(e), 'error'); }
            }}><I name="trash" size={15} /> 清空</Btn>
          </div>
        </div>

        {/* 账户 */}
        <div className="card" style={{ padding: 18 }}>
          <h3 className="row" style={{ gap: 8, font: 'var(--text-title-md)', marginBottom: 10 }}><I name="shield" size={18} /> 账户与安全</h3>
          <div className="col" style={{ gap: 8 }}>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <Btn variant="tonal" size="sm" onClick={() => nav('/membership')}><I name="crown" size={15} /> 会员中心</Btn>
              <Btn variant="tonal" size="sm" onClick={() => nav('/verification')}><I name="award" size={15} /> 身份认证</Btn>
              <Btn variant="tonal" size="sm" onClick={exportData}><I name="download" size={15} /> 导出数据 (GDPR)</Btn>
            </div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <Btn variant="danger-text" size="sm" onClick={() => nav('/deactivate')}><I name="alert" size={15} /> 注销账号</Btn>
              <Btn variant="danger-text" size="sm" onClick={async () => { await logout(); toast('已退出登录', 'info'); nav('/'); }}><I name="logout" size={15} /> 退出登录</Btn>
            </div>
          </div>
        </div>
      </div>

      <Tabs tabs={tabs} value={tab} onChange={k => setTab(k as TabKey)} />

      {tab === 'videos' && items.length > 0 && (
        <div className="video-grid">
          {(items as Video[]).map(v => (
            <div key={v.id} style={{ position: 'relative' }}>
              <VideoCard v={v} />
              <div className="row" style={{ position: 'absolute', top: 8, right: 8, gap: 4, zIndex: 2 }}>
                <button className="icon-btn icon-btn--sm" style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }} title="编辑" onClick={e => { e.preventDefault(); nav(`/upload?edit=${v.id}`); }}><I name="edit" size={15} /></button>
                <button className="icon-btn icon-btn--sm" style={{ background: 'rgba(0,0,0,0.55)', color: 'var(--md-error)' }} title="删除" onClick={e => { e.preventDefault(); delVideo(v); }}><I name="trash" size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {tab === 'articles' && items.length > 0 && (
        <div className="col" style={{ gap: 10 }}>
          {(items as Article[]).map(a => (
            <div key={a.id} className="card row" style={{ padding: 14, gap: 12, alignItems: 'center' }}>
              <Link to={`/article/${a.id}`} style={{ flex: 1, minWidth: 0 }}>
                <div className="clamp1" style={{ font: 'var(--text-title-md)' }}>{a.title}</div>
                <div className="muted small" style={{ marginTop: 4 }}>{fmtNum(a.views)} 阅读 · {timeAgo(a.created_at)}</div>
              </Link>
              <Btn variant="text" size="sm" onClick={() => nav(`/upload?article=${a.id}`)}><I name="edit" size={14} /> 编辑</Btn>
              <Btn variant="danger-text" size="sm" onClick={() => delArticle(a)}><I name="trash" size={14} /> 删除</Btn>
            </div>
          ))}
        </div>
      )}
      {tab === 'posts' && items.length > 0 && (
        <div className="col" style={{ gap: 10, maxWidth: 640 }}>
          {(items as Post[]).map(p => (
            <div key={p.id} className="card" style={{ padding: 16 }}>
              <div className="row row--between" style={{ marginBottom: 8 }}>
                <span className="muted small">{timeAgo(p.created_at)}</span>
                <div className="row" style={{ gap: 4 }}>
                  <button className="icon-btn icon-btn--sm" title="删除" onClick={() => delPost(p)}><I name="trash" size={15} /></button>
                </div>
              </div>
              <div className="clamp3" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{p.content || p.text}</div>
              {p.image_urls && p.image_urls.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 6, marginTop: 8 }}>
                  {p.image_urls.slice(0, 4).map((u, i) => <img key={i} src={u} loading="lazy" style={{ borderRadius: 8, aspectRatio: '1', objectFit: 'cover' }} alt="" />)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {items.length === 0 && !inf.loading && <Empty icon={tab === 'videos' ? 'film' : tab === 'articles' ? 'newspaper' : 'message'} title="还没有内容" desc={tab === 'videos' ? '发布你的第一个视频吧' : ''} />}
      {/* sentinel 必须常驻：空态分支若卸载它，IntersectionObserver 永不触发首次加载 */}
      {inf.sentinelEl}
      {inf.loading && <Loading text="加载更多…" />}
    </div>
  );
}
