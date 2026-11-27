"""Export the tuned model for the browser demo, plus test vectors that check the JS engine.

  web/game-data.json     rules, paytable, reel strips, Net Wild weights, verified stats
  web/test-vectors.json  random grids + wild masks with the Python engine's ways win, so the JS
                         engine can be checked to give exactly the same answer

Run after tune.py / verify.py:  .venv\\Scripts\\python.exe sims\\export_web.py
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from bootleg_beasts import engine
from bootleg_beasts.config import (
    ANTE_KEY,
    ANTE_NAME,
    ANTE_PRICE,
    BASE_WILD_MULTS,
    FEATURE_KEY,
    FEATURE_NAME,
    BUYS,
    CODES,
    FREE_SPINS,
    HOLD_FOREVER,
    LEVEL_UP_SPINS,
    LEVELS,
    MAX_WIN,
    MIN_BONUS_WIN,
    N_PAYING,
    NAMES,
    OVERRIDE_REELS,
    PAYTABLE,
    REACTORS_PER_LEVEL,
    REELS,
    ROWS,
    START_LEVEL,
    Model,
)

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"


def stats() -> dict:
    path = ROOT / "reports" / "results.json"
    if not path.exists():
        return {}
    r = json.loads(path.read_text(encoding="utf-8"))
    return {
        "rtp": r["rtp_from_parts"]["rtp"],
        "rtpCi95": r["rtp_from_parts"]["ci95"],
        "baseRtp": r["exact"]["rtp_base_ways"],
        "overrideSpinWays": r["exact"]["mean_win_one_override"],
        "simSpins": r["game"]["spins"],
        "hitRate": r["game"]["hit_rate"],
        "std": r["game"]["std"],
        "maxWinOdds": 1 / max(r["game"]["p_max_win"], 1e-12),
        "triggerOdds": [1 / p for p in r["exact"]["p_trigger"]],
        "bonusMean": [r["bonus"][lv.key]["mean_win"] for lv in LEVELS[:3]],
        "levelReach": [r["bonus"][lv.key]["final_level_share"] for lv in LEVELS[:3]],
        "bonusNets": [r["bonus"][lv.key]["avg_overrides"] for lv in LEVELS[:3]],
        "bonusMult": [r["bonus"][lv.key].get("avg_final_mult") for lv in LEVELS[:3]],
        "buyRtp": {k: v["rtp"] for k, v in r["buys"].items()},
        "buyProfile": {k: v["profile"] for k, v in r["buys"].items()},
        "ante": r.get("ante", {}),
        "featureSpin": r.get("feature_spin", {}),
        "sessionsAhead": r["sessions"]["p_ahead"],
    }


def test_vectors(model: Model, n: int = 1500, seed: int = 4) -> list[dict]:
    rng = np.random.default_rng(seed)
    cnt = np.zeros((REELS, N_PAYING + 1), np.int64)
    out = []
    keys = list(model.reels)
    for _ in range(n):
        rs = model.reels[keys[rng.integers(len(keys))]]
        grid = np.empty((REELS, ROWS), np.int8)
        for r in range(REELS):
            stop = rng.integers(rs.lens[r])
            for k in range(ROWS):
                grid[r, k] = rs.strips[r, (stop + k) % rs.lens[r]]
        mask = np.zeros((REELS, ROWS), np.bool_)
        for _ in range(rng.choice([0, 0, 1, 1, 2, 3])):
            engine.add_cross(mask, rng.choice(OVERRIDE_REELS), rng.integers(ROWS))
        if rng.random() < 0.2:
            mask[rng.choice(OVERRIDE_REELS), :] = True
        out.append({
            "grid": grid.tolist(),
            "mask": mask.astype(int).tolist(),
            "win": engine.ways_win(grid, mask, PAYTABLE, cnt),
        })
    return out


def main() -> None:
    model = Model.load()
    WEB.mkdir(exist_ok=True)
    data = {
        "version": model.version,
        "reels": REELS,
        "rows": ROWS,
        "symbols": [{"code": c, "name": n} for c, n in zip(CODES, NAMES)],
        "paytable": {CODES[s]: PAYTABLE[s, 3:].tolist() for s in range(N_PAYING)},
        "maxWin": MAX_WIN,
        "overrideReels": list(OVERRIDE_REELS),
        "freeSpins": FREE_SPINS,
        "reactorsPerLevel": REACTORS_PER_LEVEL,
        "levelUpSpins": LEVEL_UP_SPINS,
        "startLevel": {str(k): v for k, v in START_LEVEL.items()},
        "minBonusWin": list(MIN_BONUS_WIN),
        "holdForever": HOLD_FOREVER,
        "levels": [
            {"key": lv.key, "name": lv.name, "catch": lv.catch, "hold": lv.hold, "doubles": lv.doubles,
             "netChance": model.override_probs(lv.key)[1:].sum().item()}
            for lv in LEVELS
        ],
        "buys": [{"key": b.key, "name": b.name, "startLevel": b.start_level, "price": model.buy_prices[b.key]}
                 for b in BUYS],
        "ante": {"key": ANTE_KEY, "name": ANTE_NAME, "price": ANTE_PRICE, "reelSet": ANTE_KEY},
        "featureSpin": {"key": FEATURE_KEY, "name": FEATURE_NAME, "price": model.buy_prices[FEATURE_KEY]},
        "wildMults": {"values": list(BASE_WILD_MULTS[0]), "weights": list(BASE_WILD_MULTS[1])},
        "revealWeights": model.reveal_weights,
        "reelSets": {k: rs.strips[:, : int(rs.lens.max())].tolist() for k, rs in model.reels.items()},
        "reelLengths": {k: rs.lens.tolist() for k, rs in model.reels.items()},
        "overrideWeights": model.override_weights,
        "stats": stats(),
    }
    (WEB / "game-data.json").write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
    (WEB / "test-vectors.json").write_text(
        json.dumps(test_vectors(model), separators=(",", ":")), encoding="utf-8"
    )
    print(f"Wrote {WEB / 'game-data.json'} and test-vectors.json")


if __name__ == "__main__":
    main()
