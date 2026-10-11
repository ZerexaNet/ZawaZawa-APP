import { useCallback, useEffect, useRef, useState } from 'react';
import { I } from '../icons';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api';
import { asArray, type Danmaku, type Subtitle, type User, type Video } from '../types';
import { Avatar, CommentSection, Cover, Empty, Loading, Modal, Confirm, VerBadge } from '../components';
import { Player } from '../Player';
import type { DanmakuItem } from '../lib/danmaku';
import { fetchSubtitles, type Cue } from '../lib/subtitles';
import { CATEGORIES, downloadBlob, fmtCount, posterUrl, timeAgo } from '../lib/utils';
import { errMsg, toast, useAuth } from '../store';

export function VideoPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [video, setVideo] = useState<Video | null>(null);
  const [author, setAuthor] = useState<User | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [geoBlocked, setGeoBlocked] = useState(false);
  const [danmakuList, setDanmakuList] = useState<DanmakuItem[]>([]);
  const [subs, setSubs] = useState<{ label: string; cues: Cue[] }[]>([]);
  const [subMeta, setSubMeta] = useState<Subtitle[]>([]);
  const [related, setRelated] = useState<Video[]>([]);
  const [liked, setLiked] = useState(false);
  const [fav, setFav] = useState(false);
  const [confused, setConfused] = useState(false);
  const [following, setFollowing] = useState(false);
  const [aiJob, setAiJob] = useState<{ status?: string } | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showSubs, setShowSubs] = useState(false);
  const [showDel, setShowDel] = useState(false);
  const [showDmTools, setShowDmTools] = useState(false);
  const [startAt, setStartAt] = useState(0);
  const reportedWatch = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadVideo = useCallback(async () => {
    try {
      const v = await api.video(id);
      setVideo(v);
      if (v.author_uid) api.userPublic(v.author_uid).then((r) => setAuthor(r.user || null)).catch(() => {});
    } catch (e) {
      // 与官网一致：451（Unavailable For Legal Reasons）= 地区屏蔽（geo_block:CN）
      if (e instanceof ApiError && e.status === 451) setGeoBlocked(true);
      else if (e instanceof ApiError && [404, 403, 410].includes(e.status)) setNotFound(true);
      else toast(errMsg(e), 'err');
    }
  }, [id]);

  useEffect(() => {
    setVideo(null); setNotFound(false); setGeoBlocked(false); setDanmakuList([]); setSubs([]); reportedWatch.current = false;
    void loadVideo();
  }, [loadVideo]);

  // 弹幕
  useEffect(() => {
    if (!video?.status || video.status !== 'approved') return;
    api.danmaku(id, 500).then((d) => {
      const arr = asArray<Danmaku>(d);
      setDanmakuList(arr.map((x, i) => ({
        id: x.id || String(i),
        text: x.content,
        timeSec: Number(x.time_sec ?? x.time ?? 0),
        color: x.color,
        mode: x.mode,
        fontsize: x.fontsize,
      })));
    }).catch(() => {});
    api.videoConfused(id).then((r) => setConfused(!!r.confused)).catch(() => {});
    api.videoUnliked(id).then((r) => setLiked(!!r.liked)).catch(() => {});
    api.videoFavCheck(id).then((r) => setFav(!!r.favorited)).catch(() => {});
    api.recommend(id, 10).then((d) => setRelated(asArray<Video>(d))).catch(() => {});
    if (video?.author_uid && video.author_uid !== user?.uid) {
      api.followStatus(video.author_uid).then((r) => setFollowing(!!r.following)).catch(() => {});
    }
  }, [id, video?.status, user?.uid]);

  // 字幕
  useEffect(() => {
    if (!video?.id) return;
    api.subtitles(id).then(async (list) => {
      const arr = asArray<Subtitle>(list);
      setSubMeta(arr);
      const loaded: { label: string; cues: Cue[] }[] = [];
      for (const s of arr.slice(0, 3)) {
        try {
          const cues = await fetchSubtitles(s.url!);
          loaded.push({ label: s.label || s.language || '字幕', cues });
        } catch { /* skip */ }
      }
      setSubs(loaded);
    }).catch(() => {});
    if (video?.status === 'approved') {
      api.aiSubtitleStatus(id).then((r) => { if (r?.job?.status) setAiJob(r.job as { status?: string }); }).catch(() => {});
    }
  }, [id, video?.id]);

  const onReport = useCallback((watchSec: number, totalSec: number) => {
    if (reportedWatch.current) return;
    reportedWatch.current = true;
    api.watchReport(id, Math.floor(watchSec), Math.floor(totalSec)).catch(() => {});
  }, [id]);

  const sendDanmaku = useCallback(async (item: DanmakuItem) => {
    try {
      await api.danmakuSend(id, { content: item.text, time_sec: item.timeSec, color: item.color, mode: item.mode, fontsize: 25 });
    } catch (e) {
      toast(errMsg(e), 'err');
    }
  }, [id]);

  if (geoBlocked) return <div className="page"><Empty text="抱歉，此视频不支持中国大陆用户观看" desc="该视频已开启地区限制，当前网络环境无法播放。" icon="globe" /></div>;
  if (notFound) return <div className="page"><Empty text="视频不存在或已被删除" icon="ban" /></div>;
  if (!video) return <div className="page"><Loading /></div>;

  const isOwner = user && (String(user.id) === String(video.author_id) || String(user.uid) === String(video.author_uid));
  const isAdmin = user && ['admin', 'video_moderation', 'content_review'].includes(String(user.role || ''));

  const doLike = async () => {
    if (!user) return nav('/login');
    const r = await api.videoLike(id).catch((e) => { toast(errMsg(e), 'err'); return null; });
    if (r) { setLiked(r.liked); setVideo({ ...video, likes: (video.likes || 0) + (r.liked ? 1 : -1) }); }
  };
  const doFav = async () => {
    if (!user) return nav('/login');
    const r = fav ? await api.videoUnfav(id).catch((e) => { toast(errMsg(e), 'err'); return null; }) : await api.videoFav(id).catch((e) => { toast(errMsg(e), 'err'); return null; });
    if (r) setFav(r.favorited);
  };
  const doCoin = async () => {
    if (!user) return nav('/login');
    try { await api.coin(id); toast('投币成功'); setVideo({ ...video, coin_count: (video.coin_count || 0) + 1 }); } catch (e) { toast(errMsg(e), 'err'); }
  };
  const doConfuse = async () => {
    if (!user) return nav('/login');
    const r = await api.videoConfuse(id).catch((e) => { toast(errMsg(e), 'err'); return null; });
    if (r) { setConfused(r.confused); setVideo({ ...video, confusion_count: (video.confusion_count || 0) + (r.confused ? 1 : -1) }); }
  };
  const doFollow = async () => {
    if (!user) return nav('/login');
    const r = following ? await api.unfollow(video.author_uid!).catch((e) => { toast(errMsg(e), 'err'); return null; }) : await api.follow(video.author_uid!).catch((e) => { toast(errMsg(e), 'err'); return null; });
    if (r) setFollowing(r.following);
  };

  const share = async () => {
    try {
      const full = `${location.origin}/video/${id}`;
      const r = await api.shorten(full, 'video', id);
      const url = r.short_url || full;
      await navigator.clipboard.writeText(url);
      await api.shareTrack('video', id, 'copy').catch(() => {});
      toast('链接已复制');
    } catch {
      await navigator.clipboard.writeText(`${location.origin}/video/${id}`).catch(() => {});
      toast('链接已复制');
    }
  };

  const importDanmakuXml = async (file: File) => {
    const text = await file.text();
    try {
      const r = await api.danmakuImport(id, text);
      toast(`导入 ${r.imported} 条弹幕`);
      void loadVideo();
    } catch (e) { toast(errMsg(e), 'err'); }
  };
  const exportDanmaku = async () => {
    try {
      const xml = await api.danmakuXml(id);
      downloadBlob(new Blob([xml], { type: 'application/xml' }), `${video.title}.xml`);
    } catch (e) { toast(errMsg(e), 'err'); }
  };
  const uploadSubFile = async (file: File) => {
    const name = file.name.toLowerCase();
    if (!/\.(vtt|srt|ass)$/.test(name)) { toast('支持 vtt/srt/ass 格式'); return; }
    const lang = name.includes('en') ? 'en' : 'zh';
    const label = file.name.replace(/\.(vtt|srt|ass)$/i, '');
    try {
      await api.subtitleUpload(id, file, lang, label);
      toast('字幕已上传');
      setShowSubs(false);
    } catch (e) { toast(errMsg(e), 'err'); }
  };
  const genAiSub = async () => {
    try {
      setAiJob({ status: 'processing' });
      const r = await api.aiSubtitle(id);
      if (r.subtitle) { toast('AI 字幕已生成'); setAiJob(null); }
      else if (r.job) setAiJob(r.job as { status?: string });
    } catch (e) { toast(errMsg(e), 'err'); setAiJob(null); }
  };
  // AI 字幕轮询
  useEffect(() => {
    if (!aiJob || !['pending', 'processing', 'queued', 'running'].includes(aiJob.status || '')) return;
    const t = setInterval(async () => {
      try {
        const r = await api.aiSubtitleStatus(id);
        if (r.subtitle || (r.job && ['done', 'completed', 'failed', 'error'].includes(r.job.status || ''))) {
          clearInterval(t);
          setAiJob(null);
          if (r.subtitle) { toast('AI 字幕生成完成'); void loadVideo(); }
        }
      } catch { clearInterval(t); }
    }, 4000);
    return () => clearInterval(t);
  }, [aiJob, id, loadVideo]);

  return (
    <div className="page" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div className="player-wrap" style={{ marginBottom: 14 }}>
        <Player
          src={video.stream_url}
          cover={posterUrl(video.cover_url || video.external_cover_url)}
          danmaku={danmakuList}
          subtitles={subs}
          startAt={startAt}
          onSendDanmaku={user ? sendDanmaku : undefined}
          onTimeReport={onReport}
          onEnded={() => { setStartAt(0); }}
        />
      </div>

      <h1 style={{ fontSize: 19, margin: '0 0 8px', lineHeight: 1.4 }}>{video.title}</h1>
      <div className="flex wrap" style={{ color: 'var(--ink-3)', fontSize: 13, marginBottom: 14 }}>
        <span><I name="play" size={13} filled /> {fmtCount(video.views)} 次观看</span>
        <span>{video.created_at && timeAgo(video.created_at)}</span>
        {video.ip_location && <span>· {video.ip_location}</span>}
        {video.category && <span className="tag" style={{ marginLeft: 4 }}>{video.category}</span>}
        {video.status === 'pending_review' && <span className="tag" style={{ color: 'var(--warn)' }}>审核中</span>}
      </div>

      {/* 作者栏 */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', marginBottom: 14 }}>
        <Avatar name={video.author_username || '匿名'} size={44} url={video.author_gravatar_url} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700 }}>{video.author_username} <VerBadge badge={video.author_verification_badge} label={video.author_verification_label} /></div>
          <div className="muted" style={{ fontSize: 12 }}>{author?.bio || ''}</div>
        </div>
        {isOwner || isAdmin ? (
          <button className="btn btn-sm" onClick={() => nav(`/user/${video.author_uid}`)}>查看主页</button>
        ) : video.author_uid ? (
          <button className={'btn btn-sm ' + (following ? '' : 'btn-primary')} onClick={doFollow}>
            {following ? <><I name="check" size={14} /> 已关注</> : <><I name="plus" size={14} /> 关注</>}
          </button>
        ) : null}
      </div>

      {/* 操作栏 */}
      <div className="flex wrap" style={{ marginBottom: 18 }}>
        <button className={'btn ' + (liked ? 'btn-primary' : '')} onClick={doLike}>{liked ? <><I name="heart" size={14} filled /> 已赞</> : <><I name="heart" size={14} /> 点赞</>}</button>
        <button className={'btn ' + (fav ? 'btn-blue' : '')} onClick={doFav}>{fav ? <><I name="star" size={14} filled /> 已收藏</> : <><I name="star" size={14} /> 收藏</>}</button>
        <button className="btn" onClick={doCoin}><I name="coin" size={14} /> 投币 {video.coin_count ? `(${video.coin_count})` : ''}</button>
        <button className={'btn ' + (confused ? 'btn-primary' : '')} onClick={doConfuse} title="这视频有点怪"><I name="help" size={14} /> 困惑 {video.confusion_count ? `(${video.confusion_count})` : ''}</button>
        <button className="btn" onClick={share}><I name="share" size={14} /> 分享</button>
        {user && <button className="btn btn-ghost" onClick={() => setShowDmTools(true)}><I name="upload" size={14} /> 弹幕工具</button>}
        {user && <button className="btn btn-ghost" onClick={() => setShowSubs(true)}><I name="cc" size={14} /> 字幕管理</button>}
        {(isOwner || isAdmin) && (
          <>
            <button className="btn btn-ghost" onClick={() => setShowEdit(true)}><I name="pen" size={14} /> 编辑</button>
            <button className="btn btn-danger" onClick={() => setShowDel(true)}><I name="trash" size={14} /> 删除</button>
          </>
        )}
        <div className="grow" />
        <button className="btn btn-ghost" onClick={() => setShowReport(true)}><I name="flag" size={14} /> 举报</button>
      </div>

      {/* 简介 */}
      {video.description && (
        <div className="card" style={{ padding: 16, marginBottom: 18 }}>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{video.description}</div>
          {video.source_url && (
            <div style={{ marginTop: 10 }}>
              <a href={video.source_url} target="_blank" rel="noreferrer" className="tag"><I name="external" size={12} /> 原始来源</a>
            </div>
          )}
        </div>
      )}

      <CommentSection targetType="video" targetId={id} />

      {/* 相关推荐 */}
      {related.length > 0 && (
        <>
          <div className="section-title">为你推荐</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12 }}>
            {related.map((r) => (
              <RelCard key={r.id} v={r} onNotInterested={async (vid) => {
                try { await api.recommendNotInterested(vid); setRelated((p) => p.filter((x) => x.id !== vid)); } catch { /* ignore */ }
              }} />
            ))}
          </div>
        </>
      )}

      {showEdit && video && (
        <EditModal
          video={video}
          onClose={() => setShowEdit(false)}
          onSaved={(msg) => { setShowEdit(false); toast(msg); void loadVideo(); }}
        />
      )}
      {showReport && (
        <ReportModal videoId={id} onClose={() => setShowReport(false)} />
      )}
      {showDel && (
        <Confirm
          title="删除视频"
          text="确定删除这个视频吗？删除后不可恢复。"
          danger okText="删除"
          onOk={async () => {
            try { await api.videoDelete(id); toast('已删除'); nav('/profile'); } catch (e) { toast(errMsg(e), 'err'); }
          }}
          onClose={() => setShowDel(false)}
        />
      )}
      {showDmTools && (
        <Modal title="弹幕工具" onClose={() => setShowDmTools(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button className="btn btn-block" onClick={() => fileInput.current?.click()}><I name="download" size={14} /> 导入弹幕（XML）</button>
            <input ref={fileInput} type="file" accept=".xml,.xml" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void importDanmakuXml(f); e.target.value = ''; }} />
            <button className="btn btn-block" onClick={exportDanmaku}><I name="upload" size={14} /> 导出弹幕（XML）</button>
          </div>
        </Modal>
      )}
      {showSubs && (
        <Modal title="字幕管理" onClose={() => setShowSubs(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {subMeta.length === 0 && <div className="muted">暂无字幕</div>}
            {subMeta.map((s) => (
              <div key={s.id} className="row-item" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <div className="grow">
                  <div style={{ fontWeight: 600 }}>{s.label || s.language}</div>
                  <div className="muted">{s.source === 'ai' ? 'AI 生成' : '手动上传'} · {s.created_at}</div>
                </div>
                {isOwner && (
                  <button className="btn btn-sm btn-danger" onClick={async () => {
                    try { await api.subtitleDelete(id, s.id); toast('已删除'); const list = asArray<Subtitle>(await api.subtitles(id)); setSubMeta(list); } catch (e) { toast(errMsg(e), 'err'); }
                  }}>删除</button>
                )}
              </div>
            ))}
            <div className="divider" />
            <button className="btn btn-block" onClick={() => fileInput.current?.click()}><I name="upload" size={14} /> 上传字幕（vtt/srt/ass）</button>
            <input ref={fileInput} type="file" accept=".vtt,.srt,.ass" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadSubFile(f); e.target.value = ''; }} />
            <button className="btn btn-block btn-blue" disabled={aiJob?.status === 'processing' || aiJob?.status === 'pending'} onClick={genAiSub}>
              {aiJob?.status === 'processing' || aiJob?.status === 'pending' ? <><I name="clock" size={14} /> AI 字幕生成中…</> : <><I name="bot" size={14} /> AI 生成字幕</>}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function RelCard({ v, onNotInterested }: { v: Video; onNotInterested: (id: string) => void }) {
  return (
    <div style={{ position: 'relative' }}>
      <Link to={`/video/${v.id}`} className="vcard">
        <div className="cover">
          {(v.cover_url || v.external_cover_url) && <Cover src={v.cover_url || v.external_cover_url} alt={v.title} />}
        </div>
        <div className="meta">
          <div className="title" style={{ minHeight: 0 }}>{v.title}</div>
          <div className="sub"><span><I name="play" size={12} filled /> {fmtCount(v.views)} · {v.author_username}</span></div>
        </div>
      </Link>
      <button
        className="btn btn-sm btn-ghost"
        style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,.55)', color: '#fff', border: 'none' }}
        title="不感兴趣"
        onClick={() => onNotInterested(v.id)}
      ><I name="x" size={14} /></button>
    </div>
  );
}

function EditModal({ video, onClose, onSaved }: { video: Video; onClose: () => void; onSaved: (msg: string) => void }) {
  const [title, setTitle] = useState(video.title || '');
  const [desc, setDesc] = useState(video.description || '');
  const [catMain, setCatMain] = useState(video.category?.split(' / ')[0] || '综合');
  const [catSub, setCatSub] = useState(video.category?.split(' / ')[1] || '其他');
  const [sourceUrl, setSourceUrl] = useState(video.source_url || '');
  const [busy, setBusy] = useState(false);
  const coverInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [srcFile, setSrcFile] = useState<File | null>(null);
  const [coverUrl, setCoverUrl] = useState(video.cover_url || video.external_cover_url || '');
  const [uploading, setUploading] = useState(false);

  const subs = CATEGORIES[catMain] || ['其他'];

  const save = async () => {
    setBusy(true);
    try {
      const category = `${catMain} / ${catSub}`;
      let msg = '已保存';
      if (coverFile) {
        setUploading(true);
        await api.coverUpdate(video.id, coverFile, coverFile.type || 'image/jpeg');
        msg = '已保存（封面更新中）';
      }
      if (srcFile) {
        setUploading(true);
        await api.reupload(video.id, srcFile, srcFile.type || 'video/mp4');
        msg = '已保存（源文件替换中）';
      }
      await api.videoUpdate(video.id, { title, description: desc, category, source_url: sourceUrl || undefined });
      if (coverFile) setCoverUrl(URL.createObjectURL(coverFile));
      onSaved(msg);
    } catch (e) {
      toast(errMsg(e), 'err');
    } finally {
      setBusy(false);
      setUploading(false);
    }
  };

  return (
    <Modal title="编辑视频" onClose={onClose} wide foot={
      <>
        <button className="btn" onClick={onClose}>取消</button>
        <button className="btn btn-primary" disabled={busy || uploading} onClick={save}>{uploading ? '上传中…' : '保存'}</button>
      </>
    }>
      <div className="field"><label>标题</label><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></div>
      <div className="field"><label>简介</label><textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={2000} /></div>
      <div className="field"><label>分类</label>
        <div className="flex">
          <select value={catMain} onChange={(e) => { setCatMain(e.target.value); const sub = (CATEGORIES[e.target.value] || ['其他'])[0]; setCatSub(sub); }} style={{ flex: 1, padding: '9px 10px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)' }}>
            {Object.keys(CATEGORIES).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={catSub} onChange={(e) => setCatSub(e.target.value)} style={{ flex: 1, padding: '9px 10px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)' }}>
            {subs.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="field"><label>原始来源链接（可选）</label><input type="text" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://…" /></div>
      <div className="field"><label>封面</label>
        <div className="flex wrap">
          {coverUrl && <img src={coverUrl} alt="" style={{ width: 160, borderRadius: 10 }} referrerPolicy="no-referrer" />}
          <button className="btn btn-sm" onClick={() => coverInput.current?.click()}>更换封面</button>
          <input ref={coverInput} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) { setCoverFile(f); setCoverUrl(URL.createObjectURL(f)); } }} />
        </div>
      </div>
      <div className="field"><label>替换源文件（可选）</label>
        <div className="flex wrap">
          <span className="muted">{srcFile ? srcFile.name : '选择新的视频文件替换当前视频'}</span>
          <button className="btn btn-sm" onClick={() => fileInput.current?.click()}>选择文件</button>
          <input ref={fileInput} type="file" accept="video/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) setSrcFile(f); }} />
        </div>
      </div>
    </Modal>
  );
}

function ReportModal({ videoId, onClose }: { videoId: string; onClose: () => void }) {
  const [reason, setReason] = useState('spam');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const REASONS = [
    { id: 'spam', label: '垃圾广告' },
    { id: 'inappropriate', label: '违规内容' },
    { id: 'copyright', label: '侵权' },
    { id: 'misleading', label: '虚假/误导' },
    { id: 'other', label: '其他' },
  ];
  return (
    <Modal title="举报视频" onClose={onClose} foot={
      <>
        <button className="btn" onClick={onClose}>取消</button>
        <button className="btn btn-danger" disabled={busy} onClick={async () => {
          setBusy(true);
          try { await api.videoReport(videoId, reason, details || undefined); toast('举报已提交，感谢反馈'); onClose(); } catch (e) { toast(errMsg(e), 'err'); } finally { setBusy(false); }
        }}>提交举报</button>
      </>
    }>
      <div className="field"><label>举报原因</label>
        <select value={reason} onChange={(e) => setReason(e.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)' }}>
          {REASONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
      </div>
      <div className="field"><label>补充说明（可选）</label><textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="详细描述问题…" maxLength={500} /></div>
    </Modal>
  );
}
