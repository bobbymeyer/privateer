/**
 * What the route chart and the logbook's chart both draw: the world's coasts,
 * coarse enough for a chart of the whole world, and a leg's way from one
 * landmark to the next along the lanes.
 */

import coast from '../world/data/coast.json';
import { FAR, type NodeId, type SeaMap } from '../world/map.ts';

/** The world from 180°W to 180°E, and from the Arctic to below the Horn. */
export const BOUNDS = { W: -180, E: 180, N: 72, S: -60 } as const;
export const X = (lon: number) => lon;
export const Y = (lat: number) => -lat;

/** The coast, as one path, drawn once. */
export const coastPath = (() => {
  let d = '';
  for (const r of coast.rings as number[][]) {
    let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
    for (let i = 0; i < r.length; i += 2) [w, s, e, n] = [Math.min(w, r[i]), Math.min(s, r[i + 1]), Math.max(e, r[i]), Math.max(n, r[i + 1])];
    if (e - w < 0.8 && n - s < 0.8) continue;
    let [lx, ly] = [r[0], r[1]];
    d += `M${lx.toFixed(1)},${(-ly).toFixed(1)}`;
    for (let i = 2; i < r.length; i += 2) {
      if (Math.abs(r[i] - lx) < 0.35 && Math.abs(r[i + 1] - ly) < 0.35) continue;
      [lx, ly] = [r[i], r[i + 1]];
      d += `L${lx.toFixed(1)},${(-ly).toFixed(1)}`;
    }
    d += 'Z';
  }
  return d;
})();

/** A leg's way along the lanes, as a path broken where it crosses the edge of the chart. */
export function legPath(map: SeaMap, a: NodeId, b: NodeId): string {
  const d = map.distTo(b);
  if (d[a] >= FAR) return '';
  let at = a;
  let path = `M${X(map.nodes[at].lon)},${Y(map.nodes[at].lat)}`;
  for (let guard = 0; at !== b && guard < 2000; guard++) {
    const next = map.adj[at].find((m) => d[m] === d[at] - 1);
    if (next === undefined) break;
    const [p, q] = [map.nodes[at], map.nodes[next]];
    path += `${Math.abs(q.lon - p.lon) > 180 ? 'M' : 'L'}${X(q.lon)},${Y(q.lat)}`;
    at = next;
  }
  return path;
}
