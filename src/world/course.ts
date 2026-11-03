/**
 * Setting a course: pick a destination and the ship sails for it a day at a
 * time, until it arrives or something happens. Each day's step is the one
 * that brings it nearest, and where steps tie, the one that runs best with
 * the current and wind you've charted.
 */

import { FAR, type NodeId } from './map.ts';
import { legWeight } from './sea.ts';
import type { Sea } from './ships.ts';
import { inSight } from './scout.ts';
import { type WorldState, advance, knowledge } from './world.ts';

/** Tomorrow's step toward `dest`, or null if you're there or can't get there. */
export function nextStep(sea: Sea, s: WorldState, dest: NodeId): NodeId | null {
  const d = sea.map.distTo(dest);
  if (s.player === dest || d[s.player] >= FAR) return null;
  const know = knowledge(s);
  let best: NodeId | null = null;
  let bestW = -1;
  for (const m of sea.map.adj[s.player]) {
    if (d[m] !== d[s.player] - 1) continue;
    const w = legWeight(sea.map, sea.pattern, s.player, m, s.turn, know);
    if (w > bestW) [best, bestW] = [m, w];
  }
  return best;
}

/** The whole course from here, for drawing, as things stand today. */
export function plotCourse(sea: Sea, s: WorldState, dest: NodeId): NodeId[] {
  const course = [s.player];
  let at: WorldState = s;
  for (let step = nextStep(sea, at, dest); step !== null; step = nextStep(sea, at, dest)) {
    course.push(step);
    at = { ...at, player: step };
  }
  return course;
}

/** Why a day's sailing stopped short of the destination. `news`: something in the log worth heaving to for. */
export type Halt = 'arrived' | 'encounter' | 'hail' | 'sunk' | 'won' | 'sighted' | 'stuck' | 'news' | 'sail' | 'choice';

/** One day toward `dest`; says why to stop, if you should. */
export function sailToward(sea: Sea, s: WorldState, dest: NodeId): { world: WorldState; halt: Halt | null } {
  const step = nextStep(sea, s, dest);
  if (step === null) return { world: s, halt: s.player === dest ? 'arrived' : 'stuck' };
  const world = advance(sea, s, step);
  if (world.won) return { world, halt: 'won' };
  if (world.encounter) return { world, halt: 'encounter' };
  if (world.hail) return { world, halt: 'hail' };
  if (world.dilemma) return { world, halt: 'choice' };
  if (world.islands.filter((i) => i.found).length > s.islands.filter((i) => i.found).length) return { world, halt: 'sighted' };
  if (world.player !== dest && world.log.slice(s.log.length).some((l) => l.stop)) return { world, halt: 'news' };
  // A hostile sail newly in sight: heave to while there's time to choose.
  const before = new Set(inSight(sea, s).filter((x) => x.hostile).map((x) => x.ship.id));
  if (inSight(sea, world).some((x) => x.hostile && !before.has(x.ship.id))) return { world, halt: 'sail' };
  return { world, halt: world.player === dest ? 'arrived' : null };
}
