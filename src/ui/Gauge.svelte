<script lang="ts">
  /** A row of pips: filled for what is left, hollow for what is gone. */
  let { value, max, label, color = 'var(--ink)' }: { value: number; max: number; label: string; color?: string } = $props();
</script>

<div class="gauge">
  <span class="label">{label}</span>
  <svg viewBox="0 0 {max * 14} 12" width={max * 14} height="12" role="img" aria-label="{label} {value} of {max}">
    {#each Array(max) as _, i}
      <rect x={i * 14 + 1} y="1" width="10" height="10" fill={i < value ? color : 'none'} stroke={color} stroke-width="1.5" />
    {/each}
  </svg>
  <span class="num">{value}/{max}</span>
</div>

<style>
  .gauge { display: flex; align-items: center; gap: 0.6rem; }
  .label { width: 4.5rem; }
  .num { font-variant-numeric: tabular-nums; color: var(--faint); }
</style>
