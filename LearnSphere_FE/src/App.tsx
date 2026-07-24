import { Fragment, Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import { api, clearSession, saveSession, type Role, type User } from './services/api';

const HomePage = lazy(() => import('./pages/HomePage').then((module) => ({ default: module.HomePage })));
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage').then((module) => ({ default: module.AdminUsersPage })));
const AIAssistantPage = lazy(() => import('./pages/AIAssistantPage').then((module) => ({ default: module.AIAssistantPage })));
const CourseCatalogPage = lazy(() => import('./pages/CourseCatalogPage').then((module) => ({ default: module.CourseCatalogPage })));
const CourseDetailPage = lazy(() => import('./pages/CourseDetailPage').then((module) => ({ default: module.CourseDetailPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const LessonDetailPage = lazy(() => import('./pages/LessonDetailPage').then((module) => ({ default: module.LessonDetailPage })));
const LessonManagementPage = lazy(() => import('./pages/LessonManagementPage').then((module) => ({ default: module.LessonManagementPage })));
const LockedCoursesPage = lazy(() => import('./pages/LockedCoursesPage').then((module) => ({ default: module.LockedCoursesPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const MyCoursesPage = lazy(() => import('./pages/MyCoursesPage').then((module) => ({ default: module.MyCoursesPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((module) => ({ default: module.ProfilePage })));
const QuizPage = lazy(() => import('./pages/QuizPage').then((module) => ({ default: module.QuizPage })));
const QuestionBuilderPage = lazy(() => import('./pages/QuestionBuilderPage').then((module) => ({ default: module.QuestionBuilderPage })));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then((module) => ({ default: module.ResetPasswordPage })));
const SignupPage = lazy(() => import('./pages/SignupPage').then((module) => ({ default: module.SignupPage })));
const SystemMonitoringPage = lazy(() => import('./pages/SystemMonitoringPage').then((module) => ({ default: module.SystemMonitoringPage })));

type RouteDefinition = {
  element: ReactNode;
  requiresAuth?: boolean;
  roles?: Role[];
};

function LoadingScreen({ message = 'Đang xác thực phiên đăng nhập...' }: { message?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0d131f] px-4 text-[#dde2f4]">
      <div className="text-center">
        <span className="material-symbols-outlined mb-3 animate-spin text-[42px] text-[#adc7ff]">progress_activity</span>
        <p className="font-mono text-[13px] text-[#8b90a0]">{message}</p>
      </div>
    </div>
  );
}

function Redirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);

  return <LoadingScreen message="Đang chuyển trang..." />;
}

function AccessDenied({ user }: { user: User }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0d131f] px-4 text-[#dde2f4]">
      <section className="max-w-md rounded-xl border border-[#414754] bg-[#161c28] p-8 text-center">
        <span className="material-symbols-outlined mb-4 text-[48px] text-[#ffb4ab]">lock</span>
        <h1 className="text-[26px] font-semibold">Không có quyền truy cập</h1>
        <p className="mt-2 text-[#c1c6d7]">
          Tài khoản {user.full_name} không có quyền mở trang này.
        </p>
        <a className="mt-6 inline-flex rounded-lg bg-[#adc7ff] px-5 py-3 font-bold text-[#002e68]" href="/dashboard">
          Về bảng điều khiển
        </a>
      </section>
    </div>
  );
}

function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0d131f] px-4 text-[#dde2f4]">
      <section className="max-w-lg rounded-2xl border border-[#414754] bg-[#161c28] p-8 text-center shadow-2xl">
        <p className="font-mono text-[13px] font-bold uppercase tracking-[0.2em] text-[#adc7ff]">404</p>
        <h1 className="mt-3 text-[30px] font-semibold">Không tìm thấy trang</h1>
        <p className="mt-3 leading-7 text-[#c1c6d7]">Đường dẫn này không tồn tại hoặc đã được thay đổi.</p>
        <a className="mt-7 inline-flex rounded-xl bg-[#adc7ff] px-5 py-3 font-bold text-[#002e68]" href="/">
          Về trang chủ
        </a>
      </section>
    </main>
  );
}

function getRoute(pathname: string): RouteDefinition {
  if (/^\/reset-password(?:\/[^/]+)?\/?$/.test(pathname)) {
    return { element: <ResetPasswordPage /> };
  }

  const routes: Record<string, RouteDefinition> = {
    '/': { element: <HomePage /> },
    '/login': { element: <LoginPage /> },
    '/signup': { element: <SignupPage /> },
    '/dashboard': { element: <DashboardPage />, requiresAuth: true },
    '/my-courses': { element: <MyCoursesPage />, requiresAuth: true, roles: ['student'] },
    '/ai-assistant': { element: <AIAssistantPage />, requiresAuth: true, roles: ['student', 'tutor'] },
    '/courses': { element: <CourseCatalogPage /> },
    '/course-detail': { element: <CourseDetailPage />, requiresAuth: true },
    '/lesson-detail': { element: <LessonDetailPage />, requiresAuth: true },
    '/lesson-management': { element: <LessonManagementPage />, requiresAuth: true, roles: ['tutor', 'admin'] },
    '/locked-courses': { element: <LockedCoursesPage />, requiresAuth: true, roles: ['tutor', 'admin'] },
    '/quiz': { element: <QuizPage />, requiresAuth: true },
    '/question-builder': { element: <QuestionBuilderPage />, requiresAuth: true, roles: ['tutor', 'admin'] },
    '/system-monitoring': { element: <SystemMonitoringPage />, requiresAuth: true, roles: ['admin'] },
    '/admin-users': { element: <AdminUsersPage />, requiresAuth: true, roles: ['admin'] },
    '/profile': { element: <ProfilePage />, requiresAuth: true },
  };

  return routes[pathname] ?? { element: <NotFoundPage /> };
}

export default function App() {
  const [locationHref, setLocationHref] = useState(
    () => `${window.location.pathname}${window.location.search}${window.location.hash}`,
  );
  const pathname = new URL(locationHref, window.location.origin).pathname;
  const route = getRoute(pathname);
  const [authState, setAuthState] = useState<{ isLoading: boolean; user: User | null }>({
    isLoading: true,
    user: null,
  });

  useEffect(() => {
    const syncLocation = () => {
      setLocationHref(`${window.location.pathname}${window.location.search}${window.location.hash}`);
    };
    const handleInternalLink = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a');
      if (!anchor || anchor.target && anchor.target !== '_self' || anchor.hasAttribute('download')) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      const onlyHashChanged =
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search &&
        destination.hash !== window.location.hash;
      if (onlyHashChanged || anchor.getAttribute('href') === '#') return;

      event.preventDefault();
      window.history.pushState({}, '', `${destination.pathname}${destination.search}${destination.hash}`);
      syncLocation();
      window.scrollTo({ top: 0, behavior: 'auto' });
    };

    window.addEventListener('popstate', syncLocation);
    document.addEventListener('click', handleInternalLink);
    return () => {
      window.removeEventListener('popstate', syncLocation);
      document.removeEventListener('click', handleInternalLink);
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    function markAnonymous() {
      if (isActive) setAuthState({ isLoading: false, user: null });
    }

    async function bootstrapAuth() {
      try {
        const user = await api.me();
        if (!isActive) return;

        saveSession({ user });
        setAuthState({ isLoading: false, user });
      } catch {
        clearSession();
        markAnonymous();
      }
    }

    window.addEventListener('learnsphere:unauthorized', markAnonymous);
    void bootstrapAuth();

    return () => {
      isActive = false;
      window.removeEventListener('learnsphere:unauthorized', markAnonymous);
    };
  }, []);

  if (authState.isLoading) {
    return <LoadingScreen />;
  }

  if (route.requiresAuth && !authState.user) {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    return <Redirect to={`/login?return_to=${encodeURIComponent(returnTo)}`} />;
  }

  if (authState.user && route.roles && !route.roles.includes(authState.user.role)) {
    return <AccessDenied user={authState.user} />;
  }

  if (authState.user && (pathname === '/login' || pathname === '/signup')) {
    return <Redirect to="/dashboard" />;
  }

  return (
    <Suspense fallback={<LoadingScreen message="Đang tải trang..." />}>
      <Fragment key={locationHref}>{route.element}</Fragment>
    </Suspense>
  );
}
