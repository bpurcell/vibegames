/* =====================================================================
   Spooky Forest 2 — walking deeper in, in black and white.

   Where the first game was a fixed scene you tapped at, this one is a
   first-person walk: the camera moves forward at a steady pace and the
   trees sweep past on both sides. Things step out from behind them and
   you peg them with a pumpkin before you walk by.

   How the 3D works — there is no 3D library here, just one divide:

     scale = focal / z      (z = metres ahead of the camera)

   Everything in the world is stored in metres as (x, height, z). The
   camera sits at the origin looking down +z, so "walking" is simply
   subtracting from every object's z, and anything that falls behind the
   near plane is recycled out to the far plane with a new random shape.
   That keeps the object count fixed and the frame time flat.

   Depth is carried by VALUE rather than colour, which is the whole trick
   to making a greyscale scene readable: distant trees are painted the
   same grey as the mist and dissolve into it, near ones are pure black.
   The monsters ignore the fog and stay white, because a thing you have
   to tap must never be the same shade as the thing behind it.
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

  var ROUND = 45;
  var KINDS = ["reaper", "skeleton", "witch", "scarecrow", "watcher"];

  // World constants, all in metres.
  var EYE = 1.62;            // camera height
  var NEAR = 1.4, FAR = 52;
  var PATH = 2.5;            // half-width of the clear path
  var TREES = 34, SPECKS = 120, WISPS = 26;

  var S = {
    mode: "title",
    score: 0, missed: 0, best: 0,
    time: ROUND,
    walked: 0,
    trees: [], specks: [], wisps: [], monsters: [], pumpkins: [], fx: [],
    spawnIn: 1.0,
    spot: false                // spot colour: the pumpkins go orange
  };

  var W = 0, H = 0, dpr = 1, cx = 0, horizon = 0, focal = 600;
  var T = 0, bob = 0;
  var bg = document.createElement("canvas");
  var grain = document.createElement("canvas");
  var grainSheet = document.createElement("canvas");
  var vigCanvas = document.createElement("canvas");
  // One soft white blob, drawn once and then stretched wherever a glow is
  // wanted. Building a fresh radial gradient for every wisp on every frame
  // is what took this from a smooth walk to ten frames a second.
  var blob = document.createElement("canvas");

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) { /* private browsing */ }
    return null;
  }

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ------------------------------------------------------- projection */

  function scaleAt(z) { return focal / Math.max(z, 0.35); }
  function sx(x, z, s) { return cx + x * (s || scaleAt(z)); }
  function sy(h, z, s) { return horizon + bob + (EYE - h) * (s || scaleAt(z)); }

  // Turn a tap back into a point in the world, so a pumpkin thrown at
  // nothing still flies somewhere sensible instead of at the screen.
  function unproject(px, py, z) {
    var s = scaleAt(z);
    return { x: (px - cx) / s, h: EYE - (py - horizon - bob) / s, z: z };
  }

  // How grey a thing is at this distance. Near black, far mist.
  function fogShade(z) {
    var t = clamp(Math.pow(clamp(z / FAR, 0, 1), 0.75), 0, 1);
    var v = Math.round(lerp(4, 196, t));
    return "rgb(" + v + "," + v + "," + v + ")";
  }
  function fogAlpha(z) { return clamp((FAR - z) / 10, 0, 1); }

  /* ------------------------------------------------------------ trees */

  // A tree is a list of line segments in local metres, grouped by how deep
  // in the branching they are so each group can be stroked in one path at
  // one width — 4 stroke calls a tree instead of thirty.
  function growTree() {
    var height = 5.5 + Math.random() * 4;
    var levels = [[], [], [], []];
    (function branch(x, y, ang, len, depth) {
      var x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
      levels[depth].push([x, y, x2, y2]);
      if (depth >= 3) return;
      var n = Math.random() < 0.25 ? 3 : 2;
      for (var i = 0; i < n; i++) {
        var spread = (i - (n - 1) / 2) * (0.5 + Math.random() * 0.5);
        branch(x2, y2, ang + spread + (Math.random() - 0.5) * 0.3,
               len * (0.58 + Math.random() * 0.22), depth + 1);
      }
    })(0, 0, Math.PI / -2 + (Math.random() - 0.5) * 0.24, height * 0.46, 0);
    return { levels: levels, w: 0.20 + Math.random() * 0.16, height: height };
  }

  function placeTree(t, z) {
    var side = Math.random() < 0.5 ? -1 : 1;
    t.x = side * (PATH + Math.random() * Math.random() * 12);
    t.z = z;
    var g = growTree();
    t.levels = g.levels; t.w = g.w; t.height = g.height;
    return t;
  }

  function seedWorld() {
    S.trees = [];
    for (var i = 0; i < TREES; i++) {
      S.trees.push(placeTree({}, NEAR + (i / TREES) * (FAR - NEAR) + Math.random()));
    }
    S.specks = [];
    for (var j = 0; j < SPECKS; j++) {
      S.specks.push({
        x: (Math.random() - 0.5) * 22,
        z: NEAR + Math.random() * (FAR - NEAR),
        r: 0.05 + Math.random() * 0.15
      });
    }
    // Mist lying on the forest floor. The near ones blow up huge and sweep
    // past the bottom of the frame, which is what sells the walking more
    // than anything else on screen.
    S.wisps = [];
    for (var k = 0; k < WISPS; k++) {
      S.wisps.push({
        x: (Math.random() - 0.5) * 20,
        z: NEAR + Math.random() * (FAR - NEAR),
        w: 2.5 + Math.random() * 5,
        h: 0.25 + Math.random() * 0.5,
        a: 0.10 + Math.random() * 0.13
      });
    }
  }

  function drawTree(t) {
    var s = scaleAt(t.z);
    if (s <= 0) return;
    var px = cx + t.x * s, base = sy(0, t.z, s);
    ctx.strokeStyle = fogShade(t.z);
    ctx.globalAlpha = fogAlpha(t.z);
    ctx.lineCap = "round";
    for (var d = 0; d < t.levels.length; d++) {
      var segs = t.levels[d];
      if (!segs.length) continue;
      ctx.lineWidth = Math.max(0.6, t.w * Math.pow(0.56, d) * s);
      ctx.beginPath();
      for (var i = 0; i < segs.length; i++) {
        var g = segs[i];
        ctx.moveTo(px + g[0] * s, base + g[1] * s);
        ctx.lineTo(px + g[2] * s, base + g[3] * s);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* --------------------------------------------------------- monsters */

  function ramp(a, b) {
    var p = 1 - clamp(S.time, 0, ROUND) / ROUND;
    return a + (b - a) * p;
  }
  function walkSpeed() { return ramp(4.2, 7.6); }

  function spawnMonster() {
    // Step out from behind a tree that is far enough ahead to give the
    // player a few seconds, and near enough to the path to be seen.
    var cands = S.trees.filter(function (t) {
      return t.z > 16 && t.z < 30 && Math.abs(t.x) < PATH + 2.4;
    });
    if (!cands.length) return;
    var t = cands[(Math.random() * cands.length) | 0];
    if (S.monsters.some(function (m) { return m.tree === t; })) return;
    var kind = KINDS[(Math.random() * KINDS.length) | 0];
    S.monsters.push({
      tree: t,
      kind: kind,
      kindH: FIGURES[kind].h,
      // Step INTO the path. Stepping outward walks them straight off the
      // side of the frame as you close on them, which is both harder to
      // tap and far less alarming than something moving into your way.
      side: t.x < 0 ? 1 : -1,
      p: 0,
      claimed: false,
      wob: Math.random() * 6.28
    });
  }

  function mpos(m) {
    var e = m.p * m.p * (3 - 2 * m.p);                  // smoothstep
    var z = m.tree.z;
    var s = scaleAt(z);
    return {
      x: m.tree.x + m.side * 1.05 * e,
      z: z, s: s,
      px: cx + (m.tree.x + m.side * 1.05 * e) * s,
      py: sy(0, z, s),                                   // feet on the ground
      h: 2.0 * (0.55 + 0.45 * e)
    };
  }

  function hitRadius(m) {
    var pos = mpos(m);
    return Math.max(pos.s * 0.85, 34);
  }

  function stepMonsters(dt) {
    for (var i = S.monsters.length - 1; i >= 0; i--) {
      var m = S.monsters[i];
      if (m.p < 1) m.p = Math.min(1, m.p + dt / 0.45);

      // You walk past it — that is the only way one gets away, and it is
      // the walking that does it, not a hidden timer.
      if (m.claimed) continue;
      var gone = m.tree.z < 3.2;
      if (!gone && m.p > 0.9) {
        var px = mpos(m).px;
        gone = px < -W * 0.25 || px > W * 1.25;          // swept off the side
      }
      if (gone) { S.monsters.splice(i, 1); S.missed++; }
    }

    S.spawnIn -= dt;
    if (S.spawnIn <= 0) {
      S.spawnIn = ramp(1.5, 0.62) * (0.8 + Math.random() * 0.4);
      if (S.monsters.length < Math.round(ramp(2, 4))) spawnMonster();
    }
  }

  /* --------------------------------------------------------- throwing */

  function launch(target, at) {
    if (S.pumpkins.length > 5) return;
    S.pumpkins.push({
      from: { x: 0, h: 0.9, z: 0.55 },
      to: at, target: target || null,
      t: 0, dur: 0.42, spin: (Math.random() < 0.5 ? -1 : 1) * 9
    });
    if (target) target.claimed = true;
    sfxThrow();
  }

  function stepPumpkins(dt) {
    for (var i = S.pumpkins.length - 1; i >= 0; i--) {
      var p = S.pumpkins[i];
      p.t += dt;
      var m = p.target;
      if (m && S.monsters.indexOf(m) >= 0) {
        var pos = mpos(m);
        p.to = { x: pos.x, h: 1.05, z: pos.z };
      }
      // A claimed monster you are about to walk past is hit now rather
      // than lost on a technicality.
      var arrived = p.t >= p.dur || (m && p.to && p.to.z < 2.6);
      if (!arrived) continue;

      S.pumpkins.splice(i, 1);
      if (m && S.monsters.indexOf(m) >= 0) {
        var at = mpos(m);
        S.monsters.splice(S.monsters.indexOf(m), 1);
        S.score++;
        elScore.textContent = String(S.score);
        poof(at.px, at.py - at.s * 1.0, at.s);
        S.fx.push({ type: "float", x: at.px, y: at.py - at.s * 1.4, t: 0 });
        sfxHit();
      } else if (p.to) {
        var s = scaleAt(p.to.z);
        poof(cx + p.to.x * s, sy(p.to.h, p.to.z, s), s * 0.5);
        sfxSplat();
      }
    }
  }

  function poof(x, y, s) {
    for (var i = 0; i < 14; i++) {
      var a = Math.random() * 6.28, sp = s * (0.5 + Math.random() * 1.4);
      S.fx.push({
        type: "bit", x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - s * 0.4,
        t: 0, life: 0.45 + Math.random() * 0.35,
        r: s * (0.05 + Math.random() * 0.13)
      });
    }
  }

  function stepFx(dt) {
    for (var i = S.fx.length - 1; i >= 0; i--) {
      var f = S.fx[i];
      f.t += dt;
      if (f.type === "bit") {
        f.x += f.vx * dt; f.y += f.vy * dt; f.vy -= f.r * 2 * dt;  // smoke rises
        if (f.t > f.life) S.fx.splice(i, 1);
      } else if (f.t > 0.8) S.fx.splice(i, 1);
    }
  }

  canvas.addEventListener("pointerdown", function (e) {
    if (S.mode !== "play") return;
    e.preventDefault();
    var r = canvas.getBoundingClientRect();
    var x = e.clientX - r.left, y = e.clientY - r.top;

    // Nearest monster first: it is the one drawn on top, and the one the
    // player is about to lose.
    var order = S.monsters.slice().sort(function (a, b) { return a.tree.z - b.tree.z; });
    for (var i = 0; i < order.length; i++) {
      var m = order[i];
      if (m.claimed || m.p < 0.25) continue;
      var pos = mpos(m);
      var cxm = pos.px, cym = pos.py - pos.s * m.kindH * 0.5;
      if (Math.hypot(x - cxm, y - cym) <= hitRadius(m)) {
        launch(m, { x: pos.x, h: 1.05, z: pos.z });
        return;
      }
    }
    launch(null, unproject(x, y, 11));
  });
  canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  /* ------------------------------------------------------- characters */

  // Each figure is drawn with its feet at the origin and u = pixels per
  // metre, so the same code works at any distance. White bodies, black
  // holes for faces: at a glance that is what reads as "spooky" in
  // greyscale, and it stays legible when the figure is 20px tall.
  var PAPER = "#f2f2f2", INK = "#080808";

  function drawReaper(u, wob) {
    var sway = Math.sin(wob + T * 2) * 0.04;
    ctx.fillStyle = PAPER;
    ctx.beginPath();
    ctx.moveTo(-0.52 * u, 0);
    ctx.quadraticCurveTo(-0.46 * u + sway * u, -1.2 * u, -0.30 * u + sway * u, -1.66 * u);
    ctx.quadraticCurveTo(-0.30 * u + sway * u, -2.08 * u, 0 + sway * u, -2.08 * u);
    ctx.quadraticCurveTo(0.30 * u + sway * u, -2.08 * u, 0.30 * u + sway * u, -1.66 * u);
    ctx.quadraticCurveTo(0.46 * u + sway * u, -1.2 * u, 0.52 * u, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = INK;                                  // the empty hood
    ctx.beginPath();
    ctx.ellipse(sway * u, -1.72 * u, 0.19 * u, 0.25 * u, 0, 0, 6.284);
    ctx.fill();
    ctx.fillStyle = PAPER;
    ctx.beginPath(); ctx.arc(sway * u - 0.07 * u, -1.76 * u, 0.045 * u, 0, 6.284); ctx.fill();
    ctx.beginPath(); ctx.arc(sway * u + 0.07 * u, -1.76 * u, 0.045 * u, 0, 6.284); ctx.fill();
  }

  function drawSkeleton(u, wob) {
    var b = Math.sin(wob + T * 3) * 0.03 * u;
    ctx.strokeStyle = PAPER; ctx.fillStyle = PAPER;
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(1, 0.09 * u);
    ctx.beginPath();                                      // legs and spine
    ctx.moveTo(-0.16 * u, 0); ctx.lineTo(-0.10 * u, -0.62 * u);
    ctx.moveTo(0.16 * u, 0); ctx.lineTo(0.10 * u, -0.62 * u);
    ctx.moveTo(0, -0.62 * u); ctx.lineTo(0, -1.32 * u);
    ctx.moveTo(-0.30 * u, -0.78 * u + b); ctx.lineTo(-0.02 * u, -1.24 * u);
    ctx.moveTo(0.30 * u, -0.78 * u - b); ctx.lineTo(0.02 * u, -1.24 * u);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, 0.07 * u);
    ctx.beginPath();                                      // ribs
    for (var i = 0; i < 3; i++) {
      var y = -0.86 * u - i * 0.15 * u;
      ctx.moveTo(-0.19 * u, y); ctx.lineTo(0.19 * u, y);
    }
    ctx.stroke();
    ctx.beginPath();                                      // skull
    ctx.arc(0, -1.50 * u, 0.26 * u, 0, 6.284); ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.ellipse(-0.10 * u, -1.54 * u, 0.07 * u, 0.09 * u, 0, 0, 6.284); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0.10 * u, -1.54 * u, 0.07 * u, 0.09 * u, 0, 0, 6.284); ctx.fill();
    ctx.fillRect(-0.12 * u, -1.36 * u, 0.24 * u, 0.05 * u);
  }

  function drawWitch(u, wob) {
    var sway = Math.sin(wob + T * 1.7) * 0.05;
    ctx.save();
    ctx.translate(sway * u, 0);
    ctx.fillStyle = PAPER;
    ctx.beginPath();                                      // robe
    ctx.moveTo(-0.50 * u, 0);
    ctx.quadraticCurveTo(-0.22 * u, -1.1 * u, -0.20 * u, -1.42 * u);
    ctx.lineTo(0.20 * u, -1.42 * u);
    ctx.quadraticCurveTo(0.22 * u, -1.1 * u, 0.50 * u, 0);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();                                      // head
    ctx.arc(0, -1.56 * u, 0.20 * u, 0, 6.284); ctx.fill();
    ctx.beginPath();                                      // hooked nose
    ctx.moveTo(0.14 * u, -1.58 * u);
    ctx.lineTo(0.36 * u, -1.48 * u);
    ctx.lineTo(0.14 * u, -1.44 * u);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();                                      // pointed hat
    ctx.moveTo(-0.40 * u, -1.70 * u);
    ctx.lineTo(0.40 * u, -1.70 * u);
    ctx.lineTo(-0.02 * u, -2.34 * u);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = INK;
    ctx.fillRect(-0.42 * u, -1.74 * u, 0.84 * u, 0.07 * u);
    ctx.beginPath(); ctx.arc(-0.06 * u, -1.60 * u, 0.045 * u, 0, 6.284); ctx.fill();
    ctx.beginPath(); ctx.arc(0.08 * u, -1.60 * u, 0.045 * u, 0, 6.284); ctx.fill();
    ctx.restore();
  }

  function drawScarecrow(u, wob) {
    var tilt = Math.sin(wob + T * 1.3) * 0.05;
    ctx.save();
    ctx.rotate(tilt);
    ctx.strokeStyle = PAPER;
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(1, 0.10 * u);
    ctx.beginPath();                                      // pole and crossbar
    ctx.moveTo(0, 0); ctx.lineTo(0, -1.5 * u);
    ctx.moveTo(-0.62 * u, -1.14 * u); ctx.lineTo(0.62 * u, -1.14 * u);
    ctx.stroke();
    ctx.fillStyle = PAPER;
    ctx.beginPath();                                      // ragged coat
    ctx.moveTo(-0.40 * u, -1.16 * u);
    ctx.lineTo(0.40 * u, -1.16 * u);
    ctx.lineTo(0.26 * u, -0.42 * u);
    ctx.lineTo(0.10 * u, -0.60 * u);
    ctx.lineTo(-0.04 * u, -0.38 * u);
    ctx.lineTo(-0.20 * u, -0.58 * u);
    ctx.lineTo(-0.30 * u, -0.44 * u);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();                                      // sack head
    ctx.ellipse(0, -1.52 * u, 0.25 * u, 0.28 * u, 0, 0, 6.284); ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1, 0.05 * u);
    ctx.beginPath();                                      // stitched X eyes
    [-0.10, 0.10].forEach(function (o) {
      ctx.moveTo(o * u - 0.05 * u, -1.60 * u); ctx.lineTo(o * u + 0.05 * u, -1.50 * u);
      ctx.moveTo(o * u + 0.05 * u, -1.60 * u); ctx.lineTo(o * u - 0.05 * u, -1.50 * u);
    });
    ctx.moveTo(-0.11 * u, -1.40 * u); ctx.lineTo(0.11 * u, -1.40 * u);
    for (var i = 0; i < 4; i++) {
      var mx = -0.09 * u + i * 0.06 * u;
      ctx.moveTo(mx, -1.44 * u); ctx.lineTo(mx, -1.36 * u);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawWatcher(u, wob) {
    var sway = Math.sin(wob + T * 1.1) * 0.06;
    ctx.fillStyle = PAPER;
    ctx.save();
    ctx.translate(sway * u, 0);
    ctx.beginPath();                                      // very long body
    ctx.moveTo(-0.17 * u, 0);
    ctx.lineTo(-0.20 * u, -2.10 * u);
    ctx.quadraticCurveTo(0, -2.46 * u, 0.20 * u, -2.10 * u);
    ctx.lineTo(0.17 * u, 0);
    ctx.closePath(); ctx.fill();
    ctx.lineCap = "round";
    ctx.strokeStyle = PAPER;
    ctx.lineWidth = Math.max(1, 0.08 * u);
    ctx.beginPath();                                      // arms past the knees
    ctx.moveTo(-0.18 * u, -1.86 * u);
    ctx.quadraticCurveTo(-0.44 * u, -1.2 * u, -0.34 * u, -0.34 * u);
    ctx.moveTo(0.18 * u, -1.86 * u);
    ctx.quadraticCurveTo(0.44 * u, -1.2 * u, 0.34 * u, -0.34 * u);
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.ellipse(-0.08 * u, -2.16 * u, 0.05 * u, 0.10 * u, 0, 0, 6.284); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0.08 * u, -2.16 * u, 0.05 * u, 0.10 * u, 0, 0, 6.284); ctx.fill();
    ctx.restore();
  }

  var FIGURES = {
    reaper: { draw: drawReaper, h: 2.1 },
    skeleton: { draw: drawSkeleton, h: 1.8 },
    witch: { draw: drawWitch, h: 2.3 },
    scarecrow: { draw: drawScarecrow, h: 1.8 },
    watcher: { draw: drawWatcher, h: 2.5 }
  };
  KINDS.forEach(function (k) { FIGURES[k].kind = k; });

  function drawMonster(m) {
    var pos = mpos(m);
    var fig = FIGURES[m.kind];
    var u = pos.s * (0.55 + 0.45 * (m.p * m.p * (3 - 2 * m.p)));
    if (u < 2) return;

    ctx.save();
    ctx.translate(pos.px, pos.py);
    // A soft halo so a white figure still separates from pale far mist.
    ctx.globalAlpha = 0.22;
    ctx.drawImage(blob, -u * 1.5, -fig.h * u * 0.5 - u * 1.5, u * 3, u * 3);
    ctx.globalAlpha = 1;
    fig.draw(u, m.wob);
    ctx.restore();
  }

  /* ---------------------------------------------------------- pumpkin */

  function drawPumpkin(x, y, r, rot) {
    if (r < 0.7) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    var body = S.spot ? "#ff8a1f" : "#dcdcdc";
    var rib = S.spot ? "rgba(120,50,0,0.6)" : "rgba(20,20,20,0.55)";
    ctx.fillStyle = S.spot ? "#2f7d32" : "#8a8a8a";
    ctx.fillRect(-r * 0.1, -r * 1.24, r * 0.2, r * 0.45);
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.88, 0, 0, 6.284); ctx.fill();
    ctx.strokeStyle = rib;
    ctx.lineWidth = Math.max(0.6, r * 0.12);
    [-0.45, 0, 0.45].forEach(function (o) {
      ctx.beginPath(); ctx.ellipse(o * r, 0, r * 0.24, r * 0.85, 0, 0, 6.284); ctx.stroke();
    });
    ctx.restore();
  }

  /* --------------------------------------------------------- backdrop */

  function paintBackground() {
    bg.width = canvas.width; bg.height = canvas.height;
    var c = bg.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Dark canopy above, bright moonlit mist at eye level, dark forest
    // floor below. Trees silhouette against the bright band.
    var sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#050505");
    sky.addColorStop(Math.max(0.01, horizon / H - 0.26), "#1c1c1c");
    sky.addColorStop(clamp(horizon / H, 0.02, 0.98), "#c6c6c6");
    sky.addColorStop(clamp(horizon / H + 0.14, 0.03, 0.99), "#3a3a3a");
    sky.addColorStop(1, "#121212");
    c.fillStyle = sky;
    c.fillRect(0, 0, W, H);

    var mr = Math.min(W, H) * 0.10;
    var mx = W * 0.28, my = horizon - Math.min(W, H) * 0.22;
    var glow = c.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 4);
    glow.addColorStop(0, "rgba(255,255,255,0.20)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = glow;
    c.beginPath(); c.arc(mx, my, mr * 4, 0, 6.284); c.fill();
    c.fillStyle = "#efefef";
    c.beginPath(); c.arc(mx, my, mr, 0, 6.284); c.fill();
    c.fillStyle = "rgba(150,150,150,0.5)";
    [[0.32, -0.2, 0.2], [-0.3, 0.22, 0.16], [0.1, 0.44, 0.1]].forEach(function (k) {
      c.beginPath(); c.arc(mx + k[0] * mr, my + k[1] * mr, k[2] * mr, 0, 6.284); c.fill();
    });
  }

  // A film-grain tile, built once and tiled over the frame at a random
  // offset. Greyscale without grain looks like a flat vector drawing.
  function makeBlob() {
    var n = 128;
    blob.width = n; blob.height = n;
    var c = blob.getContext("2d");
    var g = c.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.45, "rgba(255,255,255,0.45)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, n, n);
  }

  function paintVignette() {
    vigCanvas.width = canvas.width; vigCanvas.height = canvas.height;
    var c = vigCanvas.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    var g = c.createRadialGradient(cx, horizon, Math.min(W, H) * 0.28,
                                   cx, horizon, Math.max(W, H) * 0.85);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.55)");
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
  }

  function paintGrainSheet() {
    // Half resolution, scaled 2x on the way out: a quarter of the fill cost
    // and chunkier grain, which reads as film rather than digital noise.
    var gw = Math.ceil(W / 2) + 64, gh = Math.ceil(H / 2) + 64;
    if (gw < 2 || gh < 2) return;
    grainSheet.width = gw; grainSheet.height = gh;
    var c = grainSheet.getContext("2d");
    c.fillStyle = c.createPattern(grain, "repeat");
    c.fillRect(0, 0, gw, gh);
  }

  function makeGrain() {
    var n = 96;
    grain.width = n; grain.height = n;
    var c = grain.getContext("2d");
    var img = c.createImageData(n, n);
    for (var i = 0; i < n * n; i++) {
      var v = (Math.random() * 255) | 0;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  }

  /* ----------------------------------------------------------- layout */

  function layout() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    if (!W || !H) return;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = W / 2;
    horizon = H * 0.52;
    // Wide enough that trees sweep past the edges rather than crawling.
    focal = Math.max(W, H * 0.9) * 0.95;
    paintBackground();
    paintVignette();
    paintGrainSheet();
  }

  if (window.ResizeObserver) new ResizeObserver(layout).observe(canvas);
  else window.addEventListener("resize", layout);
  window.addEventListener("orientationchange", function () { setTimeout(layout, 250); });

  /* ----------------------------------------------------------- render */

  function draw(dt) {
    ctx.drawImage(bg, 0, 0, W, H);          // covers the frame; no clear needed

    // The trail you are walking. A plain ground plane leaves the bottom
    // third of the frame an empty black field; a trapezoid narrowing to
    // the vanishing point fills it and says "forward" on its own.
    (function () {
      var zN = 1.7, zF = 42, hw = 2.05;
      var sN = scaleAt(zN), sF = scaleAt(zF);
      var yN = sy(0, zN, sN), yF = sy(0, zF, sF);
      var g = ctx.createLinearGradient(0, yF, 0, yN);
      g.addColorStop(0, "rgba(190,190,190,0.30)");
      g.addColorStop(0.45, "rgba(150,150,150,0.14)");
      g.addColorStop(1, "rgba(120,120,120,0.05)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx - hw * sF, yF);
      ctx.lineTo(cx + hw * sF, yF);
      ctx.lineTo(cx + hw * sN, yN);
      ctx.lineTo(cx - hw * sN, yN);
      ctx.closePath();
      ctx.fill();
    })();

    // Ground litter first: it is the strongest cue that you are moving.
    S.specks.forEach(function (sp) {
      var s = scaleAt(sp.z);
      var r = sp.r * s;
      if (r < 0.4) return;
      ctx.globalAlpha = fogAlpha(sp.z) * 0.7;
      ctx.fillStyle = fogShade(sp.z);
      ctx.beginPath();
      ctx.ellipse(cx + sp.x * s, sy(0, sp.z, s), r * 1.6, r * 0.5, 0, 0, 6.284);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    S.wisps.forEach(function (wp) {
      var s = scaleAt(wp.z);
      var y = sy(wp.h * 0.5, wp.z, s);
      var rx = wp.w * s, ry = Math.max(wp.h * s, rx * 0.22);
      if (rx < 2) return;
      ctx.globalAlpha = wp.a;
      ctx.drawImage(blob, cx + wp.x * s - rx, y - ry, rx * 2, ry * 2);
    });
    ctx.globalAlpha = 1;

    // Far to near, so near trees paint over distant ones.
    var order = S.trees.slice().sort(function (a, b) { return b.z - a.z; });
    var mons = S.monsters.slice().sort(function (a, b) { return b.tree.z - a.tree.z; });
    var mi = 0;
    order.forEach(function (t) {
      while (mi < mons.length && mons[mi].tree.z > t.z) drawMonster(mons[mi++]);
      drawTree(t);
    });
    while (mi < mons.length) drawMonster(mons[mi++]);

    S.pumpkins.forEach(function (p) {
      var u = clamp(p.t / p.dur, 0, 1);
      var x = lerp(p.from.x, p.to.x, u);
      var h = lerp(p.from.h, p.to.h, u) + Math.sin(Math.PI * u) * 0.55;
      var z = lerp(p.from.z, p.to.z, u);
      var s = scaleAt(z);
      drawPumpkin(cx + x * s, sy(h, z, s), 0.22 * s, p.spin * p.t);
    });

    S.fx.forEach(function (f) {
      if (f.type === "bit") {
        ctx.globalAlpha = Math.max(0, 1 - f.t / f.life) * 0.9;
        ctx.fillStyle = "#e6e6e6";
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.284); ctx.fill();
      } else {
        ctx.globalAlpha = Math.max(0, 1 - f.t / 0.8);
        ctx.fillStyle = "#ffffff";
        ctx.font = "900 " + Math.max(14, W * 0.055) + "px " + getComputedStyle(document.body).fontFamily;
        ctx.textAlign = "center";
        ctx.fillText("+1", f.x, f.y - f.t * 40);
      }
      ctx.globalAlpha = 1;
    });

    // Grain, then a vignette to push the eye to the middle of the path.
    if (grainSheet.width > 1) {
      ctx.globalAlpha = 0.05;
      ctx.drawImage(grainSheet, -((Math.random() * 60) | 0), -((Math.random() * 60) | 0),
                    grainSheet.width * 2, grainSheet.height * 2);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(vigCanvas, 0, 0, W, H);
  }

  /* ------------------------------------------------------------ audio */

  var audio = null, muted = store("spooky2.muted") === "1";
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
    g.gain.exponentialRampToValueAtTime(gain || 0.14, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(a.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  function sfxThrow() { tone(560, 0, 0.15, "sine", 0.06, 260); }
  function sfxSplat() { tone(110, 0, 0.09, "square", 0.06); }
  function sfxHit() { tone(240, 0, 0.20, "sine", 0.12, 90); tone(700, 0, 0.08, "triangle", 0.07); }
  function sfxStep() { tone(70, 0, 0.07, "sine", 0.05); }
  function sfxTick() { tone(760, 0, 0.05, "sine", 0.08); }
  function sfxEnd() { [392, 330, 262].forEach(function (f, i) { tone(f, i * 0.16, 0.5, "sine", 0.12); }); }

  soundBtn.addEventListener("click", function () {
    muted = !muted;
    soundBtn.textContent = muted ? "🔇" : "🔊";
    store("spooky2.muted", muted ? "1" : "0");
    if (!muted) sfxHit();
  });

  var colorBtn = document.getElementById("colorBtn");
  function setSpot(on) {
    S.spot = on;
    colorBtn.textContent = on ? "🎃" : "B&W";
    store("spooky2.spot", on ? "1" : "0");
  }
  colorBtn.addEventListener("click", function () { setSpot(!S.spot); });

  /* -------------------------------------------------------------- flow */

  function setClock() {
    clockFill.style.transform = "scaleX(" + (clamp(S.time, 0, ROUND) / ROUND) + ")";
    clock.classList.toggle("low", S.time <= 10);
  }

  function startRound() {
    S.score = 0; S.missed = 0; S.time = ROUND; S.walked = 0;
    S.monsters = []; S.pumpkins = []; S.fx = [];
    S.spawnIn = 0.9;
    seedWorld();
    elScore.textContent = "0";
    setClock();
    titleCard.hidden = true; overCard.hidden = true; pauseCard.hidden = true;
    S.mode = "play";
  }

  function endRound() {
    S.mode = "over";
    S.pumpkins.forEach(function (p) {                     // thrown before the buzzer
      if (p.target && S.monsters.indexOf(p.target) >= 0) S.score++;
    });
    elScore.textContent = String(S.score);
    S.monsters = []; S.pumpkins = [];
    sfxEnd();
    if (S.score > S.best) { S.best = S.score; store("spooky2.best", String(S.best)); }
    elBest.textContent = String(S.best);
    document.getElementById("overScore").textContent = String(S.score);
    document.getElementById("overTitle").textContent =
      S.score === 0 ? "They all watched you go by" :
      S.score >= S.best ? "New best score" : "Out of the woods";
    document.getElementById("overText").textContent =
      "You walked " + Math.round(S.walked) + " metres into the forest" +
      (S.missed ? " and " + S.missed + " slipped back behind the trees." : ". Nothing escaped you.");
    overCard.hidden = false;
  }

  document.getElementById("startBtn").addEventListener("click", function () { ac(); startRound(); });
  document.getElementById("againBtn").addEventListener("click", function () { ac(); startRound(); });
  document.getElementById("resumeBtn").addEventListener("click", function () {
    pauseCard.hidden = true;
    S.mode = "play";
  });
  document.addEventListener("visibilitychange", function () {
    last = 0;
    if (document.hidden && S.mode === "play") { S.mode = "paused"; pauseCard.hidden = false; }
  });

  /* -------------------------------------------------------------- loop */

  var last = 0, lastTick = 99, stepPhase = 0;
  function frame(t) {
    var dt = last ? Math.min(0.033, (t - last) / 1000) : 0;
    last = t;
    T += dt;

    if (S.mode === "play") {
      var v = walkSpeed();
      var move = v * dt;
      S.walked += move;
      S.time -= dt;
      setClock();

      // Walk the world past the camera and recycle whatever falls behind.
      S.trees.forEach(function (tr) {
        tr.z -= move;
        if (tr.z < NEAR) placeTree(tr, FAR + Math.random() * 6);
      });
      S.specks.forEach(function (sp) {
        sp.z -= move;
        if (sp.z < NEAR) { sp.z = FAR + Math.random() * 6; sp.x = (Math.random() - 0.5) * 22; }
      });
      S.wisps.forEach(function (wp) {
        wp.z -= move;
        if (wp.z < NEAR) { wp.z = FAR + Math.random() * 6; wp.x = (Math.random() - 0.5) * 20; }
      });

      // Headbob and footfalls, tied to the actual pace.
      stepPhase += move / 0.85;
      bob = Math.sin(stepPhase * Math.PI) * (H * 0.006);
      if (stepPhase >= 1) { stepPhase -= 1; sfxStep(); }

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

  S.best = parseInt(store("spooky2.best") || "0", 10) || 0;
  elBest.textContent = String(S.best);
  setSpot(store("spooky2.spot") === "1");
  makeGrain();
  makeBlob();
  layout();
  seedWorld();
  setClock();
  requestAnimationFrame(frame);
})();
