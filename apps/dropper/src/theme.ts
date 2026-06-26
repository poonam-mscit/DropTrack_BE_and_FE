/**
 * Single source of truth for colours, spacing, type scale.
 * Matches the dropper wireframes (dark, lime accent, Inter).
 */
export const colors = {
  bg: '#18181B',
  card: '#27272A',
  cardSoft: 'rgba(255,255,255,0.04)',
  border: '#3F3F46',
  borderSoft: 'rgba(255,255,255,0.18)',
  text: '#FFFFFF',
  textMuted: '#A1A1AA',
  textFaint: 'rgba(255,255,255,0.5)',
  accent: '#A3E635',          // lime
  accentDeep: '#65A30D',
  primary: '#4F46E5',          // indigo
  primaryDeep: '#3730A3',
  danger: '#EF4444',
  warn: '#F59E0B',
  success: '#10B981',
};

export const radii = { sm: 8, md: 12, lg: 14, xl: 18, pill: 999 };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };
export const font = {
  family: 'System',
  size: { xs: 11, sm: 12, md: 14, lg: 16, xl: 20, xxl: 24, hero: 48 },
  weight: { regular: '400', medium: '500', semibold: '600', bold: '700', black: '800' } as const,
};
