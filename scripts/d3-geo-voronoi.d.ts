declare module 'd3-geo-voronoi' {
  export function geoDelaunay(points: [number, number][]): { edges: [number, number][]; triangles: [number, number, number][] };
}
