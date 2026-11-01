/** Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { type Card, damageCard } from './cards.ts';
import { act, createEncounter, legalActions, type EncounterState } from './rules.ts';
import { merchantEncounter } from './setup.ts';

const card = (id: string, side: Card['side'], effects: Card['effects']): Card =>
  ({ id, side, name: id, text: id, effects });

const blank = (n: number, side: Card['side'] = 'ship') =>
  Array.from({ length: n }, (_, i) => card(`blank${i}`, side, []));

function encounter(cards: Card[], seed = 1, over: Partial<EncounterState['target']> = {}) {
  return createEncounter({
    seed,
    shipCards: cards,
    targetCards: [],
    ship: { hull: 5, maxHull: 5, brace: 0 },
    target: { name: 't', hull: 5, maxHull: 5, cargo: 6, bounty: 10, ...over },
  });
}

/** An encounter with exactly this hand showing and `rest` blanks beneath it. */
function stacked(hand: Card[], rest = 6, over: Partial<EncounterState['target']> = {}): EncounterState {
  const s = encounter(blank(3), 1, over);
  return { ...s, hand, deck: blank(rest).map((c, i) => ({ ...c, id: `rest${i}` })) };
}

const allIds = (s: EncounterState) => [...s.deck, ...s.hand].map((c) => c.id).sort();

test('the same seed deals the same encounter', () => {
  assert.deepEqual(merchantEncounter(42).hand, merchantEncounter(42).hand);
  assert.notDeepEqual(merchantEncounter(42).deck, merchantEncounter(43).deck);
});

test('a hand of three is dealt from the top', () => {
  const s = merchantEncounter(7);
  assert.equal(s.hand.length, 3);
  assert.equal(s.round, 1);
});

test('the rejected card goes to the bottom, and no card is lost', () => {
  // Blanks, so nothing kept adds cards to the deck.
  const s0 = stacked(blank(3).map((c, i) => ({ ...c, id: `hand${i}` })));
  const before = allIds(s0);
  const rejected = s0.hand[2];
  const s1 = act(s0, { type: 'keep', picks: [0, 1] });
  assert.equal(s1.outcome, null);
  assert.equal(s1.deck.at(-1)!.id, rejected.id);
  // The two kept cards leave the encounter; everything else is still here.
  const kept = new Set([s0.hand[0].id, s0.hand[1].id]);
  assert.deepEqual(allIds(s1), before.filter((id) => !kept.has(id)));
});

test('kept cards resolve in the order named', () => {
  const s0 = stacked([card('repair', 'ship', [{ kind: 'repair', amount: 3 }]), card('dmg', 'ship', [{ kind: 'breach', amount: 3 }]), ...blank(1)]);
  // Repair first does nothing at full hull, then the damage lands: 2 left.
  assert.equal(act(s0, { type: 'keep', picks: [0, 1] }).ship.hull, 2);
  // Damage first, then repair: back to 5.
  assert.equal(act(s0, { type: 'keep', picks: [1, 0] }).ship.hull, 5);
});

test('destroying the target pays plunder plus bounty', () => {
  const s0 = stacked([card('kill', 'target', [{ kind: 'plunder', amount: 2 }, { kind: 'breach', amount: 9 }]), ...blank(2)]);
  const s1 = act(s0, { type: 'keep', picks: [0, 1] });
  assert.equal(s1.outcome, 'destroyed');
  assert.equal(s1.payout, 2 + 10);
});

test('being sunk forfeits the plunder, and stops mid-card', () => {
  const s0 = stacked([card('doom', 'ship', [{ kind: 'plunder', amount: 3 }, { kind: 'breach', amount: 9 }, { kind: 'repair', amount: 9 }]), ...blank(2)]);
  const s1 = act(s0, { type: 'keep', picks: [0, 1] });
  assert.equal(s1.outcome, 'sunk');
  assert.equal(s1.payout, 0);
  assert.equal(s1.ship.hull, 0, 'the repair after the sinking never lands');
});

test('brace soaks damage before the hull does', () => {
  const s0 = stacked([card('brace', 'ship', [{ kind: 'brace', amount: 2 }]), card('dmg', 'ship', [{ kind: 'breach', amount: 3 }]), ...blank(1)]);
  const s1 = act(s0, { type: 'keep', picks: [0, 1] });
  assert.equal(s1.ship.hull, 4);
  assert.equal(s1.ship.brace, 0);
});

test('plunder is capped by what is left in the hold', () => {
  const s0 = stacked([card('haul', 'ship', [{ kind: 'plunder', amount: 99 }]), ...blank(2)], 6, { cargo: 4 });
  const s1 = act(s0, { type: 'keep', picks: [0, 1] });
  assert.equal(s1.plunder, 4);
  assert.equal(s1.target.cargo, 0);
});

test('a finished encounter takes no more actions', () => {
  const s0 = stacked([card('kill', 'target', [{ kind: 'breach', amount: 9 }]), ...blank(2)]);
  const s1 = act(s0, { type: 'keep', picks: [0, 1] });
  assert.equal(s1.outcome, 'destroyed');
  assert.deepEqual(legalActions(s1), []);
  assert.throws(() => act(s1, { type: 'keep', picks: [0, 1] }));
});

test('the deck running short parts the ships', () => {
  // Four blanks: one hand of three, keep two, two left — not enough to deal.
  const s1 = act(encounter(blank(4)), { type: 'keep', picks: [0, 1] });
  assert.equal(s1.outcome, 'parted');
  assert.equal(s1.round, 1);
});

test('every encounter ends, whatever is picked', () => {
  for (let seed = 0; seed < 200; seed++) {
    let s = merchantEncounter(seed);
    let steps = 0;
    while (!s.outcome) {
      const keeps = legalActions(s).filter((a) => a.type === 'keep');
      s = act(s, keeps[(seed + steps) % keeps.length]);
      assert.ok(++steps < 50);
    }
  }
});

test('illegal picks are refused', () => {
  const s = merchantEncounter(1);
  assert.throws(() => act(s, { type: 'keep', picks: [0, 0] }));
  assert.throws(() => act(s, { type: 'keep', picks: [0, 3] }));
});

const flee = (side: Card['side']) => card(`flee-${side}`, side, [{ kind: 'flee' }]);
const hold = (side: Card['side'], amount = 1) => card(`hold-${side}`, side, [{ kind: 'hold', amount }]);
/** Damage landing now, as if a damage card of that size were kept. */
const hit = (n: number) => card(`hit${n}`, 'target', [{ kind: 'breach', amount: n }]);
const hurt = (n: number) => card(`hurt${n}`, 'ship', [{ kind: 'breach', amount: n }]);

test('a ship that is not threatened does not run', () => {
  const s1 = act(stacked([flee('target'), ...blank(2)]), { type: 'keep', picks: [0, 1] });
  assert.equal(s1.outcome, null);
  const e = s1.events.find((e) => e.type === 'effect');
  assert.equal(e?.type === 'effect' && e.note, 'unthreatened');
});

test('a threatened target flees, and takes the rest of its hold with it', () => {
  // Hull 5 → 2 is at half or less.
  const s1 = act(stacked([card('haul', 'target', [{ kind: 'plunder', amount: 2 }, { kind: 'breach', amount: 3 }]), flee('target'), ...blank(1)]), { type: 'keep', picks: [0, 1] });
  assert.equal(s1.outcome, 'escaped');
  assert.equal(s1.payout, 2);
});

test('threat is checked when the card resolves, so order matters', () => {
  const hand = [hit(3), flee('target'), ...blank(1)];
  assert.equal(act(stacked(hand), { type: 'keep', picks: [1, 0] }).outcome, null, 'fled before it was hurt: no');
  assert.equal(act(stacked(hand), { type: 'keep', picks: [0, 1] }).outcome, 'escaped');
});

test('you flee the same way, and keep your plunder', () => {
  const s0 = { ...stacked([hurt(3), flee('ship'), ...blank(1)]), plunder: 4 };
  const s1 = act(s0, { type: 'keep', picks: [0, 1] });
  assert.equal(s1.outcome, 'fled');
  assert.equal(s1.payout, 4);
});

test('hold cancels the other side’s next flee, once', () => {
  const s0 = stacked([hold('ship'), hit(3), flee('target')], 6);
  const s1 = act(s0, { type: 'keep', picks: [0, 1] });
  assert.equal(s1.target.held, 1);
  // The flee card went to the bottom; play it through by hand.
  const s2 = act({ ...s1, hand: [flee('target'), ...blank(2)] }, { type: 'keep', picks: [0, 1] });
  assert.equal(s2.outcome, null);
  assert.equal(s2.target.held, 0);
  const s3 = act({ ...s2, hand: [flee('target'), ...blank(2)] }, { type: 'keep', picks: [0, 1] });
  assert.equal(s3.outcome, 'escaped');
});

test('their hold stops your flee', () => {
  const s0 = stacked([hold('target'), hurt(3), flee('ship')]);
  const s1 = act({ ...s0, hand: [s0.hand[0], s0.hand[1], blank(1)[0]] }, { type: 'keep', picks: [0, 1] });
  assert.equal(s1.ship.held, 1);
  const s2 = act({ ...s1, hand: [flee('ship'), ...blank(2)] }, { type: 'keep', picks: [0, 1] });
  assert.equal(s2.outcome, null);
});

const damageIn = (cards: Card[], side: Card['side']) =>
  cards.filter((c) => c.damage && c.side === side).length;

test('a hit leaves the hull alone and puts damage cards in the deck', () => {
  const s0 = stacked([card('broadside', 'ship', [{ kind: 'hit', amount: 3 }]), card('return', 'target', [{ kind: 'hurt', amount: 2 }]), ...blank(1)]);
  const s1 = act(s0, { type: 'keep', picks: [0, 1] });
  assert.equal(s1.target.hull, 5);
  assert.equal(s1.ship.hull, 5);
  // The next hand came off the top, so count both.
  const all = [...s1.deck, ...s1.hand];
  assert.equal(damageIn(all, 'target'), 3);
  assert.equal(damageIn(all, 'ship'), 2);
  assert.equal(new Set(all.map((c) => c.id)).size, all.length, 'ids stay unique');
});

test('damage lands only when its card is kept', () => {
  const s0 = stacked([damageCard('ship', 'd1'), damageCard('target', 'd2'), ...blank(1)]);
  const s1 = act(s0, { type: 'keep', picks: [0, 1] });
  assert.equal(s1.ship.hull, 4);
  assert.equal(s1.target.hull, 4);
});

test('one damage card can be sent to the bottom; two in a hand cannot both be', () => {
  const s0 = stacked([damageCard('ship', 'd1'), damageCard('ship', 'd2'), ...blank(1)]);
  for (const a of legalActions(s0)) assert.ok(act(s0, a).ship.hull <= 4, 'at least one lands, whatever is kept');
});

test('the same seed makes the same damage', () => {
  const run = () => {
    let s = merchantEncounter(9);
    while (!s.outcome) s = act(s, legalActions(s)[0]);
    return s.events;
  };
  assert.deepEqual(run(), run());
});
