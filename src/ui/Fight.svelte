<script lang="ts">
  import { describeEvent, GLOSSARY, OUTCOME_TEXT, RAID_OUTCOME_TEXT } from '../describe.ts';
  import { chained, linksFor, threatened, type Action, type EncounterState, type GameEvent } from '../rules.ts';
  import { type Card, REACHES, cardType } from '../cards.ts';
  import type { Reckoning } from '../world/meet.ts';
  import { adjective, type Nation } from '../world/ports.ts';
  import Flag from './Flag.svelte';
  import CardView from './CardView.svelte';
  import Gauge from './Gauge.svelte';
  import { fade, fly } from 'svelte/transition';

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

  // Motion, unless the reader has asked for none.
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** A card dealt off the deck, from the left, one after another; a wound drops onto it from above. */
  const deal = (node: Element, { i, wound }: { i: number; wound: boolean }) =>
    fly(node, still ? { duration: 0 } : wound ? { y: -36, duration: 320, delay: 120 + i * 110 } : { x: -48, duration: 260, delay: i * 110 });
  /** The round's lines, one at a time, as they happened. */
  const told = (node: Element, { i }: { i: number }) => fade(node, still ? { duration: 0 } : { duration: 200, delay: i * 90 });
  const waiting = (side: 'ship' | 'target') => (side === 'ship' ? fight.deck : fight.herDeck).filter((c) => c.damage && c.side === side).length;
  /**
   * The links each card in hand would make: a picked card, in the order
   * picked; an unpicked one, if it were picked next.
   */
  const links = $derived.by(() => {
    let chain = fight.chain;
    const out = fight.hand.map(() => 0);
    for (const i of picks) {
      const c = fight.hand[i];
      const t = cardType(c);
      out[i] = inRange(c) ? linksFor(chain, t) : 0;
      chain = inRange(c) ? chained(chain, t) : t === 'hands' ? chain : { last: null, links: 0 };
    }
    fight.hand.forEach((c, i) => {
      if (!picks.includes(i) && picks.length < 2 && inRange(c)) out[i] = linksFor(chain, cardType(c));
    });
    return out;
  });
  const NEXT: Record<string, string> = { sail: 'shot', shot: 'board' };
  /** Whether any of a card's effects works at the range as it stands. */
  const inRange = (card: Card) => !card.effects.length || card.effects.some((e) => !e.at || e.at.includes(REACHES[fight.range]));
  const RANGE_WORDS = ['grappled: alongside and made fast, where boarders go across', 'close: broadside range', 'far: long guns only, and one more stretch of open water and a ship is away'];
  const bottom = $derived(fight.deck.at(-1) ?? null);
  const bottomCopy = $derived(bottom && !bottom.damage && !bottom.id.startsWith('reinforce') ? bottom.id.split('#')[1] : null);
  const spent = (side: 'ship' | 'target') => (side === 'ship' ? fight.discard : fight.herDiscard).filter((c) => c.side === side && !c.damage).length;

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

{#snippet state(isThreatened: boolean)}
  {isThreatened ? 'threatened: hard pressed, and likely to run' : ''}
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
        <p class="status">{waiting('ship')} {waiting('ship') === 1 ? 'wound' : 'wounds'} waiting in the deck · {spent('ship')} of your cards spent</p>
        <p class="status">{@render state(threatened(fight.ship, fight.target))}</p>
      {/if}
    </div>
    <div class="ship theirs">
      <h3>{fight.target.name}</h3>
      <Gauge label="hull" value={fight.target.hull} max={fight.target.maxHull} color="var(--theirs)" />
      <p>cargo {fight.target.cargo} · bounty {fight.target.bounty}</p>
      {#if !fight.outcome}
        <p class="status">{waiting('target')} {waiting('target') === 1 ? 'wound' : 'wounds'} waiting in the deck · {spent('target')} of theirs spent</p>
        <p class="status">{@render state(threatened(fight.target, fight.ship))}</p>
      {/if}
    </div>
  </div>

  <!-- The range: where the ships lie, and so what will work. -->
  <div class="range" aria-label="the range: {REACHES[fight.range]}">
    {#each REACHES as r, i}
      <span class="stop" class:here={fight.range === i}>{r}</span>
      <span class="gap" aria-hidden="true"></span>
    {/each}
    <span class="stop away">away</span>
  </div>
  <p class="status">
    the chain: sail → shot → board. {fight.chain.last ? `your last was ${fight.chain.last}${fight.chain.links ? `, ${fight.chain.links} in order` : ''}: ${NEXT[fight.chain.last]} next makes ${fight.chain.links + 1}` : 'start it with sail'}.
  </p>
  <p class="status">{RANGE_WORDS[fight.range]}{fight.target.fixed ? ' · a town goes nowhere: close is the boats offshore, grappled is the party ashore' : ''}</p>

  {#if fight.outcome}
    <div class="outcome">
      <h3>{(isRaid ? RAID_OUTCOME_TEXT : OUTCOME_TEXT)[fight.outcome]}</h3>
      <p>you come away with {fight.payout}</p>
      {#if reckoning?.heard}<p>prisoners talked: {reckoning.heard} {reckoning.heard === 1 ? 'rumor' : 'rumors'}</p>{/if}
      {#if reckoning?.attacked}<p>the {adjective(reckoning.nation)} will remember this</p>{/if}
      <button onclick={oncontinue}>{fight.outcome === 'sunk' ? 'the end' : 'back to sea'}</button>
    </div>
  {:else}
    <p class="prompt">her next card is face up. keep two of yours: they play first, in the order you pick them, then hers. the third goes under your deck. a card does only what works at the range as it stands, so close or open it first.</p>
    <div class="table">
      <div class="hand">
        {#each fight.hand as card, i (card.id)}
          <div class="slot" in:deal={{ i, wound: !!card.damage }}>
            <CardView {card} order={picks.includes(i) ? picks.indexOf(i) + 1 : null} disabled={picks.length === 2 && !picks.includes(i)} note={inRange(card) ? '' : 'out of range now'} link={links[i]} onpick={() => toggle(i)} />
          </div>
        {/each}
      </div>
      {#if fight.intent}
        <div class="intent">
          {#key fight.intent.id}
            <div class="slot" in:deal={{ i: 3, wound: !!fight.intent.damage }}>
              <CardView card={fight.intent} order={null} disabled note="her next card" onpick={() => {}} />
            </div>
          {/key}
        </div>
      {/if}
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
      {#key fight.round}
        <ul>
          {#each lastRound.filter((e) => describeEvent(e)) as e, i}
            <li class={e.type} in:told={{ i }}>{describeEvent(e)}</li>
          {/each}
        </ul>
      {/key}
    </div>
  {/if}
  <details class="glossary">
    <summary>what the cards say</summary>
    <dl>
      {#each GLOSSARY as g}<dt>{g.word}</dt><dd>{g.means}</dd>{/each}
    </dl>
  </details>
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
  .ship { min-width: 0; }
  .theirs { color: var(--theirs); }
  .table { display: grid; grid-template-columns: 3fr 1fr; gap: 1.25rem; align-items: start; }
  .intent { border-left: 1px dashed var(--rule); padding-left: 1.25rem; }
  .hand { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
  .range { display: flex; align-items: center; gap: 0; }
  .range .stop { padding: 0.2rem 0.6rem; border: 1.5px solid var(--rule); color: var(--faint); transition: background 0.25s, color 0.25s; }
  .range .stop.here { border-color: var(--ink); background: var(--ink); color: var(--paper); }
  .range .stop.away { border-style: dashed; }
  .range .gap { flex: 0 0 1.25rem; height: 1.5px; background: var(--rule); }
  .slot { display: grid; }
  .outcome h3 { font-size: 1.4rem; letter-spacing: -0.025em; }
  .outcome button { margin-top: 0.75rem; }
  .log ul { list-style: none; margin: 0; padding: 0; }
  .log li.played { color: var(--ink); margin-top: 0.4rem; }
  .log li.effect { padding-left: 1rem; }
  .log li.rejected { font-style: italic; }
  .glossary { color: var(--faint); font-size: 0.85rem; }
  .glossary summary { cursor: pointer; }
  .glossary dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.25rem 1rem; margin: 0.5rem 0 0; }
  .glossary dt { color: var(--ink); }
  .glossary dd { margin: 0; }
  .keys { font-size: 0.8rem; border-top: 1px dashed var(--rule); padding-top: 0.75rem; }
  @media (max-width: 40rem) {
    .table { grid-template-columns: 1fr; }
    .intent { border-left: none; padding-left: 0; border-top: 1px dashed var(--rule); padding-top: 0.75rem; }
  }
  @media (max-width: 34rem) {
    .ships, .hand { grid-template-columns: 1fr; }
  }
</style>
