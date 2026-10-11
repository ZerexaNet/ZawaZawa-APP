import { useEffect, useRef, useState } from 'react';
import { I } from '../icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import type { Membership, VerificationRequest } from '../types';
import { Empty, Loading } from '../components';
import { errMsg, toast, useAuth } from '../store';
import { fmtDate } from '../lib/utils';

interface Plan { label: string; price: string; id: string; badge?: string }
const PLAN_MONTH: Plan = { label: '月度会员', price: '£1.09 / 月', id: 'month' };
const PLAN_YEAR: Plan = { label: '年度会员', price: '£9.99 / 年', id: 'year', badge: '省 23%' };

export function MembershipPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [info, setInfo] = useState<Membership | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState<'none' | 'confirming' | 'active' | 'cancelled' | 'pending' | 'error'>('none');
  const attempts = useRef(0);

  useEffect(() => { if (!user) { nav('/login'); } }, [user, nav]);
  useEffect(() => {
    if (user) api.membership().then(setInfo).catch((e) => toast(errMsg(e), 'err'));
  }, [user]);

  // Stripe 回跳确认流程：?checkout=success&session_id=...
  useEffect(() => {
    const mode = params.get('checkout');
    if (mode !== 'success') {
      if (mode === 'cancel') setConfirmMsg('cancelled');
      return;
    }
    const sessionId = params.get('session_id') || undefined;
    setConfirmMsg('confirming');
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const r = await api.membershipCheckoutConfirm(sessionId);
        if (stopped) return;
        if ((r as { active?: boolean }).active) {
          clearInterval(timer);
          const fresh = await api.membership();
          setInfo(fresh);
          setConfirmMsg('active');
          toast('粉V 会员已开通');
        } else if (++attempts.current > 6) {
          clearInterval(timer);
          setConfirmMsg('pending');
        }
      } catch {
        if (++attempts.current > 6) { clearInterval(timer); setConfirmMsg('error'); }
      }
    }, 2500);
    // 首次立即尝试
    void (async () => {
      try {
        const r = await api.membershipCheckoutConfirm(sessionId);
        if (!stopped && (r as { active?: boolean }).active) {
          clearInterval(timer);
          const fresh = await api.membership();
          setInfo(fresh);
          setConfirmMsg('active');
          toast('粉V 会员已开通');
        }
      } catch { /* 交给轮询 */ }
    })();
    // 清理 URL 参数
    params.delete('checkout');
    params.delete('session_id');
    setParams(params, { replace: true });
    return () => { stopped = true; clearInterval(timer); };
  }, [params, setParams]);

  if (!user || !info) return <div className="page"><Loading /></div>;

  const active = !!info.active;
  const canceling = !!info.cancel_at_period_end;

  const checkout = async (plan: string, method: string) => {
    setBusy(true);
    try {
      const r = await api.membershipCheckout(plan, method);
      if (r.url) {
        window.location.href = r.url;
        return;
      } else if (r.invoice_url) {
        window.open(r.invoice_url, '_blank');
        toast('已生成账单，请在账单页完成支付后返回本页确认');
      } else {
        toast('订单已创建，完成支付后返回本页');
      }
      setInfo(await api.membership());
    } catch (e) { toast(errMsg(e), 'err'); } finally { setBusy(false); }
  };

  const cancelPending = async () => {
    setBusy(true);
    try {
      await api.membershipCheckoutCancel();
      setInfo(await api.membership());
      setConfirmMsg('none');
      toast('已取消待支付订单');
    } catch (e) { toast(errMsg(e), 'err'); } finally { setBusy(false); }
  };

  const portal = async () => {
    try {
      const r = await api.membershipPortal();
      if (r.url) window.location.href = r.url;
    } catch (e) { toast(errMsg(e), 'err'); }
  };

  const confirmBanners: Record<string, string> = {
    confirming: '⏳ 正在确认付款结果…（如页面跳转自支付平台）',
    active: '付款确认成功，粉V 已生效！',
    pending: '⏳ 付款可能尚未到账，请稍后刷新或联系客服。',
    cancelled: '已取消支付。你可以重新选择支付方式。',
    error: '暂时无法核实付款，请重试或联系客服。',
  };

  return (
    <div className="page" style={{ maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, marginBottom: 6 }}><I name="flower" size={18} /> 会员中心（粉V）</h1>
      <p className="muted" style={{ marginTop: 0 }}>粉V 会员享受 30GB 额外存储空间、上传时长提升至 4 小时、专属粉色认证标识</p>

      {confirmMsg !== 'none' && confirmBanners[confirmMsg] && (
        <div className="notice-banner" style={{ marginBottom: 14, color: confirmMsg === 'error' ? 'var(--err)' : 'var(--ink)' }}>
          {confirmBanners[confirmMsg]}
        </div>
      )}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div className="flex between wrap" style={{ alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>
              {active ? <><I name="check" size={14} /> 粉V 会员生效中</> : '尚未开通粉V'}
            </div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              {active && info.current_period_end ? `有效期至 ${fmtDate(new Date(info.current_period_end * 1000).toISOString())}` : ''}
              {canceling && <span style={{ color: 'var(--warn)' }}> · 到期后不续费</span>}
            </div>
          </div>
          {active && <button className="btn btn-sm" onClick={portal}>管理订阅</button>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14 }}>
        {[PLAN_MONTH, PLAN_YEAR].map((p) => (
          <div key={p.id} className="card" style={{ padding: 20, position: 'relative' }}>
            {p.badge && <span className="tag" style={{ position: 'absolute', top: 12, right: 12, color: 'var(--accent)', borderColor: 'var(--accent)' }}>{p.badge}</span>}
            <div style={{ fontWeight: 800, fontSize: 16 }}>{p.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, margin: '8px 0' }}>{p.price}</div>
            <ul style={{ fontSize: 13, color: 'var(--ink-2)', paddingLeft: 18, margin: '0 0 16px' }}>
              <li>30GB 额外存储</li>
              <li>上传时长上限 4 小时</li>
              <li>粉V 认证标识</li>
              <li>会员专属权益</li>
            </ul>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="btn btn-primary" disabled={busy || active} onClick={() => checkout(p.id, 'card')}>
                <I name="card" size={14} /> 信用卡 / 借记卡
              </button>
              <button className="btn" disabled={busy || active} onClick={() => checkout(p.id, 'alipay')}>
                🀄 支付宝
              </button>
              <button className="btn" disabled={busy || active} onClick={() => checkout(p.id, 'wechat_pay')}>
                <I name="wallet" size={14} /> 微信支付（发票）
              </button>
            </div>
          </div>
        ))}
      </div>
      {info.has_pending_checkout && (
        <div className="notice-banner" style={{ marginTop: 14 }}>
          有一笔待完成的订单（{info.pending_plan === 'year' ? '年度' : '月度'} · {info.pending_payment_method}）。完成支付后返回本页即可自动确认。
          <span style={{ marginLeft: 8 }}>
            <button className="btn btn-sm btn-primary" style={{ marginRight: 6 }} disabled={busy}
              onClick={() => checkout(info.pending_plan || 'month', info.pending_payment_method || 'card')}>继续支付</button>
            <button className="btn btn-sm" disabled={busy} onClick={cancelPending}>取消订单</button>
          </span>
        </div>
      )}
    </div>
  );
}

// ============ 资质认证 ============
export function VerificationPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [status, setStatus] = useState<{ latest_request?: VerificationRequest | null; requests?: VerificationRequest[] } | null>(null);
  const [busy, setBusy] = useState(false);
  // 表单
  const [badgeType, setBadgeType] = useState('blue');
  const [eligibility, setEligibility] = useState('onsite_100k');
  const [orgType, setOrgType] = useState('personal');
  const [orgName, setOrgName] = useState('');
  const [externalPlatform, setExternalPlatform] = useState('');
  const [followerCount, setFollowerCount] = useState('');
  const [reason, setReason] = useState('');
  const [materials, setMaterials] = useState<File[]>([]);
  const [letter, setLetter] = useState<File | null>(null);

  useEffect(() => { if (!user) nav('/login'); }, [user, nav]);
  useEffect(() => {
    if (user) api.verificationStatus().then(setStatus).catch((e) => toast(errMsg(e), 'err'));
  }, [user]);

  if (!user || !status) return <div className="page"><Loading /></div>;

  const latest = status.latest_request || null;
  const canApply = !latest || latest.status === 'rejected';
  const current = (status as { current_badge?: string; current_label?: string });

  const apply = async () => {
    if (!reason.trim()) { toast('请填写申请理由', 'err'); return; }
    setBusy(true);
    try {
      await api.verificationApply(
        {
          badge_type: badgeType,
          eligibility_type: eligibility,
          org_type: orgType,
          org_name: orgName.trim() || undefined,
          external_platform: externalPlatform.trim() || undefined,
          follower_count: followerCount ? Number(followerCount) : undefined,
          reason: reason.trim(),
        },
        materials,
        letter
      );
      toast('认证申请已提交');
      setStatus(await api.verificationStatus());
    } catch (e) { toast(errMsg(e), 'err'); } finally { setBusy(false); }
  };

  return (
    <div className="page" style={{ maxWidth: 680, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, marginBottom: 6 }}><I name="medal" size={18} /> 资质认证</h1>
      <p className="muted">申请蓝V（机构/媒体）或黄V（个人影响力）认证标识，审核通过后展示在你的昵称旁</p>

      {current.current_badge && (
        <div className="card" style={{ padding: 14, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'inline-flex' }}>{current.current_badge === 'pink' ? <I name="flower" size={24} /> : current.current_badge === 'yellow' ? <I name="star" size={24} /> : current.current_badge === 'blue' ? <I name="gem" size={24} /> : <I name="medal" size={24} />}</span>
          <div>
            <div style={{ fontWeight: 700 }}>当前认证：{current.current_label || current.current_badge}</div>
            <div className="muted" style={{ fontSize: 12 }}>badge: {current.current_badge}</div>
          </div>
        </div>
      )}

      {/* 当前状态 */}
      {latest && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div className="flex between">
            <div style={{ fontWeight: 700 }}>
              当前申请：{latest.badge_type === 'yellow' ? '黄V' : '蓝V'}
              {latest.org_name && ` · ${latest.org_name}`}
            </div>
            <span className={'tag'} style={{
              color: latest.status === 'pending' ? 'var(--warn)' : latest.status === 'approved' ? 'var(--ok)' : 'var(--err)',
              borderColor: 'currentColor',
            }}>
              {latest.status === 'pending' ? '审核中' : latest.status === 'approved' ? '已通过' : '已拒绝'}
            </span>
          </div>
          {(latest.admin_note || latest.review_note) && <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>审核意见：{latest.admin_note || latest.review_note}</div>}
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{latest.created_at && timeLabel(latest.created_at)}</div>
        </div>
      )}

      {/* 历史 */}
      {(status.requests || []).length > 1 && (
        <details style={{ marginBottom: 14 }}>
          <summary className="muted" style={{ cursor: 'pointer' }}>历史申请（{(status.requests || []).length - 1}）</summary>
          <div className="card" style={{ padding: 10, marginTop: 8 }}>
            {(status.requests || []).slice(1).map((r) => (
              <div key={r.id} className="row-item" style={{ padding: '6px 0', fontSize: 13 }}>
                <span className="tag">{r.badge_type === 'yellow' ? '黄V' : '蓝V'}</span>
                <span className="grow">{r.org_name || r.reason}</span>
                <span className="muted">{r.status}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {canApply ? (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>提交认证申请</div>
          <div className="field">
            <label>认证类型</label>
            <div className="flex">
              {[['blue', '蓝V · 机构/媒体'], ['yellow', '黄V · 个人影响力']].map(([id, label]) => (
                <button key={id} className={'chip' + (badgeType === id ? ' active' : '')} onClick={() => setBadgeType(id)}>{label}</button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>申请资格</label>
            <select value={eligibility} onChange={(e) => setEligibility(e.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)' }}>
              <option value="onsite_100k">站内粉丝 ≥ 10 万</option>
              <option value="onsite_10k">站内粉丝 ≥ 1 万</option>
              <option value="external">外部平台影响力</option>
              <option value="media">媒体/机构</option>
            </select>
          </div>
          {badgeType === 'blue' && (
            <>
              <div className="field">
                <label>机构类型</label>
                <select value={orgType} onChange={(e) => setOrgType(e.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)' }}>
                  <option value="enterprise">企业</option>
                  <option value="media">媒体</option>
                  <option value="personal">个人工作室</option>
                </select>
              </div>
              <div className="field"><label>机构名称</label><input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="与营业执照一致" /></div>
            </>
          )}
          {eligibility === 'external' && (
            <>
              <div className="field"><label>外部平台</label><input type="text" value={externalPlatform} onChange={(e) => setExternalPlatform(e.target.value)} placeholder="如 B站 / YouTube / 微博" /></div>
              <div className="field"><label>外部粉丝数</label><input type="text" value={followerCount} onChange={(e) => setFollowerCount(e.target.value)} placeholder="如 120000" /></div>
            </>
          )}
          <div className="field"><label>申请理由 *</label><textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="介绍你的影响力、内容方向与认证用途…" maxLength={500} /></div>
          <div className="field">
            <label>证明材料（截图等，可多选）</label>
            <input type="file" multiple accept="image/*,.pdf" onChange={(e) => setMaterials(Array.from(e.target.files || []))} style={{ fontSize: 13 }} />
          </div>
          <div className="field">
            <label>授权书（蓝V 机构认证需上传）</label>
            <input type="file" accept="image/*,.pdf" onChange={(e) => setLetter(e.target.files?.[0] || null)} style={{ fontSize: 13 }} />
          </div>
          <button className="btn btn-primary btn-block" disabled={busy} onClick={apply}>{busy ? '提交中…' : '提交认证申请'}</button>
        </div>
      ) : (
        <div>
          <div className="notice-banner">
            {latest?.status === 'pending' ? '你的认证申请正在审核中，请耐心等待。' : '你已拥有认证标识。'}
          </div>
          {latest?.status === 'pending' && (
            <div className="card" style={{ padding: 16, marginTop: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>修改草稿（审核中可补充材料）</div>
              <div className="field">
                <label>机构/名称</label>
                <input type="text" value={latest.org_name || ''} onChange={(e) => { latest.org_name = e.target.value; }} placeholder="机构名称" style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg)', color: 'var(--ink)' }} />
              </div>
              <div className="field">
                <label>申请理由</label>
                <textarea value={latest.reason || ''} onChange={(e) => { latest.reason = e.target.value; }} style={{ width: '100%', minHeight: 80, border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg)', color: 'var(--ink)', padding: '9px 12px' }} />
              </div>
              <button className="btn btn-primary btn-sm" onClick={async () => {
                try {
                  await api.verificationDraft(latest.id, {
                    badge_type: latest.badge_type || 'blue',
                    org_name: latest.org_name || '',
                    reason: latest.reason || '',
                    eligibility_type: latest.eligibility_type || '',
                  }, []);
                  toast('草稿已更新');
                  setStatus(await api.verificationStatus());
                } catch (e) { toast(errMsg(e), 'err'); }
              }}>保存草稿</button>
            </div>
          )}
        </div>
      )}
      {(status.requests || []).length === 0 && !latest && (
        <div style={{ marginTop: 20 }}><Empty text="你还没有提交过认证申请" icon="medal" /></div>
      )}
    </div>
  );
}

function timeLabel(s: string) {
  const d = new Date(s.replace(' ', 'T') + (s.includes('T') ? '' : 'Z'));
  return isNaN(d.getTime()) ? s : d.toLocaleString('zh-CN');
}
