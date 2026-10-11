import { useEffect, useState } from 'react';
import { I } from '../icons';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { asArray, type User, type Video } from '../types';
import { Avatar, Cover, Empty, Loading, Markdown, VideoCard, VerBadge } from '../components';
import { errMsg, toast, useAuth } from '../store';
import { fmtCount, timeAgo } from '../lib/utils';

// ============ 搜索 ============
export function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get('q') || '';
  const [videos, setVideos] = useState<Video[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q.trim()) return;
    setLoading(true);
    api.search(q.trim()).then((r) => {
      setVideos(asArray<Video>(r.videos));
      setUsers(asArray<User>(r.users));
    }).catch((e) => toast(errMsg(e), 'err')).finally(() => setLoading(false));
  }, [q]);

  return (
    <div className="page" style={{ maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20 }}><I name="search" size={18} /> “{q}” 的搜索结果</h1>
      {loading ? <Loading /> : (
        <>
          {users.length > 0 && (
            <>
              <div className="section-title"><I name="user" size={15} /> 用户</div>
              <div className="card" style={{ padding: 6 }}>
                {users.map((u) => (
                  <div key={u.id} className="row-item">
                    <Avatar name={u.username} size={40} url={u.gravatar_url} />
                    <div className="grow">
                      <Link to={`/user/${u.uid}`} style={{ fontWeight: 600 }}>{u.username}</Link> <VerBadge badge={u.verification_badge} label={u.verification_label} />
                      <div className="desc">ID {u.uid} · {fmtCount(u.follower_count)} 粉丝 · {fmtCount(u.video_count)} 视频</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="section-title"><I name="video" size={15} /> 视频 {videos.length > 0 && <span className="muted">{videos.length}</span>}</div>
          {videos.length === 0 && users.length === 0 ? <Empty text="没有找到相关结果" icon="search" /> : (
            <div className="grid-videos">{videos.map((v) => <VideoCard key={v.id} v={v} />)}</div>
          )}
        </>
      )}
    </div>
  );
}

// ============ 热门 ============
export function TrendingPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.trending(48).then((d) => setVideos(asArray<Video>(d))).catch((e) => toast(errMsg(e), 'err')).finally(() => setLoading(false));
  }, []);
  return (
    <div className="page">
      <h1 style={{ fontSize: 20 }}><I name="flame" size={18} /> 热门视频</h1>
      {loading ? <Loading /> : videos.length === 0 ? <Empty text="暂无热门视频" /> : (
        <div className="grid-videos">{videos.map((v) => <VideoCard key={v.id} v={v} />)}</div>
      )}
    </div>
  );
}

// ============ 何意味（困惑榜） ============
export function ConfusionPage() {
  const [page, setPage] = useState(1);
  const [range, setRange] = useState('all');
  const [data, setData] = useState<{ videos: Video[]; total: number; total_pages?: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.confusionBoard({ page, per_page: 20, range }).then(setData).catch((e) => toast(errMsg(e), 'err')).finally(() => setLoading(false));
  }, [page, range]);

  return (
    <div className="page" style={{ maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20 }}><I name="help" size={18} /> 何意味排行榜</h1>
      <div className="chip-row" style={{ marginBottom: 14 }}>
        {[['all', '全部'], ['day', '今日'], ['week', '本周'], ['month', '本月']].map(([id, label]) => (
          <button key={id} className={'chip' + (range === id ? ' active' : '')} onClick={() => { setRange(id); setPage(1); }}>{label}</button>
        ))}
      </div>
      {loading ? <Loading /> : !data || data.videos.length === 0 ? <Empty text="暂无数据" icon="help" /> : (
        <>
          <div className="card" style={{ padding: 6 }}>
            {data.videos.map((v, i) => (
              <Link key={v.id} to={`/video/${v.id}`} className="row-item" style={{ display: 'flex' }}>
                <div style={{ fontWeight: 800, fontSize: 18, width: 34, textAlign: 'center', color: i < 3 ? 'var(--accent)' : 'var(--ink-3)' }}>{i + 1}</div>
                <Cover src={v.cover_url || v.external_cover_url} alt="" className="thumb-48" />
                <div className="grow">
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title}</div>
                  <div className="desc">{v.author_username} · {timeAgo(v.created_at as string)}</div>
                </div>
                <div style={{ fontWeight: 800, color: 'var(--accent)' }}><I name="help" size={15} /> {fmtCount(v.confusion_count)}</div>
              </Link>
            ))}
          </div>
          {data.total_pages && data.total_pages > 1 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14 }}>
              <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
              <span className="muted">{page} / {data.total_pages}</span>
              <button className="btn btn-sm" disabled={page >= (data.total_pages || 1)} onClick={() => setPage(page + 1)}>下一页</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============ 法律文档 ============
export function LegalPage() {
  const { doc = 'tos' } = useParams();
  const [content, setContent] = useState<{ title?: string; content?: string } | null>(null);
  useEffect(() => {
    api.legal(doc as 'tos' | 'privacy').then((r) => setContent(r)).catch((e) => toast(errMsg(e), 'err'));
  }, [doc]);
  return (
    <div className="page" style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="flex between" style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>{doc === 'tos' ? '服务条款' : '隐私政策'}</h1>
        <div className="flex" style={{ gap: 6 }}>
          <Link to="/legal/tos" className={'chip' + (doc === 'tos' ? ' active' : '')}>服务条款</Link>
          <Link to="/legal/privacy" className={'chip' + (doc === 'privacy' ? ' active' : '')}>隐私政策</Link>
        </div>
      </div>
      <div className="card" style={{ padding: 22 }}>
        {content ? <Markdown text={content.content || ''} /> : <Loading />}
      </div>
    </div>
  );
}

// ============ 关注动态流 ============
export function FollowingFeedPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [items, setItems] = useState<Video[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    if (!user) nav('/login');
  }, [user, nav]);

  const load = async (reset = false) => {
    setLoading(true);
    try {
      const d = await api.followingFeed(20, reset ? 0 : offset);
      const arr = asArray<Video>(d);
      setItems((prev) => (reset ? arr : [...prev, ...arr.filter((a) => !prev.some((p) => p.id === a.id))]));
      setOffset(reset ? arr.length : offset + arr.length);
      const hm = (d as { has_more?: boolean })?.has_more;
      setHasMore(hm !== undefined ? hm : arr.length >= 20);
    } catch (e) { toast(errMsg(e), 'err'); } finally { setLoading(false); }
  };

  useEffect(() => { if (user) void load(true); /* eslint-disable-next-line */ }, [user?.id]);

  if (!user) return null;

  return (
    <div className="page" style={{ maxWidth: 760, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20 }}><I name="radio" size={18} /> 关注动态</h1>
      <p className="muted" style={{ marginTop: 0 }}>你关注的创作者最新发布的内容</p>
      {loading && items.length === 0 ? <Loading /> : items.length === 0 ? <Empty text="还没有关注任何人，去发现一些创作者吧" icon="radio" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map((v) => (
            <Link key={v.id} to={`/video/${v.id}`} className="card" style={{ display: 'flex', gap: 12, padding: 10, alignItems: 'center' }}>
              <Cover src={v.cover_url || v.external_cover_url} alt="" style={{ width: 140, height: 79, objectFit: 'cover', borderRadius: 8, flexShrink: 0, background: '#222' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{v.title}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  {v.author_username} <VerBadge badge={v.author_verification_badge} label={v.author_verification_label} />
                  {' · '}{timeAgo(v.created_at as string)} · <I name="play" size={12} filled /> {fmtCount(v.views)}
                </div>
              </div>
            </Link>
          ))}
          {hasMore && !loading && <div style={{ textAlign: 'center' }}><button className="btn btn-sm" onClick={() => load()}>加载更多</button></div>}
          {loading && <Loading />}
        </div>
      )}
    </div>
  );
}
