// sky.js - the full-page weather scene.
//
// A canvas behind the whole page draws sun, clouds, rain, snow and wind in simple 3D:
// every drop, flake and cloud has a depth (z), is drawn with perspective, and moves with
// the mouse at a different speed depending on how far away it is (parallax).
// It also switches the colour theme of the page: <html data-weather="rainy"> etc.
//
//   Sky.set("rainy")            change the weather
//   Sky.set("rainy", {save:true})   ... and remember it on the other pages
//   Sky.get()                   current weather name
//   Sky.mood("rainy")           a short mood line for the weather
//   Sky.icon("rainy")           SVG icon markup
//
// Elements with data-wx-icon="rainy" get that icon automatically.

(function () {
  "use strict";

  const NAMES = ["sunny", "cloudy", "rainy", "snowy", "windy"];
  const STORE_KEY = "weatherfit-weather";
  const PLAN_STORE_KEY = "weatherfit-plan-weather";
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const MOODS = {
    sunny:  "Bright, warm and clear",
    cloudy: "Soft light and no shadows",
    rainy:  "Steady rain on the ground",
    snowy:  "Quiet, slow flakes",
    windy:  "Gusts and flying leaves"
  };

  // ---------- Icons (inline SVG, drawn with currentColor) ----------
  const CLOUD_PATH = "M15 28h19a7 7 0 0 0 .9-13.9A10 10 0 0 0 15.6 12 8 8 0 0 0 15 28z";
  const ICONS = {
    sunny:  `<circle cx="24" cy="24" r="8"/><path d="M24 6v6M24 36v6M6 24h6M36 24h6M11.3 11.3l4.2 4.2M32.5 32.5l4.2 4.2M11.3 36.7l4.2-4.2M32.5 15.5l4.2-4.2"/>`,
    cloudy: `<path d="M14 36h20a7.5 7.5 0 0 0 1-14.9A10.5 10.5 0 0 0 14.6 19 8.8 8.8 0 0 0 14 36z"/>`,
    rainy:  `<path d="${CLOUD_PATH}"/><path d="M17 34l-2 7M25 34l-2 7M33 34l-2 7"/>`,
    snowy:  `<path d="${CLOUD_PATH}"/><circle cx="17" cy="36" r="1.6" fill="currentColor" stroke="none"/><circle cx="25" cy="41" r="1.6" fill="currentColor" stroke="none"/><circle cx="33" cy="36" r="1.6" fill="currentColor" stroke="none"/>`,
    windy:  `<path d="M6 18h22a5 5 0 1 0-5-5"/><path d="M6 26h32a5 5 0 1 1-5 5"/><path d="M6 34h14"/>`
  };

  function icon(name) {
    return `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] || ""}</svg>`;
  }

  function fillIcons() {
    document.querySelectorAll("[data-wx-icon]").forEach(el => {
      el.innerHTML = icon(el.dataset.wxIcon);
    });
  }

  // ---------- What each weather looks like (amounts from 0 to 1) ----------
  //  sun: sun and rays   cloud: how many clouds   dark: how dark the clouds are
  //  rain / snow / wind / motes: particles   wet: wet ground   drift: snow on the ground
  //  speed: how fast the clouds travel
  const TARGETS = {
    sunny:  { sun: 1,   cloud: 0.30, dark: 0,    rain: 0, snow: 0, wind: 0, motes: 1, wet: 0, drift: 0, speed: 1 },
    cloudy: { sun: 0.3, cloud: 1,    dark: 0.12, rain: 0, snow: 0, wind: 0, motes: 0, wet: 0, drift: 0, speed: 1.2 },
    rainy:  { sun: 0,   cloud: 1,    dark: 1,    rain: 1, snow: 0, wind: 0, motes: 0, wet: 1, drift: 0, speed: 1.5 },
    snowy:  { sun: 0.1, cloud: 0.85, dark: 0.05, rain: 0, snow: 1, wind: 0, motes: 0, wet: 0, drift: 1, speed: 0.8 },
    windy:  { sun: 0.45, cloud: 0.6, dark: 0,    rain: 0, snow: 0, wind: 1, motes: 0, wet: 0, drift: 0, speed: 7 }
  };

  function readSaved() {
    try {
      const saved = localStorage.getItem(STORE_KEY);
      return NAMES.includes(saved) ? saved : null;
    } catch (error) { return null; }
  }

  function readPlanWeather() {
    try {
      const saved = localStorage.getItem(PLAN_STORE_KEY);
      return NAMES.includes(saved) ? saved : null;
    } catch (error) { return null; }
  }

  const savedPlanWeather = readPlanWeather();
  let name = savedPlanWeather || document.documentElement.dataset.weather;
  if (!NAMES.includes(name)) name = readSaved() || "sunny";
  document.documentElement.dataset.weather = name;

  const cur = Object.assign({}, TARGETS[name]);   // amounts right now (they ease towards the target)
  let target = TARGETS[name];

  // ---------- Canvas ----------
  const canvas = document.createElement("canvas");
  canvas.id = "sky";
  canvas.setAttribute("aria-hidden", "true");
  document.body.insertBefore(canvas, document.body.firstChild);
  const ctx = canvas.getContext("2d");

  let W = 0, H = 0, DPR = 1, CX = 0, CY = 0, F = 1, SW = 0;
  let T = 0;                                 // scene time in seconds
  const cam = { x: 0, y: 0, tx: 0, ty: 0 };  // camera shift from the mouse (-1 to 1)
  let lastMove = -1e9;
  let running = false;
  let lastFrame = 0;
  let flash = 0, flashTimer = 6;

  const GROUND = 0.5;       // world height of the ground (eye is at 0, y grows downwards)
  const PX = 0.25, PY = 0.12;   // how strongly the camera moves things
  const small = Math.min(window.screen.width, window.innerWidth) < 700;
  const MULT = small ? 0.55 : 1;

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Perspective: how many pixels one world unit is at depth z
  const scale = z => F / z;
  // Screen x of a particle with sideways position u (-1..1) at depth z
  const screenX = (u, z) => CX + u * SW - cam.x * PX * scale(z);
  // Highest world y that is still visible at depth z (top of the screen)
  const topY = z => -(CY / F) * z * 1.15 - 0.2;

  // ---------- Soft sprites, drawn once ----------
  function makeDot(r, g, b) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const x = c.getContext("2d");
    const grad = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
    grad.addColorStop(0.35, `rgba(${r},${g},${b},0.65)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = grad;
    x.fillRect(0, 0, 64, 64);
    return c;
  }
  // A snowflake: a white core with a faint blue-grey halo, so it also shows on a pale sky
  function makeFlake() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const x = c.getContext("2d");
    let g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(120,150,185,0.30)");
    g.addColorStop(0.55, "rgba(120,150,185,0.16)");
    g.addColorStop(1, "rgba(120,150,185,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    g = x.createRadialGradient(32, 32, 0, 32, 32, 20);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.7, "rgba(255,255,255,0.95)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return c;
  }
  const flakeSprite = makeFlake();
  const moteSprite = makeDot(255, 236, 170);

  // A cloud is a cluster of soft blobs. We draw a light one and a dark one and
  // fade between them, so the same clouds can be white or stormy.
  const CLOUD_W = 560, CLOUD_H = 240;
  function makeCloud(dark, seed) {
    const c = document.createElement("canvas");
    c.width = CLOUD_W;
    c.height = CLOUD_H;
    const x = c.getContext("2d");
    let s = seed;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const blobs = [];
    const n = 11 + Math.floor(rnd() * 4);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const bump = Math.sin(t * Math.PI);                  // taller in the middle
      blobs.push({
        x: 70 + t * (CLOUD_W - 140),
        y: CLOUD_H - 78 - bump * (30 + rnd() * 70) - rnd() * 14,
        r: 44 + bump * 44 + rnd() * 24
      });
    }
    // shade first (slightly lower), then the lit blobs on top
    const shade = dark ? [34, 46, 64] : [150, 168, 190];
    const lit   = dark ? [88, 106, 130] : [255, 255, 255];
    [[shade, 14, 0.9], [lit, 0, 0.85]].forEach(([col, dy, a]) => {
      blobs.forEach(b => {
        const grad = x.createRadialGradient(b.x, b.y + dy, 0, b.x, b.y + dy, b.r);
        grad.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${a})`);
        grad.addColorStop(0.6, `rgba(${col[0]},${col[1]},${col[2]},${a * 0.6})`);
        grad.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
        x.fillStyle = grad;
        x.beginPath();
        x.arc(b.x, b.y + dy, b.r, 0, Math.PI * 2);
        x.fill();
      });
    });
    return c;
  }
  const lightClouds = [], darkClouds = [];
  for (let i = 0; i < 5; i++) {
    lightClouds.push(makeCloud(false, 11 + i * 37));
    darkClouds.push(makeCloud(true, 11 + i * 37));
  }

  // ---------- Particles ----------
  const COUNTS = {
    rain:  Math.round(440 * MULT),
    snow:  Math.round(260 * MULT),
    motes: Math.round(70 * MULT),
    leaves: Math.round(22 * MULT),
    gusts: Math.round(18 * MULT),
    clouds: Math.round(24 * MULT) + 6
  };

  const drops = Array.from({ length: COUNTS.rain }, () => {
    const z = rand(0.6, 7);
    return { u: rand(-1, 1), z, y: rand(topY(z), GROUND), v: rand(0.85, 1.15) };
  });
  const ripples = [];

  const flakes = Array.from({ length: COUNTS.snow }, () => {
    const z = rand(0.6, 6);
    return { u: rand(-1, 1), z, y: rand(topY(z), GROUND), ph: rand(0, 6.28), s: rand(0.6, 1.4), v: rand(0.7, 1.3) };
  });

  const motes = Array.from({ length: COUNTS.motes }, () => ({
    u: rand(-1, 1), z: rand(0.8, 5), k: rand(0, 1), ph: rand(0, 6.28), s: rand(0.5, 1.4)
  }));

  const LEAF_COLORS = ["#d9a441", "#c4622d", "#7aa33a", "#e0b95a", "#a8442a"];
  const leaves = Array.from({ length: COUNTS.leaves }, () => ({
    u: rand(-1.1, 1.1), z: rand(0.7, 4), k: rand(0.1, 0.95), ph: rand(0, 6.28),
    spin: rand(-3, 3), rot: rand(0, 6.28), flip: rand(0, 6.28), s: rand(0.7, 1.3),
    color: LEAF_COLORS[Math.floor(rand(0, LEAF_COLORS.length))], v: rand(0.7, 1.4)
  }));

  const gusts = Array.from({ length: COUNTS.gusts }, () => ({
    u: rand(-1.2, 1.2), z: rand(0.8, 4), k: rand(0.08, 0.95), ph: rand(0, 6.28),
    len: rand(160, 420), v: rand(0.9, 1.6)
  }));

  const clouds = Array.from({ length: COUNTS.clouds }, (_, i) => ({
    u: rand(-1.3, 1.3),
    z: 1.2 + Math.pow(Math.random(), 1.3) * 4.3,
    k: rand(0.05, 0.92),
    sprite: Math.floor(rand(0, 5)),
    size: rand(0.8, 1.3),
    drift: rand(0.008, 0.022),
    rank: i / COUNTS.clouds
  })).sort((a, b) => b.z - a.z);   // far clouds first, near clouds last

  // ---------- Size ----------
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    CX = W / 2;
    CY = H * 0.46;
    F = H * 0.6;
    SW = W * 0.5 + H * 0.3;
    kick();
  }

  // ---------- Drawing the pieces ----------
  function drawSun() {
    const a = cur.sun;
    if (a < 0.01) return;
    const x = CX + W * 0.26 - cam.x * W * 0.04;
    const y = CY * 0.5 - cam.y * H * 0.02;
    const R = H * 0.075;
    const pulse = 1 + Math.sin(T * 0.8) * 0.03;

    // big warm glow
    let g = ctx.createRadialGradient(x, y, 0, x, y, H * 0.65 * pulse);
    g.addColorStop(0, `rgba(255,246,205,${0.95 * a})`);
    g.addColorStop(0.18, `rgba(255,214,130,${0.55 * a})`);
    g.addColorStop(0.55, `rgba(255,190,110,${0.16 * a})`);
    g.addColorStop(1, "rgba(255,190,110,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // slowly turning rays
    const L = Math.max(W, H) * 1.3;
    g = ctx.createRadialGradient(x, y, R, x, y, L);
    g.addColorStop(0, `rgba(255,244,200,${0.30 * a})`);
    g.addColorStop(1, "rgba(255,244,200,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    const beams = 16;
    for (let i = 0; i < beams; i++) {
      const ang = T * 0.045 + (i / beams) * Math.PI * 2;
      const w = 0.028 + 0.012 * Math.sin(i * 2.3 + T * 0.5);
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang - w) * L, y + Math.sin(ang - w) * L);
      ctx.lineTo(x + Math.cos(ang + w) * L, y + Math.sin(ang + w) * L);
      ctx.closePath();
    }
    ctx.fill();

    // the sun itself
    g = ctx.createRadialGradient(x - R * 0.25, y - R * 0.25, 0, x, y, R);
    g.addColorStop(0, `rgba(255,255,240,${a})`);
    g.addColorStop(1, `rgba(255,226,150,${a})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fill();

    // lens flare: small circles on the line from the sun through the middle of the screen
    const fa = a * a * 0.12;
    if (fa > 0.004) {
      [[0.45, 0.035], [0.7, 0.055], [1.0, 0.025], [1.35, 0.045]].forEach(([t, r]) => {
        const fx = x + (CX - x) * t * 1.6;
        const fy = y + (CY - y) * t * 1.6;
        ctx.fillStyle = `rgba(255,240,200,${fa})`;
        ctx.beginPath();
        ctx.arc(fx, fy, r * H, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  function drawOvercast() {
    // a dark band across the top of the sky when the clouds are stormy
    if (cur.dark < 0.02) return;
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.7);
    g.addColorStop(0, `rgba(8,16,30,${0.6 * cur.dark})`);
    g.addColorStop(1, "rgba(8,16,30,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H * 0.7);
  }

  function horizonY() {
    return CY + (GROUND - cam.y * PY) * scale(8);
  }

  function drawWetGround() {
    if (cur.wet < 0.02) return;
    const y0 = horizonY();
    const g = ctx.createLinearGradient(0, y0, 0, H);
    g.addColorStop(0, `rgba(30,52,78,${0.25 * cur.wet})`);
    g.addColorStop(1, `rgba(4,10,20,${0.7 * cur.wet})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, y0, W, H - y0);
  }

  function drawSnowHills() {
    if (cur.drift < 0.02) return;
    const layers = [
      { base: 0.86, amp: 0.030, f: 0.0042, par: 0.010, a: 0.55, col: "226,238,250" },
      { base: 0.92, amp: 0.030, f: 0.0031, par: 0.022, a: 0.78, col: "240,247,253" },
      { base: 0.975, amp: 0.022, f: 0.0027, par: 0.040, a: 1.0, col: "255,255,255" }
    ];
    layers.forEach((l, i) => {
      ctx.fillStyle = `rgba(${l.col},${l.a * cur.drift})`;
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W + 20; x += 20) {
        const y = H * l.base - cam.y * H * 0.01 * (i + 1) +
          Math.sin((x + cam.x * W * l.par * 6) * l.f + i * 2) * H * l.amp;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
    });
  }

  function drawClouds(dt) {
    const drift = dt * cur.speed;
    for (const c of clouds) {
      c.u += c.drift * drift;
      if (c.u > 1.45) c.u = -1.45;
      const a = clamp((cur.cloud - c.rank) * 6, 0, 1);
      if (a < 0.01) continue;
      const k = scale(c.z);
      const w = (CLOUD_W * 1.15 * c.size / c.z) * clamp(H / 800, 0.6, 1.5);
      const h = w * (CLOUD_H / CLOUD_W);
      const x = CX + c.u * SW * 1.15 - cam.x * PX * k;
      const y = CY - c.k * CY * 0.95 - cam.y * PY * k * 0.4;
      const fade = clamp(1.4 - c.z * 0.12, 0.45, 1);
      // light version, then the dark one fading in on top
      ctx.globalAlpha = a * fade * (1 - cur.dark * 0.9);
      if (ctx.globalAlpha > 0.01) ctx.drawImage(lightClouds[c.sprite], x - w / 2, y - h / 2, w, h);
      ctx.globalAlpha = a * fade * cur.dark;
      if (ctx.globalAlpha > 0.01) ctx.drawImage(darkClouds[c.sprite], x - w / 2, y - h / 2, w, h);
    }
    ctx.globalAlpha = 1;
  }

  function drawMotes(dt) {
    const a = cur.motes;
    if (a < 0.02) return;
    const n = Math.floor(motes.length * a);
    for (let i = 0; i < n; i++) {
      const m = motes[i];
      m.k -= dt * 0.012 * m.s;
      if (m.k < -0.05) m.k = 1.05;
      const k = scale(m.z);
      const x = screenX(m.u, m.z) + Math.sin(T * 0.5 + m.ph) * 18 / m.z;
      const y = H * m.k - cam.y * PY * k * 0.3;
      const size = m.s * k * 0.045 + 3;
      ctx.globalAlpha = a * (0.25 + 0.35 * Math.sin(T * 1.3 + m.ph) ** 2) * clamp(1.3 - m.z * 0.15, 0.3, 1);
      ctx.drawImage(moteSprite, x - size, y - size, size * 2, size * 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawGusts(dt) {
    const a = cur.wind;
    if (a < 0.02) return;
    const n = Math.floor(gusts.length * a);
    ctx.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const g = gusts[i];
      g.u += dt * 0.9 * g.v;
      if (g.u > 1.5) { g.u = -1.5; g.k = rand(0.08, 0.95); }
      const k = scale(g.z);
      const hx = screenX(g.u, g.z);
      const hy = H * g.k - cam.y * PY * k * 0.3;
      const len = g.len / g.z;
      const steps = 22;
      const grad = ctx.createLinearGradient(hx - len, 0, hx, 0);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(1, `rgba(255,255,255,${0.6 * a})`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = clamp(3.2 / g.z, 1, 3.4);
      ctx.beginPath();
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = hx - t * len;
        const y = hy + Math.sin(t * 9 + T * 3 + g.ph) * (6 + 14 * t) / g.z;
        s === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  function drawLeaves(dt) {
    const a = cur.wind;
    if (a < 0.02) return;
    const n = Math.floor(leaves.length * a);
    for (let i = 0; i < n; i++) {
      const l = leaves[i];
      l.u += dt * 0.55 * l.v;
      l.rot += l.spin * dt;
      l.flip += dt * 4;
      if (l.u > 1.2) { l.u = -1.2; l.k = rand(0.1, 0.95); }
      const k = scale(l.z);
      const x = screenX(l.u, l.z);
      const y = H * l.k + Math.sin(T * 1.8 + l.ph) * 30 / l.z - cam.y * PY * k * 0.3;
      const size = l.s * k * 0.05 + 4;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(l.rot);
      ctx.scale(1, Math.cos(l.flip));      // turning over in the air
      ctx.globalAlpha = a * clamp(1.2 - l.z * 0.12, 0.4, 1);
      ctx.fillStyle = l.color;
      ctx.beginPath();
      ctx.moveTo(-size, 0);
      ctx.quadraticCurveTo(0, -size * 0.65, size, 0);
      ctx.quadraticCurveTo(0, size * 0.65, -size, 0);
      ctx.fill();
      ctx.strokeStyle = "rgba(60,40,10,0.45)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-size, 0);
      ctx.lineTo(size * 0.9, 0);
      ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawRain(dt) {
    const a = cur.rain;
    if (a < 0.02) return;
    const n = Math.floor(drops.length * a);
    const lean = 0.12;                                // rain falls slightly slanted
    const near = [], mid = [], far = [];
    for (let i = 0; i < n; i++) {
      const d = drops[i];
      const k = scale(d.z);
      const speedPx = d.v * 3.0 * k;                  // pixels per second, faster when close
      d.y += d.v * 3.0 * dt;
      d.u += (lean * speedPx * dt) / SW;
      if (d.u > 1.05) d.u = -1.05;
      if (d.y > GROUND) {
        if (ripples.length < 140 && Math.random() < 0.55) ripples.push({ u: d.u, z: d.z, t: 0 });
        d.z = rand(0.6, 7);
        d.u = rand(-1, 1);
        d.y = topY(d.z) - rand(0, 0.8);
      }
      const x = screenX(d.u, d.z);
      const y = CY + (d.y - cam.y * PY) * k;
      const len = Math.max(6, speedPx * 0.05);
      const bucket = d.z < 1.6 ? near : d.z < 3.5 ? mid : far;
      bucket.push(x, y, x - lean * len, y - len);
    }
    ctx.lineCap = "round";
    [[near, 2.2, 0.55], [mid, 1.4, 0.4], [far, 0.9, 0.28]].forEach(([list, width, alpha]) => {
      if (!list.length) return;
      ctx.strokeStyle = `rgba(205,228,255,${alpha * a})`;
      ctx.lineWidth = width;
      ctx.beginPath();
      for (let i = 0; i < list.length; i += 4) {
        ctx.moveTo(list[i], list[i + 1]);
        ctx.lineTo(list[i + 2], list[i + 3]);
      }
      ctx.stroke();
    });

    // rings spreading on the wet ground, squashed because we look at the ground from a low angle
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.t += dt * 1.5;
      if (r.t >= 1) { ripples.splice(i, 1); continue; }
      const k = scale(r.z);
      const x = screenX(r.u, r.z);
      const y = CY + (GROUND - cam.y * PY) * k;
      const rx = (0.02 + r.t * 0.09) * k;
      ctx.strokeStyle = `rgba(210,232,255,${(1 - r.t) * 0.55 * a})`;
      ctx.lineWidth = clamp(1.6 / r.z ** 0.4, 0.7, 1.8);
      ctx.beginPath();
      ctx.ellipse(x, y, rx, rx * 0.28, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawSnow(dt) {
    const a = cur.snow;
    if (a < 0.02) return;
    const n = Math.floor(flakes.length * a);
    for (let i = 0; i < n; i++) {
      const f = flakes[i];
      f.y += f.v * 0.32 * dt;
      if (f.y > GROUND) {
        f.z = rand(0.6, 6);
        f.u = rand(-1, 1);
        f.y = topY(f.z) - rand(0, 0.6);
      }
      const k = scale(f.z);
      const x = screenX(f.u, f.z) + Math.sin(T * 0.7 + f.ph) * 0.05 * k;
      const y = CY + (f.y - cam.y * PY) * k;
      const size = Math.max(4, f.s * k * 0.04);
      ctx.globalAlpha = a * clamp(1.15 - f.z * 0.1, 0.5, 1);
      ctx.drawImage(flakeSprite, x - size, y - size, size * 2, size * 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawLightning(dt) {
    if (reduced) return;
    if (cur.rain > 0.9) {
      flashTimer -= dt;
      if (flashTimer < 0) { flash = 1; flashTimer = rand(8, 16); }
    }
    flash *= Math.exp(-dt * 2.5);
    if (flash > 0.01) {
      ctx.fillStyle = `rgba(215,230,255,${flash * 0.14})`;   // a soft glow, never a hard flash
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ---------- Frame loop ----------
  function step(dt) {
    const ease = 1 - Math.exp(-dt * 3.2);
    let settled = true;
    for (const key in target) {
      const diff = target[key] - cur[key];
      if (Math.abs(diff) > 0.003) settled = false;
      cur[key] += diff * ease;
    }
    return settled;
  }

  function render(dt, simDt) {
    T += simDt;
    // camera follows the mouse; with no mouse for a while it sways by itself
    const idle = performance.now() - lastMove > 4000;
    if (!reduced) {
      if (idle) { cam.tx = Math.sin(T * 0.2) * 0.5; cam.ty = Math.cos(T * 0.15) * 0.25; }
      const follow = 1 - Math.exp(-dt * 4);
      cam.x += (cam.tx - cam.x) * follow;
      cam.y += (cam.ty - cam.y) * follow;
    }

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    drawSun();
    drawOvercast();
    drawWetGround();
    drawClouds(simDt);
    drawMotes(simDt);
    drawGusts(simDt);
    drawLeaves(simDt);
    drawRain(simDt);
    drawSnow(simDt);
    drawSnowHills();
    drawLightning(simDt);
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - lastFrame) / 1000 || 0.016);
    lastFrame = now;
    const settled = step(dt);
    render(dt, reduced ? 0 : dt);
    // people who asked for less motion get a still picture: stop once the change is finished
    if (reduced && settled) { running = false; return; }
    requestAnimationFrame(frame);
  }

  function kick() {
    if (!ctx || running) return;
    running = true;
    lastFrame = performance.now();
    requestAnimationFrame(frame);
  }

  // ---------- Public functions ----------
  function set(next, options) {
    if (!NAMES.includes(next)) return;
    const planWeather = readPlanWeather();
    if (planWeather && !(options && options.plan)) return;
    if (next !== name) {
      name = next;
      target = TARGETS[next];
      document.documentElement.dataset.weather = next;
      document.dispatchEvent(new CustomEvent("weatherchange", { detail: next }));
      kick();
    }
    if (options && options.save) {
      try { localStorage.setItem(STORE_KEY, next); } catch (error) { /* storage blocked: ignore */ }
    }
    if (options && options.plan) {
      try { localStorage.setItem(PLAN_STORE_KEY, next); } catch (error) { /* storage blocked: ignore */ }
    }
  }

  window.Sky = {
    names: NAMES,
    set,
    get: () => name,
    getPlanWeather: readPlanWeather,
    mood: n => MOODS[n] || "",
    icon
  };

  window.addEventListener("storage", event => {
    if (event.key !== PLAN_STORE_KEY) return;
    const planWeather = readPlanWeather();
    if (planWeather) set(planWeather, { save: true, plan: true });
  });

  window.setInterval(() => {
    if (readPlanWeather()) return;
    const currentIndex = NAMES.indexOf(name);
    set(NAMES[(currentIndex + 1) % NAMES.length], { save: true });
  }, 3000);

  // ---------- Start ----------
  if (ctx) {
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", event => {
      if (event.pointerType === "touch") return;
      cam.tx = (event.clientX / W - 0.5) * 2;
      cam.ty = (event.clientY / H - 0.5) * 2;
      lastMove = performance.now();
    });
    resize();
  }
  fillIcons();
})();