/**
 * The engraver's marks: the shapes a woodcut chart is cut from. Glyphs are
 * paths in screen pixels about a centre, drawn with
 * `transform="translate(x y) scale(px)"` so they stay one size at any zoom.
 */

/** A ship under sail, about 18 px across: hull, two masts, two sails, a pennant. */
export const SHIP = {
  hull: 'M-9,2 C-6,7.5 6,7.5 9,2 Z',
  masts: 'M-3,2 V-9 M3,2 V-11',
  sails: 'M-3,-8 C0.8,-6 0.8,-1.5 -3,-0.5 Z M3,-10 C7.5,-7 7.5,-1.5 3,0 Z',
  pennant: 'M3,-11 L8,-10 L3,-9 Z',
};

/** A fortified port: a crenellated tower with a gate. */
export const TOWER = {
  body: 'M-5,6 V-3 H-6.5 V-8 H-4 V-6 H-1.5 V-8 H1.5 V-6 H4 V-8 H6.5 V-3 H5 V6 Z',
  gate: 'M-1.6,6 V2.4 A1.6,1.6 0 0 1 1.6,2.4 V6',
};

/** An open town: two gabled houses. */
export const TOWN = {
  body: 'M-7.5,6 V0 L-4.5,-4 L-1.5,0 V6 Z M0.5,6 V-1.5 L4,-5.5 L7.5,-1.5 V6 Z',
  windows: 'M-5.2,2 h1.4 M2.6,1.5 h1.4',
};

/**
 * A wind rose: sixteen points, the eight principal ones long. Each point is
 * two halves, one cut in ink and one left paper, which is how the engraver
 * shaded them. Returns the ink halves and the paper halves as two paths.
 */
export function windRose(r: number): { ink: string; paper: string; ring: number } {
  const ink: string[] = [];
  const paper: string[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8;
    const long = i % 2 === 0;
    const len = long ? (i % 4 === 0 ? r : r * 0.72) : r * 0.5;
    const half = long ? r * 0.13 : r * 0.08;
    const tip = [Math.sin(a) * len, -Math.cos(a) * len];
    const left = [Math.sin(a - Math.PI / 2) * half, -Math.cos(a - Math.PI / 2) * half];
    const right = [-left[0], -left[1]];
    const p = (q: number[]) => `${q[0].toFixed(2)},${q[1].toFixed(2)}`;
    ink.push(`M0,0 L${p(left)} L${p(tip)} Z`);
    paper.push(`M0,0 L${p(right)} L${p(tip)} Z`);
  }
  return { ink: ink.join(' '), paper: paper.join(' '), ring: r * 0.62 };
}

/** The seas by their names on charts of the time, where to letter them, and how big (degrees). */
export const SEA_NAMES: { name: string; at: [number, number]; size: number }[] = [
  { name: 'Mar del Nort', at: [-42, 33], size: 3 },
  { name: 'Oceanus Æthiopicus', at: [-14, -22], size: 3 },
  { name: 'Mar del Sur', at: [-118, -12], size: 3.4 },
  { name: 'Mare Pacificum', at: [-165, 22], size: 3.4 },
  { name: 'Oceanus Indicus', at: [78, -18], size: 3.2 },
  { name: 'Mare Magellanicum', at: [-55, -50], size: 2.2 },
  { name: 'Mar de las Antillas', at: [-74, 14.5], size: 1.4 },
  { name: 'Golfo de Mexico', at: [-91, 25], size: 1.3 },
  { name: 'Mare Mediterraneum', at: [17, 34.3], size: 1.3 },
  { name: 'Mare Germanicum', at: [3, 56.5], size: 1 },
  { name: 'Mare Arabicum', at: [63, 14], size: 1.5 },
  { name: 'Sinus Gangeticus', at: [88, 15], size: 1.3 },
  { name: 'Mare Sinense', at: [114, 13], size: 1.3 },
];

/** Where the wind roses sit, from which the rhumb lines fan across each ocean. */
export const ROSES: [number, number][] = [
  [-36, 24],
  [-22, -26],
  [74, -14],
  [-140, 8],
  [160, 22],
];

/** The thirty-two rhumbs from a rose, as line ends `len` degrees out. */
export function rhumbs(len: number): [number, number][] {
  return Array.from({ length: 32 }, (_, i) => {
    const a = (i * Math.PI) / 16;
    return [Math.sin(a) * len, -Math.cos(a) * len];
  });
}

/** Ink, faded toward the sea, for the water lines further out: k of n. */
export function fade(ink: [number, number, number], sea: [number, number, number], k: number, n: number): string {
  const t = (k / (n + 1)) ** 0.8;
  const c = ink.map((v, i) => Math.round(v + (sea[i] - v) * t));
  return `rgb(${c.join(',')})`;
}
