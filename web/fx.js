// Game-feel effects layered over the reels: confetti bursts, fountains, screen shake,
// Override Wild beams and a full-screen impact flash. All of them switch off for reduced motion.

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

export class Fx {
  constructor(host) {
    this.host = host;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "fx-canvas";
    host.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this.parts = [];
    this.running = false;
    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
  }

  resize() {
    const r = this.host.getBoundingClientRect();
    this.dpr = Math.min(2, devicePixelRatio || 1);
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
  }

  /** Centre of an element, in host coordinates. */
  at(el) {
    const a = el.getBoundingClientRect();
    const h = this.host.getBoundingClientRect();
    return [a.left - h.left + a.width / 2, a.top - h.top + a.height / 2];
  }

  burst(x, y, { n = 24, colors = ["#ffd21f", "#ff3b3b", "#fff"], speed = 5, size = 4, life = 45,
    gravity = 0.18, angle = 0, spread = Math.PI * 2 } = {}) {
    if (reduce) return;
    for (let i = 0; i < n; i++) {
      const a = angle - spread / 2 + Math.random() * spread;
      const v = speed * (0.35 + Math.random() * 0.9);
      this.parts.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: gravity, life: life * (0.6 + Math.random() * 0.6),
        age: 0, s: Math.max(2, Math.round(size * (0.6 + Math.random() * 0.8))),
        c: colors[Math.floor(Math.random() * colors.length)],
      });
    }
    this.start();
  }

  /** Coins and sparks shooting up from the bottom of the reels (big wins). */
  fountain(n = 120, colors = ["#ffd21f", "#fff3d6", "#ff8a3d", "#ff3b3b", "#4a95ff"]) {
    if (reduce) return;
    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;
    for (let i = 0; i < n; i++) {
      setTimeout(() => this.burst(w * (0.15 + Math.random() * 0.7), h + 4, {
        n: 1, colors, speed: 9 + Math.random() * 5, size: 6, life: 90, gravity: 0.22,
        angle: -Math.PI / 2, spread: 0.7,
      }), i * 12);
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    const step = () => {
      const { ctx, dpr } = this;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.parts = this.parts.filter((p) => p.age < p.life);
      for (const p of this.parts) {
        p.age++;
        p.vy += p.g;
        p.vx *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
        ctx.fillStyle = p.c;
        if (p.s >= 5) { // confetti: a spinning paper square
          ctx.save();
          ctx.translate(p.x * dpr, p.y * dpr);
          ctx.rotate(p.age * 0.25 + p.s);
          ctx.fillRect((-p.s * dpr) / 2, (-p.s * dpr * Math.abs(Math.cos(p.age * 0.2))) / 2, p.s * dpr, p.s * dpr * Math.abs(Math.cos(p.age * 0.2)) + 1);
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(p.x * dpr, p.y * dpr, (p.s * dpr) / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      if (this.parts.length) requestAnimationFrame(step);
      else this.running = false;
    };
    requestAnimationFrame(step);
  }

  /** Laser beam from an origin cell along its row or column, across the whole grid. */
  beam(originEl, gridEl, vertical, ms = 520) {
    if (reduce) return;
    const h = this.host.getBoundingClientRect();
    const o = originEl.getBoundingClientRect();
    const g = gridEl.getBoundingClientRect();
    const b = document.createElement("div");
    b.className = "beam";
    const thick = o.width * 0.42;
    if (vertical) {
      Object.assign(b.style, {
        left: `${o.left - h.left + o.width / 2 - thick / 2}px`, top: `${g.top - h.top + 6}px`,
        width: `${thick}px`, height: `${g.height - 12}px`, "--dir": "180deg",
        transformOrigin: `50% ${o.top - g.top + o.height / 2}px`,
      });
    } else {
      Object.assign(b.style, {
        left: `${g.left - h.left + 6}px`, top: `${o.top - h.top + o.height / 2 - thick / 2}px`,
        width: `${g.width - 12}px`, height: `${thick}px`,
        transformOrigin: `${o.left - g.left + o.width / 2}px 50%`,
      });
    }
    this.host.appendChild(b);
    const s = vertical ? "scaleY" : "scaleX";
    b.animate(
      [{ transform: `${s}(0)`, opacity: 1 }, { transform: `${s}(1)`, opacity: 1, offset: 0.35 },
        { transform: `${s}(1) ${vertical ? "scaleX(.2)" : "scaleY(.2)"}`, opacity: 0 }],
      { duration: ms, easing: "cubic-bezier(.2,.8,.3,1)" },
    ).finished.then(() => b.remove());
  }
}

export function shake(el, strength = 7, ms = 380) {
  if (reduce) return;
  const frames = [];
  for (let i = 0; i < 8; i++) {
    const k = strength * (1 - i / 8);
    frames.push({ transform: `translate(${(Math.random() * 2 - 1) * k}px, ${(Math.random() * 2 - 1) * k}px)` });
  }
  frames.push({ transform: "none" });
  el.animate(frames, { duration: ms, easing: "linear" });
}

/** Full-screen punch: a white flash and a zoom kick (bonus triggers and level-ups). */
export function impact(ms = 600) {
  if (reduce) return Promise.resolve();
  document.body.classList.remove("impact");
  void document.body.offsetWidth;
  document.body.classList.add("impact");
  return new Promise((r) => setTimeout(() => {
    document.body.classList.remove("impact");
    r();
  }, ms));
}
