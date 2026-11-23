/**
 * What the last English ship left behind on each coast, kept in the browser
 * across runs like the graves: a people left hostile are hostile to the next
 * voyage, a people left friendly friendlier. See world/peoples.ts. Nothing
 * leaves the browser.
 */

import { type Memory, PEOPLE_KEYS } from './world/peoples.ts';

export const PEOPLES_KEY = 'privateer:peoples';

/** Browser storage can refuse or be missing: a people's memory is a keepsake, never a reason to fail. */
export function loadPeoples(): Memory {
  try {
    const raw = JSON.parse(localStorage.getItem(PEOPLES_KEY) ?? '{}');
    if (!raw || typeof raw !== 'object') return {};
    // Only the peoples we know, and only the two words.
    return Object.fromEntries(PEOPLE_KEYS.filter((p) => raw[p] === 'hostile' || raw[p] === 'friendly').map((p) => [p, raw[p]]));
  } catch {
    return {};
  }
}

export function savePeoples(memory: Memory): void {
  try {
    localStorage.setItem(PEOPLES_KEY, JSON.stringify(memory));
  } catch {
    // They remember all the same; only it isn't written down.
  }
}
