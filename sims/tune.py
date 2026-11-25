"""Build the reel strips and tune the Override Wild drop rates so the game hits its RTP targets.

Order of work (each step only depends on the ones before it):
  1. Build base and bonus reel strips from the compositions below (fixed seeds, so reproducible).
  2. Base game, exact: ways RTP without Override Wilds, mean win when one drops, trigger odds.
  3. Each buyable tier: find the drop rate whose mean payout = target buy RTP x price
     (bisection on Monte Carlo with common random numbers, then a secant step on a bigger run).
     Legendary Capture uses Night Raid's drop rate.
  4. Base drop rate, exact: base RTP is linear in the drop rate, so solve
     (1 - q) * E0 + q * E1 = 96% - sum_t P(tier t) * E[tier t payout].
  5. Save the model to src/glitch_tamers/model.json.

Run:  .venv\\Scripts\\python.exe sims\\tune.py
"""

from __future__ import annotations

import time

import numpy as np

from glitch_tamers import exact, sim
from glitch_tamers.config import MODEL_PATH, REELS, TIERS, Model, ReelSet
from glitch_tamers.reelgen import build_strip

TARGET_RTP = 0.9600
TARGET_BUY_RTP = 0.9620
WEIGHT_TOTAL = 1_000_000

# Paying-symbol stacks per reel (same on every reel). Glitch Wilds and one Capture Core per reel
# are placed between stacks.
STACKS = {
    "H1": [2, 2], "H2": [3, 2], "H3": [3, 2, 1], "H4": [3, 2, 2],
    "L1": [3, 3, 2], "L2": [3, 3, 2], "L3": [3, 3, 2, 1], "L4": [3, 3, 2, 1], "L5": [3, 3, 2, 2],
}
# Street Hunt's reels add non-paying Static so a cross is worth less there and can drop more often.
STREET_STACKS = STACKS | {"X": [3, 3, 2, 2, 2]}

# (stacks, Glitch Wilds per reel, seed) for each reel set
REEL_SETS = {
    "base": (STACKS, [0, 1, 1, 1, 1], 11),
    "street_hunt": (STREET_STACKS, [0, 1, 1, 1, 1], 101),
    "night_raid": (STACKS, [0, 2, 2, 2, 2], 101),
    "legendary": (STACKS, [0, 2, 2, 2, 2], 101),
}


def build_reels(stacks: dict, wilds: list[int], seed: int) -> ReelSet:
    return ReelSet.from_codes(
        [build_strip(stacks, {"W": wilds[r], "S": 1}, seed + r) for r in range(REELS)]
    )


def weights(q: float) -> list[int]:
    w1 = int(round(q * WEIGHT_TOTAL))
    return [WEIGHT_TOTAL - w1, w1, 0]


def bonus_ev(model, tier_index, q, rounds, seed):
    return sim.run_bonus(model, tier_index, rounds, seed=seed, ow_weights=weights(q))


def tune_tier(model, tier_index, target_ev, lo=0.0, hi=0.4):
    if bonus_ev(model, tier_index, 0.0, 2_000_000, seed=777)["mean_win"] >= target_ev:
        raise SystemExit(f"{TIERS[tier_index].name}: the guaranteed cross alone beats the target")
    # Bisection with common random numbers: same seed every evaluation, so EV(q) is smooth enough.
    for _ in range(16):
        mid = 0.5 * (lo + hi)
        if bonus_ev(model, tier_index, mid, 2_000_000, seed=777)["mean_win"] < target_ev:
            lo = mid
        else:
            hi = mid
    q0 = 0.5 * (lo + hi)
    # Secant step on a larger, independent run.
    q1 = q0 * 1.03
    e0 = bonus_ev(model, tier_index, q0, 10_000_000, seed=31_337)["mean_win"]
    e1 = bonus_ev(model, tier_index, q1, 10_000_000, seed=31_337)["mean_win"]
    return q0 + (target_ev - e0) * (q1 - q0) / (e1 - e0)


def main() -> None:
    t0 = time.perf_counter()
    reels = {key: build_reels(*spec) for key, spec in REEL_SETS.items()}
    model = Model("0.1", reels, {key: weights(0.0) for key in REEL_SETS})

    ex = exact.base_game_exact(model)
    for key, rs in reels.items():
        print(f"Reel lengths {key:12s} {rs.lens.tolist()}")
    print(f"Base, exact:  RTP without Override {ex['rtp_no_override']:.4%},  "
          f"mean win with one Override {ex['mean_win_one_override']:.2f}x")
    for t, p in zip(TIERS, ex["p_trigger"]):
        print(f"  {t.name:18s} trigger 1 in {1 / p:,.0f}")

    # Buyable tiers
    for i, t in enumerate(TIERS):
        if t.buy_price is None:
            continue
        q = tune_tier(model, i, TARGET_BUY_RTP * t.buy_price)
        model.override_weights[t.key] = weights(q)
        print(f"{t.name}: Override drop chance per free spin = {q:.5f}")
    model.override_weights["legendary"] = list(model.override_weights["night_raid"])

    # Final tier EVs on fresh seeds
    evs, cis = [], []
    for i, t in enumerate(TIERS):
        r = sim.run_bonus(model, i, 20_000_000, seed=2024 + i)
        evs.append(r["mean_win"])
        cis.append(r["ci95"])
        extra = f"  buy RTP {r['buy_rtp']:.3%} +/- {r['buy_rtp_ci95']:.3%}" if t.buy_price else ""
        print(f"  {t.name:18s} mean payout {r['mean_win']:9.2f}x +/- {r['ci95']:.2f}{extra}")

    # Base drop rate (exact, linear)
    bonus_rtp = float(np.dot(ex["p_trigger"], evs))
    target_base = TARGET_RTP - bonus_rtp
    e0, e1 = ex["rtp_no_override"], ex["mean_win_one_override"]
    q_base = (target_base - e0) / (e1 - e0)
    if not 0 < q_base < 0.05:
        raise SystemExit(f"base drop rate {q_base:.5f} is out of range: change the base reels")
    model.override_weights["base"] = weights(q_base)

    ex = exact.base_game_exact(model)
    total = ex["rtp_base_ways"] + bonus_rtp
    ci = float(np.sqrt(np.sum((np.array(ex["p_trigger"]) * np.array(cis)) ** 2)))
    print(f"Base Override drop: 1 in {1 / q_base:,.0f} spins")
    print(f"RTP = base {ex['rtp_base_ways']:.4%} (exact) + bonuses {bonus_rtp:.4%} "
          f"= {total:.4%} +/- {ci:.4%}")

    model.save(MODEL_PATH)
    print(f"Saved {MODEL_PATH}  ({time.perf_counter() - t0:.0f}s)")


if __name__ == "__main__":
    main()
