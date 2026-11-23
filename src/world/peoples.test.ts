/** The peoples of the coasts, truck, the Huguenots, and the voyage shared. Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { choices, choose } from './dilemmas.ts';
import { raise } from './journey.ts';
import { FRENCH_GRIEVANCE, sailSighted } from './meet.ts';
import {
  AMBUSH, FAIR, HARSH, PEOPLES, ambush, deal, hostileTo, meetPeople, peopleAt, remember, standingOf, standingWord, startingStanding, takeWhatYouNeed,
} from './peoples.ts';
import { FRENCH_COURT, GIFT_PARDON, courtRisk, pardonOf } from './reckoning.ts';
import { BARTER_DAYS, CHANDLER, TRUCK_ROOM, barter, barterHere, buy, daysOf, marketHere, shoreDays, takeHere, trade } from './stores.ts';
import { noWay } from './weather.ts';
import { decode, encode } from '../save.ts';
import { shareText } from '../share.ts';
import { createSea, createWorld, type WorldState } from './world.ts';
import { lyingAt } from './testing.ts';

const sea = createSea();
const { map } = sea;
const said = (w: WorldState, re: RegExp) => w.log.some((l) => re.test(l.text));
const base = (over: Partial<WorldState> = {}, ship = 'sloop', backer: WorldState['backer'] = 'own') => ({ ...createWorld(sea, 1, ship, backer), ...over });
/** Lying at a landmark, with some truck and a purse. */
const at = (key: string, over: Partial<WorldState> = {}) => ({ ...lyingAt(sea, base(), key), truck: 2, gold: 50, ...over });

// --- Standing --------------------------------------------------------------------

test('each people starts where history left them: the Miwok friendly, the Mapuche wary', () => {
  const w = base();
  assert.equal(standingWord(w, 'miwok'), 'friendly');
  assert.equal(standingWord(w, 'mapuche'), 'wary');
  assert.equal(standingWord(w, 'tupinamba'), 'wary');
  assert.equal(peopleAt('mocha'), 'mapuche');
  assert.equal(peopleAt('callao'), null);
});

test('fair dealing brings a people round; harsh dealing turns them, and the log says when', () => {
  let w = base();
  w = deal(w, 'tupinamba', FAIR);
  assert.equal(standingWord(w, 'tupinamba'), 'friendly');
  assert.ok(said(w, /Tupinambá are your friends/));
  w = deal(w, 'tupinamba', HARSH);
  assert.equal(standingWord(w, 'tupinamba'), 'wary');
  w = deal(w, 'tupinamba', HARSH);
  assert.equal(standingWord(w, 'tupinamba'), 'hostile');
  assert.ok(said(w, /turned against you/));
  // Never past the ends.
  for (let i = 0; i < 5; i++) w = deal(w, 'tupinamba', HARSH);
  assert.equal(standingOf(w, 'tupinamba'), -3);
});

test('trading with islanders, in gold or truck, is fair dealing', () => {
  const ladrones = at('ladrones');
  assert.equal(marketHere(sea, ladrones), 'islanders');
  const paid = trade(sea, ladrones);
  assert.equal(standingWord(paid, 'chamorro'), 'friendly');
  const truck = trade(sea, ladrones, 'truck');
  assert.equal(truck.truck, 1);
  assert.equal(truck.gold, ladrones.gold);
  assert.throws(() => trade(sea, { ...ladrones, truck: 0 }, 'truck'), /no truck/);
});

test('truck: bought at Plymouth and nowhere else, so much and no more, and bartered for fresh food where there is no market', () => {
  let home: WorldState = { ...base({ gold: 100 }), voyage: { at: 'plymouth', bound: null, visited: ['plymouth'] } };
  for (let i = 0; i < TRUCK_ROOM; i++) home = buy(sea, home, 'truck');
  assert.equal(home.truck, TRUCK_ROOM);
  assert.equal(home.gold, 100 - TRUCK_ROOM * CHANDLER.truck.cost);
  assert.throws(() => buy(sea, home, 'truck'), /hold is full/);
  assert.throws(() => buy(sea, at('ternate'), 'truck'), /bought at Plymouth/);

  const san = at('san-julian', { fresh: 30, stores: { ...base().stores, food: 100, water: 10 } });
  assert.ok(barterHere(sea, san));
  const fed = barter(sea, san);
  assert.equal(fed.truck, 1);
  assert.equal(fed.fresh, 0);
  assert.ok(daysOf(fed).food >= BARTER_DAYS);
  assert.equal(standingWord(fed, 'patagonians'), 'friendly');
  assert.throws(() => barter(sea, { ...san, truck: 0 }), /no truck/);
  // Not where there's a market, nor where there's nobody.
  assert.ok(!barterHere(sea, at('ladrones')));
  assert.ok(!barterHere(sea, at('callao')));
});

test('taking what you need: fresh food and water at once, and the coast turned against you', () => {
  const brazil = at('brazil', { fresh: 40, stores: { ...base().stores, food: 0, water: 0 } });
  assert.ok(takeHere(sea, brazil));
  const taken = takeWhatYouNeed(brazil);
  assert.equal(taken.fresh, 0);
  assert.ok(daysOf(taken).water > 0 && daysOf(taken).food > 0);
  assert.equal(standingWord(taken, 'tupinamba'), 'hostile');
  assert.ok(said(taken, /take what they need/));
  // Hostile: no barter, no islanders' market.
  assert.ok(!barterHere(sea, taken));
  const ladrones = deal(deal(at('ladrones'), 'chamorro', HARSH), 'chamorro', HARSH);
  assert.ok(hostileTo(ladrones, 'chamorro'));
  assert.equal(marketHere(sea, ladrones), null);
});

test('friendly, they guide you and bring food down to the beach; wary or worse, arrows at the work ashore', () => {
  const nova = at('nova-albion');
  assert.equal(shoreDays(nova, 'forage'), 2);
  const met = meetPeople(nova, 'nova-albion');
  assert.ok(said(met, /Miwok: friendly/));
  assert.ok(said(met, /a gift/));
  assert.equal(meetPeople(met, 'nova-albion').log.filter((l) => /a gift/.test(l.text)).length, 1, 'the gift once');
  // Arrows: never from friends; from the hostile, often.
  const r = { rng: 1 };
  let hits = 0;
  for (let i = 0; i < 400; i++) if (ambush({ ...at('mocha'), peoples: { ...base().peoples, mapuche: -3 } }, r).crew < at('mocha').crew) hits++;
  assert.ok(hits > 400 * AMBUSH.hostile * 0.7 && hits < 400 * AMBUSH.hostile * 1.3, `ambushed ${hits} of 400`);
  for (let i = 0; i < 100; i++) assert.equal(ambush(nova, r).crew, nova.crew);
});

test('the hands wrong a people: flog them, pay amends, or let it pass and lose the coast', () => {
  const w: WorldState = { ...at('sierra-leone'), dilemma: { kind: 'misconduct', people: 'temne' } };
  assert.deepEqual(choices(w, w.dilemma!).map((c) => c.key), ['punish', 'amends', 'pass']);
  assert.equal(standingWord(choose(sea, w, 'punish'), 'temne'), 'friendly');
  const amends = choose(sea, w, 'amends');
  assert.equal(amends.truck, 1);
  assert.equal(standingWord(amends, 'temne'), 'wary');
  assert.equal(standingWord(choose(sea, w, 'pass'), 'temne'), 'hostile');
});

test('canoes: truck is goodwill, a gun over them is remembered', () => {
  const w: WorldState = { ...base({ truck: 1 }), player: map.landmarks.ladrones, dilemma: { kind: 'canoes' } };
  assert.ok(choices(w, w.dilemma!).some((c) => c.key === 'truck'));
  assert.equal(standingWord(choose(sea, w, 'truck'), 'chamorro'), 'friendly');
  assert.equal(standingOf(choose(sea, w, 'warn'), 'chamorro'), -1);
});

test('a hostile coast is remembered by the next voyage, a friendly one too, and a wary one forgotten', () => {
  let w = base();
  w = deal(deal({ ...w, seen: [...w.seen, 'met:mapuche'] }, 'mapuche', HARSH), 'mapuche', HARSH);
  w = deal(w, 'tupinamba', FAIR);
  const memory = remember({ temne: 'hostile' }, { ...w, seen: [...w.seen, 'met:temne'] });
  assert.deepEqual(memory, { mapuche: 'hostile', tupinamba: 'friendly' });
  // The next voyage: the Mapuche hostile from the start, and they say why.
  const next = createWorld(sea, 2, 'sloop', 'own', false, memory);
  assert.equal(standingWord(next, 'mapuche'), 'hostile');
  assert.deepEqual(next.peoples, startingStanding(memory));
  const mocha = raise(sea, { ...next, player: map.landmarks.mocha, voyage: { at: 'strait', bound: 'mocha', visited: ['plymouth', 'strait'] } });
  assert.ok(said(mocha, /remember the last English ship, and keep to the trees/));
});

// --- The Huguenots -------------------------------------------------------------------

test('Huguenot privateers hail you as a friend, off Spain, Guinea and Brazil', () => {
  const off = map.nodes.find((n) => n.lat > 40 && n.lat < 44 && n.lon > -12 && n.lon < -9 && !n.port && map.adj[n.id].length)!.id;
  let met = 0;
  for (let rng = 0; rng < 4000 && !met; rng++) {
    const w = sailSighted(sea, { ...base(), player: off, rng });
    if (w.dilemma?.kind === 'huguenots') met++;
  }
  assert.ok(met, 'met them');
});

test('in company, privateers and corsairs stand off, and you wait for the slower ship a day in four', () => {
  const w: WorldState = { ...base(), dilemma: { kind: 'huguenots' } };
  const company = choose(sea, w, 'company');
  assert.ok(company.company > company.turn);
  assert.ok([0, 1, 2, 3].some((d) => noWay({ ...company, turn: company.turn + d })));
  const off = map.nodes.find((n) => n.lat > 40 && n.lat < 44 && n.lon > -12 && n.lon < -9 && !n.port && map.adj[n.id].length)!.id;
  for (let rng = 0; rng < 2000; rng++) assert.equal(sailSighted(sea, { ...company, player: off, rng }).encounter, null);
});

test('a French commission: refused under the Crown; halves Spain’s grievance, but the Queen likes it less', () => {
  const crown: WorldState = { ...base({}, 'sloop', 'crown'), dilemma: { kind: 'huguenots' } };
  assert.ok(choices(crown, crown.dilemma!).find((c) => c.key === 'commission')!.barred);
  const own: WorldState = { ...base(), dilemma: { kind: 'huguenots' } };
  const french = choose(sea, own, 'commission');
  assert.ok(french.french);
  assert.ok(choices({ ...french, dilemma: { kind: 'huguenots' } }, { kind: 'huguenots' }).find((c) => c.key === 'commission')!.barred, 'one is enough');
  assert.equal(FRENCH_GRIEVANCE, 0.5);
  const plain = { ...own, dilemma: null, grievance: 300 };
  assert.ok(Math.abs(courtRisk({ ...plain, french: true }) - courtRisk(plain) - FRENCH_COURT) < 0.011);
  assert.equal(pardonOf(plain), GIFT_PARDON);
  assert.equal(pardonOf({ ...plain, french: true }), 1);
  const news = choose(sea, own, 'news');
  assert.ok(news.dilemma?.kind === 'rumor' || said(news, /nothing in their news/), 'news is a rumor, or nothing');
});

// --- Saves and sharing ----------------------------------------------------------------

test('a save from before the peoples comes forward, with the coasts as history left them', () => {
  const { peoples: _p, memory: _m, truck: _t, company: _c, french: _f, ...old } = base();
  const text = JSON.stringify({ ...JSON.parse(encode(1, old as WorldState)), version: 17 });
  const saved = decode(text)!;
  assert.equal(saved.world.truck, 0);
  assert.equal(saved.world.french, false);
  assert.equal(standingWord(saved.world, 'miwok'), 'friendly');
});

test('the voyage shared: which voyage, the ship and her money, how far, who died, the score, the seed', () => {
  const home = { ...base({}, 'sloop', 'crown'), won: true, ending: 'home' as const, gold: 300, verdict: 'court' as const, voyage: { at: 'plymouth-home', bound: null, visited: ['plymouth', 'canaries', 'cape', 'plymouth-home'] } };
  const dead = { ...home, hands: home.hands.map((h, i) => (i === 0 ? { ...h, dead: { turn: 40, node: 0, place: 'at sea', cause: 'scurvy' } } : h)) };
  const text = shareText(dead, 1234, '2026-11-23');
  const lines = text.split('\n');
  assert.ok(lines.length <= 12);
  assert.match(lines[0], /today's voyage, 2026-11-23/);
  assert.match(text, /a sloop, on the Crown’s money/);
  assert.match(text, /home to Plymouth/);
  assert.match(text, /a voyage like/);
  assert.match(text, /of scurvy/);
  assert.match(text, /seed 1234/);
  assert.doesNotMatch(text, /@|http/);
  const lost = shareText({ ...base(), sunk: true, voyage: { at: 'mocha', bound: null, visited: ['plymouth', 'mocha'] } }, 9, null);
  assert.match(lost, /lost on .*last raised Mocha Island/);
  assert.match(lost, /Oxenham/);
  void PEOPLES;
});
