/**
 * Monkeys and parrots: the fashionable pets of London, where "monkeys,
 * along with parrots and lapdogs, were in vogue as expensive household
 * pets" (Levin & Auble, p. 173). Bought for a little, or a chest of truck,
 * on the coast of Brazil and at Sierra Leone; kept in a corner of the hold;
 * and sold in London for a good deal more, if they live. Most don't: the
 * cold of the high latitudes kills them, the monkeys first.
 */

import { landmarkHere } from './stores.ts';
import { hostileTo, peopleHere } from './peoples.ts';
import { type Roller, roll } from './random.ts';
import type { Sea, WorldState } from './world.ts';

export type Pet = 'monkey' | 'parrot';

/** What one costs on the coast, and fetches in London. */
export const PET_COST: Record<Pet, number> = { monkey: 3, parrot: 2 };
export const PET_WORTH: Record<Pet, number> = { monkey: 15, parrot: 10 };
/** Room for so many, all told: a corner of the hold, a cage or two. */
export const PET_ROOM = 6;

/** Each day at sea, each one dies this often: hardly in the tropics, often in the cold, a monkey oftener than a parrot. */
export function petDeathChance(pet: Pet, lat: number): number {
  const a = Math.abs(lat);
  if (a < 23.5) return 1 / 200;
  if (a < 40) return 1 / 90;
  return pet === 'monkey' ? 1 / 18 : 1 / 30;
}

export const petsAboard = (s: WorldState) => s.monkeys + s.parrots;
/** Pets for sale where you're lying: a coast that offers them, and a people who'll trade. */
export const petsHere = (sea: Sea, s: WorldState) => !!landmarkHere(sea, s)?.offers.pets && !hostileTo(s, peopleHere(s));

const count = (pet: Pet) => (pet === 'monkey' ? 'monkeys' : 'parrots') as 'monkeys' | 'parrots';

/** Buy one, for gold or a chest of truck. */
export function buyPet(sea: Sea, s: WorldState, pet: Pet, pay: 'gold' | 'truck' = 'gold'): WorldState {
  if (!landmarkHere(sea, s)?.offers.pets) throw new Error('there are no monkeys or parrots to be had here');
  if (hostileTo(s, peopleHere(s))) throw new Error('they won’t trade with you');
  if (petsAboard(s) >= PET_ROOM) throw new Error('no room for more');
  if (pay === 'truck') {
    if (s.truck <= 0) throw new Error('no truck to trade');
    return { ...s, truck: s.truck - 1, [count(pet)]: s[count(pet)] + 1 };
  }
  if (s.gold < PET_COST[pet]) throw new Error('not enough in the purse');
  return { ...s, gold: s.gold - PET_COST[pet], [count(pet)]: s[count(pet)] + 1 };
}

/** A day at sea for the pets: some die, and a line when the last of a kind goes. */
export function petsDay(sea: Sea, s: WorldState, r: Roller): WorldState {
  if (!petsAboard(s)) return s;
  const lat = sea.map.nodes[s.player].lat;
  let w = s;
  for (const pet of ['monkey', 'parrot'] as Pet[]) {
    const n = w[count(pet)];
    if (!n) continue;
    let dead = 0;
    for (let i = 0; i < n; i++) if (roll(r) < petDeathChance(pet, lat)) dead++;
    if (!dead) continue;
    w = { ...w, [count(pet)]: n - dead };
    if (n - dead === 0) {
      const text = pet === 'monkey' ? (Math.abs(lat) >= 40 ? 'the last of the monkeys dead of the cold' : 'the last of the monkeys dead') : 'the last of the parrots dead, and the ship quieter for it';
      w = { ...w, log: [...w.log, { turn: w.turn, text }] };
    }
  }
  return w;
}

/** What the pets fetch in London. */
export const petsWorth = (s: WorldState) => s.monkeys * PET_WORTH.monkey + s.parrots * PET_WORTH.parrot;
