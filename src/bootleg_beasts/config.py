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
WILD = 9  # Glitch Wild: substitutes for every paying symbol
OVERRIDE = 10  # Override Wild: dropped onto reels 2-4 by the feature, turns its row and column wild
CORE = 11  # Capture Core: scatter, 3/4/5 trigger the bonus at level 1/2/3
STATIC = 12  # Static: mystery symbol, every Static on screen reveals the same random symbol
REACTOR = 13  # Reactor: bonus only, collect 3 to level up
N_PAYING = 9

CODES = ["H1", "H2", "H3", "H4", "L1", "L2", "L3", "L4", "L5", "W", "OW", "S", "X", "R"]
NAMES = [
    "Sparkjaw",
    "Blazegob",
    "Tidewyrm",
    "Thornbyte",
    "Heel Spray",
    "Candee",
    "Glitch Berry",
    "Champeen Medal",
    "Burned Disc",
    "Glitch Wild",
    "Override Wild",
    "Capture Core",
    "Static",
    "Reactor",
]
CODE_TO_ID = {code: i for i, code in enumerate(CODES)}

# ---- Paytable: pay per way (x total bet), indexed [symbol, run length] -------
_PAYS = {
    H1: (0.20, 0.50, 1.50),
    H2: (0.15, 0.40, 1.00),
    H3: (0.10, 0.30, 0.75),
    H4: (0.10, 0.25, 0.50),
    L1: (0.05, 0.10, 0.25),
    L2: (0.05, 0.10, 0.25),
    L3: (0.04, 0.10, 0.20),
    L4: (0.04, 0.10, 0.20),
    L5: (0.04, 0.10, 0.20),
}
PAYTABLE = np.zeros((N_PAYING, REELS + 1), dtype=np.float64)
for _sym, _pays in _PAYS.items():
    PAYTABLE[_sym, 3:] = _pays

MAX_WIN = 5_000.0
OVERRIDE_REELS = (1, 2, 3)  # 0-based, i.e. reels 2-4

# Win-size buckets used by every report (x bet). A win w falls in bucket (edge[i-1], edge[i]].
WIN_BUCKET_EDGES = np.array(
    [0.5, 1, 2, 5, 10, 20, 50, 100, 250, 500, 1000, 2500, 5000], dtype=np.float64
)


# ---- Bonus: one bonus with four levels ----------------------------------------
@dataclass(frozen=True)
class Level:
    key: str
    name: str
    mult: int  # every win in this level is multiplied by this
    override_shape: int  # what an Override Wild turns wild: 1 = its column, 2 = its row and column
    sticky_wilds: bool  # Glitch Wilds that land stay wild for the rest of the bonus
    sticky_crosses: bool  # Override Wild columns/crosses stay wild for the rest of the bonus
    override_factor: float  # Override drop chance relative to level 1


SHAPE_COLUMN = 1
SHAPE_CROSS = 2

LEVELS = (
    Level("street_hunt", "Street Hunt", 1, SHAPE_COLUMN, False, False, 1.0),
    Level("night_raid", "Night Raid", 1, SHAPE_COLUMN, False, False, 1.0),
    Level("lockdown", "Lockdown", 1, SHAPE_COLUMN, False, True, 1.0),
    Level("overload", "Overload", 1, SHAPE_CROSS, True, True, 1.0),
)

# Beast capture (bonus only): each beast (H1-H4) under a freshly dropped Override Wild's column or
# cross is captured and adds a random amount to that spin's multiplier (which starts at x1).
# Per level: (values, weights).
CAPTURE = (
    ((1, 2, 0), (4, 1, 0)),
    ((1, 2, 0), (3, 1, 0)),
    ((1, 2, 3), (4, 2, 1)),
    ((1, 2, 3), (3, 2, 1)),
)
# Guaranteed minimum bonus win (x bet) by starting level.
MIN_BONUS_WIN = (20.0, 50.0, 120.0, 250.0)
FREE_SPINS = 10
REACTORS_PER_LEVEL = 3  # collect this many Reactors to reach the next level
LEVEL_UP_SPINS = 4  # extra free spins awarded on each level-up
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

MODEL_PATH = Path(__file__).with_name("model.json")


def capture_arrays():
    """Capture values [level, i] and cumulative weights [level, i] for Numba."""
    vals = np.array([v for v, _ in CAPTURE], dtype=np.int64)
    cum = np.cumsum(np.array([w for _, w in CAPTURE], dtype=np.int64), axis=1)
    return vals, cum


def level_arrays():
    """Level rules as flat arrays for Numba kernels."""
    return (
        np.array([lv.mult for lv in LEVELS], dtype=np.int64),
        np.array([lv.override_shape for lv in LEVELS], dtype=np.int64),
        np.array([lv.sticky_wilds for lv in LEVELS], dtype=np.bool_),
        np.array([lv.sticky_crosses for lv in LEVELS], dtype=np.bool_),
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
    # Weights for dropping 0, 1 or 2 Override Wilds on a spin: "base" and one list per level.
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
