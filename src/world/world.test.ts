/** Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { portNamed, ports } from './map.ts';
import { FADE, FADED, makeRumor, markerStrength, maxOff, predict, searchArea } from './rumors.ts';
import { movesOn } from './ships.ts';
import { PORTS, ROUTES, STRAITS } from './caribbean.ts';
import { KX } from './grid.ts';
import { advance, createSea, createWorld, hearRumor, learn } from './world.ts';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

test('the sea is built once and shared', () => {
  assert.equal(createSea(), createSea());
  const { map } = createSea();
  assert.ok(map.nodes.length > 500 && map.nodes.length < 1000, `${map.nodes.length} nodes`);
});

test('one sea: every node reaches every other, and every port has its own node', () => {
  const { map } = createSea();
  for (const row of map.dist) for (const d of row) assert.ok(Number.isFinite(d));
  assert.equal(new Set(ports(map)).size, PORTS.length);
  for (const id of ports(map)) assert.ok(map.nodes[id].coast, `${map.nodes[id].port!.name} is on the coast`);
});

test('every port sits near where it really is', () => {
  const { map } = createSea();
  for (const def of PORTS) {
    const n = map.nodes[portNamed(map, def.name)];
    const off = Math.hypot((n.lon - def.at[0]) * KX, n.lat - def.at[1]);
    assert.ok(off < 1.6, `${def.name} is ${off.toFixed(2)}° off`);
  }
});

test('deep keels keep off the banks but can still make every course', () => {
  const { map } = createSea();
  const shoals = map.nodes.filter((n) => n.shoal && !n.port);
  assert.ok(shoals.length > 5, 'the banks are on the map');
  for (const n of shoals) assert.equal(map.deep.adj[n.id].length, 0);
  for (const course of Object.values(ROUTES)) {
    for (const a of course) for (const b of course) assert.ok(Number.isFinite(map.deep.dist[portNamed(map, a)][portNamed(map, b)]), `${a} → ${b}`);
  }
});

test('the Gulf Stream runs north up the Florida coast', () => {
  const { map, pattern } = createSea();
  const offFlorida = map.nodes.filter((n) => n.lat > 25 && n.lat < 29 && n.lon > -80.6 && n.lon < -79);
  assert.ok(offFlorida.length > 0);
  for (const n of offFlorida) assert.ok(pattern.current[n.id][1] > 0.5, `current at ${n.lon.toFixed(1)},${n.lat.toFixed(1)} sets north`);
});

test('the named passages are on the map', () => {
  const { map } = createSea();
  for (const s of STRAITS) assert.ok(map.nodes.some((n) => n.strait === s.name), s.name);
});

test('you can only sail to a neighbour or stay', () => {
  const sea = createSea();
  const w = createWorld(sea, 1);
  const far = sea.map.nodes.find((n) => sea.map.dist[w.player][n.id] > 1)!;
  assert.throws(() => advance(sea, w, far.id));
  assert.doesNotThrow(() => advance(sea, w, w.player));
  assert.doesNotThrow(() => advance(sea, w, sea.map.adj[w.player][0]));
});

test('ships sail one leg at a time, and slow ones only on even turns', () => {
  const sea = createSea();
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
    const sea = createSea();
    const w = createWorld(sea, seed);
    const ship = w.ships[seed % w.ships.length];
    assert.equal(makeRumor(sea, { rng: seed }, 0, ship, 0, 1).reported, ship.node);
    const bad = makeRumor(sea, { rng: seed }, 0, ship, 0, 0);
    const off = sea.map.dist[ship.node][bad.reported];
    assert.ok(off >= 1 && off <= maxOff(0), `off by ${off}`);
  }
});

test('markers fade each turn and are dropped once faded', () => {
  const sea = createSea();
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
  const sea = createSea();
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
    const sea = createSea();
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
    const sea = createSea();
    let w = createWorld(sea, seed);
    const hunter = w.ships.find((s) => s.kind === 'hunter')!;
    before += sea.map.dist[hunter.node][w.player];
    for (let i = 0; i < 30; i++) {
      const was = w.ships[hunter.id].node;
      w = advance(sea, w, w.player);
      if (was === w.player) assert.equal(w.ships[hunter.id].node, w.player, 'found you, stays');
    }
    after += sea.map.dist[w.ships[hunter.id].node][w.player];
  }
  assert.ok(after < before / 2, `mean distance ${before / 40} → ${after / 40}`);
});

test('learning the sea is remembered', () => {
  const sea = createSea();
  const w = learn(createWorld(sea, 1), { currents: true });
  assert.deepEqual(w.know, { currents: true, winds: false });
});
