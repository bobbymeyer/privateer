# privateer

A card-based roguelike about the voyage of a Drake copycat. Plymouth,
December 1580: the *Golden Hind* is in with a hold full of Spanish silver,
and every gentleman with a ship thinks *I could do that too*. You are one
of them. It has Oregon Trail's bones: choose your ship, fit out, sail a
chain of landmarks with forks in it, keep the crew alive, take what Spain
leaves lying about, and come home. It's an alpha: play it at
[bobbymeyer.com/privateer](https://bobbymeyer.com/privateer/).

Underneath it is a rules module that knows nothing about drawing, a browser
front end in Svelte, and simulators that play whole voyages to tune the
numbers. Every push to `main` is tested and published to GitHub Pages, and
the site serves it from there. The design is in
[docs/the-voyage.md](docs/the-voyage.md).

## playing

**Choose your ship**, as the trail has you choose a trade
(`SHIP_CLASSES` in `src/outfit.ts`). The smaller the ship, the bigger the
purse and the more the voyage counts for; the bigger, the stouter, the
better gunned and the deeper the hold.

| ship | purse | hull | hands | deck | score |
| --- | --- | --- | --- | --- | --- |
| pinnace | 120 | 12 | 20 of 30 | 15 cards | ×2 |
| sloop | 70 | 14 | 30 of 45 | 16, a raking fire more | ×1.5 |
| brigantine | 30 | 17 | 47 of 70 | 17, a broadside and a raking fire more | ×1 |

**Fit out** at Plymouth's chandler: food at 4 for 300 rations, water at 1
for 300, five hands for 4, a bundle of spares or a barrel of powder for 3.
Abroad, a chandler is half as dear again. You start with two months' food
and a month's water for the hands aboard.

**Continue on.** The screen is the chart of the whole voyage, what you've
got, and one button. The ship sails the lanes a day at a time to the next
landmark and stops when something happens: a landmark raised, an event, a
sail, a storm, the end. Where the way divides you choose the leg; you can
turn for home whenever you like. Space continues on, or heaves to.

**At a landmark**, what it offers (`offers` in `src/world/landmarks.ts`):
fill the casks (2 days), forage and fish (3), careen her (5); a chandler
(Plymouth, Ternate, Bantam), or islanders who fill your casks and sell
three weeks of fresh food for 3 (the Ladrones, Table Bay); or a Spanish
town to raid, once (Valparaíso, Callao, Guatulco, Manila).

**Rations and pace.** Full, short or starvation rations stretch food and
water at the cost of hands; easy, steady or crack on lose or gain a day in
three, at the cost of the hull.

**The way's events** ask you how to meet them, and say what each choice
costs: storms, fever, foul water, weevils, a leak, a wreck adrift, islanders'
canoes, a reef in the Indies, a gentleman stirring the crew at San Julián,
hands who'd stay in the islands. Between them the days differ by where you
are: seals off Patagonia, ice and fog in the high latitudes, crossing the
line, rats, a fire in the galley, the worm in her planking.

**Spice.** Cloves at Ternate, pepper at Bantam, by the ton, a ton for every
five of her complement; each sells for 20 on the quay at Plymouth. On a reef
it's the spice you throw over first, as Drake did.

**Rumors** (`src/world/rumors.ts`) open detours off the way. You hear one
from prisoners after a prize, from islanders, from gossip at a chandler's,
or from the Sultan's pilot; follow it, and the detour is among your choices
where it branches, rejoining the way after. About one in three is false,
settled when you hear it and shaded by who told you (a prisoner 55% true,
gossip 65%, islanders 70%, the Sultan's pilot 85%); you learn which by
going, and a false one is the days spent for nothing.

| rumor | heard | from | days on | if true |
| --- | --- | --- | --- | --- |
| the Manila galleon, at Cabo San Lucas | Spanish prisoners on the Pacific coast | Guatulco (17), Nova Albion (20) | 103 to the Ladrones | the galleon comes in: +4 hull over a galleon, 280 more in her, taken whole |
| the Isles of Solomon | islanders at the Ladrones, Spanish prisoners | Guatulco, Nova Albion, Cabo San Lucas, the Ladrones (28) | 41 to Ternate | water, food, a careen, islanders; one time in four, gold dust |
| the Great Ship of Amacon, off Macau | gossip at Ternate, Portuguese prisoners in the East | the Ladrones, Manila (12), Ternate (26) | 31 to Java | the carrack for Nagasaki: +5 hull, 320 more, taken whole |
| the Banda islands | the Sultan's pilot at Ternate | Ternate (9) | 25 to Java | nutmeg as a gift, half your spice room |
| Goa | gossip at Bantam, Portuguese prisoners in the East | Java (46) | 80 to the Cape | a fortress to raid: +4 walls over a fortified port, 300 more in it |
| the carrack from Goa, off the Azores | gossip at Bantam, a castaway at the Cape, prisoners off Brazil | Sierra Leone (35), Brazil (51) | 23 to Plymouth | the year's carrack: +6 hull, 400 more, taken whole |

How the prizes go, on a sound hull, by the fight bot over 300 fights:

| | pinnace | sloop | brigantine |
| --- | --- | --- | --- |
| the plate ship, asleep | 92% | 93% | 97% |
| the Manila galleon | 24% | 50% | 78% |
| the Great Ship | 13% | 34% | 71% |
| the carrack from Goa | 6% | 24% | 64% |
| Goa | 0% | 1% | 26% |

**Storm landfalls** (`src/world/landfalls.ts`). A storm met in the right
waters drives you onto an island one time in eight, one in five running
before it: 2 to 5 days drifting, and there you lie, as at a landmark, until
you continue on to where you were bound. Each comes once a run.

| island | the waters | what's there |
| --- | --- | --- |
| Bermuda, the Isle of Devils | 80°W–50°W, 25°N–40°N | reefs coming in (even odds, 1 to 3 hull); hogs, birds, water, a careen. The Spanish keep away |
| St Helena | 25°W–10°E, 30°S–2°S | the Portuguese secret: water, lemons, goats |
| Mauritius | 45°E–80°E, 30°S–10°S | nobody: dodos, tortoises, water, ebony, a careen |
| the Galápagos | 100°W–82°W, 10°S–5°N | tortoises, a month of fresh meat in the hold; little water |
| Juan Fernández | 85°W–75°W, 40°S–28°S | goats and streams, a careen |

**A sail** is a roll each day at sea, about one in 25, and who she is
depends on the waters (`WATERS` in `src/world/meet.ts`): Spanish and
Portuguese privateers and Barbary corsairs off Spain and Morocco, who come
at you; Portuguese merchants off Brazil and Guinea, Spanish ones off Peru,
Portuguese merchants and carracks in the East, which are yours to attack
or let pass. Elsewhere the sea is empty.

**The treasure ship** (`src/world/treasure.ts`). Raise Cape San Francisco
and the year's silver from Callao comes alongside, once: 4 hull under a
galleon's if the coast is asleep, 4 over if you raided Valparaíso or
Callao on the way. She carries 150 over a galleon's hold, and beaten she
strikes, so the whole of it is yours.

**A fight** is cards (see *the loop*). It spends a barrel of powder for
every three shots fired, and kills hands for every point of hull lost;
with no powder the guns are silent. A prize's hold fills yours; a town's
storehouses are fresh food.

**The score** (`src/world/score.ts`): treasure home, 2 for every hand
alive, up to 20 for the ship's condition, times your ship's multiplier,
set against the voyages of the time.

| a voyage like | means |
| --- | --- |
| Drake's | round the world, 200 or more home, at least half the complement alive |
| Cavendish's | home rich, but dear in men, or not round the world |
| Fenton's | home, poorer than you left, or with little to show |
| Oxenham's | lost |

The voyage saves as you go (`src/save.ts`, version 12; a run from before
the simplification is dropped). Every voyage that ends goes in the
logbook, with its score. *Today's voyage* is the same seed for everyone
that day.

## the voyage

The landmarks are the chain a captain of 1580 would sail, Drake's way
westward as the main line, with the forks the captains of the time chose
between. `journey.ts` moves you along them; `map.ts` places each on the
chart and adds its legs to the lanes. Days per leg, at a steady pace:

| from | to | days |
| --- | --- | --- |
| Plymouth | the Canaries | 28 |
| the Canaries | the Cape Verde islands | 16 |
| the Cape Verde islands | the coast of Brazil | 53 |
| the coast of Brazil | the River Plate | 10 |
| the River Plate | Port San Julián | 18 |
| Port San Julián | **the Strait of Magellan** / **round the Horn** | 9 / 10 |
| the Strait / the Horn | Mocha Island | 21 / 22 |
| Mocha Island | Valparaíso | 7 |
| Valparaíso | Callao | 24 |
| Callao | off Cape San Francisco | 15 |
| off Cape San Francisco | **Guatulco** / **the Strait, homeward** | 22 / 61 |
| Guatulco | **Nova Albion** / **the Ladrones** | 37 / 117 |
| Nova Albion | the Ladrones | 87 |
| the Ladrones | **Ternate** / **Manila** | 26 / 29 |
| Ternate or Manila | Java | 28 |
| Java | the Cape of Good Hope | 95 |
| the Cape | Sierra Leone | 54 |
| Sierra Leone | Plymouth | 51 |
| the Strait, homeward | the coast of Brazil, homeward | 59 |
| Brazil, homeward | Plymouth | 71 |

You come home *round the world* (by the Ladrones or the Cape), *back the
way you went* (by the Strait homeward), or *turned back*.

**The Strait or the Horn.** On the map they're a day apart. At sea the
Strait is the slow, sheltered way: bound through it, the williwaws hold you
at anchor one day in two. The Horn is the fast way, with the storms: past
55°S a storm is ten times as likely.

**What wears down** (`src/world/stores.ts`, `src/world/weather.ts`):

- **Hands**: a number against the complement. Fewer than 8 and she can't
  be sailed: the voyage is lost.
- **Food and water**, in rations: a hand for a day. Full rations eat 1,
  short 0.67, starvation 0.34, of both; water goes 1.5 times as fast in the
  tropics. A ship carries 180 days of food and 90 of water for her
  complement. With none, about 3% of the hands die a day of hunger, 8% of
  thirst; on starvation rations hunger kills a little even with food aboard.
- **Scurvy**: past 42 days without fresh food it kills, a little more each
  day it goes on, worse on short rations. Foraging, food bought in port, a
  town's storehouses and islanders' fruit reset it; fish and birds put it
  back 10 days.
- **The hull**: weed and worm take a point every 60 days at an easy pace,
  40 steady, 25 cracking on. Careening mends 2 a bundle of spares, and 1
  for the scraping. A storm ridden out takes spares before hull.

| event | how often | what it does |
| --- | --- | --- |
| rain squall | 1 in 20 days in the tropics | casks topped up |
| fish, birds, a turtle | 1 in 25 | 3 days of food, scurvy put back 10 days |
| a calm | 1 in 15 in the doldrums | 2 to 6 days without way |
| williwaws | 1 in 2, in the Strait | a day at anchor |
| a hand overboard | 1 in 150 | a hand lost |
| fever aboard | 1 in 45 in the tropics | press on (2 to 5 dead) or nurse them (3 days lying to, 0 or 1 dead) |
| the water gone foul | 1 in 90 | drink it (the flux, 1 to 4 dead) or heave half over |
| weevils in the bread | 1 in 90 | eat it (3 in 10, a hand dead) or heave a quarter of the food over |
| a storm | 1 in 120, more in its seasons and latitudes | ride it out (1 to 3, spares first), run before it (2 to 4 days lost), or lighten ship |
| a leak | 1 in 160 | fother it (a bundle of spares and a day) or pump and press on (2 hull) |
| a wreck adrift | 1 in 220 | board her (2 days: stores, a strongbox, nothing, or her sickness) or sail on |
| canoes | 1 in 30 among the Pacific islands | trade (2 gold: water, 14 days of fresh food), let them aboard (fruit, and they steal), or fire a gun over them |
| aground on a reef | 1 in 30 in the Indies | lighten her (half the spice, or powder and food) or wait for the tide (1 to 2 days, even odds of 2 to 3 hull) |
| a gentleman adventurer | at San Julián, once | try him (a hand), maroon him (1 to 3), or let it be (even odds 2 to 5 slip away at the next landmark) |
| hands who'd stay | 35% at the Ladrones, Ternate, Java | let them go (2 to 4) or double the watch (a day, and one time in three 1 to 3 slip away) |

And the ones that just happen (`src/world/happenings.ts`): crossing the
line and the Southern Cross, once each; seals and penguins off Patagonia (1
in 6, 10 to 24 days of fresh meat); ice in the rigging below 50°S (1 in 6, a
day); fog above 42° (1 in 25, a day); calms in the horse latitudes (1 in 30,
1 to 3 days); a fire in the galley, rats in the bread room, lightning,
flotsam, the worm in her planking; and, one day in twelve, a line about the
sea itself, by region.

## the loop

A fight is two ships, two decks, and the range between them
(`src/rules.ts`).

- **The range**: grappled, close or far. Most cards care. Long guns reach
  at far, a broadside is heavy close, boarders only go across grappled.
  Opened past far, whoever opened it is away.
- **Her intent is face up**: the top card of her deck, shown before you
  choose.
- **Your hand**: three dealt; keep two, which resolve in the order you name
  them; the third goes under your deck.
- **Where it starts**: close when you attack; far when she comes at you.
  A town can't move: close is the boats offshore, grappled is the party
  ashore, and its relief comes if the raid drags on.
- **Wounds**: a leak, a fire or shot-away sails, as a card on top of the
  wounded ship's deck.
- **The chain: sail → shot → board.** Played in the order of a boarding
  action, each card that follows the one before scales: shot after sail
  +1, board after sail-then-shot +2.

Card text is written from the effects (`cardText` in `src/cards.ts`), so a
card can't say other than it does.

## balance

`npm run voyage` sails whole voyages with a captain bot (`cli/voyage.ts`):
it fits out (hands, water, food, then spares and powder), takes forks at
random, rations by the leg ahead, waters, forages and careens where there's
a shore, buys and trades where it can, attacks merchants and the treasure
ship on a sound enough hull, leaves the coast of Peru asleep for the
silver, follows every rumor (and attacks a rumored prize on a hull still a
quarter sound), and fights by one-step lookahead.

```
npm run voyage -- [--ship pinnace|sloop|brigantine|all] [--runs 40] [--from 0] [--raid] [--wake] [--no-rumors] [--trace]
```

Over 40 voyages a ship:

| ship | home | on day | with | like Drake's / Cavendish's / Fenton's | rumors heard | detours sailed (true / false) |
| --- | --- | --- | --- | --- | --- | --- |
| pinnace | 16 (40%) | 633 | 148 gold, 15 hands | 2 / 4 / 10 | 24 | 20 (13 / 7) |
| sloop | 21 (53%) | 571 | 117 gold, 22 hands | 0 / 7 / 14 | 24 | 12 (8 / 4) |
| brigantine | 22 (55%) | 603 | 177 gold, 31 hands | 1 / 8 / 13 | 29 | 25 (12 / 13) |

What ends the rest is almost always too few hands: scurvy on the long
crossings above all, then hunger, the way's events and fights. The bot
seldom gets the good of a rumored prize: it met one 3 times in 120
voyages, since the galleon and the carracks are mostly heard of from
prisoners and it takes few prizes, and it comes to them with its hull worn
down. A person who
forages at every shore, hires hands where they can, careens before a
detour and keeps a sound hull for the prizes will do better.

## running it

Node 22.12+.

```bash
npm install
npm run dev                  # the browser version, http://localhost:5173
npm run build                # static build in dist/
npm run check                # svelte-check and TypeScript

npm test                     # the rules and the voyage, 116 tests
npm run sim                  # card bots × 2000 fights (--target privateer, --ship sloop)
npm run voyage               # whole voyages with a captain bot (see balance)
npm run world -- ne.geojson  # rebuild the world graph from Natural Earth (1:10m)
npm run coast -- ne.geojson  # rebuild the coastline the browser draws (1:50m)
```

## layout

```
src/
  rng.ts         seeded RNG; its whole state is one integer kept in the game state
  cards.ts       the effect vocabulary, card types and card text
  rules.ts       createEncounter, act, legalActions — pure, no I/O
  setup.ts       every kind of ship and town you can fight, and its deck
  describe.ts    words for events and the cards' glossary
  outfit.ts      the three ships you can choose, and the deck each fights with
  save.ts        saving a voyage to the browser
  logbook.ts     the logbook of finished voyages, and today's voyage
  ui/            Svelte: App, RouteChart, Fight, CardView, Gauge, Flag; sound.ts
  world/
    data/        world.json and coast.json, from Natural Earth
    geo.ts       the sphere: distances, great circles, headings
    ports.ts     the ports of 1580, their flags and their names
    ocean.ts     rivers, straits, banks, the great crossings and courses
    passages.ts  the narrow straits, traced by hand
    map.ts       the world graph split into days, with its lanes and landmarks
    landmarks.ts the voyage's landmarks, forks and what each offers
    journey.ts   where you are on the voyage, where you're bound, coming home
    world.ts     createWorld and a day of the voyage — pure, like rules.ts
    course.ts    continuing on, at a pace, and why the ship stops
    events.ts    a day: storms, the weather, the stores
    weather.ts   rain, fish, calms, williwaws, fever, foul water, weevils
    happenings.ts the rest of what happens on the way, by region, and on arriving
    dilemmas.ts  events that ask you something, and what each choice stakes
    stores.ts    hands, food, water, spares, powder; the shore; the market; a fight's cost and a prize's hold
    meet.ts      a sail sighted by the waters, attacking, raiding a town, settling a fight
    treasure.ts  the treasure ship off Cape San Francisco, asleep or warned
    rumors.ts    rumors heard, the detours they open, and what's at the end of them
    landfalls.ts storms that drive you onto an island
    reading.ts   what you can tell of a ship before you engage her
    record.ts    the voyage's tally, and the last fight told
    score.ts     the score, and the voyage of the time it was like
cli/
  sim.ts         card bots and their outcome tables
  voyage.ts      whole voyages with a captain bot
  bots.ts        the bots
```

`rules.ts` knows nothing about drawing. A renderer reads `EncounterState`
and its `events` log and sends `Action`s back.
