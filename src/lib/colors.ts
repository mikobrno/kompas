export const DEFAULT_CATEGORY_COLOR = '#f05a28';

export const CATEGORY_COLOR_PALETTE = [
  DEFAULT_CATEGORY_COLOR,
  '#ff8b5c',
  '#f97316',
  '#facc15',
  '#0ea5e9',
  '#22d3ee',
  '#10b981',
  '#6366f1',
  '#a855f7',
  '#ec4899',
];

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{6})$/;

export const normalizeHexColor = (input: string | null | undefined): string => {
  if (!input) {
    return DEFAULT_CATEGORY_COLOR;
  }

  const trimmed = input.trim();
  if (HEX_COLOR_REGEX.test(trimmed)) {
    return `#${trimmed.slice(1).toLowerCase()}`;
  }

  return DEFAULT_CATEGORY_COLOR;
};

export const hexToRgba = (input: string, alpha = 1): string => {
  const normalized = normalizeHexColor(input);
  const sanitizedAlpha = Number.isFinite(alpha) ? Math.min(Math.max(alpha, 0), 1) : 1;
  const hex = normalized.slice(1);
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${sanitizedAlpha})`;
};
