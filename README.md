# privateer

A card-based roguelike about the voyage of a Drake copycat. Plymouth,
autumn 1580: the *Golden Hind* is in with a hold full of Spanish silver,
and every gentleman with a ship thinks *I could do that too*. You are one
of them. It has Oregon Trail's bones: fit out, sail a chain of landmarks
with forks in it, keep the crew alive, take what Spain leaves lying about,
and come home. It's an alpha: play it at
[bobbymeyer.com/privateer](https://bobbymeyer.com/privateer/).

Underneath it is a rules module that knows nothing about drawing, a browser
front end in Svelte, a terminal harness, and simulators that play whole runs
to tune the numbers. Every push to `main` is tested and published to GitHub
Pages, and the site serves it from there.

The design is in [docs/the-voyage.md](docs/the-voyage.md).

## playing

Play it on the site, or `npm run dev` and open the page.

- **Fit out at Plymouth.** You have a pinnace, 20 hands of her complement
  of 30, two months' food, a month's water, 2 bundles of spares, 3 barrels
  of powder, and 80 gold. The chandler sells by the lot: 300 rations of
  biscuit and salt meat for 4, 300 of water for 1, a bundle of canvas,
  cordage and timber for 3, a barrel of powder and shot for 3, five hands
  for 4. Abroad, where they'll deal with you at all, it's half as dear
  again. The bar, the yard and bigger ships are there too.
- **The voyage panel** says the landmark you last raised and lists where
  you can make for next, with the days on the lanes and what a captain
  knows of each. Where the way divides you choose: the Strait or the Horn,
  on across the Pacific or back the way you came, the Moluccas or Manila.
  Once you've left Plymouth you can always turn for home.
- **Sailing**: choose a landmark, or click the chart for anywhere else, and
  set sail. The ship sails the lanes a day at a time and heaves to when she
  raises land, when a ship comes alongside, when a hostile sail comes into
  sight, or for news: a storm, a fever, the water gone foul, the crew close
  to mutiny. You can turn aside for a port or a prize and come back on
  course.
- **Stores**: every day each hand eats and drinks a ration; water goes half
  as fast again in the tropics. Set the rations (full, short, starvation)
  and the pace (easy, steady, crack on). Six weeks without fresh food and
  the scurvy starts to kill.
- **Ashore**: at a landmark with a shore, fill the casks (2 days), forage
  and fish (3), careen (5) or rest the crew (4). Islanders trade water and
  fresh food for 3 gold.
- **Events that ask**: a storm, fever aboard, foul water, weevils, the crew
  wanting their shares, a man on a beach. Each choice says what it stakes.
- **The fight** is cards: see *the loop*. It costs powder and hands, and a
  prize's hold fills yours.
- **Pirates**: fire on an English ship and you are one. English ports shut,
  and Plymouth would hang you. A pardon costs 80 in an English port; or
  retire rich (150) in a pirate's haven: Baltimore, Algiers, Tunis, Tripoli
  or Salé.
- **The run is won** by raising Plymouth again. It's lost if the ship goes
  down, or if fewer than 8 hands are left to work her.

**The score** (`src/world/score.ts`) is the treasure home, 2 for every hand
home, and up to 20 for the ship, by the hull she has left. It's set against
the voyages of the time:

| a voyage like | means |
| --- | --- |
| Drake's | round the world, 150 or more home, and at least half her complement alive |
| Cavendish's | 150 or more home, by any way, short of Drake's |
| Fenton's | home again, with less than 150 |
| Oxenham's | lost |
| a pirate's end | retired rich in a haven, never home |

Each run has a seed in the URL; `?seed=42` plays the same world again.
*Today's voyage* is a seed fixed for the date, the same for everyone.

## the voyage

The landmarks (`src/world/landmarks.ts`) are the chain a captain of 1580
would sail, Drake's way westward as the main line, with the forks the
captains of the time chose between. `src/world/journey.ts` moves you along
them; `map.ts` places each on the chart and adds its legs to the lanes.
Days per leg, on the lanes at a steady pace:

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

**The Strait or the Horn.** On the map they're two days apart. At sea the
Strait is the slow, sheltered way: bound through it, within 6 steps of it,
the williwaws hold you at anchor one day in two. The Horn is the fast way
with the storms: past 55°S a storm is ten times as likely. Sailed from San
Julián to Mocha, victualled, over 30 seeds: 43 days by the Strait with 0.8
storms, 32 round the Horn with 1.5.

**The treasure ship off Cape San Francisco** (`src/world/treasure.ts`).
Every year the silver of Potosí went north from Callao to Panama in one
galleon, alone, because nobody had ever come to take her; Drake overhauled
the *Cacafuego* there in March 1579. Raise Cape San Francisco and she comes
alongside, the first time only. If the coast is still asleep she takes you
for a Spaniard: 4 hull under a galleon's 13, her guns struck below. If you
have raided a town on the coast of Chile and Peru on the way, word has gone
ahead and she's warned: 4 hull over. Either way she carries 150 over a
galleon's 30, and beaten she strikes rather than sinks, so her whole hold is
yours, though she can still run. Over 400 fights, a pinnace takes her
asleep 92% of the time for 172 on average; warned, 23% of the time for 51.
A brigantine takes her warned 79% of the time for 147. So the coast is a
choice: raid Valparaíso and Callao for their storehouses, or let it sleep
and take the silver.

**What wears down** (`src/world/stores.ts`, `src/world/weather.ts`):

- **Hands**: a number against the ship's complement (pinnace 30, sloop 45,
  brigantine 70, frigate 110). Hire more by fives in port.
- **Food and water**, in rations: a hand for a day. Full rations eat 1,
  short 0.67, starvation 0.34, of both. Water goes 1.5 times as fast inside
  the tropics. A ship carries food for 180 days of her complement and water
  for 90. With none left, about 3% of the hands die a day of hunger, 8% of
  thirst. Short rations cost a point of morale every 10 days, starvation
  every 4.
- **Scurvy**: past 42 days without fresh food it kills, a little more each
  day it goes on. Foraging, buying food in port, a town's storehouses and
  islanders' fruit reset it; fish and birds put it back 10 days.
- **The hull**: weed and worm take a point every 40 days at sea at an easy
  pace, 25 steady, 15 cracking on. Careening mends 2 a bundle of spares, and
  1 for the scraping.
- **Spares**: a storm ridden out takes them before the hull.
- **Pace**: easy makes no way one day in three; cracking on makes two days'
  way one day in three, and costs a point of morale every 12 days.
- **Powder**: a barrel for every three shots fired. With none, the guns are
  silent.

**The way's events**, at sea:

| event | how often | what it does |
| --- | --- | --- |
| rain squall | 1 in 20 days in the tropics | casks topped up, 8 rations a hand |
| fish, birds, a turtle | 1 in 25 | 3 days of food, scurvy put back 10 days |
| a calm | 1 in 15 in the doldrums | 2 to 6 days without way |
| williwaws | 1 in 2, in the Strait | a day at anchor |
| a hand overboard | 1 in 150 | a hand lost |
| fever aboard | 1 in 45 in the tropics | press on (2 to 5 dead) or nurse them (3 days lying to, 0 or 1 dead) |
| the water gone foul | 1 in 90 | drink it (the flux, 1 to 4 dead) or heave half of it over |
| weevils in the bread | 1 in 90 | eat it (morale −1) or heave a quarter of the food over |
| a storm | 1 in 120, more in its seasons and latitudes | ride it out (1 to 3, spares first), run before it (2 to 4 days downwind), or lighten ship |

A surgeon halves the dead of fever and the flux.

## the loop

A fight is two ships, two decks, and the range between them (`src/rules.ts`).

- **The range**: grappled, close or far. Most cards care. Long guns reach
  at far, a broadside is heavy close, boarders only go across grappled.
  Chase and grapnels close the range; bearing away opens it. Opened past
  far, whoever opened it is away. A card out of range does nothing, and
  the fight says so.
- **Her intent is face up**: the top card of her deck, shown before you
  choose. You play first, then she plays it.
- **Your hand**: three dealt from your deck. Keep two; they resolve in the
  order you name them and are spent. The third goes under your deck.
- **Where it starts**: close when you fire first; far when she comes at
  you. A town can't move: close is the boats offshore, grappled is the
  party ashore.
- **Wounds**: some shot leaves a leak (2 hull), a fire (3) or shot-away
  sails (that ship can't bear away till they're dealt with), as a card on
  top of the wounded ship's deck.
- **The chain: sail → shot → board.** Every card has a type: *sail*,
  *shot*, *board* or *hands*. Played in the order of a boarding action,
  each card that follows the one before scales: shot after sail is +1 to
  its hits, board after sail-then-shot +2 to its plunder. Hands neither add
  to it nor break it; anything out of order starts it again.
- **Each kind fights its own way**: a merchant runs, a guard ship closes
  and is deadly alongside, a galleon's great guns ruin you close, an
  armada's long guns reach you far off, a town mends its barricades and
  calls its relief.

A ship is **credibly threatened**, and its flee cards work, at half hull or
less, or outgunned two to one.

Card text is written from the effects (`cardText` in `src/cards.ts`), so a
card can't say other than it does.

**What it costs and what it pays** (`settle` in `src/world/meet.ts`):

- **Powder**: a barrel for every three shot cards you played. With no
  powder aboard, the shot cards stay out of your deck: sails and boarders.
- **Hands**: for every point of hull lost, 1.5% of those aboard are killed.
- **Her hold**: a prize taken fills yours as far as there's room, in days
  of food and water for a crew like yours: a merchant about 25 and 20, a
  galleon 30 and 25, a warship less food and more powder. A town's
  storehouses are 45 days of fresh food, and its well fills the casks.
- **Prize cards**: three from that kind's pool; keep one, for good, or none.
  A yard strikes a card for 6, down to a deck of 10.
- The payout goes in the purse; prisoners questioned give rumors; a ship
  destroyed is laid up at home for 60 days.

| target | hull | hold |
| --- | --- | --- |
| merchant | 11 | 12 |
| privateer, corsair | 11 | 8, 6 |
| guard ship | 14 | 3 |
| galleon | 13 | 30 |
| treasure fleet | 22 | 60 |
| armada | 26 | 4 |
| open town | 12 | 25 |
| fortified port | 20 | 45 |

**Your deck is your ship** (`src/outfit.ts`), never stored, worked out from
the ship, its refits, your hands of note and your prize cards:

| ship | cost | hull | complement | berths |
| --- | --- | --- | --- | --- |
| pinnace | (you start in one) | 12 | 30 | 2 |
| sloop | 40 | 14 | 45 | 3 |
| brigantine | 90 | 17 | 70 | 4 |
| frigate | 180 | 22 | 110 | 6 |

A smaller ship carries fewer: buy down and the hands and stores over her
capacity are paid off and sold. Hands of note (a master gunner, marksmen, a
quartermaster, a boatswain, a surgeon, a pilot, a navigator) are hired in
the bar, one of each, as many as you have berths. Refits belong to the
ship.

## the world

It is 1580, strictly (`src/world/ports.ts`, `src/world/wars.ts`). Spain and
Portugal are one crown since this year, so every Iberian port from Lisbon
to Goa to Manila is hostile. There's no Dutch East India Company, no
Batavia, no English colony anywhere. France is divided and its Huguenots
friendly; the Barbary corsairs are hostile to everyone. In the Moluccas the
Sultan of Ternate has thrown out the Portuguese.

**The wars are fixed.** England is at war with Spain, Portugal, the Barbary
states and Morocco from the first day, and the others' wars are the ones
of the time: the Dutch Revolt against Spain and Portugal, the Ottomans
against Malta, the corsairs against most of Christendom. They don't drift.
You can still start one: attacking a nation at peace with England strains
the peace, and at 6 it's war.

**The coast is where the action is.** `src/world/data/world.json` is built
by `npm run world` from Natural Earth's 1:10m land (public domain): a node
offshore every 60 nautical miles along every coast, the ocean filled in
sparser farther out, everything triangulated on the sphere, inland water
and the ice dropped. Ten straits too narrow for the spacing are traced by
hand in `src/world/passages.ts`, Magellan above all.

**A turn is a day.** Every leg longer than a day's sail is split into days
(`src/world/map.ts`), 24,331 steps in all.

**Sea lanes** (`buildLanes` in `src/world/map.ts`). Everyone sails the
lanes, you too: the shortest paths between each port and its three
nearest, a tree spanning every port, the great crossings (`OCEAN_LANES` in
`src/world/ocean.ts`), the great courses, and the voyage's legs. About
2,700 of the 24,000 nodes; the map's adjacency is the lanes and nothing
else, so ships meet on them.

**The grain of the sea** (`src/world/ocean.ts`): currents with a course, a
strength and a width; a wind model of the trades, the doldrums, the
westerlies and the Roaring Forties, following the sun through the year,
with the monsoon over the Indian seas; rivers pushing out to sea; banks
that keep deep keels off. Seasons are 91 days.

**The living sea** (`src/world/ships.ts`):

| kind | habit |
| --- | --- |
| merchant | one out of every port, trading with ports within 30 days, three times likelier under its own flag |
| treasure fleet | the flota and galeones (Cádiz, the Canaries, Veracruz or Cartagena and Nombre de Dios, Havana); half speed |
| treasure ship | the Manila galleon (Acapulco, Umatac, Manila), the Portuguese carreira (Lisbon, Mozambique, Goa), the South Sea's plate ship (Arica, Callao, Panama) |
| armada | the Armada de Barlovento round the Caribbean, the Mar Océano off Iberia; half speed |
| guard ship | at Havana, Cartagena, San Juan, Goa, Malacca, Manila, Mozambique and Algiers; they keep station until their nation wants you, then chase you within 25 days of it |
| privateer | out of Dunkirk, Saint-Malo, La Rochelle, Amsterdam, Salé, Algiers, Lisbon, Havana and Cartagena; when their nation is at war with England they come for you within 10 days of home, and one that has fought you leaves you be for 60 days |
| corsair | out of Algiers, Salé, Tunis and Tripoli, cruising off a port within 45 days of home |
| sea monster | one in each named sea, drifting with the current |

The coast of Chile and Peru keeps no guard ships: in 1579 Drake found it
asleep, and so will you, until you raid it.

**Flags and standing.** Every nation keeps a standing with you. Attack one
of its ships and it falls: one for landing damage or taking plunder, two
for a sinking. Below zero, its guard ships hunt you and its ports won't
deal with you until its officials are bribed (10 gold, times how far below
zero you are). Standing drifts a point back toward zero every 60 days.
**Countries protect their waters**: a guard ship never enters another
nation's waters, and a foreign one found inside them is driven off.

**Meeting a ship**, on the same node outside a port: a hostile ship attacks;
anyone else comes alongside and the choice is yours, attack or let her
pass.

**Raiding a port.** In port, raid it instead of trading. A town can't run,
carries its valuables inland while you fight, and from the fourth round
calls its relief. Sacking it takes the treasury and its storehouses, and
it has nothing for anybody for 120 days; its nation's guard ships hunt
twice as far for 30. A raid turned out short of a sack leaves the town on
its guard for 90 days: shut for 14, then 4 more hull and its relief 2
rounds sooner for each raid it has turned out, its treasury refilling 1 a
day.

**Rumors are bought by the round** (`src/world/bar.ts`), 2 gold a round in
a port's bar: a ship somebody saw, a few days back, true with some
reliability that falls as the room gets drunker. A rumor is a fading ring
on the chart and a cloud of where her ship could be by now, tighter where
you've charted the current and wind (`src/world/rumors.ts`).

**Uncharted islands**: eight a run, out in open ocean. Sight one and the
Crown pays 15; after that it's an anchorage where no ship troubles you,
and the hull mends a point a day.

**Morale** (`src/world/events.ts`) starts at 7 of 10. Sixty days after the
last prize the crew lose a point every 15 days; hunger, cracking on and
weevils cost more. At nothing it's mutiny. A prize (+3), a sack (+4), the
first round in a bar, islanders' fruit, foraging, rest and a good omen put
it back.

**The chart is a woodcut** (`src/ui/woodcut.ts`, `src/ui/SeaChart.svelte`),
sepia on parchment, drawn in code: water-lining, hatched land, rhumb lines,
the seas lettered as the charts of the time named them, ports and ships as
woodcuts. The landmarks are on it: the next ones in ink, the one you're
bound for ringed, the ones raised faded. **The sea moves**
(`src/ui/SeaShader.svelte`): a WebGL shader draws the engraver's wave marks
under the chart, rolling. **Sound** (`src/ui/sound.ts`), off until asked
for: the sea, the ship's bell, the guns, coin, a storm, all WebAudio.

**Under the chart, three tabs**: *location* (the landmark, the shore, a
port's chandler, bar, yard and raid), *politics* (who's at war, standing,
the flags), and *ship & crew* (`src/ui/ShipSheet.svelte`). The sidebar
keeps the hull, morale and stores (`src/ui/Stores.svelte`), the rations and
pace, the course, the voyage, what's in sight, rumors and news.

**When a run ends**, the screen gives the score and the voyage it was like,
tells the last fight if one sank you (`src/world/record.ts`), and the run in
numbers. **The logbook** (`src/logbook.ts`) keeps every run in the browser:
the score, the gold, the landmarks raised, the days, how it ended. It
downloads as JSON, which is the way to send real runs back for balancing.

**The run saves as you go** (`src/save.ts`), after every day and every card.
A save carries a version, and a step in `MIGRATIONS` brings an older one up
to date, so a run in progress survives an update.

## balance

`npm run voyage` plays whole runs with a captain bot (`cli/voyage.ts`). It
fits out at the chandler, sails the voyage taking a fork at random, rations
by the leg ahead, waters, forages and careens where there's a shore, fights
by one-step lookahead and runs when outgunned, and turns aside for a prize
within 8 days.

```
npm run voyage -- [--runs 20] [--days 730] [--from 0]
  --straight  keep to the voyage: no turning aside for prizes, no raids off it
  --trace     each run's landmarks, deaths and fights, from the log
  --where     where the ship is and what it's steering for, every five days
```

Over 40 runs of up to 1,000 days, it **wins 9** (23%), on day 504 on
average, with 92 in the purse: 7 voyages like Fenton's and 2 like
Cavendish's. The other 31 are lost on day 396 on average, 28 of them for
want of hands, 3 in a fight; about 14 hands a run die of want, scurvy far
ahead of thirst. With `--straight`, keeping to the way, it wins 13 of 40
(33%) with 79 in the purse: 11 like Fenton's, 2 like Cavendish's. No run has
yet come home like Drake's: round the world, rich, and half the crew alive.
Scurvy on the long crossings is what stands between.

It's hard, and meant to be, but the bot is a poor captain: it never hires
hands abroad, has no plan for the Pacific crossing, and takes the
treasure ship only when it happens to be fit to. A person will do better;
the logbook will say.

What moved the numbers to here: the treasure ship, and a crew that sours only after 60 days without a prize, then every 15 (it was 30 and 10, which on a voyage meant a mutiny every crossing); privateers hunting within 10 days of home
rather than 20, and leaving you be 60 days after a fight (from 33 meetings a
run to about 4); no guard ships on the Pacific coast; fights killing 1.5% of
the hands a point of hull, not 3%; calms one day in 15 in the doldrums, not
10; and scurvy killing more slowly.

## running it

Node 22.12+.

```bash
npm install
npm run dev                  # the browser version, http://localhost:5173
npm run build                # static build in dist/, relative paths
npm run check                # svelte-check and TypeScript

npm test                     # the rules and the world, 162 tests
npm run play                 # one encounter in the terminal, random seed
npm run play -- --seed 42    # that encounter again
npm run sim                  # card bots × 2000 fights (--target armada, --hull 14)
npm run voyage               # whole runs with a captain bot (see balance)
npm run rumors               # how good a rumor is, by age and knowledge
npm run world -- ne.geojson  # rebuild the world graph from Natural Earth (1:10m)
npm run coast -- ne.geojson  # rebuild the coastline the browser draws (1:50m)
npm run chart -- out.svg land.geojson [--turns 2000 --flow current --box w,s,e,n --scale 30]
```

In the browser, keys: space sets sail or heaves to, f finds the ship, + and
− zoom; in a fight 1 2 3 pick, enter resolves.

## layout

```
src/
  rng.ts         seeded RNG; its whole state is one integer kept in the game state
  cards.ts       the effect vocabulary, card types and card text
  rules.ts       createEncounter, act, legalActions — pure, no I/O
  setup.ts       every kind of ship and town, and its deck
  describe.ts    words for events and the cards' glossary, shared by terminal and browser
  save.ts        saving a run to the browser, and migrating it forward
  logbook.ts     the logbook of finished runs, and today's voyage
  outfit.ts      ships, crew, refits, prize cards: what your deck is made of
  ui/            Svelte: App, SeaChart, SeaShader, Fight, CardView, Gauge, ShipSheet, Stores; sound.ts
  world/
    data/        world.json: the world graph, from Natural Earth
    passages.ts  the narrow straits, traced by hand
    ports.ts     the ports of 1580 and their flags
    ocean.ts     currents, rivers, banks, the wind model, the great courses and crossings
    drake.ts     Drake's raid round the world, as the places he touched
    landmarks.ts the voyage's landmarks and forks: data only
    journey.ts   where you are on the voyage, where you're bound, raising a landmark, coming home
    geo.ts       the sphere: distances, great circles, headings
    map.ts       the world graph split into days, with ports, lanes and landmarks
    sea.ts       currents and wind per node, and how they weigh a leg
    ships.ts     the kinds of ship and how each moves
    rumors.ts    making a rumor, its fading marker, its prediction
    bar.ts       buying rounds, and what the room tells you
    meet.ts      meeting a ship, fighting it, settling up, raids, repairs
    port.ts      hiring, the yard, bribes, pardons, and who will deal with you
    wars.ts      who's at war with whom in 1580, and so what's fair game
    stores.ts    hands, food, water, spares, powder; the shore; the chandler; what a fight costs and a prize pays
    weather.ts   the days at sea: rain, fish, calms, williwaws, fever, foul water, weevils
    events.ts    a day at sea: morale and mutiny, storms, omens
    dilemmas.ts  events that ask you something, and what each choice stakes
    score.ts     the score, and the voyage of the time it was like
    treasure.ts  the treasure ship off Cape San Francisco, asleep or warned
    scout.ts     the lookout, and a read of a ship before you meet her
    seas.ts      the named seas, where the chart letters them and the monsters keep
    course.ts    setting a course and sailing it a day at a time, at a pace
    world.ts     createWorld, advance, observe, hearRumor — pure, like rules.ts
    testing.ts   a test helper: holds that never empty
cli/
  play.ts        the interactive harness
  sim.ts         bots and their outcome tables
  voyage.ts      whole runs with a captain bot
  render.ts      text rendering shared by both
```

`rules.ts` knows nothing about drawing. A renderer reads `EncounterState`
and its `events` log and sends `Action`s back. The `events` log is there so a
renderer can animate what happened, not just show the new state.
