import { useCallback, useEffect, useState } from 'react';
import { I } from '../icons';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import type { Referendum, ReferendumOption } from '../types';
import { Empty, Loading } from '../components';
import { errMsg, toast, useAuth } from '../store';
import { fmtCount, timeAgo } from '../lib/utils';

// ============ 积分签到 ============
export function CoinsPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [coins, setCoins] = useState<{ balance: number; checkedIn: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!user) nav('/login'); }, [user, nav]);

  const load = useCallback(() => {
    api.coins().then(setCoins).catch(() => {});
  }, []);
  useEffect(() => { if (user) load(); }, [user, load]);

  const checkin = async () => {
    setBusy(true);
    try {
      const r = await api.checkin();
      toast(`签到成功！获得 ${r.reward ?? '积分'}`);
      load();
    } catch (e) { toast(errMsg(e), 'err'); } finally { setBusy(false); }
  };

  if (!user || !coins) return <div className="page"><Loading /></div>;

  return (
    <div className="page" style={{ maxWidth: 520, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}><I name="coin" size={18} /> 我的积分</h1>
      <div className="card" style={{ padding: 28, textAlign: 'center' }}>
        <div className="muted">当前余额</div>
        <div style={{ fontSize: 44, fontWeight: 800, margin: '6px 0' }}>{fmtCount(coins.balance)}</div>
        <button
          className={'btn ' + (coins.checkedIn ? '' : 'btn-primary')}
          disabled={coins.checkedIn || busy}
          onClick={checkin}
        >
          {coins.checkedIn ? <><I name="check" size={14} /> 今日已签到</> : busy ? '签到中…' : '每日签到 +10'}
        </button>
        {coins.checkedIn && <div className="hint">明天再来签到吧</div>}
      </div>
      <div className="notice-banner" style={{ marginTop: 14 }}>
        积分可用于投币支持创作者，每日签到可获得额外积分奖励。
      </div>
    </div>
  );
}

// ============ 公投 ============
export function ReferendumsPage() {
  const { id } = useParams();
  const [list, setList] = useState<Referendum[]>([]);
  const [single, setSingle] = useState<Referendum | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ReferendumOption | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  const nav = useNavigate();

  const loadList = useCallback(() => {
    api.referendums(20).then((d) => {
      setList(d);
      if (id) setSingle(d.find((r) => r.id === id) || null);
    }).catch((e) => toast(errMsg(e), 'err')).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    setLoading(true);
    if (id) {
      api.referendum(id).then(setSingle).catch((e) => toast(errMsg(e), 'err')).finally(() => setLoading(false));
    } else {
      loadList();
    }
  }, [id, loadList]);

  const vote = async () => {
    if (!user) return nav('/login');
    if (!id) return;
    setBusy(true);
    try {
      await api.referendumRespond(id, selected?.id || '', textAnswer.trim() || undefined);
      toast('投票成功，感谢参与');
      const r = await api.referendum(id);
      setSingle(r);
    } catch (e) { toast(errMsg(e), 'err'); } finally { setBusy(false); }
  };

  if (loading) return <div className="page"><Loading /></div>;

  if (id && single) {
    const myResp = single.my_response;
    const voted = !!(myResp && (myResp.option_id || myResp.text_answer));
    return (
      <div className="page" style={{ maxWidth: 640, margin: '0 auto' }}>
        <Link to="/referendums" className="muted" style={{ fontSize: 13 }}><I name="arrowLeft" size={13} /> 返回公投列表</Link>
        <h1 style={{ fontSize: 21, marginTop: 10 }}>{single.title}</h1>
        {single.description && <p className="muted">{single.description}</p>}
        <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>已有 {fmtCount(single.response_count)} 人参与 · {timeAgo(single.created_at as string)}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {(single.options || []).map((o) => (
            <button
              key={o.id}
              className={'btn btn-block ' + (selected?.id === o.id ? 'btn-primary' : '')}
              style={{ justifyContent: 'space-between' }}
              disabled={voted || myResp?.option_id === o.id}
              onClick={() => setSelected(o)}
            >
              <span>{o.label}</span>
              {myResp?.option_id === o.id && <span><I name="check" size={12} /> 我的选择</span>}
            </button>
          ))}
        </div>
        {single.allow_text && !voted && (
          <div className="field">
            <label>补充意见（可选）</label>
            <textarea value={textAnswer} onChange={(e) => setTextAnswer(e.target.value)} placeholder="说说你的想法…" maxLength={500} />
          </div>
        )}
        {!voted ? (
          <button className="btn btn-primary btn-block" disabled={busy || (!selected && !textAnswer.trim())} onClick={vote}>
            {busy ? '提交中…' : '提交投票'}
          </button>
        ) : (
          <div className="notice-banner">你已投出这一票：{myResp?.option_id ? (single.options || []).find((o) => o.id === myResp.option_id)?.label : ''}{myResp?.text_answer ? ' + ' + myResp.text_answer : ''}</div>
        )}
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, marginBottom: 14 }}><I name="vote" size={18} /> 社区公投</h1>
      {list.length === 0 ? <Empty text="暂无进行中的公投" icon="vote" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map((r) => (
            <Link key={r.id} to={`/referendums/${r.id}`} className="card" style={{ padding: 16, display: 'block' }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{r.title}</div>
              {r.description && <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{r.description}</div>}
              <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                {fmtCount(r.response_count)} 人已参与
                {r.my_response?.option_id || r.my_response?.text_answer ? ' · 已投票' : ''}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
