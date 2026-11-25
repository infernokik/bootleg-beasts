"""Numba kernels: win evaluation, Override Wild crosses, base spins, bonus rounds, batch simulators.

Grids are indexed [reel, row]. A wild mask marks cells that are wild because an Override Wild cross
covers them (this spin, or sticky from earlier in a bonus).

Each batch simulator splits the work into chunks and seeds every chunk with seed + chunk index. That
makes results reproducible no matter how many threads run them, and the per-chunk totals give the
RTP convergence curve for free.
"""

import numpy as np
from numba import njit, prange

from .config import CORE, N_PAYING, OVERRIDE_REELS, REELS, ROWS, WILD

OW_FIRST = OVERRIDE_REELS[0]
OW_LAST = OVERRIDE_REELS[-1]


@njit(cache=True)
def spin_reels(strips, lens, grid):
    for r in range(REELS):
        n = lens[r]
        stop = np.random.randint(0, n)
        for k in range(ROWS):
            grid[r, k] = strips[r, (stop + k) % n]


@njit(cache=True)
def add_cross(mask, reel, row):
    """Override Wild at (reel, row): its whole column and whole row turn wild."""
    for k in range(ROWS):
        mask[reel, k] = True
    for r in range(REELS):
        mask[r, row] = True


@njit(cache=True)
def ways_win(grid, wild_mask, paytable, cnt):
    """Total ways win (x bet). Wins pay left to right from reel 1 for runs of 3+ reels.

    For each paying symbol, ways = product over the run of (cells showing the symbol or a wild).
    `cnt` is a scratch buffer of shape [REELS, N_PAYING + 1]; column N_PAYING holds the wild count.
    """
    for r in range(REELS):
        for s in range(N_PAYING + 1):
            cnt[r, s] = 0
        for k in range(ROWS):
            v = grid[r, k]
            if wild_mask[r, k] or v == WILD:
                cnt[r, N_PAYING] += 1
            elif v < N_PAYING:
                cnt[r, v] += 1
    total = 0.0
    for s in range(N_PAYING):
        ways = 1
        length = 0
        for r in range(REELS):
            c = cnt[r, s] + cnt[r, N_PAYING]
            if c == 0:
                break
            ways *= c
            length += 1
        if length >= 3:
            total += paytable[s, length] * ways
    return total


@njit(cache=True)
def draw_count(cum_weights):
    """Draw how many Override Wilds drop (index into a cumulative weight table)."""
    x = np.random.randint(0, cum_weights[cum_weights.shape[0] - 1])
    for i in range(cum_weights.shape[0]):
        if x < cum_weights[i]:
            return i
    return cum_weights.shape[0] - 1


@njit(cache=True)
def _reel_used(out_r, placed, r):
    for j in range(placed):
        if out_r[j] == r:
            return True
    return False


@njit(cache=True)
def place_overrides(n, blocked, out_r, out_k):
    """Drop up to n Override Wilds on reels 2-4, each on a different reel, never on a blocked cell.

    Each drop picks uniformly among the allowed cells. Returns how many were placed (fewer than n
    if every cell on the remaining reels is blocked).
    """
    placed = 0
    for _ in range(n):
        m = 0
        for r in range(OW_FIRST, OW_LAST + 1):
            if _reel_used(out_r, placed, r):
                continue
            for k in range(ROWS):
                if not blocked[r, k]:
                    m += 1
        if m == 0:
            break
        pick = np.random.randint(0, m)
        done = False
        for r in range(OW_FIRST, OW_LAST + 1):
            if done:
                break
            if _reel_used(out_r, placed, r):
                continue
            for k in range(ROWS):
                if not blocked[r, k]:
                    if pick == 0:
                        out_r[placed] = r
                        out_k[placed] = k
                        done = True
                        break
                    pick -= 1
        placed += 1
    return placed


@njit(cache=True)
def base_spin(strips, lens, paytable, ow_cum, grid, mask, blocked, cnt, ow_r, ow_k):
    """One base-game spin. Returns (ways win, Capture Cores showing, Override Wilds dropped).

    Capture Cores are counted before any Override Wild expands.
    """
    spin_reels(strips, lens, grid)
    cores = 0
    for r in range(REELS):
        for k in range(ROWS):
            mask[r, k] = False
            blocked[r, k] = False
            if grid[r, k] == CORE:
                cores += 1
    n_ow = 0
    n = draw_count(ow_cum)
    if n > 0:
        n_ow = place_overrides(n, blocked, ow_r, ow_k)
        for i in range(n_ow):
            add_cross(mask, ow_r[i], ow_k[i])
    return ways_win(grid, mask, paytable, cnt), cores, n_ow


@njit(cache=True)
def bonus_round(
    strips, lens, paytable, ow_cum, free_spins, sticky_mode, mult_step, preplaced, guarantee,
    retrig_cores, retrig_spins, cap, grid, mask, sticky, cnt, ow_r, ow_k,
):
    """Play one bonus. Returns (win, spins played, Override Wilds dropped, final multiplier, hit cap).

    - Every Override Wild that drops adds `mult_step` to the global multiplier before that spin pays.
    - sticky_mode 0: crosses are wild for one spin. 1: the Override Wild's column stays wild for the
      rest of the bonus. 2: the whole cross stays wild. Sticky cells hide whatever lands under them:
      no new Override Wild can drop there, and Cores under them don't count.
    - `preplaced` crosses are placed (sticky) before the first spin and don't raise the multiplier.
    - With `guarantee`, if no Override Wild has dropped by the last free spin, one drops on it.
    - The bonus stops as soon as its total reaches `cap`.
    """
    for r in range(REELS):
        for k in range(ROWS):
            sticky[r, k] = False
    if preplaced > 0:
        n0 = place_overrides(preplaced, sticky, ow_r, ow_k)
        for i in range(n0):
            add_cross(sticky, ow_r[i], ow_k[i])

    mult = 1
    total = 0.0
    n_drop = 0
    spins_left = free_spins
    played = 0
    while spins_left > 0:
        spins_left -= 1
        played += 1
        spin_reels(strips, lens, grid)
        cores = 0
        for r in range(REELS):
            for k in range(ROWS):
                mask[r, k] = sticky[r, k]
                if not sticky[r, k] and grid[r, k] == CORE:
                    cores += 1
        n_new = 0
        n = draw_count(ow_cum)
        if guarantee and n == 0 and n_drop == 0 and spins_left == 0:
            n = 1
        if n > 0:
            n_new = place_overrides(n, sticky, ow_r, ow_k)
            for i in range(n_new):
                add_cross(mask, ow_r[i], ow_k[i])
            for i in range(n_new):
                if sticky_mode == 2:
                    add_cross(sticky, ow_r[i], ow_k[i])
                elif sticky_mode == 1:
                    for k in range(ROWS):
                        sticky[ow_r[i], k] = True
        n_drop += n_new
        mult += mult_step * n_new
        total += ways_win(grid, mask, paytable, cnt) * mult
        if total >= cap:
            return cap, played, n_drop, mult, True
        if cores >= retrig_cores:
            spins_left += retrig_spins
    return total, played, n_drop, mult, False


@njit(cache=True)
def bucket(win, edges):
    """Bucket 0 = no win; bucket i >= 1 = (edges[i-2], edges[i-1]]."""
    if win <= 0.0:
        return 0
    return np.searchsorted(edges, win) + 1


@njit(parallel=True, cache=True)
def simulate_game(
    n_chunks, chunk_size, seed, base_strips, base_lens, bonus_strips, bonus_lens, paytable,
    base_cum, tier_cum, free_spins, sticky_mode, mult_step, preplaced, guarantee,
    retrig_cores, retrig_spins, max_win, edges,
):
    """Play n_chunks * chunk_size full game rounds (base spin + any bonus it triggers).

    bonus_strips / bonus_lens hold one reel set per tier: [tier, reel, position] / [tier, reel].
    """
    nb = edges.shape[0] + 1
    tot = np.zeros(n_chunks)
    sq = np.zeros(n_chunks)
    base_part = np.zeros(n_chunks)
    cross_part = np.zeros(n_chunks)
    bonus_part = np.zeros((n_chunks, 3))
    trig = np.zeros((n_chunks, 3), np.int64)
    hits = np.zeros(n_chunks, np.int64)
    drops = np.zeros(n_chunks, np.int64)
    maxw = np.zeros(n_chunks, np.int64)
    hist = np.zeros((n_chunks, nb), np.int64)
    hist_win = np.zeros((n_chunks, nb))
    for c in prange(n_chunks):
        np.random.seed(seed + c)
        grid = np.empty((REELS, ROWS), np.int8)
        mask = np.zeros((REELS, ROWS), np.bool_)
        blocked = np.zeros((REELS, ROWS), np.bool_)
        sticky = np.zeros((REELS, ROWS), np.bool_)
        cnt = np.zeros((REELS, N_PAYING + 1), np.int64)
        ow_r = np.zeros(3, np.int64)
        ow_k = np.zeros(3, np.int64)
        for _ in range(chunk_size):
            win, cores, n_ow = base_spin(
                base_strips, base_lens, paytable, base_cum, grid, mask, blocked, cnt, ow_r, ow_k
            )
            if win > max_win:
                win = max_win
            total = win
            base_part[c] += win
            if n_ow > 0:
                drops[c] += 1
                cross_part[c] += win
            if cores >= 3:
                t = min(cores, 5) - 3
                trig[c, t] += 1
                bw, _, _, _, _ = bonus_round(
                    bonus_strips[t], bonus_lens[t], paytable, tier_cum[t], free_spins[t],
                    sticky_mode[t], mult_step[t], preplaced[t], guarantee[t], retrig_cores,
                    retrig_spins, max_win - win, grid, mask, sticky, cnt, ow_r, ow_k,
                )
                bonus_part[c, t] += bw
                total += bw
            if total >= max_win:
                total = max_win
                maxw[c] += 1
            tot[c] += total
            sq[c] += total * total
            if total > 0.0:
                hits[c] += 1
            b = bucket(total, edges)
            hist[c, b] += 1
            hist_win[c, b] += total
    return tot, sq, base_part, cross_part, bonus_part, trig, hits, drops, maxw, hist, hist_win


@njit(parallel=True, cache=True)
def sample_bonus(
    n_chunks, chunk_size, seed, strips, lens, paytable, ow_cum, free_spins, sticky_mode, mult_step,
    preplaced, guarantee, retrig_cores, retrig_spins, max_win,
):
    """Like simulate_bonus, but return every round's win and Override count (for distributions)."""
    wins = np.zeros(n_chunks * chunk_size)
    drops = np.zeros(n_chunks * chunk_size, np.int64)
    for c in prange(n_chunks):
        np.random.seed(seed + c)
        grid = np.empty((REELS, ROWS), np.int8)
        mask = np.zeros((REELS, ROWS), np.bool_)
        sticky = np.zeros((REELS, ROWS), np.bool_)
        cnt = np.zeros((REELS, N_PAYING + 1), np.int64)
        ow_r = np.zeros(3, np.int64)
        ow_k = np.zeros(3, np.int64)
        for i in range(chunk_size):
            w, _, nd, _, _ = bonus_round(
                strips, lens, paytable, ow_cum, free_spins, sticky_mode, mult_step, preplaced,
                guarantee, retrig_cores, retrig_spins, max_win, grid, mask, sticky, cnt, ow_r, ow_k,
            )
            wins[c * chunk_size + i] = w
            drops[c * chunk_size + i] = nd
    return wins, drops


@njit(parallel=True, cache=True)
def simulate_bonus(
    n_chunks, chunk_size, seed, strips, lens, paytable, ow_cum, free_spins, sticky_mode, mult_step,
    preplaced, guarantee, retrig_cores, retrig_spins, max_win, edges,
):
    """Play n_chunks * chunk_size bonus rounds directly (a bonus buy / forced trigger)."""
    nb = edges.shape[0] + 1
    tot = np.zeros(n_chunks)
    sq = np.zeros(n_chunks)
    spins = np.zeros(n_chunks, np.int64)
    drops = np.zeros(n_chunks, np.int64)
    mults = np.zeros(n_chunks, np.int64)
    maxw = np.zeros(n_chunks, np.int64)
    hist = np.zeros((n_chunks, nb), np.int64)
    hist_win = np.zeros((n_chunks, nb))
    for c in prange(n_chunks):
        np.random.seed(seed + c)
        grid = np.empty((REELS, ROWS), np.int8)
        mask = np.zeros((REELS, ROWS), np.bool_)
        sticky = np.zeros((REELS, ROWS), np.bool_)
        cnt = np.zeros((REELS, N_PAYING + 1), np.int64)
        ow_r = np.zeros(3, np.int64)
        ow_k = np.zeros(3, np.int64)
        for _ in range(chunk_size):
            w, played, nd, m, capped = bonus_round(
                strips, lens, paytable, ow_cum, free_spins, sticky_mode, mult_step, preplaced,
                guarantee, retrig_cores, retrig_spins, max_win, grid, mask, sticky, cnt, ow_r, ow_k,
            )
            tot[c] += w
            sq[c] += w * w
            spins[c] += played
            drops[c] += nd
            mults[c] += m
            if capped:
                maxw[c] += 1
            b = bucket(w, edges)
            hist[c, b] += 1
            hist_win[c, b] += w
    return tot, sq, spins, drops, mults, maxw, hist, hist_win
