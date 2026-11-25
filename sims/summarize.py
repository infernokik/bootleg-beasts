"""Turn reports/results.json into Markdown tables (reports/summary.md) for the README and the spec.

Run after verify.py:  .venv\\Scripts\\python.exe sims\\summarize.py
"""

from __future__ import annotations

import json
from pathlib import Path

from glitch_tamers.config import TIERS

REPORTS = Path(__file__).resolve().parent.parent / "reports"


def pct(x: float, d: int = 2) -> str:
    return f"{100 * x:.{d}f}%"


def one_in(p: float) -> str:
    return f"1 in {1 / p:,.0f}" if p > 0 else "never seen"


def main() -> None:
    r = json.loads((REPORTS / "results.json").read_text(encoding="utf-8"))
    ex, g, parts, bonus = r["exact"], r["game"], r["rtp_from_parts"], r["bonus"]
    sh, nr, lg = (bonus[t.key] for t in TIERS)

    headline = "\n".join([
        "| | Result |",
        "|---|---|",
        f"| **RTP, exact base + simulated bonuses** | **{pct(parts['rtp'], 3)} ± {pct(parts['ci95'], 3)}** |",
        f"| RTP, {g['spins']:.0e} full-game spins | {pct(g['rtp'], 3)} ± {pct(g['ci95'], 3)} |",
        f"| Street Hunt buy (100×) RTP | {pct(sh['buy_rtp'], 2)} ± {pct(sh['buy_rtp_ci95'], 2)} |",
        f"| Night Raid buy (300×) RTP | {pct(nr['buy_rtp'], 2)} ± {pct(nr['buy_rtp_ci95'], 2)} |",
        f"| Hit frequency | {pct(g['hit_rate'], 1)} |",
        f"| Volatility (SD per spin) | {g['std']:.1f}× bet |",
        f"| Bonus odds (3 / 4 / 5 Cores) | {' / '.join(one_in(p) for p in ex['p_trigger'])} spins |",
        f"| Max win 10,000× | {one_in(g['p_max_win'])} spins |",
    ]).replace("1e+10", "10¹⁰").replace("1e+09", "10⁹")

    rtp = parts["rtp"]
    q = ex["override_probs"][1]
    base_plain = (1 - q) * ex["rtp_no_override"]
    base_cross = q * ex["mean_win_one_override"]
    split = "\n".join([
        "| Source | RTP | Share of RTP |",
        "|---|---|---|",
        f"| Base game, normal wins (exact) | {pct(base_plain)} | {pct(base_plain / rtp, 1)} |",
        f"| Base game, Override Wild spins (exact) | {pct(base_cross)} | {pct(base_cross / rtp, 1)} |",
        *(f"| {t.name} | {pct(p)} | {pct(p / rtp, 1)} |" for t, p in zip(TIERS, parts["bonus_parts"])),
        f"| **Total** | **{pct(rtp, 3)}** | 100% |",
    ])

    def prof(b, key, fmt=lambda x: pct(x, 1)):
        return fmt(b["profile"][key]) if key in b["profile"] else "–"

    def max_odds(b):
        if b["p_max_win"] > 0:
            return one_in(b["p_max_win"])
        return f"not reached in {b['rounds']:.0e} rounds".replace("1e+08", "10⁸").replace("2e+07", "2×10⁷")

    bonus_tbl = "\n".join([
        "| | Street Hunt | Night Raid | Legendary Capture |",
        "|---|---|---|---|",
        f"| Price | 100× | 300× | not buyable |",
        f"| Mean payout | {sh['mean_win']:.1f}× | {nr['mean_win']:.1f}× | {lg['mean_win']:,.0f}× |",
        f"| Median payout | {sh['profile']['median_x']:.1f}× | {nr['profile']['median_x']:.1f}× | "
        f"{lg['profile']['median_x']:,.0f}× |",
        "| 10th–90th percentile | " + " | ".join(
            f"{b['percentiles_x']['10']:,.0f}–{b['percentiles_x']['90']:,.0f}×" for b in (sh, nr, lg)) + " |",
        f"| Pays back at least the price | {prof(sh, 'p_at_least_price')} | "
        f"{prof(nr, 'p_at_least_price')} | – |",
        f"| Pays back under half the price | {prof(sh, 'p_under_50pct')} | "
        f"{prof(nr, 'p_under_50pct')} | – |",
        f"| Pays back under 10% of the price | {prof(sh, 'p_under_10pct')} | "
        f"{prof(nr, 'p_under_10pct')} | – |",
        f"| Average Override Wilds | {sh['avg_overrides']:.2f} | {nr['avg_overrides']:.2f} | "
        f"{lg['avg_overrides']:.2f} (+1 placed) |",
        f"| Reaches 10,000× | {max_odds(sh)} | {max_odds(nr)} | "
        f"{pct(lg['p_max_win'], 1)} of bonuses |",
    ])

    targets = "\n".join([
        "| Metric | Target | Result |",
        "|---|---|---|",
        f"| RTP, base mode | 96.00% | **{pct(parts['rtp'], 3)} ± {pct(parts['ci95'], 3)}** (exact base + simulated bonuses); "
        f"{pct(g['rtp'], 3)} ± {pct(g['ci95'], 3)} ({g['spins']:.0e}-spin full-game check, z = {r['game_vs_parts_z']:+.2f}) |",
        f"| RTP, each bonus buy | 96.0–96.3% | Street Hunt {pct(sh['buy_rtp'])} ± {pct(sh['buy_rtp_ci95'])}, "
        f"Night Raid {pct(nr['buy_rtp'])} ± {pct(nr['buy_rtp_ci95'])} |",
        f"| Base game's share of RTP | 55–65% | {pct(ex['rtp_base_ways'] / rtp, 1)} |",
        f"| Hit frequency | about 25% | {pct(ex['hit_rate_base'], 1)} exact (base wins); {pct(g['hit_rate'], 1)} counting bonus rounds |",
        f"| Street Hunt trigger | about 1 in 250 | {one_in(ex['p_trigger'][0])} (exact) |",
        f"| Night Raid trigger | about 1 in 4,000 | {one_in(ex['p_trigger'][1])} (exact) |",
        f"| Legendary trigger | about 1 in 250,000 | {one_in(ex['p_trigger'][2])} (exact) |",
        f"| Override Wild in base game | – | {one_in(ex['override_probs'][1])} spins |",
        f"| Volatility (SD per spin) | 12–20× | {g['std']:.1f}× |",
        f"| Max win 10,000× | report | {one_in(g['p_max_win'])} spins ({g['max_win_count']:,} hits) |",
    ]).replace("1e+10", "10¹⁰").replace("1e+09", "10⁹")

    md = (f"## Headline\n\n{headline}\n\n## Targets vs results\n\n{targets}\n\n"
          f"## Where the RTP comes from\n\n{split}\n\n## Bonus payouts\n\n{bonus_tbl}\n")
    (REPORTS / "summary.md").write_text(md, encoding="utf-8")
    print(md)


if __name__ == "__main__":
    main()
