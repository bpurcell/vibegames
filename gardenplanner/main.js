/* =====================================================================
   Summer garden planner — five questions in, one printable plan out.

   The plan is assembled in three passes:

   1. SEASON. The zone becomes a last-frost date and a frost-free length
      (see plants.js for why the zone alone is the wrong question). Every
      date in the output is derived from that one date, so overriding it
      moves the whole plan coherently.

   2. SPACE. The bed is divided into horizontal bands, one per crop,
      ordered tallest at the top. Rows are handed out by the divisor
      method — repeatedly give the next row to whichever crop has the
      worst share so far — which fills the bed without any crop being
      squeezed out by rounding.

   3. TIME. Each crop's sowing, transplanting and first-harvest dates
      fall out of the frost date and its days-to-maturity, and anything
      that cannot finish before the autumn frost is flagged rather than
      quietly included.

   Tallest to the north is the only layout rule that really matters in a
   home bed, and it is the one most plans get wrong.
   ===================================================================== */
(function () {
  "use strict";

  var DAY = 86400000;
  var PLANTS = window.PLANTS, ZONES = window.ZONES;

  var S = {
    path: null, zone: "6", frost: null, sun: 6,
    likes: {}, appetite: 2, bw: 4, bd: 8, filter: "all", step: 0
  };

  var PALETTE = ["#6fcf6f", "#ffb454", "#7fb2ff", "#ff8fb1", "#c79bff",
                 "#5fd6c4", "#e0d16a", "#ff9d7a", "#9fd35c", "#8ec9ff"];

  var $ = function (id) { return document.getElementById(id); };

  /* ------------------------------------------------------------ dates */

  function zoneObj(z) {
    for (var i = 0; i < ZONES.length; i++) if (ZONES[i].z === z) return ZONES[i];
    return ZONES[3];
  }
  function md(year, pair) { return new Date(year, pair[0] - 1, pair[1]); }

  // Which season is this plan for? Up to roughly two months before the
  // autumn frost there is still time to plant something; after that the
  // only useful plan is next year's.
  function targetYear(z) {
    var now = new Date(), y = now.getFullYear();
    return now < new Date(md(y, z.first).getTime() - 60 * DAY) ? y : y + 1;
  }
  function seasonDays(z, y) { return Math.round((md(y, z.first) - md(y, z.last)) / DAY); }

  function addDays(d, n) { return new Date(d.getTime() + n * DAY); }
  function fmtDate(d) {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  function toInput(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") +
           "-" + String(d.getDate()).padStart(2, "0");
  }

  function season() {
    var z = zoneObj(S.zone), y = targetYear(z);
    var last = S.frost || md(y, z.last);
    // Keep the published frost-free length when the date is overridden —
    // a warmer garden usually runs later at the far end too.
    var first = addDays(last, seasonDays(z, y));
    return { z: z, year: last.getFullYear(), last: last, first: first,
             days: Math.round((first - last) / DAY) };
  }

  /* ----------------------------------------------------------- wizard */

  function chosen() {
    return PLANTS.filter(function (p) { return S.likes[p.id]; });
  }

  function show(n) {
    S.step = n;
    for (var i = 0; i < 5; i++) {
      $("s" + i).classList.toggle("on", i === n);
      var dot = $("p" + i);
      dot.className = i < n ? "done" : i === n ? "now" : "";
    }
    $("back").style.visibility = n === 0 ? "hidden" : "visible";
    $("next").textContent = n === 3 ? "Make my plan" : "Next";
    $("next").style.display = n === 4 ? "none" : "";
    $("printBtn").style.display = n === 4 ? "" : "none";
    $("restart").style.display = n === 4 ? "" : "none";
    validate();
    window.scrollTo(0, 0);
  }

  function validate() {
    var ok = true;
    if (S.step === 1) ok = !!S.frost;
    if (S.step === 2) ok = Object.keys(S.likes).length > 0;
    if (S.step === 3) ok = S.bw > 0 && S.bd > 0;
    $("next").disabled = !ok;
  }

  /* --------------------------------------------------- step 1: paths */

  Array.prototype.forEach.call(document.querySelectorAll(".path"), function (b) {
    b.addEventListener("click", function () {
      S.path = b.dataset.path;
      S.likes = {};
      buildLikes();
      show(1);
    });
  });

  /* ---------------------------------------------------- step 2: zone */

  var zsel = $("zone");
  ZONES.forEach(function (z) {
    var o = document.createElement("option");
    o.value = z.z; o.textContent = z.label;
    zsel.appendChild(o);
  });
  zsel.value = S.zone;

  function syncFrost(force) {
    var z = zoneObj(S.zone), y = targetYear(z);
    if (force || !S.frost) S.frost = md(y, z.last);
    $("frost").value = toInput(S.frost);
    var s = season();
    $("frostHint").textContent =
      "Typical for zone " + z.z + ": " + fmtDate(md(y, z.last)) +
      ", giving about " + seasonDays(z, y) + " frost-free days (planning for " + y + ").";
    validate();
    return s;
  }
  zsel.addEventListener("change", function () { S.zone = zsel.value; syncFrost(true); });
  $("frost").addEventListener("change", function () {
    var v = $("frost").value;
    if (v) { var p = v.split("-"); S.frost = new Date(+p[0], +p[1] - 1, +p[2]); }
    validate();
  });

  Array.prototype.forEach.call(document.querySelectorAll("#sun .chip"), function (b) {
    b.addEventListener("click", function () {
      S.sun = +b.dataset.sun;
      Array.prototype.forEach.call(document.querySelectorAll("#sun .chip"), function (o) {
        o.classList.toggle("on", o === b);
      });
    });
    if (+b.dataset.sun === S.sun) b.classList.add("on");
  });

  /* --------------------------------------------------- step 3: likes */

  var FILTERS = {
    food: [["all", "Everything"], ["raw", "Good raw from the bed"],
           ["quick", "Ready in under 60 days"], ["herb", "Herbs"]],
    flower: [["all", "Everything"], ["cut", "For cutting"],
             ["pollinator", "For pollinators"], ["short", "Low / front of bed"]]
  };

  function matches(p) {
    if (S.filter === "all") return true;
    if (S.filter === "raw") return !!p.raw;
    if (S.filter === "quick") return p.dtm < 60;
    if (S.filter === "herb") return p.kind === "herb";
    if (S.filter === "cut") return !!p.cut;
    if (S.filter === "pollinator") return !!p.pollinator;
    if (S.filter === "short") return p.height <= 24;
    return true;
  }

  function buildLikes() {
    var food = S.path === "food";
    $("likeTitle").textContent = food ? "What do you actually eat?" : "What do you want to grow?";
    $("likeLede").textContent = food
      ? "Pick what you'd genuinely be pleased to have a lot of. Everything else is just work."
      : "Pick what you like the look of. The plan sorts out heights, spacing and dates.";
    $("appetiteQ").textContent = food ? "How much do you want?" : "How steady a supply?";
    $("appetiteHint").textContent = food
      ? "Sets how many repeat sowings the calendar plans for the crops that allow it."
      : "More repeat sowings means flowers over a longer stretch rather than one big flush.";

    var fbox = $("likeFilters");
    fbox.innerHTML = "";
    FILTERS[food ? "food" : "flower"].forEach(function (f) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (S.filter === f[0] ? " on" : "");
      b.textContent = f[1];
      b.addEventListener("click", function () { S.filter = f[0]; buildLikes(); });
      fbox.appendChild(b);
    });

    var box = $("likes");
    box.innerHTML = "";
    PLANTS.filter(function (p) {
      return (food ? p.kind !== "flower" : p.kind === "flower") && matches(p);
    }).forEach(function (p) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "pick" + (S.likes[p.id] ? " on" : "");
      var tags = [];
      if (p.raw) tags.push("good raw");
      if (p.cut) tags.push("cuts well");
      if (p.pollinator) tags.push("pollinators");
      if (p.support) tags.push("needs a " + p.support);
      tags.push(p.dtm + " days");
      b.innerHTML = '<span class="e">' + p.emoji + '</span><span class="n">' + p.name +
                    '<span class="t">' + tags.join(" · ") + '</span></span>';
      b.addEventListener("click", function () {
        if (S.likes[p.id]) delete S.likes[p.id]; else S.likes[p.id] = true;
        b.classList.toggle("on");
        validate();
      });
      box.appendChild(b);
    });
    validate();
  }

  Array.prototype.forEach.call(document.querySelectorAll("#appetite .chip"), function (b) {
    b.addEventListener("click", function () {
      S.appetite = +b.dataset.appetite;
      Array.prototype.forEach.call(document.querySelectorAll("#appetite .chip"), function (o) {
        o.classList.toggle("on", o === b);
      });
    });
  });

  /* ---------------------------------------------------- step 4: size */

  // Long side across, short side away from you: you can only reach about
  // 2ft in from an edge, so the depth is the dimension that has to stay
  // small. A 4x8 bed wants to be 8 wide and 4 deep, not the reverse.
  var SIZES = [["4 × 4", 4, 4], ["8 × 4", 8, 4], ["10 × 3", 10, 3],
               ["10 × 8", 10, 8], ["20 × 10", 20, 10], ["30 × 20", 30, 20]];
  var sbox = $("sizes");
  SIZES.forEach(function (s) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "chip"; b.textContent = s[0] + " ft";
    b.title = s[1] + " ft wide by " + s[2] + " ft deep";
    b.addEventListener("click", function () {
      S.bw = s[1]; S.bd = s[2];
      $("bw").value = s[1]; $("bd").value = s[2];
      syncSize();
    });
    sbox.appendChild(b);
  });
  function syncSize() {
    S.bw = parseFloat($("bw").value) || 0;
    S.bd = parseFloat($("bd").value) || 0;
    $("bedArea").textContent = S.bw && S.bd
      ? "= " + Math.round(S.bw * S.bd) + " sq ft" : "";
    Array.prototype.forEach.call(sbox.children, function (b, i) {
      b.classList.toggle("on", SIZES[i][1] === S.bw && SIZES[i][2] === S.bd);
    });
    validate();
  }
  $("bw").value = S.bw; $("bd").value = S.bd;
  $("bw").addEventListener("input", syncSize);
  $("bd").addEventListener("input", syncSize);

  /* ------------------------------------------------- the plan itself */

  // Divisor method: hand the next row to whichever crop is worst served
  // so far. Keeps every chosen crop in the bed and still fills it.
  // Row spacing is the gap BETWEEN rows, so a single row does not need a
  // whole row-spacing of bed depth — it needs about the width of the plant
  // itself. Charging every row the full spacing throws out crops that would
  // have fitted comfortably.
  function foot(p) { return Math.min(p.rowSpacing, Math.max(p.spacing, 6)); }
  function bandDepth(p, n) { return foot(p) + (n - 1) * p.rowSpacing; }

  function allocate(list, widthIn, depthIn) {
    var rows = {}, used = 0, dropped = [];
    var keep = list.slice().sort(function (a, b) { return b.height - a.height; });

    keep.forEach(function (p) { rows[p.id] = p.minRows || 1; });
    var need = function () {
      return keep.reduce(function (t, p) { return t + bandDepth(p, rows[p.id]); }, 0);
    };
    // Too much for the bed: drop the hungriest until what is left fits.
    while (keep.length && need() > depthIn) {
      var worst = keep.slice().sort(function (a, b) {
        return bandDepth(b, b.minRows || 1) - bandDepth(a, a.minRows || 1);
      })[0];
      dropped.push(worst);
      keep.splice(keep.indexOf(worst), 1);
      delete rows[worst.id];
    }
    used = need();

    for (;;) {
      var best = null, score = -1;
      keep.forEach(function (p) {
        if (used + p.rowSpacing > depthIn) return;
        var s = 1 / (rows[p.id] + 1);
        if (s > score) { score = s; best = p; }
      });
      if (!best) break;
      rows[best.id]++; used += best.rowSpacing;
    }

    var bands = [], top = 0;
    keep.forEach(function (p, i) {
      var depth = bandDepth(p, rows[p.id]);
      var perRow = Math.max(1, Math.floor(widthIn / p.spacing));
      bands.push({
        p: p, rows: rows[p.id], perRow: perRow, count: rows[p.id] * perRow,
        top: top, depth: depth, color: PALETTE[i % PALETTE.length]
      });
      top += depth;
    });
    return { bands: bands, dropped: dropped, usedIn: top };
  }

  function schedule(p, se) {
    var out = addDays(se.last, (p.out || 0) * 7);
    var ev = [];
    if (p.start === "transplant") {
      ev.push({ d: addDays(se.last, -(p.indoorWeeks || 6) * 7),
                t: "Start " + p.name.toLowerCase() + " indoors",
                s: (p.indoorWeeks || 6) + " weeks before the frost date" });
      ev.push({ d: out, t: "Plant out " + p.name.toLowerCase(),
                s: p.out > 0 ? "once nights are reliably warm" : "hardy enough to go early" });
    } else if (p.start === "tuber") {
      ev.push({ d: out, t: "Plant " + p.name.toLowerCase(),
                s: p.id === "potato" ? "seed potatoes, 4in deep" : "tubers, after frost" });
    } else {
      ev.push({ d: out, t: "Sow " + p.name.toLowerCase() + " direct",
                s: p.out > 0 ? "after the last frost" : Math.abs(p.out) + " weeks before the last frost" });
    }
    // Repeat sowings, as many as the appetite asks for and the season allows.
    if (p.succession) {
      for (var i = 1; i < S.appetite + 1; i++) {
        var d = addDays(out, p.succession * i);
        if (addDays(d, p.dtm) > se.first) break;
        ev.push({ d: d, t: "Sow more " + p.name.toLowerCase(), s: "repeat sowing " + (i + 1) });
      }
    }
    var harvest = addDays(out, p.dtm);
    ev.push({ d: harvest, t: (p.kind === "flower" ? "First flowers: " : "First harvest: ") + p.name.toLowerCase(),
              s: "roughly, " + p.dtm + " days on" });
    return { out: out, harvest: harvest, events: ev,
             fits: Math.round((se.first - out) / DAY) >= p.dtm,
             shortBy: p.dtm - Math.round((se.first - out) / DAY) };
  }

  function drawBed(alloc, widthIn, depthIn) {
    var maxW = 820, maxH = 560;
    var k = Math.min(maxW / widthIn, maxH / depthIn);
    var W = widthIn * k, H = depthIn * k;       // the whole bed, not just the used part
    var pad = 34;
    var svg = ['<svg id="bed" viewBox="0 0 ' + (W + pad * 2) + ' ' + (H + pad * 2) +
               '" width="' + (W + pad * 2) + '" role="img" aria-label="Bed layout to scale">'];
    svg.push('<rect x="' + pad + '" y="' + pad + '" width="' + W + '" height="' + H +
             '" fill="#241a12" stroke="#5b4633" stroke-width="2" rx="4"/>');

    alloc.bands.forEach(function (b) {
      var f = foot(b.p);
      var y = pad + b.top * k, h = b.depth * k;
      svg.push('<rect x="' + pad + '" y="' + y + '" width="' + W + '" height="' + h +
               '" fill="' + b.color + '" fill-opacity="0.12"/>');
      svg.push('<line x1="' + pad + '" y1="' + y + '" x2="' + (pad + W) + '" y2="' + y +
               '" stroke="' + b.color + '" stroke-opacity="0.5" stroke-width="1"/>');

      // Only a trellis is a line along the bed edge; a cage is a thing you
      // drop over each individual plant, and belongs in the shopping list.
      if (b.p.support === "trellis") {
        svg.push('<line x1="' + (pad + 2) + '" y1="' + (y + 3) + '" x2="' + (pad + W - 2) +
                 '" y2="' + (y + 3) + '" stroke="' + b.color +
                 '" stroke-width="3" stroke-dasharray="2 4" stroke-opacity="0.9"/>');
      }

      // The first row sits half a plant-width into the band; every row after
      // it is a full row-spacing further down. Using the row spacing for the
      // first row too drops the plants outside their own band.
      var dot = Math.max(1.5, Math.min(b.p.spacing * k * 0.35, f * k * 0.42, 26));
      for (var r = 0; r < b.rows; r++) {
        var cy = pad + (b.top + f / 2 + r * b.p.rowSpacing) * k;
        for (var c = 0; c < b.perRow; c++) {
          var cxp = pad + (c + 0.5) * (W / b.perRow);
          svg.push('<circle cx="' + cxp.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' +
                   dot.toFixed(1) + '" fill="' + b.color + '" fill-opacity="0.8"/>');
        }
      }
      var fs = Math.max(9, Math.min(13, h - 3));
      svg.push('<text x="' + (pad + 6) + '" y="' + (y + Math.min(h - 2, fs + 2)) +
               '" font-size="' + fs + '" font-weight="700" fill="#fff" ' +
               'stroke="#14100c" stroke-width="3" paint-order="stroke" ' +
               'style="font-family:inherit">' + b.p.emoji + " " + b.p.name +
               " · " + b.count + '</text>');
    });

    // Whatever is left over, said plainly rather than left as a mystery gap.
    var spare = depthIn - alloc.usedIn;
    if (spare > 6) {
      svg.push('<text x="' + (pad + W / 2) + '" y="' + (pad + (alloc.usedIn + spare / 2) * k + 4) +
               '" text-anchor="middle" font-size="11" fill="#8a7a68" style="font-family:inherit">' +
               (spare / 12).toFixed(1) + ' ft spare — path, or a later sowing</text>');
    }

    // North arrow and a scale bar, so the drawing can be paced out on site.
    svg.push('<text x="' + (pad + W / 2) + '" y="' + (pad - 12) +
             '" text-anchor="middle" font-size="13" font-weight="800" fill="#8fa3bf" ' +
             'style="font-family:inherit">▲ north — tallest plants along this edge</text>');
    var barFt = widthIn >= 120 ? 5 : 2, barPx = barFt * 12 * k;
    svg.push('<line x1="' + pad + '" y1="' + (pad + H + 14) + '" x2="' + (pad + barPx) +
             '" y2="' + (pad + H + 14) + '" stroke="#8fa3bf" stroke-width="2"/>');
    svg.push('<text x="' + (pad + barPx + 6) + '" y="' + (pad + H + 18) +
             '" font-size="11" fill="#8fa3bf" style="font-family:inherit">' + barFt + ' ft</text>');
    svg.push('</svg>');
    return svg.join("");
  }

  function buy(p, count, widthFt) {
    var base;
    if (p.start === "transplant") base = count + " plant" + (count === 1 ? "" : "s") + " (or a packet + indoor start)";
    else if (p.start === "tuber") base = count + (p.id === "potato" ? " seed potatoes" : " tubers");
    else base = "1 seed packet";
    if (p.support === "cage") base += " · " + count + " cage" + (count === 1 ? "" : "s");
    if (p.support === "trellis") base += " · a trellis " + widthFt + " ft wide, 6 ft tall";
    return base;
  }

  function makePlan() {
    var se = season();
    var list = chosen();
    var widthIn = S.bw * 12, depthIn = S.bd * 12;
    var alloc = allocate(list, widthIn, depthIn);

    var events = [], rows = [], warns = [];

    alloc.bands.forEach(function (b) {
      var sc = schedule(b.p, se);
      b.sc = sc;
      events = events.concat(sc.events);
      rows.push(b);
      if (!sc.fits) {
        warns.push("<b>" + b.p.name + "</b> needs about " + sc.shortBy +
          " more frost-free days than this spot gives. Buy it as a started plant, pick the " +
          "fastest variety you can find, or leave it out.");
      }
      if (b.p.sun > S.sun) {
        warns.push("<b>" + b.p.name + "</b> wants " + b.p.sun + "+ hours of sun and you have around " +
          S.sun + ". It will grow, but expect thin plants and a fraction of the crop.");
      }
      if (b.p.minRows && b.rows < b.p.minRows) {
        warns.push("<b>" + b.p.name + "</b> is wind-pollinated and needs a block of at least " +
          b.p.minRows + " rows to fill its cobs. This bed only fits " + b.rows + ".");
      }
    });

    alloc.dropped.forEach(function (p) {
      warns.push("<b>" + p.name + "</b> did not fit — even one row of it wants " +
        (bandDepth(p, p.minRows || 1) / 12).toFixed(1) + " ft of depth and " +
        p.spacing + "in between plants. Give it a bed of its own, or leave it out this year.");
    });

    var needsBees = alloc.bands.some(function (b) { return b.p.pollinated === "insect"; });
    var hasFlowers = alloc.bands.some(function (b) { return b.p.pollinator; });
    if (needsBees && !hasFlowers) {
      warns.push("Squash, cucumbers and melons set fruit only if an insect moves pollen between " +
        "separate male and female flowers. A few <b>borage, zinnias or alyssum</b> along one edge " +
        "measurably improves the set — this is the one piece of companion-planting folklore that holds up.");
    }
    if (S.bd > 5) {
      warns.push("A bed deeper than about 4 ft can't be reached into from the edges. " +
        "This plan assumes you can step between the rows — fine for an open plot, but if " +
        "it is a raised bed, split it into 4 ft beds with paths between and run this again.");
    }
    if (S.sun < 4) {
      warns.push("Under four hours of sun is below what any fruiting crop needs. Leafy things — " +
        "lettuce, spinach, chard, kale — are the only ones worth the effort in that spot.");
    }

    events.sort(function (a, b) { return a.d - b.d; });
    events.push({ d: se.first, t: "Average first autumn frost — the season closes",
                  s: "tender plants finish here" });

    var total = alloc.bands.reduce(function (t, b) { return t + b.count; }, 0);

    var h = [];
    h.push('<h1>Your ' + se.year + " " + (S.path === "food" ? "food" : "flower") + ' garden</h1>');
    h.push('<p class="lede">Zone ' + se.z.z + " · " + S.bw + "×" + S.bd + " ft · last frost " +
           fmtDate(se.last) + " · about " + se.days + " frost-free days.</p>");

    h.push('<div class="facts">');
    h.push('<div class="fact"><div class="k">Plants</div><div class="v">' + total +
           '</div><div class="s">' + alloc.bands.length + " kinds</div></div>");
    h.push('<div class="fact"><div class="k">Bed</div><div class="v">' + Math.round(S.bw * S.bd) +
           ' sq ft</div><div class="s">' + Math.round(alloc.usedIn / 12 * 10) / 10 + " ft used of " + S.bd + "</div></div>");
    h.push('<div class="fact"><div class="k">First sowing</div><div class="v">' +
           fmtDate(events[0].d) + '</div><div class="s">' + events[0].t.toLowerCase() + "</div></div>");
    h.push('<div class="fact"><div class="k">Season ends</div><div class="v">' +
           fmtDate(se.first) + '</div><div class="s">average first frost</div></div>');
    h.push("</div>");

    if (warns.length) {
      h.push("<h2>Worth knowing before you buy</h2>");
      warns.forEach(function (w) { h.push('<div class="warn">' + w + "</div>"); });
    }

    h.push("<h2>The bed</h2>");
    h.push('<div id="bedbox">' + drawBed(alloc, widthIn, depthIn) + "</div>");
    h.push('<div class="legend">');
    alloc.bands.forEach(function (b) {
      h.push('<span><i style="background:' + b.color + '"></i>' + b.p.name + "</span>");
    });
    h.push("</div>");
    h.push('<p class="hint">Drawn to scale. Dots are plants at their real spacing; ' +
           'a dashed line along a band\'s top edge means that crop needs something to climb.</p>');

    h.push("<h2>What to buy</h2>");
    h.push("<table><thead><tr><th>Plant</th><th>Buy</th><th>Rows</th><th>Plants</th>" +
           "<th>Spacing</th><th>Rough yield</th></tr></thead><tbody>");
    rows.forEach(function (b) {
      var y = b.p.yield
        ? Math.round(b.p.yield[0] * b.count) + "–" + Math.round(b.p.yield[1] * b.count) + " " + b.p.yield[2]
        : "—";
      h.push("<tr><td>" + b.p.emoji + " <b>" + b.p.name + "</b></td><td>" + buy(b.p, b.count, S.bw) +
             '</td><td class="num">' + b.rows + '</td><td class="num">' + b.count +
             '</td><td class="num">' + b.p.spacing + '" apart</td><td class="num">' + y + "</td></tr>");
    });
    h.push("</tbody></table>");
    h.push('<p class="hint">Yields are per-season rough spans and vary severalfold with variety, ' +
           'soil and water. Read them as orders of magnitude, not promises.</p>');

    h.push("<h2>What to do, when</h2>");
    h.push('<ul class="cal">');
    events.forEach(function (e) {
      h.push('<li><span class="when">' + fmtDate(e.d) + '</span><span class="what"><b>' +
             e.t + "</b> <span>— " + e.s + "</span></span></li>");
    });
    h.push("</ul>");
    h.push('<p class="hint">All dates hang off your last-frost date of ' + fmtDate(se.last) +
           ". Move that and everything moves with it. Watch the forecast rather than the calendar " +
           "for anything tender.</p>");

    h.push("<h2>Notes on what you picked</h2>");
    h.push("<table><tbody>");
    rows.forEach(function (b) {
      h.push("<tr><td>" + b.p.emoji + " <b>" + b.p.name + "</b></td><td>" + b.p.note + "</td></tr>");
    });
    h.push("</tbody></table>");

    $("plan").innerHTML = h.join("");
  }

  /* --------------------------------------------------------- buttons */

  $("next").addEventListener("click", function () {
    if (S.step === 1) syncFrost(false);
    if (S.step === 3) { makePlan(); show(4); return; }
    show(S.step + 1);
  });
  $("back").addEventListener("click", function () { show(Math.max(0, S.step - 1)); });
  $("printBtn").addEventListener("click", function () { window.print(); });
  $("restart").addEventListener("click", function () {
    S.likes = {}; S.path = null;
    show(0);
  });

  syncFrost(false);
  syncSize();
  show(0);
})();
