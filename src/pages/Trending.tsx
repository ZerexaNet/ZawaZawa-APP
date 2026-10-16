import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { videos } from '../lib/api';
import type { Video } from '../lib/types';
import { I } from '../components/icons';
import { asList } from '../lib/http';
import { errMsg } from '../store/toast';
import { fmtViews } from '../lib/util';

export default function Trending() {
  const [list, setList] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      let d: any;
      try {
        d = await videos.trending({ limit: 60 });
      } catch {
        d = await videos.list({ sort: 'hot', limit: 60 });
      }
      setList(asList<Video>(d));
    } catch (e: any) {
      setErr(errMsg(e, '热门列表加载失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="page fade-in">
      <div className="section-head">
        <h1 className="page-title row" style={{ gap: 10 }}>
          <I name="fireFill" size={26} style={{ color: 'var(--md-warning)' }} /> 热门趋势
        </h1>
        <button className="btn btn--tonal btn--sm" onClick={load}><I name="refresh" size={15} /> 刷新</button>
      </div>
      {loading ? (
        <div className="loading-center"><span className="spinner spinner--lg" /></div>
      ) : err ? (
        <div className="empty"><span className="muted">{err}</span><button className="btn btn--tonal btn--sm" onClick={load}>重试</button></div>
      ) : list.length === 0 ? (
        <div className="empty"><I name="flame" size={26} className="muted" /><span>暂无热门内容</span></div>
      ) : (
        <div className="col" style={{ gap: 12 }}>
          {list.map((v, i) => (
            <div key={v.id} className="row card" style={{ padding: 12, gap: 14, alignItems: 'center' }}>
              <div style={{ font: '700 22px/1 var(--font-sans)', width: 38, textAlign: 'center', color: i < 3 ? 'var(--md-warning)' : 'var(--md-outline)', flex: 'none', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</div>
              <Link to={`/video/${v.id}`} style={{ width: 'min(190px, 30vw)', flex: 'none' }}>
                <div style={{ aspectRatio: '16/9', borderRadius: 10, overflow: 'hidden', position: 'relative', background: 'var(--md-surface-container)' }}>
                  {v.cover_url && <img src={v.cover_url} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />}
                  {v.status === 'pending_review' && <span className="live-tag" style={{ position: 'absolute', left: 6, top: 6 }}>审核中</span>}
                </div>
              </Link>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link to={`/video/${v.id}`} className="clamp2" style={{ font: 'var(--text-title-sm)', lineHeight: 1.45 }}>{v.title}</Link>
                <div className="row muted small" style={{ marginTop: 6, gap: 6, flexWrap: 'wrap' }}>
                  <Link to={`/user/${v.author_uid ?? v.author_id}`}>{v.author_username}</Link>
                  <span>·</span><span>{fmtViews(v.views)} 播放</span>
                  <span>·</span><span>{fmtViews(v.likes)} 点赞</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
