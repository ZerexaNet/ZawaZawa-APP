import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { articles, users } from '../lib/api';
import type { Article, Comment } from '../lib/types';
import { Markdown } from '../components/Markdown';
import { Comments } from '../components/Comments';
import { Avatar, Btn, Loading, VBadge, confirmDialog } from '../components/ui';
import { I } from '../components/icons';
import { useAuth } from '../store/auth';
import { useToast, errMsg } from '../store/toast';
import { copyText, fmtDateTime, fmtViews } from '../lib/util';

export default function ArticlePage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const user = useAuth(s => s.user);
  const toast = useToast(s => s.push);

  const [a, setA] = useState<Article | null>(null);
  const [author, setAuthor] = useState<any>(null);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const d: any = await articles.detail(id);
      setA(d?.article ?? d);
      const aid = d?.article?.author_id ?? d?.author_uid ?? d?.author_id;
      if (aid) {
        users.public(String(aid)).then((u: any) => {
          const usr = u?.user ?? u;
          setAuthor(usr);
          setFollowing(!!usr?.is_following);
        }).catch(() => { });
      }
    } catch (e: any) {
      setErr(e?.message || '专栏不存在或已被删除');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); window.scrollTo(0, 0); }, [load]);

  const isOwner = user && a && (user.id === (a as any).author_id || user.uid === (a as any).author_uid);
  const isAdmin = user && ['admin', 'video_moderation', 'content_review'].includes(user.role || '');

  const handlers = useMemo(() => ({
    list: (l: number, o: number) => articles.comments(id!, l, o),
    post: (c: string, p?: string) => articles.commentPost(id!, c, p),
    like: (cid: string) => articles.commentLike(id!, cid),
    remove: (cid: string) => articles.commentDelete(id!, cid),
  }), [id]);

  const canDelete = useCallback((c: Comment) => {
    if (!user || !a) return false;
    return c.username === user.username || c.author_id === user.id || !!isAdmin;
  }, [user, a, isAdmin]);

  const doFollow = async () => {
    if (!author) return;
    try {
      const r: any = following ? await users.unfollow(author.id) : await users.follow(author.id);
      setFollowing(!!(r?.following ?? !following));
      toast(r?.following ?? !following ? '已关注' : '已取消关注', 'success');
    } catch (e: any) { toast(errMsg(e), 'error'); }
  };

  if (loading) return <Loading text="加载专栏…" />;
  if (err || !a) {
    return (
      <div className="empty">
        <I name="alert" size={26} className="muted" />
        <div style={{ font: 'var(--text-title-md)' }}>{err || '专栏不存在'}</div>
        <Btn variant="tonal" onClick={() => nav('/')}>返回首页</Btn>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ maxWidth: 860, margin: '0 auto', width: '100%' }}>
      <article className="card" style={{ padding: '26px 30px' }}>
        {a.cover_url && <img src={a.cover_url} alt="" style={{ borderRadius: 14, marginBottom: 18, maxHeight: 380, objectFit: 'cover', width: '100%' }} />}
        <h1 style={{ font: 'var(--text-display-sm)', marginBottom: 14 }}>{a.title}</h1>
        <div className="row row--between" style={{ gap: 10, flexWrap: 'wrap', borderBottom: '1px solid var(--md-outline-variant)', paddingBottom: 16, marginBottom: 6 }}>
          <div className="row" style={{ gap: 10 }}>
            {author && <Link to={`/user/${author.id}`}><Avatar user={author} size={40} /></Link>}
            <div>
              <div className="row" style={{ gap: 6 }}>
                <Link to={`/user/${author?.id}`} style={{ font: 'var(--text-title-sm)' }}>{a.author_username || author?.username}</Link>
                <VBadge badge={a.author_verification_badge} size={14} />
              </div>
              <div className="muted small" style={{ marginTop: 2 }}>
                {fmtDateTime(a.created_at)} · {fmtViews(a.views)} 阅读{a.author_ip_location ? ` · ${a.author_ip_location}` : ''}
              </div>
            </div>
          </div>
          <div className="row" style={{ gap: 6 }}>
            {author && user && user.id !== author.id && (
              <Btn variant={following ? 'tonal' : 'tonal-primary'} size="sm" onClick={doFollow}>
                <I name={following ? 'userCheck' : 'userPlus'} size={15} /> {following ? '已关注' : '关注'}
              </Btn>
            )}
            <Btn variant="text" size="sm" onClick={async () => { await copyText(location.href); toast('链接已复制', 'success'); }}>
              <I name="link" size={15} /> 分享
            </Btn>
            {isOwner && (
              <>
                <Btn variant="text" size="sm" onClick={() => nav(`/upload?article=${id}`)}><I name="edit" size={15} /> 编辑</Btn>
                <Btn variant="danger-text" size="sm" onClick={async () => {
                  const ok = await confirmDialog({ title: '删除专栏', message: '确定删除该专栏吗？此操作不可恢复。', okText: '删除', danger: true });
                  if (!ok) return;
                  try { await articles.remove(id!); toast('已删除', 'success'); nav('/'); } catch (e: any) { toast(errMsg(e), 'error'); }
                }}><I name="trash" size={15} /> 删除</Btn>
              </>
            )}
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <Markdown content={a.content} />
        </div>
      </article>

      <div style={{ marginTop: 22 }}>
        <Comments targetId={id!} handlers={handlers} canDelete={canDelete} />
      </div>
    </div>
  );
}
