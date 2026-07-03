/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
          <Route path="/" element={<Layout />}>
            <Route index element={<InitialRoute />} />
            <Route path="today" element={<Home />} />
            <Route path="preferences" element={<Preferences />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
}
