/** The packed sea is the surveyed sea: what the browser loads is what the survey made. Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadMap, unpackSea } from './map.ts';
import { buildMap, packSea } from './survey.ts';
import sea from './data/sea.json' with { type: 'json' };

const surveyed = buildMap();
const loaded = loadMap();

test('the packing on disk is up to date: `npm run bake` after changing the sea', () => {
  assert.deepEqual(packSea(surveyed), sea, 'src/world/data/sea.json is stale');
});

test('every node the voyage can reach is where the survey put it, with its port, strait, bank, river, guns and waters', () => {
  assert.equal(loaded.nodes.length, surveyed.nodes.length);
  let placed = 0;
  for (const n of surveyed.nodes) {
    const m = loaded.nodes[n.id];
    if (!Number.isNaN(m.lon)) {
      assert.equal(m.lon, n.lon, `lon of ${n.id}`);
      assert.equal(m.lat, n.lat, `lat of ${n.id}`);
      placed++;
    }
    assert.equal(m.kind, n.kind, `kind of ${n.id}`);
    assert.deepEqual(m.port, n.port, `port at ${n.id}`);
    for (const key of ['strait', 'shoal', 'river', 'guns', 'waters'] as const) assert.equal(m[key], n[key], `${key} at ${n.id}`);
  }
  // Only day-steps off the lanes go without a place: never sailed, never drawn.
  for (const [a, b] of surveyed.lanes) for (const id of [a, b]) assert.ok(!Number.isNaN(loaded.nodes[id].lon), `lane node ${id} placed`);
  assert.ok(placed >= (sea as { kinds: string }).kinds.length, 'every node of the world graph placed');
});

test('the same lanes, the same landmarks, the same days between them', () => {
  // In the same order, too: a ship takes the first neighbour a day nearer, so the order is the route.
  const key = (adj: number[][]) => adj.map((out) => out.join(',')).join(';');
  assert.equal(key(loaded.adj), key(surveyed.adj));
  assert.equal(key(loaded.deep.adj), key(surveyed.deep.adj));
  assert.deepEqual(loaded.landmarks, surveyed.landmarks);
  for (const k of Object.keys(surveyed.landmarks)) assert.deepEqual(loaded.distTo(loaded.landmarks[k]), surveyed.distTo(surveyed.landmarks[k]), k);
});

test('unpacking twice gives the same sea', () => {
  const again = unpackSea(packSea(surveyed));
  assert.equal(again.nodes.length, loaded.nodes.length);
  assert.deepEqual(again.landmarks, loaded.landmarks);
});
