/**
 * Under false colours: at a Spanish or Portuguese place you haven't raided,
 * come in as a merchant to water and buy, as Petit's party travelled "in
 * merchants' disguise" through hostile country (Takeda, pp. 142, 154). A
 * day's work, and a chance of being found out — likelier with a name for
 * piracy, or once the coast has heard of you. Found out, the port is shut
 * to you, and either a patrol comes out or Spain has one more complaint.
 *
 * And Persian silk: four parts in five of Europe's raw silk came out of
 * Persia (Takeda, p. 146), and the Portuguese carried it from Hormuz to Goa
 * and home. Only a Goa carrack or Goa itself has it; light, and dear.
 */

import { landmark } from './landmarks.ts';
import { type Roller, roll } from './random.ts';
import type { Sea, WorldState } from './world.ts';
import { patrol } from './meet.ts';
import { holdRoom, landmarkHere } from './stores.ts';

/** Where you might pass for a merchant: Spanish and Portuguese places on the way, and the River May. */
export const DISGUISE_AT = ['canaries', 'cape-verde', 'brazil', 'brazil-home', 'valparaiso', 'callao', 'guatulco', 'manila', 'river-may'];
/** Found out: the base chance, more for each point of a name for piracy, more once the coast has heard of you. */
export const FOUND_OUT = 0.2;
export const FOUND_PER_INFAMY = 0.08;
export const FOUND_KNOWN = 0.15;
/** Found out, what Spain's ambassador adds to the account, if no patrol comes. */
export const FOUND_GRIEVANCE = 10;

/** Whether you could try it here. */
export function disguiseHere(sea: Sea, s: WorldState): boolean {
  const at = s.voyage.at;
  return !!landmarkHere(sea, s) && DISGUISE_AT.includes(at) && !s.raided.includes(at) && !s.seen.includes(`shut:${at}`) && !s.seen.includes(`disguised:${at}`);
}

/** The chance of being found out, as things stand. */
export const foundOut = (s: WorldState) => Math.min(0.9, FOUND_OUT + FOUND_PER_INFAMY * s.infamy + (s.seen.includes('coast-alarm') || s.grievance > 0 ? FOUND_KNOWN : 0));

/** Go in under false colours: a day, and the chandler deals with you, or the port is shut and worse. */
export function disguise(sea: Sea, s: WorldState, advance: (sea: Sea, s: WorldState, to: number) => WorldState): WorldState {
  if (!disguiseHere(sea, s)) throw new Error('there is no passing for a merchant here');
  const r: Roller = { rng: s.rng };
  const at = s.voyage.at;
  const name = landmark(at).name;
  const caught = roll(r) < foundOut(s);
  let w: WorldState = { ...s, rng: r.rng };
  if (!caught) {
    w = { ...w, seen: [...w.seen, `disguised:${at}`], log: [...w.log, { turn: w.turn, text: `in at ${name} under false colours, and they take you for a merchant: the chandler will deal with you` }] };
    return advance(sea, w, w.player);
  }
  w = { ...w, seen: [...w.seen, `shut:${at}`] };
  if (roll(r) < 0.5) return patrol({ ...w, rng: r.rng, log: [...w.log, { turn: w.turn, text: `found out at ${name}: an officer knew the ship for English`, stop: true }] });
  return { ...w, rng: r.rng, grievance: w.grievance + FOUND_GRIEVANCE, log: [...w.log, { turn: w.turn, text: `found out at ${name}, and the port shut to you: one more thing for Spain to complain of`, stop: true }] };
}

// --- Persian silk ----------------------------------------------------------------

/** What a ton of raw silk fetches in London: far above spice. */
export const SILK_WORTH = 45;
/** Tons in a Goa carrack's hold, or the Viceroy's warehouses: as many as there's room for, of these. */
export const SILK_TONS = [2, 4] as const;
/** Room for silk, beside the spice and the brazilwood. */
export const silkRoom = (s: WorldState) => Math.max(0, holdRoom(s) - s.spice - s.wood - s.silk);

/** Silk out of her hold, or the warehouses, as far as there's room. */
export function takeSilk(s: WorldState, r: Roller): WorldState {
  const got = Math.min(silkRoom(s), SILK_TONS[0] + Math.floor(roll(r) * (SILK_TONS[1] - SILK_TONS[0] + 1)));
  if (got <= 0) return { ...s, log: [...s.log, { turn: s.turn, text: 'bales of Persian silk, and no room in the hold for them' }] };
  return { ...s, silk: s.silk + got, log: [...s.log, { turn: s.turn, text: `${got} tons of Persian silk out of her, light and dear` }] };
}
