// The back alley behind the game: a grimy brick wall with faded posters and graffiti, a pavement
// strip, one warm street lamp overhead and dust drifting through its light. The wall is drawn once
// per resize; only the light flicker and the dust animate.

function rng(seed) {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
}

export function startBackground(canvas) {
  const ctx = canvas.getContext("2d");
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let W, H, dpr, wall, dust;

  function build() {
    dpr = Math.min(2, devicePixelRatio || 1);
    W = Math.ceil((innerWidth || 1280) * dpr);
    H = Math.ceil((innerHeight || 720) * dpr);
    canvas.width = W;
    canvas.height = H;
    const rand = rng(2024);
    wall = document.createElement("canvas");
    wall.width = W;
    wall.height = H;
    const o = wall.getContext("2d");

    // Mortar, then bricks with a little colour variation, a top highlight and a bottom shadow
    o.fillStyle = "#141017";
    o.fillRect(0, 0, W, H);
    const bw = 70 * dpr, bh = 26 * dpr, gap = 4 * dpr;
    const floorY = H * 0.86;
    for (let row = 0, y = 0; y < floorY; row++, y += bh) {
      for (let x = row % 2 ? -bw / 2 : 0; x < W; x += bw) {
        const l = 13 + rand() * 6;
        const h = 268 + rand() * 18;
        o.fillStyle = `hsl(${h} ${10 + rand() * 8}% ${l}%)`;
        o.fillRect(x + gap / 2, y + gap / 2, bw - gap, bh - gap);
        o.fillStyle = "rgba(255,255,255,.035)";
        o.fillRect(x + gap / 2, y + gap / 2, bw - gap, 2 * dpr);
        o.fillStyle = "rgba(0,0,0,.25)";
        o.fillRect(x + gap / 2, y + bh - gap / 2 - 3 * dpr, bw - gap, 3 * dpr);
        if (rand() < 0.07) { // chipped brick
          o.fillStyle = "rgba(0,0,0,.35)";
          o.beginPath();
          o.arc(x + rand() * bw, y + rand() * bh, (4 + rand() * 6) * dpr, 0, Math.PI * 2);
          o.fill();
        }
      }
    }

    // Wheat-pasted posters, peeling and faded
    const posterCols = ["#fff3d6", "#ffd21f", "#ff3b3b", "#4a95ff"];
    for (let i = 0; i < 7; i++) {
      const pw = (90 + rand() * 120) * dpr, ph = pw * (1.2 + rand() * 0.4);
      const px = rand() * W, py = rand() * floorY * 0.8;
      o.save();
      o.translate(px, py);
      o.rotate((rand() - 0.5) * 0.25);
      o.globalAlpha = 0.06 + rand() * 0.05;
      o.fillStyle = posterCols[i % posterCols.length];
      o.beginPath();
      o.moveTo(0, 0);
      for (let t = 0; t <= 1; t += 0.1) o.lineTo(pw * t, (rand() - 0.5) * 8 * dpr);
      o.lineTo(pw, ph);
      for (let t = 1; t >= 0; t -= 0.1) o.lineTo(pw * t, ph + (rand() - 0.5) * 14 * dpr);
      o.closePath();
      o.fill();
      o.globalAlpha *= 1.6;
      o.fillStyle = "#141017";
      o.fillRect(pw * 0.12, ph * 0.14, pw * 0.76, ph * 0.08);
      o.beginPath();
      o.arc(pw / 2, ph * 0.55, pw * 0.26, 0, Math.PI * 2);
      o.fill();
      o.restore();
    }

    // Faded spray tags with drips
    const tagCols = ["#ff3b3b", "#ffd21f", "#4a95ff", "#4cc43a", "#ff6fae"];
    o.lineCap = "round";
    o.lineJoin = "round";
    for (let i = 0; i < 9; i++) {
      const tx = rand() * W, ty = (0.15 + rand() * 0.7) * floorY, s = (40 + rand() * 60) * dpr;
      o.strokeStyle = tagCols[i % tagCols.length];
      o.globalAlpha = 0.08 + rand() * 0.06;
      o.lineWidth = (5 + rand() * 6) * dpr;
      o.beginPath();
      o.moveTo(tx, ty);
      let cx = tx, cy = ty;
      for (let k = 0; k < 5; k++) {
        const nx = cx + s * (0.3 + rand() * 0.5), ny = ty + (rand() - 0.5) * s * 0.9;
        o.bezierCurveTo(cx + s * 0.2, cy - s * 0.6, nx - s * 0.2, ny + s * 0.6, nx, ny);
        cx = nx;
        cy = ny;
      }
      o.stroke();
      o.lineWidth = 3 * dpr;
      for (let k = 0; k < 4; k++) {
        const dx = tx + rand() * (cx - tx), dy = ty + s * 0.3;
        o.beginPath();
        o.moveTo(dx, dy);
        o.lineTo(dx, dy + (10 + rand() * 40) * dpr);
        o.stroke();
      }
    }
    o.globalAlpha = 1;

    // Grime: soft dark stains
    for (let i = 0; i < 26; i++) {
      const gx = rand() * W, gy = rand() * H, gr = (60 + rand() * 220) * dpr;
      const g = o.createRadialGradient(gx, gy, 0, gx, gy, gr);
      g.addColorStop(0, "rgba(0,0,0,.28)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      o.fillStyle = g;
      o.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
    }

    // Pavement and kerb
    const fg = o.createLinearGradient(0, floorY, 0, H);
    fg.addColorStop(0, "#221c26");
    fg.addColorStop(1, "#0d0a10");
    o.fillStyle = fg;
    o.fillRect(0, floorY, W, H - floorY);
    o.fillStyle = "#2e2733";
    o.fillRect(0, floorY, W, 6 * dpr);
    o.fillStyle = "rgba(0,0,0,.5)";
    o.fillRect(0, floorY + 6 * dpr, W, 3 * dpr);

    // Vignette
    const v = o.createRadialGradient(W / 2, H * 0.42, Math.min(W, H) * 0.25, W / 2, H * 0.5, Math.max(W, H) * 0.75);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,.78)");
    o.fillStyle = v;
    o.fillRect(0, 0, W, H);

    dust = Array.from({ length: still ? 0 : 46 }, () => ({
      x: W * (0.2 + rand() * 0.6), y: rand() * H, r: (0.8 + rand() * 2.2) * dpr,
      vx: (rand() - 0.5) * 0.25 * dpr, vy: (-0.1 - rand() * 0.25) * dpr, p: rand() * 6.28,
    }));
  }

  let flicker = 1, nextFlicker = 0;
  function frame(t) {
    ctx.drawImage(wall, 0, 0);
    if (!still && t > nextFlicker) {
      flicker = 0.55 + Math.random() * 0.3;
      setTimeout(() => (flicker = 1), 60 + Math.random() * 90);
      nextFlicker = t + 2500 + Math.random() * 7000;
    }
    // Street lamp light cone from above the board
    const lx = W / 2, ly = -H * 0.08;
    const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, H * 1.05);
    g.addColorStop(0, `rgba(255, 196, 110, ${0.3 * flicker})`);
    g.addColorStop(0.45, `rgba(255, 170, 80, ${0.11 * flicker})`);
    g.addColorStop(1, "rgba(255, 150, 60, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    for (const d of dust) {
      d.x += d.vx + Math.sin(t / 1600 + d.p) * 0.15 * dpr;
      d.y += d.vy;
      if (d.y < -10) d.y = H + 10;
      const a = 0.25 + 0.25 * Math.sin(t / 700 + d.p);
      ctx.fillStyle = `rgba(255, 226, 170, ${a * flicker})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  build();
  frame(0);
  let resizeT;
  addEventListener("resize", () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      build();
      frame(performance.now());
    }, 120);
  });
  if (still) return;
  let last = 0;
  const loop = (t) => {
    if (!document.hidden && t - last > 33) { // ~30 fps is plenty for dust
      frame(t);
      last = t;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
