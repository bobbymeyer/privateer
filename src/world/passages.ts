/**
 * Narrow water the coastline graph would miss: straits thinner than the
 * spacing between coastal nodes, which sit offshore and so never fall inside
 * them. Each is traced by hand, end to end, as longitude and latitude; the
 * build threads a chain of nodes along it and joins its ends to the sea.
 *
 * The Strait of Magellan is the one the game cannot do without: Drake went
 * through it in sixteen days in 1578.
 */

export const PASSAGES: { name: string; path: [number, number][] }[] = [
  {
    name: 'Strait of Magellan',
    path: [[-68.3, -52.35], [-69.0, -52.45], [-69.6, -52.55], [-70.2, -52.75], [-70.6, -53.0], [-70.9, -53.4], [-71.25, -53.85], [-71.9, -53.75], [-72.5, -53.5], [-73.1, -53.2], [-73.8, -52.9], [-74.6, -52.7]],
  },
  { name: 'Strait of Gibraltar', path: [[-6.3, 35.95], [-5.75, 35.97], [-5.2, 36.0]] },
  { name: 'Strait of Dover', path: [[2.0, 51.15], [1.45, 50.95], [0.9, 50.7]] },
  { name: 'Øresund', path: [[12.55, 56.1], [12.7, 55.75], [12.85, 55.45]] },
  { name: 'Dardanelles and Bosporus', path: [[26.0, 39.95], [26.4, 40.2], [26.75, 40.4], [27.5, 40.65], [28.4, 40.85], [29.0, 41.05], [29.15, 41.3]] },
  { name: 'Strait of Messina', path: [[15.55, 38.3], [15.62, 38.15], [15.6, 38.0]] },
  { name: 'Bab-el-Mandeb', path: [[43.0, 13.0], [43.35, 12.65], [43.6, 12.4]] },
  { name: 'Strait of Hormuz', path: [[56.1, 26.75], [56.45, 26.55], [56.75, 26.35]] },
  { name: 'Strait of Malacca', path: [[100.2, 3.4], [101.3, 2.4], [102.6, 1.6], [103.6, 1.2], [104.3, 1.25]] },
  { name: 'Sunda Strait', path: [[106.0, -5.75], [105.75, -6.0], [105.35, -6.4]] },
];
