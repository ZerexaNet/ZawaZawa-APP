import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { history } from '../lib/api';
import type { HistoryEntry } from '../lib/types';
import { Avatar, Btn, Empty, Loading, Switch, confirmDialog } from '../components/ui';
import { I } from '../components/icons';
import { useAuth } from '../store/auth';
import { useToast, errMsg } from '../store/toast';
import { asList, asTotal } from '../lib/http';
import { fmtDuration, timeAgo } from '../lib/util';

export default function HistoryPage() {
  const nav = useNavigate();
  const user = useAuth(s => s.user);
  const toast = useToast(s => s.push);
  const [list, setList] = useState<HistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [err, setErr] = useState('');
  const limit = 30;

  useEffect(() => {
    if (!user) nav('/login');
  }, [user, nav]);

  const load = useCallback(async (reset = false) => {
    setLoading(true);
    setErr('');
    try {
      const d: any = await history.list(limit, reset ? 0 : list.length);
      const items = asList<HistoryEntry>(d);
      setTotal(asTotal(d, items.length));
      setList(prev => reset ? items : [...prev, ...items.filter(x => !prev.some(p => p.history_id === x.history_id))]);
    } catch (e: any) {
      setErr(e?.status === 403 ? '观看历史已关闭' : errMsg(e, '历史加载失败'));
    } finally {
      setLoading(false);
    }
  }, [list.length]);

  useEffect(() => {
    if (user) load(true);
  }, [user]); // eslint-disable-line

  const toggle = async (v: boolean) => {
    setEnabled(v);
    try {
      await history.settings(v);
      toast(v ? '已开启观看历史' : '已关闭观看历史', 'success');
      if (v) load(true);
    } catch (e: any) { setEnabled(!v); toast(errMsg(e), 'error'); }
  };

  const delOne = async (h: HistoryEntry) => {
    try {
      await history.removeEntry(h.history_id);
      setList(prev => prev.filter(x => x.history_id !== h.history_id));
      toast('已移除该记录', 'success');
    } catch (e: any) { toast(errMsg(e), 'error'); }
  };

  const clearAll = async () => {
    const ok = await confirmDialog({ title: '清空历史', message: '确定清空全部观看历史吗？此操作不可恢复。', okText: '清空', danger: true });
    if (!ok) return;
    try {
      await history.clear();
      setList([]);
      setTotal(0);
      toast('历史已清空', 'success');
    } catch (e: any) { toast(errMsg(e), 'error'); }
  };

  return (
    <div className="page fade-in">
      <div className="section-head" style={{ flexWrap: 'wrap' }}>
        <h1 className="page-title row" style={{ gap: 8 }}><I name="history" size={24} /> 观看历史</h1>
        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          <Switch checked={enabled} onChange={toggle} label="记录观看历史" />
          <span className="muted small">记录观看历史</span>
          {list.length > 0 && <Btn variant="danger-text" size="sm" onClick={clearAll}><I name="trash" size={15} /> 清空全部</Btn>}
        </div>
      </div>

      {loading ? <Loading /> : err ? (
        <Empty icon="clock" title={err} desc={err === '观看历史已关闭' ? '开启右上角开关后继续记录' : ''} />
      ) : list.length === 0 ? (
        <Empty icon="clock" title="暂无观看历史" desc="看过 20% 以上的视频会自动记录" />
      ) : (
        <div className="col" style={{ gap: 4 }}>
          {list.map(h => (
            <div key={h.history_id} className="history-row">
              <Link to={`/video/${h.id}`} style={{ width: 168, flex: 'none', aspectRatio: '16/9', borderRadius: 10, overflow: 'hidden', background: 'var(--md-surface-container)', display: 'block' }}>
                {h.cover_url && <img className="h-thumb" src={h.cover_url} loading="lazy" decoding="async" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </Link>
              <div className="h-info col" style={{ gap: 5 }}>
                <Link to={`/video/${h.id}`} className="clamp2" style={{ font: 'var(--text-title-sm)', lineHeight: 1.4 }}>{h.title}</Link>
                <div className="row muted small" style={{ gap: 6, flexWrap: 'wrap' }}>
                  <Avatar user={{ gravatar_url: h.author_gravatar_url, username: h.author_username }} size={20} />
                  <span>{h.author_username}</span>
                  <span>·</span>
                  <span>{timeAgo(h.watched_at)}</span>
                  {h.watch_seconds && h.video_seconds
                    ? <span>· 看了 {fmtDuration(h.watch_seconds)} / {fmtDuration(h.video_seconds)}（{Math.round((h.watch_seconds / h.video_seconds) * 100)}%）</span>
                    : null}
                </div>
              </div>
              <button className="icon-btn" title="删除该记录" onClick={() => delOne(h)}><I name="trash" size={18} /></button>
            </div>
          ))}
          {list.length < total && (
            <div className="center" style={{ padding: '12px 0' }}>
              <Btn variant="tonal" size="sm" onClick={() => load()}>加载更多（还有 {total - list.length} 条）</Btn>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
