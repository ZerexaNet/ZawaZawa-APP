import { useCallback, useEffect, useRef, useState } from 'react';
import { I } from '../icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { errMsg, toast, useAuth } from '../store';
import { StreamingSha256, CATEGORIES, fmtSize } from '../lib/utils';
import { asArray, type Collection, type Video } from '../types';

const MAX_SIZE = 15 * 1024 ** 3; // 15GB
const MAX_DURATION = 2 * 60 * 60; // 2h
const PART_SIZE = 10 * 1024 * 1024; // 10MB

type Phase = 'idle' | 'hashing' | 'uploading' | 'done' | 'error';

export function UploadPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [catMain, setCatMain] = useState('综合');
  const [catSub, setCatSub] = useState('Vlog');
  const [sourceUrl, setSourceUrl] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [stageText, setStageText] = useState('');
  const [hash, setHash] = useState('');
  const [existingVideo, setExistingVideo] = useState<Video | null>(null);
  const [resultVideo, setResultVideo] = useState<Video | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverUrl, setCoverUrl] = useState('');
  const [subFiles, setSubFiles] = useState<File[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [targetCollection, setTargetCollection] = useState('');
  const [partTitle, setPartTitle] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadIdRef = useRef('');
  const keyRef = useRef('');

  useEffect(() => {
    if (!user) nav('/login');
  }, [user, nav]);

  useEffect(() => {
    if (user) api.myCollections().then((d) => setCollections(asArray<Collection>(d))).catch(() => {});
  }, [user]);

  // 快速导入（B站链接）
  const [quickUrl, setQuickUrl] = useState('');
  const [quickBusy, setQuickBusy] = useState(false);
  const quickImport = async () => {
    if (!quickUrl.trim()) return;
    setQuickBusy(true);
    try {
      await api.quickImport(quickUrl.trim(), `${catMain} / ${catSub}`);
      toast('快速导入成功，视频进入审核队列');
      nav('/profile');
    } catch (e) {
      toast(errMsg(e), 'err');
    } finally { setQuickBusy(false); }
  };

  const onPickFile = (f: File) => {
    if (f.size > MAX_SIZE) { toast('文件超过 15GB 上限', 'err'); return; }
    setFile(f);
    setPhase('idle');
    setProgress(0);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''));
    // 预检时长
    const url = URL.createObjectURL(f);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.src = url;
    v.onloadedmetadata = () => {
      if (v.duration > MAX_DURATION + 5) {
        toast('视频超过 2 小时上限', 'err');
        setFile(null);
      }
      URL.revokeObjectURL(url);
    };
  };

  const startUpload = useCallback(async () => {
    if (!file) return;
    if (!title.trim()) { toast('请填写标题', 'err'); return; }
    const f = file;
    setPhase('hashing');
    setStageText('正在计算文件指纹…');
    setProgress(0);
    let hashVal = '';
    try {
      // 1. 计算 SHA-256（增量）
      const hasher = new StreamingSha256();
      const step = 16 * 1024 * 1024;
      let off = 0;
      while (off < f.size) {
        const buf = await f.slice(off, Math.min(off + step, f.size)).arrayBuffer();
        hasher.feed(new Uint8Array(buf));
        off += step;
        setProgress(Math.min(5, (off / f.size) * 5));
        if (off % (step * 4) === 0) await new Promise((r) => setTimeout(r, 0)); // 让出 UI
      }
      hashVal = hasher.digestHex();
      setHash(hashVal);
      setStageText('检查是否重复上传…');

      // 2. 去重检查
      const chk = await api.uploadCheckHash(hashVal);
      if (chk.exists && chk.existingVideoId) {
        try {
          const v = await api.video(chk.existingVideoId);
          setExistingVideo(v);
        } catch { /* ignore */ }
        setPhase('idle');
        setProgress(0);
        setStageText('该文件似乎已经上传过');
        return;
      }

      // 3. 初始化上传
      setPhase('uploading');
      setStageText('初始化上传…');
      const small = f.size <= PART_SIZE * 2;
      const init = await api.uploadInitiate(f.name, f.type || 'video/mp4', small);
      const { uploadId, key, videoId } = init;
      uploadIdRef.current = uploadId;
      keyRef.current = key;

      const controller = new AbortController();
      abortRef.current = controller;
      let done = false;

      const finish = async (parts: { PartNumber: number; ETag: string }[]) => {
        done = true;
        setStageText('提交中，创建视频…');
        setProgress(99);
        const res = await api.uploadComplete({
          uploadId, key, videoId, parts,
          title: title.trim(),
          description: desc.trim() || undefined,
          category: `${catMain} / ${catSub}`,
          source_url: sourceUrl.trim() || undefined,
          file_hash: hashVal,
        });
        setProgress(100);
        setStageText('上传完成');

        // 4. 封面
        if (coverFile) {
          setStageText('上传封面…');
          try { await api.coverUpdate(videoId, coverFile, coverFile.type || 'image/jpeg'); } catch (e) { toast('封面上传失败：' + errMsg(e), 'err'); }
        }
        // 5. 字幕
        for (const sf of subFiles) {
          try {
            const lang = sf.name.toLowerCase().includes('en') ? 'en' : 'zh';
            await api.subtitleUpload(videoId, sf, lang, sf.name.replace(/\.[^.]+$/, ''));
          } catch { /* ignore */ }
        }
        // 6. 加入合集
        if (targetCollection) {
          try { await api.collectionAddItem(targetCollection, videoId, partTitle.trim() || undefined); } catch { /* ignore */ }
        }

        const vRes = res as Video;
        setResultVideo({ ...vRes, id: vRes.id || videoId, title: vRes.title || title });
        setPhase('done');
        // 刷新合集
        try { setCollections(asArray<Collection>(await api.myCollections())); } catch { /* ignore */ }
      };

      if (init.directUpload && !init.putUrl) {
        // 直传但服务端未给 putUrl → 用 presign-single 获取整文件预签名地址
        setStageText('获取直传地址…');
        try {
          const { url } = await api.uploadPresignSingle(key, uploadId);
          setStageText('正在上传…');
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', url);
            xhr.setRequestHeader('Content-Type', f.type || 'video/mp4');
            if (controller.signal.aborted) reject(new Error('aborted'));
            controller.signal.addEventListener('abort', () => { xhr.abort(); reject(new Error('aborted')); });
            xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(5 + (e.loaded / e.total) * 94); };
            xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('upload failed ' + xhr.status)));
            xhr.onerror = () => reject(new Error('network error'));
            xhr.send(f);
          });
          await finish([]);
        } catch (e1) {
          if (String(e1).includes('aborted')) { setPhase('idle'); setStageText('已取消'); return; }
          setStageText('直传失败，切换服务器代理上传…');
          try {
            await api.uploadProxyPut(key, f, f.type || 'video/mp4', (p) => setProgress(5 + p * 94), controller.signal);
            await finish([]);
          } catch (e2) {
            if (String(e2).includes('aborted')) { setPhase('idle'); setStageText('已取消'); await api.uploadCancel(uploadId, key).catch(() => {}); return; }
            throw e2;
          }
        }
        return;
      }

      if (init.directUpload && init.putUrl) {
        // 直传模式
        setStageText('正在上传…');
        try {
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', init.putUrl!);
            xhr.setRequestHeader('Content-Type', f.type || 'video/mp4');
            if (controller.signal.aborted) reject(new Error('aborted'));
            controller.signal.addEventListener('abort', () => { xhr.abort(); reject(new Error('aborted')); });
            xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(5 + (e.loaded / e.total) * 94); };
            xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('upload failed ' + xhr.status)));
            xhr.onerror = () => reject(new Error('network error'));
            xhr.send(f);
          });
          await finish([]);
        } catch (e1) {
          if (String(e1).includes('aborted')) { setPhase('idle'); setStageText('已取消'); return; }
          // 回退到代理上传
          setStageText('直传失败，切换服务器代理上传…');
          try {
            await api.uploadProxyPut(key, f, f.type || 'video/mp4', (p) => setProgress(5 + p * 94), controller.signal);
            await finish([]);
          } catch (e2) {
            if (String(e2).includes('aborted')) { setPhase('idle'); setStageText('已取消'); await api.uploadCancel(uploadId, key).catch(() => {}); return; }
            throw e2;
          }
        }
      } else {
        // 分片上传
        const totalParts = Math.ceil(f.size / PART_SIZE);
        const parts: { PartNumber: number; ETag: string }[] = new Array(totalParts);
        let completed = 0;
        let partNo = 0;
        const worker = async () => {
          while (!done) {
            const n = ++partNo;
            if (n > totalParts) return;
            const start = (n - 1) * PART_SIZE;
            const end = Math.min(start + PART_SIZE, f.size);
            const chunk = f.slice(start, end);
            let etag = '';
            let ok = false;
            for (let attempt = 0; attempt < 3 && !ok; attempt++) {
              try {
                const { url } = await api.uploadPresignPart(key, uploadId, n);
                await new Promise<void>((resolve, reject) => {
                  const xhr = new XMLHttpRequest();
                  xhr.open('PUT', url);
                  if (controller.signal.aborted) reject(new Error('aborted'));
                  controller.signal.addEventListener('abort', () => { xhr.abort(); reject(new Error('aborted')); });
                  xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) { etag = xhr.getResponseHeader('ETag') || `'part-${n}'`; resolve(); }
                    else reject(new Error('part ' + n + ' failed ' + xhr.status));
                  };
                  xhr.onerror = () => reject(new Error('part network error'));
                  xhr.send(chunk);
                });
                ok = true;
              } catch (pe) {
                if (String(pe).includes('aborted')) throw pe;
                await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
              }
            }
            if (!ok) throw new Error('分片 ' + n + ' 上传失败');
            parts[n - 1] = { PartNumber: n, ETag: etag };
            completed++;
            setProgress(5 + (completed / totalParts) * 94);
            setStageText(`分片上传 ${completed}/${totalParts}`);
          }
        };
        const CONC = 3;
        try {
          const workers = Array.from({ length: Math.min(CONC, totalParts) }, () => worker());
          await Promise.all(workers);
          if (!done) await finish(parts);
        } catch (e1) {
          if (String(e1).includes('aborted')) { setPhase('idle'); setStageText('已取消'); await api.uploadCancel(uploadId, key).catch(() => {}); return; }
          // 分片失败 → 尝试整体代理上传
          setStageText('分片上传失败，尝试服务器代理整体上传…');
          try {
            await api.uploadProxyPut(key, f, f.type || 'video/mp4', (p) => setProgress(5 + p * 94), controller.signal);
            if (!done) await finish([]);
          } catch (e2) {
            if (String(e2).includes('aborted')) { setPhase('idle'); setStageText('已取消'); await api.uploadCancel(uploadId, key).catch(() => {}); return; }
            throw e2;
          }
        }
      }
    } catch (e) {
      if (String(e).includes('aborted')) { setPhase('idle'); setStageText('已取消'); return; }
      setPhase('error');
      setErrorMsg(errMsg(e));
      try { await api.uploadCancel(uploadIdRef.current || '', keyRef.current).catch(() => {}); } catch { /* ignore */ }
    }
  }, [file, title, desc, catMain, catSub, sourceUrl, coverFile, subFiles, targetCollection, partTitle]);

  const isBusy = phase === 'uploading' || phase === 'hashing';
  if (!user) return null;

  return (
    <div className="page" style={{ maxWidth: 760, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22 }}><I name="plus" size={20} /> 投稿视频</h1>

      {/* 快速导入 */}
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}><I name="zap" size={15} /> 快速导入（B站视频链接）</div>
        <div className="flex">
          <input
            type="text" value={quickUrl} onChange={(e) => setQuickUrl(e.target.value)}
            placeholder="粘贴 bilibili.com 视频链接"
            style={{ flex: 1, padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg)', color: 'var(--ink)', minWidth: 0 }}
          />
          <button className="btn btn-sm" disabled={quickBusy || !quickUrl.trim()} onClick={quickImport}>{quickBusy ? '导入中…' : '一键导入'}</button>
        </div>
        <div className="hint">导入的视频将自动进入审核队列</div>
      </div>

      {/* 文件选择 */}
      <div
        className="card"
        style={{ padding: 20, marginBottom: 16, textAlign: 'center', borderStyle: file ? 'solid' : 'dashed', cursor: 'pointer' }}
        onClick={() => !file && fileInput.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onPickFile(f); }}
      >
        {file ? (
          <div>
            <div style={{ fontWeight: 700 }}>{file.name}</div>
            <div className="muted">{fmtSize(file.size)} · {file.type || 'video'}</div>
            <button className="btn btn-sm btn-ghost" style={{ marginTop: 8 }} onClick={(e) => { e.stopPropagation(); setFile(null); setPhase('idle'); setProgress(0); }}>重新选择</button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', marginBottom: 6 }}><I name="video" size={34} /></div>
            <div style={{ fontWeight: 600 }}>点击选择或拖拽视频文件到此处</div>
            <div className="hint">支持 MP4 / WebM / MOV，最大 15GB，时长 ≤ 2 小时</div>
          </div>
        )}
        <input ref={fileInput} type="file" accept="video/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickFile(f); e.target.value = ''; }} />
      </div>

      {existingVideo && (
        <div className="notice-banner" style={{ marginBottom: 16 }}>
          检测到相同文件已上传：<a href={'/video/' + existingVideo.id} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-2)' }}>{existingVideo.title}</a>
        </div>
      )}

      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div className="field">
          <label>标题 *</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="给视频起个标题" disabled={!!resultVideo} />
        </div>
        <div className="field">
          <label>简介</label>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={2000} placeholder="介绍一下你的视频…" disabled={!!resultVideo} />
        </div>
        <div className="field">
          <label>分类</label>
          <div className="flex">
            <select value={catMain} onChange={(e) => { setCatMain(e.target.value); setCatSub((CATEGORIES[e.target.value] || ['其他'])[0]); }} style={{ flex: 1, padding: '9px 10px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)' }}>
              {Object.keys(CATEGORIES).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={catSub} onChange={(e) => setCatSub(e.target.value)} style={{ flex: 1, padding: '9px 10px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)' }}>
              {(CATEGORIES[catMain] || ['其他']).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label>原始来源链接（可选）</label>
          <input type="text" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://…" disabled={!!resultVideo} />
        </div>
        <div className="field">
          <label>封面（可选，不填将自动截取）</label>
          <div className="flex wrap">
            {coverUrl && <img src={coverUrl} alt="" style={{ width: 150, borderRadius: 10 }} />}
            <CoverPick onPick={(f) => { setCoverFile(f); setCoverUrl(URL.createObjectURL(f)); }} />
          </div>
        </div>
        <div className="field">
          <label>字幕文件（可选，可多选 vtt/srt/ass）</label>
          <SubPick files={subFiles} onChange={setSubFiles} />
        </div>
        <div className="field">
          <label>加入合集（可选）</label>
          <div className="flex">
            <select value={targetCollection} onChange={(e) => setTargetCollection(e.target.value)} style={{ flex: 1, padding: '9px 10px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)' }}>
              <option value="">不加入合集</option>
              {collections.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            {targetCollection && <input type="text" value={partTitle} onChange={(e) => setPartTitle(e.target.value)} placeholder="分P标题" style={{ flex: 1, padding: '9px 10px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', minWidth: 0 }} />}
          </div>
        </div>
      </div>

      {phase === 'error' && <div className="notice-banner" style={{ color: 'var(--err)' }}>{errorMsg}</div>}

      {phase === 'done' && resultVideo ? (
        <div className="card" style={{ padding: 20, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--ok)' }}><I name="check" size={44} /></div>
          <div style={{ fontWeight: 700, fontSize: 17, marginTop: 6 }}>上传成功！</div>
          <div className="muted" style={{ margin: '6px 0 14px' }}>视频已提交审核，审核通过后即可公开观看</div>
          <div className="flex" style={{ justifyContent: 'center' }}>
            <button className="btn" onClick={() => nav('/')}>返回首页</button>
            <button className="btn btn-primary" onClick={() => nav(`/video/${resultVideo.id}`)}>查看视频</button>
          </div>
        </div>
      ) : (
        <div>
          {file && (
            <div className="progress" style={{ marginBottom: 10 }}>
              <div style={{ width: progress + '%' }} />
            </div>
          )}
          <div className="flex between">
            <span className="muted">{stageText || ''} {hash ? <span className="mono">#{hash.slice(0, 12)}…</span> : null}</span>
            {isBusy ? (
              <button className="btn btn-danger btn-sm" onClick={() => abortRef.current?.abort()}>取消上传</button>
            ) : (
              <button className="btn btn-primary" disabled={!file || !title.trim() || isBusy} onClick={startUpload}>
                {file ? '开始上传' : '请先选择视频'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CoverPick({ onPick }: { onPick: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button className="btn btn-sm" onClick={() => ref.current?.click()}>选择封面图</button>
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ''; }} />
    </>
  );
}

function SubPick({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button className="btn btn-sm" onClick={() => ref.current?.click()}>选择字幕文件</button>
      {files.length > 0 && <span className="muted" style={{ marginLeft: 8 }}>{files.map((f) => f.name).join(', ')}</span>}
      <input ref={ref} type="file" multiple accept=".vtt,.srt,.ass" style={{ display: 'none' }} onChange={(e) => { onChange([...files, ...Array.from(e.target.files || [])]); e.target.value = ''; }} />
    </>
  );
}


