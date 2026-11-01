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

The game ends with Drake's circumnavigation, 1577–1580, so the sea is the
whole world: `src/world/data/world.json`, built by `npm run world` from
Natural Earth's 1:10m land.

**Coastline first, because the coast is where the action is.** Every coast
and island gets a node offshore every 60 nautical miles, about a day's
coasting. Then the open ocean is filled in, sparser the farther it is from
land, up to 300 miles apart mid-ocean. Then everything is triangulated on
the sphere, and any edge that crosses more than a spit of land, or runs far
longer than its neighbours, is dropped. Water cut off from the ocean (the
Caspian, the Great Lakes) is dropped too. The ice beyond 62°S and 72°N is
left out.

The result is 6,954 nodes (3,213 on the coast) and 17,236 edges.

Straits narrower than the coastal spacing would be missed, since coastal
nodes sit offshore. Ten are traced by hand in `src/world/passages.ts` and
threaded through as chains: Magellan above all, plus Gibraltar, Dover, the
Øresund, the Dardanelles and Bosporus, Messina, Bab-el-Mandeb, Hormuz,
Malacca and Sunda.

`src/world/drake.ts` is Drake's voyage as the places he touched. The tests
check that the graph can sail it, Plymouth to Plymouth by Magellan, the
Moluccas and the Cape, and `npm run world-chart -- out.svg land.geojson`
draws it (259 legs).

What follows is still the Caribbean-only sea that the rest of the game
runs on. It moves onto the world graph next.

## the sea and its rumors

Between fights is the Caribbean and the Gulf of Mexico around 1680.

**The open sea is a triangular grid.** Every node has six neighbours, about
sixty nautical miles apart: 687 nodes of water. Land is masked from Natural
Earth's coastline (public domain, built into `src/world/data/land.json` by
`npm run coast`). The Pacific is cut out: at this scale the isthmus is
thinner than the grid.

**The coast is history**, all in `src/world/caribbean.ts`:

- **22 ports**, Spanish, English, French and Dutch, each on the node
  nearest where it really was. Forts put the water a leg out under their
  guns.
- **Straits**: Florida, Yucatán, the Windward, Mona and Anegada passages,
  the Old Bahama Channel, the Dragon's Mouth.
- **Rivers** push water out to sea: the Mississippi, Magdalena, Chagres,
  Orinoco, Grijalva.
- **Banks**: the Bahama, Campeche and Mosquito banks. Deep keels
  (treasure ships, fleets, the armada) keep off them; merchants and hunters
  don't have to.

**Currents** are streams with a course, a strength and a width. The
Caribbean Current runs west through the sea, north through the Yucatán
Channel, round the Loop, and out the Florida Straits as the Gulf Stream.
The Antilles Current runs outside the islands, and an eddy runs back east
along Panama. **Wind** is the north-east trades, swinging through four
seasons of ten turns, with northers over the Gulf in the dry season.

**Ships** sail one leg a turn and favour running with both:

| kind | habit |
| --- | --- |
| merchant | port to port, three times likelier to trade under its own flag; a turn in each port |
| treasure fleet | the galeones (in to Cartagena, Portobelo, back, Havana) and the flota (in by San Juan to Veracruz, Havana), then out the Florida Straits for Spain, gone 20 turns, back in through the islands; half speed |
| treasure ship | a register ship on the same pattern |
| armada | the Armada de Barlovento, round the Spanish ports; half speed |
| hunter | guarda costas out of Spanish forts, closing on you |

Square-riggers let the sea pick their heading: they go round rather than
beat. Hunters are small, weatherly sloops and can work to windward. With
the same pull as everyone else, they took 30 turns to cover a quarter of
the way to you. Now they cover two thirds.

`npm run chart -- out.svg` draws it all: coastline, currents (or one
season's wind), and where ships actually went over a long run. Lanes
show: the flota coming in by the islands and leaving up the Gulf Stream,
the galeones in the south-west.

**Rumors.** A rumor says a ship was at a node, on a turn, from a source of
some reliability. It is exactly right with that probability; otherwise it
is off by up to one node (good sources), two or three (bad ones). Rumors
come from prisoners (`interrogate`, on boarding party and strike colours,
lost if you sink) and, later, from ports. A fleet across the Atlantic can't
be rumored.

Each rumor gives two things:

- **a marker**, which loses a fifth of its strength each turn and is gone
  below a tenth. A 90% rumor lasts ten turns.
- **a prediction**, a cloud of where the ship could be now. It starts at
  the report and sails forward the way that kind sails:
  - a merchant is bound for some port, nobody knows which;
  - a treasure fleet keeps its known route, and while it's probably across
    the Atlantic, the cloud adds up to less than one;
  - a hunter is bound for you.

  It weighs each leg by what you know of the sea. The **search area** is
  the fewest nodes holding 70% of the cloud.

`npm run rumors` measures it. For a 90% rumor, over 200 rumors:

| you know | age 2: best guess right | age 8: best guess right | age 8: search area | ship inside it |
| --- | --- | --- | --- | --- |
| nothing | 18% | 3% | 32 nodes | 38% |
| currents | 33% | 9% | 25 | 71% |
| wind | 32% | 11% | 23 | 73% |
| both | 37% | 15% | 18 | 79% |

Knowing nothing, a week-old rumor is close to worthless. The area is a
fifth of the sea, and the ship has usually left it, because blind guesses
spread evenly while real ships run with the sea. Knowing currents and
wind, the area is about half the size and right four times in five.

Two things it took. The first prediction treated every ship as drifting,
when ships head somewhere, so the cloud fell behind the ship it was
tracking. Ships also have to go round to run with the sea; while they only
chose among legs that closed the distance, knowing the sea barely helped.
Treasure routes were common knowledge, so a fleet's prediction only weighs
its route's ports.

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
npm run chart -- out.svg     # the sea, its currents, and where ships went
npm run coast -- ne.geojson  # rebuild the land mask from Natural Earth
npm run world -- ne.geojson  # rebuild the world graph from Natural Earth
npm run world-chart -- out.svg land.geojson [--box w,s,e,n --scale 30]
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
    grid.ts      the triangular grid over longitude and latitude
    caribbean.ts ports, straits, rivers, banks, currents, winds, routes
    data/        the land mask and coastline, from Natural Earth
    map.ts       the sea graph: water nodes and what the coast makes of them
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
