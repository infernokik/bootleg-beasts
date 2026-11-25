"""Turn the AI-generated symbol art into pixel art with one shared palette.

Each source image is shrunk onto a GRID x GRID pixel grid (box-averaged, so every output pixel is
the average colour of the block it covers), then every pixel is snapped to a palette shared by the
whole symbol set. The shared palette is what makes images from different prompts look like one game.

Outputs are tiny PNGs (GRID x GRID). The browser scales them up with `image-rendering: pixelated`,
so they stay crisp at any size.

Run:  .venv\\Scripts\\python.exe art\\pixelate.py [--grid 96] [--colors 64] [--preview sheet.png]
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art" / "gemini"
OUT = ROOT / "web" / "assets" / "symbols"

# Source file stem prefix -> symbol code used by the game
CODES = ["H1", "H2", "H3", "H4", "L1", "L2", "L3", "L4", "L5", "W", "OW", "S", "X", "R"]
# Colours every symbol must be able to use: the tile background navy, outline black, white.
FIXED = [(11, 13, 30), (6, 6, 12), (245, 245, 250)]


def find_sources() -> dict[str, Path]:
    found = {}
    for p in sorted(SRC.iterdir()):
        code = p.stem.split("_", 1)[0]
        if code in CODES and p.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}:
            found[code] = p
    return found


def load(path: Path) -> Image.Image:
    im = Image.open(path).convert("RGB")
    s = min(im.size)
    left, top = (im.width - s) // 2, (im.height - s) // 2
    im = im.crop((left, top, left + s, top + s))
    im = ImageEnhance.Color(im).enhance(1.15)
    return ImageEnhance.Contrast(im).enhance(1.08)


def shrink(im: Image.Image, grid: int) -> Image.Image:
    return im.resize((grid, grid), Image.Resampling.BOX)


def shared_palette(smalls: list[Image.Image], colors: int) -> Image.Image:
    """Median-cut + k-means palette over all symbols at once, plus the fixed colours."""
    g = smalls[0].width
    mosaic = Image.new("RGB", (g * len(smalls), g + 4))
    for i, im in enumerate(smalls):
        mosaic.paste(im, (i * g, 0))
    strip = np.zeros((4, mosaic.width, 3), np.uint8)
    for i, c in enumerate(FIXED):
        strip[:, i * mosaic.width // len(FIXED): (i + 1) * mosaic.width // len(FIXED)] = c
    mosaic.paste(Image.fromarray(strip), (0, g))
    return mosaic.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, kmeans=8)


def to_palette(small: Image.Image, pal: Image.Image) -> Image.Image:
    return small.quantize(palette=pal, dither=Image.Dither.NONE)


def static_tile(grid: int, pal: Image.Image, seed: int = 7) -> Image.Image:
    """Fallback for the non-paying Static symbol when there's no source art: procedural TV noise."""
    rng = np.random.default_rng(seed)
    noise = rng.integers(40, 150, (grid, grid)).astype(np.uint8)
    noise[rng.random(grid) < 0.12] //= 2  # a few dark scanlines
    rgb = np.stack([noise, noise, (noise * 1.08).clip(0, 255).astype(np.uint8)], -1)
    border = max(2, grid // 16)
    rgb[:border], rgb[-border:], rgb[:, :border], rgb[:, -border:] = 25, 25, 25, 25
    return to_palette(Image.fromarray(rgb), pal)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--grid", type=int, default=96)
    ap.add_argument("--colors", type=int, default=64)
    ap.add_argument("--preview", type=Path, help="also write a contact sheet here")
    args = ap.parse_args()

    sources = find_sources()
    smalls = {code: shrink(load(p), args.grid) for code, p in sources.items()}
    pal = shared_palette(list(smalls.values()), args.colors)
    out = {code: to_palette(im, pal) for code, im in smalls.items()}
    if "X" not in out:
        out["X"] = static_tile(args.grid, pal)

    OUT.mkdir(parents=True, exist_ok=True)
    for code, im in out.items():
        im.save(OUT / f"{code}.png", optimize=True)
    (OUT / "manifest.json").write_text(
        json.dumps({"grid": args.grid, "colors": args.colors, "codes": sorted(out)}), encoding="utf-8"
    )
    total = sum((OUT / f"{c}.png").stat().st_size for c in out)
    print(f"{len(out)} symbols at {args.grid}x{args.grid}, {args.colors} colours, {total / 1024:.1f} KB total")
    missing = [c for c in CODES if c not in sources]
    if missing:
        print("No source art yet for:", ", ".join(missing))

    if args.preview:
        scale = 4
        codes = sorted(out, key=CODES.index)
        sheet = Image.new("RGB", (len(codes) * args.grid * scale, args.grid * scale))
        for i, c in enumerate(codes):
            big = out[c].convert("RGB").resize((args.grid * scale,) * 2, Image.Resampling.NEAREST)
            sheet.paste(big, (i * args.grid * scale, 0))
        sheet.save(args.preview)


if __name__ == "__main__":
    main()
