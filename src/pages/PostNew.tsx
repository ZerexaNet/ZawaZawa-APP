import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { posts, upload } from '../lib/api';
import { Avatar, Btn, Spinner } from '../components/ui';
import { I } from '../components/icons';
import { useAuth } from '../store/auth';
import { useToast, errMsg } from '../store/toast';

/** 发布动态（文字 + 图片）。图片通过 /api/videos/upload/proxy-put 上传到 dynamic/ 前缀。 */
export default function PostNew() {
  const nav = useNavigate();
  const user = useAuth(s => s.user);
  const toast = useToast(s => s.push);
  const [text, setText] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { if (!user) nav('/login'); }, [user, nav]);

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    const arr = [...files].filter(f => f.type.startsWith('image/') && f.size < 10 * 1024 * 1024);
    setImages(prev => [...prev, ...arr].slice(0, 9));
  };

  const publish = async () => {
    if (!text.trim() && images.length === 0) { setErr('写点什么吧'); return; }
    setBusy(true); setErr('');
    try {
      let imageUrls: string[] = [];
      if (images.length) {
        for (let i = 0; i < images.length; i++) {
          const f = images[i];
          const key = `dynamics/${user!.id}/${Date.now()}_${i}_${f.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
          await upload.proxyPut(key, f, f.type);
          imageUrls.push(`/api/s3/object?key=${encodeURIComponent(key)}`);
        }
      }
      const r: any = await posts.create({ content: text.trim(), image_urls: imageUrls });
      toast(r?.pending_review ? '动态已提交审核' : '动态发布成功', 'success');
      nav('/me');
    } catch (e: any) {
      setErr(errMsg(e, '发布失败'));
      setBusy(false);
    }
  };

  return (
    <div className="page fade-in" style={{ maxWidth: 640 }}>
      <h1 className="page-title row" style={{ gap: 8 }}><I name="message" size={22} /> 发布动态</h1>
      <div className="card col" style={{ padding: 20, gap: 14 }}>
        <div className="row" style={{ gap: 10 }}>
          <Avatar user={user} size={40} />
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="分享你的想法…"
            maxLength={2000}
            style={{ flex: 1, background: 'none', border: 'none', resize: 'vertical', minHeight: 90, outline: 'none', color: 'var(--md-on-surface)', lineHeight: 1.6 }}
          />
        </div>
        {images.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {images.map((f, i) => (
              <div key={i} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', aspectRatio: '1' }}>
                <img src={URL.createObjectURL(f)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button className="icon-btn icon-btn--sm" style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', color: '#fff' }} onClick={() => setImages(x => x.filter((_, j) => j !== i))} aria-label="移除"><I name="x" size={13} /></button>
              </div>
            ))}
          </div>
        )}
        <div className="row" style={{ gap: 8, justifyContent: 'space-between' }}>
          <div className="row" style={{ gap: 8 }}>
            <Btn variant="tonal" size="sm" onClick={() => document.getElementById('post-img')?.click()}><I name="image" size={15} /> 图片 ({images.length}/9)</Btn>
            <input id="post-img" type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => { onFiles(e.target.files); e.target.value = ''; }} />
          </div>
          <div className="row" style={{ gap: 10 }}>
            <span className="muted small">{text.length}/2000</span>
            <Btn variant="filled" onClick={publish} disabled={busy}>{busy ? <Spinner size={15} /> : <I name="send" size={15} />} 发布</Btn>
          </div>
        </div>
        {err && <div className="err">{err}</div>}
      </div>
    </div>
  );
}
