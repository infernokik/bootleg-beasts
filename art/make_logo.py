"""Make the web logo: remove the black background (colour-to-alpha) and resize.

Run:  .venv\\Scripts\\python.exe art\\make_logo.py
"""

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
src = Image.open(ROOT / "art" / "gemini" / "logo.webp").convert("RGB")
a = np.asarray(src).astype(np.float32) / 255.0
alpha = a.max(axis=2)  # black -> transparent, bright -> opaque
rgb = np.where(alpha[..., None] > 0, a / np.maximum(alpha[..., None], 1e-6), 0)
out = np.dstack([rgb, alpha]).clip(0, 1)
img = Image.fromarray((out * 255).astype(np.uint8), "RGBA")
img = img.resize((900, round(900 * img.height / img.width)), Image.Resampling.LANCZOS)
dest = ROOT / "web" / "assets" / "logo.webp"
img.save(dest, quality=90)
print(dest, img.size, dest.stat().st_size // 1024, "KB")
