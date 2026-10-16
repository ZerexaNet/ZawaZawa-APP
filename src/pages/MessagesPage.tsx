import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { messages } from '../lib/api';
import type { Conversation, DirectMessage, InboxMessage, Ticket, TicketMessage } from '../lib/types';
import { Avatar, Btn, Dialog, Empty, Field, Loading, Spinner, Tabs, VBadge } from '../components/ui';
import { I } from '../components/icons';
import { useAuth } from '../store/auth';
import { useToast, errMsg } from '../store/toast';
import { asList } from '../lib/http';
import { fmtDateTime, timeAgo } from '../lib/util';

type Tab = 'inbox' | 'dm' | 'tickets';

export default function MessagesPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const user = useAuth(s => s.user);
  const dmTarget = params.get('dm');

  const [tab, setTab] = useState<Tab>(dmTarget ? 'dm' : 'inbox');
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => { if (!user) nav('/login'); }, [user, nav]);

  useEffect(() => {
    messages.summary().then(setSummary).catch(() => { });
  }, [tab]);

  useEffect(() => {
    if (dmTarget) setTab('dm');
  }, [dmTarget]);

  return (
    <div className="page fade-in">
      <h1 className="page-title row" style={{ gap: 8 }}><I name="message" size={24} /> 消息中心</h1>
      <Tabs
        tabs={[
          { key: 'inbox', label: '站内信', icon: 'megaphone', count: summary?.inboxUnread },
          { key: 'dm', label: '私信', icon: 'message', count: summary?.directUnread },
          { key: 'tickets', label: '工单', icon: 'ticket' },
        ]}
        value={tab}
        onChange={k => setTab(k as Tab)}
      />
      {tab === 'inbox' && <InboxTab />}
      {tab === 'dm' && <DmTab initialUserId={dmTarget} />}
      {tab === 'tickets' && <TicketsTab />}
    </div>
  );
}

/* ================= 站内信 ================= */
function InboxTab() {
  const toast = useToast(s => s.push);
  const [list, setList] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [openMsg, setOpenMsg] = useState<InboxMessage | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    messages.inbox(50, 0).then((d: any) => {
      setList(asList<InboxMessage>(d));
    }).catch(() => { }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const open = async (m: InboxMessage) => {
    setOpenMsg(m);
    if (!m.is_read) {
      setList(prev => prev.map(x => x.id === m.id ? { ...x, is_read: 1 } : x));
      messages.inboxRead(m.id).then(() => {
        messages.summary().then(setSummaryLocal).catch(() => { });
      }).catch(() => { });
    }
  };
  const setSummaryLocal = () => { window.dispatchEvent(new Event('zzw:refresh-summary')); };

  const markAll = async () => {
    try { await messages.inboxRead(); toast('已全部标为已读', 'success'); load(); } catch (e: any) { toast(errMsg(e), 'error'); }
  };

  return (
    <div className="col" style={{ gap: 10, maxWidth: 760 }}>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        {list.some(m => !m.is_read) && <Btn variant="tonal" size="sm" onClick={markAll}><I name="check" size={15} /> 全部标为已读</Btn>}
      </div>
      {loading ? <Loading /> : list.length === 0 ? (
        <Empty icon="megaphone" title="暂无站内信" />
      ) : (
        <div className="col" style={{ gap: 8 }}>
          {list.map(m => (
            <div key={m.id} className={`inbox-item ${!m.is_read ? 'unread' : ''}`} onClick={() => open(m)}>
              <div className="it-title">
                {!m.is_read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--md-primary)', flex: 'none' }} />}
                {m.title || '（无标题）'}
              </div>
              <div className="it-content clamp2">{m.content}</div>
              <div className="muted small">{timeAgo(m.created_at)}</div>
            </div>
          ))}
        </div>
      )}
      <Dialog open={!!openMsg} onClose={() => setOpenMsg(null)} title={openMsg?.title || '站内信'}>
        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{openMsg?.content}</div>
        <div className="muted small" style={{ textAlign: 'right' }}>{fmtDateTime(openMsg?.created_at)}</div>
      </Dialog>
    </div>
  );
}

/* ================= 私信 ================= */
function DmTab({ initialUserId }: { initialUserId?: string | null }) {
  const toast = useToast(s => s.push);
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [conv, setConv] = useState<Conversation | null>(null);
  const [msgs, setMsgs] = useState<DirectMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const loadConvs = useCallback(() => {
    setLoading(true);
    messages.conversations().then((d: any) => {
      setConvs(asList<Conversation>(d));
    }).catch(() => { }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { loadConvs(); }, [loadConvs]);

  const openConv = async (c: Conversation) => {
    setConv(c);
    setMsgs([]);
    const uid = String(c.user_id ?? c.uid ?? c.other_user?.uid ?? c.id);
    try {
      const d: any = await messages.direct(uid);
      setMsgs(asList<DirectMessage>(d?.messages ?? d));
      messages.directRead(uid).catch(() => { });
    } catch (e: any) { toast(errMsg(e), 'error'); }
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
  };
  useEffect(() => {
    if (initialUserId) {
      const c: Conversation = { user_id: initialUserId, username: '', gravatar_url: '' };
      setConv(c);
      messages.direct(initialUserId).then((d: any) => {
        setMsgs(asList<DirectMessage>(d?.messages ?? d));
        if (d?.other_user) setConv({ ...c, ...d.other_user });
      }).catch(() => { });
      messages.directRead(initialUserId).catch(() => { });
    }
  }, [initialUserId]);

  useEffect(() => { endRef.current?.scrollIntoView(); }, [msgs.length]);

  const send = async () => {
    const t = text.trim();
    if (!t || !conv || sending) return;
    setSending(true);
    const uid = String(conv.user_id ?? conv.uid ?? conv.other_user?.uid ?? conv.id);
    try {
      await messages.directSend(uid, t);
      setMsgs(prev => [...prev, { id: 'tmp' + Date.now(), content: t, sender_id: 'me', created_at: new Date().toISOString() }]);
      setText('');
    } catch (e: any) { toast(errMsg(e, '发送失败'), 'error'); }
    finally { setSending(false); }
  };

  const openNew = async () => {
    const name = newName.trim();
    if (!name) return;
    // 用户名 → 用户 ID：用搜索接口
    try {
      const { videos } = await import('../lib/api');
      const d: any = await videos.search(name, 10);
      const u = d?.users?.[0];
      if (u?.id) {
        setNewOpen(false);
        setNewName('');
        openConv({ user_id: String(u.id), uid: u.uid, username: u.username, gravatar_url: u.gravatar_url } as Conversation);
      } else {
        toast('未找到该用户', 'error');
      }
    } catch (e: any) { toast(errMsg(e), 'error'); }
  };

  const convLabel = (c: Conversation) => c.username || c.other_user?.username || `UID ${c.user_id ?? c.uid}`;
  const me = useAuth(s => s.user);
  const myId = String(me?.id ?? '');
  const myUid = String(me?.uid ?? '');

  return (
    <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 14, maxWidth: 900 }}>
      <div className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '68dvh' }}>
        <div className="row row--between" style={{ padding: '2px 6px 8px' }}>
          <b style={{ font: 'var(--text-title-sm)' }}>会话</b>
          <Btn variant="tonal" size="sm" onClick={() => setNewOpen(true)}><I name="userPlus" size={14} /> 发起私信</Btn>
        </div>
        {loading ? <Loading /> : convs.length === 0 ? (
          <div className="muted small" style={{ padding: 14 }}>还没有私会话，点击右上角发起</div>
        ) : (
          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {convs.map((c, i) => (
              <div
                key={String(c.user_id ?? c.uid ?? i)}
                className="conv-item"
                style={conv && String(conv.user_id ?? conv.uid) === String(c.user_id ?? c.uid) ? { background: 'var(--glass-2)' } : undefined}
                onClick={() => openConv(c)}
              >
                <Avatar user={{ gravatar_url: c.gravatar_url ?? c.other_user?.gravatar_url, username: convLabel(c) }} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <span className="clamp1" style={{ font: 'var(--text-title-sm)' }}>{convLabel(c)}</span>
                    <VBadge badge={c.other_user ? undefined : undefined} size={13} />
                  </div>
                  {c.last_message && <div className="muted small clamp1" style={{ marginTop: 2 }}>{c.last_message}</div>}
                </div>
                {c.unread ? <span className="unread">{c.unread > 99 ? '99+' : c.unread}</span> : c.last_at ? <span className="muted small">{timeAgo(c.last_at)}</span> : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card col" style={{ padding: 14, gap: 12, minHeight: 320 }}>
        {conv ? (
          <>
            <div className="row" style={{ gap: 10, borderBottom: '1px solid var(--md-outline-variant)', paddingBottom: 10 }}>
              <Avatar user={{ gravatar_url: conv.gravatar_url ?? conv.other_user?.gravatar_url, username: convLabel(conv) }} size={36} />
              <b>{convLabel(conv)}</b>
              {(conv.uid || conv.user_id) && (
                <a href={`/user/${conv.uid ?? conv.user_id}`} className="btn btn--text btn--sm" style={{ marginLeft: 'auto' }}>查看主页</a>
              )}
            </div>
            <div className="msg-thread">
              {msgs.length === 0 && <div className="muted small" style={{ textAlign: 'center', padding: 20 }}>还没有消息，打个招呼吧</div>}
              {msgs.map((m, i) => {
                const mine = String(m.sender_id ?? '') === myId || String(m.sender_id ?? '') === myUid || m.sender_id === 'me';
                return (
                  <div key={m.id || i} className={`msg-bubble ${mine ? 'mine' : 'theirs'}`}>
                    {(m.image_urls || []).map((u, j) => <img key={j} src={u} loading="lazy" alt="" />)}
                    {m.content}
                    <div className="msg-time">{fmtDateTime(m.created_at)}</div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
            <div className="msg-input">
              <textarea
                value={text}
                placeholder="输入私信内容…"
                rows={1}
                maxLength={2000}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              />
              <Btn variant="filled" onClick={send} disabled={sending || !text.trim()}>{sending ? <Spinner size={15} /> : <I name="send" size={16} />}</Btn>
            </div>
          </>
        ) : (
          <Empty icon="message" title="选择一个会话" desc="或点击右上角发起新的私信" />
        )}
      </div>

      <Dialog open={newOpen} onClose={() => setNewOpen(false)} title="发起私信"
        actions={<><Btn variant="text" onClick={() => setNewOpen(false)}>取消</Btn><Btn variant="filled" onClick={openNew}>确定</Btn></>}>
        <Field label="对方用户名" hint="输入用户名，将从搜索结果中选择第一个匹配用户">
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="对方用户名" autoFocus />
        </Field>
      </Dialog>
    </div>
  );
}

/* ================= 工单 ================= */
function TicketsTab() {
  const toast = useToast(s => s.push);
  const [list, setList] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [openTicket, setOpenTicket] = useState<Ticket | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    messages.tickets().then((d: any) => setList(asList<Ticket>(d))).catch(() => { }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const open = async (t: Ticket) => {
    setOpenTicket(t);
    try {
      const d: any = await messages.ticket(t.id);
      setOpenTicket(d?.ticket ?? d);
    } catch { /* 用列表数据 */ }
  };

  const create = async () => {
    if (!subject.trim() || !content.trim()) { toast('请填写标题和描述', 'info'); return; }
    setSending(true);
    try {
      await messages.ticketCreate({ subject: subject.trim(), content: content.trim() });
      setNewOpen(false);
      setSubject(''); setContent('');
      toast('工单已提交', 'success');
      load();
    } catch (e: any) { toast(errMsg(e), 'error'); }
    finally { setSending(false); }
  };

  const sendReply = async () => {
    if (!reply.trim() || !openTicket) return;
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('content', reply.trim());
      const r: any = await messages.ticketReply(openTicket.id, fd);
      setReply('');
      const t2 = await messages.ticket(openTicket.id).then((x: any) => x?.ticket ?? x).catch(() => null);
      setOpenTicket(t2 || { ...openTicket, messages: [...(openTicket.messages || []), { id: 'tmp' + Date.now(), content: reply.trim(), sender_role: 'user', created_at: new Date().toISOString() } as TicketMessage] });
      void r;
      load();
    } catch (e: any) { toast(errMsg(e), 'error'); }
    finally { setSending(false); }
  };

  const reopen = async (t: Ticket) => {
    try {
      await messages.ticketReopen(t.id);
      toast('工单已重新打开', 'success');
      setOpenTicket(null);
      load();
    } catch (e: any) { toast(errMsg(e), 'error'); }
  };

  const statusMap: Record<string, [string, string]> = {
    open: ['status-tag--open', '待处理'],
    pending: ['status-tag--pending', '处理中'],
    resolved: ['status-tag--approved', '已解决'],
    closed: ['status-tag--rejected', '已关闭'],
  };

  return (
    <div className="col" style={{ gap: 10, maxWidth: 860 }}>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <Btn variant="tonal" size="sm" onClick={() => setNewOpen(true)}><I name="plus" size={15} /> 提交新工单</Btn>
      </div>
      {loading ? <Loading /> : list.length === 0 ? (
        <Empty icon="ticket" title="暂无工单" desc="遇到问题？提交工单联系官方支持" />
      ) : (
        <div className="col" style={{ gap: 8 }}>
          {list.map(t => {
            const [cls, label] = statusMap[t.status || 'open'] || ['status-tag--open', t.status || ''];
            return (
              <div key={t.id} className="card row" style={{ padding: 14, gap: 12, cursor: 'pointer', alignItems: 'center' }} onClick={() => open(t)}>
                <I name="ticket" size={20} className="muted" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="clamp1" style={{ font: 'var(--text-title-sm)' }}>{t.subject || '（无标题工单）'}</div>
                  <div className="muted small" style={{ marginTop: 3 }}>{t.messages?.[0]?.content || ''}</div>
                </div>
                <span className={`status-tag ${cls}`}>{label}</span>
                <span className="muted small" style={{ minWidth: 70, textAlign: 'right' }}>{timeAgo(t.updated_at || t.created_at)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* 工单详情 */}
      <Dialog open={!!openTicket} onClose={() => setOpenTicket(null)} title={openTicket?.subject || '工单详情'} wide>
        {openTicket && (
          <>
            <div className="row" style={{ gap: 8 }}>
              {(() => { const [cls, label] = statusMap[openTicket.status || 'open'] || ['status-tag--open', '']; return <span className={`status-tag ${cls}`}>{label}</span>; })()}
              <span className="muted small">工单号 {openTicket.id.slice(0, 8)}…</span>
            </div>
            <div className="msg-thread" style={{ maxHeight: '48dvh' }}>
              {(openTicket.messages || []).map((m, i) => (
                <div key={m.id || i} className={`msg-bubble ${m.sender_role === 'user' ? 'mine' : 'theirs'}`}>
                  <div className="muted small" style={{ marginBottom: 4, opacity: 0.7 }}>{m.sender_role === 'user' ? (m.username || '我') : `官方支持 · ${m.username || ''}`}</div>
                  {(m.image_urls || []).map((u, j) => <img key={j} src={u} loading="lazy" alt="" />)}
                  {m.content}
                  <div className="msg-time">{fmtDateTime(m.created_at)}</div>
                </div>
              ))}
            </div>
            {openTicket.status === 'closed' ? (
              <Btn variant="tonal" onClick={() => reopen(openTicket)}><I name="refresh" size={15} /> 重新打开工单</Btn>
            ) : (
              <div className="msg-input">
                <textarea value={reply} placeholder="回复官方支持…" rows={2} maxLength={2000} onChange={e => setReply(e.target.value)} />
                <Btn variant="filled" onClick={sendReply} disabled={sending || !reply.trim()}>{sending ? <Spinner size={15} /> : <I name="send" size={16} />}</Btn>
              </div>
            )}
          </>
        )}
      </Dialog>

      {/* 新建工单 */}
      <Dialog open={newOpen} onClose={() => setNewOpen(false)} title="提交工单"
        actions={<><Btn variant="text" onClick={() => setNewOpen(false)}>取消</Btn><Btn variant="filled" onClick={create} disabled={sending}>{sending ? <Spinner size={15} /> : <I name="send" size={15} />} 提交</Btn></>}>
        <Field label="标题 *"><input value={subject} onChange={e => setSubject(e.target.value)} maxLength={80} placeholder="一句话描述问题" autoFocus /></Field>
        <Field label="详细描述 *"><textarea value={content} onChange={e => setContent(e.target.value)} style={{ minHeight: 140 }} placeholder="请详细描述遇到的问题、发生时间与相关页面…" /></Field>
      </Dialog>
    </div>
  );
}
