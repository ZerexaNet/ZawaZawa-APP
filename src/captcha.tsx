import { useEffect, useRef, useState } from 'react';
import { api } from './api';

declare global {
  interface Window {
    initGeetest4?: (opts: Record<string, unknown>, cb: (inst: GeetestInstance) => void) => void;
  }
}

interface GeetestInstance {
  appendTo: (el: HTMLElement) => void;
  onSuccess: (cb: () => void) => void;
  onError: (cb: () => void) => void;
  onClose: (cb: () => void) => void;
  getValidate: () => string | null;
  destroy?: () => void;
}

const GT4_URL = 'https://static.geetest.com/v4/gt4.js';

// 与官方实现一致：带重试的脚本加载
function loadGt4Script(): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const MAX = 3;
    const tryLoad = () => {
      attempts++;
      let el = document.querySelector<HTMLScriptElement>(`script[src="${GT4_URL}"]`);
      if (el?.dataset.failed === 'true') { el.remove(); el = null; }
      if (window.initGeetest4) { resolve(); return; }
      if (!el) {
        el = document.createElement('script');
        el.src = GT4_URL;
        el.async = true;
        el.defer = true;
        el.dataset.loaded = 'false';
        el.dataset.failed = 'false';
        document.body.appendChild(el);
      }
      if (el.dataset.loaded === 'true') { resolve(); return; }
      el.addEventListener('load', () => { el.dataset.loaded = 'true'; resolve(); }, { once: true });
      el.addEventListener('error', () => {
        el.dataset.failed = 'true';
        if (attempts < MAX) {
          el.remove();
          setTimeout(tryLoad, 1500 * attempts);
        } else {
          reject(new Error('极验脚本加载失败'));
        }
      }, { once: true });
    };
    tryLoad();
  });
}

export interface CaptchaResult {
  geetest?: string;
}

/**
 * 极验 v4 人机验证（与官方站点完全相同的链路）：
 * 页面加载时初始化 float 组件 → 用户点击验证 → onSuccess 拿 validate
 */
export function CaptchaBox({ onVerified }: { onVerified: (r: CaptchaResult) => void }) {
  const [enabled, setEnabled] = useState(false);
  const [captchaId, setCaptchaId] = useState('');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [passed, setPassed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const instRef = useRef<GeetestInstance | null>(null);
  const firedRef = useRef(false);
  // 回调放 ref：避免父组件每次渲染（如输入框敲字）产生新函数引用 → effect 重跑 → 验证码被反复销毁重建
  const onVerifiedRef = useRef(onVerified);
  onVerifiedRef.current = onVerified;

  // 1. 读取验证码配置
  useEffect(() => {
    let alive = true;
    api.captchaConfig()
      .then((c) => {
        if (!alive) return;
        setEnabled(!!c.geetest_enabled);
        setCaptchaId(String(c.geetest_captcha_id || ''));
      })
      .catch(() => alive && setEnabled(false))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  // 2. 初始化 Geetest float（官方同款：appendTo + onSuccess/onError/onClose）
  useEffect(() => {
    if (!enabled || !captchaId || !containerRef.current || firedRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        await loadGt4Script();
      } catch {
        if (!cancelled) setFailed(true);
        return;
      }
      if (cancelled || !containerRef.current || !window.initGeetest4) return;
      try {
        window.initGeetest4(
          {
            captchaId,
            product: 'float',
            language: 'zho',
            https: true,
            timeout: 10000,
            onError: () => { if (!cancelled) setFailed(true); },
          },
          (inst) => {
            if (cancelled || !containerRef.current) return;
            instRef.current?.destroy?.();
            instRef.current = inst;
            containerRef.current.innerHTML = '';
            inst.appendTo(containerRef.current);
            inst.onSuccess(() => {
              if (firedRef.current) return;
              firedRef.current = true;
              setPassed(true);
              setFailed(false);
              onVerifiedRef.current({ geetest: inst.getValidate() || undefined });
            });
            inst.onError(() => {
              firedRef.current = false;
              setFailed(true);
            });
            inst.onClose(() => {
              // 用户关闭验证窗口，允许再次点击
            });
          }
        );
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      instRef.current?.destroy?.();
      instRef.current = null;
    };
  }, [enabled, captchaId, reloadKey]);

  if (loading) {
    return (
      <div className="captcha-box">
        <div className="captcha-slot">正在加载人机验证…</div>
      </div>
    );
  }
  if (!enabled) return null;

  return (
    <div className="captcha-box">
      <div ref={containerRef} className="captcha-slot" style={{ minHeight: 70 }} />
      {failed && !passed && (
        <div className="row" style={{ gap: 8, marginTop: 6 }}>
          <span className="muted" style={{ fontSize: 12 }}>验证码加载失败</span>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => { setFailed(false); firedRef.current = false; setReloadKey((k) => k + 1); }}
          >
            重新加载
          </button>
        </div>
      )}
      {passed && <div className="row" style={{ marginTop: 6 }}><span className="captcha-ok">人机验证已通过</span></div>}
    </div>
  );
}
