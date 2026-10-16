import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { videos, users, collections } from '../lib/api';
import type { Comment, Video } from '../lib/types';
import { Player } from '../components/Player';
import { Comments } from '../components/Comments';
import { Avatar, Btn, Dialog, Field, Loading, Menu, VBadge, confirmDialog } from '../components/ui';
import { I } from '../components/icons';
import { useAuth } from '../store/auth';
import { useToast, errMsg } from '../store/toast';
import { copyText, fmtDateTime, fmtViews } from '../lib/util';
import { parseCat } from '../lib/categories';

export default function VideoPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const user = useAuth(s => s.user);
  const toast = useToast(s => s.push);

  const [v, setV] = useState<Video | null>(null);
  const [author, setAuthor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [liked, setLiked] = useState(false);
  const [faved, setFaved] = useState(false);
  const [confused, setConfused] = useState(false);
  const [coined, setCoined] = useState(false);
  const [following, setFollowing] = useState(false);
  const [recs, setRecs] = useState<Video[]>([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('违规内容');
  const [reportDetails, setReportDetails] = useState('');
  const [favTo, setFavTo] = useState<string | null>(null);
  const [myCols, setMyCols] = useState<any[]>([]);
  const [descOpen, setDescOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErr('');
    try {
      const d: any = await videos.detail(id);
      const video = d?.video ?? d;
      setV(video);
      setLiked(!!video.liked);
      setFaved(!!video.favorited);
      setConfused(!!video.confused);
      if (video.author_id || video.author_uid) {
        const aid = video.author_uid ?? video.author_id;
        users.public(String(aid)).then((u: any) => {
          const usr = u?.user ?? u;
          setAuthor(usr);
          setFollowing(!!usr?.is_following);
        }).catch(() => { });
      }
      videos.liked(id).then((r: any) => setLiked(!!r?.liked)).catch(() => { });
      videos.favorited(id).then((r: any) => setFaved(!!r?.favorited)).catch(() => { });
      videos.confused(id).then((r: any) => setConfused(!!r?.confused)).catch(() => { });
    } catch (e: any) {
      setErr(e?.message || '视频不存在或已被删除');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); window.scrollTo(0, 0); }, [load]);
  useEffect(() => {
    if (id && v?.status === 'approved') {
      videos.recommend(id, 12).then((d: any) => setRecs(Array.isArray(d) ? d : d?.items || [])).catch(() => { });
    }
  }, [id, v?.status]);

  const requireAuth = () => {
    if (!user) {
      toast('请先登录', 'info');
      nav('/login?next=' + encodeURIComponent(location.pathname));
      return false;
    }
    return true;
  };

  const doLike = async () => {
    if (!requireAuth()) return;
    try {
      const r: any = liked ? await videos.unlike(id!) : await videos.like(id!);
      setLiked(!!(r?.liked ?? !liked));
      setV(x => x && { ...x, likes: Math.max(0, (x.likes || 0) + (liked ? -1 : 1)) });
    } catch (e: any) { toast(errMsg(e), 'error'); }
  };
  const doFav = async (colId?: string) => {
    if (!requireAuth()) return;
    try {
      if (faved && !colId) { await videos.unfavorite(id!); setFaved(false); setV(x => x && { ...x, fav_count: Math.max(0, (x.fav_count || 0) - 1) }); toast('已取消收藏', 'success'); return; }
      if (colId) {
        await collections.addItem(colId, { video_id: id!, part_title: v?.title, sort_order: 999 });
        toast('已加入合集', 'success');
      } else {
        await videos.favorite(id!);
        setFaved(true);
        setV(x => x && { ...x, fav_count: (x.fav_count || 0) + 1 });
        toast('收藏成功', 'success');
      }
    } catch (e: any) {
      if (colId) {
        // 可能已存在
        const msg = String(e?.message || '');
        if (!/已存在|exist/i.test(msg)) toast(errMsg(e, '加入合集失败'), 'error');
      } else toast(errMsg(e), 'error');
    }
    setFavTo(null);
  };
  const openFavMenu = async () => {
    if (!requireAuth()) return;
    try {
      const d: any = await users.meCollections();
      setMyCols(Array.isArray(d) ? d : d?.items || []);
    } catch { setMyCols([]); }
    setFavTo('open');
  };
  const doCoin = async () => {
    if (!requireAuth()) return;
    if (coined) { toast('已投过币', 'info'); return; }
    try {
      await videos.coin(id!);
      setCoined(true);
      setV(x => x && { ...x, coin_count: (x.coin_count || 0) + 1 });
      toast('投币成功 +1', 'success');
    } catch (e: any) { toast(errMsg(e), 'error'); }
  };
  const doConfuse = async () => {
    if (!requireAuth()) return;
    try {
      const r: any = await videos.confusion(id!);
      setConfused(!!(r?.confused ?? !confused));
      setV(x => x && { ...x, confusion_count: Math.max(0, (x.confusion_count || 0) + (confused ? -1 : 1)) });
    } catch (e: any) { toast(errMsg(e), 'error'); }
  };
  const doFollow = async () => {
    if (!requireAuth()) return;
    if (!author) return;
    try {
      const r: any = following ? await users.unfollow(author.id) : await users.follow(author.id);
      setFollowing(!!(r?.following ?? !following));
      setAuthor((a: any) => a && { ...a, is_following: r?.following ?? !following, follower_count: (a.follower_count || 0) + ((r?.following ?? !following) ? 1 : -1) });
      toast(r?.following ?? !following ? '已关注' : '已取消关注', 'success');
    } catch (e: any) { toast(errMsg(e), 'error'); }
  };
  const doShare = async () => {
    try {
      const full = location.origin + location.pathname;
      let url = full;
      try {
        const r: any = await videos.shorten(full, 'video', id!);
        if (r?.short_url) url = r.short_url;
      } catch { /* 缩短失败用完整链接 */ }
      videos.shareTrack('video', id!, 'copy').catch(() => { });
      await copyText(url);
      toast('链接已复制到剪贴板', 'success');
    } catch { toast('复制失败', 'error'); }
  };
  const doReport = async () => {
    try {
      await videos.report(id!, reportReason, reportDetails);
      setReportOpen(false);
      setReportDetails('');
      toast('举报已提交，我们会尽快处理', 'success');
    } catch (e: any) { toast(errMsg(e, '举报提交失败'), 'error'); }
  };

  const isOwner = user && v && (user.id === v.author_id || user.uid === v.author_uid);
  const isAdmin = user && ['admin', 'video_moderation', 'content_review'].includes(user.role || '');

  const commentHandlers = useMemo(() => ({
    list: (l: number, o: number) => videos.comments(id!, l, o),
    post: (c: string, p?: string) => videos.commentPost(id!, c, p),
    like: (cid: string) => videos.commentLike(cid),
    remove: (cid: string) => videos.commentDelete(cid),
  }), [id]);

  const canDeleteComment = useCallback((c: Comment) => {
    if (!user || !v) return false;
    return c.username === user.username || c.author_id === user.id || !!isAdmin;
  }, [user, v, isAdmin]);

  if (loading) return <Loading text="加载视频…" />;
  if (err || !v) {
    return (
      <div className="empty">
        <I name="alert" size={26} className="muted" />
        <div style={{ font: 'var(--text-title-md)' }}>{err || '视频不存在'}</div>
        <Btn variant="tonal" onClick={() => nav('/')}>返回首页</Btn>
      </div>
    );
  }

  const { main: catMain, sub: catSub } = parseCat(v.category);
  const descLong = (v.description || '').length > 140;

  return (
    <div className="video-layout fade-in">
      <div className="col" style={{ gap: 16, minWidth: 0 }}>
        <Player video={v} onWatched={() => { }} />

        <div className="video-head">
          <h1 className="vt">{v.title}</h1>
          <div className="video-meta">
            <span>{fmtViews(v.views)} 播放</span>
            <span>·</span>
            <span>{fmtDateTime(v.created_at)}</span>
            <span>·</span>
            <span className="chip" style={{ height: 24, padding: '0 10px', cursor: 'default' }}>{catMain}{catSub ? ` / ${catSub}` : ''}</span>
            {v.ip_location && <><span>·</span><span>{v.ip_location}</span></>}
            {v.status === 'pending_review' && <span className="status-tag status-tag--pending">审核中，仅自己可见</span>}
            {v.status === 'rejected' && <span className="status-tag status-tag--rejected">未通过审核{v.moderation_opinion ? `：${v.moderation_opinion}` : ''}</span>}
            {v.geo_block && <span className="status-tag status-tag--pending">部分地区受限</span>}
          </div>

          {/* 操作行 */}
          <div className="video-actions">
            <button className={`action-pill ${liked ? 'on-error' : ''}`} onClick={doLike}>
              <I name={liked ? 'heartFill' : 'heart'} size={18} /> {fmtViews(v.likes)}
            </button>
            <button className={`action-pill ${faved ? 'on' : ''}`} onClick={() => (faved ? doFav() : openFavMenu())}>
              <I name={faved ? 'bookmarkFill' : 'bookmark'} size={18} /> {fmtViews(v.fav_count)}
            </button>
            <button className={`action-pill ${coined ? 'on-warn' : ''}`} onClick={doCoin}>
              <I name={coined ? 'coinFill' : 'coin'} size={18} /> 投币 {fmtViews(v.coin_count)}
            </button>
            <button className={`action-pill ${confused ? 'on' : ''}`} onClick={doConfuse} title="何意味？">
              <I name="question" size={18} /> 何意味 {fmtViews(v.confusion_count)}
            </button>
            <button className="action-pill" onClick={doShare}><I name="share" size={18} /> 分享</button>
            <Menu
              trigger={<button className="action-pill" style={{ padding: '0 14px' }}><I name="dots" size={18} /></button>}
              items={[
                { label: '复制链接', icon: 'link', onClick: doShare },
                ...(v.source_url ? [{ label: '打开原始链接', icon: 'external', onClick: () => window.open(v.source_url, '_blank') }] : []),
                'sep',
                ...(isOwner ? [
                  { label: '编辑视频信息', icon: 'edit', onClick: () => nav(`/upload?edit=${id}`) },
                  { label: '删除视频', icon: 'trash', danger: true, onClick: async () => {
                    const ok = await confirmDialog({ title: '删除视频', message: '确定删除该视频吗？此操作不可恢复。', okText: '删除', danger: true });
                    if (!ok) return;
                    try { await videos.remove(id!); toast('已删除', 'success'); nav('/'); } catch (e: any) { toast(errMsg(e), 'error'); }
                  } },
                ] : []),
                { label: '举报视频', icon: 'flag', danger: true, onClick: () => setReportOpen(true) },
              ]}
            />
          </div>

          {/* 作者卡 */}
          {author && (
            <div className="card row" style={{ padding: '12px 16px', marginTop: 14, gap: 12 }}>
              <Link to={`/user/${author.id}`}><Avatar user={author} size={46} /></Link>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link to={`/user/${author.id}`} className="row" style={{ gap: 6 }}>
                  <span style={{ font: 'var(--text-title-sm)' }}>{author.username}</span>
                  <VBadge badge={author.verification_badge} label={author.verification_label} size={15} />
                </Link>
                <div className="muted small" style={{ marginTop: 2 }}>{fmtNum2(author.follower_count)} 粉丝</div>
              </div>
              {user && user.id !== author.id && (
                <Btn variant={following ? 'tonal' : 'filled'} size="sm" onClick={doFollow}>
                  <I name={following ? 'userCheck' : 'userPlus'} size={16} /> {following ? '已关注' : '关注'}
                </Btn>
              )}
            </div>
          )}

          {/* 简介 */}
          {v.description && (
            <div className="video-desc" style={{ cursor: descLong ? 'pointer' : 'default' }} onClick={() => descLong && setDescOpen(true)}>
              {descLong && !descOpen ? (v.description as string).slice(0, 140) + '…' : v.description}
            </div>
          )}
          <Dialog open={descOpen} onClose={() => setDescOpen(false)} title="视频简介">
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{v.description}</div>
          </Dialog>
        </div>

        <Comments targetId={id!} handlers={commentHandlers} canDelete={canDeleteComment} />
      </div>

      {/* 侧栏推荐 */}
      <aside className="col" style={{ gap: 12, minWidth: 0 }}>
        {recs.length > 0 && (
          <div className="card side-card">
            <h3 className="row" style={{ gap: 7 }}><I name="sparkles" size={16} /> 相关推荐</h3>
            <div className="col" style={{ gap: 2, maxHeight: 560, overflowY: 'auto' }}>
              {recs.map(r => (
                <RecItem key={r.id} v={r} onNotInterested={async () => {
                  try { await videos.notInterested(r.id); setRecs(x => x.filter(y => y.id !== r.id)); toast('已减少此类推荐', 'info'); } catch { /* ignore */ }
                }} />
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* 举报弹窗 */}
      <Dialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="举报视频"
        actions={
          <>
            <Btn variant="text" onClick={() => setReportOpen(false)}>取消</Btn>
            <Btn variant="filled" onClick={doReport}>提交举报</Btn>
          </>
        }
      >
        <Field label="举报原因">
          <select value={reportReason} onChange={e => setReportReason(e.target.value)}>
            {['违规内容', '侵权/版权', '色情低俗', '垃圾广告', '人身攻击', '欺诈', '其他'].map(r => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="补充说明（可选）">
          <textarea value={reportDetails} onChange={e => setReportDetails(e.target.value)} placeholder="请描述具体问题…" />
        </Field>
      </Dialog>

      {/* 加入合集 */}
      <Dialog open={!!favTo} onClose={() => setFavTo(null)} title="加入合集"
        actions={<Btn variant="text" onClick={() => setFavTo(null)}>取消</Btn>}>
        <div className="col" style={{ gap: 4 }}>
          <button className="list-item" onClick={() => doFav()} style={{ justifyContent: 'flex-start' }}>
            <I name="bookmark" size={18} className="muted" />
            <span className="li-title">默认收藏夹</span>
          </button>
          {myCols.map(c => (
            <button key={c.id} className="list-item" onClick={() => doFav(c.id)} style={{ justifyContent: 'flex-start' }}>
              <I name="folder" size={18} className="muted" />
              <span className="li-title">{c.title}</span>
            </button>
          ))}
          {myCols.length === 0 && <div className="muted small" style={{ padding: '6px 14px' }}>暂无合集，可在「我的合集」中创建</div>}
        </div>
      </Dialog>
    </div>
  );
}

function RecItem({ v, onNotInterested }: { v: Video; onNotInterested: () => void }) {
  return (
    <div className="rec-item">
      <Link to={`/video/${v.id}`} style={{ flex: 1, minWidth: 0 }}>
        <div style={{ aspectRatio: '16/9', borderRadius: 8, overflow: 'hidden', background: 'var(--md-surface-container)', marginBottom: 6 }}>
          {v.cover_url && <img className="rec-thumb" src={v.cover_url} loading="lazy" decoding="async" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        </div>
        <div className="rec-title clamp2">{v.title}</div>
        <div className="rec-sub clamp1">{v.author_username} · {fmtViews(v.views)} 播放</div>
      </Link>
      <Menu trigger={<button className="icon-btn icon-btn--sm" onClick={e => e.stopPropagation()} aria-label="更多"><I name="dots" size={16} /></button>}
        items={[{ label: '不感兴趣', icon: 'x', onClick: onNotInterested }]} />
    </div>
  );
}

function fmtNum2(n?: number) {
  return fmtViews(n);
}
