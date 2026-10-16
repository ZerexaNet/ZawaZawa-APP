import { lazy, Suspense } from 'react';
import { BrowserRouter, HashRouter, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { Shell } from './components/Shell';
import { Loading } from './components/ui';

const Home = lazy(() => import('./pages/Home'));
const Trending = lazy(() => import('./pages/Trending'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const VideoPage = lazy(() => import('./pages/VideoPage'));
const ArticlePage = lazy(() => import('./pages/ArticlePage'));
const UserPage = lazy(() => import('./pages/UserPage'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Forgot = lazy(() => import('./pages/Forgot'));
const Deactivate = lazy(() => import('./pages/Deactivate'));
const Upload = lazy(() => import('./pages/Upload'));
const PostNew = lazy(() => import('./pages/PostNew'));
const Profile = lazy(() => import('./pages/Profile'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const FavoritesPage = lazy(() => import('./pages/FavoritesPage'));
const Collections = lazy(() => import('./pages/CollectionsPage'));
const CollectionDetail = lazy(() => import('./pages/CollectionsPage').then(m => ({ default: m.CollectionDetail })));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const ReferendumsPage = lazy(() => import('./pages/ReferendumsPage'));
const MembershipPage = lazy(() => import('./pages/MembershipPage'));
const VerificationPage = lazy(() => import('./pages/VerificationPage'));
const LegalPage = lazy(() => import('./pages/LegalPage'));
const ConfusionPage = lazy(() => import('./pages/ConfusionPage'));
const FollowingFeedPage = lazy(() => import('./pages/FollowingFeedPage'));
const FollowListPage = lazy(() => import('./pages/FollowingFeedPage').then(m => ({ default: m.FollowListPage })));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const NotFound = lazy(() => import('./pages/NotFound'));

function FollowListRoute() {
  const { kind } = useParams<{ kind: string }>();
  return (
    <Suspense fallback={<Loading />}>
      <FollowListPage kind={kind === 'followers' ? 'followers' : 'following'} />
    </Suspense>
  );
}

function Page() {
  const loc = useLocation();
  return (
    <Suspense fallback={<Loading text="加载中…" />}>
      <Routes location={loc}>
        <Route path="/" element={<Home />} />
        <Route path="/trending" element={<Trending />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/video/:id" element={<VideoPage />} />
        <Route path="/article/:id" element={<ArticlePage />} />
        <Route path="/user/:id" element={<UserPage />} />
        <Route path="/legal/:type" element={<LegalPage />} />
        <Route path="/referendums" element={<ReferendumsPage />} />
        <Route path="/confusion" element={<ConfusionPage />} />
        {/* 认证 */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot" element={<Forgot />} />
        <Route path="/deactivate" element={<Deactivate />} />
        {/* 用户 */}
        <Route path="/upload" element={<Upload />} />
        <Route path="/post-new" element={<PostNew />} />
        <Route path="/me" element={<Profile />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/collections" element={<Collections />} />
        <Route path="/collections/:id" element={<CollectionDetail />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/membership" element={<MembershipPage />} />
        <Route path="/verification" element={<VerificationPage />} />
        <Route path="/following" element={<FollowingFeedPage />} />
        <Route path="/follow-list/:kind" element={<FollowListRoute />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

// Electron 以 file:// 加载时 history API 不可用，改用 HashRouter；Web 环境用 BrowserRouter
const IS_FILE = typeof window !== 'undefined' && window.location.protocol === 'file:';
const Router = IS_FILE ? HashRouter : BrowserRouter;

export default function App() {
  return (
    <Router>
      <Shell>
        <Page />
      </Shell>
    </Router>
  );
}
