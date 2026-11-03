/**
 * The grain of the world's sea: the currents that carry a ship, the winds
 * that drive it, the banks a deep keel keeps off, and the great courses
 * ships kept. Hand-written, longitude and latitude; Pacific paths may run
 * past ±180°, which the geometry wraps.
 */

import type { LonLat } from './geo.ts';

/**
 * Currents as streams: a line the water runs along, how hard, and how wide
 * (degrees) before it fades.
 */
export const STREAMS: { name: string; path: LonLat[]; strength: number; width: number }[] = [
  // North Atlantic gyre
  { name: 'Gulf Stream', strength: 1.5, width: 1.2, path: [[-81.6, 23.7], [-80.1, 24.6], [-79.8, 27], [-79.5, 31], [-75, 35], [-68, 38.5], [-60, 40.5], [-48, 42]] },
  { name: 'North Atlantic Drift', strength: 0.6, width: 4, path: [[-48, 44], [-35, 48], [-22, 51], [-12, 55], [-2, 60], [8, 65]] },
  { name: 'Canary Current', strength: 0.5, width: 4, path: [[-14, 42], [-14, 34], [-17, 26], [-20, 20], [-24, 15]] },
  { name: 'North Equatorial Current', strength: 0.6, width: 5, path: [[-22, 15], [-35, 15], [-48, 14.5], [-58, 14], [-62, 14.5]] },
  { name: 'Antilles Current', strength: 0.4, width: 2, path: [[-61, 19.5], [-67, 20.3], [-72, 21.8], [-75.5, 24], [-78.5, 27], [-79.6, 29]] },
  { name: 'Caribbean Current', strength: 0.8, width: 2.5, path: [[-60, 13.5], [-65, 14.3], [-70, 14.8], [-75, 15.3], [-80, 16.4], [-84, 18.6], [-85.9, 20.8]] },
  { name: 'Yucatán and Loop', strength: 1.0, width: 1.5, path: [[-85.9, 20.6], [-86.2, 22.5], [-87, 25], [-87.3, 26.6], [-86, 27.2], [-84.3, 26.2], [-83.6, 24.6], [-82.2, 23.8], [-80.6, 24.0]] },
  { name: 'Panama eddy', strength: 0.4, width: 1.4, path: [[-83, 10.8], [-80.5, 9.9], [-77.5, 9.4], [-76.2, 10.2], [-75.5, 11.2], [-77, 12.2], [-80.5, 12.6], [-82.5, 11.8]] },
  { name: 'Guinea Current', strength: 0.5, width: 2, path: [[-15, 6], [-5, 4.5], [3, 4], [8, 3.5]] },
  // South Atlantic gyre
  { name: 'South Equatorial Current', strength: 0.6, width: 4, path: [[8, -1], [-5, -2], [-20, -3], [-32, -4]] },
  { name: 'North Brazil Current', strength: 0.7, width: 2.5, path: [[-34, -5], [-40, -1.5], [-47, 1.5], [-53, 5.5], [-58, 8], [-61, 11]] },
  { name: 'Brazil Current', strength: 0.5, width: 2.5, path: [[-35, -9], [-38, -16], [-41, -23], [-47, -29], [-53, -36]] },
  { name: 'Benguela Current', strength: 0.5, width: 4, path: [[16, -35], [13, -28], [11, -20], [9, -12], [7, -4]] },
  // The Southern Ocean
  { name: 'West Wind Drift', strength: 0.8, width: 6, path: [[-180, -52], [-150, -55], [-120, -56], [-90, -57], [-70, -58], [-55, -55], [-30, -50], [0, -47], [30, -44], [60, -45], [90, -46], [120, -48], [150, -50], [180, -52]] },
  // Pacific
  { name: 'Humboldt Current', strength: 0.6, width: 4, path: [[-76, -45], [-75, -35], [-76, -24], [-79, -12], [-83, -4], [-88, -1]] },
  { name: 'South Equatorial Current, Pacific', strength: 0.6, width: 6, path: [[-88, -2], [-110, -4], [-140, -6], [-170, -9], [165, -12], [150, -14]] },
  { name: 'East Australian Current', strength: 0.7, width: 2, path: [[153.5, -16], [154.5, -25], [153, -32], [151, -37]] },
  { name: 'North Equatorial Current, Pacific', strength: 0.6, width: 5, path: [[-108, 13], [-130, 13], [-160, 13], [180, 13], [155, 13.5], [135, 14], [125, 14.5]] },
  { name: 'Equatorial Countercurrent', strength: 0.4, width: 3, path: [[130, 6], [160, 6.5], [-170, 7], [-130, 7], [-95, 6]] },
  { name: 'Kuroshio', strength: 1.3, width: 2, path: [[122, 20], [124, 25], [129, 29], [134, 32.5], [141, 35.5], [150, 37]] },
  { name: 'North Pacific Current', strength: 0.5, width: 5, path: [[152, 39], [170, 41], [-170, 42], [-150, 42], [-132, 42]] },
  { name: 'California Current', strength: 0.5, width: 4, path: [[-128, 46], [-125, 40], [-120, 32], [-115, 24], [-110, 17]] },
  // Indian Ocean
  { name: 'South Equatorial Current, Indian', strength: 0.6, width: 5, path: [[115, -12], [95, -12], [75, -12], [60, -13], [50, -13]] },
  { name: 'Agulhas Current', strength: 1.2, width: 2, path: [[40, -12], [41, -18], [36, -25], [32, -30], [27, -34], [21, -37]] },
  { name: 'West Australian Current', strength: 0.4, width: 4, path: [[112, -34], [110, -28], [106, -20], [100, -14]] },
];

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

/**
 * Wind, as a smooth model of the global circulation: trades between the
 * equator and about 30°, blowing toward the west and the equator; westerlies
 * from 30° to 60°, toward the east and the pole, harder in the south (the
 * Roaring Forties); the doldrums slack at the equator. The whole pattern
 * follows the sun north and south through the year. Over the Arabian Sea,
 * the Bay of Bengal and the South China Sea, the monsoon overrides it:
 * toward the north-east in the summer, the south-west in the winter.
 */
export const WIND = {
  /** How far north the belts sit, by season (degrees): winter, spring, summer, autumn of the north. */
  shift: [-4, 0, 4, 0],
  /** The southern westerlies, against the northern. */
  roaring: 1.4,
  monsoon: {
    regions: [
      { west: 42, east: 100, south: -5, north: 26 },
      { west: 100, east: 125, south: 0, north: 25 },
    ],
    /** Bearing the monsoon blows toward, and how hard, by season. Null: the belts as usual. */
    seasons: [{ toward: 225, strength: 0.9 }, null, { toward: 45, strength: 1.0 }, null] as ({ toward: number; strength: number } | null)[],
  },
  /** Gulf of Mexico northers in the winter. */
  norther: { west: -98, east: -80, north: 31, south: 23, toward: 180, strength: 0.9 },
};

/** A turn is a day; a season a quarter of the year. */
export const SEASON_LENGTH = 91;
export const SEASON_NAMES = ['winter', 'spring', 'summer', 'autumn'];

/**
 * Who sails a fixed course, port to port in order and round again.
 *
 * - The flota and the galeones leave Cádiz by the Canaries, come in through
 *   the islands, load silver (the flota at Veracruz, the galeones at
 *   Cartagena and Portobelo), meet at Havana, and run home up the Gulf Stream.
 * - The Manila galleon crosses the Pacific each way: west on the trades,
 *   back east on the westerlies.
 * - The South Sea fleet brings Potosí silver up from Arica and Callao to
 *   Panama.
 * - The Portuguese carreira and the Dutch return fleet run to the Indies by
 *   the Cape.
 * - The armadas patrol.
 */
/**
 * The great crossings, where trade went across open water rather than port
 * to port along a coast: to the Americas, round Africa, across the Pacific.
 * The sea lanes are the shortest paths between these pairs, between each
 * port and its nearest neighbours, and along the great courses below.
 */
export const OCEAN_LANES: [string, string][] = [
  ['Plymouth', 'Bridgetown'],
  ['Plymouth', 'Jamestown'],
  ['Plymouth', 'Bermuda'],
  ['Bristol', 'Boston'],
  ['Brest', 'Quebec'],
  ['Saint-Malo', 'Saint-Pierre'],
  ['Amsterdam', 'New Amsterdam'],
  ['Amsterdam', 'Elmina'],
  ['Lisbon', 'Salvador'],
  ['Lisbon', 'Recife'],
  ['Luanda', 'Salvador'],
  ['Rio de Janeiro', 'Buenos Aires'],
  ['Buenos Aires', 'Valdivia'],
  ['Valparaíso', 'Rapa Nui'],
  ['Callao', 'Acapulco'],
  ['Acapulco', 'Kealakekua'],
  ['Kealakekua', 'Matavai'],
  ['Matavai', 'Nuku Hiva'],
  ['Matavai', 'Nuku’alofa'],
  ['Kealakekua', 'Umatac'],
  ['Cape Town', 'Goa'],
  ['Goa', 'Mocha'],
  ['Batavia', 'Malacca'],
  ['Malacca', 'Macau'],
  ['Macau', 'Nagasaki'],
  ['Cape Town', 'Elmina'],
];

export const ROUTES: Record<string, string[]> = {
  flota: ['Cádiz', 'Las Palmas', 'San Juan', 'Veracruz', 'Havana'],
  galeones: ['Cádiz', 'Las Palmas', 'Cartagena', 'Portobelo', 'Cartagena', 'Havana'],
  'manila galleon': ['Acapulco', 'Umatac', 'Manila'],
  'south sea fleet': ['Arica', 'Callao', 'Panama', 'Callao'],
  carreira: ['Lisbon', 'Mozambique', 'Goa'],
  retourvloot: ['Amsterdam', 'Cape Town', 'Batavia', 'Cape Town'],
  barlovento: ['Veracruz', 'Havana', 'Santo Domingo', 'San Juan', 'Cartagena', 'Portobelo', 'Campeche'],
  'mar océano': ['Cádiz', 'Angra', 'Lisbon'],
};
