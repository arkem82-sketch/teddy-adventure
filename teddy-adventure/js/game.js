// Teddy's Adventure - game code (canvas 1280x720, no dependencies)
// Sections: utils, images, text, audio, input, LEVELS (level data), physics, player, foes, drawing, menus, main loop
"use strict";
const W = 1280,
  H = 720;
const cv = document.getElementById("c"),
  ctx = cv.getContext("2d");
let VS = 1,
  DPR = Math.min(2, window.devicePixelRatio || 1);
function resize() {
  const r = document.body.getBoundingClientRect();
  const bw = r.width || innerWidth,
    bh = r.height || innerHeight;
  VS = Math.min(bw / W, bh / H);
  cv.style.width = Math.floor(W * VS) + "px";
  cv.style.height = Math.floor(H * VS) + "px";
  cv.width = Math.round(W * VS * DPR);
  cv.height = Math.round(H * VS * DPR);
}
addEventListener("resize", resize);
resize();

// ---------- utils ----------
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp = (a, b, t) => a + (b - a) * t,
  rnd = (a, b) => a + Math.random() * (b - a);
const ease = (t) => 1 - Math.pow(1 - t, 3);
function mulberry(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const store = {
  get(k) {
    try {
      return JSON.parse(localStorage.getItem(k));
    } catch (e) {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
  },
};

// ---------- images ----------
const IMG = {};
let loaded = 0;
const names = Object.keys(META);
names.forEach((n) => {
  const im = new Image();
  im.onload = () => loaded++;
  im.onerror = () => loaded++;
  im.src = "assets/" + n + ".webp";
  IMG[n] = im;
});
function img(n, x, y, s = 1, flip = false, alpha = 1) {
  const im = IMG[n];
  if (!im) return;
  const w = META[n][0] * s,
    h = META[n][1] * s;
  if (alpha !== 1) ctx.globalAlpha = alpha;
  if (flip) {
    ctx.save();
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(im, 0, 0, w, h);
    ctx.restore();
  } else ctx.drawImage(im, x, y, w, h);
  if (alpha !== 1) ctx.globalAlpha = 1;
}
// bottom-center anchored
function imgB(n, x, y, s = 1, flip = false, alpha = 1) {
  img(n, x - (META[n][0] * s) / 2, y - META[n][1] * s, s, flip, alpha);
}
function frame(n, f, x, y, s = 1, flip = false, alpha = 1) {
  const m = META[n];
  const [fw, fh, cnt, cols] = m;
  f = ((Math.floor(f) % cnt) + cnt) % cnt;
  const sx = (f % cols) * fw,
    sy = Math.floor(f / cols) * fh;
  const w = fw * s,
    h = fh * s;
  ctx.globalAlpha = alpha;
  if (flip) {
    ctx.save();
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(IMG[n], sx, sy, fw, fh, 0, 0, w, h);
    ctx.restore();
  } else ctx.drawImage(IMG[n], sx, sy, fw, fh, x, y, w, h);
  ctx.globalAlpha = 1;
}
function frameB(n, f, x, y, s = 1, flip = false, alpha = 1) {
  const m = META[n];
  frame(n, f, x - (m[0] * s) / 2, y - m[1] * s, s, flip, alpha);
}
// Walk / jump sheets. Durations are the source GIF frame times (ms).
// ax, ay is the ground point in frame pixels; scale matches the rig's on-screen height.
const TEDDY_WALK = {
  name: "teddy_walk",
  scale: 0.324,
  ax: 222,
  ay: 433,
  dur: [130, 120, 130, 120, 130, 120, 130, 130],
};
const TEDDY_JUMP = {
  name: "teddy_jump",
  scale: 0.324,
  ax: 222,
  ay: 438,
  dur: [140, 150, 140, 140, 140, 150, 140, 140],
};
// Aerial frames 0–5 are 860ms in the GIF; a full jump is in the air ~700ms.
// Speed the aerial cycle so those poses finish as Teddy lands. Land frames stay at GIF timing.
const JUMP_AIR_RATE = 860 / 700;
function frameFromDurs(t, durs, loop) {
  const total = durs.reduce((a, b) => a + b, 0);
  let ms = Math.max(0, t) * 1000;
  if (loop) ms = ((ms % total) + total) % total;
  let acc = 0;
  for (let i = 0; i < durs.length; i++) {
    acc += durs[i];
    if (ms < acc) return i;
  }
  return durs.length - 1;
}
function drawAnchoredFrame(name, f, x, y, s, face, alpha, ax, ay) {
  const m = META[name];
  const [fw, fh, cnt, cols] = m;
  f = ((f % cnt) + cnt) % cnt;
  const sx = (f % cols) * fw,
    sy = Math.floor(f / cols) * fh;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale((face < 0 ? -1 : 1) * s, s);
  ctx.drawImage(IMG[name], sx, sy, fw, fh, -ax, -ay, fw, fh);
  ctx.restore();
}

// ---------- text ----------
const FONT = "Cinzel, Georgia, serif",
  DFONT = '"Cinzel Decorative", Cinzel, Georgia, serif';
function text(
  s,
  x,
  y,
  size = 24,
  col = "#f6e7c8",
  align = "center",
  font = FONT,
  outline = "#2a1c12",
  ow = 5,
) {
  ctx.font = `900 ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  if (ow) {
    ctx.lineJoin = "round";
    ctx.lineWidth = ow;
    ctx.strokeStyle = outline;
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = col;
  ctx.fillText(s, x, y);
}

// ---------- audio ----------
const settings = Object.assign(
  { sound: true, music: true, touch: "auto" },
  store.get("teddy_settings") || {},
);
let AC = null,
  sfxG,
  musG;
function initAudio() {
  if (AC) {
    if (AC.state === "suspended") AC.resume();
    return;
  }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    const m = AC.createGain();
    m.gain.value = 0.8;
    m.connect(AC.destination);
    sfxG = AC.createGain();
    sfxG.connect(m);
    musG = AC.createGain();
    musG.connect(m);
    applyAudio();
  } catch (e) {
    AC = null;
  }
}
function applyAudio() {
  if (!AC) return;
  sfxG.gain.value = settings.sound ? 0.9 : 0;
  musG.gain.value = settings.music ? 0.35 : 0;
}
function tone(f, d, type = "sine", v = 0.2, f2 = 0, when = 0, dest) {
  if (!AC) return;
  const t = AC.currentTime + when;
  const o = AC.createOscillator(),
    g = AC.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g);
  g.connect(dest || sfxG);
  o.start(t);
  o.stop(t + d + 0.05);
}
let NB = null;
function noise(d, v = 0.2, ff = 1000, ft = "bandpass", when = 0, f2 = 0) {
  if (!AC) return;
  if (!NB) {
    NB = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const a = NB.getChannelData(0);
    for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1;
  }
  const t = AC.currentTime + when;
  const s = AC.createBufferSource();
  s.buffer = NB;
  const fl = AC.createBiquadFilter();
  fl.type = ft;
  fl.frequency.setValueAtTime(ff, t);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + d);
  const g = AC.createGain();
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  s.connect(fl);
  fl.connect(g);
  g.connect(sfxG);
  s.start(t);
  s.stop(t + d + 0.05);
}
const SFX = {
  jump() {
    tone(330, 0.14, "triangle", 0.18, 620);
  },
  djump() {
    tone(520, 0.16, "triangle", 0.16, 1040);
    noise(0.18, 0.12, 900, "bandpass", 0, 2400);
  },
  swing() {
    noise(0.16, 0.25, 700, "bandpass", 0, 3200);
  },
  hit() {
    tone(160, 0.14, "square", 0.14, 60);
    noise(0.1, 0.25, 600, "lowpass");
  },
  block() {
    tone(240, 0.09, "square", 0.12, 180);
    tone(720, 0.14, "triangle", 0.12);
    noise(0.08, 0.2, 2500, "highpass");
  },
  crystal() {
    [1319, 1760, 2093].forEach((f, i) => tone(f, 0.12, "sine", 0.1, 0, i * 0.05));
  },
  bone() {
    tone(392, 0.1, "triangle", 0.15);
    tone(523, 0.14, "triangle", 0.15, 0, 0.08);
  },
  rune() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.6, "sine", 0.09, 0, i * 0.07));
  },
  hurt() {
    tone(360, 0.28, "sawtooth", 0.12, 140);
  },
  die() {
    noise(0.3, 0.3, 900, "lowpass", 0, 200);
    tone(220, 0.25, "square", 0.08, 70);
  },
  bark() {
    tone(620, 0.07, "sawtooth", 0.12, 380);
    tone(640, 0.08, "sawtooth", 0.12, 400, 0.14);
  },
  portal() {
    tone(180, 1.4, "sine", 0.14, 900);
    noise(1.2, 0.12, 300, "bandpass", 0, 3000);
  },
  land() {
    noise(0.06, 0.12, 300, "lowpass");
  },
  move() {
    tone(660, 0.05, "triangle", 0.08);
  },
  select() {
    tone(880, 0.09, "triangle", 0.12);
    tone(1320, 0.12, "triangle", 0.08, 0, 0.05);
  },
  heal() {
    [523, 784, 1047].forEach((f, i) => tone(f, 0.3, "triangle", 0.1, 0, i * 0.08));
  },
  thorn() {
    noise(0.12, 0.18, 1600, "bandpass", 0, 600);
  },
};
function sfx(n) {
  if (AC && settings.sound) SFX[n]();
}
// music
const SCALES = [
  [0, 2, 4, 7, 9],
  [0, 2, 3, 7, 9],
  [0, 3, 5, 7, 10],
];
const ROOTS = [261.63, 293.66, 220];
let mus = { on: false, next: 0, step: 0, song: 0, note: 2 };
function setSong(i) {
  mus.song = i;
}
function musicTick() {
  if (!AC || !settings.music) return;
  const bpm = [100, 108, 92][mus.song],
    st = 60 / bpm / 2;
  const now = AC.currentTime;
  if (mus.next < now) mus.next = now + 0.05;
  while (mus.next < now + 0.25) {
    const t = mus.next - now,
      sc = SCALES[mus.song],
      r = ROOTS[mus.song],
      s = mus.step % 32;
    if (s % 8 === 0) {
      const deg = [0, 3, 4, 2][Math.floor(s / 8) % 4];
      const f = (r / 2) * Math.pow(2, sc[deg % 5] / 12);
      tone(f, st * 7, "sine", 0.14, 0, t, musG);
      tone(f * 1.5, st * 7, "triangle", 0.03, 0, t, musG);
    }
    if (Math.random() < 0.6) {
      mus.note = clamp(mus.note + Math.floor(rnd(-2, 3)), 0, 9);
      const o = Math.floor(mus.note / 5),
        f = r * Math.pow(2, (sc[mus.note % 5] + 12 * o) / 12);
      tone(f, st * 1.6, "triangle", 0.05, 0, t, musG);
    }
    mus.step++;
    mus.next += st;
  }
}

// ---------- input ----------
const keys = {},
  pressed = {};
const KEYMAP = {
  left: ["ArrowLeft", "KeyA"],
  right: ["ArrowRight", "KeyD"],
  up: ["ArrowUp", "KeyW"],
  down: ["ArrowDown", "KeyS"],
  jump: ["Space", "ArrowUp", "KeyW", "KeyZ"],
  attack: ["KeyJ", "KeyX"],
  block: ["KeyK", "KeyC", "ShiftLeft", "ShiftRight"],
  pause: ["Escape", "KeyP"],
  confirm: ["Enter", "Space", "NumpadEnter"],
  back: ["Escape", "Backspace"],
};
const touchState = { left: false, right: false, jump: false, attack: false, block: false };
const touchPressed = {};
function held(a) {
  return KEYMAP[a].some((k) => keys[k]) || touchState[a];
}
function hit(a) {
  return KEYMAP[a].some((k) => pressed[k]) || touchPressed[a];
}
addEventListener("keydown", (e) => {
  initAudio();
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  if (!keys[e.code]) pressed[e.code] = true;
  keys[e.code] = true;
  usingTouch = false;
});
addEventListener("keyup", (e) => {
  keys[e.code] = false;
});
addEventListener("blur", () => {
  for (const k in keys) keys[k] = false;
});
let mouse = { x: 0, y: 0, click: false };
let usingTouch = "ontouchstart" in window || matchMedia("(pointer:coarse)").matches;
function toLogical(e) {
  const r = cv.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
}
const TB = [
  { id: "left", x: 95, y: 630, r: 62, img: "ui_left" },
  { id: "right", x: 235, y: 630, r: 62, img: "ui_right" },
  { id: "attack", x: 1062, y: 640, r: 58, img: "ui_paw_2", label: "ATTACK" },
  { id: "jump", x: 1190, y: 585, r: 62, img: "ui_paw_1", label: "JUMP" },
  { id: "block", x: 1080, y: 500, r: 52, img: "ui_paw_3", label: "BLOCK" },
];
const ptrs = new Map();
function showTouch() {
  return settings.touch === "on" || (settings.touch === "auto" && usingTouch);
}
function tbAt(p) {
  if (!showTouch() || state !== "play") return null;
  for (const b of TB) {
    if (Math.hypot(p.x - b.x, p.y - b.y) < b.r + 14) return b.id;
  }
  return null;
}
function refreshTouch() {
  for (const k in touchState) touchState[k] = false;
  for (const id of ptrs.values()) if (id) touchState[id] = true;
}
cv.addEventListener("pointerdown", (e) => {
  initAudio();
  cv.focus();
  const p = toLogical(e);
  if (e.pointerType === "touch") usingTouch = true;
  else if (e.pointerType === "mouse")
    usingTouch = usingTouch && settings.touch !== "auto" ? usingTouch : false;
  const b = tbAt(p);
  if (b) {
    ptrs.set(e.pointerId, b);
    touchPressed[b] = true;
    refreshTouch();
    cv.setPointerCapture(e.pointerId);
    e.preventDefault();
    return;
  }
  mouse.x = p.x;
  mouse.y = p.y;
  mouse.click = true;
});
cv.addEventListener("pointermove", (e) => {
  const p = toLogical(e);
  mouse.x = p.x;
  mouse.y = p.y;
  if (ptrs.has(e.pointerId)) {
    const b = tbAt(p);
    const old = ptrs.get(e.pointerId);
    if (b && b !== old && (b === "left" || b === "right") && (old === "left" || old === "right")) {
      ptrs.set(e.pointerId, b);
      refreshTouch();
    }
  }
});
function ptrEnd(e) {
  if (ptrs.has(e.pointerId)) {
    ptrs.delete(e.pointerId);
    refreshTouch();
  }
}
cv.addEventListener("pointerup", ptrEnd);
cv.addEventListener("pointercancel", ptrEnd);
cv.addEventListener("contextmenu", (e) => e.preventDefault());

// ---------- level data ----------
const LEVELS = [
  {
    name: "Whispering Meadow",
    sky: ["#9fc0cf", "#d9dcc4", "#efe3c1"],
    fog: "rgba(214,220,205,",
    song: 0,
    w: 5000,
    ground: [
      [-300, 1300, 600],
      [1480, 2600, 600],
      [2780, 3300, 600],
      [3300, 3900, 540],
      [4080, 5300, 600],
    ],
    plats: [
      [700, 470, 200],
      [1000, 380, 180],
      [2000, 460, 220],
      [2300, 360, 180],
      [3500, 400, 200],
      [3720, 290, 160],
      [4300, 460, 200],
    ],
    foes: [
      ["walk", 1180],
      ["walk", 1900],
      ["walk", 2400],
      ["walk", 3100],
      ["walk", 3600],
      ["hop", 4500],
    ],
    runes: [
      [2390, 320],
      [3800, 250],
      [4700, 560],
    ],
    bones: [
      [1650, 560],
      [3440, 500],
    ],
    crystals: [
      [400, 560],
      [450, 560],
      [500, 560],
      [760, 430],
      [800, 430],
      [840, 430],
      [1040, 340],
      [1080, 340],
      [1120, 340],
      [1390, 470],
      [1560, 520],
      [2060, 420],
      [2110, 420],
      [2160, 420],
      [2650, 480],
      [2700, 470],
      [2950, 560],
      [3560, 360],
      [3610, 360],
      [3660, 360],
      [3990, 440],
      [4350, 420],
      [4400, 420],
      [4450, 420],
    ],
    big: [
      [1250, 600],
      [4000, 540],
    ],
    dog: 3040,
    cave: 4780,
    signs: [
      [260, "MOVE", "Arrows / A D"],
      [640, "JUMP", "Space - twice to double jump!"],
      [1180, "ATTACK", "J / X - swing your sword"],
      [1720, "BLOCK", "Hold K / C - raise your button shield"],
      [2230, "RUNES", "Find 3 rune stones to open the portal"],
    ],
  },
  {
    name: "Rune Stone Hills",
    sky: ["#e6b886", "#efcf9e", "#f3e2bc"],
    fog: "rgba(240,214,170,",
    song: 1,
    w: 6400,
    ground: [
      [-300, 900, 600],
      [1200, 2000, 600],
      [2000, 2600, 520],
      [2900, 3500, 600],
      [3800, 4300, 560],
      [4300, 4800, 470],
      [5100, 6700, 600],
    ],
    plats: [
      [1010, 500, 110],
      [1500, 450, 180],
      [1750, 350, 160],
      [2300, 380, 180],
      [2690, 440, 120],
      [3100, 440, 200],
      [3350, 330, 160],
      [3590, 470, 120],
      [4000, 400, 160],
      [4500, 330, 180],
      [4890, 470, 120],
      [5300, 450, 200],
      [5600, 340, 180],
    ],
    foes: [
      ["walk", 600],
      ["hop", 1500],
      ["walk", 1850],
      ["hop", 2350],
      ["walk", 3200],
      ["hop", 3400],
      ["walk", 4100],
      ["hop", 4600],
      ["walk", 5450],
      ["hop", 5800],
      ["walk", 6000],
    ],
    runes: [
      [1830, 300],
      [3430, 280],
      [4590, 280],
    ],
    bones: [
      [1300, 560],
      [3950, 520],
    ],
    crystals: [
      [300, 560],
      [350, 560],
      [1060, 460],
      [1550, 410],
      [1600, 410],
      [1800, 310],
      [2150, 480],
      [2200, 480],
      [2350, 340],
      [2400, 340],
      [2740, 400],
      [3150, 400],
      [3200, 400],
      [3250, 400],
      [3640, 430],
      [4050, 360],
      [4100, 360],
      [4400, 430],
      [4940, 430],
      [5350, 410],
      [5400, 410],
      [5450, 410],
      [5650, 300],
      [5700, 300],
      [5750, 300],
    ],
    big: [
      [2550, 520],
      [5200, 600],
    ],
    dog: 3000,
    cave: 6150,
    signs: [[200, "TIP", "Some gaps need a double jump!"]],
  },
  {
    name: "Thorn Hollow",
    sky: ["#4b4e78", "#9a7894", "#e0a88a"],
    fog: "rgba(160,130,150,",
    song: 2,
    w: 7200,
    ground: [
      [-300, 1000, 600],
      [1300, 2100, 600],
      [2100, 2700, 500],
      [2700, 3200, 600],
      [3500, 4200, 600],
      [4500, 5000, 520],
      [5300, 7500, 600],
    ],
    plats: [
      [1110, 480, 100],
      [1600, 440, 180],
      [1850, 330, 160],
      [2300, 360, 180],
      [2850, 430, 180],
      [3050, 320, 150],
      [3320, 470, 110],
      [3700, 420, 200],
      [4000, 310, 160],
      [4320, 450, 110],
      [4700, 380, 180],
      [5120, 460, 110],
      [5700, 440, 200],
      [6000, 330, 180],
    ],
    foes: [
      ["walk", 700],
      ["hop", 850],
      ["big", 1750],
      ["hop", 2450],
      ["walk", 2950],
      ["big", 3900],
      ["walk", 4800],
      ["hop", 4650],
      ["hop", 5600],
      ["walk", 5900],
      ["hop", 6150],
      ["big", 6500],
    ],
    runes: [
      [1930, 280],
      [4080, 260],
      [6080, 280],
    ],
    bones: [
      [2500, 460],
      [4620, 480],
      [5450, 560],
    ],
    crystals: [
      [300, 560],
      [360, 560],
      [1150, 440],
      [1650, 400],
      [1700, 400],
      [1900, 290],
      [2350, 320],
      [2400, 320],
      [2900, 390],
      [2950, 390],
      [3100, 280],
      [3360, 430],
      [3750, 380],
      [3800, 380],
      [3850, 380],
      [4360, 410],
      [4750, 340],
      [4800, 340],
      [5160, 420],
      [5750, 400],
      [5800, 400],
      [6050, 290],
      [6100, 290],
    ],
    big: [
      [2650, 500],
      [5000, 520],
    ],
    dog: 5500,
    cave: 6950,
    signs: [[200, "BEWARE", "Big thornbacks spit thorns - block them!"]],
  },
];

// ---------- game state ----------
let state = "loading",
  prevState = "",
  stateT = 0,
  levelIdx = 0,
  L = null,
  cam = { x: 0, y: 0 },
  P = null,
  foes = [],
  items = [],
  parts = [],
  shots = [],
  decor = [],
  dog = null,
  cave = null,
  signs = [];
let totals = { crystals: 0, foes: 0 },
  levelStats = { crystals: 0, foes: 0, time: 0 },
  checkpoint = null,
  banner = 0,
  fade = 0,
  fadeTo = null,
  msg = null;
let menuSel = 0,
  titleCam = 0,
  flash = 0,
  shake = 0;

function groundAt(x) {
  for (const g of L.ground) if (x >= g[0] && x <= g[1]) return g;
  return null;
}
function surfaceY(x) {
  const g = groundAt(x);
  return g ? g[2] : null;
}

function buildDecor() {
  decor = [];
  const r = mulberry(levelIdx * 977 + 13);
  const pick = (a) => a[Math.floor(r() * a.length)];
  for (const g of L.ground) {
    const x0 = Math.max(g[0], -100),
      x1 = Math.min(g[1], L.w + 200);
    for (let x = x0 + 140; x < x1 - 120; x += rnd(260, 420) * 0 + 260 + r() * 260) {
      const t = r();
      let n,
        s = 1,
        layer = "back";
      if (t < 0.22) {
        n = pick(["tree1", "tree2", "tree3", "tree4"]);
        s = 0.8 + r() * 0.35;
      } else if (t < 0.34) {
        n = pick(["sym1", "sym2", "sym3", "sym4", "sym5", "sym6"]);
        s = 0.9;
      } else if (t < 0.44) {
        n = pick(["rock5", "rock6", "sym8", "sym9"]);
        s = 0.7 + r() * 0.2;
      } else if (t < 0.56) {
        n = pick(["fence1", "fence2"]);
        s = 0.75;
      } else if (t < 0.66) {
        n = pick([
          "stone1",
          "stone3",
          "stone4",
          "stone6",
          "stone8",
          "stone9",
          "rock1",
          "rock2",
          "rock3",
          "rock4",
        ]);
        s = 1;
        layer = r() < 0.4 ? "front" : "back";
      } else if (t < 0.8) {
        decor.push({
          anim: "grass",
          x,
          y: g[2] + 18,
          s: 0.7 + r() * 0.3,
          f: r() * 40,
          layer: r() < 0.5 ? "front" : "back",
          flip: r() < 0.5,
        });
        continue;
      } else if (t < 0.88) {
        n = pick(["sym7", "sym10", "trees"]);
        s = 0.6;
      } else {
        n = pick(["stone11", "stone2", "stone5", "stone7", "stone10"]);
        s = 0.9;
      }
      decor.push({ n, x, y: g[2] + 14, s, layer, flip: r() < 0.5 });
    }
    // ground patches on top
    for (let x = x0 + 60; x < x1 - 200; x += 300 + r() * 400)
      decor.push({
        n: pick(["gd1", "gd2", "gd3", "gd4", "gd5"]),
        x,
        y: g[2] + 34,
        s: 0.55,
        layer: "patch",
        flip: r() < 0.5,
      });
  }
  decor.push({ n: "door", x: L.cave - 360, y: surfaceY(L.cave - 360) + 14, s: 0.75, layer: "back" });
  decor.push({ n: "cave_a", x: L.cave + 220, y: surfaceY(L.cave) + 14, s: 0.9, layer: "back" });
  decor.push({ n: "bowl", x: L.dog - 90, y: surfaceY(L.dog) + 12, s: 0.75, layer: "back" });
  decor.push({ n: "boneb", x: L.dog + 80, y: surfaceY(L.dog) + 8, s: 0.9, layer: "back" });
  decor.push({ anim: "flies", x: L.dog - 90, y: surfaceY(L.dog) - 20, s: 0.7, f: 0, layer: "front" });
  decor.sort(
    (a, b) => (a.n === "trees" || a.n === "sym10" ? 0 : 1) - (b.n === "trees" || b.n === "sym10" ? 0 : 1),
  );
}

function newPlayer(x) {
  const y = surfaceY(x) || 600;
  return {
    x,
    y,
    w: 50,
    h: 112,
    vx: 0,
    vy: 0,
    face: 1,
    onGround: true,
    jumps: 0,
    coyote: 0,
    buffer: 0,
    atk: -1,
    swing: 0,
    block: 0,
    hurt: 0,
    inv: 0,
    hp: 5,
    hpShow: 5,
    flip: 0,
    run: 0,
    t: 0,
    land: 0,
    walkT: 0,
    jumpT: 0,
    showLand: false,
    dead: false,
    exit: 0,
    lastSafe: x,
  };
}

function loadLevel(i, keepHp) {
  levelIdx = i;
  L = LEVELS[i];
  setSong(L.song);
  const hp = keepHp && P ? P.hp : 5;
  P = newPlayer(120);
  P.hp = P.hpShow = hp;
  checkpoint = { x: 120 };
  foes = L.foes.map(([t, x]) => makeFoe(t, x));
  items = [];
  shots = [];
  parts = [];
  L.crystals.forEach(([x, y]) => items.push({ t: "crystal", x, y, ph: Math.random() * 6 }));
  L.big.forEach(([x, y]) => items.push({ t: "bigcrystal", x, y, ph: Math.random() * 6 }));
  L.bones.forEach(([x, y]) => items.push({ t: "bone", x, y, ph: Math.random() * 6 }));
  L.runes.forEach(([x, y], k) =>
    items.push({ t: "rune", x, y, ph: Math.random() * 6, id: [3, 7, 12, 5, 9, 14, 2, 11, 16][i * 3 + k] }),
  );
  dog = { x: L.dog, y: surfaceY(L.dog), anim: "dog_idle", f: 0, active: false, face: -1, bark: 0, sniffT: 4 };
  cave = { x: L.cave, y: surfaceY(L.cave), open: 0, runes: 0, hint: 0 };
  signs = L.signs.map((s) => ({ x: s[0], title: s[1], txt: s[2] }));
  butterflies = [0, 1, 2, 3].map((k) => ({ x: 600 + (k * L.w) / 4, y: 380 + k * 20, ph: k * 2 }));
  levelStats = { crystals: 0, foes: 0, time: 0, runes: 0, bones: 0 };
  msg = null;
  buildDecor();
  cam.x = 0;
  cam.y = 0;
  banner = 3.2;
}
let butterflies = [];

function makeFoe(t, x) {
  const y = surfaceY(x) || 600;
  const d = {
    walk: { w: 74, h: 70, hp: 2, sp: 70, img: "thorn_walk", s: 0.62, bb: 131, leg: 16 },
    hop: { w: 70, h: 78, hp: 2, sp: 0, img: "thorn_hop", s: 0.58, bb: 158, leg: 12 },
    big: { w: 150, h: 130, hp: 6, sp: 40, img: "thorn_big", s: 0.72, bb: 222, leg: 22 },
  }[t];
  return Object.assign(
    {
      t,
      x,
      y,
      vx: 0,
      vy: 0,
      face: -1,
      hurt: 0,
      dead: false,
      cool: 1 + Math.random(),
      ph: Math.random() * 6,
      onGround: true,
      hitBy: -1,
      maxhp: d.hp,
    },
    d,
  );
}

// ---------- physics ----------
const GRAV = 2400,
  RUN = 340,
  JV = 840,
  DJV = 760;
function solidsAt() {
  return L.ground;
}
function moveBody(b, dt, oneWay = true) {
  const prevY = b.y;
  b.x += b.vx * dt;
  // walls (ground sides)
  for (const g of L.ground) {
    if (b.y > g[2] + 4 && b.x + b.w / 2 > g[0] && b.x - b.w / 2 < g[1]) {
      if (b.x < g[0] + b.w / 2) {
        b.x = g[0] - b.w / 2;
        b.vx = Math.min(0, b.vx);
        b.hitWall = true;
      } else if (b.x > g[1] - b.w / 2) {
        b.x = g[1] + b.w / 2;
        b.vx = Math.max(0, b.vx);
        b.hitWall = true;
      }
    }
  }
  b.x = clamp(b.x, -60 + b.w / 2, L.w + 260);
  b.vy += GRAV * dt;
  b.vy = Math.min(b.vy, 1500);
  b.y += b.vy * dt;
  b.onGround = false;
  if (b.vy >= 0) {
    for (const g of L.ground) {
      if (b.x > g[0] - b.w * 0.3 && b.x < g[1] + b.w * 0.3 && prevY <= g[2] + 2 && b.y >= g[2]) {
        b.y = g[2];
        b.vy = 0;
        b.onGround = true;
        b.plat = null;
      }
    }
    if (oneWay && !b.onGround)
      for (const p of L.plats) {
        if (b.x > p[0] - b.w * 0.25 && b.x < p[0] + p[2] + b.w * 0.25 && prevY <= p[1] + 2 && b.y >= p[1]) {
          b.y = p[1];
          b.vy = 0;
          b.onGround = true;
          b.plat = p;
        }
      }
  }
}

// ---------- particles ----------
function burst(x, y, n, type, col) {
  for (let i = 0; i < n; i++)
    parts.push({
      x,
      y,
      vx: rnd(-260, 260),
      vy: rnd(-420, -80),
      life: rnd(0.4, 0.9),
      max: 0.9,
      type,
      col,
      rot: rnd(0, 6),
      vr: rnd(-10, 10),
      s: rnd(3, 8),
    });
}
function floatText(x, y, s, col) {
  parts.push({ x, y, vx: 0, vy: -60, life: 1.1, max: 1.1, type: "text", txt: s, col });
}
function puff(x, y, s = 0.18) {
  parts.push({ x, y, vx: 0, vy: -20, life: 0.5, max: 0.5, type: "puff", s });
}

// ---------- player update ----------
function hurtPlayer(src, dmg = 1) {
  if (P.inv > 0 || P.exit || P.dead) return false;
  const dir = Math.sign(src.x - P.x) || P.face;
  if (P.block > 0.6 && dir === P.face) {
    sfx("block");
    burst(P.x + P.face * 50, P.y - 70, 10, "spark", "#ffe9a8");
    P.vx = -dir * 220;
    if (src.vx !== undefined && src.t) {
      src.vx = dir * 420;
      src.vy = -260;
      src.hurt = 0.15;
    }
    shake = 4;
    return "blocked";
  }
  P.hp -= dmg;
  P.inv = 1.3;
  P.hurt = 0.35;
  P.vx = -dir * 420;
  P.vy = -460;
  flash = 0.25;
  shake = 10;
  sfx("hurt");
  burst(P.x, P.y - 70, 8, "fluff", "#e6c9a0");
  if (P.hp <= 0) {
    P.hp = 0;
    P.dead = true;
    P.deadT = 0;
  }
  return true;
}
function updatePlayer(dt) {
  P.t += dt;
  levelStats.time += dt;
  if (P.exit) {
    P.exit += dt;
    P.x = lerp(P.x, cave.x + 10, dt * 2);
    if (P.exit > 1.6 && !fadeTo) {
      fadeTo = "clear";
    }
    return;
  }
  if (P.dead) {
    P.deadT += dt;
    P.vx *= 0.9;
    moveBody(P, dt);
    if (P.deadT > 1.4 && state === "play") {
      state = "gameover";
      stateT = 0;
      menuSel = 0;
    }
    return;
  }
  const L_ = held("left"),
    R_ = held("right");
  let dir = (R_ ? 1 : 0) - (L_ ? 1 : 0);
  const blocking = held("block") && P.atk < 0;
  P.block = clamp(P.block + (blocking ? 1 : -1) * dt * 10, 0, 1);
  if (dir && P.hurt <= 0) P.face = dir;
  const sp = RUN * (blocking ? 0.35 : 1) * (P.atk >= 0 && P.onGround ? 0.55 : 1);
  if (P.hurt > 0) {
    P.hurt -= dt;
  } else {
    const target = dir * sp;
    const acc = P.onGround ? 2600 : 1600;
    P.vx += clamp(target - P.vx, -acc * dt, acc * dt);
  }
  P.coyote = P.onGround ? 0.1 : P.coyote - dt;
  P.buffer = hit("jump") ? 0.13 : P.buffer - dt;
  if (P.buffer > 0 && P.hurt <= 0) {
    if (P.coyote > 0) {
      P.vy = -JV;
      P.onGround = false;
      P.coyote = 0;
      P.jumps = 1;
      P.buffer = 0;
      P.jumpT = 0;
      P.showLand = false;
      // Physics steps more than once per frame. Consume the press so the
      // second step does not spend the double jump on the same tap.
      for (const k of KEYMAP.jump) delete pressed[k];
      sfx("jump");
      puff(P.x, P.y, 0.14);
    } else if (P.jumps < 2) {
      P.vy = -DJV;
      P.jumps = 2;
      P.buffer = 0;
      P.jumpT = 0;
      P.showLand = false;
      for (const k of KEYMAP.jump) delete pressed[k];
      P.flip = 0.42;
      sfx("djump");
      puff(P.x, P.y - 10, 0.22);
    }
  }
  if (!held("jump") && P.vy < -300 && P.jumps === 1) P.vy += GRAV * dt * 1.4; // variable height
  if (hit("attack") && P.atk < 0 && P.block < 0.3) {
    P.atk = 0;
    P.swing++;
    sfx("swing");
  }
  if (P.atk >= 0) {
    P.atk += dt;
    if (P.atk > 0.36) P.atk = -1;
  }
  if (P.flip > 0) P.flip -= dt;
  if (P.inv > 0) P.inv -= dt;
  if (P.land > 0) P.land -= dt;
  const wasG = P.onGround,
    vyb = P.vy;
  moveBody(P, dt);
  if (P.onGround) {
    if (!wasG) {
      const fromJump = P.jumps > 0 || vyb > 420;
      P.showLand = fromJump;
      P.land = fromJump ? 0.28 : 0.12;
      if (vyb > 500) {
        sfx("land");
        puff(P.x - 20, P.y, 0.1);
        puff(P.x + 20, P.y, 0.1);
      }
    }
    P.jumps = 0;
    const g = groundAt(P.x);
    if (g && !P.plat && P.x > g[0] + 70 && P.x < g[1] - 70) P.lastSafe = P.x;
  }
  if (Math.abs(P.vx) > 30 && P.onGround) P.run += ((dt * Math.abs(P.vx)) / RUN) * 11;
  if (Math.abs(P.vx) > 30 && P.onGround && !P.dead && P.hurt <= 0) {
    const rate = clamp(Math.abs(P.vx) / RUN, 0.5, 1.2);
    P.walkT += dt * rate;
  }
  if (!P.onGround && P.jumps > 0 && !P.dead) P.jumpT += dt * JUMP_AIR_RATE;
  if (P.onGround && P.land <= 0) P.showLand = false;
  // fell
  if (P.y > H + 260) {
    P.hp -= 1;
    flash = 0.3;
    sfx("hurt");
    if (P.hp <= 0) {
      P.hp = 0;
      P.dead = true;
      P.deadT = 1.4;
      P.y = H + 300;
    } else {
      P.x = P.lastSafe;
      P.y = surfaceY(P.x) || 600;
      P.vx = P.vy = 0;
      P.inv = 1.5;
    }
  }
  P.hpShow = lerp(P.hpShow, P.hp, dt * 2.5);
  // attack hitbox
  if (P.atk > 0.07 && P.atk < 0.22) {
    const hx0 = P.face > 0 ? P.x : P.x - 115,
      hx1 = P.face > 0 ? P.x + 115 : P.x;
    for (const f of foes) {
      if (f.dead || f.hitBy === P.swing) continue;
      if (f.x + f.w / 2 > hx0 && f.x - f.w / 2 < hx1 && f.y - f.h < P.y + 10 && f.y > P.y - 140) {
        f.hitBy = P.swing;
        f.hp--;
        f.hurt = 0.25;
        f.vx = P.face * (f.t === "big" ? 200 : 380);
        f.vy = -280;
        sfx("hit");
        shake = 5;
        burst(f.x, f.y - f.h / 2, 8, "twig");
        if (f.hp <= 0) {
          f.dead = true;
          sfx("die");
          burst(f.x, f.y - f.h / 2, 18, "twig");
          burst(f.x, f.y - f.h / 2, 8, "spark", "#ffb45a");
          levelStats.foes++;
          items.push({ t: "crystal", x: f.x, y: f.y - 40, ph: 0, vy: -400, drop: true });
          if (f.t === "big")
            for (let k = 0; k < 3; k++)
              items.push({ t: "crystal", x: f.x + (k - 1) * 40, y: f.y - 60, ph: k, vy: -500, drop: true });
        }
      }
    }
    for (const s of shots) {
      if (!s.friendly && s.x > hx0 - 10 && s.x < hx1 + 10 && Math.abs(s.y - (P.y - 70)) < 70) {
        s.friendly = true;
        s.vx = P.face * 600;
        s.vy = -80;
        sfx("block");
      }
    }
  }
  // items
  for (const it of items) {
    if (it.got) continue;
    const r = it.t === "bigcrystal" ? 60 : 44;
    if (Math.abs(it.x - P.x) < r && Math.abs(it.y - (P.y - 60)) < r + 30) {
      it.got = true;
      if (it.t === "crystal") {
        levelStats.crystals++;
        sfx("crystal");
        floatText(it.x, it.y - 20, "+1", "#9fe3ff");
        burst(it.x, it.y, 6, "spark", "#8fd8ff");
      }
      if (it.t === "bigcrystal") {
        levelStats.crystals += 5;
        sfx("rune");
        floatText(it.x, it.y - 60, "+5", "#9fe3ff");
        burst(it.x, it.y - 30, 16, "spark", "#8fd8ff");
      }
      if (it.t === "bone") {
        levelStats.bones++;
        sfx("bone");
        floatText(it.x, it.y - 20, "Bone! Give it to the pup", "#fff1d0");
      }
      if (it.t === "rune") {
        cave.runes++;
        sfx("rune");
        floatText(it.x, it.y - 30, `Rune stone ${cave.runes}/3`, "#ffe28a");
        burst(it.x, it.y, 14, "spark", "#ffe28a");
        if (cave.runes === 3) {
          setTimeout(() => sfx("portal"), 300);
          msg = { t: 3, txt: "The portal has awakened!" };
        }
      }
    }
  }
  // dog
  if (Math.abs(dog.x - P.x) < 130 && Math.abs(dog.y - P.y) < 80) {
    if (!dog.active) {
      dog.active = true;
      checkpoint = { x: dog.x };
      P.lastSafe = dog.x;
      sfx("bark");
      dog.bark = 1;
      floatText(dog.x, dog.y - 120, "Checkpoint!", "#fff1d0");
    }
    if (levelStats.bones > 0 && dog.anim !== "dog_bone") {
      levelStats.bones--;
      dog.anim = "dog_bone";
      dog.f = 0;
      P.hp = 5;
      sfx("heal");
      floatText(P.x, P.y - 150, "Health restored!", "#a8f0a0");
      burst(P.x, P.y - 80, 12, "spark", "#a8f0a0");
    }
  }
  // cave
  const nearCave = Math.abs(P.x - cave.x) < 70 && P.onGround;
  if (nearCave && cave.open >= 1 && !P.exit) {
    P.exit = 0.001;
    P.vx = 0;
    sfx("portal");
  } else if (Math.abs(P.x - cave.x) < 200 && cave.runes < 3 && cave.hint <= 0) {
    msg = { t: 2.5, txt: `The portal needs 3 rune stones (${cave.runes}/3)` };
    cave.hint = 4;
  }
  if (cave.hint > 0) cave.hint -= dt;
}

// ---------- foes ----------
function updateFoes(dt) {
  for (const f of foes) {
    if (f.dead) continue;
    f.ph += dt;
    if (f.hurt > 0) f.hurt -= dt;
    const dx = P.x - f.x,
      adx = Math.abs(dx);
    if (adx > 1600) {
      continue;
    }
    if (f.t === "walk" || f.t === "big") {
      if (f.onGround && f.hurt <= 0) {
        const ahead = f.x + f.face * (f.w / 2 + 10);
        if ((surfaceY(ahead) !== f.y && !f.plat) || f.hitWall) f.face *= -1;
        if (f.plat && (ahead < f.plat[0] || ahead > f.plat[0] + f.plat[2])) f.face *= -1;
        if (adx < 420 && Math.abs(P.y - f.y) < 60 && Math.sign(dx) !== f.face && f.cool <= 0) {
          f.face = Math.sign(dx);
          f.cool = 1.2;
        }
        f.vx = f.face * f.sp * (adx < 420 ? 1.5 : 1);
      }
      f.cool -= dt;
      if (f.t === "big") {
        f.shoot = (f.shoot || 2) - dt;
        if (f.shoot <= 0 && adx < 700 && Math.abs(P.y - f.y) < 220) {
          f.face = Math.sign(dx) || f.face;
          f.shoot = 2.6;
          f.spit = 0.4;
          sfx("thorn");
          shots.push({
            x: f.x + f.face * 70,
            y: f.y - f.h * 0.55,
            vx: f.face * 400,
            vy: -140,
            life: 3,
            rot: 0,
          });
        }
        if (f.spit > 0) f.spit -= dt;
      }
    } else if (f.t === "hop") {
      f.cool -= dt;
      if (f.onGround) {
        f.vx *= 0.8;
        if (f.cool <= 0 && adx < 520) {
          const d = Math.sign(dx);
          const land = f.x + d * 150;
          if (surfaceY(land) === null && !L.plats.some((p) => land > p[0] && land < p[0] + p[2])) {
            f.cool = 0.8;
            f.face = d;
          } else {
            f.vy = -760;
            f.vx = d * 260;
            f.face = d;
            f.cool = 1.3 + Math.random() * 0.6;
            f.onGround = false;
          }
        }
      }
    }
    f.hitWall = false;
    moveBody(f, dt);
    if (f.y > H + 200) {
      f.dead = true;
    }
    // contact
    if (!P.dead && !P.exit && Math.abs(dx) < f.w / 2 + 22 && P.y > f.y - f.h - 10 && P.y - 110 < f.y) {
      hurtPlayer(f);
    }
  }
  for (const s of shots) {
    s.life -= dt;
    s.vy += 300 * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.rot = Math.atan2(s.vy, s.vx);
    if (!s.friendly) {
      if (Math.abs(s.x - P.x) < 30 && s.y > P.y - 120 && s.y < P.y) {
        const r = hurtPlayer(s);
        if (r === "blocked") {
          s.friendly = true;
          s.vx *= -1.4;
          s.vy = -200;
        } else if (r) s.life = 0;
      }
    } else
      for (const f of foes) {
        if (!f.dead && Math.abs(s.x - f.x) < f.w / 2 && s.y > f.y - f.h && s.y < f.y) {
          f.hp -= 2;
          f.hurt = 0.3;
          s.life = 0;
          sfx("hit");
          burst(s.x, s.y, 8, "twig");
          if (f.hp <= 0) {
            f.dead = true;
            sfx("die");
            burst(f.x, f.y - f.h / 2, 18, "twig");
            levelStats.foes++;
            items.push({ t: "crystal", x: f.x, y: f.y - 40, ph: 0, vy: -400, drop: true });
          }
        }
      }
    const sy = surfaceY(s.x);
    if (sy !== null && s.y > sy) s.life = 0;
  }
  shots = shots.filter((s) => s.life > 0);
}

function updateWorld(dt) {
  for (const it of items) {
    it.ph += dt;
    if (it.drop) {
      it.vy += GRAV * dt;
      it.y += it.vy * dt;
      const sy = surfaceY(it.x);
      let top = sy;
      for (const p of L.plats)
        if (it.x > p[0] && it.x < p[0] + p[2] && it.y - it.vy * dt <= p[1] - 30)
          top = Math.min(top ?? 9999, p[1]);
      if (top !== null && it.y > top - 30) {
        it.y = top - 30;
        it.vy = 0;
        it.drop = false;
      }
      if (it.y > H + 300) it.got = true;
    }
  }
  for (const p of parts) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.type !== "text" && p.type !== "puff") p.vy += 900 * dt;
    p.rot += p.vr * dt || 0;
  }
  parts = parts.filter((p) => p.life > 0);
  // dog anim
  dog.f += dt * 24;
  const m = META[dog.anim];
  if (dog.anim === "dog_bone" && dog.f >= m[2] * 2) {
    dog.anim = "dog_idle";
    dog.f = 0;
  } else if (dog.anim === "dog_sniff" && dog.f >= m[2]) {
    dog.anim = "dog_idle";
    dog.f = 0;
  } else if (dog.anim === "dog_idle") {
    dog.sniffT -= dt;
    if (dog.sniffT <= 0) {
      dog.anim = "dog_sniff";
      dog.f = 0;
      dog.sniffT = 5 + Math.random() * 4;
    }
  }
  dog.face = P.x < dog.x ? -1 : 1;
  if (dog.bark > 0) dog.bark -= dt;
  if (cave.runes >= 3) cave.open = Math.min(cave.open + dt * 0.8, 1.5);
  for (const d of decor) if (d.anim) d.f += dt * 20;
  for (const b of butterflies) b.ph += dt;
  if (msg) {
    msg.t -= dt;
    if (msg.t <= 0) msg = null;
  }
}

// ---------- drawing ----------
let earthPat = null;
function makeEarth() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#5a4634";
  g.fillRect(0, 0, 256, 256);
  const r = mulberry(5);
  g.globalAlpha = 0.55;
  for (let i = 0; i < 18; i++) {
    const n = ["stone1", "stone3", "stone4", "stone5", "stone6", "stone8", "stone9", "rock1", "rock4"][
      Math.floor(r() * 9)
    ];
    const x = r() * 256,
      y = r() * 256,
      s = 0.5 + r() * 0.4;
    for (const ox of [-256, 0, 256])
      for (const oy of [-256, 0, 256]) g.drawImage(IMG[n], x + ox, y + oy, META[n][0] * s, META[n][1] * s);
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = "multiply";
  g.fillStyle = "#8a7560";
  g.fillRect(0, 0, 256, 256);
  earthPat = ctx.createPattern(c, "repeat");
}

function drawSky(t) {
  const s = L.sky;
  const gr = ctx.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, s[0]);
  gr.addColorStop(0.6, s[1]);
  gr.addColorStop(1, s[2]);
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, W, H);
  // sun glow
  const sg = ctx.createRadialGradient(W * 0.72, H * 0.3, 10, W * 0.72, H * 0.3, 380);
  sg.addColorStop(0, "rgba(255,248,220,0.55)");
  sg.addColorStop(1, "rgba(255,248,220,0)");
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, W, H);
}
function drawParallax(cx, cy, t) {
  // clouds
  for (let i = 0; i < 7; i++) {
    const px = ((((i * 520 - cx * 0.06 - t * 12) % 3640) + 3640) % 3640) - 500;
    img("cloud", px, 40 + (i % 3) * 50 - cy * 0.05, 0.55 + (i % 2) * 0.25, i % 2 === 1, 0.75);
  }
  // mountains
  const mt = ["mtn1", "mtn2", "mtn4", "mtn3"];
  for (let i = -1; i < Math.ceil((L.w * 0.15) / 360) + 5; i++) {
    const x = i * 360 - cx * 0.15;
    if (x < -500 || x > W + 100) continue;
    imgB(
      mt[(i + 8) % 4],
      x + 180,
      470 - cy * 0.1 + ((i * 37) % 3) * 14,
      1.05 + ((i * 13) % 3) * 0.12,
      i % 2 === 0,
    );
  }
  ctx.fillStyle = L.fog + "0.38)";
  ctx.fillRect(0, 0, W, H);
  // far trees & stones
  const far = ["trees", "tree2", "sym10", "tree4", "sym7", "tree3"];
  for (let i = -1; i < Math.ceil((L.w * 0.4) / 300) + 5; i++) {
    const x = i * 300 - cx * 0.4;
    if (x < -400 || x > W + 300) continue;
    const n = far[(i + 12) % far.length];
    imgB(n, x + 150, 560 - cy * 0.3, 0.7, i % 3 === 0);
  }
  ctx.fillStyle = L.fog + "0.32)";
  ctx.fillRect(0, 0, W, H);
}
function drawGround() {
  for (const g of L.ground) {
    const x0 = g[0],
      x1 = g[1],
      y = g[2];
    if (x1 < cam.x - 50 || x0 > cam.x + W + 50) continue;
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    ctx.fillStyle = earthPat;
    ctx.save();
    ctx.translate(0, 0);
    ctx.fillRect(x0, y + 60, x1 - x0, H + 400 - y);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y - 40, x1 - x0, 200);
    ctx.clip();
    const tw = 158;
    for (
      let x = Math.floor(Math.max(x0 - tw, cam.x - 200) / tw) * tw;
      x < Math.min(x1, cam.x + W + 200);
      x += tw
    ) {
      const i = (x / tw) | 0;
      img((i * 7) % 5 === 0 ? "tileB_f" : "tileA_f", x, y - 4, 1, i % 2 === 0);
    }
    for (
      let x = Math.floor(Math.max(x0, cam.x - 600) / 512) * 512;
      x < Math.min(x1, cam.x + W + 600);
      x += 512
    )
      ctx.drawImage(IMG.plat, 0, 34, 512, 44, x, y + 62, 512, 44);
    ctx.restore();
    // top outline & edge
    ctx.strokeStyle = "#3a2a1c";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x0, y - 3);
    ctx.lineTo(x1, y - 3);
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x0, y - 3);
    ctx.lineTo(x0, H + 400);
    ctx.moveTo(x1, y - 3);
    ctx.lineTo(x1, H + 400);
    ctx.stroke();
    const sh = ctx.createLinearGradient(0, y + 100, 0, H + 100);
    sh.addColorStop(0, "rgba(20,14,10,0)");
    sh.addColorStop(1, "rgba(20,14,10,0.6)");
    ctx.fillStyle = sh;
    ctx.fillRect(x0, y + 100, x1 - x0, H + 300 - y);
    imgB("rock3", x0 + 18, y + 22, 0.8);
    imgB("rock4", x1 - 16, y + 22, 0.8, true);
    ctx.restore();
  }
  // platforms
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  for (const p of L.plats) {
    const [x, y, w] = p;
    if (x + w < cam.x - 60 || x > cam.x + W + 60) continue;
    const s = 0.62,
      sw = 512 * s;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y - 20, w, 80);
    ctx.clip();
    for (let px = x; px < x + w; px += sw)
      ctx.drawImage(IMG.plat, ((px - x) * 7) % 200, 0, 512 - 200, 78, px, y - 8, (512 - 200) * s, 78 * s);
    ctx.restore();
    ctx.strokeStyle = "#3a2a1c";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 6, y - 7);
    ctx.lineTo(x + w - 6, y - 7);
    ctx.stroke();
    imgB("stone3", x + 6, y + 42, 0.62);
    imgB("stone4", x + w - 6, y + 42, 0.6, true);
  }
  ctx.restore();
}
function drawDecor(layer) {
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  for (const d of decor) {
    if (d.layer !== layer) continue;
    if (d.x < cam.x - 400 || d.x > cam.x + W + 400) continue;
    if (d.anim) frameB(d.anim, d.f, d.x, d.y, d.s, d.flip);
    else imgB(d.n, d.x, d.y, d.s, d.flip);
  }
  ctx.restore();
}

function teddyCycle() {
  if (!P || P.dead || P.hurt > 0 || P.atk >= 0 || P.block > 0.4) return null;
  if (!P.onGround) return P.jumps > 0 ? "jump" : "fall";
  if (P.showLand && P.land > 0) return "land";
  if (Math.abs(P.vx) > 40) return "walk";
  return null;
}
function drawTeddyCycle(which, x, y, face, alpha) {
  if (which === "walk") {
    drawAnchoredFrame(
      TEDDY_WALK.name,
      frameFromDurs(P.walkT, TEDDY_WALK.dur, true),
      x,
      y,
      TEDDY_WALK.scale,
      face,
      alpha,
      TEDDY_WALK.ax,
      TEDDY_WALK.ay,
    );
    return;
  }
  let f = 5;
  if (which === "jump") f = frameFromDurs(P.jumpT, TEDDY_JUMP.dur.slice(0, 6), false);
  else if (which === "land") f = 0.28 - P.land < 0.14 ? 6 : 7;
  drawAnchoredFrame(TEDDY_JUMP.name, f, x, y, TEDDY_JUMP.scale, face, alpha, TEDDY_JUMP.ax, TEDDY_JUMP.ay);
}
function drawTeddy(x, y, face, alpha = 1) {
  const cycle = teddyCycle();
  if (cycle) {
    drawTeddyCycle(cycle, x, y, face, alpha);
    return;
  }
  const k = 0.36,
    ox = 177,
    oy = 378;
  const t = P.t;
  let ll = 0,
    rl = 0,
    bob = 0,
    lean = 0,
    arm = 0,
    cape = 0,
    shx = 0,
    shy = 0,
    shr = 0,
    sqx = 1,
    sqy = 1,
    spin = 0;
  const moving = Math.abs(P.vx) > 30;
  if (P.onGround) {
    if (moving) {
      const s = Math.sin(P.run);
      ll = s * 0.5;
      rl = -s * 0.5;
      bob = -Math.abs(Math.cos(P.run)) * 12;
      lean = 0.09;
      cape = -0.3 + Math.sin(P.run * 2) * 0.14;
      arm = Math.sin(P.run) * 0.12;
    } else {
      bob = Math.sin(t * 3) * 3;
      cape = Math.sin(t * 2.4) * 0.06;
      arm = Math.sin(t * 3) * 0.04;
    }
    if (P.land > 0) {
      const q = P.land / 0.14;
      sqy = 1 - 0.12 * q;
      sqx = 1 + 0.1 * q;
    }
  } else {
    if (P.vy < 0) {
      ll = -0.45;
      rl = 0.3;
      cape = 0.2;
      sqy = 1.06;
      sqx = 0.95;
    } else {
      ll = 0.25;
      rl = -0.35;
      cape = -0.5;
      lean = -0.04;
    }
  }
  if (P.flip > 0) spin = (1 - P.flip / 0.42) * Math.PI * 2;
  if (P.atk >= 0) {
    const a = P.atk / 0.36;
    if (a < 0.2) arm = lerp(0, -0.9, a / 0.2);
    else if (a < 0.5) arm = lerp(-0.9, 2.2, ease((a - 0.2) / 0.3));
    else arm = lerp(2.2, 0, (a - 0.5) / 0.5);
    lean += a < 0.5 ? 0.1 : 0.05;
  }
  const b = P.block;
  shx = lerp(0, 150, b);
  shy = lerp(0, -8, b);
  shr = lerp(0, 0.08, b);
  arm = lerp(arm, -0.6, b);
  lean = lerp(lean, -0.05, b);
  if (P.hurt > 0) lean = -0.25;
  if (P.dead) {
    lean = -0.4 - Math.min(P.deadT, 1) * 1.1;
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(face * k * sqx, k * sqy);
  ctx.translate(-ox, -oy);
  if (spin) {
    ctx.translate(ox, 200);
    ctx.rotate(spin);
    ctx.translate(-ox, -200);
  }
  if (P.dead) {
    ctx.translate(ox, oy);
    ctx.rotate(lean * 0.5);
    ctx.translate(-ox, -oy);
  }
  const piece = (n, r = 0, dx = 0, dy = 0) => {
    const q = RIG[n];
    ctx.save();
    ctx.translate(q.px + dx, q.py + dy);
    if (r) ctx.rotate(r);
    ctx.drawImage(IMG["t_" + n], q.x - q.px, q.y - q.py, q.w, q.h);
    ctx.restore();
  };
  piece("lleg", ll);
  piece("rleg", rl);
  ctx.translate(0, bob);
  ctx.translate(170, 300);
  ctx.rotate(lean * 0.6);
  ctx.translate(-170, -300);
  piece("cape", cape);
  piece("body");
  piece("arm", arm);
  piece("shield", shr, shx, shy);
  ctx.restore();
  // slash arc
  if (P.atk > 0.06 && P.atk < 0.26) {
    const a = (P.atk - 0.06) / 0.2;
    ctx.save();
    ctx.translate(x + face * 24, y - 78);
    ctx.scale(face, 1);
    ctx.globalAlpha = (1 - a) * 0.85;
    ctx.strokeStyle = "#fff6dc";
    ctx.lineWidth = 14 * (1 - a) + 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, 0, 92, -1.5 + a * 0.5, -1.5 + a * 0.5 + 2.3 * ease(Math.min(1, a * 1.6)));
    ctx.stroke();
    ctx.strokeStyle = "#e0b070";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 78, -1.2 + a * 0.5, -1.2 + a * 0.5 + 2 * ease(Math.min(1, a * 1.6)));
    ctx.stroke();
    ctx.restore();
  }
}
function drawFoe(f) {
  const x = f.x - cam.x,
    y = f.y - cam.y;
  const s = f.s;
  const iw = META[f.img][0] * s,
    ih = META[f.img][1] * s;
  let bob = 0,
    sq = 1;
  if (f.t === "hop") {
    if (!f.onGround) {
      sq = f.vy < 0 ? 1.12 : 0.95;
    } else {
      sq = 1 + Math.sin(f.ph * 6) * 0.03;
      if (f.cool < 0.3) sq = 0.85;
    }
  } else bob = Math.abs(Math.sin(f.ph * 9)) * -3;
  const by = y - f.leg + (META[f.img][1] - f.bb) * s + bob;
  // legs
  ctx.lineCap = "round";
  const n = f.t === "big" ? 4 : 4;
  const moving = Math.abs(f.vx) > 10;
  for (let i = 0; i < n; i++) {
    const bx = x + (i - (n - 1) / 2) * f.w * 0.3,
      by0 = y - f.leg - 4 + bob;
    const sw = moving && f.onGround ? Math.sin(f.ph * 14 + i * Math.PI) * 9 : 0;
    const fx = bx + sw + (i - (n - 1) / 2) * 6,
      fy = f.onGround ? y : y - 4 + (f.vy < 0 ? -6 : 4);
    const kx = (bx + fx) / 2 + (i < n / 2 ? -7 : 7),
      ky = (by0 + fy) / 2 - 3;
    ctx.strokeStyle = "#2a1d14";
    ctx.lineWidth = f.t === "big" ? 9 : 7;
    ctx.beginPath();
    ctx.moveTo(bx, by0);
    ctx.quadraticCurveTo(kx, ky, fx, fy);
    ctx.stroke();
    ctx.strokeStyle = "#8a6a48";
    ctx.lineWidth = f.t === "big" ? 4 : 3;
    ctx.beginPath();
    ctx.moveTo(bx, by0);
    ctx.quadraticCurveTo(kx, ky, fx, fy);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(x, by);
  ctx.scale(f.face > 0 ? -1 : 1, sq);
  if (f.spit > 0) ctx.scale(1 + f.spit * 0.3, 1 - f.spit * 0.2);
  if (f.hurt > 0) ctx.filter = "brightness(2.2) saturate(0.4)";
  ctx.drawImage(IMG[f.img], -iw / 2, -ih, iw, ih);
  ctx.restore();
  if (f.t === "big" && f.hp < f.maxhp) {
    ctx.fillStyle = "rgba(30,20,14,0.7)";
    ctx.fillRect(x - 40, y - f.h - 50, 80, 8);
    ctx.fillStyle = "#e0503c";
    ctx.fillRect(x - 39, y - f.h - 49, (78 * f.hp) / f.maxhp, 6);
  }
}
function drawShot(s) {
  ctx.save();
  ctx.translate(s.x - cam.x, s.y - cam.y);
  ctx.rotate(s.rot);
  ctx.fillStyle = s.friendly ? "#f0d9a0" : "#c9a878";
  ctx.strokeStyle = "#2a1d14";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(22, 0);
  ctx.lineTo(-14, -7);
  ctx.lineTo(-10, 0);
  ctx.lineTo(-14, 7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
function drawItem(it) {
  if (it.got) return;
  const x = it.x - cam.x,
    y = it.y - cam.y + Math.sin(it.ph * 3) * 5;
  if (it.t === "crystal") {
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.2 * Math.sin(it.ph * 5);
    const g = ctx.createRadialGradient(x, y, 2, x, y, 26);
    g.addColorStop(0, "#bff0ff");
    g.addColorStop(1, "rgba(120,200,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 30, y - 30, 60, 60);
    ctx.restore();
    const sx = Math.abs(Math.cos(it.ph * 2.2));
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(0.35 + 0.65 * sx, 1);
    img("ui_crystal", -12, -27, 0.49);
    ctx.restore();
  } else if (it.t === "bigcrystal") {
    frameB("bubbles", it.ph * 18, x, y - 40, 0.6, false, 0.9);
    imgB("crystalg", x, y + 2 - Math.sin(it.ph * 3) * 5, 1.3);
  } else if (it.t === "bone") {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(it.ph * 2) * 0.3);
    img("ui_bone", -31, -10, 1);
    ctx.restore();
  } else if (it.t === "rune") {
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(it.ph * 4);
    const g = ctx.createRadialGradient(x, y, 4, x, y, 50);
    g.addColorStop(0, "#fff0b0");
    g.addColorStop(1, "rgba(255,220,120,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 55, y - 55, 110, 110);
    ctx.restore();
    img("rune" + it.id, x - 29, y - 29, 1);
  }
}
function drawDog() {
  const x = dog.x - cam.x,
    y = dog.y - cam.y + 6;
  frameB(dog.anim, dog.f, x, y, 0.95, dog.face < 0);
  if (dog.bark > 0)
    text(
      "Woof!",
      x + dog.face * 40,
      y - 120 - (1 - dog.bark) * 20,
      22,
      "#fff",
      undefined,
      FONT,
      "#2a1c12",
      5,
    );
}
function drawCave() {
  const x = cave.x - cam.x,
    y = cave.y - cam.y + 22;
  const m = META.cave;
  let f = 0;
  if (cave.open > 0) {
    f = cave.open < 1 ? Math.floor(cave.open * 9) : 9 + (Math.floor(performance.now() / 90) % 6);
  }
  frameB("cave", f, x, y, 1.25);
  if (cave.open > 0.5) {
    frameB("bubbles", performance.now() / 50, x - 30, y - 40, 0.8, false, 0.8);
    frameB("bubbles", performance.now() / 50 + 15, x + 30, y - 60, 0.7, true, 0.8);
  }
}
function drawSigns() {
  for (const s of signs) {
    const x = s.x - cam.x,
      y = surfaceY(s.x) - cam.y;
    if (x < -300 || x > W + 300) continue;
    ctx.fillStyle = "#3a2a1c";
    ctx.fillRect(x - 5, y - 62, 10, 64);
    ctx.fillStyle = "#6e5238";
    ctx.fillRect(x - 3, y - 62, 6, 62);
    img("ui_sing_1", x - 125, y - 140, 0.65);
    text(s.title, x, y - 118, 17, "#ffe7a8");
    const t = usingTouch ? touchText(s) : s.txt;
    text(t, x, y - 94, 12.5, "#f6ecd8", undefined, FONT, "#2a1c12", 3.5);
  }
}
function touchText(s) {
  return (
    {
      MOVE: "Hold the arrow buttons",
      JUMP: "Blue paw - tap twice to double jump!",
      ATTACK: "Red paw - swing your sword",
      BLOCK: "Hold the white paw to block",
    }[s.title] || s.txt
  );
}
function drawParts() {
  for (const p of parts) {
    const x = p.x - cam.x,
      y = p.y - cam.y,
      a = clamp(p.life / p.max, 0, 1);
    ctx.globalAlpha = a;
    if (p.type === "text") {
      text(p.txt, x, y, 22, p.col);
    } else if (p.type === "puff") {
      const s = p.s * (1 + (1 - a) * 1.2);
      img("cloud", x - (META.cloud[0] * s) / 2, y - META.cloud[1] * s * 0.7, s, false, a * 0.9);
    } else if (p.type === "twig") {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(p.rot);
      ctx.strokeStyle = "#2a1d14";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-p.s * 1.4, 0);
      ctx.lineTo(p.s * 1.4, 0);
      ctx.stroke();
      ctx.strokeStyle = "#8a6a48";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    } else if (p.type === "fluff") {
      ctx.fillStyle = p.col;
      ctx.beginPath();
      ctx.arc(x, y, p.s, 0, 7);
      ctx.fill();
    } else {
      ctx.fillStyle = p.col;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(p.rot);
      ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}
function drawButterflies() {
  for (const b of butterflies) {
    const x = b.x + Math.sin(b.ph * 0.5) * 220 - cam.x * 1,
      y = b.y + Math.sin(b.ph * 1.3) * 50 - cam.y;
    if (x < -100 || x > W + 100) continue;
    frame("butterfly", b.ph * 14, x, y, 0.8, Math.cos(b.ph * 0.5) < 0);
  }
}

function drawWorld(t) {
  drawSky(t);
  drawParallax(cam.x, cam.y, t);
  drawDecor("back");
  drawGround();
  drawDecor("patch");
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  ctx.restore();
  drawSigns();
  drawCave();
  drawDog();
  items.forEach(drawItem);
  foes.forEach((f) => {
    if (!f.dead && f.x > cam.x - 200 && f.x < cam.x + W + 200) drawFoe(f);
  });
  if (P && state !== "title") {
    if (P.exit) {
      const a = clamp(1 - P.exit / 1.4, 0, 1);
      const s = 0.36 * (1 - P.exit * 0.25);
      imgB("t_back", P.x - cam.x, P.y - cam.y + P.exit * -8, (s / 0.36) * 0.42, false, a);
    } else {
      const blink = P.inv > 0 && Math.floor(P.inv * 14) % 2 === 0;
      drawTeddy(P.x - cam.x, P.y - cam.y, P.face, blink ? 0.35 : 1);
    }
  }
  shots.forEach(drawShot);
  drawDecor("front");
  drawButterflies();
  drawParts();
  // vignette
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(20,14,10,0.45)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

function drawHUD() {
  // portrait
  ctx.save();
  ctx.beginPath();
  ctx.arc(62, 58, 40, 0, 7);
  ctx.fillStyle = "#6d6558";
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#3a332a";
  ctx.stroke();
  ctx.clip();
  img("teddy_head", 20, 20, 0.85);
  ctx.restore();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#9c9380";
  ctx.beginPath();
  ctx.arc(62, 58, 43, 0, 7);
  ctx.stroke();
  const bx = 100,
    by = 34;
  img("ui_health_bar_back", bx + 26, by + 12, 0.97);
  const rw = 292 * clamp(P.hpShow / 5, 0, 1),
    gw = 292 * clamp(P.hp / 5, 0, 1);
  ctx.drawImage(IMG.ui_health_red, 0, 0, (300 * rw) / 292, 44, bx + 29, by + 15, rw, 24);
  ctx.drawImage(IMG.ui_health_green, 0, 0, (300 * gw) / 292, 44, bx + 29, by + 15, gw, 24);
  img("ui_health_bar", bx, by, 1);
  text(`${P.hp} / 5`, bx + 176, by + 27, 16, "#fff", undefined, FONT, "#1d140c", 4);
  // counters
  img("ui_crystal", 112, 94, 0.36);
  text("× " + (totals.crystals + levelStats.crystals), 140, 112, 22, "#dff6ff", "left");
  img("ui_bone", 215, 103, 0.9);
  text("× " + levelStats.bones, 275, 112, 22, "#fff1d0", "left");
  // runes
  for (let i = 0; i < 3; i++) {
    const x = W / 2 - 80 + i * 80,
      y = 46;
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "#2a241c";
    ctx.beginPath();
    ctx.arc(x, y, 30, 0, 7);
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#8f8672";
    ctx.beginPath();
    ctx.arc(x, y, 30, 0, 7);
    ctx.stroke();
    const got = i < cave.runes;
    ctx.save();
    if (!got) {
      ctx.globalAlpha = 0.25;
      ctx.filter = "grayscale(1) brightness(0.6)";
    }
    img("rune" + [3, 7, 12, 5, 9, 14, 2, 11, 16][levelIdx * 3 + i], x - 24, y - 24, 0.83);
    ctx.restore();
  }
  // bag / pause button
  img("ui_invetory_bag", W - 100, 18, 0.64);
  if (showTouch())
    for (const b of TB) {
      const pr = touchState[b.id];
      let n = b.img;
      if (b.id === "left" || b.id === "right") n = b.img + (pr ? "_2" : "_1");
      const s = ((b.r * 2) / 128) * (pr ? 0.92 : 1);
      ctx.globalAlpha = pr ? 1 : 0.82;
      img(n, b.x - 64 * s, b.y - 64 * s, s);
      ctx.globalAlpha = 1;
      if (b.label) text(b.label, b.x, b.y + b.r + 2, 12, "#fff", undefined, FONT, "#1d140c", 4);
    }
  if (msg && banner <= 0) {
    const a = clamp(msg.t, 0, 1);
    ctx.globalAlpha = a;
    img("ui_sing_1", W / 2 - 232, 118, 1.2);
    text(msg.txt, W / 2, 197, 22, "#ffe9b0");
    ctx.globalAlpha = 1;
  }
  if (banner > 0) {
    const a = clamp(banner, 0, 1) * clamp((3.2 - banner) * 3, 0, 1);
    ctx.globalAlpha = a;
    img("ui_sing_1", W / 2 - 290, 200, 1.5);
    text("Level " + (levelIdx + 1), W / 2, 262, 24, "#ffe7a8");
    text(L.name, W / 2, 302, 40, "#fff4dc", undefined, DFONT);
    ctx.globalAlpha = 1;
  }
}

// ---------- menus ----------
let buttons = [];
function button(x, y, w, h, label, act, style = "plank") {
  buttons.push({ x, y, w, h, label, act, style });
}
function drawButtons() {
  buttons.forEach((b, i) => {
    const hov = i === menuSel;
    if (b.style === "plank") {
      ctx.save();
      if (hov) {
        ctx.shadowColor = "rgba(255,220,140,0.9)";
        ctx.shadowBlur = 24;
      }
      ctx.drawImage(IMG.ui_sing_1, b.x, b.y, b.w, b.h);
      ctx.restore();
      text(b.label, b.x + b.w / 2, b.y + b.h / 2 + 2, Math.min(28, b.h * 0.34), hov ? "#ffe39a" : "#f2e6cc");
    }
    if (hov) {
      img("ui_paw_2", b.x - (b.style === "plank" ? 52 : 46), b.y + b.h / 2 - 22, 0.34);
    }
  });
}
function menuInput() {
  const n = buttons.length;
  if (!n) return;
  if (hit("down")) {
    menuSel = (menuSel + 1) % n;
    sfx("move");
  }
  if (hit("up")) {
    menuSel = (menuSel + n - 1) % n;
    sfx("move");
  }
  for (let i = 0; i < n; i++) {
    const b = buttons[i];
    if (mouse.x > b.x && mouse.x < b.x + b.w && mouse.y > b.y && mouse.y < b.y + b.h) {
      if (mouse.moved && menuSel !== i) {
        menuSel = i;
      }
      if (mouse.click) {
        menuSel = i;
        sfx("select");
        b.act();
        mouse.click = false;
        return;
      }
    }
  }
  if (hit("confirm")) {
    sfx("select");
    buttons[menuSel].act();
  }
}
cv.addEventListener("pointermove", () => {
  mouse.moved = true;
});

function startGame(level, crystals = 0) {
  initAudio();
  totals = { crystals, foes: 0 };
  fadeOut(() => {
    loadLevel(level);
    state = "play";
  });
}
function fadeOut(cb) {
  fade = 0.0001;
  fadeTo = cb;
}
function saveProgress() {
  store.set("teddy_save", { level: levelIdx, crystals: totals.crystals });
}

let titleNote = null;
function drawTitle(t) {
  // scrolling world bg
  titleCam += (1 / 60) * 40;
  cam.x = titleCam % (L.w - W);
  cam.y = 0;
  drawSky(t);
  drawParallax(cam.x, 0, t);
  drawDecor("back");
  drawGround();
  drawDecor("patch");
  drawDecor("front");
  drawButterflies();
  ctx.fillStyle = "rgba(20,16,12,0.35)";
  ctx.fillRect(0, 0, W, H);
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(10,8,6,0.7)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  // title
  img("ui_sing_1", 40, 18, 1.62);
  text("Teddy's", 353, 78, 40, "#ffe7a8", undefined, DFONT, "#2a1c12", 8);
  text("Adventure", 353, 130, 52, "#fff4dc", undefined, DFONT, "#2a1c12", 9);
  // hero
  ctx.save();
  ctx.translate(330, 712);
  ctx.rotate(Math.sin(t * 1.5) * 0.02);
  const s = 0.95 + Math.sin(t * 2) * 0.01;
  imgB("teddy_full", 0, 0, s * 0.97);
  ctx.restore();
  frameB("dog_idle", t * 24, 600, 700, 1.25, false);
}
function titleButtons() {
  buttons = [];
  const bx = 830,
    by = 150,
    s = 1;
  // start.png has the 4 labels baked in
  const rows = [166, 248, 328, 410];
  const acts = [
    () => {
      startGame(0);
    },
    () => {
      const sv = store.get("teddy_save");
      if (sv) {
        startGame(sv.level, sv.crystals || 0);
      } else {
        titleNote = { t: 2, txt: "No saved game yet - start a New Game!" };
      }
    },
    () => {
      prevState = "title";
      state = "options";
      menuSel = 0;
    },
    () => {
      state = "quit";
      stateT = 0;
    },
  ];
  rows.forEach((r, i) =>
    buttons.push({ x: bx + 62, y: by + r - 32, w: 262, h: 64, act: acts[i], style: "baked" }),
  );
}
function drawTitleMenu() {
  img("ui_start", 830, 150, 1);
  buttons.forEach((b, i) => {
    if (i === menuSel) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,226,150,0.95)";
      ctx.shadowColor = "rgba(255,210,120,1)";
      ctx.shadowBlur = 18;
      ctx.lineWidth = 3;
      ctx.strokeRect(b.x + 8, b.y + 6, b.w - 16, b.h - 12);
      ctx.restore();
      img("ui_paw_2", b.x - 40, b.y + b.h / 2 - 22, 0.34);
    }
  });
  const sv = store.get("teddy_save");
  text(sv ? `Saved: Level ${sv.level + 1}` : "", 1016, 684, 16, "#e8dcc0");
  text("Arrows + Enter, click or tap", 1016, H - 12, 14, "#cfc3a8", undefined, FONT, "#1d140c", 4);
  if (titleNote) {
    ctx.globalAlpha = clamp(titleNote.t, 0, 1);
    img("ui_sing_1", W / 2 - 240, 300, 1.25);
    text(titleNote.txt, W / 2, 382, 20, "#ffe9b0");
    ctx.globalAlpha = 1;
  }
}

function optionsButtons() {
  buttons = [];
  const x = 790,
    w = 420,
    h = 100;
  button(x, 120, w, h, "Sound: " + (settings.sound ? "On" : "Off"), () => {
    settings.sound = !settings.sound;
    applyAudio();
    store.set("teddy_settings", settings);
  });
  button(x, 235, w, h, "Music: " + (settings.music ? "On" : "Off"), () => {
    settings.music = !settings.music;
    applyAudio();
    store.set("teddy_settings", settings);
  });
  button(x, 350, w, h, "Touch buttons: " + { auto: "Auto", on: "On", off: "Off" }[settings.touch], () => {
    settings.touch = { auto: "on", on: "off", off: "auto" }[settings.touch];
    store.set("teddy_settings", settings);
  });
  button(x, 465, w, h, "Back", () => {
    state = prevState;
    menuSel = prevState === "pause" ? 2 : 2;
  });
}
function drawControls(x, y) {
  ctx.fillStyle = "rgba(30,24,18,0.78)";
  ctx.strokeStyle = "#8f8672";
  ctx.lineWidth = 4;
  roundRect(x, y, 520, 400, 18);
  ctx.fill();
  ctx.stroke();
  text("Controls", x + 260, y + 40, 30, "#ffe7a8");
  const rows = [
    ["Move", "← → or A / D"],
    ["Jump", "Space / W / ↑  (again in air = double jump)"],
    ["Attack", "J or X"],
    ["Block", "Hold K, C or Shift"],
    ["Pause", "Esc / P or the bag"],
    ["Touch", "Arrows + blue / red / white paws"],
  ];
  rows.forEach((r, i) => {
    text(r[0], x + 30, y + 100 + i * 50, 20, "#ffd98a", "left");
    text(r[1], x + 140, y + 100 + i * 50, 16, "#f2e6cc", "left", FONT, "#1d140c", 3);
  });
}
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function pauseButtons() {
  buttons = [];
  const x = 720,
    w = 420,
    h = 100;
  button(x, 170, w, h, "Resume", () => {
    state = "play";
  });
  button(x, 285, w, h, "Restart Level", () => {
    fadeOut(() => {
      loadLevel(levelIdx);
      state = "play";
    });
  });
  button(x, 400, w, h, "Options", () => {
    prevState = "pause";
    state = "options";
    menuSel = 0;
  });
  button(x, 515, w, h, "Main Menu", () => {
    saveProgress();
    fadeOut(() => {
      toTitle();
    });
  });
}
function drawInventory(x, y) {
  img("ui_board", x, y, 1);
  text("Satchel", x + 207, y + 103, 26, "#ffe7a8");
  const cells = [
    [118, 192],
    [200, 192],
    [283, 192],
    [118, 280],
    [200, 280],
    [283, 280],
    [118, 370],
    [200, 370],
    [283, 370],
  ];
  const content = [
    ["crystal", totals.crystals + levelStats.crystals],
    ["bone", levelStats.bones],
    ["foe", levelStats.foes],
  ];
  for (let i = 0; i < 3; i++) {
    content.push(["rune", i < cave.runes ? [3, 7, 12, 5, 9, 14, 2, 11, 16][levelIdx * 3 + i] : 0]);
  }
  content.push(["sword", 1], ["shield", 1], ["heart", P.hp]);
  content.forEach(([k, v], i) => {
    const [cx, cy] = cells[i];
    const X = x + cx,
      Y = y + cy;
    if (k === "crystal") {
      img("ui_crystal", X - 12, Y - 30, 0.5);
      text("" + v, X + 26, Y + 26, 18, "#dff6ff");
    }
    if (k === "bone") {
      img("ui_bone", X - 28, Y - 10, 0.9);
      text("" + v, X + 26, Y + 26, 18, "#fff");
    }
    if (k === "foe") {
      ctx.drawImage(IMG.thorn_walk, X - 32, Y - 32, 64, 55);
      text("" + v, X + 26, Y + 26, 18, "#fff");
    }
    if (k === "rune") {
      if (v) img("rune" + v, X - 26, Y - 26, 0.9);
      else text("?", X, Y, 30, "rgba(255,255,255,0.3)", undefined, FONT, "", 0);
    }
    if (k === "sword") {
      ctx.save();
      ctx.translate(X, Y);
      ctx.rotate(0.5);
      ctx.drawImage(IMG.t_arm, 60, 0, 83, 120, -20, -38, 42, 62);
      ctx.restore();
    }
    if (k === "shield") img("t_shield", X - 30, Y - 36, 0.42);
    if (k === "heart") {
      text("♥", X, Y - 4, 40, "#e0503c", undefined, "serif", "#2a1c12", 4);
      text(v + "/5", X + 22, Y + 26, 16, "#fff");
    }
  });
}

function toTitle() {
  loadLevel(0);
  state = "title";
  menuSel = 0;
  P = newPlayer(120);
}

function drawOverlay(a = 0.55) {
  ctx.fillStyle = `rgba(16,12,9,${a})`;
  ctx.fillRect(0, 0, W, H);
}

// ---------- main loop ----------
let last = performance.now(),
  T = 0;
function loop(now) {
  requestAnimationFrame(loop);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  T += dt;
  ctx.setTransform(VS * DPR, 0, 0, VS * DPR, 0, 0);
  ctx.imageSmoothingQuality = "high";
  if (state === "loading") {
    drawLoading();
    if (loaded >= names.length && (!document.fonts || fontsReady)) {
      makeEarth();
      toTitle();
    }
    clearInput();
    return;
  }
  musicTick();
  if (titleNote) {
    titleNote.t -= dt;
    if (titleNote.t <= 0) titleNote = null;
  }
  if (state === "title") {
    titleButtons();
    menuInput();
    drawTitle(T);
    drawTitleMenu();
  } else if (state === "options") {
    optionsButtons();
    menuInput();
    if (hit("back") && state === "options") {
      state = prevState;
    }
    if (prevState === "title") {
      drawTitle(T);
      drawOverlay(0.45);
    } else {
      drawWorld(T);
      drawOverlay(0.6);
    }
    drawControls(150, 140);
    optionsButtons();
    drawButtons();
  } else if (state === "play") {
    if (hit("pause") || (mouse.click && mouse.x > W - 110 && mouse.y < 100)) {
      state = "pause";
      menuSel = 0;
      mouse.click = false;
      sfx("select");
    } else {
      const steps = Math.ceil(dt / (1 / 120));
      const sdt = dt / steps;
      for (let i = 0; i < steps; i++) {
        updatePlayer(sdt);
        updateFoes(sdt);
      }
      updateWorld(dt);
      if (banner > 0) banner -= dt;
      cam.x = lerp(cam.x, clamp(P.x - W * 0.42 + P.face * 80, 0, L.w - W + 200), Math.min(1, dt * 5));
      cam.y = lerp(cam.y, clamp(P.y - 470, -260, 0), Math.min(1, dt * 3));
    }
    const sx = shake ? rnd(-shake, shake) : 0,
      sy = shake ? rnd(-shake, shake) : 0;
    shake = Math.max(0, shake - dt * 40);
    ctx.save();
    ctx.translate(sx, sy);
    drawWorld(T);
    ctx.restore();
    if (flash > 0) {
      ctx.fillStyle = `rgba(200,40,30,${flash})`;
      ctx.fillRect(0, 0, W, H);
      flash -= dt;
    }
    drawHUD();
  } else if (state === "pause") {
    pauseButtons();
    menuInput();
    if (hit("pause") && state === "pause") state = "play";
    drawWorld(T);
    drawOverlay();
    drawInventory(170, 120);
    img("ui_invetory_button", 720, 40, 1.09);
    drawButtons();
    img("ui_stop", W - 100, 18, 0.64);
    if (mouse.click && mouse.x > W - 110 && mouse.y < 100) {
      state = "play";
    }
  } else if (state === "gameover") {
    buttons = [];
    const x = W / 2 - 210;
    button(x, 330, 420, 100, "Try Again", () => {
      fadeOut(() => {
        const cp = checkpoint.x;
        P = newPlayer(cp);
        P.inv = 1.5;
        state = "play";
      });
    });
    button(x, 445, 420, 100, "Main Menu", () => {
      fadeOut(toTitle);
    });
    menuInput();
    drawWorld(T);
    drawOverlay(0.6);
    img("ui_sing_1", W / 2 - 290, 120, 1.5);
    text("Teddy needs a rest...", W / 2, 218, 38, "#ffd9b0", undefined, DFONT);
    drawButtons();
  } else if (state === "clear") {
    buttons = [];
    const last_ = levelIdx === LEVELS.length - 1;
    button(W / 2 + 40, 520, 420, 100, last_ ? "The End" : "Next Level", () => {
      if (last_) {
        fadeOut(() => {
          state = "victory";
          stateT = 0;
        });
      } else {
        const n = levelIdx + 1;
        fadeOut(() => {
          loadLevel(n, true);
          P.hp = 5;
          state = "play";
          saveProgress();
        });
      }
    });
    menuInput();
    stateT += dt;
    drawWorld(T);
    drawOverlay(0.62);
    img("ui_invetory", 90, 60, 0.95);
    img("ui_sing_1", W / 2 - 60, 70, 1.35);
    text("Level Complete!", W / 2 + 200, 158, 36, "#ffe7a8", undefined, DFONT);
    const rows = [
      ["Crystals", levelStats.crystals],
      ["Thornlings defeated", levelStats.foes],
      ["Time", fmtTime(levelStats.time)],
    ];
    rows.forEach((r, i) => {
      const a = clamp(stateT * 2 - i * 0.5, 0, 1);
      ctx.globalAlpha = a;
      text(r[0], W / 2 + 30, 290 + i * 62, 24, "#f2e6cc", "left");
      text("" + r[1], W / 2 + 470, 290 + i * 62, 28, "#ffe39a", "right");
      ctx.globalAlpha = 1;
    });
    frameB("dog_bone", T * 24, 610, 700, 1.2);
    drawButtons();
  } else if (state === "victory") {
    buttons = [];
    button(W / 2 - 210, 560, 420, 100, "Main Menu", () => {
      store.set("teddy_save", null);
      fadeOut(toTitle);
    });
    menuInput();
    stateT += dt;
    drawTitleBg();
    img("ui_sing_1", W / 2 - 290, 16, 1.5);
    text("Victory!", W / 2, 80, 50, "#ffe7a8", undefined, DFONT, "#2a1c12", 9);
    text("Teddy cleared every thorny path", W / 2, 128, 19, "#f6ecd8");
    text(`Total crystals: ${totals.crystals}`, W / 2, 166, 20, "#dff6ff");
    ctx.save();
    ctx.translate(W / 2 - 120, 548);
    ctx.rotate(Math.sin(T * 6) * 0.04);
    imgB("teddy_full", 0, Math.abs(Math.sin(T * 6)) * -20, 0.6);
    ctx.restore();
    frameB("dog_walk", T * 24, W / 2 + 170, 548, 1.4, true);
    if (Math.random() < 0.2)
      parts.push({
        x: rnd(0, W) + cam.x,
        y: -10 + cam.y,
        vx: rnd(-40, 40),
        vy: rnd(60, 160),
        life: 4,
        max: 4,
        type: "spark",
        col: ["#ffe28a", "#8fd8ff", "#e0503c", "#a8f0a0"][Math.floor(rnd(0, 4))],
        rot: 0,
        vr: rnd(-5, 5),
        s: rnd(5, 10),
      });
    parts.forEach((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    });
    parts = parts.filter((p) => p.life > 0);
    drawParts();
    drawButtons();
  } else if (state === "quit") {
    stateT += dt;
    drawTitleBg();
    const x = W / 2 + Math.min(stateT, 4) * 40 - 40,
      y = 640;
    const bob = Math.abs(Math.sin(stateT * 6)) * -6;
    imgB("t_back", x, y + bob, 0.5 * (1 - Math.min(stateT, 6) * 0.06));
    frameB("dog_walk", stateT * 24, x + 130, y + 4, 0.9 * (1 - Math.min(stateT, 6) * 0.06), true);
    img("ui_sing_1", W / 2 - 290, 90, 1.5);
    text("Thanks for playing!", W / 2, 188, 38, "#ffe7a8", undefined, DFONT);
    text("Teddy and the pup are off to rest.", W / 2, 300, 22, "#f6ecd8");
    if (stateT > 1.2) text("Press any key or tap to return", W / 2, 350, 18, "#e8dcc0");
    if (stateT > 1.2 && (Object.keys(pressed).length || mouse.click)) {
      toTitle();
    }
  }
  // level clear transition
  if (state === "play" && fadeTo === "clear") {
    fadeTo = null;
    totals.crystals += levelStats.crystals;
    totals.foes += levelStats.foes;
    levelStats.crystals_ = levelStats.crystals;
    state = "clear";
    stateT = 0;
    menuSel = 0;
    if (levelIdx < LEVELS.length - 1)
      store.set("teddy_save", { level: levelIdx + 1, crystals: totals.crystals });
  }
  // fade
  if (fade > 0) {
    if (typeof fadeTo === "function") {
      fade += dt * 3;
      if (fade >= 1) {
        const cb = fadeTo;
        fadeTo = null;
        cb();
        fade = 1;
      }
    } else {
      fade -= dt * 2.5;
      if (fade < 0) fade = 0;
    }
    ctx.fillStyle = `rgba(12,9,7,${clamp(fade, 0, 1)})`;
    ctx.fillRect(0, 0, W, H);
  }
  mouse.moved = false;
  clearInput();
}
function fmtTime(s) {
  const m = Math.floor(s / 60),
    ss = Math.floor(s % 60);
  return m + ":" + (ss < 10 ? "0" : "") + ss;
}
function drawTitleBg() {
  cam.x = (T * 30) % (L.w - W);
  cam.y = 0;
  drawSky(T);
  drawParallax(cam.x, 0, T);
  drawDecor("back");
  drawGround();
  drawDecor("patch");
  drawOverlay(0.3);
}
function clearInput() {
  for (const k in pressed) delete pressed[k];
  for (const k in touchPressed) delete touchPressed[k];
  mouse.click = false;
}
let fontsReady = false;
if (document.fonts) {
  Promise.race([
    Promise.all([
      document.fonts.load("900 20px Cinzel"),
      document.fonts.load('900 20px "Cinzel Decorative"'),
    ]),
    new Promise((r) => setTimeout(r, 2500)),
  ]).then(() => (fontsReady = true));
} else fontsReady = true;
function drawLoading() {
  ctx.fillStyle = "#141a20";
  ctx.fillRect(0, 0, W, H);
  const p = loaded / names.length;
  ctx.fillStyle = "#3a332a";
  ctx.fillRect(W / 2 - 200, H / 2, 400, 16);
  ctx.fillStyle = "#e0b070";
  ctx.fillRect(W / 2 - 200, H / 2, 400 * p, 16);
  ctx.fillStyle = "#f2e6cc";
  ctx.font = "700 22px Georgia";
  ctx.textAlign = "center";
  ctx.fillText("Stitching Teddy together...", W / 2, H / 2 - 30);
}
window.__game = {
  get state() {
    return state;
  },
  get P() {
    return P;
  },
  get foes() {
    return foes;
  },
  get cave() {
    return cave;
  },
  get L() {
    return L;
  },
  loadLevel,
  set state(v) {
    state = v;
  },
  get cam() {
    return cam;
  },
  get cycle() {
    return P ? teddyCycle() : null;
  },
  get walkFrame() {
    return P ? frameFromDurs(P.walkT, TEDDY_WALK.dur, true) : 0;
  },
  get jumpFrame() {
    if (!P) return 0;
    const c = teddyCycle();
    if (c === "jump") return frameFromDurs(P.jumpT, TEDDY_JUMP.dur.slice(0, 6), false);
    if (c === "land") return 0.28 - P.land < 0.14 ? 6 : 7;
    if (c === "fall") return 5;
    return -1;
  },
};
requestAnimationFrame(loop);
