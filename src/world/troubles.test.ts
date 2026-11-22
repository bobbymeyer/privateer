/** The events from the book: the hands' raid for gold, fire in the stores, the eve of a raid, the feast, the lock-up, papers, fool's gold. Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { choices, choose, describe, type Dilemma } from './dilemmas.ts';
import { arriving, happeningsDay, ORE_SHORES } from './happenings.ts';
import { raid } from './meet.ts';
import { cardType } from '../cards.ts';
import { comeHome } from './reckoning.ts';
import { marketHere, price, spiceRoom } from './stores.ts';
import { coastAwake } from './treasure.ts';
import { lyingAt, victualled } from './testing.ts';
import { createSea, createWorld, type WorldState } from './world.ts';

const sea = createSea();
const { map } = sea;
const node = (lon: number, lat: number) =>
  map.nodes.filter((n) => !n.port && map.adj[n.id].length).sort((a, b) => Math.hypot(a.lon - lon, a.lat - lat) - Math.hypot(b.lon - lon, b.lat - lat))[0].id;
const fresh = (over: Partial<WorldState> = {}): WorldState => ({ ...victualled(createWorld(sea, 1, 'sloop')), crew: 40, gold: 100, ...over });
const said = (w: WorldState, re: RegExp) => w.log.some((l) => re.test(l.text));
const asking = (d: Dilemma, over: Partial<WorldState> = {}) => fresh({ ...over, dilemma: d });

test('every new event says what each choice stakes, and every open choice can be made', () => {
  const kinds: Dilemma[] = [
    { kind: 'gold-mutiny' }, { kind: 'stores-fire' }, { kind: 'feast', at: 'ternate' }, { kind: 'jailed', at: 'java' },
    { kind: 'papers', at: 'canaries' }, { kind: 'ore' },
  ];
  for (const d of kinds) {
    const s = asking(d, { stores: { food: 5000, water: 5000, spares: 2, powder: 4 } });
    assert.ok(describe(d).text.length > 30, d.kind);
    for (const c of choices(s, d).filter((x) => !x.barred)) {
      const after = choose(sea, s, c.key);
      assert.equal(after.dilemma, null, `${d.kind}:${c.key}`);
      assert.ok(after.log.length > s.log.length, `${d.kind}:${c.key} says what came of it`);
    }
  }
});

test('the hands want Spanish gold off the coast of Peru, after long without a prize', () => {
  const coast = fresh({ player: node(-78, -20), turn: 200, lastPrize: 0 });
  let w = coast;
  for (let d = 0; d < 400 && w.dilemma?.kind !== 'gold-mutiny'; d++) {
    const r = { rng: w.rng };
    w = happeningsDay(sea, { ...w, turn: w.turn + 1, dilemma: null }, r);
    w = { ...w, rng: r.rng };
  }
  assert.equal(w.dilemma?.kind, 'gold-mutiny');
  const prized = fresh({ player: node(-78, -20), turn: 200, lastPrize: 190 });
  for (let rng = 0; rng < 300; rng++) assert.notEqual(happeningsDay(sea, { ...prized, rng }, { rng }).dilemma?.kind, 'gold-mutiny', 'a prize lately: no talk of it');
  const joined = choose(sea, { ...w, voyage: { ...w.voyage, visited: ['plymouth', 'callao'] } }, 'join');
  assert.ok(joined.gold > w.gold && joined.grievance > w.grievance);
  assert.ok(coastAwake(joined), 'the treasure ship warned');
  const firm = choose(sea, w, 'firm');
  assert.ok(firm.seen.includes('discontent'));
  const marooned = choose(sea, w, 'maroon');
  assert.ok(marooned.crew < w.crew);
});

test('fire in the stores: fight it with canvas, or let it burn; and starving men remember Charlesfort', () => {
  const s = asking({ kind: 'stores-fire' }, { stores: { food: 1000, water: 1000, spares: 1, powder: 0 } });
  const fought = choose(sea, s, 'fight');
  assert.equal(fought.stores.food, 850);
  assert.equal(fought.stores.spares, 0);
  assert.equal(choose(sea, s, 'shut').stores.food, 650);
  assert.ok(choices({ ...s, stores: { ...s.stores, spares: 0 } }, s.dilemma!).find((c) => c.key === 'fight')!.barred);
  let grumbled = 0;
  for (let rng = 0; rng < 40; rng++) if (choose(sea, { ...s, rng, rations: 'starving' }, 'shut').seen.includes('discontent')) grumbled++;
  assert.ok(grumbled > 3 && grumbled < 25, `${grumbled} of 40`);
});

test('a storm on the eve of a raid: go in now, stand off and warn them, or land the men without the guns', () => {
  let s: WorldState | null = null;
  for (let rng = 0; rng < 200 && !s; rng++) {
    const w = raid(sea, { ...lyingAt(sea, fresh(), 'valparaiso'), rng });
    if (w.dilemma?.kind === 'eve') s = w;
  }
  assert.ok(s, 'a storm comes on the eve of some raids');
  assert.ok(s!.raided.includes('valparaiso'), 'the raid is spent either way');
  const pressed = choose(sea, s!, 'press');
  assert.ok(pressed.encounter && pressed.hull < s!.hull);
  const stood = choose(sea, s!, 'stand');
  const now = choose(sea, s!, 'press');
  assert.ok(stood.encounter!.fight.target.maxHull > now.encounter!.fight.target.maxHull, 'the town warned');
  const landed = choose(sea, s!, 'land');
  const shots = (w: WorldState) => [...w.encounter!.fight.deck, ...w.encounter!.fight.hand].filter((c) => c.side === 'ship' && cardType(c) === 'shot').length;
  assert.ok(shots(landed) < shots(now), 'the ship’s guns left with the ship');
});

test('the feast ashore: his favour gets you Plymouth’s prices; now and then it’s a trap', () => {
  const at = lyingAt(sea, fresh(), 'ternate');
  const dear = price(at, 'food');
  let favoured = 0;
  let trapped = 0;
  for (let rng = 0; rng < 60; rng++) {
    const w = choose(sea, { ...at, rng, dilemma: { kind: 'feast', at: 'ternate' } }, 'go');
    if (w.seen.includes('favour:ternate')) {
      favoured++;
      assert.ok(price(w, 'food') < dear);
    } else trapped++;
  }
  assert.ok(favoured > 40 && trapped > 0, `${favoured} favoured, ${trapped} trapped`);
});

test('hands in the lock-up: pay, leave them, or break them out and be shut out of the market', () => {
  const at = lyingAt(sea, fresh(), 'java');
  const s = { ...at, dilemma: { kind: 'jailed' as const, at: 'java' } };
  assert.equal(choose(sea, s, 'pay').gold, 100 - 25);
  assert.ok(choose(sea, s, 'leave').crew < 40);
  const broke = choose(sea, s, 'break');
  assert.equal(marketHere(sea, broke), null);
  assert.equal(marketHere(sea, at), 'chandler');
});

test('papers searched: the charts and your rumors, a bribe, or refuse', () => {
  const rumors = [{ key: 'macau', source: 'gossip' as const, told: 'x', truth: true, followed: true }];
  const s = asking({ kind: 'papers', at: 'canaries' }, { rumors, voyage: { at: 'canaries', bound: null, visited: ['plymouth', 'canaries'] }, player: map.landmarks.canaries });
  assert.equal(choose(sea, s, 'hand').rumors[0].followed, false);
  assert.equal(choose(sea, s, 'bribe').gold, 85);
  const refused = choose(sea, s, 'refuse');
  assert.ok(refused.hull < s.hull);
  // At sea, a patrol won't be refused: she fights for them.
  const patrol = choose(sea, asking({ kind: 'papers', at: null }), 'refuse');
  assert.equal(patrol.encounter?.nation, 'spain');
  assert.ok(patrol.encounter!.forced);
});

test('fool’s gold: it takes hold room, and the Tower says what it is', () => {
  const s = asking({ kind: 'ore' });
  const loaded = choose(sea, s, 'load');
  assert.equal(spiceRoom(loaded), spiceRoom(s) - 2);
  const home = comeHome(loaded);
  assert.ok(said(home, /fool’s gold/));
  assert.ok(!said(comeHome(s), /fool’s gold/));
  // Found once a voyage, on remote shores.
  let found = 0;
  for (let rng = 0; rng < 40; rng++) if (arriving({ ...fresh(), rng }, ORE_SHORES[0]).dilemma?.kind === 'ore') found++;
  assert.ok(found > 3 && found < 25, `${found} of 40`);
  assert.equal(arriving({ ...fresh(), seen: ['ore-found'], rng: 1 }, ORE_SHORES[0]).dilemma, null);
});
