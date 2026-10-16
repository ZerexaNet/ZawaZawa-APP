import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../lib/api';
import { Btn, Field, Spinner } from '../components/ui';
import { I } from '../components/icons';
import { useAuth } from '../store/auth';
import { useToast, errMsg } from '../store/toast';
import { fmtDate } from '../lib/util';

export default function Deactivate() {
  const nav = useNavigate();
  const logout = useAuth(s => s.logout);
  const toast = useToast(s => s.push);
  const [confirmed, setConfirmed] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [needsCode, setNeedsCode] = useState(false);
  const [masked, setMasked] = useState('');
  const [expiresAt, setExpiresAt] = useState<number | undefined>();
  const [code, setCode] = useState('');

  useEffect(() => {
    if (!confirmed) setText('');
  }, [confirmed]);

  const submit = async () => {
    if (!confirmed || text !== '删除我的账号') { setErr('请勾选复选框并输入「删除我的账号」'); return; }
    setBusy(true); setErr('');
    try {
      const r: any = await auth.deactivate(true, text);
      if (r?.requires_email_verification) {
        setNeedsCode(true);
        setMasked(r?.masked_email || '');
        setExpiresAt(r?.expires_at);
        toast('请输入邮箱验证码以确认注销', 'info');
        return;
      }
      await logout();
      toast('账号已注销', 'success');
      nav('/');
    } catch (e: any) { setErr(errMsg(e, '注销失败')); }
    finally { setBusy(false); }
  };

  const confirmCode = async () => {
    if (code.length < 4) { setErr('请输入验证码'); return; }
    setBusy(true); setErr('');
    try {
      await auth.deactivateConfirm(code, {});
      await logout();
      toast('账号已注销', 'success');
      nav('/');
    } catch (e: any) { setErr(errMsg(e, '验证失败')); }
    finally { setBusy(false); }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card" style={{ borderColor: 'color-mix(in srgb, var(--md-error) 40%, transparent)' }}>
        <div className="auth-title" style={{ color: 'var(--md-error)' }}>注销账号</div>
        <div className="auth-sub" style={{ lineHeight: 1.7 }}>
          此操作将 <b>永久删除</b> 你的账号、全部视频、专栏、动态、评论、私信与积分，
          且 <b>无法恢复</b>。确定要继续吗？
        </div>
        {needsCode ? (
          <div className="col" style={{ gap: 14 }}>
            <Field label="邮箱验证码" hint={'验证码已发送至 ' + (masked || '注册邮箱') + (expiresAt ? '，' + fmtDate(String(expiresAt)) + ' 前有效' : '')}>
              <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="6 位数字" style={{ letterSpacing: 5, textAlign: 'center' }} autoFocus />
            </Field>
            {err && <div className="err">{err}</div>}
            <Btn variant="filled" size="lg" onClick={confirmCode} disabled={busy}>
              {busy ? <Spinner size={18} /> : <I name="check" size={18} />} 确认注销
            </Btn>
            <Btn variant="text" onClick={() => nav('/me')}>放弃，返回</Btn>
          </div>
        ) : (
          <div className="col" style={{ gap: 14 }}>
            <label className="row" style={{ gap: 10, cursor: 'pointer', alignItems: 'flex-start' }}>
              <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} style={{ width: 18, height: 18, marginTop: 2, accentColor: 'var(--md-error)' }} />
              <span style={{ fontSize: 13.5, lineHeight: 1.6 }}>我已知晓上述后果，自愿申请注销账号</span>
            </label>
            <Field label="请输入「删除我的账号」以确认">
              <input value={text} onChange={e => setText(e.target.value)} placeholder="删除我的账号" disabled={!confirmed} />
            </Field>
            {err && <div className="err">{err}</div>}
            <Btn variant="danger" size="lg" onClick={submit} disabled={busy}>
              {busy ? <Spinner size={18} /> : <I name="trash" size={18} />} 永久注销账号
            </Btn>
            <Btn variant="text" onClick={() => nav('/me')}>放弃，返回</Btn>
          </div>
        )}
      </div>
    </div>
  );
}
