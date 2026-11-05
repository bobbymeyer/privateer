<script lang="ts">
  /**
   * What's aboard, at a glance: the hands against the complement, days of
   * food and water, spares and powder, the scurvy; and the two things you
   * set, Oregon Trail's way: the rations, and the pace.
   */
  import type { Sea } from '../world/ships.ts';
  import { type Pace, type Rations, SCURVY_DAYS, capacity, complement, daysOf, scurvy } from '../world/stores.ts';
  import type { WorldState } from '../world/world.ts';

  let { sea, world, set }: { sea: Sea; world: WorldState; set: (w: WorldState) => void } = $props();

  const cap = $derived(capacity(world));
  const days = $derived(daysOf(world));
  const ill = $derived(scurvy(world));
  const tropics = $derived(Math.abs(sea.map.nodes[world.player].lat) < 23.5);
  const pct = (v: number, m: number) => `${Math.max(0, Math.min(100, (v / m) * 100))}%`;
  const RATIONS: [Rations, string][] = [['full', 'full'], ['short', 'short'], ['starving', 'starvation']];
  const PACES: [Pace, string][] = [['easy', 'easy'], ['steady', 'steady'], ['hard', 'crack on']];
  const rows = $derived([
    { label: 'hands', bar: pct(world.crew, complement(world)), text: `${world.crew} of ${complement(world)}`, low: world.crew < complement(world) / 2 },
    { label: 'food', bar: pct(world.stores.food, cap.food), text: `${days.food} days`, low: days.food <= 10 },
    { label: 'water', bar: pct(world.stores.water, cap.water), text: `${days.water} days${tropics ? ', tropics' : ''}`, low: days.water <= 10 },
    { label: 'spares', bar: pct(world.stores.spares, cap.spares), text: `${world.stores.spares} bundles`, low: world.stores.spares === 0 },
    { label: 'powder', bar: pct(world.stores.powder, cap.powder), text: `${world.stores.powder} barrels`, low: world.stores.powder === 0 },
  ]);
</script>

<dl class="stores">
  {#each rows as r (r.label)}
    <dt>{r.label}</dt>
    <dd class:low={r.low}><span class="bar"><span style="width: {r.bar}"></span></span>{r.text}</dd>
  {/each}
</dl>
{#if ill === 'killing'}
  <p class="wanted">scurvy: {world.fresh} days without fresh food, and men are dying of it. forage at a landmark, or buy food in port.</p>
{:else if ill === 'coming'}
  <p class="wanted">gums bleeding: {world.fresh} days without fresh food. the scurvy kills after {SCURVY_DAYS}.</p>
{:else}
  <p class="faint">{world.fresh} days since fresh food</p>
{/if}
<p class="faint">rations</p>
<div class="row" role="group" aria-label="rations">
  {#each RATIONS as [k, name] (k)}<button aria-pressed={world.rations === k} onclick={() => set({ ...world, rations: k })}>{name}</button>{/each}
</div>
<p class="faint">pace</p>
<div class="row" role="group" aria-label="pace">
  {#each PACES as [k, name] (k)}<button aria-pressed={world.pace === k} onclick={() => set({ ...world, pace: k })}>{name}</button>{/each}
</div>
<p class="faint">
  {world.rations === 'full' ? 'a ration of food and water a hand a day.' : world.rations === 'short' ? 'two thirds: food and water go further, and the crew sour.' : 'a third: the hands weaken and turn ugly fast.'}
  {world.pace === 'easy' ? 'easy: a day in three lying to; the ship and crew spared.' : world.pace === 'steady' ? 'steady: a day’s way a day.' : 'cracking on: a day gained in three, at the hull and the crew’s temper.'}
</p>

<style>
  .stores { display: grid; grid-template-columns: auto 1fr; gap: 0.2rem 0.6rem; margin: 0.4rem 0; font-size: 0.9rem; }
  dt, .faint { color: var(--faint); }
  .wanted { color: var(--theirs); }
  p { margin: 0.3rem 0; }
  dd { margin: 0; display: flex; align-items: center; gap: 0.5rem; }
  .bar { display: inline-block; width: 5rem; height: 0.5rem; border: 1px solid var(--ink); flex: none; }
  .bar span { display: block; height: 100%; background: var(--ink); }
  .low { color: var(--theirs); }
  .low .bar { border-color: currentColor; }
  .low .bar span { background: currentColor; }
  button[aria-pressed='true'] { background: var(--ink); color: var(--paper); }
  .row { display: flex; flex-direction: row; flex-wrap: wrap; gap: 0.4rem; margin: 0.4rem 0; }
  .row button { padding: 0.3rem 0.6rem; font-size: 0.9rem; }
</style>
