// Original symbol art, hand-written as SVG.
//
// Art direction ("back-alley bootleg"): knock-off monster toys and junk sold out of a back alley,
// drawn as die-cut stickers. Thick ink outlines, two-tone cel shading, a white sticker border and a
// soft drop shadow. Premiums are the four beasts; low symbols are bootleg merch. Every design is
// original.
//
// Each symbol is a self-contained 120x120 SVG turned into a blob URL once at load, so the reels show
// plain <img> tags (fast to scroll, cached by the browser) instead of hundreds of live SVG trees.

const INK = "#1a1320";
const OUT = 5; // outline width

/** Base fill + cel shadow: the shape is filled `dark`, then a `base` circle offset to the upper
 *  left is clipped into it, leaving a shadow crescent on the lower right. `extra` is drawn inside
 *  the clip (highlights, markings). Finished with the ink outline. */
function cel(id, d, base, dark, [cx, cy, r], extra = "", sw = OUT) {
  return `<clipPath id="${id}"><path d="${d}"/></clipPath>
  <path d="${d}" fill="${dark}"/>
  <g clip-path="url(#${id})"><circle cx="${cx}" cy="${cy}" r="${r}" fill="${base}"/>${extra}</g>
  <path d="${d}" fill="none" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>`;
}

const part = (d, fill, sw = OUT) =>
  `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>`;

/** Die-cut sticker: a soft shadow and a white border around the silhouette paths. */
function sticker(sil) {
  return `<g transform="translate(2.5 4.5)" fill="${INK}" stroke="${INK}" stroke-width="15" stroke-linejoin="round" opacity=".38">${sil}</g>
  <g fill="#fff" stroke="#fff" stroke-width="15" stroke-linejoin="round">${sil}</g>`;
}
const sil = (...ds) => ds.map((d) => `<path d="${d}"/>`).join("");

function eye(cx, cy, r, px, py, pr) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" stroke="${INK}" stroke-width="4"/>
  <circle cx="${px}" cy="${py}" r="${pr}" fill="${INK}"/>
  <circle cx="${px - pr * 0.4}" cy="${py - pr * 0.45}" r="${Math.max(1.4, pr * 0.36)}" fill="#fff"/>`;
}
const hl = (x, y, rx, ry, rot = -30, o = 0.55) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${x} ${y})" fill="#fff" opacity="${o}"/>`;
const brow = (d, w = 6) => `<path d="${d}" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;

// "WILD" as marker strokes (no font needed inside an <img>)
const WILD_D = "M0 0 L5 30 L10.5 12 L16 30 L21 0 M31 0 V30 M41 0 V30 H55 M65 0 V30 H70 Q83 30 83 15 Q83 0 70 0 Z";

// ---- Premium beasts --------------------------------------------------------------------
function sparkjaw() {
  const head = "M60 24 C88 24 102 44 102 66 C102 90 84 104 60 104 C36 104 18 90 18 66 C18 44 32 24 60 24 Z";
  const ear = "M32 44 L14 14 L52 32 Z";
  const bolt = "M70 32 L84 2 L80 18 L98 10 L82 40 Z";
  const jaw = "M22 72 C40 64 80 64 98 72 C102 94 84 112 60 112 C36 112 18 94 22 72 Z";
  return sticker(sil(head, ear, bolt, jaw)) +
    part(ear, "#2f6ff0") + part("M30 38 L22 22 L42 32 Z", "#ffd21f", 0) +
    part(bolt, "#ffd21f") +
    cel("h1a", head, "#4a95ff", "#2152d6", [50, 54, 47], hl(38, 38, 10, 5)) +
    cel("h1b", jaw, "#7cc0ff", "#3c7de8", [52, 78, 40]) +
    part("M30 76 C46 71 74 71 90 76 C88 92 76 101 60 101 C44 101 32 92 30 76 Z", "#3a0f22", 4) +
    `<ellipse cx="62" cy="94" rx="14" ry="5.5" fill="#ff5a7a"/>` +
    part("M38 75 L43 88 L48 74 Z", "#fff", 3.5) + part("M72 74 L77 88 L82 75 Z", "#fff", 3.5) +
    part("M49 101 L53 92 L57 101 Z", "#fff", 3) + part("M64 101 L68 92 L72 101 Z", "#fff", 3) +
    eye(43, 50, 14, 47, 53, 6.5) + eye(79, 48, 9, 78, 50, 4) +
    brow("M28 32 L54 40") + brow("M70 37 L90 31") +
    `<path d="M20 60 l6 -5 l2 7 l6 -5" stroke="#ffd21f" stroke-width="3.5" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
     <path d="M88 58 l5 -4 l2 6 l5 -4" stroke="#ffd21f" stroke-width="3.5" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`;
}

function blazegob() {
  const hornL = "M30 42 C20 32 16 18 22 4 C30 18 38 24 46 30 Z";
  const hornR = "M90 42 C100 32 104 18 98 4 C90 18 82 24 74 30 Z";
  const flame = "M42 34 C38 22 46 16 44 4 C52 10 55 16 56 22 C56 12 62 6 62 -2 C70 10 68 18 70 24 C74 16 80 14 82 10 C84 22 78 28 78 34 Z";
  const earL = "M24 62 L2 50 L10 66 L2 76 L26 76 Z";
  const earR = "M96 62 L118 50 L110 66 L118 76 L94 76 Z";
  const head = "M60 28 C86 28 98 46 98 66 C98 90 82 106 60 106 C38 106 22 90 22 66 C22 46 34 28 60 28 Z";
  return `<defs><linearGradient id="h2f" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff5a1f"/><stop offset=".55" stop-color="#ffb21f"/><stop offset="1" stop-color="#fff27a"/></linearGradient></defs>` +
    sticker(sil(hornL, hornR, flame, earL, earR, head)) +
    part(earL, "#c81f35") + part(earR, "#c81f35") +
    part(hornL, "#f6e6c4") + part(hornR, "#f6e6c4") +
    `<path d="M24 22 q6 2 10 -1 M27 14 q5 2 8 -1 M96 22 q-6 2 -10 -1 M93 14 q-5 2 -8 -1" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/>` +
    part(flame, "url(#h2f)") +
    cel("h2a", head, "#ff4a3d", "#b3172e", [52, 58, 46], hl(38, 44, 9, 4.5)) +
    part("M40 80 C40 70 50 66 62 66 C74 66 84 70 84 80 C84 90 74 95 62 95 C50 95 40 90 40 80 Z", "#ff8f7a", 4) +
    `<ellipse cx="55" cy="77" rx="3.2" ry="2.4" fill="${INK}"/><ellipse cx="69" cy="77" rx="3.2" ry="2.4" fill="${INK}"/>` +
    `<path d="M46 99 Q62 106 80 97" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>` +
    part("M70 100 L74 88 L79 98 Z", "#f6e6c4", 3.5) +
    `<circle cx="43" cy="54" r="11" fill="#fff" stroke="${INK}" stroke-width="4"/>` +
    `<path d="M38 49 L48 59 M48 49 L38 59" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>` +
    eye(77, 54, 11, 74, 56, 5) +
    brow("M30 42 L53 47", 6.5) + brow("M67 47 L90 41", 6.5);
}

function tidewyrm() {
  const crest = "M30 44 L34 12 L46 28 L56 4 L64 28 L78 10 L84 42 Z";
  const finL = "M24 66 C8 60 4 46 8 38 C16 48 22 52 30 54 Z";
  const finR = "M96 66 C112 60 116 46 112 38 C104 48 98 52 90 54 Z";
  const head = "M60 30 C88 30 100 48 100 68 C100 92 82 106 60 106 C38 106 20 92 20 68 C20 48 32 30 60 30 Z";
  return sticker(sil(crest, finL, finR, head)) +
    part(crest, "#9ff3ff") +
    `<path d="M40 36 L44 22 M56 34 L56 16 M70 36 L76 20" stroke="#3bb7d6" stroke-width="3" stroke-linecap="round"/>` +
    part(finL, "#25aec6") + part(finR, "#25aec6") +
    cel("h3a", head, "#1fd3c2", "#0e8392", [52, 58, 46],
      `<ellipse cx="60" cy="96" rx="30" ry="17" fill="#c9fff2"/>` + hl(36, 46, 9, 4.5) +
      `<path d="M48 40 q5 5 10 0 M60 40 q5 5 10 0 M54 46 q5 5 10 0" stroke="#0e8392" stroke-width="2.6" fill="none" stroke-linecap="round"/>`) +
    eye(43, 60, 12, 45, 63, 5.5) +
    `<circle cx="79" cy="60" r="9.5" fill="#fff" stroke="${INK}" stroke-width="4"/><circle cx="79" cy="63" r="4" fill="${INK}"/>` +
    part("M69.5 60 A9.5 9.5 0 0 1 88.5 60 Z", "#0e8392", 4) +
    `<path d="M40 84 Q60 96 84 80" stroke="${INK}" stroke-width="4.5" fill="none" stroke-linecap="round"/>` +
    part("M70 88 L73 97 L77 86 Z", "#fff", 3.2) +
    `<g fill="#e3fdff" stroke="${INK}" stroke-width="2.6"><circle cx="106" cy="26" r="5"/><circle cx="112" cy="13" r="3"/><circle cx="12" cy="24" r="4"/></g>`;
}

function thornbyte() {
  const leafL = "M30 48 C10 42 4 22 10 10 C24 18 34 30 40 40 Z";
  const leafR = "M90 48 C110 42 116 22 110 10 C96 18 86 30 80 40 Z";
  const sprout = "M66 10 C76 2 88 6 90 14 C80 19 71 17 66 10 Z";
  const head = "M60 30 C86 30 98 48 98 68 C98 92 82 104 60 104 C38 104 22 92 22 68 C22 48 34 30 60 30 Z";
  const thorns = "M24 70 L10 66 L22 80 Z M96 70 L110 66 L98 80 Z M42 34 L36 20 L52 31 Z";
  return sticker(sil(leafL, leafR, sprout, head, thorns, "M58 32 C58 22 61 15 66 10")) +
    part(leafL, "#a7f04a") + part(leafR, "#a7f04a") +
    `<path d="M14 16 C22 26 30 34 36 42 M106 16 C98 26 90 34 84 42" stroke="#4f9a1e" stroke-width="2.6" fill="none" stroke-linecap="round"/>` +
    `<path d="M59 33 C59 22 61 15 66 10" stroke="${INK}" stroke-width="4.5" fill="none" stroke-linecap="round"/>` +
    part(sprout, "#c8ff6a", 4) +
    part(thorns, "#f6e6c4", 3.5) +
    cel("h4a", head, "#4cc43a", "#23782b", [52, 58, 46],
      hl(37, 46, 9, 4.5) + `<g fill="#23782b"><circle cx="30" cy="70" r="2"/><circle cx="35" cy="76" r="1.6"/><circle cx="90" cy="70" r="2"/><circle cx="85" cy="76" r="1.6"/></g>`) +
    eye(43, 58, 11, 47, 60, 5) + eye(77, 58, 11, 81, 60, 5) +
    part("M31.5 58 Q43 44 54.5 58 Z", "#23782b", 4) + part("M65.5 58 Q77 44 88.5 58 Z", "#23782b", 4) +
    part("M34 76 Q60 104 86 76 Q60 86 34 76 Z", "#3a0f22", 4) +
    part("M37 78 L42 86 L47 80 L52 89 L57 82 L62 90 L67 82 L72 88 L77 80 L82 85 L84 79 Q60 87 37 78 Z", "#fff", 2.5);
}

// ---- Low symbols: bootleg merch -----------------------------------------------------------
function heelSpray() {
  const can = "M38 40 Q38 34 44 34 H76 Q82 34 82 40 V100 Q82 106 76 106 H44 Q38 106 38 100 Z";
  const cap = "M44 22 H76 V36 H44 Z";
  const nozzle = "M54 12 H66 V24 H54 Z";
  return sticker(sil(can, cap, nozzle)) +
    part(nozzle, "#e9e6f2", 4) + part(cap, "#ff8fa3", 4.5) +
    cel("l1a", can, "#ff4b5c", "#b3122e", [52, 62, 40], `<rect x="45" y="40" width="6" height="60" rx="3" fill="#fff" opacity=".45"/>`) +
    part("M38 58 H82 V84 H38 Z", "#fff3d6", 4) +
    `<path d="M45 76 l6 -9 l6 10 l6 -11 l6 9 l5 -5" stroke="#ff4b5c" stroke-width="3.6" fill="none" stroke-linejoin="round" stroke-linecap="round"/>` +
    `<g fill="#ffd3dc" stroke="${INK}" stroke-width="2.6"><circle cx="82" cy="16" r="6"/><circle cx="95" cy="11" r="4"/><circle cx="98" cy="24" r="5"/><circle cx="88" cy="28" r="3"/></g>`;
}

function candee() {
  const twistL = "M38 60 L12 42 L19 60 L12 78 Z";
  const twistR = "M82 60 L108 42 L101 60 L108 78 Z";
  const ball = "M60 34 A26 26 0 1 1 59.9 34 Z";
  return sticker(sil(twistL, twistR, ball)) +
    part(twistL, "#ffb6d6", 4.5) + part(twistR, "#ffb6d6", 4.5) +
    `<path d="M20 52 L34 58 M20 68 L34 62 M100 52 L86 58 M100 68 L86 62" stroke="#e05a9a" stroke-width="2.6" stroke-linecap="round"/>` +
    cel("l2a", ball, "#ff6fae", "#c23a7e", [54, 54, 27],
      `<path d="M38 48 Q60 62 84 44 M36 66 Q60 80 86 62" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" opacity=".92"/>` + hl(48, 44, 6, 3.5));
}

function glitchBerry() {
  const berries = [[44, 64, 16], [76, 64, 16], [60, 88, 16], [60, 50, 14]];
  const d = ([x, y, r]) => `M${x} ${y - r} A${r} ${r} 0 1 1 ${x - 0.1} ${y - r} Z`;
  const leaf = "M60 36 C54 22 66 12 82 16 C80 28 70 36 60 36 Z";
  return sticker(sil(...berries.map(d), leaf)) +
    part(leaf, "#7fd640", 4) + `<path d="M62 34 C66 26 72 22 78 20" stroke="#4f9a1e" stroke-width="2.4" fill="none"/>` +
    berries.map((b, i) => cel(`l3${i}`, d(b), "#a066ff", "#5b2bbf", [b[0] - 4, b[1] - 5, b[2]], hl(b[0] - 6, b[1] - 6, 4, 2.4, -30, 0.8), 4.5)).join("");
}

function medal() {
  const strapL = "M36 8 H54 L66 52 H48 Z";
  const strapR = "M84 8 H66 L54 52 H72 Z";
  const disc = "M60 46 A28 28 0 1 1 59.9 46 Z";
  return sticker(sil(strapL, strapR, disc)) +
    part(strapR, "#ff4b5c", 4.5) + part(strapL, "#3ea6ff", 4.5) +
    cel("l4a", disc, "#ffa53a", "#d0611a", [54, 68, 28], hl(48, 62, 6, 3.5)) +
    `<circle cx="60" cy="74" r="18" fill="none" stroke="#a84a10" stroke-width="3"/>` +
    part("M60 61 L64 70 L74 71 L66.5 77.5 L69 87 L60 82 L51 87 L53.5 77.5 L46 71 L56 70 Z", "#fff3d6", 3.5);
}

function burnedDisc() {
  const disc = "M60 20 A42 42 0 1 1 59.9 20 Z";
  return sticker(sil(disc)) +
    `<clipPath id="l5c"><path d="${disc}"/></clipPath>
     <path d="${disc}" fill="#cfd6e6"/>
     <g clip-path="url(#l5c)">
       <path d="M60 62 L20 20 L60 0 Z" fill="#7ee8ff" opacity=".75"/>
       <path d="M60 62 L120 30 L120 70 Z" fill="#ff8fe0" opacity=".65"/>
       <path d="M60 62 L30 120 L0 90 Z" fill="#fff07a" opacity=".7"/>
       <path d="M60 62 L104 120 L70 120 Z" fill="#9dffb0" opacity=".55"/>
       <circle cx="88" cy="86" r="12" fill="#3a2a1c" opacity=".55"/><circle cx="92" cy="82" r="6" fill="#1a1320" opacity=".6"/>
     </g>
     <path d="${disc}" fill="none" stroke="${INK}" stroke-width="${OUT}"/>` +
    `<circle cx="60" cy="62" r="15" fill="#eef1f8" stroke="${INK}" stroke-width="3.5"/><circle cx="60" cy="62" r="6.5" fill="${INK}"/>` +
    `<path d="M30 44 q5 -8 9 0 q4 8 9 0 M34 86 l4 -8 l4 8 M44 86 v-8 M48 86 l6 -8 M48 78 l6 8" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
}

// ---- Specials ------------------------------------------------------------------------------
function wild() {
  const tag = "M14 30 H106 Q114 30 114 38 V82 Q114 90 106 90 H14 Q6 90 6 82 V38 Q6 30 14 30 Z";
  const drips = "M30 88 V100 Q30 105 34 105 Q38 105 38 100 V88 Z M76 88 V96 Q76 100 79 100 Q82 100 82 96 V88 Z";
  return `<g transform="rotate(-7 60 60)">` + sticker(sil(tag)) +
    part(tag, INK, 3) +
    part(drips, "#ffd21f", 3) +
    `<path d="M10 36 L22 30 H34 L12 44 Z M86 90 L110 72 V82 L98 90 Z" fill="#ffd21f" opacity=".9"/>` +
    `<g transform="translate(19.5 46)" fill="none" stroke-linecap="round" stroke-linejoin="round">
       <path d="${WILD_D}" stroke="#ff3b3b" stroke-width="9" transform="translate(2.5 3)"/>
       <path d="${WILD_D}" stroke="#ffd21f" stroke-width="9"/>
       <path d="M0 0 L2 10 M31 0 V8 M41 0 V8 M65 0 V8" stroke="#fff7c2" stroke-width="3"/>
     </g></g>`;
}

function overrideWild() {
  const ring = "M60 12 A48 48 0 1 1 59.9 12 Z";
  const arrows = "M60 -2 L70 14 H50 Z M60 122 L50 106 H70 Z M-2 60 L14 50 V70 Z M122 60 L106 70 V50 Z";
  return sticker(sil(ring, arrows)) +
    cel("owa", ring, "#ff3b3b", "#b3122e", [52, 52, 46], hl(36, 34, 10, 5)) +
    `<circle cx="60" cy="60" r="34" fill="none" stroke="#fff" stroke-width="5"/>` +
    `<path d="M60 6 V114 M6 60 H114" stroke="${INK}" stroke-width="15" stroke-linecap="round"/>
     <path d="M60 6 V114 M6 60 H114" stroke="#fff" stroke-width="7" stroke-linecap="round"/>` +
    part(arrows, "#fff", 4) +
    part("M60 46 A14 14 0 1 1 59.9 46 Z", "#ffd21f", 4.5) + `<circle cx="60" cy="60" r="5" fill="${INK}"/>` +
    `<g transform="translate(37 86) scale(.55)">
       <rect x="-8" y="-8" width="99" height="46" rx="10" fill="#ffd21f" stroke="${INK}" stroke-width="7"/>
       <path d="${WILD_D}" fill="none" stroke="${INK}" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round"/></g>`;
}

function core() {
  const hex = "M110 60 L85 103.3 L35 103.3 L10 60 L35 16.7 L85 16.7 Z";
  const plates = "M38 6 H82 V22 H38 Z M38 98 H82 V114 H38 Z";
  return `<defs>
      <radialGradient id="cg" cx=".42" cy=".4" r=".62"><stop offset="0" stop-color="#fffdf0"/><stop offset=".28" stop-color="#fff08a"/><stop offset=".62" stop-color="#ffc21f"/><stop offset="1" stop-color="#e07800"/></radialGradient>
      <radialGradient id="cglow"><stop offset=".45" stop-color="#ffd21f" stop-opacity=".9"/><stop offset="1" stop-color="#ffb000" stop-opacity="0"/></radialGradient>
      <pattern id="hz" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="12" fill="${INK}"/></pattern>
    </defs>` +
    `<circle cx="60" cy="60" r="60" fill="url(#cglow)"/>` +
    sticker(sil(hex, plates)) +
    cel("sa", hex, "#5d566e", "#2c2737", [52, 52, 52], hl(30, 30, 8, 3.5, -55, 0.35)) +
    part(plates, "#ffd21f", 4.5) +
    `<path d="M38 6 H82 V22 H38 Z M38 98 H82 V114 H38 Z" fill="url(#hz)" opacity=".85"/>` +
    `<path d="M38 6 H82 V22 H38 Z M38 98 H82 V114 H38 Z" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/>` +
    `<circle cx="60" cy="60" r="35" fill="${INK}"/>` +
    `<circle cx="60" cy="60" r="29" fill="url(#cg)"/>` +
    `<circle cx="60" cy="60" r="32" fill="none" stroke="#fff3a8" stroke-width="2" stroke-dasharray="5 6" opacity=".8"/>` +
    hl(49, 48, 8, 4.5, -35, 0.9) +
    `<path d="M74 40 l2.4 6 l6 2.4 l-6 2.4 l-2.4 6 l-2.4 -6 l-6 -2.4 l6 -2.4 Z" fill="#fff"/>` +
    part("M9 60 A6 6 0 1 1 9.1 60 Z M111 60 A6 6 0 1 1 111.1 60 Z", "#ffd21f", 3.5);
}

function staticTV() {
  const body = "M30 32 H90 Q104 32 104 46 V88 Q104 102 90 102 H30 Q16 102 16 88 V46 Q16 32 30 32 Z";
  const ant = "M60 33 L38 8 M60 33 L86 10";
  const feet = "M28 100 H42 V110 H28 Z M78 100 H92 V110 H78 Z";
  const screen = "M34 42 H76 Q84 42 84 50 V84 Q84 92 76 92 H34 Q26 92 26 84 V50 Q26 42 34 42 Z";
  let noise = "";
  for (let y = 44, i = 0; y < 92; y += 4, i++) {
    noise += `<rect x="26" y="${y}" width="58" height="2.4" fill="${["#8d8aa0", "#5b586b", "#c9c6d6", "#6f6c80"][i % 4]}" opacity=".55"/>`;
  }
  return sticker(sil(body, feet) + `<path d="${ant}" stroke-width="18" fill="none"/>`) +
    `<path d="${ant}" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>` +
    `<circle cx="38" cy="8" r="5" fill="#ff3b3b" stroke="${INK}" stroke-width="3.5"/><circle cx="86" cy="10" r="5" fill="#ff3b3b" stroke="${INK}" stroke-width="3.5"/>` +
    part(feet, "#5d566e", 4) +
    cel("xa", body, "#ffb347", "#d2711f", [54, 58, 50], hl(26, 40, 6, 3)) +
    `<clipPath id="xs"><path d="${screen}"/></clipPath><path d="${screen}" fill="#2b2833"/><g clip-path="url(#xs)">${noise}</g>` +
    `<path d="${screen}" fill="none" stroke="${INK}" stroke-width="4.5"/>` +
    `<path d="M46 58 Q46 50 55 50 Q64 50 64 58 Q64 63 57 66 Q55 67 55 72" fill="none" stroke="${INK}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
     <path d="M46 58 Q46 50 55 50 Q64 50 64 58 Q64 63 57 66 Q55 67 55 72" fill="none" stroke="#fff" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
     <circle cx="55" cy="82" r="5.5" fill="#fff" stroke="${INK}" stroke-width="3.5"/>` +
    `<circle cx="94" cy="54" r="5" fill="${INK}"/><circle cx="94" cy="72" r="5" fill="#fff3d6" stroke="${INK}" stroke-width="3"/>` +
    `<path d="M90 84 H98 M90 89 H98" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`;
}

const ART = {
  H1: sparkjaw(), H2: blazegob(), H3: tidewyrm(), H4: thornbyte(),
  L1: heelSpray(), L2: candee(), L3: glitchBerry(), L4: medal(), L5: burnedDisc(),
  W: wild(), OW: overrideWild(), S: core(), R: core(), X: staticTV(),
};

const URLS = {};
for (const [code, body] of Object.entries(ART)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 132 132">${body}</svg>`;
  URLS[code] = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  new Image().src = URLS[code]; // decode early
}
// CSS uses the Wild art for wild columns and locked cells.
document.documentElement.style.setProperty("--wild-img", `url("${URLS.W}")`);
document.documentElement.style.setProperty("--ow-img", `url("${URLS.OW}")`);

export const symbolURL = (code) => URLS[code];

export function symbolHTML(code) {
  if (!URLS[code]) return `<span class="sym-missing">${code}</span>`;
  return `<img class="sym" src="${URLS[code]}" alt="" draggable="false">`;
}
