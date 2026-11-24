/** The logbook as a chart. Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TRACK_KEPT, entryFor, type Entry } from './logbook.ts';
import { endedOf, logChart } from './logchart.ts';
import { createSea, createWorld } from './world/world.ts';

const sea = createSea();
const entry = (over: Partial<Entry>): Entry => ({ when: '2026-11-24', seed: 1, daily: null, day: 100, gold: 0, raised: 0, ending: 'sunk', ship: 'sloop', sunkBy: null, taken: 0, sacks: 0, ...over });

test('a logbook entry keeps the voyage’s track, the places claimed, and a pirate’s name', () => {
  const w = { ...createWorld(sea, 1), arms: ['san-julian'], verdict: 'pirate' as const, won: true, voyage: { at: 'plymouth-home', bound: null, visited: ['plymouth', 'canaries', 'cape-verde', 'plymouth-home'] } };
  const e = entryFor(w, 1, null, new Date('2026-11-24'));
  assert.deepEqual(e.track, ['plymouth', 'canaries', 'cape-verde', 'plymouth-home']);
  assert.deepEqual(e.claims, ['san-julian']);
  assert.equal(e.pirate, true);
  const long = entryFor({ ...w, voyage: { ...w.voyage, visited: Array(60).fill('canaries') } }, 1, null, new Date());
  assert.equal(long.track!.length, TRACK_KEPT);
});

test('the chart: each voyage’s legs and how it ended, graves, arms once, and the coasts that remember', () => {
  const log = [
    entry({ ending: 'home', track: ['plymouth', 'canaries', 'cape-verde'], claims: ['san-julian'] }),
    entry({ ending: 'sunk', track: ['plymouth', 'canaries'], claims: ['san-julian', 'nova-albion'] }),
    entry({ ending: 'home', pirate: true, track: ['plymouth', 'canaries'] }),
    entry({ ending: 'abandoned' }),
    entry({ ending: 'sunk', track: ['plymouth', 'nowhere-known'] }),
  ];
  const graves = [{ id: 'a', node: sea.map.landmarks.canaries, place: 'the Canaries', name: 'Thomas Moone', title: 'the gunner', date: '1 January 1581', cause: 'the flux', epitaph: 'x' }];
  const c = logChart(log, graves, { miwok: 'friendly', mapuche: 'hostile' });
  assert.deepEqual(c.tracks.map((t) => [t.index, t.ended, t.legs.length]), [[0, 'home', 2], [1, 'lost', 1], [2, 'pirate', 1]]);
  assert.deepEqual(c.tracks[0].legs, [['plymouth', 'canaries'], ['canaries', 'cape-verde']]);
  assert.deepEqual(c.arms, ['san-julian', 'nova-albion']);
  assert.equal(c.graves.length, 1);
  assert.deepEqual(c.coasts.map((m) => [m.at, m.word]).sort(), [['mocha', 'hostile'], ['nova-albion', 'friendly']]);
  assert.equal(endedOf(entry({ ending: 'retired' })), 'home');
});
