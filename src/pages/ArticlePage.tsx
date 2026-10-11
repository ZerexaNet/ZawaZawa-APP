import { useEffect, useRef, useState } from 'react';
import { I } from '../icons';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import type { Article } from '../types';
import { Avatar, CommentSection, Cover, Empty, Loading, Markdown, Modal, VerBadge } from '../components';
import { errMsg, toast, useAuth } from '../store';
import { fmtCount, timeAgo, goto } from '../lib/utils';

export function ArticlePage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const [article, setArticle] = useState<Article | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  useEffect(() => {
    api.articleDetail(id).then(setArticle).catch((e) => {
      if ((e as { status?: number }).status === 404) setNotFound(true);
      else toast(errMsg(e), 'err');
    });
  }, [id]);

  if (notFound) return <div className="page"><Empty text="专栏不存在" icon="file" /></div>;
  if (!article) return <div className="page"><Loading /></div>;

  const isOwner = user && (String(user.id) === String((article as never as { author_id?: string }).author_id) || String(user.uid) === String(article.author_uid));
  const isAdmin = user && ['admin', 'video_moderation', 'content_review'].includes(String(user.role || ''));

  return (
    <div className="page" style={{ maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, lineHeight: 1.4, marginBottom: 10 }}>{article.title}</h1>
      <div className="flex wrap" style={{ marginBottom: 18, color: 'var(--ink-3)', fontSize: 13, alignItems: 'center' }}>
        <Link to={`/user/${article.author_uid}`} className="flex" style={{ gap: 6 }}>
          <Avatar name={article.author_username || '匿名'} size={30} url={article.author_gravatar_url} />
          <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>{article.author_username}</span>
          <VerBadge badge={article.author_verification_badge} label={article.author_verification_label} />
        </Link>
        <span>· {timeAgo(article.created_at as string)}</span>
        <span>· 阅读 {fmtCount(article.views)}</span>
        {article.author_ip_location && <span>· {article.author_ip_location}</span>}
        {(isOwner || isAdmin) && (
          <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setShowEdit(true)}><I name="pen" size={14} /> 编辑</button>
        )}
      </div>
      {article.cover_url && <Cover src={article.cover_url} alt="" style={{ width: '100%', borderRadius: 14, marginBottom: 18 }} />}
      <div className="card" style={{ padding: '20px 24px' }}>
        <Markdown text={article.content || ''} />
      </div>
      <div style={{ marginTop: 22 }}>
        <CommentSection targetType="article" targetId={id} />
      </div>

      {showEdit && article && (
        <EditArticleModal article={article} onClose={() => setShowEdit(false)} onSaved={(msg) => { setShowEdit(false); toast(msg); api.articleDetail(id).then(setArticle).catch(() => {}); }} />
      )}
    </div>
  );
}

export function NewArticleButton({ onClick }: { onClick: () => void }) {
  return <button className="btn btn-primary btn-sm" onClick={onClick}>＋ 发表专栏</button>;
}

export function EditArticleModal({ article, onClose, onSaved }: { article: Article; onClose: () => void; onSaved: (msg: string) => void }) {
  const [title, setTitle] = useState(article.title || '');
  const [content, setContent] = useState(article.content || '');
  const [images, setImages] = useState<File[]>([]);
  const [cover, setCover] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    if (!title.trim()) { toast('标题不能为空', 'err'); return; }
    setBusy(true);
    try {
      await api.articleEdit(article.id, title.trim(), content, images, images.length ? 0 : -1, cover);
      onSaved('专栏已保存');
    } catch (e) {
      toast(errMsg(e), 'err');
    } finally { setBusy(false); }
  };

  return (
    <Modal title="编辑专栏" onClose={onClose} wide foot={
      <>
        <button className="btn" onClick={onClose}>取消</button>
        <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? '保存中…' : '保存'}</button>
      </>
    }>
      <div className="field"><label>标题</label><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} /></div>
      <div className="field"><label>正文（Markdown）</label><textarea value={content} onChange={(e) => setContent(e.target.value)} style={{ minHeight: 260, fontFamily: 'ui-monospace, monospace', fontSize: 13 }} /></div>
      <div className="field">
        <label>插图（图片 URL 或上传图片，图片将以 Markdown 语法插入）</label>
        <div className="flex wrap">
          <button className="btn btn-sm" onClick={() => imgRef.current?.click()}>上传图片</button>
          <button className="btn btn-sm" onClick={() => { const url = prompt('输入图片 URL：'); if (url) setContent(content + `\n![](${url})\n`); }}>插入图片链接</button>
          <input ref={imgRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => { setImages([...images, ...Array.from(e.target.files || [])]); e.target.value = ''; }} />
        </div>
        {images.length > 0 && <div className="muted" style={{ marginTop: 6 }}>{images.map((i) => i.name).join(', ')}</div>}
      </div>
      <div className="field">
        <label>封面（可选）</label>
        <div className="flex">
          <button className="btn btn-sm" onClick={() => coverRef.current?.click()}>选择封面</button>
          <span className="muted">{cover ? cover.name : '不选则自动使用第一张插图'}</span>
          <input ref={coverRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { setCover(e.target.files?.[0] || null); e.target.value = ''; }} />
        </div>
      </div>
      <div className="notice-banner">支持标准 Markdown：# 标题、**加体**、图片 ![](url)、代码块、列表、表格、引用</div>
    </Modal>
  );
}

export function NewArticleModal({ onClose, onSaved }: { onClose: () => void; onSaved?: () => void }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [cover, setCover] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    if (!title.trim() || !content.trim()) { toast('请填写标题和正文', 'err'); return; }
    setBusy(true);
    try {
      const r = await api.articlePost(title.trim(), content, images, images.length ? 0 : -1, cover);
      toast('专栏已提交');
      if (onSaved) onSaved();
      onClose();
      const id = (r as { id?: string })?.id;
      if (id) goto(`/article/${id}`);
    } catch (e) {
      toast(errMsg(e), 'err');
    } finally { setBusy(false); }
  };

  return (
    <Modal title="发表专栏" onClose={onClose} wide foot={
      <>
        <button className="btn" onClick={onClose}>取消</button>
        <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? '提交中…' : '发表'}</button>
      </>
    }>
      <div className="field"><label>标题</label><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="专栏标题" /></div>
      <div className="field"><label>正文（Markdown）</label><textarea value={content} onChange={(e) => setContent(e.target.value)} style={{ minHeight: 280, fontFamily: 'ui-monospace, monospace', fontSize: 13 }} placeholder="# 标题&#10;&#10;正文内容…" /></div>
      <div className="field">
        <label>插图</label>
        <div className="flex wrap">
          <button className="btn btn-sm" onClick={() => imgRef.current?.click()}>上传图片</button>
          <button className="btn btn-sm" onClick={() => { const url = prompt('输入图片 URL：'); if (url) setContent(content + `\n![](${url})\n`); }}>插入图片链接</button>
          <input ref={imgRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => { setImages([...images, ...Array.from(e.target.files || [])]); e.target.value = ''; }} />
        </div>
        {images.length > 0 && <div className="muted" style={{ marginTop: 6 }}>{images.map((i) => i.name).join(', ')}</div>}
      </div>
      <div className="field">
        <label>封面（可选）</label>
        <div className="flex">
          <button className="btn btn-sm" onClick={() => coverRef.current?.click()}>选择封面</button>
          <span className="muted">{cover ? cover.name : '不选则自动使用第一张插图'}</span>
          <input ref={coverRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { setCover(e.target.files?.[0] || null); e.target.value = ''; }} />
        </div>
      </div>
    </Modal>
  );
}
