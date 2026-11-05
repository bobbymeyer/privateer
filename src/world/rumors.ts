/**
 * Rumors: word of something off the way, heard from prisoners, islanders,
 * a chandler's gossip or a pilot, that opens a detour (a landmark with
 * `detour` in landmarks.ts). Follow it and the detour is among your choices
 * at the landmarks it branches from; it rejoins the way after.
 *
 * Not all of them are true. Whether one is was settled when you heard it —
 * shaded by who told you — and you learn it only by going: the galleon that
 * never comes, the Great Ship sailed a week before, the Viceroy's fleet in
 * the river at Goa, no islands where the Spaniards said.
 *
 * The six:
 *
 * | rumor | heard | the detour | if it's true |
 * | the Manila galleon | Spanish prisoners on the Pacific coast | Cabo San Lucas | the galleon from Manila comes in |
 * | the Isles of Solomon | islanders at the Ladrones, Spanish prisoners | Mendaña's islands | water, food, a careen, islanders; maybe gold |
 * | the Great Ship of Amacon | Ternate, Portuguese prisoners in the East | off Macau | the carrack for Nagasaki |
 * | the Banda islands | the Sultan's pilot at Ternate | where the nutmeg grows | the Sultan's kinsmen give you nutmeg |
 * | Goa | Bantam, Portuguese prisoners in the East | the Viceroy's city | a fortress to raid, the richest of all |
 * | the carrack from Goa | Bantam, a castaway at the Cape, prisoners off Brazil | off the Azores | the year's carrack from the Indies |
 */

import type { Extra } from '../setup.ts';
import { HOME_LANDMARK, LANDMARKS, landmark } from './landmarks.ts';
import type { Nation } from './ports.ts';
import { type Roller, pick, roll } from './random.ts';
import { capacity, spiceRoom, topUp } from './stores.ts';
import type { Sea, WorldState } from './world.ts';

/** Who told you, and how far to trust them. */
export type Source = 'prisoner' | 'islanders' | 'gossip' | 'castaway' | 'pilot';
export const SOURCES: Record<Source, { truth: number; told: string[] }> = {
  prisoner: { truth: 0.55, told: ['a prisoner who would say anything to be put ashore', 'a frightened prisoner, eager to please', 'the pilot of the prize, sullen, but he swears it'] },
  islanders: { truth: 0.7, told: ['the islanders, by signs and drawings in the sand'] },
  gossip: { truth: 0.65, told: ['gossip in the chandler’s, over a cup', 'a Gujarati merchant who has been everywhere'] },
  castaway: { truth: 0.6, told: ['a Portuguese castaway, half mad from the sun'] },
  pilot: { truth: 0.85, told: ['the Sultan’s own pilot'] },
};

/** A rumor heard: what of, who told you, whether it's true, and whether you mean to follow it. */
export interface Rumor {
  key: string;
  source: Source;
  told: string;
  truth: boolean;
  followed: boolean;
}

interface Detour {
  /** The word, as you hear it. */
  word: string;
  /** Landmarks where you hear it, on raising them, and from whom. */
  heardAt: Partial<Record<string, Source>>;
  /** Prisoners of these nations, taken at these landmarks' waters (the landmark you last raised), tell of it. */
  prisoners?: { nations: Nation[]; after: string[] };
  /** Arriving, if it was a lie. */
  nothing: string;
}

export const DETOURS: Record<string, Detour> = {
  'cabo-san-lucas': {
    word: 'the galleon from Manila makes her landfall at Cabo San Lucas, every year, her crew dying of the scurvy and her hold full of silk and gold',
    heardAt: {},
    prisoners: { nations: ['spain'], after: ['valparaiso', 'callao', 'cacafuego', 'guatulco'] },
    nothing: 'Cabo San Lucas, and no galleon: she came in early this year, or late, or not at all',
  },
  solomons: {
    word: 'there are islands to the west where Mendaña found gold, and the people are kind, and nobody goes',
    heardAt: { ladrones: 'islanders' },
    prisoners: { nations: ['spain'], after: ['valparaiso', 'callao', 'cacafuego', 'guatulco'] },
    nothing: 'no islands where the Spaniards said: open sea, and the days spent looking',
  },
  macau: {
    word: 'the Great Ship of Amacon sails from Macau for Nagasaki with a year of China’s silk, and nobody has ever stopped her',
    heardAt: { ternate: 'gossip' },
    prisoners: { nations: ['portugal'], after: ['ladrones', 'manila', 'ternate'] },
    nothing: 'off Macau, and the Great Ship sailed a week ago. a junk says to try Canton, where they will not let you in',
  },
  banda: {
    word: 'the Sultan’s kinsmen at Banda have nutmeg to give an enemy of the Portuguese, for the asking',
    heardAt: { ternate: 'pilot' },
    nothing: 'the Banda islands, and Portuguese ships in the roads: the Sultan’s kinsmen dare not come out',
  },
  goa: {
    word: 'the Viceroy’s fleet has gone north against the Mughal, and Goa lies open, its warehouses full',
    heardAt: { java: 'gossip' },
    prisoners: { nations: ['portugal'], after: ['ternate', 'manila', 'macau', 'banda'] },
    nothing: 'Goa, and the Viceroy’s galleys in the river and the walls manned: no going in',
  },
  azores: {
    word: 'the carrack from Goa makes her landfall at the Azores every summer, so deep laden she can hardly sail',
    heardAt: { java: 'gossip', cape: 'castaway' },
    prisoners: { nations: ['portugal'], after: ['brazil-home', 'sierra-leone', 'cape'] },
    nothing: 'the Azores, and no carrack: the galleys of the Azores guard went out to bring her in a week ago',
  },
};

/** On raising a landmark, a rumor this often, if there's one to hear. */
export const RUMOR_CHANCE = 0.6;
/** From prisoners, after a prize taken. */
export const PRISONERS_TALK = 0.5;

/** Detours you've chosen to follow and not yet sailed. */
export const followed = (s: WorldState): string[] => s.rumors.filter((r) => r.followed && !s.voyage.visited.includes(r.key)).map((r) => r.key);
/** The rumor of a detour, if you've heard it. */
export const rumorOf = (s: WorldState, key: string) => s.rumors.find((r) => r.key === key) ?? null;

/** Landmarks you can still come to from here, by the way and its forks. */
function ahead(at: string): Set<string> {
  const seen = new Set<string>([at]);
  const queue = [at];
  while (queue.length) {
    const k = queue.shift()!;
    for (const n of landmark(k).next) if (!seen.has(n) && n !== HOME_LANDMARK) (seen.add(n), queue.push(n));
  }
  return seen;
}

/** Whether a detour can still be reached: one of the landmarks it branches from is ahead, and it isn't sailed. */
export function reachable(s: WorldState, key: string): boolean {
  if (s.voyage.visited.includes(key)) return false;
  const on = ahead(s.voyage.at);
  return landmark(key).detour!.from.some((f) => on.has(f) && (f === s.voyage.at || !s.voyage.visited.includes(f)));
}

/** A rumor offered: as an event that asks, follow it or not. Its truth is settled now. */
function offer(s: WorldState, key: string, source: Source, r: Roller): WorldState {
  const told = pick(r, SOURCES[source].told);
  const truth = roll(r) < SOURCES[source].truth;
  return { ...s, dilemma: { kind: 'rumor', key, source, told, truth }, log: [...s.log, { turn: s.turn, text: `a rumor, from ${told}`, stop: true }] };
}

const open = (s: WorldState, key: string) => !rumorOf(s, key) && reachable(s, key);

/** On raising a landmark: a rumor heard there, sometimes. At most one. */
export function hearAt(s: WorldState, at: string): WorldState {
  if (s.dilemma || s.hail || s.encounter) return s;
  const r: Roller = { rng: s.rng };
  const here = Object.entries(DETOURS).filter(([k, d]) => d.heardAt[at] && open(s, k));
  if (!here.length || roll(r) >= RUMOR_CHANCE) return { ...s, rng: r.rng };
  const [key, d] = pick(r, here);
  return { ...offer(s, key, d.heardAt[at]!, r), rng: r.rng };
}

/** After a prize taken: her people talk, sometimes. */
export function hearFromPrisoners(s: WorldState, nation: Nation): WorldState {
  if (s.dilemma || s.hail || s.encounter) return s;
  const r: Roller = { rng: s.rng };
  const here = Object.entries(DETOURS).filter(([k, d]) => d.prisoners?.nations.includes(nation) && d.prisoners.after.includes(s.voyage.at) && open(s, k));
  if (!here.length || roll(r) >= PRISONERS_TALK) return { ...s, rng: r.rng };
  const [key] = pick(r, here);
  return { ...offer(s, key, 'prisoner', r), rng: r.rng };
}

/** Follow it, or let it be. Either way it's heard, and not offered again. */
export function heed(s: WorldState, follow: boolean): WorldState {
  const d = s.dilemma;
  if (d?.kind !== 'rumor') throw new Error('there is no rumor to heed');
  const rumor: Rumor = { key: d.key, source: d.source, told: d.told, truth: d.truth, followed: follow };
  const name = landmark(d.key).name;
  const from = landmark(d.key).detour!.from.map((k) => landmark(k).name);
  const text = follow ? `you mean to see for yourself: ${name}, from ${from.join(' or ')}` : `you let the rumor of ${name} be`;
  return { ...s, dilemma: null, rumors: [...s.rumors, rumor], log: [...s.log, { turn: s.turn, text }] };
}

// --- The prizes at the end of a rumor --------------------------------------------

export type Prize = 'galleon' | 'great-ship' | 'carrack';
export const PRIZES: Record<Prize, { name: string; nation: Nation; extra: Extra; text: string }> = {
  galleon: {
    name: 'the Manila galleon', nation: 'spain', extra: { hull: 4, cargo: 280, takenWhole: true },
    text: 'the galleon from Manila, five months out, her crew sick and her decks crowded with silk bales; but she carries guns, and soldiers for the Philippines.',
  },
  'great-ship': {
    name: 'the Great Ship of Amacon', nation: 'portugal', extra: { hull: 5, cargo: 320, takenWhole: true },
    text: 'the Great Ship of Amacon, a carrack of a thousand tons, deep with silk for Japan and the silver to buy more.',
  },
  carrack: {
    name: 'the carrack from Goa', nation: 'portugal', extra: { hull: 6, cargo: 400, takenWhole: true },
    text: 'the carrack from Goa, seven decks high, the Indies’ whole year of pepper, cloves, silk, diamonds and calico in her.',
  },
};
/** Goa: the richest town in the East, and the hardest. */
export const GOA_EXTRA: Extra = { hull: 4, cargo: 300 };
const PRIZE_AT: Record<string, Prize> = { 'cabo-san-lucas': 'galleon', macau: 'great-ship', azores: 'carrack' };
/** The Isles of Solomon: Mendaña's gold, this often, and how much. */
export const SOLOMON_GOLD = 0.25;
export const SOLOMON_GOLD_SUM = [15, 45] as const;
/** The Sultan's kinsmen at Banda: nutmeg to fill this share of your spice room. */
export const BANDA_GIFT = 0.5;

/** Whether a detour you're lying at turned out true. Not a detour: true. */
export const trueHere = (s: WorldState, key: string) => !landmark(key).detour || rumorOf(s, key)?.truth !== false;

/** Raising a detour: what was there, if anything. Called by `raise`. */
export function arriveDetour(sea: Sea, s: WorldState, key: string): WorldState {
  void sea;
  if (!landmark(key).detour) return s;
  const say = (w: WorldState, text: string): WorldState => ({ ...w, log: [...w.log, { turn: w.turn, text, stop: true }] });
  if (!trueHere(s, key)) return say(s, DETOURS[key].nothing);
  const prize = PRIZE_AT[key];
  if (prize) return say({ ...s, hail: { kind: 'treasure-ship', nation: PRIZES[prize].nation, prize } }, `a sail: ${PRIZES[prize].name}, as they said`);
  const r: Roller = { rng: s.rng };
  let w: WorldState = s;
  if (key === 'solomons') {
    w = say(w, 'the Isles of Solomon, as the islanders drew them: green, and the people coming down to the beach with fruit');
    if (roll(r) < SOLOMON_GOLD) {
      const gold = SOLOMON_GOLD_SUM[0] + Math.floor(roll(r) * (SOLOMON_GOLD_SUM[1] - SOLOMON_GOLD_SUM[0] + 1));
      w = say({ ...w, gold: w.gold + gold }, `and gold dust in the streams, as the Spaniards said: ${gold}, traded for knives`);
    }
  }
  if (key === 'banda') {
    const gift = Math.max(0, Math.min(spiceRoom(w) - w.spice, Math.ceil(spiceRoom(w) * BANDA_GIFT)));
    const cap = capacity(w);
    w = say({ ...w, spice: w.spice + gift, fresh: 0, stores: { ...w.stores, food: topUp(w.stores.food, w.crew * 7, cap.food) } }, `the Sultan’s kinsmen come out with nutmeg: ${gift} tons, a gift, and fruit for the crew`);
  }
  if (key === 'goa') w = say(w, 'Goa, and the river empty of galleys: the Viceroy’s fleet is away, as they said');
  return { ...w, rng: r.rng };
}

/** Every detour, for drawing. */
export const DETOUR_KEYS = LANDMARKS.filter((l) => l.detour).map((l) => l.key);
