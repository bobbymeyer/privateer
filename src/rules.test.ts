/** Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { type Card, cardType, woundCard } from './cards.ts';
import { act, type Action, CLOSE, createEncounter, FAR, GRAPPLED, legalActions, type EncounterState, type Range } from './rules.ts';
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

test('your deck running short parts the ships', () => {
  // Three blanks: one hand, keep two, the third goes under — one card can't make a hand.
  const s1 = act(encounter(blank(3)), { type: 'keep', picks: [0, 1] });
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

const flee = (side: Card['side'], amount = 1) => card(`flee-${side}`, side, [{ kind: 'flee', amount }]);
const hold = (side: Card['side'], amount = 1) => card(`hold-${side}`, side, [{ kind: 'hold', amount }]);
const chase = (side: Card['side'], amount = 1) => card(`chase-${side}`, side, [{ kind: 'chase', amount }]);
const hurt = (n: number) => card(`hurt${n}`, 'ship', [{ kind: 'breach', amount: n }]);
const keep01: Action = { type: 'keep', picks: [0, 1] };

/** As `stacked`, at this range, with her intent face up and her deck beneath it. */
function facing(hand: Card[], range: Range, intent: Card | null = null, herDeck: Card[] = blank(6, 'target')): EncounterState {
  return { ...stacked(hand), range, intent, herDeck: herDeck.map((c, i) => ({ ...c, id: `her${i}` })) };
}

test('bearing away opens the range; opened past far, you are away, with what you came for', () => {
  const s1 = act({ ...facing([flee('ship'), ...blank(2)], CLOSE), plunder: 4 }, keep01);
  assert.equal(s1.outcome, null);
  assert.equal(s1.range, FAR);
  const s2 = act({ ...s1, hand: [flee('ship'), ...blank(2)] }, keep01);
  assert.equal(s2.outcome, 'fled');
  assert.equal(s2.payout, 4);
});

test('chase and grapnels close the range, down to grappled and no closer', () => {
  const s1 = act(facing([chase('ship'), hold('ship'), ...blank(1)], FAR), keep01);
  assert.equal(s1.range, GRAPPLED);
  const s2 = act({ ...s1, hand: [chase('ship'), ...blank(2)] }, keep01);
  assert.equal(s2.range, GRAPPLED);
});

test('her intent is face up, plays after yours, and the next turns up', () => {
  const runs = card('she-runs', 'target', [{ kind: 'flee', amount: 1 }]);
  const s0 = facing(blank(3), FAR, runs);
  assert.equal(s0.intent!.id, 'she-runs');
  const s1 = act(s0, keep01);
  assert.equal(s1.outcome, 'escaped', 'from far, her bearing away is the end of it');
  // Another round: her next card is up.
  const s2 = act(facing(blank(3), CLOSE, card('fire', 'target', [{ kind: 'hurt', amount: 1 }])), keep01);
  assert.equal(s2.ship.hull, 4);
  assert.equal(s2.intent!.id, 'her0');
  assert.deepEqual(s2.herDiscard.map((c) => c.id), ['fire']);
});

test('order matters: run her down before she bears away, and she falls short', () => {
  const runs = card('she-runs', 'target', [{ kind: 'flee', amount: 1 }]);
  // Her intent shown: she'll bear away from far. Chase first: far → close, then she runs: close → far. Still here.
  const chased = act(facing([chase('ship'), ...blank(2)], FAR, runs), keep01);
  assert.equal(chased.outcome, null);
  assert.equal(chased.range, FAR);
  // Without the chase she's away.
  assert.equal(act(facing(blank(3), FAR, runs), keep01).outcome, 'escaped');
});

test('a card out of range does nothing, and says so', () => {
  const broadside = card('broadside', 'ship', [{ kind: 'hit', amount: 3, at: ['close'] }]);
  const atFar = act(facing([broadside, ...blank(2)], FAR), keep01);
  assert.equal(atFar.target.hull, 5);
  const e = atFar.events.find((x) => x.type === 'effect' && x.card.id === 'broadside');
  assert.ok(e && e.type === 'effect' && e.note === 'range' && e.applied === 0);
  assert.equal(act(facing([broadside, ...blank(2)], CLOSE), keep01).target.hull, 2);
});

test('a ship that runs takes the rest of her hold with her', () => {
  const s0 = facing([card('haul', 'ship', [{ kind: 'plunder', amount: 2 }]), ...blank(2)], FAR, card('runs', 'target', [{ kind: 'flee', amount: 1 }]));
  const s1 = act(s0, keep01);
  assert.equal(s1.outcome, 'escaped');
  assert.equal(s1.payout, 2);
});

test('a town goes nowhere: its people can carry things inland, but it can’t bear away', () => {
  const s0 = { ...facing(blank(3), CLOSE, card('run', 'target', [{ kind: 'flee', amount: 5 }])), target: { ...facing(blank(3), CLOSE).target, fixed: true } };
  const s1 = act(s0, keep01);
  assert.equal(s1.outcome, null);
  assert.equal(s1.range, CLOSE);
});

test('prisoners give up rumors, which go down with you if you sink', () => {
  const talk = card('talk', 'ship', [{ kind: 'interrogate', reliability: 0.7 }]);
  const s1 = act(stacked([talk, ...blank(2)]), { type: 'keep', picks: [0, 1] });
  assert.deepEqual(s1.intel, [0.7]);
  const s2 = act(stacked([talk, hurt(9), ...blank(1)]), { type: 'keep', picks: [0, 1] });
  assert.equal(s2.outcome, 'sunk');
  assert.deepEqual(s2.intel, []);
});

const damageIn = (cards: Card[], side: Card['side']) => cards.filter((c) => c.damage && c.side === side).length;

test('shot strikes the hull at once; brace soaks yours', () => {
  const s0 = { ...facing([card('broadside', 'ship', [{ kind: 'hit', amount: 3 }]), ...blank(2)], CLOSE, card('return', 'target', [{ kind: 'hurt', amount: 2 }])), ship: { hull: 5, maxHull: 5, brace: 1 } };
  const s1 = act(s0, keep01);
  assert.equal(s1.target.hull, 2);
  assert.equal(s1.ship.hull, 4, 'one of the two braced');
  assert.equal(damageIn([...s1.herDeck, ...(s1.intent ? [s1.intent] : [])], 'target'), 0, 'plain shot leaves no wound');
});

test('a wound to her goes on top of her deck: her next card is dealing with it, and it costs her', () => {
  const leak = card('leaky', 'ship', [{ kind: 'wound', what: 'leak' }]);
  const s1 = act(facing([leak, ...blank(2)], CLOSE), keep01);
  assert.equal(s1.intent!.wound, 'leak');
  assert.equal(s1.intent!.side, 'target');
  const s2 = act({ ...s1, hand: blank(3) }, keep01);
  assert.equal(s2.target.hull, 5 - 2, 'a leak costs two');
});

test('a wound to you goes on top of your deck: in your next hand, it costs its hull when kept', () => {
  const s1 = act(facing(blank(3), CLOSE, card('fireship', 'target', [{ kind: 'wound', what: 'fire' }])), keep01);
  assert.equal(s1.hand[0].wound, 'fire');
  assert.equal(s1.hand[0].side, 'ship');
  const s2 = act(s1, keep01);
  assert.equal(s2.ship.hull, 5 - 3, 'a fire costs three');
  assert.ok(s2.discard.some((c) => c.wound === 'fire'), 'and it is spent');
});

test('shot-away sails: no bearing away till they are dealt with, for either side', () => {
  const sails = woundCard('ship', 'sails-ship#1', 'sails');
  const s0 = { ...facing([flee('ship'), ...blank(2)], FAR), deck: [sails, ...blank(6)] };
  const s1 = act(s0, keep01);
  assert.equal(s1.outcome, null, 'you could not get away');
  const e = s1.events.find((x) => x.type === 'effect' && x.effect.kind === 'flee');
  assert.ok(e && e.type === 'effect' && e.note === 'rigging');
  // Hers: sails against her in her deck, and her bearing away fails.
  const hers = facing(blank(3), FAR, card('runs', 'target', [{ kind: 'flee', amount: 1 }]), [woundCard('target', 'sails-t#1', 'sails'), ...blank(4, 'target')]);
  assert.equal(act(hers, keep01).outcome, null);
});

test('the two kept are spent; the third goes under your deck; her card goes to her discard', () => {
  const s0 = facing(blank(3).map((c, i) => ({ ...c, id: `h${i}` })), CLOSE, card('hers', 'target', []));
  const s1 = act(s0, keep01);
  assert.deepEqual(s1.discard.map((c) => c.id), ['h0', 'h1']);
  assert.ok(s1.deck.some((c) => c.id === 'h2'));
  assert.deepEqual(s1.herDiscard.map((c) => c.id), ['hers']);
});

test('a card that ends the fight is spent too', () => {
  const s1 = act(facing([card('kill', 'ship', [{ kind: 'hit', amount: 9 }]), ...blank(2)], CLOSE), keep01);
  assert.equal(s1.outcome, 'destroyed');
  assert.ok(s1.discard.some((c) => c.id === 'kill'));
});

test('recall brings back your own spent cards, most recent first, never wounds', () => {
  const recall = card('recall', 'ship', [{ kind: 'recall', amount: 2 }]);
  const spent = [card('a', 'ship', []), woundCard('ship', 'leak-ship#9', 'leak'), card('b', 'ship', [])];
  const s1 = act({ ...facing([recall, ...blank(2)], CLOSE), discard: spent }, keep01);
  assert.deepEqual(s1.discard.map((c) => c.id).filter((id) => id !== 'recall' && !id.startsWith('blank')), ['leak-ship#9']);
  assert.deepEqual(s1.deck.slice(-3).map((c) => c.id).filter((id) => id === 'a' || id === 'b'), ['b', 'a']);
});

test('with nothing spent, a recall brings nothing', () => {
  const recall = card('recall', 'ship', [{ kind: 'recall', amount: 3 }]);
  const s1 = act(facing([recall, ...blank(2)], CLOSE), keep01);
  const e = s1.events.find((x) => x.type === 'effect' && x.effect.kind === 'recall');
  assert.equal(e?.type === 'effect' && e.applied, 0);
});

test('a garrison’s relief is a fixed number of cards, every so often — not a flood', () => {
  const relief = { side: 'target' as const, name: 'relief', text: '', effects: [] };
  let s: EncounterState = { ...stacked(blank(3), 40), reinforce: { from: 2, every: 2, count: 3, card: relief } };
  const rounds: number[] = [];
  while (!s.outcome && s.round < 20) {
    const before = s.reinforced;
    s = act(s, keep01);
    if (s.reinforced > before) rounds.push(s.round);
  }
  assert.deepEqual(rounds, [2, 4, 6], 'from round 2, every other round, three in all');
});

// The chain: sail → shot → board.
const sail = (id = 'sail') => card(id, 'ship', [{ kind: 'chase', amount: 1 }]);
const shot = (id = 'shot', n = 2) => card(id, 'ship', [{ kind: 'hit', amount: n }]);
const board = (id = 'board', n = 2) => card(id, 'ship', [{ kind: 'plunder', amount: n }]);
const patch = (id = 'patch') => card(id, 'ship', [{ kind: 'repair', amount: 1 }]);

test('every card has a type, from what it does', () => {
  assert.equal(cardType(sail()), 'sail');
  assert.equal(cardType(shot()), 'shot');
  assert.equal(cardType(board()), 'board');
  assert.equal(cardType(patch()), 'hands');
  assert.equal(cardType(woundCard('ship', 'leak#1', 'leak')), 'hands');
});

test('shot after sail is a link: +1 to its hits', () => {
  const s1 = act({ ...facing([sail(), shot(), ...blank(1)], FAR), target: { ...stacked(blank(3)).target, hull: 9, maxHull: 9 } }, keep01);
  assert.equal(s1.target.hull, 9 - 3, 'two, and one for the link');
  assert.ok(s1.events.some((e) => e.type === 'chain' && e.links === 1));
  // The other way round, no link.
  const s2 = act({ ...facing([sail(), shot(), ...blank(1)], FAR), target: { ...stacked(blank(3)).target, hull: 9, maxHull: 9 } }, { type: 'keep', picks: [1, 0] });
  assert.equal(s2.target.hull, 9 - 2);
});

test('the chain carries across rounds, her card between doesn’t break it, and a full chain scales the board +2', () => {
  // Round one: sail, then shot (+1). Round two: board follows the shot: +2.
  const s0 = { ...facing([sail(), shot(), ...blank(1)], GRAPPLED), target: { ...stacked(blank(3)).target, hull: 20, maxHull: 20, cargo: 20 } };
  const s1 = act(s0, keep01);
  assert.deepEqual(s1.chain, { last: 'shot', links: 1 });
  const s2 = act({ ...s1, hand: [board(), ...blank(2)] }, keep01);
  assert.equal(s2.plunder, 2 + 2);
  assert.deepEqual(s2.chain, { last: null, links: 0 }, 'a full chain closes');
});

test('hands keep the chain; anything out of order starts it again', () => {
  const kept = act(facing([sail(), patch(), ...blank(1)], CLOSE), keep01);
  assert.deepEqual(kept.chain, { last: 'sail', links: 0 });
  const broken = act({ ...facing([shot(), shot('shot2'), ...blank(1)], CLOSE) }, keep01);
  assert.deepEqual(broken.chain, { last: 'shot', links: 0 }, 'shot after shot is no link');
});

test('a link never adds to bearing away or closing the range', () => {
  const run = card('run', 'ship', [{ kind: 'flee', amount: 1 }]);
  // A chain at board can't be followed, and sail starts one; so try a link on a sail card by hand.
  const s1 = act({ ...facing([run, ...blank(2)], CLOSE), chain: { last: 'board', links: 2 } }, keep01);
  assert.equal(s1.range, FAR, 'one step, no more');
});

test('a card that does nothing at this range is no link: it breaks the chain', () => {
  const longShot = card('long', 'ship', [{ kind: 'hit', amount: 2, at: ['far'] }]);
  const s1 = act({ ...facing([longShot, ...blank(2)], CLOSE), chain: { last: 'sail', links: 0 } }, keep01);
  assert.deepEqual(s1.chain, { last: null, links: 0 });
  assert.ok(!s1.events.some((e) => e.type === 'chain'));
});
