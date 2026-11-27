import itertools

import numpy as np
import pytest
from numba import njit

from bootleg_beasts import engine, exact
from bootleg_beasts.config import (
    BASE_WILD_MULT_MEAN,
    CODE_TO_ID,
    CORE,
    H1,
    HOLD_FOREVER,
    L5,
    N_PAYING,
    PAYTABLE,
    REELS,
    ROWS,
    STATIC,
    WILD,
    Model,
    ReelSet,
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
EVERY_SPIN = [0, 1, 0]  # Net Wild drop weights: always one
NEVER = [1, 0, 0]


def _bonus(reels, start_level, weights=NEVER, paytable=None, catch=None, seed=11):
    """Play one bonus on hand-built reels. Returns (win, played, nets, final level, Cores, caught,
    final multiplier, capped) and the final hold timers."""
    lens = np.array([len(r) for r in reels], dtype=np.int64)
    strips = np.full((REELS, max(lens)), CODE_TO_ID["L5"], dtype=np.int8)
    for r, reel in enumerate(reels):
        strips[r, : len(reel)] = [CODE_TO_ID[c] for c in reel]
    level_cum = np.tile(np.cumsum(np.array(weights, dtype=np.int64)), (4, 1))
    cv, hold, doubles = level_arrays()
    if catch is not None:
        cv = np.array(catch, np.int64)
    timer = np.zeros(REELS, np.int64)
    pt = np.zeros_like(PAYTABLE) if paytable is None else paytable
    _seed(seed)
    res = engine.bonus_round(
        strips, lens, pt, level_cum, np.array([L5], np.int64), np.array([1], np.int64), cv, hold, doubles,
        start_level, 10, 3, 3, 0.0, 5000.0, np.empty((REELS, ROWS), np.int8), no_mask(), timer, scratch(),
        np.zeros(3, np.int64), np.zeros(3, np.int64),
    )
    return res, timer


ONE_CORE = [["L5"] * 5, ["R", "L5", "L5", "L5", "L5"]] + [["L5"] * 5] * 3  # exactly one bonus Core per spin


def test_cores_level_up_and_add_spins():
    (total, played, nets, final, cores, caught, mult, capped), _ = _bonus(ONE_CORE, 0)
    # Levels at 3, 6 and 9 Cores, +3 spins each: 10 + 9 spins, top level reached.
    assert (played, final, cores) == (19, 3, 19)


def test_no_nets_no_multiplier():
    pt = np.zeros_like(PAYTABLE)
    pt[L5, 5] = 0.001  # 5 L5 on reel 1, the Core reel shows 4: 5*4*5*5*5 = 2500 ways = 2.5x per spin
    (total, played, nets, final, cores, caught, mult, capped), _ = _bonus(ONE_CORE, 0, paytable=pt)
    assert mult == 2 and nets == 0  # reaching Overload doubles the x1 multiplier
    # Overload arrives after spin 9 (the 9th Core): spins 1-9 pay x1, spins 10-19 pay x2
    assert total == pytest.approx(9 * 2.5 + 10 * 2.5 * 2)


def test_catch_multiplier_never_resets():
    """A Net every spin on reels full of beasts catches all 5 beasts of its reel: +5 per spin at +1
    per catch, so spin i pays x(1 + 5i) and nothing resets."""
    pt = np.zeros_like(PAYTABLE)
    pt[H1, 5] = 0.001
    beasts = [["H1"] * 5] * 5
    (total, played, nets, final, cores, caught, mult, capped), _ = _bonus(
        beasts, 0, EVERY_SPIN, paytable=pt, catch=[1, 1, 1, 1])
    assert (played, nets, caught, mult) == (10, 10, 50, 51)
    assert total == pytest.approx(sum(1 + 5 * i for i in range(1, 11)) * 3.125)


def test_catch_value_by_level():
    beasts = [["H1"] * 5] * 5
    for level, per in ((0, 1), (1, 1), (2, 2)):
        (_, played, nets, _, _, caught, mult, _), _ = _bonus(beasts, level, EVERY_SPIN)
        assert (nets, caught, mult) == (10, 50, 1 + 50 * per)
    (_, _, nets, _, _, caught, mult, _), _ = _bonus(beasts, 3, EVERY_SPIN)
    assert mult == 1 + 50 * 3


def test_nets_hit_netted_reels_on_every_level():
    """Nets can land on a reel that is already netted, so every level gets a Net every spin here
    (the old design blocked locked reels, so higher levels saw fewer)."""
    dead = [["L5"] * 5] * 5
    for level in range(4):
        (_, played, nets, *_), _ = _bonus(dead, level, EVERY_SPIN)
        assert nets == played == 10


def test_holds_by_level():
    dead = [["L5"] * 5] * 5
    one_net = [0, 1, 0]
    # Street Hunt: no hold, nothing stays netted
    _, timer = _bonus(dead, 0, one_net)
    assert not timer.any()
    # Overload: every netted reel holds for good
    _, timer = _bonus(dead, 3, one_net)
    assert set(timer[1:4].tolist()) == {HOLD_FOREVER} and timer[0] == timer[4] == 0


def test_hold_makes_reel_wild_next_spin():
    """A Night Raid Net holds its reel one more spin: with a wild-only win on reel 1..5 of L5 the win
    needs the netted reel, so held spins pay too."""
    pt = np.zeros_like(PAYTABLE)
    pt[L5, 5] = 0.001
    reels = [["L5"] * 5, ["L5"] * 5, ["L4"] * 5, ["L5"] * 5, ["L5"] * 5]  # reel 3 blocks every L5 win
    w0, _ = _bonus(reels, 0, EVERY_SPIN, paytable=pt, seed=5)
    w1, _ = _bonus(reels, 1, EVERY_SPIN, paytable=pt, seed=5)
    # with a Net every spin both win on the spins where reel 3 is netted; Night Raid's holds can only add
    assert w1[0] >= w0[0] > 0


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


@pytest.mark.parametrize("weight", [1.0, BASE_WILD_MULT_MEAN])
@pytest.mark.parametrize("R,cross,reveal", CONFIGS)
def test_factorised_formula_matches_full_cycle(R, cross, reveal, weight):
    m = tiny_model()
    Ec, P0 = exact.count_tables(m.base, reveal, weight)
    assert exact.expected_win(Ec, P0, PAYTABLE, R, cross) == pytest.approx(
        exact.enumerate_base(m, R, cross, reveal, wild_weight=weight)["rtp"], rel=1e-12
    )


def test_base_wild_multipliers_average_to_their_mean():
    """ways_win_base draws a multiplier per Glitch Wild; on average a wild counts its mean."""
    g = np.full((REELS, ROWS), CORE, np.int8)  # non-paying filler
    g[:, 0] = H1
    g[1, 1] = WILD  # reel 2: one H1 and one wild
    _seed(5)
    n = 200_000
    mean = np.mean([engine.ways_win_base(g, no_mask(), PAYTABLE, scratch()) for _ in range(n)])
    expect = PAYTABLE[H1, 5] * (1 + BASE_WILD_MULT_MEAN)
    assert mean == pytest.approx(expect, rel=0.01)
    mask = no_mask()
    mask[1, 1] = True  # under an Override the wild counts once
    assert engine.ways_win_base(g, mask, PAYTABLE, scratch()) == pytest.approx(PAYTABLE[H1, 5] * 2)


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
    assert np.mean(wins) == pytest.approx(exact.enumerate_base(m, R, cross, reveal, wild_weight=1.0)["rtp"], rel=1e-12)


def test_core_distribution():
    p = np.full(REELS, 0.08)
    d = exact.core_count_distribution(p)
    assert d.sum() == pytest.approx(1.0)
    assert d[3] == pytest.approx(10 * 0.08**3 * 0.92**2)
    assert d[5] == pytest.approx(0.08**5)
