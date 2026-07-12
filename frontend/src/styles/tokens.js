// LogiSense design system — single source of truth for JS/Recharts consumers.
// Mirrors the Tailwind theme in tailwind.config.js. `tokens` is the canonical
// object from UI_DESIGN_SPEC §1; `colors` is kept for existing imports.

export const tokens = {
  // Surfaces
  bg: '#0B0C0D', // page background (near-black, slightly warm)
  surface: '#0F0F11', // card / panel background
  surface2: '#15151A', // raised elements, table header, dropdowns
  surface3: '#1A1A1F', // row hover, active states
  border: '#27272A', // all 1px borders
  borderSoft: '#1F1F23', // subtle internal dividers

  // Text
  text: '#F8F8F8',
  textDim: '#A1A1AA',
  muted: '#71717A',

  // Brand
  primary: '#FFD60A',
  primaryDim: '#9A6800',

  // Status (semantic — consistent everywhere)
  early: '#4ADE80',
  onTime: '#60A5FA',
  late: '#F87171',
  rto: '#94A3B8',
  pending: '#FBBF24',
  notYet: '#94A3B8',

  // Status pill backgrounds (15% opacity of the status color)
  earlyBg: 'rgba(74,222,128,0.15)',
  onTimeBg: 'rgba(96,165,250,0.15)',
  lateBg: 'rgba(248,113,113,0.15)',
  rtoBg: 'rgba(148,163,184,0.15)',
  pendingBg: 'rgba(251,191,36,0.15)',
}

export const radii = { sm: '8px', md: '12px', lg: '16px' }
export const spacing = { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px', xxl: '48px' }
export const fonts = {
  sans: "'Inter', system-ui, sans-serif",
  mono: "'JetBrains Mono', monospace",
}

// --- Back-compat: existing pages import { colors } with camelCase keys. -------
export const colors = {
  background: tokens.bg,
  surface: tokens.surface,
  surface2: tokens.surface2,
  surface3: tokens.surface3,
  primary: tokens.primary,
  textPrimary: tokens.text,
  textMuted: tokens.muted,
  early: tokens.early,
  onTime: tokens.onTime,
  late: tokens.late,
  rto: tokens.rto,
  border: tokens.border,
}

// SLA status → color (charts / legends).
export const slaColors = {
  Early: tokens.early,
  'On Time': tokens.onTime,
  Late: tokens.late,
  RTO: tokens.rto,
  'Not Yet Delivered': tokens.notYet,
}
