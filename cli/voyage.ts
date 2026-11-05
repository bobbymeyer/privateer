/**
 * Whole runs, played by a captain bot, to see whether a run can be won and
 * how long it takes. The captain:
 *
 * - in port: repairs, provisions, buys a couple of rounds, hires crew and
 *   buys a bigger ship when it can spare the gold;
 * - at sea: sails the voyage, a fork at random, turning aside for a prize
 *   close by; waters, forages and careens where there's a shore, and
 *   rations by the leg ahead;
 * - goes to a friendly yard near by when the hull is low, else careens at
 *   the next shore;
 * - fights by one-step lookahead, and runs whenever outgunned;
 * - comes home to Plymouth at the end of the way.
 *
 *   npm run voyage -- [--runs 20] [--days 730] [--from 0]
 *     --straight  keep to the voyage: no turning aside for prizes, no raids off it
 *     --trace     each run's landmarks, deaths and fights, from the log
 *     --where     where the ship is and what it's steering for, every five days
 */

import { CREW, SHIP_CLASSES, deckSize } from '../src/outfit.ts';
import { threatened } from '../src/rules.ts';
import { buyRound, ROUND_COST } from '../src/world/bar.ts';
import { sailToward } from '../src/world/course.ts';
import { type NodeId, portNamed, ports } from '../src/world/map.ts';
import { attack, fight, letPass, raid, raidable, repair, REPAIR_COST } from '../src/world/meet.ts';
import { isEnemy } from '../src/world/wars.ts';
import { choices, choose as decide } from '../src/world/dilemmas.ts';
import { choices as choicesOf, daysTo, howHome, makeFor } from '../src/world/journey.ts';
import { landmark as landmarkOf } from '../src/world/landmarks.ts';
import { buyShip, isHaven, leavePrize, retire, PROVISION_COST, provision, provisions, recruit, serves, takePrize } from '../src/world/port.ts';
import { markerStrength, predict } from '../src/world/rumors.ts';
import { type ShipKind, wantedBy } from '../src/world/ships.ts';
import { advance, createSea, createWorld, GOAL, knowledge, pursuitOf, type WorldState } from '../src/world/world.ts';
import { lookahead } from './bots.ts';
import { score } from '../src/world/score.ts';
import { ashore, buy, daysOf, price, room, shore, type Ware } from '../src/world/stores.ts';

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return Number(i >= 0 ? process.argv[i + 1] : fallback);
};
const RUNS = arg('runs', '20');
const DAYS = arg('days', '730');
const FROM = arg('from', '0');
/** Keep to the voyage: no turning aside for prizes. */
const STRAIGHT = process.argv.includes('--straight');

const sea = createSea();
const { map } = sea;
const plymouth = portNamed(map, 'Plymouth');
const harbours = ports(map);

const WORTH: Record<ShipKind, number> = { 'treasure-ship': 3, merchant: 2, 'treasure-fleet': 1.5, hunter: 0, privateer: 0.5, corsair: 1, armada: 0, monster: 0 };
const HIRE_ORDER = ['quartermaster', 'gunner', 'pilot', 'boatswain', 'marksmen', 'surgeon', 'navigator'];
const fightBot = (outgunned: boolean) => lookahead({ hull: 0.6, damage: 0.4, fled: outgunned ? 100 : 0 });

function inPort(w: WorldState): WorldState {
  if (isHaven(sea, w) && w.gold >= GOAL) return retire(sea, w);
  if (provisions(sea, w) && w.gold >= PROVISION_COST && (w.morale <= 7 || w.hull < w.maxHull)) w = provision(sea, w);
  if (!serves(sea, w)) return w;
  if (w.hull < w.maxHull && w.gold >= REPAIR_COST) w = repair(sea, w);
  // The chandler first: water, food, hands, spares, powder, while there's room and money.
  for (const ware of ['water', 'food', 'hands', 'spares', 'powder'] as Ware[]) {
    const keep = ware === 'water' || ware === 'food' ? 0 : 10;
    for (let i = 0; i < 40 && room(w, ware) && w.gold - price(sea, w, ware) >= keep; i++) w = buy(sea, w, ware, true);
  }
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
  if (w.pirate && w.gold >= GOAL) return portNamed(map, 'Baltimore');
  // A foul or battered hull: a friendly yard if there's one near; else carry on and careen at the next shore.
  if (w.hull < w.maxHull * 0.6) {
    const near = harbours.filter((p) => p !== w.player && d[p] <= 12 && serves(sea, { ...w, player: p })).sort((a, b) => d[a] - d[b]);
    if (near.length) return near[0];
  }
  // The voyage: a prize close by is worth turning aside for; otherwise the next landmark.
  let prize: { node: NodeId; value: number } | null = null;
  for (const r of w.rumors) {
    if (!isEnemy(w.wars, r.nation)) continue;
    const value = WORTH[r.kind] * markerStrength(r, w.turn);
    if (value <= 0.5 || (prize && value <= prize.value)) continue;
    const p = predict(sea, r, w.turn, knowledge(w), w.player, pursuitOf(w, sea));
    const node = p.indexOf(Math.max(...p));
    if (d[node] <= 8) prize = { node, value };
  }
  if (prize && !STRAIGHT) return prize.node;
  if (w.voyage.bound) return map.landmarks[w.voyage.bound];
  if (w.hull < w.maxHull * 0.6) {
    const near = harbours.filter((p) => p !== w.player && serves(sea, { ...w, player: p })).sort((a, b) => d[a] - d[b]);
    return near[0];
  }
  let best: { node: NodeId; value: number } | null = null;
  for (const r of w.rumors) {
    if (!isEnemy(w.wars, r.nation)) continue; // only enemies are fair game
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
  return near.length ? near[(w.turn * 7) % near.length] : plymouth;
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
          : w.dilemma.kind === 'fever'
            ? 'nurse'
            : w.dilemma.kind === 'foul'
              ? daysOf(w).water > 30 ? 'heave' : 'drink'
              : w.dilemma.kind === 'weevils'
                ? w.morale > 4 ? 'eat' : 'heave'
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

const results: { won: boolean; sunk: boolean; day: number; gold: number; fights: number; ship: string; raised: number; ending: string }[] = [];
const met: Record<string, number> = {};
const ends: Record<string, number> = {};
const killedBy: Record<string, number> = {};
let passed = 0;
const hows: Record<string, number> = {};
const reached: Record<string, number> = {};
let raids = 0;
let mutinies = 0;
let storms = 0;
let omens = 0;
const hullIn: Record<string, string[]> = {};
const lostTo: Record<string, number> = {};
const dead: number[] = [];
const likes: Record<string, number> = {};
const of: Record<string, number> = {};
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
      if ((!STRAIGHT || Object.values(map.landmarks).includes(w.player)) && isEnemy(w.wars, port.nation) && raidable(sea, w) && able && w.hull >= w.maxHull * 0.9) {
        w = fightItOut(raid(sea, w));
        raids++;
      } else w = inPort(w);
      if (w.sunk || w.won) break;
    }
    // On a shore: water when it's low, forage when the scurvy's coming, careen when she's foul.
    // Rations by the leg ahead: short when the food or water won't see it out with a margin.
    if (w.voyage.bound) {
      const need = daysTo(sea, w, w.voyage.bound) + 15;
      const full = daysOf({ ...w, rations: 'full' });
      const short = daysOf({ ...w, rations: 'short' });
      const rations = Math.min(full.food, full.water) >= need ? 'full' : Math.min(short.food, short.water) >= need ? 'short' : 'starving';
      if (rations !== w.rations) w = { ...w, rations };
    }
    const free = (x: WorldState) => !x.encounter && !x.hail && !x.dilemma && !x.spoil && !x.sunk && !x.won;
    if (free(w) && shore(sea, w).water && daysOf(w).water < 40) w = answer(ashore(sea, w, 'water', advance));
    if (free(w) && shore(sea, w).forage && w.fresh > 20) w = answer(ashore(sea, w, 'forage', advance));
    if (free(w) && shore(sea, w).careen && w.hull < w.maxHull - 1) w = answer(ashore(sea, w, 'careen', advance));
    if (w.sunk || w.won) break;
    if (w.hail) w = letPass(w);
    if (w.encounter) w = fightItOut(w);
    if (w.sunk || w.won) break;
    // At a landmark with no leg chosen: choose one, a fork at random, never turning back.
    if (!w.voyage.bound) {
      const legs = choicesOf(w.voyage).filter((k) => k !== 'plymouth-home' || landmarkOf(w.voyage.at).next.includes('plymouth-home'));
      if (legs.length) w = makeFor(w, legs[(seed + w.turn) % legs.length]);
    }
    if (dest === null || since > 10 || w.player === dest || danger(w) !== null) ((dest = choose(w)), (since = 0));
    if (dest === w.player) dest = harbours[(seed + w.turn) % harbours.length];
    if (process.argv.includes('--where') && w.turn % 5 === 0) { const n = map.nodes[w.player], t = map.nodes[dest]; console.log(w.turn, `at ${n.lat.toFixed(0)},${n.lon.toFixed(0)}`, `for ${t.port?.name ?? `${t.lat.toFixed(0)},${t.lon.toFixed(0)}`}`, w.voyage.bound, 'hull', w.hull, 'water', daysOf(w).water, 'food', daysOf(w).food, w.rations); }
    const out = sailToward(sea, w, dest);
    // Going nowhere — there already, or no way there — the day still passes, lying where she is.
    w = answer(out.world.turn === w.turn ? advance(sea, answer(out.world), out.world.player) : out.world);
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
  if (process.argv.includes('--trace')) console.log(seed, w.log.filter((l) => /you raise|dead of|the fight cost|Plymouth|too few/.test(l.text)).map((l) => `${l.turn}:${l.text}`).join('\n  '));
  if (w.won) likes[score(w).like] = (likes[score(w).like] ?? 0) + 1;
  if (w.sunk) {
    const why = w.log.at(-1)?.text.includes('too few hands') ? 'too few hands' : 'in a fight';
    lostTo[why] = (lostTo[why] ?? 0) + 1;
  }
  for (const l of w.log) for (const k of ['scurvy', 'thirst', 'hunger']) if (/ dead of /.test(l.text) && l.text.includes(k)) of[k] = (of[k] ?? 0) + (Number(l.text.split(' ')[0]) || 1);
  dead.push(w.log.filter((l) => / dead of /.test(l.text)).reduce((t, l) => t + (Number(l.text.split(' ')[0]) || 1), 0));
  mutinies += w.log.filter((l) => l.text.startsWith('mutiny')).length;
  storms += w.log.filter((l) => l.text.startsWith('a storm')).length;
  omens += w.log.filter((l) => l.text.startsWith('a good omen')).length;
  hows[w.won ? howHome(w.voyage) : w.sunk ? 'sunk' : 'adrift'] = (hows[w.won ? howHome(w.voyage) : w.sunk ? 'sunk' : 'adrift'] ?? 0) + 1;
  reached[w.voyage.at] = (reached[w.voyage.at] ?? 0) + 1;
  results.push({ won: w.won, sunk: w.sunk, day: w.turn, gold: w.gold, fights, ship: w.outfit.ship, raised: w.voyage.visited.length - 1, ending: w.ending ?? (w.pirate ? 'pirate' : '') });
}

const n = results.length;
const won = results.filter((r) => r.won);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
console.log(`${n} runs of up to ${DAYS} days, home to Plymouth\n`);
console.log(`won    ${won.length} (${Math.round((100 * won.length) / n)}%), on day ${Math.round(mean(won.map((r) => r.day)))} on average`);
console.log(`sunk   ${results.filter((r) => r.sunk).length}, on day ${Math.round(mean(results.filter((r) => r.sunk).map((r) => r.day)))} on average`);
console.log(`adrift ${results.filter((r) => !r.won && !r.sunk).length} (out of time), with ${Math.round(mean(results.filter((r) => !r.won && !r.sunk).map((r) => r.gold)))} gold`);
console.log(`fights ${mean(results.map((r) => r.fights)).toFixed(1)} a run · met`, met, '· ended', ends);
console.log('ships at the end', results.reduce((t, r) => ((t[r.ship] = (t[r.ship] ?? 0) + 1), t), {} as Record<string, number>));
console.log('sunk by', killedBy, '· hull going in', hullIn);
console.log(`let pass ${(passed / RUNS).toFixed(1)} a run`);
console.log(`raids ${(raids / RUNS).toFixed(1)} a run`);
console.log(`mutinies ${(mutinies / RUNS).toFixed(1)}, storms ${(storms / RUNS).toFixed(1)}, omens ${(omens / RUNS).toFixed(1)} a run`);
console.log('landmarks raised', results.reduce((t, r) => ((t[r.raised] = (t[r.raised] ?? 0) + 1), t), {} as Record<number, number>), '· endings', results.reduce((t, r) => ((t[r.ending || 'none'] = (t[r.ending || 'none'] ?? 0) + 1), t), {} as Record<string, number>));
console.log(`gold at a win ${Math.round(mean(won.map((r) => r.gold)))}`);
console.log('lost', lostTo, `· hands dead of want ${mean(dead).toFixed(1)} a run`, of);
console.log('like', likes);
console.log('voyages', hows, '· last landmark raised', reached);
