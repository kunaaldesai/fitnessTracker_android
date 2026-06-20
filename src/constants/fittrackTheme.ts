export const fittrackColors = {
  light: {
    background: '#f2f2f7',
    nav: 'rgba(242,242,247,0.94)',
    surface: '#ffffff',
    surfaceAlt: 'rgba(0,0,0,0.04)',
    surfacePressed: 'rgba(0,0,0,0.06)',
    text: '#000000',
    label: '#3c3c43',
    muted: '#8e8e93',
    faint: '#c7c7cc',
    border: 'rgba(0,0,0,0.08)',
    primary: '#007AFF',
    primaryHover: '#0066D6',
    accent: '#FF3B30',
    success: '#34C759',
    warning: '#FF9F0A',
    info: '#32ADE6',
    shadow: 'rgba(0,0,0,0.08)',
  },
  dark: {
    background: '#000000',
    nav: 'rgba(0,0,0,0.94)',
    surface: '#1c1c1e',
    surfaceAlt: 'rgba(255,255,255,0.08)',
    surfacePressed: 'rgba(255,255,255,0.12)',
    text: '#ffffff',
    label: '#ebebf5',
    muted: '#8e8e93',
    faint: '#48484a',
    border: 'rgba(255,255,255,0.08)',
    primary: '#0A84FF',
    primaryHover: '#007AFF',
    accent: '#FF453A',
    success: '#30D158',
    warning: '#FF9F0A',
    info: '#64D2FF',
    shadow: 'rgba(0,0,0,0.4)',
  },
} as const;

export type FittrackMode = keyof typeof fittrackColors;
export type FittrackColors = (typeof fittrackColors)[FittrackMode];

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  pill: 999,
} as const;
