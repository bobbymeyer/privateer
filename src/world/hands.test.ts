/** The hands of note, their graves, the master's warnings, and the dead folded in the log. Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { choose } from './dilemmas.ts';
import { type Named, type Role, ROLES, alive, causeOf, gravesOf, howDied, lossWords, mourn, muster, visitGraves } from './hands.ts';
import { sailSighted } from './meet.ts';
import { ashore, foldDeaths } from './stores.ts';
import { warnings } from './warnings.ts';
import { weatherDay } from './weather.ts';
import { type LogEntry, type WorldState, advance, createSea, createWorld, dateOf } from './world.ts';
import { lyingAt, victualled } from './testing.ts';
import { cleanEpitaph, withEpitaph, withGraves } from '../graves.ts';
import { decode, encode } from '../save.ts';

const sea = createSea();
const { map } = sea;
const without = (w: WorldState, role: Role): WorldState => ({ ...w, hands: w.hands.map((h) => (h.role === role ? { ...h, dead: { turn: 0, node: 0, place: 'Plymouth', cause: 'test' } } : h)) });
const node = (lon: number, lat: number) =>
  map.nodes.filter((n) => !n.port && map.adj[n.id].length).sort((a, b) => Math.hypot(a.lon - lon, a.lat - lat) - Math.hypot(b.lon - lon, b.lat - lat))[0].id;

test('six hands of note, named from the seed, the same each time and different between voyages', () => {
  const a = createWorld(sea, 7).hands;
  assert.deepEqual(a.map((h) => h.role), ROLES);
  assert.equal(new Set(a.map((h) => h.name)).size, 6);
  assert.deepEqual(createWorld(sea, 7).hands, a);
  assert.notDeepEqual(createWorld(sea, 8).hands.map((h) => h.name), a.map((h) => h.name));
  assert.match(a.find((h) => h.role === 'boy')!.name, /^(Will|Jack|Kit|Tom|Dick|Hal|Ned|Robin|Davy|Wat) /);
});

test('when hands die, a named one may be among them, and the log says who and of what', () => {
  const before = createWorld(sea, 3);
  // Every hand aboard dead of thirst: every hand of note with them.
  const after: WorldState = { ...before, crew: 0, log: foldDeaths(before.log, 'thirst', before.crew, 1) };
  const w = mourn(sea, before, after);
  assert.ok(w.hands.every((h) => h.dead?.cause === 'thirst'));
  assert.ok(w.log.some((l) => /^[A-Z][a-z]+ [A-Z][a-z]+, the master, dead of thirst$/.test(l.text)));
  assert.equal(w.losses.thirst, before.crew);
  // Nobody lost, nobody named dies.
  assert.deepEqual(mourn(sea, before, before).hands, before.hands);
});

test('the log tells what took them, and when it was nobody of note', () => {
  const said = (...text: string[]): LogEntry[] => text.map((t) => ({ turn: 1, text: t }));
  assert.equal(causeOf(said('pressing on through the fever: 3 hands dead of it')).cause, 'fever');
  assert.equal(causeOf(said('the foul water drunk, and the flux: 2 hands dead of it')).cause, 'the flux');
  assert.equal(causeOf(said('the fight cost 2 barrels of powder, 3 hands killed')).cause, 'killed in the fight');
  assert.ok(causeOf(said('2 hands paid off to stay in the islands')).left);
  assert.ok(causeOf(said('the gentleman tried before the company and beheaded on the beach')).none);
  assert.equal(causeOf([{ turn: 1, text: 'scurvy: 4 hands dead over 3 days', fold: { kind: 'scurvy', dead: 4, from: 1, to: 3 } }]).cause, 'scurvy');
});

test('the gunner makes powder go further; the boy sights the sail', () => {
  // The gunner: see stores.test.ts, a barrel serves four shots with him and three without.
  let sighted: WorldState | null = null;
  for (let rng = 0; rng < 400 && !sighted; rng++) {
    const w = sailSighted(sea, { ...createWorld(sea, 1), rng, player: node(-12, 40) });
    if (w.hail || w.encounter) sighted = w;
  }
  assert.ok(sighted);
  assert.match(sighted!.log.at(-1)!.text, /sings out from the masthead/);
});

test('the master finds wind a day sooner in the doldrums', () => {
  const calm = (w: WorldState) => {
    let most = 0;
    for (let rng = 0; rng < 600; rng++) {
      const r = { rng };
      const after = weatherDay(sea, { ...w, rng, calm: 0 }, r);
      if (/becalmed in the doldrums/.test(after.log.at(-1)?.text ?? '')) most = Math.max(most, after.calm - after.turn);
    }
    return most;
  };
  const w = victualled({ ...createWorld(sea, 1), player: node(-25, 2) });
  assert.equal(calm(without(w, 'master')), 6);
  assert.equal(calm(w), 5);
});

test('the carpenter mends a point more careening', () => {
  const s = victualled(lyingAt(sea, { ...createWorld(sea, 1), hull: 4, maxHull: 14, stores: { food: 1e9, water: 1e9, spares: 1, powder: 0 } }, 'san-julian'));
  const quiet = (sea_: typeof sea, w: WorldState, to: number) => ({ ...advance(sea_, w, to), dilemma: null, hail: null, encounter: null });
  const withHim = ashore(sea, s, 'careen', quiet);
  const withoutHim = ashore(sea, without(s, 'carpenter'), 'careen', quiet);
  assert.equal(withHim.hull - withoutHim.hull, 1);
});

test('the surgeon often saves one of the fever’s dead; the boatswain one of the deserters', () => {
  const lost = (w: WorldState, kind: 'fever' | 'deserters', key: string) => {
    let m = 0;
    let all = 0;
    for (let rng = 0; rng < 200; rng++) {
      const after = choose(sea, { ...w, rng, dilemma: { kind } }, key);
      m = Math.max(m, w.crew - after.crew);
      all += w.crew - after.crew;
    }
    return { most: m, all };
  };
  const most = (w: WorldState, kind: 'fever' | 'deserters', key: string) => lost(w, kind, key).most;
  const w = { ...createWorld(sea, 1), crew: 40 };
  // About one in two, he saves a man: some 100 of the 700 the fever would take over 200 voyages.
  const fever = { without: lost(without(w, 'surgeon'), 'fever', 'press').all, with: lost(w, 'fever', 'press').all };
  assert.ok(fever.without - fever.with > 60 && fever.without - fever.with < 140, JSON.stringify(fever));
  assert.equal(most(without(w, 'boatswain'), 'deserters', 'go'), 4);
  assert.equal(most(w, 'deserters', 'go'), 3);
});

test('the dead are graves where they fell, and a later voyage passing finds them, once', () => {
  const w = createWorld(sea, 5);
  const cape = map.landmarks['san-julian'];
  const dead: Named[] = w.hands.map((h) => (h.role === 'gunner' ? { ...h, dead: { turn: 90, node: cape, place: 'Port San Julián', cause: 'scurvy' } } : h));
  const graves = gravesOf({ ...w, hands: dead }, 5, dateOf, 'pinnace', 'off Plymouth');
  assert.equal(graves.length, 1);
  assert.equal(graves[0].title, 'the gunner');
  const lost = gravesOf({ ...w, sunk: true }, 5, dateOf, 'pinnace', 'bound for the Canaries');
  assert.equal(lost.at(-1)!.title, 'lost with her hands');
  // Another voyage, lying at San Julián.
  const later = lyingAt(sea, createWorld(sea, 6), 'san-julian');
  const found = visitGraves(sea, later, graves);
  assert.match(found.log.at(-1)!.text, /^a grave on the shore at Port San Julián: .*, the gunner, .*, dead of scurvy\. “.+”$/);
  assert.deepEqual(visitGraves(sea, found, graves).log, found.log, 'once a voyage');
  assert.deepEqual(visitGraves(sea, createWorld(sea, 6), graves).log, createWorld(sea, 6).log, 'not from Plymouth');
});

test('graves kept: each once, newest first, and an epitaph made plain', () => {
  const w = createWorld(sea, 5);
  const g = gravesOf({ ...w, sunk: true }, 5, dateOf, 'pinnace', 'here');
  assert.equal(withGraves(withGraves([], g), g).length, 1);
  assert.equal(cleanEpitaph('  He   served\nhis turn.  '), 'He served his turn.');
  assert.equal(cleanEpitaph('x'.repeat(200)).length, 80);
  assert.equal(withEpitaph(g, g[0].id, 'Lost off the Lizard.')[0].epitaph, 'Lost off the Lizard.');
  assert.equal(withEpitaph(g, g[0].id, '   ')[0].epitaph, g[0].epitaph, 'an empty board keeps the old words');
});

test('the master warns before a leg the water won’t see out; not when stocked, not at sea', () => {
  const w = createWorld(sea, 3);
  const short = warnings(sea, w);
  assert.equal(short.length, 1);
  assert.equal(short[0].kind, 'water');
  assert.equal(short[0].fix, 'buy');
  assert.match(short[0].text, /the master: “the water (won’t|will barely) see us to the Canaries/);
  assert.deepEqual(warnings(sea, { ...w, stores: { ...w.stores, water: 1e6, food: 1e6 } }), []);
  assert.deepEqual(warnings(sea, { ...w, player: node(-12, 40) }), [], 'at sea there is nothing to be done');
  assert.match(warnings(sea, without(w, 'master'))[0].text, /^the water /, 'with the master dead, the plain sum');
  assert.ok(alive(w, 'master'));
});

test('the dying folds into one line: the first stops the ship, the rest run on', () => {
  let log: LogEntry[] = [];
  log = foldDeaths(log, 'thirst', 2, 10);
  assert.ok(log[0].stop);
  assert.match(log[0].text, /men are dying of thirst: 2 hands dead/);
  log = [...foldDeaths(log, 'thirst', 3, 11), { turn: 11, text: 'flying fish come aboard in the night' }];
  log = foldDeaths(log, 'thirst', 1, 12);
  const thirst = log.filter((l) => l.fold?.kind === 'thirst');
  assert.equal(thirst.length, 1);
  assert.equal(thirst[0].text, 'thirst: 6 hands dead over 3 days');
  assert.ok(!thirst[0].stop);
  assert.equal(log.at(-1), thirst[0], 'moved to the end as it grows');
  assert.ok(foldDeaths(log, 'thirst', 1, 30).at(-1)!.stop, 'a new run of it, weeks later, stops her again');
});

test('a voyage from before the hands of note comes forward, mustered', () => {
  const { hands: _h, losses: _l, ...old } = createWorld(sea, 2);
  const text = JSON.stringify({ ...JSON.parse(encode(2, old as WorldState)), version: 15 });
  const saved = decode(text)!;
  assert.equal(saved.world.hands.length, 6);
  assert.deepEqual(saved.world.losses, {});
});

test('how a man died reads as a sentence says it', () => {
  assert.equal(howDied('thirst'), 'dead of thirst');
  assert.equal(howDied('the flux'), 'dead of the flux');
  assert.equal(howDied('lost over the side'), 'lost over the side');
  assert.equal(howDied('killed in the fight'), 'killed in the fight');
  assert.equal(lossWords('lost over the side', 2), '2 lost over the side');
  assert.equal(lossWords('killed in the fight', 4), '4 killed fighting');
  assert.equal(lossWords('thirst', 18), '18 to thirst');
});
