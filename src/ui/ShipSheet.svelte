<script lang="ts">
  /**
   * Your ship and crew on one sheet: the ship, how she stands, who sails in
   * her and what each brings, her refits, and the deck all that makes,
   * laid out as cards and grouped by where each came from. In a port with a
   * yard, a card can be struck out from here.
   */
  import { CREW, MIN_DECK, PLAYER_CARDS, SHIP_CLASSES, STRIKE_COST, UPGRADES, WAGE_DAYS, cardWords, deckSize, deckSources, maxHullOf } from '../outfit.ts';
  import { explainCard } from '../describe.ts';
  import { MORALE_MAX } from '../world/events.ts';
  import type { Sea } from '../world/ships.ts';
  import { dismiss, serves, strikable, strikeCard } from '../world/port.ts';
  import type { WorldState } from '../world/world.ts';
  import Gauge from './Gauge.svelte';
  import { SHIP } from './woodcut.ts';

  let { sea, world, act, onclose }: { sea: Sea; world: WorldState; act: (f: () => WorldState, done?: string) => void; onclose?: () => void } = $props();

  const cls = $derived(SHIP_CLASSES[world.outfit.ship]);
  const atYard = $derived(!!sea.map.nodes[world.player].port && serves(sea, world));
  /** The deck by source, each card with how many of its copies are struck: struck copies come off the ship's own first, then the rest in order. */
  const groups = $derived.by(() => {
    const left = world.outfit.struck.reduce((t, k) => ((t[k] = (t[k] ?? 0) + 1), t), {} as Record<string, number>);
    return deckSources(world.outfit).map((src) => ({
      ...src,
      cards: Object.entries(src.cards).map(([key, n]) => {
        const gone = Math.min(n, left[key] ?? 0);
        if (gone) left[key] -= gone;
        return { key, n, gone };
      }),
    }));
  });
  /** Bigger ships drawn bigger. */
  const scale = $derived(2.2 + cls.hull / 10);
</script>

<div class="ship-sheet">
  <header>
    <svg viewBox="-14 -14 28 24" width={28 * scale} height={24 * scale} aria-hidden="true">
      <g stroke-linejoin="round">
        <path d={SHIP.masts} stroke="var(--ink)" stroke-width="0.8" />
        <path d={SHIP.sails} fill="var(--paper)" stroke="var(--ink)" stroke-width="0.8" />
        <path d={SHIP.pennant} fill="var(--theirs)" stroke="var(--ink)" stroke-width="0.4" />
        <path d={SHIP.hull} fill="var(--ink)" stroke="var(--ink)" stroke-width="0.8" />
      </g>
    </svg>
    <div>
      <h2>your {cls.name}</h2>
      <Gauge label="hull" value={world.hull} max={world.maxHull} />
      <Gauge label="morale" value={world.morale} max={MORALE_MAX} />
      <p class="faint">hull {maxHullOf(world.outfit)} · {cls.berths} berths, {world.outfit.crew.length} filled · sight {world.sight}</p>
    </div>
  </header>

  <section>
    <h3>hands of note</h3>
    {#if !world.outfit.crew.length}<p class="faint">none aboard. they're hired in a port's bar.</p>{/if}
    <ul class="plain rows">
      {#each world.outfit.crew as key (key)}
        {@const c = CREW[key]}
        <li>
          <span>the {c.name}</span>
          <span class="faint">{cardWords(c.cards)}{c.sight ? `${Object.keys(c.cards).length ? ', ' : ''}sight +${c.sight}` : ''} · wage {c.wage} every {WAGE_DAYS} days</span>
          <button onclick={() => act(() => dismiss(world, key), `the ${c.name} goes ashore`)}>let go</button>
        </li>
      {/each}
    </ul>
  </section>

  <section>
    <h3>refits</h3>
    {#if !world.outfit.upgrades.length}<p class="faint">none. a yard fits them, to this ship only.</p>{/if}
    <ul class="plain rows">
      {#each world.outfit.upgrades as key, i (i)}
        {@const u = UPGRADES[key]}
        <li><span>{u.name}</span><span class="faint">{[u.cards ? cardWords(u.cards) : '', u.hull ? `hull +${u.hull}` : ''].filter(Boolean).join(', ')}</span></li>
      {/each}
    </ul>
  </section>

  <section>
    <h3>the deck: {deckSize(world.outfit)} cards</h3>
    <p class="faint">
      {atYard ? `a card struck here costs ${STRIKE_COST}, down to ${MIN_DECK} cards: a thinner deck deals what you want more often.` : 'a yard in a port that deals with you will strike cards out.'}
    </p>
    {#each groups as src, i (i)}
      <h4>{src.label}</h4>
      <div class="cards">
        {#each src.cards as { key, n, gone } (key)}
          {#each Array(n) as _, copy}
            {@const isStruck = copy >= n - gone}
            <div class="card" class:struck={isStruck} title={explainCard(PLAYER_CARDS[key].text)}>
              <span class="name">{PLAYER_CARDS[key].name}</span>
              <span class="text">{PLAYER_CARDS[key].text}</span>
              {#if isStruck}<span class="note">struck</span>{:else if atYard && copy === 0}<button onclick={() => act(() => strikeCard(sea, world, key), `${PLAYER_CARDS[key].name} struck from the deck`)} disabled={!strikable(sea, world, key)}>strike</button>{/if}
            </div>
          {/each}
        {/each}
      </div>
    {/each}
  </section>

  {#if onclose}<div class="row"><button onclick={onclose}>back to the chart</button></div>{/if}
</div>

<style>
  .ship-sheet { display: flex; flex-direction: column; gap: 1.1rem; }
  header { display: flex; gap: 1.25rem; align-items: center; }
  h2 { margin: 0 0 0.4rem; font-size: 1.5rem; font-weight: 400; letter-spacing: -0.025em; }
  h3 { margin: 0 0 0.4rem; font-size: 1.1rem; font-weight: 400; border-bottom: 1px dashed var(--rule); padding-bottom: 0.3rem; }
  h4 { margin: 0.8rem 0 0.4rem; font-size: 0.9rem; font-weight: 400; color: var(--faint); }
  p { margin: 0.3rem 0; }
  .plain { list-style: none; margin: 0; padding: 0; }
  .rows li { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.2rem 0.75rem; margin-top: 0.35rem; }
  .rows button { padding: 0.1rem 0.5rem; font-size: 0.85rem; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr)); gap: 0.5rem; }
  .card { display: flex; flex-direction: column; gap: 0.25rem; min-height: 5.2rem; padding: 0.5rem 0.6rem; border: 1.5px solid var(--ink); }
  .card .name { font-size: 0.95rem; }
  .card .text { margin-top: auto; font-size: 0.85rem; color: var(--faint); font-variant-numeric: tabular-nums; }
  .card button { align-self: flex-start; padding: 0.05rem 0.4rem; font-size: 0.75rem; }
  .card.struck { border-style: dashed; opacity: 0.45; }
  .card .note { font-size: 0.75rem; }
  .faint { color: var(--faint); }
  .row { display: flex; gap: 0.5rem; }
</style>
