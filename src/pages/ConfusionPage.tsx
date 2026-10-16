import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { videos } from '../lib/api';
import type { Video } from '../lib/types';
import { I } from '../components/icons';
import { Loading, Empty } from '../components/ui';
import { useToast, errMsg } from '../store/toast';
import { fmtViews } from '../lib/util';

const RANGES = [
  { v: 'all', l: '全部' },
  { v: 'day', l: '今天' },
  { v: 'week', l: '本周' },
  { v: 'month', l: '本月' },
  { v: 'year', l: '今年' },
];

export default function ConfusionPage() {
  const toast = useToast(s => s.push);
  const [range, setRange] = useState('all');
  const [page, setPage] = useState(1);
  const [list, setList] = useState<Video[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const perPage = 30;

  const load = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const d: any = await videos.confusionBoard({ page: p, per_page: perPage, range });
      const vids = d?.videos || d?.items || (Array.isArray(d) ? d : []);
      setList(vids);
      setTotalPages(Number(d?.total_pages ?? 1));
      setPage(p);
    } catch (e: any) {
      toast(errMsg(e, '排行榜加载失败'), 'error');
    } finally {
      setLoading(false);
    }
  }, [page, range, toast]);

  useEffect(() => { load(1); }, [range]); // eslint-disable-line

  return (
    <div className="page fade-in">
      <div className="section-head">
        <h1 className="page-title row" style={{ gap: 10 }}>
          <I name="question" size={26} style={{ color: 'var(--md-tertiary)' }} /> 何意味排行榜
        </h1>
        <button className="btn btn--tonal btn--sm" onClick={() => load()}><I name="refresh" size={15} /> 刷新</button>
      </div>
      <p className="page-sub">「何意味？」= 看不懂。给让你困惑的视频投上一票，看看全平台最让人迷惑的内容。</p>
      <div className="seg">
        {RANGES.map(r => (
          <button key={r.v} className={range === r.v ? 'active' : ''} onClick={() => setRange(r.v)} type="button">{r.l}</button>
        ))}
      </div>
      {loading ? <Loading /> : list.length === 0 ? (
        <Empty icon="question" title="暂无困惑内容" desc="快去投出你的第一票吧" />
      ) : (
        <div className="col" style={{ gap: 10 }}>
          {list.map((v, i) => (
            <div key={v.id} className="card confusion-card" style={{ cursor: 'pointer' }} onClick={() => window.location.assign(`/video/${v.id}`)}>
              <div className={`rank ${i < 3 ? 'top' : ''}`}>{i + 1}</div>
              <Link to={`/video/${v.id}`} style={{ width: 130, aspectRatio: '16/9', borderRadius: 10, overflow: 'hidden', flex: 'none', background: 'var(--md-surface-container)', display: 'block' }}>
                {v.cover_url && <img src={v.cover_url} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />}
              </Link>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link to={`/video/${v.id}`} className="clamp2" style={{ font: 'var(--text-title-sm)', lineHeight: 1.4 }}>{v.title}</Link>
                <div className="muted small" style={{ marginTop: 5 }}>{v.author_username} · {fmtViews(v.views)} 播放</div>
              </div>
              <div className="col" style={{ alignItems: 'flex-end', gap: 3 }}>
                <span className="confusion-count" style={{ color: 'var(--md-tertiary)' }}>{fmtViews(v.confusion_count)}</span>
                <span className="muted small">何意味</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {totalPages > 1 && (
        <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
          <button className="btn btn--tonal btn--sm" disabled={page <= 1} onClick={() => load(page - 1)}><I name="chevronL" size={16} /> 上一页</button>
          <span className="muted small">第 {page} / {totalPages} 页</span>
          <button className="btn btn--tonal btn--sm" disabled={page >= totalPages} onClick={() => load(page + 1)}>下一页 <I name="chevronR" size={16} /></button>
        </div>
      )}
    </div>
  );
}
