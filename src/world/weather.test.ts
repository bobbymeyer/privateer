/** The days at sea: rain, fish, calms, williwaws, fever, foul water, weevils. Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { continueOn } from './course.ts';
import { choices, choose } from './dilemmas.ts';
import { aDay } from './events.ts';
import { doldrums, inStrait, noWay } from './weather.ts';
import { createSea, createWorld, type WorldState } from './world.ts';
import { victualled } from './testing.ts';

const sea = createSea();
const { map } = sea;
const node = (lon: number, lat: number) =>
  map.nodes.filter((n) => !n.port && map.adj[n.id].length).sort((a, b) => Math.hypot(a.lon - lon, a.lat - lat) - Math.hypot(b.lon - lon, b.lat - lat))[0].id;
const fresh = (over: Partial<WorldState> = {}): WorldState => ({ ...victualled(createWorld(sea, 1)), ...over });

/** Days at a place, with every choice answered by its first. */
function lie(w: WorldState, days: number): WorldState {
  for (let d = 0; d < days; d++) {
    w = aDay(sea, { ...w, turn: w.turn + 1 });
    if (w.dilemma) w = choose(sea, w, choices(w, w.dilemma)[0].key);
    if (w.sunk) break;
  }
  return w;
}

test('in the doldrums, calms come on and the ship makes no way', () => {
  const w = fresh({ player: node(-25, 2) });
  assert.ok(doldrums(sea, w));
  const after = lie({ ...w, crew: 1000 }, 200);
  assert.ok(after.log.some((l) => /becalmed/.test(l.text)));
  assert.ok(!doldrums(sea, fresh({ player: node(-25, 30) })));
  // Becalmed, a day's sailing goes nowhere.
  const calm: WorldState = { ...w, calm: w.turn + 3, voyage: { at: 'cape-verde', bound: 'brazil', visited: ['plymouth', 'canaries', 'cape-verde'] } };
  assert.ok(noWay(calm));
  const out = continueOn(sea, calm);
  assert.equal(out.world.player, w.player);
});

test('the williwaws hold you in the Strait, and only there, and only bound through it', () => {
  const at = map.landmarks.strait;
  const bound = fresh({ player: at, voyage: { at: 'san-julian', bound: 'strait', visited: ['plymouth', 'san-julian'] } });
  assert.ok(inStrait(sea, bound));
  assert.ok(!inStrait(sea, { ...bound, voyage: { ...bound.voyage, bound: 'horn' } }));
  const after = lie({ ...bound, crew: 1000 }, 30);
  assert.ok(after.log.filter((l) => /williwaws/.test(l.text)).length >= 5);
});

test('rain fills the casks and fish freshen the crew, in the tropics', () => {
  const w = fresh({ player: node(-30, 10), stores: { food: 1e6, water: 2000, spares: 0, powder: 0 }, fresh: 30, crew: 10 });
  const after = lie(w, 100);
  assert.ok(after.log.some((l) => /rain squall/.test(l.text)));
  assert.ok(after.log.some((l) => /bonito|flying fish|turtle|boobies/.test(l.text)));
});

test('fever, foul water and weevils ask, and say what they cost', () => {
  const w = fresh({ player: node(-30, 10), crew: 30, stores: { food: 1000, water: 1000, spares: 0, powder: 0 } });
  const fever = { ...w, dilemma: { kind: 'fever' as const } };
  assert.deepEqual(choices(fever, fever.dilemma).map((c) => c.key), ['press', 'nurse']);
  const nursed = choose(sea, fever, 'nurse');
  assert.ok(nursed.crew >= 29);
  assert.ok(noWay(nursed));
  const pressed = choose(sea, fever, 'press');
  assert.ok(pressed.crew <= 28 && pressed.crew >= 25);
  const foul = { ...w, dilemma: { kind: 'foul' as const } };
  assert.equal(choose(sea, foul, 'heave').stores.water, 500);
  assert.ok(choose(sea, foul, 'drink').crew < 30);
  const weevils = { ...w, dilemma: { kind: 'weevils' as const } };
  assert.equal(choose(sea, weevils, 'heave').stores.food, 750);
  let sick = 0;
  for (let rng = 0; rng < 200; rng++) sick += 30 - choose(sea, { ...weevils, rng }, 'eat').crew;
  assert.ok(sick > 30 && sick < 100, `${sick} hands of 200 sickened of the weevils`);
});

test('over a long voyage the way asks things of you, and costs hands', () => {
  const w = fresh({ player: node(-30, 10), crew: 1000 });
  const after = lie(w, 800);
  for (const what of ['fever aboard', 'gone foul', 'weevils']) assert.ok(after.log.some((l) => l.text.includes(what)), what);
  assert.ok(after.crew < 1000);
});
