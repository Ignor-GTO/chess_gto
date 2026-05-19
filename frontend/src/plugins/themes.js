/**
 * Темы в стиле Chess.com — мягкие, не «ядовитые» цвета.
 */

const BOARD_GREEN = {
  '--board-light':       '#ebecd0',
  '--board-dark':        '#739552',
  '--board-selected':    '#f6f669',
  '--board-last-move':   'rgba(155, 199, 0, 0.41)',
  '--board-check':       'rgba(220, 50, 50, 0.75)',
  '--board-border':      '#403d39',
};

const BOARD_BROWN = {
  '--board-light':       '#f0d9b5',
  '--board-dark':        '#b58863',
  '--board-selected':    '#f6f669',
  '--board-last-move':   'rgba(155, 119, 60, 0.45)',
  '--board-check':       'rgba(220, 50, 50, 0.75)',
  '--board-border':      '#5c4a3a',
};

const BOARD_BLUE = {
  '--board-light':       '#dee3e6',
  '--board-dark':        '#8ca2ad',
  '--board-selected':    '#f6f669',
  '--board-last-move':   'rgba(100, 140, 180, 0.45)',
  '--board-check':       'rgba(220, 50, 50, 0.75)',
  '--board-border':      '#5a6670',
};

export const THEMES = {
  dark: {
    id: 'dark',
    icon: '♟',
    labelKey: 'themes.dark',
    vars: {
      '--color-bg':         '#312e2b',
      '--color-surface':    '#262421',
      '--color-surface2':   '#3d3935',
      '--color-border':     '#484441',
      '--color-accent':     '#81b64c',
      '--color-accent2':    '#6a9a3f',
      '--color-text':       '#ffffff',
      '--color-text-muted': '#9a9693',
      '--color-success':    '#81b64c',
      '--color-danger':     '#fa412d',
      '--color-warning':    '#f7c631',
      '--color-nav-bg':     'rgba(49, 46, 43, 0.96)',
      ...BOARD_GREEN,
    },
  },
  light: {
    id: 'light',
    icon: '☀',
    labelKey: 'themes.light',
    vars: {
      '--color-bg':         '#ebebeb',
      '--color-surface':    '#ffffff',
      '--color-surface2':   '#f0f0f0',
      '--color-border':     '#d4d4d4',
      '--color-accent':     '#81b64c',
      '--color-accent2':    '#6a9a3f',
      '--color-text':       '#272727',
      '--color-text-muted': '#666666',
      '--color-success':    '#5a9a2e',
      '--color-danger':     '#d93025',
      '--color-warning':    '#e6a800',
      '--color-nav-bg':     'rgba(255, 255, 255, 0.96)',
      ...BOARD_GREEN,
    },
  },
  wood: {
    id: 'wood',
    icon: '🪵',
    labelKey: 'themes.wood',
    vars: {
      '--color-bg':         '#2a2118',
      '--color-surface':    '#352920',
      '--color-surface2':   '#453528',
      '--color-border':     '#5c4a3a',
      '--color-accent':     '#c9a66b',
      '--color-accent2':    '#a08050',
      '--color-text':       '#f5e6d3',
      '--color-text-muted': '#b8a088',
      '--color-success':    '#81b64c',
      '--color-danger':     '#e05545',
      '--color-warning':    '#d4a017',
      '--color-nav-bg':     'rgba(42, 33, 24, 0.96)',
      ...BOARD_BROWN,
    },
  },
  slate: {
    id: 'slate',
    icon: '❄',
    labelKey: 'themes.slate',
    vars: {
      '--color-bg':         '#2b3139',
      '--color-surface':    '#22272e',
      '--color-surface2':   '#323840',
      '--color-border':     '#434a54',
      '--color-accent':     '#6aabcc',
      '--color-accent2':    '#4a8aad',
      '--color-text':       '#e8eaed',
      '--color-text-muted': '#9aa0a6',
      '--color-success':    '#5cb85c',
      '--color-danger':     '#e05545',
      '--color-warning':    '#f0ad4e',
      '--color-nav-bg':     'rgba(43, 49, 57, 0.96)',
      ...BOARD_BLUE,
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
