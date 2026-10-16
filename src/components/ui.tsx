import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { I } from './icons';
import { useToast } from '../store/toast';
import { avatarUrl, fallbackAvatar } from '../lib/util';
import type { Badge } from '../lib/types';

/* ---------- Buttons ---------- */
export function Btn({ variant = 'filled', size, icon, children, className = '', ...rest }: any) {
  const cls = ['btn', `btn--${variant}`, size === 'sm' ? 'btn--sm' : size === 'lg' ? 'btn--lg' : '', className].filter(Boolean).join(' ');
  return (
    <button className={cls} {...rest}>
      {icon && <I name={icon} size={size === 'sm' ? 16 : 18} />}
      {children}
    </button>
  );
}
export function IconBtn({ name, label, active, size, className = '', ...rest }: any) {
  return (
    <button className={`icon-btn ${active ? 'icon-btn--active' : ''} ${className}`} aria-label={label} title={label} {...rest}>
      <I name={name} size={size || 20} />
    </button>
  );
}

/* ---------- Avatar & badges ---------- */
export function Avatar({ user, size = 36, className = '' }: { user: any; size?: number; className?: string }) {
  const [err, setErr] = useState(false);
  // 用户变化时重置错误态（否则会一直显示上一个用户的回退头像）
  useEffect(() => { setErr(false); }, [user?.id, user?.avatar_url, user?.gravatar_url]);
  // 远程头像加载失败 → 本地生成头像（不能把失败的 URL 再塞回去）
  const url = err ? fallbackAvatar(user?.username) : avatarUrl(user, size);
  return (
    <img
      className={`avatar ${size <= 30 ? 'avatar--sm' : size >= 80 ? 'avatar--lg' : ''} ${className}`}
      style={{ width: size, height: size }}
      src={url}
      alt={user?.username || ''}
      loading="lazy"
      decoding="async"
      onError={() => setErr(true)}
    />
  );
}
export function VBadge({ badge, label, size = 16 }: { badge?: Badge | string; label?: string; size?: number }) {
  if (!badge) return null;
  const cls = badge === 'blue' ? 'vbadge--blue' : badge === 'green' ? 'vbadge--green' : badge === 'yellow' ? 'vbadge--yellow' : badge === 'pink' ? 'vbadge--pink' : 'vbadge--org';
  const txt = badge === 'pink' ? 'P' : badge === 'blue' || badge === 'green' || badge === 'yellow' ? '✓' : (label || '').slice(0, 2);
  return (
    <span className={`vbadge ${cls}`} style={{ width: size, height: size }} title={label || `${badge} 认证`}>
      {txt}
    </span>
  );
}
export function UserName({ user, badge = true }: { user: any; badge?: boolean }) {
  return (
    <span className="row" style={{ gap: 5, minWidth: 0 }}>
      <span className="uname clamp1" style={{ maxWidth: 180, color: 'var(--md-on-surface)' }}>{user?.username}</span>
      {badge && <VBadge badge={user?.verification_badge ?? user?.author_verification_badge} label={user?.verification_label ?? user?.author_verification_label} size={14} />}
    </span>
  );
}

/* ---------- Chip / Seg ---------- */
export function Chip({ selected, onClick, children, className = '' }: any) {
  return (
    <button className={`chip ${selected ? 'chip--selected' : ''} ${className}`} onClick={onClick} type="button">
      {children}
    </button>
  );
}
export function Seg({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="seg">
      {options.map(o => (
        <button key={o.value} className={o.value === value ? 'active' : ''} onClick={() => onChange(o.value)} type="button">{o.label}</button>
      ))}
    </div>
  );
}

/* ---------- Switch ---------- */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="switch"
      onClick={e => { e.stopPropagation(); onChange(!checked); }}
      type="button"
    >
      <span className="knob" />
    </button>
  );
}

/* ---------- Modal / Dialog ---------- */
export function Dialog({ open, onClose, title, children, wide, actions, className = '' }: any) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', h); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`dialog ${wide ? 'dialog--wide' : ''} ${className}`} role="dialog" aria-modal="true">
        <div className="dialog-head">
          <h3>{title}</h3>
          <IconBtn name="x" label="关闭" size={18} onClick={onClose} />
        </div>
        <div className="dialog-body">{children}</div>
        {actions && <div className="dialog-actions">{actions}</div>}
      </div>
    </div>
  );
}

let confirmSeq = 0;
export function confirmDialog(opts: { title?: string; message: string; okText?: string; danger?: boolean }): Promise<boolean> {
  return new Promise(resolve => {
    const id = ++confirmSeq;
    (window as any).__zzwConfirm = { id, resolve };
    document.dispatchEvent(new CustomEvent('zzw:confirm', { detail: opts }));
  });
}
export function ConfirmHost() {
  const [opts, setOpts] = useState<any>(null);
  useEffect(() => {
    const h = (e: any) => setOpts(e.detail);
    document.addEventListener('zzw:confirm', h);
    return () => document.removeEventListener('zzw:confirm', h);
  }, []);
  const done = (v: boolean) => { (window as any).__zzwConfirm?.resolve(v); setOpts(null); };
  return (
    <Dialog
      open={!!opts}
      onClose={() => done(false)}
      title={opts?.title || '确认操作'}
      actions={
        <>
          <Btn variant="text" onClick={() => done(false)}>取消</Btn>
          <Btn variant={opts?.danger ? 'filled' : 'tonal-primary'} onClick={() => done(true)} style={opts?.danger ? { background: 'var(--md-error-container)', color: 'var(--md-on-error-container)' } : undefined}>
            {opts?.okText || '确认'}
          </Btn>
        </>
      }
    >
      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{opts?.message}</div>
    </Dialog>
  );
}

/* ---------- Menu (popover) ---------- */
export interface MenuItem { label: string; icon?: string; danger?: boolean; onClick?: () => void; sep?: boolean }
export function Menu({ trigger, items, align = 'right', width }: { trigger: React.ReactNode; items: (MenuItem | 'sep')[]; align?: 'left' | 'right'; width?: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [open]);
  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={ref}>
      <span onClick={e => { e.stopPropagation(); setOpen(!open); }}>{trigger}</span>
      {open && (
        <div className="menu" style={{ [align]: 0, top: 'calc(100% + 6px)', minWidth: width ? undefined : 200 }} onClick={e => e.stopPropagation()}>
          {items.map((it, i) =>
            it === 'sep' ? (
              <div key={i} className="menu-sep" />
            ) : (
              <button key={i} className={`menu-item ${it.danger ? 'menu-item--danger' : ''}`} onClick={() => { setOpen(false); it.onClick?.(); }} disabled={!it.onClick}>
                {it.icon && <I name={it.icon} size={18} />}
                <span>{it.label}</span>
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Field ---------- */
export function Field({ label, hint, error, children }: { label?: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      <div className="control">{children}</div>
      {error ? <span className="err">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

/* ---------- Feedback ---------- */
export function Spinner({ size = 22, className = '' }: { size?: number; className?: string }) {
  return <span className={`spinner ${size >= 30 ? 'spinner--lg' : ''} ${className}`} style={{ width: size, height: size }} />;
}
export function Loading({ text }: { text?: string }) {
  return (
    <div className="loading-center col" style={{ gap: 12 }}>
      <Spinner size={34} />
      {text && <span className="muted small">{text}</span>}
    </div>
  );
}
export function Empty({ icon = 'inbox', title, desc }: { icon?: string; title: string; desc?: string }) {
  return (
    <div className="empty">
      <div className="empty-icon"><I name={icon} size={26} /></div>
      <div style={{ font: 'var(--text-title-md)' }}>{title}</div>
      {desc && <div className="small muted">{desc}</div>}
    </div>
  );
}
export function Progress({ value, indeterminate }: { value?: number; indeterminate?: boolean }) {
  return <div className={`progress ${indeterminate ? 'progress--indeterminate' : ''}`}><i style={{ width: `${Math.min(100, Math.max(0, value ?? 0))}%` }} /></div>;
}
export function Skeleton({ w, h, r = 10, style }: any) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

/* ---------- Toast host ---------- */
export function ToastHost() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="toast-region">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast--${t.type}`} onClick={() => dismiss(t.id)} style={{ pointerEvents: 'auto', cursor: 'pointer' }}>
          <I name={t.type === 'success' ? 'checkCircle' : t.type === 'error' ? 'xCircle' : 'info'} size={18} style={{ color: t.type === 'success' ? 'var(--md-success)' : t.type === 'error' ? 'var(--md-error)' : 'var(--md-primary)' }} />
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Tabs ---------- */
export function Tabs({ tabs, value, onChange }: { tabs: { key: string; label: string; icon?: string; count?: number }[]; value: string; onChange: (k: string) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(t => (
        <button key={t.key} role="tab" aria-selected={t.key === value} className={`tab ${t.key === value ? 'active' : ''}`} onClick={() => onChange(t.key)}>
          {t.icon && <I name={t.icon} size={17} />}
          {t.label}
          {t.count !== undefined && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------- Infinite scroll hook ---------- */
export function useInfinite(onLoad: () => Promise<boolean> | boolean, deps: any[] = []) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const lock = useRef(false);
  const loadRef = useRef(onLoad);
  loadRef.current = onLoad;

  useLayoutEffect(() => { setDone(false); }, deps); // eslint-disable-line

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(async es => {
      if (!es[0].isIntersecting || lock.current || done) return;
      lock.current = true;
      setLoading(true);
      try {
        const more = await loadRef.current();
        if (!more) setDone(true);
      } finally {
        lock.current = false;
        setLoading(false);
      }
    }, { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [done]);

  return { loading, done, sentinelEl: <div ref={sentinel} style={{ height: 8 }} /> };
}
