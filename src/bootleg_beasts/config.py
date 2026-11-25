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
CORE = 11  # Capture Core: scatter, 3/4/5 trigger the bonus tiers
STATIC = 12  # Static: non-paying tile, bonus reels only
N_PAYING = 9

CODES = ["H1", "H2", "H3", "H4", "L1", "L2", "L3", "L4", "L5", "W", "OW", "S", "X"]
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

MAX_WIN = 10_000.0
OVERRIDE_REELS = (1, 2, 3)  # 0-based, i.e. reels 2-4

# Win-size buckets used by every report (x bet). A win w falls in bucket (edge[i-1], edge[i]].
WIN_BUCKET_EDGES = np.array(
    [0.5, 1, 2, 5, 10, 20, 50, 100, 250, 500, 1000, 2500, 5000, 10000], dtype=np.float64
)


STICKY_NONE = 0  # crosses are wild for the spin they land on only
STICKY_COLUMN = 1  # the Override Wild's column stays wild for the rest of the bonus
STICKY_CROSS = 2  # the whole cross (row and column) stays wild for the rest of the bonus


@dataclass(frozen=True)
class Tier:
    key: str
    name: str
    cores: int
    free_spins: int
    sticky_mode: int
    mult_step: int
    preplaced_crosses: int
    guaranteed_cross: bool  # if no Override Wild has landed, one drops on the last free spin
    buy_price: float | None


TIERS = (
    Tier("street_hunt", "Street Hunt", 3, 10, STICKY_NONE, 0, 0, True, 100.0),
    Tier("night_raid", "Night Raid", 4, 10, STICKY_COLUMN, 1, 0, True, 300.0),
    Tier("legendary", "Legendary Capture", 5, 10, STICKY_CROSS, 2, 1, False, None),
)
REEL_SET_KEYS = ("base",) + tuple(t.key for t in TIERS)
RETRIGGER_CORES = 3
RETRIGGER_SPINS = 4

MODEL_PATH = Path(__file__).with_name("model.json")


# ---- Model (reel strips + Override Wild weights) -----------------------------
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
    # Reel set per mode: "base" plus one per bonus tier key.
    reels: dict[str, ReelSet]
    # Weights for dropping 0, 1 or 2 Override Wilds on a spin, per mode.
    override_weights: dict[str, list[int]]

    @property
    def base(self) -> ReelSet:
        return self.reels["base"]

    def override_cum(self, mode: str) -> np.ndarray:
        return np.cumsum(np.array(self.override_weights[mode], dtype=np.int64))

    def override_probs(self, mode: str) -> np.ndarray:
        w = np.array(self.override_weights[mode], dtype=np.float64)
        return w / w.sum()

    def tier_reels(self):
        """All bonus reel sets stacked for Numba: strips [tier, reel, pos], lens [tier, reel]."""
        sets = [self.reels[t.key] for t in TIERS]
        max_len = max(s.strips.shape[1] for s in sets)
        strips = np.full((len(sets), REELS, max_len), -1, dtype=np.int8)
        for i, s in enumerate(sets):
            strips[i, :, : s.strips.shape[1]] = s.strips
        return strips, np.stack([s.lens for s in sets])

    def save(self, path: Path = MODEL_PATH) -> None:
        data = {
            "version": self.version,
            "override_weights": self.override_weights,
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
        )


def tier_arrays():
    """Bonus rules as flat arrays, for passing into Numba kernels."""
    return (
        np.array([t.free_spins for t in TIERS], dtype=np.int64),
        np.array([t.sticky_mode for t in TIERS], dtype=np.int64),
        np.array([t.mult_step for t in TIERS], dtype=np.int64),
        np.array([t.preplaced_crosses for t in TIERS], dtype=np.int64),
        np.array([t.guaranteed_cross for t in TIERS], dtype=np.bool_),
    )
