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
import { fightCost, landmarkHere, prizeStores } from './stores.ts';
import { plateExtra } from './treasure.ts';
import { GOA_EXTRA, PRIZES, type Prize, hearFromPrisoners } from './rumors.ts';
import type { Sea, WorldState } from './world.ts';

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
}

/** A sail in sight, waiting on your choice: attack, or let her pass. */
export interface Hail {
  kind: TargetKind;
  nation: Nation;
  /** The treasure ship off Cape San Francisco: asleep, or warned by your raids. See treasure.ts. */
  plate?: 'asleep' | 'warned';
  /** A prize at the end of a rumor. See rumors.ts. */
  prize?: Prize;
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

/** A sail sighted, on any day at sea. */
export const SIGHT_CHANCE = 1 / 25;

interface Waters {
  name: string;
  box: [number, number, number, number];
  /** Who you meet there, and how often of the sails sighted. */
  sails: { kind: TargetKind; nation: Nation; weight: number }[];
}

/** Who sails where, in 1580. Waters not listed are empty of anyone worth the name. */
export const WATERS: Waters[] = [
  {
    name: 'off Spain and the Barbary coast', box: [-20, 25, 10, 46],
    sails: [{ kind: 'privateer', nation: 'spain', weight: 1 }, { kind: 'privateer', nation: 'portugal', weight: 1 }, { kind: 'corsair', nation: 'barbary', weight: 1 }],
  },
  { name: 'the coast of Brazil', box: [-55, -36, -28, 2], sails: [{ kind: 'merchant', nation: 'portugal', weight: 1 }] },
  { name: 'the coast of Chile and Peru', box: [-86, -45, -68, 5], sails: [{ kind: 'merchant', nation: 'spain', weight: 1 }] },
  { name: 'the Guinea coast', box: [-30, -5, 15, 25], sails: [{ kind: 'merchant', nation: 'portugal', weight: 1 }] },
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
  if (roll(r) >= SIGHT_CHANCE) return { ...s, rng: r.rng };
  const waters = watersAt(sea, s);
  if (!waters) return { ...s, rng: r.rng };
  const total = waters.sails.reduce((t, x) => t + x.weight, 0);
  let x = roll(r) * total;
  const sail = waters.sails.find((y) => (x -= y.weight) < 0) ?? pick(r, waters.sails);
  const w: WorldState = { ...s, rng: r.rng };
  const what = whatOf(sail.kind, sail.nation, null);
  if (hostile(sail.kind)) {
    return startFight({ ...w, log: [...w.log, { turn: w.turn, text: `a sail: ${what}, bearing down on you`, stop: true }] }, { kind: sail.kind, nation: sail.nation, raid: null, plate: false }, true);
  }
  return { ...w, hail: { kind: sail.kind, nation: sail.nation }, log: [...w.log, { turn: w.turn, text: `a sail: ${what}`, stop: true }] };
}

function startFight(s: WorldState, who: Omit<Meeting, 'fight' | 'forced'>, forced: boolean, extra: Extra = {}): WorldState {
  const r: Roller = { rng: s.rng };
  const seed = Math.floor(roll(r) * 2 ** 31);
  // No powder, no guns: the shot cards stay in the locker.
  const deck = s.stores.powder > 0 ? deckOf(s.ship) : deckOf(s.ship).filter((c) => cardType(c) !== 'shot');
  // She came at you: she's bearing down from far. You fired first: within hail.
  const fight = encounterWith(who.kind, seed, { hull: s.hull, maxHull: s.maxHull }, deck, extra, forced ? FAR : CLOSE);
  const log = s.stores.powder > 0 ? s.log : [...s.log, { turn: s.turn, text: 'no powder aboard: the guns are silent, and it is sails and boarders' }];
  return { ...s, rng: r.rng, hail: null, log, encounter: { ...who, fight, forced } };
}

/** Attack the sail in sight. */
export function attack(s: WorldState): WorldState {
  const h = s.hail;
  if (!h) throw new Error('there is no sail in sight');
  return startFight(s, { kind: h.kind, nation: h.nation, raid: null, plate: !!h.plate, ...(h.prize ? { prize: h.prize } : {}) }, false, hailExtra(h));
}

/** What the sail in sight brings to a fight over a ship of her kind: the treasure ship's silver, a rumored prize's. */
export const hailExtra = (h: Hail): Extra => (h.plate ? plateExtra(h.plate === 'warned') : h.prize ? PRIZES[h.prize].extra : {});

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

/** Raid the Spanish town you're lying off: once, whatever comes of it. */
export function raid(sea: Sea, s: WorldState): WorldState {
  if (s.encounter || s.hail || s.dilemma) throw new Error('there is something to finish first');
  const here = raidHere(sea, s);
  if (!here) throw new Error('there is no town here to raid');
  const w = { ...s, raided: [...s.raided, here.key], log: [...s.log, { turn: s.turn, text: `the boats go in to ${landmark(here.key).name}` }] };
  // Goa is Portuguese, and the richest of all.
  const goa = here.key === 'goa';
  return startFight(w, { kind: here.kind, nation: goa ? 'portugal' : 'spain', raid: here.key, plate: false }, false, goa ? GOA_EXTRA : {});
}

/** One move in the fight at hand; settled when it ends. */
export function fight(sea: Sea, s: WorldState, action: Action): WorldState {
  const m = s.encounter;
  if (!m) throw new Error('there is no fight');
  const now = act(m.fight, action);
  if (!now.outcome) return { ...s, encounter: { ...m, fight: now } };
  return settle(sea, s, { ...m, fight: now });
}

function settle(sea: Sea, s: WorldState, m: Meeting): WorldState {
  void sea;
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
  const done: WorldState = {
    ...w,
    rng: r.rng,
    gold: w.gold + (outcome === 'sunk' ? 0 : f.payout),
    hull: f.ship.hull,
    sunk: outcome === 'sunk',
    encounter: null,
    reckoning: { kind: m.kind, nation: m.nation, outcome, payout: f.payout, raid: m.raid, said: w.log.slice(before).map((l) => l.text) },
  };
  // Prisoners taken, and they talk: a rumor, sometimes.
  return taken && (m.nation === 'spain' || m.nation === 'portugal') ? hearFromPrisoners(done, m.nation) : done;
}
