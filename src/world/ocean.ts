/**
 * The grain of the world's sea, as the chart's lanes are built from it: the
 * rivers, straits and banks, the great crossings, and the courses ships kept. Hand-written, longitude and latitude; Pacific paths may run
 * past ±180°, which the geometry wraps.
 */

import type { LonLat } from './geo.ts';

/** River mouths push water out to sea. */
export const RIVERS: { name: string; at: LonLat; seaward: number; strength: number }[] = [
  // `seaward`: compass bearing the water runs out on, degrees.
  { name: 'Amazon', at: [-49.5, 0.3], seaward: 45, strength: 0.9 },
  { name: 'Orinoco', at: [-60.9, 8.7], seaward: 45, strength: 0.7 },
  { name: 'Mississippi', at: [-89.25, 29.0], seaward: 160, strength: 0.6 },
  { name: 'Río de la Plata', at: [-56.5, -35.5], seaward: 120, strength: 0.6 },
  { name: 'Congo', at: [12.3, -6.0], seaward: 270, strength: 0.7 },
  { name: 'Niger', at: [6.0, 4.3], seaward: 190, strength: 0.4 },
  { name: 'St. Lawrence', at: [-67.5, 49.2], seaward: 90, strength: 0.4 },
  { name: 'Ganges', at: [89.0, 21.5], seaward: 180, strength: 0.6 },
  { name: 'Indus', at: [67.3, 24.0], seaward: 220, strength: 0.4 },
  { name: 'Yangtze', at: [122.0, 31.3], seaward: 100, strength: 0.6 },
  { name: 'Pearl', at: [113.7, 22.2], seaward: 180, strength: 0.4 },
  { name: 'Magdalena', at: [-74.85, 11.1], seaward: 0, strength: 0.5 },
];

/** Narrow water, besides the passages threaded by hand. Everyone passing through passes here. */
export const STRAITS: { name: string; at: LonLat }[] = [
  { name: 'Florida Straits', at: [-80.6, 24.0] },
  { name: 'Yucatán Channel', at: [-85.8, 21.6] },
  { name: 'Windward Passage', at: [-73.8, 20.0] },
  { name: 'Mona Passage', at: [-67.8, 18.2] },
  { name: 'Drake Passage', at: [-65.0, -58.0] },
  { name: 'Mozambique Channel', at: [41.0, -17.5] },
  { name: 'Torres Strait', at: [142.3, -10.3] },
  { name: 'Taiwan Strait', at: [119.5, 24.0] },
  { name: 'Luzon Strait', at: [121.0, 20.5] },
];

/** Shallow banks. Deep keels keep off them. */
export const SHOALS: { name: string; outline: LonLat[] }[] = [
  { name: 'Great Bahama Bank', outline: [[-79.4, 25.8], [-77.9, 25.4], [-75.6, 23.0], [-76.6, 21.9], [-78.5, 22.6], [-79.6, 23.6]] },
  { name: 'Little Bahama Bank', outline: [[-79.1, 27.3], [-77.0, 27.0], [-77.0, 26.2], [-78.9, 26.4]] },
  { name: 'Campeche Bank', outline: [[-91.0, 21.5], [-90.3, 22.5], [-87.5, 22.0], [-86.9, 21.4], [-90.4, 20.6]] },
  { name: 'Mosquito Bank', outline: [[-83.5, 15.2], [-81.0, 15.5], [-81.0, 13.0], [-83.3, 12.5]] },
  { name: 'Grand Banks', outline: [[-55, 47], [-50, 47.5], [-48.5, 45], [-50.5, 43], [-54, 44]] },
  { name: 'Dogger Bank', outline: [[1, 55.3], [3, 55.6], [4.5, 54.9], [2.5, 54.2], [0.8, 54.5]] },
  { name: 'Great Barrier Reef', outline: [[143.5, -11], [146.5, -15], [150, -20], [153, -24], [151.5, -24.5], [148, -21], [145, -17], [142.5, -12]] },
];

/** A turn is a day; a season a quarter of the year. */
export const SEASON_LENGTH = 91;

/**
 * Who sails a fixed course, port to port in order and round again.
 *
 * - The flota and the galeones leave Cádiz by the Canaries, come in through
 *   the islands, load silver (the flota at Veracruz, the galeones at
 *   Cartagena and Nombre de Dios), meet at Havana, and run home up the Gulf Stream.
 * - The Manila galleon crosses the Pacific each way: west on the trades,
 *   back east on the westerlies.
 * - The South Sea fleet brings Potosí silver up from Arica and Callao to
 *   Panama.
 * - The Portuguese carreira runs to the Indies by the Cape.
 * - The armadas patrol.
 */
/**
 * The great crossings, where trade went across open water rather than port
 * to port along a coast: to the Americas, round Africa, across the Pacific.
 * The sea lanes are the shortest paths between these pairs, between each
 * port and its nearest neighbours, and along the great courses below.
 */
export const OCEAN_LANES: [string, string][] = [
  ['Plymouth', 'Las Palmas'],
  ['Plymouth', 'Ribeira Grande'],
  ['Bristol', "St. John's, Newfoundland"],
  ['Saint-Malo', "St. John's, Newfoundland"],
  ['Ribeira Grande', 'Recife'],
  ['Lisbon', 'Salvador'],
  ['Luanda', 'Salvador'],
  ['Ribeira Grande', 'Cartagena'],
  ['Rio de Janeiro', 'Buenos Aires'],
  ['Buenos Aires', 'Valdivia'],
  ['Valparaíso', 'Rapa Nui'],
  ['Callao', 'Acapulco'],
  ['Acapulco', 'Kealakekua'],
  ['Kealakekua', 'Matavai'],
  ['Matavai', 'Nuku Hiva'],
  ['Matavai', 'Nuku’alofa'],
  ['Kealakekua', 'Umatac'],
  ['Table Bay', 'Goa'],
  ['Table Bay', 'Elmina'],
  ['Goa', 'Mocha'],
  ['Bantam', 'Malacca'],
  ['Malacca', 'Macau'],
  ['Macau', 'Nagasaki'],
  ['Ternate', 'Bantam'],
];

export const ROUTES: Record<string, string[]> = {
  flota: ['Cádiz', 'Las Palmas', 'San Juan', 'Veracruz', 'Havana'],
  galeones: ['Cádiz', 'Las Palmas', 'Cartagena', 'Nombre de Dios', 'Cartagena', 'Havana'],
  'manila galleon': ['Acapulco', 'Umatac', 'Manila'],
  'south sea fleet': ['Arica', 'Callao', 'Panama', 'Callao'],
  carreira: ['Lisbon', 'Mozambique', 'Goa'],
  barlovento: ['Veracruz', 'Havana', 'Santo Domingo', 'San Juan', 'Cartagena', 'Nombre de Dios', 'Campeche'],
  'mar océano': ['Cádiz', 'Angra', 'Lisbon'],
};
