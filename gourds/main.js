/* =====================================================================
   Gourd Garden — a procedural 3D gourd, rendered as pen and ink.

   The shape is a surface of revolution with its heart cut out: a profile
   curve is swept around a SPINE that is allowed to lean or crook, the
   radius is modulated around the circumference to cut ribs, and a scatter
   of Gaussian bumps makes warts. A tapered tube on top is the stem.

   The drawing is a painter's algorithm over a few thousand quads. Each
   quad is filled with the paper colour (which is what hides the back of
   the gourd), then hatched: a quad has a handful of hatch "slots" at fixed
   fractions of its width, and a slot is drawn only if the quad is darker
   than that slot's threshold. Because the slots sit at the same fractions
   in every quad, the strokes line up across quad boundaries into
   continuous lines running down the gourd — the hatching reads as pen
   strokes rather than tiles. A contour is drawn along any edge where the
   neighbouring quad faces away from you.

   Everything is seeded, so a seed is a gourd.
   ===================================================================== */
(function () {
  "use strict";

  var cv = document.getElementById("c"), ctx = cv.getContext("2d");
  var elName = document.getElementById("name"), elNo = document.getElementById("no");
  var elSeed = document.getElementById("seedBox"), elHint = document.getElementById("hint");

  /* ------------------------------------------------------------ random */

  function mulberry(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var rnd;
  var R = function (a, b) { return a + (b - a) * rnd(); };
  var RI = function (a, b) { return Math.floor(R(a, b + 1)); };
  var pick = function (arr) { return arr[Math.floor(rnd() * arr.length)]; };

  /* -------------------------------------------------------- archetypes */

  // Profile `bulbs` are Gaussians in t (0 = blossom end, 1 = stem end):
  // radius(t) = sum of a * exp(-((t-c)/w)^2). Everything else is a range
  // that each seed picks from.
  var KINDS = {
    pumpkin: {
      noun: ["Pumpkin", "Field Pumpkin", "Cheese Pumpkin", "Pie Pumpkin"],
      bulbs: [[.5, .78, 1]], n: [2.9, 3.6], aspect: [.74, 1.0], ribs: [8, 16], ribDepth: [.09, .2], ribSharp: [1.3, 2.4],
      warts: [0, 4], crook: [0, 0], lean: [-.12, .12], stem: [.22, .36], flat: [.15, .32],
      colors: ["orange", "deep", "pale", "white", "cream"]
    },
    knucklehead: {
      noun: ["Knucklehead", "Warted Pumpkin", "Goosebump Pumpkin"],
      bulbs: [[.5, .78, 1]], n: [2.7, 3.3], aspect: [.74, .98], ribs: [8, 12], ribDepth: [.06, .14], ribSharp: [1.2, 2],
      warts: [28, 70], crook: [0, 0], lean: [-.1, .1], stem: [.22, .34], flat: [.12, .26],
      colors: ["orange", "deep", "green", "wartyorange"]
    },
    acorn: {
      noun: ["Acorn Squash", "Pepper Squash"],
      bulbs: [[.5, .62, 1]], n: [2.2, 2.6], aspect: [1.0, 1.25], ribs: [9, 11], ribDepth: [.16, .26], ribSharp: [2, 3.2],
      warts: [0, 0], crook: [0, 0], lean: [-.08, .08], stem: [.16, .26], flat: [.04, .1], point: [.35, .6],
      colors: ["darkgreen", "green", "cream", "orange"]
    },
    butternut: {
      noun: ["Butternut", "Butternut Squash"],
      bulbs: [[.24, .27, 1], [.72, .34, .62]], n: [2, 2.2], aspect: [1.7, 2.3], ribs: [0, 5], ribDepth: [0, .035], ribSharp: [1, 1.5],
      warts: [0, 2], crook: [0, .15], lean: [-.15, .15], stem: [.14, .22], flat: [0, .05],
      colors: ["tan", "pale", "cream"]
    },
    bottle: {
      noun: ["Bottle Gourd", "Calabash", "Birdhouse Gourd"],
      bulbs: [[.24, .24, 1], [.72, .2, .68]], n: [2, 2.2], aspect: [1.6, 2.1], ribs: [0, 0], ribDepth: [0, 0], ribSharp: [1, 1],
      warts: [0, 3], crook: [0, .2], lean: [-.15, .15], stem: [.18, .3], flat: [0, .05],
      colors: ["green", "cream", "tan", "mottled"]
    },
    crookneck: {
      noun: ["Crookneck", "Crookneck Squash", "Warted Crookneck"],
      bulbs: [[.2, .22, 1], [.74, .36, .3]], n: [2, 2.2], aspect: [2.0, 2.6], ribs: [0, 4], ribDepth: [0, .04], ribSharp: [1, 1.5],
      warts: [12, 50], crook: [.7, 1], lean: [0, .2], stem: [.12, .2], flat: [0, .05],
      colors: ["yellow", "orange", "wartyorange", "green"]
    },
    turban: {
      noun: ["Turban Squash", "Turk's Cap"],
      bulbs: [[.36, .34, 1], [.84, .12, .56]], n: [2.0, 2.3], aspect: [.9, 1.15], ribs: [8, 12], ribDepth: [.08, .16], ribSharp: [1.4, 2.2],
      warts: [0, 6], crook: [0, 0], lean: [-.1, .1], stem: [.14, .22], flat: [.05, .14], cap: true,
      colors: ["orange", "deep", "green", "white"]
    },
    dipper: {
      noun: ["Dipper Gourd", "Swan Gourd", "Spoon Gourd"],
      bulbs: [[.16, .19, 1], [.7, .42, .15]], n: [2, 2.2], aspect: [2.6, 3.4], ribs: [0, 0], ribDepth: [0, 0], ribSharp: [1, 1],
      warts: [0, 2], crook: [.3, .9], lean: [0, .25], stem: [.14, .22], flat: [0, .05],
      colors: ["green", "cream", "mottled", "tan"]
    }
  };

  // Stripe pairs are chosen to contrast; a stripe you cannot see is not one.
  var STRIPE = { green: "#e9dfb4", cream: "#8ea85a", mottled: "#6f8a45" };

  var PALETTE = {
    orange:      ["#f08a2a", "#d9701c"], deep: ["#d6671f", "#b84f12"], pale: ["#f2b06a", "#dd9550"],
    white:       ["#f6f1e4", "#e2d9c4"], cream: ["#efe2bd", "#d8c89a"], tan: ["#e6c48e", "#cfa66b"],
    green:       ["#9bb86a", "#7c9a4d"], darkgreen: ["#5d7b3f", "#45602c"], yellow: ["#f1c94e", "#d9a92c"],
    wartyorange: ["#e9933c", "#7f9a4a"], mottled: ["#c9c99a", "#8aa05e"]
  };

  /* ------------------------------------------------------------ gourd */

  var G = null;          // the current gourd

  function grow(seed) {
    rnd = mulberry(seed);
    var kindName = pick(Object.keys(KINDS)), K = KINDS[kindName];
    var g = { seed: seed, kind: kindName };

    g.bulbs = K.bulbs.map(function (b) { return [b[0] + R(-.03, .03), b[1] * R(.9, 1.1), b[2] * R(.92, 1.08)]; });
    g.aspect = R(K.aspect[0], K.aspect[1]);
    g.ribs = RI(K.ribs[0], K.ribs[1]);
    g.ribDepth = R(K.ribDepth[0], K.ribDepth[1]);
    g.ribSharp = R(K.ribSharp[0], K.ribSharp[1]);
    g.ribPhase = R(0, 6.28);
    g.crook = R(K.crook[0], K.crook[1]);
    g.lean = R(K.lean[0], K.lean[1]);
    g.stemLen = R(K.stem[0], K.stem[1]);
    g.flat = R(K.flat[0], K.flat[1]);          // depth of the stem well and blossom dimple
    g.n = R(K.n[0], K.n[1]);                   // squareness of the profile's shoulders
    g.point = K.point ? R(K.point[0], K.point[1]) : 0;
    g.cap = !!K.cap;
    g.color = pick(K.colors);
    // A turban's cap is nearly always a different colour from its body.
    g.capColor = g.cap ? pick(["cream", "white", "green", "orange"].filter(function (c) { return c !== g.color; })) : null;
    g.stripes = (g.color === "green" || g.color === "cream" || g.color === "mottled") && rnd() < .5;
    g.wobble = [R(0, 6.28), R(.01, .035), R(0, 6.28), R(.01, .03)];   // asymmetry

    var nWarts = RI(K.warts[0], K.warts[1]);
    g.warts = [];
    for (var i = 0; i < nWarts; i++) {
      g.warts.push({ th: R(0, 6.28), t: R(.12, .9), s: R(.03, .07), h: R(.06, .15) });
    }

    // Name. Adjectives come from what actually grew, not a random list.
    var noun = pick(K.noun), adj = [];
    if (nWarts > 20 && noun.indexOf("Wart") < 0) adj.push(pick(["Knobbly", "Warty", "Goosebumped"]));
    if (g.ribDepth > .17) adj.push(pick(["Deep-ribbed", "Furrowed"]));
    if (g.aspect > 2.7) adj.push("Long-necked");
    else if (g.crook > .6 && kindName !== "crookneck") adj.push(pick(["Crook-necked", "Bent"]));
    if (g.stripes) adj.push("Striped");
    if (g.color === "white") adj.push(pick(["Ghost", "Moonlit"]));
    if (g.color === "mottled") adj.push("Mottled");
    if (!adj.length) adj.push(pick(["Stout", "Fine", "Handsome", "Lopsided", "Modest", "Proud"]));
    g.name = adj.slice(0, 2).join(" ") + " " + noun;
    g.no = String(seed % 10000).padStart(4, "0");

    buildMesh(g);
    return g;
  }

  /* ----------------------------------------------------------- shape */

  function profile(g, t) {
    var r = 0;
    for (var i = 0; i < g.bulbs.length; i++) {
      var b = g.bulbs[i], d = (t - b[0]) / b[1];
      r += b[2] * Math.exp(-d * d);
    }
    // Close the ends with a superellipse: n = 2 rounds off like a sphere,
    // n > 3 keeps the sides full almost to the poles and turns the corner
    // late, which is the difference between a lens and a pumpkin.
    var x = Math.abs(2 * Math.min(1, Math.max(0, t)) - 1);
    r *= Math.pow(Math.max(0, 1 - Math.pow(x, g.n)), 1 / g.n);
    if (g.point && t < .2) r *= .55 + .45 * Math.pow(t / .2, .55);
    return Math.max(r, 0);
  }

  function ribbing(g, th, t) {
    if (!g.ribs) return 1;
    var c = .5 - .5 * Math.cos(g.ribs * th + g.ribPhase);     // 0 at ridge, 1 in the furrow
    var taper = Math.pow(Math.sin(Math.PI * t), .6);           // ribs fade at the poles
    return 1 - g.ribDepth * taper * Math.pow(c, g.ribSharp);
  }

  function warting(g, th, t) {
    var h = 0;
    for (var i = 0; i < g.warts.length; i++) {
      var w = g.warts[i];
      var dth = Math.atan2(Math.sin(th - w.th), Math.cos(th - w.th)) * .55;   // angular distance, scaled
      var dt = (t - w.t) * 1.6;
      var d2 = (dth * dth + dt * dt) / (w.s * w.s);
      if (d2 < 9) h += w.h * Math.exp(-d2);
    }
    return 1 + h;
  }

  // A cubic Bezier spine, bending in the x-y plane. `crook` swings the
  // top over; `lean` tilts the whole thing.
  function spine(g, t) {
    var H = g.aspect, cx = g.lean * H;
    var c = g.crook;
    var p0 = [0, 0], p1 = [cx * .2, H * .38], p2 = [cx * .7 + c * H * .55, H * .86 - c * H * .02], p3 = [cx + c * H * .78, H - c * H * .42];
    var u = 1 - t;
    var x = u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0];
    var y = u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1];
    var dx = 3*u*u*(p1[0]-p0[0]) + 6*u*t*(p2[0]-p1[0]) + 3*t*t*(p3[0]-p2[0]);
    var dy = 3*u*u*(p1[1]-p0[1]) + 6*u*t*(p2[1]-p1[1]) + 3*t*t*(p3[1]-p2[1]);
    var L = Math.hypot(dx, dy) || 1;
    return { p: [x, y, 0], T: [dx / L, dy / L, 0] };
  }

  var U = 80, V = 96;    // segments along and around

  function buildMesh(g) {
    var verts = new Float32Array(U * V * 3);
    var cols = new Uint8Array(U * V);        // stripe band index per column
    for (var i = 0; i < U; i++) {
      // Cluster rings near the poles to keep shoulders and dimples smooth.
      var t = (1 - Math.cos(Math.PI * i / (U - 1))) / 2;
      var s = spine(g, t);
      // Frame: N lies in the bend plane, B is the fixed z axis. No twist.
      var N = [s.T[1], -s.T[0], 0], B = [0, 0, 1];
      var r0 = profile(g, t);
      // The stem well: push the surface down along the spine near the top
      // pole, more at the centre than the rim, and a shallower dimple at
      // the blossom end. This is what makes a pumpkin look sat-on.
      var well = g.flat * .6 * Math.exp(-((1 - t) / .14) * ((1 - t) / .14))
               - g.flat * .25 * Math.exp(-(t / .1) * (t / .1));
      // Slow asymmetry so no gourd is a perfect solid of revolution.
      for (var j = 0; j < V; j++) {
        var th = j / V * Math.PI * 2;
        var r = r0 * ribbing(g, th, t) * warting(g, th, t)
              * (1 + g.wobble[1] * Math.sin(th + g.wobble[0]) + g.wobble[3] * Math.sin(2 * th + g.wobble[2]) * Math.sin(Math.PI * t));
        var k = (i * V + j) * 3;
        verts[k]     = s.p[0] + r * (Math.cos(th) * N[0] + Math.sin(th) * B[0]) - s.T[0] * well;
        verts[k + 1] = s.p[1] + r * (Math.cos(th) * N[1] + Math.sin(th) * B[1]) - s.T[1] * well;
        verts[k + 2] = s.p[2] + r * (Math.cos(th) * N[2] + Math.sin(th) * B[2]) - s.T[2] * well;
        if (g.stripes) cols[i * V + j] = Math.floor((th + g.ribPhase) / (Math.PI * 2) * (g.ribs || 10)) % 2;
      }
    }
    g.body = { verts: verts, U: U, V: V, cols: cols };

    // Stem: a tapered tube continuing the spine's tangent, then bending
    // a little, with a slightly flared base.
    var SU = 15, SV = 20, top = spine(g, 1), sv = new Float32Array(SU * SV * 3);
    var bend = [R(-.6, .6), R(.2, .9)];
    var sink = g.flat * .6;
    var rootDepth = .14; // bury the flared root inside the shoulder                       // start inside the stem well
    var L = g.stemLen;
    for (var a = 0; a < SU; a++) {
      var q = Math.min(1, a / (SU - 2));
      var px = top.p[0] + top.T[0] * (L * q - sink - rootDepth * (1 - q)) + bend[0] * L * q * q;
      var py = top.p[1] + top.T[1] * (L * q - sink - rootDepth * (1 - q)) + bend[1] * L * q * q * .4;
      // Direction of the stem here, so each ring sits square to it. With
      // horizontal rings a sideways stem collapses to a flat paddle.
      var dx = top.T[0] * (L + rootDepth) + 2 * bend[0] * L * q, dy = top.T[1] * (L + rootDepth) + 2 * bend[1] * L * q * .4;
      var dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
      var Nx = dy, Ny = -dx;                              // in the bend plane; B is z
      var rad = .11 * (1 - q * .45) + .08 * Math.exp(-q * q / .03) * (1 - g.crook * .5);
      for (var b = 0; b < SV; b++) {
        var ph = b / SV * Math.PI * 2;
        var kk = (a * SV + b) * 3;
        // The final ring collapses to the cut-end centre, closing the tip.
        var ridged = a === SU - 1 ? 0 : rad * (1 + .12 * Math.cos(ph * 5));
        sv[kk]     = px + ridged * Math.cos(ph) * Nx;
        sv[kk + 1] = py + ridged * Math.cos(ph) * Ny;
        sv[kk + 2] = ridged * Math.sin(ph);
      }
    }
    g.stem = { verts: sv, U: SU, V: SV };

    // Overall size, so every gourd fills the frame about the same amount.
    var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, maxZ = 0;
    var all = [verts, sv];
    all.forEach(function (arr) {
      for (var m = 0; m < arr.length; m += 3) {
        minX = Math.min(minX, arr[m]); maxX = Math.max(maxX, arr[m]);
        minY = Math.min(minY, arr[m + 1]); maxY = Math.max(maxY, arr[m + 1]);
        maxZ = Math.max(maxZ, Math.abs(arr[m + 2]));
      }
    });
    g.centerX = (minX + maxX) / 2;
    g.centerY = (minY + maxY) / 2;
    var halfW = Math.max((maxX - minX) / 2, maxZ), halfH = (maxY - minY) / 2;
    g.scale = 1 / Math.max(halfH * 1.05, halfW * 1.1);
  }

  /* ---------------------------------------------------------- render */

  var yaw = .5, pitch = .3, autoSpin = true, inkOnly = false;
  var W = 0, H = 0, dpr = 1;

  function resize() {
    var w = cv.clientWidth || 600;
    var h = Math.round(w * (window.innerWidth < 600 ? 1.1 : .78));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      cv.style.height = h + "px";
    }
    W = w; H = h;
  }

  // Rotate, then a mild perspective. Returns screen x, y, and depth.
  function project(x, y, z, g, out, o) {
    var cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    x -= g.centerX; y -= g.centerY;
    var x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
    var y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
    var s = g.scale * Math.min(W, H) * .4;
    var persp = 1 / (1 + z2 * g.scale * .12);
    out[o]     = W / 2 + x1 * s * persp;
    out[o + 1] = H / 2 - y2 * s * persp;
    out[o + 2] = z2;
  }

  var light = [-.55, .7, -.55];
  (function () { var L = Math.hypot(light[0], light[1], light[2]); light = light.map(function (v) { return v / L; }); })();

  function renderMesh(g, mesh, quads, isStem) {
    var U = mesh.U, V = mesh.V, vs = mesh.verts;
    var P = new Float32Array(U * V * 3);
    for (var i = 0; i < U; i++) for (var j = 0; j < V; j++) {
      var k = (i * V + j) * 3;
      project(vs[k], vs[k + 1], vs[k + 2], g, P, k);

    }
    // Facing follows the perspective camera; normals also drive lighting.
    var facing = new Float32Array((U - 1) * V);
    var cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    for (var a = 0; a < U - 1; a++) for (var b = 0; b < V; b++) {
      var b2 = (b + 1) % V;
      var i0 = (a * V + b) * 3, i1 = (a * V + b2) * 3, i2 = ((a + 1) * V + b2) * 3, i3 = ((a + 1) * V + b) * 3;
      // Model-space normal for lighting.
      var ax = vs[i2] - vs[i0], ay = vs[i2 + 1] - vs[i0 + 1], az = vs[i2 + 2] - vs[i0 + 2];
      var bx = vs[i1] - vs[i3], by = vs[i1 + 1] - vs[i3 + 1], bz = vs[i1 + 2] - vs[i3 + 2];
      var nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      var L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
      // Rotate the normal with the gourd for lighting and facing.
      var rx = nx * cy + nz * sy, rz = -nx * sy + nz * cy;
      var ry = ny * cp - rz * sp, rz2 = ny * sp + rz * cp;
      var lam = Math.max(0, rx * light[0] + ry * light[1] + rz2 * light[2]);
      // The perspective camera is on negative z. Include its position
      // when culling so silhouettes agree with the actual projection.
      var mx = (vs[i0] + vs[i1] + vs[i2] + vs[i3]) / 4 - g.centerX;
      var my = (vs[i0 + 1] + vs[i1 + 1] + vs[i2 + 1] + vs[i3 + 1]) / 4 - g.centerY;
      var mz = (vs[i0 + 2] + vs[i1 + 2] + vs[i2 + 2] + vs[i3 + 2]) / 4;
      var vx = mx * cy + mz * sy, vz = -mx * sy + mz * cy;
      var vy = my * cp - vz * sp, depth = my * sp + vz * cp;
      var face = -rx * vx - ry * vy - rz2 * (depth + 1 / (g.scale * .12));
      facing[a * V + b] = face;
      if (face <= 0) continue;
      quads.push({
        p: [P[i0], P[i0 + 1], P[i1], P[i1 + 1], P[i2], P[i2 + 1], P[i3], P[i3 + 1]],
        z: (P[i0 + 2] + P[i1 + 2] + P[i2 + 2] + P[i3 + 2]) / 4,
        lam: lam, a: a, b: b, stem: isStem, stripe: mesh.cols ? mesh.cols[a * V + b] : 0, mesh: mesh, facing: facing
      });
    }
  }

  function draw() {
    resize();
    var g = G;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#f3ead6";
    ctx.fillRect(0, 0, W, H);

    // Ground shadow, so it sits on something.
    ctx.fillStyle = "rgba(60,40,20,.10)";
    ctx.beginPath();
    ctx.ellipse(W / 2 + 10, H * .5 + g.centerY * g.scale * Math.min(W, H) * .4 * Math.cos(pitch) + 8, Math.min(W, H) * .3, Math.min(W, H) * .06, 0, 0, 6.283);
    ctx.fill();

    var body = [], stem = [];
    renderMesh(g, g.body, body, false);
    renderMesh(g, g.stem, stem, true);
    var byDepth = function (p, q) { return q.z - p.z; };
    // Interleave both surfaces, including the stem inside the top well.
    var quads = body.concat(stem).sort(byDepth);

    var pal = PALETTE[g.color] || PALETTE.orange;
    var ink = "#2a1d12";

    for (var n = 0; n < quads.length; n++) {
      var q = quads[n], p = q.p;
      var dark = 1 - q.lam;                                 // 0 lit, 1 in shadow

      // Flat fill: paper in ink mode, otherwise the gourd's colour, a
      // touch darker in shadow so the hatching is not doing all the work.
      var fill;
      if (inkOnly) fill = "#f3ead6";
      else if (q.stem) fill = dark > .5 ? "#6e7a3e" : "#8b9a4f";
      else if (g.cap && (1 - Math.cos(Math.PI * (q.a + .5) / (q.mesh.U - 1))) / 2 > .72) fill = shade(PALETTE[g.capColor][0], dark * .22);
      else fill = shade(q.stripe ? (STRIPE[g.color] || pal[1]) : pal[0], dark * .22);
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]); ctx.lineTo(p[2], p[3]); ctx.lineTo(p[4], p[5]); ctx.lineTo(p[6], p[7]);
      ctx.closePath(); ctx.fill();
      // A hairline of the fill colour over the seam, so the paper does
      // not show through between quads as a moiré.
      ctx.strokeStyle = fill; ctx.lineWidth = .7; ctx.stroke();

      // Hatching: slots at fixed fractions of the quad's width, running
      // down the gourd. Dark quads light more slots. Stem hatches denser.
      var slots = q.stem ? [.2, .5, .8] : [.17, .5, .83];
      var thr = q.stem ? [.15, .4, .65] : [.28, .5, .72];
      // Near the poles the quads shrink to slivers and every column's
      // hatch lands on the same pixels, which reads as a black knot. Thin
      // the hatching out as a quad narrows, and drop it entirely below 2px.
      var wq = Math.min(Math.hypot(p[2] - p[0], p[3] - p[1]),
        Math.hypot(p[4] - p[6], p[5] - p[7]));
      var thin = Math.min(1, Math.max(0, (wq - 2) / 5));
      ctx.strokeStyle = ink; ctx.lineCap = "round";
      for (var s = 0; s < slots.length; s++) {
        if (dark < thr[s] + (1 - thin) * .6) continue;
        var f = slots[s];
        var x0 = p[0] + (p[2] - p[0]) * f, y0 = p[1] + (p[3] - p[1]) * f;
        var x1 = p[6] + (p[4] - p[6]) * f, y1 = p[7] + (p[5] - p[7]) * f;
        ctx.lineWidth = (.55 + dark * .9) * (.5 + .5 * thin);
        ctx.globalAlpha = (.55 + dark * .4) * thin;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }
      // Cross-hatch in the deepest shadow.
      if (dark > .82 && thin > .6) {
        ctx.lineWidth = .6; ctx.globalAlpha = .6;
        ctx.beginPath();
        ctx.moveTo(p[0] + (p[6] - p[0]) * .5, p[1] + (p[7] - p[1]) * .5);
        ctx.lineTo(p[2] + (p[4] - p[2]) * .5, p[3] + (p[5] - p[3]) * .5);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Contour: any edge whose neighbour faces away gets an ink line.
      var fa = q.facing, Vm = q.mesh.V, Um = q.mesh.U, a = q.a, b = q.b;
      var left = fa[a * Vm + (b + Vm - 1) % Vm] <= 0, right = fa[a * Vm + (b + 1) % Vm] <= 0;
      var below = a > 0 && fa[(a - 1) * Vm + b] <= 0;
      var above = a < Um - 2 && fa[(a + 1) * Vm + b] <= 0;
      if (left || right || below || above) {
        ctx.lineWidth = q.stem ? 1.2 : 1.6; ctx.globalAlpha = .9;
        ctx.beginPath();
        if (left)  { ctx.moveTo(p[0], p[1]); ctx.lineTo(p[6], p[7]); }
        if (right) { ctx.moveTo(p[2], p[3]); ctx.lineTo(p[4], p[5]); }
        if (below) { ctx.moveTo(p[0], p[1]); ctx.lineTo(p[2], p[3]); }
        if (above) { ctx.moveTo(p[6], p[7]); ctx.lineTo(p[4], p[5]); }
        ctx.stroke(); ctx.globalAlpha = 1;
      }
    }
  }

  function shade(hex, k) {
    var r = parseInt(hex.slice(1, 3), 16), gg = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    r = Math.round(r * (1 - k)); gg = Math.round(gg * (1 - k)); b = Math.round(b * (1 - k));
    return "rgb(" + r + "," + gg + "," + b + ")";
  }

  /* ------------------------------------------------------------ flow */

  var dragging = false, lx = 0, ly = 0, dirty = true;

  cv.addEventListener("pointerdown", function (e) {
    dragging = true; lx = e.clientX; ly = e.clientY;
    cv.setPointerCapture(e.pointerId);
    elHint.classList.add("gone");
  });
  cv.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    yaw += (e.clientX - lx) * .012; pitch += (e.clientY - ly) * .008;
    pitch = Math.max(-1.1, Math.min(1.1, pitch));
    lx = e.clientX; ly = e.clientY; dirty = true;
  });
  function up() { dragging = false; }
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);

  var last = 0;
  function loop(t) {
    requestAnimationFrame(loop);
    var dt = last ? Math.min(.05, (t - last) / 1000) : 0; last = t;
    if (autoSpin && !dragging) { yaw += dt * .35; dirty = true; }
    if (dirty) { draw(); dirty = false; }
  }

  function setGourd(seed, pushUrl) {
    G = grow(seed);
    elName.textContent = G.name;
    elNo.textContent = "No. " + G.no + " · " + G.kind;
    elSeed.value = String(seed);
    if (pushUrl) history.replaceState(null, "", "#" + seed);
    dirty = true;
  }

  document.getElementById("grow").addEventListener("click", function () {
    setGourd(Math.floor(Math.random() * 1e9), true);
  });
  document.getElementById("spin").addEventListener("click", function () {
    autoSpin = !autoSpin; this.setAttribute("aria-pressed", String(autoSpin));
  });
  document.getElementById("ink").addEventListener("click", function () {
    inkOnly = !inkOnly; this.setAttribute("aria-pressed", String(inkOnly)); dirty = true;
  });
  document.getElementById("save").addEventListener("click", function () {
    draw();
    cv.toBlob(function (blob) {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = G.name.toLowerCase().replace(/[^a-z]+/g, "-") + "-" + G.seed + ".png";
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    }, "image/png");
  });
  document.getElementById("share").addEventListener("click", function () {
    var url = location.href.split("#")[0] + "#" + G.seed, self = this;
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () {
      self.textContent = "Copied"; setTimeout(function () { self.textContent = "Copy link"; }, 1400);
    }, function () { prompt("Link to this gourd:", url); });
  });
  elSeed.addEventListener("change", function () {
    var s = parseInt(elSeed.value, 10);
    if (!isNaN(s)) setGourd(Math.abs(s), true);
  });
  window.addEventListener("resize", function () { dirty = true; });

  var h = parseInt((location.hash || "").slice(1), 10);
  setGourd(!isNaN(h) ? h : Math.floor(Math.random() * 1e9), false);
  requestAnimationFrame(loop);
})();
