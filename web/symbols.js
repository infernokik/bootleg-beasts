// Original symbol art, drawn as inline SVG. Shared gradients, patterns and masks live in index.html.
//
// Art direction: cheap bootleg monster merch. Premium symbols are knock-off toys in blister packs
// (off-model creatures, googly eyes, stitching, misprints). Low symbols are knock-off items with
// misspelled labels. Every creature and item is an original design.

const INK = "#0b0716";

function polygon(cx, cy, spikes, outer, inner, rot = -90) {
  const pts = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = ((rot + (i * 180) / spikes) * Math.PI) / 180;
    const r = i % 2 ? inner : outer;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}

const sticker = (fill, text) => `
  <g transform="rotate(-14 81 19)">
    <polygon points="${polygon(81, 19, 12, 14.5, 10.5)}" fill="${fill}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>
    <text x="81" y="${text.length > 4 ? 21.3 : 21.8}" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-size="${text.length > 4 ? 6.2 : 7.6}" fill="${INK}">${text}</text>
  </g>`;

// Blister pack: hang tab, printed card, the toy, a plastic bubble over it, and a sticker.
const pack = (card, stickerFill, stickerText, toy) => `
  <rect x="33" y="1" width="34" height="13" rx="4" fill="${card}" stroke="${INK}" stroke-width="2"/>
  <rect x="42.5" y="4.6" width="15" height="4.6" rx="2.3" fill="${INK}"/>
  <rect x="4" y="9" width="92" height="89" rx="8" fill="${card}" stroke="${INK}" stroke-width="2.5"/>
  <rect x="4" y="9" width="92" height="89" rx="8" fill="url(#dots)" opacity=".16"/>
  <path d="M4 86 H96 V90 Q96 98 88 98 H12 Q4 98 4 90 Z" fill="${INK}" opacity=".25"/>
  ${toy}
  <rect x="12" y="17" width="76" height="75" rx="15" fill="url(#gBubble)" stroke="#fff" stroke-opacity=".6" stroke-width="1.6"/>
  <path d="M19 27 Q15.5 50 20 72" stroke="#fff" stroke-opacity=".6" stroke-width="3.6" fill="none" stroke-linecap="round"/>
  ${sticker(stickerFill, stickerText)}`;

// ---- Premium creatures (bootleg toys) ------------------------------------------
const SPARKJAW = `
  <path d="M51 31 L57 15 L53 16 L59 4 L48 20 L53.5 19 Z" fill="#ffe14d" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M50 27 C68 25 82 37 81 55 C80 73 68 85 50 85 C31 85 19 74 19 56 C19 41 30 28 50 27 Z" fill="url(#gSpark)" stroke="${INK}" stroke-width="2.5"/>
  <path d="M50 28 C46.5 46 53.5 65 50 84" stroke="${INK}" stroke-opacity=".35" stroke-width="1.2" fill="none" stroke-dasharray="3 3"/>
  <path d="M22 62 l5 -3 l1 5 l5 -3" stroke="#ffe14d" stroke-width="2.2" fill="none" stroke-linejoin="round"/>
  <path d="M67 65 l5 -3 l1 5 l5 -3" stroke="#ffe14d" stroke-width="2.2" fill="none" stroke-linejoin="round"/>
  <circle cx="37" cy="48" r="11" fill="#fff" stroke="${INK}" stroke-width="2"/><circle cx="33" cy="52" r="5" fill="${INK}"/>
  <circle cx="64" cy="46" r="7" fill="#fff" stroke="${INK}" stroke-width="2"/><circle cx="67" cy="43" r="3.2" fill="${INK}"/>
  <path d="M30 65 Q51 83 72 63 Q51 73 30 65 Z" fill="${INK}"/>
  <path d="M30 65 L34.2 70.5 L38.4 67.5 L42.6 72 L46.8 68.5 L51 73 L55.2 68.1 L59.4 72 L63.6 66.3 L67.8 70 L72 63 L63.6 66.3 L55.2 68.1 L46.8 68.5 L38.4 67.5 Z" fill="#fff" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>`;

const BLAZEGOB = `
  <path d="M24 58 L9 49 L13 61 L6 66 L22 69 Z" fill="#7a1240" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M76 58 L91 49 L87 61 L94 66 L78 69 Z" fill="#7a1240" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M33 36 C29 24 37 19 35 8 C43 14 44 20 46 25 C46 15 52 11 52 3 C60 13 58 21 60 27 C62 19 68 17 70 12 C72 25 67 31 67 37 Z" fill="url(#gFlame)" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
  <path d="M29 41 L18 27 L33 35 Z" fill="#f1e3c8" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M71 41 L84 29 L69 35 Z" fill="#f1e3c8" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M26 46 C26 34 39 30 50 30 C63 30 75 35 75 47 C75 52 74 55 73 58 C80 61 85 66 83 74 C81 82 69 87 53 86 C37 85 26 79 24 67 C23 59 25 52 26 46 Z" fill="url(#gBlaze)" stroke="${INK}" stroke-width="2.5"/>
  <circle cx="40" cy="47" r="8" fill="#fff" stroke="${INK}" stroke-width="2"/><circle cx="44.2" cy="48" r="3.6" fill="${INK}"/>
  <circle cx="60" cy="47" r="8" fill="#fff" stroke="${INK}" stroke-width="2"/><circle cx="55.8" cy="48" r="3.6" fill="${INK}"/>
  <path d="M31 37 L47 41" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><path d="M53 42 L68 39" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
  <ellipse cx="54" cy="71" rx="22" ry="12" fill="#ffb199" stroke="${INK}" stroke-width="2"/>
  <ellipse cx="47" cy="65" rx="2.6" ry="2" fill="${INK}"/><ellipse cx="61" cy="65" rx="2.6" ry="2" fill="${INK}"/>
  <path d="M38 75 Q54 83 70 73" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <path d="M44 77 L46 83.5 L49.5 78.2 Z" fill="#fff" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M60.5 77.4 L63 81.5 L64.5 76.4 Z" fill="#fff" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>`;

const TIDEWYRM = `
  <path d="M30 38 L35 17 L43 31 L50 10 L57 31 L65 17 L70 38 Z" fill="#8ffaff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
  <path d="M22 56 C22 40 36 32 50 32 C66 32 80 42 80 58 C80 75 66 87 50 87 C34 87 22 74 22 56 Z" fill="url(#gTide)" stroke="${INK}" stroke-width="2.5"/>
  <path d="M27 54 C27 43 38 36 50 36 C60 36 68 40 72 46" stroke="#ff4fd8" stroke-opacity=".6" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M26 62 q5 3 0 7 M24.5 55 q5 3 0 7 M74 62 q-5 3 0 7 M75.5 55 q-5 3 0 7" stroke="${INK}" stroke-width="1.8" fill="none"/>
  <circle cx="38" cy="52" r="10" fill="#fff" stroke="${INK}" stroke-width="2"/><circle cx="39.5" cy="55.5" r="4.6" fill="${INK}"/>
  <circle cx="63" cy="53" r="7" fill="#fff" stroke="${INK}" stroke-width="2"/><circle cx="63" cy="56" r="2.8" fill="${INK}"/>
  <path d="M55.6 53.4 A7.4 7.4 0 0 1 70.4 53.4 Z" fill="#2a74e0" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
  <path d="M36 74 Q50 65 66 74" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
  <path d="M62 72.5 C63.5 77 61 81 63 85 C66 81 65 77 64.5 73" fill="#c9fbff" stroke="${INK}" stroke-width="1.2"/>
  <g fill="#c9fbff" opacity=".8"><circle cx="31" cy="68" r="2"/><circle cx="35" cy="73" r="1.4"/><circle cx="70" cy="66" r="1.6"/></g>`;

const THORNBYTE = `
  <path d="M25 42 C11 36 8 24 14 17 C20 27 28 30 33 38 Z" fill="url(#gThorn)" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
  <path d="M75 42 C89 36 92 24 86 17 C80 27 72 30 67 38 Z" fill="url(#gThorn)" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
  <path d="M59 31 V22" stroke="#efe6d2" stroke-width="3.2"/>
  <path d="M50.5 23.5 C50.5 14.5 67.5 14.5 67.5 23.5 Z" fill="#c084fc" stroke="${INK}" stroke-width="1.8"/>
  <circle cx="55.5" cy="19.6" r="1.5" fill="#fff"/><circle cx="62" cy="19.2" r="1.3" fill="#fff"/>
  <path d="M50 29 C62 28 74 33 77 45 C80 57 79 71 70 80 C62 88 38 88 30 80 C21 71 20 57 23 45 C26 33 38 29 50 29 Z" fill="url(#gThorn)" stroke="${INK}" stroke-width="2.5"/>
  <g fill="#0e5a32" opacity=".45"><circle cx="34" cy="39" r="2"/><circle cx="66" cy="37" r="1.6"/><circle cx="28" cy="59" r="1.8"/><circle cx="72" cy="63" r="2"/><circle cx="44" cy="35" r="1.3"/><circle cx="56" cy="82" r="1.5"/></g>
  <path d="M23.2 51 l-6.5 -2 l6.5 -3.4 Z M76.8 51 l6.5 -2 l-6.5 -3.4 Z M31 35 l-4.5 -5.5 l6.8 2.4 Z" fill="#efe6d2" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>
  <circle cx="39" cy="51" r="8.5" fill="#2b2b38" stroke="${INK}" stroke-width="2"/><path d="M35.2 47.2 l7.6 7.6 M42.8 47.2 l-7.6 7.6" stroke="#e9e6ff" stroke-width="1.9"/>
  <circle cx="62" cy="53" r="6.5" fill="#d94841" stroke="${INK}" stroke-width="2"/>
  <g fill="${INK}"><circle cx="60" cy="51" r="1.2"/><circle cx="64" cy="51" r="1.2"/><circle cx="60" cy="55" r="1.2"/><circle cx="64" cy="55" r="1.2"/></g>
  <path d="M34 71 Q50 79 66 69" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <path d="M38 69 l1 6.5 M44 71 l.5 6.5 M50 72 v6.5 M56 71 l-.5 6.5 M62 69.5 l-1 6.5" stroke="${INK}" stroke-width="1.6"/>`;

// ---- Low symbols (knock-off items) -------------------------------------------------
const label = (x, y, w, h, rot, text, color, size) => `
  <g transform="rotate(${rot} ${x + w / 2} ${y + h / 2})">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2.5" fill="#fff6d6" stroke="${INK}" stroke-width="1.5"/>
    <text x="${x + w / 2}" y="${y + h / 2 + size * 0.36}" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-size="${size}" fill="${color}">${text}</text>
  </g>`;

const HEEL_SPRAY = `
  <path d="M40 12 H62 V23 H40 Z" fill="#e9e6ff" stroke="${INK}" stroke-width="2"/>
  <path d="M62 14 H76 L73.5 19.5 H62 Z" fill="#e9e6ff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
  <path d="M43 23 L45 31 H57 L59 23 Z" fill="#c9c4e8" stroke="${INK}" stroke-width="2"/>
  <path d="M41 31 L38 23 Q34 28 36 31 Z" fill="#c9c4e8" stroke="${INK}" stroke-width="1.6"/>
  <path d="M30 37 Q30 31 38 31 H64 Q72 31 72 37 V85 Q72 91 64 91 H38 Q30 91 30 85 Z" fill="#22d3a6" stroke="${INK}" stroke-width="2.5"/>
  <path d="M51 37 v9 M46.5 41.5 h9" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>
  ${label(32, 50, 38, 20, -6, "HEEL", "#e8384f", 12)}
  <path d="M28 77 L74 72 L74 79.5 L28 84.5 Z" fill="#f5e6a3" opacity=".85"/>
  <path d="M36 40 V82" stroke="#fff" stroke-opacity=".45" stroke-width="3" stroke-linecap="round"/>`;

const CANDEE = `
  <path d="M25 48 L7 35 L12 48 L5 61 Z" fill="#ff6fb5" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
  <path d="M75 48 L93 35 L88 48 L95 61 Z" fill="#ff6fb5" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
  <ellipse cx="50" cy="48" rx="28" ry="20" fill="#ff6fb5" stroke="${INK}" stroke-width="2.5"/>
  <path d="M33 36 L43 60 M45 29 L57 67 M58 30 L69 58" stroke="#fff" stroke-width="5.5" stroke-linecap="round" opacity=".9"/>
  <path d="M63 38 q5 6 -1 12" stroke="${INK}" stroke-width="1.6" fill="none" opacity=".6"/>
  <path d="M30 40 Q34 33 42 31" stroke="#fff" stroke-opacity=".7" stroke-width="3" fill="none" stroke-linecap="round"/>
  ${label(29, 70, 42, 15, 7, "CANDEE", "#7b3df5", 9.5)}`;

const GLITCH_BERRY = `
  <path d="M50 25 C44 14 34 14 29 18 C35 25 44 27 50 25 Z" fill="#3ddc84" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M50 25 C56 12 66 12 71 16 C65 24 56 27 50 25 Z" fill="#3ddc84" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M50 24 V31" stroke="${INK}" stroke-width="2.6"/>
  <g mask="url(#mBite)">
    <path d="M50 29 C71 29 81 45 77 63 C73 81 61 91 50 91 C39 91 27 81 23 63 C19 45 29 29 50 29 Z" fill="#7c4dff" stroke="${INK}" stroke-width="2.5"/>
    <rect x="22" y="62" width="34" height="4.5" fill="#21f0ff" opacity=".65"/>
    <g fill="#ffe14d"><rect x="37" y="44" width="4.5" height="4.5"/><rect x="52" y="40" width="4.5" height="4.5"/><rect x="44" y="56" width="4.5" height="4.5"/><rect x="59" y="54" width="4.5" height="4.5"/><rect x="35" y="72" width="4.5" height="4.5"/><rect x="50" y="76" width="4.5" height="4.5"/><rect x="62" y="70" width="4.5" height="4.5"/></g>
  </g>
  <path d="M75.5 46 A9 9 0 0 0 73.5 61.5 A8 8 0 0 0 73 74" stroke="#ffd6f5" stroke-width="3.2" fill="none" stroke-linecap="round"/>
  <path d="M31 42 Q28 54 32 64" stroke="#fff" stroke-opacity=".5" stroke-width="3" fill="none" stroke-linecap="round"/>`;

const CHAMPEEN = `
  <path d="M33 6 H47 L56 40 H42 Z" fill="#e83e8c" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
  <path d="M67 6 H53 L44 40 H58 Z" fill="#21a3ff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
  <polygon points="${polygon(50, 63, 5, 28, 12.5)}" fill="url(#gGold)" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
  <g fill="#8a5a0a" opacity=".75"><path d="M33 56 l5 1.5 l-2.5 3.5 Z"/><path d="M63 77 l4 -1 l-1 4.5 Z"/><path d="M57 46 l3 2 l-3.5 1.5 Z"/></g>
  <circle cx="50" cy="63" r="10.5" fill="#fff1b8" stroke="${INK}" stroke-width="1.8"/>
  <text x="50" y="67.4" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-size="11.5" fill="${INK}">#1</text>
  <path d="M38 50 L44 56" stroke="#fff" stroke-opacity=".7" stroke-width="2.6" stroke-linecap="round"/>`;

const BURNED_DISC = `
  <circle cx="50" cy="51" r="37" fill="url(#gDisc)" stroke="${INK}" stroke-width="2.5"/>
  <circle cx="50" cy="51" r="25" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1"/>
  <path d="M22 40 A30 30 0 0 1 42 21" stroke="#fff" stroke-opacity=".8" stroke-width="3.2" fill="none" stroke-linecap="round"/>
  <path d="M78 62 A30 30 0 0 1 62 79" stroke="#ff9de8" stroke-opacity=".7" stroke-width="3" fill="none" stroke-linecap="round"/>
  <circle cx="50" cy="51" r="11.5" fill="#d9dcef" stroke="${INK}" stroke-width="2"/>
  <circle cx="50" cy="51" r="5" fill="#0f0b1c"/>
  <text x="50" y="79" text-anchor="middle" font-family="Segoe Print, Comic Sans MS, cursive" font-weight="700" font-size="10" fill="#1a1a2e" transform="rotate(-9 50 79)">MOVES 2</text>
  <path d="M71 23 L64.5 33.5 L70.5 37.5 L62 48" stroke="${INK}" stroke-width="1.8" fill="none" stroke-linejoin="round"/>`;

// ---- Special symbols (64x64) -------------------------------------------------------
const SPECIAL = {
  W: `
    <rect x="5" y="14" width="54" height="36" rx="5" fill="#16061f" stroke="#ff2bd6" stroke-width="2"/>
    <rect x="8" y="23" width="20" height="3" fill="#21f0ff" opacity=".7"/><rect x="36" y="39" width="18" height="3" fill="#ff2bd6" opacity=".7"/>
    <g font-family="Arial Black, Impact, sans-serif" font-weight="900" font-size="17" text-anchor="middle">
      <text x="30.5" y="38.5" fill="#ff2bd6">WILD</text><text x="33.5" y="38.5" fill="#21f0ff">WILD</text><text x="32" y="38.5" fill="#fff">WILD</text>
    </g>`,
  OW: `
    <rect x="4" y="4" width="56" height="56" rx="8" fill="#04131a" stroke="#21f0ff" stroke-width="2.5"/>
    <path d="M32 9 V55 M9 32 H55" stroke="#21f0ff" stroke-width="6" stroke-linecap="round"/>
    <path d="M32 9 V55 M9 32 H55" stroke="#e8feff" stroke-width="2" stroke-linecap="round"/>
    <path d="M27 14 L32 8 L37 14 M27 50 L32 56 L37 50 M14 27 L8 32 L14 37 M50 27 L56 32 L50 37" stroke="#e8feff" stroke-width="2.5" fill="none" stroke-linejoin="round"/>
    <circle cx="32" cy="32" r="9" fill="#04131a" stroke="#ff2bd6" stroke-width="3"/>
    <circle cx="32" cy="32" r="3.5" fill="#ff2bd6"/>`,
  S: `
    <polygon points="32,5 55,18.5 55,45.5 32,59 9,45.5 9,18.5" fill="#1b1404" stroke="#ffc531" stroke-width="3" stroke-linejoin="round"/>
    <polygon points="32,14 47,23 47,41 32,50 17,41 17,23" fill="none" stroke="#ffe08a" stroke-width="1.5" opacity=".55"/>
    <circle cx="32" cy="32" r="9.5" fill="url(#gCore)"/>
    <circle cx="29" cy="29" r="3" fill="#fff" opacity=".85"/>`,
  X: `
    <rect x="6" y="6" width="52" height="52" rx="6" fill="#121218" stroke="#33333f" stroke-width="2"/>
    <path d="M12 18h18M36 18h14M12 26h8M26 26h26M12 34h22M40 34h10M12 42h12M30 42h22M12 50h30" stroke="#44445a" stroke-width="3" stroke-linecap="round"/>`,
};

const ART = {
  H1: [100, pack("#7b3df5", "#ffe14d", "NEW!!", SPARKJAW)],
  H2: [100, pack("#ffc93c", "#21f0ff", "HOT!", BLAZEGOB)],
  H3: [100, pack("#e0418f", "#ffe14d", "100%", TIDEWYRM)],
  H4: [100, pack("#ff8f3c", "#fff", "REAL!", THORNBYTE)],
  L1: [100, HEEL_SPRAY],
  L2: [100, CANDEE],
  L3: [100, GLITCH_BERRY],
  L4: [100, CHAMPEEN],
  L5: [100, BURNED_DISC],
  ...Object.fromEntries(Object.entries(SPECIAL).map(([k, v]) => [k, [64, v]])),
};

const cache = {};
function svgFor(code) {
  if (!ART[code]) return `<svg viewBox="0 0 64 64" aria-hidden="true"><text x="32" y="40" text-anchor="middle" font-size="22" fill="#fff">${code}</text></svg>`;
  if (!cache[code]) {
    const [vb, body] = ART[code];
    cache[code] = `<svg viewBox="0 0 ${vb} ${vb}" aria-hidden="true">${body}</svg>`;
  }
  return cache[code];
}

// Pixel-art symbols made by art/pixelate.py. Any symbol without one falls back to the vector art.
let PIXEL = new Set();
try {
  const manifest = await (await fetch("assets/symbols/manifest.json", { cache: "no-cache" })).json();
  PIXEL = new Set(manifest.codes);
  for (const code of PIXEL) new Image().src = `assets/symbols/${code}.png?v=11`; // warm the cache
} catch {
  /* no pixel art: vector symbols only */
}

export function symbolHTML(code) {
  if (PIXEL.has(code)) return `<img class="px" src="assets/symbols/${code}.png?v=11" alt="" draggable="false">`;
  return svgFor(code);
}
