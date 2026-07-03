export type NavItemKey = 'today' | 'preferences' | 'reports' | 'settings';

export const DEFAULT_NAV_ORDER: NavItemKey[] = ['today', 'preferences', 'reports', 'settings'];
export const NAV_ORDER_STORAGE_KEY = 'bottomNavOrder';
export const NAV_ORDER_CHANGE_EVENT = 'bottomNavOrderChange';
export const NAV_PATHS: Record<NavItemKey, string> = {
  today: '/today',
  preferences: '/preferences',
  reports: '/reports',
  settings: '/settings'
};

export function normalizeNavOrder(value: unknown): NavItemKey[] {
  if (!Array.isArray(value)) return DEFAULT_NAV_ORDER;

  const validKeys = new Set(DEFAULT_NAV_ORDER);
  const ordered = value.filter((item): item is NavItemKey => validKeys.has(item as NavItemKey));
  const missing = DEFAULT_NAV_ORDER.filter(item => !ordered.includes(item));

  return [...ordered, ...missing];
}

export function loadNavOrder(): NavItemKey[] {
  try {
    return normalizeNavOrder(JSON.parse(localStorage.getItem(NAV_ORDER_STORAGE_KEY) || 'null'));
  } catch (error) {
    return DEFAULT_NAV_ORDER;
  }
}

export function getInitialNavPath() {
  return NAV_PATHS[loadNavOrder()[0]] || NAV_PATHS.today;
}
