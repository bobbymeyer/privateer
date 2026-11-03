# privateer

A card-based privateering roguelike, round the world in 16XX. It's an alpha:
play it at [bobbymeyer.com/privateer](https://bobbymeyer.com/privateer/).

Underneath it is a rules module that knows nothing about drawing, a browser
front end in Svelte, a terminal harness, and simulators that play whole runs
to tune the numbers. Every push to `main` is tested and published to GitHub
Pages, and the site serves it from there.

## playing

Play it on the site, or `npm run dev` and open the page. You're a privateer out of Plymouth in a
pinnace with 20 gold. **Bring 150 home to London and the run is won.** Sink,
and it's over.

- **Sail** by clicking the sea to set a course, then *set sail*. The ship
  goes a day at a time and stops when it arrives, when a ship comes
  alongside, when you sight uncharted land, or for news worth heaving to
  for: a storm, a mutiny, a war declared, the crew close to mutiny (a log
  line with `stop` set; see `sailToward`). Drag to pan, wheel or the
  buttons to zoom.
- **In port**, the bar sells rounds (rumors) and hires crew; the yard
  mends the hull (1 gold a point), fits upgrades and sells bigger ships. A
  port of a nation that wants you won't deal with you until you bribe its
  officials.
- **Rumors** show as red rings that fade. Pick one in the list to see the
  cloud of where its ship could be by now. The cloud is tighter where
  you've seen the current and wind (blue and dashed grey arrows a step out).
- **Meeting a ship** at sea: a guard ship or armada of a nation that wants
  you, or that's at war with England, attacks on sight. Anyone else comes
  alongside and you choose: attack, or let her pass. Spain and the Barbary
  corsairs are fair game; anyone else's ships, the Crown hears of; an
  English ship makes you a pirate.
- **Raiding a port**: in port, you can raid it instead of trading.
- **Build the deck.** Take a ship and her stores are offered: three cards
  off her, keep one or none. A yard will strike a card out for 6, down to
  10. Your deck is listed under your ship. Hands of note draw wages.
- **Sea lanes** (`buildLanes` in `src/world/map.ts`). The open ocean wasn't
serving the game: on 24,000 day-steps of water the ships spread thin, and
sailing was waiting, prizes were hard to find, and nothing said where to
go. Now everyone sails the lanes, you too: the shortest paths between each
port and its three nearest, along a tree spanning every port so none is
cut off, along the great crossings (`OCEAN_LANES` in `src/world/ocean.ts`:
Plymouth to Barbados and Virginia, Lisbon to Bahia, the Cape to Goa,
Acapulco to Hawaii and on), and along the great courses, traced through
water deep enough for the ships that sail them. That's about 2,700 nodes
of 24,000; the map's adjacency is the lanes and nothing else, so courses,
ships, distances and rumor clouds all keep to them without knowing it.
The water off them is drawn and never sailed. The chart marks them as a
dotted track, and a click on the chart lands on the nearest lane.

Over 30 runs the captain bot has half again as many fights (29.5 a run,
against 19.8 on the open ocean), wins 7 against 2, and is sunk 14 times
against 19. A cost: on the lanes a ship can be in fewer places, so
knowing the currents and winds tightens a rumor's cloud less than it did.
Some legs of the underlying graph cut a headland, Brittany's for one; the
lanes show it now that they're drawn.

**The sea moves** (`src/ui/SeaShader.svelte`). A WebGL shader draws the
open sea under the SVG chart, in the chart's own coordinates, so it pans
and zooms with it: the engraver's wave marks, each a short double curve
whose curl rolls slowly, with long swells crossing them that thicken the
ink on their faces and thin it between. Two colours, the sea's and the
sepia's. The coast's water-lining is drawn over it as before, so the
coastal water stays engraved and still and the open sea lives beyond it.
Without WebGL the SVG's still marks are drawn instead.

**The ship sails**: she glides from day to day instead of jumping, faces
the way she's going, and leaves a short wake astern; the chart eases after
her. **Stops say themselves on the chart**, as a banner where you're
looking, not a line in the sidebar. **Keys**: space sets sail or heaves
to, f finds the ship, + and − zoom, escape closes.

**Sound** (`src/ui/sound.ts`), off until asked for in the header, and
remembered: all made in the browser with WebAudio, no files. The sea under
the hull, swelling and falling; the ship's bell when she heaves to (two
strokes on arriving, three for something seen); the guns in a fight, in
the order the shot was fired, yours heavier than hers; coin for a prize; a
storm getting up; one long low stroke when a run ends at the bottom.

None of the motion plays with reduced motion asked for.

**Under the chart, three tabs.** *Location* is whatever is where you
are: a port's bar, yard, ships for sale and raid, or at sea the water
you're in — whose waters, a strait, a bank, a river mouth, a fort's guns,
an island anchorage. Arriving in a port turns to it. *Politics* is who's
at war, the strain on a peace, your standing with each nation, your name,
and the flags. *Ship & crew* is the ship sheet. The sidebar keeps what you
glance at while sailing: the ship's gauges, the course, your letter, what's
in sight, rumors and news.

**Ship and crew** have a sheet of their own (`src/ui/ShipSheet.svelte`),
in its tab under the chart: the ship drawn to her size, her hull and morale,
each hand of note with what they bring and what they cost, the refits,
and the deck laid out as cards, grouped by where each came from — the
ship, each refit, each hand, the prizes — with struck cards shown struck,
and a strike button on each in a port with a yard. In port, every hire,
refit and ship for sale says what it would add before you buy it. The
sidebar's sections fold.
- **Read a ship before you engage.** The lookout sees ships two days past
  the water you can read, and a hostile sail coming into view stops you.
  Alongside, or in the *in sight* list, you see her hull against yours and
  how she fights: heavily gunned, fast, hard to shake off, a rich hold.
- **Your name gets about.** The more your prizes pay, the farther the
  hunters and privateers come for you, and the better found. Make the score
  and word gets out: every enemy privateer puts to sea to stop you getting
  it home.
- **Barbary corsairs** raid the open towns of their enemies for captives.
  Take one laden and the captives go free.
- **Keep the crew in heart.** Morale runs out of ten. A long stretch with
  no prize sours them, and at nothing it's mutiny. A prize, a round in the
  bar, fresh water at an island and a good omen all put it up.
- **Some events ask you.** A storm, the crew wanting their shares, a man on
  the beach of new land: each stops the ship and offers a choice, with what
  each choice stakes told plainly.
- **Islanders** in Guam, Hawaii, Tahiti, Tonga, the Marquesas and Rapa Nui
  trade water, fruit and timber, not drink or ships. Sometimes they put out
  war canoes instead.

Each run has a seed in the URL; `?seed=42` plays the same world again.

**When a run ends**, the screen tells the last fight: who she was, your
hull going in, hers at the end, how many rounds, the wounds still against
you, and the last three rounds card by card, down to the one that sank
you (`src/world/record.ts`). Then the run in numbers — fights, prizes,
sacks, ships that got away and times you did, letters done, the ship you
ended in, your best prize — and your best run beside it.

**The logbook** (`src/logbook.ts`) keeps every run that ends, and every
one given up, in the browser: the date, the seed, the gold, letters done,
days, the ship, how it ended and what sank you. Your best is the richest
win; with no win yet, the furthest the letters went. It downloads as JSON,
which is the way to send real runs back for balancing.

**Today's voyage** is a seed fixed for the date, so everyone who sails it
that day sails the same world; the header marks it, and so does the
logbook.

**The run saves as you go** (`src/save.ts`), to the browser's storage, after
every day and every card. A reload picks it up where it was, mid-fight
included, unless the address asks for a different seed. A finished run is
forgotten. A save carries a version: when the shape of the state changes,
`SAVE_VERSION` goes up and older saves are dropped rather than loaded
half-understood.

**How to play** opens on a first visit and from the header after. In a
fight, hovering a card explains its words, and *what the cards say* under
the hand lists them all (`GLOSSARY` in `src/describe.ts`).

**Every nation has its colours**, a field and a border, like a flag at a
distance (`src/world/colors.ts`). England is white edged red, the Dutch
orange edged blue, France blue edged gold, Spain yellow edged red, Portugal
green edged red, the Danes red edged gold, Japan red edged white,
independent harbours black. They mark ports (squares fortified, circles
open), ships in sight (triangles, warships larger), rumor rings, each
nation's protected waters (a faint wash), the standing list and the fight
sheet, with a key under the chart.

**The chart is a woodcut** (`src/ui/woodcut.ts`, `src/ui/SeaChart.svelte`),
sepia on parchment, after the engraved charts of the century, and all of it
drawn in code:
- **Water-lining:** every coast drawn again and again out to sea.
- **Hatching** across the land, the same density at any zoom.
- **Wave marks** scattered on the open sea.
- **Rhumb lines** fanning from a rose in each ocean.
- **The seas lettered** as the charts of the time named them: Mar del
  Nort, Mar del Sur, Oceanus Indicus, Mare Germanicum.
- **Ports as woodcuts**, a tower for a fortified port and two houses for an
  open town, and **ships** as hull and sails in their flag's colours.
- **A wind rose and a graduated border**, fixed to the frame.

The coast is drawn nine times over for the water lines, so it's drawn
only where it can be seen and only as fine as a pixel. Each nation's
protected waters are built once, as one path. A pan costs the same as it
did before the engraving.

## the loop

A fight is two ships, two decks, and the range between them (`src/rules.ts`).

- **The range**: grappled, close or far. Most cards care. Long guns reach
  at far, a broadside is heavy close, boarders only go across grappled.
  Chase and grapnels close the range; bearing away opens it. Opened past
  far, whoever opened it is away. So cards set each other up: give chase,
  then grapple, then sweep the hold. A card out of range does nothing, and
  the fight says so; your hand marks those cards *out of range now*.
- **Her intent is face up**: the top card of her deck, shown before you
  choose. You play first, then she plays it, then her next card turns up.
  She's about to bear away from far? Chase first, and she falls short.
- **Your hand**: three dealt from your deck. Keep two; they resolve in the
  order you name them and are spent. The third goes under your deck. Spent
  cards come back only by `recall`, so a deck of fifteen runs out in about
  seven rounds, and fights last five or six.
- **Where it starts**: close when you fire first, within hail; far when
  she comes at you, bearing down, which gives you a chance to bear away
  before she closes. A town can't move: close is the boats offshore,
  grappled is the party ashore, and it never gets away.
- **Wounds**: some shot leaves a leak (2 hull), a fire (3) or shot-away
  sails (no hull, but that ship can't bear away till they're dealt with),
  as a card on top of the wounded ship's deck. Yours comes into your hand:
  keep it to deal with it, or send it under. Hers becomes her next card, a
  round she spends on it — chain shot is how you stop a ship that runs.
- **Each kind fights its own way**, from its deck: a merchant runs, a
  guard ship closes and grapples and is deadly alongside, a galleon's
  great guns ruin you close, an armada's long guns reach you far off, a
  town mends its barricades and calls its relief. The read of a ship before
  you engage says which.

Card text is written from the effects (`cardText` in `src/cards.ts`), so a
card can't say other than it does: *far: hit 1 · close or grappled: hit 3 ·
close: leak*.

What the simulator says, a pinnace with the balanced bot:

| against | rounds | taken | she got away | sunk |
| --- | --- | --- | --- | --- |
| a merchant | 5.7 | 75% | 14% | 0% |
| a guard ship, coming at you | 6.9 | 21% | — | 1% |
| …running, the bot that bears away when it can | 3.2 | 9% | — | 0.4% (73% away) |

Before the rework a fight ran eleven rounds, and how you played hardly
mattered: four sensible bots came within a hair of each other. Now running
and fighting are different games. Over a whole run the captain bot does
worse than before (4 wins and 19 sunk of 30, against 7 and 14), partly
because it plays a round at a time and never sets up a combination or
reads her intent the way a person will; your logbook will say more.

| ending | payout |
| --- | --- |
| you get away | your plunder |
| she gets away | your plunder; the rest of her hold goes with her |
| she is destroyed | plunder plus bounty; her hold sinks |
| you are sunk | nothing |
| the ships part (your deck runs out) | your plunder |

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
| hunter | guard ships at ten stations out where control is weak (Havana, Cartagena, San Juan, Callao, Goa, Batavia, Manila, Algiers, and England's pirate hunters at Port Royal and Bridgetown); they keep station until their nation wants you, then chase you within 25 days of it |

Square-riggers let the sea pick their heading: they go round rather than
beat. Hunters are weatherly and can work to windward.

**Rumors are bought by the round** (`src/world/bar.ts`). In port, stand
the house a drink (2 gold) and somebody may tell you about a ship: where it
was when they saw it, a few days back.

- **What's talked about:** ships whose wake came within 30 days of the
  port. Treasure fleets are talked about five times as much as a merchant,
  and nearer ships more than farther.
- **How stale:** a sighting is up to twelve days old, mostly recent; about
  five on average.
- **How true:** news from far off is garbled, and each round finds the room
  drunker. The first round of the night hears something nearly nine times
  in ten, at about 0.75 reliable; the fifth, under four in ten, at about
  0.5. The room turns over overnight.

A rumor says a ship was at a node, on a turn, with some reliability. It is
exactly right with that probability; otherwise it is off by up to one step
(good sources), two or three (bad ones). Prisoners talk too
(`interrogate`, on boarding party and strike colours, lost if you sink).

**Flags, standing and protected waters.** Every ship flies its home port's
flag; a route ship flies its first port's. Every nation keeps a **standing**
with you. Attack one of its ships and the standing falls: one for landing
damage or taking plunder, two for a sinking. Below zero, its guard ships
hunt you. Until then they keep station.

**Countries protect their waters.** The sea within 4 days of a nation's
forts is its protected water; where two overlap, the nearer fort decides.
A guard ship never enters another nation's waters, so a chase breaks off
at the edge and a friendly fort is a refuge. Any foreign guard ship found
inside is driven off by that nation's navy (Spanish ships off Plymouth
bring out the Royal Navy) and laid up at home; it goes in the world's log.
That's why the guard stations are out in the colonies: Europe's home
waters are its navies' business. The armadas are exempt, keeping their
patrols round their own empire's ports.

**What you sail with is what you fight with** (`src/outfit.ts`). Your deck
is never stored. It's worked out from your ship, its upgrades and your crew:

| ship | cost | hull | berths | adds |
| --- | --- | --- | --- | --- |
| pinnace | (you start in one) | 10 | 2 | the nine starting cards, 13 in all |
| sloop | 40 | 12 | 3 | raking fire |
| brigantine | 90 | 14 | 4 | broadside, raking fire |
| frigate | 180 | 18 | 6 | two broadsides, chain shot |

- **Crew**, hired in the bar, one of each, as many as you have berths: a
  master gunner (double-shotted guns), marksmen (hit and hold), a
  quartermaster (a prize crew that plunders and questions), a boatswain
  (all hands: brace 3), a surgeon, a pilot (another bear away), a
  navigator (a step more sight).
- **Upgrades**, at the yard, belong to the ship: more guns, a sheathed hull
  (+2), boarding nets, chase guns. A new ship starts bare.

A bigger ship is sturdier but less nimble. More cards in the deck means
the flee cards come round more slowly: from an armada, a pinnace gets away
82% of the time, a brigantine 58%. Hire a pilot.

**Grudges fade and can be bought off.** Standing drifts a point back
toward zero every 60 days. In any port of a nation that wants you, its
officials can be bribed a point at a time: 10 gold, times how far below
zero you are.

**Uncharted islands.** Every run hides eight out in open ocean, in nobody's
waters, far from ports and from each other. Sight one and the Crown pays
15 for charting it. After that it's an anchorage: no ship troubles you
there, and the hull mends a point a day.

**Setting a course** (`src/world/course.ts`): each day's step is the one
that brings you nearest, and where steps tie, the one that runs best with
the current and wind you've charted.

**Who's at war with whom** (`src/world/wars.ts`) is part of the world, and
it moves:

- **How a run opens:** England is at war with the Barbary corsairs and
  Morocco, and with one of Spain, France or the Dutch Republic, chosen by
  the run. The other powers' wars open as the century had them: Spain
  against the Dutch and the French, the Dutch against Portugal, the
  Ottomans against Venice and Malta, the corsairs against nearly everyone.
- **It drifts.** Every season each pair of powers may make peace (12%) or
  fall out (3%). The corsairs make peace hard and break it easily. The news
  reports it.
- **You can start a war.** Attacking a nation at peace with England puts a
  strain on the peace: 1 for firing on a ship, 1 more for taking her, 3 for
  a raid, 2 more for a sack. At 6, England and that nation are at war. The
  strain fades as grudges do.

For you, sailing for England, it decides what's fair game:

| her flag | firing on her | taking her, or sacking the town |
| --- | --- | --- |
| at war with England (Spain, Barbary) | her nation −1 | her nation −1 more; England +1 (+2 for a town) |
| at peace with England | her nation −1, England −1 | her nation −1 more, England −1 more |
| English | piracy | piracy |

A raid costs three times a ship: −3 to the town's nation when you go in,
−2 more if you sack it.

**Meeting a ship** (`src/world/meet.ts`), when you share a node with one
outside a port. The world waits until you've dealt with it. If several are
there, one that means you harm comes first, then the one that matters most
by the bar's notability.

- **She attacks you** if she's hostile: a guard ship, an armada or a
  privateer of a nation that wants you, or of one at war with England. The
  fight is on. Guard ships only go out of their way to hunt you once their
  nation wants you.
- **Enemy privateers** fit out of Dunkirk, Saint-Malo, Tortuga, Amsterdam,
  Willemstad, Salé, Algiers, Havana and Cartagena. Whenever their nation is
  at war with England they come for you, within 20 days of home. Unlike
  guard ships they go where they like, other nations' waters included:
  raiding foreign coasts is the trade.
- **Anyone else comes alongside, and attacking is your choice.** Let her
  pass and she goes her way, and won't come alongside again for 5 days.
  Fire on her and her nation remembers it, a point off your standing,
  however the fight goes, since you fired first; sinking her costs a point
  more.

**Events at sea** (`src/world/events.ts`), once a day while nobody is
fighting:

- **Morale** starts at 7 of 10. From 30 days after the last prize, the crew
  lose a point every 10 days. At nothing it's **mutiny**: a hand of note is
  hanged as a ringleader or deserts at the next landfall, taking his cards
  out of your deck with him. With nobody of note aboard, the strongroom is
  broken open and 30% of the gold goes. Afterwards morale is 4 and the
  clock starts again.
- **What puts it up**: a prize with a payout, +3 (+4 for a sacked town); the
  first round bought in a port, +1; trading with islanders, +3; each day at
  anchor off a charted island, +1; a good omen, +2.
- **Good omens**, about one day in 45 at sea: birds over the bow, a spring on
  an island, Saint Elmo's fire, porpoises under the bow.
- **Storms**, about one day in 120 at sea. Three times as often in the
  Antilles in autumn and in the Indian seas in the summer monsoon, and
  twice as often past forty degrees. How to meet it is your choice (see
  *Events that ask you something*, below). (At first a storm simply took 1
  to 3 hull or some of the gold, it was one day in 80 and up to two fifths of the
  purse, and the captain bot's wins fell from 43% to 27%; as now, 33% over
  30 runs, about 5 storms and 10 omens a run, and no mutinies: the bot
  takes a prize often enough to keep its crew.)
- **Islanders**: Umatac on Guam (Spanish, the galleon's watering stop on
  the way to Manila), and native harbours at Kealakekua, Matavai, Nuku'alofa,
  Nuku Hiva and Rapa Nui. Native ports have no bar, yard or hands to hire,
  but trade provisions, 3 gold for +3 morale and +2 hull, once a day. Coming
  in, 30% of the time the canoes come out to fight instead (70% if you've
  raided them). Beating them off costs you no standing; raiding their town
  does.
- **Sea monsters**: one in each named sea on the chart. A monster drifts
  where the current takes it, turns for home once it's more than 12 days
  out, and attacks whoever it meets. It's nobody's, so fighting it costs no
  standing, and its bounty pays (ambergris, and a story for the bar).

**Letters of marque: a run in three acts** (`src/world/letters.ts`).
*Work in progress on this branch.* A run is three letters, each a nation,
a region (dashed on the chart), a task, a deadline and a reward: two
prizes near home (the Narrow Seas, the Barbary coast), then a town to sack
farther out (the Spanish Main, Brazil, the Indies), then a named Spanish
plate ship. A letter makes its nation fair game while it lasts. Finishing
one pays it and brings the next, with the Admiralty's word of where to
look; the plate ship gets fresh word every 30 days. A missed deadline gets
more time once, at −2 with England; a second, and the letter is revoked
and you're a pirate (a pardon brings a new one). All three and home to
London wins; gold is the score. Runs from before letters win the old way.

The Admiralty's latest word of the plate ship stays on the chart till
fresher word replaces it, so her cloud is there all act long, widening as
the word ages.

Where it stands: the captain bot, which now intercepts (it heads for where
she's likeliest to be in k days that it can reach in k days), wins 2 of 30
runs, on day 368 on average; 12 of 30 reach the third letter. It is sunk
in 19 of 30: the letters take a small ship into enemy waters.

**Events that ask you something** (`src/world/dilemmas.ts`). A storm used
to take its toll and log it; the crew soured in silence. Now the
events that matter stop the world and ask, and every choice says what it
stakes before you pick it:

| event | when | choices |
| --- | --- | --- |
| a storm | the storm chance, at sea | **ride it out**: lose 1 to 3 hull, never the last · **run before it**: no damage, but 2 to 4 days downwind, off your course, sailed day by day (anything can happen in them) · **lighten ship**: a tenth to a quarter of the gold over the side, 30 at most |
| the crew want their shares | morale sours to 3 | **pay them**: a tenth of the purse, 5 at least, morale +3 · **promise them the next prize**: morale +1, and a quarter of the next payout is theirs · **stand firm**: even odds of morale +1 or −1 |
| a man on the beach | half the time you sight new land | **take him aboard**: a hand of note you haven't got, free, if there's a berth — but one in four is a liar and a Jonah, and it's morale −2 · **leave him** |

A choice that can't be made — nothing aboard to lighten, no berth, not
enough to pay — is shown barred, with why. The bot rides out a storm on a
sound hull, pays shares it can spare, and takes any castaway; with that it
wins 27% over 30 runs, against 20% when storms rolled their own cost.

**Building the deck** (`src/outfit.ts`, `src/world/port.ts`). The deck
was all bought: a bigger ship, a gunner, and every run converged on the
same cards. Now most of it is chosen.

- **Prize cards.** Take a ship, sack a town, or kill a monster, and three
  cards from that kind's pool in `PRIZE_CARDS` are offered: keep one, for
  good, or leave them. The world waits on the choice. They run along three
  ways to fight — the guns (hit and wounds: *her long guns*, *a Spanish
  great gun*), the boarders (plunder and hold: *her grapnels*, *boarding
  pikes*), the runner (flee and chase: *her pilot*, *galley sweeps*) — and
  the strong ones cost you: the great gun recoils, the pikes cost blood.
  Prize cards come with you to a new ship.
- **Striking cards.** A yard that deals with you strikes a copy of any card
  for 6, down to a deck of 10. The deck is listed under your ship, with the
  strike buttons when you're in such a port.
- **Wages.** Every 60 days each hand of note is paid, 1 or 2 gold, from the
  purse, which is also your score. Short of it, morale falls 2, and the ship
  stops to tell you.

**Seeing her first** (`src/world/scout.ts`).

- **A longer lookout.** Ships are seen two steps past the water you can
  read, and a hostile sail newly in sight stops the ship, with how far off
  she is and whether she's bearing down — time to run, or turn.
- **A read of her**, off her deck: her hull with any renown bonus, against
  yours; how heavily she's gunned (her hurt, and what her wounds would
  cost, per card); whether she'll run, is hard to shake off, mends quickly,
  or has help coming; and how rich her hold is, laden corsairs included. It
  shows on the sheet when she comes alongside, and for every ship in the
  *in sight* list.
- What the bot makes of it: 20% won over 30 runs, against 23% before. It
  takes the first card offered, and it dies later than it did (on day 214
  on average, against 74). Letting it sheer off at the longer lookout made
  it worse (13%): it turned away from too much, and ran out of time.

**The late game** (`src/world/world.ts`, `src/world/meet.ts`):

- **Renown**, from everything your prizes have paid. At 60, 120 and 200 it
  goes up a step, and each step hunters and privateers come a quarter
  farther for you (`reach` in `Pursuit`), and a hostile warship comes with
  2 more hull. Passing a step is news, and stops the ship.
- **The home stretch.** With the score in hand and no noose waiting, word
  gets out, and every privateer of a nation at war with England comes for
  you, whatever the range. The Channel ports — Dunkirk, Saint-Malo,
  Amsterdam — are between you and London.
- **Barbary corsairs**, one each out of Algiers, Salé, Tunis and Tripoli.
  Each picks an open town of an enemy of its nation within 45 days of home,
  the nearer the likelier: Baltimore is in reach, and Reykjavík when the
  Danes are at war with them. It strips the town for 60 days, logs it (and
  stops your ship if the town was English), and sails home with the
  captives, where it lies 20 days before going out again. A corsair is
  hostile to you while its nation is at war with England. Take one laden
  and it carries 12 more in its hold, and the captives go free: a point
  with their nation, and one with the Crown.
- **What it does to a run**: over 30 runs the captain bot wins 23%, down
  from 33%. Corsairs sank it twice; the bot has no notion of the home
  stretch and sails into it blind.
- **Saves migrate.** Each change to the save's shape adds a step to
  `MIGRATIONS` in `src/save.ts`, so a run in progress survives an update.

**The fight moves** a little, so a round can be read without reading it.
A new hand deals in from the deck, a card at a time; a wound card drops
onto it from above. Hull, morale and way are rows of pips: a pip lost
drains, a pip gained fills, and the difference floats up off the count.
The round's lines come in one by one. None of it plays when the reader has
asked for reduced motion.

**Raiding a port.** In port, raid it instead of trading. The fight is the
same game against the town's defences, from `src/setup.ts`:

- **A town can't run**: no flee cards. Its people carry valuables inland
  while you fight, so the longer the raid, the less there is to take.
- **An open town** has a battery, musketry, barricades. **A fortified
  port** has great guns and walls to mend, and is too much for a pinnace.
- **If the raid goes on, help comes**: from the seventh round, the
  garrison is reinforced, a card on top of the town's deck every other
  round, four in all. (At first it came every round without end, which
  flooded every hand with relief.)
- **A raiding party can fall back to the boats**: two extra flee cards in
  your deck for a raid. They work when you're threatened, as always.
- **Sacking it takes everything left in its treasury**, and the town has
  nothing for anybody (no trade, no raid) for 120 days.
- **The alarm**: the town's nation's guard ships hunt twice as far, 50 days
  out, for the next 30 days.
- **A raid turned out leaves the town on its guard.** Falling back to the
  boats with what you'd plundered, and coming straight back to a treasury
  full as new, was the strongest play in the game. Now a raid that ends
  short of a sack (you fled, or it petered out) puts the town on its guard
  for 90 days:
  - for the first 14 the boats would never get ashore: no raid;
  - after that its walls have 4 more hull and its relief comes 2 rounds
    sooner, for each raid it has turned out while on its guard;
  - its treasury starts from what the last raid left it and fills again 1
    a day, up to the usual.

  The port panel says all of this. A sack ends the guard. Over 60 seeds
  the captain bot, which raids enemy towns, wins 22% with the guard
  against about 28% without.

`npm run sim -- --target town --ship brigantine` measures a raid:

| raiding with | open town | fortified port |
| --- | --- | --- |
| pinnace | sacked 65%, sunk 8% | never sacked, sunk 3% |
| brigantine | sacked 91% | sacked 48%, sunk 15% |
| frigate | sacked nearly always | sacked 95% |

The relief was first a card that hurt *and* mended the walls, which made a
town nearly impossible to sack; mending only from the barricades, and
relief that only fires, is what gives the table its shape.

**You sail for England, and attacking an English ship is piracy.**
- England wants you, at least -3, and while you're a pirate that grudge
  doesn't fade.
- English ports won't deal with you, and no bribe changes that.
- London won't count as a win: they'd hang you.
- A royal pardon (80, in any English port) clears it all and sets England
  back to 0.
- Port Royal and Bridgetown keep English guard ships, pirate hunters, who
  come out only for a captain England wants.

Every kind of ship has a deck (`src/setup.ts`):

| target | hull | hold | deck |
| --- | --- | --- | --- |
| merchant | 12 | 12 | return fire, jettisons cargo, runs |
| guard ship | 12 | 3 | hits hard, grapples so you can't run, bounty 10 |
| galleon | 13 | 30 | heavy guns, runs, strikes for the silver |
| treasure fleet | 24 | 60 | escorts' broadsides, cuts off your retreat, a straggler to snatch |
| armada | 30 | 4 | broadsides of 4, holds the weather gauge. Run. |

A ship is **credibly threatened**, and its flee cards work, at half hull or
less, *or outgunned three to one*. That's what makes a fleet or an armada
survivable: against them your flee cards work from the first hand, unless
they hold you. A captain who runs whenever a flee card works gets away from
a treasure fleet 77% of the time (often with a straggler's plunder) and
from an armada 66%. One who stays sinks. `npm run sim -- --target armada`.

Afterwards it is settled:
- the payout goes in the purse;
- your hull is kept as it came out (mend it in port at 3 gold a point);
- each prisoner questioned (`interrogate`) gives a rumor about a ship seen
  in the last few days;
- a ship destroyed is laid up at home for 60 days;
- a ship parted from leaves you be for 5;
- if you're sunk, the run is over.

**You see the next node.** The water a step out from you, its current and
this season's wind, goes on your chart (`WorldState.chart`). Currents never
change, so a current once seen is charted for good. Winds change with the
season, but the seasons come round, so wind seen in summer is charted for
every summer. Predictions only use what's on your chart: in water you've
never sailed, every leg looks the same. `sight` is one step for now; the
crew will extend it.

Each rumor gives two things:

- **a marker**, which loses a fifth of its strength each day and is gone
  below a tenth. A 90% rumor lasts ten days.
- **a prediction**, a cloud of where the ship could be now. It starts at
  the report and sails forward the way that kind sails:
  - a merchant is bound for one of the ports it trades with, nobody knows
    which;
  - a treasure fleet keeps its known course;
  - a hunter is bound for you if you're in its range, else for its station.

  It weighs each leg by what's on your chart. The **search area** is the
  fewest nodes holding 70% of the cloud.

`npm run rumors` measures what a chart is worth, from a blank one to the
whole sea known. For a 90% rumor, about a random ship, over 80 rumors:

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

## balance

`npm run voyage` plays whole runs with a captain bot. In port it repairs,
buys rounds, hires crew and buys a bigger ship when it can spare the gold.
At sea it chases the best rumor, sheers off from armadas and from guard
ships that want it, fights by lookahead, runs when outgunned, and goes
home with the score. It attacks only enemies (Spanish and Barbary
merchants and galleons) on a sound hull, lets the rest pass, and raids
enemy towns, and fortified ports only from a brigantine up. Over 100 runs
it **wins 39%**, home around day 525, after about eleven raids a run. Most
of the rest sink: 30 raiding towns, 13 to armadas, which attack on sight
now that Spain is at war with you.

The economy and the danger are one dial. Cutting a town's treasury from
25 to 20 took wins from 39% to 9%, and *more* captains sank raiding, not
fewer: short of gold, they couldn't buy a sturdier ship, and kept raiding
in a pinnace.

Getting there took three changes:

- **A bigger starting hull (6 to 10).** At 6, a merchant fight sank you a
  quarter of the time: a fine gamble once, but over the 15–25 fights of a
  run nobody lived. At 10 it's 6%, and each fight costs hull you pay to
  mend instead.
- **Repairs at 1 gold a point, not 3.** At 3, mending a merchant fight's
  damage cost more than the merchant paid.
- **Outgunned at two to one, not three,** so a fleet or an armada is still
  something to run from once your hull is bigger.

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
npm run sim                  # card bots × 2000 fights (--target armada, --hull 14)
npm run voyage               # whole runs with a captain bot (--runs 40 --days 730)
npm run rumors               # how good a rumor is, by age and knowledge
npm run world -- ne.geojson  # rebuild the world graph from Natural Earth (1:10m)
npm run coast -- ne.geojson  # rebuild the coastline the browser draws (1:50m)
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
  describe.ts    words for events and the cards' glossary, shared by terminal and browser
  save.ts        saving a run to the browser, and loading it back
  logbook.ts     the logbook of finished runs, and today's voyage
  rules.test.ts
  outfit.ts      ships, crew, upgrades: what your deck is made of
  ui/            Svelte: App (the game), SeaChart, SeaShader, Fight, CardView, Gauge, ShipSheet; sound.ts
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
    bar.ts       buying rounds, and what the room tells you
    meet.ts      meeting a ship at sea, fighting it, settling up, repairs
    port.ts      hiring, the yard, bribes, and who will deal with you
    wars.ts      who's at war with whom, and so what's fair game
    events.ts    a day at sea: morale and mutiny, storms, omens
    dilemmas.ts  events that ask you something, and what each choice stakes
    scout.ts     the lookout, and a read of a ship before you meet her
    seas.ts      the named seas, where the chart letters them and the monsters keep
    course.ts    setting a course and sailing it a day at a time
    world.ts     createWorld, advance, observe, hearRumor — pure, like rules.ts
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

That was a single fight, tuned with a 6-hull ship. For whole runs the
pinnace now has 10 (see *balance* above), which makes a merchant 81%
destroyed and 6% sunk for the balanced bot: `npm run sim -- --hull 6` gives
the table above back.

How we got here, because the cliffs are the useful part. (This was the
first damage model, where all shot became damage cards. It's been replaced
by direct damage and wounds; see below.)

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

**Then shot went straight to the hull.** Damage cards for every point of
shot made fights long (21 rounds) and let you dodge most of what came at
you. Now shot lands at once, and only some of it leaves a wound card. Fights
are shorter and threat comes sooner, so running matters again: a captain
who runs when it can gets away from a merchant a third of the time.

Old open questions from the damage-card model, kept for the record:

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
