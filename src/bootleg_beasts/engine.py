"""Numba kernels: win evaluation, Static reveals, Override Wild crosses, base spins, the level-up
bonus, and batch simulators.

Grids are indexed [reel, row]. A wild mask marks cells that are wild because an Override Wild cross
covers them (this spin, or locked from earlier in the bonus).

Each batch simulator splits the work into chunks and seeds every chunk with seed + chunk index, so
results are reproducible no matter how many threads run them.
"""

import numpy as np
from numba import njit, prange

from .config import CORE, N_PAYING, OVERRIDE_REELS, REACTOR, REELS, ROWS, STATIC, WILD

OW_FIRST = OVERRIDE_REELS[0]
OW_LAST = OVERRIDE_REELS[-1]
N_LEVELS = 4


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
    """Index drawn from a cumulative weight table."""
    x = np.random.randint(0, cum_weights[cum_weights.shape[0] - 1])
    for i in range(cum_weights.shape[0]):
        if x < cum_weights[i]:
            return i
    return cum_weights.shape[0] - 1


@njit(cache=True)
def reveal_static(grid, blocked, rv_syms, rv_cum):
    """Every visible Static (not under a blocked cell) turns into the same random symbol.

    The symbol is drawn on every spin, independent of the reel stops. Returns the revealed symbol,
    or -1 if no Static was showing."""
    m = rv_syms[draw_count(rv_cum)]
    found = False
    for r in range(REELS):
        for k in range(ROWS):
            if not blocked[r, k] and grid[r, k] == STATIC:
                grid[r, k] = m
                found = True
    return m if found else -1


@njit(cache=True)
def _reel_used(out_r, placed, r):
    for j in range(placed):
        if out_r[j] == r:
            return True
    return False


@njit(cache=True)
def place_overrides(n, blocked, out_r, out_k):
    """Drop up to n Override Wilds on reels 2-4, each on a different reel, never on a blocked cell.

    Each drop picks uniformly among the allowed cells. Returns how many were placed."""
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
def add_shape(mask, reel, row, shape):
    """Shape 1: the Override Wild's column turns wild. Shape 2: its whole row and column."""
    if shape == 2:
        add_cross(mask, reel, row)
    else:
        for k in range(ROWS):
            mask[reel, k] = True


@njit(cache=True)
def base_spin(strips, lens, paytable, ow_cum, rv_syms, rv_cum, grid, mask, blocked, cnt, ow_r, ow_k):
    """One base-game spin. Returns (ways win, Capture Cores, Override Wilds dropped, revealed symbol).

    Order: reels stop, Cores are counted, Static reveals, then any Override Wild expands."""
    spin_reels(strips, lens, grid)
    cores = 0
    for r in range(REELS):
        for k in range(ROWS):
            mask[r, k] = False
            blocked[r, k] = False
            if grid[r, k] == CORE:
                cores += 1
    revealed = reveal_static(grid, blocked, rv_syms, rv_cum)
    n_ow = 0
    n = draw_count(ow_cum)
    if n > 0:
        n_ow = place_overrides(n, blocked, ow_r, ow_k)
        for i in range(n_ow):
            add_cross(mask, ow_r[i], ow_k[i])
    return ways_win(grid, mask, paytable, cnt), cores, n_ow, revealed


@njit(cache=True)
def bonus_round(
    strips, lens, paytable, level_cum, rv_syms, rv_cum, mults, shapes, cap_v, cap_c, sticky_w, sticky_x, start_level,
    free_spins, per_level, levelup_spins, guarantee, min_win, cap, grid, mask, sticky, cnt, ow_r, ow_k,
):
    """Play one bonus. Returns (win, spins played, Override Wilds, final level, Reactors, hit cap).

    Each spin: reels stop; Reactors not under locked cells are counted; Static reveals; an Override
    Wild may drop (chance set by the level) and turns its column (shape 1) or row and column
    (shape 2) wild; with `guarantee`, one is forced on a random spin among the first `free_spins`
    if none has dropped by then; the win pays x the level's multiplier.
    Then Glitch Wilds lock if the level says so, and every `per_level` Reactors collected raise the
    level by one (up to the top level) and add `levelup_spins` spins. Locked cells hide whatever
    lands under them. The bonus stops as soon as its total reaches `cap`.
    """
    for r in range(REELS):
        for k in range(ROWS):
            sticky[r, k] = False
    level = start_level
    spins_left = free_spins
    meter = 0
    reactors = 0
    total = 0.0
    n_drop = 0
    played = 0
    g_spin = 1 + np.random.randint(0, free_spins) if guarantee else -1
    while spins_left > 0:
        spins_left -= 1
        played += 1
        spin_reels(strips, lens, grid)
        r_count = 0
        for r in range(REELS):
            for k in range(ROWS):
                mask[r, k] = sticky[r, k]
                if not sticky[r, k] and grid[r, k] == REACTOR:
                    r_count += 1
        reveal_static(grid, sticky, rv_syms, rv_cum)
        n_new = 0
        spin_mult = 1
        n = draw_count(level_cum[level])
        if guarantee and n == 0 and n_drop == 0 and played == g_spin:
            n = 1
        if n > 0:
            n_new = place_overrides(n, sticky, ow_r, ow_k)
            for i in range(n_new):
                # capture: beasts under this Override's shape (not already locked) add multiplier
                for r in range(REELS):
                    for k in range(ROWS):
                        hit = r == ow_r[i] or (shapes[level] == 2 and k == ow_k[i])
                        if hit and not mask[r, k] and grid[r, k] < 4:
                            spin_mult += cap_v[level, draw_count(cap_c[level])]
                            mask[r, k] = True
                add_shape(mask, ow_r[i], ow_k[i], shapes[level])
            if sticky_x[level]:  # the Override's column locks (on Overload the row is one spin only)
                for i in range(n_new):
                    add_shape(sticky, ow_r[i], ow_k[i], 1)
        n_drop += n_new
        total += ways_win(grid, mask, paytable, cnt) * mults[level] * spin_mult
        if total >= cap:
            return cap, played, n_drop, level, reactors + r_count, True
        if sticky_w[level]:
            for r in range(REELS):
                for k in range(ROWS):
                    if grid[r, k] == WILD:
                        sticky[r, k] = True
        reactors += r_count
        meter += r_count
        while meter >= per_level and level < N_LEVELS - 1:
            meter -= per_level
            level += 1
            spins_left += levelup_spins
    if total < min_win:
        total = min(min_win, cap)
    return total, played, n_drop, level, reactors, False


@njit(cache=True)
def bucket(win, edges):
    """Bucket 0 = no win; bucket i >= 1 = (edges[i-2], edges[i-1]]."""
    if win <= 0.0:
        return 0
    return np.searchsorted(edges, win) + 1


@njit(cache=True)
def game_round(
    base_strips, base_lens, bonus_strips, bonus_lens, paytable, base_cum, rv_base_s, rv_base_c,
    rv_bonus_s, rv_bonus_c, level_cum, mults, shapes, cap_v, cap_c, sticky_w, sticky_x, start_by_cores, free_spins,
    per_level, levelup_spins, min_wins, max_win, grid, mask, blocked, sticky, cnt, ow_r, ow_k,
):
    """One full round: a base spin plus any bonus it triggers.

    Returns (total, base win, Override dropped, revealed symbol, start level or -1, final level,
    bonus win, hit max win)."""
    win, cores, n_ow, rev = base_spin(
        base_strips, base_lens, paytable, base_cum, rv_base_s, rv_base_c, grid, mask, blocked, cnt,
        ow_r, ow_k,
    )
    if win > max_win:
        win = max_win
    start = start_by_cores[min(cores, 5)]
    final = -1
    bw = 0.0
    if start >= 0:
        bw, _, _, final, _, _ = bonus_round(
            bonus_strips, bonus_lens, paytable, level_cum, rv_bonus_s, rv_bonus_c, mults, shapes, cap_v, cap_c, sticky_w,
            sticky_x, start, free_spins, per_level, levelup_spins, False, min_wins[start], max_win - win, grid, mask,
            sticky, cnt, ow_r, ow_k,
        )
    total = win + bw
    capped = total >= max_win
    if capped:
        total = max_win
    return total, win, n_ow, rev, start, final, bw, capped


@njit(parallel=True, cache=True)
def simulate_game(
    n_chunks, chunk_size, seed, base_strips, base_lens, bonus_strips, bonus_lens, paytable,
    base_cum, rv_base_s, rv_base_c, rv_bonus_s, rv_bonus_c, level_cum, mults, shapes, cap_v, cap_c, sticky_w, sticky_x,
    start_by_cores, free_spins, per_level, levelup_spins, min_wins, max_win, edges,
):
    """Play n_chunks * chunk_size full game rounds."""
    nb = edges.shape[0] + 1
    tot = np.zeros(n_chunks)
    sq = np.zeros(n_chunks)
    base_part = np.zeros(n_chunks)
    cross_part = np.zeros(n_chunks)
    reveal_part = np.zeros(n_chunks)
    bonus_part = np.zeros((n_chunks, N_LEVELS))
    trig = np.zeros((n_chunks, N_LEVELS), np.int64)
    reach = np.zeros((n_chunks, N_LEVELS), np.int64)
    hits = np.zeros(n_chunks, np.int64)
    drops = np.zeros(n_chunks, np.int64)
    reveals = np.zeros(n_chunks, np.int64)
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
            total, win, n_ow, rev, start, final, bw, capped = game_round(
                base_strips, base_lens, bonus_strips, bonus_lens, paytable, base_cum, rv_base_s,
                rv_base_c, rv_bonus_s, rv_bonus_c, level_cum, mults, shapes, cap_v, cap_c, sticky_w, sticky_x,
                start_by_cores, free_spins, per_level, levelup_spins, min_wins, max_win, grid, mask, blocked,
                sticky, cnt, ow_r, ow_k,
            )
            base_part[c] += win
            if n_ow > 0:
                drops[c] += 1
                cross_part[c] += win
            elif rev >= 0:
                reveals[c] += 1
                reveal_part[c] += win
            if start >= 0:
                trig[c, start] += 1
                reach[c, final] += 1
                bonus_part[c, start] += bw
            if capped:
                maxw[c] += 1
            tot[c] += total
            sq[c] += total * total
            if total > 0.0:
                hits[c] += 1
            b = bucket(total, edges)
            hist[c, b] += 1
            hist_win[c, b] += total
    return (tot, sq, base_part, cross_part, reveal_part, bonus_part, trig, reach, hits, drops,
            reveals, maxw, hist, hist_win)


@njit(parallel=True, cache=True)
def simulate_bonus(
    n_chunks, chunk_size, seed, strips, lens, paytable, level_cum, rv_s, rv_c, mults, shapes, cap_v, cap_c, sticky_w,
    sticky_x, start_level, free_spins, per_level, levelup_spins, min_wins, max_win, edges,
):
    """Play n_chunks * chunk_size bonuses directly from `start_level` (what a bonus buy plays)."""
    nb = edges.shape[0] + 1
    tot = np.zeros(n_chunks)
    sq = np.zeros(n_chunks)
    spins = np.zeros(n_chunks, np.int64)
    drops = np.zeros(n_chunks, np.int64)
    reactors = np.zeros(n_chunks, np.int64)
    reach = np.zeros((n_chunks, N_LEVELS), np.int64)
    reach_win = np.zeros((n_chunks, N_LEVELS))
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
            w, played, nd, final, nr, capped = bonus_round(
                strips, lens, paytable, level_cum, rv_s, rv_c, mults, shapes, cap_v, cap_c, sticky_w, sticky_x,
                start_level, free_spins, per_level, levelup_spins, False, min_wins[start_level], max_win, grid, mask,
                sticky, cnt, ow_r, ow_k,
            )
            tot[c] += w
            sq[c] += w * w
            spins[c] += played
            drops[c] += nd
            reactors[c] += nr
            reach[c, final] += 1
            reach_win[c, final] += w
            if capped:
                maxw[c] += 1
            b = bucket(w, edges)
            hist[c, b] += 1
            hist_win[c, b] += w
    return tot, sq, spins, drops, reactors, reach, reach_win, maxw, hist, hist_win


@njit(parallel=True, cache=True)
def sample_bonus(
    n_chunks, chunk_size, seed, strips, lens, paytable, level_cum, rv_s, rv_c, mults, shapes, cap_v, cap_c, sticky_w,
    sticky_x, start_level, free_spins, per_level, levelup_spins, min_wins, max_win,
):
    """Every bonus round's win and final level (for distributions)."""
    wins = np.zeros(n_chunks * chunk_size)
    finals = np.zeros(n_chunks * chunk_size, np.int64)
    for c in prange(n_chunks):
        np.random.seed(seed + c)
        grid = np.empty((REELS, ROWS), np.int8)
        mask = np.zeros((REELS, ROWS), np.bool_)
        sticky = np.zeros((REELS, ROWS), np.bool_)
        cnt = np.zeros((REELS, N_PAYING + 1), np.int64)
        ow_r = np.zeros(3, np.int64)
        ow_k = np.zeros(3, np.int64)
        for i in range(chunk_size):
            w, _, _, final, _, _ = bonus_round(
                strips, lens, paytable, level_cum, rv_s, rv_c, mults, shapes, cap_v, cap_c, sticky_w, sticky_x,
                start_level, free_spins, per_level, levelup_spins, False, min_wins[start_level], max_win, grid, mask,
                sticky, cnt, ow_r, ow_k,
            )
            wins[c * chunk_size + i] = w
            finals[c * chunk_size + i] = final
    return wins, finals


@njit(parallel=True, cache=True)
def simulate_sessions(
    n_players, n_spins, n_paths, seed, base_strips, base_lens, bonus_strips, bonus_lens, paytable,
    base_cum, rv_base_s, rv_base_c, rv_bonus_s, rv_bonus_c, level_cum, mults, shapes, cap_v, cap_c, sticky_w, sticky_x,
    start_by_cores, free_spins, per_level, levelup_spins, min_wins, max_win,
):
    """Each player makes n_spins bets of 1. Returns every player's final net result and the running
    balance path of the first n_paths players."""
    net = np.zeros(n_players)
    paths = np.zeros((n_paths, n_spins))
    for p in prange(n_players):
        np.random.seed(seed + p)
        grid = np.empty((REELS, ROWS), np.int8)
        mask = np.zeros((REELS, ROWS), np.bool_)
        blocked = np.zeros((REELS, ROWS), np.bool_)
        sticky = np.zeros((REELS, ROWS), np.bool_)
        cnt = np.zeros((REELS, N_PAYING + 1), np.int64)
        ow_r = np.zeros(3, np.int64)
        ow_k = np.zeros(3, np.int64)
        bal = 0.0
        for i in range(n_spins):
            total, _, _, _, _, _, _, _ = game_round(
                base_strips, base_lens, bonus_strips, bonus_lens, paytable, base_cum, rv_base_s,
                rv_base_c, rv_bonus_s, rv_bonus_c, level_cum, mults, shapes, cap_v, cap_c, sticky_w, sticky_x,
                start_by_cores, free_spins, per_level, levelup_spins, min_wins, max_win, grid, mask, blocked,
                sticky, cnt, ow_r, ow_k,
            )
            bal += total - 1.0
            if p < n_paths:
                paths[p, i] = bal
        net[p] = bal
    return net, paths
