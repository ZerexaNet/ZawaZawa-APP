import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { users } from '../lib/api';
import type { Video } from '../lib/types';
import { VideoCard } from '../components/VideoCard';
import { Avatar, Empty, Loading, VBadge, Btn } from '../components/ui';
import { I } from '../components/icons';
import { useAuth } from '../store/auth';
import { asList } from '../lib/http';
import { useInfinite } from '../components/ui';

export default function FollowingFeedPage() {
  const nav = useNavigate();
  const user = useAuth(s => s.user);
  const [list, setList] = useState<Video[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => { if (!user) nav('/login'); }, [user, nav]);

  const onLoad = useCallback(async () => {
    const d: any = await users.followingFeed(20, list.length);
    const items = asList<Video>(d);
    setTotal(Number(d?.total ?? -1));
    setList(prev => [...prev, ...items.filter(x => !prev.some(p => p.id === x.id))]);
    return items.length > 0;
  }, [list.length]);

  const inf = useInfinite(onLoad, [user?.id]);

  return (
    <div className="page fade-in">
      <div className="section-head">
        <h1 className="page-title row" style={{ gap: 8 }}><I name="users" size={24} /> 关注动态</h1>
        {total >= 0 && <span className="muted small">{total} 条更新</span>}
      </div>
      {list.length > 0 && (
        <div className="video-grid">
          {list.map(v => <VideoCard key={v.id} v={v} />)}
        </div>
      )}
      {list.length === 0 && !inf.loading && (
        <>
          <Empty icon="users" title="关注流为空" desc="关注一些创作者后，他们的新视频会出现在这里" />
          <div className="center"><Btn variant="filled" onClick={() => nav('/search?q=')}>去发现创作者</Btn></div>
        </>
      )}
      {/* sentinel 必须常驻：空态分支若卸载它，IntersectionObserver 永不触发首次加载 */}
      {inf.sentinelEl}
      {inf.loading && <Loading text="加载更多…" />}
      {!inf.loading && inf.done && list.length > 0 && <div className="center muted small" style={{ padding: 16 }}>— 已经到底了 —</div>}
    </div>
  );
}

export function FollowListPage({ kind }: { kind: 'following' | 'followers' }) {
  const nav = useNavigate();
  const user = useAuth(s => s.user);
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const limit = 30;

  useEffect(() => { if (!user) nav('/login'); }, [user, nav]);

  const load = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const d: any = kind === 'following'
        ? await users.following(limit, reset ? 0 : list.length)
        : await users.followers(limit, reset ? 0 : list.length);
      const items = asList(d);
      setList(prev => reset ? items : [...prev, ...items.filter(x => !prev.some(p => p.id === x.id))]);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [kind, list.length]);

  useEffect(() => { if (user) load(true); }, [user, kind]); // eslint-disable-line

  return (
    <div className="page fade-in">
      <h1 className="page-title row" style={{ gap: 8 }}>
        <I name={kind === 'following' ? 'userPlus' : 'users'} size={24} /> {kind === 'following' ? '我的关注' : '我的粉丝'}
      </h1>
      {loading ? <Loading /> : list.length === 0 ? (
        <Empty icon="users" title={kind === 'following' ? '还没有关注任何人' : '还没有粉丝'} />
      ) : (
        <>
          <div className="col" style={{ gap: 8, maxWidth: 640 }}>
            {list.map(x => (
              <div key={x.id} className="card row" style={{ padding: '10px 14px', gap: 12, alignItems: 'center' }}>
                <Link to={`/user/${x.id}`}><Avatar user={x} size={40} /></Link>
                <Link to={`/user/${x.id}`} style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <span style={{ font: 'var(--text-title-sm)' }}>{x.username}</span>
                    <VBadge badge={x.verification_badge} size={14} />
                  </div>
                  {x.bio && <div className="muted small clamp1" style={{ marginTop: 2 }}>{x.bio}</div>}
                </Link>
                <Btn variant="tonal" size="sm" onClick={async () => {
                  try {
                    const r: any = x.is_following ? await users.unfollow(x.id) : await users.follow(x.id);
                    setList(prev => prev.map(p => p.id === x.id ? { ...p, is_following: r?.following } : p));
                  } catch { /* ignore */ }
                }}>{x.is_following ? '已关注' : '关注'}</Btn>
              </div>
            ))}
          </div>
          <div className="center"><Btn variant="tonal" size="sm" onClick={() => load()}>加载更多</Btn></div>
        </>
      )}
    </div>
  );
}
