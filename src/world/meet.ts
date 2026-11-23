/**
 * Meeting a ship, and raiding a town.
 *
 * Nothing sails about the chart for you to find. Each day at sea there's a
 * chance of a sail, and what she is depends on where you are: off Spain and
 * the Barbary coast a privateer or a corsair, who comes at you; off Brazil
 * a Portuguese merchant; on the coast of Peru a Spanish one; in the East a
 * Portuguese merchant, or a carrack. Off Cape San Francisco, the treasure
 * ship (treasure.ts). A merchant is yours to attack or let pass.
 *
 * The Spanish towns on the way — Valparaíso, Callao, Guatulco, Manila — can
 * each be raided once. A town can't run, but its people carry what they can
 * inland, and if the raid goes on, the garrison's relief comes.
 *
 * A fight is fought card by card, and afterwards settled: what it cost in
 * powder and hands, gold into the purse, her hold into yours.
 */

import { act, type Action, CLOSE, type EncounterState, FAR, type Outcome } from '../rules.ts';
import { cardType } from '../cards.ts';
import { deckOf } from '../outfit.ts';
import { encounterWith, type Extra, type TargetKind } from '../setup.ts';
import { landmark } from './landmarks.ts';
import type { Nation } from './ports.ts';
import { type Roller, pick, roll } from './random.ts';
import { recordFight, tallied, whatOf } from './record.ts';
import { capacity, fightCost, landmarkHere, prizeStores } from './stores.ts';
import { plateExtra } from './treasure.ts';
import { GOA_EXTRA, PRIZES, type Prize, hearFromPrisoners } from './rumors.ts';
import type { Sea, WorldState } from './world.ts';
import { infamyFor } from './reckoning.ts';
import { alive, mourn, nameOf } from './hands.ts';
import { plunderJewels } from './jewels.ts';
import { freed } from './captives.ts';
import { read } from './reading.ts';

export interface Meeting {
  kind: TargetKind;
  nation: Nation;
  fight: EncounterState;
  /** She came at you, rather than you at her. */
  forced: boolean;
  /** The landmark of the town you're raiding, or null for a ship. */
  raid: string | null;
  /** The treasure ship. */
  plate: boolean;
  /** A prize at the end of a rumor: the Manila galleon, the Great Ship, the carrack from Goa. */
  prize?: Prize;
  /** Practice on a fishing boat at the Canaries: nothing it costs counts. See `practise`. */
  practice?: true;
}

/** A sail in sight, waiting on your choice: attack, or let her pass. */
export interface Hail {
  kind: TargetKind;
  nation: Nation;
  /** The treasure ship off Cape San Francisco: asleep, or warned by your raids. See treasure.ts. */
  plate?: 'asleep' | 'warned';
  /** A prize at the end of a rumor. See rumors.ts. */
  prize?: Prize;
  /** A friend's merchant — French, Hanseatic, Dutch — and taking her is piracy. See reckoning.ts. */
  neutral?: true;
}

export interface Reckoning {
  kind: TargetKind;
  nation: Nation;
  outcome: Outcome;
  payout: number;
  raid: string | null;
  /** What the fight cost and paid, in the log's words. */
  said: string[];
}

/** Under a French commission, what you take from Spain counts this much toward its grievance. */
export const FRENCH_GRIEVANCE = 0.5;

/** A sail sighted, on any day at sea, in waters where nobody has seen you yet. */
export const SIGHT_CHANCE = 1 / 25;

/**
 * What the lookout calls you up for. `every`: every sail. `worth`: those
 * that come at you, the Huguenots, the treasure ship and the prizes at the
 * end of a rumor, and a Spanish or Portuguese ship you could take as you
 * are; the rest he lets go by with a line in the log.
 */
export type Lookout = 'every' | 'worth';

/**
 * In waters where you've been seen, a harmless sail is less likely: word
 * goes round, and merchants keep their distance. Privateers and corsairs are
 * hunting you, and come as often as ever.
 */
export const keepsAway = (s: WorldState, waters: string) => 1 - 1 / (1 + (s.sightings[waters] ?? 0) / 2);
/** The chance a harmless sail is seen in these waters today. */
export const sightChance = (s: WorldState, waters: string) => SIGHT_CHANCE * (1 - keepsAway(s, waters));

/** How a fight with the sail in sight looks, her hull and guns against yours as you are: told before you choose. */
export type Odds = 'fair' | 'hard' | 'hopeless';
export function oddsOf(s: WorldState, h: Hail): Odds {
  const her = read(h.kind, hailExtra(h));
  const deadly = her.traits.includes('deadly alongside') || her.traits.includes('her guns reach you far off');
  const ratio = her.hull / Math.max(1, s.hull);
  if (s.hull <= 2 || ratio >= 2.2 || (deadly && ratio >= 1.6)) return 'hopeless';
  if (ratio >= 1.2 || (deadly && ratio >= 0.9) || s.stores.powder <= 0) return 'hard';
  return 'fair';
}
/** The odds in a line, and the master's word on them while he lives. */
export function oddsSaid(s: WorldState, h: Hail): string {
  const odds = oddsOf(s, h);
  if (odds === 'fair') return '';
  const plain = odds === 'hopeless' ? 'she would likely sink you as you are' : s.stores.powder <= 0 ? 'with no powder aboard, a hard fight' : 'she outguns you: a hard fight';
  if (!alive(s, 'master')) return plain;
  return `${plain}. ${nameOf(s, 'master')}, the master: “${odds === 'hopeless' ? 'she’ll sink us as we are, captain. let her go.' : 'she’s more than we are, captain.'}”`;
}

/** Whether the quieter lookout calls you up for this sail. */
export function worthStopping(s: WorldState, h: Hail): boolean {
  if (h.plate || h.prize) return true;
  // A friend's merchant: you'd have to turn pirate to take her.
  if (h.neutral) return false;
  return oddsOf(s, h) === 'fair' && s.hull >= s.maxHull / 2;
}

interface Waters {
  name: string;
  box: [number, number, number, number];
  /** Who you meet there, and how often of the sails sighted. */
  sails: { kind: TargetKind; nation: Nation; weight: number; neutral?: true; huguenot?: true }[];
}

/** What a friend's merchant carries over her kind's usual: richer than her guns suggest, which is the temptation. */
export const NEUTRAL_CARGO = 12;

/** Who sails where, in 1580. Waters not listed are empty of anyone worth the name. */
export const WATERS: Waters[] = [
  {
    name: 'off Spain and the Barbary coast', box: [-20, 25, 10, 46],
    sails: [
      { kind: 'privateer', nation: 'spain', weight: 1 }, { kind: 'privateer', nation: 'portugal', weight: 1 }, { kind: 'corsair', nation: 'barbary', weight: 1 },
      // Hanseatic hulks with grain for Lisbon, French and Dutch traders: friends, at least on paper.
      { kind: 'merchant', nation: 'hanse', weight: 1, neutral: true }, { kind: 'merchant', nation: 'france', weight: 0.5, neutral: true }, { kind: 'merchant', nation: 'netherlands', weight: 0.5, neutral: true },
      // Huguenot privateers out of La Rochelle, after Spanish prizes as Coligny sent them: friends.
      { kind: 'privateer', nation: 'france', weight: 0.4, huguenot: true },
    ],
  },
  {
    name: 'the coast of Brazil', box: [-55, -36, -28, 2],
    // Norman ships still come for the brazilwood, as they did for the French colony at Guanabara.
    sails: [{ kind: 'merchant', nation: 'portugal', weight: 2 }, { kind: 'merchant', nation: 'france', weight: 1, neutral: true }, { kind: 'privateer', nation: 'france', weight: 0.5, huguenot: true }],
  },
  { name: 'the coast of Chile and Peru', box: [-86, -45, -68, 5], sails: [{ kind: 'merchant', nation: 'spain', weight: 1 }] },
  { name: 'the Guinea coast', box: [-30, -5, 15, 25], sails: [{ kind: 'merchant', nation: 'portugal', weight: 2 }, { kind: 'merchant', nation: 'france', weight: 1, neutral: true }, { kind: 'privateer', nation: 'france', weight: 0.5, huguenot: true }] },
  {
    name: 'the East', box: [70, -15, 150, 25],
    sails: [{ kind: 'merchant', nation: 'portugal', weight: 3 }, { kind: 'treasure-ship', nation: 'portugal', weight: 1 }],
  },
];

/** The waters you're in, if anyone sails them. */
export function watersAt(sea: Sea, s: WorldState): Waters | null {
  const { lon, lat } = sea.map.nodes[s.player];
  return WATERS.find(({ box: [w, so, e, n] }) => lon >= w && lon <= e && lat >= so && lat <= n) ?? null;
}

/** Whether a sail of this kind comes at you: privateers and corsairs do. */
export const hostile = (kind: TargetKind) => kind === 'privateer' || kind === 'corsair';

/**
 * After a day's sail: a sail in sight? Called by `advance`, at sea, when
 * nothing else is waiting. A privateer or a corsair comes at you, and the
 * fight is on; anyone else is yours to attack or let pass.
 */
export function sailSighted(sea: Sea, s: WorldState): WorldState {
  if (s.encounter || s.hail || s.dilemma || s.sunk || s.won || sea.map.nodes[s.player].port || landmarkHere(sea, s)) return s;
  const r: Roller = { rng: s.rng };
  const waters = watersAt(sea, s);
  if (!waters) return { ...s, rng: r.rng };
  if (roll(r) >= SIGHT_CHANCE) return { ...s, rng: r.rng };
  const total = waters.sails.reduce((t, x) => t + x.weight, 0);
  let x = roll(r) * total;
  const sail = waters.sails.find((y) => (x -= y.weight) < 0) ?? pick(r, waters.sails);
  // A merchant who's heard of you keeps her distance; a privateer comes all the same.
  if (!hostile(sail.kind) && !sail.huguenot && roll(r) < keepsAway(s, waters.name)) return { ...s, rng: r.rng };
  const w: WorldState = { ...s, rng: r.rng, sightings: { ...s.sightings, [waters.name]: (s.sightings[waters.name] ?? 0) + 1 } };
  const what = whatOf(sail.kind, sail.nation, null);
  // The boy, while he lives, is the one who sees her first.
  const boy = alive(w, 'boy') ? `${nameOf(w, 'boy')} sings out from the masthead: ` : '';
  // Huguenots out of La Rochelle: friends, and they hail you.
  if (sail.huguenot) {
    if (w.company > w.turn) return w;
    return { ...w, dilemma: { kind: 'huguenots' }, log: [...w.log, { turn: w.turn, text: `${boy}a sail: Huguenot privateers out of La Rochelle, and they hail you as a friend`, stop: true }] };
  }
  // In company, a privateer or a corsair thinks better of two ships, and stands off.
  if (hostile(sail.kind) && w.company > w.turn) {
    return { ...w, log: [...w.log, { turn: w.turn, text: `${boy}a sail: ${what}, who stands off from the two of you` }] };
  }
  if (hostile(sail.kind)) {
    return startFight({ ...w, log: [...w.log, { turn: w.turn, text: `${boy}a sail: ${what}, bearing down on you`, stop: true }] }, { kind: sail.kind, nation: sail.nation, raid: null, plate: false }, true);
  }
  const hail: Hail = { kind: sail.kind, nation: sail.nation, ...(sail.neutral ? { neutral: true as const } : {}) };
  // The quieter lookout lets a sail go by that isn't worth heaving to for, with a line.
  if (w.lookout === 'worth' && !worthStopping(w, hail)) {
    return { ...w, log: [...w.log, { turn: w.turn, text: `${boy}a sail: ${what}${sail.neutral ? ', a friend’s' : ''}, let go by` }] };
  }
  return { ...w, hail, log: [...w.log, { turn: w.turn, text: `${boy}a sail: ${what}${sail.neutral ? ', a friend’s' : ''}`, stop: true }] };
}

function startFight(s: WorldState, who: Omit<Meeting, 'fight' | 'forced'>, forced: boolean, extra: Extra = {}, noGuns = false): WorldState {
  const r: Roller = { rng: s.rng };
  const seed = Math.floor(roll(r) * 2 ** 31);
  // No powder, no guns: the shot cards stay in the locker. Nor have men landed without the ship.
  // Practice is dry firing: the guns are run out, and no powder spent.
  const deck = (s.stores.powder > 0 || who.practice) && !noGuns ? deckOf(s.ship) : deckOf(s.ship).filter((c) => cardType(c) !== 'shot');
  // She came at you: she's bearing down from far. You fired first: within hail.
  const fight = encounterWith(who.kind, seed, { hull: s.hull, maxHull: s.maxHull }, deck, extra, forced ? FAR : CLOSE);
  const log = s.stores.powder > 0 || who.practice ? s.log : [...s.log, { turn: s.turn, text: 'no powder aboard: the guns are silent, and it is sails and boarders' }];
  return { ...s, rng: r.rng, hail: null, log, encounter: { ...who, fight, forced } };
}

/**
 * Practice on a fishing boat off the Canaries, the first time you raise
 * them: she has no guns, and run down or run off, nothing it costs you
 * counts — no powder, no hull, no hands. The first fight, taught as it goes.
 */
export function practise(s: WorldState): WorldState {
  return startFight({ ...s, dilemma: null }, { kind: 'fishing', nation: 'spain', raid: null, plate: false, practice: true }, false);
}

/** What practice comes to: a line, and a basket of fish if she struck. */
function practised(s: WorldState, m: Meeting): WorldState {
  const f = m.fight;
  const struck = f.outcome === 'destroyed';
  const text = struck
    ? 'she strikes, her crew laughing, and you let her go with her catch, all but a basket of fish: practice, and the gun crews the better for it'
    : 'she gets away under all the sail she has, and the hands jeer her: practice all the same';
  const food = struck ? Math.min(capacity(s).food, s.stores.food + s.crew * 2) : s.stores.food;
  return {
    ...s,
    stores: { ...s.stores, food: Math.max(s.stores.food, food) },
    encounter: null,
    reckoning: { kind: m.kind, nation: m.nation, outcome: f.outcome!, payout: 0, raid: null, said: [text] },
    log: [...s.log, { turn: s.turn, text }],
  };
}

/** Attack the sail in sight. A friend's merchant: that's piracy, whatever comes of it. */
export function attack(s: WorldState): WorldState {
  const h = s.hail;
  if (!h) throw new Error('there is no sail in sight');
  if (h.neutral) {
    const infamy = infamyFor(s);
    s = { ...s, infamy: s.infamy + infamy, log: [...s.log, { turn: s.turn, text: `you fire on ${whatOf(h.kind, h.nation, null)}: piracy, and the Admiralty will hear of it` }] };
  }
  return startFight(s, { kind: h.kind, nation: h.nation, raid: null, plate: !!h.plate, ...(h.prize ? { prize: h.prize } : {}) }, false, hailExtra(h));
}

/** What the sail in sight brings to a fight over a ship of her kind: the treasure ship's silver, a rumored prize's. */
export const hailExtra = (h: Hail): Extra => (h.plate ? plateExtra(h.plate === 'warned') : h.prize ? PRIZES[h.prize].extra : h.neutral ? { cargo: NEUTRAL_CARGO } : {});

/** Let her go her way. */
export function letPass(s: WorldState): WorldState {
  if (!s.hail) throw new Error('there is no sail in sight');
  const what = s.hail.plate ? 'the treasure ship' : s.hail.prize ? PRIZES[s.hail.prize].name : whatOf(s.hail.kind, s.hail.nation, null);
  return { ...s, hail: null, log: [...s.log, { turn: s.turn, text: `you let ${what} pass` }] };
}

/** The town you could raid here, if there is one you haven't raided. */
export function raidHere(sea: Sea, s: WorldState): { key: string; kind: 'town' | 'fortress' } | null {
  const l = landmarkHere(sea, s);
  if (!l?.offers.raid || s.raided.includes(l.key)) return null;
  return { key: l.key, kind: l.offers.raid };
}

/** A storm getting up on the eve of a raid, this often: Ribault's ships were scattered so, going for San Agustín in 1565. */
export const EVE_CHANCE = 1 / 5;

/** Raid the Spanish town you're lying off: once, whatever comes of it. Sometimes a storm gets up first, and you choose how to go in. */
export function raid(sea: Sea, s: WorldState): WorldState {
  if (s.encounter || s.hail || s.dilemma) throw new Error('there is something to finish first');
  const here = raidHere(sea, s);
  if (!here) throw new Error('there is no town here to raid');
  const r: Roller = { rng: s.rng };
  const w = { ...s, raided: [...s.raided, here.key] };
  if (roll(r) < EVE_CHANCE) {
    return { ...w, rng: r.rng, dilemma: { kind: 'eve', town: here.key }, log: [...w.log, { turn: w.turn, text: `on the eve of the raid on ${landmark(here.key).name}, the glass falling and a storm getting up`, stop: true }] };
  }
  return raidFight({ ...w, rng: r.rng }, here.key);
}

/** How you go in: in the teeth of a storm, or after standing off while the town readies (`extra`), or with the men landed and the ship's guns left behind (`noGuns`). */
export function raidFight(s: WorldState, key: string, how: { extra?: Extra; noGuns?: boolean } = {}): WorldState {
  const kind = landmark(key).offers.raid ?? 'town';
  const w = { ...s, log: [...s.log, { turn: s.turn, text: `the boats go in to ${landmark(key).name}` }] };
  // Goa is Portuguese, and the richest of all.
  const goa = key === 'goa';
  const base: Extra = goa ? GOA_EXTRA : {};
  const extra: Extra = { ...base, ...how.extra, hull: (base.hull ?? 0) + (how.extra?.hull ?? 0), reliefSooner: (base.reliefSooner ?? 0) + (how.extra?.reliefSooner ?? 0) };
  return startFight(w, { kind, nation: goa ? 'portugal' : 'spain', raid: key, plate: false }, false, extra, how.noGuns);
}

/** A Spanish patrol that won't be refused: she comes at you. */
export const patrol = (s: WorldState): WorldState =>
  startFight({ ...s, log: [...s.log, { turn: s.turn, text: 'a Spanish patrol, bearing down on you', stop: true }] }, { kind: 'privateer', nation: 'spain', raid: null, plate: false }, true);

/** One move in the fight at hand; settled when it ends. */
export function fight(sea: Sea, s: WorldState, action: Action): WorldState {
  const m = s.encounter;
  if (!m) throw new Error('there is no fight');
  const now = act(m.fight, action);
  if (!now.outcome) return { ...s, encounter: { ...m, fight: now } };
  return mourn(sea, s, settle(sea, s, { ...m, fight: now }));
}

function settle(sea: Sea, s: WorldState, m: Meeting): WorldState {
  if (m.practice) return practised(s, m);
  const f = m.fight;
  const outcome = f.outcome!;
  const r: Roller = { rng: s.rng };
  const taken = outcome === 'destroyed';
  const before = s.log.length;
  let w: WorldState = s;

  // What it cost: powder for every shot fired, hands for every point of hull lost.
  const shots = f.events.filter((e) => e.type === 'played' && e.card.side === 'ship' && cardType(e.card) === 'shot').length;
  w = fightCost(w, shots, s.hull - f.ship.hull, r);
  if (m.raid && taken) w = { ...w, log: [...w.log, { turn: w.turn, text: `${landmark(m.raid).name} is sacked` }] };
  // Her hold, or the town's storehouses: food, water, spares, powder.
  if (taken) w = prizeStores(w, m.kind, m.raid !== null, r);
  if (f.payout > 0 && outcome !== 'sunk') w = { ...w, log: [...w.log, { turn: w.turn, text: `${f.payout} gold into the strongroom` }] };

  // The tally, and the fight told, for the end of the run.
  const who = m.prize ? PRIZES[m.prize].name : whatOf(m.kind, m.nation, m.raid ? landmark(m.raid).name : null, m.plate);
  w = { ...w, tally: tallied(w.tally, outcome, f.payout, who, m.raid !== null), lastFight: recordFight(f, who, m.kind, m.nation, s.hull) };
  // What's taken from Spain and Portugal is lawful, and the ambassador keeps count.
  const iberian = m.nation === 'spain' || m.nation === 'portugal';
  const won = outcome === 'sunk' ? 0 : f.payout;
  const done: WorldState = {
    ...w,
    rng: r.rng,
    // Under a French commission too, the ambassador counts it half against England: the Huguenots took it as well.
    grievance: w.grievance + (iberian ? Math.round(won * (s.french ? FRENCH_GRIEVANCE : 1)) : 0),
    lastPrize: taken && won > 0 ? s.turn : w.lastPrize,
    gold: w.gold + won,
    hull: f.ship.hull,
    sunk: outcome === 'sunk',
    encounter: null,
    reckoning: { kind: m.kind, nation: m.nation, outcome, payout: f.payout, raid: m.raid, said: w.log.slice(before).map((l) => l.text) },
  };
  if (!taken) return done;
  // The great cabin, or the church plate: a jewel, sometimes, and her captain's ring if he fell.
  const r2: Roller = { rng: done.rng };
  let after = plunderJewels(done, m.kind, m.nation, sea.map.nodes[s.player].lon > 60, r2);
  if (!iberian) return { ...after, rng: r2.rng };
  // An Englishman at her oars, or in the town's jail, freed; and he knows the coast.
  const f2 = freed(after, m.raid, r2);
  after = { ...f2.world, rng: r2.rng };
  // Prisoners taken, and they talk: a rumor, sometimes; surely, if one of ours was among them.
  return hearFromPrisoners(after, m.nation, f2.freed ? 1 : undefined);
}
