import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Home, Heart, BarChart2, Settings as SettingsIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { useLanguage } from '../contexts/LanguageContext';
import { loadNavOrder, NAV_ORDER_CHANGE_EVENT, NAV_PATHS, type NavItemKey } from '../navigation';

function PageSkeleton() {
  return (
    <div className="page-skeleton pointer-events-none absolute inset-0 z-20 bg-[#F2F2F7] px-4 pt-4">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="space-y-3 px-2">
          <div className="h-8 w-40 rounded-2xl bg-gray-200/80" />
          <div className="h-4 w-56 rounded-xl bg-gray-200/70" />
        </div>
        <div className="space-y-4 px-2">
          {[0, 1, 2].map(item => (
            <div key={item} className="rounded-[28px] bg-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 shrink-0 rounded-[18px] bg-gray-200/70" />
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="h-4 w-24 rounded-xl bg-gray-200/70" />
                  <div className="h-5 w-3/4 rounded-xl bg-gray-200/80" />
                  <div className="h-3 w-full rounded-xl bg-gray-100" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Layout() {
  const { t } = useLanguage();
  const location = useLocation();
  const mainRef = useRef<HTMLElement | null>(null);
  const previousPath = useRef(location.pathname);
  const [navOrder, setNavOrder] = useState<NavItemKey[]>(() => loadNavOrder());
  const [isSwitchingPage, setIsSwitchingPage] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const navItems = {
    today: { to: NAV_PATHS.today, label: t('navToday'), icon: Home },
    preferences: { to: NAV_PATHS.preferences, label: t('navPreferences'), icon: Heart },
    reports: { to: NAV_PATHS.reports, label: t('navReports'), icon: BarChart2 },
    settings: { to: NAV_PATHS.settings, label: t('navSettings'), icon: SettingsIcon }
  };

  useLayoutEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);

  useEffect(() => {
    if (previousPath.current === location.pathname) return;
    previousPath.current = location.pathname;
    setIsSwitchingPage(true);
    const timer = window.setTimeout(() => setIsSwitchingPage(false), 140);
    return () => window.clearTimeout(timer);
  }, [location.pathname]);

  useEffect(() => {
    const syncNavOrder = () => setNavOrder(loadNavOrder());
    window.addEventListener('storage', syncNavOrder);
    window.addEventListener(NAV_ORDER_CHANGE_EVENT, syncNavOrder);
    return () => {
      window.removeEventListener('storage', syncNavOrder);
      window.removeEventListener(NAV_ORDER_CHANGE_EVENT, syncNavOrder);
    };
  }, []);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;

    const syncModalState = () => {
      setIsModalOpen(Boolean(main.querySelector('.pwa-modal-backdrop')));
    };
    const observer = new MutationObserver(syncModalState);
    observer.observe(main, { childList: true, subtree: true });
    syncModalState();

    return () => observer.disconnect();
  }, []);

  return (
    <div className="app-shell flex h-[100dvh] flex-col overflow-hidden bg-[#F2F2F7] text-black font-sans selection:bg-blue-200">
      <main ref={mainRef} className="app-main relative min-h-0 flex-1 overflow-y-auto p-4 pb-32">
        <Outlet />
        {isSwitchingPage && <PageSkeleton />}
      </main>

      <nav className={clsx(
        "app-bottom-nav fixed bottom-4 left-1/2 z-30 flex h-[72px] w-[calc(100%-32px)] max-w-md -translate-x-1/2 items-center justify-around rounded-[28px] border border-white/80 bg-white/90 px-2 shadow-[0_16px_48px_rgba(0,0,0,0.14)] backdrop-blur-xl",
        isModalOpen && "pointer-events-none invisible opacity-0"
      )}>
        {navOrder.map(key => {
          const item = navItems[key];
          const Icon = item.icon;

          return (
            <NavLink
              key={key}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  "flex h-[56px] min-w-[68px] flex-col items-center justify-center rounded-[22px] text-[10px] font-semibold transition-colors duration-150",
                  isActive ? "bg-[#007AFF]/10 text-[#007AFF]" : "text-gray-400 hover:bg-[#F2F2F7] hover:text-gray-600"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={23} strokeWidth={isActive ? 2.6 : 2} />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
