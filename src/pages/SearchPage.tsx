import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { videos } from '../lib/api';
import type { User, Video } from '../lib/types';
import { VideoCard } from '../components/VideoCard';
import { Avatar, VBadge, Empty } from '../components/ui';
import { I } from '../components/icons';
import { fmtNum } from '../lib/util';

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const [input, setInput] = useState(q);
  const [tab, setTab] = useState('all');
  const [vids, setVids] = useState<Video[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => { setInput(q); }, [q]);

  const load = useCallback(async () => {
    if (!q) { setVids([]); setUsers([]); setDone(true); return; }
    setLoading(true);
    setDone(false);
    try {
      const d: any = await videos.search(q, 40);
      setVids(d?.videos || []);
      setUsers(d?.users || []);
    } catch {
      setVids([]); setUsers([]);
    } finally {
      setLoading(false);
      setDone(true);
    }
  }, [q]);

  useEffect(() => { load(); }, [load]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = input.trim();
    if (v) setParams({ q: v });
  };

  return (
    <div className="page fade-in">
      <form className="row" style={{ gap: 10, maxWidth: 640 }} onSubmit={submit}>
        <div style={{ position: 'relative', flex: 1 }}>
          <I name="search" size={18} className="search-icon" style={{ position: 'absolute', left: 14, top: '50%', translate: '0 -50%', color: 'var(--md-on-surface-variant)' }} />
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="搜索视频、用户…"
            autoFocus
            style={{
              width: '100%', height: 46, borderRadius: 999,
              border: '1px solid var(--md-outline-variant)', background: 'var(--glass-1)',
              padding: '0 18px 0 42px', color: 'var(--md-on-surface)',
            }}
          />
        </div>
        <button className="btn btn--filled" type="submit">搜索</button>
      </form>

      {q && (
        <>
          <div className="seg">
            {[{ v: 'all', l: '全部' }, { v: 'videos', l: `视频 ${vids.length}` }, { v: 'users', l: `用户 ${users.length}` }].map(o => (
              <button key={o.v} className={tab === o.v ? 'active' : ''} onClick={() => setTab(o.v)} type="button">{o.l}</button>
            ))}
          </div>

          {loading ? <div className="loading-center"><span className="spinner spinner--lg" /></div> : done && vids.length === 0 && users.length === 0 ? (
            <Empty icon="search" title={`没有找到与「${q}」相关的内容`} />
          ) : (
            <>
              {(tab === 'all' || tab === 'videos') && vids.length > 0 && (
                <div className="video-grid">{vids.map(v => <VideoCard key={v.id} v={v} />)}</div>
              )}
              {(tab === 'all' || tab === 'users') && users.length > 0 && (
                <div className="col" style={{ gap: 8, marginTop: 4 }}>
                  <h2 style={{ font: 'var(--text-title-md)' }}>用户</h2>
                  {users.map(u => (
                    <a key={u.id} href={`/user/${u.id}`} className="card card--hover list-item" style={{ textDecoration: 'none' }}>
                      <Avatar user={u} size={42} />
                      <div className="li-main" style={{ flex: 1, minWidth: 0 }}>
                        <div className="row" style={{ gap: 6 }}>
                          <span className="li-title">{u.username}</span>
                          <VBadge badge={u.verification_badge} label={u.verification_label} size={15} />
                        </div>
                        <div className="li-sub">{fmtNum(u.follower_count)} 粉丝 · {fmtNum(u.video_count)} 视频</div>
                      </div>
                      <I name="chevronR" size={18} className="muted" />
                    </a>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
