/** Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { distanceNm } from './geo.ts';
import { DAY_NM, FAR, portNamed, ports } from './map.ts';
import { ROUTES } from './ocean.ts';
import { PORTS } from './ports.ts';
import { FADE, FADED, makeRumor, markerStrength, maxOff, predict, searchArea } from './rumors.ts';
import { KNOW_ALL, KNOW_NOTHING, currentAt, seasonOf, windAt } from './sea.ts';
import { movesOn } from './ships.ts';
import { ROUND_COST, buyRound } from './bar.ts';
import { type WorldState, advance, createSea, createWorld, earn, hearRumor, knowledge } from './world.ts';

const sea = createSea();
const { map } = sea;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const ll = (id: number): [number, number] => [map.nodes[id].lon, map.nodes[id].lat];

test('the sea is built once and shared', () => {
  assert.equal(createSea(), sea);
});

test('one ocean: every node reaches every other', () => {
  assert.ok(!map.distTo(0).includes(FAR));
});

test('every step is a day’s sail', () => {
  for (const n of map.nodes) for (const m of map.adj[n.id]) assert.ok(distanceNm(ll(n.id), ll(m)) < DAY_NM * 1.6, `${n.id}→${m}`);
});

test('every port has its own node, near where it really is', () => {
  assert.equal(new Set(ports(map)).size, PORTS.length);
  for (const def of PORTS) {
    const off = distanceNm(def.at, ll(portNamed(map, def.name)));
    assert.ok(off < 120, `${def.name} is ${off.toFixed(0)} miles off`);
  }
});

test('every great course can be sailed by deep keels', () => {
  for (const [name, course] of Object.entries(ROUTES)) {
    for (let i = 0; i < course.length; i++) {
      const [a, b] = [portNamed(map, course[i]), portNamed(map, course[(i + 1) % course.length])];
      assert.ok(map.deep.distTo(b)[a] < FAR, `${name}: ${course[i]} → ${course[(i + 1) % course.length]}`);
    }
  }
});

test('the currents run the right way', () => {
  const north = (lon: number, lat: number) => currentAt([lon, lat])[1];
  const east = (lon: number, lat: number) => currentAt([lon, lat])[0];
  assert.ok(north(-79.8, 28) > 0.8, 'Gulf Stream north off Florida');
  assert.ok(east(-60, -57) > 0.5, 'West Wind Drift east through the Drake Passage');
  assert.ok(north(-78, -15) > 0.3, 'Humboldt north up Peru');
  assert.ok(east(-150, 13) < -0.3, 'North Equatorial west across the Pacific');
  assert.ok(north(34, -28) < -0.5, 'Agulhas south down Africa');
});

test('the winds blow the right way, and the monsoon turns', () => {
  assert.ok(windAt([-40, 15], 0)[0] < -0.5, 'north-east trades in the Atlantic');
  assert.ok(windAt([80, -45], 0)[0] > 0.8, 'Roaring Forties');
  assert.ok(windAt([0, 0], 1)[0] > -0.4, 'doldrums are slack');
  const summer = windAt([65, 15], 2);
  const winter = windAt([65, 15], 0);
  assert.ok(summer[0] > 0 && summer[1] > 0, 'south-west monsoon in summer');
  assert.ok(winter[0] < 0 && winter[1] < 0, 'north-east monsoon in winter');
});

test('Magellan and the hand-threaded passages are on the map', () => {
  for (const name of ['Strait of Magellan', 'Strait of Gibraltar', 'Sunda Strait']) assert.ok(map.nodes.some((n) => n.strait === name), name);
});

test('ships sail one step at a time, and slow ones only on even turns', () => {
  let w = createWorld(sea, 2);
  for (let i = 0; i < 12; i++) {
    const next = advance(sea, w, w.player);
    w.ships.forEach((ship, k) => {
      const to = next.ships[k].node;
      assert.ok(to === ship.node || map.adj[ship.node].includes(to));
      if (!movesOn(ship.kind, w.turn)) assert.equal(to, ship.node);
    });
    w = next;
  }
});

test('a sure rumor is exact; a bad one is off, but not by more than it may be', () => {
  const w = createWorld(sea, 3);
  for (let i = 0; i < 30; i++) {
    const ship = w.ships[i * 3];
    assert.equal(makeRumor(sea, { rng: i }, 0, ship, 0, 1).reported, ship.node);
    const bad = makeRumor(sea, { rng: i }, 0, ship, 0, 0);
    const off = map.distTo(ship.node)[bad.reported];
    assert.ok(off >= 1 && off <= maxOff(0), `off by ${off}`);
  }
});

test('markers fade each turn and are dropped once faded', () => {
  // The rumor bought here, not the letter's intelligence the run opens with.
  let w = hearRumor(sea, createWorld(sea, 3), 0, 0.9);
  const rumor = w.rumors.at(-1)!;
  assert.equal(markerStrength(rumor, rumor.turn + 1), 0.9 * FADE);
  let turns = 0;
  while (w.rumors.some((r) => r.id === rumor.id)) {
    assert.ok(markerStrength(rumor, w.turn) >= FADED);
    w = advance(sea, { ...w, dilemma: null }, w.player);
    turns++;
  }
  assert.equal(turns, Math.ceil(Math.log(FADED / 0.9) / Math.log(FADE)));
});

test('a prediction is a probability over the sea, starts at the report, and spreads', () => {
  let w = createWorld(sea, 4);
  const flota = w.ships.find((s) => s.routeName === 'flota')!;
  for (let i = 0; i < 5; i++) w = advance(sea, { ...w, dilemma: null }, w.player);
  w = hearRumor(sea, w, flota.id, 1);
  const rumor = w.rumors.at(-1)!;
  assert.ok(Math.abs(predict(sea, rumor, w.turn, knowledge(w), w.player)[rumor.reported] - 1) < 1e-9);
  for (let i = 0; i < 6; i++) w = advance(sea, { ...w, dilemma: null }, w.player);
  const later = predict(sea, rumor, w.turn, KNOW_ALL, w.player);
  assert.ok(Math.abs(sum(later) - 1) < 1e-9);
  assert.ok(searchArea(later).length > 1);
});

test('knowing the sea tightens the search', () => {
  let blind = 0;
  let wise = 0;
  for (let seed = 0; seed < 12; seed++) {
    let w = createWorld(sea, seed);
    for (let i = 0; i < 4; i++) w = advance(sea, w, w.player);
    w = hearRumor(sea, w, (seed * 7) % w.ships.length, 0.9);
    for (let i = 0; i < 4; i++) w = advance(sea, w, w.player);
    blind += searchArea(predict(sea, w.rumors[0], w.turn, KNOW_NOTHING, w.player)).length;
    wise += searchArea(predict(sea, w.rumors[0], w.turn, KNOW_ALL, w.player)).length;
  }
  assert.ok(wise < blind * 0.85, `${wise} vs ${blind}`);
});


test('you see the next node’s current and wind, and no farther', () => {
  const w = createWorld(sea, 1);
  const know = knowledge(w);
  assert.ok(know.current(w.player) && know.wind(w.player, 0));
  for (const m of map.adj[w.player]) assert.ok(know.current(m) && know.wind(m, 0), 'next node seen');
  const beyond = map.nodes.findIndex((n) => map.distTo(w.player)[n.id] === 2);
  assert.ok(!know.current(beyond), 'two steps out is unseen');
  assert.ok(!know.wind(w.player, 2), 'summer wind is not seen in winter');
});

test('a current once seen stays charted; wind is charted season by season', () => {
  // An empty sea, so nothing comes alongside to fight.
  let w: WorldState = { ...createWorld(sea, 1), ships: [], trail: [] };
  const start = w.player;
  const away = map.adj[start][0];
  w = advance(sea, w, away);
  w = advance(sea, w, map.adj[away].find((m) => map.distTo(start)[m] >= 2) ?? away);
  assert.ok(knowledge(w).current(start), 'still charted');
  // Lie at anchor into the next season: the wind here is charted for it too.
  // Storms and the crew's shares set aside: this is about the chart.
  while (seasonOf(sea.pattern, w.turn) === 0) w = advance(sea, { ...w, dilemma: null }, w.player);
  assert.ok(knowledge(w).wind(w.player, 0) && knowledge(w).wind(w.player, 1));
  assert.ok(!knowledge(w).wind(start, 1) || map.distTo(w.player)[start] <= 1, 'the start was not seen in spring');
});

test('a round in port costs gold and may buy a rumor; there is no bar at sea', () => {
  let w = createWorld(sea, 7);
  for (let i = 0; i < 12; i++) w = advance(sea, w, w.player);
  const { world, heard } = buyRound(sea, w);
  assert.equal(world.gold, w.gold - ROUND_COST);
  if (heard) {
    assert.ok(heard.turn < w.turn && heard.turn >= w.turn - 12, 'the news is a few days old');
    assert.equal(world.rumors.at(-1), heard);
  }
  assert.throws(() => buyRound(sea, advance(sea, w, map.adj[w.player][0])), /no bar at sea/);
  assert.throws(() => buyRound(sea, { ...w, gold: 0 }), /purse/);
});

test('the more rounds, the less the room knows and the less it is right', () => {
  const firsts: number[] = [];
  const thirds: number[] = [];
  let firstHeard = 0;
  let thirdHeard = 0;
  for (let seed = 0; seed < 60; seed++) {
    let w = earn(createWorld(sea, seed), 100);
    for (let i = 0; i < 12; i++) w = advance(sea, w, w.player);
    for (let round = 1; round <= 3; round++) {
      const got = buyRound(sea, w);
      w = got.world;
      if (got.heard && round === 1) (firstHeard++, firsts.push(got.heard.reliability));
      if (got.heard && round === 3) (thirdHeard++, thirds.push(got.heard.reliability));
    }
  }
  const mean = (xs: number[]) => sum(xs) / xs.length;
  assert.ok(thirdHeard < firstHeard, `heard ${firstHeard} then ${thirdHeard}`);
  assert.ok(mean(thirds) < mean(firsts), `${mean(firsts).toFixed(2)} then ${mean(thirds).toFixed(2)}`);
});

test('the bar talks about treasure more than its share', () => {
  let treasure = 0;
  let heard = 0;
  for (let seed = 0; seed < 80; seed++) {
    let w = createWorld(sea, seed);
    for (let i = 0; i < 12; i++) w = advance(sea, w, w.player);
    const got = buyRound(sea, w);
    if (!got.heard) continue;
    heard++;
    if (got.heard.kind !== 'merchant') treasure++;
  }
  const share = w0().ships.filter((s) => s.kind !== 'merchant').length / w0().ships.length;
  assert.ok(treasure / heard > share, `${treasure}/${heard} against a share of ${share.toFixed(2)}`);
});

const w0 = () => createWorld(sea, 0);
