import { Link } from 'react-router-dom';
import type { Video } from '../lib/types';
import { I } from './icons';
import { VBadge, Avatar } from './ui';
import { fmtViews, fmtDuration, timeAgo } from '../lib/util';

export function VideoCard({ v, horizontal }: { v: Video; horizontal?: boolean }) {
  const dur = v.duration ?? v.duration_sec;
  const durStr = typeof dur === 'number' ? fmtDuration(dur) : (typeof dur === 'string' && dur ? dur : '');
  if (horizontal) {
    return (
      <Link className="history-row" to={`/video/${v.id}`}>
        <div className="thumb-wrap" style={{ width: 168, aspectRatio: '16/9', borderRadius: 10, overflow: 'hidden', position: 'relative', flex: 'none', background: 'var(--md-surface-container)' }}>
          {v.cover_url ? <img className="thumb" src={v.cover_url} loading="lazy" decoding="async" alt="" /> : <div className="thumb-fallback"><I name="film" size={26} /></div>}
          {durStr && <span className="duration">{durStr}</span>}
        </div>
        <div className="h-info col" style={{ gap: 5 }}>
          <span className="clamp2" style={{ font: 'var(--text-body-md)', lineHeight: 1.4 }}>{v.title}</span>
          <span className="row muted small" style={{ gap: 6 }}>
            <Avatar user={{ gravatar_url: v.author_gravatar_url, username: v.author_username }} size={18} />
            <span className="clamp1" style={{ maxWidth: 140 }}>{v.author_username}</span>
            <VBadge badge={v.author_verification_badge} label={v.author_verification_label} size={13} />
            <span>· {fmtViews(v.views)} 播放</span>
          </span>
        </div>
      </Link>
    );
  }
  return (
    <Link className="card card--hover video-card feed-item" to={`/video/${v.id}`}>
      <div className="thumb-wrap">
        {v.cover_url ? (
          <img className="thumb" src={v.cover_url} loading="lazy" decoding="async" alt="" />
        ) : (
          <div className="thumb-fallback"><I name="film" size={30} /></div>
        )}
        {v.status === 'pending_review' && <span className="live-tag">审核中</span>}
        {durStr && <span className="duration">{durStr}</span>}
      </div>
      <div className="meta">
        <div className="vtitle clamp2">{v.title}</div>
        <div className="vauthor">
          <Avatar user={{ gravatar_url: v.author_gravatar_url, username: v.author_username }} size={24} />
          <span className="uname clamp1">{v.author_username}</span>
          <VBadge badge={v.author_verification_badge} label={v.author_verification_label} size={14} />
        </div>
        <div className="vstats">
          <I name="eye" size={14} /> {fmtViews(v.views)}
          <span className="dot">·</span>
          <I name="message" size={13} /> {fmtViews(v.comment_count)}
          <span className="dot hide-sm">·</span>
          <span className="hide-sm">{timeAgo(v.created_at)}</span>
        </div>
      </div>
    </Link>
  );
}
