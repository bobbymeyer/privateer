/**
 * Events that ask you something: a storm, fever aboard, the water gone
 * foul, weevils in the bread. Each stops the voyage and offers a few
 * choices, and each choice says what it stakes before you make it. The odds
 * are told plainly — a captain of the century knew what a storm could do —
 * so the choice is about what you can afford, not a guess.
 */

import { type Roller, roll } from './random.ts';
import { capacity, deaths, topUp } from './stores.ts';
import { DISCONTENT_LOST } from './happenings.ts';
import { landmark } from './landmarks.ts';
import { DETOURS, SOURCES, type Source, heed } from './rumors.ts';
import { driven } from './landfalls.ts';
import { patrol, practise, raidFight } from './meet.ts';
import { followed } from './rumors.ts';
import { pardonOf, SEIZED, courtRisk, fameFor, giftGold, outlawed, pleasure, reckon, restitutionFor } from './reckoning.ts';
import { favourOf, proofOfService, saleValue } from './jewels.ts';
import { NORMAN_WOOD_COST, SETTLEMENT_COST, SETTLEMENT_DAYS, SETTLEMENT_DEALS } from './brazil.ts';
import { WOOD_WORTH, woodRoom } from './stores.ts';
import { newsOf, tellOf } from './rumors.ts';
import { FAIR, HARSH, PEOPLES, type People, deal } from './peoples.ts';
import type { Sea, WorldState } from './world.ts';
import { FEVER_NURSE, FEVER_NURSE_DAYS, FEVER_PRESS, FLUX, FOUL_LOST, WEEVIL_LOST, WEEVIL_SICK, feverDeaths, fluxDeaths } from './weather.ts';
import { alive, mourn } from './hands.ts';
import { CHRISTMAS_DAYS, PLAIN_GRUMBLE } from './calendar.ts';

export type Dilemma =
  /** A storm: ride it out, run before it, or lighten ship. */
  | { kind: 'storm' }
  /** Fever aboard: press on, or lie to and nurse the sick. */
  | { kind: 'fever' }
  /** The water gone foul in the casks: drink it, or heave it over. */
  | { kind: 'foul' }
  /** Weevils in the bread: eat it, or heave it over. */
  | { kind: 'weevils' }
  /** A leak below the waterline: fother it with a sail, or pump and press on. */
  | { kind: 'leak' }
  /** A wreck adrift: board her, or sail on. */
  | { kind: 'wreck' }
  /** Islanders' canoes in the Pacific: trade, let them alongside, or warn them off. */
  | { kind: 'canoes' }
  /** Aground on a reef in the Indies: lighten her, or wait for the tide. */
  | { kind: 'reef' }
  /** A gentleman stirring the hands at San Julián, as Doughty did: try him, maroon him, or let it be. */
  | { kind: 'gentleman' }
  /** Hands who want to stay in the islands: let them go, or double the watch. */
  | { kind: 'deserters' }
  /** A rumor of a detour: follow it, or let it be. Whether it's true is settled already, and not said. See rumors.ts. */
  | { kind: 'rumor'; key: string; source: Source; told: string; truth: boolean }
  /** Home, and the reckoning: show yourself at court, lie low, or give the Queen a gift. See reckoning.ts. */
  | { kind: 'reckoning' }
  /** The hands want to go raiding for Spanish gold on their own account: join them, hold firm, or maroon the ringleaders. */
  | { kind: 'gold-mutiny' }
  /** Fire in the bread room: fight it with what's to hand, or shut it and let it burn. */
  | { kind: 'stores-fire' }
  /** A storm on the eve of a raid: press on, stand off, or land the men and leave the ship. */
  | { kind: 'eve'; town: string }
  /** A ruler's feast ashore: go yourself, send a deputy, or decline. */
  | { kind: 'feast'; at: string }
  /** Hands jailed after a brawl ashore: pay, leave them, or break them out. */
  | { kind: 'jailed'; at: string }
  /** Your papers searched: hand over the charts, bribe, or refuse. `at` a landmark, or by a patrol at sea. */
  | { kind: 'papers'; at: string | null }
  /** Shining ore on a beach: load it, or leave it. */
  | { kind: 'ore' }
  /** A fishing boat off the Canaries, the first time: practice the fight on her, or let her be. See `practise` in meet.ts. */
  | { kind: 'practice' }
  /** A Portuguese settlement on the coast of Brazil, not yet sworn to Philip: treat with it, or keep clear. See brazil.ts. */
  | { kind: 'settlement' }
  /** A Norman ship loading brazilwood at Guanabara: trade for news, buy her brazilwood, or let her be. */
  | { kind: 'normans' }
  /** Hands who've wronged the people of a coast: punish them, pay amends, or let it pass. See peoples.ts. */
  | { kind: 'misconduct'; people: People }
  /** Huguenot privateers out of La Rochelle: keep company, trade news, take a French commission, or part. See huguenots.ts. */
  | { kind: 'huguenots' }
  /** Christmas Day: keep it with a double ration, or keep it plain. See calendar.ts. */
  | { kind: 'christmas' }
  /** The Queen's Accession Day, 17 November: fire a salute, or drink her health. See calendar.ts. */
  | { kind: 'accession' };

export interface Choice {
  key: string;
  label: string;
  /** What it stakes, told plainly. */
  stakes: string;
  /** Why it can't be chosen, if it can't. */
  barred?: string;
}

/** The hands' raid for Spanish gold: what a coast village gives up; the ringleaders marooned. */
export const MUTINY_GOLD = [20, 60] as const;
export const MAROONED = [3, 6] as const;
/** Fire in the bread room: the food lost fighting it, or letting it burn out. */
export const FIRE_FOUGHT = 0.15;
export const FIRE_SHUT = 0.35;
/** On the eve of a raid: going in now, standing off, landing the men. */
export const EVE_HULL = [1, 2] as const;
export const EVE_HANDS = [1, 3] as const;
export const EVE_DAYS = 3;
export const EVE_WARNED_HULL = 4;
export const EVE_CUT_OFF = [2, 4] as const;
/** The feast ashore: how often it's a trap, and what it costs. */
export const FEAST_TREACHERY = 0.1;
export const FEAST_DEAD = [2, 4] as const;
export const FEAST_RANSOM = 20;
/** Hands in the lock-up: what the governor asks, a quarter of the purse and no less than 5; what leaving them costs. */
export const jailFine = (s: WorldState) => Math.max(5, Math.round(s.gold / 4));
export const JAILED = [2, 4] as const;
/** What an officer takes to look the other way. */
export const PAPERS_BRIBE = 15;
/** Shining ore: the tons of hold it takes. */
export const ORE_ROOM = 2;

/** Amends paid in gold, when there's no truck to pay them in. */
export const AMENDS = 5;
/** Keeping company with the Huguenots: this many days. */
export const COMPANY_DAYS = 6;
/** The people whose canoes these are: the Chamorro north of the line, the islanders of the Solomons south of it. */
const canoePeople = (sea: Sea, s: WorldState): People => (sea.map.nodes[s.player].lat >= 0 ? 'chamorro' : 'solomons');

/** A leak pumped and pressed on with. */
export const LEAK_HULL = 2;
/** A wreck boarded: the days, what a strongbox holds, and the sickness. */
export const WRECK_DAYS = 2;
export const WRECK_GOLD = [10, 40] as const;
export const WRECK_SICK = [2, 4] as const;
/** Islanders' canoes: what trinkets cost, and what they bring. */
export const CANOE_COST = 2;
export const CANOE_DAYS = 14;
/** Fast on a reef, waiting for the tide; and what pounding costs. */
export const REEF_DAYS = [1, 2] as const;
export const REEF_HULL = [2, 3] as const;
/** Hands who'd stay in the islands; and who slip away from a doubled watch. */
export const DESERTERS = [2, 4] as const;
export const SLIP_AWAY = [1, 3] as const;

/** Riding out a storm costs this much, spares first and then hull, never the last point. */
export const STORM_HULL = [1, 3] as const;
/** Running before it costs this many days driven off your course. */
export const STORM_RUN = [2, 4] as const;
/** Lightening ship throws over this share of the purse, and no more than JETTISON_CAP. */
export const LIGHTEN = [0.1, 0.25] as const;
export const JETTISON_CAP = 30;

const range = ([a, b]: readonly [number, number]) => `${a} to ${b}`;
const lightenRange = (gold: number) => {
  const share = (k: number) => Math.min(JETTISON_CAP, Math.max(1, Math.round(gold * k)));
  return [share(LIGHTEN[0]), share(LIGHTEN[1])] as const;
};

export function describe(d: Dilemma): { title: string; text: string } {
  switch (d.kind) {
    case 'storm':
      return { title: 'a storm', text: 'the glass is falling and the sea getting up. there is time to choose how to meet it.' };
    case 'fever':
      return { title: 'fever aboard', text: 'a dozen hands in their hammocks, burning and raving. they want lying still, and in the shade.' };
    case 'foul':
      return { title: 'the water gone foul', text: 'green and stinking in the casks, with things alive in it. the hands will drink it if they must.' };
    case 'weevils':
      return { title: 'weevils in the bread', text: 'the biscuit is crawling. the hands knock it on the table to get them out, and grumble.' };
    case 'leak':
      return { title: 'a leak', text: 'water coming in below the waterline faster than the pumps like. the carpenter cannot get at it from inside.' };
    case 'wreck':
      return { title: 'a wreck', text: 'a ship adrift, dismasted, low in the water, and nobody on her deck. whatever killed her crew may still be aboard.' };
    case 'canoes':
      return { title: 'canoes', text: 'the islanders put out to you, a hundred canoes, with coconuts and fish held up. some of them have their eyes on anything iron.' };
    case 'reef':
      return { title: 'aground', text: 'on a reef in the Indies, fast by the bow, with the tide falling. Drake sat a day on one like it, and threw cloves and guns over to float her.' };
    case 'gentleman':
      return { title: 'a gentleman adventurer', text: 'one of the gentlemen who put money in the voyage has been telling the hands you will drown them all, and some of them listen. Drake tried Doughty here, and beheaded him.' };
    case 'rumor':
      return { title: `a rumor: ${landmark(d.key).name}`, text: `${d.told} says ${DETOURS[d.key].word}.` };
    case 'deserters':
      return { title: 'hands who would stay', text: 'some of the hands have found the islands kinder than the ship, and mean to stay when she sails.' };
    case 'gold-mutiny':
      return { title: 'the hands want Spanish gold', text: 'months without a prize, and the Spanish coast in sight. a party of the hands has armed itself and means to go raiding on its own account, as Laudonnière’s men did from Fort Caroline, with you or without you.' };
    case 'stores-fire':
      return { title: 'fire in the bread room', text: 'smoke coming up through the hatch from the bread room, and the biscuit going up like tinder.' };
    case 'eve':
      return { title: `a storm on the eve of the raid`, text: `the boats are ready for ${landmark(d.town).name}, and the glass is falling. Ribault went for San Agustín in weather like this, and lost his ships and his fort.` };
    case 'feast':
      return { title: 'a feast ashore', text: `the ${d.at === 'solomons' ? 'chief of the island' : d.at === 'java' ? 'King of Bantam' : 'Sultan'} asks you ashore to feast at his house. it would honour him, and he has rivals who would not mind an Englishman poisoned. Drake would not go ashore at Ternate, and sent his gentlemen.` };
    case 'jailed':
      return { title: 'hands in the lock-up', text: `a quarrel over a woman, or a cup, or nothing at all, and some of your hands are in the governor's lock-up at ${landmark(d.at).name}. he names a price.` };
    case 'papers':
      return { title: 'your papers searched', text: d.at ? `the officers of ${landmark(d.at).name} come aboard to search your papers, as they search every stranger's, and they mean to have your charts.` : 'a Spanish patrol in your wake, and her captain wants your papers and your charts, or he will have them anyway.' };
    case 'practice':
      return { title: 'a fishing boat', text: 'a fishing boat out of Lanzarote, her crew hauling nets, and not a gun aboard her. the gun crews have never fired a shot in anger: run her down for practice, and learn how a fight goes before one matters.' };
    case 'ore':
      return { title: 'shining ore', text: 'black rock on the beach shot through with glittering yellow. the hands swear it is gold, as Frobisher’s men swore of theirs in 1578.' };
    case 'settlement':
      return { title: 'a Portuguese settlement', text: 'a sugar mill and a church on the shore, and the smoke of a town beyond. Portugal took the King of Spain for its king this year, and nobody knows yet whether Brazil will. they may deal with an English ship, or send word south.' };
    case 'normans':
      return { title: 'a Norman ship', text: 'a ship of Dieppe in the bay, her boats ferrying brazilwood out from the beach where the Tupinambá stack it, as they did for Villegagnon. her master is glad of an Englishman to talk to.' };
    case 'misconduct':
      return { title: 'trouble ashore', text: `some of the hands ashore have taken what wasn't given and laid hands on ${PEOPLES[d.people].name}. their elders have come down to the boats. the Spaniards, the English like to say, sought not the people but their goods; this is how it starts.` };
    case 'huguenots':
      return { title: 'Huguenots', text: 'two ships of La Rochelle, flying the white cross of the Prince of Condé: Huguenot privateers out after Spanish prizes, as Coligny sent them. their captain hails you as a friend and a fellow Protestant.' };
    case 'christmas':
      return { title: 'Christmas Day', text: 'Christmas at sea. the hands look for a double ration and a holiday, as on any ship out of a Christian country; the steward looks at the bread room.' };
    case 'accession':
      return { title: 'the Queen’s day', text: 'the seventeenth of November, the day the Queen came to the throne, kept at home with bells and bonfires and the tilt at Whitehall. at sea, a gun fired for her if there’s powder to spare.' };
    case 'reckoning':
      return { title: 'the reckoning', text: 'Plymouth, and the voyage is over but for this. your backers have had their shares. now the court will hear of what you did, and so will Spain’s ambassador, who demanded Drake’s head for less.' };
  }
}

export function choices(s: WorldState, d: Dilemma): Choice[] {
  switch (d.kind) {
    case 'storm': {
      const [lo, hi] = lightenRange(s.gold);
      return [
        { key: 'ride', label: 'ride it out', stakes: `${range(STORM_HULL)} damage, spares first (${s.stores.spares} aboard), then hull, never the last` },
        { key: 'run', label: 'run before it', stakes: `no damage, but ${range(STORM_RUN)} days driven off your course` },
        { key: 'lighten', label: 'lighten ship', stakes: `throw ${lo === hi ? lo : `${lo} to ${hi}`} gold over the side, and no damage`, ...(s.gold <= 0 ? { barred: 'nothing aboard to throw over' } : {}) },
      ];
    }
    case 'fever':
      return [
        { key: 'press', label: 'press on', stakes: `${range(FEVER_PRESS)} hands dead of it` },
        { key: 'nurse', label: 'lie to and nurse them', stakes: `${FEVER_NURSE_DAYS} days making no way, and ${range(FEVER_NURSE)} dead` },
      ];
    case 'foul':
      return [
        { key: 'drink', label: 'drink it', stakes: `the flux: ${range(FLUX)} hands dead of it` },
        { key: 'heave', label: 'heave it over', stakes: `lose half the water: ${Math.round(s.stores.water * FOUL_LOST)} rations` },
      ];
    case 'weevils':
      return [
        { key: 'eat', label: 'eat it anyway', stakes: `about one time in ${Math.round(1 / WEEVIL_SICK)}, a hand sickens of it and dies` },
        { key: 'heave', label: 'heave the worst over', stakes: `lose a quarter of the food: ${Math.round(s.stores.food * WEEVIL_LOST)} rations` },
      ];
    case 'leak':
      return [
        { key: 'fother', label: 'fother it', stakes: 'a sail drawn under her bottom over the leak: a bundle of the spares and a day', ...(s.stores.spares <= 0 ? { barred: 'no spare canvas to do it with' } : {}) },
        { key: 'pump', label: 'pump and press on', stakes: `${LEAK_HULL} hull, never the last` },
      ];
    case 'wreck':
      return [
        { key: 'board', label: 'board her', stakes: `${WRECK_DAYS} days. she may have stores, or silver, or nothing, or the sickness that emptied her` },
        { key: 'sail', label: 'sail on', stakes: 'nothing ventured' },
      ];
    case 'canoes':
      return [
        { key: 'trade', label: 'trade with them', stakes: `${CANOE_COST} gold in trinkets: the casks filled, ${CANOE_DAYS} days of fresh food`, ...(s.gold < CANOE_COST ? { barred: 'nothing in the purse to trade' } : {}) },
        ...(s.truck > 0 ? [{ key: 'truck', label: 'trade truck', stakes: `a chest of knives and beads: the casks filled, ${CANOE_DAYS} days of fresh food, and their goodwill` }] : []),
        { key: 'alongside', label: 'let them come aboard', stakes: 'fruit for nothing, a week of it, but they will take what they can lift' },
        { key: 'warn', label: 'fire a gun over them', stakes: 'a barrel of powder, and they keep off; they won’t forget it', ...(s.stores.powder <= 0 ? { barred: 'no powder' } : {}) },
      ];
    case 'reef':
      return [
        { key: 'lighten', label: 'lighten her', stakes: s.spice > 0 ? `half the spice over the side: ${Math.ceil(s.spice / 2)} tons` : 'two barrels of powder and a quarter of the food over the side' },
        { key: 'wait', label: 'wait for the tide', stakes: `${range(REEF_DAYS)} days fast, and even odds she pounds: ${range(REEF_HULL)} hull` },
      ];
    case 'gentleman':
      return [
        { key: 'try', label: 'try him, and behead him', stakes: 'a man dead, and nobody will talk of drowning again' },
        { key: 'maroon', label: 'put him ashore', stakes: 'he goes, and his friends may go with him: 1 to 3 hands' },
        { key: 'leave', label: 'let it be', stakes: `${s.backer === 'gentlemen' ? 'his fellow adventurers aboard will see to it that' : 'even odds that'} ${range(DISCONTENT_LOST)} hands slip away at the next landmark` },
      ];
    case 'rumor': {
      const from = landmark(d.key).detour!.from.filter((k) => !s.voyage.visited.includes(k) || k === s.voyage.at).map((k) => landmark(k).name);
      return [
        { key: 'follow', label: 'see for yourself', stakes: `${landmark(d.key).name} goes among your choices at ${from.join(' or ')}; ${trustOf(d.source)}` },
        { key: 'ignore', label: 'let it be', stakes: 'sailors’ talk: you keep to the way' },
      ];
    }
    case 'deserters':
      return [
        { key: 'go', label: 'let them go', stakes: `${range(DESERTERS)} hands stay behind` },
        { key: 'watch', label: 'double the watch', stakes: `a day, and even so ${range(SLIP_AWAY)} may slip over the side, one time in three` },
      ];
    case 'gold-mutiny':
      return [
        { key: 'join', label: 'lead them', stakes: `${range(MUTINY_GOLD)} gold from a coast village, and fresh food; Spain will hear of it${s.voyage.visited.includes('cacafuego') ? '' : ', and the treasure ship be warned'}` },
        { key: 'firm', label: 'hold firm', stakes: 'even odds they slip away at the next landmark: 2 to 5 hands' },
        { key: 'maroon', label: 'maroon the ringleaders', stakes: `${range(MAROONED)} hands put ashore; even odds the Spanish catch them and they talk${s.voyage.visited.includes('cacafuego') ? '' : ', and the treasure ship is warned'}` },
      ];
    case 'stores-fire':
      return [
        { key: 'fight', label: 'fight it', stakes: `wet canvas and buckets: a bundle of the spares, and ${Math.round(FIRE_FOUGHT * 100)}% of the food`, ...(s.stores.spares <= 0 ? { barred: 'no canvas to fight it with' } : {}) },
        { key: 'shut', label: 'batten the hatch and let it burn out', stakes: `${Math.round(FIRE_SHUT * 100)}% of the food` },
      ];
    case 'eve': {
      const fort = landmark(d.town).offers.raid === 'fortress';
      return [
        { key: 'press', label: 'go in now', stakes: `the boats in a rising sea: ${range(EVE_HULL)} hull and ${range(EVE_HANDS)} hands before you're ashore` },
        { key: 'stand', label: 'stand off till it blows over', stakes: `${EVE_DAYS} days of stores, and the ${fort ? 'garrison' : 'town'} warned: ${EVE_WARNED_HULL} more to its walls, its relief sooner` },
        { key: 'land', label: 'land the men, and leave the ship', stakes: `no guns from the ship in the fight, and even odds ${range(EVE_CUT_OFF)} hands are cut off` },
      ];
    }
    case 'feast':
      return [
        { key: 'go', label: 'go yourself', stakes: `his favour: Plymouth's prices here and two weeks of fresh food; ${Math.round(FEAST_TREACHERY * 100)} in 100, poison or seizure: ${range(FEAST_DEAD)} of your boat's crew dead, and a ransom` },
        { key: 'deputy', label: 'send a gentleman', stakes: 'a week of fresh food, and courtesy; little risk' },
        { key: 'decline', label: 'decline, politely', stakes: 'nothing gained, nothing risked' },
      ];
    case 'jailed': {
      const fine = jailFine(s);
      return [
        { key: 'pay', label: 'pay the governor', stakes: `${fine} gold`, ...(s.gold < fine ? { barred: 'not enough in the purse' } : {}) },
        { key: 'leave', label: 'leave them', stakes: `${range(JAILED)} hands lost` },
        { key: 'break', label: 'break them out', stakes: `even odds a man or two is killed doing it; the market here shut to you after` },
      ];
    }
    case 'papers': {
      const charts = followed(s).filter((k) => !s.voyage.visited.includes(k)).length;
      return [
        { key: 'hand', label: 'hand over the charts', stakes: charts ? `the rumors you mean to follow go with them: ${charts}` : 'nothing they can use: your charts of the way are the Spaniards’ own' },
        { key: 'bribe', label: 'bribe the officer', stakes: `${PAPERS_BRIBE} gold`, ...(s.gold < PAPERS_BRIBE ? { barred: 'not enough in the purse' } : {}) },
        { key: 'refuse', label: 'refuse', stakes: d.at ? `you sail out under their guns: ${range(EVE_HULL)} hull, and the market here shut to you` : 'she will fight for them' },
      ];
    }
    case 'practice':
      return [
        { key: 'practise', label: 'practise on her', stakes: 'a fight that costs nothing: no powder, no hull, no hands, and the fight explained as it goes' },
        { key: 'leave', label: 'let her be', stakes: 'learn it when it matters' },
      ];
    case 'ore':
      return [
        { key: 'load', label: 'load it', stakes: `a day's work, and ${ORE_ROOM} tons of the hold that could carry spice` },
        { key: 'leave', label: 'leave it', stakes: 'if it is gold, someone else will have it' },
      ];
    case 'settlement': {
      return [
        { key: 'treat', label: 'send a boat to treat', stakes: `${Math.round(SETTLEMENT_DEALS * 100)} in 100 they deal: the casks filled and ${SETTLEMENT_DAYS} days of fresh food for ${SETTLEMENT_COST}; else turned away, and word sent south${s.voyage.visited.includes('cacafuego') ? '' : ' to warn the coast ahead of you'}` },
        { key: 'clear', label: 'keep clear', stakes: 'nothing gained, and nobody the wiser' },
      ];
    }
    case 'normans': {
      const room = woodRoom(s) - s.wood;
      const afford = Math.floor(s.gold / NORMAN_WOOD_COST);
      const tons = Math.max(0, Math.min(room, afford));
      return [
        { key: 'news', label: 'trade news', stakes: 'a cask of English beer for what they know of the Portuguese' },
        { key: 'buy', label: 'buy her brazilwood', stakes: `${tons} ${tons === 1 ? 'ton' : 'tons'} at ${NORMAN_WOOD_COST} a ton, cheaper than cutting your own; it sells at home for ${WOOD_WORTH}`, ...(tons <= 0 ? { barred: room <= 0 ? 'no room in the hold' : 'not enough in the purse' } : {}) },
        { key: 'leave', label: 'let her be', stakes: 'a wave, and on your way' },
      ];
    }
    case 'misconduct':
      return [
        { key: 'punish', label: 'flog the men before them', stakes: `${PEOPLES[d.people].name} see justice done and think the better of you; one time in three the man flogged runs` },
        { key: 'amends', label: 'pay amends', stakes: s.truck > 0 ? 'a chest of truck, and it is mended' : `${AMENDS} gold, and it is mended`, ...(s.truck <= 0 && s.gold < AMENDS ? { barred: 'nothing to pay with' } : {}) },
        { key: 'pass', label: 'let it pass', stakes: `nothing now; ${PEOPLES[d.people].name} turn against you, and remember it` },
      ];
    case 'huguenots':
      return [
        { key: 'company', label: 'keep company', stakes: `${COMPANY_DAYS} days together: privateers and corsairs stand off from two ships, but you sail at the slower one's pace` },
        { key: 'news', label: 'trade news', stakes: 'what they know of the Spanish and Portuguese, for what you know' },
        { key: 'commission', label: 'take a French commission', stakes: 'a letter from the Huguenot leaders as well as your own: what you take from Spain angers its ambassador half as much, but the Queen likes it less at court', ...(s.backer === 'crown' ? { barred: 'the Queen’s commission forbids a second master' } : s.french ? { barred: 'you carry one already' } : {}) },
        { key: 'part', label: 'part company', stakes: 'a salute of guns, and on your way' },
      ];
    case 'christmas':
      return [
        { key: 'keep', label: 'keep it: a double ration', stakes: `a day's food more eaten, and the hands in better heart${s.seen.includes('discontent') ? ': the grumbling dies down' : ''}` },
        { key: 'plain', label: 'keep it plain', stakes: `nothing spent; one time in ${Math.round(1 / PLAIN_GRUMBLE)} the hands grumble, and it comes to a head at the next landmark` },
      ];
    case 'accession':
      return [
        { key: 'salute', label: 'fire a salute', stakes: `a barrel of powder, and the hands cheer${s.seen.includes('discontent') ? ': the grumbling dies down' : ''}`, ...(s.stores.powder <= 0 ? { barred: 'no powder to fire' } : {}) },
        { key: 'toast', label: 'drink her health', stakes: 'a toast in the great cabin, and nothing spent' },
      ];
    case 'reckoning': {
      const sale = saleValue(s);
      const pleased = pleasure(s);
      const risk = Math.round(courtRisk(s) * 100);
      const gift = giftGold(s);
      const ring = proofOfService(s);
      const pirateAfterGift = outlawed({ ...s, infamy: Math.max(0, s.infamy - pardonOf(s) - (ring ? 1 : 0)) });
      const jewels = favourOf(s) ? `; the jewels set aside presented to her${pleased ? `, ${pleased} more fame for her pleasure in them` : ''}` : '';
      return [
        {
          key: 'court', label: 'show yourself at court',
          stakes: outlawed({ ...s, infamy: Math.max(0, s.infamy - (ring ? 1 : 0)) }) ? `with your name, and no favour: named a pirate, and ${Math.round(SEIZED * 100)}% of the prize seized` : `${fameFor(s.gold + sale) + pleased} fame to the score${risk ? `; ${risk} in 100 you are disowned to please Spain, hand back ${restitutionFor(s)} and have no fame` : ring ? ', and the dead commander’s ring answers for you' : ', and nobody to say otherwise'}${jewels}`,
        },
        { key: 'low', label: 'lie low', stakes: `${s.jewels.length ? 'every jewel sold, ' : ''}${outlawed(s) ? `even odds they come for you anyway, and ${Math.round(SEIZED * 100)}% of the prize is seized` : 'safe, and no fame'}` },
        {
          key: 'gift', label: 'a gift for the Queen',
          stakes: pirateAfterGift ? `${gift} from the treasure, and even so your name is too black: named a pirate` : `${gift ? `${gift} from the treasure` : 'the jewels are gift enough'}${s.infamy ? `, ${Math.min(s.infamy, pardonOf(s) + (ring ? 1 : 0))} of the questions forgotten` : ''}, and court is safe: ${fameFor(s.gold + sale - gift) + pleased} fame`,
          ...(s.gold <= 0 && !favourOf(s) ? { barred: 'nothing to give' } : {}),
        },
      ];
    }
  }
}

/** Make the choice. Throws if there's nothing to choose, or the choice is barred. */
export function choose(sea: Sea, s: WorldState, key: string): WorldState {
  return mourn(sea, s, decide(sea, s, key));
}

function decide(sea: Sea, s: WorldState, key: string): WorldState {
  const d = s.dilemma;
  if (!d) throw new Error('there is nothing to choose');
  const c = choices(s, d).find((x) => x.key === key);
  if (!c) throw new Error(`no choice ${key}`);
  if (c.barred) throw new Error(c.barred);
  if (d.kind === 'rumor') return heed(s, key === 'follow');
  if (d.kind === 'practice' && key === 'practise') return practise(s);
  if (d.kind === 'eve') return goIn(s, d.town, key as 'press' | 'stand' | 'land');
  if (d.kind === 'papers' && key === 'refuse' && !d.at) return patrol({ ...s, dilemma: null, log: [...s.log, { turn: s.turn, text: 'you refuse the patrol your papers' }] });
  if (d.kind === 'reckoning') {
    const r: Roller = { rng: s.rng };
    const w = reckon(s, key as 'court' | 'low' | 'gift', () => roll(r));
    return { ...w, rng: r.rng };
  }
  const r: Roller = { rng: s.rng };
  let w: WorldState = { ...s, dilemma: null };
  const log = (text: string) => (w = { ...w, log: [...w.log, { turn: w.turn, text }] });
  const between = ([a, b]: readonly [number, number]) => a + Math.floor(roll(r) * (b - a + 1));
  const hands = (n: number) => (n === 1 ? 'a hand' : `${n} hands`);

  switch (`${d.kind}:${key}`) {
    case 'storm:ride': {
      // Spare canvas and timber take the damage first; then the hull.
      const blow = between(STORM_HULL);
      const spent = Math.min(blow, w.stores.spares);
      const lost = Math.min(blow - spent, w.hull - 1);
      w = { ...w, hull: w.hull - lost, stores: { ...w.stores, spares: w.stores.spares - spent } };
      const parts = [spent && `${spent} of the spares`, lost && `${lost} hull`].filter(Boolean).join(' and ');
      log(parts ? `the storm ridden out, at ${parts}` : 'the storm ridden out, with nothing left to lose');
      break;
    }
    case 'storm:lighten': {
      const [lo, hi] = lightenRange(w.gold);
      const lost = Math.min(w.gold, between([lo, hi]));
      w = { ...w, gold: w.gold - lost };
      log(`${lost} thrown over the side, and the ship rides light through the storm`);
      break;
    }
    case 'storm:run': {
      const days = between(STORM_RUN);
      w = { ...w, calm: w.turn + days };
      log(`running before the storm: ${days} days driven off your course`);
      break;
    }
    case 'fever:press':
    case 'fever:nurse': {
      const how = key as 'press' | 'nurse';
      const dead = feverDeaths(w, how, r);
      w = { ...w, crew: w.crew - dead, ...(how === 'nurse' ? { calm: w.turn + FEVER_NURSE_DAYS } : {}) };
      log(`${how === 'nurse' ? 'lying to while the sick are nursed' : 'pressing on through the fever'}: ${dead ? `${hands(dead)} dead of it` : 'nobody lost'}`);
      break;
    }
    case 'foul:drink': {
      const dead = fluxDeaths(w, r);
      w = { ...w, crew: w.crew - dead };
      log(dead ? `the foul water drunk, and the flux: ${hands(dead)} dead of it` : 'the foul water drunk, and nobody the worse');
      break;
    }
    case 'foul:heave':
      w = { ...w, stores: { ...w.stores, water: Math.round(w.stores.water * (1 - FOUL_LOST)) } };
      log('the foul casks heaved over the side');
      break;
    case 'weevils:eat': {
      const dead = Math.min(w.crew, deaths(r, WEEVIL_SICK));
      w = { ...w, crew: w.crew - dead };
      log(dead ? 'the weevils eaten with the bread, and a hand sickened of it and died' : 'the weevils eaten with the bread, and the hands grumbling');
      break;
    }
    case 'weevils:heave':
      w = { ...w, stores: { ...w.stores, food: Math.round(w.stores.food * (1 - WEEVIL_LOST)) } };
      log('the worst of the bread heaved over the side');
      break;
    case 'leak:fother':
      w = { ...w, calm: Math.max(w.calm, w.turn + 1), stores: { ...w.stores, spares: w.stores.spares - 1 } };
      log('a sail fothered under her bottom, and the leak taken up');
      break;
    case 'leak:pump': {
      const lost = Math.min(LEAK_HULL, w.hull - 1);
      w = { ...w, hull: w.hull - lost };
      log(`pumping watch and watch, and pressing on: ${lost} hull`);
      break;
    }
    case 'wreck:board': {
      w = { ...w, calm: Math.max(w.calm, w.turn + WRECK_DAYS) };
      const cap = capacity(w);
      const luck = roll(r);
      if (luck < 0.4) {
        w = { ...w, stores: { food: topUp(w.stores.food, w.crew * 12, cap.food), water: topUp(w.stores.water, w.crew * 10, cap.water), spares: topUp(w.stores.spares, 1, cap.spares), powder: topUp(w.stores.powder, 1, cap.powder) } };
        log('the wreck boarded: biscuit, casks, canvas and powder out of her hold');
      } else if (luck < 0.65) {
        const gold = between(WRECK_GOLD);
        w = { ...w, gold: w.gold + gold };
        log(`the wreck boarded: a strongbox in the great cabin, ${gold} in it`);
      } else if (luck < 0.85) {
        log('the wreck boarded: stripped already, nothing in her but water');
      } else {
        const dead = Math.min(w.crew, between(WRECK_SICK));
        w = { ...w, crew: w.crew - dead };
        log(`the wreck boarded, and the sickness that emptied her came back with the boarders: ${hands(dead)} dead of it`);
      }
      break;
    }
    case 'wreck:sail':
      log('the wreck left to drift');
      break;
    case 'canoes:trade': {
      const cap = capacity(w);
      w = { ...w, gold: w.gold - CANOE_COST, fresh: 0, stores: { ...w.stores, water: Math.max(w.stores.water, cap.water), food: topUp(w.stores.food, w.crew * CANOE_DAYS, cap.food) } };
      log('beads and knives for coconuts, fish and fresh water');
      w = deal(w, canoePeople(sea, w), FAIR);
      break;
    }
    case 'canoes:alongside': {
      const cap = capacity(w);
      w = { ...w, fresh: 0, stores: { ...w.stores, food: topUp(w.stores.food, w.crew * 7, cap.food) } };
      if (w.stores.spares > 0) {
        w = { ...w, stores: { ...w.stores, spares: w.stores.spares - 1 } };
        log('fruit for all hands, and a bundle of the spares gone over the side into a canoe');
      } else {
        const gone = Math.min(w.gold, 5);
        w = { ...w, gold: w.gold - gone };
        log(`fruit for all hands, and ${gone} gone from the cabin before they were off`);
      }
      break;
    }
    case 'canoes:warn':
      w = { ...w, stores: { ...w.stores, powder: w.stores.powder - 1 } };
      log('a gun fired over the canoes, and they turn back for the beach');
      w = deal(w, canoePeople(sea, w), -1);
      break;
    case 'canoes:truck': {
      const cap = capacity(w);
      w = { ...w, truck: w.truck - 1, fresh: 0, stores: { ...w.stores, water: Math.max(w.stores.water, cap.water), food: topUp(w.stores.food, w.crew * CANOE_DAYS, cap.food) } };
      log('a chest of knives and beads for coconuts, fish and fresh water');
      w = deal(w, canoePeople(sea, w), FAIR);
      break;
    }
    case 'reef:lighten':
      if (w.spice > 0) {
        const over = Math.ceil(w.spice / 2);
        w = { ...w, spice: w.spice - over };
        log(`${over} tons of spice over the side, and she floats off`);
      } else {
        w = { ...w, stores: { ...w.stores, powder: Math.max(0, w.stores.powder - 2), food: Math.round(w.stores.food * 0.75) } };
        log('powder and food over the side, and she floats off');
      }
      break;
    case 'reef:wait': {
      const days = between(REEF_DAYS);
      w = { ...w, calm: Math.max(w.calm, w.turn + days) };
      if (roll(r) < 0.5) {
        const lost = Math.min(between(REEF_HULL), w.hull - 1);
        w = { ...w, hull: w.hull - lost };
        log(`${days} days fast on the reef, pounding: ${lost} hull, and then the tide lifts her`);
      } else log(`${days} days fast on the reef, and the tide lifts her off unhurt`);
      break;
    }
    case 'gentleman:try':
      w = { ...w, crew: w.crew - 1 };
      log('the gentleman tried before the company and beheaded on the beach. nobody talks of drowning now');
      break;
    case 'gentleman:maroon': {
      const friends = Math.min(w.crew - 1, between([0, 2]));
      w = { ...w, crew: w.crew - 1 - friends };
      log(`the gentleman put ashore with his chest${friends ? `, and ${hands(friends)} went with him` : ', alone'}`);
      break;
    }
    case 'gentleman:leave':
      w = { ...w, seen: [...w.seen, 'discontent'] };
      log('you let it be, and the grumbling goes on below');
      break;
    case 'deserters:go': {
      // The boatswain, while he lives, talks one of them round.
      const lost = Math.min(w.crew, Math.max(1, between(DESERTERS) - (alive(w, 'boatswain') ? 1 : 0)));
      w = { ...w, crew: w.crew - lost };
      log(`${hands(lost)} paid off to stay in the islands`);
      break;
    }
    case 'deserters:watch': {
      w = { ...w, calm: Math.max(w.calm, w.turn + 1) };
      if (roll(r) < 1 / 3) {
        const lost = Math.min(w.crew, Math.max(1, between(SLIP_AWAY) - (alive(w, 'boatswain') ? 1 : 0)));
        w = { ...w, crew: w.crew - lost };
        log(`the watch doubled, and still ${hands(lost)} slipped over the side in the night`);
      } else log('the watch doubled, and every hand aboard when she sails');
      break;
    }
    case 'gold-mutiny:join': {
      const gold = between(MUTINY_GOLD);
      const cap = capacity(w);
      w = { ...w, gold: w.gold + gold, grievance: w.grievance + gold, lastPrize: w.turn, fresh: 0, stores: { ...w.stores, food: topUp(w.stores.food, w.crew * 10, cap.food) } };
      if (!w.voyage.visited.includes('cacafuego')) w = { ...w, seen: [...w.seen, 'coast-alarm'] };
      log(`you lead them ashore: a village on the coast plundered, ${gold} in silver and its hens and maize, and the alarm carried up the coast`);
      break;
    }
    case 'gold-mutiny:firm':
      w = { ...w, seen: [...w.seen, 'discontent'] };
      log('you hold firm, and they put up their arms, muttering');
      break;
    case 'gold-mutiny:maroon': {
      const lost = Math.min(w.crew, between(MAROONED));
      w = { ...w, crew: w.crew - lost };
      const caught = roll(r) < 0.5;
      if (caught && !w.voyage.visited.includes('cacafuego')) w = { ...w, seen: [...w.seen, 'coast-alarm'] };
      log(`${hands(lost)} put ashore with their arms and a cask of water${caught ? '; the Spanish will have them before long, and they will talk' : ''}`);
      break;
    }
    case 'stores-fire:fight':
    case 'stores-fire:shut': {
      const share = key === 'fight' ? FIRE_FOUGHT : FIRE_SHUT;
      w = { ...w, stores: { ...w.stores, food: Math.round(w.stores.food * (1 - share)), spares: w.stores.spares - (key === 'fight' ? 1 : 0) } };
      log(key === 'fight' ? 'the fire beaten out with wet canvas, and a share of the biscuit lost' : 'the hatch battened down, and the bread room burned out');
      // On short commons or driven hard, hungry men remember Charlesfort, where they killed their captain when the stores burned.
      if ((w.rations === 'starving' || w.pace === 'hard') && roll(r) < 0.3) {
        w = { ...w, seen: [...w.seen, 'discontent'] };
        log('the hands mutter about a captain at Charlesfort who was killed when the stores burned');
      }
      break;
    }
    case 'feast:go': {
      const at = (d as { at: string }).at;
      if (roll(r) < FEAST_TREACHERY) {
        const dead = Math.min(w.crew, between(FEAST_DEAD));
        const ransom = Math.min(w.gold, FEAST_RANSOM);
        w = { ...w, crew: w.crew - dead, gold: w.gold - ransom };
        log(`treachery at the feast: ${hands(dead)} of your boat's crew dead of poison, and ${ransom} paid for your own way back aboard`);
      } else {
        const cap = capacity(w);
        w = { ...w, fresh: 0, seen: [...w.seen, `favour:${at}`], stores: { ...w.stores, food: topUp(w.stores.food, w.crew * 14, cap.food) } };
        log('feasted ashore, and in favour: fresh food sent aboard, and Plymouth’s prices here');
      }
      break;
    }
    case 'feast:deputy': {
      const cap = capacity(w);
      w = { ...w, fresh: 0, stores: { ...w.stores, food: topUp(w.stores.food, w.crew * 7, cap.food) } };
      log('a gentleman sent ashore with your compliments, and a week of fresh food back with him');
      break;
    }
    case 'feast:decline':
      log('you decline the feast, with gifts and regrets');
      break;
    case 'jailed:pay': {
      const fine = jailFine(w);
      w = { ...w, gold: w.gold - fine };
      log(`${fine} to the governor, and the hands let out of his lock-up`);
      break;
    }
    case 'jailed:leave': {
      const lost = Math.min(w.crew, between(JAILED));
      w = { ...w, crew: w.crew - lost };
      log(`${hands(lost)} left in the governor's lock-up`);
      break;
    }
    case 'jailed:break': {
      const at = (d as { at: string }).at;
      const dead = roll(r) < 0.5 ? Math.min(w.crew, between([1, 2])) : 0;
      w = { ...w, crew: w.crew - dead, seen: [...w.seen, `shut:${at}`] };
      log(`the lock-up broken open in the night${dead ? `, and ${hands(dead)} killed doing it` : ''}: nobody here will sell to you now`);
      break;
    }
    case 'papers:hand': {
      const lost = followed(w).filter((k) => !w.voyage.visited.includes(k));
      w = { ...w, rumors: w.rumors.map((x) => (lost.includes(x.key) ? { ...x, followed: false } : x)) };
      log(lost.length ? `your charts handed over, and with them the ${lost.length === 1 ? 'rumor' : 'rumors'} you meant to follow` : 'your charts handed over: the Spaniards find their own coasts on them');
      break;
    }
    case 'papers:bribe':
      w = { ...w, gold: w.gold - PAPERS_BRIBE };
      log(`${PAPERS_BRIBE} to the officer, and he finds your papers in order`);
      break;
    case 'papers:refuse': {
      const at = (d as { at: string | null }).at!;
      const lost = Math.min(between(EVE_HULL), w.hull - 1);
      w = { ...w, hull: w.hull - lost, seen: [...w.seen, `shut:${at}`] };
      log(`you refuse, and sail out under their guns: ${lost} hull, and nothing to be bought here now`);
      break;
    }
    case 'ore:load':
      w = { ...w, calm: Math.max(w.calm, w.turn + 1), seen: [...w.seen, 'ore'] };
      log(`${ORE_ROOM} tons of the shining ore loaded, and the hands already spending it`);
      break;
    case 'practice:leave':
      log('you let the fishing boat be');
      break;
    case 'ore:leave':
      log('you leave the ore on the beach');
      break;
    case 'settlement:treat': {
      if (roll(r) < SETTLEMENT_DEALS) {
        const cap = capacity(w);
        const paid = Math.min(w.gold, SETTLEMENT_COST);
        w = { ...w, gold: w.gold - paid, fresh: 0, stores: { ...w.stores, water: Math.max(w.stores.water, cap.water), food: topUp(w.stores.food, w.crew * SETTLEMENT_DAYS, cap.food) } };
        log(`they deal: the casks filled and fresh food sent off, for ${paid}, and no questions about whose king is whose`);
      } else {
        if (!w.voyage.visited.includes('cacafuego') && !w.seen.includes('coast-alarm')) w = { ...w, seen: [...w.seen, 'coast-alarm'] };
        log('they turn your boat away with a volley over its head, and a rider goes south with word of an English ship');
      }
      break;
    }
    case 'settlement:clear':
      log('you keep clear of the settlement');
      break;
    case 'normans:news':
      log('the Norman master’s news, over English beer');
      return tellOf({ ...w, rng: r.rng }, 'azores', 'gossip');
    case 'normans:buy': {
      const tons = Math.max(0, Math.min(woodRoom(w) - w.wood, Math.floor(w.gold / NORMAN_WOOD_COST)));
      w = { ...w, wood: w.wood + tons, gold: w.gold - tons * NORMAN_WOOD_COST };
      log(`${tons} tons of the Normans’ brazilwood swayed aboard, for ${tons * NORMAN_WOOD_COST}`);
      break;
    }
    case 'normans:leave':
      log('you leave the Normans to their loading');
      break;
    case 'misconduct:punish': {
      const p = (d as { people: People }).people;
      log(`the men flogged at the gangway before ${PEOPLES[p].name}`);
      if (roll(r) < 1 / 3) {
        w = { ...w, crew: w.crew - 1 };
        log('the man flogged slipped away in the night');
      }
      w = deal(w, p, FAIR);
      break;
    }
    case 'misconduct:amends': {
      const p = (d as { people: People }).people;
      w = w.truck > 0 ? { ...w, truck: w.truck - 1 } : { ...w, gold: w.gold - AMENDS };
      log(`amends paid to ${PEOPLES[p].name}, and the matter mended`);
      break;
    }
    case 'misconduct:pass': {
      const p = (d as { people: People }).people;
      log('you let it pass');
      w = deal(w, p, HARSH);
      break;
    }
    case 'huguenots:company':
      w = { ...w, company: w.turn + COMPANY_DAYS };
      log(`in company with the Rochellers, ${COMPANY_DAYS} days`);
      break;
    case 'huguenots:news':
      log('news traded with the Rochellers over their wine');
      return newsOf({ ...w, rng: r.rng }, 'gossip');
    case 'huguenots:commission':
      w = { ...w, french: true };
      log('a commission from the Huguenot leaders at La Rochelle, signed for the Prince of Condé');
      break;
    case 'huguenots:part':
      log('a salute of guns, and the Rochellers go their way');
      break;
    case 'christmas:keep':
      w = { ...w, stores: { ...w.stores, food: Math.max(0, w.stores.food - w.crew * CHRISTMAS_DAYS) }, seen: w.seen.filter((x) => x !== 'discontent') };
      log('Christmas kept with a double ration, a hogshead of wine broached, and no work but the watch');
      break;
    case 'christmas:plain':
      if (roll(r) < PLAIN_GRUMBLE && !w.seen.includes('discontent')) {
        w = { ...w, seen: [...w.seen, 'discontent'] };
        log('Christmas kept plain, and the hands grumbling that it was never so on any ship they sailed in');
      } else log('Christmas kept plain: prayers, and the day’s work');
      break;
    case 'accession:salute':
      w = { ...w, stores: { ...w.stores, powder: w.stores.powder - 1 }, seen: w.seen.filter((x) => x !== 'discontent') };
      log('a gun fired for the Queen, and the hands cheering her name');
      break;
    case 'accession:toast':
      log('the Queen’s health drunk in the great cabin');
      break;
  }
  // A storm in the right waters may drive you onto an island: likelier running before it.
  if (d.kind === 'storm') w = driven(sea, w, key === 'run', r);
  return { ...w, rng: r.rng };
}

/** Going in to raid on the eve of a storm, one way or another. */
function goIn(s: WorldState, town: string, how: 'press' | 'stand' | 'land'): WorldState {
  const r: Roller = { rng: s.rng };
  const between = ([a, b]: readonly [number, number]) => a + Math.floor(roll(r) * (b - a + 1));
  let w: WorldState = { ...s, dilemma: null };
  const log = (text: string) => (w = { ...w, log: [...w.log, { turn: w.turn, text }] });
  if (how === 'press') {
    const hull = Math.min(between(EVE_HULL), w.hull - 1);
    const lost = Math.min(w.crew, between(EVE_HANDS));
    w = { ...w, hull: w.hull - hull, crew: w.crew - lost };
    log(`the boats go in through the surf: ${hull} hull and ${lost === 1 ? 'a hand' : `${lost} hands`} lost to the sea before the fight`);
    return raidFight({ ...w, rng: r.rng }, town);
  }
  if (how === 'stand') {
    const eat = w.crew * EVE_DAYS;
    w = { ...w, stores: { ...w.stores, food: Math.max(0, w.stores.food - eat), water: Math.max(0, w.stores.water - eat) } };
    log(`${EVE_DAYS} days standing off while it blows, and the town sees you`);
    return raidFight({ ...w, rng: r.rng }, town, { extra: { hull: EVE_WARNED_HULL, reliefSooner: 1 } });
  }
  // Landed: the ship's guns stay with the ship; and some may never get back to her.
  if (roll(r) < 0.5) {
    const cut = Math.min(w.crew, between(EVE_CUT_OFF));
    w = { ...w, crew: w.crew - cut };
    log(`the men landed in the lee of a headland, and ${cut === 1 ? 'a hand' : `${cut} hands`} cut off from the boats`);
  } else log('the men landed in the lee of a headland, all of them');
  return raidFight({ ...w, rng: r.rng }, town, { noGuns: true });
}

/** How far to trust a source, said plainly. */
const trustOf = (source: Source) =>
  SOURCES[source].truth >= 0.8 ? 'he has no reason to lie' : SOURCES[source].truth >= 0.65 ? 'likely enough' : 'it may be true'
