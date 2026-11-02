<script lang="ts">
  import { COLORS } from '../world/colors.ts';
  import { adjective, type Nation } from '../world/ports.ts';

  /** A nation's colours as a small swatch, for lists and headings. */
  let { nation, size = 14 }: { nation: Nation; size?: number } = $props();
  const c = $derived(COLORS[nation]);
</script>

<svg class="flag" width={size * 1.4} height={size} viewBox="0 0 14 10" role="img" aria-label="{adjective(nation)} colours">
  <rect x="1" y="1" width="12" height="8" fill={c.field} stroke={c.border} stroke-width="2" />
  <rect x="0.25" y="0.25" width="13.5" height="9.5" fill="none" stroke="var(--ink)" stroke-width="0.5" />
</svg>

<style>
  .flag { display: inline-block; vertical-align: -0.1em; margin-right: 0.35em; flex: none; }
</style>
