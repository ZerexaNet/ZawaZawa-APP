import { useCallback, useEffect, useState } from 'react';
import { I } from '../icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { asArray, type User } from '../types';
import { Avatar, Empty, Loading, VerBadge } from '../components';
import { errMsg, toast, useAuth } from '../store';
import { fmtCount } from '../lib/utils';

/** 我的关注 / 粉丝列表（/following-list?type=following|followers） */
export function FollowListPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const type = params.get('type') === 'followers' ? 'followers' : 'following';
  const [list, setList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [followState, setFollowState] = useState<Record<string, boolean>>({});

  useEffect(() => { if (!user) nav('/login'); }, [user, nav]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = type === 'following' ? await api.myFollowing(50, 0) : await api.myFollowers(50, 0);
      const arr = asArray<User>(d);
      setList(arr);
      // 关注状态（关注列表默认 true；粉丝列表逐个查）
      const st: Record<string, boolean> = {};
      if (type === 'followers') {
        await Promise.all(arr.slice(0, 30).map(async (u) => {
          try { st[u.uid] = (await api.followStatus(u.uid)).following; } catch { st[u.uid] = false; }
        }));
      } else {
        arr.forEach((u) => (st[u.uid] = true));
      }
      setFollowState(st);
    } catch (e) { toast(errMsg(e), 'err'); } finally { setLoading(false); }
  }, [type]);

  useEffect(() => { if (user) void load(); }, [user, load]);

  const toggle = async (u: User) => {
    try {
      const r = followState[u.uid] ? await api.unfollow(u.uid) : await api.follow(u.uid);
      setFollowState((p) => ({ ...p, [u.uid]: !!r.following }));
      if (type === 'following' && !r.following) setList((p) => p.filter((x) => x.uid !== u.uid));
    } catch (e) { toast(errMsg(e), 'err'); }
  };

  if (!user) return null;

  return (
    <div className="page" style={{ maxWidth: 720, margin: '0 auto' }}>
      <div className="tabs">
        <button className={type === 'following' ? 'active' : ''} onClick={() => setParams({ type: 'following' })}>我关注的</button>
        <button className={type === 'followers' ? 'active' : ''} onClick={() => setParams({ type: 'followers' })}>我的粉丝</button>
      </div>
      {loading ? <Loading /> : list.length === 0 ? <Empty text={type === 'following' ? '还没有关注任何人' : '还没有粉丝'} icon="users" /> : (
        <div className="card" style={{ padding: 6 }}>
          {list.map((u) => (
            <div key={u.id} className="row-item">
              <Avatar name={u.username} size={42} url={u.gravatar_url} />
              <div className="grow" style={{ minWidth: 0 }}>
                <a href={`/user/${u.uid}`} style={{ fontWeight: 700 }}>{u.username}</a> <VerBadge badge={u.verification_badge} label={u.verification_label} />
                <div className="desc">
                  ID {u.uid} · {fmtCount(u.follower_count)} 粉丝{u.video_count ? ` · ${fmtCount(u.video_count)} 视频` : ''}
                </div>
              </div>
              <button className={'btn btn-sm ' + (followState[u.uid] ? '' : 'btn-primary')} onClick={() => toggle(u)}>
                {followState[u.uid] ? <><I name="check" size={14} /> 已关注</> : <><I name="plus" size={14} /> 关注</>}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
