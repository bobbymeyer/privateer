/**
 * Whole runs, played by a captain bot, to see whether a run can be won and
 * how long it takes. The captain:
 *
 * - in port: repairs, buys a couple of rounds, hires crew and buys a
 *   bigger ship when it can spare the gold, keeping enough for repairs;
 * - at sea: chases the best rumor (treasure and merchants over warships),
 *   sailing for where the prediction says the ship is likeliest now;
 *   with no rumor worth it, sails for a port to buy some;
 * - goes to port to mend when the hull is low;
 * - fights by one-step lookahead, and runs whenever outgunned;
 * - sails home to London once it has the score.
 *
 *   npm run voyage -- [--runs 20] [--days 730]
 */

import { CREW, SHIP_CLASSES } from '../src/outfit.ts';
import { threatened } from '../src/rules.ts';
import { buyRound, ROUND_COST } from '../src/world/bar.ts';
import { sailToward } from '../src/world/course.ts';
import { type NodeId, portNamed, ports } from '../src/world/map.ts';
import { attack, fight, letPass, raid, raidable, repair, REPAIR_COST } from '../src/world/meet.ts';
import { isEnemy } from '../src/world/wars.ts';
import { buyShip, PROVISION_COST, provision, provisions, recruit, serves } from '../src/world/port.ts';
import { markerStrength, predict } from '../src/world/rumors.ts';
import { type ShipKind, wantedBy } from '../src/world/ships.ts';
import { createSea, createWorld, GOAL, HOME, knowledge, pursuitOf, type WorldState } from '../src/world/world.ts';
import { lookahead } from './bots.ts';

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return Number(i >= 0 ? process.argv[i + 1] : fallback);
};
const RUNS = arg('runs', '20');
const DAYS = arg('days', '730');

const sea = createSea();
const { map } = sea;
const london = portNamed(map, HOME);
const harbours = ports(map);

const WORTH: Record<ShipKind, number> = { 'treasure-ship': 3, merchant: 2, 'treasure-fleet': 1.5, hunter: 0, privateer: 0.5, armada: 0, monster: 0 };
const HIRE_ORDER = ['quartermaster', 'gunner', 'pilot', 'boatswain', 'marksmen', 'surgeon', 'navigator'];
const fightBot = (outgunned: boolean) => lookahead({ hull: 0.6, damage: 0.4, fled: outgunned ? 100 : 0 });

function inPort(w: WorldState): WorldState {
  if (provisions(sea, w) && w.gold >= PROVISION_COST && (w.morale <= 7 || w.hull < w.maxHull)) w = provision(sea, w);
  if (!serves(sea, w)) return w;
  if (w.hull < w.maxHull && w.gold >= REPAIR_COST) w = repair(sea, w);
  for (let i = 0; i < 2 && w.gold >= ROUND_COST + 10; i++) w = buyRound(sea, w).world;
  const reserve = 15;
  for (const cls of ['frigate', 'brigantine', 'sloop']) {
    const c = SHIP_CLASSES[cls];
    if (c.hull > SHIP_CLASSES[w.outfit.ship].hull && w.gold - c.cost >= reserve && w.outfit.crew.length <= c.berths) {
      w = buyShip(sea, w, cls);
      break;
    }
  }
  for (const role of HIRE_ORDER) {
    if (w.outfit.crew.length >= SHIP_CLASSES[w.outfit.ship].berths) break;
    if (!w.outfit.crew.includes(role) && w.gold - CREW[role].cost >= reserve) w = recruit(sea, w, role);
  }
  return w;
}

/** A ship in sight you'd rather not meet: an armada, a sea monster, or a guard ship whose nation wants you. */
function danger(w: WorldState): NodeId | null {
  const d = map.distTo(w.player);
  const bad = w.ships.find(
    (s) => s.laidUp <= w.turn && d[s.node] <= w.sight + 1 && (s.kind === 'armada' || s.kind === 'monster' || (s.kind === 'hunter' && wantedBy(w.standing, s.nation))),
  );
  return bad ? bad.node : null;
}

function choose(w: WorldState): NodeId {
  const d = map.distTo(w.player);
  // Sheer off from danger in sight: the nearest friendly port farther from it than you are.
  const threat = danger(w);
  if (threat !== null) {
    const fromIt = map.distTo(threat);
    const away = harbours.filter((p) => fromIt[p] > fromIt[w.player] && serves(sea, { ...w, player: p })).sort((a, b) => d[a] - d[b]);
    if (away.length) return away[0];
  }
  if (w.gold >= GOAL) return london;
  if (w.hull < w.maxHull * 0.6) {
    const near = harbours.filter((p) => p !== w.player && serves(sea, { ...w, player: p })).sort((a, b) => d[a] - d[b]);
    return near[0];
  }
  let best: { node: NodeId; value: number } | null = null;
  for (const r of w.rumors) {
    if (!isEnemy(w.wars, r.nation)) continue; // only enemies are fair game
    const value = WORTH[r.kind] * markerStrength(r, w.turn);
    if (value <= 0.3 || (best && value <= best.value)) continue;
    const p = predict(sea, r, w.turn, knowledge(w), w.player, pursuitOf(w));
    const node = p.indexOf(Math.max(...p));
    if (d[node] <= 25) best = { node, value };
  }
  if (best) return best.node;
  // Nothing worth chasing: an enemy town worth raiding, if the hull's sound.
  if (w.hull >= w.maxHull * 0.9) {
    const big = SHIP_CLASSES[w.outfit.ship].hull >= 14;
    const towns = harbours
      .filter((p) => isEnemy(w.wars, map.nodes[p].port!.nation) && (big || !map.nodes[p].port!.fort) && (w.sacked[p] ?? -1) < w.turn && d[p] <= 30)
      .sort((a, b) => d[a] - d[b]);
    if (towns.length) return towns[0];
  }
  // Else a port within a fortnight, for the bar.
  const near = harbours.filter((p) => p !== w.player && d[p] <= 14 && serves(sea, { ...w, player: p }));
  return near.length ? near[(w.turn * 7) % near.length] : london;
}

/** Fight the encounter at hand to its end, keeping the tallies. */
let fights = 0;
function fightItOut(w: WorldState): WorldState {
  if (!w.encounter) return w;
  const enteredWith = `${w.hull}/${w.maxHull}`;
  fights++;
  met[w.encounter.kind] = (met[w.encounter.kind] ?? 0) + 1;
  while (w.encounter) {
    const f = w.encounter.fight;
    w = fight(sea, w, fightBot(threatened(f.ship, f.target))(f));
  }
  const r = w.reckoning!;
  ends[r.outcome] = (ends[r.outcome] ?? 0) + 1;
  if (w.sunk) {
    killedBy[r.kind] = (killedBy[r.kind] ?? 0) + 1;
    hullIn[r.kind] = [...(hullIn[r.kind] ?? []), enteredWith];
  }
  return w;
}

const results: { won: boolean; sunk: boolean; day: number; gold: number; fights: number; ship: string }[] = [];
const met: Record<string, number> = {};
const ends: Record<string, number> = {};
const killedBy: Record<string, number> = {};
let passed = 0;
let raids = 0;
let mutinies = 0;
let storms = 0;
let omens = 0;
const hullIn: Record<string, string[]> = {};
for (let seed = 0; seed < RUNS; seed++) {
  let w = createWorld(sea, seed);
  let dest: NodeId | null = null;
  fights = 0;
  let since = 0;
  while (w.turn < DAYS && !w.sunk && !w.won) {
    if (map.nodes[w.player].port) {
      // An enemy port, on a sound hull: raid it. A fortified one only in a ship that can take it.
      const port = map.nodes[w.player].port!;
      const able = !port.fort || SHIP_CLASSES[w.outfit.ship].hull >= 14;
      if (isEnemy(w.wars, port.nation) && raidable(sea, w) && able && w.hull >= w.maxHull * 0.9 && w.gold < GOAL) {
        w = fightItOut(raid(sea, w));
        raids++;
      } else w = inPort(w);
      if (w.sunk) break;
    }
    if (dest === null || since > 10 || w.player === dest || danger(w) !== null) ((dest = choose(w)), (since = 0));
    if (dest === w.player) dest = harbours[(seed + w.turn) % harbours.length];
    const out = sailToward(sea, w, dest);
    w = out.world;
    since++;
    if (out.halt === 'stuck') dest = null;
    // A ship alongside: foreign prizes worth the risk, on a sound hull; never your own flag.
    if (w.hail) {
      const h = w.hail;
      const worth = (h.kind === 'merchant' || h.kind === 'treasure-ship') && isEnemy(w.wars, h.nation);
      w = worth && w.hull >= w.maxHull * 0.6 ? attack(w) : letPass(w);
      if (!w.encounter) passed++;
    }
    if (w.encounter) {
      w = fightItOut(w);
      dest = null;
    }
  }
  mutinies += w.log.filter((l) => l.text.startsWith('mutiny')).length;
  storms += w.log.filter((l) => l.text.startsWith('a storm')).length;
  omens += w.log.filter((l) => l.text.startsWith('a good omen')).length;
  results.push({ won: w.won, sunk: w.sunk, day: w.turn, gold: w.gold, fights, ship: w.outfit.ship });
}

const n = results.length;
const won = results.filter((r) => r.won);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
console.log(`${n} runs of up to ${DAYS} days, goal ${GOAL} home to ${HOME}\n`);
console.log(`won    ${won.length} (${Math.round((100 * won.length) / n)}%), on day ${Math.round(mean(won.map((r) => r.day)))} on average`);
console.log(`sunk   ${results.filter((r) => r.sunk).length}, on day ${Math.round(mean(results.filter((r) => r.sunk).map((r) => r.day)))} on average`);
console.log(`adrift ${results.filter((r) => !r.won && !r.sunk).length} (out of time), with ${Math.round(mean(results.filter((r) => !r.won && !r.sunk).map((r) => r.gold)))} gold`);
console.log(`fights ${mean(results.map((r) => r.fights)).toFixed(1)} a run · met`, met, '· ended', ends);
console.log('ships at the end', results.reduce((t, r) => ((t[r.ship] = (t[r.ship] ?? 0) + 1), t), {} as Record<string, number>));
console.log('sunk by', killedBy, '· hull going in', hullIn);
console.log(`let pass ${(passed / RUNS).toFixed(1)} a run`);
console.log(`raids ${(raids / RUNS).toFixed(1)} a run`);
console.log(`mutinies ${(mutinies / RUNS).toFixed(1)}, storms ${(storms / RUNS).toFixed(1)}, omens ${(omens / RUNS).toFixed(1)} a run`);
