import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { verifications } from '../lib/api';
import type { VerificationRequest } from '../lib/types';
import { Btn, Field, Loading, Spinner } from '../components/ui';
import { I } from '../components/icons';
import { useAuth } from '../store/auth';
import { useToast, errMsg } from '../store/toast';
import { fmtDate } from '../lib/util';

const BADGES = [
  { id: 'yellow', name: '黄 V', desc: '领域创作者 / 个人身份', color: 'linear-gradient(135deg,#f2c94c,#d99a1b)' },
  { id: 'blue', name: '蓝 V', desc: '企业 / 机构认证', color: 'linear-gradient(135deg,#4f8ef7,#2563c9)' },
];
const ELIGIBILITY = ['领域创作者', '企业机构', '知名人士', '其他'];

export default function VerificationPage() {
  const nav = useNavigate();
  const user = useAuth(s => s.user);
  const toast = useToast(s => s.push);

  const [state, setState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [badge, setBadge] = useState('yellow');
  const [eligibility, setEligibility] = useState(ELIGIBILITY[0]);
  const [orgName, setOrgName] = useState('');
  const [platform, setPlatform] = useState('');
  const [followers, setFollowers] = useState('');
  const [reason, setReason] = useState('');
  const [materials, setMaterials] = useState<File[]>([]);
  const [letter, setLetter] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!user) nav('/login'); }, [user, nav]);

  const load = useCallback(() => {
    setLoading(true);
    verifications.me().then(setState).catch(() => { }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const latest = state?.latest_request as VerificationRequest | undefined;

  const buildForm = () => {
    const fd = new FormData();
    fd.append('badge_type', badge);
    fd.append('eligibility_type', eligibility);
    if (orgName.trim()) fd.append('org_name', orgName.trim());
    if (platform.trim()) fd.append('external_platform', platform.trim());
    if (followers) fd.append('follower_count', followers);
    fd.append('reason', reason.trim());
    materials.forEach(f => fd.append('materials[]', f));
    if (letter) fd.append('certification_letter', letter);
    return fd;
  };

  const submit = async () => {
    if (!reason.trim()) { toast('请填写申请理由', 'info'); return; }
    setBusy(true);
    try {
      const fd = buildForm();
      if (latest?.status === 'rejected') {
        await verifications.updateDraft(latest.id, fd);
      } else {
        await verifications.apply(fd);
      }
      toast('认证申请已提交，请等待审核', 'success');
      load();
    } catch (e: any) { toast(errMsg(e, '提交失败'), 'error'); }
    finally { setBusy(false); }
  };

  if (loading) return <Loading text="加载认证信息…" />;

  const statusInfo: Record<string, [string, string]> = {
    pending: ['status-tag--pending', '审核中'],
    approved: ['status-tag--approved', '已通过'],
    rejected: ['status-tag--rejected', '已拒绝'],
    draft: ['status-tag--draft', '草稿'],
  };

  return (
    <div className="page fade-in" style={{ maxWidth: 780 }}>
      <h1 className="page-title row" style={{ gap: 10 }}>
        <I name="award" size={26} style={{ color: 'var(--md-primary)' }} /> 身份认证
      </h1>

      {/* 当前状态 */}
      <div className="card" style={{ padding: 20 }}>
        <div className="row" style={{ gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="verif-badge-preview" style={{ background: user?.verification_badge === 'blue' ? BADGES[1].color : user?.verification_badge ? BADGES[0].color : 'var(--md-surface-container-high)', color: user?.verification_badge ? '#fff' : 'var(--md-on-surface-variant)' }}>
            {user?.verification_badge ? '✓' : '—'}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ font: 'var(--text-title-md)' }}>{user?.verification_label || (user?.verification_badge ? '已认证' : '未认证')}</div>
            <div className="muted small" style={{ marginTop: 4 }}>认证标识将展示在你的用户名旁</div>
          </div>
          {latest?.status && (
            <span className={`status-tag ${statusInfo[latest.status]?.[0] ?? 'status-tag--draft'}`}>{statusInfo[latest.status]?.[1] || latest.status}</span>
          )}
        </div>
        {latest?.status === 'rejected' && latest.note && (
          <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 12, background: 'color-mix(in srgb, var(--md-error) 10%, transparent)', color: 'var(--md-error)', font: 'var(--text-body-md)' }}>
            上次申请被拒绝：{latest.note}
          </div>
        )}
      </div>

      {/* 申请历史 */}
      {state?.requests?.length > 1 && (
        <div className="section">
          <h2 style={{ font: 'var(--text-title-md)' }}>申请记录</h2>
          <div className="col" style={{ gap: 6 }}>
            {state.requests.slice(0, 5).map((r: VerificationRequest) => (
              <div key={r.id} className="card row" style={{ padding: '10px 14px', gap: 10, alignItems: 'center' }}>
                <span className={`verif-badge-preview`} style={{ width: 28, height: 28, borderRadius: 8, fontSize: 12, background: r.badge_type === 'blue' ? BADGES[1].color : BADGES[0].color }}>✓</span>
                <span style={{ font: 'var(--text-title-sm)', width: 60 }}>{r.badge_type === 'blue' ? '蓝 V' : '黄 V'}</span>
                <span className="muted small flex-1 clamp1">{r.org_name || r.reason}</span>
                <span className={`status-tag ${r.status ? (statusInfo[r.status]?.[0] ?? 'status-tag--draft') : 'status-tag--draft'}`}>{r.status ? (statusInfo[r.status]?.[1] ?? r.status) : ''}</span>
                <span className="muted small">{fmtDate(r.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 申请表单 */}
      <div className="card col" style={{ padding: 20, gap: 14 }}>
        <h2 style={{ font: 'var(--text-title-md)' }}>{latest?.status === 'rejected' ? '重新提交申请' : '认证申请'}</h2>
        <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
          {BADGES.map(b => (
            <label key={b.id} className="card row" style={{ gap: 12, cursor: 'pointer', borderColor: badge === b.id ? 'var(--md-primary)' : undefined }}>
              <input type="radio" name="badge" checked={badge === b.id} onChange={() => setBadge(b.id)} style={{ accentColor: 'var(--md-primary)' }} />
              <span className="verif-badge-preview" style={{ width: 34, height: 34, borderRadius: 10, fontSize: 14, background: b.color }}>✓</span>
              <span><b style={{ display: 'block', font: 'var(--text-title-sm)' }}>{b.name}</b><span className="muted small">{b.desc}</span></span>
            </label>
          ))}
        </div>
        <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <Field label="认证类型"><select value={eligibility} onChange={e => setEligibility(e.target.value)} style={{ minWidth: 140 }}>{ELIGIBILITY.map(x => <option key={x}>{x}</option>)}</select></Field>
          <Field label="机构/平台名称"><input value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="如：某某工作室" style={{ minWidth: 180 }} /></Field>
        </div>
        <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <Field label="外部平台账号（可选）" hint="如 B 站 / 微博 主页链接"><input value={platform} onChange={e => setPlatform(e.target.value)} placeholder="https://…" style={{ minWidth: 220 }} /></Field>
          <Field label="平台粉丝数（可选）"><input value={followers} onChange={e => setFollowers(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="如 50000" style={{ minWidth: 120 }} /></Field>
        </div>
        <Field label="申请理由 *">
          <textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={500} placeholder="请说明你的创作领域、代表作品与申请理由…" style={{ minHeight: 100 }} />
        </Field>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <Btn variant="tonal" size="sm" onClick={() => document.getElementById('v-mat')?.click()}><I name="image" size={15} /> 证明材料 ({materials.length})</Btn>
          <input id="v-mat" type="file" multiple accept="image/*,application/pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files ? [...e.target.files] : []; setMaterials(prev => [...prev, ...f].slice(0, 6)); e.target.value = ''; }} />
          <Btn variant="tonal" size="sm" onClick={() => document.getElementById('v-letter')?.click()}><I name="file" size={15} /> {letter ? letter.name : '授权函（可选）'}</Btn>
          <input id="v-letter" type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={e => { setLetter(e.target.files?.[0] || null); e.target.value = ''; }} />
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Btn variant="filled" onClick={submit} disabled={busy}>
            {busy ? <Spinner size={16} /> : <I name="send" size={16} />} 提交申请
          </Btn>
        </div>
      </div>
    </div>
  );
}
