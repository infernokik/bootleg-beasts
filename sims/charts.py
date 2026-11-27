"""Charts and par sheet from reports/results.json (run sims/verify.py first).

Writes reports/*.png and docs/par_sheet.md.
Run:  .venv\\Scripts\\python.exe sims\\charts.py
"""

from __future__ import annotations

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

from bootleg_beasts.config import HOLD_FOREVER, LEVELS, MAX_WIN, NAMES, PAYTABLE  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
REPORTS = ROOT / "reports"
INK, MUTED, GRID, ACCENT, ACCENT2 = "#1f1d2b", "#6b6880", "#e6e4ee", "#5b3fd6", "#c2185b"

plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 10, "axes.edgecolor": GRID, "axes.labelcolor": INK,
    "xtick.color": MUTED, "ytick.color": MUTED, "axes.grid": True, "grid.color": GRID, "grid.linewidth": 0.8,
    "axes.spines.top": False, "axes.spines.right": False, "axes.titleweight": "bold", "axes.titlesize": 12,
    "axes.titlelocation": "left", "figure.dpi": 130, "savefig.bbox": "tight",
})


def pct(x, d=2):
    return f"{100 * x:.{d}f}%"


def convergence(r):
    a = np.loadtxt(REPORTS / "convergence.csv", delimiter=",", skiprows=1)
    n, rtp, ci = a[:, 0], a[:, 1], a[:, 2]
    fig, ax = plt.subplots(figsize=(8, 4))
    ax.fill_between(n, rtp - ci, rtp + ci, color=ACCENT, alpha=0.18, linewidth=0, label="95% confidence band")
    ax.plot(n, rtp, color=ACCENT, linewidth=2, label="Simulated RTP")
    ax.axhline(r["rtp_from_parts"]["rtp"], color=INK, linewidth=1, linestyle="--",
               label=f"Exact base + bonus parts ({pct(r['rtp_from_parts']['rtp'])})")
    ax.set_xscale("log")
    ax.set_ylim(0.90, 1.02)
    ax.yaxis.set_major_formatter(matplotlib.ticker.PercentFormatter(1.0, decimals=0))
    ax.set_xlabel("Spins simulated")
    ax.set_ylabel("RTP")
    ax.set_title("RTP converges on 96% as spins add up")
    ax.legend(frameon=False, loc="upper right")
    fig.savefig(REPORTS / "rtp_convergence.png")
    plt.close(fig)


def rtp_split(r):
    ex = r["exact"]
    q = ex["override_probs"][1]
    parts = [
        ("Base: normal wins", (1 - q) * ex["rtp_no_override"]),
        ("Base: Net Wild spins", q * ex["mean_win_one_override"]),
    ] + [(f"Bonus from level {i + 1} ({LEVELS[i].name})", v) for i, v in enumerate(r["rtp_from_parts"]["bonus_parts"])]
    fig, ax = plt.subplots(figsize=(8, 3.2))
    labels, vals = zip(*parts)
    y = np.arange(len(parts))[::-1]
    ax.barh(y, vals, color=ACCENT, height=0.6)
    for yi, v in zip(y, vals):
        ax.text(v + 0.005, yi, pct(v), va="center", color=INK)
    ax.set_yticks(y, labels)
    ax.xaxis.set_major_formatter(matplotlib.ticker.PercentFormatter(1.0, decimals=0))
    ax.set_xlim(0, max(vals) * 1.2)
    ax.grid(axis="y", visible=False)
    ax.set_title(f"Where the {pct(r['rtp_from_parts']['rtp'])} RTP comes from")
    fig.savefig(REPORTS / "rtp_split.png")
    plt.close(fig)


def win_distribution(r):
    h = r["game"]["histogram"]
    counts = np.array(h["counts"], dtype=float)
    share = counts / counts.sum()
    labels = ["no win"] + [f"{lab}×" for lab in h["labels"][1:]]
    fig, ax = plt.subplots(figsize=(9, 3.8))
    ax.bar(range(len(share)), share, color=ACCENT, width=0.7)
    ax.set_yscale("log")
    ax.set_xticks(range(len(share)), labels, rotation=40, ha="right")
    ax.set_ylabel("Share of spins (log scale)")
    ax.set_title("Win sizes per round: most spins win small, big wins are rare")
    ax.grid(axis="x", visible=False)
    fig.savefig(REPORTS / "win_distribution.png")
    plt.close(fig)


def bonus_levels(r):
    b = r["bonus"][LEVELS[0].key]
    fig, axes = plt.subplots(1, 2, figsize=(9, 3.4))
    names = [lv.name for lv in LEVELS]
    axes[0].bar(names, b["final_level_share"], color=ACCENT, width=0.6)
    for i, v in enumerate(b["final_level_share"]):
        axes[0].text(i, v + 0.01, pct(v, 1), ha="center", color=INK)
    axes[0].yaxis.set_major_formatter(matplotlib.ticker.PercentFormatter(1.0, decimals=0))
    axes[0].set_title("How far a bonus gets")
    axes[0].grid(axis="x", visible=False)
    axes[1].bar(names, b["mean_win_by_final_level"], color=ACCENT2, width=0.6)
    for i, v in enumerate(b["mean_win_by_final_level"]):
        axes[1].text(i, v * 1.02, f"{v:,.0f}×", ha="center", color=INK)
    axes[1].set_title("Average bonus win by final level")
    axes[1].grid(axis="x", visible=False)
    for ax in axes:
        ax.tick_params(axis="x", labelsize=9)
    fig.suptitle("Bonus bought or triggered at level 1", x=0.01, ha="left", color=MUTED, fontsize=10)
    fig.savefig(REPORTS / "bonus_levels.png")
    plt.close(fig)


def sessions(r):
    paths = np.load(REPORTS / "session_paths.npy")
    s = r["sessions"]
    fig, axes = plt.subplots(1, 2, figsize=(10, 3.8), gridspec_kw={"width_ratios": [1.6, 1]})
    for p in paths:
        axes[0].plot(p, color=MUTED, alpha=0.25, linewidth=1)
    axes[0].plot(np.median(paths, axis=0), color=ACCENT, linewidth=2, label="Median of these players")
    axes[0].axhline(0, color=INK, linewidth=1)
    axes[0].set_xlabel("Spin")
    axes[0].set_ylabel("Net result (bets)")
    axes[0].set_title(f"{len(paths)} sample players, {s['spins']} spins each")
    axes[0].legend(frameon=False, loc="upper left")
    edges = np.array(s["net_hist_edges"])
    axes[1].bar(edges[:-1], s["net_hist"], width=np.diff(edges), align="edge", color=ACCENT, linewidth=0)
    axes[1].axvline(0, color=INK, linewidth=1)
    axes[1].set_xlabel("Net result after 500 spins (bets)")
    axes[1].set_title(f"{s['players']:,} players: {pct(s['p_ahead'], 1)} finish ahead")
    axes[1].set_yscale("log")
    fig.savefig(REPORTS / "sessions.png")
    plt.close(fig)


def level_row(r, i, lv):
    hold = "rest of bonus" if lv.hold >= HOLD_FOREVER else (f"{lv.hold} more spin{'s' if lv.hold > 1 else ''}" if lv.hold else "that spin")
    rule = f"| {lv.name} | +{lv.catch}× | {hold}{' (×2 on arrival)' if lv.doubles else ''} | {pct(r['net_chance'][i], 1)} | "
    b = r["bonus"].get(lv.key)
    if not b:
        return rule + "earned only | | | |"
    return rule + (f"{b['avg_overrides']:.1f} | {b['avg_catches']:.1f} | ×{b['avg_final_mult']:.1f} | "
                   f"1 in {1 / max(b['p_max_win'], 1e-12):,.0f} |")


def par_sheet(r):
    ex, g, parts, buys = r["exact"], r["game"], r["rtp_from_parts"], r["buys"]
    b0 = r["bonus"][LEVELS[0].key]
    pay_rows = "\n".join(f"| {NAMES[s]} | {PAYTABLE[s, 3]:.2f} | {PAYTABLE[s, 4]:.2f} | {PAYTABLE[s, 5]:.2f} |" for s in range(9))
    buy_rows = "\n".join(
        f"| {v['name']} | {v['price']:.0f}× | level {v['start_level'] + 1} | {pct(v['rtp'])} ± {pct(v['rtp_ci95'])} | "
        f"{v['profile']['median_x']:.0f}× | {pct(v['profile']['p_at_least_price'], 1)} |" for v in buys.values())
    md = f"""# Bootleg Beasts — Par Sheet

Generated by `sims/charts.py` from `reports/results.json`. Bet = 1; all values × bet.

## Summary

| Item | Value |
|---|---|
| Grid / pays | 5 × 5, 3,125 ways, left to right |
| **RTP (base mode)** | **{pct(parts['rtp'])} ± {pct(parts['ci95'])}** (exact base game + simulated bonus) |
| RTP, full-game simulation | {pct(g['rtp'])} ± {pct(g['ci95'])} over {g['spins']:,} spins (z = {r['game_vs_parts_z']:+.2f}) |
| Hit frequency | {pct(g['hit_rate'], 1)} |
| Volatility (SD per spin) | {g['std']:.1f}× |
| Max win | {MAX_WIN:,.0f}× · 1 in {1 / max(g['p_max_win'], 1e-12):,.0f} spins |
| Bonus frequency (3 / 4 / 5 Cores) | 1 in {1 / ex['p_trigger'][0]:,.0f} / 1 in {1 / ex['p_trigger'][1]:,.0f} / 1 in {1 / ex['p_trigger'][2]:,.0f} |
| Base game RTP (exact) | {pct(ex['rtp_base_ways'])} |
| Net Wild in base | 1 in {1 / ex['override_probs'][1]:,.0f} spins |
| Players ahead after 500 spins | {pct(r['sessions']['p_ahead'], 1)} (10,000 simulated players) |

## Other modes

| Mode | Cost | RTP (exact parts) | RTP (full-game simulation) | Notes |
|---|---|---|---|---|
| {r['ante']['name']} (ante) | {r['ante']['price']:g}× bet per spin | {pct(r['ante']['rtp'])} | {pct(r['ante']['rtp_sim'])} ± {pct(r['ante']['rtp_sim_ci95'])} (z = {r['ante']['z']:+.2f}) | bonus 1 in {1 / r['ante']['p_trigger'][0]:,.0f} spins, Net Wild 1 in {1 / r['ante']['override_prob']:,.0f} |
| {r['feature_spin']['name']} | {r['feature_spin']['price']:g}× bet per spin | {pct(r['feature_spin']['rtp'])} | {pct(r['feature_spin']['rtp_sim'])} ± {pct(r['feature_spin']['rtp_sim_ci95'])} (z = {r['feature_spin']['z']:+.2f}) | guaranteed Net Wild cross |

## Bonus buys

| Buy | Price | Starts on | RTP | Median payout | Pays ≥ price |
|---|---|---|---|---|---|
{buy_rows}

## Bonus levels (from level 1)

| Level | Reached as final level | Average win if it ends there |
|---|---|---|
""" + "\n".join(f"| {LEVELS[i].name} | {pct(b0['final_level_share'][i], 1)} | {b0['mean_win_by_final_level'][i]:,.0f}× |" for i in range(4)) + f"""

## Bonus rules and feel (per bonus, by starting level)

| Level | Catch value | Net hold | Net chance per spin | Avg Nets | Avg beasts caught | Avg final multiplier | Max-win rate |
|---|---|---|---|---|---|---|---|
""" + "\n".join(level_row(r, i, lv) for i, lv in enumerate(LEVELS)) + f"""

## Paytable (pay per way)

Base-game Tag Wilds carry ×2 / ×3 / ×5 (weights 6 : 3 : 1) and count as that many ways.

| Symbol | 3 | 4 | 5 |
|---|---|---|---|
{pay_rows}

![RTP convergence](../reports/rtp_convergence.png)
![RTP split](../reports/rtp_split.png)
![Win distribution](../reports/win_distribution.png)
![Bonus levels](../reports/bonus_levels.png)
![Player sessions](../reports/sessions.png)
"""
    (ROOT / "docs" / "par_sheet.md").write_text(md, encoding="utf-8")


def main():
    r = json.loads((REPORTS / "results.json").read_text(encoding="utf-8"))
    convergence(r)
    rtp_split(r)
    win_distribution(r)
    bonus_levels(r)
    sessions(r)
    par_sheet(r)
    print("Wrote charts to reports/ and docs/par_sheet.md")


if __name__ == "__main__":
    main()
