import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { admin, videos as videosApi } from '../lib/api';
import type { AuditItem, Ticket, User, Video } from '../lib/types';
import { Avatar, Btn, Dialog, Empty, Field, Loading, Spinner, VBadge, confirmDialog } from '../components/ui';
import { I } from '../components/icons';
import { useAuth } from '../store/auth';
import { useToast, errMsg } from '../store/toast';
import { asList } from '../lib/http';
import { fmtDateTime, fmtNum, timeAgo } from '../lib/util';

const TABS = [
  { key: 'audit', label: '内容审核', icon: 'shield', roles: ['admin', 'video_moderation'] },
  { key: 'reports', label: '举报处理', icon: 'flag', roles: ['admin', 'video_moderation'] },
  { key: 'comments', label: '评论审核', icon: 'message', roles: ['admin', 'content_review'] },
  { key: 'verifications', label: '认证审核', icon: 'award', roles: ['admin'] },
  { key: 'tickets', label: '工单', icon: 'ticket', roles: ['admin'] },
  { key: 'users', label: '用户管理', icon: 'users', roles: ['admin'] },
  { key: 'videos', label: '视频管理', icon: 'film', roles: ['admin'] },
  { key: 'announcements', label: '公告', icon: 'megaphone', roles: ['admin'] },
  { key: 'referendums', label: '公投', icon: 'poll', roles: ['admin'] },
  { key: 'messages', label: '站内信', icon: 'mail', roles: ['admin'] },
];

export default function AdminPage() {
  const nav = useNavigate();
  const user = useAuth(s => s.user);
  const role = user?.role || '';
  const visible = TABS.filter(t => t.roles.includes(role) || role === 'admin');
  const [tab, setTab] = useState(visible[0]?.key || 'audit');

  // 角色解析完成/变化后，若当前 tab 不可见则切回第一个可见 tab（避免越权请求）
  useEffect(() => {
    if (visible.length && !visible.some(t => t.key === tab)) setTab(visible[0].key);
  }, [role]); // eslint-disable-line

  if (!user) return <RedirectLogin />;
  if (!['admin', 'video_moderation', 'content_review'].includes(role)) {
    return (
      <div className="empty" style={{ padding: 80 }}>
        <I name="lock" size={28} className="muted" />
        <div style={{ font: 'var(--text-title-md)' }}>没有管理权限</div>
        <Btn variant="tonal" onClick={() => nav('/')}>返回首页</Btn>
      </div>
    );
  }

  return (
    <div className="page fade-in">
      <h1 className="page-title row" style={{ gap: 8 }}><I name="shield" size={24} /> 管理后台</h1>
      <div className="admin-layout">
        <nav className="admin-nav">
          {visible.map(t => (
            <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
              <I name={t.icon} size={18} /> {t.label}
            </button>
          ))}
        </nav>
        <div style={{ minWidth: 0 }}>
          {tab === 'audit' && <AuditTab />}
          {tab === 'reports' && <ReportsTab />}
          {tab === 'comments' && <CommentsTab />}
          {tab === 'verifications' && <VerificationsTab />}
          {tab === 'tickets' && <TicketsTab />}
          {tab === 'users' && <UsersTab />}
          {tab === 'videos' && <VideosTab />}
          {tab === 'announcements' && <AnnouncementsTab />}
          {tab === 'referendums' && <ReferendumsTab />}
          {tab === 'messages' && <MessagesTab />}
        </div>
      </div>
    </div>
  );
}

function RedirectLogin() {
  useEffect(() => { location.href = '/login?next=' + encodeURIComponent(location.pathname); }, []);
  return <Loading />;
}

/* ================= 内容审核 ================= */
function AuditTab() {
  const toast = useToast(s => s.push);
  const [items, setItems] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<any>(null);
  const [detail, setDetail] = useState<AuditItem | null>(null);
  const [opinion, setOpinion] = useState('');
  const [geoBlock, setGeoBlock] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      admin.auditList({ limit: 50 }).catch(() => null),
      admin.auditReport().catch(() => null),
    ]).then(([d1, d2]) => {
      setItems(asList<AuditItem>(d1));
      setReport(d2);
    }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const claim = async (it: AuditItem) => {
    try {
      await admin.auditClaim({ item_id: it.id, item_type: it.item_type || 'video' });
      toast('已认领', 'success');
      load();
    } catch (e: any) { toast(errMsg(e), 'error'); }
  };
  const review = async (status: 'approved' | 'rejected') => {
    if (!detail) return;
    if (status === 'rejected' && !opinion.trim()) { toast('请填写拒绝理由', 'info'); return; }
    setBusy(true);
    try {
      await admin.auditReview({
        item_id: detail.id,
        item_type: detail.item_type || 'video',
        video_id: detail.item_type === 'video' ? detail.video_id || detail.id : undefined,
        status,
        reason: opinion.trim() || undefined,
        geo_block: status === 'approved' && geoBlock ? geoBlock : null,
      });
      toast(status === 'approved' ? '已通过' : '已拒绝', 'success');
      setDetail(null);
      setOpinion('');
      setGeoBlock('');
      load();
    } catch (e: any) { toast(errMsg(e), 'error'); }
    finally { setBusy(false); }
  };

  const openDetail = async (it: AuditItem) => {
    setDetail(it);
    setOpinion('');
    setGeoBlock('');
    if (it.item_type === 'video') {
      try {
        const d: any = await videosApi.detail(it.video_id || it.id);
        const v = d?.video ?? d;
        setDetail(x => x && { ...x, video: v });
      } catch { /* 已删除 */ }
    }
  };

  return (
    <div className="col" style={{ gap: 12 }}>
      {report && (
        <div className="stat-cards">
          <div className="card stat-card"><div className="sv">{fmtNum(report.pending ?? report.pending_count)}</div><div className="sl">待审核</div></div>
          <div className="card stat-card"><div className="sv">{fmtNum(report.today_approved ?? report.approved_today)}</div><div className="sl">今日通过</div></div>
          <div className="card stat-card"><div className="sv">{fmtNum(report.today_rejected ?? report.rejected_today)}</div><div className="sl">今日拒绝</div></div>
          <div className="card stat-card"><div className="sv">{fmtNum(report.avg_minutes ?? report.avg_time)}</div><div className="sl">平均耗时(分)</div></div>
        </div>
      )}
      {loading ? <Loading /> : items.length === 0 ? <Empty icon="checkCircle" title="审核队列已清空" /> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>ID</th><th>类型</th><th>标题</th><th>作者</th><th>状态</th><th>时间</th><th>操作</th></tr></thead>
            <tbody>
              {items.map(it => (
                <tr key={it.id}>
                  <td className="code">{String(it.id).slice(0, 8)}</td>
                  <td>{it.item_type === 'article' ? '专栏' : '视频'}</td>
                  <td style={{ maxWidth: 260 }}><span className="clamp1">{it.title || it.moderation_opinion || '（无标题）'}</span></td>
                  <td>{it.author_username || it.author_id?.slice(0, 8)}</td>
                  <td><StatusTag s={it.status} /></td>
                  <td className="muted small">{timeAgo(it.created_at)}</td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      <button className="icon-btn icon-btn--sm" title="查看" onClick={() => openDetail(it)}><I name="eye" size={16} /></button>
                      {it.status === 'pending_review' && !it.claimed_by && (
                        <button className="icon-btn icon-btn--sm" title="认领" onClick={() => claim(it)}><I name="hand" size={16} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!detail} onClose={() => setDetail(null)} title="审核详情" wide>
        {detail && (
          <>
            {'video' in detail && detail.video ? (
              <div className="col" style={{ gap: 10 }}>
                <div style={{ aspectRatio: '16/9', borderRadius: 12, overflow: 'hidden', background: '#000' }}>
                  {detail.video.cover_url && <img src={detail.video.cover_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />}
                </div>
                <div style={{ font: 'var(--text-title-md)' }}>{detail.video.title}</div>
                <div className="muted small">{detail.video.author_username} · {detail.video.views ?? 0} 播放 · {detail.video.category}</div>
                {detail.video.description && <div className="card" style={{ padding: 12, whiteSpace: 'pre-wrap', fontSize: 13.5, maxHeight: 160, overflowY: 'auto' }}>{detail.video.description}</div>}
                {detail.video.source_url && <a className="small" style={{ color: 'var(--md-primary)', wordBreak: 'break-all' }} href={detail.video.source_url} target="_blank" rel="noreferrer">{detail.video.source_url}</a>}
              </div>
            ) : (
              <div style={{ font: 'var(--text-title-md)' }}>{detail.title || `审核项 ${String(detail.id).slice(0, 8)}`}</div>
            )}
            <Field label="审核意见（拒绝时必填）"><textarea value={opinion} onChange={e => setOpinion(e.target.value)} maxLength={300} placeholder="写给创作者的反馈…" /></Field>
            <div className="row" style={{ gap: 12, alignItems: 'center' }}>
              <span style={{ font: 'var(--text-label-lg)' }}>通过并地区限制：</span>
              <select value={geoBlock} onChange={e => setGeoBlock(e.target.value)} style={{ background: 'var(--md-surface-container)', border: '1px solid var(--md-outline-variant)', borderRadius: 8, padding: '8px 12px', color: 'var(--md-on-surface)' }}>
                <option value="">不限制</option>
                <option value="CN">限制中国大陆</option>
              </select>
            </div>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
              <Btn variant="danger" onClick={() => review('rejected')} disabled={busy}>{busy ? <Spinner size={15} /> : <I name="x" size={15} />} 拒绝</Btn>
              <Btn variant="filled" onClick={() => review('approved')} disabled={busy}>{busy ? <Spinner size={15} /> : <I name="check" size={15} />} 通过</Btn>
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}

/* ================= 举报 ================= */
function ReportsTab() {
  const toast = useToast(s => s.push);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    admin.reports({ limit: 50 }).then(d => setItems(asList(d))).catch(() => { }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const handle = async (id: string, action: string, note?: string) => {
    try {
      await admin.reportReview(id, { action, note });
      toast(action === 'action_taken' ? '已处理' : '已忽略', 'success');
      load();
    } catch (e: any) { toast(errMsg(e), 'error'); }
  };

  return (
    <div className="col" style={{ gap: 12 }}>
      {loading ? <Loading /> : items.length === 0 ? <Empty icon="flag" title="暂无举报" /> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>目标</th><th>原因</th><th>详情</th><th>举报人</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>
              {items.map(r => (
                <tr key={r.id}>
                  <td className="code">{String(r.id).slice(0, 8)}</td>
                  <td>{r.reason}</td>
                  <td style={{ maxWidth: 240 }}><span className="clamp1 muted">{r.details || '—'}</span></td>
                  <td>{r.reporter_username || r.reporter_id?.slice(0, 8)}</td>
                  <td><StatusTag s={r.status} /></td>
                  <td>
                    {r.status !== 'resolved' && r.status !== 'ignored' && (
                      <div className="row" style={{ gap: 4 }}>
                        <Btn variant="filled" size="sm" onClick={() => handle(r.id, 'action_taken')}>处理</Btn>
                        <Btn variant="text" size="sm" onClick={() => handle(r.id, 'ignored')}>忽略</Btn>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ================= 评论审核 ================= */
function CommentsTab() {
  const toast = useToast(s => s.push);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [opinion, setOpinion] = useState<Record<string, string>>({});
  const load = useCallback(() => {
    setLoading(true);
    admin.commentsPending(100, 0).then(d => setItems(asList(d))).catch(() => { }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const review = async (id: string, action: string) => {
    try {
      await admin.commentReview(id, { action, opinion: opinion[id] || undefined });
      toast(action === 'approve' ? '已通过' : '已拒绝', 'success');
      load();
    } catch (e: any) { toast(errMsg(e), 'error'); }
  };

  return (
    <div className="col" style={{ gap: 12 }}>
      {loading ? <Loading /> : items.length === 0 ? <Empty icon="message" title="评论队列已清空" /> : (
        <div className="col" style={{ gap: 8 }}>
          {items.map(c => (
            <div key={c.id} className="card" style={{ padding: 14 }}>
              <div className="row row--between" style={{ gap: 8, flexWrap: 'wrap' }}>
                <span className="row" style={{ gap: 8 }}>
                  <b>{c.username}</b>
                  <span className="muted small">{timeAgo(c.created_at)}</span>
                  {c.moderation_opinion && <span className="status-tag status-tag--pending">敏感词: {c.moderation_opinion}</span>}
                </span>
                <div className="row" style={{ gap: 6 }}>
                  <Btn variant="filled" size="sm" onClick={() => review(c.id, 'approve')}><I name="check" size={14} /> 通过</Btn>
                  <Btn variant="danger" size="sm" onClick={() => review(c.id, 'reject')}><I name="x" size={14} /> 拒绝</Btn>
                </div>
              </div>
              <div style={{ marginTop: 8, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{c.content}</div>
              <input value={opinion[c.id] || ''} onChange={e => setOpinion(x => ({ ...x, [c.id]: e.target.value }))} placeholder="处理备注（可选）" style={{ marginTop: 8, height: 34, borderRadius: 8, border: '1px solid var(--md-outline-variant)', background: 'var(--glass-1)', padding: '0 12px', color: 'var(--md-on-surface)', width: '100%' }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================= 认证审核 ================= */
function VerificationsTab() {
  const toast = useToast(s => s.push);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);
  const [note, setNote] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    admin.verifications().then(d => setItems(asList(d))).catch(() => { }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const review = async (action: 'approve' | 'reject') => {
    if (!detail) return;
    setBusy(true);
    try {
      await admin.verificationReview(detail.id, { action, note: note.trim() || undefined, label: label.trim() || undefined });
      toast(action === 'approve' ? '已通过认证' : '已拒绝申请', 'success');
      setDetail(null);
      load();
    } catch (e: any) { toast(errMsg(e), 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div className="col" style={{ gap: 12 }}>
      {loading ? <Loading /> : items.length === 0 ? <Empty icon="award" title="暂无认证申请" /> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>申请人</th><th>类型</th><th>机构</th><th>理由</th><th>状态</th><th>时间</th><th>操作</th></tr></thead>
            <tbody>
              {items.map(v => (
                <tr key={v.id}>
                  <td>{v.username || v.user?.username || String(v.user_id).slice(0, 8)}</td>
                  <td>{v.badge_type === 'blue' ? '蓝 V' : '黄 V'}</td>
                  <td>{v.org_name || '—'}</td>
                  <td style={{ maxWidth: 220 }}><span className="clamp1 muted">{v.reason}</span></td>
                  <td><StatusTag s={v.status} /></td>
                  <td className="muted small">{timeAgo(v.created_at)}</td>
                  <td><button className="icon-btn icon-btn--sm" onClick={() => { setDetail(v); setNote(''); setLabel(v.current_label || ''); }}><I name="eye" size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={!!detail} onClose={() => setDetail(null)} title="认证审核" wide>
        {detail && (
          <>
            <div className="row" style={{ gap: 12 }}>
              <span className="verif-badge-preview" style={{ background: detail.badge_type === 'blue' ? 'linear-gradient(135deg,#4f8ef7,#2563c9)' : 'linear-gradient(135deg,#f2c94c,#d99a1b)' }}>✓</span>
              <div>
                <div style={{ font: 'var(--text-title-md)' }}>{detail.username || detail.user?.username} · {detail.badge_type === 'blue' ? '蓝 V' : '黄 V'}</div>
                <div className="muted small">{detail.eligibility_type}{detail.org_name ? ` · ${detail.org_name}` : ''}{detail.external_platform ? ` · ${detail.external_platform}` : ''}{detail.follower_count ? ` · ${detail.follower_count} 粉丝` : ''}</div>
              </div>
            </div>
            <div className="card" style={{ padding: 12 }}>{detail.reason}</div>
            {(detail.materials?.length > 0) && (
              <div>
                <b style={{ font: 'var(--text-label-lg)' }}>证明材料</b>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8, marginTop: 8 }}>
                  {detail.materials.map((m: any, i: number) => (
                    <a key={i} href={m.url} target="_blank" rel="noreferrer">
                      {m.kind === 'image' || /\.(png|jpe?g|webp)$/i.test(m.url || '') ? (
                        <img src={m.url} style={{ borderRadius: 8, aspectRatio: '1', objectFit: 'cover' }} alt="" />
                      ) : (
                        <div className="card" style={{ padding: 12, display: 'grid', placeItems: 'center' }}><I name="file" size={22} /></div>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}
            <div className="row" style={{ gap: 12 }}>
              <Field label="认证标签"><input value={label} onChange={e => setLabel(e.target.value)} maxLength={20} placeholder="如：音乐人 / MCN 机构" /></Field>
            </div>
            <Field label="备注"><textarea value={note} onChange={e => setNote(e.target.value)} maxLength={300} style={{ minHeight: 70 }} /></Field>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <Btn variant="danger" onClick={() => review('reject')} disabled={busy}>{busy ? <Spinner size={15} /> : <I name="x" size={15} />} 拒绝</Btn>
              <Btn variant="filled" onClick={() => review('approve')} disabled={busy}>{busy ? <Spinner size={15} /> : <I name="check" size={15} />} 通过认证</Btn>
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}

/* ================= 工单 ================= */
function TicketsTab() {
  const toast = useToast(s => s.push);
  const [items, setItems] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Ticket | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    admin.tickets({ limit: 50 }).then(d => setItems(asList<Ticket>(d))).catch(() => { }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const open = async (t: Ticket) => {
    try {
      const d: any = await admin.ticket(t.id);
      setDetail(d?.ticket ?? d);
    } catch { setDetail(t); }
  };
  const claim = async (id: string) => { try { await admin.ticketClaim(id); toast('已认领', 'success'); load(); } catch (e: any) { toast(errMsg(e), 'error'); } };
  const close = async (id: string) => {
    const ok = await confirmDialog({ title: '关闭工单', message: '确定关闭该工单吗？', okText: '关闭' });
    if (!ok) return;
    try { await admin.ticketClose(id); toast('已关闭', 'success'); setDetail(null); load(); } catch (e: any) { toast(errMsg(e), 'error'); }
  };
  const reopen = async (id: string) => { try { await admin.ticketReopen(id); toast('已重新打开', 'success'); setDetail(null); load(); } catch (e: any) { toast(errMsg(e), 'error'); } };
  const sendReply = async () => {
    if (!detail || !reply.trim()) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('content', reply.trim());
      await admin.ticketReply(detail.id, fd);
      setReply('');
      const d: any = await admin.ticket(detail.id);
      setDetail(d?.ticket ?? d);
      load();
    } catch (e: any) { toast(errMsg(e), 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div className="col" style={{ gap: 12 }}>
      {loading ? <Loading /> : items.length === 0 ? <Empty icon="ticket" title="暂无工单" /> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>工单</th><th>用户</th><th>状态</th><th>处理人</th><th>更新</th><th>操作</th></tr></thead>
            <tbody>
              {items.map(t => (
                <tr key={t.id}>
                  <td style={{ maxWidth: 260 }}><span className="clamp1">{t.subject || '（无标题）'}</span></td>
                  <td>{t.username || t.user?.username || '—'}</td>
                  <td><StatusTag s={t.status} /></td>
                  <td>{t.claimed_by_username || '—'}</td>
                  <td className="muted small">{timeAgo(t.updated_at || t.created_at)}</td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      <button className="icon-btn icon-btn--sm" title="查看" onClick={() => open(t)}><I name="eye" size={16} /></button>
                      {t.status !== 'closed' && !t.claimed_by && <button className="icon-btn icon-btn--sm" title="认领" onClick={() => claim(t.id)}><I name="check" size={16} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={!!detail} onClose={() => setDetail(null)} title={detail?.subject || '工单'} wide>
        {detail && (
          <>
            <div className="row" style={{ gap: 8 }}>
              <StatusTag s={detail.status} />
              {detail.claimed_by_username && <span className="muted small">处理人：{detail.claimed_by_username}</span>}
            </div>
            <div className="msg-thread" style={{ maxHeight: '44dvh' }}>
              {(detail.messages || []).map((m, i) => (
                <div key={m.id || i} className={`msg-bubble ${m.sender_role === 'user' ? 'theirs' : 'mine'}`}>
                  <div className="muted small" style={{ marginBottom: 4 }}>{m.username || m.sender_role}</div>
                  {m.content}
                  <div className="msg-time">{fmtDateTime(m.created_at)}</div>
                </div>
              ))}
            </div>
            <div className="msg-input">
              <textarea value={reply} onChange={e => setReply(e.target.value)} placeholder="回复用户…" rows={2} />
              <Btn variant="filled" onClick={sendReply} disabled={busy || !reply.trim()}>{busy ? <Spinner size={15} /> : <I name="send" size={16} />}</Btn>
            </div>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
              {detail.status === 'closed' ? (
                <Btn variant="tonal" size="sm" onClick={() => reopen(detail.id)}><I name="refresh" size={15} /> 重新打开</Btn>
              ) : (
                <Btn variant="danger" size="sm" onClick={() => close(detail.id)}><I name="x" size={15} /> 关闭工单</Btn>
              )}
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}

/* ================= 用户管理 ================= */
function UsersTab() {
  const toast = useToast(s => s.push);
  const [q, setQ] = useState('');
  const [items, setItems] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [target, setTarget] = useState<User | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async (search = q) => {
    setLoading(true);
    try {
      const d: any = await admin.users({ search: search || undefined, limit: 50, offset: 0 });
      setItems(asList<User>(d));
    } catch (e: any) { toast(errMsg(e), 'error'); }
    finally { setLoading(false); }
  }, [q, toast]);
  useEffect(() => { load(''); }, []); // eslint-disable-line

  const setRole = async (u: User, role: string) => {
    try { await admin.userRole(u.id, role); toast('角色已更新', 'success'); setTarget(x => x && { ...x, role: role as any }); load(); } catch (e: any) { toast(errMsg(e), 'error'); }
  };
  const setStatus = async (u: User, status: 'active' | 'banned') => {
    if (status === 'banned' && !reason.trim()) { toast('请填写封禁理由', 'info'); return; }
    try {
      await admin.userStatus(u.id, status, reason.trim() || undefined);
      toast(status === 'banned' ? '已封禁' : '已解封', 'success');
      setTarget(null); setReason(''); load();
    } catch (e: any) { toast(errMsg(e), 'error'); }
  };
  const perm = async (u: User, permission: string, granted: boolean) => {
    try {
      const r: any = await admin.userPermissions(u.id, permission, granted);
      setTarget(x => x && { ...x, permissions: r?.permissions ?? [...(x.permissions || []), ...(granted ? [] : [])] });
      toast('权限已更新', 'success');
    } catch (e: any) { toast(errMsg(e), 'error'); }
  };
  const removeReviewer = async (u: User) => {
    const ok = await confirmDialog({ title: '移除审核员', message: `移除 @${u.username} 的内容审核员权限？`, okText: '移除', danger: true });
    if (!ok) return;
    try { await admin.removeContentReviewer(u.id); toast('已移除', 'success'); load(); } catch (e: any) { toast(errMsg(e), 'error'); }
  };
  const purge = async (u: User) => {
    const ok = await confirmDialog({ title: '清理未过审视频', message: `删除 @${u.username} 所有未过审的视频？`, okText: '删除', danger: true });
    if (!ok) return;
    try { await admin.purgeUserFailedVideos(u.id); toast('已清理', 'success'); load(); } catch (e: any) { toast(errMsg(e), 'error'); }
  };

  return (
    <div className="col" style={{ gap: 12 }}>
      <form className="row" style={{ gap: 8, maxWidth: 480 }} onSubmit={e => { e.preventDefault(); load(); }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <I name="search" size={16} style={{ position: 'absolute', left: 12, top: '50%', translate: '0 -50%', color: 'var(--md-on-surface-variant)' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="搜索用户名 / UID / 邮箱" style={{ width: '100%', height: 42, borderRadius: 999, border: '1px solid var(--md-outline-variant)', background: 'var(--glass-1)', padding: '0 14px 0 36px', color: 'var(--md-on-surface)' }} />
        </div>
        <Btn variant="tonal" type="submit">搜索</Btn>
      </form>
      {loading ? <Loading /> : items.length === 0 ? <Empty icon="users" title="未找到用户" /> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>用户</th><th>UID</th><th>角色</th><th>状态</th><th>视频数</th><th>注册时间</th><th>操作</th></tr></thead>
            <tbody>
              {items.map(u => (
                <tr key={u.id}>
                  <td><div className="row" style={{ gap: 8 }}><Avatar user={u} size={28} /><span className="clamp1">{u.username}</span><VBadge badge={u.verification_badge} size={13} /></div></td>
                  <td className="code">{u.uid || '—'}</td>
                  <td><StatusTag s={u.role === 'user' ? 'open' : 'claimed'} label={u.role} /></td>
                  <td><StatusTag s={u.account_status === 'banned' ? 'banned' : 'active'} label={u.account_status === 'banned' ? '已封禁' : '正常'} /></td>
                  <td>{u.video_count ?? '—'}</td>
                  <td className="muted small">{timeAgo(u.created_at)}</td>
                  <td><button className="icon-btn icon-btn--sm" onClick={() => { setTarget(u); setReason(u.ban_reason || ''); }}><I name="settings" size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={!!target} onClose={() => setTarget(null)} title={`管理用户：${target?.username || ''}`} wide>
        {target && (
          <>
            <div className="row" style={{ gap: 10 }}>
              <Avatar user={target} size={52} />
              <div>
                <div className="row" style={{ gap: 6 }}><b style={{ font: 'var(--text-title-md)' }}>{target.username}</b><VBadge badge={target.verification_badge} size={15} /></div>
                <div className="muted small">UID {target.uid} · 粉丝 {fmtNum(target.follower_count)} · 视频 {fmtNum(target.video_count)}</div>
              </div>
              <span className="spacer" />
              <StatusTag s={target.account_status === 'banned' ? 'banned' : 'active'} label={target.account_status === 'banned' ? '已封禁' : '正常'} />
            </div>
            {target.ban_reason && <div className="err">封禁理由：{target.ban_reason}</div>}
            <div className="row" style={{ gap: 10, alignItems: 'center' }}>
              <span style={{ font: 'var(--text-label-lg)' }}>角色：</span>
              <select value={target.role} onChange={e => setRole(target, e.target.value)} style={{ background: 'var(--md-surface-container)', border: '1px solid var(--md-outline-variant)', borderRadius: 8, padding: '8px 12px', color: 'var(--md-on-surface)' }}>
                <option value="user">普通用户</option>
                <option value="video_moderation">视频审核员</option>
                <option value="content_review">内容审核员</option>
                <option value="admin">管理员</option>
              </select>
            </div>
            <div className="row" style={{ gap: 16 }}>
              {['video_moderation', 'content_review'].map(p => (
                <label key={p} className="row" style={{ gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={(target.permissions || []).includes(p)} onChange={e => perm(target, p, e.target.checked)} style={{ accentColor: 'var(--md-primary)', width: 16, height: 16 }} />
                  <span className="small">{p === 'video_moderation' ? '视频审核' : '内容审核'}</span>
                </label>
              ))}
            </div>
            <Field label="封禁理由"><input value={reason} onChange={e => setReason(e.target.value)} placeholder="封禁时必填" /></Field>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
              {target.role === 'content_review' && <Btn variant="text" size="sm" onClick={() => removeReviewer(target)}>移除审核员</Btn>}
              <Btn variant="text" size="sm" onClick={() => purge(target)}>清理未过审视频</Btn>
              {target.account_status === 'banned' ? (
                <Btn variant="tonal" size="sm" onClick={() => setStatus(target, 'active')}><I name="unlock" size={15} /> 解封</Btn>
              ) : (
                <Btn variant="danger" size="sm" onClick={() => setStatus(target, 'banned')}><I name="ban" size={15} /> 封禁</Btn>
              )}
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}

/* ================= 视频管理 ================= */
function VideosTab() {
  const toast = useToast(s => s.push);
  const [status, setStatus] = useState('');
  const [items, setItems] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [missing, setMissing] = useState<any[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      admin.videos({ status: status || undefined, limit: 50 }).catch(() => null),
      admin.coversMissing(50).catch(() => null),
    ]).then(([d1, d2]) => {
      setItems(asList<Video>(d1));
      setMissing(d2?.items || []);
    }).finally(() => setLoading(false));
  }, [status]);
  useEffect(() => { load(); }, [load]);

  const geo = async (v: Video, on: boolean) => {
    try { await admin.geoBlock(v.id, on ? 'CN' : null); toast(on ? '已限制中国大陆' : '已解除限制', 'success'); load(); } catch (e: any) { toast(errMsg(e), 'error'); }
  };
  const del = async (v: Video) => {
    const ok = await confirmDialog({ title: '删除视频', message: `平台删除「${v.title}」？`, okText: '删除', danger: true });
    if (!ok) return;
    try { await videosApi.remove(v.id); toast('已删除', 'success'); load(); } catch (e: any) { toast(errMsg(e), 'error'); }
  };
  const syncCover = async (id: string) => {
    try { await admin.coverSync(id); toast('封面已同步', 'success'); load(); } catch (e: any) { toast(errMsg(e), 'error'); }
  };

  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {['', 'pending_review', 'approved', 'rejected'].map(s => (
          <button key={s || 'all'} className={`chip ${status === s ? 'chip--selected' : ''}`} onClick={() => setStatus(s)} type="button">
            {s === '' ? '全部' : s === 'pending_review' ? '待审核' : s === 'approved' ? '已通过' : '已拒绝'}
          </button>
        ))}
      </div>
      {loading ? <Loading /> : items.length === 0 ? <Empty icon="film" title="没有匹配的视频" /> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>标题</th><th>作者</th><th>分类</th><th>播放</th><th>状态</th><th>区限制</th><th>操作</th></tr></thead>
            <tbody>
              {items.map(v => (
                <tr key={v.id}>
                  <td style={{ maxWidth: 280 }}><span className="clamp1">{v.title}</span></td>
                  <td>{v.author_username}</td>
                  <td className="muted small">{v.category}</td>
                  <td>{fmtNum(v.views)}</td>
                  <td><StatusTag s={v.status} /></td>
                  <td>{v.geo_block ? <StatusTag s="pending" label={v.geo_block} /> : <span className="muted">—</span>}</td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      <Link className="icon-btn icon-btn--sm" to={`/video/${v.id}`} title="查看"><I name="eye" size={16} /></Link>
                      <button className="icon-btn icon-btn--sm" title={v.geo_block ? '解除地区限制' : '限制中国大陆'} onClick={() => geo(v, !v.geo_block)}><I name="globe" size={16} /></button>
                      <button className="icon-btn icon-btn--sm" title="平台删除" onClick={() => del(v)}><I name="trash" size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {missing.length > 0 && (
        <div className="card" style={{ padding: 14 }}>
          <b className="row" style={{ gap: 8, marginBottom: 8 }}><I name="image" size={16} /> 缺失封面（{missing.length}）</b>
          <div className="col" style={{ gap: 6 }}>
            {missing.slice(0, 8).map((m: any) => (
              <div key={m.id} className="row" style={{ gap: 10 }}>
                <span className="clamp1 small" style={{ flex: 1 }}>{m.title || m.id}</span>
                <Btn variant="tonal" size="sm" onClick={() => syncCover(m.id)}><I name="refresh" size={14} /> 同步封面</Btn>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= 公告 ================= */
function AnnouncementsTab() {
  const toast = useToast(s => s.push);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<any | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    admin.announcementsAll().then(d => setItems(asList(d))).catch(() => { }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!title.trim() || !content.trim()) { toast('请填写标题和内容', 'info'); return; }
    setBusy(true);
    try {
      if (edit?.id) await admin.announcementUpdate(edit.id, { title: title.trim(), content: content.trim(), is_active: active });
      else await admin.announcementCreate({ title: title.trim(), content: content.trim(), is_active: active });
      toast('已保存', 'success');
      setEdit(null); setTitle(''); setContent(''); setActive(true);
      load();
    } catch (e: any) { toast(errMsg(e), 'error'); }
    finally { setBusy(false); }
  };
  const del = async (id: string) => {
    const ok = await confirmDialog({ title: '删除公告', message: '确定删除该公告吗？', okText: '删除', danger: true });
    if (!ok) return;
    try { await admin.announcementDelete(id); toast('已删除', 'success'); load(); } catch (e: any) { toast(errMsg(e), 'error'); }
  };

  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <Btn variant="tonal" size="sm" onClick={() => { setEdit(null); setTitle(''); setContent(''); setActive(true); setEditorOpen(true); }}><I name="plus" size={15} /> 新建公告</Btn>
      </div>
      {loading ? <Loading /> : items.length === 0 ? <Empty icon="megaphone" title="暂无公告" /> : (
        <div className="col" style={{ gap: 8 }}>
          {items.map(a => (
            <div key={a.id} className="card row" style={{ padding: 14, gap: 12, alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ gap: 8 }}><b className="clamp1">{a.title}</b>{!a.is_active && <span className="status-tag status-tag--draft">已停用</span>}</div>
                <div className="muted small clamp1" style={{ marginTop: 3 }}>{a.content}</div>
              </div>
              <button className="icon-btn icon-btn--sm" onClick={() => { setEdit(a); setTitle(a.title); setContent(a.content); setActive(a.is_active); setEditorOpen(true); }}><I name="edit" size={16} /></button>
              <button className="icon-btn icon-btn--sm" style={{ color: 'var(--md-error)' }} onClick={() => del(a.id)}><I name="trash" size={16} /></button>
            </div>
          ))}
        </div>
      )}
      <Dialog open={editorOpen} onClose={() => setEditorOpen(false)} title={edit?.id ? '编辑公告' : '新建公告'}
        actions={<><Btn variant="text" onClick={() => setEditorOpen(false)}>取消</Btn><Btn variant="filled" onClick={save} disabled={busy}>{busy ? <Spinner size={15} /> : <I name="check" size={15} />} 保存</Btn></>}>
        <Field label="标题 *"><input value={title} onChange={e => setTitle(e.target.value)} maxLength={80} /></Field>
        <Field label="内容 *"><textarea value={content} onChange={e => setContent(e.target.value)} style={{ minHeight: 140 }} /></Field>
        <label className="row" style={{ gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} style={{ accentColor: 'var(--md-primary)', width: 17, height: 17 }} />
          <span>启用（新用户登录时展示）</span>
        </label>
      </Dialog>
    </div>
  );
}

/* ================= 公投 ================= */
function ReferendumsTab() {
  const toast = useToast(s => s.push);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<any | null>(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [options, setOptions] = useState<string[]>(['选项一', '选项二']);
  const [busy, setBusy] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [resultData, setResultData] = useState<any>(null);

  const load = useCallback(() => {
    setLoading(true);
    admin.referendumsAll().then(d => setItems(asList(d))).catch(() => { }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!title.trim() || options.filter(o => o.trim()).length < 2) { toast('标题和至少 2 个选项必填', 'info'); return; }
    setBusy(true);
    try {
      const payload = { title: title.trim(), description: desc.trim(), status: 'active', allow_text: false, options: options.filter(o => o.trim()).map(o => ({ label: o })) };
      if (edit?.id) await admin.referendumUpdate(edit.id, payload);
      else await admin.referendumCreate(payload);
      toast('已保存', 'success');
      setEdit(null); setTitle(''); setDesc(''); setOptions(['选项一', '选项二']);
      load();
    } catch (e: any) { toast(errMsg(e), 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <Btn variant="tonal" size="sm" onClick={() => { setEdit(null); setTitle(''); setDesc(''); setOptions(['选项一', '选项二']); setEditorOpen(true); }}><I name="plus" size={15} /> 新建公投</Btn>
      </div>
      {loading ? <Loading /> : items.length === 0 ? <Empty icon="poll" title="暂无公投" /> : (
        <div className="col" style={{ gap: 8 }}>
          {items.map(r => (
            <div key={r.id} className="card row" style={{ padding: 14, gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div className="row" style={{ gap: 8 }}><b className="clamp1">{r.title}</b><StatusTag s={r.status} /></div>
                <div className="muted small" style={{ marginTop: 3 }}>{fmtNum(r.response_count)} 人参与 · {r.options?.length ?? 0} 个选项</div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <Btn variant="tonal" size="sm" onClick={async () => {
                  try {
                    const d: any = await admin.referendumResults(r.id);
                    setResultData({ title: r.title, data: d });
                    setResultOpen(true);
                  } catch (e: any) { toast(errMsg(e), 'error'); }
                }}><I name="poll" size={14} /> 结果</Btn>
                <a className="btn btn--tonal btn--sm" href={admin.referendumExport(r.id)} download><I name="download" size={14} /> CSV</a>
                <button className="icon-btn icon-btn--sm" onClick={() => { setEdit(r); setTitle(r.title); setDesc(r.description || ''); setOptions((r.options || []).map((o: any) => o.label)); setEditorOpen(true); }}><I name="edit" size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Dialog open={editorOpen} onClose={() => setEditorOpen(false)} title={edit?.id ? '编辑公投' : '新建公投'} wide
        actions={<><Btn variant="text" onClick={() => setEditorOpen(false)}>取消</Btn><Btn variant="filled" onClick={save} disabled={busy}>{busy ? <Spinner size={15} /> : <I name="check" size={15} />} 保存</Btn></>}>
        <Field label="标题 *"><input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} /></Field>
        <Field label="说明"><textarea value={desc} onChange={e => setDesc(e.target.value)} style={{ minHeight: 90 }} /></Field>
        <Field label="选项">
          <div className="col" style={{ gap: 6 }}>
            {options.map((o, i) => (
              <div className="row" key={i} style={{ gap: 6 }}>
                <input value={o} onChange={e => setOptions(x => x.map((y, j) => j === i ? e.target.value : y))} style={{ flex: 1, height: 38, borderRadius: 8, border: '1px solid var(--md-outline-variant)', background: 'var(--glass-1)', padding: '0 12px', color: 'var(--md-on-surface)' }} />
                <button className="icon-btn icon-btn--sm" onClick={() => setOptions(x => x.filter((_, j) => j !== i))} disabled={options.length <= 2}><I name="x" size={14} /></button>
              </div>
            ))}
            <Btn variant="text" size="sm" onClick={() => setOptions(x => [...x, `选项${x.length + 1}`])}><I name="plus" size={14} /> 添加选项</Btn>
          </div>
        </Field>
      </Dialog>
      <Dialog open={resultOpen} onClose={() => setResultOpen(false)} title={resultData?.title ? `公投结果：${resultData.title}` : '公投结果'}>
        <pre style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, whiteSpace: 'pre-wrap', lineHeight: 1.6, background: 'var(--md-surface-container-lowest)', border: '1px solid var(--md-outline-variant)', borderRadius: 12, padding: 14, maxHeight: '50dvh', overflowY: 'auto' }}>
          {JSON.stringify(resultData?.data ?? null, null, 2)}
        </pre>
      </Dialog>
    </div>
  );
}

/* ================= 站内信 ================= */
function MessagesTab() {
  const toast = useToast(s => s.push);
  const [uid, setUid] = useState('');
  const [username, setUsername] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [broadcast, setBroadcast] = useState(false);
  const [busy, setBusy] = useState(false);

  const lookup = async () => {
    const q2 = username.trim();
    if (!q2) return;
    try {
      const d: any = await admin.users({ search: q2, limit: 1 });
      const u = asList(d)[0];
      if (u) { setUid(String(u.id)); toast(`已定位用户：${u.username}`, 'success'); }
      else toast('未找到该用户', 'error');
    } catch (e: any) { toast(errMsg(e), 'error'); }
  };
  const send = async () => {
    if (broadcast) {
      if (!title.trim() || !content.trim()) { toast('请填写标题和内容', 'info'); return; }
    } else if (!uid || !content.trim()) {
      toast('broadcast 或（目标用户 + 内容）必填', 'info');
      return;
    }
    setBusy(true);
    try {
      const r: any = await admin.sendMessage({ user_id: uid, title: title.trim(), content: content.trim(), broadcast });
      toast(broadcast ? `已广播给 ${r?.sent ?? '全部'} 用户` : '已发送', 'success');
      setTitle(''); setContent(''); setUid(''); setBroadcast(false);
    } catch (e: any) { toast(errMsg(e), 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div className="card col" style={{ padding: 20, gap: 14, maxWidth: 620 }}>
      <h2 className="row" style={{ gap: 8, font: 'var(--text-title-md)' }}><I name="mail" size={18} /> 发送站内信</h2>
      <label className="row" style={{ gap: 10, cursor: 'pointer' }}>
        <input type="checkbox" checked={broadcast} onChange={e => setBroadcast(e.target.checked)} style={{ accentColor: 'var(--md-primary)', width: 17, height: 17 }} />
        <span>全员广播（发给所有用户）</span>
      </label>
      {!broadcast && (
        <div className="row" style={{ gap: 8 }}>
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder="接收人用户名" style={{ flex: 1, height: 42, borderRadius: 999, border: '1px solid var(--md-outline-variant)', background: 'var(--glass-1)', padding: '0 14px', color: 'var(--md-on-surface)' }} />
          <Btn variant="tonal" onClick={lookup}><I name="search" size={15} /> 查找</Btn>
          {uid && <span className="chip chip--selected"><I name="check" size={13} /> {uid.slice(0, 8)}…</span>}
        </div>
      )}
      {!broadcast && <Field label="标题"><input value={title} onChange={e => setTitle(e.target.value)} maxLength={80} /></Field>}
      {broadcast && <Field label="广播标题"><input value={title} onChange={e => setTitle(e.target.value)} maxLength={80} /></Field>}
      <Field label="内容 *"><textarea value={content} onChange={e => setContent(e.target.value)} style={{ minHeight: 130 }} /></Field>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <Btn variant="filled" onClick={send} disabled={busy}>{busy ? <Spinner size={16} /> : <I name="send" size={16} />} {broadcast ? '广播' : '发送'}</Btn>
      </div>
    </div>
  );
}

/* ================= 通用 ================= */
function StatusTag({ s, label }: { s?: string; label?: string }) {
  const map: Record<string, string> = {
    approved: 'status-tag--approved', active: 'status-tag--active', closed: 'status-tag--closed',
    rejected: 'status-tag--rejected', banned: 'status-tag--banned',
    pending: 'status-tag--pending', pending_review: 'status-tag--pending', claimed: 'status-tag--claimed',
    open: 'status-tag--open', running: 'status-tag--open', user: 'status-tag--open',
  };
  const cls = map[s || ''] || 'status-tag--draft';
  const labels: Record<string, string> = {
    approved: '已通过', active: '正常', closed: '已关闭', rejected: '已拒绝', banned: '已封禁',
    pending: '待处理', pending_review: '待审核', claimed: '已认领', open: '处理中', user: '普通用户',
    video_moderation: '视频审核员', content_review: '内容审核员', admin: '管理员',
  };
  return <span className={`status-tag ${cls}`}>{label ?? labels[s || ''] ?? s}</span>;
}
