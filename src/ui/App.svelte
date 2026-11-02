<script lang="ts">
  import { onDestroy } from 'svelte';
  import { act, type Action, type EncounterState, type GameEvent } from '../rules.ts';
  import { CREW, SHIP_CLASSES, UPGRADES } from '../outfit.ts';
  import { buyRound, ROUND_COST } from '../world/bar.ts';
  import { plotCourse, sailToward } from '../world/course.ts';
  import type { NodeId } from '../world/map.ts';
  import { fight, repair, REPAIR_COST, type Reckoning } from '../world/meet.ts';
  import { SEASON_NAMES } from '../world/ocean.ts';
  import { bribe, bribeCost, buyShip, buyUpgrade, dismiss, recruit, serves } from '../world/port.ts';
  import { adjective, article } from '../world/ports.ts';
  import { markerStrength, predict } from '../world/rumors.ts';
  import type { Sea } from '../world/ships.ts';
  import { atIsland, createSea, createWorld, GOAL, HOME, knowledge, type WorldState } from '../world/world.ts';
  import Fight from './Fight.svelte';
  import Gauge from './Gauge.svelte';
  import SeaChart from './SeaChart.svelte';

  function seedFromUrl(): number {
    const raw = new URLSearchParams(location.search).get('seed');
    const n = raw === null ? NaN : Number(raw);
    return Number.isInteger(n) ? n : Math.floor(Math.random() * 2 ** 31);
  }

  // Building the sea takes a moment; let the page paint first.
  let sea: Sea | null = $state.raw(null);
  let seed = $state(seedFromUrl());
  let world: WorldState | null = $state.raw(null);
  setTimeout(() => {
    sea = createSea();
    world = createWorld(sea, seed);
  }, 30);

  $effect(() => {
    const url = new URL(location.href);
    url.searchParams.set('seed', String(seed));
    history.replaceState(null, '', url);
  });

  // --- Sailing ---------------------------------------------------------------

  let dest: NodeId | null = $state(null);
  let sailing = $state(false);
  let halted = $state('');
  let timer: ReturnType<typeof setInterval> | null = null;
  const course = $derived(sea && world && dest !== null ? plotCourse(sea, world, dest) : []);

  function setSail() {
    if (!sea || !world || dest === null) return;
    sailing = true;
    halted = '';
    timer ??= setInterval(day, 140);
  }
  function stop(why = '') {
    sailing = false;
    halted = why;
    if (timer) clearInterval(timer);
    timer = null;
  }
  function day() {
    if (!sea || !world || dest === null) return stop();
    const out = sailToward(sea, world, dest);
    world = out.world;
    chart?.recentre();
    if (!out.halt) return;
    const why: Record<string, string> = {
      arrived: 'arrived',
      encounter: 'a sail!',
      sighted: 'land ho — uncharted',
      stuck: 'no way there',
      won: 'home',
      sunk: '',
    };
    if (out.halt === 'arrived') dest = null;
    stop(why[out.halt]);
  }
  function oneDay() {
    if (dest !== null) day();
  }
  onDestroy(() => stop());

  // --- Fighting --------------------------------------------------------------

  /** The fight as it stands, kept a moment after the world settles it, to show how it ended. */
  let shown: EncounterState | null = $state.raw(null);
  let lastRound: GameEvent[] = $state.raw([]);
  let reckoning: Reckoning | null = $state.raw(null);
  let flag = $state('');

  $effect(() => {
    if (world?.encounter && !shown) {
      shown = world.encounter.fight;
      flag = adjective(world.ships[world.encounter.shipId].nation);
      lastRound = [];
      reckoning = null;
    }
  });

  function onact(a: Action) {
    if (!sea || !world?.encounter || !shown) return;
    const before = shown.events.length;
    const next = act(shown, a);
    lastRound = next.events.slice(before).filter((e) => e.type === 'played' || e.type === 'effect' || e.type === 'rejected');
    world = fight(sea, world, a);
    shown = next;
    if (next.outcome) reckoning = world.reckoning;
  }
  function oncontinue() {
    shown = null;
    reckoning = null;
  }

  // --- In port ---------------------------------------------------------------

  let said = $state('');
  function attempt(f: () => WorldState, done = '') {
    try {
      world = f();
      said = done;
    } catch (e) {
      said = (e as Error).message;
    }
  }
  function round() {
    if (!sea || !world) return;
    try {
      const { world: w, heard } = buyRound(sea, world);
      world = w;
      said = heard ? `somebody saw a ${adjective(heard.nation)} ${heard.kind.replace('-', ' ')}, ${ago(world.turn - heard.turn)}` : 'nobody knows anything worth the drink';
      if (heard) focus = heard.id;
    } catch (e) {
      said = (e as Error).message;
    }
  }

  // --- Rumors ----------------------------------------------------------------

  let focus: number | null = $state(null);
  const cloud = $derived.by(() => {
    if (!sea || !world || focus === null || sailing) return [];
    const r = world.rumors.find((x) => x.id === focus);
    if (!r) return [];
    const p = predict(sea, r, world.turn, knowledge(world), world.player, world.standing);
    return p.flatMap((v, node) => (v > 0.003 ? [{ node, p: v }] : []));
  });

  /** Ships within a step of what you can see. */
  const visible = $derived.by(() => {
    if (!sea || !world) return [];
    const d = sea.map.distTo(world.player);
    return world.ships.filter((s) => s.laidUp <= world!.turn && d[s.node] <= world!.sight + 1).map((s) => s.id);
  });

  let chart: SeaChart | null = $state(null);

  function newRun() {
    stop();
    seed = Math.floor(Math.random() * 2 ** 31);
    world = createWorld(sea!, seed);
    dest = null;
    focus = null;
    said = '';
    shown = null;
    chart?.recentre();
  }

  const ago = (days: number) => (days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days back`);

  const nodeName = (id: NodeId) => {
    const n = sea!.map.nodes[id];
    if (n.port) return n.port.name;
    if (world!.islands.some((i) => i.found && i.node === id)) return 'an uncharted isle';
    return `${Math.abs(n.lat).toFixed(0)}°${n.lat >= 0 ? 'n' : 's'} ${Math.abs(n.lon).toFixed(0)}°${n.lon >= 0 ? 'e' : 'w'}`;
  };
</script>

{#if !sea || !world}
  <main class="loading"><p>charting the seas…</p></main>
{:else}
  {@const port = sea.map.nodes[world.player].port}
  <main>
    <header>
      <h1>privateer</h1>
      <p class="meta">
        day {world.turn + 1}, {SEASON_NAMES[Math.floor(world.turn / sea.pattern.seasonLength) % 4]} ·
        {world.gold} gold of {GOAL} to bring home to {HOME} · seed {seed}
      </p>
    </header>

    <div class="layout">
      <div class="map">
        <SeaChart bind:this={chart} {sea} {world} {course} {cloud} {focus} {visible} onpick={(n) => ((dest = n), (halted = ''))} />
        <div class="mapkeys">
          <button onclick={() => chart?.zoom(1 / 1.4)} aria-label="zoom in">+</button>
          <button onclick={() => chart?.zoom(1.4)} aria-label="zoom out">−</button>
          <button onclick={() => chart?.recentre()}>find the ship</button>
        </div>
        <p class="legend">blue: the current a step out · dashed grey: this season's wind · red rings: rumors, fading · red cloud: where the selected one's ship could be by now</p>
      </div>

      <aside>
        <section>
          <h2>{nodeName(world.player)}</h2>
          <Gauge label="hull" value={world.hull} max={world.maxHull} />
          <p>a {SHIP_CLASSES[world.outfit.ship].name}, {world.outfit.crew.length ? world.outfit.crew.map((c) => CREW[c].name).join(', ') : 'no hands of note'}</p>
          <p class="faint">sight {world.sight} · {world.outfit.upgrades.length ? world.outfit.upgrades.map((u) => UPGRADES[u].name).join(', ') : 'no refits'}</p>
          {#if atIsland(world)}<p>at anchor off an uncharted isle: taking on water, mending the hull.</p>{/if}
        </section>

        <section>
          <h2>course</h2>
          {#if dest === null}
            <p class="faint">click the sea to set a course.</p>
          {:else}
            <p>for {nodeName(dest)}, {course.length - 1} days</p>
            <div class="row">
              {#if sailing}<button onclick={() => stop('hove to')}>heave to</button>{:else}<button onclick={setSail} disabled={course.length < 2}>set sail</button><button onclick={oneDay} disabled={course.length < 2}>one day</button>{/if}
              <button onclick={() => ((dest = null), stop())}>clear</button>
            </div>
          {/if}
          {#if halted}<p class="said">{halted}</p>{/if}
        </section>

        {#if port}
          <section>
            <h2>{port.name}, {adjective(port.nation)}</h2>
            {#if !serves(sea, world)}
              <p>the {adjective(port.nation)} won't deal with you.</p>
              <button onclick={() => attempt(() => bribe(sea!, world!), 'the right palms are greased')}>bribe the officials ({bribeCost(world, port.nation)})</button>
            {:else}
              <h3>the bar</h3>
              <button onclick={round}>buy a round ({ROUND_COST})</button>
              <div class="list">
                {#each Object.entries(CREW).filter(([k]) => !world!.outfit.crew.includes(k)) as [key, c]}
                  <button onclick={() => attempt(() => recruit(sea!, world!, key), `the ${c.name} signs on`)}>hire a {c.name} ({c.cost})</button>
                {/each}
                {#each world.outfit.crew as key}
                  <button onclick={() => attempt(() => dismiss(world!, key), `the ${CREW[key].name} goes ashore`)}>let the {CREW[key].name} go</button>
                {/each}
              </div>
              <h3>the yard</h3>
              {#if world.hull < world.maxHull}
                <button onclick={() => attempt(() => repair(sea!, world!), 'the carpenters are paid')}>repair ({REPAIR_COST} a point)</button>
              {/if}
              <div class="list">
                {#each Object.entries(UPGRADES) as [key, u]}
                  <button onclick={() => attempt(() => buyUpgrade(sea!, world!, key), `${u.name} fitted`)}>{u.name} ({u.cost})</button>
                {/each}
                {#each Object.entries(SHIP_CLASSES).filter(([k]) => k !== world!.outfit.ship && k !== 'pinnace') as [key, c]}
                  <button onclick={() => attempt(() => buyShip(sea!, world!, key), `you take command of a ${c.name}`)}>a {c.name}: hull {c.hull}, {c.berths} berths ({c.cost})</button>
                {/each}
              </div>
              {#if (world.standing[port.nation] ?? 0) < 0}
                <button onclick={() => attempt(() => bribe(sea!, world!), 'the right palms are greased')}>bribe the officials ({bribeCost(world, port.nation)})</button>
              {/if}
            {/if}
            {#if said}<p class="said">{said}</p>{/if}
          </section>
        {/if}

        <section>
          <h2>rumors</h2>
          {#if !world.rumors.length}<p class="faint">none worth the name. buy a round in port.</p>{/if}
          <ul class="rumors">
            {#each [...world.rumors].reverse() as r (r.id)}
              <li>
                <button class:focused={focus === r.id} onclick={() => (focus = focus === r.id ? null : r.id)}>
                  {article(adjective(r.nation))} {adjective(r.nation)} {r.kind.replace('-', ' ')}, {ago(world.turn - r.turn)}
                  <span class="faint">· {Math.round(markerStrength(r, world.turn) * 100)}%</span>
                </button>
              </li>
            {/each}
          </ul>
        </section>

        <section>
          <h2>standing</h2>
          {#if !Object.values(world.standing).some((v) => v)}<p class="faint">nobody has reason to hunt you.</p>{/if}
          <ul class="plain">
            {#each Object.entries(world.standing).filter(([, v]) => v) as [n, v]}
              <li class:wanted={v! < 0}>{adjective(n as never)}: {v! > 0 ? '+' : ''}{v}{v! < 0 ? ', and their guard ships are out' : ''}</li>
            {/each}
          </ul>
        </section>

        {#if world.log.length}
          <section>
            <h2>news</h2>
            <ul class="plain">
              {#each world.log.slice(-4).reverse() as l}<li><span class="faint">day {l.turn + 1}:</span> {l.text}</li>{/each}
            </ul>
          </section>
        {/if}
      </aside>
    </div>

    {#if shown}
      <div class="overlay">
        <div class="sheet">
          <Fight fight={shown} {lastRound} {reckoning} {flag} {onact} {oncontinue} />
        </div>
      </div>
    {:else if world.sunk || world.won}
      <div class="overlay">
        <div class="sheet">
          <h2>{world.won ? 'home' : 'lost with all hands'}</h2>
          <p>{world.won ? `you came home to ${HOME} on day ${world.turn + 1} with ${world.gold}.` : `the sea took you on day ${world.turn + 1}, ${world.gold} in the purse.`}</p>
          <button onclick={newRun}>a new run</button>
        </div>
      </div>
    {/if}
  </main>
{/if}

<style>
  main { max-width: 84rem; margin: 0 auto; padding: 1.25rem 16px 2rem; display: flex; flex-direction: column; gap: 1rem; }
  .loading { color: var(--faint); }
  h1 { margin: 0; font-size: 1.8rem; font-weight: 400; letter-spacing: -0.025em; }
  h2 { margin: 0 0 0.5rem; font-size: 1.1rem; font-weight: 400; }
  h3 { margin: 0.75rem 0 0.4rem; font-size: 0.95rem; font-weight: 400; color: var(--faint); }
  p { margin: 0.3rem 0; }
  .meta, .faint, .legend { color: var(--faint); }
  .legend { font-size: 0.8rem; }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 22rem; gap: 1.25rem; align-items: start; }
  .map { display: flex; flex-direction: column; gap: 0.5rem; height: min(78vh, 52rem); }
  .mapkeys { display: flex; gap: 0.5rem; }
  .mapkeys button { padding: 0.25rem 0.7rem; }
  aside { display: flex; flex-direction: column; gap: 1.25rem; }
  aside section { border-top: 1px dashed var(--rule); padding-top: 0.75rem; }
  .row, .list { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .list button, .row button, aside button { padding: 0.3rem 0.6rem; font-size: 0.9rem; }
  .said { font-style: italic; }
  .rumors, .plain { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; }
  .rumors button { width: 100%; border-color: var(--rule); }
  .rumors button.focused { border-color: var(--theirs); color: var(--theirs); }
  .wanted { color: var(--theirs); }
  .overlay { position: fixed; inset: 0; background: rgba(255, 255, 255, 0.92); display: grid; place-items: start center; overflow: auto; padding: 2rem 16px; }
  .sheet { width: min(44rem, 100%); background: var(--paper); border: 1.5px solid var(--ink); padding: 1.25rem; }
  @media (max-width: 60rem) {
    .layout { grid-template-columns: 1fr; }
    .map { height: 60vh; }
  }
</style>
