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

import { CREW, SHIP_CLASSES, deckSize } from '../src/outfit.ts';
import { threatened } from '../src/rules.ts';
import { buyRound, ROUND_COST } from '../src/world/bar.ts';
import { sailToward } from '../src/world/course.ts';
import { type NodeId, portNamed, ports } from '../src/world/map.ts';
import { attack, fight, letPass, onGuard, raid, raidable, repair, REPAIR_COST } from '../src/world/meet.ts';
import { isEnemy } from '../src/world/wars.ts';
import { choices, choose as decide } from '../src/world/dilemmas.ts';
import { inRegion, reprisal } from '../src/world/letters.ts';
import { buyShip, isHaven, leavePrize, retire, PROVISION_COST, provision, provisions, recruit, serves, takePrize } from '../src/world/port.ts';
import { markerStrength, predict } from '../src/world/rumors.ts';
import { type ShipKind, wantedBy } from '../src/world/ships.ts';
import { advance, createSea, createWorld, GOAL, homeward, HOME, knowledge, pursuitOf, type WorldState } from '../src/world/world.ts';
import { lookahead } from './bots.ts';

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return Number(i >= 0 ? process.argv[i + 1] : fallback);
};
const RUNS = arg('runs', '20');
const DAYS = arg('days', '730');
const FROM = arg('from', '0');

const sea = createSea();
const { map } = sea;
const london = portNamed(map, HOME);
const harbours = ports(map);

const WORTH: Record<ShipKind, number> = { 'treasure-ship': 3, merchant: 2, 'treasure-fleet': 1.5, hunter: 0, privateer: 0.5, corsair: 1, armada: 0, monster: 0 };
const HIRE_ORDER = ['quartermaster', 'gunner', 'pilot', 'boatswain', 'marksmen', 'surgeon', 'navigator'];
const fightBot = (outgunned: boolean) => lookahead({ hull: 0.6, damage: 0.4, fled: outgunned ? 100 : 0 });

function inPort(w: WorldState): WorldState {
  if (isHaven(sea, w) && w.gold >= GOAL) return retire(sea, w);
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
  if (homeward(w)) return london;
  if (w.pirate && w.gold >= GOAL) return portNamed(map, 'Port Royal');
  if (w.hull < w.maxHull * 0.6) {
    const near = harbours.filter((p) => p !== w.player && serves(sea, { ...w, player: p })).sort((a, b) => d[a] - d[b]);
    return near[0];
  }
  // The letter first.
  const l = w.letter;
  if (l) {
    if (l.task.kind === 'take') {
      // The plate ship: where the freshest word of her says she is now; a big enough ship first.
      const word = w.rumors.filter((r) => r.shipId === (l.task as { shipId: number }).shipId).at(-1);
      if (word && SHIP_CLASSES[w.outfit.ship].hull >= 12) {
        // Intercept: where she's likeliest to be in k days, that we can reach in k days.
        let best = { node: w.player, p: -1 };
        for (let k = 0; k <= 30; k += 3) {
          const p = predict(sea, word, w.turn + k, knowledge(w), w.player, pursuitOf(w, sea));
          for (let n = 0; n < p.length; n++) if (p[n] > best.p && d[n] <= k && !map.nodes[n].port) best = { node: n, p: p[n] };
        }
        if (best.p > 0) return best.node;
      }
    } else if (l.task.kind === 'sack') {
      const towns = harbours.filter((p) => inRegion(sea, l.region!, p) && map.nodes[p].port!.nation === l.nation && !map.nodes[p].port!.fort && (w.sacked[p] ?? -1) < w.turn && !onGuard(w, p));
      if (towns.length && w.hull >= w.maxHull * 0.9) return towns.sort((a, b) => d[a] - d[b])[0];
    } else if (!inRegion(sea, l.region!, w.player)) {
      // Into the region: its nearest port that will deal with you, else its nearest water.
      const inside = harbours.filter((p) => inRegion(sea, l.region!, p) && serves(sea, { ...w, player: p }));
      return (inside.length ? inside : map.nodes.filter((n) => n.kind === 'ocean' && map.adj[n.id].length && inRegion(sea, l.region!, n.id)).map((n) => n.id)).sort((a, b) => d[a] - d[b])[0];
    }
  }
  if (w.hull < w.maxHull * 0.6) {
    const near = harbours.filter((p) => p !== w.player && serves(sea, { ...w, player: p })).sort((a, b) => d[a] - d[b]);
    return near[0];
  }
  let best: { node: NodeId; value: number } | null = null;
  for (const r of w.rumors) {
    if (!isEnemy(w.wars, r.nation) && !reprisal(w, r.nation)) continue; // only enemies are fair game
    const value = WORTH[r.kind] * markerStrength(r, w.turn);
    if (value <= 0.3 || (best && value <= best.value)) continue;
    const p = predict(sea, r, w.turn, knowledge(w), w.player, pursuitOf(w, sea));
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

/** The bot's answer to an event that asks: ride out a storm on a sound hull, pay shares it can spare, take any castaway. */
function answer(w: WorldState): WorldState {
  while (w.dilemma) {
    const open = choices(w, w.dilemma).filter((c) => !c.barred).map((c) => c.key);
    const want =
      w.dilemma.kind === 'storm'
        ? w.hull > 3 ? 'ride' : open.includes('lighten') ? 'lighten' : 'run'
        : w.dilemma.kind === 'shares'
          ? open.includes('pay') && w.gold >= w.dilemma.cost + 20 ? 'pay' : 'promise'
          : open.includes('take') ? 'take' : 'leave';
    w = decide(sea, w, want);
  }
  return w;
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
  // Her stores: the bot keeps the first offer while its deck is small, and leaves them after.
  if (w.spoil) w = deckSize(w.outfit) < 20 ? takePrize(w, w.spoil.offers[0]) : leavePrize(w);
  const r = w.reckoning!;
  ends[r.outcome] = (ends[r.outcome] ?? 0) + 1;
  if (w.sunk) {
    killedBy[r.kind] = (killedBy[r.kind] ?? 0) + 1;
    hullIn[r.kind] = [...(hullIn[r.kind] ?? []), enteredWith];
  }
  return w;
}

const results: { won: boolean; sunk: boolean; day: number; gold: number; fights: number; ship: string; acts: number; ending: string }[] = [];
const met: Record<string, number> = {};
const ends: Record<string, number> = {};
const killedBy: Record<string, number> = {};
let passed = 0;
let raids = 0;
let mutinies = 0;
let storms = 0;
let omens = 0;
const hullIn: Record<string, string[]> = {};
for (let seed = FROM; seed < FROM + RUNS; seed++) {
  let w = createWorld(sea, seed);
  let dest: NodeId | null = null;
  fights = 0;
  let since = 0;
  while (w.turn < DAYS && !w.sunk && !w.won) {
    if (map.nodes[w.player].port) {
      // An enemy port, on a sound hull: raid it. A fortified one only in a ship that can take it.
      const port = map.nodes[w.player].port!;
      const able = !port.fort || SHIP_CLASSES[w.outfit.ship].hull >= 14;
      const lettered = w.letter?.task.kind === 'sack' && w.letter.nation === port.nation && inRegion(sea, w.letter.region!, w.player);
      if ((isEnemy(w.wars, port.nation) || lettered) && raidable(sea, w) && able && w.hull >= w.maxHull * 0.9 && !homeward(w)) {
        w = fightItOut(raid(sea, w));
        raids++;
      } else w = inPort(w);
      if (w.sunk || w.won) break;
    }
    if (dest === null || since > 10 || w.player === dest || danger(w) !== null) ((dest = choose(w)), (since = 0));
    if (dest === w.player) dest = harbours[(seed + w.turn) % harbours.length];
    const out = sailToward(sea, w, dest);
    // Going nowhere — there already, or no way there — the day still passes, lying where she is.
    w = answer(out.world.turn === w.turn ? advance(sea, answer(out.world), out.world.player) : out.world);
    since++;
    if (out.halt === 'stuck') dest = null;
    // A ship alongside: foreign prizes worth the risk, on a sound hull; never your own flag.
    if (w.hail) {
      const h = w.hail;
      const plate = w.letter?.task.kind === 'take' && w.letter.task.shipId === h.shipId;
      const worth = plate || ((h.kind === 'merchant' || h.kind === 'treasure-ship') && (isEnemy(w.wars, h.nation) || reprisal(w, h.nation)));
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
  results.push({ won: w.won, sunk: w.sunk, day: w.turn, gold: w.gold, fights, ship: w.outfit.ship, acts: w.acts, ending: w.ending ?? (w.commission === 'revoked' ? 'revoked' : '') });
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
console.log('letters done', results.reduce((t, r) => ((t[r.acts] = (t[r.acts] ?? 0) + 1), t), {} as Record<number, number>), '· endings', results.reduce((t, r) => ((t[r.ending || 'none'] = (t[r.ending || 'none'] ?? 0) + 1), t), {} as Record<string, number>));
console.log(`gold at a win ${Math.round(mean(won.map((r) => r.gold)))}`);
