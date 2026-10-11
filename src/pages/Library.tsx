import { useCallback, useEffect, useState } from 'react';
import { I } from '../icons';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { asArray, type Collection, type FavoriteEntry, type HistoryEntry, type Video } from '../types';
import { Avatar, Confirm, Cover, Empty, Loading, Modal, VideoCard, VerBadge } from '../components';
import { errMsg, toast, useAuth } from '../store';
import { fmtCount, timeAgo } from '../lib/utils';

function requireLogin(user: unknown, nav: (p: string) => void) {
  if (!user) nav('/login');
}

// ============ 历史记录 ============
export function HistoryPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [list, setList] = useState<HistoryEntry[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [showClear, setShowClear] = useState(false);

  useEffect(() => { requireLogin(user, nav); }, [user, nav]);

  const load = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const d = await api.history(30, reset ? 0 : offset);
      const o = d as { enabled?: boolean } & (HistoryEntry[] | { items: HistoryEntry[] });
      if (typeof o.enabled === 'boolean') setEnabled(o.enabled);
      const arr = asArray<HistoryEntry>(d);
      setList((prev) => (reset ? arr : [...prev, ...arr.filter((a) => !prev.some((p) => p.history_id === a.history_id))]));
      setOffset(reset ? arr.length : offset + arr.length);
      setHasMore(arr.length >= 30);
    } catch (e) { toast(errMsg(e), 'err'); } finally { setLoading(false); }
  }, [offset]);

  useEffect(() => { if (user) void load(true); }, [user, load]);

  const toggleSetting = async () => {
    const next = !enabled;
    setEnabled(next);
    try { await api.historySettings(next); toast(next ? '已开启历史记录' : '已关闭历史记录'); } catch (e) { setEnabled(!next); toast(errMsg(e), 'err'); }
  };

  if (!user) return null;

  return (
    <div className="page" style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="flex between" style={{ marginBottom: 14 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}><I name="clock" size={18} /> 观看历史</h1>
        <div className="flex">
          <label className="flex" style={{ gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={enabled} onChange={toggleSetting} /> 记录历史
          </label>
          {list.length > 0 && <button className="btn btn-sm btn-danger" onClick={() => setShowClear(true)}>清空</button>}
        </div>
      </div>
      {loading && list.length === 0 ? <Loading /> : list.length === 0 ? <Empty text="暂无观看历史" icon="clock" /> : (
        <div className="card" style={{ padding: 6 }}>
          {list.map((h) => (
            <div key={h.history_id} className="row-item">
              <Link to={`/video/${h.id || h.history_id}`}>
                <Cover src={h.cover_url} alt="" className="thumb-48" />
              </Link>
              <div className="grow" style={{ minWidth: 0 }}>
                <Link to={`/video/${h.id || h.history_id}`} style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                  {h.title}
                </Link>
                <div className="desc">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Avatar name={h.author_username || ''} size={16} url={h.author_gravatar_url} />
                    {h.author_username} <VerBadge badge={h.author_verification_badge} label={h.author_verification_label} />
                  </span>
                  {' · '}{timeAgo(h.watched_at as string)}
                  {typeof h.watch_seconds === 'number' && h.watch_seconds > 0 && <span> · 看了 {Math.floor(h.watch_seconds / 60)} 分钟</span>}
                </div>
              </div>
              <button className="btn btn-sm btn-ghost" onClick={async () => {
                try {
                  await api.historyRemove(h.history_id);
                  setList((prev) => prev.filter((x) => x.history_id !== h.history_id));
                } catch (e) { toast(errMsg(e), 'err'); }
              }}>删除</button>
            </div>
          ))}
          {hasMore && !loading && <div style={{ textAlign: 'center', padding: 10 }}><button className="btn btn-sm" onClick={() => load()}>加载更多</button></div>}
        </div>
      )}
      {showClear && (
        <Confirm title="清空历史" text="确定清空全部观看历史吗？" danger okText="清空"
          onOk={async () => {
            try { await api.historyClear(); setList([]); toast('已清空'); } catch (e) { toast(errMsg(e), 'err'); }
          }}
          onClose={() => setShowClear(false)} />
      )}
    </div>
  );
}

// ============ 收藏 ============
export function FavoritesPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [list, setList] = useState<FavoriteEntry[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => { requireLogin(user, nav); }, [user, nav]);

  const load = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const d = await api.favorites(24, reset ? 0 : offset);
      const arr = asArray<FavoriteEntry>(d);
      setList((prev) => (reset ? arr : [...prev, ...arr.filter((a) => !prev.some((p) => p.id === a.id))]));
      setOffset(reset ? arr.length : offset + arr.length);
      setHasMore(arr.length >= 24);
    } catch (e) { toast(errMsg(e), 'err'); } finally { setLoading(false); }
  }, [offset]);

  useEffect(() => { if (user) void load(true); }, [user, load]);
  if (!user) return null;

  return (
    <div className="page">
      <h1 style={{ fontSize: 20, marginBottom: 14 }}><I name="star" size={18} /> 我的收藏</h1>
      {loading && list.length === 0 ? <Loading /> : list.length === 0 ? <Empty text="还没有收藏任何视频" icon="star" /> : (
        <>
          <div className="grid-videos">
            {list.map((v) => (
              <div key={v.id} style={{ position: 'relative' }}>
                <VideoCard v={v} />
                {v.favorited_at && <span className="muted" style={{ position: 'absolute', top: 8, right: 8, fontSize: 11, background: 'rgba(0,0,0,.5)', color: '#fff', padding: '1px 6px', borderRadius: 6 }}>{timeAgo(v.favorited_at)}</span>}
              </div>
            ))}
          </div>
          {hasMore && !loading && <div style={{ textAlign: 'center', marginTop: 14 }}><button className="btn btn-sm" onClick={() => load()}>加载更多</button></div>}
        </>
      )}
    </div>
  );
}

// ============ 合集 ============
export function CollectionsPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [list, setList] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const showNew = params.get('new') === '1';

  const load = useCallback(async () => {
    setLoading(true);
    try { setList(asArray<Collection>(await api.myCollections())); } catch (e) { toast(errMsg(e), 'err'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { requireLogin(user, nav); }, [user, nav]);
  useEffect(() => { if (user) void load(); }, [user, load]);

  const create = async () => {
    if (!newTitle.trim()) return;
    setBusy(true);
    try {
      const r = await api.collectionCreate(newTitle.trim(), newDesc.trim() || undefined);
      toast('合集已创建');
      setNewTitle(''); setNewDesc('');
      params.delete('new');
      setParams(params, { replace: true });
      await load();
      const id = (r as { id?: string })?.id;
      if (id) nav(`/collection/${id}`);
    } catch (e) { toast(errMsg(e), 'err'); } finally { setBusy(false); }
  };

  if (!user) return null;

  return (
    <div className="page" style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="flex between" style={{ marginBottom: 14 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}><I name="folder" size={18} /> 我的合集</h1>
        {!showNew && <button className="btn btn-sm btn-primary" onClick={() => { params.set('new', '1'); setParams(params); }}>＋ 新建合集</button>}
      </div>
      {showNew && (
        <div className="card" style={{ padding: 18, marginBottom: 14 }}>
          <div className="field"><label>合集名称</label><input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} maxLength={50} placeholder="例如：我的音乐合集" /></div>
          <div className="field"><label>描述（可选）</label><input type="text" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} maxLength={200} /></div>
          <div className="flex">
            <button className="btn" onClick={() => { params.delete('new'); setParams(params); }}>取消</button>
            <button className="btn btn-primary" disabled={busy || !newTitle.trim()} onClick={create}>{busy ? '创建中…' : '创建'}</button>
          </div>
        </div>
      )}
      {loading ? <Loading /> : list.length === 0 ? <Empty text="还没有合集，创建一个吧" icon="folder" /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
          {list.map((c) => (
            <Link key={c.id} to={`/collection/${c.id}`} className="card" style={{ padding: 16, textAlign: 'center' }}>
              <div style={{ display: 'flex' }}><I name="folder" size={34} /></div>
              <div style={{ fontWeight: 700, marginTop: 6 }}>{c.title}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{c.video_count ?? c.items?.length ?? 0} 个视频</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function CollectionDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const [col, setCol] = useState<Collection | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [targetVideo, setTargetVideo] = useState('');
  const [partTitle, setPartTitle] = useState('');
  const [myVideos, setMyVideos] = useState<Video[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.collectionDetail(id).then((c) => {
      setCol(c);
      // 补充 item 的视频详情
      const items = c.items || [];
      Promise.all(items.map((it) => api.video(it.video_id).catch(() => null))).then((vs) => {
        setCol({ ...c, items: items.map((it, i) => ({ ...it, video: vs[i] ?? undefined })) });
      });
    }).catch((e) => {
      if ((e as { status?: number }).status === 404) setNotFound(true);
      else toast(errMsg(e), 'err');
    });
  }, [id]);

  const loadMyVideos = async () => {
    try { setMyVideos(asArray<Video>(await api.myVideos(50, 0))); } catch { /* ignore */ }
  };

  const add = async () => {
    if (!targetVideo) return;
    setBusy(true);
    try {
      await api.collectionAddItem(id, targetVideo, partTitle.trim() || undefined);
      toast('已添加到合集');
      setShowAdd(false);
      setTargetVideo(''); setPartTitle('');
      setCol(await api.collectionDetail(id));
    } catch (e) { toast(errMsg(e), 'err'); } finally { setBusy(false); }
  };

  const remove = async (videoId: string) => {
    try {
      await api.collectionRemoveItem(id, videoId);
      toast('已移除');
      const c = await api.collectionDetail(id);
      Promise.all((c.items || []).map((it) => api.video(it.video_id).catch(() => null))).then((vs) => {
        setCol({ ...c, items: (c.items || []).map((it, i) => ({ ...it, video: vs[i] ?? undefined })) });
      });
    } catch (e) { toast(errMsg(e), 'err'); }
  };

  if (notFound) return <div className="page"><Empty text="合集不存在" icon="folder" /></div>;
  if (!col) return <div className="page"><Loading /></div>;

  const isOwner = user && String((col as never as { author_id?: string }).author_id) === String(user.id) || (col as never as { user_id?: string }).user_id === user?.id;

  return (
    <div className="page" style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="flex between" style={{ marginBottom: 14, alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 20, margin: 0 }}><I name="folder" size={18} /> {col.title}</h1>
          {col.description && <div className="muted" style={{ fontSize: 13 }}>{col.description}</div>}
        </div>
        {isOwner && <button className="btn btn-sm btn-primary" onClick={() => { setShowAdd(true); void loadMyVideos(); }}>＋ 添加视频</button>}
      </div>
      {(col.items || []).length === 0 ? <Empty text="合集还是空的" icon="folder" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(col.items || []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((it, i) => (
            <div key={it.video_id} className="card" style={{ display: 'flex', gap: 12, padding: 10, alignItems: 'center' }}>
              <div style={{ width: 26, textAlign: 'center', fontWeight: 800, color: 'var(--ink-3)' }}>{i + 1}</div>
              <Link to={`/video/${it.video_id}`}><Cover src={it.video?.cover_url || it.video?.external_cover_url} alt="" className="thumb-48" style={{ width: 110, height: 62 }} /></Link>
              <div className="grow" style={{ minWidth: 0 }}>
                <Link to={`/video/${it.video_id}`} style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                  {it.part_title || it.video?.title || '视频'}
                </Link>
                <div className="muted" style={{ fontSize: 12 }}>{it.video?.author_username} · <I name="play" size={12} filled /> {fmtCount(it.video?.views)}</div>
              </div>
              {isOwner && <button className="btn btn-sm btn-danger" onClick={() => remove(it.video_id)}>移除</button>}
            </div>
          ))}
        </div>
      )}
      {showAdd && (
        <Modal title="添加视频到合集" onClose={() => setShowAdd(false)} foot={
          <>
            <button className="btn" onClick={() => setShowAdd(false)}>取消</button>
            <button className="btn btn-primary" disabled={busy || !targetVideo} onClick={add}>{busy ? '添加中…' : '添加'}</button>
          </>
        }>
          <div className="field">
            <label>选择我的视频</label>
            <select value={targetVideo} onChange={(e) => setTargetVideo(e.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)' }}>
              <option value="">请选择…</option>
              {myVideos.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
            </select>
          </div>
          <div className="field"><label>分P标题（可选）</label><input type="text" value={partTitle} onChange={(e) => setPartTitle(e.target.value)} maxLength={50} /></div>
        </Modal>
      )}
    </div>
  );
}
