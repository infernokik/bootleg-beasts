"""Python-side wrappers around the Numba batch simulators: run them and summarise the results."""

from __future__ import annotations

import numpy as np

from . import engine
from .config import (
    MAX_WIN,
    PAYTABLE,
    RETRIGGER_CORES,
    RETRIGGER_SPINS,
    TIERS,
    WIN_BUCKET_EDGES,
    Model,
    tier_arrays,
)

Z95 = 1.959963984540054


def _chunks(n: int, chunk_size: int) -> int:
    return max(1, int(np.ceil(n / chunk_size)))


def run_bonus(
    model: Model, tier_index: int, n_rounds: int, seed: int = 1, chunk_size: int = 20_000,
    ow_weights: list[int] | None = None, paytable=PAYTABLE,
) -> dict:
    """Simulate `n_rounds` of one bonus tier directly (what a bonus buy plays)."""
    tier = TIERS[tier_index]
    cum = np.cumsum(np.array(ow_weights or model.override_weights[tier.key], dtype=np.int64))
    n_chunks = _chunks(n_rounds, chunk_size)
    reels = model.reels[tier.key]
    tot, sq, spins, drops, mults, maxw, hist, hist_win = engine.simulate_bonus(
        n_chunks, chunk_size, seed, reels.strips, reels.lens, paytable, cum,
        tier.free_spins, tier.sticky_mode, tier.mult_step, tier.preplaced_crosses,
        tier.guaranteed_cross, RETRIGGER_CORES, RETRIGGER_SPINS, MAX_WIN, WIN_BUCKET_EDGES,
    )
    n = n_chunks * chunk_size
    mean = tot.sum() / n
    var = sq.sum() / n - mean**2
    se = np.sqrt(var / n)
    out = {
        "tier": tier.key,
        "rounds": n,
        "mean_win": mean,
        "std": np.sqrt(var),
        "ci95": Z95 * se,
        "avg_spins": spins.sum() / n,
        "avg_overrides": drops.sum() / n,
        "avg_final_mult": mults.sum() / n,
        "p_max_win": maxw.sum() / n,
        "max_win_count": int(maxw.sum()),
        "histogram": hist.sum(axis=0),
        "histogram_win": hist_win.sum(axis=0),
    }
    if tier.buy_price:
        out["buy_price"] = tier.buy_price
        out["buy_rtp"] = mean / tier.buy_price
        out["buy_rtp_ci95"] = Z95 * se / tier.buy_price
    return out


def sample_bonus(
    model: Model, tier_index: int, n_rounds: int, seed: int = 1, chunk_size: int = 20_000,
    ow_weights: list[int] | None = None, paytable=PAYTABLE,
):
    """Every round's payout and Override Wild count for one bonus tier."""
    tier = TIERS[tier_index]
    cum = np.cumsum(np.array(ow_weights or model.override_weights[tier.key], dtype=np.int64))
    reels = model.reels[tier.key]
    return engine.sample_bonus(
        _chunks(n_rounds, chunk_size), chunk_size, seed, reels.strips, reels.lens,
        paytable, cum, tier.free_spins, tier.sticky_mode, tier.mult_step, tier.preplaced_crosses,
        tier.guaranteed_cross, RETRIGGER_CORES, RETRIGGER_SPINS, MAX_WIN,
    )


def payout_profile(wins: np.ndarray, price: float) -> dict:
    """How a bonus buy feels: share of buys returning under 10% / under 50% / at least the price."""
    return {
        "median_x": float(np.median(wins)),
        "p_under_10pct": float(np.mean(wins < 0.1 * price)),
        "p_under_50pct": float(np.mean(wins < 0.5 * price)),
        "p_at_least_price": float(np.mean(wins >= price)),
        "p_10x_price": float(np.mean(wins >= 10 * price)),
    }


def run_game(
    model: Model, n_spins: int, seed: int = 1, chunk_size: int = 500_000, paytable=PAYTABLE
) -> dict:
    """Simulate `n_spins` full game rounds and return totals, splits and per-chunk sums."""
    n_chunks = _chunks(n_spins, chunk_size)
    tier_cum = np.stack([model.override_cum(t.key) for t in TIERS])
    free_spins, sticky_mode, mult_step, preplaced, guarantee = tier_arrays()
    bonus_strips, bonus_lens = model.tier_reels()
    tot, sq, base, cross, bonus, trig, hits, drops, maxw, hist, hist_win = engine.simulate_game(
        n_chunks, chunk_size, seed, model.base.strips, model.base.lens, bonus_strips,
        bonus_lens, paytable, model.override_cum("base"), tier_cum, free_spins, sticky_mode,
        mult_step, preplaced, guarantee, RETRIGGER_CORES, RETRIGGER_SPINS, MAX_WIN,
        WIN_BUCKET_EDGES,
    )
    n = n_chunks * chunk_size
    mean = tot.sum() / n
    var = sq.sum() / n - mean**2
    return {
        "spins": n,
        "chunk_size": chunk_size,
        "rtp": mean,
        "std": np.sqrt(var),
        "ci95": Z95 * np.sqrt(var / n),
        "rtp_base": base.sum() / n,
        "rtp_base_override_spins": cross.sum() / n,
        "rtp_bonus": (bonus.sum(axis=0) / n).tolist(),
        "trigger_rate": (trig.sum(axis=0) / n).tolist(),
        "hit_rate": hits.sum() / n,
        "override_spin_rate": drops.sum() / n,
        "p_max_win": maxw.sum() / n,
        "max_win_count": int(maxw.sum()),
        "histogram": hist.sum(axis=0),
        "histogram_win": hist_win.sum(axis=0),
        "chunk_totals": tot,
        "chunk_sq": sq,
    }
