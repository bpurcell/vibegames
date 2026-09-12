/* =====================================================================
   Spooky Forest — monsters pop out of the trees, you throw pumpkins.

   Built for a six-year-old, which drove most of the decisions here:

   * The whole interface is "tap the monster". No aiming, no joystick,
     no dragging. A tap anywhere throws a pumpkin, so a wild tap is still
     a satisfying splat rather than nothing happening.

   * Pumpkins HOME to the monster you tapped, and a tapped monster stops
     ducking until the pumpkin lands. A small child taps a moment after
     they decide to; without those two rules the game keeps telling them
     they missed when they didn't.

   * Nothing chases you and nothing can hurt you. The round is a timer,
     the outcome is a number, and monsters that get away are counted with
     a friendly line rather than a penalty.

   * The monsters are silly, not frightening: big grins, googly eyes,
     no blood, no jump scares, no sudden loud noises.
   ===================================================================== */
(function () {
  "use strict";

  var canvas = document.getElementById("stage");
  var ctx = canvas.getContext("2d");

  var elScore = document.getElementById("scoreNum");
  var elBest = document.getElementById("bestNum");
  var clock = document.getElementById("clock");
  var clockFill = document.getElementById("clockFill");
  var titleCard = document.getElementById("titleCard");
  var overCard = document.getElementById("overCard");
  var pauseCard = document.getElementById("pauseCard");

  var ROUND = 45;                 // seconds; a minute is a long time at six
  var KINDS = ["ghost", "goblin", "zombie", "bat"];

  var S = {
    mode: "title",                // title | play | over | paused
    score: 0, escaped: 0, best: 0,
    time: ROUND,
    slots: [],
    props: [],
    monsters: [],
    pumpkins: [],
    fx: [],
    bats: [],
    spawnIn: 0.6
  };

  var U = 60;                     // tree unit, set by layout()
  var W = 0, H = 0, dpr = 1;
  var T = 0;                      // seconds since load, for idle animation
  var bg = document.createElement("canvas");

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) { /* private browsing */ }
    return null;
  }

  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    if (c.roundRect) { c.roundRect(x, y, w, h, r); return; }
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  /* ----------------------------------------------------------- layout */

  // Three rows of trees, back to front. Each row is smaller and higher up
  // than the one in front of it, which is all the perspective this needs.
  var ROWS = [
    { y: 0.36, n: 4, s: 0.68 },
    { y: 0.54, n: 3, s: 0.86 },
    { y: 0.72, n: 4, s: 1.04 }
  ];

  function layout() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    if (!W || !H) return;
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    U = Math.min(W / 5.2, H / 6.2);

    // Slots are rebuilt on resize, so anything pointing at one by index
    // would dangle — monsters hold the slot object itself instead.
    var old = S.slots;
    S.slots = [];
    ROWS.forEach(function (r, ri) {
      for (var i = 0; i < r.n; i++) {
        // Alternate rows are nudged sideways so the trunks don't line up
        // into an obvious grid.
        var nx = (i + 0.5) / r.n + (ri % 2 ? 0.055 : -0.03) / r.n;
        var s = {
          x: nx * W,
          base: r.y * H,
          s: r.s,
          row: ri,
          seed: (i * 37 + ri * 101) % 100
        };
        s.R = U * 0.50 * r.s;                  // canopy radius
        s.canopyY = s.base - U * 0.55 * r.s - s.R * 0.55;
        S.slots.push(s);
      }
    });

    // Keep live monsters on a sensible slot across a rotation.
    S.monsters.forEach(function (m, i) {
      var was = old.indexOf(m.slot);
      m.slot = S.slots[was >= 0 && was < S.slots.length ? was : i % S.slots.length];
    });

    buildProps();
    paintBackground();
  }

  // Gravestones and jack-o'-lanterns along the front, between the last row
  // of trees and the thrower. Purely scenery — nothing spawns here — but
  // without them the bottom third of the screen is an empty purple field.
  function buildProps() {
    S.props = [];
    var top = ROWS[2].y * H + U * 0.2, bottom = throwerY() - U * 0.3;
    if (bottom <= top) return;
    var spots = [0.08, 0.24, 0.40, 0.62, 0.80, 0.93];
    spots.forEach(function (nx, i) {
      // Leave the middle clear so nothing sits on the thrower's head.
      if (Math.abs(nx - 0.5) < 0.08) return;
      S.props.push({
        x: nx * W,
        y: top + ((i * 37) % 100) / 100 * (bottom - top),
        s: U * (0.22 + ((i * 53) % 30) / 100),
        kind: i % 3 === 1 ? "lantern" : i % 3 === 2 ? "grass" : "stone",
        ph: i * 1.7
      });
    });
    // Draw the near ones last so they overlap the far ones correctly.
    S.props.sort(function (a, b) { return a.y - b.y; });
  }

  if (window.ResizeObserver) new ResizeObserver(layout).observe(canvas);
  else window.addEventListener("resize", layout);
  window.addEventListener("orientationchange", function () { setTimeout(layout, 250); });

  /* ------------------------------------------------- static backdrop */

  // Sky, moon, stars and hills never change, so they are painted once per
  // resize into an offscreen canvas and blitted each frame.
  function paintBackground() {
    bg.width = canvas.width; bg.height = canvas.height;
    var c = bg.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);

    var sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#1a0f33");
    sky.addColorStop(0.45, "#39194f");
    sky.addColorStop(0.72, "#6b2a54");
    sky.addColorStop(1, "#2a1338");
    c.fillStyle = sky;
    c.fillRect(0, 0, W, H);

    for (var i = 0; i < 60; i++) {
      var sx = Math.random() * W, sy = Math.random() * H * 0.55;
      c.globalAlpha = 0.25 + Math.random() * 0.65;
      c.fillStyle = "#fff";
      c.fillRect(sx, sy, 1.6, 1.6);
    }
    c.globalAlpha = 1;

    // Moon, low and huge, so the trees read as silhouettes against it.
    var mx = W * 0.76, my = H * 0.17, mr = Math.min(W, H) * 0.13;
    var glow = c.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 3.2);
    glow.addColorStop(0, "rgba(255,226,150,0.30)");
    glow.addColorStop(1, "rgba(255,226,150,0)");
    c.fillStyle = glow;
    c.beginPath(); c.arc(mx, my, mr * 3.2, 0, 6.284); c.fill();
    c.fillStyle = "#ffeab4";
    c.beginPath(); c.arc(mx, my, mr, 0, 6.284); c.fill();
    c.fillStyle = "rgba(217,186,120,0.55)";
    [[0.3, -0.25, 0.19], [-0.32, 0.18, 0.15], [0.12, 0.42, 0.11]].forEach(function (k) {
      c.beginPath(); c.arc(mx + k[0] * mr, my + k[1] * mr, k[2] * mr, 0, 6.284); c.fill();
    });

    // Far hills and a wash of ground fog behind the back row.
    c.fillStyle = "#1d0f2e";
    c.beginPath();
    c.moveTo(0, H * 0.46);
    for (var x = 0; x <= W; x += W / 8) {
      c.quadraticCurveTo(x + W / 16, H * (0.40 + 0.05 * Math.sin(x)), x + W / 8, H * 0.45);
    }
    c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fill();

    var fog = c.createLinearGradient(0, H * 0.30, 0, H * 0.58);
    fog.addColorStop(0, "rgba(180,150,220,0)");
    fog.addColorStop(0.5, "rgba(180,150,220,0.17)");
    fog.addColorStop(1, "rgba(180,150,220,0)");
    c.fillStyle = fog;
    c.fillRect(0, H * 0.30, W, H * 0.28);

    var ground = c.createLinearGradient(0, H * 0.62, 0, H);
    ground.addColorStop(0, "rgba(20,10,34,0)");
    ground.addColorStop(1, "rgba(14,7,26,0.92)");
    c.fillStyle = ground;
    c.fillRect(0, H * 0.62, W, H * 0.38);
  }

  /* ---------------------------------------------------------- monsters */

  // Everything gets harder across the round rather than between rounds:
  // a six-year-old gets the gentle version every single time they start.
  function ramp(a, b) {
    var p = 1 - Math.max(0, S.time) / ROUND;
    return a + (b - a) * p;
  }

  function mrad(m) { return U * 0.38 * m.slot.s; }
  function hitRad(m) { return Math.max(mrad(m) * 1.7, 30); }

  function mpos(m) {
    var s = m.slot, R = mrad(m);
    var hidden = s.canopyY + R * 0.35;                 // tucked behind the leaves
    // Clear of the canopy by all but a quarter of its body: enough overlap
    // to read as "behind the tree", little enough to be a tap target.
    var out = s.canopyY - s.R * 1.12 - R * 0.70;
    // A little overshoot on the way up reads as "popped out", not "slid up".
    var p = m.p, e = m.phase === "rise" ? 1 + 2.2 * Math.pow(p - 1, 3) + 1.4 * Math.pow(p - 1, 2) : p;
    return {
      x: s.x + Math.sin(m.wob + T * 2.2) * R * 0.10,
      y: hidden + (out - hidden) * e,
      r: R
    };
  }

  function spawn() {
    var free = S.slots.filter(function (s) {
      return !S.monsters.some(function (m) { return m.slot === s; });
    });
    if (!free.length) return;
    var slot = free[(Math.random() * free.length) | 0];
    var kind = KINDS[(Math.random() * KINDS.length) | 0];
    S.monsters.push({
      slot: slot,
      kind: kind,
      phase: "rise",
      p: 0,
      t: 0,
      // Bats are quick visitors; the rest linger.
      life: ramp(2.6, 1.3) * (kind === "bat" ? 0.75 : 1),
      claimed: false,
      wob: Math.random() * 6.28
    });
  }

  function stepMonsters(dt) {
    for (var i = S.monsters.length - 1; i >= 0; i--) {
      var m = S.monsters[i];
      // A monster someone has already thrown at holds still until the
      // pumpkin lands — including one caught halfway down its hole. The
      // pumpkin is airborne for a third of a second, and "I tapped it!"
      // being true is worth more than the monster's dignity.
      if (m.claimed && m.phase !== "rise") continue;

      if (m.phase === "rise") {
        m.p += dt / 0.24;
        if (m.p >= 1) { m.p = 1; m.phase = "up"; m.t = 0; }
      } else if (m.phase === "up") {
        m.t += dt;
        if (m.t >= m.life) m.phase = "duck";
      } else {
        m.p -= dt / 0.26;
        if (m.p <= 0) { S.monsters.splice(i, 1); S.escaped++; }
      }
    }

    S.spawnIn -= dt;
    if (S.spawnIn <= 0) {
      S.spawnIn = ramp(1.15, 0.5) * (0.75 + Math.random() * 0.5);
      if (S.monsters.length < Math.round(ramp(3, 5))) spawn();
    }
  }

  /* ---------------------------------------------------------- throwing */

  function throwerY() { return H - U * 0.62; }

  function launch(tx, ty, target) {
    if (S.pumpkins.length > 5) return;
    var x0 = W / 2, y0 = throwerY() - U * 0.34;
    var dist = Math.hypot(tx - x0, ty - y0);
    S.pumpkins.push({
      x0: x0, y0: y0, tx: tx, ty: ty, target: target || null,
      t: 0, dur: 0.34 + dist / (W * 6), arc: dist * 0.30 + U * 0.4,
      spin: (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 5)
    });
    if (target) target.claimed = true;
    sfxThrow();
  }

  function stepPumpkins(dt) {
    for (var i = S.pumpkins.length - 1; i >= 0; i--) {
      var p = S.pumpkins[i];
      p.t += dt;
      if (p.target) {                       // follow a moving monster
        var mp = mpos(p.target);
        p.tx = mp.x; p.ty = mp.y;
      }
      if (p.t < p.dur) continue;

      S.pumpkins.splice(i, 1);
      var m = p.target;
      if (m && S.monsters.indexOf(m) >= 0) {
        var at = mpos(m);
        S.monsters.splice(S.monsters.indexOf(m), 1);
        S.score++;
        elScore.textContent = String(S.score);
        puff(at.x, at.y, at.r, m.kind);
        S.fx.push({ type: "float", x: at.x, y: at.y, t: 0 });
        sfxBonk();
      } else {
        S.fx.push({ type: "splat", x: p.tx, y: p.ty, t: 0, r: U * 0.3 });
        sfxSplat();
      }
    }
  }

  function puff(x, y, r, kind) {
    var tint = kind === "ghost" ? "#e8edff" : kind === "bat" ? "#b9a0e8" : "#a8e07a";
    for (var i = 0; i < 16; i++) {
      var a = Math.random() * 6.28, sp = r * (2 + Math.random() * 4);
      S.fx.push({
        type: "bit", x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - r * 1.5,
        t: 0, life: 0.5 + Math.random() * 0.3,
        r: r * (0.12 + Math.random() * 0.22),
        c: Math.random() < 0.45 ? "#ff8a1f" : tint
      });
    }
  }

  function stepFx(dt) {
    for (var i = S.fx.length - 1; i >= 0; i--) {
      var f = S.fx[i];
      f.t += dt;
      if (f.type === "bit") {
        f.x += f.vx * dt; f.y += f.vy * dt; f.vy += U * 9 * dt;
        if (f.t > f.life) S.fx.splice(i, 1);
      } else if (f.type === "splat") {
        if (f.t > 0.6) S.fx.splice(i, 1);
      } else if (f.type === "float") {
        f.y -= U * 0.9 * dt;
        if (f.t > 0.8) S.fx.splice(i, 1);
      }
    }
  }

  // Pointer, not touch/click: one path covers a finger, a pencil and a
  // mouse, and it fires on press rather than release so it feels instant.
  canvas.addEventListener("pointerdown", function (e) {
    if (S.mode !== "play") return;
    e.preventDefault();
    var r = canvas.getBoundingClientRect();
    var x = e.clientX - r.left, y = e.clientY - r.top;

    // Front-most monster first: that's the one under the finger visually.
    for (var i = S.monsters.length - 1; i >= 0; i--) {
      var m = S.monsters[i];
      if (m.claimed || m.p < 0.3) continue;
      var pos = mpos(m);
      if (Math.hypot(x - pos.x, y - pos.y) <= hitRad(m)) { launch(pos.x, pos.y, m); return; }
    }
    launch(x, y, null);
  });
  canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  /* ----------------------------------------------------------- drawing */

  function drawTree(s) {
    var R = s.R, x = s.x, base = s.base;
    var trunkW = R * 0.34, trunkH = base - (s.canopyY + R * 0.25);

    ctx.fillStyle = "#2f2040";
    rr(ctx, x - trunkW / 2, s.canopyY, trunkW, trunkH + R * 0.25, trunkW * 0.3);
    ctx.fill();
    // A couple of crooked branches; straight trunks look planted, not wild.
    ctx.strokeStyle = "#2f2040";
    ctx.lineWidth = trunkW * 0.42;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, s.canopyY + R * 0.5);
    ctx.lineTo(x - R * 0.55, s.canopyY + R * 0.15);
    ctx.moveTo(x, s.canopyY + R * 0.8);
    ctx.lineTo(x + R * 0.5, s.canopyY + R * 0.45);
    ctx.stroke();

    // Seeded wobble so each tree keeps its own silhouette frame to frame.
    var k = (s.seed % 7) / 7 - 0.5, k2 = (s.seed % 5) / 5 - 0.5;
    var blobs = [
      [k * R * 0.2, -R * (0.30 + k2 * 0.12), R * (0.78 + k * 0.12)],
      [-R * (0.62 + k2 * 0.1), R * 0.02, R * (0.58 + k2 * 0.1)],
      [R * (0.60 - k * 0.1), R * 0.04, R * (0.60 + k * 0.1)],
      [-R * 0.22, R * 0.30, R * 0.52],
      [R * 0.26, R * 0.32, R * 0.50]
    ];
    ctx.fillStyle = "#15382a";
    blobs.forEach(function (b) {
      ctx.beginPath(); ctx.arc(x + b[0], s.canopyY + b[1], b[2], 0, 6.284); ctx.fill();
    });
    // Moonlight catches the upper right of every canopy.
    ctx.fillStyle = "rgba(122,196,140,0.16)";
    blobs.slice(0, 3).forEach(function (b) {
      ctx.beginPath();
      ctx.arc(x + b[0] + b[2] * 0.22, s.canopyY + b[1] - b[2] * 0.26, b[2] * 0.62, 0, 6.284);
      ctx.fill();
    });
  }

  function drawGhost(R) {
    ctx.fillStyle = "#f4f7ff";
    ctx.beginPath();
    ctx.arc(0, -R * 0.12, R * 0.82, Math.PI, 0);
    ctx.lineTo(R * 0.82, R * 0.48);
    var n = 3, step = (R * 1.64) / n, x = R * 0.82;
    for (var i = 0; i < n; i++) {
      ctx.quadraticCurveTo(x - step * 0.5, R * 0.48 + (i % 2 ? -R * 0.3 : R * 0.3), x - step, R * 0.48);
      x -= step;
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#2a2140";
    ctx.beginPath(); ctx.ellipse(-R * 0.30, -R * 0.20, R * 0.15, R * 0.20, 0, 0, 6.284); ctx.fill();
    ctx.beginPath(); ctx.ellipse(R * 0.30, -R * 0.20, R * 0.15, R * 0.20, 0, 0, 6.284); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, R * 0.22, R * 0.17, R * 0.13, 0, 0, 6.284); ctx.fill();
  }

  function drawGoblin(R) {
    ctx.fillStyle = "#6fbf3f";
    // Ears first so the head overlaps their roots.
    [-1, 1].forEach(function (s) {
      ctx.beginPath();
      ctx.moveTo(s * R * 0.45, -R * 0.25);
      ctx.lineTo(s * R * 1.15, -R * 0.75);
      ctx.lineTo(s * R * 0.55, R * 0.20);
      ctx.closePath(); ctx.fill();
    });
    ctx.beginPath(); ctx.arc(0, 0, R * 0.72, 0, 6.284); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(-R * 0.26, -R * 0.14, R * 0.20, 0, 6.284); ctx.fill();
    ctx.beginPath(); ctx.arc(R * 0.26, -R * 0.14, R * 0.20, 0, 6.284); ctx.fill();
    ctx.fillStyle = "#241a33";
    ctx.beginPath(); ctx.arc(-R * 0.22, -R * 0.12, R * 0.10, 0, 6.284); ctx.fill();
    ctx.beginPath(); ctx.arc(R * 0.30, -R * 0.12, R * 0.10, 0, 6.284); ctx.fill();
    // A big daft grin, which is the whole difference between silly and scary.
    ctx.fillStyle = "#241a33";
    ctx.beginPath();
    ctx.moveTo(-R * 0.42, R * 0.22);
    ctx.quadraticCurveTo(0, R * 0.68, R * 0.42, R * 0.22);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fff";
    [-0.2, 0.12].forEach(function (o) {
      ctx.beginPath();
      ctx.moveTo(R * o, R * 0.24); ctx.lineTo(R * (o + 0.16), R * 0.24);
      ctx.lineTo(R * (o + 0.08), R * 0.44); ctx.closePath(); ctx.fill();
    });
  }

  function drawZombie(R) {
    ctx.fillStyle = "#9ed08a";
    rr(ctx, -R * 0.66, -R * 0.72, R * 1.32, R * 1.44, R * 0.3);
    ctx.fill();
    ctx.fillStyle = "#3c2b4a";                       // flat mop of hair
    rr(ctx, -R * 0.70, -R * 0.84, R * 1.40, R * 0.46, R * 0.18);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(-R * 0.27, -R * 0.10, R * 0.22, 0, 6.284); ctx.fill();
    ctx.beginPath(); ctx.arc(R * 0.28, -R * 0.08, R * 0.14, 0, 6.284); ctx.fill();
    ctx.fillStyle = "#241a33";
    ctx.beginPath(); ctx.arc(-R * 0.24, -R * 0.08, R * 0.10, 0, 6.284); ctx.fill();
    ctx.beginPath(); ctx.arc(R * 0.30, -R * 0.07, R * 0.07, 0, 6.284); ctx.fill();
    ctx.strokeStyle = "#5f8a4f";
    ctx.lineWidth = R * 0.07;
    ctx.beginPath();                                  // stitches on one cheek
    ctx.moveTo(-R * 0.52, R * 0.22); ctx.lineTo(-R * 0.16, R * 0.22);
    for (var i = 0; i < 3; i++) {
      var sx = -R * 0.46 + i * R * 0.14;
      ctx.moveTo(sx, R * 0.12); ctx.lineTo(sx, R * 0.32);
    }
    ctx.stroke();
    ctx.lineWidth = R * 0.1;
    ctx.strokeStyle = "#241a33";
    ctx.beginPath();
    ctx.moveTo(R * 0.02, R * 0.42);
    ctx.quadraticCurveTo(R * 0.26, R * 0.30, R * 0.50, R * 0.44);
    ctx.stroke();
  }

  function drawBat(R, wob) {
    var flap = 0.55 + 0.45 * Math.sin(wob + T * 12);
    ctx.fillStyle = "#4b2f6e";
    [-1, 1].forEach(function (s) {
      ctx.beginPath();
      ctx.moveTo(s * R * 0.3, 0);
      ctx.quadraticCurveTo(s * R * 1.0, -R * 0.55 * flap, s * R * 1.35, R * 0.12 * flap);
      ctx.quadraticCurveTo(s * R * 0.95, R * 0.05, s * R * 0.85, R * 0.42 * flap);
      ctx.quadraticCurveTo(s * R * 0.6, R * 0.16, s * R * 0.3, R * 0.38);
      ctx.closePath(); ctx.fill();
    });
    ctx.fillStyle = "#3a2456";
    ctx.beginPath(); ctx.arc(0, 0, R * 0.46, 0, 6.284); ctx.fill();
    [-1, 1].forEach(function (s) {
      ctx.beginPath();
      ctx.moveTo(s * R * 0.12, -R * 0.38);
      ctx.lineTo(s * R * 0.34, -R * 0.85);
      ctx.lineTo(s * R * 0.42, -R * 0.26);
      ctx.closePath(); ctx.fill();
    });
    ctx.fillStyle = "#ffd54a";
    ctx.beginPath(); ctx.arc(-R * 0.17, -R * 0.04, R * 0.10, 0, 6.284); ctx.fill();
    ctx.beginPath(); ctx.arc(R * 0.17, -R * 0.04, R * 0.10, 0, 6.284); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();                                   // one little fang
    ctx.moveTo(-R * 0.08, R * 0.20); ctx.lineTo(R * 0.02, R * 0.20);
    ctx.lineTo(-R * 0.03, R * 0.34); ctx.closePath(); ctx.fill();
  }

  function drawMonster(m) {
    var pos = mpos(m), R = pos.r;
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.scale(0.7 + 0.3 * m.p, 0.7 + 0.3 * m.p);
    ctx.rotate(Math.sin(m.wob + T * 1.8) * 0.07);
    if (m.kind === "ghost") drawGhost(R);
    else if (m.kind === "goblin") drawGoblin(R);
    else if (m.kind === "zombie") drawZombie(R);
    else drawBat(R, m.wob);
    ctx.restore();
  }

  function drawPumpkin(x, y, r, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = "#2f7d32";
    rr(ctx, -r * 0.12, -r * 1.2, r * 0.24, r * 0.5, r * 0.1);
    ctx.fill();
    ctx.fillStyle = "#ff8a1f";
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.88, 0, 0, 6.284); ctx.fill();
    ctx.strokeStyle = "rgba(180,80,10,0.55)";
    ctx.lineWidth = r * 0.11;
    [-0.46, 0, 0.46].forEach(function (o) {
      ctx.beginPath();
      ctx.ellipse(o * r, 0, r * 0.24, r * 0.86, 0, 0, 6.284);
      ctx.stroke();
    });
    ctx.restore();
  }

  // A trick-or-treater in a pointy hat, with the basket the pumpkins
  // come out of. Face left in shadow with two glowing eyes — a costume,
  // so no child is being drawn as more or less like the player.
  function drawThrower() {
    var x = W / 2, y = throwerY(), u = U * 0.45;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#4a2a6e";
    ctx.beginPath();                                   // cloak
    ctx.moveTo(-u * 0.85, u * 0.9);
    ctx.quadraticCurveTo(-u * 0.5, -u * 0.5, 0, -u * 0.5);
    ctx.quadraticCurveTo(u * 0.5, -u * 0.5, u * 0.85, u * 0.9);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#2a1a42";
    ctx.beginPath(); ctx.arc(0, -u * 0.62, u * 0.42, 0, 6.284); ctx.fill();
    ctx.fillStyle = "#5b3585";
    ctx.beginPath();                                   // pointy hat
    ctx.moveTo(-u * 0.62, -u * 0.82);
    ctx.quadraticCurveTo(-u * 0.1, -u * 2.1, u * 0.55, -u * 0.9);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ffcf4a";
    ctx.beginPath(); ctx.arc(-u * 0.15, -u * 0.6, u * 0.08, 0, 6.284); ctx.fill();
    ctx.beginPath(); ctx.arc(u * 0.15, -u * 0.6, u * 0.08, 0, 6.284); ctx.fill();
    ctx.fillStyle = "#7a4a22";                         // basket
    rr(ctx, -u * 0.62, u * 0.28, u * 1.24, u * 0.72, u * 0.16);
    ctx.fill();
    [-0.3, 0.0, 0.3].forEach(function (o, i) {
      drawPumpkin(o * u, u * 0.26 + (i === 1 ? -u * 0.08 : 0), u * 0.2, 0);
    });
    ctx.restore();
  }

  function drawProps() {
    S.props.forEach(function (p) {
      var r = p.s;
      if (p.kind === "stone") {
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath(); ctx.ellipse(p.x, p.y + r * 0.06, r * 0.8, r * 0.18, 0, 0, 6.284); ctx.fill();
        ctx.fillStyle = "#4a4260";
        ctx.beginPath();
        ctx.moveTo(p.x - r * 0.55, p.y);
        ctx.lineTo(p.x - r * 0.55, p.y - r * 0.7);
        ctx.arc(p.x, p.y - r * 0.7, r * 0.55, Math.PI, 0);
        ctx.lineTo(p.x + r * 0.55, p.y);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "#6b6187";
        ctx.lineWidth = Math.max(1.5, r * 0.08);
        ctx.beginPath();
        ctx.moveTo(p.x - r * 0.2, p.y - r * 0.75);
        ctx.lineTo(p.x + r * 0.2, p.y - r * 0.75);
        ctx.moveTo(p.x, p.y - r * 0.95);
        ctx.lineTo(p.x, p.y - r * 0.55);
        ctx.stroke();
      } else if (p.kind === "lantern") {
        var flicker = 0.78 + 0.22 * Math.sin(T * 7 + p.ph);
        var g = ctx.createRadialGradient(p.x, p.y - r * 0.4, r * 0.2, p.x, p.y - r * 0.4, r * 2.4);
        g.addColorStop(0, "rgba(255,150,40," + (0.26 * flicker) + ")");
        g.addColorStop(1, "rgba(255,150,40,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y - r * 0.4, r * 2.4, 0, 6.284); ctx.fill();
        drawPumpkin(p.x, p.y - r * 0.45, r * 0.55, 0);
        ctx.fillStyle = "rgba(40,16,0," + (0.55 + 0.3 * flicker) + ")";
        [-1, 1].forEach(function (k) {                  // triangle eyes
          ctx.beginPath();
          ctx.moveTo(p.x + k * r * 0.1, p.y - r * 0.5);
          ctx.lineTo(p.x + k * r * 0.34, p.y - r * 0.5);
          ctx.lineTo(p.x + k * r * 0.22, p.y - r * 0.72);
          ctx.closePath(); ctx.fill();
        });
        ctx.beginPath();                                // zigzag grin
        ctx.moveTo(p.x - r * 0.3, p.y - r * 0.26);
        ctx.lineTo(p.x - r * 0.1, p.y - r * 0.34);
        ctx.lineTo(p.x + r * 0.06, p.y - r * 0.2);
        ctx.lineTo(p.x + r * 0.3, p.y - r * 0.3);
        ctx.lineTo(p.x + r * 0.2, p.y - r * 0.12);
        ctx.lineTo(p.x - r * 0.22, p.y - r * 0.1);
        ctx.closePath(); ctx.fill();
      } else {
        ctx.strokeStyle = "#2a4038";
        ctx.lineWidth = Math.max(1.5, r * 0.1);
        ctx.lineCap = "round";
        for (var i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(p.x + i * r * 0.16, p.y);
          ctx.quadraticCurveTo(p.x + i * r * 0.3, p.y - r * 0.4,
                               p.x + i * r * 0.5 + Math.sin(T * 1.4 + p.ph + i) * r * 0.06, p.y - r * 0.62);
          ctx.stroke();
        }
      }
    });
  }

  function drawFx() {
    S.fx.forEach(function (f) {
      if (f.type === "bit") {
        ctx.globalAlpha = Math.max(0, 1 - f.t / f.life);
        ctx.fillStyle = f.c;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.284); ctx.fill();
      } else if (f.type === "splat") {
        var k = f.t / 0.6;
        ctx.globalAlpha = Math.max(0, 1 - k) * 0.9;
        ctx.fillStyle = "#ff8a1f";
        for (var i = 0; i < 6; i++) {
          var a = i * 1.05 + f.x;
          ctx.beginPath();
          ctx.arc(f.x + Math.cos(a) * f.r * (0.3 + k), f.y + Math.sin(a) * f.r * (0.25 + k * 0.8),
                  f.r * (0.3 - k * 0.12), 0, 6.284);
          ctx.fill();
        }
      } else if (f.type === "float") {
        ctx.globalAlpha = Math.max(0, 1 - f.t / 0.8);
        ctx.fillStyle = "#ffd54a";
        ctx.font = "900 " + (U * 0.42) + "px " + getComputedStyle(document.body).fontFamily;
        ctx.textAlign = "center";
        ctx.fillText("+1", f.x, f.y);
      }
      ctx.globalAlpha = 1;
    });
  }

  function drawBats(dt) {
    if (S.bats.length < 2 && Math.random() < dt * 0.25) {
      var dir = Math.random() < 0.5 ? 1 : -1;
      S.bats.push({ x: dir > 0 ? -U : W + U, y: H * (0.08 + Math.random() * 0.2), dir: dir, ph: Math.random() * 6.28 });
    }
    for (var i = S.bats.length - 1; i >= 0; i--) {
      var b = S.bats[i];
      b.x += b.dir * U * 1.3 * dt;
      if (b.x < -U * 2 || b.x > W + U * 2) { S.bats.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.translate(b.x, b.y + Math.sin(T * 3 + b.ph) * U * 0.15);
      ctx.scale(b.dir, 1);
      drawBat(U * 0.16, b.ph);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  function draw(dt) {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(bg, 0, 0, W, H);
    drawBats(dt);

    // Row by row, back to front. Within a row every monster is drawn before
    // every tree, so a monster rises from BEHIND the leaves.
    for (var row = 0; row < ROWS.length; row++) {
      S.monsters.forEach(function (m) { if (m.slot.row === row) drawMonster(m); });
      S.slots.forEach(function (s) { if (s.row === row) drawTree(s); });
    }

    drawProps();
    drawThrower();

    S.pumpkins.forEach(function (p) {
      var u = Math.min(1, p.t / p.dur);
      var x = p.x0 + (p.tx - p.x0) * u;
      var y = p.y0 + (p.ty - p.y0) * u - Math.sin(Math.PI * u) * p.arc;
      drawPumpkin(x, y, U * 0.17, p.spin * p.t);
    });

    drawFx();
  }

  /* ------------------------------------------------------------- audio */

  var audio = null, muted = store("spooky.muted") === "1";
  var soundBtn = document.getElementById("soundBtn");
  soundBtn.textContent = muted ? "🔇" : "🔊";

  function ac() {
    if (!audio) {
      var Ctor = window.AudioContext || window.webkitAudioContext;
      if (Ctor) audio = new Ctor();
    }
    if (audio && audio.state === "suspended") audio.resume();
    return audio;
  }

  function tone(freq, when, dur, type, gain, slideTo) {
    var a = ac();
    if (!a || muted) return;
    var t0 = a.currentTime + (when || 0);
    var osc = a.createOscillator(), g = a.createGain();
    osc.type = type || "triangle";
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.16, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(a.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  function sfxThrow() { tone(680, 0, 0.16, "sine", 0.07, 300); }
  function sfxSplat() { tone(120, 0, 0.10, "square", 0.07); }
  function sfxBonk() { tone(700, 0, 0.09, "triangle", 0.16); tone(1050, 0.06, 0.14, "triangle", 0.13); }
  function sfxTick() { tone(880, 0, 0.06, "sine", 0.10); }
  function sfxEnd() { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.12, 0.36); }); }

  soundBtn.addEventListener("click", function () {
    muted = !muted;
    soundBtn.textContent = muted ? "🔇" : "🔊";
    store("spooky.muted", muted ? "1" : "0");
    if (!muted) sfxBonk();
  });

  /* -------------------------------------------------------------- flow */

  function setClock() {
    var k = Math.max(0, S.time) / ROUND;
    clockFill.style.transform = "scaleX(" + k + ")";
    clock.classList.toggle("low", S.time <= 10);
  }

  function startRound() {
    S.score = 0; S.escaped = 0; S.time = ROUND;
    S.monsters = []; S.pumpkins = []; S.fx = [];
    S.spawnIn = 0.5;
    elScore.textContent = "0";
    setClock();
    titleCard.hidden = true; overCard.hidden = true; pauseCard.hidden = true;
    S.mode = "play";
  }

  function endRound() {
    S.mode = "over";
    // Pumpkins still in the air were thrown before the buzzer, so they
    // count. A six-year-old taps right up to the last moment.
    S.pumpkins.forEach(function (p) {
      if (p.target && S.monsters.indexOf(p.target) >= 0) {
        S.score++;
        var at = mpos(p.target);
        puff(at.x, at.y, at.r, p.target.kind);
      }
    });
    elScore.textContent = String(S.score);
    S.monsters = []; S.pumpkins = [];
    sfxEnd();
    if (S.score > S.best) { S.best = S.score; store("spooky.best", String(S.best)); }
    elBest.textContent = String(S.best);
    document.getElementById("overScore").textContent = String(S.score);
    document.getElementById("overTitle").textContent =
      S.score === 0 ? "Ooh, tricky!" : S.score >= S.best ? "New best score! 🏆" : "Time's up!";
    document.getElementById("overText").textContent =
      (S.score === 1 ? "You got 1 monster" : "You got " + S.score + " monsters") +
      (S.escaped ? ", and " + S.escaped + " sneaked away." : ". Not one got away!");
    overCard.hidden = false;
  }

  document.getElementById("startBtn").addEventListener("click", function () { ac(); startRound(); });
  document.getElementById("againBtn").addEventListener("click", function () { ac(); startRound(); });
  document.getElementById("resumeBtn").addEventListener("click", function () {
    pauseCard.hidden = true;
    S.mode = "play";
  });

  // Switching apps mid-round shouldn't silently burn the clock.
  document.addEventListener("visibilitychange", function () {
    last = 0;
    if (document.hidden && S.mode === "play") { S.mode = "paused"; pauseCard.hidden = false; }
  });

  /* -------------------------------------------------------------- loop */

  var last = 0, lastTick = 99;
  function frame(t) {
    var dt = last ? Math.min(0.033, (t - last) / 1000) : 0;
    last = t;
    T += dt;

    if (S.mode === "play") {
      S.time -= dt;
      setClock();
      var whole = Math.ceil(S.time);
      if (whole <= 5 && whole > 0 && whole !== lastTick) { lastTick = whole; sfxTick(); }
      stepMonsters(dt);
      stepPumpkins(dt);
      if (S.time <= 0) endRound();
    }
    stepFx(dt);
    draw(dt);
    requestAnimationFrame(frame);
  }

  S.best = parseInt(store("spooky.best") || "0", 10) || 0;
  elBest.textContent = String(S.best);
  layout();
  setClock();
  requestAnimationFrame(frame);
})();
