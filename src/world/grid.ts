/**
 * The open sea as a triangular grid: every node has six neighbours, rows
 * offset by half a step. Laid over longitude and latitude with longitude
 * squeezed by cos(20°), so the triangles are near enough equilateral on the
 * water around the Caribbean.
 *
 * Pure geometry; which cells are land comes from `data/land.json`, built by
 * `npm run coast` from Natural Earth.
 */

export const BOUNDS = { west: -98, east: -59, south: 8, north: 31 };

/** Degrees of latitude between neighbouring nodes. About sixty nautical miles. */
export const SPACING = 1.0;

const LAT0 = 20;
export const KX = Math.cos((LAT0 * Math.PI) / 180);
const ROW_STEP = (SPACING * Math.sqrt(3)) / 2;

export const ROWS = Math.floor((BOUNDS.north - BOUNDS.south) / ROW_STEP) + 1;
export const COLS = Math.floor(((BOUNDS.east - BOUNDS.west) * KX) / SPACING) + 1;

/** Projected position: x east, y north, both in degrees of latitude. */
export function cellXY(col: number, row: number): [number, number] {
  return [BOUNDS.west * KX + (col + (row % 2) / 2) * SPACING, BOUNDS.south + row * ROW_STEP];
}

export function cellLonLat(col: number, row: number): [number, number] {
  const [x, y] = cellXY(col, row);
  return [x / KX, y];
}

export function project(lon: number, lat: number): [number, number] {
  return [lon * KX, lat];
}

/** The six neighbours of a cell, those inside the grid. */
export function cellNeighbours(col: number, row: number): [number, number][] {
  const shift = row % 2; // odd rows sit half a step east
  const out: [number, number][] = [
    [col - 1, row],
    [col + 1, row],
    [col - 1 + shift, row - 1],
    [col + shift, row - 1],
    [col - 1 + shift, row + 1],
    [col + shift, row + 1],
  ];
  return out.filter(([c, r]) => c >= 0 && c < COLS && r >= 0 && r < ROWS);
}

/**
 * Where a cell's land is sampled: the centre and six points around it.
 * A cell with four or more on land is land.
 */
export function cellSamples(col: number, row: number): [number, number][] {
  const [x, y] = cellXY(col, row);
  const r = SPACING * 0.3;
  const pts: [number, number][] = [[x, y]];
  for (let k = 0; k < 6; k++) pts.push([x + r * Math.cos((k * Math.PI) / 3), y + r * Math.sin((k * Math.PI) / 3)]);
  return pts.map(([px, py]) => [px / KX, py]);
}
