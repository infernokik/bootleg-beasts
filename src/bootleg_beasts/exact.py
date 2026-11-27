"""Exact base-game math.

Reel stops are independent of each other and of the Override Wild drop. Once you fix which reels
carry a cross and which rows are wild, each reel's count of "this symbol or a wild" cells depends only
on that reel's own stop. So for every symbol and run length,

    E[ways win] = pay * E[c_1] * ... * E[c_L] * P(c_{L+1} = 0)

and the base-game RTP is exact after a few milliseconds of arithmetic. The Static reveal is drawn
independently of the stops too, so conditioning on the revealed symbol keeps the formula exact:
average the result over every reveal outcome, weighted by its probability. `enumerate_base` checks
this by brute force over every stop combination (the "full cycle").
"""

from __future__ import annotations

import numpy as np
from numba import njit, prange

from .config import (
    BASE_WILD_MULT_MEAN,
    CORE,
    N_PAYING,
    OVERRIDE_REELS,
    PAYTABLE,
    REELS,
    ROWS,
    STATIC,
    WILD,
    WIN_BUCKET_EDGES,
    Model,
    ReelSet,
)
from .engine import bucket

N_ROW_MASKS = 1 << ROWS


def windows(reelset: ReelSet, r: int, reveal: int | None = None) -> np.ndarray:
    """All visible 5-symbol windows of reel r, one per stop: shape [n_stops, ROWS].
    With `reveal`, every Static in the window is replaced by that symbol."""
    n = int(reelset.lens[r])
    idx = (np.arange(n)[:, None] + np.arange(ROWS)[None, :]) % n
    w = reelset.strips[r, :n][idx]
    if reveal is not None:
        w = np.where(w == STATIC, reveal, w)
    return w


def _row_mask(R: int) -> np.ndarray:
    return np.array([(R >> k) & 1 for k in range(ROWS)], dtype=bool)


def _weighted_counts(raw: np.ndarray, reveal, R: int, s: int, wild_weight: float) -> np.ndarray:
    """Per stop: cells counting for s. Cells in a wild row (Override) count 1; Glitch Wilds that
    landed count `wild_weight` (their mean multiplier); wilds revealed by Static and cells showing s
    count 1. `raw` are the windows before the Static reveal."""
    w = raw if reveal is None else np.where(raw == STATIC, reveal, raw)
    row = _row_mask(R)[None, :]
    natural = (raw == WILD) & ~row
    return ((w == s) | row | ((w == WILD) & ~natural)).sum(axis=1) + wild_weight * natural.sum(axis=1)


def count_tables(reelset: ReelSet, reveal: int | None = None, wild_weight: float = 1.0):
    """Ec[r, R, s] = E[c] and P0[r, R, s] = P(c == 0) over reel r's stops.

    c = cells on reel r that show symbol s or a Glitch Wild, or that lie in a wild row (bitmask R).
    """
    Ec = np.zeros((REELS, N_ROW_MASKS, N_PAYING))
    P0 = np.zeros((REELS, N_ROW_MASKS, N_PAYING))
    for r in range(REELS):
        raw = windows(reelset, r)
        for R in range(N_ROW_MASKS):
            for s in range(N_PAYING):
                c = _weighted_counts(raw, reveal, R, s, wild_weight)
                Ec[r, R, s] = c.mean()
                P0[r, R, s] = (c == 0).mean()
    return Ec, P0


def expected_win(Ec, P0, paytable, R: int, cross_reels: frozenset) -> float:
    """Expected ways win given wild rows R and reels whose whole column is wild."""
    total = 0.0
    for s in range(N_PAYING):
        prod = 1.0
        for r in range(REELS):
            prod *= 5.0 if r in cross_reels else Ec[r, R, s]
            length = r + 1
            if length < 3:
                continue
            if length < REELS:
                nxt = r + 1
                p_stop = 0.0 if nxt in cross_reels else P0[nxt, R, s]
                total += paytable[s, length] * prod * p_stop
            else:
                total += paytable[s, length] * prod
    return total


def override_configs(n: int):
    """Yield (cross_reels, wild_row_mask, probability) for n Override Wilds, as the engine drops them
    on an empty grid: the first uniformly over reels 2-4 x 5 rows, the second uniformly over the
    cells of the two other reels."""
    cells = [(r, k) for r in OVERRIDE_REELS for k in range(ROWS)]
    if n == 0:
        yield frozenset(), 0, 1.0
    elif n == 1:
        for r, k in cells:
            yield frozenset({r}), 1 << k, 1.0 / len(cells)
    elif n == 2:
        for r1, k1 in cells:
            others = [(r, k) for r, k in cells if r != r1]
            for r2, k2 in others:
                yield frozenset({r1, r2}), (1 << k1) | (1 << k2), 1.0 / (len(cells) * len(others))
    else:
        raise ValueError(n)


def core_probabilities(reelset: ReelSet) -> np.ndarray:
    """P(a Capture Core shows) for each reel."""
    return np.array([(windows(reelset, r) == CORE).any(axis=1).mean() for r in range(REELS)])


def core_count_distribution(p: np.ndarray) -> np.ndarray:
    """P(exactly k Cores), k = 0..REELS, for independent reels (Poisson-binomial)."""
    dist = np.zeros(REELS + 1)
    dist[0] = 1.0
    for pr in p:
        dist[1:] = dist[1:] * (1 - pr) + dist[:-1] * pr
        dist[0] *= 1 - pr
    return dist


def base_game_exact(model: Model, paytable=PAYTABLE, reel_key: str = "base") -> dict:
    """Exact base-game RTP (ways wins only) and exact bonus trigger probabilities, per unit bet,
    on the given base reel set ("base", or "hunt" for the ante mode)."""
    reels = model.reels[reel_key]
    rv_syms, _, rv_p = model.reveal_table("base")
    ow_p = model.override_probs(reel_key if reel_key in model.override_weights else "base")
    ow_p = np.pad(ow_p, (0, 3 - len(ow_p)))
    by_drops = np.zeros(3)  # mean win given 0 / 1 / 2 Override Wilds, averaged over reveals
    by_reveal = {}
    for m, pm in zip(rv_syms.tolist(), rv_p):
        Ec, P0 = count_tables(reels, m, BASE_WILD_MULT_MEAN)
        e = np.array([
            sum(p * expected_win(Ec, P0, paytable, R, cr) for cr, R, p in override_configs(n))
            for n in range(3)
        ])
        by_drops += pm * e
        by_reveal[m] = float(e[0])
    Ec0, P00 = count_tables(reels, None, BASE_WILD_MULT_MEAN)  # Static left unrevealed: pays nothing
    no_static_rtp = expected_win(Ec0, P00, paytable, 0, frozenset())
    core_p = core_probabilities(reels)
    dist = core_count_distribution(core_p)
    return {
        "rtp_no_override": float(by_drops[0]),
        "rtp_static_as_blank": float(no_static_rtp),
        "rtp_no_override_by_reveal": by_reveal,
        "mean_win_one_override": float(by_drops[1]),
        "mean_win_two_overrides": float(by_drops[2]),
        "override_probs": ow_p.tolist(),
        "rtp_base_ways": float(np.dot(ow_p, by_drops)),
        "core_prob_by_reel": core_p.tolist(),
        "p_cores": dist.tolist(),
        "p_trigger": [float(dist[3]), float(dist[4]), float(dist[5])],
    }


# ---- Brute-force full cycle (independent check) -----------------------------
def _count_table_for(reelset: ReelSet, R: int, cross_reels: frozenset, reveal=None,
                     wild_weight: float = 1.0) -> np.ndarray:
    """cnt[r, stop, s] = cells counting for s on reel r at that stop (s, wild, wild row, cross)."""
    n_max = int(reelset.lens.max())
    cnt = np.zeros((REELS, n_max, N_PAYING), dtype=np.float64)
    for r in range(REELS):
        w = windows(reelset, r, reveal)
        n = w.shape[0]
        if r in cross_reels:
            cnt[r, :n, :] = ROWS
            continue
        raw = windows(reelset, r)
        for s in range(N_PAYING):
            cnt[r, :n, s] = _weighted_counts(raw, reveal, R, s, wild_weight)
    return cnt


@njit(parallel=True, cache=True)
def _enumerate(cnt, lens, paytable, edges):
    n0 = lens[0]
    nb = edges.shape[0] + 1
    sums = np.zeros(n0)
    sq = np.zeros(n0)
    hits = np.zeros(n0, np.int64)
    hist = np.zeros((n0, nb), np.int64)
    for a in prange(n0):
        for b in range(lens[1]):
            for c in range(lens[2]):
                for d in range(lens[3]):
                    for e in range(lens[4]):
                        w = 0.0
                        for s in range(N_PAYING):
                            c0 = cnt[0, a, s]
                            if c0 == 0:
                                continue
                            c1 = cnt[1, b, s]
                            if c1 == 0:
                                continue
                            c2 = cnt[2, c, s]
                            if c2 == 0:
                                continue
                            ways = c0 * c1 * c2
                            c3 = cnt[3, d, s]
                            if c3 == 0:
                                w += paytable[s, 3] * ways
                                continue
                            ways *= c3
                            c4 = cnt[4, e, s]
                            if c4 == 0:
                                w += paytable[s, 4] * ways
                            else:
                                w += paytable[s, 5] * ways * c4
                        sums[a] += w
                        sq[a] += w * w
                        if w > 0.0:
                            hits[a] += 1
                        hist[a, bucket(w, edges)] += 1
    return sums, sq, hits, hist


def enumerate_base(
    model: Model, R: int = 0, cross_reels: frozenset = frozenset(), reveal=None, paytable=PAYTABLE,
    wild_weight: float = BASE_WILD_MULT_MEAN,
) -> dict:
    """Every stop combination of the base reels, for one fixed Override Wild configuration and one
    revealed symbol."""
    cnt = _count_table_for(model.base, R, cross_reels, reveal, wild_weight)
    lens = model.base.lens
    sums, sq, hits, hist = _enumerate(cnt, lens, paytable, WIN_BUCKET_EDGES)
    n = float(np.prod(lens.astype(np.float64)))
    mean = sums.sum() / n
    return {
        "combinations": n,
        "rtp": mean,
        "hit_rate": hits.sum() / n,
        "variance": sq.sum() / n - mean**2,
        "histogram": hist.sum(axis=0),
    }
