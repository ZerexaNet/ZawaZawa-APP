import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collections, users } from '../lib/api';
import type { Collection, CollectionItem } from '../lib/types';
import { Btn, Dialog, Empty, Field, Loading, Spinner, confirmDialog } from '../components/ui';
import { I } from '../components/icons';
import { useAuth } from '../store/auth';
import { useToast, errMsg } from '../store/toast';
import { asList } from '../lib/http';
import { fmtDuration, timeAgo } from '../lib/util';

export default function CollectionsPage() {
  const nav = useNavigate();
  const user = useAuth(s => s.user);
  const toast = useToast(s => s.push);
  const [list, setList] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!user) nav('/login'); }, [user, nav]);

  const load = useCallback(() => {
    setLoading(true);
    users.meCollections().then((d: any) => setList(asList<Collection>(d))).catch(() => { }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!newTitle.trim()) return;
    setBusy(true);
    try {
      await collections.create({ title: newTitle.trim(), description: newDesc.trim() });
      setCreateOpen(false);
      setNewTitle(''); setNewDesc('');
      toast('合集已创建', 'success');
      load();
    } catch (e: any) { toast(errMsg(e), 'error'); }
    finally { setBusy(false); }
  };

  const delCol = async (c: Collection) => {
    const ok = await confirmDialog({ title: '删除合集', message: `确定删除合集「${c.title}」吗？（不会删除视频本身）`, okText: '删除', danger: true });
    if (!ok) return;
    try {
      await collections.remove(c.id);
      toast('已删除', 'success');
      load();
    } catch (e: any) { toast(errMsg(e), 'error'); }
  };

  return (
    <div className="page fade-in">
      <div className="section-head">
        <h1 className="page-title row" style={{ gap: 8 }}><I name="folder" size={24} /> 我的合集</h1>
        <Btn variant="tonal" size="sm" onClick={() => setCreateOpen(true)}><I name="plus" size={15} /> 新建合集</Btn>
      </div>
      {loading ? <Loading /> : list.length === 0 ? (
        <Empty icon="folder" title="还没有合集" desc="创建合集来整理你收藏的视频" />
      ) : (
        <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          {list.map(c => (
            <div key={c.id} className="card collection-card card--hover" onClick={() => nav(`/collections/${c.id}`)}>
              <div className="row row--between" style={{ gap: 8 }}>
                <span className="c-title"><I name="folder" size={17} className="muted" /> <span className="clamp1">{c.title}</span></span>
                <button className="icon-btn icon-btn--sm" onClick={e => { e.stopPropagation(); delCol(c); }} aria-label="删除合集"><I name="trash" size={15} /></button>
              </div>
              {c.description && <div className="muted small clamp1" style={{ margin: '4px 0' }}>{c.description}</div>}
              <div className="c-count">{c.item_count ?? c.video_count ?? 0} 个视频{c.created_at ? ` · ${timeAgo(c.created_at)}` : ''}</div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="新建合集"
        actions={
          <>
            <Btn variant="text" onClick={() => setCreateOpen(false)}>取消</Btn>
            <Btn variant="filled" onClick={create} disabled={busy || !newTitle.trim()}>{busy ? <Spinner size={15} /> : <I name="check" size={15} />} 创建</Btn>
          </>
        }
      >
        <Field label="合集名称 *"><input value={newTitle} onChange={e => setNewTitle(e.target.value)} maxLength={50} placeholder="例如：2026 年度学习清单" autoFocus /></Field>
        <Field label="描述（可选）"><textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} maxLength={200} /></Field>
      </Dialog>
    </div>
  );
}

export function CollectionDetail() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const toast = useToast(s => s.push);
  const [col, setCol] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [t, setT] = useState('');
  const [d, setD] = useState('');

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    collections.detail(id).then((x: any) => setCol(x?.collection ?? x)).catch(e => setErr(errMsg(e))).finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const saveEdit = async () => {
    try {
      await collections.update(id!, { title: t, description: d });
      setEditOpen(false);
      toast('已保存', 'success');
      load();
    } catch (e: any) { toast(errMsg(e), 'error'); }
  };
  const removeItem = async (item: CollectionItem) => {
    try {
      await collections.removeItem(id!, item.id!);
      toast('已移出合集', 'success');
      load();
    } catch (e: any) { toast(errMsg(e), 'error'); }
  };

  if (loading) return <Loading />;
  if (err || !col) {
    return <Empty icon="folder" title={err || '合集不存在'} />;
  }
  const items: CollectionItem[] = col.items || [];

  return (
    <div className="page fade-in">
      <button className="btn btn--text btn--sm" onClick={() => nav('/collections')}><I name="back" size={16} /> 返回我的合集</button>
      <div className="card" style={{ padding: 20 }}>
        <div className="row row--between" style={{ gap: 10, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <h1 className="row" style={{ gap: 8, font: 'var(--text-headline-sm)' }}><I name="folder" size={22} className="muted" /> {col.title}</h1>
            {col.description && <p className="muted" style={{ marginTop: 6, lineHeight: 1.6 }}>{col.description}</p>}
            <div className="muted small" style={{ marginTop: 8 }}>{items.length} 个视频{col.created_at ? ` · 创建于 ${timeAgo(col.created_at)}` : ''}</div>
          </div>
          <Btn variant="tonal" size="sm" onClick={() => { setT(col.title); setD(col.description || ''); setEditOpen(true); }}><I name="edit" size={15} /> 编辑</Btn>
        </div>
      </div>

      {items.length === 0 ? <Empty icon="film" title="合集里还没有视频" desc="在视频页「收藏 → 加入合集」添加" /> : (
        <div className="col" style={{ gap: 6 }}>
          {items.map((it, i) => (
            <div key={it.id || it.video_id} className="card row" style={{ padding: '10px 14px', gap: 14, alignItems: 'center', cursor: 'pointer' }} onClick={() => nav(`/video/${it.video_id}`)}>
              <span className="ci-part" style={{ font: 'var(--text-label-md)', color: 'var(--md-outline)', width: 28, textAlign: 'center' }}>{i + 1}</span>
              {it.cover_url && <img src={it.cover_url} loading="lazy" style={{ width: 132, aspectRatio: '16/9', borderRadius: 8, objectFit: 'cover', flex: 'none' }} alt="" />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ci-title clamp2">{it.part_title || it.title || '未命名视频'}</div>
                {it.duration && <div className="muted small" style={{ marginTop: 3 }}>时长 {typeof it.duration === 'number' ? fmtDuration(it.duration) : it.duration}</div>}
              </div>
              {it.id && <button className="icon-btn" title="移出合集" onClick={e => { e.stopPropagation(); removeItem(it); }}><I name="x" size={17} /></button>}
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="编辑合集"
        actions={<><Btn variant="text" onClick={() => setEditOpen(false)}>取消</Btn><Btn variant="filled" onClick={saveEdit}>保存</Btn></>}
      >
        <Field label="名称"><input value={t} onChange={e => setT(e.target.value)} maxLength={50} /></Field>
        <Field label="描述"><textarea value={d} onChange={e => setD(e.target.value)} maxLength={200} /></Field>
      </Dialog>
    </div>
  );
}
