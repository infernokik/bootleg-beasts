import itertools

import numpy as np
import pytest
from numba import njit

from glitch_tamers import engine, exact
from glitch_tamers.config import (
    CODE_TO_ID,
    CORE,
    H1,
    N_PAYING,
    PAYTABLE,
    REELS,
    ROWS,
    TIERS,
    WILD,
    Model,
    ReelSet,
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


def win(grid, mask=None):
    return engine.ways_win(grid, no_mask() if mask is None else mask, PAYTABLE, scratch())


# ---- Ways evaluation ---------------------------------------------------------
def test_three_of_a_kind_one_way():
    g = empty_grid()
    g[0, 0] = g[1, 3] = g[2, 4] = H1
    assert win(g) == pytest.approx(PAYTABLE[H1, 3])


def test_ways_multiply():
    g = empty_grid()
    g[0, 0] = g[0, 1] = H1  # 2 on reel 1
    g[1, 2] = H1  # 1 on reel 2
    g[2, 0] = g[2, 2] = g[2, 4] = H1  # 3 on reel 3
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
    assert win(empty_grid(), m) == pytest.approx(24.25)


def test_place_overrides_rules():
    out_r = np.zeros(3, np.int64)
    out_k = np.zeros(3, np.int64)
    for seed in range(200):
        _seed(seed)
        blocked = no_mask()
        blocked[2, :] = True  # reel 3 fully blocked
        blocked[:, 4] = True  # bottom row blocked
        n = engine.place_overrides(2, blocked, out_r, out_k)
        assert n == 2
        reels = set(out_r[:n].tolist())
        assert len(reels) == 2 and reels <= {1, 3}
        for i in range(n):
            assert not blocked[out_r[i], out_k[i]]


# ---- Bonus rules -------------------------------------------------------------
EVERY_SPIN = [0, 1, 0]  # Override Wild drop weights: always one
NEVER = [1, 0, 0]  # never


def _bonus(tier_index, weights=EVERY_SPIN):
    """Bonus on dead reels with a zero paytable. Returns the result and the final sticky grid."""
    tier = TIERS[tier_index]
    strips = np.full((REELS, 8), CODE_TO_ID["L5"], dtype=np.int8)
    lens = np.full(REELS, 8, dtype=np.int64)
    cum = np.cumsum(np.array(weights, dtype=np.int64))
    sticky = no_mask()
    _seed(7)
    result = engine.bonus_round(
        strips, lens, np.zeros_like(PAYTABLE), cum, tier.free_spins, tier.sticky_mode,
        tier.mult_step, tier.preplaced_crosses, tier.guaranteed_cross, 3, 4, 10_000.0,
        np.empty((REELS, ROWS), np.int8), no_mask(), sticky, scratch(), np.zeros(3, np.int64),
        np.zeros(3, np.int64),
    )
    return result, sticky


def test_street_hunt_drops_every_spin_nothing_sticks():
    (total, played, drops, mult, capped), sticky = _bonus(0)
    assert (played, drops) == (10, 10)
    assert not sticky.any()


def test_night_raid_columns_stick():
    (total, played, drops, mult, capped), sticky = _bonus(1)
    # Each drop locks one of reels 2-4 wild, so only three can ever drop.
    assert (played, drops, mult) == (10, 3, 4)
    assert sticky[1:4, :].all() and not sticky[0].any() and not sticky[4].any()


def test_legendary_starts_with_a_cross_and_double_steps():
    (total, played, drops, mult, capped), sticky = _bonus(2)
    assert (played, drops, mult) == (10, 2, 5)
    # Full sticky crosses: reels 2-4 locked, plus three locked rows on reels 1 and 5.
    assert sticky[1:4, :].all() and sticky[0].sum() == 3 and sticky[4].sum() == 3


def test_street_hunt_has_no_multiplier():
    (total, played, drops, mult, capped), sticky = _bonus(0)
    assert mult == 1


@pytest.mark.parametrize("tier_index,expected_drops", [(0, 1), (1, 1), (2, 0)])
def test_guaranteed_cross_on_last_spin(tier_index, expected_drops):
    (total, played, drops, mult, capped), _ = _bonus(tier_index, NEVER)
    assert played == 10 and drops == expected_drops


# ---- Exact maths vs brute force ------------------------------------------------
TINY = [
    ["H1", "L1", "H2", "H1", "L3", "S", "H4"],
    ["H1", "W", "L1", "H3", "H1", "L2", "S"],
    ["L1", "H1", "W", "H2", "L4", "H1", "L5"],
    ["H2", "H1", "L1", "W", "L5", "S", "H3"],
    ["H1", "L2", "H2", "L1", "W", "H4", "L3"],
]


def tiny_model():
    return Model("test", {"base": ReelSet.from_codes(TINY)}, {"base": [1, 0, 0]})


CONFIGS = [(0, frozenset()), (1 << 1, frozenset({2})), (1 << 4, frozenset({1})), (0b1001, frozenset({1, 3}))]


@pytest.mark.parametrize("R,cross", CONFIGS)
def test_factorised_formula_matches_full_cycle(R, cross):
    m = tiny_model()
    Ec, P0 = exact.count_tables(m.base)
    assert exact.expected_win(Ec, P0, PAYTABLE, R, cross) == pytest.approx(
        exact.enumerate_base(m, R, cross)["rtp"], rel=1e-12
    )


def test_full_cycle_matches_engine_evaluation():
    """Independent path: build every grid and score it with the engine's ways_win."""
    m = tiny_model()
    R, cross = 1 << 1, frozenset({2})
    mask = no_mask()
    for r in cross:
        mask[r, :] = True
    for k in range(ROWS):
        if (R >> k) & 1:
            mask[:, k] = True
    wins = []
    wins_by_reel = [exact.windows(m.base, r) for r in range(REELS)]
    for stops in itertools.product(*(range(int(n)) for n in m.base.lens)):
        g = np.stack([wins_by_reel[r][s] for r, s in enumerate(stops)]).astype(np.int8)
        wins.append(win(g, mask))
    assert np.mean(wins) == pytest.approx(exact.enumerate_base(m, R, cross)["rtp"], rel=1e-12)


def test_core_distribution():
    p = np.full(REELS, 0.08)
    d = exact.core_count_distribution(p)
    assert d.sum() == pytest.approx(1.0)
    assert d[3] == pytest.approx(10 * 0.08**3 * 0.92**2)
    assert d[5] == pytest.approx(0.08**5)
