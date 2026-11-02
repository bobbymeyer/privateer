/** Flags, standing, and protected waters. Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { portNamed } from './map.ts';
import { HUNTER_STATIONS, advance, createSea, createWorld, type WorldState } from './world.ts';
import { hunterGoal, mayEnter } from './ships.ts';

const sea = createSea();
const { map } = sea;
const at = (name: string) => portNamed(map, name);

test('every ship flies its home port’s flag', () => {
  const w = createWorld(sea, 1);
  const route = (name: string) => w.ships.find((s) => s.routeName === name)!.nation;
  assert.equal(route('flota'), 'spain');
  assert.equal(route('manila galleon'), 'spain');
  assert.equal(route('carreira'), 'portugal');
  assert.equal(route('retourvloot'), 'netherlands');
  assert.equal(w.ships.find((s) => s.kind === 'merchant' && s.home === at('Amsterdam'))!.nation, 'netherlands');
});

test('the guard stations are out where control is weak, not in Europe', () => {
  for (const name of HUNTER_STATIONS) assert.ok(!['Cádiz', 'Lisbon', 'Plymouth', 'Amsterdam', 'Brest'].includes(name), name);
});

test('forts make protected waters', () => {
  assert.equal(map.nodes[at('Plymouth')].waters, 'england');
  assert.equal(map.nodes[at('Havana')].waters, 'spain');
  assert.equal(map.nodes[at('Willemstad')].waters, 'netherlands');
  const midAtlantic = map.nodes.reduce((best, n) => (Math.hypot(n.lon + 40, n.lat - 30) < Math.hypot(best.lon + 40, best.lat - 30) ? n : best));
  assert.equal(midAtlantic.waters, null);
});

/** You, lying in Santo Domingo (Spanish waters, so Spanish guard ships may come), for 40 days. */
function lieAt(standing: WorldState['standing']) {
  let w: WorldState = { ...createWorld(sea, 3), player: at('Santo Domingo'), standing };
  const guards = w.ships.filter((s) => s.kind === 'hunter' && s.nation === 'spain' && map.distTo(s.home)[w.player] <= 25);
  const before = guards.reduce((t, g) => t + map.distTo(w.player)[g.node], 0);
  for (let i = 0; i < 40; i++) {
    w = advance(sea, w, w.player);
    for (const s of w.ships) assert.ok(mayEnter(map, s, s.node), `${s.nation} ${s.kind} in ${map.nodes[s.node].waters} waters`);
  }
  const after = guards.reduce((t, g) => t + map.distTo(w.player)[w.ships[g.id].node], 0);
  return { before, after, guards: guards.length };
}

test('guard ships leave you be until you’ve attacked their nation', () => {
  const calm = lieAt({});
  const wanted = lieAt({ spain: -1 });
  assert.ok(calm.guards > 0);
  assert.ok(wanted.after < wanted.before / 2, `wanted: ${wanted.before} → ${wanted.after}`);
  assert.ok(calm.after > wanted.after * 2, `unprovoked they keep station: ${calm.after} against ${wanted.after}`);
});

test('a guard ship never enters another nation’s waters — so they are a refuge', () => {
  const w = createWorld(sea, 1);
  const havana = w.ships.find((s) => s.kind === 'hunter' && s.home === at('Havana'))!;
  // Wanted by Spain, but lying under Port Royal's guns.
  assert.equal(hunterGoal(map, havana, at('Port Royal'), { spain: -3 }), havana.home);
  assert.equal(hunterGoal(map, havana, at('Santiago de Cuba'), { spain: -3 }), at('Santiago de Cuba'));
});

test('a foreign guard ship found in protected waters is driven off by the navy', () => {
  let w = createWorld(sea, 1);
  const havana = w.ships.find((s) => s.kind === 'hunter' && s.home === at('Havana'))!;
  const offPlymouth = map.adj[at('Plymouth')].find((n) => !map.nodes[n].port)!;
  w = { ...w, ships: w.ships.map((s) => (s.id === havana.id ? { ...s, node: offPlymouth } : s)) };
  w = advance(sea, w, w.player);
  assert.ok(w.ships[havana.id].laidUp > w.turn, 'laid up');
  assert.equal(w.ships[havana.id].node, havana.home);
  assert.match(w.log.at(-1)!.text, /Royal Navy drove off a Spanish guard ship/);
});
