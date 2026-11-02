/** Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { type Card, woundCard } from './cards.ts';
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

test('prisoners give up rumors, which go down with you if you sink', () => {
  const talk = card('talk', 'ship', [{ kind: 'interrogate', reliability: 0.7 }]);
  const s1 = act(stacked([talk, ...blank(2)]), { type: 'keep', picks: [0, 1] });
  assert.deepEqual(s1.intel, [0.7]);
  const s2 = act(stacked([talk, hurt(9), ...blank(1)]), { type: 'keep', picks: [0, 1] });
  assert.equal(s2.outcome, 'sunk');
  assert.deepEqual(s2.intel, []);
});

const damageIn = (cards: Card[], side: Card['side']) =>
  cards.filter((c) => c.damage && c.side === side).length;

test('shot strikes the hull at once; brace soaks yours', () => {
  const s0 = { ...stacked([card('broadside', 'ship', [{ kind: 'hit', amount: 3 }]), card('return', 'target', [{ kind: 'hurt', amount: 2 }]), ...blank(1)]), ship: { hull: 5, maxHull: 5, brace: 1, held: 0 } };
  const s1 = act(s0, { type: 'keep', picks: [0, 1] });
  assert.equal(s1.target.hull, 2);
  assert.equal(s1.ship.hull, 4, 'one of the two braced');
  assert.equal(damageIn([...s1.deck, ...s1.hand], 'target'), 0, 'plain shot leaves no wound');
});

test('some shot leaves a wound, on top of the deck against the side it struck', () => {
  const s0 = stacked([card('heated', 'ship', [{ kind: 'hit', amount: 1 }, { kind: 'wound', what: 'fire' }]), card('chain', 'target', [{ kind: 'wound', what: 'sails' }]), ...blank(1)]);
  const s1 = act(s0, { type: 'keep', picks: [0, 1] });
  // Wounds go on top, so they're in the very next hand.
  const fire = s1.hand.find((c) => c.wound === 'fire')!;
  const sails = s1.hand.find((c) => c.wound === 'sails')!;
  assert.equal(fire.side, 'target');
  assert.equal(sails.side, 'ship');
  const all = [...s1.deck, ...s1.hand];
  assert.equal(new Set(all.map((c) => c.id)).size, all.length, 'ids stay unique');
});

test('a wound costs its hull when kept, and is spent', () => {
  const s0 = stacked([woundCard('ship', 'leak', 'leak'), woundCard('target', 'fire', 'fire'), ...blank(1)]);
  const s1 = act(s0, { type: 'keep', picks: [0, 1] });
  assert.equal(s1.ship.hull, 3, 'a leak: 2');
  assert.equal(s1.target.hull, 2, 'a fire: 3');
  assert.deepEqual(s1.discard.map((c) => c.id), ['leak', 'fire']);
});

test('sent to the bottom, a wound comes round again; two in a hand, one gets through', () => {
  const s0 = stacked([woundCard('ship', 'l1', 'leak'), woundCard('ship', 'l2', 'leak'), ...blank(1)]);
  for (const a of legalActions(s0)) assert.ok(act(s0, a).ship.hull <= 3, 'at least one lands, whatever is kept');
  const s1 = act(stacked([woundCard('ship', 'l1', 'leak'), ...blank(2)]), { type: 'keep', picks: [1, 2] });
  assert.equal(s1.deck.at(-1)!.id, 'l1', 'put off, not gone');
});

test('shot-away sails: no hull, but no running till they are dealt with', () => {
  const flee = card('flee', 'ship', [{ kind: 'flee' }]);
  const hurt3 = card('hurt3', 'ship', [{ kind: 'breach', amount: 3 }]);
  // Threatened (hull 2 of 5), sails shot away and still in the deck: the flee fails.
  const rigged = { ...stacked([hurt3, flee, ...blank(1)]), deck: [woundCard('ship', 'sails', 'sails'), ...blank(5)] };
  const s1 = act(rigged, { type: 'keep', picks: [0, 1] });
  assert.equal(s1.outcome, null);
  const e = s1.events.find((x) => x.type === 'effect' && x.effect.kind === 'flee');
  assert.equal(e?.type === 'effect' && e.note, 'rigging');
  // Repaired aloft — the sails kept, and spent — and the same flee works.
  const fixed = act(stacked([woundCard('ship', 'sails', 'sails'), hurt3, ...blank(1)]), { type: 'keep', picks: [0, 1] });
  assert.equal(fixed.ship.hull, 2, 'sails cost no hull');
  const away = act({ ...fixed, hand: [flee, ...blank(2)] }, { type: 'keep', picks: [0, 1] });
  assert.equal(away.outcome, 'fled');
});

test('the same seed makes the same damage', () => {
  const run = () => {
    let s = merchantEncounter(9);
    while (!s.outcome) s = act(s, legalActions(s)[0]);
    return s.events;
  };
  assert.deepEqual(run(), run());
});

test('the two kept are spent into the discard; the third goes under the deck', () => {
  const [a, b, c] = blank(3).map((x, i) => ({ ...x, id: `h${i}` }));
  const s0 = stacked([a, b, c]);
  const s1 = act(s0, { type: 'keep', picks: [1, 0] });
  assert.deepEqual(s1.discard.map((x) => x.id), ['h1', 'h0'], 'in the order played');
  assert.equal(s1.deck.at(-1)!.id, 'h2');
  assert.ok(![...s1.deck, ...s1.hand].some((x) => x.id === 'h0' || x.id === 'h1'), 'spent cards are out of play');
});

test('a card that ends the fight is spent too', () => {
  const kill = card('kill', 'target', [{ kind: 'breach', amount: 9 }]);
  const s1 = act(stacked([kill, ...blank(2)]), { type: 'keep', picks: [0, 1] });
  assert.equal(s1.outcome, 'destroyed');
  assert.equal(s1.discard.at(-1)!.id, 'kill');
});

test('recall brings back the side’s own spent cards, most recent first — never damage, never theirs', () => {
  const recall = card('recall', 'ship', [{ kind: 'recall', amount: 2 }]);
  const s0 = {
    ...stacked([recall, ...blank(2)]),
    discard: [
      card('old', 'ship', []),
      card('theirs', 'target', []),
      woundCard('ship', 'dmg', 'leak'),
      card('recent', 'ship', []),
    ],
  };
  const s1 = act(s0, { type: 'keep', picks: [0, 1] });
  // The deck was blanks; the hand dealt from its top, so look at the bottom.
  const back = [...s1.deck, ...s1.hand].map((x) => x.id);
  assert.ok(back.includes('recent') && back.includes('old'));
  assert.ok(!back.includes('dmg') && !back.includes('theirs'));
  assert.deepEqual(s1.discard.map((x) => x.id), ['theirs', 'dmg', 'recall', 'blank0']);
  const e = s1.events.find((x) => x.type === 'effect' && x.effect.kind === 'recall');
  assert.equal(e?.type === 'effect' && e.applied, 2);
});

test('with nothing spent, a recall brings nothing', () => {
  const recall = card('recall', 'ship', [{ kind: 'recall', amount: 3 }]);
  const s1 = act(stacked([recall, ...blank(2)]), { type: 'keep', picks: [0, 1] });
  const e = s1.events.find((x) => x.type === 'effect' && x.effect.kind === 'recall');
  assert.equal(e?.type === 'effect' && e.applied, 0);
});

test('a garrison’s relief is a fixed number of cards, every so often — not a flood', () => {
  const relief = { side: 'target' as const, name: 'relief', text: '', effects: [] };
  let s: EncounterState = { ...stacked(blank(3), 40), reinforce: { from: 2, every: 2, count: 3, card: relief } };
  const rounds: number[] = [];
  while (!s.outcome && s.round < 20) {
    const before = s.reinforced;
    s = act(s, { type: 'keep', picks: [0, 1] });
    if (s.reinforced > before) rounds.push(s.round);
  }
  assert.deepEqual(rounds, [2, 4, 6], 'from round 2, every other round, three in all');
});
