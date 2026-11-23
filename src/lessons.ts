/**
 * The fight, taught as it goes: the first fight a player ever has, and the
 * practice fight at the Canaries, show a hint at a time — the range, her
 * card face up, keeping two of three, the chain, what it costs. Each hint
 * goes once it's read, and the browser remembers which have been read, so
 * a player who has learned the fight isn't taught it again. Nothing leaves
 * the browser.
 */

import type { EncounterState } from './rules.ts';

export const TAUGHT_KEY = 'privateer:taught';

export type Lesson = 'range' | 'intent' | 'keep' | 'chain' | 'cost';

export interface Teaching {
  key: Lesson;
  title: string;
  text: string;
  /** Whether the fight has come far enough for this one to make sense. */
  ready: (f: EncounterState) => boolean;
}

export const LESSONS: Teaching[] = [
  {
    key: 'range',
    title: 'the range',
    text: 'far, close or grappled: the bar above shows where the ships lie. each card works only at some ranges — long guns far, a broadside close, boarders grappled — and one that won’t is marked out of range now. sail cards close the range, or open it.',
    ready: () => true,
  },
  {
    key: 'intent',
    title: 'her next card',
    text: 'her card is face up beside your hand: she plays it after yours. plan against it — close before she runs, bear away from a broadside.',
    ready: (f) => !!f.intent,
  },
  {
    key: 'keep',
    title: 'two of three',
    text: 'pick two cards in the order you want them played, then resolve. the third goes under your deck, and comes round again.',
    ready: () => true,
  },
  {
    key: 'chain',
    title: 'the chain',
    text: 'sail, then shot, then board: each card that follows the one before in that order hits harder, +1 and then +2. the mark on a card says what it would gain picked next; anything out of order starts the chain again.',
    ready: (f) => f.round >= 2,
  },
  {
    key: 'cost',
    title: 'what it costs',
    text: 'a barrel of powder for every three shots, and hands for every point of hull you lose. beat her down and she strikes; three stretches of open water and a ship is away, hers or yours.',
    ready: (f) => f.round >= 3 || !!f.outcome,
  },
];

/** The next hint to show in this fight: the first not yet read whose moment has come. */
export function nextLesson(f: EncounterState, read: readonly Lesson[]): Teaching | null {
  return LESSONS.find((l) => !read.includes(l.key) && l.ready(f)) ?? null;
}

/** Whether every hint has been read: then a real fight teaches nothing more. */
export const allTaught = (read: readonly Lesson[]) => LESSONS.every((l) => read.includes(l.key));

/** Read hints with one more. */
export const withLesson = (read: readonly Lesson[], key: Lesson): Lesson[] => (read.includes(key) ? [...read] : [...read, key]);
/** Every hint, as if read: "no more hints". */
export const everyLesson = (): Lesson[] => LESSONS.map((l) => l.key);

type Store = Pick<Storage, 'getItem' | 'setItem'>;
const browser = (): Store | null => (typeof localStorage === 'undefined' ? null : localStorage);

/** The hints read before, from the browser; none if it can't say. */
export function loadTaught(store: Store | null = browser()): Lesson[] {
  try {
    const raw = JSON.parse(store?.getItem(TAUGHT_KEY) ?? '[]');
    const keys = LESSONS.map((l) => l.key) as string[];
    return Array.isArray(raw) ? (raw.filter((k) => keys.includes(k)) as Lesson[]) : [];
  } catch {
    return [];
  }
}

/** Remember the hints read. The browser may refuse: then they're taught again next time, which is no harm. */
export function saveTaught(read: readonly Lesson[], store: Store | null = browser()): void {
  try {
    store?.setItem(TAUGHT_KEY, JSON.stringify(read));
  } catch {
    // Taught again, then.
  }
}
