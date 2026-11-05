/** Storms that drive you onto an island. Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { continueOn } from './course.ts';
import { choose } from './dilemmas.ts';
import { HOME_LANDMARK, LANDMARKS } from './landmarks.ts';
import { FAR } from './map.ts';
import { LANDFALL_WATERS, landfallFor } from './landfalls.ts';
import { landmarkHere } from './stores.ts';
import { createSea, createWorld, type WorldState } from './world.ts';
import { victualled } from './testing.ts';

const sea = createSea();
const { map } = sea;
const node = (lon: number, lat: number) =>
  map.nodes.filter((n) => !n.port && map.adj[n.id].length).sort((a, b) => Math.hypot(a.lon - lon, a.lat - lat) - Math.hypot(b.lon - lon, b.lat - lat))[0].id;
/** In a storm, at sea, bound home from Sierra Leone. */
const storm = (lon: number, lat: number, over: Partial<WorldState> = {}): WorldState => ({
  ...victualled(createWorld(sea, 1)),
  player: node(lon, lat),
  crew: 40,
  voyage: { at: 'sierra-leone', bound: HOME_LANDMARK, visited: ['plymouth', 'sierra-leone'] },
  dilemma: { kind: 'storm' },
  ...over,
});

test('each island lies in its own waters, on the lanes, with a way on to every landmark', () => {
  for (const l of LANDMARKS.filter((x) => x.landfall)) {
    const n = map.nodes[map.landmarks[l.key]];
    const [w, s, e, nn] = LANDFALL_WATERS[l.key];
    assert.ok(n.lon >= w && n.lon <= e && n.lat >= s && n.lat <= nn, `${l.key} in its waters`);
    assert.ok(map.adj[map.landmarks[l.key]].length > 0, `${l.key} on the lanes`);
    for (const k of LANDMARKS.filter((x) => !x.landfall)) assert.ok(map.distTo(map.landmarks[k.key])[map.landmarks[l.key]] < FAR, `${l.key} → ${k.key}`);
  }
});

test('the chance: about one storm in eight in an island’s waters, one in five running before it, none elsewhere', () => {
  const count = (s: WorldState, key: string) => {
    let n = 0;
    for (let rng = 0; rng < 800; rng++) if (choose(sea, { ...s, rng }, key).landfall) n++;
    return n / 800;
  };
  const off = storm(-66, 31);
  assert.equal(landfallFor(sea, off)?.key, 'bermuda');
  const ride = count(off, 'ride');
  const run = count(off, 'run');
  assert.ok(ride > 0.08 && ride < 0.17, `ride ${ride}`);
  assert.ok(run > 0.15 && run < 0.26, `run ${run}`);
  assert.equal(count(storm(-30, 45), 'run'), 0, 'mid-Atlantic, no island');
});

test('driven ashore: placed on the island, the days gone, bound where you were, and you sail on from it', () => {
  let s: WorldState | null = null;
  for (let rng = 0; rng < 200 && !s; rng++) {
    const w = choose(sea, { ...storm(-66, 31), rng }, 'run');
    if (w.landfall) s = w;
  }
  assert.ok(s);
  const before = storm(-66, 31);
  assert.equal(s!.player, map.landmarks.bermuda);
  assert.ok(s!.turn >= before.turn + 2);
  assert.equal(s!.voyage.bound, HOME_LANDMARK);
  assert.ok(s!.seen.includes('bermuda'));
  assert.ok(s!.log.some((l) => /onto Bermuda/.test(l.text)));
  assert.equal(landmarkHere(sea, s!)?.key, 'bermuda');
  assert.ok(landmarkHere(sea, s!)!.offers.shore!.includes('careen'));
  const on = continueOn(sea, { ...s!, calm: 0, dilemma: null }).world;
  assert.ok(map.distTo(map.landmarks[HOME_LANDMARK])[on.player] < map.distTo(map.landmarks[HOME_LANDMARK])[s!.player] || on.dilemma || on.hail || on.encounter);
});

test('once a run', () => {
  assert.equal(landfallFor(sea, storm(-66, 31, { seen: ['bermuda'] })), null);
});

test('the Galápagos: tortoises for weeks, and little water', () => {
  let s: WorldState | null = null;
  for (let rng = 0; rng < 300 && !s; rng++) {
    const w = choose(sea, { ...storm(-91, -2, { fresh: 50, stores: { food: 10, water: 1e6, spares: 0, powder: 0 }, voyage: { at: 'cacafuego', bound: 'guatulco', visited: ['plymouth', 'cacafuego'] } }), rng }, 'run');
    if (w.landfall) s = w;
  }
  assert.equal(s!.landfall, 'galapagos');
  assert.equal(s!.fresh, 0);
  assert.ok(s!.stores.food > 40 * 25);
  assert.ok(!landmarkHere(sea, s!)!.offers.shore!.includes('water'));
});
