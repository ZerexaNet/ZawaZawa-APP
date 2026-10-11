import { useCallback, useEffect, useState } from 'react';
import { I } from '../icons';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { asArray, type Article, type Post, type User, type Video } from '../types';
import { Avatar, Cover, Empty, Loading, VideoCard, VerBadge } from '../components';
import { errMsg, toast, useAuth } from '../store';
import { fmtCount, timeAgo } from '../lib/utils';

export function UserPage() {
  const { userId = '' } = useParams();
  const { user: me } = useAuth();
  const [info, setInfo] = useState<{ user: User; videos?: Video[] } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<'videos' | 'articles' | 'dynamics' | 'followers'>('videos');
  const [list, setList] = useState<(Video | Article | Post | User)[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followCount, setFollowCount] = useState<number | null>(null);
  const [blocked, setBlocked] = useState(false);

  const isMe = me && String(me.uid) === userId;

  useEffect(() => {
    setInfo(null);
    setNotFound(false);
    setTab('videos');
    api.userPublic(userId).then((r) => {
      setInfo(r);
      if (r.user && me) {
        setFollowing(!!r.user.is_following);
        setFollowCount(typeof r.user.follower_count === 'number' ? r.user.follower_count : null);
      }
    }).catch(() => setNotFound(true));
  }, [userId, me]);

  // 关注状态
  useEffect(() => {
    if (isMe || !me) return;
    api.followStatus(userId).then((r) => {
      setFollowing(!!r.following);
      setFollowCount(typeof r.follower_count === 'number' ? r.follower_count : null);
    }).catch(() => {});
  }, [userId, me, isMe]);

  const loadTab = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'videos') {
        // 用户视频内嵌在公开信息 /users/{id} 的 videos 字段（无独立端点）
        setList(info?.videos || []);
        setLoading(false);
        return;
      }
      let d: unknown;
      if (tab === 'articles') d = await api.userArticles(userId, 30, 0);
      if (tab === 'dynamics') d = await api.userDynamics(userId, 30, 0);
      if (tab === 'followers') d = await api.userFollowers(userId, 30, 0);
      setList(asArray(d as never));
    } catch (e) {
      toast(errMsg(e), 'err');
    } finally { setLoading(false); }
  }, [tab, userId, info]);

  useEffect(() => { void loadTab(); }, [loadTab]);

  const doFollow = async () => {
    if (!me) return;
    try {
      const r = following ? await api.unfollow(userId) : await api.follow(userId);
      setFollowing(r.following);
      if (typeof r.follower_count === 'number') setFollowCount(r.follower_count);
    } catch (e) { toast(errMsg(e), 'err'); }
  };

  const doBlock = async () => {
    if (!me) return;
    try {
      if (blocked) await api.unblock(userId); else await api.block(userId);
      setBlocked(!blocked);
      toast(blocked ? '已取消拉黑' : '已拉黑该用户');
    } catch (e) { toast(errMsg(e), 'err'); }
  };

  if (notFound) return <div className="page"><Empty text="用户不存在" icon="ghost" /></div>;
  if (!info) return <div className="page"><Loading /></div>;

  const u = info.user;

  return (
    <div className="page" style={{ maxWidth: 900, margin: '0 auto' }}>
      <div className="card" style={{ padding: 24, marginBottom: 16, display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <Avatar name={u.username} size={84} url={u.gravatar_url} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 21, fontWeight: 800 }}>{u.username} <VerBadge badge={u.verification_badge} label={u.verification_label} /></div>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{u.bio || '这个人很懒，什么都没写'}</div>
          <div className="flex wrap" style={{ marginTop: 10, fontSize: 14 }}>
            <span><b>{fmtCount(followCount ?? u.follower_count)}</b> <span className="muted">粉丝</span></span>
            <span style={{ marginLeft: 16 }}><b>{fmtCount(u.following_count as number ?? 0)}</b> <span className="muted">关注</span></span>
            <span style={{ marginLeft: 16 }}><b>{fmtCount(u.video_count as number ?? 0)}</b> <span className="muted">视频</span></span>
            <span className="muted" style={{ marginLeft: 16, fontSize: 12 }}>{timeAgo(u.created_at as string)} 加入</span>
          </div>
        </div>
        {!isMe && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className={'btn ' + (following ? '' : 'btn-primary')} onClick={doFollow}>{following ? <><I name="check" size={14} /> 已关注</> : <><I name="plus" size={14} /> 关注</>}</button>
            <button className="btn" onClick={doBlock}>{blocked ? '取消拉黑' : '拉黑'}</button>
          </div>
        )}
      </div>

      <div className="tabs">
        {([['videos', '视频'], ['articles', '专栏'], ['dynamics', '动态'], ['followers', '粉丝']] as const).map(([id, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {loading ? <Loading /> : list.length === 0 ? <Empty text="暂无内容" /> : (
        <>
          {tab === 'videos' && <div className="grid-videos">{(list as Video[]).map((v) => <VideoCard key={v.id} v={v} />)}</div>}
          {tab === 'articles' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(list as Article[]).map((a) => (
                <ArticleRow key={a.id} a={a} />
              ))}
            </div>
          )}
          {tab === 'dynamics' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(list as Post[]).map((p) => (
                <div key={p.id} className="card" style={{ padding: 14 }}>
                  <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{p.content}</div>
                  {p.video_id && <VideoCardMini id={p.video_id} />}
                  {p.images && p.images.length > 0 && (
                    <div className="img-grid" style={{ marginTop: 8 }}>{p.images.map((img, i) => <img key={i} src={img} alt="" />)}</div>
                  )}
                  <div className="muted" style={{ fontSize: 12, marginTop: 8 }}><I name="heart" size={12} filled /> {fmtCount(p.like_count)} · {timeAgo(p.created_at as string)}</div>
                </div>
              ))}
            </div>
          )}
          {tab === 'followers' && (
            <div className="card" style={{ padding: 6 }}>
              {(list as User[]).map((f) => <FollowerRow key={f.id} f={f} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FollowerRow({ f }: { f: User }) {
  const [st, setSt] = useState<{ following: boolean } | null>(null);
  useEffect(() => {
    api.followStatus(f.uid).then((r) => setSt({ following: !!r.following })).catch(() => {});
  }, [f.uid]);
  return (
    <div className="row-item">
      <Avatar name={f.username} size={40} url={f.gravatar_url} />
      <div className="grow">
        <div style={{ fontWeight: 600 }}>{f.username} <VerBadge badge={f.verification_badge} label={f.verification_label} /></div>
        <div className="desc">{f.bio || `ID ${f.uid}`} {typeof f.follower_count === 'number' && <span className="muted"> · {fmtCount(f.follower_count)} 粉丝</span>}</div>
      </div>
      <button
        className={'btn btn-sm ' + (st?.following ? '' : 'btn-primary')}
        disabled={!st}
        onClick={async () => {
          try {
            const r = st?.following ? await api.unfollow(f.uid) : await api.follow(f.uid);
            setSt({ following: !!r.following });
          } catch (e) { toast(errMsg(e), 'err'); }
        }}
      >
        {st?.following ? <><I name="check" size={14} /> 已关注</> : <><I name="plus" size={14} /> 关注</>}
      </button>
    </div>
  );
}

function ArticleRow({ a }: { a: Article }) {
  return (
    <a href={`/article/${a.id}`} className="card" style={{ display: 'flex', gap: 12, padding: 12 }}>
      {a.cover_url && <Cover src={a.cover_url} alt="" style={{ width: 110, height: 74, objectFit: 'cover', borderRadius: 10 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{a.title}</div>
        {a.summary && <div className="muted" style={{ fontSize: 13, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.summary}</div>}
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}><I name="play" size={12} filled /> {fmtCount(a.views)} · {timeAgo(a.created_at as string)}</div>
      </div>
    </a>
  );
}

function VideoCardMini({ id }: { id: string }) {
  const [v, setV] = useState<Video | null>(null);
  useEffect(() => {
    api.video(id).then(setV).catch(() => {});
  }, [id]);
  if (!v) return null;
  return <VideoCard v={v} compact />;
}
