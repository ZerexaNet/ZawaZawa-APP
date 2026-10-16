import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { membership } from '../lib/api';
import type { Membership } from '../lib/types';
import { Btn, Loading, Spinner } from '../components/ui';
import { I } from '../components/icons';
import { useAuth } from '../store/auth';
import { useToast, errMsg } from '../store/toast';
import { fmtDate } from '../lib/util';

const PLANS = [
  { id: 'month', name: '月付', price: '£1.09', period: '/ 月' },
  { id: 'year', name: '年付', price: '£9.99', period: '/ 年', tag: '省 25%' },
];
const PAYMENTS = [
  { id: 'card', name: '银行卡', desc: 'Stripe 自动续费' },
  { id: 'wechat_pay', name: '微信支付', desc: '生成付款码，手动续费' },
  { id: 'alipay', name: '支付宝', desc: '一次性支付' },
];

export default function MembershipPage() {
  const nav = useNavigate();
  const user = useAuth(s => s.user);
  const toast = useToast(s => s.push);
  const [m, setM] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState('month');
  const [pay, setPay] = useState('card');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!user) nav('/login'); }, [user, nav]);

  const load = useCallback(() => {
    setLoading(true);
    membership.status().then(setM).catch(() => { }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const checkout = async () => {
    setBusy(true);
    try {
      const r: any = await membership.checkout(plan, pay);
      if (r?.url) {
        window.location.href = r.url;
      } else if (r?.qrcode || r?.qr_code || r?.code_url) {
        toast('付款码已生成，请完成支付', 'success');
        load();
      } else {
        toast('已创建订单，请在邮件中查看支付链接', 'success');
        load();
      }
    } catch (e: any) { toast(errMsg(e, '创建订单失败'), 'error'); }
    finally { setBusy(false); }
  };

  const cancel = async () => {
    if (!m?.has_pending_checkout) return;
    setBusy(true);
    try {
      await membership.checkoutCancel(String(m.session_id || m.url || ''));
      toast('已取消待支付订单', 'success');
      load();
    } catch (e: any) { toast(errMsg(e), 'error'); }
    finally { setBusy(false); }
  };

  const confirm = async () => {
    if (!m?.has_pending_checkout) return;
    setBusy(true);
    try {
      await membership.checkoutConfirm(String(m.session_id || m.url || ''));
      toast('已确认支付，会员生效中', 'success');
      load();
    } catch (e: any) { toast(errMsg(e, '确认失败，请检查是否已完成支付'), 'error'); }
    finally { setBusy(false); }
  };

  const portal = async () => {
    try {
      const r: any = await membership.portal();
      if (r?.url) window.location.href = r.url;
      else toast('当前无法打开管理门户', 'error');
    } catch (e: any) { toast(errMsg(e), 'error'); }
  };

  if (loading) return <Loading text="加载会员信息…" />;

  const active = !!m?.active;
  const periodEnd = m?.current_period_end ? fmtDate(String(m.current_period_end)) : '';

  return (
    <div className="page fade-in" style={{ maxWidth: 880 }}>
      <h1 className="page-title row" style={{ gap: 10 }}>
        <I name="crown" size={26} style={{ color: 'var(--md-tertiary)' }} /> 会员中心 · 粉 V
      </h1>

      {active && (
        <div className="card" style={{ padding: 20, borderColor: 'color-mix(in srgb, var(--md-tertiary) 45%, transparent)' }}>
          <div className="row row--between" style={{ flexWrap: 'wrap', gap: 10 }}>
            <div className="row" style={{ gap: 12, alignItems: 'center' }}>
              <span className="vbadge vbadge--pink" style={{ width: 40, height: 40, fontSize: 17, borderRadius: 12 }}>P</span>
              <div>
                <div style={{ font: 'var(--text-title-lg)' }}>粉 V 会员生效中</div>
                <div className="muted small" style={{ marginTop: 3 }}>
                  {m?.plan === 'year' ? '年付' : '月付'} · {m?.payment_method === 'card' ? 'Stripe 自动续费' : m?.payment_method}
                  {periodEnd ? ` · 至 ${periodEnd}` : ''}
                </div>
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <Btn variant="tonal" size="sm" onClick={portal}><I name="settings" size={15} /> 管理订阅</Btn>
            </div>
          </div>
          {m?.cancel_at_period_end && (
            <div className="status-tag status-tag--pending" style={{ marginTop: 12 }}>订阅将于本期结束后取消</div>
          )}
          <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginTop: 16 }}>
            <div className="stat-card"><div className="sv">30GB</div><div className="sl">上传空间</div></div>
            <div className="stat-card"><div className="sv">4 小时</div><div className="sl">单视频时长</div></div>
            <div className="stat-card"><div className="sv">粉 V 徽章</div><div className="sl">主页展示</div></div>
          </div>
        </div>
      )}

      {m?.has_pending_checkout && (
        <div className="card" style={{ padding: 16, borderColor: 'color-mix(in srgb, var(--md-warning) 50%, transparent)' }}>
          <div className="row row--between" style={{ flexWrap: 'wrap', gap: 10 }}>
            <span className="row" style={{ gap: 8 }}><I name="clock" size={18} className="muted" /> 有未完成支付的订单（{m?.pending_plan} / {m?.pending_payment_method}）</span>
            <div className="row" style={{ gap: 8 }}>
              <Btn variant="filled" size="sm" onClick={confirm} disabled={busy}>{busy ? <Spinner size={14} /> : <I name="check" size={14} />} 确认已支付</Btn>
              <Btn variant="text" size="sm" onClick={cancel}>取消订单</Btn>
            </div>
          </div>
        </div>
      )}

      {!active && (
        <div className="col" style={{ gap: 16 }}>
          <p className="page-sub">升级粉 V，获得更大的创作空间与专属标识。</p>
          <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            {PLANS.map(p => (
              <div key={p.id} className={`card ${plan === p.id ? '' : 'card--static'}`}
                style={{ padding: 22, cursor: 'pointer', borderColor: plan === p.id ? 'var(--md-tertiary)' : undefined, position: 'relative' }}
                onClick={() => setPlan(p.id)}>
                {p.tag && <span className="live-tag" style={{ position: 'absolute', right: 12, top: 12, background: 'var(--md-tertiary-container)', color: 'var(--md-on-tertiary-container)' }}>{p.tag}</span>}
                <div style={{ font: 'var(--text-title-md)', marginBottom: 8 }}>{p.name}</div>
                <div><span style={{ font: 'var(--text-display-sm)' }}>{p.price}</span> <span className="muted small">{p.period}</span></div>
                <div className="muted small" style={{ marginTop: 10, lineHeight: 1.8 }}>
                  ✓ 30GB 上传空间<br />✓ 单视频最长 4 小时<br />✓ 主页粉 V 徽章
                </div>
                {plan === p.id && <I name="checkCircle" size={22} style={{ position: 'absolute', right: 14, bottom: 14, color: 'var(--md-tertiary)' }} />}
              </div>
            ))}
          </div>
          <div className="card" style={{ padding: 18 }}>
            <b style={{ font: 'var(--text-title-sm)' }}>支付方式</b>
            <div className="col" style={{ gap: 8, marginTop: 10 }}>
              {PAYMENTS.map(p => (
                <label key={p.id} className="row" style={{ gap: 12, cursor: 'pointer', padding: '10px 12px', borderRadius: 12, border: `1px solid ${pay === p.id ? 'var(--md-tertiary)' : 'var(--md-outline-variant)'}`, background: pay === p.id ? 'color-mix(in srgb, var(--md-tertiary) 8%, transparent)' : 'transparent' }}>
                  <input type="radio" name="pay" checked={pay === p.id} onChange={() => setPay(p.id)} style={{ accentColor: 'var(--md-tertiary)' }} />
                  <span style={{ font: 'var(--text-title-sm)', width: 90 }}>{p.name}</span>
                  <span className="muted small">{p.desc}</span>
                </label>
              ))}
            </div>
          </div>
          <Btn variant="filled" size="lg" onClick={checkout} disabled={busy} style={{ alignSelf: 'flex-start' }}>
            {busy ? <Spinner size={18} /> : <I name="card" size={18} />} 立即开通
          </Btn>
        </div>
      )}
    </div>
  );
}
