import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { Home, Heart, BarChart2, Settings as SettingsIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { useLanguage } from '../contexts/LanguageContext';
import { loadNavOrder, NAV_ORDER_CHANGE_EVENT, NAV_PATHS, TODAY_NAV_TOGGLE_EVENT, type NavItemKey } from '../navigation';

type LayoutProps = {
  children?: React.ReactNode;
};

export default function Layout({ children }: LayoutProps) {
  const { t } = useLanguage();
  const location = useLocation();
  const mainRef = useRef<HTMLElement | null>(null);
  const [navOrder, setNavOrder] = useState<NavItemKey[]>(() => loadNavOrder());
  const [isModalOpen, setIsModalOpen] = useState(false);

  const navItems = {
    today: { to: NAV_PATHS.today, label: t('navToday'), icon: Home },
    preferences: { to: NAV_PATHS.preferences, label: t('navPreferences'), icon: Heart },
    reports: { to: NAV_PATHS.reports, label: t('navReports'), icon: BarChart2 },
    settings: { to: NAV_PATHS.settings, label: t('navSettings'), icon: SettingsIcon }
  };

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
        {children ?? <Outlet />}
      </main>

      <nav className={clsx(
        "app-bottom-nav fixed bottom-4 left-1/2 z-30 flex h-[72px] w-[calc(100%-32px)] max-w-md -translate-x-1/2 items-center justify-around rounded-[28px] border border-white/80 bg-white/90 px-2 shadow-[0_16px_48px_rgba(0,0,0,0.14)] backdrop-blur-xl",
        isModalOpen && "pointer-events-none invisible opacity-0"
      )}>
        {navOrder.map(key => {
          const item = navItems[key];
          const Icon = item.icon;
          const isTodayActive = key === 'today' && location.pathname === NAV_PATHS.today;

          return (
            <NavLink
              key={key}
              to={item.to}
              onClick={(event) => {
                if (!isTodayActive) return;
                event.preventDefault();
                window.dispatchEvent(new Event(TODAY_NAV_TOGGLE_EVENT));
              }}
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
