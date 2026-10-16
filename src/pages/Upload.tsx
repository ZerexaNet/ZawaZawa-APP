import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { upload, videos, collections, articles } from '../lib/api';
import type { Video } from '../lib/types';
import { Btn, Field, Progress, Spinner, Switch } from '../components/ui';
import { I } from '../components/icons';
import { useAuth } from '../store/auth';
import { useToast, errMsg } from '../store/toast';
import { CATEGORIES, CATEGORY_NAMES, catLabel } from '../lib/categories';
import { fmtBytes, sha256Hex } from '../lib/util';

const PART_SIZE = 10 * 1024 * 1024;
const CONCURRENCY = 4;
const MAX_SIZE = 15 * 1024 * 1024 * 1024; // 15GB

type Phase = 'pick' | 'meta' | 'hashing' | 'uploading' | 'complete' | 'done' | 'error' | 'article';

export default function Upload() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const editId = params.get('edit');
  const articleId = params.get('article');
  const user = useAuth(s => s.user);
  const toast = useToast(s => s.push);

  const [phase, setPhase] = useState<Phase>('pick');
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState('');

  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [catMain, setCatMain] = useState('General');
  const [catSub, setCatSub] = useState(CATEGORIES['General'][0]);
  const [sourceUrl, setSourceUrl] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [autoCover, setAutoCover] = useState(true);
  const [coverPreview, setCoverPreview] = useState('');

  const [initInfo, setInitInfo] = useState<any>(null);
  const [progress, setProgress] = useState(0);
  const [doneVideo, setDoneVideo] = useState<Video | null>(null);
  const [myCols, setMyCols] = useState<any[]>([]);
  const [aborting, setAborting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // 快速导入
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);

  // 专栏
  const [artTitle, setArtTitle] = useState('');
  const [artContent, setArtContent] = useState('');
  const [artCover, setArtCover] = useState<File | null>(null);
  const [artImages, setArtImages] = useState<File[]>([]);
  const [artBusy, setArtBusy] = useState(false);

  useEffect(() => {
    if (!user) { nav('/login?next=' + encodeURIComponent(location.pathname)); return; }
  }, [user, nav]);

  // 编辑模式：加载视频信息
  useEffect(() => {
    if (!editId) return;
    videos.detail(editId).then((d: any) => {
      const v = d?.video ?? d;
      setTitle(v.title || '');
      setDesc(v.description || '');
      const c = (v.category || '').split(' / ');
      setCatMain(c[0] || 'General');
      setCatSub(c[1] || '其他');
      setSourceUrl(v.source_url || '');
      setPhase('meta');
    }).catch(e => { setErr(errMsg(e)); setPhase('error'); });
  }, [editId]);

  // 专栏编辑模式
  useEffect(() => {
    if (!articleId) return;
    articles.detail(articleId).then((d: any) => {
      const a = d?.article ?? d;
      setArtTitle(a.title || '');
      setArtContent(a.content || '');
      setPhase('article');
    }).catch(e => { setErr(errMsg(e)); setPhase('error'); });
  }, [articleId]);

  useEffect(() => {
    if (!user) return;
    import('../lib/api').then(({ users }) => users.meCollections().then((d: any) => {
      setMyCols(Array.isArray(d) ? d : d?.items || []);
    }).catch(() => { }));
  }, [user]);

  const pickFile = (f: File | null) => {
    if (!f) return;
    if (f.size > MAX_SIZE) { setErr('文件超过 15GB 上限'); return; }
    setFile(f);
    setCoverPreview('');
    setPhase('meta');
    // 预取封面（video 文件）
    if (f.type.startsWith('video/') && autoCover) {
      captureCover(f);
    }
  };

  const captureCover = (f: File) => {
    const url = URL.createObjectURL(f);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.src = url;
    v.muted = true;
    v.onloadeddata = () => {
      const d = v.duration || 100;
      v.currentTime = Math.min(d * 0.2, 30);
    };
    v.onseeked = () => {
      try {
        const cv = document.createElement('canvas');
        cv.width = v.videoWidth || 640;
        cv.height = v.videoHeight || 360;
        const ctx = cv.getContext('2d')!;
        ctx.drawImage(v, 0, 0, cv.width, cv.height);
        setCoverPreview(cv.toDataURL('image/jpeg', 0.85));
      } catch { /* ignore */ }
      v.src = '';
      URL.revokeObjectURL(url);
    };
    v.onerror = () => { URL.revokeObjectURL(url); };
  };

  /* ---------- 发布 ---------- */
  const publish = async () => {
    if (!file) return;
    if (!title.trim()) { setErr('请输入标题'); return; }
    setErr('');
    setPhase('hashing');
    try {
      const buf = await file.arrayBuffer();
      const h = await sha256Hex(buf);
      // 秒传检查
      try {
        const ck: any = await upload.checkHash(h);
        if (ck?.exists) {
          toast('秒传成功！检测到相同文件', 'success');
          setDoneVideo({ id: ck.existingVideoId, title: title.trim() } as Video);
          setPhase('done');
          return;
        }
      } catch { /* 忽略秒传检查失败 */ }

      setPhase('uploading');
      const ac = new AbortController();
      abortRef.current = ac;

      const init: any = await upload.init({ filename: file.name, contentType: file.type || 'video/mp4' });
      setInitInfo(init);
      const { uploadId, key, videoId, directUpload, putUrl } = init;
      let parts: { PartNumber: number; ETag: string }[] = [];

      const meta = {
        title: title.trim(),
        description: desc.trim(),
        category: catLabel(catMain, catSub),
        source_url: sourceUrl.trim() || undefined,
        file_hash: h,
      };

      if (directUpload && putUrl) {
        // 直传模式
        try {
          await upload.putToPresigned(putUrl, file, ac.signal);
          parts = [];
        } catch (e: any) {
          if (e?.name === 'AbortError') throw e;
          // 回退代理
          await upload.proxyPut(key, file, file.type || 'application/octet-stream');
        }
      } else {
        // 分片上传
        const totalParts = Math.ceil(file.size / PART_SIZE);
        setProgress(0);
        let doneParts = 0;
        const etags: (string | undefined)[] = new Array(totalParts);
        let cursor = 0;

        const uploadOne = async (partNumber: number) => {
          const start = (partNumber - 1) * PART_SIZE;
          const end = Math.min(file.size, start + PART_SIZE);
          const chunk = file.slice(start, end);
          let lastErr: any;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const presigned: any = await upload.presignPart(key, uploadId, partNumber);
              const url = presigned?.url || presigned?.putUrl;
              const etag = await upload.putToPresigned(url, chunk, ac.signal);
              etags[partNumber - 1] = etag;
              doneParts++;
              setProgress(doneParts / totalParts);
              return;
            } catch (e: any) {
              lastErr = e;
              if (e?.name === 'AbortError') throw e;
              await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
            }
          }
          throw lastErr;
        };

        const worker = async () => {
          while (true) {
            const n = cursor++;
            if (n >= totalParts) return;
            await uploadOne(n + 1);
          }
        };
        const workers: Promise<void>[] = [];
        for (let i = 0; i < Math.min(CONCURRENCY, totalParts); i++) workers.push(worker());
        await Promise.all(workers);

        if (etags.some(e => !e)) {
          // 某些分片没拿到 ETag（CORS 头未暴露），尝试代理整文件兜底
          try {
            await upload.proxyPut(key, file, file.type || 'application/octet-stream');
            parts = [];
          } catch {
            parts = etags.map((e2, i2) => ({ PartNumber: i2 + 1, ETag: e2 || `part-${i2 + 1}` }));
          }
        } else {
          parts = etags.map((e2, i2) => ({ PartNumber: i2 + 1, ETag: e2! }));
        }
      }

      const done: any = await upload.complete({ uploadId, key, videoId, parts, ...meta });
      setProgress(1);
      const vid = done?.video ?? done;
      setDoneVideo(vid || { id: videoId, title: meta.title } as Video);
      setPhase('done');
      toast('上传完成，视频进入审核', 'success');
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        setErr('已取消上传');
      } else {
        setErr(errMsg(e, '上传失败'));
      }
      setPhase('error');
    } finally {
    }
  };

  const cancelUpload = async () => {
    setAborting(true);
    abortRef.current?.abort();
    try {
      if (initInfo?.uploadId) await upload.cancel(initInfo.uploadId);
    } catch { /* ignore */ }
    setAborting(false);
  };

  /* ---------- 封面上传（完成后） ---------- */
  const uploadCover = async (v: Video) => {
    if (!v.id) return;
    try {
      let coverKey: string;
      let coverUrl: string;
      if (coverFile) {
        coverKey = `covers/${v.id}/${Date.now()}_${coverFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        await upload.proxyPut(coverKey, coverFile, coverFile.type || 'image/jpeg');
        coverUrl = `/api/videos/upload/proxy-put?key=`;
        const r: any = await videos.coverUpdateKey(v.id, coverKey);
        coverUrl = r?.cover_url || '';
      } else if (coverPreview) {
        // 自动截取的封面
        const blob = await (await fetch(coverPreview)).blob();
        const f2 = new File([blob], `cover_${v.id}.jpg`, { type: 'image/jpeg' });
        coverKey = `covers/${v.id}/${Date.now()}_auto.jpg`;
        await upload.proxyPut(coverKey, f2, 'image/jpeg');
        const r: any = await videos.coverUpdateKey(v.id, coverKey);
        coverUrl = r?.cover_url || '';
      } else return;
      setDoneVideo(x => x && { ...x, cover_url: coverUrl || x.cover_url });
      toast('封面已更新', 'success');
    } catch (e: any) {
      toast(errMsg(e, '封面上传失败'), 'error');
    }
  };

  /* ---------- 快速导入 ---------- */
  const quickImport = async () => {
    if (!/^https?:\/\/.+/.test(importUrl.trim())) { setErr('请输入有效的视频链接（如 B 站链接）'); return; }
    setErr('');
    setImporting(true);
    try {
      const r: any = await upload.quickImport({ source_url: importUrl.trim(), category: catLabel(catMain, catSub) });
      toast(`导入成功${r?.pending_review ? '，等待审核' : ''}`, 'success');
      nav('/me');
    } catch (e: any) {
      setErr(errMsg(e, '导入失败'));
    } finally {
      setImporting(false);
    }
  };

  /* ---------- 编辑模式：仅保存信息 / 换封面 ---------- */
  const saveEdit = async () => {
    if (!editId) return;
    try {
      const r: any = await videos.update(editId, {
        title: title.trim(),
        description: desc.trim(),
        category: catLabel(catMain, catSub),
        source_url: sourceUrl.trim(),
      });
      if (r?.moderation_warning) toast('已提交，但需注意：' + (r.moderation_opinion || '触发敏感词审核'), 'info');
      toast('信息已更新', 'success');
      if (coverFile || coverPreview) {
        await uploadCover({ id: editId } as Video);
      }
      nav(`/video/${editId}`);
    } catch (e: any) {
      setErr(errMsg(e, '保存失败'));
    }
  };

  /* ---------- 专栏 ---------- */
  const publishArticle = async () => {
    if (!artTitle.trim()) { setErr('请输入标题'); return; }
    if (!artContent.trim()) { setErr('请输入内容'); return; }
    setErr('');
    setArtBusy(true);
    try {
      const fd = new FormData();
      fd.append('title', artTitle.trim());
      fd.append('content', artContent);
      if (artCover) fd.append('cover', artCover);
      artImages.forEach(f => fd.append('images[]', f));
      const r: any = articleId ? await articles.edit(articleId, fd) : await articles.create(fd);
      const id = r?.article?.id ?? r?.id ?? articleId;
      toast(articleId ? '专栏已更新' : '专栏发布成功', 'success');
      if (id) nav(`/article/${id}`);
    } catch (e: any) {
      setErr(errMsg(e, '发布失败'));
    } finally {
      setArtBusy(false);
    }
  };

  const onArticleImages = (files: FileList | null) => {
    if (!files) return;
    const arr = [...files].filter(f => f.type.startsWith('image/') && f.size < 10 * 1024 * 1024);
    setArtImages(prev => [...prev, ...arr]);
  };

  /* ---------- render ---------- */
  if (phase === 'article') {
    return (
      <div className="page fade-in" style={{ maxWidth: 860 }}>
        <h1 className="page-title row" style={{ gap: 8 }}>
          <I name="newspaper" size={24} /> {articleId ? '编辑专栏' : '发布专栏'}
        </h1>
        <div className="card col" style={{ padding: 20, gap: 14 }}>
          <Field label="标题">
            <input value={artTitle} onChange={e => setArtTitle(e.target.value)} maxLength={100} placeholder="专栏标题" />
          </Field>
          <Field label="封面（可选）">
            <div className="row" style={{ gap: 10 }}>
              <Btn variant="tonal" size="sm" onClick={() => document.getElementById('art-cover-input')?.click()}><I name="image" size={15} /> 选择封面</Btn>
              {artCover && <span className="muted small">{artCover.name}</span>}
              <input id="art-cover-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setArtCover(e.target.files?.[0] || null)} />
            </div>
          </Field>
          <Field label="正文（Markdown）" hint="支持 ![](图片) 语法；可先上传图片获得外链">
            <textarea value={artContent} onChange={e => setArtContent(e.target.value)} style={{ minHeight: 320, fontFamily: 'var(--font-mono)', fontSize: 13.5 }} placeholder={'# 标题\n\n正文…\n\n![](图片链接)'} />
          </Field>
          <Field label={`插图（${artImages.length} 张，将上传后返回外链）`}>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <Btn variant="tonal" size="sm" onClick={() => document.getElementById('art-img-input')?.click()}><I name="plus" size={15} /> 添加图片</Btn>
              <input id="art-img-input" type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => { onArticleImages(e.target.files); e.target.value = ''; }} />
              {artImages.map((f, i) => (
                <span key={i} className="chip">
                  {f.name}
                  <button className="icon-btn icon-btn--sm" style={{ width: 20, height: 20 }} onClick={() => setArtImages(x => x.filter((_, j) => j !== i))} aria-label="移除"><I name="x" size={12} /></button>
                </span>
              ))}
            </div>
          </Field>
          {err && <div className="err">{err}</div>}
          <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
            <Btn variant="text" onClick={() => nav(-1 as any)}>取消</Btn>
            <Btn variant="filled" onClick={publishArticle} disabled={artBusy}>
              {artBusy ? <Spinner size={16} /> : <I name="send" size={16} />} {articleId ? '保存' : '发布'}
            </Btn>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="page fade-in" style={{ maxWidth: 640 }}>
        <div className="card" style={{ padding: 30, textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', margin: '0 auto 16px', display: 'grid', placeItems: 'center', background: 'color-mix(in srgb, var(--md-success) 18%, transparent)', color: 'var(--md-success)' }}>
            <I name="check" size={36} />
          </div>
          <h1 style={{ font: 'var(--text-headline-md)', marginBottom: 8 }}>上传完成</h1>
          <p className="muted" style={{ marginBottom: 20 }}>视频已提交审核，审核通过后即可公开播放。</p>
          <div className="row" style={{ gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {doneVideo?.id && <Btn variant="filled" onClick={() => nav(`/video/${doneVideo.id}`)}><I name="film" size={16} /> 查看视频</Btn>}
            {(coverFile || coverPreview) && <Btn variant="tonal" onClick={() => uploadCover(doneVideo!)}><I name="camera" size={16} /> {coverFile ? '上传选择封面' : '使用自动封面'}</Btn>}
            {doneVideo?.id && myCols.length > 0 && (
              <select className="field" style={{ background: 'var(--md-surface-container)', border: '1px solid var(--md-outline-variant)', borderRadius: 999, padding: '0 14px', height: 40, color: 'var(--md-on-surface)' }} defaultValue="" onChange={async e => {
                const cid = e.target.value;
                if (!cid) return;
                try {
                  await collections.addItem(cid, { video_id: doneVideo!.id, part_title: title, sort_order: 999 });
                  toast('已加入合集', 'success');
                } catch (e2: any) { toast(errMsg(e2), 'error'); }
              }}>
                <option value="" disabled>加入合集…</option>
                {myCols.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            )}
            <Btn variant="text" onClick={() => nav('/me')}>我的视频</Btn>
            <Btn variant="text" onClick={() => nav('/')}>回首页</Btn>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page fade-in" style={{ maxWidth: 760 }}>
      <h1 className="page-title row" style={{ gap: 8 }}>
        <I name={editId ? 'edit' : 'upload'} size={24} /> {editId ? '编辑视频' : '发布视频'}
      </h1>

      {/* 快速导入 */}
      {!editId && phase !== 'uploading' && (
        <div className="card" style={{ padding: 16 }}>
          <div className="row" style={{ gap: 8, marginBottom: 10 }}>
            <I name="zap" size={17} style={{ color: 'var(--md-tertiary)' }} />
            <b style={{ font: 'var(--text-title-sm)' }}>快速导入</b>
            <span className="muted small">粘贴 B 站等外部视频链接，一键导入</span>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <input value={importUrl} onChange={e => setImportUrl(e.target.value)} placeholder="https://www.bilibili.com/video/BV..." style={{ flex: 1, height: 40, borderRadius: 999, border: '1px solid var(--md-outline-variant)', background: 'var(--glass-1)', padding: '0 16px', color: 'var(--md-on-surface)' }} />
            <Btn variant="tonal" onClick={quickImport} disabled={importing}>{importing ? <Spinner size={15} /> : <I name="download" size={15} />} 导入</Btn>
          </div>
          <hr className="divider" />
        </div>
      )}

      {/* 选择文件 */}
      {phase === 'pick' && (
        <div
          className={`upload-drop ${drag ? 'drag' : ''}`}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); pickFile(e.dataTransfer.files?.[0] || null); }}
        >
          <div style={{ width: 72, height: 72, borderRadius: 22, display: 'grid', placeItems: 'center', background: 'var(--md-primary-container)', color: 'var(--md-on-primary-container)' }}>
            <I name="film" size={34} />
          </div>
          <div style={{ font: 'var(--text-title-md)' }}>拖拽视频文件到此处，或</div>
          <Btn variant="filled" onClick={() => document.getElementById('zz-file')?.click()}>
            <I name="upload" size={17} /> 选择文件
          </Btn>
          <input id="zz-file" type="file" accept="video/*" style={{ display: 'none' }} onChange={e => { pickFile(e.target.files?.[0] || null); e.target.value = ''; }} />
          <div className="muted small">MP4 / WebM / MKV(MP4 兼容性最佳) · ≤15GB · ≤2 小时 · 支持 SHA-256 秒传</div>
        </div>
      )}

      {/* 填写信息 */}
      {(phase === 'meta' || phase === 'hashing' || phase === 'uploading') && file && (
        <div className="card col" style={{ padding: 20, gap: 14 }}>
          <div className="upload-file-meta">
            <span className="uicon"><I name="film" size={24} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="clamp1" style={{ font: 'var(--text-title-sm)' }}>{file.name}</div>
              <div className="muted small">{fmtBytes(file.size)}{file.type ? ` · ${file.type}` : ''}</div>
            </div>
          </div>

          <Field label="标题 *">
            <input value={title} onChange={e => setTitle(e.target.value)} maxLength={100} placeholder="给视频起个标题" />
          </Field>
          <Field label="简介">
            <textarea value={desc} onChange={e => setDesc(e.target.value)} maxLength={4000} placeholder="介绍一下你的视频（可选）" />
          </Field>
          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            <Field label="分类"><select value={catMain} onChange={e => { setCatMain(e.target.value); setCatSub(CATEGORIES[e.target.value]?.[0] || ''); }} style={{ minWidth: 130 }}>{CATEGORY_NAMES.map(c => <option key={c}>{c}</option>)}</select></Field>
            <Field label="子类"><select value={catSub} onChange={e => setCatSub(e.target.value)} style={{ minWidth: 130 }}>{(CATEGORIES[catMain] || []).map(c => <option key={c}>{c}</option>)}</select></Field>
          </div>
          <Field label="原始链接（可选）" hint="B 站 / YouTube 等原始地址">
            <input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://…" />
          </Field>

          {!editId && (
            <div className="col" style={{ gap: 8 }}>
              <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                <span style={{ font: 'var(--text-label-lg)', width: 70 }}>封面</span>
                <Btn variant="tonal" size="sm" onClick={() => document.getElementById('zz-cover')?.click()}><I name="camera" size={15} /> 选择封面图</Btn>
                <input id="zz-cover" type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { setCoverFile(f); setCoverPreview(f ? URL.createObjectURL(f) : ''); } }} />
                <label className="row" style={{ gap: 6, cursor: 'pointer' }}>
                  <Switch checked={autoCover} onChange={setAutoCover} label="自动截取封面" />
                  <span className="small muted">自动从视频截取封面</span>
                </label>
              </div>
              {coverPreview && (
                <div style={{ position: 'relative', width: 220, borderRadius: 12, overflow: 'hidden' }}>
                  <img src={coverPreview} alt="封面预览" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />
                  {coverFile && <span className="live-tag" style={{ position: 'absolute', left: 8, top: 8 }}>自定义</span>}
                </div>
              )}
            </div>
          )}

          {err && <div className="err">{err}</div>}

          {phase === 'hashing' && (
            <div className="upload-step active">
              <span className="step-dot"><Spinner size={14} /></span>
              <span>正在计算 SHA-256（用于秒传检测）…</span>
            </div>
          )}
          {phase === 'uploading' && (
            <div className="col" style={{ gap: 8 }}>
              <div className="upload-step active">
                <span className="step-dot"><Spinner size={14} /></span>
                <span style={{ font: 'var(--text-label-lg)' }}>正在上传 {Math.round(progress * 100)}%</span>
                <span className="muted small">{fmtBytes(file.size * progress)} / {fmtBytes(file.size)}</span>
              </div>
              <Progress value={progress * 100} />
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <Btn variant="text" onClick={cancelUpload} disabled={aborting}>{aborting ? '取消中…' : '取消上传'}</Btn>
              </div>
            </div>
          )}

          <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
            {!editId && <Btn variant="text" onClick={() => { setFile(null); setPhase('pick'); }}>← 重新选择文件</Btn>}
            {editId ? (
              <Btn variant="filled" size="lg" onClick={saveEdit}><I name="check" size={18} /> 保存修改</Btn>
            ) : (
              <Btn variant="filled" size="lg" onClick={publish} disabled={phase !== 'meta'}>
                <I name="upload" size={18} /> 开始上传
              </Btn>
            )}
          </div>
        </div>
      )}

      {/* 失败 */}
      {phase === 'error' && (
        <div className="card" style={{ padding: 30, textAlign: 'center' }}>
          <I name="xCircle" size={40} style={{ color: 'var(--md-error)', margin: '0 auto 14px' }} />
          <div style={{ font: 'var(--text-title-md)', marginBottom: 8 }}>上传失败</div>
          <p className="muted" style={{ marginBottom: 18 }}>{err}</p>
          <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
            <Btn variant="tonal" onClick={() => setPhase(file ? 'meta' : 'pick')}><I name="refresh" size={16} /> 重试</Btn>
            <Btn variant="text" onClick={() => nav('/me')}>返回</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
