/**
 * Where the chart's names go, so none falls on another: the Strait of
 * Magellan and round the Horn, Valparaíso and Mocha, Ternate and Banda lie
 * close enough that a name set to the right of each runs into the next.
 * Each name tries a few places round its point — right, left, above,
 * below — then a shorter name in the same places, and is left off only if
 * none fits. Names that matter most (where you've been, where you might go
 * next) are placed first. Pure: positions in the chart's own units, sized by
 * how many of them a screen pixel covers.
 */

export interface LabelIn {
  key: string;
  /** The point it names, in chart units. */
  x: number;
  y: number;
  name: string;
  /** A shorter name, if the long one won't fit. */
  short: string;
  /** Placed first, the higher it is. */
  priority: number;
}

export interface LabelOut {
  key: string;
  x: number;
  y: number;
  anchor: 'start' | 'end';
  text: string;
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** A name's type size, in screen pixels; how wide a letter of it runs, as a share of that; the room a point takes. */
export const LABEL_FONT = 11;
const LETTER = 0.55;
const POINT = 3.5;

/** The places round a point a name may go, in screen pixels: right, left, then the corners. */
const SPOTS: { dx: number; dy: number; anchor: 'start' | 'end' }[] = [
  { dx: 6, dy: 4, anchor: 'start' },
  { dx: -6, dy: 4, anchor: 'end' },
  { dx: 5, dy: -6, anchor: 'start' },
  { dx: 5, dy: 14, anchor: 'start' },
  { dx: -5, dy: -6, anchor: 'end' },
  { dx: -5, dy: 14, anchor: 'end' },
];

/** The box a name takes, set at (x, y) with its anchor. */
export function boxOf(x: number, y: number, text: string, anchor: 'start' | 'end', px: number, font = LABEL_FONT): Box {
  const w = text.length * font * LETTER * px;
  const [x0, x1] = anchor === 'start' ? [x, x + w] : [x - w, x];
  return { x0, x1, y0: y - font * 0.8 * px, y1: y + font * 0.25 * px };
}

export const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** A shorter name: what's before a comma, without "the", "off" or "round the". */
export const shortName = (name: string) =>
  name
    .split(',')[0]
    .replace(/^(off|round) (the )?/, '')
    .replace(/^the /, '')
    .replace(/ (islands|isles)$/i, '')
    .trim();

/**
 * Names placed so none overlaps another or another's point, inside the
 * chart's bounds `[west, top, east, bottom]`. `points` are every point drawn,
 * named or not (by default, the named ones). A name that can't be placed is
 * left out.
 */
export function layoutLabels(labels: LabelIn[], px: number, bounds: [number, number, number, number], font = LABEL_FONT, points: { key: string; x: number; y: number }[] = labels): LabelOut[] {
  const [west, top, east, bottom] = bounds;
  const dots = points.map((p) => ({ key: p.key, box: { x0: p.x - POINT * px, x1: p.x + POINT * px, y0: p.y - POINT * px, y1: p.y + POINT * px } }));
  const placed: { out: LabelOut; box: Box }[] = [];
  const order = labels.map((l, i) => ({ l, i })).sort((a, b) => b.l.priority - a.l.priority || a.i - b.i);
  for (const { l } of order) {
    let done = false;
    for (const text of l.short && l.short !== l.name ? [l.name, l.short] : [l.name]) {
      for (const s of SPOTS) {
        const x = l.x + s.dx * px;
        const y = l.y + s.dy * px;
        const box = boxOf(x, y, text, s.anchor, px, font);
        if (box.x0 < west || box.x1 > east || box.y0 < top || box.y1 > bottom) continue;
        if (placed.some((p) => overlaps(p.box, box))) continue;
        if (dots.some((d) => d.key !== l.key && overlaps(d.box, box))) continue;
        placed.push({ out: { key: l.key, x, y, anchor: s.anchor, text }, box });
        done = true;
        break;
      }
      if (done) break;
    }
  }
  return placed.map((p) => p.out);
}
