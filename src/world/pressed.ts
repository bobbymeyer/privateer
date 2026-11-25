/**
 * The men who aren't your own: pressed from prizes, and hired at a price.
 *
 * Pressed men. After a prize, her people are yours to press or let go, as
 * captains of the time made up their crews: Drake took Nuño da Silva, a
 * Portuguese pilot who knew the coast of Brazil, off the Cape Verde islands
 * in 1578, and men off his prizes all the way up the coast of Peru. Pressed
 * men work the ship and count toward sailing her, but they never asked to
 * come: at a landmark some slip away, more where their own people are, and
 * in a fight now and then they turn. Fed full and given a share of a prize,
 * in two months they come round and are hands like the rest.
 *
 * Hired men, each with a catch:
 * - soldiers wanting "noble purchase" (Middleton's soldiers in The Phoenix,
 *   Jowitt pp. 238–9): a card the more in a fight, grappled; they sail like
 *   landsmen (the hull wears faster), and three months without a prize they
 *   go off to find their own;
 * - hands from the jails, as Gilbert proposed to man his plantations with
 *   the "needie" taken "twentie at a clappe out of one iayle" (Strobl,
 *   pp. 211, 227): cheap, and they run at every landmark;
 * - a renegade interpreter, a turncoat who has served everyone (Qoli Beg,
 *   Takeda pp. 153–4): he opens rumors and smooths things with the people of
 *   a coast, and one landmark he may sell your plans and go.
 *
 * Their numbers are among the crew, never over it: `pressed`, `soldiers` and
 * `jailed` are how many of the hands are such men.
 */

import type { Card } from '../cards.ts';
import type { TargetKind } from '../setup.ts';
import { landmark } from './landmarks.ts';
import type { Nation } from './ports.ts';
import { type Roller, pick, roll } from './random.ts';
import { complement, deaths } from './stores.ts';
import type { Sea, WorldState } from './world.ts';
import { FAIR, deal, peopleAt } from './peoples.ts';
import { alive } from './hands.ts';

// --- Pressed men ------------------------------------------------------------------

/** How many of her people you could press, by what she was: a merchant few, a carrack many. */
export const PRESSABLE: Partial<Record<TargetKind, number>> = { merchant: 2, privateer: 2, corsair: 1, 'treasure-ship': 3 };
/** Pressed men aboard at most, as a share of the hands: the rest must guard them. */
export const GUARDED = 0.2;
/** A rumored prize (the galleon, the Great Ship, the carrack): a crowded ship. */
export const PRESSABLE_PRIZE = 5;
/** Days fed full and without trouble before pressed men come round and are hands. */
export const COME_ROUND = 90;
/** What a prize's share takes off that. */
export const SHARE_DAYS = 15;
/** At a landmark, the share of pressed men who slip away: more where their own people are. */
export const PRESSED_RUN = 0.3;
export const PRESSED_RUN_HOME = 0.6;
/** After a fight, the chance they turn, more against their own nation. */
export const TURN = 0.2;
export const TURN_OWN = 0.4;

/** Where a Spaniard or a Portuguese could find his own people, ashore or alongside. */
export const IBERIAN = ['canaries', 'cape-verde', 'brazil', 'guanabara', 'brazil-home', 'valparaiso', 'callao', 'cacafuego', 'guatulco', 'manila', 'goa', 'macau', 'azores', 'arica', 'river-may'];

/** The pilot: a Portuguese prize off the Atlantic coast, who knows the coast of Brazil. Once a voyage. */
export const pilotWaters = (sea: Sea, s: WorldState) => {
  const { lon, lat } = sea.map.nodes[s.player];
  return lon < -10 && lat < 20 && lat > -40;
};
/** The legs he knows: down the coast of Brazil to the Plate and San Julián. */
export const PILOT_COAST = ['brazil', 'guanabara', 'plate', 'san-julian', 'brazil-home'];
/** With him, along that coast, a day's way more in every three. */
export const piloted = (s: WorldState) => s.seen.includes('pilot') && !!s.voyage.bound && PILOT_COAST.includes(s.voyage.bound);

/** What's on offer after a prize: so many men, and her pilot. Null if there's nothing, or no room. */
export function pressable(sea: Sea, s: WorldState, kind: TargetKind, nation: Nation, prize: boolean): { men: number; pilot: boolean } | null {
  const room = Math.max(0, complement(s) - s.crew);
  // No more pressed men aboard than a fifth of the hands can keep under guard.
  const guard = Math.max(0, Math.floor(s.crew * GUARDED) - s.pressed);
  const men = Math.min(room, guard, prize ? PRESSABLE_PRIZE : (PRESSABLE[kind] ?? 0));
  const pilot = nation === 'portugal' && !s.seen.includes('pilot-had') && pilotWaters(sea, s);
  return men > 0 || pilot ? { men, pilot } : null;
}

/** Press them: the men, and the pilot if there is one; or let them all go. */
export function press(s: WorldState, men: number, pilot: boolean, nation: Nation): WorldState {
  let w: WorldState = s;
  if (men > 0) w = { ...w, crew: w.crew + men, pressed: w.pressed + men, pressedSince: w.pressed > 0 ? w.pressedSince : w.turn, pressedFrom: w.pressedFrom.includes(nation) ? w.pressedFrom : [...w.pressedFrom, nation] };
  if (pilot) w = { ...w, seen: [...w.seen, 'pilot', 'pilot-had'] };
  const said = [men > 0 && `${men === 1 ? 'a man' : `${men} men`} pressed from her crew`, pilot && 'her pilot taken, who knows the coast of Brazil as Nuño da Silva did'].filter(Boolean).join(', and ');
  return said ? { ...w, log: [...w.log, { turn: w.turn, text: said }] } : w;
}

/** A day of them: short commons set them back; fed full long enough, they come round. Called by `aDay`. */
export function pressedDay(s: WorldState): WorldState {
  if (s.pressed <= 0) return s;
  if (s.rations !== 'full') return { ...s, pressedSince: s.pressedSince + 1 };
  if (s.turn - s.pressedSince < COME_ROUND) return s;
  return { ...s, pressed: 0, pressedFrom: [], log: [...s.log, { turn: s.turn, text: `the pressed men have come round, fed and shared with the rest: hands now, like any other` }] };
}

/** A prize taken: the pressed men have their share, and come round the sooner. */
export const shareOut = (s: WorldState): WorldState => (s.pressed > 0 ? { ...s, pressedSince: s.pressedSince - SHARE_DAYS } : s);

/**
 * After a fight, the pressed men may turn: in the smoke, against you, the
 * likelier against their own nation's ship. Those who turned are put over
 * the side in a boat, or go over to her. Not mourned: no hand of note among
 * them, and the count is kept here.
 */
export function rising(s: WorldState, nation: Nation, r: Roller): WorldState {
  if (s.pressed <= 0 || s.sunk) return s;
  const own = s.pressedFrom.includes(nation);
  if (roll(r) >= (own ? TURN_OWN : TURN)) return s;
  const n = Math.min(s.pressed, 1 + Math.floor(roll(r) * Math.ceil(s.pressed / 2)));
  const text = `in the fight ${n === 1 ? 'one of the pressed men' : `${n} of the pressed men`} turned on you, and ${n === 1 ? 'was' : 'were'} put over the side in the boat when it was done`;
  return { ...s, crew: s.crew - n, pressed: s.pressed - n, pressedSince: s.turn, losses: { ...s.losses, ran: (s.losses.ran ?? 0) + n }, log: [...s.log, { turn: s.turn, text, stop: true }] };
}

// --- Hired men ---------------------------------------------------------------------

/** Where men are hired, beside the plain hands: soldiers and jail-hands at home, the interpreter where renegades are found. */
export const HIRES_AT: Record<'soldiers' | 'jail' | 'interpreter', string[]> = {
  soldiers: ['plymouth'],
  jail: ['plymouth'],
  interpreter: ['plymouth', 'ternate', 'java'],
};
export const HIRE = {
  soldiers: { lot: 5, cost: 6, name: 'soldiers wanting noble purchase' },
  jail: { lot: 5, cost: 1, name: 'hands from the jails' },
  interpreter: { lot: 1, cost: 8, name: 'a renegade interpreter' },
} as const;
export type Hire = keyof typeof HIRE;

/** Whether this hire is to be had where you're lying. */
export const hireHere = (s: WorldState, h: Hire) => HIRES_AT[h].includes(s.voyage.at) && !s.seen.includes(`shut:${s.voyage.at}`);
/** Room for them under her complement; the interpreter once a voyage. */
export function canHire(s: WorldState, h: Hire): boolean {
  if (!hireHere(s, h)) return false;
  if (h === 'interpreter' && s.hands.some((x) => x.role === 'interpreter')) return false;
  return s.crew + HIRE[h].lot <= complement(s) && s.gold >= HIRE[h].cost;
}

// Renegades of every flag: a Portuguese who has turned Moor and back, a Genoese, a Fleming.
const RENEGADES = ['Diogo Fernandes', 'Antonio de Lisboa', 'Giovanni Battista Moro', 'Pieter Janszoon', 'Manuel Rodrigues', 'Jacques Lemoine'];

/** Hire them. */
export function hire(s: WorldState, h: Hire, r: Roller): WorldState {
  if (!hireHere(s, h)) throw new Error('they are not to be had here');
  if (!canHire(s, h)) throw new Error(s.gold < HIRE[h].cost ? 'not enough in the purse' : h === 'interpreter' ? 'you have your interpreter' : 'no room for more hands');
  const paid = { ...s, gold: s.gold - HIRE[h].cost, crew: s.crew + HIRE[h].lot };
  if (h === 'soldiers') return { ...paid, soldiers: s.soldiers + HIRE.soldiers.lot, log: [...s.log, { turn: s.turn, text: 'five soldiers sign on, wanting noble purchase' }] };
  if (h === 'jail') return { ...paid, jailed: s.jailed + HIRE.jail.lot, log: [...s.log, { turn: s.turn, text: 'five men out of the jail, glad of the chance' }] };
  const name = pick(r, RENEGADES);
  return { ...paid, hands: [...s.hands, { role: 'interpreter', name }], log: [...s.log, { turn: s.turn, text: `${name}, a renegade who has served everyone, signs on as your interpreter` }] };
}

/** Soldiers aboard enough to go over the side: a card the more in a fight. */
export const SOLDIERS_FIGHT = 5;
/** Their card: they hold her alongside and sweep her decks. Board, like the boarding party, but no gunner's loss. */
export const SOLDIERS_CARD = { key: 'soldiers', name: 'soldiers over the side' } as const;
export const soldiersCard = (s: WorldState) => s.soldiers >= SOLDIERS_FIGHT;
/** Landsmen at the sheets: the hull wears faster, by this, while they're aboard. */
export const SOLDIERS_WEAR = 0.75;
/** Days without a prize before soldiers go off to find their own; and how often they do then, at a landmark. */
export const SOLDIERS_IDLE = 90;
export const SOLDIERS_GO = 0.35;
/** The share of jail-hands who run at each landmark. */
export const JAIL_RUN = 0.2;
/** The interpreter: how often he sells your plans and goes, at a landmark. */
export const BETRAY = 0.06;
export const BETRAY_GRIEVANCE = 20;

/** The deck's extra card, while soldiers are aboard. */
export const soldierCards = (deck: Card[], s: WorldState, card: Card): Card[] => (soldiersCard(s) ? [...deck, card] : deck);

// --- At a landmark ---------------------------------------------------------------

/**
 * On raising a landmark: pressed men slip away (more where their own people
 * are), jail-hands run, idle soldiers go off, and the interpreter may sell
 * your plans. Lines the mourning reads as men gone, none of them of note.
 */
export function strangersArriving(s: WorldState, key: string): WorldState {
  const r: Roller = { rng: s.rng };
  let w = s;
  const say = (text: string) => (w = { ...w, log: [...w.log, { turn: w.turn, text }] });
  const boatswain = alive(w, 'boatswain') ? 1 : 0;
  if (w.pressed > 0) {
    const n = Math.max(0, Math.min(w.pressed, deaths(r, w.pressed * (IBERIAN.includes(key) ? PRESSED_RUN_HOME : PRESSED_RUN)) - boatswain));
    if (n > 0) {
      w = { ...w, crew: w.crew - n, pressed: w.pressed - n };
      say(`${n === 1 ? 'one of the pressed men' : `${n} of the pressed men`} slipped away at ${landmark(key).name}${IBERIAN.includes(key) ? ', to his own people' : ''}`);
    }
  }
  if (w.jailed > 0) {
    const n = Math.min(w.jailed, deaths(r, w.jailed * JAIL_RUN));
    if (n > 0) {
      w = { ...w, crew: w.crew - n, jailed: w.jailed - n };
      say(`${n === 1 ? 'one of the jail-hands' : `${n} of the jail-hands`} ran at ${landmark(key).name}`);
    }
  }
  if (w.soldiers > 0 && w.turn - w.lastPrize > SOLDIERS_IDLE && roll(r) < SOLDIERS_GO) {
    const n = Math.max(1, Math.ceil(w.soldiers / 2));
    w = { ...w, crew: w.crew - n, soldiers: w.soldiers - n };
    say(`${n} of the soldiers went off at ${landmark(key).name} to find their own noble purchase, tired of waiting for yours`);
  }
  const renegade = w.hands.find((h) => h.role === 'interpreter' && !h.dead && !h.ran);
  if (renegade) {
    // A people of the coast, the first time: he has their tongue, or near enough.
    const p = peopleAt(key);
    if (p && !w.seen.includes(`interpreted:${p}`)) w = { ...deal(w, p, FAIR), seen: [...w.seen, `interpreted:${p}`] };
    if (roll(r) < BETRAY) {
      const before = !w.voyage.visited.includes('cacafuego') || w.voyage.at === 'cacafuego';
      w = {
        ...w,
        crew: w.crew - 1,
        hands: w.hands.map((h) => (h === renegade ? { ...h, ran: true } : h)),
        ...(before ? { seen: w.seen.includes('coast-alarm') ? w.seen : [...w.seen, 'coast-alarm'] } : { grievance: w.grievance + BETRAY_GRIEVANCE }),
      };
      say(`the interpreter, ${renegade.name}, gone in the night at ${landmark(key).name}, and your plans sold with him: ${before ? 'word of you goes up the coast ahead' : 'one more thing for Spain to complain of'}`);
    }
  }
  return { ...w, rng: r.rng };
}

/**
 * When hands are lost to anything else — sickness, a fight, the sea — the
 * pressed, the soldiers and the jail-hands are among them in their share.
 */
export function thin(before: WorldState, after: WorldState): WorldState {
  const lost = before.crew - after.crew;
  if (lost <= 0 || before.crew <= 0) return after;
  const share = (n: number) => Math.min(n, Math.round((n * lost) / before.crew));
  let pressed = after.pressed - share(before.pressed);
  let soldiers = after.soldiers - share(before.soldiers);
  let jailed = after.jailed - share(before.jailed);
  // Never more of them than there are hands.
  while (pressed + soldiers + jailed > after.crew) {
    if (pressed > 0) pressed--;
    else if (soldiers > 0) soldiers--;
    else jailed--;
  }
  return { ...after, pressed: Math.max(0, pressed), soldiers: Math.max(0, soldiers), jailed: Math.max(0, jailed) };
}

/** The strangers aboard, in a phrase: "4 pressed, 5 soldiers". */
export function strangers(s: WorldState): string {
  return [s.pressed && `${s.pressed} pressed`, s.soldiers && `${s.soldiers} ${s.soldiers === 1 ? 'soldier' : 'soldiers'}`, s.jailed && `${s.jailed} from the jails`].filter(Boolean).join(', ');
}
