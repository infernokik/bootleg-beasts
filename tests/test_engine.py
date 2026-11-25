import itertools

import numpy as np
import pytest
from numba import njit

from bootleg_beasts import engine, exact
from bootleg_beasts.config import (
    CODE_TO_ID,
    CORE,
    H1,
    L5,
    N_PAYING,
    PAYTABLE,
    REELS,
    ROWS,
    STATIC,
    WILD,
    Model,
    ReelSet,
    capture_arrays,
    level_arrays,
)


@njit
def _seed(s):
    np.random.seed(s)


def empty_grid():
    """A grid of Capture Cores: nothing on it pays."""
    return np.full((REELS, ROWS), CORE, dtype=np.int8)


def no_mask():
    return np.zeros((REELS, ROWS), dtype=np.bool_)


def scratch():
    return np.zeros((REELS, N_PAYING + 1), dtype=np.int64)


def win(grid, mask=None, paytable=PAYTABLE):
    return engine.ways_win(grid, no_mask() if mask is None else mask, paytable, scratch())


# ---- Ways evaluation ---------------------------------------------------------
def test_three_of_a_kind_one_way():
    g = empty_grid()
    g[0, 0] = g[1, 3] = g[2, 4] = H1
    assert win(g) == pytest.approx(PAYTABLE[H1, 3])


def test_ways_multiply():
    g = empty_grid()
    g[0, 0] = g[0, 1] = H1
    g[1, 2] = H1
    g[2, 0] = g[2, 2] = g[2, 4] = H1
    assert win(g) == pytest.approx(6 * PAYTABLE[H1, 3])


def test_two_reels_pay_nothing():
    g = empty_grid()
    g[0, 0] = g[1, 0] = H1
    assert win(g) == 0.0


def test_run_must_start_on_reel_one():
    g = empty_grid()
    g[1, 0] = g[2, 0] = g[3, 0] = g[4, 0] = H1
    assert win(g) == 0.0


def test_glitch_wild_substitutes():
    g = empty_grid()
    g[0, 0] = H1
    g[1, 2] = WILD
    g[2, 1] = H1
    assert win(g) == pytest.approx(PAYTABLE[H1, 3])


# ---- Override Wild cross -----------------------------------------------------
def test_cross_covers_row_and_column():
    m = no_mask()
    engine.add_cross(m, 2, 1)
    assert m.sum() == 9
    assert m[2, :].all() and m[:, 1].all()


def test_single_cross_minimum_win():
    """One cross on an otherwise dead screen: every symbol gets 1*1*5*1*1 = 5 ways of 5."""
    m = no_mask()
    engine.add_cross(m, 2, 1)
    assert win(empty_grid(), m) == pytest.approx(5 * PAYTABLE[:, 5].sum())


def test_place_overrides_rules():
    out_r = np.zeros(3, np.int64)
    out_k = np.zeros(3, np.int64)
    for seed in range(200):
        _seed(seed)
        blocked = no_mask()
        blocked[2, :] = True
        blocked[:, 4] = True
        n = engine.place_overrides(2, blocked, out_r, out_k)
        assert n == 2
        reels = set(out_r[:n].tolist())
        assert len(reels) == 2 and reels <= {1, 3}
        for i in range(n):
            assert not blocked[out_r[i], out_k[i]]


# ---- Static reveal -------------------------------------------------------------
def test_static_reveals_to_one_symbol_except_blocked():
    g = empty_grid()
    g[0, 0] = g[3, 2] = g[4, 4] = STATIC
    blocked = no_mask()
    blocked[4, 4] = True
    syms = np.array([H1, L5], dtype=np.int64)
    cum = np.cumsum(np.array([1, 1], dtype=np.int64))
    _seed(3)
    m = engine.reveal_static(g, blocked, syms, cum)
    assert m in (H1, L5)
    assert g[0, 0] == m and g[3, 2] == m and g[4, 4] == STATIC


def test_no_static_reveals_nothing():
    g = empty_grid()
    syms = np.array([H1], dtype=np.int64)
    assert engine.reveal_static(g, no_mask(), syms, np.array([1], dtype=np.int64)) == -1


# ---- Bonus levels ----------------------------------------------------------------
EVERY_SPIN = [0, 1, 0]  # Override Wild drop weights: always one
NEVER = [1, 0, 0]


def _bonus(reels, start_level, weights=NEVER, guarantee=False, paytable=None, cap=None):
    """Play one bonus on hand-built reels. Returns the result and the final locked-cell grid."""
    lens = np.array([len(r) for r in reels], dtype=np.int64)
    strips = np.full((REELS, max(lens)), CODE_TO_ID["L5"], dtype=np.int8)
    for r, reel in enumerate(reels):
        strips[r, : len(reel)] = [CODE_TO_ID[c] for c in reel]
    level_cum = np.tile(np.cumsum(np.array(weights, dtype=np.int64)), (4, 1))
    mults, shapes, sw, sx = level_arrays()
    cv, cc = capture_arrays() if cap is None else cap
    sticky = no_mask()
    pt = np.zeros_like(PAYTABLE) if paytable is None else paytable
    _seed(11)
    res = engine.bonus_round(
        strips, lens, pt, level_cum, np.array([L5], np.int64), np.array([1], np.int64), mults,
        shapes, cv, cc, sw, sx, start_level, 10, 3, 4, guarantee, 0.0, 5000.0, np.empty((REELS, ROWS), np.int8), no_mask(),
        sticky, scratch(), np.zeros(3, np.int64), np.zeros(3, np.int64),
    )
    return res, sticky


ONE_REACTOR = [["R", "L5", "L5", "L5", "L5"]] + [["L5"] * 5] * 4  # exactly one Reactor per spin


def test_reactors_level_up_and_add_spins():
    (total, played, drops, final, reactors, capped), _ = _bonus(ONE_REACTOR, 0)
    # Levels at 3, 6 and 9 Reactors, +4 spins each: 10 + 12 spins, top level reached.
    assert (played, final, reactors) == (22, 3, 22)


def test_no_flat_level_multiplier():
    pt = np.zeros_like(PAYTABLE)
    pt[L5, 5] = 0.001  # reel 1 shows 4 L5 + the Reactor: 4*5*5*5*5 = 2500 ways = 2.5x per spin
    (total, *_), _ = _bonus(ONE_REACTOR, 0, paytable=pt)
    assert total == pytest.approx(22 * 2.5)


def test_captured_beasts_stack_multipliers():
    """Street Hunt column drops every spin on reels full of beasts: each drop captures all 5
    beasts in its column, including the one it lands on: x(1 + 5*2) = x11."""
    pt = np.zeros_like(PAYTABLE)
    pt[H1, 5] = 0.001
    reels = [["H1"] * 5] * 5
    two = (np.full((4, 3), 2, np.int64), np.cumsum(np.ones((4, 3), np.int64), axis=1))
    zero = (np.zeros((4, 3), np.int64), np.cumsum(np.ones((4, 3), np.int64), axis=1))
    (with_cap, *_), _ = _bonus(reels, 0, EVERY_SPIN, paytable=pt, cap=two)
    (no_cap, *_), _ = _bonus(reels, 0, EVERY_SPIN, paytable=pt, cap=zero)
    assert with_cap == pytest.approx(11 * no_cap)


def test_starting_level_skips_ahead():
    (total, played, drops, final, reactors, capped), _ = _bonus(ONE_REACTOR, 2)
    assert (played, final) == (14, 3)


def test_only_overload_locks_glitch_wilds():
    reels = [["L5"] * 5, ["W", "L5", "L5", "L5", "L5", "L5", "L5"]] + [["L5"] * 5] * 3
    _, sticky = _bonus(reels, 3)
    assert sticky[1].any() and not sticky[0].any() and not sticky[2:].any()
    for level in (0, 1, 2):  # wilds only lock on Overload
        _, sticky = _bonus(reels, level)
        assert not sticky.any()


def test_lockdown_locks_override_columns():
    dead = [["L5"] * 5] * 5
    (_, _, drops, _, _, _), sticky = _bonus(dead, 2, EVERY_SPIN)
    assert drops == 3 and sticky[1:4].all() and not sticky[0].any()  # each locked column fills one of reels 2-4
    (_, _, drops, _, _, _), sticky = _bonus(dead, 3, EVERY_SPIN)  # Overload: crosses, but only the column locks
    assert drops == 3 and sticky[1:4].all() and not sticky[0].any() and not sticky[4].any()
    for level in (0, 1):
        (_, _, drops, _, _, _), sticky = _bonus(dead, level, EVERY_SPIN)
        assert drops == 10 and not sticky.any()


def test_guaranteed_cross():
    dead = [["L5"] * 5] * 5
    for seed in range(20):
        (_, _, drops, _, _, _), _ = _bonus(dead, 0, NEVER, guarantee=True)
        assert drops == 1


# ---- Exact maths vs brute force ------------------------------------------------
TINY = [
    ["H1", "L1", "H2", "H1", "L3", "S", "H4", "X"],
    ["H1", "W", "L1", "H3", "X", "H1", "L2", "S"],
    ["L1", "H1", "W", "H2", "L4", "X", "H1", "L5"],
    ["H2", "H1", "L1", "W", "L5", "S", "H3"],
    ["H1", "L2", "H2", "X", "L1", "W", "H4", "L3"],
]


def tiny_model():
    return Model("test", {"base": ReelSet.from_codes(TINY)}, {"base": [1, 0, 0]},
                 {"base": {"H1": 1}}, {})


CONFIGS = [(0, frozenset(), None), (1 << 1, frozenset({2}), H1), (1 << 4, frozenset({1}), L5),
           (0b1001, frozenset({1, 3}), WILD)]


@pytest.mark.parametrize("R,cross,reveal", CONFIGS)
def test_factorised_formula_matches_full_cycle(R, cross, reveal):
    m = tiny_model()
    Ec, P0 = exact.count_tables(m.base, reveal)
    assert exact.expected_win(Ec, P0, PAYTABLE, R, cross) == pytest.approx(
        exact.enumerate_base(m, R, cross, reveal)["rtp"], rel=1e-12
    )


def test_full_cycle_matches_engine_evaluation():
    """Independent path: build every grid, reveal Static, score it with the engine's ways_win."""
    m = tiny_model()
    R, cross, reveal = 1 << 1, frozenset({2}), H1
    mask = no_mask()
    for r in cross:
        mask[r, :] = True
    for k in range(ROWS):
        if (R >> k) & 1:
            mask[:, k] = True
    wins = []
    by_reel = [exact.windows(m.base, r) for r in range(REELS)]
    for stops in itertools.product(*(range(int(n)) for n in m.base.lens)):
        g = np.stack([by_reel[r][s] for r, s in enumerate(stops)]).astype(np.int8)
        g[g == STATIC] = reveal
        wins.append(win(g, mask))
    assert np.mean(wins) == pytest.approx(exact.enumerate_base(m, R, cross, reveal)["rtp"], rel=1e-12)


def test_core_distribution():
    p = np.full(REELS, 0.08)
    d = exact.core_count_distribution(p)
    assert d.sum() == pytest.approx(1.0)
    assert d[3] == pytest.approx(10 * 0.08**3 * 0.92**2)
    assert d[5] == pytest.approx(0.08**5)
