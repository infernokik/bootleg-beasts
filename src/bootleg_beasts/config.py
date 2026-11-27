"""Game constants, paytable, bonus rules and loading of the tuned math model.

Every pay is a multiple of the total bet (bet = 1).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np

REELS = 5
ROWS = 5

# ---- Symbols ---------------------------------------------------------------
H1, H2, H3, H4, L1, L2, L3, L4, L5 = range(9)
WILD = 9  # Tag Wild: substitutes for every paying symbol
OVERRIDE = 10  # Net Wild: dropped onto reels 2-4; base game: its row and column turn wild, bonus: its reel
CORE = 11  # Capture Core: scatter, 3/4/5 trigger the bonus at level 1/2/3
STATIC = 12  # Static: mystery symbol, every Static on screen reveals the same random symbol
REACTOR = 13  # bonus Capture Core: collect 3 to level up (code "R", same art as the scatter)
N_PAYING = 9

CODES = ["H1", "H2", "H3", "H4", "L1", "L2", "L3", "L4", "L5", "W", "OW", "S", "X", "R"]
NAMES = [
    "Sparkjaw",
    "Blazegob",
    "Tidewyrm",
    "Thornbyte",
    "Heel Spray",
    "Candee",
    "Berry Pop",
    "Champeen Medal",
    "Burned Disc",
    "Tag Wild",
    "Net Wild",
    "Capture Core",
    "Static",
    "Capture Core",
]
CODE_TO_ID = {code: i for i, code in enumerate(CODES)}

# ---- Paytable: pay per way (x total bet), indexed [symbol, run length] -------
# Pays are small because base-game Tag Wilds carry x2-x5 multipliers that multiply ways.
_PAYS = {
    H1: (0.10, 0.25, 0.70),
    H2: (0.07, 0.18, 0.45),
    H3: (0.05, 0.14, 0.35),
    H4: (0.05, 0.12, 0.25),
    L1: (0.02, 0.05, 0.12),
    L2: (0.02, 0.05, 0.12),
    L3: (0.02, 0.04, 0.10),
    L4: (0.02, 0.04, 0.10),
    L5: (0.02, 0.04, 0.10),
}
PAYTABLE = np.zeros((N_PAYING, REELS + 1), dtype=np.float64)
for _sym, _pays in _PAYS.items():
    PAYTABLE[_sym, 3:] = _pays

MAX_WIN = 10_000.0
# Base game: every Tag Wild that lands on the reels (not one revealed by Static) and is not covered
# by a Net carries a multiplier. In a ways game it counts as that many ways, so multipliers on one win multiply.
BASE_WILD_MULTS = ((2, 3, 5), (6, 3, 1))  # (values, weights)
BASE_WILD_MULT_MEAN = sum(v * w for v, w in zip(*BASE_WILD_MULTS)) / sum(BASE_WILD_MULTS[1])
OVERRIDE_REELS = (1, 2, 3)  # 0-based, i.e. reels 2-4

# Win-size buckets used by every report (x bet). A win w falls in bucket (edge[i-1], edge[i]].
WIN_BUCKET_EDGES = np.array(
    [0.5, 1, 2, 5, 10, 20, 50, 100, 250, 500, 1000, 2500, 5000], dtype=np.float64
)


# ---- Bonus: one bonus with four levels ----------------------------------------
# Every free spin a Net Wild may drop onto reels 2-4 and turn its whole reel wild. Every beast (H1-H4)
# on that reel is caught and adds the level's catch value to the Catch Multiplier, which starts at x1,
# never resets, and multiplies every win in the bonus. A Net can land on a reel that is already
# netted: it catches that reel's beasts again and refreshes the hold.
HOLD_FOREVER = 99  # a hold this long never runs out


@dataclass(frozen=True)
class Level:
    key: str
    name: str
    catch: int  # each caught beast adds this much to the Catch Multiplier
    hold: int  # extra spins a netted reel stays wild after the spin it lands (HOLD_FOREVER = rest of bonus)
    net_factor: float  # Net Wild drop chance relative to level 1
    doubles: bool  # reaching this level doubles the Catch Multiplier and locks every net on screen


LEVELS = (
    Level("street_hunt", "Street Hunt", 1, 0, 1.00, False),
    Level("night_raid", "Night Raid", 1, 1, 1.15, False),
    Level("lockdown", "Lockdown", 2, 2, 1.30, False),
    Level("overload", "Overload", 3, HOLD_FOREVER, 1.45, True),
)
N_BEASTS = 4  # symbols 0-3 (H1-H4) are the beasts a Net catches
# Guaranteed minimum bonus win (x bet) by starting level.
MIN_BONUS_WIN = (20.0, 50.0, 150.0, 250.0)
FREE_SPINS = 10
REACTORS_PER_LEVEL = 3  # collect this many bonus Capture Cores to reach the next level
LEVEL_UP_SPINS = 3  # extra free spins awarded on each level-up
START_LEVEL = {3: 0, 4: 1, 5: 2}  # Capture Cores -> starting level (0-based)


@dataclass(frozen=True)
class Buy:
    key: str
    name: str
    start_level: int


BUYS = (
    Buy("street_hunt", "Street Hunt", 0),
    Buy("night_raid", "Night Raid", 1),
    Buy("lockdown", "Lockdown", 2),
)
# Ante mode: the player pays ANTE_KEY's price (x bet) per spin to play the base game on the
# "hunt" reels, which carry two Capture Cores per reel. Wins and the max win stay relative to the bet.
ANTE_KEY = "hunt"
ANTE_NAME = "Bonus Hunt"
ANTE_PRICE = 3.0  # x bet per spin
# Feature spin: a base spin with a guaranteed Net Wild cross, priced from the exact maths.
FEATURE_KEY = "override_spin"
FEATURE_NAME = "Super Net Spin"

MODEL_PATH = Path(__file__).with_name("model.json")


def level_arrays():
    """Level rules as flat arrays for Numba kernels: catch values, holds, doubling flags."""
    return (
        np.array([lv.catch for lv in LEVELS], dtype=np.int64),
        np.array([lv.hold for lv in LEVELS], dtype=np.int64),
        np.array([lv.doubles for lv in LEVELS], dtype=np.bool_),
    )


# ---- Model (reel strips + feature weights) -----------------------------------
@dataclass
class ReelSet:
    strips: np.ndarray  # int8 [REELS, max_len], padded
    lens: np.ndarray  # int64 [REELS]

    @classmethod
    def from_codes(cls, reels: list[list[str]]) -> "ReelSet":
        if len(reels) != REELS:
            raise ValueError(f"expected {REELS} reels, got {len(reels)}")
        max_len = max(len(r) for r in reels)
        strips = np.full((REELS, max_len), -1, dtype=np.int8)
        for r, reel in enumerate(reels):
            strips[r, : len(reel)] = [CODE_TO_ID[c] for c in reel]
        return cls(strips, np.array([len(r) for r in reels], dtype=np.int64))

    def to_codes(self) -> list[list[str]]:
        return [[CODES[v] for v in self.strips[r, : self.lens[r]]] for r in range(REELS)]


@dataclass
class Model:
    version: str
    reels: dict[str, ReelSet]  # "base" and "bonus"
    # Weights for dropping 0, 1 or 2 Net Wilds on a spin: "base" and one list per level.
    override_weights: dict[str, list[int]]
    # What Static reveals into: symbol code -> weight, for "base" and "bonus".
    reveal_weights: dict[str, dict[str, int]]
    buy_prices: dict[str, float]

    @property
    def base(self) -> ReelSet:
        return self.reels["base"]

    def override_cum(self, mode: str) -> np.ndarray:
        return np.cumsum(np.array(self.override_weights[mode], dtype=np.int64))

    def override_probs(self, mode: str) -> np.ndarray:
        w = np.array(self.override_weights[mode], dtype=np.float64)
        return w / w.sum()

    def level_override_cum(self) -> np.ndarray:
        return np.stack([self.override_cum(lv.key) for lv in LEVELS])

    def reveal_table(self, mode: str):
        """(symbol ids, cumulative weights) for Numba, and (ids, probabilities) for exact maths."""
        items = self.reveal_weights[mode]
        syms = np.array([CODE_TO_ID[c] for c in items], dtype=np.int64)
        w = np.array(list(items.values()), dtype=np.int64)
        return syms, np.cumsum(w), w / w.sum()

    def save(self, path: Path = MODEL_PATH) -> None:
        data = {
            "version": self.version,
            "buy_prices": self.buy_prices,
            "override_weights": self.override_weights,
            "reveal_weights": self.reveal_weights,
            "reels": {k: v.to_codes() for k, v in self.reels.items()},
        }
        path.write_text(json.dumps(data, indent=1), encoding="utf-8")

    @classmethod
    def load(cls, path: Path = MODEL_PATH) -> "Model":
        data = json.loads(path.read_text(encoding="utf-8"))
        return cls(
            version=data["version"],
            reels={k: ReelSet.from_codes(v) for k, v in data["reels"].items()},
            override_weights=data["override_weights"],
            reveal_weights=data["reveal_weights"],
            buy_prices=data["buy_prices"],
        )
