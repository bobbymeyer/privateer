/**
 * Meeting a ship, and raiding a port.
 *
 * When you share a node with a ship, outside a port, one of two things.
 * If she's hostile — a guard ship or an armada of a nation that wants you,
 * or is at war with England — she attacks, and the fight is on. Anyone else
 * comes alongside, and attacking her is your choice; let her pass and she
 * goes her way.
 *
 * In a port, you may raid it. A town can't run, but its people carry what
 * they can inland, and if the raid goes on, the garrison's relief comes.
 *
 * Whether it's fair game is the war table's business (wars.ts):
 * - an enemy of England's: fair game, and the Crown approves when you
 *   take or sack one;
 * - a nation at peace with England: the Crown hears of it, and your
 *   standing with England suffers;
 * - England itself: piracy.
 * Either way the nation you hit remembers, and a port more than a ship.
 *
 * The world waits while a fight is fought, card by card, and afterwards it
 * is settled: gold into the purse, the damage kept, the prisoners
 * questioned, and the ship sunk or the town sacked, parted from, or the
 * end of you.
 */

import { act, type Action, type EncounterState, type Outcome } from '../rules.ts';
import { PRIZE_CARDS, deckOf } from '../outfit.ts';
import { encounterWith, type Extra, TARGETS, type TargetKind } from '../setup.ts';
import { NOTABLE, sighting } from './bar.ts';
import type { NodeId } from './map.ts';
import { type Roller, roll } from './random.ts';
import { serves } from './port.ts';
import { PRIZE_CHEER, SACK_CHEER, spoils } from './events.ts';
import { PROMISED_SHARE } from './dilemmas.ts';
import { makeRumor } from './rumors.ts';
import { adjective, article, type Nation, nationName } from './ports.ts';
import { type Sea, type ShipKind, wantedBy } from './ships.ts';
import { CASUS_BELLI, YOUR_NATION, declare, isEnemy } from './wars.ts';
import { extraFor } from './scout.ts';
import { renown, type WorldState } from './world.ts';

/** What a laden corsair carries over the usual: captives, and what was taken with them. */
export const CAPTIVES_CARGO = 12;

/** A prize's payout to your name. Passing a step of renown is news. */
function fameFor(s: WorldState, payout: number): WorldState {
  const fame = s.fame + payout;
  const before = renown(s);
  const after = renown({ fame });
  if (after === before) return { ...s, fame };
  const text = ['', 'your name is getting about: hunters and privateers will come farther for you, and better found', 'your name is known in every port: they come farther still, and better found', 'your name is a legend: no captain on the seas is hunted harder'][after];
  return { ...s, fame, log: [...s.log, { turn: s.turn, text, stop: true }] };
}

export { YOUR_NATION } from './wars.ts';

/** How many of a prize's cards you're offered to choose from. */
export const PRIZE_OFFERS = 3;
/** After parting, a ship won't engage you again for this many days. */
export const PARTED_DAYS = 5;
/** A ship sunk or taken is laid up at home this long. */
export const REFIT_DAYS = 60;
/** Gold per point of hull, in port. */
export const REPAIR_COST = 1;
/** Prisoners know where their consorts were this recently. */
const PRISONERS_KNOW = 3;
/** A sacked town has nothing for anybody for this long. */
export const SACK_DAYS = 120;
/** After a raid, the nation's guard ships hunt twice as far for this long. */
export const ALARM_DAYS = 30;
/** Attack your own flag and its standing falls at least this far, and stays there till you're pardoned. */
export const PIRACY_FLOOR = -3;

export interface Meeting {
  /** The ship you're fighting, or -1 for a port. */
  shipId: number;
  /** The port you're raiding, or null for a ship. */
  port: NodeId | null;
  kind: TargetKind;
  nation: Nation;
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

export interface Reckoning {
  shipId: number;
  port: NodeId | null;
  kind: TargetKind;
  nation: Nation;
  outcome: Outcome;
  payout: number;
  /** You fired first, or did her harm: her nation will remember. */
  attacked: boolean;
  /** Rumors got from prisoners. */
  heard: number;
}

/**
 * A ship that will attack you on sight: a guard ship or an armada of a
 * nation that wants you, or that's at war with England.
 */
export const hostile = (s: WorldState, ship: { kind: ShipKind; nation: Nation }) =>
  ship.kind === 'monster' ||
  ((ship.kind === 'hunter' || ship.kind === 'armada' || ship.kind === 'privateer' || ship.kind === 'corsair') && (wantedBy(s.standing, ship.nation) || isEnemy(s.wars, ship.nation)));

/** After a move: a ship here to fight, or to hail? Called by `advance`. */
export function meeting(sea: Sea, s: WorldState): WorldState {
  if (s.encounter || s.hail || s.spoil || s.dilemma || s.sunk || sea.map.nodes[s.player].port || s.islands.some((i) => i.found && i.node === s.player)) return s;
  const here = s.ships.filter((x) => x.node === s.player && x.laidUp <= s.turn && (s.parted[x.id] ?? -1) < s.turn);
  if (!here.length) return s;
  // The one that matters most, if more than one; one that means you harm first.
  here.sort((a, b) => Number(hostile(s, b)) - Number(hostile(s, a)) || NOTABLE[b.kind] - NOTABLE[a.kind] || a.id - b.id);
  const other = here[0];
  if (!hostile(s, other)) return { ...s, hail: { shipId: other.id, kind: other.kind, nation: other.nation } };
  return startFight(s, { shipId: other.id, port: null, kind: other.kind, nation: other.nation }, true);
}

/** Islanders who meet a ship with war canoes, as often as not, rather than with fruit: likelier still if you've given them cause. */
export const CANOE_CHANCE = 0.3;
export const CANOE_CHANCE_WANTED = 0.7;

/** Coming into an island harbour: the canoes come out, to trade or to fight. Called by `advance` on arrival. */
export function landfall(sea: Sea, s: WorldState): WorldState {
  const port = sea.map.nodes[s.player].port;
  if (!port || port.nation !== 'native' || s.encounter || s.hail || s.sunk) return s;
  const r: Roller = { rng: s.rng };
  const chance = wantedBy(s.standing, 'native') ? CANOE_CHANCE_WANTED : CANOE_CHANCE;
  if (roll(r) >= chance) return { ...s, rng: r.rng };
  const w = { ...s, rng: r.rng, log: [...s.log, { turn: s.turn, text: `war canoes put out from ${port.name}` }] };
  return startFight(w, { shipId: -1, port: s.player, kind: 'canoes', nation: 'native' }, true);
}

function startFight(s: WorldState, who: Omit<Meeting, 'fight' | 'forced'>, forced: boolean, extra?: Extra): WorldState {
  const r: Roller = { rng: s.rng };
  const seed = Math.floor(roll(r) * 2 ** 31);
  // What you saw of her is what you fight: a warship better found against a captain with a name, a corsair laden.
  const ship = who.shipId >= 0 ? s.ships.find((x) => x.id === who.shipId) : undefined;
  const fight = encounterWith(who.kind, seed, { hull: s.hull, maxHull: s.maxHull }, deckOf(s.outfit), extra ?? (ship ? extraFor(s, ship) : {}));
  return { ...s, rng: r.rng, hail: null, encounter: { ...who, fight, forced } };
}

/**
 * What a hostile act costs, by whose it was and how bad: standing with
 * them, standing with England, the strain on a peace (`strain`, for a
 * nation at peace with England — enough of it and it's war), and the log.
 */
function reckon(s: WorldState, nation: Nation, theirs: number, crown: { enemy: number; neutral: number }, what: (flag: string) => string, strain = 0): WorldState {
  const standing = { ...s.standing, [nation]: (s.standing[nation] ?? 0) - theirs };
  const log = [...s.log];
  let pirate = s.pirate;
  if (nation === YOUR_NATION) {
    standing[nation] = Math.min(standing[nation]!, PIRACY_FLOOR);
    if (!pirate) log.push({ turn: s.turn, text: `${what('English')}: you're a pirate now, and England will hang you if it can` });
    pirate = true;
  } else if (isEnemy(s.wars, nation)) {
    if (crown.enemy && !s.pirate) standing[YOUR_NATION] = (standing[YOUR_NATION] ?? 0) + crown.enemy;
  } else if (nation !== 'local' && nation !== 'native') {
    if (crown.neutral) {
      standing[YOUR_NATION] = Math.min(s.pirate ? PIRACY_FLOOR : Infinity, (standing[YOUR_NATION] ?? 0) - crown.neutral);
      log.push({ turn: s.turn, text: `${what(adjective(nation))}, at peace with England: the Crown will hear of it` });
    }
    // Strain on the peace. Enough of it and England is at war with them.
    const t = (s.tension[nation] ?? 0) + strain;
    if (t >= CASUS_BELLI) {
      log.push({ turn: s.turn, text: `England and ${nationName(nation)} are at war: your attacks have seen to it`, stop: true });
      return { ...s, standing, pirate, log, tension: { ...s.tension, [nation]: 0 }, wars: declare(s.wars, YOUR_NATION, nation) };
    }
    return { ...s, standing, pirate, log, tension: { ...s.tension, [nation]: t } };
  }
  return { ...s, standing, pirate, log };
}

/** Attack the ship alongside. Her nation remembers it whatever comes of the fight: you fired first. */
export function attack(s: WorldState): WorldState {
  const h = s.hail;
  if (!h) throw new Error('there is no ship alongside');
  const next = reckon(s, h.nation, 1, { enemy: 0, neutral: 1 }, (flag) => `you fired on ${article(flag)} ${flag} ${h.kind.replace('-', ' ')}`, 1);
  return startFight(next, { shipId: h.shipId, port: null, kind: h.kind, nation: h.nation }, false);
}

/** Let the ship alongside go her way. She won't come alongside again for a few days. */
export function letPass(s: WorldState): WorldState {
  const h = s.hail;
  if (!h) throw new Error('there is no ship alongside');
  return { ...s, hail: null, parted: { ...s.parted, [h.shipId]: s.turn + PARTED_DAYS } };
}

/** Whether this port can be raided now: not one sacked lately. */
export const raidable = (sea: Sea, s: WorldState) => !!sea.map.nodes[s.player].port && (s.sacked[s.player] ?? -1) < s.turn && !onGuard(s, s.player);

/**
 * A raid that ends short of a sack leaves the town on its guard. For a
 * fortnight the boats would never get ashore. For three months after, it is
 * better defended — more hull to its walls, its relief sooner. Its treasury
 * starts from what it kept and fills again a little a day (TREASURY_REFILL),
 * up to what it holds in the ordinary way. Each raid while it's on its guard
 * puts it a step further on it.
 * Without this, a raiding party could plunder early, fall back to the
 * boats, and come again to a treasury full as new.
 */
export const GUARD_DAYS = 90;
export const GUARD_SHUT = 14;
export const GUARD_HULL = 4;
export const GUARD_RELIEF = 2;
/** A raided town's treasury fills again by this much a day. */
export const TREASURY_REFILL = 1;
export const guardOf = (s: WorldState, node: NodeId) => {
  const g = s.guarded[node];
  return g && g.until > s.turn ? g : null;
};
/** The boats would never get ashore: the town turned out a raid lately. */
export const onGuard = (s: WorldState, node: NodeId) => (guardOf(s, node)?.shutUntil ?? -1) > s.turn;
/** What a town on its guard brings to a raid. */
export function guardExtra(s: WorldState, node: NodeId, kind: 'town' | 'fortress'): Extra {
  const g = guardOf(s, node);
  if (!g) return {};
  return { hull: GUARD_HULL * g.level, cargo: treasury(s, node, kind) - TARGETS[kind].cargo, reliefSooner: GUARD_RELIEF * g.level };
}

/** What a town has in its treasury now: what a raid left it, filling again by the day, up to the usual. */
export function treasury(s: WorldState, node: NodeId, kind: 'town' | 'fortress'): number {
  const full = TARGETS[kind].cargo;
  const g = guardOf(s, node);
  return g ? Math.min(full, g.cargo + TREASURY_REFILL * (s.turn - g.since)) : full;
}

/**
 * Raid the port you're in. A fortified port is a fortress; any other, a
 * town. Its nation remembers three times over, and raises the alarm.
 */
export function raid(sea: Sea, s: WorldState): WorldState {
  const port = sea.map.nodes[s.player].port;
  if (!port) throw new Error('there is no port here to raid');
  if (s.encounter || s.hail) throw new Error('there is a fight to finish first');
  if (s.spoil) throw new Error("the prize's stores are waiting: take a card, or leave them");
  if ((s.sacked[s.player] ?? -1) >= s.turn) throw new Error(`${port.name} was sacked lately: there's nothing left`);
  if (onGuard(s, s.player)) throw new Error(`${port.name} is on its guard after your last raid: the boats would never get ashore`);
  let next = reckon(s, port.nation, 3, { enemy: 0, neutral: 2 }, (flag) => `you raided ${port.name}, ${flag}`, 3);
  next = { ...next, alarm: { ...next.alarm, [port.nation]: s.turn + ALARM_DAYS } };
  const kind = port.fort ? 'fortress' : 'town';
  return startFight(next, { shipId: -1, port: s.player, kind, nation: port.nation }, false, guardExtra(s, s.player, kind));
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

  // Prisoners talk about the ships they know of.
  const rumors = [...s.rumors];
  let next = s.nextRumor;
  for (const reliability of f.intel) {
    const seen = sighting(sea, s, r, s.player, PRISONERS_KNOW, m.shipId);
    if (!seen) continue;
    rumors.push(makeRumor(sea, r, next++, { ...seen.ship, node: seen.at }, s.turn - seen.age, reliability));
  }

  let w: WorldState = { ...s, rng: r.rng, rumors, nextRumor: next };

  // A nation remembers. If you attacked, that was counted when you fired;
  // taking her, or sacking the town, counts again. If she attacked you,
  // what you did in your own defence still counts.
  const taken = outcome === 'destroyed';
  const hurtHer = taken || f.plunder > 0 || f.target.hull < f.target.maxHull;
  const attacked = !m.forced || hurtHer;
  const what = (flag: string) => (m.port !== null ? `you sacked ${sea.map.nodes[m.port].port!.name}, ${flag}` : `you took ${article(flag)} ${flag} ${m.kind.replace('-', ' ')}`);
  if (m.kind === 'monster' || m.kind === 'canoes') {
    // A monster is nobody's; and islanders who came out to fight you bear no grudge for being beaten off.
  } else if (m.forced && hurtHer) w = reckon(w, m.nation, taken ? 2 : 1, { enemy: taken ? 1 : 0, neutral: 1 }, what);
  else if (!m.forced && taken) w = reckon(w, m.nation, m.port !== null ? 2 : 1, { enemy: m.port !== null ? 2 : 1, neutral: 1 }, what, m.port !== null ? 2 : 1);

  if (m.kind === 'canoes') {
    if (taken) w = { ...w, log: [...w.log, { turn: s.turn, text: `the canoes at ${sea.map.nodes[m.port!].port!.name} beaten off` }] };
  } else if (m.port !== null) {
    if (!taken && outcome !== 'sunk') {
      // Turned out, but not sacked: the town is on its guard, a step further if it already was.
      const level = (guardOf(s, m.port)?.level ?? 0) + 1;
      const name = sea.map.nodes[m.port].port!.name;
      w = {
        ...w,
        guarded: { ...w.guarded, [m.port]: { since: s.turn, until: s.turn + GUARD_DAYS, shutUntil: s.turn + GUARD_SHUT, level, cargo: f.target.cargo } },
        log: [...w.log, { turn: s.turn, text: `${name} is on its guard now: ${f.target.cargo} left in its treasury, and its walls manned` }],
      };
    }
    if (taken) {
      const { [m.port]: _, ...guarded } = w.guarded;
      w = { ...w, guarded };
      w = { ...w, sacked: { ...w.sacked, [m.port]: s.turn + SACK_DAYS } };
      w = { ...w, log: [...w.log, { turn: s.turn, text: `${sea.map.nodes[m.port].port!.name} is sacked` }] };
    }
  } else {
    // A corsair taken with captives aboard: they go free, and their nation and the Crown hear of it.
    const freed = taken ? s.ships.find((x) => x.id === m.shipId)?.captives : null;
    if (freed) {
      const standing = { ...w.standing, [freed]: (w.standing[freed] ?? 0) + 1 };
      if (!w.pirate && freed !== YOUR_NATION) standing[YOUR_NATION] = (standing[YOUR_NATION] ?? 0) + 1;
      w = { ...w, standing, log: [...w.log, { turn: s.turn, text: `you freed ${adjective(freed)} captives from the corsairs' hold` }] };
    }
    w = {
      ...w,
      ships: w.ships.map((x) => {
        if (x.id !== m.shipId || !taken) return x;
        if (x.kind === 'corsair') return { ...x, node: x.home, laidUp: s.turn + REFIT_DAYS, dest: null, raid: null, captives: null };
        // Gone to the bottom, or taken: laid up at home, then out again.
        return { ...x, node: x.home, laidUp: s.turn + REFIT_DAYS, dest: x.route ? x.route[1] : null, leg: x.route ? 1 : 0 };
      }),
      parted: taken || outcome === 'sunk' ? w.parted : { ...w.parted, [m.shipId]: s.turn + PARTED_DAYS },
    };
  }

  if (f.payout > 0 && outcome !== 'sunk') w = fameFor(w, f.payout);
  if (f.payout > 0 && outcome !== 'sunk') w = spoils(w, m.port !== null && taken && m.kind !== 'canoes' ? SACK_CHEER : PRIZE_CHEER);
  // Her stores: three cards to choose from, if she was taken and had anything worth having.
  const pool = PRIZE_CARDS[m.kind];
  if (taken && pool?.length) {
    const r2: Roller = { rng: w.rng };
    const offers = [...pool];
    for (let i = offers.length - 1; i > 0; i--) {
      const j = Math.floor(roll(r2) * (i + 1));
      [offers[i], offers[j]] = [offers[j], offers[i]];
    }
    w = { ...w, rng: r2.rng, spoil: { kind: m.kind, offers: offers.slice(0, PRIZE_OFFERS) } };
  }
  // Shares promised to the crew come out of this prize.
  const owed = s.promised && f.payout > 0 && outcome !== 'sunk' ? Math.round(f.payout * PROMISED_SHARE) : 0;
  if (owed) w = { ...w, promised: false, log: [...w.log, { turn: s.turn, text: `the crew's promised shares paid out of the prize: ${owed}` }] };
  return {
    ...w,
    gold: s.gold + f.payout - owed,
    hull: f.ship.hull,
    sunk: outcome === 'sunk',
    encounter: null,
    reckoning: { shipId: m.shipId, port: m.port, kind: m.kind, nation: m.nation, outcome, payout: f.payout, attacked, heard: next - s.nextRumor },
  };
}

/** Patch the hull in port, a point at a time, as far as the purse goes. */
export function repair(sea: Sea, s: WorldState, points = s.maxHull - s.hull): WorldState {
  if (!sea.map.nodes[s.player].port) throw new Error('repairs are made in port');
  if (!serves(sea, s)) throw new Error("this port won't deal with you");
  const can = Math.min(points, s.maxHull - s.hull, Math.floor(s.gold / REPAIR_COST));
  return { ...s, hull: s.hull + can, gold: s.gold - can * REPAIR_COST };
}
