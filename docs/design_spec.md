# Bootleg Beasts — Game Design & Math Spec

**Status:** v0.3 (Reactor level-up redesign), tuned. The math model is in [`src/bootleg_beasts/model.json`](../src/bootleg_beasts/model.json),
built by [`sims/tune.py`](../sims/tune.py) and verified by [`sims/verify.py`](../sims/verify.py).
**Title:** *Bootleg Beasts*. No released slot with this name turned up in a search in November 2026.

---

## 1. Concept

A black-market toy stall in a rain-soaked neon alley sells cheap knock-off monster toys. Something
went wrong at the bootleg factory, and the knock-offs are alive. You're a back-alley tamer catching
them with stolen Capture Cores before they glitch out of their blister packs. The tone is gritty, dark
and a little absurd, in the high-volatility style of modern Hacksaw and Nolimit City games.

**Art direction: bootleg monster merch.** The game is a parody of cheap knock-off monster toys.
Premium symbols are off-model bootleg figures in blister packs: googly or mismatched eyes, visible
mould seams, stitching, misregistered paint and starburst stickers ("NEW!!", "100%", "REAL!"). Low
symbols are knock-off items with misspelled labels ("HEEL" spray, "CANDEE"). The joke reads instantly
as "bootleg monster game" while every design stays original.

### Original-IP guardrails

The game uses the creature-catching *genre* and bootleg-toy humour without copying any existing franchise:

- No Pokémon names, creature designs, item designs, red-and-white ball design, element-type icons,
  logos or fonts. Even an off-model "knock-off" of a real character is still that character.
- The creatures are types (electric critter, fire dragon, water serpent, plant monster) with their own
  designs. The electric critter is **not a yellow mouse**, and the fire dragon has no flame tail.
- No studio's branded mechanic names (no "xWays", "xNudge", "Hidden Epic Bonus" and so on).

Two reasons matter to a studio:

1. **IP risk.** A public repo that looks like Pokémon is a liability.
2. **Regulation.** Regulated markets (UK Gambling Commission and advertising rules, many US states)
   ban gambling content of *particular appeal to children*. A cute cartoon-monster look would get
   flagged in compliance review. A gritty cyberpunk look with adult creatures is safer.

---

## 2. Grid and how wins pay

| Item | Value |
|---|---|
| Grid | 5 reels × 5 rows |
| Pay mechanic | **3,125 ways**, left to right, 3+ adjacent reels starting from reel 1 |
| Win per symbol | `pay[symbol][length] × ways × bet` |
| Ways | product of (matching symbols + wilds) on each reel in the run |
| Bet | 1 unit = total bet. All pays are multiples of total bet |
| Max win | **5,000× bet** per round (base spin plus any bonus it triggers). The round ends as soon as it's reached |

---

## 3. Symbols

| Code | Name | Concept | Where |
|---|---|---|---|
| H1 | **Sparkjaw** | The mascot. Bootleg electric critter: lumpy cyan head, bent lightning antenna, mismatched googly eyes, shark grin. Violet pack, "NEW!!" sticker | All reels |
| H2 | **Blazegob** | Bootleg fire dragon: flaming mohawk, horns, crossed eyes, crooked teeth, stubby wings poking out of the plastic. Yellow pack, "HOT!" | All reels |
| H3 | **Tidewyrm** | Bootleg water serpent: fin crest, one bulging eye and one half-shut, drooling, misprinted pink paint. Pink pack, "100%" | All reels |
| H4 | **Thornbyte** | Bootleg moss gremlin: leaf ears, thorns, a mushroom sprouting off its head, mismatched sewn-on button eyes. Orange pack, "REAL!" | All reels |
| L1 | **Heel Spray** | Knock-off healing spray, label misspelled "HEEL", taped up | All reels |
| L2 | **Candee** | Crushed striped wrapped candy | All reels |
| L3 | **Glitch Berry** | Pixel-seeded berry with a bite taken out | All reels |
| L4 | **Champeen Medal** | Chipped "#1" star medal on a ribbon | All reels |
| L5 | **Burned Disc** | Cracked CD-R with "MOVES 2" in marker | All reels |
| W | **Glitch Wild** | A corrupted, pixel-tearing tile. Substitutes for every paying symbol | Reels 2–5 |
| OW | **Override Wild** | Wild cross or column (section 4). **Dropped onto the grid by the game, not on the reel strips** | Reels 2–4 |
| S | **Capture Core** | A glowing hexagonal containment device. Triggers the bonus | All reels, max 1 per reel |
| R | **Reactor** | A pulsing power cell. Collect 3 in the bonus to level up | Bonus reels 1–4 |
| X | **Static** | A glitching TV. Mystery symbol: all Statics reveal the same random symbol each spin | All reels |

### Paytable (pays per way, × total bet)

| Symbol | 3 of a kind | 4 of a kind | 5 of a kind |
|---|---|---|---|
| H1 Sparkjaw | 0.20 | 0.50 | 1.50 |
| H2 Blazegob | 0.15 | 0.40 | 1.00 |
| H3 Tidewyrm | 0.10 | 0.30 | 0.75 |
| H4 Thornbyte | 0.10 | 0.25 | 0.50 |
| L1 Heel Spray, L2 Candee | 0.05 | 0.10 | 0.25 |
| L3 Glitch Berry, L4 Champeen Medal, L5 Burned Disc | 0.04 | 0.10 | 0.20 |

Glitch Wild and Override Wild don't pay on their own. They substitute only.

### Reel strips

Paying symbols and Static sit in stacks. Glitch Wilds, the one Capture Core per reel and (in the
bonus) Reactors go between stacks, so they never split one. There are two reel sets: base (71–72
stops per reel) and bonus (78–79 stops per reel, Reactors on reels 1–4, Static stacks on every reel).

### Static reveal weights

| Reel set | H1 | H2 | H3 | H4 | each low | Glitch Wild |
|---|---|---|---|---|---|---|
| Base | 3 | 4 | 5 | 6 | 9–11 | 1 |
| Bonus | 5 | 6 | 7 | 8 | 7 | 3 |

Every Static on screen reveals the **same** symbol, so a screen of Static stacks can turn into a
wall of one beast. The reveal happens before wins are counted.

---

## 4. Override Wild

The Override Wild is dropped onto a random cell of reels 2–4 by a weighted draw, separate from the
reel stops. That keeps the exact base-game formula exact (section 7) and lets the drop rate be tuned
continuously.

- **Base game:** a full **cross** (its row and column turn wild), about **1 in 1,488 spins**.
- **Bonus levels 1–3:** a wild **column**. **Overload:** a full cross. It drops on 9.4% of free spins.
- Capture Cores and Reactors are counted **before** the wilds land.
- There is **no guaranteed drop**. v0.2 forced one on the last spin if none had landed. Players
  noticed it always arrived at the end, so it was removed.

**Beast capture (bonus only).** Every beast (H1–H4) the Override covers, including the cell it
lands on, adds a random amount to that spin's multiplier, which starts at ×1. Captures **stack**:
five beasts under one column can make a ×6–×11 spin.

| Level | Capture values (weights) |
|---|---|
| Street Hunt | +1 (4), +2 (1) |
| Night Raid | +1 (3), +2 (1) |
| Lockdown | +1 (4), +2 (2), +3 (1) |
| Overload | +1 (3), +2 (2), +3 (1) |

---

## 5. The bonus: four levels

3, 4 or 5 Capture Cores start the bonus with **10 free spins** at level 1, 2 or 3. Every **3 Reactors**
collected adds **+4 spins** and unlocks the next level. Each level keeps everything below it.

| Level | Name | What it adds | Guaranteed minimum |
|---|---|---|---|
| 1 | **Street Hunt** | Override drops a wild column; beast captures | 20× |
| 2 | **Night Raid** | Bigger capture values | 50× |
| 3 | **Lockdown** | Override columns **lock** wild for the rest of the bonus | 120× |
| 4 | **Overload** | Full **crosses**, and every Glitch Wild that lands **locks** | 250× |

Locked cells hide whatever lands under them, so Reactors and Cores under them don't count.
The minimum is checked at the end: if the bonus paid less than the floor for its starting level, it
pays the floor instead. Max win is **5,000×** per round, and the round ends as soon as it's reached.

| Buy | Price | Starts on |
|---|---|---|
| Street Hunt | 100× | Street Hunt (same as 3 Cores) |
| Night Raid | 230× | Night Raid (same as 4 Cores) |
| Lockdown | 690× | Lockdown (same as 5 Cores) |

---

## 6. Results

Full tables and charts: **[par_sheet.md](par_sheet.md)** (generated by `sims/charts.py`).

| Metric | Result |
|---|---|
| RTP, base mode | **96.03% ± 0.04%** (exact base + simulated bonus); 96.03% ± 0.09% over 2×10⁹ full-game spins (z = −0.07) |
| Bonus buy RTP | Street Hunt 96.22% ± 0.15%, Night Raid 95.98% ± 0.12%, Lockdown 96.17% ± 0.07% |
| Base game RTP (exact) | 65.38%, 68% of the total |
| Hit frequency | 30.8% |
| Bonus odds (3 / 4 / 5 Cores) | 1 in 342 / 1 in 9,140 / 1 in 610,574 (exact) |
| Volatility (SD per spin) | 21.0× |
| Max win 5,000× | 1 in 149,948 spins |

| Bonus from level 1 | Value |
|---|---|
| Mean / median payout | 96.2× / 20.3× |
| 75th / 90th / 99th percentile | 56× / 149× / 1,458× |
| Reaches Night Raid / Lockdown / Overload | 47.1% / 13.9% / 3.1% |
| Average Override Wilds | 1.18 |

**Volatility note.** The brief asked for medium volatility (SD roughly 8–12×). This design lands
at 21×: the level ladder and stacking captures put a lot of value in rare deep runs, and the median
bonus sits on its 20× floor. Getting to medium would mean flatter captures, a higher floor and a
cheaper path to Overload, which trades away the "reach the end" payoff. That is the main open decision.

---

## 7. How RTP is verified

```
RTP = base-game wins + Σ over start levels  P(k Cores) × E[bonus payout from that level]
```

1. **Base-game wins: exact, by formula.** Reel stops are independent of each other, of the Static
   reveal and of the Override drop. Fix the revealed symbol and where the Override lands, and each
   reel's count of "this symbol or a wild" cells depends only on that reel's stop. So:

   ```
   E[win] = pay × E[c₁] × … × E[c_L] × P(c_{L+1} = 0)
   ```

   Averaging over reveals and the 16 Override configurations gives the exact base RTP in milliseconds.
2. **Brute-force check.** For a reveal, all 1.91 billion stop combinations of the base reels are
   enumerated with Numba. They match the formula to ten decimal places.
3. **Trigger odds: exact.** There's at most one Core per reel, so P(k Cores) is a Poisson-binomial.
4. **Bonus payouts: Monte Carlo**, 2×10⁷ rounds per start level, with 95% confidence intervals.
5. **Whole-game simulation as an independent check.** 2×10⁹ complete rounds, played exactly as a
   player would. It agrees with the sum of the parts (z = −0.07).
6. **The browser engine** (`web/engine.js`) is checked against Python on exported test grids and by
   its own Monte Carlo on the [self-test page](https://infernokik.github.io/bootleg-beasts/selftest.html).

---

## 8. Design iteration log

**v0.1 → v0.2: the bonus buys were lottery tickets.** With no guarantees, 67% of Street Hunt buys
got no cross and the median was 7.8×. Fixed with a guaranteed cross, column-only sticking in Night
Raid and Static on the Street Hunt reels.

**v0.2 → v0.3: play-test feedback.**

1. *"The bonus is boring."* Three separate tiers became one bonus with a **Reactor level-up ladder**
   (collect 3 → +4 spins and a new feature), in the style of collect-to-upgrade bonuses.
2. *"The Override always drops on the last spin."* The guarantee was removed. A minimum bonus win
   protects the player instead, without a predictable pattern.
3. *"The multiplier feels wonky."* The flat global multiplier was replaced by **beast captures**:
   the multiplier comes from the beasts the Override hits, so you can see why it's big.
4. *"I can't tell which symbols are good."* Rarity frames (gold / purple / blue / green) on beasts,
   dimmed lows, and glowing specials. Static became a mystery symbol in every mode.

Tried and dropped along the way: flat level multipliers (lottery-like, median under 10×) and crosses
on every level (one cross alone paid more than the buy price).

---

## 9. Decisions still open

1. **Volatility.** Medium would need flatter captures and a higher floor (section 6).
2. **Reactor art** is procedural (`art/make_reactor.py`). It can be swapped for Gemini art.
3. **Optional extras:** an ante bet.
