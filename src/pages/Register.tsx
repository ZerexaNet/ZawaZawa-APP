import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth, users } from '../lib/api';
import { CaptchaBox, type CaptchaTokens } from '../components/Captcha';
import { Btn, Field, Spinner } from '../components/ui';
import { I } from '../components/icons';
import { useAuth } from '../store/auth';
import { useToast, errMsg } from '../store/toast';

export default function Register() {
  const nav = useNavigate();
  const login = useAuth(s => s.login);
  const toast = useToast(s => s.push);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [tokens, setTokens] = useState<CaptchaTokens | null>(null);
  const [captchaReady, setCaptchaReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [avail, setAvail] = useState<any>(null);
  const [verifying, setVerifying] = useState<null | { identifier: string; email: string; masked?: string }>(null);
  const [code, setCode] = useState('');
  const [resendCd, setResendCd] = useState(0);

  useEffect(() => {
    if (!resendCd) return;
    const t = setInterval(() => setResendCd(x => x - 1), 1000);
    return () => clearInterval(t);
  }, [resendCd > 0]); // eslint-disable-line

  const onTokens = useCallback((t: CaptchaTokens | null, ready: boolean) => { setTokens(t); setCaptchaReady(ready); }, []);

  useEffect(() => {
    if (!/^[a-z0-9_\-]{2,24}$/i.test(username)) { setAvail(null); return; }
    const t = setTimeout(async () => {
      try { setAvail(await users.checkUsername(username, undefined, true)); } catch { setAvail(null); }
    }, 400);
    return () => clearTimeout(t);
  }, [username]);

  const sendCode = async () => {
    if (!verifying || resendCd > 0) return;
    try {
      await auth.verifyEmail(verifying.identifier, verifying.email, '', { captchaToken: tokens?.turnstile });
      setResendCd(60);
      toast('验证码已发送至邮箱', 'success');
    } catch (e: any) {
      toast(errMsg(e, '验证码发送失败'), 'error');
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaReady) { setErr('请先完成人机验证'); return; }
    if (!/^[a-z0-9_\-]{2,24}$/i.test(username)) { setErr('用户名需为 2-24 位字母、数字、下划线'); return; }
    if (!avail || !avail.available) { setErr('用户名不可用'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setErr('请输入有效邮箱'); return; }
    if (password.length < 8) { setErr('密码至少 8 位'); return; }
    if (password !== confirm) { setErr('两次输入的密码不一致'); return; }
    setBusy(true);
    setErr('');
    try {
      const r: any = await auth.register({ username, email, password, geetest: tokens?.geetest }, { captchaToken: tokens?.turnstile });
      if (r?.requires_email_verification) {
        setVerifying({ identifier: username, email, masked: r?.masked_email });
        toast('注册成功，请验证邮箱', 'success');
      } else {
        await login(username, password, tokens?.geetest, tokens?.turnstile);
        toast('注册成功，欢迎加入 ZawaZawa！', 'success');
        nav('/');
      }
    } catch (e2: any) {
      setErr(errMsg(e2, '注册失败'));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!verifying || code.length < 4) { setErr('请输入验证码'); return; }
    setBusy(true);
    setErr('');
    try {
      await auth.verifyEmail(verifying.identifier, verifying.email, code, { captchaToken: tokens?.turnstile });
      toast('邮箱验证成功', 'success');
      try {
        await login(username, password, tokens?.geetest, tokens?.turnstile);
        toast('欢迎加入 ZawaZawa！', 'success');
        nav('/');
      } catch (e3: any) {
        setErr('邮箱已验证，但自动登录失败：' + errMsg(e3) + '，请手动登录');
      }
    } catch (e2: any) {
      setErr(errMsg(e2, '验证失败'));
    } finally {
      setBusy(false);
    }
  };

  if (verifying) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="auth-title">验证邮箱</div>
          <div className="auth-sub">
            验证码已发送至 {verifying.masked || verifying.email}，输入 6 位数字完成验证。
          </div>
          <div className="col" style={{ gap: 14 }}>
            <Field label="邮箱验证码">
              <input
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6 位数字"
                inputMode="numeric"
                autoFocus
                style={{ letterSpacing: 6, textAlign: 'center', fontSize: 20 }}
              />
            </Field>
            {err && <div className="err">{err}</div>}
            <Btn variant="filled" size="lg" onClick={verify} disabled={busy || code.length < 6}>
              {busy ? <Spinner size={18} /> : <I name="mail" size={18} />} 验证
            </Btn>
            <Btn variant="text" onClick={sendCode} disabled={resendCd > 0}>
              {resendCd > 0 ? `重新发送（${resendCd}s）` : '重新发送验证码'}
            </Btn>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-title">注册 ZawaZawa</div>
        <div className="auth-sub">创建账号，开始创作</div>
        <form onSubmit={submit} className="col" style={{ gap: 14 }}>
          <Field
            label="用户名"
            hint={
              username.length === 0 ? '2-24 位字母、数字、下划线（注册仅限英文）'
                : avail ? (avail.available ? '✓ 可用' : `✗ ${avail.reason || '不可用'}`)
                : /^[a-z0-9_\-]{2,24}$/i.test(username) ? '检查中…' : '格式不符'
            }
          >
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="your_name" maxLength={24} autoFocus />
          </Field>
          <Field label="邮箱" hint="用于登录与找回密码">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          </Field>
          <Field label="密码" hint="至少 8 位">
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
          </Field>
          <Field label="确认密码">
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
          </Field>
          <CaptchaBox onTokens={onTokens} />
          {err && <div className="err">{err}</div>}
          <Btn variant="filled" size="lg" type="submit" disabled={busy || !captchaReady}>
            {busy ? <Spinner size={18} /> : <I name="userPlus" size={18} />} {busy ? '注册中…' : '注册'}
          </Btn>
        </form>
        <div className="muted small" style={{ textAlign: 'center' }}>
          已有账号？<Link to="/login" style={{ color: 'var(--md-primary)' }}>去登录</Link>
        </div>
      </div>
    </div>
  );
}
