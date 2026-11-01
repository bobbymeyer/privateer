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
