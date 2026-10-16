// 人机验证组件：与 www.zawa.uk 完全相同的链路
// 1) Geetest v4（float 产品，点击触发浮层，成功后 getValidate()）
// 2) Cloudflare Turnstile（explicit 渲染，onTurnstileGlobal 回调）
// 两者按 /api/auth/captcha-config 的开关启用。
import { useCallback, useEffect, useRef, useState } from 'react';
import { auth } from '../lib/api';
import { I } from './icons';
import type { CaptchaConfig } from '../lib/types';

const TURNSTILE_SITEKEY = '0x4AAAAAAC1MlnIw6vcESt6V';

declare global {
  interface Window {
    initGeetest4?: (opts: any, cb: (gt: any) => void) => void;
    gtInstance?: any;
    turnstile?: any;
    onTurnstileGlobal?: (token: string) => void;
    __zzwTurnstileCb?: (token: string) => void;
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('脚本加载失败：' + src));
    document.head.appendChild(s);
  });
}

export interface CaptchaTokens { geetest: string; turnstile: string }

export function CaptchaBox({
  onTokens,
  disabled,
}: {
  onTokens: (t: CaptchaTokens | null, ready: boolean) => void;
  disabled?: boolean;
}) {
  const [cfg, setCfg] = useState<CaptchaConfig | null>(null);
  const [geetestOk, setGeetestOk] = useState(false);
  const [turnstileOk, setTurnstileOk] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [geetestToken, setGeetestToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const geetestRef = useRef<HTMLDivElement>(null);
  const tsRef = useRef<HTMLDivElement>(null);
  const gtInstance = useRef<any>(null);

  useEffect(() => {
    auth.captchaConfig().then(setCfg).catch(() => setCfg({ geetest_enabled: false, turnstile_enabled: false }));
  }, []);

  // 初始化 Geetest v4 float
  useEffect(() => {
    if (!cfg?.geetest_enabled || !cfg.geetest_captcha_id || !geetestRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        await loadScript('https://static.geetest.com/v4/gt4.js');
        if (cancelled || !window.initGeetest4) return;
        window.initGeetest4(
          {
            captchaId: cfg.geetest_captcha_id,
            product: 'float',
            language: 'zho',
            protocol: window.location.protocol,
            width: '100%',
          },
          (gt: any) => {
            if (cancelled) return;
            gtInstance.current = gt;
            window.gtInstance = gt;
            setErr('');
          }
        );
      } catch (e: any) {
        setErr('验证码加载失败，请刷新重试');
      }
    })();
    return () => { cancelled = true; };
  }, [cfg?.geetest_enabled, cfg?.geetest_captcha_id]);

  // 初始化 Turnstile（turnstileOk 变化时重建：重置后容器是全新节点，需要重新 render）
  useEffect(() => {
    if (!cfg?.turnstile_enabled || !tsRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        await loadScript(`https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`);
        if (cancelled || !window.turnstile || !tsRef.current) return;
        window.__zzwTurnstileCb = (token: string) => {
          if (token) {
            setTurnstileToken(token);
            setTurnstileOk(true);
          }
        };
        (window as any).onTurnstileGlobal = window.__zzwTurnstileCb;
        window.turnstile.render(tsRef.current, {
          sitekey: TURNSTILE_SITEKEY,
          callback: (token: string) => {
            setTurnstileToken(token);
            setTurnstileOk(true);
          },
          'error-callback': () => {
            setTurnstileOk(false);
            setErr('Turnstile 验证失败，请重试');
          },
        });
      } catch (e) {
        setErr('Turnstile 加载失败，请检查网络');
      }
    })();
    return () => { cancelled = true; };
  }, [cfg?.turnstile_enabled, turnstileOk]);

  // 触发 geetest 浮层
  const startGeetest = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setErr('');
    try {
      const gt = gtInstance.current || window.gtInstance;
      if (!gt) throw new Error('验证组件未就绪');
      await gt.execute?.();
      // float 产品：执行后弹层，用户完成后轮询 getValidate
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 500));
        const v = gt.getValidate?.();
        if (v) {
          setGeetestToken(v);
          setGeetestOk(true);
          return;
        }
      }
      setErr('验证超时，请重试');
    } catch (e: any) {
      setErr(e?.message || '验证失败，请重试');
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const reset = useCallback(() => {
    setGeetestOk(false);
    setTurnstileOk(false);
    setGeetestToken('');
    setTurnstileToken('');
    setErr('');
  }, []);

  useEffect(() => {
    const needG = !!cfg?.geetest_enabled;
    const needT = !!cfg?.turnstile_enabled;
    const ready = (!needG || geetestOk) && (!needT || turnstileOk);
    onTokens(
      ready ? { geetest: geetestToken, turnstile: turnstileToken } : null,
      ready
    );
  }, [cfg, geetestOk, turnstileOk, geetestToken, turnstileToken, onTokens]);

  if (!cfg) {
    return (
      <div className="captcha-slot">
        <span className="row muted small"><I name="shield" size={16} /> 正在加载人机验证…</span>
      </div>
    );
  }
  if (!cfg.geetest_enabled && !cfg.turnstile_enabled) {
    // 无需验证
    return null;
  }

  return (
    <div className="col" style={{ gap: 10 }}>
      {cfg.geetest_enabled && (
        <div className={`captcha-slot ${geetestOk ? 'ready' : ''}`} style={{ minHeight: 44 }}>
          {geetestOk ? (
            <span className="row muted small" style={{ color: 'var(--md-success)' }}>
              <I name="checkCircle" size={16} /> 已通过人机验证
              <button className="btn btn--text btn--sm" style={{ height: 28 }} onClick={() => { setGeetestOk(false); setGeetestToken(''); }}>重新验证</button>
            </span>
          ) : (
            <button className="btn btn--tonal btn--sm" style={{ width: '100%' }} onClick={startGeetest} disabled={busy || disabled}>
              <I name="shield" size={16} /> {busy ? '验证中…' : '点击进行人机验证'}
            </button>
          )}
          <div ref={geetestRef} className="geetest-container" />
        </div>
      )}
      {cfg.turnstile_enabled && (
        <div className={`captcha-slot ${turnstileOk ? 'ready' : ''}`} style={{ minHeight: 64 }}>
          {turnstileOk ? (
            <span className="row muted small" style={{ color: 'var(--md-success)' }}>
              <I name="checkCircle" size={16} /> Turnstile 验证通过
            </span>
          ) : (
            <div ref={tsRef} style={{ display: 'grid', placeItems: 'center', width: '100%' }} />
          )}
        </div>
      )}
      {err && <div className="err" style={{ color: 'var(--md-error)', font: 'var(--text-body-sm)' }}>{err}</div>}
      <button className="btn btn--text" style={{ alignSelf: 'flex-start', height: 26 }} onClick={reset}>
        <I name="refresh" size={14} /> 重置验证
      </button>
    </div>
  );
}
