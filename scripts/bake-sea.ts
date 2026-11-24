/**
 * Survey the sea and pack it for the browser: `npm run bake`. Run it after
 * changing the world graph, the ports, the lanes or the landmarks; the tests
 * fail until the packing matches the survey.
 */
import { writeFileSync } from 'node:fs';
import { buildMap, packSea } from '../src/world/survey.ts';

const packed = packSea(buildMap());
writeFileSync(new URL('../src/world/data/sea.json', import.meta.url), JSON.stringify(packed));
console.log(`sea.json: ${packed.count} nodes, ${packed.lanes.length / 2} lanes, ${packed.legs.length / 4} legs of day-steps, coast ${packed.coast.length} characters`);
