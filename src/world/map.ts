/**
 * The sea as a graph: the triangular grid's water cells, joined to their
 * water neighbours, tagged with what the coast makes of them. Built once,
 * deterministically, from the grid, the land mask and the history in
 * caribbean.ts.
 */

import { MARKS, type Nation, OUTSIDE, PORTS, RIVERS, SHOALS, STRAITS } from './caribbean.ts';
import land from './data/land.json' with { type: 'json' };
import { COLS, ROWS, cellLonLat, cellNeighbours, cellXY, project } from './grid.ts';

export type NodeId = number;

export interface Port {
  name: string;
  nation: Nation;
  fort: boolean;
}

export interface SeaNode {
  id: NodeId;
  col: number;
  row: number;
  lon: number;
  lat: number;
  /** Projected, for drawing and for headings. */
  x: number;
  y: number;
  port: Port | null;
  /** Next to land. */
  coast: boolean;
  /** In a named narrows. */
  strait: string | null;
  /** On a bank too shallow for deep keels. */
  shoal: string | null;
  /** At a river's mouth. */
  river: string | null;
  /** Under the guns of this port's fort. */
  guns: string | null;
  /** Where the Atlantic begins, for ships to or from Europe. */
  mark: string | null;
}

export interface Graph {
  adj: NodeId[][];
  /** Hops between every pair of nodes; Infinity where there is no way. */
  dist: number[][];
}

export interface SeaMap extends Graph {
  nodes: SeaNode[];
  /** The same sea for deep keels: no banks. */
  deep: Graph;
  /** Coastline rings for drawing, longitude and latitude. */
  coast: [number, number][][];
}

/** A cell is land with four or more of its seven samples on land. */
const landAt = (col: number, row: number) => Number(land.land[row * COLS + col]);
/** Land, or water that belongs to another sea. */
const isLand = (col: number, row: number) =>
  landAt(col, row) >= 4 || OUTSIDE.some((o) => inPolygon(cellLonLat(col, row), o.outline));

export function buildMap(): SeaMap {
  if (land.cols !== COLS || land.rows !== ROWS) throw new Error('land.json is for another grid; run npm run coast');

  // Water cells, then only the largest connected body of them: lagoons and
  // lakes cut off by land on this grid are not sea.
  const index = new Map<string, number>();
  const cells: [number, number][] = [];
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) if (!isLand(col, row)) cells.push([col, row]);
  const key = (c: number, r: number) => `${c},${r}`;
  const water = new Set(cells.map(([c, r]) => key(c, r)));
  const seen = new Set<string>();
  let body: [number, number][] = [];
  for (const start of cells) {
    if (seen.has(key(...start))) continue;
    const comp = [start];
    seen.add(key(...start));
    for (let i = 0; i < comp.length; i++) {
      for (const [c, r] of cellNeighbours(...comp[i])) {
        const k = key(c, r);
        if (water.has(k) && !seen.has(k)) (seen.add(k), comp.push([c, r]));
      }
    }
    if (comp.length > body.length) body = comp;
  }
  body.sort((a, b) => a[1] - b[1] || a[0] - b[0]);

  const nodes: SeaNode[] = body.map(([col, row], id) => {
    index.set(key(col, row), id);
    const [lon, lat] = cellLonLat(col, row);
    const [x, y] = cellXY(col, row);
    const coast = landAt(col, row) > 0 || cellNeighbours(col, row).some(([c, r]) => isLand(c, r));
    const shoal = SHOALS.find((s) => inPolygon([lon, lat], s.outline))?.name ?? null;
    return { id, col, row, lon, lat, x, y, port: null, coast, strait: null, shoal, river: null, guns: null, mark: null };
  });
  const adj = nodes.map((n) =>
    cellNeighbours(n.col, n.row)
      .map(([c, r]) => index.get(key(c, r)))
      .filter((m): m is number => m !== undefined),
  );

  const nearest = (lon: number, lat: number, taken = new Set<NodeId>()) => {
    const [px, py] = project(lon, lat);
    let best = -1;
    let bestD = Infinity;
    for (const n of nodes) {
      const d = Math.hypot(n.x - px, n.y - py);
      if (d < bestD && !taken.has(n.id)) [best, bestD] = [n.id, d];
    }
    return best;
  };

  const taken = new Set<NodeId>();
  for (const p of PORTS) {
    const id = nearest(p.at[0], p.at[1], taken);
    taken.add(id);
    nodes[id].port = { name: p.name, nation: p.nation, fort: p.fort };
    nodes[id].coast = true;
  }
  for (const s of STRAITS) {
    const [px, py] = project(...s.at);
    for (const n of nodes) if (Math.hypot(n.x - px, n.y - py) <= 0.9) n.strait = s.name;
  }
  for (const r of RIVERS) nodes[nearest(...r.at)].river = r.name;
  for (const [name, at] of Object.entries(MARKS)) nodes[nearest(...at, taken)].mark = name;
  for (const n of nodes) {
    if (!n.port?.fort) continue;
    for (const m of [n.id, ...adj[n.id]]) nodes[m].guns ??= n.port.name;
  }

  const deepAdj = adj.map((out, i) => (nodes[i].shoal && !nodes[i].port ? [] : out.filter((m) => !nodes[m].shoal || nodes[m].port)));
  return {
    nodes,
    adj,
    dist: allPairs(adj),
    deep: { adj: deepAdj, dist: allPairs(deepAdj) },
    coast: land.coast as [number, number][][],
  };
}

function allPairs(adj: NodeId[][]): number[][] {
  return adj.map((_, from) => {
    const dist = adj.map(() => Infinity);
    dist[from] = 0;
    const queue = [from];
    for (let i = 0; i < queue.length; i++) {
      for (const m of adj[queue[i]]) {
        if (dist[m] === Infinity) {
          dist[m] = dist[queue[i]] + 1;
          queue.push(m);
        }
      }
    }
    return dist;
  });
}

function inPolygon([x, y]: [number, number], poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Every node exactly `k` hops from `from`. */
export function ring(map: SeaMap, from: NodeId, k: number): NodeId[] {
  return map.nodes.filter((n) => map.dist[from][n.id] === k).map((n) => n.id);
}

export const ports = (map: SeaMap) => map.nodes.filter((n) => n.port !== null).map((n) => n.id);

/** A port, or a mark where the Atlantic begins, by name. */
export const portNamed = (map: SeaMap, name: string): NodeId => {
  const n = map.nodes.find((x) => x.port?.name === name || x.mark === name);
  if (!n) throw new Error(`no port or mark ${name}`);
  return n.id;
};
