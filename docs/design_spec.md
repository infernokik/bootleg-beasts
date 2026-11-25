# Glitch Tamers — Game Design & Math Spec

**Status:** v0.2, tuned. The math model is in [`src/glitch_tamers/model.json`](../src/glitch_tamers/model.json),
built by [`sims/tune.py`](../sims/tune.py) and verified by [`sims/verify.py`](../sims/verify.py).
**Working title:** *Glitch Tamers*. Check that no released slot uses this name before publishing.

---

## 1. Concept

A neon megacity where rogue digital creatures ("Glitchlings") have escaped a corporate lab. You're an
underground tamer catching them with stolen Capture Cores. The tone is gritty, dark and a little
absurd, in the high-volatility style of modern Hacksaw and Nolimit City games.

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
| Max win | **10,000× bet** per round (base spin plus any bonus it triggers). The round ends as soon as it's reached |

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
| OW | **Override Wild** | The cross wild (section 4). **Dropped onto the grid by the game, not on the reel strips** | Reels 2–4 |
| S | **Capture Core** | A glowing hexagonal containment device. Triggers the bonuses | All reels, max 1 per reel |
| X | **Static** | A burnt-out screen tile. Pays nothing | Street Hunt reels only |

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

Paying symbols sit in stacks of 1–3. Glitch Wilds and the one Capture Core per reel go between
stacks, so they never split one. There are four reel sets: base, Street Hunt, Night Raid and Legendary.

| Reel set | Lengths (reels 1–5) | Glitch Wilds per reel (reels 2–5) | Static |
|---|---|---|---|
| Base | 67, 68, 68, 68, 68 | 1 | – |
| Street Hunt | 79, 80, 80, 80, 80 | 1 | 12 per reel |
| Night Raid / Legendary | 67, 69, 69, 69, 69 | 2 | – |

---

## 4. Signature mechanic: the Override Wild (cross wild)

When an Override Wild lands, **its entire row and its entire column turn wild**. That's 9 wild cells
in a cross centred where it landed.

```
Override Wild lands on reel 3, row 2:

  . . W . .
  W W O W W      O = Override Wild, W = new wild cells
  . . W . .
  . . W . .
  . . W . .
```

Rules:

- On each spin, a weighted draw decides whether an Override Wild drops. If it does, it lands on a
  random cell of reels 2–4: 15 cells, all equally likely. In a bonus it never lands on a sticky cell.
- Capture Cores are counted **before** the cross expands.
- The row puts a wild on **every reel**, including reel 1, so every symbol on screen connects.
- The engine supports two drops on one spin (always on different reels). The current tuning never uses it.

**Why a drop instead of a symbol on the strips:** The base game needs a cross only about once every
900 spins. On a strip, a symbol shows on 5 of every N stops, so the strip would need about 4,500
positions. A weighted draw can be tuned continuously, and it's independent of the reel stops, which
keeps the exact base-game formula exact (section 7).

**Why a cross instead of a fixed T:** A fixed T covers the same 9 cells every time. A cross centred
on the landing cell takes 15 different shapes, so it feels random and is still easy to tune.

**Why the per-way pays are small:** One cross, on any of reels 2–4, gives every symbol at least 5 ways
of 5 of a kind, even with nothing else on screen. With this paytable that's at least
5 × 4.85 = **24.25× bet**. On the base reels a cross averages **94.5×**.

---

## 5. Bonus games (3, 4 or 5 Capture Cores)

Each tier adds one thing on top of the tier below it.

| | Tier 1: **Street Hunt** | Tier 2: **Night Raid** | Tier 3: **Legendary Capture** (hidden) |
|---|---|---|---|
| Trigger | 3 Cores | 4 Cores | 5 Cores |
| Free spins | 10 | 10 | 10 |
| Override Wild | Drops on 7.1% of free spins | Drops on 3.0% of free spins | Same as Night Raid |
| Guaranteed cross | **Yes**: if none has landed, one drops on the last spin | **Yes** | Starts with **1 sticky cross already placed** |
| What sticks | Nothing | The Override Wild's **column** stays wild for the rest of the bonus | The **whole cross** stays wild |
| Global multiplier | None | Starts at ×1. **+1 per Override Wild**, applied on the spin it lands | **+2 per Override Wild** |
| Reels | Street Hunt reels (with Static) | Night Raid reels (2 wilds per reel) | Same as Night Raid |
| Retrigger | 3+ Cores (not under sticky cells) → +4 spins | Same | Same |
| Bonus buy | **100×** | **300×** | **Not buyable** |

Sticky cells hide whatever lands under them: no Override Wild can drop there, and Cores under them
don't count. Each Override Wild sits on its own reel, so Night Raid and Legendary can have at most
three crosses.

"Hidden" means Legendary Capture isn't shown in the buy menu or the intro screen. It **must still be
described in the game rules**, because regulated markets require every feature to be disclosed.

---

## 6. Results

Generated from [`reports/results.json`](../reports/results.json) by `sims/summarize.py`.

### Targets vs results

| Metric | Target | Result |
|---|---|---|
| RTP, base mode | 96.00% | **95.997% ± 0.004%** (exact base + simulated bonuses); 95.984% ± 0.024% (10¹⁰-spin full-game check, z = -1.01) |
| RTP, each bonus buy | 96.0–96.3% | Street Hunt 96.18% ± 0.01%, Night Raid 96.23% ± 0.03% |
| Base game's share of RTP | 55–65% | 60.7% |
| Hit frequency | about 25% | 29.3% exact (base wins); 29.6% counting bonus rounds |
| Street Hunt trigger | about 1 in 250 | 1 in 291 (exact) |
| Night Raid trigger | about 1 in 4,000 | 1 in 7,300 (exact) |
| Legendary trigger | about 1 in 250,000 | 1 in 458,417 (exact) |
| Override Wild in base game | – | 1 in 907 spins |
| Volatility (SD per spin) | 12–20× | 12.5× |
| Max win 10,000× | report | 1 in 1,778,410 spins (5,623 hits) |

### Where the RTP comes from

| Source | RTP | Share of RTP |
|---|---|---|
| Base game, normal wins (exact) | 47.81% | 49.8% |
| Base game, Override Wild spins (exact) | 10.42% | 10.9% |
| Street Hunt | 33.10% | 34.5% |
| Night Raid | 3.96% | 4.1% |
| Legendary Capture | 0.71% | 0.7% |
| **Total** | **95.997%** | 100% |

### Bonus payouts

| | Street Hunt | Night Raid | Legendary Capture |
|---|---|---|---|
| Price | 100× | 300× | not buyable |
| Mean payout | 96.2× | 288.7× | 3,275× |
| Median payout | 76.5× | 195.9× | 1,107× |
| 10th–90th percentile | 53–165× | 133–401× | 880–10,000× |
| Pays back at least the price | 32.2% | 19.6% | – |
| Pays back under half the price | 5.5% | 23.5% | – |
| Pays back under 10% of the price | 0.0% | 0.0% | – |
| Average Override Wilds | 1.19 | 1.04 | 0.27 (+1 placed) |
| Reaches 10,000× | not reached in 10⁸ rounds | 1 in 1,877 | 22.4% of bonuses |

About 87% of 10,000× max wins come from Legendary Capture, and most of the rest from Night Raid. That's the intended shape: the hidden tier is where the top of the game lives.

---

## 7. How RTP is verified

The total RTP is split into parts, and each part is measured the most precise way available:

```
RTP = base-game wins + Σ over tiers of  P(tier triggers) × E[tier payout]
```

1. **Base-game wins: exact, by formula.** Reel stops are independent of each other and of the Override
   Wild drop. Fix which reels have a cross and which rows are wild, and each reel's count of
   "this symbol or a wild" cells depends only on that reel's own stop. So for each symbol and run
   length L:

   ```
   E[win] = pay × E[c₁] × … × E[c_L] × P(c_{L+1} = 0)
   ```

   Averaging over the 16 Override configurations (none, or one of 15 cells) gives the exact base RTP
   in milliseconds.
2. **Brute-force check.** Every one of the 1.43 billion stop combinations on the base reels
   (the "full cycle") is enumerated with Numba in about a second. It matches the formula to ten
   decimal places. The unit tests also check both against direct grid-by-grid scoring on small reels.
3. **Trigger odds: exact.** At most one Core per reel, so P(k Cores) is a Poisson-binomial over the
   five reels' Core probabilities.
4. **Bonus payouts: Monte Carlo.** Each tier is simulated on its own for 10⁸ rounds, giving its mean
   payout with a 95% confidence interval.
5. **Whole-game simulation as an independent check.** 10¹⁰ complete rounds (about 3 minutes on a
   12-core desktop), played exactly as a player would. It agrees with the sum of the parts:
   z = −1.01, well inside the 95% band of ±1.96.

The RTP from the parts (±0.004%) is about 6× tighter than even the 10-billion-spin simulation
(±0.024%), because the base game, 61% of the RTP, carries no sampling error.

Simplification: the formula applies the 10,000× cap to each bonus on its own rather than to the
base spin and bonus combined. The billion-spin simulation applies the cap exactly, and the two agree.

---

## 8. Design iteration log

**v0.1 → v0.2: the bonus buys were lottery tickets.**
The first version had Street Hunt (crosses plus a growing multiplier) and Night Raid (fully sticky
crosses), with no guarantees. Tuned to 96%, the simulation showed:

| Buy | Average | Median | Bonuses with no cross | Pays back <10% of price |
|---|---|---|---|---|
| Street Hunt (100×) | 96× | 7.8× | 67% | 55% |
| Night Raid (300×) | 289× | 4.9× | 84% | 82% |

The cause: one cross is worth about as much as the whole Street Hunt price. A sticky full cross pays
at least ~48× on *every* remaining spin. So the drop rates had to be tiny, and most buys got nothing.

The fixes, each tested in simulation before being adopted:

1. **Guaranteed cross** in both buyable tiers.
2. **Night Raid sticks the column only.** Fully sticky crosses moved to the rare, unbuyable Legendary.
3. **Street Hunt has no multiplier.** With one, the guaranteed cross alone paid ~130–210×, more than
   the price. Letting the multiplier rise *after* the landing spin paid worked too, but mixed timing
   between tiers would confuse players.
4. **Static on the Street Hunt reels.** This lowers a cross's value there (94× → 79×), so crosses
   can drop more often.

Static made Night Raid *worse* (median 196× → 150×), so Night Raid keeps the regular bonus reels.

---

## 9. Decisions still open

1. **Name and art direction.** *Glitch Tamers* is a placeholder.
2. **Night Raid price.** 300× works (median about 196×). A 400–500× version with a stronger feature
   is possible.
3. **Optional extras for later:** an ante bet (higher bet for more frequent bonuses), and Glitch Wilds
   that carry multipliers in the bonuses.
