// Animated pixel-art city behind the game: a synthwave sun, three skyline layers with lit windows,
// flickering neon signs, hover cars and rain. Drawn at low resolution, scaled up with crisp pixels.

const PX = 3; // screen pixels per art pixel
const WINDOW_COLOURS = ["#ffd86b", "#21f0ff", "#ff5ce1", "#b197fc", "#ffe9b0"];
const SIGN_COLOURS = ["#ff2bd6", "#21f0ff", "#ffc531", "#b6ff3b"];

function rng(seed) {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
}

export function startBackground(canvas) {
  const ctx = canvas.getContext("2d");
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let W, H, base, flickers, signs, drops, cars;

  function build() {
    W = Math.max(64, Math.ceil((innerWidth || document.documentElement.clientWidth || 1280) / PX));
    H = Math.max(48, Math.ceil((innerHeight || document.documentElement.clientHeight || 720) / PX));
    canvas.width = W;
    canvas.height = H;
    const rand = rng(1337);
    base = document.createElement("canvas");
    base.width = W;
    base.height = H;
    const o = base.getContext("2d");

    // Sky: banded gradient with dithered seams
    const bands = ["#08041a", "#0d0626", "#140832", "#1d0a3c", "#290c45", "#360d4a", "#43104c"];
    const bandH = Math.ceil((H * 0.78) / bands.length);
    bands.forEach((c, i) => {
      o.fillStyle = c;
      o.fillRect(0, i * bandH, W, bandH + 1);
      if (i > 0) {
        o.fillStyle = bands[i - 1];
        for (let x = 0; x < W; x += 2) o.fillRect(x + (i % 2), i * bandH, 1, 1);
      }
    });
    o.fillStyle = bands[bands.length - 1];
    o.fillRect(0, bands.length * bandH, W, H);

    // Stars
    for (let i = 0; i < (W * H) / 900; i++) {
      o.fillStyle = rand() < 0.8 ? "rgba(255,255,255,.35)" : "rgba(33,240,255,.6)";
      o.fillRect(Math.floor(rand() * W), Math.floor(rand() * H * 0.45), 1, 1);
    }

    // Synthwave sun with scanline gaps
    const sx = Math.floor(W * 0.68), sy = Math.floor(H * 0.5), sr = Math.floor(Math.min(W, H) * 0.2);
    for (let y = -sr; y <= sr; y++) {
      const half = Math.floor(Math.sqrt(sr * sr - y * y));
      const t = (y + sr) / (2 * sr);
      if (y > 0 && (y % 6) < Math.min(4, 1 + Math.floor(t * 5))) continue;
      o.fillStyle = t < 0.5 ? "#ff7ad9" : t < 0.75 ? "#ff4fa8" : "#ff8a3d";
      o.globalAlpha = 0.55;
      o.fillRect(sx - half, sy + y, half * 2, 1);
    }
    o.globalAlpha = 1;

    // Skyline layers, far to near
    flickers = [];
    signs = [];
    const layers = [
      { base: 0.62, minH: 0.12, maxH: 0.34, minW: 6, maxW: 16, col: "#1a0d33", win: 0.1, wsz: 1 },
      { base: 0.76, minH: 0.16, maxH: 0.42, minW: 9, maxW: 22, col: "#110822", win: 0.16, wsz: 1 },
      { base: 0.92, minH: 0.2, maxH: 0.55, minW: 12, maxW: 30, col: "#07040f", win: 0.2, wsz: 2 },
    ];
    layers.forEach((L, li) => {
      let x = -Math.floor(rand() * 10);
      while (x < W) {
        const bw = Math.floor(L.minW + rand() * (L.maxW - L.minW));
        const bh = Math.floor(H * (L.minH + rand() * (L.maxH - L.minH)));
        const top = Math.floor(H * L.base - bh);
        o.fillStyle = L.col;
        o.fillRect(x, top, bw, H - top);
        if (rand() < 0.35) o.fillRect(x + Math.floor(bw / 2), top - 4 - Math.floor(rand() * 6), 1, 8); // antenna
        // windows
        for (let wy = top + 3; wy < H * L.base - 2; wy += L.wsz + 2) {
          for (let wx = x + 2; wx < x + bw - 2; wx += L.wsz + 2) {
            if (rand() < L.win) {
              const c = WINDOW_COLOURS[Math.floor(rand() * WINDOW_COLOURS.length)];
              o.fillStyle = c;
              o.globalAlpha = 0.35 + 0.3 * li * 0.5 + rand() * 0.2;
              o.fillRect(wx, wy, L.wsz, L.wsz);
              if (rand() < 0.04) flickers.push({ x: wx, y: wy, s: L.wsz, c, on: true });
            }
          }
        }
        o.globalAlpha = 1;
        // neon signs on the two nearer layers
        if (li > 0 && rand() < 0.45 && bw > 10) {
          const sw = 4 + Math.floor(rand() * Math.min(10, bw - 6)), sh = 2 + Math.floor(rand() * 2);
          signs.push({
            x: x + 2 + Math.floor(rand() * (bw - sw - 3)), y: top + 4 + Math.floor(rand() * Math.max(1, bh * 0.4)),
            w: sw, h: sh, c: SIGN_COLOURS[Math.floor(rand() * SIGN_COLOURS.length)], on: true, next: 0,
          });
        }
        x += bw + Math.floor(rand() * 3);
      }
    });

    // Ground haze
    const g = o.createLinearGradient(0, H * 0.75, 0, H);
    g.addColorStop(0, "rgba(255,43,214,0)");
    g.addColorStop(1, "rgba(255,43,214,.18)");
    o.fillStyle = g;
    o.fillRect(0, H * 0.75, W, H * 0.25);

    drops = Array.from({ length: Math.floor((W * H) / 260) }, () => ({
      x: rand() * W, y: rand() * H, v: 2 + rand() * 2.5, l: 2 + Math.floor(rand() * 3),
    }));
    cars = Array.from({ length: 3 }, (_, i) => ({
      x: rand() * W, y: Math.floor(H * (0.3 + 0.12 * i)), v: (rand() < 0.5 ? -1 : 1) * (0.4 + rand() * 0.5),
      c: i % 2 ? "#21f0ff" : "#ff2bd6",
    }));
  }

  function draw(now) {
    ctx.drawImage(base, 0, 0);
    for (const s of signs) {
      if (now > s.next) {
        s.on = Math.random() > 0.12;
        s.next = now + (s.on ? 400 + Math.random() * 3000 : 60 + Math.random() * 120);
      }
      if (!s.on) continue;
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = s.c;
      ctx.fillRect(s.x - 1, s.y - 1, s.w + 2, s.h + 2);
      ctx.globalAlpha = 0.95;
      ctx.fillRect(s.x, s.y, s.w, s.h);
    }
    ctx.globalAlpha = 1;
    for (const f of flickers) {
      if (Math.random() < 0.01) f.on = !f.on;
      if (!f.on) {
        ctx.fillStyle = "#07040f";
        ctx.fillRect(f.x, f.y, f.s, f.s);
      }
    }
    for (const c of cars) {
      c.x += c.v;
      if (c.x < -6) c.x = W + 6;
      if (c.x > W + 6) c.x = -6;
      ctx.fillStyle = c.c;
      ctx.fillRect(Math.round(c.x), c.y, 3, 1);
      ctx.globalAlpha = 0.3;
      ctx.fillRect(Math.round(c.x) - 3 * Math.sign(c.v), c.y, 3, 1);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = "rgba(160,200,255,.32)";
    for (const d of drops) {
      d.y += d.v;
      d.x -= d.v * 0.25;
      if (d.y > H) {
        d.y = -d.l;
        d.x = Math.random() * (W + 20);
      }
      ctx.fillRect(Math.round(d.x), Math.round(d.y), 1, d.l);
    }
  }

  let last = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    if (document.hidden || now - last < 33) return; // ~30 fps
    last = now;
    draw(now);
  }

  build();
  draw(0);
  let resizeTimer;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      build();
      draw(performance.now());
    }, 150);
  });
  if (!still) requestAnimationFrame(loop);
}
