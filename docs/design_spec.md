# Bootleg Beasts — Game Design & Math Spec

**Status:** v0.4 (flagship pass: multiplier wilds, Bonus Hunt, Override Spin, new art), tuned. The math model is in [`src/bootleg_beasts/model.json`](../src/bootleg_beasts/model.json),
built by [`sims/tune.py`](../sims/tune.py) and verified by [`sims/verify.py`](../sims/verify.py).
**Title:** *Bootleg Beasts*. No released slot with this name turned up in a search in November 2026.

---

## 1. Concept

A back alley behind a black-market stall, under one flickering street lamp. Something went wrong at
the bootleg factory and the knock-off monsters came alive. You catch them with stolen Capture Cores
before they get away. The tone is grimy, loud and a little absurd, in the high-volatility style of
modern Hacksaw and Nolimit City games.

**Art direction: back-alley bootleg (v0.4).** Hand-inked cartoon in the street-art tradition: chunky
ink outlines, two-tone cel shading and a white die-cut sticker border on every symbol, like bootleg
stickers slapped on a wall. Palette: hazard yellow and hot red on dark brick and asphalt. The beasts
are snarling, scarred and off-model (mismatched eyes, an X-stitched eye, fangs, underbites); low
symbols are knock-off merch (spray can, candy, berries, a star medal, a burned CD). The board has
hazard-tape edges; the logo is chunky display lettering with a "100% REAL!" sticker. All symbols are
hand-written SVG in [`web/symbols.js`](../web/symbols.js); the background (brick wall, faded posters
and tags, lamp light, drifting dust) is drawn on a canvas in [`web/background.js`](../web/background.js).
v0.1–v0.3 used AI-generated pixel art (kept in `art/` for reference); play-testers found the neon
look busy and unpolished.

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
   ban gambling content of *particular appeal to children*. The cartoon style is kept adult: snarling,
   scarred creatures, graffiti and a back-alley setting, no baby-faced or kawaii designs and no
   toys-for-kids framing. It would still need a compliance review before any real-money release.

---

## 2. Grid and how wins pay

| Item | Value |
|---|---|
| Grid | 5 reels × 5 rows |
| Pay mechanic | **3,125 ways**, left to right, 3+ adjacent reels starting from reel 1 |
| Win per symbol | `pay[symbol][length] × ways × bet` |
| Ways | product of (matching symbols + wilds) on each reel in the run |
| Bet | 1 unit = total bet. All pays are multiples of total bet |
| Max win | **10,000× bet** per round (base spin plus any bonus it triggers). The round ends as soon as it's reached |

---

## 3. Symbols

| Code | Name | Concept | Where |
|---|---|---|---|
| H1 | **Sparkjaw** | The mascot. Electric chomper: blue head, lightning-bolt antenna, one big and one small eye, a huge underbite full of fangs | All reels |
| H2 | **Blazegob** | Fire goblin: flame mohawk, ridged horns, one X-stitched eye, a snout and a tusk | All reels |
| H3 | **Tidewyrm** | Water wyrm: spiky fin crest, gill fins, one half-shut eye, a snaggletooth and bubbles | All reels |
| H4 | **Thornbyte** | Thorn gremlin: leaf ears, thorns, a sprout on its head, heavy-lidded eyes and a jagged grin | All reels |
| L1 | **Heel Spray** | Knock-off spray can with a scribbled label | All reels |
| L2 | **Candee** | Striped wrapped candy | All reels |
| L3 | **Glitch Berry** | A bunch of purple berries | All reels |
| L4 | **Champeen Medal** | Bronze star medal on a ribbon | All reels |
| L5 | **Burned Disc** | Scorched CD-R with "MIX" in marker | All reels |
| W | **Glitch Wild** | A spray-painted WILD tag. Substitutes for every paying symbol. In the base game it carries ×2, ×3 or ×5 | Reels 2–5 |
| OW | **Override Wild** | Wild cross or column (section 4). **Dropped onto the grid by the game, not on the reel strips** | Reels 2–4 |
| S | **Capture Core** | A glowing yellow core in a hazard-striped hex casing. Triggers the bonus | All reels, max 1 per reel |
| R | **Reactor** | Same yellow art as the Capture Core. Collect 3 in the bonus to level up | Bonus reels 1–4 |
| X | **Static** | A knock-off TV full of static with a "?". Mystery symbol: all Statics reveal the same random symbol each spin | All reels |

### Paytable (pays per way, × total bet)

| Symbol | 3 of a kind | 4 of a kind | 5 of a kind |
|---|---|---|---|
| H1 Sparkjaw | 0.10 | 0.25 | 0.70 |
| H2 Blazegob | 0.07 | 0.18 | 0.45 |
| H3 Tidewyrm | 0.05 | 0.14 | 0.35 |
| H4 Thornbyte | 0.05 | 0.12 | 0.25 |
| L1 Heel Spray, L2 Candee | 0.02 | 0.05 | 0.12 |
| L3 Glitch Berry, L4 Champeen Medal, L5 Burned Disc | 0.02 | 0.04 | 0.10 |

Glitch Wild and Override Wild don't pay on their own. They substitute only. Pays were scaled down
about 0.45× in v0.4 to pay for the base-game wild multipliers.

**Multiplier Glitch Wilds (base game).** Every Glitch Wild that lands in the base game carries ×2, ×3
or ×5 (weights 6 : 3 : 1, mean ×2.6). A wild counts as that many ways, so multipliers on one win
multiply together. Wilds revealed by Static and cells under an Override count once. This keeps the
exact formula exact: a landed wild enters its reel's count with weight 2.6 instead of 1.

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

- **Base game:** a full **cross** (its row and column turn wild), about **1 in 313 spins** (1 in 69 in Bonus Hunt).
- **Bonus levels 1–3:** a wild **column**. **Overload:** a full cross. It drops on 16.0% of free spins.
- **Override Spin** (feature buy, 57.1× bet): one base spin with a guaranteed cross.
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
| 4 | **Overload** | Full **crosses** (the column still locks, the row is one spin), and every Glitch Wild that lands **locks** | 250× |

Locked cells hide whatever lands under them, so Reactors and Cores under them don't count.
The minimum is checked at the end: if the bonus paid less than the floor for its starting level, it
pays the floor instead. Max win is **10,000×** per round, and the round ends as soon as it's reached.

| Buy | Price | Starts on |
|---|---|---|
| Street Hunt | 100× | Street Hunt (same as 3 Cores) |
| Night Raid | 289× | Night Raid (same as 4 Cores) |
| Lockdown | 956× | Lockdown (same as 5 Cores) |

Overload can't be bought. **Bonus Hunt** (ante, 3× bet per spin) plays on reels with extra Capture
Cores: the bonus comes about 1 in 70 spins instead of 1 in 342, with its own Override rate tuned to 96%.

---

## 6. Results

Full tables and charts: **[par_sheet.md](par_sheet.md)** (generated by `sims/charts.py`).

| Metric | Result |
|---|---|
| RTP, base mode | **96.00% ± 0.04%** (exact base + simulated bonus); 95.97% ± 0.06% over 10¹⁰ full-game spins (z = −0.80) |
| Bonus Hunt (3×) RTP | 95.99% exact parts; 95.93% ± 0.09% over 2.5×10⁹ spins (z = −1.23) |
| Override Spin (57.1×) RTP | 96.13% exact parts; 96.13% ± 0.01% over 2.5×10⁸ spins (z = +1.03) |
| Bonus buy RTP | Street Hunt 96.40% ± 0.13%, Night Raid 96.11% ± 0.09%, Lockdown 96.14% ± 0.05% |
| Base game RTP (exact) | 64.63%, 67% of the total |
| Hit frequency | 31.0% |
| Bonus odds (3 / 4 / 5 Cores) | 1 in 342 / 1 in 9,140 / 1 in 610,574 (exact) |
| Volatility (SD per spin) | 28.5× |
| Max win 10,000× | 1 in 535,590 spins |

| Bonus from level 1 | Value |
|---|---|
| Mean / median payout | 96.4× / 20.0× |
| 75th / 90th / 99th percentile | 40× / 113× / 1,572× |
| Reaches Night Raid / Lockdown / Overload | 47.1% / 13.9% / 2.8% |
| Average Override Wilds | 2.00 |

**Volatility note.** The brief asked for medium volatility (SD roughly 8–12×). This design lands
at 28×: the level ladder and stacking captures put a lot of value in rare deep runs, and the median
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
4. **Bonus payouts: Monte Carlo**, 5×10⁷ rounds per start level, with 95% confidence intervals.
5. **Whole-game simulation as an independent check.** 10¹⁰ complete rounds, played exactly as a
   player would. It agrees with the sum of the parts (z = −0.80). Bonus Hunt and Override Spin get the
   same check (z = −1.23 and +1.03).
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

5. *"The Override didn't lock on Overload."* Overload had swapped Lockdown's column lock for
   locking Glitch Wilds, so a cross on the top level vanished after one spin. Overload now keeps the
   column lock as well (the cross's row still lasts one spin). Re-tuned: Override chance 9.4% → 8.8%
   per free spin, buys 237× and 723×.

**v0.3 → v0.4: "make it a flagship".** Multiplier Glitch Wilds in the base game, a 10,000× max win,
the Bonus Hunt ante and the Override Spin buy, the Overload buy removed (earned only), and player
protection (session clock and net, reality checks, autoplay loss and win limits, game history). The
first 10¹⁰-spin check failed (z = −4.3): Static-revealed wilds were carrying multipliers, which the
formula didn't model, and the 10,000× cap clipped rare base wins. Revealed wilds now count once, and
the re-run passes. The art was redrawn from pixel art into the back-alley sticker style (section 1).

Tried and dropped along the way: flat level multipliers (lottery-like, median under 10×) and crosses
on every level (one cross alone paid more than the buy price).

---

## 9. Decisions still open

1. **Volatility.** Very high. Medium would need flatter captures and a higher floor (section 6).
2. **Reactor art** reuses the yellow Capture Core art, so the bonus collect symbol matches the trigger.
3. **Optional extras:** a jurisdiction switch (turbo, autoplay and buys off for UK rules) and bonus replays.
