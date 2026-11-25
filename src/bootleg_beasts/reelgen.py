"""Build reel strips from a symbol composition.

Paying symbols are laid out in stacks (blocks of the same symbol). Glitch Wilds and Capture Cores are
single symbols placed between stacks, so they never split a stack. A strip never has two stacks of
the same symbol next to each other, and Capture Cores are at least ROWS apart, so a 5-row window can
show at most one Core per reel.
"""

from __future__ import annotations

import numpy as np

from .config import ROWS

SINGLE_SYMBOLS = ("W", "S")


def _min_circular_gap(strip: list[str], code: str) -> int:
    pos = [i for i, c in enumerate(strip) if c == code]
    if len(pos) < 2:
        return len(strip)
    gaps = [b - a for a, b in zip(pos, pos[1:])] + [pos[0] + len(strip) - pos[-1]]
    return min(gaps)


def build_strip(
    stacks: dict[str, list[int]], singles: dict[str, int], seed: int, max_tries: int = 20_000
) -> list[str]:
    """Return a strip (list of symbol codes) built from `stacks` and `singles`.

    stacks:  paying symbol code -> list of stack sizes, e.g. {"H1": [3, 2]}
    singles: "W" / "S" -> how many to place between stacks
    """
    rng = np.random.default_rng(seed)
    blocks = [(code, size) for code, sizes in stacks.items() for size in sizes]
    single_list = [code for code, n in singles.items() for _ in range(n)]
    if len(single_list) > len(blocks):
        raise ValueError("more single symbols than stack boundaries")

    for _ in range(max_tries):
        seq = [blocks[i] for i in rng.permutation(len(blocks))]
        if any(seq[i][0] == seq[(i + 1) % len(seq)][0] for i in range(len(seq))):
            continue
        slots = rng.choice(len(seq), size=len(single_list), replace=False)
        fill = list(single_list)
        rng.shuffle(fill)
        after = dict(zip(slots.tolist(), fill))
        strip: list[str] = []
        for i, (code, size) in enumerate(seq):
            strip.extend([code] * size)
            if i in after:
                strip.append(after[i])
        if _min_circular_gap(strip, "S") >= ROWS:
            return strip
    raise RuntimeError("could not build a strip that meets the spacing rules")
