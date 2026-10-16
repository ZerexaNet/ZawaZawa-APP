import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { users } from '../lib/api';
import type { Article, Post, User, Video } from '../lib/types';
import { VideoCard } from '../components/VideoCard';
import { Avatar, Btn, Dialog, Field, Loading, Menu, Tabs, VBadge, confirmDialog, useInfinite } from '../components/ui';
import { I } from '../components/icons';
import { useAuth } from '../store/auth';
import { useToast, errMsg } from '../store/toast';
import { asList } from '../lib/http';
import { fmtNum, timeAgo } from '../lib/util';

type TabKey = 'videos' | 'articles' | 'posts' | 'followers' | 'following' | 'fans';

export default function UserPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const me = useAuth(s => s.user);
  const setUser = useAuth(s => s.setUser);
  const toast = useToast(s => s.push);

  const [u, setU] = useState<User | null>(null);
  const [tab, setTab] = useState<TabKey>('videos');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [items, setItems] = useState<any[]>([]);

  const [editOpen, setEditOpen] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editName, setEditName] = useState('');
  const [nameAvail, setNameAvail] = useState<any>(null);

  const isMe = me && id && (String(me.id) === String(id) || String(me.uid) === String(id));

  const loadUser = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErr('');
    try {
      const d: any = await users.public(id);
      setU(d?.user ?? d);
    } catch (e: any) {
      setErr(e?.message || '用户不存在');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadUser(); window.scrollTo(0, 0); }, [loadUser]);

  const loadTab = useCallback(async (reset = false) => {
    if (!id) return false;
    const offset = reset ? 0 : items.length;
    try {
      let d: any;
      switch (tab) {
        case 'videos': d = await users.userVideos(id, 24, offset); break;
        case 'articles': d = await users.userArticles(id, 24, offset); break;
        case 'posts': d = await users.userPosts(id, 24, offset); break;
        case 'followers': d = await users.userFollowers(id, 24, offset); break;
        case 'following': d = await users.userFollowing(id, 24, offset); break;
        default: d = [];
      }
      const list = asList(d);
      setItems(prev => (reset ? list : [...prev, ...list.filter(x => !prev.some(p => (p.id || p.history_id) === (x.id || x.history_id)))]));
      return list.length > 0;
    } catch {
      return false;
    }
  }, [id, tab, items.length]);

  const inf = useInfinite(loadTab, [id, tab]);
  useEffect(() => { setItems([]); }, [id, tab]);

  const doFollow = async () => {
    if (!u) return;
    try {
      const r: any = u.is_following ? await users.unfollow(u.id) : await users.follow(u.id);
      const f = r?.following ?? !u.is_following;
      setU(x => x && { ...x, is_following: f, follower_count: (x.follower_count || 0) + (f ? 1 : -1) });
      toast(f ? '已关注' : '已取消关注', 'success');
    } catch (e: any) { toast(errMsg(e), 'error'); }
  };
  const doBlock = async () => {
    if (!u) return;
    const ok = await confirmDialog({ title: '拉黑用户', message: `确定拉黑 @${u.username} 吗？拉黑后对方无法再关注你或向你发送私信。`, okText: '拉黑', danger: true });
    if (!ok) return;
    try {
      await users.block(u.id);
      toast('已拉黑', 'success');
      setU(x => x && { ...x, is_blocked: true });
    } catch (e: any) { toast(errMsg(e), 'error'); }
  };
  const doUnblock = async () => {
    if (!u) return;
    try { await users.unblock(u.id); toast('已取消拉黑', 'success'); setU(x => x && { ...x, is_blocked: false }); } catch (e: any) { toast(errMsg(e), 'error'); }
  };

  const saveBio = async () => {
    try {
      const r: any = await users.updateBio(editBio);
      const bio = r?.bio ?? editBio;
      setU(x => x && { ...x, bio });
      if (isMe) setUser({ ...useAuth.getState().user!, bio });
      setEditOpen(false);
      toast('简介已更新', 'success');
    } catch (e: any) { toast(errMsg(e), 'error'); }
  };
  const saveName = async () => {
    try {
      const r: any = await users.updateUsername(editName);
      const username = r?.username ?? editName;
      setU(x => x && { ...x, username });
      if (isMe) setUser({ ...useAuth.getState().user!, username });
      setEditOpen(false);
      toast('用户名已更新', 'success');
    } catch (e: any) { toast(errMsg(e), 'error'); }
  };
  const checkName = useCallback(async () => {
    if (!editName) { setNameAvail(null); return; }
    try {
      const r: any = await users.checkUsername(editName, u?.id);
      setNameAvail(r);
    } catch { setNameAvail(null); }
  }, [editName, u?.id]);

  if (loading) return <Loading text="加载用户…" />;
  if (err || !u) {
    return (
      <div className="empty">
        <I name="alert" size={26} className="muted" />
        <div style={{ font: 'var(--text-title-md)' }}>{err || '用户不存在'}</div>
        <Btn variant="tonal" onClick={() => nav('/')}>返回首页</Btn>
      </div>
    );
  }

  const tabs = [
    { key: 'videos' as TabKey, label: '视频', icon: 'film' },
    { key: 'articles' as TabKey, label: '专栏', icon: 'newspaper' },
    { key: 'posts' as TabKey, label: '动态', icon: 'message' },
    { key: 'followers' as TabKey, label: `粉丝 ${u.follower_count ?? ''}`.trim(), icon: 'users' },
    { key: 'following' as TabKey, label: '关注', icon: 'userPlus' },
  ];

  return (
    <div className="page fade-in">
      <div className="card profile-head">
        <Avatar user={u} size={96} className="avatar--xl" />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="row" style={{ gap: 8 }}>
            <h1 style={{ font: 'var(--text-headline-sm)' }}>{u.username}</h1>
            <VBadge badge={u.verification_badge} label={u.verification_label} size={20} />
            {u.role && u.role !== 'user' && <span className="status-tag status-tag--open">{u.role}</span>}
          </div>
          {u.bio ? <p className="ph-bio clamp2">{u.bio}</p> : <p className="muted ph-bio">这个人很懒，什么都没写</p>}
          <div className="profile-stats">
            <div className="ps"><b>{fmtNum(u.follower_count)}</b><span>粉丝</span></div>
            <div className="ps"><b>{fmtNum(u.following_count)}</b><span>关注</span></div>
            <div className="ps"><b>{fmtNum(u.video_count)}</b><span>视频</span></div>
          </div>
        </div>
        <div className="col" style={{ gap: 8 }}>
          {me && !isMe ? (
            <>
              <Btn variant={u.is_following ? 'tonal' : 'filled'} onClick={doFollow}>
                <I name={u.is_following ? 'userCheck' : 'userPlus'} size={16} /> {u.is_following ? '已关注' : '关注'}
              </Btn>
              <Btn variant="tonal" size="sm" onClick={() => nav(`/messages?dm=${u.id}`)}><I name="message" size={15} /> 私信</Btn>
              <Menu
                trigger={<button className="icon-btn" aria-label="更多操作"><I name="dots" size={20} /></button>}
                items={u.is_blocked
                  ? [{ label: '取消拉黑', icon: 'userX', onClick: doUnblock }]
                  : [{ label: '拉黑该用户', icon: 'ban', danger: true, onClick: doBlock }]}
              />
            </>
          ) : isMe ? (
            <Btn variant="tonal" size="sm" onClick={() => { setEditBio(u.bio || ''); setEditName(u.username); setEditOpen(true); }}>
              <I name="edit" size={15} /> 编辑资料
            </Btn>
          ) : null}
        </div>
      </div>

      <Tabs tabs={tabs} value={tab} onChange={k => setTab(k as TabKey)} />

      {tab === 'videos' && (
        items.length === 0 && !inf.loading ? <EmptyState /> :
          <div className="video-grid">{(items as Video[]).map(v => <VideoCard key={v.id} v={v} />)}</div>
      )}
      {tab === 'articles' && (
        items.length === 0 && !inf.loading ? <EmptyState icon="newspaper" title="暂无专栏" /> :
          <div className="col" style={{ gap: 10 }}>
            {(items as Article[]).map(a => (
              <Link key={a.id} to={`/article/${a.id}`} className="card card--hover" style={{ padding: 14, display: 'flex', gap: 14, alignItems: 'center' }}>
                {a.cover_url && <img src={a.cover_url} loading="lazy" style={{ width: 120, aspectRatio: '16/9', objectFit: 'cover', borderRadius: 10, flex: 'none' }} alt="" />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="clamp1" style={{ font: 'var(--text-title-md)' }}>{a.title}</div>
                  <div className="muted small" style={{ marginTop: 4 }}>{a.summary || '（无摘要）'}</div>
                  <div className="muted small" style={{ marginTop: 4 }}>{fmtViews2(a.views)} 阅读 · {timeAgo(a.created_at)}</div>
                </div>
                <I name="chevronR" size={18} className="muted" />
              </Link>
            ))}
          </div>
      )}
      {tab === 'posts' && (
        items.length === 0 && !inf.loading ? <EmptyState icon="message" title="暂无动态" /> :
          <div className="col" style={{ gap: 10, maxWidth: 640 }}>
            {(items as Post[]).map(p => (
              <div key={p.id} className="card" style={{ padding: 16 }}>
                <div className="row" style={{ gap: 8, marginBottom: 8 }}>
                  <Avatar user={{ gravatar_url: p.author_gravatar_url, username: p.author_username }} size={30} />
                  <span style={{ font: 'var(--text-label-lg)' }}>{p.author_username}</span>
                  <span className="muted small">{timeAgo(p.created_at)}</span>
                </div>
                <div className="col" style={{ gap: 8 }}>
                  <div className="clamp3" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{p.content || p.text}</div>
                  {p.image_urls && p.image_urls.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 6 }}>
                      {p.image_urls.slice(0, 4).map((u2, i) => <img key={i} src={u2} loading="lazy" style={{ borderRadius: 8, aspectRatio: '1', objectFit: 'cover' }} alt="" />)}
                    </div>
                  )}
                  <div className="row muted small" style={{ gap: 12 }}>
                    <span className="row" style={{ gap: 4 }}><I name="heart" size={14} /> {fmtNum(p.likes ?? p.like_count)}</span>
                    <span className="row" style={{ gap: 4 }}><I name="message" size={14} /> {fmtNum(p.comment_count)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
      )}
      {(tab === 'followers' || tab === 'following') && (
        items.length === 0 && !inf.loading ? <EmptyState icon="users" title={tab === 'followers' ? '暂无粉丝' : '还没有关注任何人'} /> :
          <div className="col" style={{ gap: 8, maxWidth: 640 }}>
            {(items as User[]).map(x => (
              <div key={x.id} className="card row" style={{ padding: '10px 14px', gap: 12, alignItems: 'center' }}>
                <Link to={`/user/${x.id}`}><Avatar user={x} size={40} /></Link>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link to={`/user/${x.id}`} className="row" style={{ gap: 6 }}>
                    <span style={{ font: 'var(--text-title-sm)' }}>{x.username}</span>
                    <VBadge badge={x.verification_badge} size={14} />
                  </Link>
                  {x.bio && <div className="muted small clamp1" style={{ marginTop: 2 }}>{x.bio}</div>}
                </div>
                {me && x.id !== me.id && (
                  <Btn variant="tonal" size="sm" onClick={async () => {
                    try {
                      const r: any = x.is_following ? await users.unfollow(x.id) : await users.follow(x.id);
                      setItems(prev => prev.map(p => p.id === x.id ? { ...p, is_following: r?.following } : p));
                      loadUser();
                    } catch (e: any) { toast(errMsg(e), 'error'); }
                  }}>
                    {x.is_following ? '已关注' : '关注'}
                  </Btn>
                )}
              </div>
            ))}
          </div>
      )}
      {inf.sentinelEl}
      {inf.loading && <Loading text="加载更多…" />}

      {/* 编辑资料 */}
      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="编辑资料"
        actions={
          <>
            <Btn variant="text" onClick={() => setEditOpen(false)}>取消</Btn>
            <Btn variant="filled" onClick={() => { saveBio(); saveName(); }}>保存</Btn>
          </>
        }
      >
        <Field label="用户名" hint={nameAvail ? (nameAvail.available ? '✓ 该用户名可用' : `✗ ${nameAvail.reason || '不可用'}`) : '2-24 位字母、数字、下划线或中文'}>
          <input value={editName} onChange={e => setEditName(e.target.value)} onBlur={checkName} maxLength={24} />
        </Field>
        <Field label="个人简介" hint="最多 200 字">
          <textarea value={editBio} onChange={e => setEditBio(e.target.value)} maxLength={200} />
        </Field>
      </Dialog>
    </div>
  );
}

function EmptyState({ icon = 'film', title = '还没有作品' }: { icon?: string; title?: string }) {
  return (
    <div className="empty">
      <div className="empty-icon"><I name={icon} size={26} /></div>
      <div style={{ font: 'var(--text-title-md)' }}>{title}</div>
    </div>
  );
}
function fmtViews2(n?: number) {
  if (!n && n !== 0) return '0';
  if (n < 10000) return String(n);
  return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万';
}
