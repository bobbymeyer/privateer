/**
 * The landmarks of the voyage: the chain a captain of 1580 would sail, with
 * its forks. Data only — the map places each on the chart (`landmarks` on
 * SeaMap), and journey.ts moves you along them.
 *
 * Drake's way, westward, is the main line. The forks are the real choices
 * the captains of the time made: the Strait or the Horn; on across the
 * Pacific or back the way you came; the Moluccas or Manila.
 */

export type LandmarkKind = 'port' | 'anchorage' | 'strait' | 'cape' | 'sea' | 'home' | 'island';

export interface Landmark {
  key: string;
  name: string;
  kind: LandmarkKind;
  /** Where it lies, longitude and latitude; or a port's name, to sit on that port. */
  at: [number, number] | string;
  /** What a captain knows of it, before and on arriving. */
  text: string;
  /** Where you can make for next: one, or a fork. */
  next: string[];
  /** What's to be had here. */
  offers: Offers;
  /**
   * A detour, off the main way: known only by a rumor (rumors.ts), made for
   * from any of `from`, and left by `next` to rejoin the way.
   */
  detour?: { from: string[] };
  /**
   * A landfall a storm may drive you to (landfalls.ts): never made for, only
   * blown onto. `near` ties it into the lanes, so the ship can sail on from it.
   */
  landfall?: { near: string[] };
}

export type ShoreWork = 'water' | 'forage' | 'careen';

export interface Offers {
  /** What the crew can do ashore: fill the casks, forage and fish, haul her down and scrape her. */
  shore?: ShoreWork[];
  /** Somewhere to buy: a chandler, where they'll deal with you, or islanders who trade water and fresh food for a little. */
  market?: 'chandler' | 'islanders';
  /** A Spanish town on the way, open or walled, to raid once. */
  raid?: 'town' | 'fortress';
  /** Spice to buy by the ton, and what a ton costs here: it sells at home for SPICE_WORTH. See stores.ts. */
  spice?: { name: string; cost: number };
}

export const LANDMARKS: Landmark[] = [
  {
    key: 'plymouth', name: 'Plymouth', kind: 'port', at: 'Plymouth', next: ['canaries'], offers: { market: 'chandler' },
    text: 'Drake came in here in September, the Golden Hind low in the water with Spanish silver. Fit out, and follow him.',
  },
  {
    key: 'canaries', name: 'the Canaries', kind: 'anchorage', at: [-15.8, 28.6], next: ['cape-verde'], offers: { shore: ['water', 'forage'] },
    text: 'Spanish islands, and the last of Europe. Water and fruit in a quiet bay away from the towns; fishing boats to take for their fish, or to leave be.',
  },
  {
    key: 'cape-verde', name: 'the Cape Verde islands', kind: 'anchorage', at: [-23.4, 15.4], next: ['brazil'], offers: { shore: ['water', 'forage'] },
    text: 'Portuguese, and so the King of Spain’s since this year. Drake took a Portuguese ship here, and her pilot, who knew the coast of Brazil, and watered at Brava before the long crossing.',
  },
  {
    key: 'brazil', name: 'the coast of Brazil', kind: 'anchorage', at: [-48.5, -27.5], next: ['plate'], offers: { shore: ['water', 'forage', 'careen'] },
    text: 'Landfall after the long crossing. Water, wood, and fresh food ashore, if the Portuguese settlements are kept clear of.',
  },
  {
    key: 'plate', name: 'the River Plate', kind: 'anchorage', at: [-56.2, -35.4], next: ['san-julian'], offers: { shore: ['water', 'forage'] },
    text: 'Fresh water a long way out to sea. Seals on the islands for the pot.',
  },
  {
    key: 'san-julian', name: 'Port San Julián', kind: 'anchorage', at: [-67.6, -49.4], next: ['strait', 'horn'], offers: { shore: ['water', 'forage', 'careen'] },
    text: 'Where Magellan wintered and hanged his mutineers, and Drake beheaded Doughty. Careen here, and settle the crew, before the bottom of the world.',
  },
  {
    key: 'strait', name: 'the Strait of Magellan', kind: 'strait', at: [-71.0, -53.6], next: ['mocha'], offers: { shore: ['water'] },
    text: 'Three hundred miles of narrow water between mountains, williwaws coming down off the snow. Sheltered, and slow.',
  },
  {
    key: 'horn', name: 'round the Horn', kind: 'cape', at: [-67.5, -56.6], next: ['mocha'], offers: {},
    text: 'Open sea where the two oceans meet, found by Drake when the storm drove him south. Faster than the Strait, if the ship and crew live through it.',
  },
  {
    key: 'mocha', name: 'Mocha Island', kind: 'anchorage', at: [-73.9, -38.4], next: ['valparaiso'], offers: { shore: ['water', 'forage'] },
    text: 'The first land up the coast of Chile. The islanders took Drake for a Spaniard, and he lost men to their arrows.',
  },
  {
    key: 'valparaiso', name: 'Valparaíso', kind: 'port', at: 'Valparaíso', next: ['callao'], offers: { raid: 'town' },
    text: 'A Spanish port that has never seen an enemy ship. Drake took a ship lying here with gold and Chilean wine.',
  },
  {
    key: 'callao', name: 'Callao, the port of Lima', kind: 'port', at: 'Callao', next: ['cacafuego'], offers: { raid: 'town' },
    text: 'Lima’s port, full of ships with their sails ashore and their silver aboard. Here Drake heard of the treasure ship ahead of him.',
  },
  {
    key: 'cacafuego', name: 'off Cape San Francisco', kind: 'sea', at: [-80.1, 0.7], next: ['guatulco', 'strait-east'], offers: {},
    text: 'Where the treasure ship from Callao to Panama is overhauled, if she is. Then the choice: on across the Pacific, or back the way you came while the coast is still asleep.',
  },
  {
    key: 'guatulco', name: 'Guatulco', kind: 'port', at: 'Guatulco', next: ['nova-albion', 'ladrones'], offers: { raid: 'town' },
    text: 'A small port on the coast of New Spain, to water before the Pacific. Then north to find the passage home, or straight across.',
  },
  {
    key: 'nova-albion', name: 'Nova Albion', kind: 'anchorage', at: [-123.0, 38.0], next: ['ladrones'], offers: { shore: ['water', 'forage', 'careen'] },
    text: 'A good bay on the coast north of New Spain, where Drake careened and claimed the land for the Queen. The natives crowned him.',
  },
  {
    key: 'ladrones', name: 'the Ladrones', kind: 'port', at: 'Umatac', next: ['ternate', 'manila'], offers: { market: 'islanders' },
    text: 'The Islands of Thieves, Magellan called them. Water and fruit after the longest crossing in the world, or canoes swarming to steal what isn’t tied down.',
  },
  {
    key: 'ternate', name: 'Ternate, in the Moluccas', kind: 'port', at: 'Ternate', next: ['java'], offers: { market: 'chandler', spice: { name: 'cloves', cost: 6 } },
    text: 'The Spice Islands. The Sultan has thrown out the Portuguese and is glad of an enemy of theirs: cloves for the hold, and a welcome.',
  },
  {
    key: 'manila', name: 'Manila', kind: 'port', at: 'Manila', next: ['java'], offers: { raid: 'fortress' },
    text: 'Spain’s port in the East, where the galleon comes from Acapulco with silver. Rich, and on its guard.',
  },
  {
    key: 'java', name: 'Java', kind: 'port', at: 'Bantam', next: ['cape'], offers: { market: 'chandler', spice: { name: 'pepper', cost: 8 } },
    text: 'Bantam, where the pepper is, and kings who trade with anyone. The last good water before the Indian Ocean.',
  },
  {
    key: 'cape', name: 'the Cape of Good Hope', kind: 'cape', at: 'Table Bay', next: ['sierra-leone'], offers: { shore: ['water'], market: 'islanders' },
    text: '“The fairest cape we saw in the whole circumference of the earth,” Drake’s chaplain wrote. Water in Table Bay, if the weather lets you in.',
  },
  {
    key: 'sierra-leone', name: 'Sierra Leone', kind: 'anchorage', at: [-13.4, 8.4], next: ['plymouth-home'], offers: { shore: ['water', 'forage', 'careen'] },
    text: 'Water, lemons and oysters on the coast of Guinea, and the last landfall before home.',
  },
  {
    key: 'strait-east', name: 'the Strait, homeward', kind: 'strait', at: [-71.0, -53.6], next: ['brazil-home'], offers: { shore: ['water'] },
    text: 'Back through the Strait while the Spanish are still looking for you on the coast of Peru. They will be waiting at the other end before long.',
  },
  {
    key: 'brazil-home', name: 'the coast of Brazil, homeward', kind: 'anchorage', at: [-38.0, -9.5], next: ['plymouth-home'], offers: { shore: ['water', 'forage', 'careen'] },
    text: 'Water and wood for the last crossing. The Portuguese know what you’ve done by now.',
  },
  // --- Detours, known only by a rumor -------------------------------------------
  {
    key: 'cabo-san-lucas', name: 'Cabo San Lucas', kind: 'cape', at: [-109.9, 22.6], next: ['ladrones'], offers: { shore: ['water'] },
    detour: { from: ['guatulco', 'nova-albion'] },
    text: 'The tip of California, where the galleon from Manila makes her landfall after five months at sea, her crew half dead of the scurvy. Cavendish lay in wait here in 1587 and took the Santa Ana.',
  },
  {
    key: 'solomons', name: 'the Isles of Solomon', kind: 'anchorage', at: [159.9, -9.4], next: ['ternate'], offers: { shore: ['water', 'forage', 'careen'], market: 'islanders' },
    detour: { from: ['guatulco', 'nova-albion', 'cabo-san-lucas', 'ladrones'] },
    text: 'Islands Mendaña found in 1568 and named for King Solomon’s mines. Water and fruit and a welcome, the islanders say; gold, the Spaniards say.',
  },
  {
    key: 'macau', name: 'off Macau', kind: 'sea', at: [113.3, 21.6], next: ['java'], offers: {},
    detour: { from: ['ladrones', 'manila', 'ternate'] },
    text: 'The Portuguese at Macau, by the Emperor’s leave, and every year the Great Ship of Amacon sails for Nagasaki with China’s silk and comes back with Japan’s silver. Macau itself is too strong to touch.',
  },
  {
    key: 'banda', name: 'the Banda islands', kind: 'anchorage', at: [129.9, -4.6], next: ['java'], offers: { shore: ['water', 'forage'] },
    detour: { from: ['ternate'] },
    text: 'The only place in the world the nutmeg grows. The Sultan of Ternate has kinsmen here, and no love for the Portuguese.',
  },
  {
    key: 'goa', name: 'Goa', kind: 'port', at: 'Goa', next: ['cape'], offers: { raid: 'fortress' },
    detour: { from: ['java'] },
    text: 'Golden Goa, the Viceroy’s city, the richest in Portuguese India: churches, warehouses, the pepper of Malabar. Walled, and its fleet is often in the river.',
  },
  {
    key: 'azores', name: 'off the Azores', kind: 'sea', at: [-28.5, 38.0], next: ['plymouth-home'], offers: {},
    detour: { from: ['sierra-leone', 'brazil-home'] },
    text: 'Where the carracks from Goa make their landfall before Lisbon, low in the water with the whole year’s trade of the Indies. The Madre de Deus was taken here, in time.',
  },
  // --- Landfalls a storm drives you to ---------------------------------------------
  {
    key: 'bermuda', name: 'Bermuda, the Isle of Devils', kind: 'island', at: [-64.8, 32.3], next: [], offers: { shore: ['water', 'forage', 'careen'] },
    landfall: { near: ['plymouth-home', 'canaries'] },
    text: 'The Isle of Devils, the Spanish call it, and keep away: reefs all round it, and the birds crying in the night like the damned. Inside the reefs, wild hogs, birds by the thousand, and sweet water.',
  },
  {
    key: 'st-helena', name: 'St Helena', kind: 'island', at: [-5.7, -15.9], next: [], offers: { shore: ['water', 'forage'] },
    landfall: { near: ['cape', 'sierra-leone', 'brazil'] },
    text: 'The Portuguese secret: a rock in the middle of the South Atlantic with water, lemons, figs and goats run wild, and nobody on it but the odd castaway.',
  },
  {
    key: 'mauritius', name: 'Mauritius', kind: 'island', at: [57.6, -20.2], next: [], offers: { shore: ['water', 'forage', 'careen'] },
    landfall: { near: ['cape', 'java'] },
    text: 'Cirne, the Portuguese call it, and nobody lives there: ebony forests, tortoises, and great fat birds that cannot fly and do not know to run.',
  },
  {
    key: 'galapagos', name: 'the Galápagos', kind: 'island', at: [-90.4, -0.7], next: [], offers: { shore: ['forage', 'careen'] },
    landfall: { near: ['cacafuego', 'guatulco'] },
    text: 'The Enchanted Isles, where Berlanga drifted in 1535: black rock, little water, and tortoises so big a man can ride them, that live for weeks in the hold.',
  },
  {
    key: 'juan-fernandez', name: 'Juan Fernández', kind: 'island', at: [-78.9, -33.6], next: [], offers: { shore: ['water', 'forage', 'careen'] },
    landfall: { near: ['valparaiso', 'mocha'] },
    text: 'Found by the pilot Juan Fernández in 1574, out of sight of the coast of Chile: goats on the hills, and streams of sweet water.',
  },
  {
    key: 'plymouth-home', name: 'Plymouth', kind: 'home', at: 'Plymouth', next: [], offers: {},
    text: 'Home.',
  },
];

export const START_LANDMARK = 'plymouth';
export const HOME_LANDMARK = 'plymouth-home';
export const landmark = (key: string): Landmark => {
  const l = LANDMARKS.find((x) => x.key === key);
  if (!l) throw new Error(`no landmark ${key}`);
  return l;
};

/** The main way: neither a detour nor a landfall. */
export const onTheWay = (l: Landmark) => !l.detour && !l.landfall;
