/** What happens on the way: the table, the new events that ask, spice. Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { choices, choose, describe } from './dilemmas.ts';
import { HAPPENINGS, arriving, happeningsDay } from './happenings.ts';
import { raise } from './journey.ts';
import { SPICE_WORTH, buySpice, spiceRoom } from './stores.ts';
import { decode, encode } from '../save.ts';
import { createSea, createWorld, type WorldState } from './world.ts';
import { lyingAt, victualled } from './testing.ts';

const sea = createSea();
const { map } = sea;
const node = (lon: number, lat: number) =>
  map.nodes.filter((n) => !n.port && map.adj[n.id].length).sort((a, b) => Math.hypot(a.lon - lon, a.lat - lat) - Math.hypot(b.lon - lon, b.lat - lat))[0].id;
const fresh = (over: Partial<WorldState> = {}): WorldState => ({ ...victualled(createWorld(sea, 1)), crew: 40, ...over });

/** Days at a place, every question answered by its first open choice, and what the log said. */
function days(w: WorldState, n: number): WorldState {
  for (let d = 0; d < n; d++) {
    const r = { rng: w.rng };
    w = happeningsDay(sea, { ...w, turn: w.turn + 1, crew: 40, hull: w.maxHull }, r);
    w = { ...w, rng: r.rng };
    if (w.dilemma) w = choose(sea, w, choices(w, w.dilemma).find((c) => !c.barred)!.key);
  }
  return w;
}
const said = (w: WorldState, re: RegExp) => w.log.some((l) => re.test(l.text));

test('the days differ by where you are', () => {
  const tropic = days(fresh({ player: node(-30, 10) }), 300);
  const cold = days(fresh({ player: node(-60, -48) }), 300);
  assert.ok(said(tropic, /dolphins|waterspout|pitch soft|flying fish skittering/));
  assert.ok(!said(tropic, /seals and penguins/));
  assert.ok(said(cold, /seals and penguins/), 'off Patagonia, seals');
  assert.ok(said(cold, /fog/));
  assert.ok(said(cold, /whale|Saint Elmo|albatrosses|grey swell/));
});

test('crossing the line, once a voyage', () => {
  const w = days(fresh({ player: node(-25, -2) }), 30);
  assert.equal(w.log.filter((l) => /crossing the line/.test(l.text)).length, 1);
  assert.ok(w.seen.includes('the-line'));
});

test('canoes in the Pacific, a reef in the Indies, and only there', () => {
  assert.ok(said(days(fresh({ player: node(160, 10) }), 200), /canoes/));
  assert.ok(said(days(fresh({ player: node(125, -2) }), 200), /aground on a reef/));
  const atlantic = days(fresh({ player: node(-30, 30) }), 300);
  assert.ok(!said(atlantic, /canoes|reef/));
});

test('every event that asks says what each choice stakes, and every choice can be made', () => {
  const kinds = ['leak', 'wreck', 'canoes', 'reef', 'gentleman', 'deserters'] as const;
  for (const kind of kinds) {
    const s = fresh({ player: node(-30, 10), gold: 50, stores: { food: 1000, water: 1000, spares: 2, powder: 2 }, spice: 4, dilemma: { kind } });
    assert.ok(describe({ kind }).text.length > 20, kind);
    for (const c of choices(s, { kind })) {
      assert.ok(c.stakes.length > 0, `${kind}:${c.key}`);
      const after = choose(sea, s, c.key);
      assert.equal(after.dilemma, null);
      assert.ok(after.log.length > s.log.length, `${kind}:${c.key} says what came of it`);
    }
  }
});

test('fothering a leak needs canvas; lightening on a reef throws the spice first', () => {
  const leak = fresh({ dilemma: { kind: 'leak' }, stores: { food: 1, water: 1, spares: 0, powder: 0 } });
  assert.ok(choices(leak, { kind: 'leak' }).find((c) => c.key === 'fother')!.barred);
  const reef = fresh({ dilemma: { kind: 'reef' }, spice: 6 });
  assert.equal(choose(sea, reef, 'lighten').spice, 3);
});

test('the Doughty business at San Julián: let it be, and hands may slip away at the next landmark', () => {
  const there = raise(sea, { ...fresh(), player: map.landmarks['san-julian'], voyage: { at: 'plate', bound: 'san-julian', visited: ['plymouth', 'plate'] } });
  assert.equal(there.dilemma?.kind, 'gentleman');
  const left = choose(sea, there, 'leave');
  assert.ok(left.seen.includes('discontent'));
  let lost = 0;
  for (let rng = 0; rng < 40; rng++) {
    const next = arriving({ ...left, rng }, 'strait');
    assert.ok(!next.seen.includes('discontent'), 'it comes to a head once');
    lost += left.crew - next.crew;
  }
  assert.ok(lost > 0);
  const tried = choose(sea, there, 'try');
  assert.equal(tried.crew, there.crew - 1);
  assert.ok(!tried.seen.includes('discontent'));
});

test('spice bought in the Moluccas sells on the quay at home', () => {
  const ternate = lyingAt(sea, fresh({ gold: 100 }), 'ternate');
  let w = ternate;
  for (let i = 0; i < spiceRoom(w); i++) w = buySpice(sea, w);
  assert.equal(w.spice, spiceRoom(w));
  assert.throws(() => buySpice(sea, w), /no room/);
  assert.throws(() => buySpice(sea, lyingAt(sea, fresh(), 'canaries')), /no spice/);
  const home = raise(sea, { ...w, player: map.landmarks['plymouth-home'], voyage: { at: 'sierra-leone', bound: 'plymouth-home', visited: ['plymouth', 'ternate', 'cape', 'sierra-leone'] } });
  assert.ok(home.won);
  assert.equal(home.gold, w.gold + w.spice * SPICE_WORTH);
  assert.equal(home.spice, 0);
  assert.ok(said(home, /sold on the quay/));
});

test('a save from before the happenings comes forward', () => {
  const { spice: _s, seen: _n, ...old } = createWorld(sea, 1);
  const text = JSON.stringify({ ...JSON.parse(encode(1, old as WorldState)), version: 12 });
  const saved = decode(text)!;
  assert.equal(saved.world.spice, 0);
  assert.deepEqual(saved.world.seen, []);
});

test('the table: every happening has a place and a chance', () => {
  for (const h of HAPPENINGS) assert.ok(h.chance > 0 && h.chance <= 1, h.key);
  assert.ok(HAPPENINGS.length >= 16);
});
