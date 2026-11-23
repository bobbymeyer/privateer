/**
 * The peoples of the coasts you put in at, and how you treat them.
 *
 * The English of the 1580s made a point of it: the Spaniards, Hakluyt wrote,
 * "sought not them, but their goods and riches", and Las Casas's account of
 * what Spain had done in the Indies was printed in English in 1583. Drake
 * made friends of the Cimarrons on the isthmus and was crowned by the Miwok
 * at Nova Albion; he lost men to the Mapuche's arrows at Mocha, and two more
 * to the Patagonians at San Julián. So here: deal fairly — trade, pay in
 * truck, keep the hands in hand — and a people are friendly: guides who make
 * the work ashore quicker, fresh food brought down to the beach, and what
 * they know of the coast. Deal harshly — take what you need, fire on their
 * canoes, let the hands run wild — and the coast is closed: no trade, and
 * arrows from the trees at the watering place.
 *
 * And they remember. A people you left hostile are hostile to the next
 * English ship too (kept in the browser, like the graves: see
 * `src/peoples.ts`), and a people you left friendly are friendlier.
 */

import { type Roller, roll } from './random.ts';
import { capacity, topUp } from './stores.ts';
import type { WorldState } from './world.ts';

export type People = 'tupinamba' | 'patagonians' | 'mapuche' | 'miwok' | 'chamorro' | 'solomons' | 'khoikhoi' | 'temne';

export interface PeopleDef {
  name: string;
  /** The landmarks of their coast. */
  at: string[];
  /** Where they stand with the English before you come: the Miwok crowned Drake; the Mapuche shot at him. */
  start: number;
}

export const PEOPLES: Record<People, PeopleDef> = {
  tupinamba: { name: 'the Tupinambá', at: ['brazil', 'guanabara', 'brazil-home'], start: 0 },
  patagonians: { name: 'the Patagonians', at: ['san-julian'], start: 0 },
  mapuche: { name: 'the Mapuche', at: ['mocha'], start: -1 },
  miwok: { name: 'the Miwok', at: ['nova-albion'], start: 1 },
  chamorro: { name: 'the Chamorro', at: ['ladrones'], start: 0 },
  solomons: { name: 'the islanders of the Solomons', at: ['solomons'], start: 1 },
  khoikhoi: { name: 'the Khoikhoi', at: ['cape'], start: 0 },
  temne: { name: 'the Temne', at: ['sierra-leone'], start: 0 },
};
export const PEOPLE_KEYS = Object.keys(PEOPLES) as People[];

/** Standing runs from -3 to 3: friendly at 1 and over, hostile at -2 and under, wary between. */
export const STANDING = [-3, 3] as const;
export const FRIENDLY = 1;
export const HOSTILE = -2;
/** What fair and harsh dealing do to standing. */
export const FAIR = 1;
export const HARSH = -2;

export type Word = 'friendly' | 'wary' | 'hostile';
/** What a voyage before left behind on a coast: remembered by the next English ship. */
export type Memory = Partial<Record<People, 'friendly' | 'hostile'>>;

/** The people of the coast at a landmark, if any. */
export const peopleAt = (key: string): People | null => PEOPLE_KEYS.find((p) => PEOPLES[p].at.includes(key)) ?? null;
/** The people of the coast you're lying at. */
export const peopleHere = (s: WorldState) => (s.landfall ? null : peopleAt(s.voyage.at));

/** Where a people stand with you now. */
export const standingOf = (s: WorldState, p: People) => s.peoples[p] ?? PEOPLES[p].start;
export const wordOf = (n: number): Word => (n >= FRIENDLY ? 'friendly' : n <= HOSTILE ? 'hostile' : 'wary');
export const standingWord = (s: WorldState, p: People) => wordOf(standingOf(s, p));
export const friendly = (s: WorldState, p: People | null) => !!p && standingOf(s, p) >= FRIENDLY;
export const hostileTo = (s: WorldState, p: People | null) => !!p && standingOf(s, p) <= HOSTILE;

/** Where every people stand at the start of a voyage, with what the last English ship left behind. */
export function startingStanding(memory: Memory = {}): Partial<Record<People, number>> {
  return Object.fromEntries(PEOPLE_KEYS.map((p) => [p, clamp(PEOPLES[p].start + (memory[p] === 'hostile' ? -3 : memory[p] === 'friendly' ? 1 : 0))]));
}

const clamp = (n: number) => Math.max(STANDING[0], Math.min(STANDING[1], n));
const said = (s: WorldState, text: string, stop = false): WorldState => ({ ...s, log: [...s.log, { turn: s.turn, text, ...(stop ? { stop } : {}) }] });

/** Deal with a people, fairly or harshly: their standing moves, and the log says so when it turns. */
export function deal(s: WorldState, p: People, by: number): WorldState {
  const was = standingWord(s, p);
  const w: WorldState = { ...s, peoples: { ...s.peoples, [p]: clamp(standingOf(s, p) + by) }, seen: s.seen.includes(`met:${p}`) ? s.seen : [...s.seen, `met:${p}`] };
  const now = standingWord(w, p);
  if (now === was) return w;
  return said(w, now === 'friendly' ? `${PEOPLES[p].name} are your friends now` : now === 'hostile' ? `${PEOPLES[p].name} have turned against you` : `${PEOPLES[p].name} are wary of you now`, now === 'hostile');
}

// --- At their coast ----------------------------------------------------------------

/** Friendly, they bring this many days of fresh food down to the beach, the first time. */
export const GIFT_DAYS = 5;
/** Their guides make the work ashore a day quicker, and the foraging half as good again. */
export const GUIDED_DAYS = 1;
export const GUIDED_FORAGE = 1.25;
/** At the work ashore, arrows from the trees: this often, wary or hostile; and the dead. */
export const AMBUSH = { wary: 0.12, hostile: 0.4 } as const;
export const AMBUSH_DEAD = [1, 3] as const;

/**
 * Raising their coast: where they stand, said; what the last English ship
 * left behind, said once; and, friendly, fresh food brought down to the beach
 * the first time.
 */
export function meetPeople(s: WorldState, key: string): WorldState {
  const memory = s.memory ?? {};
  const p = peopleAt(key);
  if (!p) return s;
  let w: WorldState = s.seen.includes(`met:${p}`) ? s : { ...s, seen: [...s.seen, `met:${p}`] };
  if (memory[p] && !w.seen.includes(`remembered:${p}`)) {
    w = { ...w, seen: [...w.seen, `remembered:${p}`] };
    w = said(w, memory[p] === 'hostile' ? `${PEOPLES[p].name} remember the last English ship, and keep to the trees with their bows strung` : `${PEOPLES[p].name} remember the last English ship, and come down to the beach to meet you`);
  }
  const word = standingWord(w, p);
  w = said(w, `${PEOPLES[p].name}: ${word}`);
  if (word === 'friendly' && !w.seen.includes(`gift:${key}`)) {
    const cap = capacity(w);
    w = said({ ...w, seen: [...w.seen, `gift:${key}`], fresh: 0, stores: { ...w.stores, food: topUp(w.stores.food, w.crew * GIFT_DAYS, cap.food) } }, `they bring fruit and fresh meat down to the beach: ${GIFT_DAYS} days of it, a gift`);
  }
  return w;
}

/**
 * At the work ashore on their coast: arrows from the trees, sometimes, if
 * they're wary of you or worse. Returns the state after, with the dead.
 */
export function ambush(s: WorldState, r: Roller): WorldState {
  const p = peopleHere(s);
  if (!p) return s;
  const word = standingWord(s, p);
  if (word === 'friendly' || roll(r) >= AMBUSH[word]) return s;
  const dead = Math.min(s.crew, AMBUSH_DEAD[0] + Math.floor(roll(r) * (AMBUSH_DEAD[1] - AMBUSH_DEAD[0] + 1)));
  return said({ ...s, crew: s.crew - dead }, `arrows from the trees at the work ashore: ${dead === 1 ? 'a hand' : `${dead} hands`} dead of arrows`, true);
}

/** What the voyage leaves behind on the coasts it met, for the next: hostile, friendly, or forgotten. */
export function remember(memory: Memory, s: WorldState): Memory {
  const next: Memory = { ...memory };
  for (const p of PEOPLE_KEYS) {
    if (!s.seen.includes(`met:${p}`)) continue;
    const word = standingWord(s, p);
    if (word === 'wary') delete next[p];
    else next[p] = word;
  }
  return next;
}

// --- Taking what you need --------------------------------------------------------------

/** Taken by force: three weeks of fresh food and the casks filled, in a day; and the coast turned against you. */
export const TAKEN_DAYS = 21;

/** Take what you need from a people's coast: fresh food and water, at the cost of their friendship. */
export function takeWhatYouNeed(s: WorldState): WorldState {
  const p = peopleHere(s);
  if (!p) throw new Error('there is nobody here to take from');
  const cap = capacity(s);
  let w: WorldState = {
    ...s,
    fresh: 0,
    calm: Math.max(s.calm, s.turn + 1),
    stores: { ...s.stores, water: Math.max(s.stores.water, cap.water), food: topUp(s.stores.food, s.crew * TAKEN_DAYS, cap.food) },
  };
  w = said(w, `the hands go ashore armed and take what they need from ${PEOPLES[p].name}: the casks filled, ${TAKEN_DAYS} days of fresh food`);
  return deal(w, p, HARSH);
}
