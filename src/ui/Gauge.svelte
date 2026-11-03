<script lang="ts">
  import { untrack } from 'svelte';
  /**
   * A row of pips: filled for what is left, hollow for what is gone. When
   * the value changes, the pips that changed flash — drained, or filled —
   * and the difference floats off the number, so a round's damage can be
   * read at a glance rather than counted.
   */
  let { value, max, label, color = 'var(--ink)' }: { value: number; max: number; label: string; color?: string } = $props();

  // What it was before the last change, and how many changes there have
  // been: the count keys the flash, so it plays again on every change.
  let before = $state(untrack(() => value));
  let changes = $state(0);
  let last = untrack(() => value);
  $effect(() => {
    if (value === last) return;
    before = last;
    last = value;
    changes++;
  });
  const delta = $derived(value - before);
  const lost = (i: number) => delta < 0 && i >= value && i < before;
  const gained = (i: number) => delta > 0 && i >= before && i < value;
</script>

<div class="gauge" style="--pip: {color}">
  <span class="label">{label}</span>
  {#key changes}
    <svg viewBox="0 0 {max * 14} 12" width={max * 14} height="12" role="img" aria-label="{label} {value} of {max}">
      {#each Array(max) as _, i}
        <rect
          x={i * 14 + 1}
          y="1"
          width="10"
          height="10"
          fill={i < value ? color : 'none'}
          stroke={color}
          stroke-width="1.5"
          class:lost={changes > 0 && lost(i)}
          class:gained={changes > 0 && gained(i)}
        />
      {/each}
    </svg>
  {/key}
  <span class="num">
    {value}/{max}
    {#key changes}
      {#if changes > 0 && delta !== 0}<span class="delta">{delta > 0 ? `+${delta}` : `−${-delta}`}</span>{/if}
    {/key}
  </span>
</div>

<style>
  .gauge { display: flex; align-items: center; gap: 0.6rem; min-width: 0; }
  /* A long row of pips shrinks to fit its column rather than running out of it. */
  .gauge svg { flex: 0 1 auto; min-width: 0; height: auto; max-height: 12px; }
  .label { flex: none; }
  .label { width: 4.5rem; }
  .num { position: relative; font-variant-numeric: tabular-nums; color: var(--faint); }

  /* A pip lost drains from full to hollow; a pip gained fills. */
  .lost { animation: drain 0.7s ease-in forwards; }
  .gained { animation: fill 0.5s ease-out; }
  @keyframes drain {
    0%, 35% { fill: var(--pip); }
    100% { fill: transparent; }
  }
  @keyframes fill {
    from { fill: transparent; }
    to { fill: var(--pip); }
  }

  /* The difference, floating up off the number and gone. */
  .delta {
    position: absolute;
    left: 0;
    bottom: 70%;
    color: var(--pip);
    white-space: nowrap;
    animation: float 1.2s ease-out forwards;
  }
  @keyframes float {
    0% { opacity: 0; transform: translateY(0.3rem); }
    15% { opacity: 1; transform: translateY(0); }
    70% { opacity: 1; }
    100% { opacity: 0; transform: translateY(-0.6rem); }
  }

  @media (prefers-reduced-motion: reduce) {
    .lost, .gained, .delta { animation: none; }
    .lost { fill: transparent; }
    .delta { display: none; }
  }
</style>
