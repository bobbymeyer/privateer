/**
 * The landmarks of the voyage: the chain a captain of 1580 would sail, with
 * its forks. Data only — the map places each on the chart (`landmarks` on
 * SeaMap), and journey.ts moves you along them.
 *
 * Drake's way, westward, is the main line. The forks are the real choices
 * the captains of the time made: the Strait or the Horn; on across the
 * Pacific or back the way you came; the Moluccas or Manila.
 */

export type LandmarkKind = 'port' | 'anchorage' | 'strait' | 'cape' | 'sea' | 'home';

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
}

export const LANDMARKS: Landmark[] = [
  {
    key: 'plymouth', name: 'Plymouth', kind: 'port', at: 'Plymouth', next: ['canaries'],
    text: 'Drake came in here in September, the Golden Hind low in the water with Spanish silver. Fit out, and follow him.',
  },
  {
    key: 'canaries', name: 'the Canaries', kind: 'anchorage', at: [-15.8, 28.6], next: ['cape-verde'],
    text: 'Spanish islands, and the last of Europe. Water and fruit in a quiet bay away from the towns; fishing boats to take for their fish, or to leave be.',
  },
  {
    key: 'cape-verde', name: 'the Cape Verde islands', kind: 'anchorage', at: [-23.4, 15.4], next: ['brazil'],
    text: 'Portuguese, and so the King of Spain’s since this year. Drake took a Portuguese ship here, and her pilot, who knew the coast of Brazil, and watered at Brava before the long crossing.',
  },
  {
    key: 'brazil', name: 'the coast of Brazil', kind: 'anchorage', at: [-48.5, -27.5], next: ['plate'],
    text: 'Landfall after the long crossing. Water, wood, and fresh food ashore, if the Portuguese settlements are kept clear of.',
  },
  {
    key: 'plate', name: 'the River Plate', kind: 'anchorage', at: [-56.2, -35.4], next: ['san-julian'],
    text: 'Fresh water a long way out to sea. Seals on the islands for the pot.',
  },
  {
    key: 'san-julian', name: 'Port San Julián', kind: 'anchorage', at: [-67.6, -49.4], next: ['strait', 'horn'],
    text: 'Where Magellan wintered and hanged his mutineers, and Drake beheaded Doughty. Careen here, and settle the crew, before the bottom of the world.',
  },
  {
    key: 'strait', name: 'the Strait of Magellan', kind: 'strait', at: [-71.0, -53.6], next: ['mocha'],
    text: 'Three hundred miles of narrow water between mountains, williwaws coming down off the snow. Sheltered, and slow.',
  },
  {
    key: 'horn', name: 'round the Horn', kind: 'cape', at: [-67.5, -56.6], next: ['mocha'],
    text: 'Open sea where the two oceans meet, found by Drake when the storm drove him south. Faster than the Strait, if the ship and crew live through it.',
  },
  {
    key: 'mocha', name: 'Mocha Island', kind: 'anchorage', at: [-73.9, -38.4], next: ['valparaiso'],
    text: 'The first land up the coast of Chile. The islanders took Drake for a Spaniard, and he lost men to their arrows.',
  },
  {
    key: 'valparaiso', name: 'Valparaíso', kind: 'port', at: 'Valparaíso', next: ['callao'],
    text: 'A Spanish port that has never seen an enemy ship. Drake took a ship lying here with gold and Chilean wine.',
  },
  {
    key: 'callao', name: 'Callao, the port of Lima', kind: 'port', at: 'Callao', next: ['cacafuego'],
    text: 'Lima’s port, full of ships with their sails ashore and their silver aboard. Here Drake heard of the treasure ship ahead of him.',
  },
  {
    key: 'cacafuego', name: 'off Cape San Francisco', kind: 'sea', at: [-80.1, 0.7], next: ['guatulco', 'strait-east'],
    text: 'Where the treasure ship from Callao to Panama is overhauled, if she is. Then the choice: on across the Pacific, or back the way you came while the coast is still asleep.',
  },
  {
    key: 'guatulco', name: 'Guatulco', kind: 'port', at: 'Guatulco', next: ['nova-albion', 'ladrones'],
    text: 'A small port on the coast of New Spain, to water before the Pacific. Then north to find the passage home, or straight across.',
  },
  {
    key: 'nova-albion', name: 'Nova Albion', kind: 'anchorage', at: [-123.0, 38.0], next: ['ladrones'],
    text: 'A good bay on the coast north of New Spain, where Drake careened and claimed the land for the Queen. The natives crowned him.',
  },
  {
    key: 'ladrones', name: 'the Ladrones', kind: 'port', at: 'Umatac', next: ['ternate', 'manila'],
    text: 'The Islands of Thieves, Magellan called them. Water and fruit after the longest crossing in the world, or canoes swarming to steal what isn’t tied down.',
  },
  {
    key: 'ternate', name: 'Ternate, in the Moluccas', kind: 'port', at: 'Ternate', next: ['java'],
    text: 'The Spice Islands. The Sultan has thrown out the Portuguese and is glad of an enemy of theirs: cloves for the hold, and a welcome.',
  },
  {
    key: 'manila', name: 'Manila', kind: 'port', at: 'Manila', next: ['java'],
    text: 'Spain’s port in the East, where the galleon comes from Acapulco with silver. Rich, and on its guard.',
  },
  {
    key: 'java', name: 'Java', kind: 'port', at: 'Bantam', next: ['cape'],
    text: 'Bantam, where the pepper is, and kings who trade with anyone. The last good water before the Indian Ocean.',
  },
  {
    key: 'cape', name: 'the Cape of Good Hope', kind: 'cape', at: 'Table Bay', next: ['sierra-leone'],
    text: '“The fairest cape we saw in the whole circumference of the earth,” Drake’s chaplain wrote. Water in Table Bay, if the weather lets you in.',
  },
  {
    key: 'sierra-leone', name: 'Sierra Leone', kind: 'anchorage', at: [-13.4, 8.4], next: ['plymouth-home'],
    text: 'Water, lemons and oysters on the coast of Guinea, and the last landfall before home.',
  },
  {
    key: 'strait-east', name: 'the Strait, homeward', kind: 'strait', at: [-71.0, -53.6], next: ['brazil-home'],
    text: 'Back through the Strait while the Spanish are still looking for you on the coast of Peru. They will be waiting at the other end before long.',
  },
  {
    key: 'brazil-home', name: 'the coast of Brazil, homeward', kind: 'anchorage', at: [-38.0, -9.5], next: ['plymouth-home'],
    text: 'Water and wood for the last crossing. The Portuguese know what you’ve done by now.',
  },
  {
    key: 'plymouth-home', name: 'Plymouth', kind: 'home', at: 'Plymouth', next: [],
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
