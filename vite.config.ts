import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [svelte()],
  // Relative asset paths, so the build runs from whatever path the site puts it under.
  base: './',
});
