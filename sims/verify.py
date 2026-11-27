"""Verify the tuned model three ways and save the results for the charts and the par sheet.

  1. Exact: base-game RTP and trigger odds (factorised formula, averaged over Static reveals),
     cross-checked by brute-force enumeration of every base-reel stop combination.
  2. Bonus: Monte Carlo from each starting level, with 95% confidence intervals, level-reach rates
     and buy payout profiles.
  3. Full game: Monte Carlo of complete rounds, checked against 1 + 2. Plus player sessions.

Run:  .venv\\Scripts\\python.exe sims\\verify.py [--spins 1e9]
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import numpy as np

from bootleg_beasts import exact, sim
import copy

from bootleg_beasts.config import (ANTE_KEY, ANTE_NAME, ANTE_PRICE, BUYS, FEATURE_KEY, FEATURE_NAME, LEVELS,
                                  MAX_WIN, WIN_BUCKET_EDGES, Model)

REPORTS = Path(__file__).resolve().parent.parent / "reports"


def bucket_labels() -> list[str]:
    e = [0.0] + WIN_BUCKET_EDGES.tolist()
    return ["0"] + [f"{lo:g}-{hi:g}" for lo, hi in zip(e[:-1], e[1:])]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--spins", type=float, default=1e9)
    ap.add_argument("--bonus-rounds", type=float, default=2e7)
    ap.add_argument("--seed", type=int, default=20_261_125)
    args = ap.parse_args()
    REPORTS.mkdir(exist_ok=True)
    model = Model.load()
    out: dict = {"model_version": model.version, "max_win": MAX_WIN, "buy_prices": model.buy_prices}

    # 1. Exact base game
    t = time.perf_counter()
    ex = exact.base_game_exact(model)
    # brute-force check of one reveal outcome (the most common one)
    rv_syms, _, rv_p = model.reveal_table("base")
    m = int(rv_syms[int(np.argmax(rv_p))])
    enum = exact.enumerate_base(model, reveal=m)
    q = ex["override_probs"][1]
    out["exact"] = {**ex, "check_reveal": m, "check_formula": ex["rtp_no_override_by_reveal"][m],
                    "check_full_cycle": enum["rtp"], "full_cycle_combinations": enum["combinations"]}
    out["exact"]["rtp_no_override_by_reveal"] = {str(k): v for k, v in ex["rtp_no_override_by_reveal"].items()}
    print(f"[exact] base RTP {ex['rtp_base_ways']:.4%}; formula vs full cycle for reveal {m} "
          f"({enum['combinations']:.3g} combos): {ex['rtp_no_override_by_reveal'][m]:.10f} vs {enum['rtp']:.10f}"
          f"  ({time.perf_counter() - t:.1f}s)")

    # 2. Bonus from each starting level
    out["bonus"] = {}
    evs, cis = [], []
    for lvl in range(3):
        t = time.perf_counter()
        r = sim.run_bonus(model, lvl, int(args.bonus_rounds), seed=args.seed + 1000 * (lvl + 1))
        wins, finals = sim.sample_bonus(model, lvl, 2_000_000, seed=args.seed + 7 + lvl)
        r["percentiles_x"] = {str(p): float(np.percentile(wins, p)) for p in (10, 25, 50, 75, 90, 99)}
        r["histogram"] = r["histogram"].tolist()
        r["histogram_win"] = r["histogram_win"].tolist()
        # payout sample (log-spaced bins) for the distribution chart
        bins = np.concatenate([[0], np.geomspace(1, MAX_WIN, 40)])
        r["payout_hist"] = {"bins": bins.tolist(), "counts": np.histogram(wins, bins=bins)[0].tolist()}
        out["bonus"][LEVELS[lvl].key] = r
        evs.append(r["mean_win"])
        cis.append(r["ci95"])
        print(f"[bonus] start {LEVELS[lvl].name:12s} mean {r['mean_win']:8.2f}x +/- {r['ci95']:.2f}  "
              f"reach {np.round(r['final_level_share'], 3).tolist()}  ({time.perf_counter() - t:.0f}s)")
    out["buys"] = {}
    for i, b in enumerate(BUYS):
        r = out["bonus"][LEVELS[b.start_level].key]
        price = model.buy_prices[b.key]
        wins, _ = sim.sample_bonus(model, b.start_level, 2_000_000, seed=args.seed + 99 + i)
        out["buys"][b.key] = {"name": b.name, "price": price, "start_level": b.start_level,
                              "rtp": r["mean_win"] / price, "rtp_ci95": r["ci95"] / price,
                              "profile": sim.payout_profile(wins, price)}
        print(f"[buy]   {b.name:12s} {price:.0f}x  RTP {r['mean_win'] / price:.3%} +/- {r['ci95'] / price:.3%}")

    p_trig = np.array(ex["p_trigger"])
    rtp_split = ex["rtp_base_ways"] + float(p_trig @ np.array(evs))
    ci_split = float(np.sqrt(np.sum((p_trig * np.array(cis)) ** 2)))
    out["rtp_from_parts"] = {"rtp": rtp_split, "ci95": ci_split, "bonus_parts": (p_trig * np.array(evs)).tolist()}
    print(f"[parts] RTP = {rtp_split:.4%} +/- {ci_split:.4%}")

    # 3. Full game
    t = time.perf_counter()
    g = sim.run_game(model, int(args.spins), seed=args.seed, chunk_size=1_000_000)
    cum_n = np.arange(1, len(g["chunk_totals"]) + 1) * g["chunk_size"]
    cum_mean = np.cumsum(g["chunk_totals"]) / cum_n
    cum_var = np.cumsum(g["chunk_sq"]) / cum_n - cum_mean**2
    np.savetxt(REPORTS / "convergence.csv", np.column_stack([cum_n, cum_mean, sim.Z95 * np.sqrt(cum_var / cum_n)]),
               delimiter=",", header="spins,rtp,ci95", comments="", fmt=["%d", "%.8f", "%.8f"])
    hist, hist_win = g.pop("histogram"), g.pop("histogram_win")
    g.pop("chunk_totals")
    g.pop("chunk_sq")
    g["histogram"] = {"labels": bucket_labels(), "counts": hist.tolist(),
                      "rtp_share": (hist_win / hist_win.sum()).tolist()}
    g["seconds"] = time.perf_counter() - t
    out["game"] = g
    z = (g["rtp"] - rtp_split) / np.hypot(g["ci95"] / sim.Z95, ci_split / sim.Z95)
    out["game_vs_parts_z"] = float(z)
    print(f"[game]  {g['spins']:.3g} spins in {g['seconds']:.0f}s: RTP {g['rtp']:.4%} +/- {g['ci95']:.4%} "
          f"(z = {z:+.2f}); hit {g['hit_rate']:.2%}, sd {g['std']:.2f}x, max win 1 in "
          f"{1 / max(g['p_max_win'], 1e-12):,.0f}")

    # Player sessions: 10,000 players x 500 spins at bet 1
    net, paths = sim.run_sessions(model)
    np.save(REPORTS / "session_paths.npy", paths)
    out["sessions"] = {"players": int(net.size), "spins": int(paths.shape[1]), "p_ahead": float(np.mean(net > 0)),
                       "median_net": float(np.median(net)), "mean_net": float(np.mean(net)),
                       "net_percentiles": {str(p): float(np.percentile(net, p)) for p in (5, 25, 50, 75, 95)},
                       "net_hist": np.histogram(net, bins=60)[0].tolist(),
                       "net_hist_edges": np.histogram(net, bins=60)[1].tolist()}
    print(f"[sessions] {net.size:,} players x {paths.shape[1]} spins: {np.mean(net > 0):.1%} finish ahead, "
          f"median {np.median(net):+.0f}")

    # 4. Bonus Hunt (ante) and Override Spin: exact parts vs an independent full-game simulation
    def mode_check(name, price, ev_parts, ci_parts, g):
        rtp_sim, ci_sim = g["rtp"] / price, g["ci95"] / price
        zz = (rtp_sim - ev_parts / price) / np.hypot(ci_sim / sim.Z95, ci_parts / price / sim.Z95)
        print(f"[mode]  {name:14s} {price:g}x: RTP {ev_parts / price:.4%} (parts) vs {rtp_sim:.4%} +/- {ci_sim:.4%} "
              f"over {g['spins']:.3g} spins (z = {zz:+.2f}); sd {g['std'] / price:.2f}x stake")
        return {"name": name, "price": price, "rtp": ev_parts / price, "rtp_ci95": ci_parts / price,
                "rtp_sim": rtp_sim, "rtp_sim_ci95": ci_sim, "z": float(zz), "spins": g["spins"],
                "sd_per_stake": g["std"] / price, "hit_rate": g["hit_rate"]}

    exh = exact.base_game_exact(model, reel_key=ANTE_KEY)
    ph = np.array(exh["p_trigger"])
    gh = sim.run_game(model, int(args.spins) // 4, seed=args.seed + 5, chunk_size=1_000_000, reel_key=ANTE_KEY)
    out["ante"] = mode_check(ANTE_NAME, ANTE_PRICE, exh["rtp_base_ways"] + float(ph @ np.array(evs)),
                             float(np.sqrt(np.sum((ph * np.array(cis)) ** 2))), gh)
    out["ante"] |= {"key": ANTE_KEY, "p_trigger": exh["p_trigger"], "override_prob": exh["override_probs"][1]}
    forced = copy.deepcopy(model)
    forced.override_weights["base"] = [0, 1, 0]
    gf = sim.run_game(forced, int(args.spins) // 40, seed=args.seed + 6, chunk_size=200_000)
    price_f = model.buy_prices[FEATURE_KEY]
    out["feature_spin"] = mode_check(FEATURE_NAME, price_f, ex["mean_win_one_override"] + float(p_trig @ np.array(evs)),
                                     ci_split, gf) | {"key": FEATURE_KEY}

    (REPORTS / "results.json").write_text(json.dumps(out, indent=1, default=float), encoding="utf-8")
    print(f"Saved {REPORTS / 'results.json'}")


if __name__ == "__main__":
    main()
