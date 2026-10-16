import { useCallback, useEffect, useState } from 'react';
import type { Comment } from '../lib/types';
import { useAuth } from '../store/auth';
import { useToast, errMsg } from '../store/toast';
import { I } from './icons';
import { Avatar, VBadge, Spinner, Empty, confirmDialog } from './ui';
import { timeAgo } from '../lib/util';

interface Handlers {
  list: (limit: number, offset: number) => Promise<any>;
  post?: (content: string, parentId?: string) => Promise<any>;
  like?: (id: string) => Promise<any>;
  remove?: (id: string) => Promise<any>;
}

export function Comments({ targetId, handlers, canDelete }: { targetId: string; handlers: Handlers; canDelete: (c: Comment) => boolean }) {
  const user = useAuth(s => s.user);
  const toast = useToast(s => s.push);
  const [list, setList] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [input, setInput] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [translating, setTranslating] = useState<string | null>(null);
  const [translateMap, setTranslateMap] = useState<Record<string, string>>({});
  const [posting, setPosting] = useState(false);
  const limit = 20;
  const offset = list.length;

  const load = useCallback(async (reset = false) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);
    try {
      const d: any = await handlers.list(limit, reset ? 0 : list.length);
      const items: Comment[] = Array.isArray(d) ? d : d?.items || [];
      setTotal(Number(d?.total ?? (Array.isArray(d) ? items.length : 0)));
      setList(prev => (reset ? items : [...prev, ...items.filter(i => !prev.some(p => p.id === i.id))]));
    } catch (e: any) {
      toast(errMsg(e, '评论加载失败'), 'error');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [handlers, list.length, toast]);

  useEffect(() => { setList([]); load(true); }, [targetId]); // eslint-disable-line

  const submit = async () => {
    const content = input.trim();
    if (!content || !handlers.post || posting) return;
    setPosting(true);
    try {
      await handlers.post(content, replyTo?.id);
      setInput('');
      setReplyTo(null);
      await load(true);
      toast('评论发布成功', 'success');
    } catch (e: any) {
      toast(errMsg(e, '评论发布失败'), 'error');
    } finally {
      setPosting(false);
    }
  };

  const likeComment = async (c: Comment) => {
    if (!handlers.like) return;
    try {
      const r: any = await handlers.like(c.id);
      setList(prev => prev.map(x => x.id === c.id ? { ...x, liked: r?.liked, like_count: r?.like_count ?? x.like_count } : x));
    } catch (e: any) { toast(errMsg(e, '点赞失败'), 'error'); }
  };

  const del = async (c: Comment) => {
    if (!handlers.remove) return;
    const ok = await confirmDialog({ title: '删除评论', message: '确定删除该评论吗？删除后无法恢复。', okText: '删除', danger: true });
    if (!ok) return;
    try {
      await handlers.remove(c.id);
      await load(true);
      toast('评论已删除', 'success');
    } catch (e: any) { toast(errMsg(e, '删除失败'), 'error'); }
  };

  const translate = async (c: Comment) => {
    if (translateMap[c.id] || translating) return;
    setTranslating(c.id);
    try {
      const r: any = await (await import('../lib/api')).comments.translate(c.content || '', 'en');
      const t = r?.translated_text;
      if (t) {
        setTranslateMap(m => ({ ...m, [c.id]: t }));
        setTimeout(() => setTranslateMap(m => { const n = { ...m }; delete n[c.id]; return n; }), 12000);
      } else toast('翻译失败', 'error');
    } catch (e: any) {
      toast(errMsg(e, '翻译失败'), 'error');
    } finally { setTranslating(null); }
  };

  const renderComment = (c: Comment) => (
    <div className="comment" key={c.id}>
      <Avatar user={{ gravatar_url: c.gravatar_url, username: c.username }} size={34} />
      <div className="c-body">
        <div className="c-head">
          <span className="c-name">{c.username}</span>
          <VBadge badge={c.verification_badge} label={c.verification_label} size={13} />
          <span className="c-time">{timeAgo(c.created_at)}{c.ip_location ? ` · ${c.ip_location}` : ''}</span>
          {c.pending && <span className="status-tag status-tag--pending" style={{ font: 'var(--text-label-sm)' }}>审核中</span>}
        </div>
        <div className="c-content">{c.content}</div>
        {translateMap[c.id] && <div className="c-content muted" style={{ marginTop: 4 }}>{translateMap[c.id]}</div>}
        <div className="c-actions">
          {handlers.like && (
            <button className={`c-act ${c.liked ? 'liked' : ''}`} onClick={() => likeComment(c)}>
              <I name={c.liked ? 'heartFill' : 'heart'} size={15} /> {c.like_count || 0}
            </button>
          )}
          {handlers.post && (
            <button className="c-act" onClick={() => { setReplyTo(replyTo?.id === c.id ? null : c); setInput(''); }}>
              <I name="reply" size={15} /> 回复
            </button>
          )}
          <button className="c-act" onClick={() => translate(c)} disabled={!!translating}>
            {translating === c.id ? <Spinner size={13} /> : <I name="translate" size={15} />} 翻译
          </button>
          {canDelete(c) && (
            <button className="c-act" style={{ color: 'var(--md-error)' }} onClick={() => del(c)}>
              <I name="trash" size={15} /> 删除
            </button>
          )}
        </div>
        {c.children?.length ? (
          <div className="replies">
            {c.children.map((r: Comment) => (
              <div className="comment" key={r.id} style={{ padding: '8px 0' }}>
                <Avatar user={{ gravatar_url: r.gravatar_url, username: r.username }} size={26} />
                <div className="c-body">
                  <div className="c-head">
                    <span className="c-name">{r.username}</span>
                    <span className="c-time">{timeAgo(r.created_at)}</span>
                  </div>
                  <div className="c-content">{r.content}</div>
                  <div className="c-actions">
                    {handlers.like && (
                      <button className={`c-act ${r.liked ? 'liked' : ''}`} onClick={() => likeComment(r)}>
                        <I name={r.liked ? 'heartFill' : 'heart'} size={14} /> {r.like_count || 0}
                      </button>
                    )}
                    {canDelete(r) && (
                      <button className="c-act" style={{ color: 'var(--md-error)' }} onClick={() => del(r)}>
                        <I name="trash" size={14} /> 删除
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );

  // 平铺列表转树形（parent_id）
  const { roots } = (() => {
    const map: Record<string, Comment[]> = {};
    const roots: Comment[] = [];
    for (const c of list) {
      if (c.parent_id && list.some(p => p.id === c.parent_id)) {
        (map[c.parent_id] ||= []).push(c);
      } else {
        roots.push(c);
      }
    }
    const withKids = roots.map(r => ({ ...r, children: map[r.id] || [] }));
    return { roots: withKids };
  })();

  return (
    <div className="section">
      <div className="section-head">
        <h2>评论 {total > 0 && <span className="muted">({total})</span>}</h2>
      </div>

      {handlers.post ? (
        user ? (
          <div className="col" style={{ gap: 8 }}>
            {replyTo && (
              <div className="row" style={{ gap: 8 }}>
                <span className="chip" style={{ cursor: 'default' }}>回复 @{replyTo.username}</span>
                <button className="icon-btn icon-btn--sm" onClick={() => setReplyTo(null)} aria-label="取消回复"><I name="x" size={14} /></button>
              </div>
            )}
            <div className="comment-box">
              <Avatar user={{ gravatar_url: (user as any).gravatar_url, username: user.username }} size={36} />
              <div className="cb-input">
                <textarea
                  value={input}
                  placeholder={replyTo ? `回复 @${replyTo.username}…` : '发表评论…'}
                  maxLength={2000}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }}
                  rows={2}
                />
                <div className="row row--between" style={{ marginTop: 8 }}>
                  <span className="muted small">{input.length}/2000</span>
                  <button className="btn btn--filled btn--sm" disabled={!input.trim() || posting} onClick={submit}>
                    {posting ? <Spinner size={14} /> : <I name="send" size={15} />} 发布
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="empty" style={{ padding: '20px' }}>
            <span className="muted">登录后可发表评论</span>
          </div>
        )
      ) : null}

      <div>
        {loading ? <Spinner className="center" /> : roots.length === 0 ? (
          <Empty icon="message" title="还没有评论" desc="来抢沙发吧" />
        ) : (
          <>
            {roots.map(renderComment)}
            {offset < total && (
              <div className="center" style={{ padding: '10px 0' }}>
                <button className="btn btn--tonal btn--sm" onClick={() => load()} disabled={loadingMore}>
                  {loadingMore ? <Spinner size={14} /> : `加载更多（还有 ${total - offset} 条）`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
