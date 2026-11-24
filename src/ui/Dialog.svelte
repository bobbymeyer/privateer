<script lang="ts">
  /**
   * A dialog over the page: an event, a sail, the fight, the reckoning, the
   * end, how to play, the logbook. A real one for a screen reader — modal,
   * named by its first heading — and for the keyboard: focus goes to its
   * first choice when it opens, stays inside it while it's open, and goes
   * back where it was when it closes. Escape closes it only where closing is
   * safe (`onclose`); a choice that must be made has to be made.
   */
  import type { Snippet } from 'svelte';

  let { wide = false, intro = false, onclose, children }: { wide?: boolean; intro?: boolean; onclose?: () => void; children: Snippet } = $props();

  let sheet: HTMLDivElement;
  let labelledby = $state<string | undefined>(undefined);

  const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
  const focusables = () => [...sheet.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);

  $effect(() => {
    const before = document.activeElement as HTMLElement | null;
    // Named by its first heading.
    const heading = sheet.querySelector('h2, h3');
    if (heading) {
      heading.id ||= `dialog-${Math.random().toString(36).slice(2, 9)}`;
      labelledby = heading.id;
    }
    // To its first choice, or to the dialog itself if it has none yet.
    (sheet.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0] ?? sheet).focus({ preventScroll: true });
    return () => {
      // Back where it was, if that's still on the page; else to the voyage's own next step.
      if (before && document.body.contains(before)) before.focus({ preventScroll: true });
      else document.querySelector<HTMLElement>('.primary button:not([disabled])')?.focus({ preventScroll: true });
    };
  });

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && onclose) {
      e.stopPropagation();
      onclose();
      return;
    }
    if (e.key !== 'Tab') return;
    // Kept inside while it's open.
    const els = focusables();
    if (!els.length) return e.preventDefault();
    const [first, last] = [els[0], els[els.length - 1]];
    if (e.shiftKey && (document.activeElement === first || !sheet.contains(document.activeElement))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
</script>

<div class="overlay" role="presentation" {onkeydown}>
  <div class="sheet" class:wide class:intro bind:this={sheet} role="dialog" aria-modal="true" aria-labelledby={labelledby} tabindex="-1">
    {@render children()}
  </div>
</div>

<style>
  .overlay { position: fixed; inset: 0; background: rgba(255, 255, 255, 0.92); display: grid; place-items: start center; overflow: auto; padding: 2rem 16px; z-index: 2; }
  .sheet { width: min(44rem, 100%); background: var(--paper); border: 1.5px solid var(--ink); padding: 1.25rem; }
  .sheet:focus { outline: none; }
  .sheet.wide { width: min(60rem, 100%); }
  @media (max-width: 600px) {
    .overlay { padding: 1rem 8px; }
    .sheet { padding: 1rem; }
  }
</style>
