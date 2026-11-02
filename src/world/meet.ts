/**
 * When you share a node with a ship, outside a port, one of two things.
 * If she's hostile — a guard ship or an armada of a nation that wants you —
 * she attacks, and the fight is on. Anyone else comes alongside, and
 * attacking her is your choice; let her pass and she goes her way.
 *
 * The world waits while a fight is fought, card by card, and afterwards it
 * is settled: gold into the purse, the damage kept, the prisoners
 * questioned, and the other ship sunk, parted from, or the end of you.
 *
 * You sail for England. Attacking an English ship is piracy.
 */

import { act, type Action, type EncounterState, type Outcome } from '../rules.ts';
import { deckOf } from '../outfit.ts';
import { encounterWith } from '../setup.ts';
import { NOTABLE, sighting } from './bar.ts';
import { type Roller, roll } from './random.ts';
import { serves } from './port.ts';
import { makeRumor } from './rumors.ts';
import type { Nation } from './ports.ts';
import { type Sea, type ShipKind, wantedBy } from './ships.ts';
import type { WorldState } from './world.ts';

/** After parting, a ship won't engage you again for this many days. */
export const PARTED_DAYS = 5;
/** A ship sunk or taken is laid up at home this long. */
export const REFIT_DAYS = 60;
/** Gold per point of hull, in port. */
export const REPAIR_COST = 1;
/** Prisoners know where their consorts were this recently. */
const PRISONERS_KNOW = 3;

export interface Meeting {
  shipId: number;
  kind: ShipKind;
  fight: EncounterState;
  /** She attacked you, rather than you her. */
  forced: boolean;
}

/** A ship alongside, waiting on your choice: attack, or let her pass. */
export interface Hail {
  shipId: number;
  kind: ShipKind;
  nation: Nation;
}

/** The flag you sail under. */
export const YOUR_NATION: Nation = 'england';
/** Attack your own flag's ships and its standing falls at least this far, and stays there till you're pardoned. */
export const PIRACY_FLOOR = -3;

/** A ship that will attack you on sight: a guard ship or an armada of a nation that wants you. */
export const hostile = (s: WorldState, ship: { kind: ShipKind; nation: Nation }) =>
  (ship.kind === 'hunter' || ship.kind === 'armada') && wantedBy(s.standing, ship.nation);

export interface Reckoning {
  shipId: number;
  kind: ShipKind;
  nation: Nation;
  outcome: Outcome;
  payout: number;
  /** You damaged it or took from it, and its nation will remember. */
  attacked: boolean;
  /** Rumors got from prisoners. */
  heard: number;
}

/** After a move: is there a ship here to fight? Called by `advance`. */
export function meeting(sea: Sea, s: WorldState): WorldState {
  if (s.encounter || s.hail || s.sunk || sea.map.nodes[s.player].port || s.islands.some((i) => i.found && i.node === s.player)) return s;
  const here = s.ships.filter((x) => x.node === s.player && x.laidUp <= s.turn && (s.parted[x.id] ?? -1) < s.turn);
  if (!here.length) return s;
  // The one that matters most, if more than one; one that means you harm first.
  here.sort((a, b) => Number(hostile(s, b)) - Number(hostile(s, a)) || NOTABLE[b.kind] - NOTABLE[a.kind] || a.id - b.id);
  const other = here[0];
  if (!hostile(s, other)) return { ...s, hail: { shipId: other.id, kind: other.kind, nation: other.nation } };
  return startFight(s, other.id, true);
}

function startFight(s: WorldState, shipId: number, forced: boolean): WorldState {
  const other = s.ships[shipId];
  const r: Roller = { rng: s.rng };
  const seed = Math.floor(roll(r) * 2 ** 31);
  const fight = encounterWith(other.kind, seed, { hull: s.hull, maxHull: s.maxHull }, deckOf(s.outfit));
  return { ...s, rng: r.rng, hail: null, encounter: { shipId, kind: other.kind, fight, forced } };
}

/**
 * Attack the ship alongside. Her nation will remember it whatever comes of
 * the fight: you fired first. An English ship makes you a pirate.
 */
export function attack(s: WorldState): WorldState {
  const h = s.hail;
  if (!h) throw new Error('there is no ship alongside');
  const standing = { ...s.standing, [h.nation]: (s.standing[h.nation] ?? 0) - 1 };
  let next: WorldState = { ...s, standing };
  if (h.nation === YOUR_NATION) {
    standing[h.nation] = Math.min(standing[h.nation]!, PIRACY_FLOOR);
    next = {
      ...next,
      pirate: true,
      log: [...s.log, { turn: s.turn, text: `you fired on an English ${h.kind.replace('-', ' ')}: you're a pirate now, and England will hang you if it can` }],
    };
  }
  return startFight(next, h.shipId, false);
}

/** Let the ship alongside go her way. She won't come alongside again for a few days. */
export function letPass(s: WorldState): WorldState {
  const h = s.hail;
  if (!h) throw new Error('there is no ship alongside');
  return { ...s, hail: null, parted: { ...s.parted, [h.shipId]: s.turn + PARTED_DAYS } };
}

/** One keep in the fight at hand; settled when it ends. */
export function fight(sea: Sea, s: WorldState, action: Action): WorldState {
  const m = s.encounter;
  if (!m) throw new Error('there is no fight');
  const now = act(m.fight, action);
  if (!now.outcome) return { ...s, encounter: { ...m, fight: now } };
  return settle(sea, s, { ...m, fight: now });
}

function settle(sea: Sea, s: WorldState, m: Meeting): WorldState {
  const f = m.fight;
  const outcome = f.outcome!;
  const r: Roller = { rng: s.rng };

  // Prisoners talk about their consorts.
  const rumors = [...s.rumors];
  let next = s.nextRumor;
  for (const reliability of f.intel) {
    const seen = sighting(sea, s, r, s.player, PRISONERS_KNOW, m.shipId);
    if (!seen) continue;
    rumors.push(makeRumor(sea, r, next++, { ...seen.ship, node: seen.at }, s.turn - seen.age, reliability));
  }

  const ships = s.ships.map((x) => {
    if (x.id !== m.shipId || outcome !== 'destroyed') return x;
    // Gone to the bottom, or taken: laid up at home, then out again.
    return { ...x, node: x.home, laidUp: s.turn + REFIT_DAYS, dest: x.route ? x.route[1] : null, leg: x.route ? 1 : 0 };
  });
  const parted = outcome === 'destroyed' || outcome === 'sunk' ? s.parted : { ...s.parted, [m.shipId]: s.turn + PARTED_DAYS };

  // A nation remembers. If you attacked, that was counted when you fired;
  // a sinking costs a point more. If she attacked you, what you did in
  // your own defence still counts: damage or plunder a point, a sinking two.
  const nation = s.ships[m.shipId].nation;
  const hurtHer = outcome === 'destroyed' || f.plunder > 0 || f.target.hull < f.target.maxHull;
  const attacked = !m.forced || hurtHer;
  const cost = m.forced ? (hurtHer ? (outcome === 'destroyed' ? 2 : 1) : 0) : outcome === 'destroyed' ? 1 : 0;
  const standing = cost ? { ...s.standing, [nation]: (s.standing[nation] ?? 0) - cost } : s.standing;

  return {
    ...s,
    rng: r.rng,
    gold: s.gold + f.payout,
    hull: f.ship.hull,
    sunk: outcome === 'sunk',
    ships,
    parted,
    rumors,
    nextRumor: next,
    standing,
    encounter: null,
    reckoning: { shipId: m.shipId, kind: m.kind, nation, outcome, payout: f.payout, attacked, heard: next - s.nextRumor },
  };
}

/** Patch the hull in port, a point at a time, as far as the purse goes. */
export function repair(sea: Sea, s: WorldState, points = s.maxHull - s.hull): WorldState {
  if (!sea.map.nodes[s.player].port) throw new Error('repairs are made in port');
  if (!serves(sea, s)) throw new Error("this port won't deal with you");
  const can = Math.min(points, s.maxHull - s.hull, Math.floor(s.gold / REPAIR_COST));
  return { ...s, hull: s.hull + can, gold: s.gold - can * REPAIR_COST };
}
