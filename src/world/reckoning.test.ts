/** Backers, privateer or pirate, and the reckoning at home. Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SHIP_CLASSES, SHIPS } from '../outfit.ts';
import { legalActions } from '../rules.ts';
import { choices, choose } from './dilemmas.ts';
import { HOME_LANDMARK } from './landmarks.ts';
import { raise } from './journey.ts';
import { attack, fight, hailExtra, NEUTRAL_CARGO } from './meet.ts';
import {
  BACKERS, BACKER_KEYS, CROWN_SHARE, GIFT_PARDON, PIRATE_INFAMY, SEIZED, courtRisk, fameFor, giftFor, grievanceWord, lawfulness, outlawed, sharesDue,
} from './reckoning.ts';
import { score } from './score.ts';
import { decode, encode } from '../save.ts';
import { createSea, createWorld, type WorldState } from './world.ts';

const sea = createSea();
const { map } = sea;

/** Bound home from Sierra Leone, just off Plymouth, with this in the strongroom. */
const homeward = (over: Partial<WorldState> = {}, backer: WorldState['backer'] = 'own', ship = 'pinnace'): WorldState => ({
  ...createWorld(sea, 1, ship, backer),
  player: map.landmarks[HOME_LANDMARK],
  voyage: { at: 'sierra-leone', bound: HOME_LANDMARK, visited: ['plymouth', 'canaries', 'ladrones', 'cape', 'sierra-leone'] },
  ...over,
});
const home = (over: Partial<WorldState> = {}, backer: WorldState['backer'] = 'own', ship = 'pinnace') => raise(sea, homeward(over, backer, ship));
const said = (w: WorldState, re: RegExp) => w.log.some((l) => re.test(l.text));

test('each backer fits you out differently: gentlemen most, the Crown less but with stores, your own stake nothing', () => {
  for (const ship of SHIPS) {
    const purse = SHIP_CLASSES[ship].purse;
    const [crown, gentlemen, own] = BACKER_KEYS.map((b) => createWorld(sea, 1, ship, b));
    assert.equal(own.gold, purse);
    assert.equal(own.stake, 0);
    assert.ok(gentlemen.gold > purse && crown.gold > purse);
    assert.equal(crown.stores.spares, own.stores.spares + BACKERS.crown.spares);
    assert.equal(crown.stores.powder, own.stores.powder + BACKERS.crown.powder);
    assert.equal(gentlemen.stake, gentlemen.gold - purse);
  }
  assert.throws(() => createWorld(sea, 1, 'pinnace', 'pope' as never), /no such backer/);
});

test('at home the backers take their shares: the Queen a third, the gentlemen their stake and a quarter of the profit', () => {
  const crown = homeward({ gold: 300 }, 'crown');
  assert.equal(sharesDue(crown).queen, Math.round(300 * CROWN_SHARE));
  const g = homeward({ gold: 400 }, 'gentlemen');
  const purse = SHIP_CLASSES.pinnace.purse;
  assert.equal(sharesDue(g).gentlemen, Math.round(g.stake + (400 - purse - g.stake) / 4));
  assert.equal(sharesDue(homeward({ gold: 50 }, 'gentlemen')).gentlemen, Math.min(50, g.stake), 'no profit: they take what there is, to their stake');
  assert.deepEqual(sharesDue(homeward({ gold: 400 })), { queen: 0, gentlemen: 0 });
  const back = home({ gold: 300 }, 'crown');
  assert.equal(back.gold, 300 - Math.round(300 * CROWN_SHARE));
  assert.equal(back.settled.queen, Math.round(300 * CROWN_SHARE));
  assert.ok(said(back, /Queen's third/));
});

test('a friend’s merchant: richer than she looks, and taking her is piracy, twice over under the Crown', () => {
  const sighted = (backer: WorldState['backer']) => ({ ...createWorld(sea, 1, 'pinnace', backer), hail: { kind: 'merchant' as const, nation: 'hanse' as const, neutral: true as const } });
  assert.equal(hailExtra(sighted('own').hail).cargo, NEUTRAL_CARGO);
  assert.equal(attack(sighted('own')).infamy, 1);
  assert.equal(attack(sighted('crown')).infamy, 2);
  assert.ok(said(attack(sighted('own')), /piracy/));
  // A Spaniard is fair game: no infamy, but what she pays mounts up as Spain's grievance.
  let w = attack({ ...createWorld(sea, 1), hail: { kind: 'merchant', nation: 'spain' } });
  assert.equal(w.infamy, 0);
  while (w.encounter) w = fight(sea, w, legalActions(w.encounter.fight)[0]);
  assert.equal(w.grievance, w.reckoning!.outcome === 'sunk' ? 0 : w.reckoning!.payout);
  assert.equal(lawfulness(createWorld(sea, 1)), 'lawful');
  assert.equal(lawfulness({ ...createWorld(sea, 1), infamy: PIRATE_INFAMY }), 'a name for piracy');
  assert.equal(grievanceWord({ ...createWorld(sea, 1), grievance: 500 }), 'great');
});

test('raising Plymouth brings the reckoning; nothing is over till it’s answered', () => {
  const w = home({ gold: 250 });
  assert.equal(w.dilemma?.kind, 'reckoning');
  assert.ok(!w.won);
  assert.deepEqual(choices(w, w.dilemma!).map((c) => c.key), ['court', 'low', 'gift']);
});

test('lie low: safe, and no fame', () => {
  const w = choose(sea, home({ gold: 250, grievance: 400 }), 'low');
  assert.ok(w.won);
  assert.equal(w.verdict, 'low');
  assert.equal(w.fame, 0);
  assert.equal(w.gold, 250);
});

test('show yourself at court: fame, or disowned and the silver handed back', () => {
  const clean = choose(sea, home({ gold: 250 }), 'court');
  assert.equal(clean.verdict, 'court', 'no grievance, no risk');
  assert.equal(clean.fame, fameFor(250));
  let disowned = 0;
  for (let rng = 0; rng < 60; rng++) {
    const w = choose(sea, { ...home({ gold: 300, grievance: 700, infamy: 1 }), rng }, 'court');
    if (w.verdict === 'disowned') {
      disowned++;
      assert.equal(w.fame, 0);
      assert.ok(w.gold < 300 && w.settled.restitution > 0);
    } else assert.equal(w.verdict, 'court');
  }
  assert.ok(disowned > 10 && disowned < 50, `${disowned} of 60 disowned`);
  assert.ok(courtRisk(homeward({ grievance: 700 }, 'crown')) < courtRisk(homeward({ grievance: 700 })), 'the Queen’s favour shields you');
});

test('a gift for the Queen: a share of the treasure, some infamy forgotten, and court made safe', () => {
  const s = home({ gold: 300, grievance: 900, infamy: 2 });
  const gift = giftFor(s);
  const w = choose(sea, s, 'gift');
  assert.equal(w.verdict, 'gift');
  assert.equal(w.gold, 300 - gift);
  assert.equal(w.infamy, Math.max(0, 2 - GIFT_PARDON));
  assert.equal(w.fame, fameFor(300 - gift));
});

test('a name for piracy and no favour: the prize seized, and named a pirate', () => {
  const s = home({ gold: 400, infamy: PIRATE_INFAMY + GIFT_PARDON });
  assert.ok(outlawed(s));
  const w = choose(sea, s, 'court');
  assert.equal(w.verdict, 'pirate');
  assert.equal(w.gold, 400 - Math.round(400 * SEIZED));
  assert.ok(w.won, 'home, all the same');
  assert.notEqual(score(w).like, 'drake');
  assert.match(score(w).text, /pirate/);
  // Under the Crown's favour, the same name is only questions.
  assert.ok(!outlawed(home({ gold: 400, infamy: PIRATE_INFAMY + GIFT_PARDON }, 'crown')));
});

test('the score counts the fame, and Drake’s voyage needs not to be disowned', () => {
  const court = choose(sea, home({ gold: 400, crew: 30 }), 'court');
  const low = choose(sea, home({ gold: 400, crew: 30 }), 'low');
  assert.equal(score(court).fame, court.fame);
  assert.ok(score(court).total > score(low).total);
  assert.equal(score(court).like, 'drake');
  const disowned = { ...court, verdict: 'disowned' as const, fame: 0 };
  assert.notEqual(score(disowned).like, 'drake');
});

test('a save from before the reckoning sailed on its own stake', () => {
  const { backer: _b, stake: _s, infamy: _i, grievance: _g, fame: _f, verdict: _v, settled: _t, ...old } = createWorld(sea, 1);
  const text = JSON.stringify({ ...JSON.parse(encode(1, old as WorldState)), version: 14 });
  const w = decode(text)!.world;
  assert.equal(w.backer, 'own');
  assert.equal(w.infamy, 0);
  assert.equal(w.verdict, null);
  assert.equal(w.settled.queen, 0);
});
