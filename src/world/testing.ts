/** For tests that sail a long way about something else: holds that never empty, and no scurvy. */
import type { WorldState } from './world.ts';

export const victualled = (w: WorldState): WorldState => ({ ...w, stores: { ...w.stores, food: 1e9, water: 1e9 }, fresh: -1e9 });
