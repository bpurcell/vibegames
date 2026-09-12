/* =====================================================================
   Maze Car — drive a little car through a maze, for a small human.

   Design notes worth knowing before editing:

   * All game geometry lives in CELL UNITS, not pixels. The car sits at
     (1.5, 0.5) meaning "centre of the cell one to the right of the
     start". Pixels only appear at draw time. That means a rotation, a
     Safari toolbar sliding away, or a resize never disturbs a game in
     progress — only the scale factor changes.

   * The mazes are braided (a quarter of the dead ends are opened up).
     A perfect maze has exactly one route, which for a five-year-old is
     mostly a tour of dead ends. Loops make it forgiving.

   * There is no way to lose. No timer, no enemies, no fail state. The
     only feedback is progress.
   ===================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------ setup */

  var canvas = document.getElementById("maze");
  var ctx = canvas.getContext("2d");

  var elLevel = document.getElementById("levelNum");
  var elStars = document.getElementById("starNum");
  var titleCard = document.getElementById("titleCard");
  var winCard = document.getElementById("winCard");
  var winTitle = document.getElementById("winTitle");
  var winText = document.getElementById("winText");

  var CAR_COLORS = [
    { name: "red",    body: "#ff4d5a", dark: "#c32b38" },
    { name: "blue",   body: "#4db8ff", dark: "#1b7fc0" },
    { name: "yellow", body: "#ffc447", dark: "#c8900f" },
    { name: "green",  body: "#5ce07a", dark: "#25a447" },
    { name: "purple", body: "#b98cff", dark: "#7c4fd0" },
    { name: "pink",   body: "#ff8ad1", dark: "#cc4f9c" }
  ];

  // Tuning, all in cell units per second.
  var WALL_T   = 0.15;   // wall thickness
  var CAR_R    = 0.27;   // collision radius; corridor half-width is 0.425
  var MAX_SPD  = 3.4;
  var ACCEL    = 18;
  var DRAG     = 12;     // deceleration when nothing is held
  var CENTRING = 9;      // how hard the car is nudged to the lane centre

  var S = {
    level: 1,
    stars: 0,
    cols: 5, rows: 5,
    cells: [],
    walls: [],
    starPickups: [],
    car: { x: 0.5, y: 0.5, vx: 0, vy: 0, angle: 0 },
    color: CAR_COLORS[0],
    mode: "title",          // title | play | won
    confetti: [],
    wonAt: 0
  };

  // Scale factors, recomputed on every resize.
  var C = 40, ox = 0, oy = 0, dpr = 1;

  function store(key, value) {
    // Private browsing on iOS can throw on write, and a saved colour is
    // never worth an exception.
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) { /* ignore */ }
    return null;
  }

  /* ------------------------------------------------------- maze maker */

  function genMaze(cols, rows) {
    var cells = new Array(cols * rows);
    for (var i = 0; i < cells.length; i++) {
      cells[i] = { n: true, e: true, s: true, w: true, seen: false };
    }
    var at = function (x, y) { return cells[y * cols + x]; };

    // Iterative recursive-backtracker. Recursion would be fine at these
    // sizes, but the loop keeps the stack honest.
    var stack = [{ x: 0, y: 0 }];
    at(0, 0).seen = true;
    while (stack.length) {
      var cur = stack[stack.length - 1];
      var nb = [];
      if (cur.y > 0        && !at(cur.x, cur.y - 1).seen) nb.push({ x: cur.x, y: cur.y - 1, d: "n" });
      if (cur.x < cols - 1 && !at(cur.x + 1, cur.y).seen) nb.push({ x: cur.x + 1, y: cur.y, d: "e" });
      if (cur.y < rows - 1 && !at(cur.x, cur.y + 1).seen) nb.push({ x: cur.x, y: cur.y + 1, d: "s" });
      if (cur.x > 0        && !at(cur.x - 1, cur.y).seen) nb.push({ x: cur.x - 1, y: cur.y, d: "w" });
      if (!nb.length) { stack.pop(); continue; }

      var pick = nb[(Math.random() * nb.length) | 0];
      var a = at(cur.x, cur.y), b = at(pick.x, pick.y);
      if (pick.d === "n") { a.n = false; b.s = false; }
      if (pick.d === "e") { a.e = false; b.w = false; }
      if (pick.d === "s") { a.s = false; b.n = false; }
      if (pick.d === "w") { a.w = false; b.e = false; }
      b.seen = true;
      stack.push({ x: pick.x, y: pick.y });
    }

    // Braid: open a quarter of the dead ends so the maze has loops.
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var c = at(x, y);
        var open = (c.n ? 0 : 1) + (c.e ? 0 : 1) + (c.s ? 0 : 1) + (c.w ? 0 : 1);
        if (open !== 1 || Math.random() > 0.25) continue;
        var cand = [];
        if (c.n && y > 0)        cand.push("n");
        if (c.e && x < cols - 1) cand.push("e");
        if (c.s && y < rows - 1) cand.push("s");
        if (c.w && x > 0)        cand.push("w");
        if (!cand.length) continue;
        var d = cand[(Math.random() * cand.length) | 0];
        if (d === "n") { c.n = false; at(x, y - 1).s = false; }
        if (d === "e") { c.e = false; at(x + 1, y).w = false; }
        if (d === "s") { c.s = false; at(x, y + 1).n = false; }
        if (d === "w") { c.w = false; at(x - 1, y).e = false; }
      }
    }
    return cells;
  }

  // Every wall becomes an axis-aligned rectangle in cell units. Collision
  // is then circle-vs-rectangle, which is short and never tunnels.
  function buildWalls(cells, cols, rows) {
    var t = WALL_T / 2, out = [];
    var push = function (x0, y0, x1, y1) { out.push({ x0: x0, y0: y0, x1: x1, y1: y1 }); };
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var c = cells[y * cols + x];
        if (c.n) push(x - t, y - t, x + 1 + t, y + t);
        if (c.w) push(x - t, y - t, x + t, y + 1 + t);
        if (c.e && x === cols - 1) push(x + 1 - t, y - t, x + 1 + t, y + 1 + t);
        if (c.s && y === rows - 1) push(x - t, y + 1 - t, x + 1 + t, y + 1 + t);
      }
    }
    return out;
  }

  function newLevel(level) {
    // Grows one cell a side per maze, then stops: past 12 the corridors
    // get thin enough on a phone that steering stops being fun.
    var n = Math.min(4 + level, 12);
    S.cols = n; S.rows = n;
    S.cells = genMaze(n, n);
    S.walls = buildWalls(S.cells, n, n);
    S.car.x = 0.5; S.car.y = 0.5;
    S.car.vx = 0; S.car.vy = 0; S.car.angle = 0;
    S.confetti = [];

    // Three stars, never on the start or the garage, never doubled up.
    S.starPickups = [];
    var taken = { "0,0": true, "": true };
    taken[(n - 1) + "," + (n - 1)] = true;
    var guard = 0;
    while (S.starPickups.length < 3 && guard++ < 200) {
      var sx = (Math.random() * n) | 0, sy = (Math.random() * n) | 0;
      var key = sx + "," + sy;
      if (taken[key]) continue;
      taken[key] = true;
      S.starPickups.push({ x: sx + 0.5, y: sy + 0.5, got: false, spin: Math.random() * 6.28 });
    }

    elLevel.textContent = String(level);
    resize();
  }

  /* ----------------------------------------------------------- sizing */

  function resize() {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // The 0.4 leaves room for the outer walls, which straddle the edge.
    C = Math.min(w / (S.cols + 0.4), h / (S.rows + 0.4));
    ox = (w - C * S.cols) / 2;
    oy = (h - C * S.rows) / 2;
  }

  var px = function (x) { return ox + x * C; };
  var py = function (y) { return oy + y * C; };

  if (window.ResizeObserver) {
    new ResizeObserver(resize).observe(canvas);
  } else {
    window.addEventListener("resize", resize);
  }
  window.addEventListener("orientationchange", function () { setTimeout(resize, 250); });

  /* ------------------------------------------------------------ audio */

  var audio = null, muted = store("mazecar.muted") === "1";
  var soundBtn = document.getElementById("soundBtn");
  soundBtn.textContent = muted ? "🔇" : "🔊";

  function ac() {
    // iOS only allows an AudioContext to start inside a user gesture, so
    // this is called first from the Drive! button.
    if (!audio) {
      var Ctor = window.AudioContext || window.webkitAudioContext;
      if (Ctor) audio = new Ctor();
    }
    if (audio && audio.state === "suspended") audio.resume();
    return audio;
  }

  function tone(freq, when, dur, type, gain) {
    var a = ac();
    if (!a || muted) return;
    var t0 = a.currentTime + (when || 0);
    var osc = a.createOscillator(), g = a.createGain();
    osc.type = type || "triangle";
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.18, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(a.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  var lastBump = 0;
  function sfxBump() {
    var now = performance.now();
    if (now - lastBump < 180) return;   // scraping a wall shouldn't machine-gun
    lastBump = now;
    tone(90, 0, 0.07, "square", 0.07);
  }
  function sfxStar() {
    tone(880, 0, 0.09);
    tone(1320, 0.07, 0.12);
  }
  function sfxWin() {
    [523, 659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.11, 0.34); });
  }
  function sfxHorn() {
    tone(392, 0, 0.18, "sawtooth", 0.12);
    tone(494, 0, 0.18, "sawtooth", 0.10);
  }

  soundBtn.addEventListener("click", function () {
    muted = !muted;
    soundBtn.textContent = muted ? "🔇" : "🔊";
    store("mazecar.muted", muted ? "1" : "0");
    if (!muted) sfxHorn();
  });

  /* ------------------------------------------------------------ input */

  // Three sources, each holding its own direction; the most recent one to
  // be pressed wins, so a thumb on the canvas overrides a stuck key.
  var padDir = null, keyDir = null, dragDir = null;

  function wanted() {
    var d = dragDir || padDir || keyDir;
    if (d === "up")    return { x: 0, y: -1 };
    if (d === "down")  return { x: 0, y: 1 };
    if (d === "left")  return { x: -1, y: 0 };
    if (d === "right") return { x: 1, y: 0 };
    return null;
  }

  var pad = document.getElementById("pad");
  var padHeld = {};   // pointerId -> button, so a slid thumb still releases

  pad.addEventListener("pointerdown", function (e) {
    var btn = e.target.closest("button");
    if (!btn) return;
    e.preventDefault();
    if (btn.hasAttribute("data-horn")) { ac(); sfxHorn(); return; }
    padHeld[e.pointerId] = btn;
    btn.classList.add("on");
    padDir = btn.getAttribute("data-dir");
    if (btn.setPointerCapture) btn.setPointerCapture(e.pointerId);
  });

  function releasePad(e) {
    var btn = padHeld[e.pointerId];
    if (!btn) return;
    delete padHeld[e.pointerId];
    btn.classList.remove("on");
    if (padDir === btn.getAttribute("data-dir")) padDir = null;
    // Another finger may still be down on a different arrow.
    for (var id in padHeld) { padDir = padHeld[id].getAttribute("data-dir"); }
  }
  pad.addEventListener("pointerup", releasePad);
  pad.addEventListener("pointercancel", releasePad);
  pad.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  var KEYS = {
    ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
    w: "up", s: "down", a: "left", d: "right",
    W: "up", S: "down", A: "left", D: "right"
  };
  var keysDown = [];
  window.addEventListener("keydown", function (e) {
    var d = KEYS[e.key];
    if (!d) return;
    e.preventDefault();
    if (keysDown.indexOf(d) < 0) keysDown.push(d);
    keyDir = keysDown[keysDown.length - 1];
  });
  window.addEventListener("keyup", function (e) {
    var d = KEYS[e.key];
    if (!d) return;
    var i = keysDown.indexOf(d);
    if (i >= 0) keysDown.splice(i, 1);
    keyDir = keysDown.length ? keysDown[keysDown.length - 1] : null;
  });

  // Drag anywhere on the maze: the car drives toward your finger, snapped
  // to the nearest of the four directions so corridors stay easy.
  var dragId = null;
  function dragTo(e) {
    var r = canvas.getBoundingClientRect();
    var dx = (e.clientX - r.left) - px(S.car.x);
    var dy = (e.clientY - r.top) - py(S.car.y);
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) { dragDir = null; return; }
    dragDir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left")
                                          : (dy > 0 ? "down" : "up");
  }
  canvas.addEventListener("pointerdown", function (e) {
    if (S.mode !== "play") return;
    dragId = e.pointerId;
    if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
    dragTo(e);
  });
  canvas.addEventListener("pointermove", function (e) {
    if (e.pointerId === dragId) dragTo(e);
  });
  function endDrag(e) {
    if (e.pointerId !== dragId) return;
    dragId = null; dragDir = null;
  }
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  /* --------------------------------------------------------- physics */

  // Circle vs rectangle, resolved on a single axis at a time. Moving x and
  // y separately is what gives the car its slide along a wall instead of
  // catching on it — the difference between fun and frustrating.
  function resolve(axis) {
    var car = S.car, hit = false;
    for (var i = 0; i < S.walls.length; i++) {
      var w = S.walls[i];
      // Cheap reject before the real test.
      if (car.x + CAR_R < w.x0 || car.x - CAR_R > w.x1) continue;
      if (car.y + CAR_R < w.y0 || car.y - CAR_R > w.y1) continue;

      var nx = Math.max(w.x0, Math.min(car.x, w.x1));
      var ny = Math.max(w.y0, Math.min(car.y, w.y1));
      var dx = car.x - nx, dy = car.y - ny;
      var d2 = dx * dx + dy * dy;
      if (d2 >= CAR_R * CAR_R) continue;

      hit = true;
      if (axis === "x") {
        car.x = car.x < (w.x0 + w.x1) / 2 ? w.x0 - CAR_R : w.x1 + CAR_R;
        car.vx = 0;
      } else {
        car.y = car.y < (w.y0 + w.y1) / 2 ? w.y0 - CAR_R : w.y1 + CAR_R;
        car.vy = 0;
      }
    }
    return hit;
  }

  function step(dt) {
    var car = S.car, dir = wanted();

    if (dir) {
      car.vx += dir.x * ACCEL * dt;
      car.vy += dir.y * ACCEL * dt;
      // Lane centring. Driving across a corridor and clipping the corner
      // of every junction is the classic way a maze game feels bad, so on
      // the axis you are not travelling along, ease toward the lane centre.
      var k = Math.min(1, CENTRING * dt);
      if (dir.x) { car.y += (Math.floor(car.y) + 0.5 - car.y) * k; car.vy = 0; }
      if (dir.y) { car.x += (Math.floor(car.x) + 0.5 - car.x) * k; car.vx = 0; }
    } else {
      var damp = Math.max(0, 1 - DRAG * dt);
      car.vx *= damp; car.vy *= damp;
    }

    var spd = Math.hypot(car.vx, car.vy);
    if (spd > MAX_SPD) { car.vx *= MAX_SPD / spd; car.vy *= MAX_SPD / spd; }

    car.x += car.vx * dt; if (resolve("x")) sfxBump();
    car.y += car.vy * dt; if (resolve("y")) sfxBump();

    // Point the car where it is actually going, turning the short way.
    if (spd > 0.25) {
      var target = Math.atan2(car.vy, car.vx);
      var diff = ((target - car.angle + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      car.angle += diff * Math.min(1, 16 * dt);
    }

    for (var i = 0; i < S.starPickups.length; i++) {
      var s = S.starPickups[i];
      s.spin += dt * 2;
      if (s.got) continue;
      if (Math.hypot(s.x - car.x, s.y - car.y) < 0.42) {
        s.got = true;
        S.stars++;
        elStars.textContent = String(S.stars);
        store("mazecar.stars", String(S.stars));
        sfxStar();
      }
    }

    if (Math.hypot(S.cols - 0.5 - car.x, S.rows - 0.5 - car.y) < 0.4) win();
  }

  function win() {
    S.mode = "won";
    S.wonAt = performance.now();
    sfxWin();
    for (var i = 0; i < 110; i++) {
      S.confetti.push({
        x: px(S.cols - 0.5), y: py(S.rows - 0.5),
        vx: (Math.random() - 0.5) * 620,
        vy: -Math.random() * 620 - 90,
        rot: Math.random() * 6.28,
        vr: (Math.random() - 0.5) * 14,
        size: 5 + Math.random() * 7,
        hue: (Math.random() * 360) | 0
      });
    }
    var got = S.starPickups.filter(function (s) { return s.got; }).length;
    winTitle.textContent = got === 3 ? "All three stars! 🌟" : "You parked it! 🎉";
    winText.textContent = got === 3
      ? "Perfect run. The next maze is a little bigger."
      : "You found " + got + " of 3 stars. The next maze is a little bigger.";
    // Let the confetti fly for a beat before the button covers it.
    setTimeout(function () { if (S.mode === "won") winCard.hidden = false; }, 900);
  }

  /* ---------------------------------------------------------- drawing */

  // Safari only grew roundRect in 16; older iPads are common hand-me-downs.
  function roundRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawFloor() {
    roundRect(px(0) - C * 0.1, py(0) - C * 0.1,
              C * S.cols + C * 0.2, C * S.rows + C * 0.2, C * 0.2);
    ctx.fillStyle = "#1a2338";
    ctx.fill();

    // Faint tarmac checker so motion is readable even in a bare corridor.
    ctx.fillStyle = "rgba(255,255,255,0.018)";
    for (var y = 0; y < S.rows; y++) {
      for (var x = 0; x < S.cols; x++) {
        if ((x + y) % 2) ctx.fillRect(px(x), py(y), C, C);
      }
    }
  }

  function drawGoal() {
    var gx = px(S.cols - 1), gy = py(S.rows - 1);
    var n = 4, s = C / n;
    ctx.save();
    roundRect(gx + C * 0.08, gy + C * 0.08, C * 0.84, C * 0.84, C * 0.14);
    ctx.clip();
    ctx.fillStyle = "rgba(255,196,71,0.22)";
    ctx.fillRect(gx, gy, C, C);
    ctx.fillStyle = "rgba(255,196,71,0.55)";
    for (var y = 0; y < n; y++) {
      for (var x = 0; x < n; x++) {
        if ((x + y) % 2) ctx.fillRect(gx + x * s, gy + y * s, s, s);
      }
    }
    ctx.restore();

    // A gentle pulse to say "over here".
    var pulse = 0.5 + 0.5 * Math.sin(performance.now() / 420);
    ctx.strokeStyle = "rgba(255,196,71," + (0.35 + pulse * 0.5) + ")";
    ctx.lineWidth = Math.max(2, C * 0.05);
    roundRect(gx + C * 0.08, gy + C * 0.08, C * 0.84, C * 0.84, C * 0.14);
    ctx.stroke();

    ctx.font = "600 " + (C * 0.3) + "px " + getComputedStyle(document.body).fontFamily;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillText("🏁", gx + C / 2, gy + C / 2);
  }

  function drawStars() {
    for (var i = 0; i < S.starPickups.length; i++) {
      var s = S.starPickups[i];
      if (s.got) continue;
      var bob = Math.sin(s.spin) * C * 0.05;
      ctx.save();
      ctx.translate(px(s.x), py(s.y) + bob);
      ctx.rotate(Math.sin(s.spin * 0.5) * 0.3);
      ctx.beginPath();
      var R = C * 0.2;
      for (var k = 0; k < 10; k++) {
        var rad = k % 2 ? R * 0.45 : R;
        var ang = -Math.PI / 2 + k * Math.PI / 5;
        ctx[k ? "lineTo" : "moveTo"](Math.cos(ang) * rad, Math.sin(ang) * rad);
      }
      ctx.closePath();
      ctx.fillStyle = "#ffc447";
      ctx.shadowColor = "rgba(255,196,71,0.6)";
      ctx.shadowBlur = C * 0.25;
      ctx.fill();
      ctx.restore();
    }
  }

  function drawWalls() {
    var r = Math.max(2, C * WALL_T * 0.45);
    for (var i = 0; i < S.walls.length; i++) {
      var w = S.walls[i];
      var x = px(w.x0), y = py(w.y0);
      var ww = (w.x1 - w.x0) * C, hh = (w.y1 - w.y0) * C;
      roundRect(x, y + Math.max(1.5, C * 0.03), ww, hh, r);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fill();
      roundRect(x, y, ww, hh, r);
      ctx.fillStyle = "#3e8f5e";
      ctx.fill();
      roundRect(x + ww * 0.06, y + hh * 0.06, ww * 0.88, hh * 0.35, r * 0.6);
      ctx.fillStyle = "rgba(126,224,129,0.55)";
      ctx.fill();
    }
  }

  function drawCar() {
    var car = S.car;
    var L = C * 0.62, W = C * 0.44;
    var moving = Math.hypot(car.vx, car.vy) > 0.3;

    ctx.save();
    ctx.translate(px(car.x), py(car.y));

    // Shadow stays put on the ground while the body rotates above it.
    ctx.save();
    ctx.rotate(car.angle);
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    roundRect(-L / 2, -W / 2 + C * 0.06, L, W, W * 0.32);
    ctx.fill();
    ctx.restore();

    ctx.rotate(car.angle);

    if (moving) {  // headlight wash
      var grd = ctx.createLinearGradient(L * 0.4, 0, L * 1.5, 0);
      grd.addColorStop(0, "rgba(255,247,200,0.30)");
      grd.addColorStop(1, "rgba(255,247,200,0)");
      ctx.beginPath();
      ctx.moveTo(L * 0.4, -W * 0.34);
      ctx.lineTo(L * 1.55, -W * 0.95);
      ctx.lineTo(L * 1.55, W * 0.95);
      ctx.lineTo(L * 0.4, W * 0.34);
      ctx.closePath();
      ctx.fillStyle = grd;
      ctx.fill();
    }

    // Wheels first, so the body sits on top of them.
    ctx.fillStyle = "#11161f";
    [-1, 1].forEach(function (sy) {
      roundRect(-L * 0.30, sy * W * 0.5 - W * 0.14, L * 0.24, W * 0.2, W * 0.08);
      ctx.fill();
      roundRect(L * 0.08, sy * W * 0.5 - W * 0.14, L * 0.24, W * 0.2, W * 0.08);
      ctx.fill();
    });

    roundRect(-L / 2, -W / 2, L, W, W * 0.3);
    ctx.fillStyle = S.color.body;
    ctx.fill();
    ctx.lineWidth = Math.max(1, C * 0.02);
    ctx.strokeStyle = S.color.dark;
    ctx.stroke();

    // Windscreen and roof.
    roundRect(-L * 0.16, -W * 0.32, L * 0.30, W * 0.64, W * 0.14);
    ctx.fillStyle = "rgba(230,245,255,0.85)";
    ctx.fill();
    roundRect(-L * 0.40, -W * 0.30, L * 0.20, W * 0.60, W * 0.12);
    ctx.fillStyle = S.color.dark;
    ctx.fill();

    // Headlights.
    ctx.fillStyle = "#fff7c8";
    [-1, 1].forEach(function (sy) {
      roundRect(L * 0.40, sy * W * 0.28 - W * 0.09, L * 0.08, W * 0.18, W * 0.06);
      ctx.fill();
    });

    ctx.restore();
  }

  function drawConfetti(dt) {
    for (var i = S.confetti.length - 1; i >= 0; i--) {
      var p = S.confetti[i];
      p.vy += 1400 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.y > canvas.clientHeight + 40) { S.confetti.splice(i, 1); continue; }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = "hsl(" + p.hue + ",90%,62%)";
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
  }

  function draw(dt) {
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    drawFloor();
    drawGoal();
    drawStars();
    drawWalls();
    drawCar();
    if (S.confetti.length) drawConfetti(dt);
  }

  /* ------------------------------------------------------------- loop */

  var last = 0;
  function frame(t) {
    var dt = last ? Math.min(0.033, (t - last) / 1000) : 0;
    last = t;
    if (S.mode === "play") step(dt);
    draw(dt);
    requestAnimationFrame(frame);
  }

  document.addEventListener("visibilitychange", function () {
    // Coming back from a locked screen should not teleport the car.
    if (!document.hidden) last = 0;
  });

  /* ------------------------------------------------------------- flow */

  var colorPick = document.getElementById("colorPick");
  var savedColor = store("mazecar.color");
  CAR_COLORS.forEach(function (c) {
    var b = document.createElement("button");
    b.type = "button";
    b.style.background = c.body;
    b.setAttribute("aria-label", c.name + " car");
    b.setAttribute("aria-pressed", String(c.name === savedColor));
    if (c.name === savedColor) S.color = c;
    b.addEventListener("click", function () {
      S.color = c;
      store("mazecar.color", c.name);
      Array.prototype.forEach.call(colorPick.children, function (o) {
        o.setAttribute("aria-pressed", String(o === b));
      });
    });
    colorPick.appendChild(b);
  });
  if (!savedColor) colorPick.firstChild.setAttribute("aria-pressed", "true");

  document.getElementById("startBtn").addEventListener("click", function () {
    ac();                       // unlock audio inside the gesture
    titleCard.hidden = true;
    S.mode = "play";
  });

  document.getElementById("nextBtn").addEventListener("click", function () {
    S.level++;
    store("mazecar.level", String(S.level));
    winCard.hidden = true;
    newLevel(S.level);
    S.mode = "play";
  });

  document.getElementById("newBtn").addEventListener("click", function () {
    winCard.hidden = true;
    newLevel(S.level);
    S.mode = S.mode === "title" ? "title" : "play";
  });

  // Pick up where they left off; a kid closing the tab shouldn't lose
  // their maze count or their star total.
  var savedLevel = parseInt(store("mazecar.level") || "1", 10);
  var savedStars = parseInt(store("mazecar.stars") || "0", 10);
  S.level = savedLevel > 0 ? savedLevel : 1;
  S.stars = savedStars > 0 ? savedStars : 0;
  elStars.textContent = String(S.stars);

  newLevel(S.level);
  requestAnimationFrame(frame);
})();
