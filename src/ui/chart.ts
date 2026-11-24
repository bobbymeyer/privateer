/**
 * What the route chart and the logbook's chart both draw: the world's coasts,
 * coarse enough for a chart of the whole world, and a leg's way from one
 * landmark to the next along the lanes.
 */

import sea from '../world/data/sea.json';
import { FAR, type NodeId, type SeaMap } from '../world/map.ts';

/** The world from 180°W to 180°E, and from the Arctic to below the Horn. */
export const BOUNDS = { W: -180, E: 180, N: 72, S: -60 } as const;
export const X = (lon: number) => lon;
export const Y = (lat: number) => -lat;

/** The coast, as one path, packed at build time with the sea (survey.ts `coastPath`). */
export const coastPath = (sea as { coast: string }).coast;

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
