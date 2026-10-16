import { useCallback, useEffect, useState } from 'react';
import { referendums } from '../lib/api';
import type { Referendum } from '../lib/types';
import { Btn, Dialog, Empty, Field, Loading, Spinner } from '../components/ui';
import { I } from '../components/icons';
import { useToast, errMsg } from '../store/toast';
import { fmtViews } from '../lib/util';

export default function ReferendumsPage() {
  const toast = useToast(s => s.push);
  const [list, setList] = useState<Referendum[]>([]);
  const [loading, setLoading] = useState(true);
  const [openPoll, setOpenPoll] = useState<Referendum | null>(null);
  const [choice, setChoice] = useState('');
  const [textAnswer, setTextAnswer] = useState('');
  const [voting, setVoting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    referendums.active().then((d: any) => {
      setList(Array.isArray(d) ? d : d?.items || []);
    }).catch(() => { }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const vote = async () => {
    if (!openPoll || !choice || voting) return;
    // 文字回答是可选的（allow_text 仅表示“允许”填写，接口 text_answer 可选）
    setVoting(true);
    try {
      await referendums.respond(openPoll.id, { option_id: choice, text_answer: textAnswer.trim() || undefined });
      toast('投票成功，感谢参与', 'success');
      setOpenPoll(null);
      setChoice('');
      setTextAnswer('');
      load();
    } catch (e: any) {
      toast(errMsg(e, '投票失败（可能已投过）'), 'error');
    } finally {
      setVoting(false);
    }
  };

  const openDetail = async (p: Referendum) => {
    setOpenPoll(p);
    try {
      const d: any = await referendums.detail(p.id);
      const full = d?.referendum ?? d;
      if (full) { setOpenPoll(full); if (full.my_response) setChoice(full.my_response); }
    } catch { /* 用列表数据 */ }
  };

  return (
    <div className="page fade-in" style={{ maxWidth: 860 }}>
      <div className="section-head">
        <h1 className="page-title row" style={{ gap: 10 }}>
          <I name="poll" size={26} style={{ color: 'var(--md-primary)' }} /> 社区公投
        </h1>
        <button className="btn btn--tonal btn--sm" onClick={load}><I name="refresh" size={15} /> 刷新</button>
      </div>
      <p className="page-sub">平台重大决策由全体用户投票决定，一人一票。</p>

      {loading ? <Loading /> : list.length === 0 ? (
        <Empty icon="poll" title="暂无进行中的公投" />
      ) : (
        <div className="col" style={{ gap: 14 }}>
          {list.map(p => {
            const totalVotes = p.options?.reduce((s, o) => s + Number(o.vote_count ?? o.count ?? 0), 0) || p.response_count || 0;
            const voted = !!p.my_response;
            return (
              <div key={p.id} className="card" style={{ padding: 18, cursor: 'pointer' }} onClick={() => openDetail(p)}>
                <div className="row row--between" style={{ gap: 10 }}>
                  <h2 style={{ font: 'var(--text-title-md)', flex: 1 }}>{p.title}</h2>
                  {voted ? (
                    <span className="status-tag status-tag--approved"><I name="check" size={13} /> 已投票</span>
                  ) : (
                    <span className="status-tag status-tag--open">进行中</span>
                  )}
                </div>
                {p.description && <p className="muted small" style={{ margin: '8px 0 12px', lineHeight: 1.6 }}>{p.description}</p>}
                {p.options && p.options.length > 0 && (
                  <div className="col" style={{ gap: 8 }}>
                    {p.options.map(o => {
                      const n = Number(o.vote_count ?? o.count ?? 0);
                      const pct = totalVotes ? Math.round((n / totalVotes) * 100) : 0;
                      const mine = p.my_response === o.id || p.my_response === o.label;
                      return (
                        <div key={o.id} className="poll-option" style={{ cursor: 'default' }}>
                          {pct > 0 && <span className="bar" style={{ width: pct + '%' }} />}
                          <I name={mine ? 'checkCircle' : 'dot'} size={16} style={{ color: mine ? 'var(--md-primary)' : 'var(--md-outline)' }} />
                          <span>{o.label}{o.text ? `：${o.text}` : ''}</span>
                          <span className="pct muted">{totalVotes ? `${pct}%` : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="muted small" style={{ marginTop: 12 }}>共 {fmtViews(totalVotes)} 人参与</div>
              </div>
            );
          })}
        </div>
      )}

      {/* 投票详情 */}
      <Dialog
        open={!!openPoll}
        onClose={() => { setOpenPoll(null); setChoice(''); setTextAnswer(''); }}
        title={openPoll?.title || ''}
        actions={openPoll?.my_response ? (
          <Btn variant="text" onClick={() => { setOpenPoll(null); setChoice(''); setTextAnswer(''); }}>关闭</Btn>
        ) : (
          <>
            <Btn variant="text" onClick={() => { setOpenPoll(null); setChoice(''); setTextAnswer(''); }}>取消</Btn>
            <Btn variant="filled" disabled={!choice || voting} onClick={vote}>
              {voting ? <Spinner size={14} /> : <I name="check" size={16} />} 确认投票
            </Btn>
          </>
        )}
      >
        {openPoll && (
          <>
            {openPoll.description && <p className="muted" style={{ lineHeight: 1.6 }}>{openPoll.description}</p>}
            <div className="col" style={{ gap: 10 }}>
              {(openPoll.options || []).map(o => (
                <button
                  key={o.id}
                  type="button"
                  className={`poll-option ${choice === o.id ? 'selected' : ''}`}
                  disabled={!!openPoll.my_response}
                  onClick={() => setChoice(o.id)}
                >
                  <span style={{ display: 'grid', placeItems: 'center', width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--md-outline)', flex: 'none' }}>
                    {choice === o.id && <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--md-primary)' }} />}
                  </span>
                  <span style={{ flex: 1, textAlign: 'left' }}>{o.label}{o.text ? <span className="muted small">（{o.text}）</span> : ''}</span>
                </button>
              ))}
              {openPoll.allow_text && !openPoll.my_response && (
                <Field label="补充文字回答（可选）">
                  <textarea value={textAnswer} onChange={e => setTextAnswer(e.target.value)} maxLength={500} placeholder="写下你的想法…" />
                </Field>
              )}
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}
