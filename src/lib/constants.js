export const FORMATS = [
  'Commander',
  'Standard',
  'Modern',
  'Draft',
  'Brawl',
  'Pioneer',
  'Legacy',
  'Vintage',
  'Pauper',
]

export const COLORS = [
  { code: 'W', name: 'White', hex: '#F9FAF4', symbol: '☀' },
  { code: 'U', name: 'Blue', hex: '#0E68AB', symbol: '💧' },
  { code: 'B', name: 'Black', hex: '#150B00', symbol: '💀' },
  { code: 'R', name: 'Red', hex: '#D3202A', symbol: '🔥' },
  { code: 'G', name: 'Green', hex: '#00733E', symbol: '🌲' },
]

export const COLOR_MAP = Object.fromEntries(COLORS.map((c) => [c.code, c]))

export const DEFAULT_LIFE = {
  Commander: 40,
  Brawl: 25,
  Standard: 20,
  Modern: 20,
  Draft: 20,
  Pioneer: 20,
  Legacy: 20,
  Vintage: 20,
  Pauper: 20,
}

export const FORMAT_ICONS = {
  Commander: '👑',
  Standard: '⚔️',
  Modern: '🔧',
  Draft: '📦',
  Brawl: '🛡️',
  Pioneer: '🗺️',
  Legacy: '📜',
  Vintage: '💎',
  Pauper: '🪙',
}
