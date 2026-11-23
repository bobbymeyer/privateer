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
| brigantine | 10 | 17 | 47 of 70 | 17, a broadside and a raking fire more | ×1 |

**Choose whose money you sail on** (`BACKERS` in `src/world/reckoning.ts`).
Most voyages were paid for privately; the Crown put in ships and money when
it suited it, as Elizabeth did in Drake's.

| backer | fits you out with | at home |
| --- | --- | --- |
| the Crown | half the ship's purse, a spare and a barrel of powder | the Queen's third of what you bring home; she wants a clean commission (infamy counts double), and her favour shields you at court |
| gentlemen adventurers | four fifths of the ship's purse | half of what comes home over your own purse, nothing if you come home poorer; their friends aboard bring the San Julián grumbling to a head |
| your own stake | nothing more | nothing shared |

The gentlemen suit a pinnace best, the Crown a sloop or a brigantine (see
the balance below).

**A chronicler**, if you'll take one at fit-out: a gentleman-poet of the
kind the promoters hired (Gascoigne for Gilbert, Churchyard for Frobisher;
Parmenius drowned with Gilbert in 1583). He costs 10 gold and a berth and
does no seamanship. Bring him home alive and his account of the voyage adds
30 and half your fame to the score; if he dies, it dies with him; named a
pirate, it's forbidden printing.

**Fit out** at Plymouth's chandler: food at 4 for 300 rations, water at 1
for 300, five hands for 4, a bundle of spares or a barrel of powder for 3,
and a chest of truck (knives, beads and cloth, as the 1564 relief voyage to
Florida packed "to trade with" the people of the coast) for 3, up to five
chests; truck is English goods, and only Plymouth sells it.
Abroad, a chandler is half as dear again. You start with two months' food
and a month's water for the hands aboard.

**The peoples of the coasts** (`src/world/peoples.ts`): the Tupinambá of
Brazil, the Patagonians at San Julián, the Mapuche at Mocha, the Miwok at
Nova Albion, the Chamorro at the Ladrones, the islanders of the Solomons,
the Khoikhoi at Table Bay and the Temne at Sierra Leone. Each is friendly,
wary or hostile, and starts where history left the English: the Miwok
crowned Drake, the Mapuche shot at him. Deal fairly (trade, pay in truck, a
chest of it for 8 days of fresh food and the casks filled where there's no
market, flog the hands who wrong them) and they come round: friendly, they
bring fresh food down to the beach the first time, their guides make the
work ashore a day quicker and the foraging a quarter better, and they tell
you what they know (a rumor, if there's one to hear there). Deal harshly
(take what you need by force, 21 days of fresh food and the casks filled at
once; fire a gun over their canoes; let misconduct pass) and they turn:
hostile, no trade, and arrows from the trees at the work ashore four times
in ten (one in eight while they're wary). What a voyage leaves on each coast
is remembered by the next English ship, in the browser (`src/peoples.ts`):
hostile stays hostile, friendly friendlier, wary is forgotten.

**Huguenot privateers out of La Rochelle** hail you off Spain, Guinea and
Brazil: keep company six days (privateers and corsairs stand off from two
ships, and you wait a day in four for the slower one), trade news (a
rumor), or take a French commission. Under one, what you take from Spain
counts half toward its grievance, but the Queen likes a captain with two
masters less: three in twenty more risk at court, and a gift forgives one
question, not two. Under the Crown's commission it's refused.

**Continue on.** The screen is the chart of the whole voyage, what you've
got, and one button. On a phone the status folds to a line (hands, food,
water, hull; the rest a tap away) and continue on stays at the bottom of
the screen. The ship sails the lanes a day at a time to the next
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

Seven more come from *Colonization, Piracy, and Trade in Early Modern
Europe* (Palgrave, 2017), each from something that happened:

| event | where | the choices | after |
| --- | --- | --- | --- |
| the hands want Spanish gold | off Chile and Peru, 90 days without a prize | lead them (20 to 60, fresh food, the treasure ship warned), hold firm (they may slip away), maroon the ringleaders (3 to 6; caught, they talk) | Laudonnière's men at Fort Caroline, 1564 |
| fire in the bread room | anywhere, rarely | fight it (a bundle of spares, 15% of the food) or let it burn (35%); starving or driven hard, the hands remember Charlesfort | Charlesfort, 1563 |
| a storm on the eve of a raid | one raid in five | go in now (1 to 2 hull, 1 to 3 hands), stand off (3 days' stores, the town warned), or land the men without the ship's guns (even odds 2 to 4 cut off) | Ribault at San Agustín, 1565 |
| a feast ashore | Ternate, Bantam, the Isles of Solomon | go (favour: Plymouth's prices there, fresh food; one in ten, poison and a ransom), send a gentleman, or decline | Drake at Ternate, 1579 |
| hands in the lock-up | Ternate, Bantam | pay a quarter of the purse, leave them (2 to 4), or break them out (the market shut to you) | |
| papers searched | the Canaries, Cape Verde, Spanish patrols | hand over the charts (and your rumors), bribe (15), or refuse (their guns, or a fight) | |
| shining ore | Nova Albion, the Isles of Solomon, the Strait, a storm's island | load it (2 tons of hold) or leave it; the Tower calls it fool's gold | Frobisher, 1578 |

**Spice.** Cloves at Ternate, pepper at Bantam, by the ton, a ton for every
five of her complement; each sells for 20 on the quay at Plymouth. On a reef
it's the spice you throw over first, as Drake did.

**Brazil** (`src/world/brazil.ts`). From Cape Verde the way divides: the
coast of Brazil, or the bay of Guanabara, where Villegagnon's France
Antarctique stood from 1555 until the Portuguese took it in 1560. There,
brazilwood from the Tupinambá at 3 a ton, for the red dye, sold to the
dyers at home for 9; it shares the hold with spice. A Norman ship is in
the bay six times in ten: buy her brazilwood at 2, or trade news for word
of the carrack from Goa. On the coast of Brazil, seven times in ten, a
Portuguese settlement not yet sworn to Philip (Portugal's colonies swore in
1581–82): send a boat to treat, and 55 in 100 they deal, the casks filled and
two weeks of fresh food for 5; else they turn you away and send word south,
and the treasure ship is warned.

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

**Privateer or pirate.** Spain's and Portugal's ships and towns are fair
game, one crown since 1580. A French, Hanseatic or Dutch merchant isn't:
they sail off Iberia, Brazil and Guinea with 12 more in the hold than a
merchant's usual, and taking one is piracy, a point of `infamy` (two under
the Crown). What you take from Spain and Portugal is lawful, but it mounts
up as Spain's `grievance`. The status strip says both in a word.

**The reckoning** (`src/world/reckoning.ts`). Raising Plymouth sells the
spice and pays your backers, and then the voyage waits on one more choice.
Spain's ambassador, as Mendoza did over Drake, wants restitution: half the
grievance, no more than half the gold.

| choice | what comes of it |
| --- | --- |
| show yourself at court | fame: 30% of the gold, 20 to 150, to the score. A risk of being disowned to please Spain (the grievance over 1200, and 12 points a point of infamy; four tenths of it under the Crown): restitution paid, no fame |
| lie low | safe, no fame |
| a gift for the Queen | a fifth of the treasure, 2 infamy forgotten, and court is safe |

With 4 infamy or more and no Crown favour, court names you a pirate and the
Admiralty seizes three quarters of the prize; lying low, even odds of the
same. Drake's voyage needs not to be disowned or named.

**Jewels** (`src/world/jewels.ts`). A prize or a sacked town sometimes gives
up a jewel from her great cabin or its church: a fifth of merchants, three
in five treasure ships, two in five towns. Emeralds from New Granada off the
Spanish Main, diamonds and pearls from the East, rubies and turquoise
anywhere; and a fighting ship's captain, fallen, one time in four, his ring.

| jewel | to a goldsmith | to the Queen |
| --- | --- | --- |
| a turquoise ring | 15 | half as much again: turquoise from Persia, which she loves |
| a ring enamelled white and black | 20 | half as much again: her colours |
| a ruby ring | 25 | as much |
| a rope of pearls | 30 | as much |
| an emerald from New Granada | 35 | as much |
| a table-cut diamond | 60 | half as much again: from the East |
| the dead commander's ring | 20 | proof of service: court is safe, a question forgotten |

At the reckoning each is sold or set aside for the Queen. Set aside, they
count toward the gift (it costs that much less gold), lessen the risk at
court (by their worth to her over 120), and her pleasure in them is fame,
half their worth. Lying low, they're all sold. The numbers are Levin and
Auble's, doubled to the game's gold: a turquoise ring at £10 in 1514, a ruby
at £13; John Mabbe's eighteen rings "enameled white and black with Turcas"
offered her in 1576; Desmond's turquoise ring sent her in 1582 as proof of
his death.

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

**The hands of note** (`src/world/hands.ts`). Six of the crew have names,
mustered from the voyage's seed from a Devon and Cornish list, and each
does one small thing while he lives:

| hand | while he lives |
| --- | --- |
| the master | warns you before a leg the stores won't see out; a calm or the horse latitudes a day shorter; fog, one time in two, no day lost |
| the gunner | a barrel of powder serves four shots, not three |
| the carpenter | careening mends a point more |
| the surgeon | one time in two, the fever or the flux takes one fewer |
| the boatswain | one fewer of the hands who'd stay in the islands; a grievance comes to a head half as often |
| the ship's boy | nothing; he sings out when he sights a sail |

They're counted among the hands. When hands die, each named one goes with
a chance of his share of the dead (twice that for the gunner in a fight, the
surgeon in a fever, the boy over the side), and the log says who and of
what. The end screen lists them, and the voyage's dead by cause.

**Captives** (`src/world/captives.ts`). Men who leave the ship alive
(deserters, the marooned, hands left in a lock-up or cut off in a raid) may
be taken and talk: six times in ten on a coast Spain or Portugal holds, now
and then elsewhere. Before the treasure ship, word goes up the coast and
warns her; after, Spain's grievance grows by 25. A ship lost on a Spanish
coast with too few hands to work her: her men are tried at Lima, Goa or
Seville, the gunner and the carpenter sent to the galleys, the rest hanged
as heretics, as Menéndez hanged the French at Matanzas in 1565. The other
way: a Spanish or Portuguese prize frees an Englishman one time in eight,
and Callao's jail one of Oxenham's company half the time; he joins as a
hand, takes the place of a hand of note who's gone, and knows the coast (a
rumor, if there's one to hear).

**Copy the log** on the end screen copies the voyage as a few lines of
plain text (`src/share.ts`): which voyage (today's, with its date), the
ship and whose money, how far, the dead of note, the score and the voyage
it was like, and the seed. Nothing is sent anywhere; where the clipboard
won't take it, the lines are shown to select.

**Graves** (`src/graves.ts`). When a voyage ends, its dead are written in
the browser where they fell, with an epitaph you can change on the end
screen, and the ship too if she was lost. A later voyage passing within a
day of the place finds them in the log, once, and the chart marks them with
a cross. Nothing leaves the browser.

**Before you sail** (`src/world/warnings.ts`). At a landmark, if the food
or water at the rations you've set won't last the next leg and seven days
over (water reckoned faster for the share of the leg in the tropics), the
master says so: once a departure, with the way to put it right there, or
sail anyway. It shows beside the casks and the chandler too.

**The dying, folded.** The first death of thirst, hunger or scurvy stops
the ship; after that it's one running line, *thirst: 14 hands dead over 9
days*, moved to the end of the log as it grows.

The voyage saves as you go (`src/save.ts`, version 16; a run from before
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
npm run voyage -- [--ship pinnace|sloop|brigantine|all] [--backer crown|gentlemen|own|all] [--runs 40] [--from 0] [--raid] [--wake] [--pirate] [--no-rumors] [--chronicler] [--french] [--no-truck] [--trace]
```

It carries three chests of truck from Plymouth (none with `--no-truck`) and
barters them where there's a people and no market, deals fairly (flogs the
hands who wrong a people, trades truck with canoes), keeps company with the
Huguenots, and takes their French commission only with `--french`.

It never fires on a friend's merchant unless `--pirate`. At the reckoning it
goes to court when the risk is under three in ten, gives the Queen a gift
when it isn't and there's more than 100 to give from, and lies low
otherwise.

It sets the dead commander's ring aside for the Queen and sells the other
jewels unless it means to give a gift; treats with a Portuguese settlement;
buys brazilwood at Guanabara, or the Normans', with what's over a margin.

Over 100 voyages a ship and a backer, mean score counting the lost as 0:

| ship | the Crown | gentlemen adventurers | your own stake |
| --- | --- | --- | --- |
| pinnace | 57% home, mean score 256 | 59%, 283 | 58%, 243 |
| sloop | 59%, 152 | 58%, 141 | 52%, 167 |
| brigantine | 63%, 201 | 61%, 126 | 51%, 162 |

Truck and the peoples' goodwill lift every ship a few points; the pinnace
most, since fresh food is what it lacks (44% on its own stake without truck,
58% with). To hold the line the brigantine's purse came down to 10, the
backers' money became purely a share of the ship's purse (the Crown half,
the gentlemen four fifths), and the Crown's stores from Deptford a spare and
a barrel. The backed brigantine is still a few points over the rest; the
next seed range (100–199) gives the Crown's pinnace, sloop and brigantine
50%, 59% and 58%, so some of it is the dice. Jewels: about one voyage home in two brings one, the brigantine
more. With a chronicler, on its own stake, he came home alive about a
quarter of the time (26, 26 and 24 of 100), worth 42, 47 and 70 to the
score when he did; mean scores rose to 190, 158 and 207.

Before backers, on its own stake, it did as follows.

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

npm test                     # the rules and the voyage, 175 tests
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
  graves.ts      the graves of voyages before, kept in the browser
  peoples.ts     what the last English ship left on each coast, kept in the browser
  share.ts       the voyage in a few lines, to copy from the end screen
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
    peoples.ts   the peoples of the coasts: how you treat them, and what they remember
    hands.ts     the hands of note, who of them died and of what, and the graves they leave
    captives.ts  men left ashore who talk, a crew taken on a Spanish coast, Englishmen freed
    jewels.ts    jewels from prizes and towns, and what the Queen makes of them
    brazil.ts    the coast of Brazil in 1580: a settlement that may deal, the Normans at Guanabara
    warnings.ts  the master's warning before a leg the stores won't see out
    dilemmas.ts  events that ask you something, and what each choice stakes
    stores.ts    hands, food, water, spares, powder; the shore; the market; a fight's cost and a prize's hold
    meet.ts      a sail sighted by the waters, attacking, raiding a town, settling a fight
    treasure.ts  the treasure ship off Cape San Francisco, asleep or warned
    rumors.ts    rumors heard, the detours they open, and what's at the end of them
    landfalls.ts storms that drive you onto an island
    reckoning.ts whose money you sail on, privateer or pirate, and the reckoning at home
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
