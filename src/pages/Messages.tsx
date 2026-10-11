import { useCallback, useEffect, useRef, useState } from 'react';
import { I } from '../icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Conversation, DirectThread, InboxMessage, Ticket, TicketMessage, User } from '../types';
import { Avatar, Empty, Loading, Modal } from '../components';
import { errMsg, toast, useAuth } from '../store';
import { timeAgo } from '../lib/utils';

type Tab = 'inbox' | 'direct' | 'tickets';

export function MessagesPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>('inbox');
  const [inboxOpenId, setInboxOpenId] = useState<string | null>(null);
  // inbox
  const [inbox, setInbox] = useState<InboxMessage[]>([]);
  // conversations
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [activeUser, setActiveUser] = useState<string | null>(null);
  const [thread, setThread] = useState<DirectThread | null>(null);
  const [dmText, setDmText] = useState('');
  // tickets
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTicket, setActiveTicket] = useState<string | null>(null);
  const [ticketDetail, setTicketDetail] = useState<Ticket | null>(null);
  const [ticketReply, setTicketReply] = useState('');
  const [ticketImages, setTicketImages] = useState<File[]>([]);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!user) nav('/login'); }, [user, nav]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [i, c, t] = await Promise.all([
        api.inbox().catch(() => [] as InboxMessage[]),
        api.conversations().catch(() => [] as Conversation[]),
        api.myTickets().catch(() => [] as Ticket[]),
      ]);
      setInbox(Array.isArray(i) ? i : []);
      setConvos(Array.isArray(c) ? c : []);
      setTickets(Array.isArray(t) ? t : []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (user) void loadAll(); }, [user, loadAll]);

  const dmCount = thread?.messages?.length ?? 0;
  const tkCount = ticketDetail?.messages?.length ?? 0;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dmCount, tkCount]);

  // 打开会话
  const openConvo = async (uidRaw: string | number) => {
    const uid = String(uidRaw);
    setActiveUser(uid);
    setThread(null);
    try {
      const t = await api.direct(uid);
      setThread(t);
      api.directRead(uid).catch(() => {});
      setConvos((prev) => prev.map((c) => (String(c.other_user.uid) === uid ? { ...c, unread_count: 0 } : c)));
    } catch (e) { toast(errMsg(e), 'err'); }
  };

  const sendDm = async () => {
    const text = dmText.trim();
    if (!activeUser || !text) return;
    setDmText('');
    // 乐观更新
    setThread((prev) => prev ? { ...prev, messages: [...prev.messages, { id: 'tmp' + Date.now(), sender_id: user?.id, content: text, created_at: new Date().toISOString(), pending: true }] } : prev);
    try {
      const r = await api.directSend(activeUser, text);
      setThread((prev) => prev ? { ...prev, messages: prev.messages.map((m) => (m.id.startsWith('tmp') ? { ...m, id: (r as { id?: string }).id || m.id, pending: false } : m)) } : prev);
      setConvos((prev) => prev.map((c) => (c.other_user.uid === activeUser ? { ...c, last_message: text } : c)));
    } catch (e) {
      toast(errMsg(e), 'err');
      setThread((prev) => prev ? { ...prev, messages: prev.messages.filter((m) => !m.id.startsWith('tmp')) } : prev);
    }
  };

  const openTicket = async (id: string) => {
    setActiveTicket(id);
    setTicketDetail(null);
    try {
      const d = await api.ticketDetail(id);
      setTicketDetail(d);
    } catch (e) { toast(errMsg(e), 'err'); }
  };

  const sendTicketReply = async () => {
    const text = ticketReply.trim();
    if (!activeTicket || !text) return;
    setTicketReply('');
    try {
      await api.ticketReply(activeTicket, text, ticketImages);
      setTicketImages([]);
      const d = await api.ticketDetail(activeTicket);
      setTicketDetail(d);
    } catch (e) { toast(errMsg(e), 'err'); }
  };

  const reopen = async (id: string) => {
    try {
      await api.ticketReopen(id);
      toast('工单已重新打开');
      await loadAll();
      openTicket(id);
    } catch (e) { toast(errMsg(e), 'err'); }
  };

  if (!user) return null;

  const isMine = (m: TicketMessage) => String(m.sender_id) === String(user.id);

  return (
    <div className="page" style={{ maxWidth: 980, margin: '0 auto' }}>
      <div className="flex between" style={{ marginBottom: 12 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}><I name="mail" size={18} /> 消息中心</h1>
        <button className="btn btn-sm btn-primary" onClick={() => setShowNewTicket(true)}>＋ 提交工单</button>
      </div>

      <div className="tabs">
        <button className={tab === 'inbox' ? 'active' : ''} onClick={() => setTab('inbox')}><I name="inbox" size={14} /> 站内信</button>
        <button className={tab === 'direct' ? 'active' : ''} onClick={() => setTab('direct')}><I name="chat" size={14} /> 私信</button>
        <button className={tab === 'tickets' ? 'active' : ''} onClick={() => setTab('tickets')}><I name="ticket" size={14} /> 工单</button>
      </div>

      {loading ? <Loading /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 320px) 1fr', gap: 14, alignItems: 'start' }} className="msg-grid">
          {/* 左栏列表 */}
          <div className="card" style={{ maxHeight: 560, overflow: 'auto' }}>
            {tab === 'inbox' && (
              <>
                <div style={{ padding: '10px 14px', fontWeight: 700, borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  站内信
                  {inbox.some((m) => !Number(m.is_read)) && (
                    <button className="btn btn-sm btn-ghost" onClick={async () => {
                      try { await api.inboxRead(); setInbox((prev) => prev.map((m) => ({ ...m, is_read: 1 }))); } catch { /* ignore */ }
                    }}>全部已读</button>
                  )}
                </div>
                {inbox.length === 0 && <Empty text="暂无站内信" icon="inbox" />}
                {inbox.map((m) => (
                  <div
                    key={m.id}
                    className="row-item"
                    style={{ cursor: 'pointer', opacity: Number(m.is_read) ? 0.65 : 1 }}
                    onClick={async () => {
                      if (!Number(m.is_read)) {
                        try { await api.inboxRead(m.id); } catch { /* ignore */ }
                      }
                      setInbox((prev) => prev.map((x) => (x.id === m.id ? { ...x, is_read: 1 } : x)));
                      setInboxOpenId(m.id);
                    }}
                  >
                    <div className="grow">
                      <div style={{ fontWeight: Number(m.is_read) ? 500 : 700 }}>{m.title}</div>
                      <div className="desc">{m.content}</div>
                      <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{timeAgo(m.created_at as string)}</div>
                    </div>
                    {!Number(m.is_read) && <span style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--accent)' }} />}
                  </div>
                ))}
              </>
            )}

            {tab === 'direct' && (
              <>
                <div style={{ padding: '10px 14px', fontWeight: 700, borderBottom: '1px solid var(--line)' }}>会话</div>
                {convos.length === 0 && <Empty text="还没有私信会话" icon="chat" />}
                {convos.map((c) => (
                  <div key={String(c.other_user.uid)} className="row-item" style={{ cursor: 'pointer', background: activeUser === String(c.other_user.uid) ? 'var(--bg)' : undefined }} onClick={() => openConvo(c.other_user.uid || c.other_user.id)}>
                    <Avatar name={c.other_user.username} size={38} url={c.other_user.gravatar_url as string} />
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.other_user.username}</div>
                      <div className="desc">{c.last_message || '开始聊天…'}</div>
                    </div>
                    {(c.unread_count || 0) > 0 && <span className="tag" style={{ background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }}>{c.unread_count}</span>}
                  </div>
                ))}
              </>
            )}

            {tab === 'tickets' && (
              <>
                <div style={{ padding: '10px 14px', fontWeight: 700, borderBottom: '1px solid var(--line)' }}>我的工单</div>
                {tickets.length === 0 && <Empty text="还没有工单" icon="ticket" />}
                {tickets.map((t) => (
                  <div key={t.id} className="row-item" style={{ cursor: 'pointer', background: activeTicket === t.id ? 'var(--bg)' : undefined }} onClick={() => openTicket(t.id)}>
                    <div style={{ display: 'flex' }}><I name="ticket" size={22} /></div>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</div>
                      <div className="muted" style={{ fontSize: 11 }}>{timeAgo(t.updated_at || t.created_at)} · {t.messages?.length ?? 0} 条消息</div>
                    </div>
                    <span className="tag" style={{ color: t.status === 'open' ? 'var(--ok)' : 'var(--ink-3)', borderColor: 'currentColor' }}>
                      {t.status === 'open' ? '处理中' : '已关闭'}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* 右栏详情 */}
          <div className="card" style={{ minHeight: 560, display: 'flex', flexDirection: 'column' }}>
            {tab === 'inbox' && inboxOpenId ? (
              <InboxDetail id={inboxOpenId} inbox={inbox} />
            ) : tab === 'inbox' ? (
              <Empty text="选择左侧消息查看详情" icon="inbox" />
            ) : tab === 'direct' ? (
              thread ? (
                <>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar name={thread.other_user.username} size={34} />
                    <div>
                      <div style={{ fontWeight: 700 }}>{thread.other_user.username}</div>
                      <div className="muted" style={{ fontSize: 11 }}>ID {thread.other_user.uid}</div>
                    </div>
                  </div>
                  <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {thread.messages.map((m) => {
                      const mine = String(m.sender_id) === String(user.id);
                      return (
                        <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                          <div
                            style={{
                              maxWidth: '72%', padding: '8px 12px', borderRadius: 14,
                              background: mine ? 'var(--accent-2)' : 'var(--bg)',
                              color: mine ? '#fff' : 'var(--ink)',
                              opacity: m.pending ? 0.6 : 1,
                              fontSize: 14, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                            }}
                          >
                            {m.content}
                            <div style={{ fontSize: 10, opacity: 0.6, marginTop: 3, textAlign: 'right' }}>{timeAgo(m.created_at as string)}</div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>
                  <div style={{ padding: 12, borderTop: '1px solid var(--line)', display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      value={dmText}
                      onChange={(e) => setDmText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendDm()}
                      placeholder="输入消息…"
                      maxLength={2000}
                      style={{ flex: 1, padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg)', color: 'var(--ink)', minWidth: 0 }}
                    />
                    <button className="btn btn-primary btn-sm" onClick={sendDm} disabled={!dmText.trim()}>发送</button>
                  </div>
                </>
              ) : (
                <NewConvoPicker convos={convos} onPick={openConvo} />
              )
            ) : ticketDetail ? (
              <>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ fontWeight: 700 }}>{ticketDetail.subject}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    状态：{ticketDetail.status === 'open' ? '处理中' : '已关闭'} · 创建 {timeAgo(ticketDetail.created_at)}
                  </div>
                </div>
                <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(ticketDetail.messages || []).map((m) => {
                    const mine = isMine(m);
                    const role = m.sender_role || (mine ? 'user' : 'admin');
                    return (
                      <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 3 }}>
                          {m.username || (role === 'admin' ? '客服' : '我')} · {role === 'admin' ? <I name="shield" size={12} /> : null} {timeAgo(m.created_at as string)}
                        </div>
                        <div
                          style={{
                            maxWidth: '80%', padding: '10px 14px', borderRadius: 14, fontSize: 14,
                            background: role === 'admin' ? 'color-mix(in srgb, var(--accent-2) 12%, var(--paper))' : mine ? 'var(--accent-2)' : 'var(--bg)',
                            color: mine ? '#fff' : 'var(--ink)',
                            border: role === 'admin' ? '1px solid color-mix(in srgb, var(--accent-2) 40%, transparent)' : 'none',
                            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                          }}
                        >
                          {m.content}
                          {m.image_urls?.length ? <div className="img-grid" style={{ marginTop: 6 }}>{m.image_urls.map((u, i) => <img key={i} src={u} alt="" style={{ width: 100, height: 100 }} />)}</div> : null}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
                {ticketDetail.status === 'open' ? (
                  <div style={{ padding: 12, borderTop: '1px solid var(--line)' }}>
                    <div className="flex" style={{ marginBottom: 8 }}>
                      <input type="file" multiple accept="image/*" onChange={(e) => setTicketImages(Array.from(e.target.files || []))} style={{ fontSize: 12 }} />
                      {ticketImages.length > 0 && <span className="muted">{ticketImages.length} 张图片</span>}
                    </div>
                    <div className="flex">
                      <input
                        type="text" value={ticketReply} onChange={(e) => setTicketReply(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendTicketReply()}
                        placeholder="回复客服…" style={{ flex: 1, padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg)', color: 'var(--ink)', minWidth: 0 }}
                      />
                      <button className="btn btn-primary btn-sm" onClick={sendTicketReply} disabled={!ticketReply.trim()}>回复</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: 12, borderTop: '1px solid var(--line)', textAlign: 'center' }}>
                    <button className="btn btn-sm" onClick={() => reopen(ticketDetail.id)}>重新打开工单</button>
                  </div>
                )}
              </>
            ) : (
              <Empty text="选择左侧工单查看详情" icon="ticket" />
            )}
          </div>
        </div>
      )}

      {showNewTicket && <NewTicketModal onClose={() => setShowNewTicket(false)} onCreated={async (id) => { setShowNewTicket(false); await loadAll(); setTab('tickets'); if (id) openTicket(id); }} />}
    </div>
  );
}

function InboxDetail({ id, inbox }: { id: string; inbox: InboxMessage[] }) {
  const m = inbox.find((x) => x.id === id);
  if (!m) return <Empty text="消息不存在" icon="inbox" />;
  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ fontSize: 18, margin: '0 0 6px' }}>{m.title}</h2>
      <div className="muted" style={{ fontSize: 12, marginBottom: 16 }}>{m.created_at}</div>
      <div style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{m.content}</div>
    </div>
  );
}

function NewConvoPicker({ convos, onPick }: { convos: Conversation[]; onPick: (uid: string | number) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!q.trim() || q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const users = await api.newConversation(q.trim());
        setResults(users.slice(0, 8));
      } catch { setResults([]); } finally { setSearching(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div style={{ fontWeight: 700 }}>发起新私信</div>
      <input
        type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索用户名…"
        style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg)', color: 'var(--ink)' }}
      />
      {searching && <Loading />}
      {results.length > 0 && (
        <div>
          {results.map((u) => (
            <div key={u.uid} className="row-item" style={{ cursor: 'pointer', padding: '8px 6px' }} onClick={() => onPick(u.uid)}>
              <Avatar name={u.username} size={34} url={u.gravatar_url} />
              <div className="grow" style={{ fontWeight: 600 }}>{u.username}</div>
              <span className="muted" style={{ fontSize: 12 }}>ID {u.uid}</span>
            </div>
          ))}
        </div>
      )}
      {convos.length > 0 && (
        <>
          <div className="divider" />
          <div className="muted" style={{ fontSize: 12 }}>历史会话</div>
          {convos.map((c) => (
            <div key={c.other_user.uid} className="row-item" style={{ cursor: 'pointer', padding: '8px 6px' }} onClick={() => onPick(c.other_user.uid || c.other_user.id)}>
              <Avatar name={c.other_user.username} size={34} />
              <div className="grow" style={{ fontWeight: 600 }}>{c.other_user.username}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function NewTicketModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id?: string) => void }) {
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="提交工单" onClose={onClose} foot={
      <>
        <button className="btn" onClick={onClose}>取消</button>
        <button className="btn btn-primary" disabled={busy || !subject.trim() || !content.trim()} onClick={async () => {
          setBusy(true);
          try {
            const r = await api.ticketCreate(subject.trim(), content.trim(), images);
            toast('工单已提交');
            onCreated((r as { id?: string })?.id);
          } catch (e) { toast(errMsg(e), 'err'); } finally { setBusy(false); }
        }}>{busy ? '提交中…' : '提交'}</button>
      </>
    }>
      <div className="field"><label>主题 *</label><input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={100} placeholder="简要描述问题" /></div>
      <div className="field"><label>问题描述 *</label><textarea value={content} onChange={(e) => setContent(e.target.value)} maxLength={2000} placeholder="详细描述遇到的问题，客服会在 1-3 个工作日内处理…" /></div>
      <div className="field"><label>截图（可选）</label><input type="file" multiple accept="image/*" onChange={(e) => setImages(Array.from(e.target.files || []))} /></div>
    </Modal>
  );
}
