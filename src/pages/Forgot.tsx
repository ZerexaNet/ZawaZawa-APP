import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../lib/api';
import { Btn, Field, Spinner } from '../components/ui';
import { I } from '../components/icons';
import { useToast, errMsg } from '../store/toast';

export default function Forgot() {
  const nav = useNavigate();
  const toast = useToast(s => s.push);
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [cd, setCd] = useState(0);

  useEffect(() => {
    if (!cd) return;
    const t = setInterval(() => setCd(x => x - 1), 1000);
    return () => clearInterval(t);
  }, [cd > 0]); // eslint-disable-line

  const sendCode = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setErr('请输入有效邮箱'); return; }
    setBusy(true); setErr('');
    try {
      await auth.forgotSendCode(email);
      setStep(2);
      setCd(60);
      toast('重置验证码已发送', 'success');
    } catch (e: any) { setErr(errMsg(e, '发送失败')); }
    finally { setBusy(false); }
  };

  const reset = async () => {
    if (code.length < 4) { setErr('请输入验证码'); return; }
    if (pw.length < 8) { setErr('新密码至少 8 位'); return; }
    if (pw !== pw2) { setErr('两次输入的密码不一致'); return; }
    setBusy(true); setErr('');
    try {
      await auth.forgotReset({ email, code, password: pw });
      toast('密码重置成功，请重新登录', 'success');
      nav('/login');
    } catch (e: any) { setErr(errMsg(e, '重置失败')); }
    finally { setBusy(false); }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-title">找回密码</div>
        <div className="auth-sub">{step === 1 ? '输入注册邮箱，获取重置验证码' : `验证码已发送至 ${email}，输入验证码并设置新密码`}</div>
        <div className="col" style={{ gap: 14 }}>
          {step === 1 ? (
            <>
              <Field label="注册邮箱">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoFocus />
              </Field>
              {err && <div className="err">{err}</div>}
              <Btn variant="filled" size="lg" onClick={sendCode} disabled={busy}>
                {busy ? <Spinner size={18} /> : <I name="mail" size={18} />} 发送验证码
              </Btn>
            </>
          ) : (
            <>
              <Field label="验证码">
                <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6 位数字" inputMode="numeric" style={{ letterSpacing: 5, textAlign: 'center' }} autoFocus />
              </Field>
              <Field label="新密码" hint="至少 8 位">
                <input type="password" value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" />
              </Field>
              <Field label="确认新密码">
                <input type="password" value={pw2} onChange={e => setPw2(e.target.value)} autoComplete="new-password" />
              </Field>
              {err && <div className="err">{err}</div>}
              <Btn variant="filled" size="lg" onClick={reset} disabled={busy}>
                {busy ? <Spinner size={18} /> : <I name="lock" size={18} />} 重置密码
              </Btn>
              <Btn variant="text" onClick={sendCode} disabled={cd > 0}>
                {cd > 0 ? `重新发送（${cd}s）` : '重新发送验证码'}
              </Btn>
            </>
          )}
          <div style={{ textAlign: 'center' }}>
            <Link to="/login" className="muted small">← 返回登录</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
