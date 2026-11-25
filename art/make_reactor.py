"""Draw the Reactor symbol as pixel art (96x96), saved as a 1024px source for art/pixelate.py.

A hazard-striped canister with a glowing green core, matching the Capture Core's industrial style.
Run:  .venv\\Scripts\\python.exe art\\make_reactor.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

G = 96
img = Image.new("RGB", (G, G), (11, 13, 30))
d = ImageDraw.Draw(img)
INK = (8, 6, 16)
STEEL, STEEL_D, STEEL_L = (120, 124, 150), (70, 72, 96), (190, 194, 214)
YEL, GLOW, CORE, HOT = (255, 197, 49), (40, 200, 90), (120, 255, 120), (230, 255, 200)

# outer glow
for r, a in [(44, 26), (40, 40), (36, 60)]:
    d.ellipse([48 - r, 50 - r, 48 + r, 50 + r], fill=(14, 40 + a, 30 + a // 2))
# end caps
for y0 in (10, 72):
    d.rectangle([22, y0, 73, y0 + 13], fill=STEEL_D, outline=INK, width=2)
    for x in range(26, 70, 8):  # hazard stripes
        d.polygon([(x, y0 + 2), (x + 4, y0 + 2), (x, y0 + 11), (x - 4, y0 + 11)], fill=YEL)
    d.rectangle([22, y0, 73, y0 + 13], outline=INK, width=2)
# glass tube
d.rectangle([28, 23, 67, 72], fill=(20, 60, 40), outline=INK, width=2)
d.rectangle([31, 26, 64, 69], fill=GLOW)
# core: stacked glowing rings
for y in range(28, 68, 6):
    d.rectangle([35, y, 60, y + 3], fill=CORE)
d.ellipse([39, 38, 56, 57], fill=HOT, outline=CORE, width=2)
d.rectangle([46, 44, 49, 51], fill=(255, 255, 255))
# side rails and bolts
for x in (24, 68):
    d.rectangle([x, 23, x + 3, 72], fill=STEEL, outline=INK)
for x, y in [(25, 14), (68, 14), (25, 76), (68, 76)]:
    d.rectangle([x, y, x + 2, y + 2], fill=STEEL_L)
# glass highlight
d.rectangle([33, 28, 34, 66], fill=(200, 255, 210))
# radiation pips
for x, y in [(12, 46), (82, 46), (47, 4), (47, 89)]:
    d.rectangle([x, y, x + 2, y + 2], fill=CORE)

out = Path(__file__).resolve().parent / "gemini" / "R_reactor.png"
img.resize((1024, 1024), Image.Resampling.NEAREST).save(out)
print(out)
