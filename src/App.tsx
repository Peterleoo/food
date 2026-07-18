/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from './components/Layout';
import Home from './pages/Home';
import Preferences from './pages/Preferences';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import { LanguageProvider } from './contexts/LanguageContext';
import { getInitialNavPath } from './navigation';

function InitialRoute() {
  return <Navigate to={getInitialNavPath()} replace />;
}

function KeepAlivePages() {
  const location = useLocation();
  const activePath = location.pathname;

  return (
    <Layout>
      <section className={activePath === '/today' ? 'block' : 'hidden'} aria-hidden={activePath !== '/today'}>
        <Home />
      </section>
      <section className={activePath === '/preferences' ? 'block' : 'hidden'} aria-hidden={activePath !== '/preferences'}>
        <Preferences />
      </section>
      <section className={activePath === '/reports' ? 'block' : 'hidden'} aria-hidden={activePath !== '/reports'}>
        <Reports />
      </section>
      <section className={activePath === '/settings' ? 'block' : 'hidden'} aria-hidden={activePath !== '/settings'}>
        <Settings />
      </section>
    </Layout>
  );
}

export default function App() {
  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    if (!isStandalone) return;

    const handleTouchEnd = (event: TouchEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;
      window.requestAnimationFrame(() => {
        if (document.activeElement !== target) target.focus({ preventScroll: false });
      });
    };

    document.addEventListener('touchend', handleTouchEnd, true);
    return () => document.removeEventListener('touchend', handleTouchEnd, true);
  }, []);

  return (
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<InitialRoute />} />
          <Route path="/today" element={<KeepAlivePages />} />
          <Route path="/preferences" element={<KeepAlivePages />} />
          <Route path="/reports" element={<KeepAlivePages />} />
          <Route path="/settings" element={<KeepAlivePages />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
}
