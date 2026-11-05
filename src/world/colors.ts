/**
 * Every nation's colours, as a field and a border, the way a flag is read
 * at a distance: England white with a red border for St George, the Dutch
 * orange edged blue, France blue edged gold. The border is also what keeps
 * a pale field visible on the chart.
 */

import type { Nation } from './ports.ts';

export interface Colors {
  field: string;
  border: string;
}

export const COLORS: Record<Nation, Colors> = {
  england: { field: '#ffffff', border: '#c8102e' },
  netherlands: { field: '#f07c1b', border: '#1f3f8f' },
  france: { field: '#1f4fb4', border: '#d4a017' },
  spain: { field: '#f5c400', border: '#b3141c' },
  portugal: { field: '#1f7a3a', border: '#c8102e' },
  denmark: { field: '#c8102e', border: '#d4a017' },
  local: { field: '#141414', border: '#ffffff' },
  sweden: { field: '#6fb7e6', border: '#f5c400' },
  hanse: { field: '#7a1f2b', border: '#ffffff' },
  italy: { field: '#ef9ab6', border: '#c8102e' },
  venice: { field: '#6a2c8f', border: '#d4a017' },
  malta: { field: '#8a8a8a', border: '#ffffff' },
  ottoman: { field: '#13827e', border: '#c8102e' },
  barbary: { field: '#7a4a24', border: '#1f7a3a' },
  morocco: { field: '#7a4a24', border: '#c8102e' },
  persia: { field: '#7f7a1f', border: '#d4a017' },
  oman: { field: '#a01030', border: '#ffffff' },
  mughal: { field: '#14532d', border: '#d4a017' },
  china: { field: '#d4a017', border: '#c8102e' },
  japan: { field: '#c8102e', border: '#ffffff' },
  native: { field: '#5b3a29', border: '#e9d8a6' },
};
