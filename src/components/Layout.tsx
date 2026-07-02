import { Outlet, NavLink } from 'react-router-dom';
import { Home, Heart, BarChart2, Settings as SettingsIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { useLanguage } from '../contexts/LanguageContext';

export default function Layout() {
  const { t } = useLanguage();

  return (
    <div className="app-shell flex min-h-[100dvh] flex-col bg-[#F2F2F7] text-black font-sans selection:bg-blue-200">
      <main className="app-main flex-1 overflow-y-auto p-4 pb-32">
        <Outlet />
      </main>

      <nav className="app-bottom-nav fixed bottom-4 left-1/2 z-30 flex h-[72px] w-[calc(100%-32px)] max-w-md -translate-x-1/2 items-center justify-around rounded-[28px] border border-white/80 bg-white/90 px-2 shadow-[0_16px_48px_rgba(0,0,0,0.14)] backdrop-blur-xl">
        <NavLink
          to="/"
          className={({ isActive }) =>
            clsx(
              "flex h-[56px] min-w-[68px] flex-col items-center justify-center rounded-[22px] text-[10px] font-semibold transition-all active:scale-95",
              isActive ? "bg-[#007AFF]/10 text-[#007AFF]" : "text-gray-400 hover:bg-[#F2F2F7] hover:text-gray-600"
            )
          }
        >
          {({ isActive }) => (
            <>
              <Home className={clsx("transition-transform", isActive && "scale-110")} size={23} strokeWidth={isActive ? 2.6 : 2} />
              <span>{t('navToday')}</span>
            </>
          )}
        </NavLink>
        <NavLink
          to="/preferences"
          className={({ isActive }) =>
            clsx(
              "flex h-[56px] min-w-[68px] flex-col items-center justify-center rounded-[22px] text-[10px] font-semibold transition-all active:scale-95",
              isActive ? "bg-[#007AFF]/10 text-[#007AFF]" : "text-gray-400 hover:bg-[#F2F2F7] hover:text-gray-600"
            )
          }
        >
          {({ isActive }) => (
            <>
              <Heart className={clsx("transition-transform", isActive && "scale-110")} size={23} strokeWidth={isActive ? 2.6 : 2} />
              <span>{t('navPreferences')}</span>
            </>
          )}
        </NavLink>
        <NavLink
          to="/reports"
          className={({ isActive }) =>
            clsx(
              "flex h-[56px] min-w-[68px] flex-col items-center justify-center rounded-[22px] text-[10px] font-semibold transition-all active:scale-95",
              isActive ? "bg-[#007AFF]/10 text-[#007AFF]" : "text-gray-400 hover:bg-[#F2F2F7] hover:text-gray-600"
            )
          }
        >
          {({ isActive }) => (
            <>
              <BarChart2 className={clsx("transition-transform", isActive && "scale-110")} size={23} strokeWidth={isActive ? 2.6 : 2} />
              <span>{t('navReports')}</span>
            </>
          )}
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            clsx(
              "flex h-[56px] min-w-[68px] flex-col items-center justify-center rounded-[22px] text-[10px] font-semibold transition-all active:scale-95",
              isActive ? "bg-[#007AFF]/10 text-[#007AFF]" : "text-gray-400 hover:bg-[#F2F2F7] hover:text-gray-600"
            )
          }
        >
          {({ isActive }) => (
            <>
              <SettingsIcon className={clsx("transition-transform", isActive && "scale-110")} size={23} strokeWidth={isActive ? 2.6 : 2} />
              <span>{t('navSettings')}</span>
            </>
          )}
        </NavLink>
      </nav>
    </div>
  );
}
