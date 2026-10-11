import { useCallback, useEffect, useRef, useState } from 'react';
import { I } from '../icons';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { asArray, type Article, type Collection, type Post, type User, type Video } from '../types';
import { Avatar, Confirm, Cover, Empty, Loading, Modal, VerBadge } from '../components';
import { errMsg, toast, useAuth } from '../store';
import { downloadJSON, fmtCount, timeAgo } from '../lib/utils';
import { CaptchaBox, type CaptchaResult } from '../captcha';
import { NewArticleModal } from './ArticlePage';

export function MePage() {
  const { user, setUser } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState<'overview' | 'videos' | 'articles' | 'dynamics' | 'collections'>('overview');
  const [videos, setVideos] = useState<Video[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [delTarget, setDelTarget] = useState<{ kind: 'video' | 'article' | 'post'; id: string; title: string } | null>(null);
  const [showNewArticle, setShowNewArticle] = useState(false);

  useEffect(() => {
    if (!user) nav('/login');
  }, [user, nav]);

  const loadTab = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (tab === 'videos') setVideos(asArray<Video>(await api.myVideos(50, 0)));
      if (tab === 'articles') setArticles(asArray<Article>(await api.myArticles(50, 0)));
      if (tab === 'dynamics') setPosts(asArray<Post>(await api.myDynamics(50, 0)));
      if (tab === 'collections') setCollections(asArray<Collection>(await api.myCollections()));
    } catch (e) {
      toast(errMsg(e), 'err');
    } finally { setLoading(false); }
  }, [tab, user]);

  useEffect(() => { void loadTab(); }, [loadTab]);

  if (!user) return null;

  const doDelete = async () => {
    if (!delTarget) return;
    try {
      if (delTarget.kind === 'video') await api.videoDelete(delTarget.id);
      if (delTarget.kind === 'article') await api.articleDelete(delTarget.id);
      if (delTarget.kind === 'post') await api.dynamicDelete(delTarget.id);
      toast('已删除');
      setDelTarget(null);
      void loadTab();
    } catch (e) { toast(errMsg(e), 'err'); }
  };

  return (
    <div className="page" style={{ maxWidth: 860, margin: '0 auto' }}>
      <div className="card" style={{ display: 'flex', gap: 16, padding: 20, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <Avatar name={user.username} size={64} email={user.email as string} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{user.username} <VerBadge badge={user.verification_badge} label={user.verification_label} /></div>
          <div className="muted" style={{ fontSize: 13 }}>ID {user.uid} · {user.bio || '这个人很懒，什么都没写'}</div>
          <div className="flex wrap" style={{ marginTop: 8, fontSize: 13 }}>
            <span><I name="video" size={14} /> {fmtCount(user.video_count as number ?? (videos.length || 0))} 视频</span>
            <span><I name="users" size={14} /> {fmtCount(user.follower_count as number ?? 0)} 粉丝</span>
            <Link to={`/user/${user.uid}`} className="tag">查看公开主页 <I name="arrowRight" size={12} /></Link>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="btn btn-sm" onClick={() => nav('/verification')}><I name="medal" size={14} /> 资质认证</button>
          <button className="btn btn-sm" onClick={() => nav('/membership')}><I name="flower" size={14} /> 会员中心</button>
        </div>
      </div>

      <div className="tabs">
        {([['overview', '总览'], ['videos', '我的视频'], ['articles', '我的专栏'], ['dynamics', '我的动态'], ['collections', '我的合集']] as const).map(([id, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab user={user} setUser={setUser} />}

      {tab === 'videos' && (
        loading ? <Loading /> : videos.length === 0 ? <Empty text="还没有投稿视频" icon="video" /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {videos.map((v) => (
              <div key={v.id} className="card" style={{ display: 'flex', gap: 12, padding: 10, alignItems: 'center' }}>
                <Link to={`/video/${v.id}`}><Cover src={v.cover_url || v.external_cover_url} alt="" className="thumb-48" style={{ width: 96, height: 54 }} /></Link>
                <div className="grow" style={{ minWidth: 0 }}>
                  <Link to={`/video/${v.id}`} className="title" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title}</Link>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {v.status === 'pending_review' ? <><I name="clock" size={12} /> 审核中</> : v.status === 'rejected' ? <><I name="x" size={12} /> 未通过</> : <><I name="check" size={12} /> 已发布</>} · <I name="play" size={12} filled />{fmtCount(v.views)} · <I name="heart" size={12} filled />{fmtCount(v.likes)} · {timeAgo(v.created_at as string)}
                  </div>
                </div>
                <button className="btn btn-sm" onClick={() => nav(`/video/${v.id}`)}>查看</button>
                <button className="btn btn-sm btn-danger" onClick={() => setDelTarget({ kind: 'video', id: v.id, title: v.title })}>删除</button>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'articles' && (
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-sm btn-primary" onClick={() => setShowNewArticle(true)}>＋ 发表专栏</button>
        </div>
      )}
      {tab === 'articles' && (
        loading ? <Loading /> : articles.length === 0 ? <Empty text="还没有发表专栏" icon="file" /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {articles.map((a) => (
              <div key={a.id} className="card" style={{ display: 'flex', gap: 12, padding: 12, alignItems: 'center' }}>
                <div className="grow" style={{ minWidth: 0 }}>
                  <Link to={`/article/${a.id}`} style={{ fontWeight: 700 }}>{a.title}</Link>
                  <div className="muted" style={{ fontSize: 12 }}><I name="play" size={12} filled />{fmtCount(a.views)} · {timeAgo(a.created_at as string)} {a.status === 'pending_review' && '· 审核中'}</div>
                </div>
                <button className="btn btn-sm" onClick={() => nav(`/article/${a.id}`)}>查看</button>
                <button className="btn btn-sm" onClick={() => nav(`/article/${a.id}?edit=1`)}>编辑</button>
                <button className="btn btn-sm btn-danger" onClick={() => setDelTarget({ kind: 'article', id: a.id, title: a.title })}>删除</button>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'dynamics' && !loading && <DynamicComposer onPosted={() => void loadTab()} />}
      {tab === 'dynamics' && (
        loading ? <Loading /> : posts.length === 0 ? <Empty text="还没有发布动态" icon="chat" /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {posts.map((p) => (
              <div key={p.id} className="card" style={{ padding: 14 }}>
                <div style={{ fontSize: 14 }}>{p.content}</div>
                {p.images && p.images.length > 0 && (
                  <div className="img-grid" style={{ marginTop: 8 }}>{p.images.map((img, i) => <img key={i} src={img} alt="" />)}</div>
                )}
                <div className="flex between" style={{ marginTop: 10 }}>
                  <button
                    className="btn btn-sm btn-ghost"
                    style={p.liked ? { color: 'var(--accent)' } : undefined}
                    onClick={async () => {
                      try {
                        const r = await api.dynamicLike(p.id);
                        setPosts((prev) => prev.map((x) => (x.id === p.id ? { ...x, liked: r.liked, like_count: r.like_count ?? x.like_count } : x)));
                      } catch (e) { toast(errMsg(e), 'err'); }
                    }}
                  ><I name="heart" size={13} filled={!!p.liked} /> {p.liked ? '已赞' : '点赞'} {fmtCount(p.like_count)}</button>
                  <div className="flex" style={{ gap: 6 }}>
                    <span className="muted" style={{ fontSize: 12 }}>{timeAgo(p.created_at as string)}</span>
                    <button className="btn btn-sm btn-danger" onClick={() => setDelTarget({ kind: 'post', id: p.id, title: '这条动态' })}>删除</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'collections' && (
        loading ? <Loading /> : collections.length === 0 ? <Empty text="还没有创建合集" icon="folder" /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {collections.map((c) => (
              <div key={c.id} className="card" style={{ display: 'flex', gap: 12, padding: 12, alignItems: 'center' }}>
                <div style={{ display: 'flex' }}><I name="folder" size={26} /></div>
                <div className="grow">
                  <div style={{ fontWeight: 700 }}>{c.title}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{c.video_count ?? c.items?.length ?? 0} 个视频</div>
                </div>
                <button className="btn btn-sm" onClick={() => nav(`/collection/${c.id}`)}>打开</button>
              </div>
            ))}
            <button className="btn btn-sm" onClick={() => nav('/collections?new=1')}>＋ 新建合集</button>
          </div>
        )
      )}

      {delTarget && (
        <Confirm title="确认删除" text={`确定删除「${delTarget.title}」吗？此操作不可恢复。`} danger okText="删除" onOk={doDelete} onClose={() => setDelTarget(null)} />
      )}
      {showNewArticle && <NewArticleModal onClose={() => setShowNewArticle(false)} onSaved={() => void loadTab()} />}
    </div>
  );
}

function DynamicComposer({ onPosted }: { onPosted: () => void }) {
  const [text, setText] = useState('');
  const [videoId, setVideoId] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);
  const post = async () => {
    if (!text.trim() && images.length === 0) { toast('写点什么或加张图片', 'err'); return; }
    setBusy(true);
    try {
      await api.postDynamic(text.trim(), videoId.trim() || undefined, images);
      toast('动态已发布');
      setText(''); setVideoId(''); setImages([]);
      onPosted();
    } catch (e) { toast(errMsg(e), 'err'); } finally { setBusy(false); }
  };
  return (
    <div className="card" style={{ padding: 14, marginBottom: 14 }}>
      <div className="flex" style={{ gap: 10 }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="分享你的想法…"
          maxLength={1000}
          style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 10, padding: '9px 12px', background: 'var(--bg)', color: 'var(--ink)', minHeight: 56, resize: 'vertical' }}
        />
      </div>
      <div className="flex wrap" style={{ marginTop: 10, gap: 8 }}>
        <input
          type="text" value={videoId} onChange={(e) => setVideoId(e.target.value)} placeholder="关联视频 ID（可选）"
          style={{ flex: 1, minWidth: 180, padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', color: 'var(--ink)' }}
        />
        <button className="btn btn-sm" onClick={() => imgRef.current?.click()}>＋ 图片</button>
        <input ref={imgRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => { setImages(Array.from(e.target.files || [])); e.target.value = ''; }} />
        {images.length > 0 && <span className="muted">{images.length} 张</span>}
        <div className="grow" />
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={post}>{busy ? '发布中…' : '发布动态'}</button>
      </div>
    </div>
  );
}

function OverviewTab({ user, setUser }: { user: User; setUser: (u: User | null) => void }) {
  const [username, setUsername] = useState(user.username || '');
  const [nameState, setNameState] = useState<string | null>(null);
  const [bio, setBio] = useState(user.bio || '');
  const [busyName, setBusyName] = useState(false);
  const [busyBio, setBusyBio] = useState(false);
  const [email, setEmail] = useState((user.email as string) || '');
  const [emailVerified, setEmailVerified] = useState(!!user.email_verified);
  const [code, setCode] = useState('');
  const [cap, setCap] = useState<CaptchaResult | null>(null);
  const [capKey, setCapKey] = useState(0);
  const [showExport, setShowExport] = useState(false);
  const nav = useNavigate();

  const saveUsername = async () => {
    const u = username.trim();
    if (u === user.username) return;
    setBusyName(true);
    try {
      const chk = await api.usernameAvailable(u, user.id);
      if (!chk.available) { setNameState(chk.reason || '不可用'); return; }
      const r = await api.changeUsername(u);
      setUser({ ...user, username: r.username });
      setNameState(null);
      toast('用户名已更新');
    } catch (e) { toast(errMsg(e), 'err'); } finally { setBusyName(false); }
  };

  const saveBio = async () => {
    setBusyBio(true);
    try {
      const r = await api.changeBio(bio.trim());
      setUser({ ...user, bio: r.bio });
      toast('简介已更新');
    } catch (e) { toast(errMsg(e), 'err'); } finally { setBusyBio(false); }
  };

  const verifyEmail = async () => {
    try {
      await api.verifyEmail(user.username || user.uid, email.trim(), code.trim());
      setEmailVerified(true);
      setUser({ ...user, email_verified: true, email: email.trim() });
      toast('邮箱验证成功');
    } catch (e) { toast(errMsg(e), 'err'); setCap(null); setCapKey((k) => k + 1); }
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="card" style={{ padding: 18 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}><I name="pen" size={15} /> 资料编辑</div>
        <div className="field">
          <label>用户名</label>
          <div className="flex">
            <input type="text" value={username} onChange={(e) => { setUsername(e.target.value); setNameState(null); }} style={{ flex: 1, padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg)', color: 'var(--ink)', minWidth: 0 }} />
            <button className="btn btn-sm" disabled={busyName || username === user.username} onClick={saveUsername}>{busyName ? '…' : '保存'}</button>
          </div>
          {nameState && <div className="hint">{nameState}</div>}
        </div>
        <div className="field">
          <label>个性签名</label>
          <div className="flex">
            <input type="text" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={120} style={{ flex: 1, padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg)', color: 'var(--ink)', minWidth: 0 }} />
            <button className="btn btn-sm" disabled={busyBio} onClick={saveBio}>{busyBio ? '…' : '保存'}</button>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}><I name="mail" size={15} /> 邮箱{emailVerified && <span className="tag" style={{ color: 'var(--ok)' }}>已验证</span>}</div>
        {emailVerified ? (
          <div className="muted">当前邮箱：{email}</div>
        ) : (
          <div>
            <div className="flex">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="输入邮箱以完成验证" style={{ flex: 1, padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg)', color: 'var(--ink)', minWidth: 0 }} />
              <button className="btn btn-sm" disabled={!cap || !email.trim() || !code.trim()} onClick={() => verifyEmail()}>验证</button>
            </div>
            <div className="field" style={{ marginTop: 10 }}>
              <label>邮箱验证码</label>
              <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="6 位验证码" style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg)', color: 'var(--ink)' }} />
            </div>
            <CaptchaBox key={capKey} onVerified={(r) => setCap(r)} />
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 18 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}><I name="shield" size={15} /> 数据与账号</div>
        <div className="flex wrap" style={{ gap: 10 }}>
          <button className="btn btn-sm" onClick={() => setShowExport(true)}><I name="download" size={14} /> 导出数据（GDPR）</button>
          <button className="btn btn-sm" onClick={() => nav('/history')}><I name="clock" size={14} /> 历史记录管理</button>
          <button className="btn btn-sm" onClick={() => nav('/coins')}><I name="coin" size={14} /> 积分与签到</button>
          <button className="btn btn-sm" onClick={() => nav('/following-list?type=following')}><I name="users" size={14} /> 我的关注</button>
          <button className="btn btn-sm" onClick={() => nav('/following-list?type=followers')}><I name="heart" size={14} /> 我的粉丝</button>
          <button className="btn btn-sm btn-danger" onClick={() => nav('/deactivate')}><I name="ban" size={14} /> 注销账号</button>
        </div>
      </div>

      <BlocklistCard />

      {showExport && (
        <Modal title="导出个人数据" onClose={() => setShowExport(false)} foot={
          <>
            <button className="btn" onClick={() => setShowExport(false)}>取消</button>
            <button className="btn btn-primary" disabled={busyBio} onClick={async () => {
              setBusyBio(true);
              try {
                const data = await api.exportData();
                downloadJSON(data, `zawazawa-data-${user.uid}.json`);
                toast('数据已导出');
                setShowExport(false);
              } catch (e) { toast(errMsg(e), 'err'); } finally { setBusyBio(false); }
            }}>开始导出</button>
          </>
        }>
          <div style={{ fontSize: 14 }}>将导出你在 ZawaZawa 的全部个人数据（JSON 格式），包括账号信息、视频、评论、收藏、历史记录等。该请求可能需要一些时间。</div>
        </Modal>
      )}
    </div>
  );
}

function BlocklistCard() {
  const [list, setList] = useState<User[] | null>(null);
  useEffect(() => {
    api.blocklist(50, 0).then((d) => setList(asArray<User>(d))).catch(() => setList([]));
  }, []);
  if (!list) return null;
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontWeight: 700, marginBottom: 12 }}><I name="ban" size={15} /> 拉黑列表（{list.length}）</div>
      {list.length === 0 ? (
        <div className="muted">没有拉黑任何用户</div>
      ) : (
        <div>
          {list.map((u) => (
            <div key={u.id} className="row-item" style={{ padding: '8px 0' }}>
              <Avatar name={u.username} size={34} url={u.gravatar_url} />
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{u.username}</div>
                <div className="muted" style={{ fontSize: 12 }}>ID {u.uid}</div>
              </div>
              <button
                className="btn btn-sm"
                onClick={async () => {
                  try { await api.unblock(u.uid); toast('已取消拉黑'); setList((p) => (p || []).filter((x) => x.id !== u.id)); } catch (e) { toast(errMsg(e), 'err'); }
                }}
              >取消拉黑</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
