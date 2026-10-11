import { useEffect, useRef, useState } from 'react';
import { I } from '../icons';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { asArray, type Article, type Video } from '../types';
import { Cover, Empty, Loading, VideoCard } from '../components';
import { CATEGORY_NAMES } from '../lib/utils';
import { errMsg, toast } from '../store';

const SORTS = [
  { id: 'recommend', label: '推荐' },
  { id: 'latest', label: '最新' },
  { id: 'popular', label: '热门' },
];

export function HomePage() {
  const [sort, setSort] = useState('recommend');
  const [cat, setCat] = useState('All');
  const [videos, setVideos] = useState<Video[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offset = useRef(0);
  const sentinel = useRef<HTMLDivElement>(null);
  const page = 24;

  const load = async (reset: boolean) => {
    if (reset) { offset.current = 0; setVideos([]); setHasMore(true); }
    if (reset || !hasMore) { if (reset) setLoading(true); }
    try {
      const d = await api.videos({ category: cat, sort, limit: page, offset: offset.current });
      const arr = asArray<Video>(d);
      setVideos((prev) => (reset ? arr : [...prev, ...arr.filter((a) => !prev.some((p) => p.id === a.id))]));
      offset.current += arr.length;
      setHasMore(arr.length >= page);
    } catch (e) {
      toast(errMsg(e), 'err');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => { void load(true); }, [sort, cat]);

  useEffect(() => {
    api.homeArticles(8).then((d) => setArticles(asArray<Article>(d))).catch(() => {});
  }, []);

  // 无限滚动
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loading && !loadingMore && hasMore) {
        setLoadingMore(true);
        void load(false);
      }
    }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [loading, loadingMore, hasMore, sort, cat]);

  const navLinks = [
    { to: '/referendums', label: '社区公投' },
    { to: '/leaderboard', label: '何意味榜' },
    { to: '/trending', label: '热门' },
    { to: '/following', label: '关注动态' },
  ];

  return (
    <div className="page">
      <div className="chip-row" style={{ marginBottom: 10 }}>
        {navLinks.map((l) => (
          <Link key={l.to} to={l.to} className="chip">{l.label}</Link>
        ))}
      </div>
      <div className="chip-row" style={{ marginBottom: 14 }}>
        {SORTS.map((s) => (
          <button key={s.id} className={'chip' + (sort === s.id ? ' active' : '')} onClick={() => setSort(s.id)}>{s.label}</button>
        ))}
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 20, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontSize: 13 }}
        >
          <option value="All">全部分类</option>
          {CATEGORY_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? <Loading /> : videos.length === 0 ? <Empty text="暂无视频" icon="video" /> : (
        <div className="grid-videos">{videos.map((v) => <VideoCard key={v.id} v={v} />)}</div>
      )}
      <div ref={sentinel} />
      {loadingMore && <Loading />}
      {!hasMore && videos.length > 0 && <div className="muted" style={{ textAlign: 'center', padding: 16 }}>— 已经到底啦 —</div>}

      {articles.length > 0 && (
        <>
          <div className="section-title"><I name="file" size={15} /> 最新专栏</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {articles.map((a) => (
              <Link key={a.id} to={`/article/${a.id}`} className="card" style={{ display: 'flex', gap: 12, padding: 12 }}>
                {a.cover_url && <Cover src={a.cover_url} alt="" style={{ width: 110, height: 74, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{a.title}</div>
                  {a.summary && <div className="muted" style={{ marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.summary}</div>}
                  <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                    {a.author_username} · {a.created_at}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
