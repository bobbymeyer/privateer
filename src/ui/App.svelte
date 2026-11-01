<script lang="ts">
  import { describeEvent, OUTCOME_TEXT } from '../describe.ts';
  import { act, threatened, type Action, type EncounterState, type GameEvent } from '../rules.ts';
  import { merchantEncounter } from '../setup.ts';
  import CardView from './CardView.svelte';
  import Gauge from './Gauge.svelte';

  function seedFromUrl(): number {
    const raw = new URLSearchParams(location.search).get('seed');
    const n = raw === null ? NaN : Number(raw);
    return Number.isInteger(n) ? n : Math.floor(Math.random() * 2 ** 31);
  }

  const firstSeed = seedFromUrl();
  let seed = $state(firstSeed);
  // Rules return new objects rather than mutating, so raw state is enough.
  let game: EncounterState = $state.raw(merchantEncounter(firstSeed));
  let picks: number[] = $state([]);

  /** Damage cards against a side still waiting in the deck. */
  const waiting = (side: 'ship' | 'target') => game.deck.filter((c) => c.damage && c.side === side).length;
  let lastRound: GameEvent[] = $state.raw([]);

  $effect(() => {
    const url = new URL(location.href);
    url.searchParams.set('seed', String(seed));
    history.replaceState(null, '', url);
  });

  function toggle(i: number) {
    if (game.outcome) return;
    if (picks.includes(i)) picks = picks.filter((p) => p !== i);
    else if (picks.length < 2) picks = [...picks, i];
  }

  function play(action: Action) {
    const before = game.events.length;
    game = act(game, action);
    lastRound = game.events.slice(before).filter((e) => e.type === 'played' || e.type === 'effect' || e.type === 'rejected');
    picks = [];
  }

  function resolve() {
    if (picks.length === 2) play({ type: 'keep', picks: [picks[0], picks[1]] });
  }

  function newEncounter() {
    seed = Math.floor(Math.random() * 2 ** 31);
    game = merchantEncounter(seed);
    lastRound = [];
    picks = [];
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (game.outcome) {
      if (e.key === 'Enter' || e.key === 'n') newEncounter();
      return;
    }
    if (['1', '2', '3'].includes(e.key)) toggle(Number(e.key) - 1);
    else if (e.key === 'Enter') resolve();
  }
</script>

<svelte:window {onkeydown} />

{#snippet state(isThreatened: boolean, held: number)}
  {(isThreatened ? 'threatened: flee cards work' : 'not threatened: flee cards do nothing') + (held ? ` · held ${held}` : '')}
{/snippet}

<main>
  <header>
    <h1>privateer</h1>
    <p class="meta">round {game.round} · {game.deck.length} in the deck · seed {seed}</p>
  </header>

  <section class="ships">
    <div class="ship">
      <h2>you</h2>
      <Gauge label="hull" value={game.ship.hull} max={game.ship.maxHull} />
      <p>plunder {game.plunder}{#if game.ship.brace} · brace {game.ship.brace}{/if}</p>
      {#if !game.outcome}<p class="status">{waiting('ship')} damage waiting in the deck</p>{/if}
      {#if !game.outcome}<p class="status">{@render state(threatened(game.ship), game.ship.held)}</p>{/if}
    </div>
    <div class="ship theirs">
      <h2>{game.target.name}</h2>
      <Gauge label="hull" value={game.target.hull} max={game.target.maxHull} color="var(--theirs)" />
      <p>cargo {game.target.cargo} · bounty {game.target.bounty}</p>
      {#if !game.outcome}<p class="status">{waiting('target')} damage waiting in the deck</p>{/if}
      {#if !game.outcome}<p class="status">{@render state(threatened(game.target), game.target.held)}</p>{/if}
    </div>
  </section>

  {#if game.outcome}
    <section class="outcome">
      <h2>{OUTCOME_TEXT[game.outcome]}</h2>
      <p class="payout">you walk away with {game.payout}{#if game.intel.length} and {game.intel.length} {game.intel.length === 1 ? 'rumor' : 'rumors'} from prisoners{/if}</p>
      <button onclick={newEncounter}>new encounter</button>
    </section>
  {:else}
    <section>
      <p class="prompt">keep two. they resolve in the order you pick them; the third goes to the bottom. shot puts damage cards on top of the deck; hull only drops when one is kept. a flee card only works for a ship at half hull or less.</p>
      <div class="hand">
        {#each game.hand as card, i (card.id)}
          <CardView {card} order={picks.includes(i) ? picks.indexOf(i) + 1 : null} disabled={picks.length === 2 && !picks.includes(i)} onpick={() => toggle(i)} />
        {/each}
      </div>
      <div class="actions">
        <button onclick={resolve} disabled={picks.length < 2}>resolve</button>
      </div>
    </section>
  {/if}

  {#if lastRound.length}
    <section class="log" aria-live="polite">
      <h2>last round</h2>
      <ul>
        {#each lastRound as e}
          {@const line = describeEvent(e)}
          {#if line}<li class={e.type}>{line}</li>{/if}
        {/each}
      </ul>
    </section>
  {/if}

  <footer class="keys">
    {#if game.outcome}enter new encounter{:else}1 2 3 pick · enter resolve{/if}
  </footer>
</main>

<style>
  main {
    max-width: 44rem;
    margin: 0 auto;
    padding: 2rem 16px 3rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }
  h1 { margin: 0; font-size: 2rem; font-weight: 400; letter-spacing: -0.025em; }
  h2 { margin: 0 0 0.6rem; font-size: 1.1rem; font-weight: 400; }
  p { margin: 0.4rem 0 0; }
  .meta, .prompt, .keys, .log { color: var(--faint); }
  .ships { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
  .ship.theirs { color: var(--theirs); }
  .status { font-size: 0.85rem; }
  .hand { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-top: 1rem; }
  .actions { display: flex; gap: 0.75rem; margin-top: 1rem; flex-wrap: wrap; }
  .outcome h2 { font-size: 1.6rem; letter-spacing: -0.025em; }
  .payout { margin-bottom: 1rem; }
  .log ul { list-style: none; margin: 0; padding: 0; }
  .log li { padding: 0.1rem 0; }
  .log li.played { color: var(--ink); margin-top: 0.5rem; }
  .log li.effect { padding-left: 1rem; }
  .log li.rejected { margin-top: 0.5rem; font-style: italic; }
  .keys { font-size: 0.8rem; border-top: 1px dashed var(--rule); padding-top: 1rem; }
  @media (max-width: 34rem) {
    .ships { grid-template-columns: 1fr; }
    .hand { grid-template-columns: 1fr; }
  }
</style>
