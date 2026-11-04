<script lang="ts">
  import type { Card } from '../cards.ts';
  import { explainCard } from '../describe.ts';

  let { card, order, disabled = false, note = '', onpick }: {
    card: Card;
    /** 1 or 2 when picked, null when not. */
    order: number | null;
    disabled?: boolean;
    /** A word on the card's corner: `out of range`, `her next card`. */
    note?: string;
    onpick: () => void;
  } = $props();

  /**
   * Which copy of its card this is — `return fire #3` — so a card sent under
   * the deck can be told from another of the same name. Wounds and relief
   * are made one at a time and have no copies.
   */
  const copy = $derived(card.damage || card.id.startsWith('reinforce') ? null : (card.id.split('#')[1] ?? null));
</script>

<button class="card" class:theirs={card.side === 'target'} class:damage={card.damage} class:picked={order !== null} {disabled} onclick={onpick} aria-pressed={order !== null} title={explainCard(card.text)}>
  <span class="side">{card.damage ? (card.side === 'ship' ? 'a wound to you' : 'a wound to them') : card.side === 'ship' ? 'yours' : 'theirs'}</span>
  <span class="name">{card.name}{#if copy}<span class="copy"> #{copy}</span>{/if}</span>
  <span class="text">{card.text}</span>
  {#if note}<span class="note">{note}</span>{/if}
  {#if order !== null}<span class="order" aria-label="resolves {order === 1 ? 'first' : 'second'}">{order}</span>{/if}
</button>

<style>
  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    width: 100%;
    min-height: 9rem;
    padding: 0.8rem;
    border-width: 1.5px;
  }
  .card.theirs { border-color: var(--theirs); color: var(--theirs); }
  .card.damage { border-style: dashed; }
  .card.picked { border-width: 4px; padding: calc(0.8rem - 2.5px); }
  .side { font-size: 0.75rem; letter-spacing: 0.08em; }
  .copy { font-size: 0.8em; opacity: 0.6; }
  .name { font-size: 1.15rem; }
  .note { font-size: 0.75rem; letter-spacing: 0.06em; opacity: 0.7; }
  .text { margin-top: auto; font-variant-numeric: tabular-nums; }
  /* The resolve order, set in paper on an ink disc. */
  .order {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    width: 1.5rem;
    height: 1.5rem;
    display: grid;
    place-items: center;
    border-radius: 50%;
    color: var(--paper);
    background: var(--ink);
  }
  .theirs .order { background: var(--theirs); }
  @media (max-width: 34rem) { .card { min-height: 6.5rem; } }
</style>
