/**
 * The Caribbean and the Gulf of Mexico in 16XX — the seventeenth century as
 * a setting, not a year, so ports and flags come from across it: the ports, the
 * passages and rivers and banks that shape the coastal water, and the
 * currents and winds that shape the open sea. Hand-written; positions are
 * longitude, latitude.
 *
 * Everything that is history rather than geometry lives here, so another
 * sea is another file like this one.
 */

export type Nation = 'spain' | 'england' | 'france' | 'netherlands';
type LonLat = [number, number];

export interface PortDef {
  name: string;
  at: LonLat;
  nation: Nation;
  /** Guns over the harbour. The water a leg out is under them. */
  fort: boolean;
}

export const PORTS: PortDef[] = [
  { name: 'Havana', at: [-82.36, 23.14], nation: 'spain', fort: true },
  { name: 'Veracruz', at: [-96.13, 19.2], nation: 'spain', fort: true },
  { name: 'Campeche', at: [-90.53, 19.85], nation: 'spain', fort: true },
  { name: 'Cartagena', at: [-75.55, 10.4], nation: 'spain', fort: true },
  { name: 'Portobelo', at: [-79.65, 9.55], nation: 'spain', fort: true },
  { name: 'Santo Domingo', at: [-69.88, 18.47], nation: 'spain', fort: true },
  { name: 'San Juan', at: [-66.12, 18.47], nation: 'spain', fort: true },
  { name: 'Santiago de Cuba', at: [-75.87, 19.97], nation: 'spain', fort: true },
  { name: 'St. Augustine', at: [-81.31, 29.89], nation: 'spain', fort: true },
  { name: 'Maracaibo', at: [-71.62, 10.65], nation: 'spain', fort: false },
  { name: 'Trujillo', at: [-85.95, 15.92], nation: 'spain', fort: false },
  { name: 'Cumaná', at: [-64.17, 10.46], nation: 'spain', fort: false },
  { name: 'Port of Spain', at: [-61.52, 10.65], nation: 'spain', fort: false },
  { name: 'Port Royal', at: [-76.84, 17.93], nation: 'england', fort: true },
  { name: 'Bridgetown', at: [-59.62, 13.1], nation: 'england', fort: true },
  { name: "St. John's", at: [-61.85, 17.12], nation: 'england', fort: false },
  { name: 'Charles Town', at: [-77.34, 25.08], nation: 'england', fort: false },
  { name: 'Tortuga', at: [-72.78, 20.05], nation: 'france', fort: false },
  { name: 'Petit-Goâve', at: [-72.86, 18.43], nation: 'france', fort: false },
  { name: 'Saint-Pierre', at: [-61.18, 14.74], nation: 'france', fort: false },
  { name: 'Willemstad', at: [-68.93, 12.11], nation: 'netherlands', fort: true },
  { name: 'St. Eustatius', at: [-62.98, 17.48], nation: 'netherlands', fort: false },
];

/**
 * Water on the grid that is not this sea. The Pacific: at a degree a node,
 * the isthmus is thinner than the grid and the two oceans would touch.
 * Traced down the Pacific coast, east of the Gulf of Urabá's other side.
 */
export const OUTSIDE: { name: string; outline: LonLat[] }[] = [
  {
    name: 'Pacific',
    outline: [[-99, 16.3], [-94.5, 16.1], [-92.2, 14.6], [-88, 13.4], [-86, 11.5], [-85, 10], [-83.6, 8.7], [-81.5, 8.2], [-80, 8.6], [-79.3, 9.15], [-78.3, 9.0], [-77.7, 8.0], [-77.4, 6], [-99, 6]],
  },
];

/** Narrow water between coasts. Everyone passing through passes here. */
export const STRAITS: { name: string; at: LonLat }[] = [
  { name: 'Florida Straits', at: [-80.6, 24.0] },
  { name: 'Yucatán Channel', at: [-85.8, 21.6] },
  { name: 'Windward Passage', at: [-73.8, 20.0] },
  { name: 'Mona Passage', at: [-67.8, 18.2] },
  { name: 'Old Bahama Channel', at: [-77.6, 22.5] },
  { name: 'Anegada Passage', at: [-64.0, 18.4] },
  { name: "Dragon's Mouth", at: [-61.9, 10.9] },
];

/** River mouths push fresh water out to sea: a current away from the coast. */
export const RIVERS: { name: string; at: LonLat; seaward: number; strength: number }[] = [
  // `seaward`: compass bearing the water runs out on, degrees.
  { name: 'Mississippi', at: [-89.25, 29.0], seaward: 160, strength: 0.7 },
  { name: 'Magdalena', at: [-74.85, 11.1], seaward: 0, strength: 0.6 },
  { name: 'Chagres', at: [-79.95, 9.35], seaward: 350, strength: 0.4 },
  { name: 'Orinoco', at: [-60.9, 8.7], seaward: 45, strength: 0.8 },
  { name: 'Grijalva', at: [-92.65, 18.6], seaward: 0, strength: 0.4 },
];

/** Shallow banks. Deep keels keep off them; small craft don't have to. */
export const SHOALS: { name: string; outline: LonLat[] }[] = [
  { name: 'Great Bahama Bank', outline: [[-79.4, 25.8], [-77.9, 25.4], [-75.6, 23.0], [-76.6, 21.9], [-78.5, 22.6], [-79.6, 23.6]] },
  { name: 'Little Bahama Bank', outline: [[-79.1, 27.3], [-77.0, 27.0], [-77.0, 26.2], [-78.9, 26.4]] },
  { name: 'Campeche Bank', outline: [[-91.0, 21.5], [-90.3, 22.5], [-87.5, 22.0], [-86.9, 21.4], [-90.4, 20.6]] },
  { name: 'Mosquito Bank', outline: [[-83.5, 15.2], [-81.0, 15.5], [-81.0, 13.0], [-83.3, 12.5]] },
];

/**
 * Currents as streams: a line the water runs along, how hard, and how wide
 * before it fades. Together: the Caribbean Current west through the sea,
 * north through the Yucatán Channel, the Loop round the Gulf, out through
 * the Florida Straits as the Gulf Stream; the Antilles Current outside the
 * islands; an eddy back east along Panama.
 */
export const STREAMS: { name: string; path: LonLat[]; strength: number; width: number }[] = [
  { name: 'Caribbean Current', strength: 0.8, width: 2.5, path: [[-60, 13.5], [-65, 14.3], [-70, 14.8], [-75, 15.3], [-80, 16.4], [-84, 18.6], [-85.9, 20.8]] },
  { name: 'Antilles inflow', strength: 0.5, width: 1.5, path: [[-59, 16.5], [-62, 16.2], [-65, 15.2]] },
  { name: 'Yucatán and Loop', strength: 1.0, width: 1.5, path: [[-85.9, 20.6], [-86.2, 22.5], [-87, 25], [-87.3, 26.6], [-86, 27.2], [-84.3, 26.2], [-83.6, 24.6], [-82.2, 23.8], [-80.6, 24.0]] },
  { name: 'Gulf Stream', strength: 1.6, width: 1.0, path: [[-81.6, 23.7], [-80.1, 24.6], [-79.8, 26], [-79.9, 28], [-80.2, 30], [-80.0, 31.8]] },
  { name: 'Antilles Current', strength: 0.4, width: 2.0, path: [[-61, 19.5], [-67, 20.3], [-72, 21.8], [-75.5, 24], [-78.5, 27], [-79.6, 29]] },
  { name: 'Panama eddy', strength: 0.4, width: 1.4, path: [[-83, 10.8], [-80.5, 9.9], [-77.5, 9.4], [-76.2, 10.2], [-75.5, 11.2], [-77, 12.2], [-80.5, 12.6], [-82.5, 11.8]] },
  { name: 'Mexican coast', strength: 0.3, width: 1.5, path: [[-95, 19.3], [-96.8, 21.5], [-97, 25.5], [-95.5, 28.3], [-92, 29.2], [-89.6, 29.2]] },
];

/** A slack westward set everywhere the streams aren't, south of the Gulf. */
export const BACKGROUND = { heading: 270, strength: 0.15, southOf: 25 };

/**
 * Wind by season: the bearing it blows *toward*, and how hard. The trades
 * come out of the north-east most of the year; in the dry season northers
 * come down over the Gulf.
 */
export const SEASONS: { name: string; toward: number; strength: number; norther?: { toward: number; strength: number; northOf: number } }[] = [
  { name: 'dry season', toward: 225, strength: 1.0, norther: { toward: 180, strength: 0.9, northOf: 23 } },
  { name: 'spring', toward: 260, strength: 0.8 },
  { name: 'wet season', toward: 285, strength: 0.6 },
  { name: 'autumn', toward: 245, strength: 0.7 },
];
export const SEASON_LENGTH = 10;

/**
 * Points at the edge of the map where the Atlantic begins. Ships bound for
 * Europe leave by the Florida Straits and the Gulf Stream; ships from Europe
 * come in on the trades through the Lesser Antilles.
 */
export const MARKS: Record<string, LonLat> = {
  'for Spain': [-79.6, 30.6],
  'from Spain': [-59.5, 14.5],
};

/** The crossing: a ship reaching `from` is gone this many turns, then comes in at `to`. */
export const VOYAGES: { from: string; to: string; turns: number }[] = [{ from: 'for Spain', to: 'from Spain', turns: 20 }];

/**
 * Who sails a fixed course, in order and round again. Treasure: the Tierra
 * Firme galleons come in through the islands to Cartagena, go on to
 * Portobelo for the fair and the Peruvian silver, back by Cartagena, and
 * run for Havana; the New Spain flota loads at Veracruz; both leave Havana
 * together for Spain. The Armada de Barlovento patrols the Spanish ports.
 */
export const ROUTES: Record<string, string[]> = {
  galeones: ['from Spain', 'Cartagena', 'Portobelo', 'Cartagena', 'Havana', 'for Spain'],
  flota: ['from Spain', 'San Juan', 'Veracruz', 'Havana', 'for Spain'],
  register: ['from Spain', 'Cartagena', 'Havana', 'for Spain'],
  barlovento: ['Veracruz', 'Havana', 'Santo Domingo', 'San Juan', 'Cartagena', 'Portobelo', 'Campeche'],
};
