/**
 * What a port offers, and on what terms. A port of a nation that wants you
 * will sell you nothing, not a drink, until its officials are paid to look
 * the other way.
 */

import { CREW, type Outfit, SHIP_CLASSES, UPGRADES, maxHullOf, sightOf } from '../outfit.ts';
import { adjective, type Nation } from './ports.ts';
import { YOUR_NATION } from './meet.ts';
import { type Sea, wantedBy } from './ships.ts';
import { GOAL, type WorldState } from './world.ts';
import { MORALE_MAX } from './events.ts';

/** Gold per point of standing raised, times how far below zero you are. */
export const BRIBE_COST = 10;

const portHere = (sea: Sea, s: WorldState) => {
  const port = sea.map.nodes[s.player].port;
  if (!port) throw new Error('that is done in port');
  return port;
};

/**
 * A pirate's havens: Port Royal, which asks no questions, and the Barbary
 * coast. They deal with a pirate whoever wants him, and he can retire there.
 */
export const PIRATE_HAVENS = ['Port Royal', 'Algiers', 'Tunis', 'Tripoli', 'Salé'];
export const isHaven = (sea: Sea, s: WorldState) => s.pirate && PIRATE_HAVENS.includes(sea.map.nodes[s.player].port?.name ?? '');

/** Whether this port will deal with you. Independent harbours deal with anyone; English ones not with a pirate, but for Port Royal; a pirate's havens with a pirate. */
export const serves = (sea: Sea, s: WorldState): boolean => {
  const port = sea.map.nodes[s.player].port;
  if (!port) return false;
  if ((s.sacked[s.player] ?? -1) > s.turn) return false;
  if (isHaven(sea, s)) return true;
  if (s.pirate && port.nation === YOUR_NATION) return false;
  // Islanders trade, but in kind: no bar, no hands to hire, no yard.
  if (port.nation === 'native') return false;
  return port.nation === 'local' || !wantedBy(s.standing, port.nation);
};

/** What water, fruit and fresh meat cost from islanders, in trade goods. */
export const PROVISION_COST = 3;
/** And what they do for the crew, and for the ship. */
export const PROVISION_CHEER = 3;
export const PROVISION_HULL = 2;

/** Whether the islanders here will trade with you today. */
export const provisions = (sea: Sea, s: WorldState) =>
  sea.map.nodes[s.player].port?.nation === 'native' && !wantedBy(s.standing, 'native') && s.rounds === 0 && !s.encounter;

/**
 * Trade with islanders for water, fruit and fresh meat, and timber for the
 * ship: the crew's spirits up, a little hull mended. Once a day — a day's
 * trading is counted, like a night in the bar, in `rounds`.
 */
export function provision(sea: Sea, s: WorldState): WorldState {
  const port = portHere(sea, s);
  if (port.nation !== 'native') throw new Error('provisions are traded for with islanders');
  if (wantedBy(s.standing, 'native')) throw new Error(`the ${port.name} islanders won't trade with you`);
  if (s.rounds > 0) throw new Error("you've traded here today");
  const paid = pay(s, PROVISION_COST);
  return {
    ...paid,
    rounds: s.rounds + 1,
    morale: Math.min(MORALE_MAX, s.morale + PROVISION_CHEER),
    hull: Math.min(s.maxHull, s.hull + PROVISION_HULL),
    log: [...s.log, { turn: s.turn, text: `water, fruit and timber from the islanders at ${port.name}` }],
  };
}

/** A royal pardon for piracy: bought in an English port, and dear. */
export const PARDON_COST = 80;

/** Buy a pardon. England forgets, as far as the law goes: you're no pirate, and its grudge is wiped clean. */
export function buyPardon(sea: Sea, s: WorldState): WorldState {
  const port = portHere(sea, s);
  if (!s.pirate) throw new Error('you have nothing to be pardoned for');
  if (port.nation !== YOUR_NATION) throw new Error('a pardon is bought in an English port');
  const paid = pay(s, PARDON_COST);
  return {
    ...paid,
    pirate: false,
    standing: { ...s.standing, [YOUR_NATION]: 0 },
    log: [...s.log, { turn: s.turn, text: 'a royal pardon, bought dear: you are no pirate' }],
  };
}

const mustServe = (sea: Sea, s: WorldState) => {
  const port = portHere(sea, s);
  if (!serves(sea, s)) throw new Error(`the ${adjective(port.nation)} won't deal with you`);
  return port;
};

const pay = (s: WorldState, cost: number): WorldState => {
  if (s.gold < cost) throw new Error('not enough in the purse');
  return { ...s, gold: s.gold - cost };
};

/** The outfit changed: hull and sight follow it. A bigger ship comes with its hull whole; damage stays with the old one. */
export function refit(s: WorldState, outfit: Outfit, freshHull = false): WorldState {
  const maxHull = maxHullOf(outfit);
  const hull = freshHull ? maxHull : Math.min(maxHull, s.hull + (maxHull - s.maxHull));
  return { ...s, outfit, maxHull, hull, sight: sightOf(outfit) };
}

/** Hire a hand of note in the bar. One of each, as many as the ship has berths. */
export function recruit(sea: Sea, s: WorldState, role: string): WorldState {
  mustServe(sea, s);
  const r = CREW[role];
  if (!r) throw new Error(`no such hand: ${role}`);
  if (s.outfit.crew.includes(role)) throw new Error(`you already have a ${r.name}`);
  if (s.outfit.crew.length >= SHIP_CLASSES[s.outfit.ship].berths) throw new Error('no berth for another');
  return refit(pay(s, r.cost), { ...s.outfit, crew: [...s.outfit.crew, role] });
}

/** Let a hand go, to make a berth. */
export function dismiss(s: WorldState, role: string): WorldState {
  return refit(s, { ...s.outfit, crew: s.outfit.crew.filter((c) => c !== role) });
}

/** A new ship at the yard. The crew come with you; the old ship's upgrades don't, nor what you paid for it. */
export function buyShip(sea: Sea, s: WorldState, cls: string): WorldState {
  mustServe(sea, s);
  const c = SHIP_CLASSES[cls];
  if (!c) throw new Error(`no such ship: ${cls}`);
  if (cls === s.outfit.ship) throw new Error(`you already sail a ${c.name}`);
  if (s.outfit.crew.length > c.berths) throw new Error(`a ${c.name} has berths for ${c.berths}`);
  return refit(pay(s, c.cost), { ship: cls, upgrades: [], crew: s.outfit.crew }, true);
}

/** Fit an upgrade to the ship you have. */
export function buyUpgrade(sea: Sea, s: WorldState, key: string): WorldState {
  mustServe(sea, s);
  const u = UPGRADES[key];
  if (!u) throw new Error(`no such upgrade: ${key}`);
  if (s.outfit.upgrades.filter((x) => x === key).length >= u.max) throw new Error(`no room for more ${u.name}`);
  return refit(pay(s, u.cost), { ...s.outfit, upgrades: [...s.outfit.upgrades, key] });
}

/** What it costs to raise your standing with a nation by one. */
export const bribeCost = (s: WorldState, nation: Nation) => BRIBE_COST * Math.max(1, -(s.standing[nation] ?? 0));

/**
 * Pay this port's officials to look the other way: your standing with its
 * nation rises by one. It works in a port that won't otherwise deal with you;
 * that is the point.
 */
export function bribe(sea: Sea, s: WorldState): WorldState {
  const port = portHere(sea, s);
  if (port.nation === 'local') throw new Error('nobody here to bribe');
  if (s.pirate && port.nation === YOUR_NATION) throw new Error('no bribe buys off piracy: buy a pardon');
  const paid = pay(s, bribeCost(s, port.nation));
  return { ...paid, standing: { ...s.standing, [port.nation]: (s.standing[port.nation] ?? 0) + 1 } };
}

/**
 * Retire, a pirate in one of his havens, with the score: a win, the
 * pirate's way. London would hang him; Port Royal and the Barbary coast
 * will let him grow old.
 */
export function retire(sea: Sea, s: WorldState): WorldState {
  const port = portHere(sea, s);
  if (!isHaven(sea, s)) throw new Error('a pirate retires in a haven: Port Royal, or the Barbary coast');
  if (s.gold < GOAL) throw new Error(`not yet: ${GOAL} to retire on`);
  return { ...s, won: true, ending: 'retired', log: [...s.log, { turn: s.turn, text: `you retired to ${port.name} with ${s.gold}, a pirate rich enough to grow old` }] };
}
