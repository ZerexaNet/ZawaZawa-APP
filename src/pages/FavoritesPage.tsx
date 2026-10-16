import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { users } from '../lib/api';
import type { FavoriteEntry } from '../lib/types';
import { VideoCard } from '../components/VideoCard';
import { Btn, Empty, Loading } from '../components/ui';
import { I } from '../components/icons';
import { useAuth } from '../store/auth';
import { asList, asTotal } from '../lib/http';
import { timeAgo } from '../lib/util';

export default function FavoritesPage() {
  const nav = useNavigate();
  const user = useAuth(s => s.user);
  const [list, setList] = useState<FavoriteEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 24;

  useEffect(() => { if (!user) nav('/login'); }, [user, nav]);

  const load = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const d: any = await users.meFavorites(limit, reset ? 0 : list.length);
      const items = asList<FavoriteEntry>(d);
      setTotal(asTotal(d, items.length));
      setList(prev => reset ? items : [...prev, ...items.filter(x => !prev.some(p => p.id === x.id))]);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [list.length]);

  useEffect(() => { if (user) load(true); }, [user]); // eslint-disable-line

  return (
    <div className="page fade-in">
      <div className="section-head">
        <h1 className="page-title row" style={{ gap: 8 }}><I name="bookmark" size={24} /> 我的收藏</h1>
        {list.length > 0 && <span className="muted small">{total} 个视频</span>}
      </div>
      {loading ? <Loading /> : list.length === 0 ? (
        <Empty icon="bookmark" title="还没有收藏" desc="在视频页点击收藏按钮即可加入" />
      ) : (
        <>
          <div className="video-grid">{list.map(v => <VideoCard key={v.id} v={v} />)}</div>
          {list.length < total && (
            <div className="center">
              <Btn variant="tonal" size="sm" onClick={() => load()}>加载更多</Btn>
            </div>
          )}
        </>
      )}
      {list[0]?.favorited_at && <div className="muted small" style={{ textAlign: 'center' }}>最近收藏：{timeAgo(list[0].favorited_at)}</div>}
    </div>
  );
}
