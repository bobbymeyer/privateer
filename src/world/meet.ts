/**
 * When you share a node with a ship, outside a port, the encounter starts.
 * The world waits while it is fought, card by card, and afterwards it is
 * settled: gold into the purse, the damage kept, the prisoners questioned,
 * and the other ship sunk, parted from, or the end of you.
 */

import { act, type Action, type EncounterState, type Outcome } from '../rules.ts';
import { encounterWith } from '../setup.ts';
import { NOTABLE, sighting } from './bar.ts';
import { type Roller, roll } from './random.ts';
import { makeRumor } from './rumors.ts';
import type { Nation } from './ports.ts';
import type { Sea, ShipKind } from './ships.ts';
import type { WorldState } from './world.ts';

/** After parting, a ship won't engage you again for this many days. */
export const PARTED_DAYS = 5;
/** A ship sunk or taken is laid up at home this long. */
export const REFIT_DAYS = 60;
/** Gold per point of hull, in port. */
export const REPAIR_COST = 3;
/** Prisoners know where their consorts were this recently. */
const PRISONERS_KNOW = 3;

export interface Meeting {
  shipId: number;
  kind: ShipKind;
  fight: EncounterState;
}

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
  if (s.encounter || s.sunk || sea.map.nodes[s.player].port) return s;
  const here = s.ships.filter((x) => x.node === s.player && x.laidUp <= s.turn && (s.parted[x.id] ?? -1) < s.turn);
  if (!here.length) return s;
  // The one that matters most, if more than one.
  here.sort((a, b) => NOTABLE[b.kind] - NOTABLE[a.kind] || a.id - b.id);
  const other = here[0];
  const r: Roller = { rng: s.rng };
  const seed = Math.floor(roll(r) * 2 ** 31);
  const fight = encounterWith(other.kind, seed, { hull: s.hull, maxHull: s.maxHull });
  return { ...s, rng: r.rng, encounter: { shipId: other.id, kind: other.kind, fight } };
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

  // An attack is remembered by the ship's nation: any damage landed or
  // plunder taken, and a sinking twice over.
  const nation = s.ships[m.shipId].nation;
  const attacked = outcome === 'destroyed' || f.plunder > 0 || f.target.hull < f.target.maxHull;
  const standing = attacked ? { ...s.standing, [nation]: (s.standing[nation] ?? 0) - (outcome === 'destroyed' ? 2 : 1) } : s.standing;

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
  const can = Math.min(points, s.maxHull - s.hull, Math.floor(s.gold / REPAIR_COST));
  return { ...s, hull: s.hull + can, gold: s.gold - can * REPAIR_COST };
}
