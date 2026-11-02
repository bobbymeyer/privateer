/**
 * The ports of 16XX: the seventeenth century as a setting rather than a
 * year, so this is a century's worth, not a census of one season. Positions
 * are longitude, latitude; the map puts each on the nearest coastal node,
 * so a port up a river (Seville, London) sits at the river's sea end.
 */

export type Nation =
  | 'spain'
  | 'portugal'
  | 'england'
  | 'france'
  | 'netherlands'
  | 'denmark'
  | 'sweden'
  | 'hanse'
  | 'italy'
  | 'venice'
  | 'malta'
  | 'ottoman'
  | 'barbary'
  | 'morocco'
  | 'persia'
  | 'oman'
  | 'mughal'
  | 'china'
  | 'japan'
  | 'local';

export interface PortDef {
  name: string;
  at: [number, number];
  nation: Nation;
  /** Guns over the harbour. The water a leg out is under them. */
  fort: boolean;
}

const p = (name: string, lon: number, lat: number, nation: Nation, fort = false): PortDef => ({ name, at: [lon, lat], nation, fort });

export const PORTS: PortDef[] = [
  // Northern Europe
  p('Plymouth', -4.14, 50.36, 'england', true),
  p('London', 0.6, 51.45, 'england'),
  p('Bristol', -2.9, 51.5, 'england'),
  p('Amsterdam', 4.9, 52.6, 'netherlands'),
  p('Dunkirk', 2.37, 51.03, 'spain', true),
  p('Saint-Malo', -2.0, 48.65, 'france', true),
  p('Brest', -4.49, 48.38, 'france', true),
  p('La Rochelle', -1.15, 46.16, 'france', true),
  p('Copenhagen', 12.57, 55.68, 'denmark', true),
  p('Bergen', 5.32, 60.39, 'denmark'),
  p('Lübeck', 10.69, 53.95, 'hanse'),
  p('Danzig', 18.65, 54.4, 'hanse'),
  p('Stockholm', 18.07, 59.33, 'sweden', true),
  // Iberia and the Atlantic islands
  p('Lisbon', -9.14, 38.7, 'portugal', true),
  p('Cádiz', -6.29, 36.53, 'spain', true),
  p('Seville', -6.36, 36.78, 'spain'),
  p('Funchal', -16.92, 32.65, 'portugal'),
  p('Las Palmas', -15.41, 28.1, 'spain'),
  p('Angra', -27.22, 38.65, 'portugal', true),
  p('Ribeira Grande', -23.6, 14.92, 'portugal'),
  // The Mediterranean
  p('Salé', -6.8, 34.05, 'morocco'),
  p('Algiers', 3.06, 36.78, 'barbary', true),
  p('Tunis', 10.3, 36.82, 'barbary'),
  p('Tripoli', 13.18, 32.9, 'barbary'),
  p('Barcelona', 2.17, 41.38, 'spain'),
  p('Marseille', 5.37, 43.3, 'france', true),
  p('Genoa', 8.93, 44.41, 'italy'),
  p('Livorno', 10.31, 43.55, 'italy', true),
  p('Naples', 14.25, 40.84, 'spain', true),
  p('Palermo', 13.36, 38.12, 'spain'),
  p('Valletta', 14.51, 35.9, 'malta', true),
  p('Venice', 12.34, 45.43, 'venice', true),
  p('Candia', 25.13, 35.34, 'venice', true),
  p('Smyrna', 27.14, 38.42, 'ottoman'),
  p('Constantinople', 28.98, 41.01, 'ottoman', true),
  p('Alexandria', 29.9, 31.2, 'ottoman'),
  // Africa
  p('Gorée', -17.4, 14.67, 'netherlands'),
  p('Elmina', -1.35, 5.08, 'netherlands', true),
  p('São Tomé', 6.73, 0.34, 'portugal'),
  p('Luanda', 13.23, -8.81, 'portugal', true),
  p('Cape Town', 18.42, -33.92, 'netherlands', true),
  p('Mozambique', 40.74, -15.03, 'portugal', true),
  p('Mombasa', 39.67, -4.06, 'portugal', true),
  p('Zanzibar', 39.19, -6.16, 'oman'),
  // The Indian Ocean
  p('Mocha', 43.25, 13.32, 'ottoman'),
  p('Aden', 45.03, 12.78, 'local'),
  p('Muscat', 58.59, 23.61, 'oman', true),
  p('Bandar Abbas', 56.27, 27.18, 'persia'),
  p('Surat', 72.6, 21.1, 'mughal'),
  p('Goa', 73.83, 15.5, 'portugal', true),
  p('Calicut', 75.78, 11.25, 'local'),
  p('Cochin', 76.26, 9.97, 'netherlands', true),
  p('Colombo', 79.85, 6.93, 'netherlands', true),
  p('Tranquebar', 79.85, 11.03, 'denmark', true),
  p('Madras', 80.28, 13.08, 'england', true),
  p('Masulipatnam', 81.13, 16.17, 'local'),
  p('Hooghly', 88.1, 21.7, 'mughal'),
  // The East Indies and beyond
  p('Aceh', 95.32, 5.55, 'local'),
  p('Malacca', 102.25, 2.19, 'netherlands', true),
  p('Bantam', 106.15, -6.02, 'local'),
  p('Batavia', 106.83, -6.12, 'netherlands', true),
  p('Makassar', 119.41, -5.13, 'local'),
  p('Ternate', 127.38, 0.79, 'local'),
  p('Ambon', 128.18, -3.7, 'netherlands', true),
  p('Manila', 120.97, 14.6, 'spain', true),
  p('Hội An', 108.33, 15.88, 'local'),
  p('Macau', 113.54, 22.2, 'portugal', true),
  p('Canton', 113.6, 22.6, 'china'),
  p('Amoy', 118.08, 24.48, 'china'),
  p('Zeelandia', 120.16, 23.0, 'netherlands', true),
  p('Nagasaki', 129.87, 32.75, 'japan'),
  // North America
  p("St. John's, Newfoundland", -52.7, 47.56, 'england'),
  p('Quebec', -70.5, 47.2, 'france'),
  p('Boston', -71.06, 42.36, 'england'),
  p('New Amsterdam', -74.01, 40.7, 'netherlands'),
  p('Jamestown', -76.3, 37.0, 'england'),
  p('Bermuda', -64.68, 32.38, 'england'),
  p('St. Augustine', -81.31, 29.89, 'spain', true),
  // The Caribbean and the Gulf
  p('Havana', -82.36, 23.14, 'spain', true),
  p('Veracruz', -96.13, 19.2, 'spain', true),
  p('Campeche', -90.53, 19.85, 'spain', true),
  p('Cartagena', -75.55, 10.4, 'spain', true),
  p('Portobelo', -79.65, 9.55, 'spain', true),
  p('Santo Domingo', -69.88, 18.47, 'spain', true),
  p('San Juan', -66.12, 18.47, 'spain', true),
  p('Santiago de Cuba', -75.87, 19.97, 'spain', true),
  p('Maracaibo', -71.62, 10.65, 'spain'),
  p('Trujillo', -85.95, 15.92, 'spain'),
  p('Cumaná', -64.17, 10.46, 'spain'),
  p('Port of Spain', -61.52, 10.65, 'spain'),
  p('Port Royal', -76.84, 17.93, 'england', true),
  p('Bridgetown', -59.62, 13.1, 'england', true),
  p("St. John's, Antigua", -61.85, 17.12, 'england'),
  p('Charles Town', -77.34, 25.08, 'england'),
  p('Tortuga', -72.78, 20.05, 'france'),
  p('Petit-Goâve', -72.86, 18.43, 'france'),
  p('Saint-Pierre', -61.18, 14.74, 'france'),
  p('Willemstad', -68.93, 12.11, 'netherlands', true),
  p('St. Eustatius', -62.98, 17.48, 'netherlands'),
  // South America
  p('Cayenne', -52.33, 4.94, 'france'),
  p('Recife', -34.88, -8.05, 'portugal', true),
  p('Salvador', -38.5, -12.97, 'portugal', true),
  p('Rio de Janeiro', -43.17, -22.9, 'portugal', true),
  p('Buenos Aires', -58.37, -34.6, 'spain'),
  p('Valdivia', -73.24, -39.8, 'spain', true),
  p('Valparaíso', -71.63, -33.04, 'spain'),
  p('Arica', -70.32, -18.48, 'spain'),
  p('Callao', -77.15, -12.05, 'spain', true),
  p('Guayaquil', -79.9, -2.2, 'spain'),
  p('Panama', -79.53, 8.98, 'spain', true),
  p('Acapulco', -99.91, 16.85, 'spain', true),
];

/** How far a nation's protected waters reach from each of its forts, in days. */
export const WATERS_DAYS = 4;

/** Who comes out when a foreign warship nears a nation's forts. */
export const NAVIES: Partial<Record<Nation, string>> = {
  england: 'the Royal Navy',
  france: 'the Marine royale',
  netherlands: 'the Dutch admiralties',
  spain: 'the Spanish guard',
  portugal: 'the Portuguese guard',
  denmark: 'the Danish navy',
  sweden: 'the Swedish navy',
  venice: 'the Venetian galleys',
  ottoman: 'the Ottoman fleet',
};
export const navyOf = (n: Nation) => NAVIES[n] ?? `${n} guard ships`;

const ADJECTIVES: Record<Nation, string> = {
  spain: 'Spanish', portugal: 'Portuguese', england: 'English', france: 'French', netherlands: 'Dutch',
  denmark: 'Danish', sweden: 'Swedish', hanse: 'Hanseatic', italy: 'Italian', venice: 'Venetian',
  malta: 'Maltese', ottoman: 'Ottoman', barbary: 'Barbary', morocco: 'Moroccan', persia: 'Persian',
  oman: 'Omani', mughal: 'Mughal', china: 'Chinese', japan: 'Japanese', local: 'local',
};
/** `Spanish`, `Dutch`: for saying whose a ship is. */
export const adjective = (n: Nation) => ADJECTIVES[n];

/** `a` or `an`, for the word that follows. */
export const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a');
