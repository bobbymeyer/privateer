<script lang="ts">
  import { describeEvent, OUTCOME_TEXT, RAID_OUTCOME_TEXT } from '../describe.ts';
  import { threatened, type Action, type EncounterState, type GameEvent } from '../rules.ts';
  import type { Reckoning } from '../world/meet.ts';
  import { adjective, type Nation } from '../world/ports.ts';
  import Flag from './Flag.svelte';
  import CardView from './CardView.svelte';
  import Gauge from './Gauge.svelte';

  let {
    fight,
    lastRound,
    reckoning = null,
    title,
    isRaid = false,
    nation,
    onact,
    oncontinue,
  }: {
    fight: EncounterState;
    lastRound: GameEvent[];
    /** Set once the fight is over and settled. */
    reckoning?: Reckoning | null;
    /** What you're fighting, as a heading: an English merchant, the raid on Maracaibo. */
    title: string;
    /** A raid on a port, rather than a ship. */
    isRaid?: boolean;
    /** Whose she is, for her colours. */
    nation: Nation;
    onact: (a: Action) => void;
    oncontinue: () => void;
  } = $props();

  let picks: number[] = $state([]);
  const waiting = (side: 'ship' | 'target') => fight.deck.filter((c) => c.damage && c.side === side).length;
  const bottom = $derived(fight.deck.at(-1) ?? null);
  const bottomCopy = $derived(bottom && !bottom.damage && !bottom.id.startsWith('reinforce') ? bottom.id.split('#')[1] : null);
  const spent = (side: 'ship' | 'target') => fight.discard.filter((c) => c.side === side && !c.damage).length;

  function toggle(i: number) {
    if (fight.outcome) return;
    if (picks.includes(i)) picks = picks.filter((p) => p !== i);
    else if (picks.length < 2) picks = [...picks, i];
  }

  function resolve() {
    if (picks.length !== 2) return;
    const action: Action = { type: 'keep', picks: [picks[0], picks[1]] };
    picks = [];
    onact(action);
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // The fight has the keys: none go through to whatever button is focused behind it.
    if (['1', '2', '3', 'Enter', ' '].includes(e.key)) e.preventDefault();
    if (fight.outcome) {
      if (e.key === 'Enter') oncontinue();
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

<section class="fight" aria-label="encounter">
  <header>
    <h2><Flag {nation} size={18} />{title}</h2>
    <p class="meta">round {fight.round} · {fight.deck.length} in the deck</p>
  </header>

  <div class="ships">
    <div class="ship">
      <h3>you</h3>
      <Gauge label="hull" value={fight.ship.hull} max={fight.ship.maxHull} />
      <p>plunder {fight.plunder}{#if fight.ship.brace} · brace {fight.ship.brace}{/if}</p>
      {#if !fight.outcome}
        <p class="status">{waiting('ship')} damage waiting in the deck · {spent('ship')} of your cards spent</p>
        <p class="status">{@render state(threatened(fight.ship, fight.target), fight.ship.held)}</p>
      {/if}
    </div>
    <div class="ship theirs">
      <h3>{fight.target.name}</h3>
      <Gauge label="hull" value={fight.target.hull} max={fight.target.maxHull} color="var(--theirs)" />
      <p>cargo {fight.target.cargo} · bounty {fight.target.bounty}</p>
      {#if !fight.outcome}
        <p class="status">{waiting('target')} damage waiting in the deck · {spent('target')} of theirs spent</p>
        <p class="status">{@render state(threatened(fight.target, fight.ship), fight.target.held)}</p>
      {/if}
    </div>
  </div>

  {#if fight.outcome}
    <div class="outcome">
      <h3>{(isRaid ? RAID_OUTCOME_TEXT : OUTCOME_TEXT)[fight.outcome]}</h3>
      <p>you come away with {fight.payout}</p>
      {#if reckoning?.heard}<p>prisoners talked: {reckoning.heard} {reckoning.heard === 1 ? 'rumor' : 'rumors'}</p>{/if}
      {#if reckoning?.attacked}<p>the {adjective(reckoning.nation)} will remember this</p>{/if}
      <button onclick={oncontinue}>{fight.outcome === 'sunk' ? 'the end' : 'back to sea'}</button>
    </div>
  {:else}
    <p class="prompt">keep two. they resolve in the order you pick them, and then they're spent; the third goes to the bottom. spent cards come back only when a card recalls them.</p>
    <div class="hand">
      {#each fight.hand as card, i (card.id)}
        <CardView {card} order={picks.includes(i) ? picks.indexOf(i) + 1 : null} disabled={picks.length === 2 && !picks.includes(i)} onpick={() => toggle(i)} />
      {/each}
    </div>
    <button onclick={resolve} disabled={picks.length < 2}>resolve</button>
    <p class="status">
      {#if bottom}at the bottom of the deck: {bottom.name}{bottomCopy ? ` #${bottomCopy}` : ''} ({bottom.damage ? (bottom.side === 'ship' ? 'a wound to you' : 'a wound to them') : bottom.side === 'ship' ? 'yours' : 'theirs'}){/if}
      {#if fight.reinforce} · relief still to come: {fight.reinforce.count - fight.reinforced}{fight.reinforced < fight.reinforce.count && fight.round < fight.reinforce.from ? `, from round ${fight.reinforce.from}` : ''}{/if}
    </p>
  {/if}

  {#if lastRound.length}
    <div class="log" aria-live="polite">
      <h3>last round</h3>
      <ul>
        {#each lastRound as e}
          {@const line = describeEvent(e)}
          {#if line}<li class={e.type}>{line}</li>{/if}
        {/each}
      </ul>
    </div>
  {/if}
  <p class="keys">{fight.outcome ? 'enter to go on' : '1 2 3 pick · enter resolve'}</p>
</section>

<style>
  .fight { display: flex; flex-direction: column; gap: 1.25rem; }
  h2 { margin: 0; font-size: 1.5rem; font-weight: 400; letter-spacing: -0.025em; }
  h3 { margin: 0 0 0.5rem; font-size: 1.05rem; font-weight: 400; }
  p { margin: 0.3rem 0 0; }
  .meta, .prompt, .keys, .log, .status { color: var(--faint); }
  .status { font-size: 0.85rem; }
  .ships { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
  .theirs { color: var(--theirs); }
  .hand { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
  .outcome h3 { font-size: 1.4rem; letter-spacing: -0.025em; }
  .outcome button { margin-top: 0.75rem; }
  .log ul { list-style: none; margin: 0; padding: 0; }
  .log li.played { color: var(--ink); margin-top: 0.4rem; }
  .log li.effect { padding-left: 1rem; }
  .log li.rejected { font-style: italic; }
  .keys { font-size: 0.8rem; border-top: 1px dashed var(--rule); padding-top: 0.75rem; }
  @media (max-width: 34rem) {
    .ships, .hand { grid-template-columns: 1fr; }
  }
</style>
