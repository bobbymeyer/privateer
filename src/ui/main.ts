import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';

const target = document.getElementById('app')!;
// The page's own "charting the seas…" has done its job.
target.replaceChildren();
export default mount(App, { target });
