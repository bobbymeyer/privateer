/** The world graph in data/world.json. Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import world from './data/world.json' with { type: 'json' };
import { DRAKE } from './drake.ts';
import { PASSAGES } from './passages.ts';

const nodes = world.nodes as [number, number, number][];
const adj: number[][] = nodes.map(() => []);
for (let i = 0; i < world.edges.length; i += 2) {
  adj[world.edges[i]].push(world.edges[i + 1]);
  adj[world.edges[i + 1]].push(world.edges[i]);
}
const R = Math.PI / 180;
const angle = (a: [number, number], b: [number, number]) =>
  Math.acos(Math.min(1, Math.sin(a[1] * R) * Math.sin(b[1] * R) + Math.cos(a[1] * R) * Math.cos(b[1] * R) * Math.cos((a[0] - b[0]) * R)));
const nearest = (at: [number, number]) => nodes.reduce((best, n, i) => (angle(at, [n[0], n[1]]) < angle(at, [nodes[best][0], nodes[best][1]]) ? i : best), 0);
const hops = (from: number) => {
  const d = new Int32Array(nodes.length).fill(-1);
  d[from] = 0;
  const q = [from];
  for (let i = 0; i < q.length; i++) for (const m of adj[q[i]]) if (d[m] < 0) (d[m] = d[q[i]] + 1, q.push(m));
  return d;
};

test('one ocean: every node reaches every other', () => {
  assert.ok(!hops(0).includes(-1));
});

test('the coast is where the nodes are', () => {
  const coast = nodes.filter((n) => n[2] === 0).length;
  assert.ok(coast / nodes.length > 0.4, `${coast} of ${nodes.length} on the coast`);
});

test('every passage survived the build', () => {
  for (const p of PASSAGES) assert.ok((world.passages as Record<string, number[]>)[p.name].length > 1, p.name);
});

test('Drake can sail round the world the way he went', () => {
  const stops = DRAKE.map((d) => nearest(d.at));
  for (let k = 0; k < stops.length - 1; k++) {
    assert.ok(hops(stops[k])[stops[k + 1]] > 0 || stops[k] === stops[k + 1], `${DRAKE[k].name} → ${DRAKE[k + 1].name}`);
  }
});

test('the Strait of Magellan is the short way from Atlantic to Pacific', () => {
  const east = nearest([-68.3, -52.35]);
  const west = nearest([-74.6, -52.7]);
  const strait = (world.passages as Record<string, number[]>)['Strait of Magellan'];
  assert.ok(hops(east)[west] <= strait.length + 2, `through the strait: ${hops(east)[west]} legs`);
});
