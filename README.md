# privateer

A card game in progress. So far: one encounter, a rules module that knows
nothing about drawing, a plain browser front end in Svelte, a terminal
harness, and a simulator to tune the numbers.

It will go up on bobbymeyer.com once it has something to look at.

## the loop

1. Your ship's cards and the target's cards are shuffled into one deck.
2. Three are dealt. Keep two, in the order they should resolve. The third
   goes to the bottom.
3. It ends when either side **flees**, when either hull reaches 0, or when
   the deck can't deal a full hand and the ships **part**.

Every action and decision in combat is a card. There is no stop button.

- **shot** — `hit` and `hurt` don't touch a hull. They put damage cards on
  top of the deck, one per point, marked against the side they hit. A
  damage card costs its side 1 hull when it's kept, and brace soaks it. You
  can send one to the bottom each hand, but fire lands on top, so they
  arrive together. Once two of yours share a hand, one gets through.

- **flee** — the card's own side breaks away. It only works when that side
  is *threatened*, meaning its hull is at half or less; otherwise the card does
  nothing. A ship that isn't in danger doesn't run. You get away the same
  way the merchant does.
- **hold** — cancels the other side's next flee. Chain shot carries it.

Damage only lowers a hull when it's kept, and threat is checked when the
card resolves, so order matters. If you play a
merchant's flee card before you hurt it, it does nothing. Play it after your
broadside and the merchant gets away.

| ending | payout |
| --- | --- |
| you flee | your plunder |
| the target flees | your plunder; the rest of its hold goes with it |
| the target is destroyed | plunder plus bounty; its hold sinks |
| you are sunk | nothing |
| the ships part | your plunder |

## the world

The year is 16XX: the seventeenth century as a setting, never a stated
year. Ports, flags and fleets are drawn from across the century, so
nothing pins the calendar.

The ultimate win is re-enacting Drake's raid round the world, so the sea
is the whole world.

**Coastline first, because the coast is where the action is.**
`src/world/data/world.json` is built by `npm run world` from Natural
Earth's 1:10m land (public domain):

1. Every coast and island gets a node offshore every 60 nautical miles,
   about a day's coasting.
2. The open ocean is filled in, sparser the farther it is from land, up to
   300 miles apart mid-ocean.
3. Everything is triangulated on the sphere. Any edge that crosses more
   than a spit of land, or runs far longer than its neighbours, is dropped.
4. Water cut off from the ocean (the Caspian, the Great Lakes) is dropped,
   and so is the ice beyond 62°S and 72°N.

That gives 6,954 nodes (3,213 on the coast).

Straits narrower than the coastal spacing would be missed, since coastal
nodes sit offshore. Ten are traced by hand in `src/world/passages.ts` and
threaded through as chains: Magellan above all, plus Gibraltar, Dover, the
Øresund, the Dardanelles and Bosporus, Messina, Bab-el-Mandeb, Hormuz,
Malacca and Sunda.

**A turn is a day.** Every leg longer than a day's sail is split into days
(`src/world/map.ts`), so one step is one turn everywhere. A coastal leg is a
day; a 300-mile ocean leg is five, and a ship on it is somewhere along it.
Ocean crossings take as long as they did, and most turns are spent near
land. That makes 24,331 steps in all.

**111 ports** (`src/world/ports.ts`), from across the century and twenty
flags: Spain and Portugal's empires, the English, French, Dutch, Danes and
Swedes, the Hanse, Venice and Malta, the Ottomans and the Barbary states,
Oman, Persia, the Mughals, China, Japan, and independent harbours like
Aceh, Bantam and Calicut. Forts put the water a step out under their guns.

**The grain of the sea** (`src/world/ocean.ts`):

- **Currents** are streams with a course, a strength and a width: the
  Atlantic and Pacific gyres, the Gulf Stream, Kuroshio and Agulhas, the
  Humboldt, the equatorial currents and countercurrent, the West Wind Drift
  round the south.
- **Wind** is a model of the global circulation. The trades blow toward the
  west and the equator, hardest about 14°, slack in the doldrums. The
  westerlies blow toward the east and the pole, hardest about 48°, and 40%
  harder in the south (the Roaring Forties). The belts follow the sun four
  degrees north and south through the year. The monsoon overrides them over
  the Arabian Sea, the Bay of Bengal and the South China Sea: south-west in
  summer, north-east in winter.
- **Rivers** push water out to sea: the Amazon, Congo, Ganges, Yangtze and
  others.
- **Banks** keep deep keels off: the Bahamas, Campeche, the Grand Banks,
  the Dogger, the Great Barrier Reef.
- **Seasons** are 91 days.

**Ships** sail a step a turn and favour running with the sea:

| kind | habit |
| --- | --- |
| merchant | one out of every port, trading with ports within 30 days, three times likelier under its own flag; a day in each port |
| treasure fleet | the flota and galeones (Cádiz, the Canaries, in through the islands, silver at Veracruz or Cartagena and Portobelo, Havana); the South Sea fleet (Arica, Callao, Panama); half speed |
| treasure ship | the Manila galleon, the Portuguese carreira to Goa, the Dutch return fleet to Batavia |
| armada | the Armada de Barlovento round the Caribbean, the Mar Océano off Iberia; half speed |
| hunter | guard ships at ten stations (Havana, Cartagena, San Juan, Callao, Cádiz, Lisbon, Goa, Batavia, Manila, Algiers), chasing you while you're within 25 days of their station |

Square-riggers let the sea pick their heading: they go round rather than
beat. Hunters are weatherly and can work to windward.

**Rumors.** A rumor says a ship was at a node, on a turn, from a source of
some reliability. It is exactly right with that probability; otherwise it
is off by up to one step (good sources), two or three (bad ones). Rumors
come from prisoners (`interrogate`, on boarding party and strike colours,
lost if you sink) and, later, from ports.

Each rumor gives two things:

- **a marker**, which loses a fifth of its strength each day and is gone
  below a tenth. A 90% rumor lasts ten days.
- **a prediction**, a cloud of where the ship could be now. It starts at
  the report and sails forward the way that kind sails:
  - a merchant is bound for one of the ports it trades with, nobody knows
    which;
  - a treasure fleet keeps its known course;
  - a hunter is bound for you if you're in its range, else for its station.

  It weighs each leg by what you know of the sea. The **search area** is
  the fewest nodes holding 70% of the cloud.

`npm run rumors` measures it. For a 90% rumor, about a random ship, over 80
rumors:

| you know | 2 days old: best guess right | 8 days: best guess right | 8 days: search area | ship inside it |
| --- | --- | --- | --- | --- |
| nothing | 28% | 9% | 24 steps | 63% |
| currents | 33% | 10% | 22 | 69% |
| wind | 35% | 15% | 20 | 75% |
| both | 34% | 14% | 18 | 76% |

Knowing the sea still helps: a tighter search, and one you can trust. It
helps less than on the Caribbean-only map, though, where an eight-day
search shrank from 32 nodes to 18. Most ships are merchants working coasts,
where the currents are slack and any of a dozen ports is plausible. The sea
earns its keep on the long runs: treasure courses, ocean crossings,
monsoon passages.

`npm run chart -- out.svg land.geojson` draws the world. Add `--turns 2000`
for where ships actually went, `--flow current` or `--flow wind:2` for the
sea's grain, and `--box w,s,e,n --scale 30` to zoom. Drake's route is traced
through the graph on every chart.

## running it

Node 22.12+.

```bash
npm install
npm run dev                  # the browser version, http://localhost:5173
npm run build                # static build in dist/, relative paths
npm run check                # svelte-check and TypeScript

npm test                     # the rules (no install needed)
npm run play                 # one encounter in the terminal, random seed
npm run play -- --seed 42    # that encounter again
npm run sim                  # bots × 2000 seeds
npm run rumors               # how good a rumor is, by age and knowledge
npm run world -- ne.geojson  # rebuild the world graph from Natural Earth
npm run chart -- out.svg land.geojson [--turns 2000 --flow current --box w,s,e,n --scale 30]
```

In the browser, `?seed=42` replays an encounter too. Keys: 1 2 3 pick,
enter resolve, s break off.

## layout

```
src/
  rng.ts         seeded RNG; its whole state is one integer kept in the game state
  cards.ts       the effect vocabulary and the placeholder decks
  rules.ts       createEncounter, act, legalActions — pure, no I/O
  setup.ts       the one encounter so far: you and a merchant
  describe.ts    words for events, shared by terminal and browser
  rules.test.ts
  ui/            Svelte: App, CardView, Gauge
  world/
    data/        world.json: the world graph, from Natural Earth
    passages.ts  the narrow straits, traced by hand
    ports.ts     the ports of 16XX and their flags
    ocean.ts     currents, rivers, banks, the wind model, the great courses
    drake.ts     Drake's raid round the world, as the places he touched
    geo.ts       the sphere: distances, great circles, headings
    map.ts       the world graph split into days, with ports and features
    sea.ts       currents and wind per node, and how they weigh a leg
    ships.ts     the kinds of ship and how each moves
    rumors.ts    making a rumor, its fading marker, its prediction
    world.ts     createWorld, advance, hearRumor, learn — pure, like rules.ts
cli/
  play.ts        the interactive harness
  sim.ts         bots and their outcome tables
  render.ts      text rendering shared by both
```

`rules.ts` knows nothing about drawing. A renderer reads `EncounterState`
and its `events` log and sends `Action`s back. The `events` log is there so a
renderer can animate what happened, not just show the new state.

## what the simulator says so far

Every bot does the same thing each round: it tries all six ordered keeps one
step ahead and takes the best result. The bots differ only in how much they
value hull, and whether getting away counts as winning. They count damage
waiting in the deck at most of a point each. Ship hull 6, merchant hull 12,
over 5,000 seeds:

| bot | payout | rounds | you flee | target flees | destroyed | sunk |
| --- | --- | --- | --- | --- | --- | --- |
| balanced | 10.3 | 21 | 3% | 12% | 61% | 25% |
| careful | 10.7 | 21 | 4% | 10% | 66% | 20% |
| never flees | 10.1 | 21 | 1% | 13% | 61% | 26% |
| random keeps | 3.6 | 14 | 41% | 12% | 3% | 45% |

How we got here, because the cliffs are the useful part:

- **Damage cards spread through the deck at random** made you nearly
  untouchable: 92% destroyed, 4% sunk. Spread out, two of your damage cards
  almost never shared a hand, and you could always dodge one. Making the
  merchant hit harder barely changed that.
- **Damage cards on top of the deck** fixed it. Fire lands in the next
  hand, so a hurt of 2 forces at least one hit.
- **Merchant hull 12 and broadside 4.** Damage against the merchant is a
  good card for you, but it still takes one of your two keeps. Your deck
  holds a fixed amount of shot, so when the merchant's hull is close to
  that total, every keep spent on something else costs you. One point past
  it and the merchant can't be sunk.

Open questions:

- **Fleeing hardly matters now.** Damage you're owed lands late, so by the
  time you're threatened the merchant usually is too, and finishing it pays
  better. Before damage cards, fleeing cut sinking nearly in half; now it
  saves about one encounter in a hundred.
- **Encounters run about 21 rounds,** double what they were. Every hit adds
  cards to the deck.
- **A forced flee.** Even "never flees" gets away 1% of the time. When a
  threatened ship is dealt a flee card beside two worse cards, keeping it
  can be the least bad option. That reads as the crew running whatever you
  wanted, which may be fine.
- **The ships never part.** Somebody always flees, sinks or goes down before
  the deck runs out. The ending is a safety net for now.
- **Destroying still pays best.** The bounty is usually worth more than the
  cargo that sinks with the ship.
