"""Verify the tuned model three ways and save the results for the charts and the par sheet.

  1. Exact: base-game RTP and trigger odds (factorised formula), cross-checked by brute-force
     enumeration of every base-reel stop combination.
  2. Bonus buys: Monte Carlo of each tier on its own, with 95% confidence intervals and payout profiles.
  3. Full game: Monte Carlo of complete rounds (base spin + any bonus), checked against 1 + 2.

Run:  .venv\\Scripts\\python.exe sims\\verify.py [--spins 1e9]
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import numpy as np

from bootleg_beasts import exact, sim
from bootleg_beasts.config import MAX_WIN, TIERS, WIN_BUCKET_EDGES, Model

REPORTS = Path(__file__).resolve().parent.parent / "reports"


def bucket_labels() -> list[str]:
    e = [0.0] + WIN_BUCKET_EDGES.tolist()
    return ["0"] + [f"{lo:g}-{hi:g}" for lo, hi in zip(e[:-1], e[1:])]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--spins", type=float, default=1e9)
    ap.add_argument("--bonus-rounds", type=float, default=2e7)
    ap.add_argument("--seed", type=int, default=20_261_124)
    args = ap.parse_args()
    REPORTS.mkdir(exist_ok=True)
    model = Model.load()
    out: dict = {"model_version": model.version, "max_win": MAX_WIN}

    # 1. Exact base game
    t = time.perf_counter()
    ex = exact.base_game_exact(model)
    enum = exact.enumerate_base(model)
    q = ex["override_probs"][1]
    out["exact"] = {
        **ex,
        "full_cycle_combinations": enum["combinations"],
        "full_cycle_rtp_no_override": enum["rtp"],
        "hit_rate_no_override": enum["hit_rate"],
        # Every Override Wild spin wins (a cross alone gives every symbol 5 ways of 5).
        "hit_rate_base": (1 - q) * enum["hit_rate"] + q,
    }
    print(f"[exact] base ways RTP {ex['rtp_base_ways']:.4%}; formula vs full cycle "
          f"({enum['combinations']:.3g} combos): {ex['rtp_no_override']:.10f} vs {enum['rtp']:.10f}"
          f"  ({time.perf_counter() - t:.1f}s)")

    # 2. Bonus tiers on their own
    out["bonus"] = {}
    evs, cis = [], []
    for i, tier in enumerate(TIERS):
        t = time.perf_counter()
        r = sim.run_bonus(model, i, int(args.bonus_rounds), seed=args.seed + 1000 * (i + 1))
        wins, drops = sim.sample_bonus(model, i, 2_000_000, seed=args.seed + 7 + i)
        price = tier.buy_price or 1.0
        r["profile"] = sim.payout_profile(wins, price) if tier.buy_price else {
            "median_x": float(np.median(wins))
        }
        r["percentiles_x"] = {str(p): float(np.percentile(wins, p)) for p in (10, 25, 50, 75, 90, 99)}
        r["avg_overrides_sample"] = float(drops.mean())
        r["histogram"] = r["histogram"].tolist()
        r["histogram_win"] = r["histogram_win"].tolist()
        out["bonus"][tier.key] = r
        evs.append(r["mean_win"])
        cis.append(r["ci95"])
        buy = f" buy RTP {r['buy_rtp']:.3%} +/- {r['buy_rtp_ci95']:.3%}" if tier.buy_price else ""
        print(f"[bonus] {tier.name:18s} mean {r['mean_win']:8.2f}x +/- {r['ci95']:.2f}{buy}  "
              f"median {r['profile']['median_x']:.1f}x  ({time.perf_counter() - t:.0f}s)")

    p_trig = np.array(ex["p_trigger"])
    rtp_split = ex["rtp_base_ways"] + float(p_trig @ np.array(evs))
    ci_split = float(np.sqrt(np.sum((p_trig * np.array(cis)) ** 2)))
    out["rtp_from_parts"] = {"rtp": rtp_split, "ci95": ci_split,
                             "bonus_parts": (p_trig * np.array(evs)).tolist()}
    print(f"[parts] RTP = {rtp_split:.4%} +/- {ci_split:.4%}")

    # 3. Full game
    t = time.perf_counter()
    g = sim.run_game(model, int(args.spins), seed=args.seed, chunk_size=1_000_000)
    elapsed = time.perf_counter() - t
    cum_n = np.arange(1, len(g["chunk_totals"]) + 1) * g["chunk_size"]
    cum_mean = np.cumsum(g["chunk_totals"]) / cum_n
    cum_var = np.cumsum(g["chunk_sq"]) / cum_n - cum_mean**2
    cum_ci = sim.Z95 * np.sqrt(cum_var / cum_n)
    np.savetxt(REPORTS / "convergence.csv", np.column_stack([cum_n, cum_mean, cum_ci]),
               delimiter=",", header="spins,rtp,ci95", comments="", fmt=["%d", "%.8f", "%.8f"])
    hist = g.pop("histogram")
    hist_win = g.pop("histogram_win")
    g.pop("chunk_totals")
    g.pop("chunk_sq")
    g["histogram"] = {"labels": bucket_labels(), "counts": hist.tolist(),
                      "rtp_share": (hist_win / hist_win.sum()).tolist()}
    g["seconds"] = elapsed
    out["game"] = g
    z = (g["rtp"] - rtp_split) / np.hypot(g["ci95"] / sim.Z95, ci_split / sim.Z95)
    out["game_vs_parts_z"] = float(z)
    print(f"[game]  {g['spins']:.3g} spins in {elapsed:.0f}s: RTP {g['rtp']:.4%} +/- {g['ci95']:.4%}"
          f"  (vs parts: z = {z:+.2f})")
    print(f"        hit rate {g['hit_rate']:.2%}, sd per spin {g['std']:.2f}x, "
          f"max win 1 in {1 / g['p_max_win']:,.0f}" if g["p_max_win"] else "        no max wins hit")

    (REPORTS / "results.json").write_text(json.dumps(out, indent=1, default=float), encoding="utf-8")
    print(f"Saved {REPORTS / 'results.json'} and convergence.csv")


if __name__ == "__main__":
    main()
