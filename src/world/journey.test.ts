/** The voyage: landmarks, forks, raising them, coming home. Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { choices, daysTo, howHome, makeFor, raise } from './journey.ts';
import { HOME_LANDMARK, LANDMARKS, landmark } from './landmarks.ts';
import { FAR } from './map.ts';
import { createSea, createWorld, type WorldState } from './world.ts';

const sea = createSea();
const { map } = sea;

test('every landmark lies on a lane, and every leg can be sailed', () => {
  for (const l of LANDMARKS) {
    const n = map.landmarks[l.key];
    assert.ok(map.adj[n].length, `${l.key} is on a lane`);
    for (const k of l.next) assert.ok(map.distTo(map.landmarks[k])[n] < FAR, `${l.key} → ${k}`);
  }
});

test('Drake’s way, Plymouth to Plymouth round the world, with forks where the captains chose', () => {
  assert.deepEqual(landmark('san-julian').next, ['strait', 'horn']);
  assert.deepEqual(landmark('cacafuego').next, ['guatulco', 'strait-east']);
  assert.deepEqual(landmark('ladrones').next, ['ternate', 'manila']);
  // Every path from Plymouth comes home.
  const ends = new Set<string>();
  const walk = (k: string, seen: string[]) => {
    if (seen.includes(k)) return;
    const next = landmark(k).next;
    if (!next.length) ends.add(k);
    for (const n of next) walk(n, [...seen, k]);
  };
  walk('plymouth', []);
  assert.deepEqual([...ends], [HOME_LANDMARK]);
});

test('from Plymouth only onward; anywhere after, home too', () => {
  const w = createWorld(sea, 1);
  assert.deepEqual(choices(w.voyage), ['canaries']);
  assert.throws(() => makeFor(w, 'plymouth-home'));
  const at = { at: 'san-julian', bound: null, visited: ['plymouth', 'san-julian'] };
  assert.deepEqual(choices(at), ['strait', 'horn', 'plymouth-home']);
  assert.equal(makeFor({ ...w, voyage: at }, 'horn').voyage.bound, 'horn');
  assert.throws(() => makeFor({ ...w, voyage: at }, 'callao'), /can’t make for/);
});

test('raising a landmark: the one you’re bound for, or any of the next', () => {
  const w = createWorld(sea, 1);
  const there: WorldState = { ...w, player: map.landmarks.canaries };
  const raised = raise(sea, there);
  assert.equal(raised.voyage.at, 'canaries');
  assert.deepEqual(raised.voyage.visited, ['plymouth', 'canaries']);
  assert.equal(raised.voyage.bound, null);
  assert.ok(raised.log.some((l) => l.stop && l.text === 'you raise the Canaries'));
  // Somewhere that isn't next: nothing.
  assert.equal(raise(sea, { ...w, player: map.landmarks.callao }).voyage.at, 'plymouth');
});

test('how a voyage came home: round the world, back the way it went, or turned back', () => {
  assert.equal(howHome({ at: 'sierra-leone', bound: null, visited: ['plymouth', 'cape', 'sierra-leone'] }), 'round');
  assert.equal(howHome({ at: 'brazil-home', bound: null, visited: ['plymouth', 'strait-east', 'brazil-home'] }), 'back');
  assert.equal(howHome({ at: 'cape-verde', bound: null, visited: ['plymouth', 'canaries', 'cape-verde'] }), 'turned');
});

test('the days to a landmark are the lanes’ days', () => {
  const w = createWorld(sea, 1);
  const d = daysTo(sea, w, 'canaries');
  assert.ok(d > 10 && d < 60, `${d} days to the Canaries`);
});
