# playtest 1

Whole voyages played through the real UI in a browser (Playwright driving
the page, the way a person would: clicking the buttons, reading the
status and the log), with a captain's judgement rather than the bot's:
fit out to about three months of water and four of food, fill the casks
and forage where there's a shore, careen when she's worn, cut the rations
when the master says the stores won't last the leg, trust a good source's
rumor and skip the Northwest Passage and the River May, let a friend's
ship pass, and keep the Pacific coast asleep for the treasure ship.

Main at PR #30, then the fixes below as they were found.

## the voyages

The first round found the bugs; the second was sailed after the fixes.

| | ship, backer | route | how it ended |
| --- | --- | --- | --- |
| 1 | pinnace, the Crown | Brazil, the Strait, the coast, Guatulco, across | died of thirst between Callao and Guatulco: nowhere to water without raiding |
| 2 | sloop, gentlemen | Guanabara, the Horn, back through the Strait | home, like Fenton's: 371 |
| 3 | brigantine, own stake, chronicler | Guanabara, the Strait, Nova Albion | starved crossing from Guatulco: a 10-gold purse buys little food |
| 4 | sloop, own stake, chronicler | the Horn, Guatulco, straight across | died of scurvy and thirst on the 117 days to the Ladrones |
| f1 | pinnace, the Crown | Brazil, the Strait, Nova Albion, the Ladrones, Ternate, Java, the Cape | home round the world, like Fenton's: 408 (×2), 682 days |
| f2 | sloop, own stake, chronicler | Brazil, the Horn, the treasure ship, Guatulco straight across, Ternate, Java, the Cape, the Azores | **home like Drake's: 626**, the chronicler's account 70 of it |
| f3 | brigantine, gentlemen | Guanabara, the Strait, back the way she came, the Azores | home, like Fenton's: 92, 33 gold |
| f4 | sloop, the Crown | Brazil, the Horn | lost to the treasure ship, attacking her with 1 hull of 14 |

A voyage is 30 to 65 presses of "continue on" and 25 to 50 dialogs; round
the world takes about 650 days.

## friction found

### fixed as found

1. **No water on the Pacific coast but by raiding** (unfair). From Mocha to
   Guatulco is some sixty-eight days, most of it in the tropics, and the
   only water was a raid, which warns the treasure ship. The master's
   warning said so and offered nothing to do. Now Valparaíso, Callao and
   Guatulco let you water by night from the river (two days, seen three
   times in ten: word goes up the coast, or, after the treasure ship, one
   more thing for Spain to complain of).
2. **The Pacific crossing couldn't be survived** (unfair). Guatulco to the
   Ladrones was 117 days, more than the casks hold in the tropics even on
   short rations. The Pacific trades now carry her two days' way every
   other day: 84 days, as the Manila galleon ran it; Nova Albion to the
   Ladrones 79. The days shown and the master's warning count it.
3. **Bound for Brazil, she put in at Guanabara** (bug). The lane passes the
   bay, and passing a sibling landmark raised it. Only the landmark you're
   bound for is raised now.
4. **The scurvy stopped the ship every few days** (dragged). Its deaths come
   further apart than the fold allowed, so each was "the scurvy has begun
   to kill" again. A bout now folds while deaths come within three weeks.
5. **Seven leaks and six fouled casks on one voyage** (dragged). An event
   that has asked won't ask again for forty days.
6. **"dead of lost over the side", "2 to lost over the side"** (bug). Deaths
   are said as a sentence says them, everywhere.
7. **Lost in mid-Pacific, her boatswain "hanged at Goa"** (bug). Her men are
   taken only when she's lost within six days of a Spanish-held landmark.

### left for later, most first

1. **Every voyage comes home at 1 hull.** Weed and worm, leaks pumped, and
   storms grind her down faster than careening mends her, so the ship's
   share of the score is always 1 or 2. It feels like a slow leak in the
   game rather than a choice. A balance lever, or a careening place on the
   long legs.
2. **Sails sighted stop the ship a great deal.** Eleven Portuguese merchants
   on one homeward run, each a stop and a dialog, most of them an easy
   "let her pass". A lookout setting (stop for every sail / only rich or
   hostile ones) would cut the noise.
3. **The brigantine on its own stake can't fit out.** Ten gold buys two lots
   of biscuit for seventy mouths. It's a trap for a new player who picks the
   strongest ship and keeps everything.
4. **Choosing a fork sets sail at once.** You can't choose the leg and then
   water and forage for it; you water first, guessing, and the master's
   warning catches you after you've chosen. Choosing could set your course
   without sailing.
5. **Foul water at a watering place** asks you to drink it or heave half
   over, when the casks could simply be refilled ashore. Harmless, but it
   reads oddly.
6. **The treasure ship can be attacked with 1 hull.** The reading says
   "hull 9 to your 1", but nothing else marks it as hopeless.

Screenshots of these voyages are in the session's scratchpad (`pt-*.png`).
