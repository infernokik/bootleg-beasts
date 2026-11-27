"""Python-side wrappers around the Numba batch simulators: run them and summarise the results."""

from __future__ import annotations

import numpy as np

from . import engine
from .config import (
    BUYS,
    FREE_SPINS,
    LEVEL_UP_SPINS,
    LEVELS,
    MAX_WIN,
    MIN_BONUS_WIN,
    PAYTABLE,
    REACTORS_PER_LEVEL,
    START_LEVEL,
    WIN_BUCKET_EDGES,
    Model,
    capture_arrays,
    level_arrays,
)

Z95 = 1.959963984540054
MIN_WINS = np.array(MIN_BONUS_WIN, dtype=np.float64)


def _chunks(n: int, chunk_size: int) -> int:
    return max(1, int(np.ceil(n / chunk_size)))


def start_by_cores() -> np.ndarray:
    out = np.full(6, -1, dtype=np.int64)
    for cores, lvl in START_LEVEL.items():
        out[cores] = lvl
    return out


def _bonus_args(model: Model, level_cum=None):
    mults, shapes, sticky_w, sticky_x = level_arrays()
    cap_v, cap_c = capture_arrays()
    rv_s, rv_c, _ = model.reveal_table("bonus")
    reels = model.reels["bonus"]
    cum = model.level_override_cum() if level_cum is None else level_cum
    return reels.strips, reels.lens, cum, rv_s, rv_c, mults, shapes, cap_v, cap_c, sticky_w, sticky_x


def _game_args(model: Model, reel_key: str = "base"):
    mults, shapes, sticky_w, sticky_x = level_arrays()
    cap_v, cap_c = capture_arrays()
    rb_s, rb_c, _ = model.reveal_table("base")
    rx_s, rx_c, _ = model.reveal_table("bonus")
    return (
        model.reels[reel_key].strips, model.reels[reel_key].lens, model.reels["bonus"].strips, model.reels["bonus"].lens,
        PAYTABLE, model.override_cum(reel_key if reel_key in model.override_weights else "base"), rb_s, rb_c, rx_s, rx_c, model.level_override_cum(),
        mults, shapes, cap_v, cap_c, sticky_w, sticky_x, start_by_cores(), FREE_SPINS, REACTORS_PER_LEVEL, LEVEL_UP_SPINS,
        MIN_WINS, MAX_WIN,
    )


def run_bonus(model: Model, start_level: int, n_rounds: int, seed: int = 1, chunk_size: int = 20_000,
              level_cum=None) -> dict:
    """Simulate `n_rounds` bonuses starting at `start_level` (what a bonus buy plays)."""
    strips, lens, cum, rv_s, rv_c, mults, shapes, cv, cc, sw, sx = _bonus_args(model, level_cum)
    n_chunks = _chunks(n_rounds, chunk_size)
    tot, sq, spins, drops, reactors, reach, reach_win, maxw, hist, hist_win = engine.simulate_bonus(
        n_chunks, chunk_size, seed, strips, lens, PAYTABLE, cum, rv_s, rv_c, mults, shapes, cv, cc, sw, sx,
        start_level, FREE_SPINS, REACTORS_PER_LEVEL, LEVEL_UP_SPINS, MIN_WINS, MAX_WIN, WIN_BUCKET_EDGES,
    )
    n = n_chunks * chunk_size
    mean = tot.sum() / n
    var = sq.sum() / n - mean**2
    reach_n = reach.sum(axis=0)
    return {
        "start_level": start_level,
        "rounds": n,
        "mean_win": mean,
        "std": float(np.sqrt(var)),
        "ci95": Z95 * float(np.sqrt(var / n)),
        "avg_spins": spins.sum() / n,
        "avg_overrides": drops.sum() / n,
        "avg_reactors": reactors.sum() / n,
        "final_level_share": (reach_n / n).tolist(),
        "mean_win_by_final_level": (reach_win.sum(axis=0) / np.maximum(reach_n, 1)).tolist(),
        "p_max_win": maxw.sum() / n,
        "max_win_count": int(maxw.sum()),
        "histogram": hist.sum(axis=0),
        "histogram_win": hist_win.sum(axis=0),
    }


def run_buy(model: Model, buy_index: int, n_rounds: int, seed: int = 1, **kw) -> dict:
    b = BUYS[buy_index]
    out = run_bonus(model, b.start_level, n_rounds, seed=seed, **kw)
    price = model.buy_prices.get(b.key)
    out["buy"] = b.key
    if price:
        out["buy_price"] = price
        out["buy_rtp"] = out["mean_win"] / price
        out["buy_rtp_ci95"] = out["ci95"] / price
    return out


def sample_bonus(model: Model, start_level: int, n_rounds: int, seed: int = 1, chunk_size: int = 20_000):
    """Every bonus round's payout and final level."""
    strips, lens, cum, rv_s, rv_c, mults, shapes, cv, cc, sw, sx = _bonus_args(model)
    return engine.sample_bonus(
        _chunks(n_rounds, chunk_size), chunk_size, seed, strips, lens, PAYTABLE, cum, rv_s, rv_c,
        mults, shapes, cv, cc, sw, sx, start_level, FREE_SPINS, REACTORS_PER_LEVEL, LEVEL_UP_SPINS, MIN_WINS, MAX_WIN,
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


def run_game(model: Model, n_spins: int, seed: int = 1, chunk_size: int = 500_000, reel_key: str = "base") -> dict:
    """Simulate `n_spins` full game rounds and return totals, splits and per-chunk sums."""
    n_chunks = _chunks(n_spins, chunk_size)
    (tot, sq, base, cross, reveal, bonus, trig, reach, hits, drops, reveals, maxw, hist,
     hist_win) = engine.simulate_game(n_chunks, chunk_size, seed, *_game_args(model, reel_key)[:-1], MAX_WIN,
                                      WIN_BUCKET_EDGES)
    n = n_chunks * chunk_size
    mean = tot.sum() / n
    var = sq.sum() / n - mean**2
    return {
        "spins": n,
        "chunk_size": chunk_size,
        "rtp": mean,
        "std": float(np.sqrt(var)),
        "ci95": Z95 * float(np.sqrt(var / n)),
        "rtp_base": base.sum() / n,
        "rtp_base_override_spins": cross.sum() / n,
        "rtp_base_reveal_spins": reveal.sum() / n,
        "rtp_bonus_by_start_level": (bonus.sum(axis=0) / n).tolist(),
        "trigger_rate_by_start_level": (trig.sum(axis=0) / n).tolist(),
        "final_level_rate": (reach.sum(axis=0) / n).tolist(),
        "hit_rate": hits.sum() / n,
        "override_spin_rate": drops.sum() / n,
        "reveal_spin_rate": reveals.sum() / n,
        "p_max_win": maxw.sum() / n,
        "max_win_count": int(maxw.sum()),
        "histogram": hist.sum(axis=0),
        "histogram_win": hist_win.sum(axis=0),
        "chunk_totals": tot,
        "chunk_sq": sq,
    }


def run_sessions(model: Model, n_players: int = 10_000, n_spins: int = 500, n_paths: int = 60, seed: int = 9):
    """Player-session simulation: final net results and a few balance paths (bet = 1)."""
    return engine.simulate_sessions(n_players, n_spins, n_paths, seed, *_game_args(model))


LEVEL_NAMES = [lv.name for lv in LEVELS]
