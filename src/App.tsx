import { useEffect, useState } from 'react';
import { I } from './icons';
import { BrowserRouter, HashRouter, Link, Route, Routes, useLocation } from 'react-router-dom';
import { api } from './api';
import { FollowListPage } from './pages/FollowList';
import { BottomNav, TopBar } from './components';
import { applyTheme, useAuth, useSettings } from './store';
import { useToast } from './store';

import { HomePage } from './pages/Home';
import { VideoPage } from './pages/VideoPage';
import { ArticlePage } from './pages/ArticlePage';
import { UserPage } from './pages/UserPage';
import { UploadPage } from './pages/Upload';
import { MePage } from './pages/Me';
import { HistoryPage, FavoritesPage, CollectionsPage, CollectionDetailPage } from './pages/Library';
import { MessagesPage } from './pages/Messages';
import { CoinsPage, ReferendumsPage } from './pages/Coins';
import { MembershipPage, VerificationPage } from './pages/Membership';
import { SearchPage, TrendingPage, ConfusionPage, LegalPage, FollowingFeedPage } from './pages/Misc';
import { AdminPage } from './pages/Admin';
import { LoginPage, RegisterPage, ForgotPage, DeactivatePage } from './pages/Auth';

function Toasts() {
  const { toasts } = useToast();
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={'toast-item' + (t.kind === 'err' ? ' err' : '')}>{t.text}</div>
      ))}
    </div>
  );
}

function Footer() {
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  useEffect(() => {
    api.ping().then(() => setApiOk(true)).catch(() => setApiOk(false));
  }, []);
  return (
    <footer className="footer">
      <div className="flex wrap" style={{ justifyContent: 'center', gap: 14, marginBottom: 8 }}>
        <Link to="/legal/tos">服务条款</Link>
        <Link to="/legal/privacy">隐私政策</Link>
      </div>
      <div className="flex" style={{ justifyContent: 'center', gap: 8, alignItems: 'center' }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: apiOk === null ? 'var(--ink-3)' : apiOk ? 'var(--ok)' : 'var(--err)', display: 'inline-block' }} />
        <span style={{ fontSize: 12 }}>
          {apiOk === null ? 'API 检测中…' : apiOk ? 'API 连接正常' : 'API 连接失败'} · © {new Date().getFullYear()} ZawaZawa · Powered by Zerexa
        </span>
      </div>
    </footer>
  );
}

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

// Electron 以 file:// 加载时 history API 不可用，改用 HashRouter；Web 环境用 BrowserRouter
const IS_FILE = typeof window !== 'undefined' && window.location.protocol === 'file:';
const Router = IS_FILE ? HashRouter : BrowserRouter;

export default function App() {
  const { theme, style } = useSettings();
  const { bootstrap } = useAuth();

  useEffect(() => { applyTheme(theme, style); }, [theme, style]);
  useEffect(() => { void bootstrap(); }, [bootstrap]);

  return (
    <Router>
      <ScrollTop />
      <div className="shell">
        <TopBar />
        <main className="main">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/video/:id" element={<VideoPage />} />
            <Route path="/article/:id" element={<ArticlePage />} />
            <Route path="/user/:userId" element={<UserPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/me" element={<MePage />} />
            <Route path="/profile" element={<MePage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="/collections" element={<CollectionsPage />} />
            <Route path="/collection/:id" element={<CollectionDetailPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/tickets" element={<MessagesPage />} />
            <Route path="/coins" element={<CoinsPage />} />
            <Route path="/referendums" element={<ReferendumsPage />} />
            <Route path="/referendums/:id" element={<ReferendumsPage />} />
            <Route path="/membership" element={<MembershipPage />} />
            <Route path="/verification" element={<VerificationPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/trending" element={<TrendingPage />} />
            <Route path="/leaderboard" element={<ConfusionPage />} />
            <Route path="/following" element={<FollowingFeedPage />} />
            <Route path="/following-list" element={<FollowListPage />} />
            <Route path="/legal/:doc" element={<LegalPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot" element={<ForgotPage />} />
            <Route path="/deactivate" element={<DeactivatePage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <Footer />
        <BottomNav />
      </div>
      <Toasts />
    </Router>
  );
}

function NotFound() {
  return (
    <div className="page" style={{ textAlign: 'center', paddingTop: 60 }}>
      <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--ink-3)' }}><I name="cloud" size={56} /></div>
      <h1 style={{ fontSize: 22 }}>页面不存在</h1>
      <p className="muted">你访问的页面走丢了</p>
      <Link to="/" className="btn btn-primary" style={{ marginTop: 12 }}>返回首页</Link>
    </div>
  );
}
