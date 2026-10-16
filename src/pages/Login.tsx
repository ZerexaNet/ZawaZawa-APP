import { useCallback, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CaptchaBox, type CaptchaTokens } from '../components/Captcha';
import { Btn, Field, Spinner } from '../components/ui';
import { I } from '../components/icons';
import { useAuth } from '../store/auth';
import { useToast, errMsg } from '../store/toast';

export default function Login() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const login = useAuth(s => s.login);
  const toast = useToast(s => s.push);

  const next = params.get('next') || '/';
  const authError = params.get('authError');

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [tokens, setTokens] = useState<CaptchaTokens | null>(null);
  const [captchaReady, setCaptchaReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const onTokens = useCallback((t: CaptchaTokens | null, ready: boolean) => {
    setTokens(t);
    setCaptchaReady(ready);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) { setErr('请输入账号和密码'); return; }
    if (!captchaReady) { setErr('请先完成人机验证'); return; }
    setBusy(true);
    setErr('');
    try {
      await login(identifier.trim(), password, tokens?.geetest, tokens?.turnstile);
      toast('欢迎回来', 'success');
      nav(next.startsWith('/') ? next : '/');
    } catch (e2: any) {
      setErr(errMsg(e2, '登录失败'));
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-title">登录 ZawaZawa</div>
        <div className="auth-sub">欢迎回来，继续你的创作</div>
        {authError && (
          <div className="err" style={{ color: 'var(--md-error)', background: 'color-mix(in srgb, var(--md-error) 10%, transparent)', padding: 10, borderRadius: 10, font: 'var(--text-body-md)' }}>
            {authError}
          </div>
        )}
        <form onSubmit={submit} className="col" style={{ gap: 14 }}>
          <Field label="用户名 / 邮箱 / UID">
            <input value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="你的账号" autoFocus autoComplete="username" />
          </Field>
          <Field label="密码">
            <div style={{ position: 'relative' }}>
              <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
              <button type="button" className="icon-btn icon-btn--sm" style={{ position: 'absolute', right: 4, top: '50%', translate: '0 -50%' }} onClick={() => setShowPw(x => !x)} aria-label="显示密码">
                <I name={showPw ? 'eyeOff' : 'eye'} size={16} />
              </button>
            </div>
          </Field>
          <CaptchaBox onTokens={onTokens} />
          {err && <div className="err">{err}</div>}
          <Btn variant="filled" size="lg" type="submit" disabled={busy || !captchaReady}>
            {busy ? <Spinner size={18} /> : <I name="logout" size={18} style={{ transform: 'rotate(180deg)' }} />}
            {busy ? '登录中…' : '登录'}
          </Btn>
        </form>
        <div className="row row--between muted small" style={{ marginTop: 4 }}>
          <Link to="/forgot">忘记密码？</Link>
          <Link to="/register" style={{ color: 'var(--md-primary)' }}>创建新账号 →</Link>
        </div>
      </div>
    </div>
  );
}
