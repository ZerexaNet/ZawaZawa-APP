import { useCallback, useEffect, useState } from 'react';
import { I, type IconName } from '../icons';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { asArray, type Announcement, type AuditItem, type ModerationComment, type Referendum, type ReportItem, type Ticket, type User, type VerificationRequest, type Video } from '../types';
import { Cover, Empty, Loading, Modal } from '../components';
import { errMsg, toast, useAuth } from '../store';
import { fmtCount, timeAgo } from '../lib/utils';

type AdminTab = 'audit' | 'reports' | 'comments' | 'verifications' | 'tickets' | 'users' | 'videos' | 'announcements' | 'referendums' | 'broadcast';

const TABS: [AdminTab, string, IconName][] = [
  ['audit', '审核队列', 'file'],
  ['reports', '举报处理', 'flag'],
  ['comments', '评论审核', 'chat'],
  ['verifications', '认证审核', 'medal'],
  ['tickets', '工单中心', 'ticket'],
  ['users', '用户管理', 'users'],
  ['videos', '视频管理', 'video'],
  ['announcements', '公告管理', 'megaphone'],
  ['referendums', '公投管理', 'vote'],
  ['broadcast', '消息推送', 'mail'],
];

export function AdminPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState<AdminTab>('audit');

  useEffect(() => {
    if (!user) { nav('/login'); return; }
    if (!['admin', 'video_moderation', 'content_review'].includes(String(user.role))) { nav('/'); return; }
  }, [user, nav]);

  if (!user) return null;
  const role = String(user.role || '');
  const isSuper = role === 'admin';
  const isVideoMod = isSuper || role === 'video_moderation';
  const isContentRev = isSuper || role === 'content_review';

  const visibleTabs = TABS.filter(([id]) => {
    if (id === 'audit' || id === 'videos') return isVideoMod;
    if (id === 'reports' || id === 'comments' || id === 'verifications' || id === 'announcements' || id === 'referendums' || id === 'broadcast') return isVideoMod || isContentRev;
    if (id === 'users' || id === 'tickets') return isSuper;
    return true;
  });

  return (
    <div className="page">
      <h1 style={{ fontSize: 20, marginBottom: 4 }}><I name="shield" size={18} /> 管理后台</h1>
      <div className="muted" style={{ marginBottom: 14 }}>当前角色：{role} · {user.username}</div>
      <div className="tabs">
        {visibleTabs.map(([id, label, icon]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><I name={icon} size={15} /> {label}</button>
        ))}
      </div>
      {tab === 'audit' && isVideoMod && <AuditTab me={user} />}
      {tab === 'reports' && <ReportsTab />}
      {tab === 'comments' && <CommentsTab />}
      {tab === 'verifications' && <VerificationsTab />}
      {tab === 'tickets' && isSuper && <AdminTicketsTab me={user} />}
      {tab === 'users' && isSuper && <UsersTab />}
      {tab === 'videos' && isVideoMod && <VideosTab />}
      {tab === 'announcements' && <AnnouncementsTab />}
      {tab === 'referendums' && <ReferendumsTab />}
      {tab === 'broadcast' && <BroadcastTab />}
    </div>
  );
}

// ============ 审核队列 ============
function AuditTab({ me }: { me: User }) {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<AuditItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, r] = await Promise.all([
        api.auditList().catch(() => [] as AuditItem[]),
        api.auditReport().catch(() => null),
      ]);
      setItems(asArray<AuditItem>(l));
      setReport(r);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const claim = async (it: AuditItem) => {
    try {
      await api.auditClaim(it.id, it.item_type);
      toast('已认领');
      void load();
    } catch (e) { toast(errMsg(e), 'err'); }
  };

  return (
    <div>
      {report && (
        <div className="stat-grid" style={{ marginBottom: 16 }}>
          {Object.entries(report).slice(0, 8).map(([k, v]) => (
            <div key={k} className="stat-card">
              <div className="num">{String(v)}</div>
              <div className="lbl">{k}</div>
            </div>
          ))}
        </div>
      )}
      {loading ? <Loading /> : items.length === 0 ? <Empty text="审核队列为空" icon="check" /> : (
        <div className="card" style={{ padding: 6 }}>
          {items.map((it) => (
            <div key={it.id} className="row-item">
              <div style={{ fontSize: 22 }}>{it.item_type === 'video' ? <I name="video" size={22} /> : <I name="file" size={22} />}</div>
              <div className="grow" style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {it.title || it.item_type + ' #' + it.id.slice(0, 8)}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {it.author_username || it.author_id} · {timeAgo(it.created_at as string)}
                  {it.claimed_by && it.claimed_by !== me.id && <span style={{ color: 'var(--warn)' }}> · 已被他人认领</span>}
                </div>
              </div>
              <span className="tag">{it.item_type === 'video' ? '视频' : '专栏'}</span>
              {(!it.claimed_by || it.claimed_by === me.id) && (
                <>
                  {(!it.claimed_by) && <button className="btn btn-sm" onClick={() => claim(it)}>认领</button>}
                  <button className="btn btn-sm btn-primary" onClick={() => setReviewing(it)}>审核</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      {reviewing && (
        <ReviewModal
          item={reviewing}
          onClose={() => setReviewing(null)}
          onDone={() => { setReviewing(null); void load(); }}
        />
      )}
    </div>
  );
}

function ReviewModal({ item, onClose, onDone }: { item: AuditItem; onClose: () => void; onDone: () => void }) {
  const [previewUrl, setPreviewUrl] = useState('');
  const [reason, setReason] = useState('');
  const [geoBlock, setGeoBlock] = useState<'CN' | ''>('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (item.item_type === 'video') {
      api.video(item.id).then((v) => setPreviewUrl(v.cover_url || v.external_cover_url || '')).catch(() => {});
    }
  }, [item]);

  const decide = async (status: 'approved' | 'rejected') => {
    setBusy(true);
    try {
      await api.auditDecide({
        item_id: item.id,
        item_type: item.item_type,
        status,
        reason: status === 'rejected' ? reason.trim() || undefined : undefined,
        geo_block: geoBlock || null,
      });
      toast(status === 'approved' ? '已通过' : '已驳回');
      onDone();
    } catch (e) {
      toast(errMsg(e), 'err');
      setBusy(false);
    }
  };

  return (
    <Modal title={`审核 ${item.item_type === 'video' ? '视频' : '专栏'} ${item.id.slice(0, 8)}`} onClose={onClose} wide foot={
      <>
        <button className="btn btn-danger" disabled={busy} onClick={() => decide('rejected')}><I name="x" size={14} /> 驳回</button>
        <button className="btn btn-primary" disabled={busy} onClick={() => decide('approved')}><I name="check" size={14} /> 通过</button>
      </>
    }>
      {previewUrl && <Cover src={previewUrl} alt="" style={{ width: '100%', maxHeight: 300, objectFit: 'contain', background: '#000', borderRadius: 10, marginBottom: 12 }} />}
      <div className="field">
        <label>驳回理由（驳回时必填）</label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="告知作者/系统驳回原因…" maxLength={500} />
      </div>
      <div className="field">
        <label>地区限制</label>
        <div className="flex">
          <button className={'chip' + (geoBlock === '' ? ' active' : '')} onClick={() => setGeoBlock('')}>不限制</button>
          <button className={'chip' + (geoBlock === 'CN' ? ' active' : '')} onClick={() => setGeoBlock('CN')}>仅屏蔽中国大陆</button>
        </div>
      </div>
      <div className="notice-banner">
        内容 ID：<span className="mono">{item.id}</span>
        {item.item_type === 'video' && item.id && <Link to={`/video/${item.id}`} target="_blank" style={{ marginLeft: 8 }}><I name="arrowRight" size={13} /> 打开视频</Link>}
      </div>
    </Modal>
  );
}

// ============ 举报处理 ============
function ReportsTab() {
  const [items, setItems] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(asArray<ReportItem>(await api.adminReports())); } catch (e) { toast(errMsg(e), 'err'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <div>
      {loading ? <Loading /> : items.length === 0 ? <Empty text="暂无待处理举报" icon="flag" /> : (
        <div className="card" style={{ padding: 6 }}>
          {items.map((r) => (
            <div key={r.id} className="row-item" style={{ alignItems: 'flex-start' }}>
              {r.video?.cover_url && <Cover src={r.video.cover_url} alt="" className="thumb-48" />}
              <div className="grow" style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{r.video?.title || r.target_id}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  原因：{r.reason} {r.details && `· ${r.details}`}
                </div>
                <div className="muted" style={{ fontSize: 11 }}>举报人：{r.reporter_username} · {timeAgo(r.created_at as string)}</div>
              </div>
              <span className="tag">{r.status === 'pending' ? '待处理' : '已处理'}</span>
              {r.status === 'pending' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button className="btn btn-sm btn-danger" onClick={async () => {
                    try { await api.reportReview(r.id, 'delete'); toast('已删除内容'); void load(); } catch (e) { toast(errMsg(e), 'err'); }
                  }}>删除内容</button>
                  <button className="btn btn-sm" onClick={async () => {
                    try { await api.reportReview(r.id, 'dismiss'); toast('已忽略'); void load(); } catch (e) { toast(errMsg(e), 'err'); }
                  }}>忽略</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ 评论审核 ============
function CommentsTab() {
  const [items, setItems] = useState<ModerationComment[]>([]);
  const [opinions, setOpinions] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = asArray<ModerationComment>(await api.commentsModeration());
      setItems(d);
      setOpinions(Object.fromEntries(d.map((c) => [c.id, c.moderation_opinion || ''])));
    } catch (e) { toast(errMsg(e), 'err'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <div>
      {loading ? <Loading /> : items.length === 0 ? <Empty text="没有待审评论" icon="chat" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((c) => (
            <div key={c.id} className="card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div className="grow" style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>
                  <div className="muted" style={{ fontSize: 12 }}>{c.username} · {timeAgo(c.created_at as string)}</div>
                  {c.content}
                </div>
              </div>
              <div className="flex wrap" style={{ marginTop: 10 }}>
                <input
                  type="text" value={opinions[c.id] || ''} onChange={(e) => setOpinions((p) => ({ ...p, [c.id]: e.target.value }))}
                  placeholder="处理意见（可选）" style={{ flex: 1, minWidth: 180, padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', color: 'var(--ink)' }}
                />
                <button className="btn btn-sm" onClick={async () => {
                  try { await api.commentReview(c.id, 'approve', opinions[c.id] || undefined); toast('已通过'); void load(); } catch (e) { toast(errMsg(e), 'err'); }
                }}>通过</button>
                <button className="btn btn-sm btn-danger" onClick={async () => {
                  try { await api.commentReview(c.id, 'reject', opinions[c.id] || undefined); toast('已驳回'); void load(); } catch (e) { toast(errMsg(e), 'err'); }
                }}>驳回</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ 认证审核 ============
function VerificationsTab() {
  const [items, setItems] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<VerificationRequest | null>(null);
  const [note, setNote] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingDraft, setEditingDraft] = useState<VerificationRequest | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(asArray<VerificationRequest>(await api.adminVerifications())); } catch (e) { toast(errMsg(e), 'err'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const review = async (action: 'approve' | 'reject') => {
    if (!reviewing) return;
    setBusy(true);
    try {
      await api.verificationReview(reviewing.id, action, note || undefined, action === 'approve' ? label || undefined : undefined);
      toast(action === 'approve' ? '认证已通过' : '认证已驳回');
      setReviewing(null); setNote(''); setLabel('');
      void load();
    } catch (e) { toast(errMsg(e), 'err'); } finally { setBusy(false); }
  };

  return (
    <div>
      {loading ? <Loading /> : items.length === 0 ? <Empty text="暂无认证申请" icon="medal" /> : (
        <div className="card" style={{ padding: 6 }}>
          {items.map((v) => (
            <div key={v.id} className="row-item" style={{ alignItems: 'flex-start' }}>
              <div style={{ fontSize: 20 }}>{v.badge_type === 'yellow' ? <I name="star" size={20} /> : <I name="gem" size={20} />}</div>
              <div className="grow" style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>
                  {v.org_name || '个人'} · {v.badge_type === 'yellow' ? '黄V' : '蓝V'}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {v.eligibility_type} {v.external_platform && `· ${v.external_platform}`} {v.follower_count && `· ${fmtCount(v.follower_count)} 粉`}
                </div>
                {v.reason && <div className="desc">{v.reason}</div>}
              </div>
              <span className="tag" style={{ color: v.status === 'pending' ? 'var(--warn)' : v.status === 'approved' ? 'var(--ok)' : 'var(--err)', borderColor: 'currentColor' }}>
                {v.status === 'pending' ? '待审' : v.status === 'approved' ? '已通过' : '已驳回'}
              </span>
              {v.status === 'pending' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button className="btn btn-sm btn-primary" onClick={() => { setReviewing(v); setNote(''); setLabel(v.current_label || ''); }}>审核</button>
                  <button className="btn btn-sm" onClick={() => { setEditingDraft(v); }}>改草稿</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {reviewing && (
        <Modal title="认证审核" onClose={() => setReviewing(null)} foot={
          <>
            <button className="btn btn-danger" disabled={busy} onClick={() => review('reject')}>驳回</button>
            <button className="btn btn-primary" disabled={busy} onClick={() => review('approve')}>通过</button>
          </>
        }>
          <div className="field"><label>展示名称（通过后显示在昵称旁）</label><input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={reviewing.org_name || '个人名称'} /></div>
          <div className="field"><label>审核意见</label><textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="写给申请人的反馈…" /></div>
          <div className="notice-banner">申请人：{reviewing.org_name || '个人'} · {reviewing.eligibility_type}{reviewing.follower_count ? ` · ${fmtCount(reviewing.follower_count)} 粉丝` : ''}<div className="muted" style={{ marginTop: 4 }}>{reviewing.reason}</div></div>
        </Modal>
      )}

      {editingDraft && (
        <Modal title="修改草稿" onClose={() => setEditingDraft(null)} foot={
          <>
            <button className="btn" onClick={() => setEditingDraft(null)}>取消</button>
            <button className="btn btn-primary" onClick={async () => {
              try {
                await api.verificationDraftUpdate(editingDraft.id, {
                  badge_type: editingDraft.badge_type || 'blue',
                  org_name: editingDraft.org_name || '',
                  reason: editingDraft.reason || '',
                });
                toast('草稿已更新');
                setEditingDraft(null);
                void load();
              } catch (e) { toast(errMsg(e), 'err'); }
            }}>保存草稿</button>
          </>
        }>
          <div className="muted">当前可修改：机构名称、申请理由。证明材料需由申请人重新提交。</div>
        </Modal>
      )}
    </div>
  );
}

// ============ 工单中心（管理员） ============
function AdminTicketsTab({ me }: { me: User }) {
  const [items, setItems] = useState<Ticket[]>([]);
  const [active, setActive] = useState<Ticket | null>(null);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(asArray<Ticket>(await api.adminTickets())); } catch (e) { toast(errMsg(e), 'err'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const open = async (id: string) => {
    try {
      const d = await api.ticketDetail(id);
      setActive(d);
    } catch (e) { toast(errMsg(e), 'err'); }
  };

  const claim = async (id: string) => {
    try { await api.adminTicketClaim(id); toast('已认领工单'); void load(); } catch (e) { toast(errMsg(e), 'err'); }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 340px) 1fr', gap: 14 }} className="msg-grid">
      <div className="card" style={{ maxHeight: 560, overflow: 'auto' }}>
        <div style={{ padding: '10px 14px', fontWeight: 700, borderBottom: '1px solid var(--line)' }}>全部工单</div>
        {loading ? <Loading /> : items.length === 0 ? <Empty text="暂无工单" icon="ticket" /> : items.map((t) => {
          const statusLabel = t.status === 'closed' ? '已关闭' : t.status === 'claimed' ? '已认领' : '待处理';
          const statusColor = t.status === 'closed' ? 'var(--ink-3)' : t.status === 'claimed' ? 'var(--accent-2)' : 'var(--warn)';
          const assigned = String((t as { assigned_admin_id?: string }).assigned_admin_id || '');
          return (
            <div key={t.id} className="row-item" style={{ cursor: 'pointer', background: active?.id === t.id ? 'var(--bg)' : undefined }} onClick={() => open(t.id)}>
              <div style={{ display: 'flex' }}><I name="ticket" size={20} /></div>
              <div className="grow" style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</div>
                <div className="muted" style={{ fontSize: 11 }}>
                  {(t as { user_username?: string }).user_username} · {timeAgo(t.updated_at || t.created_at)}
                  {assigned && assigned !== me.id && <span style={{ color: 'var(--accent-2)' }}> · 已分配</span>}
                </div>
              </div>
              <span className="tag" style={{ color: statusColor, borderColor: 'currentColor' }}>{statusLabel}</span>
              {t.status !== 'closed' && !assigned && (
                <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); void claim(t.id); }}>认领</button>
              )}
            </div>
          );
        })}
      </div>
      <div className="card" style={{ minHeight: 560, display: 'flex', flexDirection: 'column' }}>
        {!active ? <Empty text="选择工单查看" icon="ticket" /> : (
          <>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ fontWeight: 700 }}>{active.subject}</div>
              <div className="muted" style={{ fontSize: 12 }}>状态：{active.status} {active.updated_at && '· 更新 ' + timeAgo(active.updated_at as string)}</div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(active.messages || []).map((m) => {
                const fromAdmin = m.sender_role === 'admin' || m.sender_role === 'system';
                return (
                  <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: fromAdmin ? 'flex-start' : 'flex-end' }}>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 3 }}>
                      {m.username || (fromAdmin ? '客服' : '用户')} {fromAdmin && <I name="shield" size={12} style={{ marginLeft: 4 }} />} · {timeAgo(m.created_at as string)}
                    </div>
                    <div style={{
                      maxWidth: '80%', padding: '10px 14px', borderRadius: 14, fontSize: 14,
                      background: fromAdmin ? 'color-mix(in srgb, var(--accent-2) 12%, var(--paper))' : 'var(--bg)',
                      border: fromAdmin ? '1px solid color-mix(in srgb, var(--accent-2) 40%, transparent)' : 'none',
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}>
                      {m.content}
                      {m.image_urls?.length ? <div className="img-grid" style={{ marginTop: 6 }}>{m.image_urls.map((u, i) => <img key={i} src={u} alt="" style={{ width: 100, height: 100 }} />)}</div> : null}
                    </div>
                  </div>
                );
              })}
            </div>
            {active.status === 'open' ? (
              <div style={{ padding: 12, borderTop: '1px solid var(--line)', display: 'flex', gap: 8 }}>
                <input type="text" value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && reply.trim() && (async () => {
                  try { await api.adminTicketReply(active.id, reply); setReply(''); setActive(await api.ticketDetail(active.id)); } catch (er) { toast(errMsg(er), 'err'); }
                })()} placeholder="以客服身份回复…" style={{ flex: 1, padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg)', color: 'var(--ink)', minWidth: 0 }} />
                <button className="btn btn-primary btn-sm" disabled={!reply.trim()} onClick={async () => {
                  try { await api.adminTicketReply(active.id, reply); setReply(''); setActive(await api.ticketDetail(active.id)); } catch (er) { toast(errMsg(er), 'err'); }
                }}>回复</button>
                <button className="btn btn-sm" onClick={async () => {
                  if (!confirm('关闭该工单？')) return;
                  try { await api.adminTicketClose(active.id); toast('已关闭'); setActive(null); void load(); } catch (er) { toast(errMsg(er), 'err'); }
                }}>关闭</button>
              </div>
            ) : (
              <div style={{ padding: 12, borderTop: '1px solid var(--line)', textAlign: 'center' }}>
                <button className="btn btn-sm" onClick={async () => {
                  try { await api.adminTicketReopen(active.id); toast('已重新打开'); setActive(null); void load(); } catch (er) { toast(errMsg(er), 'err'); }
                }}>重新打开</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============ 用户管理 ============
function UsersTab() {
  const [q, setQ] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  const load = useCallback(async (query = '') => {
    setLoading(true);
    try {
      const d = await api.adminUsers(query || undefined, 50, 0);
      setUsers(asArray<User>(d));
    } catch (e) { toast(errMsg(e), 'err'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div>
      <div className="flex" style={{ marginBottom: 14 }}>
        <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索用户名 / 邮箱 / UID" style={{ flex: 1, maxWidth: 400, padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg)', color: 'var(--ink)' }} />
        <button className="btn btn-sm" onClick={() => load(q.trim())}>搜索</button>
        <button className="btn btn-sm btn-ghost" onClick={() => { setQ(''); void load(); }}>全部</button>
      </div>
      {loading ? <Loading /> : users.length === 0 ? <Empty text="未找到用户" icon="users" /> : (
        <div className="card table-wrap">
          <table className="table">
            <thead><tr><th>用户</th><th>UID</th><th>角色</th><th>状态</th><th>粉丝</th><th>视频</th><th>操作</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.username}</td>
                  <td className="mono">{u.uid}</td>
                  <td>{u.role || 'user'}</td>
                  <td>
                    <span className="tag" style={{ color: u.account_status === 'banned' ? 'var(--err)' : 'var(--ok)', borderColor: 'currentColor' }}>
                      {u.account_status === 'banned' ? '封禁' : '正常'}
                    </span>
                  </td>
                  <td>{fmtCount(u.follower_count as number ?? 0)}</td>
                  <td>{fmtCount(u.video_count as number ?? 0)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn btn-sm" onClick={() => setEditing(u)}>管理</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <UserManageModal user={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); void load(q); }} />}
    </div>
  );
}

const ROLES = ['user', 'video_moderation', 'content_review', 'admin'];

function UserManageModal({ user, onClose, onDone }: { user: User; onClose: () => void; onDone: () => void }) {
  const [banReason, setBanReason] = useState(user.ban_reason || '');
  const [busy, setBusy] = useState(false);

  const doAction = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    try { await fn(); toast(msg); onDone(); } catch (e) { toast(errMsg(e), 'err'); setBusy(false); }
  };

  return (
    <Modal title={`管理用户：${user.username}`} onClose={onClose} wide>
      <div className="notice-banner">
        UID: <span className="mono">{user.uid}</span> · 角色: <b>{user.role || 'user'}</b> · 状态: <b>{user.account_status || 'active'}</b>
        {user.ban_reason && <div style={{ marginTop: 4 }}>封禁原因：{user.ban_reason}</div>}
      </div>
      <div className="section-title" style={{ fontSize: 14 }}>角色权限</div>
      <div className="chip-row" style={{ marginBottom: 16 }}>
        {ROLES.map((r) => (
          <button key={r} className={'chip' + ((user.role || 'user') === r ? ' active' : '')} disabled={busy}
            onClick={() => doAction(() => api.adminUserRole(user.id, r), '角色已更新')}>{r}</button>
        ))}
      </div>
      <div className="section-title" style={{ fontSize: 14 }}>账号状态</div>
      <div className="flex wrap" style={{ marginBottom: 16 }}>
        <input type="text" value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="封禁原因（封禁时填写）" style={{ flex: 1, minWidth: 200, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', color: 'var(--ink)' }} />
        <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => doAction(() => api.adminUserStatus(user.id, 'banned', banReason || undefined), '已封禁')}>封禁</button>
        <button className="btn btn-sm" disabled={busy} onClick={() => doAction(() => api.adminUserStatus(user.id, 'active'), '已解封')}>解封</button>
      </div>
      <div className="section-title" style={{ fontSize: 14 }}>细粒度权限</div>
      <div className="flex wrap" style={{ marginBottom: 16 }}>
        {['content_review', 'video_moderation'].map((p) => {
          const has = (user.permissions || []).includes(p) || user.role === p || user.role === 'admin';
          return (
            <button key={p} className={'chip' + (has ? ' active' : '')} disabled={busy}
              onClick={() => doAction(() => api.adminUserPermissions(user.id, p, !has), has ? '已移除 ' + p : '已授予 ' + p)}>
              {has && <I name="check" size={13} style={{ marginRight: 4 }} />}{p}
            </button>
          );
        })}
        <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => doAction(() => api.adminUserRemoveReviewer(user.id), '已移除内容审核权限')}>移除内容审核员身份</button>
        <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => doAction(() => api.adminUserPurgeVideos(user.id), '已清理未过审视频')}>清理其未过审视频</button>
      </div>
    </Modal>
  );
}

// ============ 视频管理 ============
function VideosTab() {
  const [items, setItems] = useState<Video[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (off = 0) => {
    setLoading(true);
    try {
      const d = await api.adminVideos(30, off);
      setItems(asArray<Video>(d));
    } catch (e) { toast(errMsg(e), 'err'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(0); }, [load]);

  const toggleGeo = async (v: Video) => {
    const next = v.geo_block === 'CN' ? null : 'CN';
    try {
      await api.adminVideoGeoBlock(v.id, next);
      toast(next ? '已屏蔽中国大陆地区' : '已解除地区限制');
      void load(offset);
    } catch (e) { toast(errMsg(e), 'err'); }
  };

  return (
    <div>
      <div className="muted" style={{ marginBottom: 10 }}>共 {items.length} 条（当前页） · 支持地区屏蔽、直接删除、编辑</div>
      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th>视频</th><th>作者</th><th>状态</th><th>地区</th><th>观看</th><th>操作</th></tr></thead>
          <tbody>
            {items.map((v) => (
              <tr key={v.id}>
                <td style={{ maxWidth: 280 }}>
                  <Link to={`/video/${v.id}`} style={{ fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title}</Link>
                </td>
                <td>{v.author_username}</td>
                <td><span className="tag">{v.status}</span></td>
                <td>{v.geo_block ? <span style={{ color: 'var(--err)' }}>{v.geo_block}</span> : '全球'}</td>
                <td>{fmtCount(v.views)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn btn-sm btn-ghost" onClick={() => toggleGeo(v)}>{v.geo_block === 'CN' ? '解除屏蔽' : '屏蔽CN'}</button>
                  <button className="btn btn-sm btn-danger" onClick={async () => {
                    if (!confirm(`确定删除「${v.title}」？`)) return;
                    try { await api.videoDelete(v.id); toast('已删除'); void load(offset); } catch (e) { toast(errMsg(e), 'err'); }
                  }}>删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
        <button className="btn btn-sm" disabled={offset <= 0 || loading} onClick={async () => { const o = Math.max(0, offset - 30); setOffset(o); void load(o); }}>上一页</button>
        <button className="btn btn-sm" disabled={items.length < 30 || loading} onClick={async () => { const o = offset + 30; setOffset(o); void load(o); }}>下一页</button>
      </div>
    </div>
  );
}

// ============ 公告管理 ============
function AnnouncementsTab() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [active, setActive] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await api.announcementsAll(100)); } catch (e) { toast(errMsg(e), 'err'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <button className="btn btn-sm btn-primary" onClick={() => { setShowNew(true); setTitle(''); setContent(''); setActive(true); }}>＋ 新建公告</button>
      </div>
      {loading ? <Loading /> : items.length === 0 ? <Empty text="暂无公告" icon="megaphone" /> : (
        <div className="card" style={{ padding: 6 }}>
          {items.map((a) => (
            <div key={a.id} className="row-item">
              <div style={{ display: 'flex' }}><I name="megaphone" size={20} /></div>
              <div className="grow" style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{a.title}</div>
                <div className="desc">{a.content}</div>
              </div>
              <span className="tag" style={{ color: a.is_active ? 'var(--ok)' : 'var(--ink-3)', borderColor: 'currentColor' }}>{a.is_active ? '启用' : '停用'}</span>
              <button className="btn btn-sm" onClick={() => { setEditing(a); setTitle(a.title); setContent(a.content); setActive(!!a.is_active); }}>编辑</button>
              <button className="btn btn-sm btn-danger" onClick={async () => {
                if (!confirm('删除该公告？')) return;
                try { await api.adminAnnouncementDelete(a.id); toast('已删除'); void load(); } catch (e) { toast(errMsg(e), 'err'); }
              }}>删除</button>
            </div>
          ))}
        </div>
      )}
      {(showNew || editing) && (
        <Modal title={editing ? '编辑公告' : '新建公告'} onClose={() => { setShowNew(false); setEditing(null); }} foot={
          <>
            <button className="btn" onClick={() => { setShowNew(false); setEditing(null); }}>取消</button>
            <button className="btn btn-primary" onClick={async () => {
              if (!title.trim() || !content.trim()) { toast('请填写标题和内容', 'err'); return; }
              try {
                if (editing) await api.adminAnnouncementUpdate(editing.id, { title: title.trim(), content: content.trim(), is_active: active });
                else await api.adminAnnouncementCreate(title.trim(), content.trim(), active);
                toast('已保存'); setShowNew(false); setEditing(null); void load();
              } catch (e) { toast(errMsg(e), 'err'); }
            }}>保存</button>
          </>
        }>
          <div className="field"><label>标题</label><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="field"><label>内容（支持 Markdown）</label><textarea value={content} onChange={(e) => setContent(e.target.value)} style={{ minHeight: 160 }} /></div>
          <label className="flex" style={{ gap: 8, fontSize: 14 }}><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> 立即启用</label>
        </Modal>
      )}
    </div>
  );
}

// ============ 公投管理 ============
function ReferendumsTab() {
  const [items, setItems] = useState<Referendum[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [allowText, setAllowText] = useState(false);
  const [options, setOptions] = useState<string[]>(['选项 A', '选项 B']);
  const [viewing, setViewing] = useState<Referendum | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await api.adminReferendums()); } catch (e) { toast(errMsg(e), 'err'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const toggleStatus = async (r: Referendum) => {
    const next = r.status === 'active' ? 'ended' : 'active';
    try {
      await api.adminReferendumUpdate(r.id, { status: next });
      toast(next === 'active' ? '已开启' : '已结束');
      void load();
    } catch (e) { toast(errMsg(e), 'err'); }
  };

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <button className="btn btn-sm btn-primary" onClick={() => setShowNew(true)}>＋ 新建公投</button>
      </div>
      {loading ? <Loading /> : items.length === 0 ? <Empty text="暂无公投" icon="vote" /> : (
        <div className="card" style={{ padding: 6 }}>
          {items.map((r) => (
            <div key={r.id} className="row-item">
              <div style={{ display: 'flex' }}><I name="vote" size={20} /></div>
              <div className="grow" style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{r.title}</div>
                <div className="desc">{r.description}</div>
                <div className="muted" style={{ fontSize: 11 }}>{fmtCount(r.response_count)} 人参与</div>
              </div>
              <span className="tag" style={{ color: r.status === 'active' ? 'var(--ok)' : 'var(--ink-3)', borderColor: 'currentColor' }}>{r.status === 'active' ? '进行中' : '已结束'}</span>
              <button className="btn btn-sm" onClick={() => setViewing(r)}>结果</button>
              <button className="btn btn-sm" onClick={() => toggleStatus(r)}>{r.status === 'active' ? '结束' : '重新开启'}</button>
              <a className="btn btn-sm btn-ghost" href={api.adminReferendumExport(r.id)} target="_blank" rel="noreferrer">导出CSV</a>
            </div>
          ))}
        </div>
      )}
      {showNew && (
        <Modal title="新建公投" onClose={() => setShowNew(false)} foot={
          <>
            <button className="btn" onClick={() => setShowNew(false)}>取消</button>
            <button className="btn btn-primary" onClick={async () => {
              if (!title.trim() || options.length < 2) { toast('标题和至少两个选项必填', 'err'); return; }
              try {
                await api.adminReferendumCreate({ title: title.trim(), description: desc.trim() || undefined, status: 'active', allow_text: allowText, options: options.map((label) => ({ label })) });
                toast('公投已创建'); setShowNew(false); void load();
              } catch (e) { toast(errMsg(e), 'err'); }
            }}>创建</button>
          </>
        }>
          <div className="field"><label>标题</label><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="field"><label>说明</label><textarea value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
          <div className="field">
            <label>选项</label>
            {options.map((o, i) => (
              <div key={i} className="flex" style={{ marginBottom: 8 }}>
                <input type="text" value={o} onChange={(e) => setOptions((p) => p.map((x, j) => (j === i ? e.target.value : x)))} style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', color: 'var(--ink)', minWidth: 0 }} />
                {options.length > 2 && <button className="btn btn-sm btn-ghost" onClick={() => setOptions((p) => p.filter((_, j) => j !== i))}><I name="x" size={13} /></button>}
              </div>
            ))}
            <button className="btn btn-sm btn-ghost" onClick={() => setOptions((p) => [...p, `选项 ${String.fromCharCode(65 + p.length)}`])}>＋ 添加选项</button>
          </div>
          <label className="flex" style={{ gap: 8, fontSize: 14 }}><input type="checkbox" checked={allowText} onChange={(e) => setAllowText(e.target.checked)} /> 允许填写补充意见</label>
        </Modal>
      )}
      {viewing && (
        <ResultsModal referendum={viewing} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}

interface RefResults {
  referendum?: { title?: string; status?: string };
  options?: { id?: string; label: string; vote_count: number }[];
  text_responses?: { text?: string; username?: string; created_at?: string }[];
  total?: number;
}
function ResultsModal({ referendum, onClose }: { referendum: Referendum; onClose: () => void }) {
  const [results, setResults] = useState<RefResults | null>(null);
  useEffect(() => {
    api.adminReferendumResults(referendum.id).then((r) => setResults(r as unknown as RefResults)).catch(() => setResults(null));
  }, [referendum.id]);
  const total = results?.total || (results?.options || []).reduce((s, o) => s + (o.vote_count || 0), 0);
  return (
    <Modal title={`公投结果：${referendum.title}`} onClose={onClose} wide>
      {!results ? <Loading /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(results.options || []).map((o, i) => {
            const pct = total ? Math.round(((o.vote_count || 0) / total) * 100) : 0;
            return (
              <div key={o.id || i}>
                <div className="flex between" style={{ fontSize: 13, marginBottom: 4 }}>
                  <span>{o.label}</span><span className="muted">{o.vote_count} 票 · {pct}%</span>
                </div>
                <div className="progress"><div style={{ width: pct + '%', background: 'var(--accent-2)' }} /></div>
              </div>
            );
          })}
          <div className="muted" style={{ fontSize: 13 }}>共 {total} 票</div>
          {results.text_responses && results.text_responses.length > 0 && (
            <>
              <div className="divider" />
              <div style={{ fontWeight: 700, fontSize: 13 }}>文字回答（{results.text_responses.length}）</div>
              <div style={{ maxHeight: 200, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {results.text_responses.map((t, i) => (
                  <div key={i} className="muted" style={{ fontSize: 12, background: 'var(--bg)', borderRadius: 8, padding: '6px 10px' }}>
                    {t.username ? t.username + '：' : ''}{t.text}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

// ============ 消息推送 ============
function BroadcastTab() {
  const [userId, setUserId] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [broadcast, setBroadcast] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div className="card" style={{ padding: 20, maxWidth: 560 }}>
      <div style={{ fontWeight: 700, marginBottom: 12 }}>发送站内信</div>
      <div className="field">
        <label>目标用户 UID{broadcast && '（全员广播时留空）'}</label>
        <input type="text" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="用户 UID 或 ID" />
      </div>
      <div className="field"><label>标题</label><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} /></div>
      <div className="field"><label>内容</label><textarea value={content} onChange={(e) => setContent(e.target.value)} maxLength={2000} /></div>
      <label className="flex" style={{ gap: 8, fontSize: 14, marginBottom: 14 }}>
        <input type="checkbox" checked={broadcast} onChange={(e) => setBroadcast(e.target.checked)} /> 全员广播（发送给所有用户）
      </label>
      <button className="btn btn-primary" disabled={busy || !title.trim() || !content.trim() || (!broadcast && !userId.trim())} onClick={async () => {
        setBusy(true);
        try {
          await api.adminSendMessage(broadcast ? '' : userId.trim(), title.trim(), content.trim(), broadcast);
          toast(broadcast ? '广播已发送' : '站内信已发送');
          setTitle(''); setContent(''); setUserId('');
        } catch (e) { toast(errMsg(e), 'err'); } finally { setBusy(false); }
      }}>发送</button>
    </div>
  );
}
