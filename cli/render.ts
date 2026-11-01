/** Plain-text rendering, shared by the harnesses. */

import type { Card } from '../src/cards.ts';
import { describeEvent } from '../src/describe.ts';
import type { EncounterState, GameEvent } from '../src/rules.ts';

const bar = (n: number, max: number) => '█'.repeat(Math.max(0, n)) + '·'.repeat(Math.max(0, max - n));

export function cardLine(c: Card): string {
  const who = c.side === 'ship' ? 'yours ' : 'theirs';
  return `${who}  ${c.name.padEnd(18)} ${c.text}`;
}

export function status(s: EncounterState): string {
  const ship = s.ship;
  const t = s.target;
  return [
    `round ${s.round}   deck ${s.deck.length}`,
    `you       hull ${bar(ship.hull, ship.maxHull)} ${ship.hull}/${ship.maxHull}${ship.brace ? `  brace ${ship.brace}` : ''}   plunder ${s.plunder}`,
    `${t.name.padEnd(9)} hull ${bar(t.hull, t.maxHull)} ${t.hull}/${t.maxHull}   cargo ${t.cargo}   bounty ${t.bounty}`,
  ].join('\n');
}

export function eventLines(events: GameEvent[]): string[] {
  const out: string[] = [];
  for (const e of events) {
    const line = describeEvent(e);
    if (line === null) continue;
    if (e.type === 'played') out.push(`  ▸ ${line}`);
    else if (e.type === 'effect') out.push(`    ${line}`);
    else if (e.type === 'rejected') out.push(`  ▾ ${line}`);
    else out.push(`\n${line}`);
  }
  return out;
}
