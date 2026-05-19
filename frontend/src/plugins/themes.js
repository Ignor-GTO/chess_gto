/**
 * Темы оформления сайта (CSS-переменные).
 */

export const THEMES = {
  dark: {
    id: 'dark',
    icon: '🌙',
    labelKey: 'themes.dark',
    vars: {
      '--color-bg':         '#0f0f1a',
      '--color-surface':    '#1a1a2e',
      '--color-surface2':   '#16213e',
      '--color-border':     '#2d2d4a',
      '--color-accent':     '#667eea',
      '--color-accent2':    '#764ba2',
      '--color-text':       '#e2e8f0',
      '--color-text-muted': '#94a3b8',
      '--color-success':    '#10b981',
      '--color-danger':     '#ef4444',
      '--color-warning':    '#f59e0b',
      '--color-nav-bg':     'rgba(15, 15, 26, 0.92)',
    },
  },
  light: {
    id: 'light',
    icon: '☀️',
    labelKey: 'themes.light',
    vars: {
      '--color-bg':         '#f1f5f9',
      '--color-surface':    '#ffffff',
      '--color-surface2':   '#e2e8f0',
      '--color-border':     '#cbd5e1',
      '--color-accent':     '#4f46e5',
      '--color-accent2':    '#7c3aed',
      '--color-text':       '#0f172a',
      '--color-text-muted': '#64748b',
      '--color-success':    '#059669',
      '--color-danger':     '#dc2626',
      '--color-warning':    '#d97706',
      '--color-nav-bg':     'rgba(255, 255, 255, 0.92)',
    },
  },
  green: {
    id: 'green',
    icon: '🌲',
    labelKey: 'themes.green',
    vars: {
      '--color-bg':         '#0a1612',
      '--color-surface':    '#122820',
      '--color-surface2':   '#1a3d32',
      '--color-border':     '#2d5a4a',
      '--color-accent':     '#34d399',
      '--color-accent2':    '#059669',
      '--color-text':       '#ecfdf5',
      '--color-text-muted': '#86efac',
      '--color-success':    '#22c55e',
      '--color-danger':     '#f87171',
      '--color-warning':    '#fbbf24',
      '--color-nav-bg':     'rgba(10, 22, 18, 0.92)',
    },
  },
  purple: {
    id: 'purple',
    icon: '💜',
    labelKey: 'themes.purple',
    vars: {
      '--color-bg':         '#120818',
      '--color-surface':    '#1e0f2e',
      '--color-surface2':   '#2d1b4e',
      '--color-border':     '#4c1d95',
      '--color-accent':     '#a855f7',
      '--color-accent2':    '#ec4899',
      '--color-text':       '#f3e8ff',
      '--color-text-muted': '#c4b5fd',
      '--color-success':    '#34d399',
      '--color-danger':     '#fb7185',
      '--color-warning':    '#fbbf24',
      '--color-nav-bg':     'rgba(18, 8, 24, 0.92)',
    },
  },
  amber: {
    id: 'amber',
    icon: '♟',
    labelKey: 'themes.amber',
    vars: {
      '--color-bg':         '#1a1208',
      '--color-surface':    '#2a1f0f',
      '--color-surface2':   '#3d2e14',
      '--color-border':     '#5c4520',
      '--color-accent':     '#f59e0b',
      '--color-accent2':    '#d97706',
      '--color-text':       '#fef3c7',
      '--color-text-muted': '#fcd34d',
      '--color-success':    '#84cc16',
      '--color-danger':     '#ef4444',
      '--color-warning':    '#fbbf24',
      '--color-nav-bg':     'rgba(26, 18, 8, 0.92)',
    },
  },
};

export const THEME_IDS = Object.keys(THEMES);
export const DEFAULT_THEME = 'dark';

export function applyTheme(themeId) {
  const theme = THEMES[themeId] || THEMES[DEFAULT_THEME];
  const root = document.documentElement;
  Object.entries(theme.vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  root.setAttribute('data-theme', theme.id);
  return theme.id;
}
