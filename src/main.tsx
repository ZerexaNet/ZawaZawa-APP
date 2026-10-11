import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { applyTheme, useSettings } from './store';
import './styles.css';

const st0 = useSettings.getState();
applyTheme(st0.theme, st0.style);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// PWA Service Worker 注册（仅 Web 环境；Electron 的 file:// 下跳过）
const isWeb = location.protocol === 'http:' || location.protocol === 'https:';
if (isWeb && 'serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
