/** Events that ask you something: storms, shares, castaways. Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CREW, START_OUTFIT } from '../outfit.ts';
import { act, legalActions } from '../rules.ts';
import { CASTAWAY_LIAR, JETTISON_CAP, PROMISED_SHARE, SHARES_AT, STORM_RUN, castaway, choices, choose, sharesCost } from './dilemmas.ts';
import { IDLE_DAYS, SOUR_EVERY, aDay } from './events.ts';
import { attack, fight, meeting } from './meet.ts';
import { declare } from './wars.ts';
import { advance, createSea, createWorld, type WorldState } from './world.ts';

const sea = createSea();
const { map } = sea;
const midAtlantic = () => map.nodes.filter((n) => n.kind === 'ocean' && Math.abs(n.lon + 35) < 3 && Math.abs(n.lat - 25) < 3)[0].id;
const atSea = (over: Partial<WorldState> = {}): WorldState => ({ ...createWorld(sea, 1), ships: [], trail: [], player: midAtlantic(), ...over });
const storm = (over: Partial<WorldState> = {}): WorldState => atSea({ dilemma: { kind: 'storm' }, ...over });

test('nothing to choose, or a choice that is not on offer, is refused', () => {
  assert.throws(() => choose(sea, atSea(), 'ride'), /nothing to choose/);
  assert.throws(() => choose(sea, storm(), 'pray'), /no choice/);
  assert.throws(() => advance(sea, storm(), midAtlantic()), /choice to make first/);
});

test('a storm ridden out costs a little hull, never the last point', () => {
  for (let seed = 0; seed < 30; seed++) {
    const w = choose(sea, storm({ rng: seed, hull: 10 }), 'ride');
    assert.ok(w.hull >= 7 && w.hull <= 9, `hull ${w.hull}`);
    assert.equal(w.dilemma, null);
    assert.equal(choose(sea, storm({ rng: seed, hull: 1 }), 'ride').hull, 1);
  }
});

test('lightening ship costs gold, a share of it and never more than the cap, and is barred with nothing aboard', () => {
  for (let seed = 0; seed < 30; seed++) {
    const w = choose(sea, storm({ rng: seed, gold: 100, hull: 10 }), 'lighten');
    assert.ok(w.gold >= 75 && w.gold <= 90, `gold ${w.gold}`);
    assert.equal(w.hull, 10);
    const rich = choose(sea, storm({ rng: seed, gold: 1000 }), 'lighten');
    assert.ok(rich.gold >= 1000 - JETTISON_CAP);
  }
  const broke = storm({ gold: 0 });
  assert.ok(choices(broke, broke.dilemma!).find((c) => c.key === 'lighten')!.barred);
  assert.throws(() => choose(sea, broke, 'lighten'), /nothing aboard/);
});

test('running before a storm costs nothing but days and your course: the wind takes you', () => {
  const before = storm({ hull: 10, gold: 50 });
  const w = choose(sea, before, 'run');
  const days = w.turn - before.turn;
  assert.ok(days >= 1 && days <= STORM_RUN[1], `${days} days`);
  assert.notEqual(w.player, before.player);
  assert.equal(w.gold, 50);
  assert.ok(w.log.some((l) => l.text.startsWith('running before the storm')));
});

test('the crew ask for their shares as they sour, and the answer is yours', () => {
  // A month idle and more: they sour a point every so often, and at SHARES_AT they ask.
  let w = atSea({ morale: SHARES_AT + 1, gold: 80 });
  w = aDay(sea, { ...w, turn: IDLE_DAYS + SOUR_EVERY, lastSpoils: 0 });
  assert.equal(w.morale, SHARES_AT);
  assert.deepEqual(w.dilemma, { kind: 'shares', cost: sharesCost(80) });

  const paid = choose(sea, w, 'pay');
  assert.equal(paid.gold, 80 - sharesCost(80));
  assert.equal(paid.morale, SHARES_AT + 3);
  const promised = choose(sea, w, 'promise');
  assert.equal(promised.morale, SHARES_AT + 1);
  assert.equal(promised.promised, true);
  const outcomes = new Set(Array.from({ length: 20 }, (_, i) => choose(sea, { ...w, rng: i }, 'refuse').morale));
  assert.deepEqual([...outcomes].sort(), [SHARES_AT - 1, SHARES_AT + 1]);
  assert.throws(() => choose(sea, { ...w, gold: 1 }, 'pay'), /not enough/);
});

test('shares promised come out of the next prize, a quarter of it', () => {
  const w0 = createWorld(sea, 3);
  const merchant = w0.ships.find((s) => s.kind === 'merchant' && s.nation === 'spain')!;
  const here = midAtlantic();
  for (let seed = 0; seed < 20; seed++) {
    let s: WorldState = meeting(sea, { ...w0, rng: seed, promised: true, player: here, wars: declare(w0.wars, 'england', 'spain'), ships: [{ ...merchant, node: here }], trail: [[]] });
    s = attack(s);
    s = { ...s, encounter: { ...s.encounter!, fight: { ...s.encounter!.fight, ship: { ...s.encounter!.fight.ship, hull: 999, maxHull: 999 } } } };
    while (s.encounter) {
      const f = s.encounter.fight;
      const score = (a: ReturnType<typeof legalActions>[number]) => {
        const n = act(f, a);
        return n.outcome === 'destroyed' ? -1e6 : n.outcome === 'fled' || n.outcome === 'escaped' ? 1e6 : n.target.hull;
      };
      s = fight(sea, s, legalActions(f).reduce((a, b) => (score(b) < score(a) ? b : a)));
    }
    const payout = s.reckoning!.payout;
    if (!payout) continue;
    const owed = Math.round(payout * PROMISED_SHARE);
    assert.equal(s.gold, w0.gold + payout - owed);
    assert.equal(s.promised, false);
    return;
  }
  assert.fail('no prize in 20 tries');
});

test('a castaway on new land: a hand for nothing, if he is what he says, and a berth for him', () => {
  const w = atSea();
  const offers = Array.from({ length: 40 }, (_, i) => castaway(w, { rng: i * 17 + 3 }));
  assert.ok(offers.some((d) => d === null) && offers.some((d) => d !== null), 'sometimes');
  const d = offers.find((x) => x !== null)!;
  assert.ok(d.kind === 'castaway' && CREW[d.role]);

  let liars = 0;
  for (let seed = 0; seed < 200; seed++) {
    const taken = choose(sea, { ...w, rng: seed, dilemma: d }, 'take');
    if (taken.outfit.crew.includes((d as { role: string }).role)) assert.equal(taken.morale, w.morale);
    else (liars++, assert.equal(taken.morale, w.morale - 2));
  }
  assert.ok(Math.abs(liars / 200 - CASTAWAY_LIAR) < 0.1, `${liars} liars in 200`);

  const full = { ...w, dilemma: d, outfit: { ...START_OUTFIT, crew: ['gunner', 'pilot'] } };
  assert.ok(choices(full, d).find((c) => c.key === 'take')!.barred);
  assert.equal(choose(sea, full, 'leave').outfit.crew.length, 2);
});
