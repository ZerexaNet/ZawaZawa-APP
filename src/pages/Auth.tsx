import { useEffect, useState } from 'react';
import { I } from '../icons';
import { Link, useNavigate } from 'react-router-dom';
import { api, setToken } from '../api';
import { CaptchaBox, type CaptchaResult } from '../captcha';
import { errMsg, toast, useAuth } from '../store';
import { api as apiRef } from '../api';

function AuthShell({ title, children, footer }: { title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="page" style={{ maxWidth: 420, margin: '0 auto', paddingTop: 30 }}>
      <h1 style={{ fontSize: 24, textAlign: 'center', marginBottom: 20 }}>{title}</h1>
      <div className="card" style={{ padding: 22 }}>{children}</div>
      {footer && <div style={{ textAlign: 'center', marginTop: 16, fontSize: 14, color: 'var(--ink-3)' }}>{footer}</div>}
    </div>
  );
}

export function LoginPage() {
  const nav = useNavigate();
  const { setUser, authMsg, clearAuthMsg } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [cap, setCap] = useState<CaptchaResult | null>(null);
  const [capKey, setCapKey] = useState(0);

  useEffect(() => { if (authMsg) clearAuthMsg(); }, [authMsg, clearAuthMsg]);

  const doLogin = async (r: CaptchaResult) => {
    if (!identifier.trim() || !password) return;
    setBusy(true);
    try {
      const res = await api.login(identifier.trim(), password, r.geetest);
      setToken(res.token);
      setUser(res.user);
      toast('欢迎回来，' + res.user.username);
      nav('/');
    } catch (e) {
      toast(errMsg(e), 'err');
      setCap(null); setCapKey((k) => k + 1); // 允许重新验证
    } finally { setBusy(false); }
  };

  return (
    <AuthShell title="登录 ZawaZawa" footer={<span>还没有账号？<Link to="/register" style={{ color: 'var(--accent-2)' }}>立即注册</Link> · <Link to="/forgot" style={{ color: 'var(--ink-3)' }}>忘记密码</Link></span>}>
      {authMsg && <div className="notice-banner" style={{ color: 'var(--err)', borderColor: 'var(--err)' }}>{authMsg}</div>}
      <div className="field">
        <label>用户名 / 邮箱</label>
        <input type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="用户名或邮箱" autoFocus />
      </div>
      <div className="field">
        <label>密码</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="密码" onKeyDown={(e) => e.key === 'Enter' && cap && doLogin(cap)} />
      </div>
      <CaptchaBox key={capKey} onVerified={(r) => setCap(r)} />
      <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} disabled={busy || !cap || !identifier.trim() || !password} onClick={() => cap && doLogin(cap)}>
        {busy ? '登录中…' : '登录'}
      </button>
      {!cap && !busy && <div className="muted" style={{ textAlign: 'center', marginTop: 10, fontSize: 12 }}>完成上方人机验证后即可登录</div>}
    </AuthShell>
  );
}

export function RegisterPage() {
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [checking, setChecking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cap, setCap] = useState<CaptchaResult | null>(null);
  const [capKey, setCapKey] = useState(0);
  const [needVerify, setNeedVerify] = useState<string | null>(null);
  const [code, setCode] = useState('');

  const doVerifyEmail = async (_r: CaptchaResult) => {
    if (!needVerify) return;
    setBusy(true);
    try {
      await api.verifyEmail(needVerify, email.trim(), code.trim());
      toast('验证成功，请登录');
      nav('/login');
    } catch (e) { toast(errMsg(e), 'err'); setCap(null); setCapKey((k) => k + 1); } finally { setBusy(false); }
  };

  const checkName = async () => {
    const u = username.trim();
    if (!u) return;
    setChecking('…');
    try {
      const r = await apiRef.usernameAvailable(u, undefined, true);
      setChecking(r.available ? 'ok' : (r.reason || '不可用'));
    } catch { setChecking(null); }
  };

  const doRegister = async (r: CaptchaResult) => {
    const u = username.trim();
    if (!u || !email.trim() || !password) return;
    if (password.length < 8) { toast('密码至少 8 位', 'err'); return; }
    if (password !== password2) { toast('两次密码不一致', 'err'); return; }
    if (!/^[A-Za-z0-9_\-]+$/.test(u)) { toast('用户名仅限字母、数字、下划线、连字符', 'err'); return; }
    if (u.length < 2 || u.length > 24) { toast('用户名长度 2-24 位', 'err'); return; }
    setBusy(true);
    try {
      const res = await api.register(u, email.trim(), password, r.geetest);
      if (res.requires_email_verification) {
        setNeedVerify(u);
        toast('注册成功，请完成邮箱验证');
      } else {
        toast('注册成功，请登录');
        nav('/login');
      }
    } catch (e) {
      toast(errMsg(e), 'err');
      setCap(null); setCapKey((k) => k + 1);
    } finally { setBusy(false); }
  };

  if (needVerify) {
    return (
      <AuthShell title="邮箱验证" footer={<span>验证码已发送至 {email}</span>}>
        <div className="field">
          <label>邮箱验证码</label>
          <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="6 位验证码" maxLength={8} autoFocus />
        </div>
          <CaptchaBox key={capKey} onVerified={(r) => setCap(r)} />
          <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} disabled={busy || !cap || !code.trim()} onClick={() => cap && doVerifyEmail(cap)}>
            {busy ? '验证中…' : '验证邮箱'}
          </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="注册 ZawaZawa" footer={<span>已有账号？<Link to="/login" style={{ color: 'var(--accent-2)' }}>去登录</Link></span>}>
      <div className="field">
        <label>用户名 <span className="muted">（2-24 位，仅字母/数字/_/-）</span></label>
        <input type="text" value={username} onChange={(e) => { setUsername(e.target.value); setChecking(null); }} onBlur={checkName} placeholder="起个独特的名字" />
        {checking && <div className={'hint'}>{checking === 'ok' ? <span className="flex" style={{ gap: 4 }}><I name="check" size={13} /> 用户名可用</span> : <span className="flex" style={{ gap: 4 }}><I name="x" size={13} /> {checking}</span>}</div>}
      </div>
      <div className="field">
        <label>邮箱</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="用于接收验证码" />
      </div>
      <div className="field">
        <label>密码 <span className="muted">（至少 8 位）</span></label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className="field">
        <label>确认密码</label>
        <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && cap && doRegister(cap)} />
      </div>
      <CaptchaBox key={capKey} onVerified={(r) => setCap(r)} />
      <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} disabled={busy || !cap || !username.trim() || !email.trim() || !password} onClick={() => cap && doRegister(cap)}>
        {busy ? '提交中…' : '注册'}
      </button>
      {!cap && !busy && <div className="muted" style={{ textAlign: 'center', marginTop: 10, fontSize: 12 }}>完成上方人机验证后即可注册</div>}
    </AuthShell>
  );
}

export function ForgotPage() {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'send' | 'reset'>('send');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [cap, setCap] = useState<CaptchaResult | null>(null);
  const [capKey, setCapKey] = useState(0);

  const send = async () => {
    if (!email.trim()) return;
    setBusy(true);
    try {
      await api.forgotSendCode(email.trim());
      toast('验证码已发送');
      setStep('reset');
    } catch (e) { toast(errMsg(e), 'err'); } finally { setBusy(false); }
  };
  const reset = async (_cap: CaptchaResult) => {
    setBusy(true);
    try {
      await api.forgotReset(email.trim(), code.trim(), password);
      toast('密码已重置，请登录');
      location.href = '/login';
    } catch (e) { toast(errMsg(e), 'err'); setCap(null); setCapKey((k) => k + 1); } finally { setBusy(false); }
  };

  return (
    <AuthShell title="找回密码" footer={<Link to="/login" style={{ color: 'var(--ink-3)' }}><I name="arrowLeft" size={13} /> 返回登录</Link>}>
      <div className="field">
        <label>注册邮箱</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" />
      </div>
      {step === 'send' ? (
        <button className="btn btn-primary btn-block" disabled={busy || !email.trim()} onClick={send}>发送验证码</button>
      ) : (
        <>
          <div className="field">
            <label>邮箱验证码</label>
            <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="6 位验证码" />
          </div>
          <div className="field">
            <label>新密码</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
            <CaptchaBox key={capKey} onVerified={(r) => setCap(r)} />
            <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} disabled={busy || !cap || !code.trim() || !password} onClick={() => cap && reset(cap)}>
              {busy ? '重置中…' : '重置密码'}
            </button>
            {!cap && !busy && <div className="muted" style={{ textAlign: 'center', marginTop: 10, fontSize: 12 }}>完成上方人机验证后即可重置</div>}
        </>
      )}
    </AuthShell>
  );
}

export function DeactivatePage() {
  const nav = useNavigate();
  const { logout } = useAuth();
  const [step, setStep] = useState<'confirm' | 'code'>('confirm');
  const [checked, setChecked] = useState(false);
  const [text, setText] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [cap, setCap] = useState<CaptchaResult | null>(null);
  const [capKey, setCapKey] = useState(0);

  const doDeactivate = async () => {
    setBusy(true);
    try {
      const r = await api.deactivate(true, text);
      if (r.requires_email_verification) {
        setMaskedEmail(r.masked_email || '');
        setStep('code');
      } else {
        await logout(true);
        nav('/');
      }
    } catch (e) { toast(errMsg(e), 'err'); } finally { setBusy(false); }
  };

  const doConfirm = async (_cap: CaptchaResult) => {
    setBusy(true);
    try {
      await api.deactivateConfirm(code.trim());
      await logout(true);
      toast('账号已注销');
      nav('/');
    } catch (e) { toast(errMsg(e), 'err'); setCap(null); setCapKey((k) => k + 1); } finally { setBusy(false); }
  };

  return (
    <AuthShell title="注销账号" footer={<Link to="/me" style={{ color: 'var(--ink-3)' }}><I name="arrowLeft" size={13} /> 返回个人中心</Link>}>
      <div className="notice-banner" style={{ color: 'var(--err)' }}><I name="alert" size={15} style={{ verticalAlign: '-3px' }} /> 注销后你的账号、视频、评论、动态、收藏等所有数据将被永久删除，无法恢复。请谨慎操作。</div>
      {step === 'confirm' ? (
        <>
          <div className="field">
            <label>输入 "DEACTIVATE" 确认</label>
            <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="DEACTIVATE" />
          </div>
          <label className="flex" style={{ gap: 8, fontSize: 14, marginBottom: 14 }}>
            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
            我理解并同意注销后果
          </label>
          <button className="btn btn-danger btn-block" disabled={!checked || text !== 'DEACTIVATE' || busy} onClick={doDeactivate}>
            {busy ? '处理中…' : '注销我的账号'}
          </button>
        </>
      ) : (
        <>
          <div className="muted" style={{ marginBottom: 12 }}>验证码已发送至 {maskedEmail}</div>
          <div className="field">
            <label>邮箱验证码</label>
            <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="6 位验证码" autoFocus />
          </div>
            <CaptchaBox key={capKey} onVerified={(r) => setCap(r)} />
            <button className="btn btn-danger btn-block" style={{ marginTop: 12 }} disabled={busy || !cap || !code.trim()} onClick={() => cap && doConfirm(cap)}>
              {busy ? '处理中…' : '确认注销'}
            </button>
            {!cap && !busy && <div className="muted" style={{ textAlign: 'center', marginTop: 10, fontSize: 12 }}>完成上方人机验证后即可注销</div>}
        </>
      )}
    </AuthShell>
  );
}
