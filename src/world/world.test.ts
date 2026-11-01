/** Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ports } from './map.ts';
import { FADE, FADED, makeRumor, markerStrength, maxOff, predict, searchArea } from './rumors.ts';
import { HABITS, movesOn } from './ships.ts';
import { advance, createSea, createWorld, hearRumor, learn } from './world.ts';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

test('the same seed makes the same sea', () => {
  assert.deepEqual(createSea(5), createSea(5));
  assert.notDeepEqual(createSea(5).map.adj, createSea(6).map.adj);
});

test('every node can reach every other, and there are six ports', () => {
  for (let seed = 0; seed < 50; seed++) {
    const { map } = createSea(seed);
    for (const row of map.dist) for (const d of row) assert.ok(Number.isFinite(d), `seed ${seed}`);
    assert.equal(new Set(ports(map)).size, 6);
  }
});

test('you can only sail to a neighbour or stay', () => {
  const sea = createSea(1);
  const w = createWorld(sea, 1);
  const far = sea.map.nodes.find((n) => sea.map.dist[w.player][n.id] > 1)!;
  assert.throws(() => advance(sea, w, far.id));
  assert.doesNotThrow(() => advance(sea, w, w.player));
  assert.doesNotThrow(() => advance(sea, w, sea.map.adj[w.player][0]));
});

test('ships sail one leg at a time, and slow ones only on even turns', () => {
  const sea = createSea(2);
  let w = createWorld(sea, 2);
  for (let i = 0; i < 30; i++) {
    const next = advance(sea, w, w.player);
    w.ships.forEach((ship, k) => {
      const to = next.ships[k].node;
      assert.ok(to === ship.node || sea.map.adj[ship.node].includes(to));
      if (!movesOn(ship.kind, w.turn)) assert.equal(to, ship.node);
    });
    w = next;
  }
});

test('a sure rumor is exact; a bad one is off, but not by more than it may be', () => {
  for (let seed = 0; seed < 40; seed++) {
    const sea = createSea(seed);
    const w = createWorld(sea, seed);
    const ship = w.ships[seed % w.ships.length];
    assert.equal(makeRumor(sea, { rng: seed }, 0, ship, 0, 1).reported, ship.node);
    const bad = makeRumor(sea, { rng: seed }, 0, ship, 0, 0);
    const off = sea.map.dist[ship.node][bad.reported];
    assert.ok(off >= 1 && off <= maxOff(0), `off by ${off}`);
  }
});

test('markers fade each turn and are dropped once faded', () => {
  const sea = createSea(3);
  let w = hearRumor(sea, createWorld(sea, 3), 0, 0.9);
  const rumor = w.rumors[0];
  assert.equal(markerStrength(rumor, rumor.turn + 1), 0.9 * FADE);
  let turns = 0;
  while (w.rumors.length) {
    assert.ok(markerStrength(w.rumors[0], w.turn) >= FADED);
    w = advance(sea, w, w.player);
    turns++;
  }
  assert.equal(turns, Math.ceil(Math.log(FADED / 0.9) / Math.log(FADE)));
});

test('a prediction is a probability over the sea, and starts at the report', () => {
  const sea = createSea(4);
  let w = createWorld(sea, 4);
  w = hearRumor(sea, w, 1, 1);
  const rumor = w.rumors[0];
  const now = predict(sea, rumor, w.turn, w.know, w.player);
  assert.ok(Math.abs(now[rumor.reported] - 1) < 1e-9);
  for (let i = 0; i < 6; i++) w = advance(sea, w, w.player);
  for (const know of [{ currents: false, winds: false }, { currents: true, winds: true }]) {
    const later = predict(sea, rumor, w.turn, know, w.player);
    assert.ok(Math.abs(sum(later) - 1) < 1e-9);
    assert.ok(searchArea(later).length > 1, 'it has spread');
  }
});

test('knowing the sea tightens the search', () => {
  // Averaged, since one rumor can go either way.
  let blind = 0;
  let wise = 0;
  for (let seed = 0; seed < 60; seed++) {
    const sea = createSea(seed);
    let w = hearRumor(sea, createWorld(sea, seed), seed % 9, 0.9);
    for (let i = 0; i < 3; i++) w = advance(sea, w, w.player);
    blind += searchArea(predict(sea, w.rumors[0], w.turn, { currents: false, winds: false }, w.player)).length;
    wise += searchArea(predict(sea, w.rumors[0], w.turn, { currents: true, winds: true }, w.player)).length;
  }
  assert.ok(wise < blind * 0.85, `${wise} vs ${blind}`);
});

test('hunters close on you, and stay once they find you', () => {
  let before = 0;
  let after = 0;
  for (let seed = 0; seed < 40; seed++) {
    const sea = createSea(seed);
    let w = createWorld(sea, seed);
    const hunter = w.ships.find((s) => s.kind === 'hunter')!;
    before += sea.map.dist[hunter.node][w.player];
    for (let i = 0; i < 8; i++) {
      const was = w.ships[hunter.id].node;
      w = advance(sea, w, w.player);
      if (was === w.player) assert.equal(w.ships[hunter.id].node, w.player, 'found you, stays');
    }
    after += sea.map.dist[w.ships[hunter.id].node][w.player];
  }
  assert.ok(after < before / 2, `mean distance ${before / 40} → ${after / 40}`);
});

test('learning the sea is remembered', () => {
  const sea = createSea(1);
  const w = learn(createWorld(sea, 1), { currents: true });
  assert.deepEqual(w.know, { currents: true, winds: false });
  assert.ok(HABITS.armada.drift === 1);
});
