/** Geometry on the sphere: longitude and latitude in degrees, distances in nautical miles. */

export type LonLat = [number, number];

export const R_NM = 3440.065;
const RAD = Math.PI / 180;

export const wrapLon = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180;

/** Great-circle distance, nautical miles. */
export function distanceNm([lon1, lat1]: LonLat, [lon2, lat2]: LonLat): number {
  const c = Math.sin(lat1 * RAD) * Math.sin(lat2 * RAD) + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.cos((lon2 - lon1) * RAD);
  return Math.acos(Math.max(-1, Math.min(1, c))) * R_NM;
}

/** The point `t` of the way along the great circle a→b. */
export function along(a: LonLat, b: LonLat, t: number): LonLat {
  const p = vec(a);
  const q = vec(b);
  const w = Math.acos(Math.max(-1, Math.min(1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2])));
  if (w < 1e-9) return a;
  const [s1, s2] = [Math.sin((1 - t) * w) / Math.sin(w), Math.sin(t * w) / Math.sin(w)];
  const v = [p[0] * s1 + q[0] * s2, p[1] * s1 + q[1] * s2, p[2] * s1 + q[2] * s2];
  return [Math.atan2(v[1], v[0]) / RAD, Math.asin(Math.max(-1, Math.min(1, v[2]))) / RAD];
}

function vec([lon, lat]: LonLat): number[] {
  return [Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.cos(lat * RAD) * Math.sin(lon * RAD), Math.sin(lat * RAD)];
}

/** The way you set off from a toward b, as a unit [east, north]. */
export function heading([lon1, lat1]: LonLat, [lon2, lat2]: LonLat): [number, number] {
  const dl = (lon2 - lon1) * RAD;
  const east = Math.sin(dl) * Math.cos(lat2 * RAD);
  const north = Math.cos(lat1 * RAD) * Math.sin(lat2 * RAD) - Math.sin(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.cos(dl);
  const len = Math.hypot(east, north) || 1;
  return [east / len, north / len];
}

/** A compass bearing, degrees, as a unit [east, north]. */
export const bearing = (deg: number): [number, number] => [Math.sin(deg * RAD), Math.cos(deg * RAD)];

/**
 * Where `p` sits from `origin` on a flat local chart, in degrees of latitude:
 * east squeezed by the cosine of the latitude, and wrapped across the dateline.
 */
export function local(origin: LonLat, p: LonLat): [number, number] {
  return [wrapLon(p[0] - origin[0]) * Math.cos(origin[1] * RAD), p[1] - origin[1]];
}
