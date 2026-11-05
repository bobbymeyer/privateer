/**
 * Continuing on: the ship sails the lanes toward the landmark she's bound
 * for, a day at a time, until something happens. Where the way doesn't
 * divide she's bound for the next landmark without asking; at a fork, you
 * choose (journey.ts).
 */

import { FAR, type NodeId } from './map.ts';
import { makeFor, onward, raise } from './journey.ts';
import { followed } from './rumors.ts';
import { noWay } from './weather.ts';
import { type Sea, type WorldState, advance } from './world.ts';

/** Tomorrow's step toward `dest`: a neighbour a day nearer, or null if you're there or can't get there. */
export function nextStep(sea: Sea, s: WorldState, dest: NodeId): NodeId | null {
  const d = sea.map.distTo(dest);
  if (s.player === dest || d[s.player] >= FAR) return null;
  return sea.map.adj[s.player].find((m) => d[m] === d[s.player] - 1) ?? null;
}

/** The whole way from here to `dest`, for drawing. */
export function plotCourse(sea: Sea, s: WorldState, dest: NodeId): NodeId[] {
  const course = [s.player];
  let at: WorldState = s;
  for (let step = nextStep(sea, at, dest); step !== null; step = nextStep(sea, at, dest)) {
    course.push(step);
    at = { ...at, player: step };
  }
  return course;
}

/**
 * Why a day stopped the ship: a landmark raised, an event to answer, a sail
 * sighted, a fight, the end of the run, or a line in the log worth stopping
 * for. Null: sail on.
 */
export type Halt = 'landmark' | 'choice' | 'sail' | 'fight' | 'won' | 'sunk' | 'news';

/** Bound somewhere: the landmark you chose, or the next where the way doesn't divide. Throws at a fork. */
export function bound(s: WorldState): WorldState {
  if (s.voyage.bound) return s;
  const next = onward(s.voyage, followed(s));
  if (!next) throw new Error('the way divides here: choose which way');
  return makeFor(s, next);
}

const stopped = (w: WorldState) => w.won || w.sunk || !!w.encounter || !!w.hail || !!w.dilemma;

/** A step more, made in the same day: a landmark raised if she reaches one. */
function glide(sea: Sea, s: WorldState, dest: NodeId): WorldState {
  const step = nextStep(sea, s, dest);
  return step === null ? s : raise(sea, { ...s, player: step });
}

/** A day on toward the landmark you're bound for; says why to stop, if you should. */
export function continueOn(sea: Sea, s: WorldState): { world: WorldState; halt: Halt | null } {
  const from = bound(s);
  const dest = sea.map.landmarks[from.voyage.bound!];
  const step = nextStep(sea, from, dest);
  if (step === null) throw new Error('no way there');
  // Becalmed, or anchored against the williwaws, she makes no way at all;
  // at an easy pace, one day in three she lies to under short sail.
  let world = advance(sea, from, noWay(from) || (from.pace === 'easy' && from.turn % 3 === 2) ? from.player : step);
  // Cracking on: one day in three, she makes two days' way.
  if (from.pace === 'hard' && from.turn % 3 === 2 && !noWay(from) && !stopped(world) && world.voyage.at === from.voyage.at) world = glide(sea, world, dest);
  if (world.won) return { world, halt: 'won' };
  if (world.sunk) return { world, halt: 'sunk' };
  if (world.encounter) return { world, halt: 'fight' };
  if (world.hail) return { world, halt: 'sail' };
  if (world.dilemma) return { world, halt: 'choice' };
  if (world.voyage.at !== from.voyage.at) return { world, halt: 'landmark' };
  if (world.log.slice(s.log.length).some((l) => l.stop)) return { world, halt: 'news' };
  return { world, halt: null };
}
