"""Export the tuned model for the browser demo, plus test vectors that check the JS engine.

  web/game-data.json     rules, paytable, reel strips, Override Wild weights, verified stats
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
    CODES,
    MAX_WIN,
    N_PAYING,
    NAMES,
    OVERRIDE_REELS,
    PAYTABLE,
    REELS,
    RETRIGGER_CORES,
    RETRIGGER_SPINS,
    ROWS,
    TIERS,
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
        "baseRtp": r["exact"]["rtp_base_ways"],
        "bonusMean": {t.key: r["bonus"][t.key]["mean_win"] for t in TIERS},
        "bonusStd": {t.key: r["bonus"][t.key]["std"] for t in TIERS},
        "rtpCi95": r["rtp_from_parts"]["ci95"],
        "simSpins": r["game"]["spins"],
        "simRtp": r["game"]["rtp"],
        "hitRate": r["game"]["hit_rate"],
        "maxWinOdds": 1 / r["game"]["p_max_win"],
        "triggerOdds": [1 / p for p in r["exact"]["p_trigger"]],
        "buyRtp": {t.key: r["bonus"][t.key].get("buy_rtp") for t in TIERS},
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
        "retrigger": {"cores": RETRIGGER_CORES, "spins": RETRIGGER_SPINS},
        "tiers": [
            {
                "key": t.key, "name": t.name, "cores": t.cores, "freeSpins": t.free_spins,
                "stickyMode": t.sticky_mode, "multStep": t.mult_step,
                "preplaced": t.preplaced_crosses, "guaranteed": t.guaranteed_cross,
                "buyPrice": t.buy_price,
            }
            for t in TIERS
        ],
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
