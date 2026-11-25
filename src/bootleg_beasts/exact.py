"""Exact base-game math.

Reel stops are independent of each other and of the Override Wild drop. Once you fix which reels
carry a cross and which rows are wild, each reel's count of "this symbol or a wild" cells depends only
on that reel's own stop. So for every symbol and run length,

    E[ways win] = pay * E[c_1] * ... * E[c_L] * P(c_{L+1} = 0)

and the base-game RTP is exact after a few milliseconds of arithmetic. `enumerate_base` checks this
by brute force over every stop combination (the "full cycle").
"""

from __future__ import annotations

import numpy as np
from numba import njit, prange

from .config import (
    CORE,
    N_PAYING,
    OVERRIDE_REELS,
    PAYTABLE,
    REELS,
    ROWS,
    WILD,
    WIN_BUCKET_EDGES,
    Model,
    ReelSet,
)
from .engine import bucket

N_ROW_MASKS = 1 << ROWS


def windows(reelset: ReelSet, r: int) -> np.ndarray:
    """All visible 5-symbol windows of reel r, one per stop: shape [n_stops, ROWS]."""
    n = int(reelset.lens[r])
    idx = (np.arange(n)[:, None] + np.arange(ROWS)[None, :]) % n
    return reelset.strips[r, :n][idx]


def _row_mask(R: int) -> np.ndarray:
    return np.array([(R >> k) & 1 for k in range(ROWS)], dtype=bool)


def count_tables(reelset: ReelSet):
    """Ec[r, R, s] = E[c] and P0[r, R, s] = P(c == 0) over reel r's stops.

    c = cells on reel r that show symbol s or a Glitch Wild, or that lie in a wild row (bitmask R).
    """
    Ec = np.zeros((REELS, N_ROW_MASKS, N_PAYING))
    P0 = np.zeros((REELS, N_ROW_MASKS, N_PAYING))
    for r in range(REELS):
        w = windows(reelset, r)
        for R in range(N_ROW_MASKS):
            wild = (w == WILD) | _row_mask(R)[None, :]
            for s in range(N_PAYING):
                c = ((w == s) | wild).sum(axis=1)
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


def base_game_exact(model: Model, paytable=PAYTABLE) -> dict:
    """Exact base-game RTP (ways wins only) and exact bonus trigger probabilities."""
    Ec, P0 = count_tables(model.base)
    by_drops = []
    for n in range(3):
        by_drops.append(
            sum(p * expected_win(Ec, P0, paytable, R, cr) for cr, R, p in override_configs(n))
        )
    probs = model.override_probs("base")
    probs = np.pad(probs, (0, 3 - len(probs)))
    core_p = core_probabilities(model.base)
    dist = core_count_distribution(core_p)
    return {
        "rtp_no_override": by_drops[0],
        "mean_win_one_override": by_drops[1],
        "mean_win_two_overrides": by_drops[2],
        "override_probs": probs.tolist(),
        "rtp_base_ways": float(np.dot(probs, by_drops)),
        "core_prob_by_reel": core_p.tolist(),
        "p_cores": dist.tolist(),
        "p_trigger": [float(dist[3]), float(dist[4]), float(dist[5])],
    }


# ---- Brute-force full cycle (independent check) -----------------------------
def _count_table_for(reelset: ReelSet, R: int, cross_reels: frozenset) -> np.ndarray:
    """cnt[r, stop, s] = cells counting for s on reel r at that stop (s, wild, wild row, cross)."""
    n_max = int(reelset.lens.max())
    cnt = np.zeros((REELS, n_max, N_PAYING), dtype=np.int64)
    for r in range(REELS):
        w = windows(reelset, r)
        n = w.shape[0]
        if r in cross_reels:
            cnt[r, :n, :] = ROWS
            continue
        wild = (w == WILD) | _row_mask(R)[None, :]
        for s in range(N_PAYING):
            cnt[r, :n, s] = ((w == s) | wild).sum(axis=1)
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
    model: Model, R: int = 0, cross_reels: frozenset = frozenset(), paytable=PAYTABLE
) -> dict:
    """Every stop combination of the base reels, for one fixed Override Wild configuration."""
    cnt = _count_table_for(model.base, R, cross_reels)
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
