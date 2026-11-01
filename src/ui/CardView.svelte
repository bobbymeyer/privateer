<script lang="ts">
  import type { Card } from '../cards.ts';

  let { card, order, disabled = false, onpick }: {
    card: Card;
    /** 1 or 2 when picked, null when not. */
    order: number | null;
    disabled?: boolean;
    onpick: () => void;
  } = $props();
</script>

<button class="card" class:theirs={card.side === 'target'} class:picked={order !== null} {disabled} onclick={onpick} aria-pressed={order !== null}>
  <span class="side">{card.side === 'ship' ? 'yours' : 'theirs'}</span>
  <span class="name">{card.name}</span>
  <span class="text">{card.text}</span>
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
  .card.picked { border-width: 4px; padding: calc(0.8rem - 2.5px); }
  .side { font-size: 0.75rem; letter-spacing: 0.08em; }
  .name { font-size: 1.15rem; }
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
