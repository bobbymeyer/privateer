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
  | 'native'
  | 'local';

export interface PortDef {
  name: string;
  at: [number, number];
  nation: Nation;
  /** Guns over the harbour. The water a leg out is under them. */
  fort: boolean;
}

const p = (name: string, lon: number, lat: number, nation: Nation, fort = false): PortDef => ({ name, at: [lon, lat], nation, fort });

/**
 * The ports of 1580: what a captain fitting out at Plymouth in the autumn
 * Drake came home could sail for. Spain and Portugal are one crown from this
 * year, so every Iberian port from Lisbon to Goa to Manila is the King of
 * Spain's. No Dutch East India Company, no Batavia, no English colonies,
 * no buccaneers. The Dutch are rebels, and England's friends; the Huguenots
 * hold La Rochelle.
 */
export const PORTS: PortDef[] = [
  // Northern Europe
  p('Plymouth', -4.14, 50.36, 'england', true),
  p('London', 0.6, 51.45, 'england'),
  p('Bristol', -2.9, 51.5, 'england'),
  // Holland in revolt against Spain: the Sea Beggars' ports.
  p('Amsterdam', 4.9, 52.6, 'netherlands'),
  p('Dunkirk', 2.37, 51.03, 'spain', true),
  p('Saint-Malo', -2.0, 48.65, 'france', true),
  p('Brest', -4.49, 48.38, 'france', true),
  // The Huguenots' stronghold.
  p('La Rochelle', -1.15, 46.16, 'france', true),
  p('Copenhagen', 12.57, 55.68, 'denmark', true),
  p('Bergen', 5.32, 60.39, 'denmark'),
  p('Reykjavík', -21.94, 64.15, 'denmark'),
  // A fishing town in west Cork, and a pirates' haven on the Munster coast.
  p('Baltimore', -9.37, 51.48, 'england'),
  p('Lübeck', 10.69, 53.95, 'hanse'),
  p('Danzig', 18.65, 54.4, 'hanse'),
  p('Stockholm', 18.07, 59.33, 'sweden', true),
  // Iberia and the Atlantic islands: Philip's now, all of it.
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
  // Africa: the Portuguese forts, the Swahili cities, and water at the Cape.
  p('Gorée', -17.4, 14.67, 'portugal'),
  p('Elmina', -1.35, 5.08, 'portugal', true),
  p('São Tomé', 6.73, 0.34, 'portugal'),
  p('Luanda', 13.23, -8.81, 'portugal', true),
  p('Table Bay', 18.42, -33.92, 'native'),
  p('Mozambique', 40.74, -15.03, 'portugal', true),
  p('Mombasa', 39.67, -4.06, 'local'),
  p('Zanzibar', 39.19, -6.16, 'local'),
  // The Indian Ocean: the Estado da Índia, and the ports it couldn't hold.
  p('Mocha', 43.25, 13.32, 'ottoman'),
  p('Aden', 45.03, 12.78, 'ottoman'),
  p('Muscat', 58.59, 23.61, 'portugal', true),
  p('Hormuz', 56.45, 27.1, 'portugal', true),
  p('Surat', 72.6, 21.1, 'mughal'),
  p('Goa', 73.83, 15.5, 'portugal', true),
  p('Calicut', 75.78, 11.25, 'local'),
  p('Cochin', 76.26, 9.97, 'portugal', true),
  p('Colombo', 79.85, 6.93, 'portugal', true),
  p('Masulipatnam', 81.13, 16.17, 'local'),
  p('Hooghly', 88.1, 21.7, 'portugal'),
  // The East Indies and beyond. Ternate's sultan threw the Portuguese out in 1575.
  p('Aceh', 95.32, 5.55, 'local'),
  p('Malacca', 102.25, 2.19, 'portugal', true),
  p('Bantam', 106.15, -6.02, 'local'),
  p('Makassar', 119.41, -5.13, 'local'),
  p('Ternate', 127.38, 0.79, 'local'),
  p('Ambon', 128.18, -3.7, 'portugal', true),
  p('Manila', 120.97, 14.6, 'spain', true),
  p('Hội An', 108.33, 15.88, 'local'),
  p('Macau', 113.54, 22.2, 'portugal', true),
  p('Canton', 113.6, 22.6, 'china'),
  p('Amoy', 118.08, 24.48, 'china'),
  p('Nagasaki', 129.87, 32.75, 'japan'),
  // North America: the fishing banks, and Spain's one fort.
  p("St. John's, Newfoundland", -52.7, 47.56, 'local'),
  p('St. Augustine', -81.31, 29.89, 'spain', true),
  // The Caribbean and the Spanish Main
  p('Havana', -82.36, 23.14, 'spain', true),
  p('Veracruz', -96.13, 19.2, 'spain', true),
  p('Campeche', -90.53, 19.85, 'spain', true),
  p('Cartagena', -75.55, 10.4, 'spain', true),
  // The treasure port of the isthmus, before Portobelo; Drake raided it in 1572.
  p('Nombre de Dios', -79.47, 9.58, 'spain'),
  p('Santo Domingo', -69.88, 18.47, 'spain', true),
  p('San Juan', -66.12, 18.47, 'spain', true),
  p('Santiago de Cuba', -75.87, 19.97, 'spain', true),
  p('Maracaibo', -71.62, 10.65, 'spain'),
  p('Río de la Hacha', -72.9, 11.54, 'spain'),
  p('Trujillo', -85.95, 15.92, 'spain'),
  p('Cumaná', -64.17, 10.46, 'spain'),
  // South America
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
  // Where Drake watered on the coast of New Spain in 1579.
  p('Guatulco', -96.13, 15.75, 'spain'),
  p('Acapulco', -99.91, 16.85, 'spain', true),
  // The Pacific islands: water, food and timber — or war canoes. The Ladrones, where Magellan watered.
  p('Umatac', 144.66, 13.29, 'native'),
  p('Kealakekua', -155.93, 19.48, 'native'),
  p('Matavai', -149.48, -17.5, 'native'),
  p('Nuku’alofa', -175.2, -21.13, 'native'),
  p('Nuku Hiva', -140.1, -8.91, 'native'),
  p('Rapa Nui', -109.43, -27.15, 'native'),
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
  oman: 'Omani', mughal: 'Mughal', china: 'Chinese', japan: 'Japanese', native: 'islanders’', local: 'local',
};
/** `Spanish`, `Dutch`: for saying whose a ship is. */
export const adjective = (n: Nation) => ADJECTIVES[n];

/** `a` or `an`, for the word that follows. */
export const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a');

const NAMES: Record<Nation, string> = {
  spain: 'Spain', portugal: 'Portugal', england: 'England', france: 'France', netherlands: 'the Dutch Republic',
  denmark: 'Denmark', sweden: 'Sweden', hanse: 'the Hanse', italy: 'the Italian states', venice: 'Venice',
  malta: 'the Knights of Malta', ottoman: 'the Ottomans', barbary: 'the Barbary corsairs', morocco: 'Morocco',
  persia: 'Persia', oman: 'Oman', mughal: 'the Mughals', china: 'China', japan: 'Japan', native: 'the islanders', local: 'the independent harbours',
};
/** `Spain`, `the Dutch Republic`: a nation by name, for the news. */
export const nationName = (n: Nation) => NAMES[n];

/** What to call a ship you've seen or heard of, with its article: `a Dutch merchant`, `an English guard ship`, `a sea monster`. */
export function sailName(kind: string, nation: Nation): string {
  if (kind === 'monster') return 'a sea monster';
  const flag = adjective(nation);
  return `${article(flag)} ${flag} ${kind === 'hunter' ? 'guard ship' : kind.replace('-', ' ')}`;
}
