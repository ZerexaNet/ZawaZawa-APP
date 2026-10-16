import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { videos, articles as articlesApi } from '../lib/api';
import type { Article, Video } from '../lib/types';
import { VideoCard } from '../components/VideoCard';
import { Chip, Loading, useInfinite, Skeleton } from '../components/ui';
import { I } from '../components/icons';
import { CATEGORY_NAMES } from '../lib/categories';
import { asList, asTotal } from '../lib/http';
import { fmtViews, timeAgo } from '../lib/util';

const SORTS = [
  { v: 'recommend', label: '推荐' },
  { v: 'latest', label: '最新' },
];

export default function Home() {
  const [sort, setSort] = useState('recommend');
  const [cat, setCat] = useState('All');
  const [videosList, setVideosList] = useState<Video[]>([]);
  const [total, setTotal] = useState(0);
  const [artList, setArtList] = useState<Article[]>([]);

  const loadArt = useCallback(() => {
    articlesApi.homeLatest(6).then((d: any) => setArtList(asList<Article>(d))).catch(() => { });
  }, []);
  useEffect(() => { loadArt(); }, [loadArt]);

  const [loadStatus, setLoadStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [retry, setRetry] = useState(0);

  const onLoad = useCallback(async () => {
    try {
      const offset = videosList.length;
      const d: any = await videos.list({ category: cat, sort, limit: 24, offset });
      const items = asList<Video>(d);
      setTotal(asTotal(d, -1));
      setVideosList(prev => [...prev, ...items.filter(v => !prev.some(p => p.id === v.id))]);
      setLoadStatus('ok');
      return items.length > 0;
    } catch {
      setLoadStatus('error');
      return false;
    }
  }, [cat, sort, videosList.length]);

  const inf = useInfinite(onLoad, [cat, sort, retry]);

  // 切换分类/排序时重置
  useEffect(() => { setVideosList([]); setLoadStatus('idle'); }, [cat, sort]);

  return (
    <div className="page fade-in">
      <div className="row row--between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <h1 className="page-title">ZawaZawa</h1>
        <div className="seg">
          {SORTS.map(s => (
            <button key={s.v} className={sort === s.v ? 'active' : ''} onClick={() => setSort(s.v)} type="button">{s.label}</button>
          ))}
        </div>
      </div>

      <div className="chip-row">
        <Chip selected={cat === 'All'} onClick={() => setCat('All')}>全部</Chip>
        {CATEGORY_NAMES.map(c => (
          <Chip key={c} selected={cat === c} onClick={() => setCat(c)}>{c}</Chip>
        ))}
      </div>

      {videosList.length > 0 ? (
        <div className="video-grid">
          {videosList.map(v => <VideoCard key={v.id} v={v} />)}
        </div>
      ) : loadStatus === 'error' ? (
        <div className="col" style={{ gap: 12, alignItems: 'center', padding: '60px 0' }}>
          <I name="alert" size={40} className="muted" />
          <div style={{ font: 'var(--text-title-sm)' }}>加载失败</div>
          <p className="muted small" style={{ margin: 0 }}>网络异常或接口无响应</p>
          <button className="btn btn--tonal btn--sm" onClick={() => { setVideosList([]); setLoadStatus('idle'); setRetry(r => r + 1); }}>
            <I name="refresh" size={15} /> 重试
          </button>
        </div>
      ) : loadStatus === 'ok' ? (
        <div className="col" style={{ gap: 12, alignItems: 'center', padding: '60px 0' }}>
          <I name="film" size={40} className="muted" />
          <div style={{ font: 'var(--text-title-sm)' }}>暂无内容</div>
          <p className="muted small" style={{ margin: 0 }}>该分类 / 排序下暂时没有视频</p>
        </div>
      ) : (
        <div className="col" style={{ gap: 10 }}>
          {[0, 1, 2, 3].map(i => <Skeleton key={i} w="100%" h={300} r={18} />)}
        </div>
      )}
      {inf.sentinelEl}
      {inf.loading && <Loading text="加载更多…" />}
      {!inf.loading && inf.done && total >= 0 && videosList.length > 0 && (
        <div className="center muted small" style={{ padding: 16 }}>— 已经到底了 —</div>
      )}

      {artList.length > 0 && (
        <section className="section" style={{ marginTop: 8 }}>
          <div className="section-head">
            <h2 className="row" style={{ gap: 8 }}><I name="newspaper" size={19} /> 最新专栏</h2>
          </div>
          <div className="rail">
            {artList.map(a => (
              <Link key={a.id} to={`/article/${a.id}`} className="card card--hover" style={{ padding: 12, display: 'block' }}>
                <div style={{ aspectRatio: '16/9', borderRadius: 10, overflow: 'hidden', marginBottom: 10, background: 'var(--md-surface-container)' }}>
                  {a.cover_url ? <img src={a.cover_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--md-outline)' }}><I name="newspaper" size={26} /></div>}
                </div>
                <div className="clamp2" style={{ font: 'var(--text-title-sm)', lineHeight: 1.4 }}>{a.title}</div>
                <div className="row muted small" style={{ marginTop: 8, gap: 6 }}>
                  <span>{a.author_username}</span><span>·</span>
                  <span>{fmtViews(a.views)} 阅读</span><span>·</span>
                  <span>{timeAgo(a.created_at)}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
