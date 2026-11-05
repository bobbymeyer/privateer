/** Rumors, and the detours they open. Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decode, encode } from '../save.ts';
import { TARGETS } from '../setup.ts';
import { choose, choices } from './dilemmas.ts';
import { choices as legs, howHome, makeFor, raise } from './journey.ts';
import { HOME_LANDMARK, LANDMARKS, landmark } from './landmarks.ts';
import { FAR } from './map.ts';
import { attack, raid, raidHere } from './meet.ts';
import { DETOURS, GOA_EXTRA, PRIZES, type Rumor, followed, hearAt, hearFromPrisoners, reachable } from './rumors.ts';
import { landmarkHere } from './stores.ts';
import { createSea, createWorld, type WorldState } from './world.ts';
import { lyingAt, victualled } from './testing.ts';

const sea = createSea();
const { map } = sea;
const fresh = (over: Partial<WorldState> = {}): WorldState => ({ ...victualled(createWorld(sea, 1)), ...over });
/** Lying at a landmark, having come the main way to it. */
const at = (key: string, visited: string[] = ['plymouth'], over: Partial<WorldState> = {}): WorldState =>
  ({ ...lyingAt(sea, fresh({ voyage: { at: visited.at(-1)!, bound: null, visited } }), key), ...over });
const knowing = (s: WorldState, key: string, truth = true): WorldState => ({
  ...s,
  rumors: [...s.rumors, { key, source: 'prisoner', told: 'a prisoner', truth, followed: true } satisfies Rumor],
});

test('every detour can be sailed to from each landmark it branches from, and on to where it rejoins', () => {
  for (const l of LANDMARKS.filter((x) => x.detour)) {
    for (const f of l.detour!.from) assert.ok(map.distTo(map.landmarks[l.key])[map.landmarks[f]] < FAR, `${f} → ${l.key}`);
    for (const n of l.next) assert.ok(map.distTo(map.landmarks[n])[map.landmarks[l.key]] < FAR, `${l.key} → ${n}`);
    assert.ok(DETOURS[l.key], `${l.key} has a rumor`);
  }
});

test('a detour is among the choices only once you mean to follow it, and only where it branches', () => {
  const s = at('ternate', ['plymouth', 'ladrones']);
  assert.deepEqual(legs(s.voyage, followed(s)), ['java', HOME_LANDMARK]);
  const k = knowing(s, 'banda');
  assert.ok(legs(k.voyage, followed(k)).includes('banda'));
  assert.throws(() => makeFor(s, 'banda'));
  assert.equal(makeFor(k, 'banda').voyage.bound, 'banda');
  assert.ok(!legs(at('java', ['plymouth', 'ternate']).voyage, ['banda']).includes('banda'), 'not from java');
});

test('rumors are heard where they would be, from the right people, and not again', () => {
  let offered = 0;
  for (let rng = 0; rng < 40; rng++) {
    const s = hearAt({ ...at('ternate', ['plymouth', 'ladrones']), rng }, 'ternate');
    if (!s.dilemma) continue;
    offered++;
    assert.equal(s.dilemma.kind, 'rumor');
    const d = s.dilemma as Extract<WorldState['dilemma'], { kind: 'rumor' }>;
    assert.ok(['macau', 'banda'].includes(d.key));
    assert.equal(d.source, d.key === 'banda' ? 'pilot' : 'gossip');
    const heard = choose(sea, s, 'ignore');
    assert.equal(hearAt({ ...heard, rumors: [...heard.rumors, { ...heard.rumors[0], key: d.key === 'banda' ? 'macau' : 'banda' }] }, 'ternate').dilemma, null, 'heard both: nothing more');
  }
  assert.ok(offered > 10 && offered < 40, `${offered} of 40`);
  assert.equal(hearAt(at('canaries'), 'canaries').dilemma, null, 'nothing at the Canaries');
});

test('prisoners talk of what lies ahead, never of a detour already behind you', () => {
  let talked = 0;
  for (let rng = 0; rng < 40; rng++) {
    const s = hearFromPrisoners({ ...at('callao', ['plymouth', 'valparaiso']), rng }, 'spain');
    if (s.dilemma?.kind === 'rumor') (talked++, assert.ok(['cabo-san-lucas', 'solomons'].includes(s.dilemma.key)));
  }
  assert.ok(talked > 5);
  const past = at('java', ['plymouth', 'guatulco', 'ladrones', 'ternate']);
  assert.ok(!reachable(past, 'cabo-san-lucas'));
  assert.ok(!reachable(past, 'solomons'));
  assert.ok(reachable(past, 'azores'));
  for (let rng = 0; rng < 20; rng++) assert.equal(hearFromPrisoners({ ...past, rng }, 'spain').dilemma, null);
});

test('about one rumor in three is false, the pilot truer than prisoners', () => {
  let trueCount = 0;
  let pilot = 0;
  let pilots = 0;
  for (let rng = 0; rng < 400; rng++) {
    const s = hearAt({ ...at('ternate', ['plymouth', 'ladrones']), rng }, 'ternate');
    const p = hearFromPrisoners({ ...at('callao', ['plymouth', 'valparaiso']), rng }, 'spain');
    for (const d of [s.dilemma, p.dilemma]) {
      if (d?.kind !== 'rumor') continue;
      if (d.source === 'pilot') (pilots++, d.truth && pilot++);
      else if (d.truth) trueCount++;
    }
  }
  assert.ok(pilot / pilots > 0.75, 'the pilot');
  assert.ok(pilots > 20);
  assert.ok(trueCount > 0);
});

test('a false rumor: nothing there, the days spent', () => {
  const s = knowing(at('guatulco', ['plymouth', 'cacafuego']), 'cabo-san-lucas', false);
  const there = raise(sea, { ...makeFor(s, 'cabo-san-lucas'), player: map.landmarks['cabo-san-lucas'] });
  assert.equal(there.voyage.at, 'cabo-san-lucas');
  assert.equal(there.hail, null);
  assert.ok(there.log.some((l) => /no galleon/.test(l.text)));
  assert.deepEqual(landmarkHere(sea, there)!.offers, {});
  assert.deepEqual(legs(there.voyage, followed(there)).filter((k) => k !== HOME_LANDMARK), ['ladrones'], 'and on to rejoin the way');
});

test('true: the Manila galleon comes in, a bigger fight than the plate ship, taken whole', () => {
  const s = knowing(at('guatulco', ['plymouth', 'cacafuego']), 'cabo-san-lucas');
  const there = raise(sea, { ...makeFor(s, 'cabo-san-lucas'), player: map.landmarks['cabo-san-lucas'] });
  assert.equal(there.hail?.prize, 'galleon');
  const f = attack(there).encounter!.fight;
  assert.equal(f.target.hull, TARGETS['treasure-ship'].hull + PRIZES.galleon.extra.hull!);
  assert.equal(f.target.cargo, TARGETS['treasure-ship'].cargo + PRIZES.galleon.extra.cargo!);
  assert.ok(f.target.takenWhole);
  for (const [key, prize] of [['macau', 'great-ship'], ['azores', 'carrack']] as const) {
    const from = landmark(key).detour!.from[0];
    const k = knowing(at(from, ['plymouth']), key);
    assert.equal(raise(sea, { ...makeFor(k, key), player: map.landmarks[key] }).hail?.prize, prize);
  }
});

test('Goa: a raid, Portuguese, the hardest of all; or the Viceroy’s fleet is in', () => {
  const k = knowing(at('java', ['plymouth', 'ternate']), 'goa');
  const there = raise(sea, { ...makeFor(k, 'goa'), player: map.landmarks.goa });
  assert.equal(raidHere(sea, there)?.kind, 'fortress');
  const f = raid(sea, there).encounter!;
  assert.equal(f.nation, 'portugal');
  assert.equal(f.fight.target.hull, TARGETS.fortress.hull + GOA_EXTRA.hull!);
  const lie = knowing(at('java', ['plymouth', 'ternate']), 'goa', false);
  assert.equal(raidHere(sea, raise(sea, { ...makeFor(lie, 'goa'), player: map.landmarks.goa })), null);
});

test('the Isles of Solomon and Banda, when true, give what they promised; round the world still counts', () => {
  const sol = knowing(at('ladrones', ['plymouth', 'guatulco']), 'solomons');
  const isles = raise(sea, { ...makeFor(sol, 'solomons'), player: map.landmarks.solomons });
  assert.ok(landmarkHere(sea, isles)!.offers.shore!.includes('careen'));
  assert.equal(landmarkHere(sea, isles)!.offers.market, 'islanders');
  const banda = knowing(at('ternate', ['plymouth', 'ladrones']), 'banda');
  const nut = raise(sea, { ...makeFor(banda, 'banda'), player: map.landmarks.banda });
  assert.ok(nut.spice > 0, 'nutmeg');
  assert.equal(howHome({ at: 'plymouth-home', bound: null, visited: ['plymouth', 'guatulco', 'solomons', 'ternate', 'java', 'cape', 'plymouth-home'] }), 'round');
});

test('following or ignoring a rumor says so, and the choice is told plainly', () => {
  const s = { ...at('ternate', ['plymouth', 'ladrones']), dilemma: { kind: 'rumor' as const, key: 'macau', source: 'gossip' as const, told: 'gossip', truth: true } };
  const c = choices(s, s.dilemma);
  assert.deepEqual(c.map((x) => x.key), ['follow', 'ignore']);
  assert.match(c[0].stakes, /Ternate/);
  assert.deepEqual(followed(choose(sea, s, 'follow')), ['macau']);
  assert.deepEqual(followed(choose(sea, s, 'ignore')), []);
});

test('a save from before rumors comes forward', () => {
  const { rumors: _r, landfall: _l, ...old } = createWorld(sea, 1);
  const saved = decode(JSON.stringify({ ...JSON.parse(encode(1, old as WorldState)), version: 13 }))!;
  assert.deepEqual(saved.world.rumors, []);
  assert.equal(saved.world.landfall, null);
});
