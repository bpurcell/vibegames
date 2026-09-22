/* =====================================================================
   The cabinet: browsing, the card, the keyboard and the oscilloscope.

   The scope is a real AnalyserNode on the output rather than a drawing
   of the recipe — what you see is what is actually leaving the speakers.
   The little bar chart under "the model" is the recipe, and is labelled
   as such, because the two are worth comparing: the recipe says what was
   asked for, the scope says what came out after the envelopes and the
   filters had their say.
   ===================================================================== */
(function () {
  "use strict";

  var INSTRUMENTS = window.INSTRUMENTS, FAMILIES = window.FAMILIES, S = window.Synth;
  var byId = {};
  INSTRUMENTS.forEach(function (i) { byId[i.id] = i; });

  // A sensible home pitch for each, so nothing is auditioned outside its range.
  var BASE = {
    violin: 69, cello: 48, guitar: 52, harp: 60, banjo: 62, koto: 60, sitar: 57,
    flute: 72, clarinet: 58, oboe: 69, bassoon: 46, didgeridoo: 38,
    trumpet: 65, frenchhorn: 53, trombone: 46,
    marimba: 60, xylophone: 72, timpani: 41, gong: 36, steelpan: 64,
    piano: 60, harpsichord: 60, organ: 48
  };
  // How long a single note should ring before it is cut.
  var LEN = {
    ks: 3.2, additive: 1.9, inharmonic: 5.0,
    harp: 4.5, banjo: 2.6, gong: 5.5, didgeridoo: 4.2, timpani: 3.0,
    marimba: 2.2, xylophone: 1.4, steelpan: 2.6, piano: 3.0, harpsichord: 2.6, organ: 1.8
  };

  var NOTE_NAMES = ["C","C♯","D","D♯","E","F","F♯","G","G♯","A","A♯","B"];
  var mode = "family", current = null, rafId = null;

  var elList = document.getElementById("list");
  var elCard = document.getElementById("card");

  function noteLen(inst) { return LEN[inst.id] || LEN[inst.voice.engine] || 2; }
  function noteName(m) { return NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1); }

  /* -------------------------------------------------------- browsing */

  function groups() {
    if (mode === "family") {
      return Object.keys(FAMILIES).map(function (k) {
        return { label: FAMILIES[k].label + " · " + FAMILIES[k].hs,
                 items: INSTRUMENTS.filter(function (i) { return i.family === k; }) };
      });
    }
    if (mode === "region") {
      var seen = [];
      INSTRUMENTS.forEach(function (i) { if (seen.indexOf(i.region) < 0) seen.push(i.region); });
      seen.sort();
      return seen.map(function (r) {
        return { label: r, items: INSTRUMENTS.filter(function (i) { return i.region === r; }) };
      });
    }
    var sorted = INSTRUMENTS.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    return [{ label: "All instruments", items: sorted }];
  }

  function drawList() {
    elList.innerHTML = "";
    groups().forEach(function (g) {
      var h = document.createElement("div");
      h.className = "group"; h.textContent = g.label;
      elList.appendChild(h);
      g.items.forEach(function (i) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "item" + (current && current.id === i.id ? " on" : "");
        b.innerHTML = '<span class="e">' + i.emoji + "</span>" + i.name;
        b.addEventListener("click", function () { select(i); });
        elList.appendChild(b);
      });
    });
  }

  /* ------------------------------------------------------------ card */

  function select(inst) {
    current = inst;
    drawList();
    drawCard();
  }

  function drawCard() {
    var i = current, fam = FAMILIES[i.family], base = BASE[i.id] || 60;
    var h = [];

    h.push('<h2>' + i.emoji + " " + i.name + "</h2>");
    h.push('<p class="tagline"><span class="badge" style="background:' + fam.color +
           '22;color:' + fam.color + '">' + fam.label + "</span>" +
           '<span class="badge" style="background:#ffffff10;color:var(--sub)">' + fam.hs + "</span>" +
           i.region + " · " + i.origin + "</p>");

    h.push('<div class="controls">' +
      '<button class="primary" data-act="note">▶ Play a note</button>' +
      '<button data-act="scale">Play a scale</button>' +
      '<button data-act="phrase">Play a phrase</button>' +
      '<button data-act="stop">■ Stop</button>' +
      "</div>");

    // One octave from the instrument's home pitch.
    h.push('<div class="keys" id="keys">');
    for (var k = 0; k <= 12; k++) {
      var m = base + k, black = [1,3,6,8,10].indexOf(((m % 12) + 12) % 12) >= 0;
      h.push('<button type="button" class="' + (black ? "black" : "") + '" data-midi="' + m +
             '">' + (black ? "" : noteName(m)) + "</button>");
    }
    h.push("</div>");

    h.push('<div class="scope"><canvas id="scope"></canvas>' +
           '<div class="cap"><span>Waveform — what is actually coming out</span>' +
           '<span id="scopeNote">press a key</span></div></div>');

    h.push('<div class="sec"><h3>What it is</h3><p>' + i.blurb + "</p></div>");
    h.push('<div class="sec"><h3>How it makes the sound</h3><p>' + i.physics + "</p></div>");

    h.push('<div class="sec"><h3>Particulars</h3><dl class="specs">' +
      "<dt>Family</dt><dd>" + fam.label + " — " + fam.how + "</dd>" +
      "<dt>Range</dt><dd>" + i.range + "</dd>" +
      "<dt>Tuning</dt><dd>" + i.tuning + "</dd>" +
      "<dt>From</dt><dd>" + i.origin + "</dd>" +
      "</dl></div>");

    // The synthesis recipe, shown honestly as a recipe.
    h.push('<div class="sec recipe-wrap"><h3>The model behind the sound</h3>');
    if (i.voice.engine === "ks") {
      h.push("<p>A Karplus-Strong delay line: a buffer one period long, filled with noise and " +
             "circulated through a lowpass filter. Damping " + i.voice.damping +
             ", pluck brightness " + i.voice.bright + ". Nothing here is a recording — " +
             "this is a string losing its high frequencies one round trip at a time.</p>");
    } else {
      var ps = i.voice.partials;
      var max = Math.max.apply(null, ps.map(function (p) { return p[1]; }));
      h.push("<p>A stack of " + ps.length + " partials at " +
             ps.map(function (p) { return p[0]; }).join(" : ") +
             " times the fundamental, each with its own decay rate.</p>");
      h.push('<div class="recipe">');
      ps.forEach(function (p) {
        h.push('<div style="height:' + Math.max(3, (p[1] / max) * 100) + '%;background:' +
               fam.color + '"><span>' + p[0] + "×</span></div>");
      });
      h.push("</div>");
    }
    h.push("</div>");

    if (i.caveat) {
      h.push('<div class="caveat"><b>Where this model is faking it.</b> ' + i.caveat + "</div>");
    }

    elCard.innerHTML = h.join("");
    wireCard(base);
    startScope();
  }

  function wireCard(base) {
    var i = current;
    elCard.querySelectorAll(".controls button").forEach(function (b) {
      b.addEventListener("click", function () {
        var act = b.dataset.act;
        if (act === "stop") { S.stopAll(); return; }
        S.stopAll();
        if (act === "note") playMidi(base);
        if (act === "scale") playScale(base);
        if (act === "phrase") playPhrase(base);
      });
    });
    elCard.querySelectorAll(".keys button").forEach(function (b) {
      var fire = function (e) { e.preventDefault(); playMidi(+b.dataset.midi, b); };
      b.addEventListener("pointerdown", fire);
    });
  }

  function flash(el) {
    if (!el) return;
    el.classList.add("lit");
    setTimeout(function () { el.classList.remove("lit"); }, 160);
  }

  function playMidi(m, el) {
    S.play(current, S.midiToFreq(m), noteLen(current));
    flash(el);
    var n = document.getElementById("scopeNote");
    if (n) n.textContent = current.name + " · " + noteName(m);
  }

  function playScale(base) {
    var steps = current.scaleOverride || [0,2,4,5,7,9,11,12];
    var gap = current.voice.engine === "inharmonic" ? 1.1 : 0.42;
    steps.forEach(function (s, idx) {
      S.play(current, S.midiToFreq(base + s), noteLen(current), idx * gap, 0.9);
    });
    var n = document.getElementById("scopeNote");
    if (n) n.textContent = current.name + " · scale";
  }

  function playPhrase(base) {
    var beat = 0.52, t = 0;
    current.phrase.forEach(function (p) {
      S.play(current, S.midiToFreq(base + p[0]), Math.min(noteLen(current), p[1] * beat + 1.1), t, 0.95);
      t += p[1] * beat;
    });
    var n = document.getElementById("scopeNote");
    if (n) n.textContent = current.name + " · phrase";
  }

  /* ----------------------------------------------------------- scope */

  function startScope() {
    if (rafId) cancelAnimationFrame(rafId);
    var cv = document.getElementById("scope");
    if (!cv) return;
    var ctx = cv.getContext("2d");
    var fam = FAMILIES[current.family];

    function frame() {
      rafId = requestAnimationFrame(frame);
      var w = cv.clientWidth, hh = cv.clientHeight;
      if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; }
      ctx.clearRect(0, 0, w, hh);

      // Centre line, always, so silence still looks like an instrument at rest.
      ctx.strokeStyle = "#1b2740"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, hh / 2); ctx.lineTo(w, hh / 2); ctx.stroke();

      var an = S.analyser();
      if (!an) return;
      var n = an.fftSize, buf = new Uint8Array(n);
      an.getByteTimeDomainData(buf);

      ctx.strokeStyle = fam.color; ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (var x = 0; x < w; x++) {
        var v = buf[Math.floor(x / w * n)] / 128 - 1;
        var y = hh / 2 + v * (hh / 2 - 4);
        x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();

      // Spectrum, faint, along the bottom.
      var fb = new Uint8Array(an.frequencyBinCount);
      an.getByteFrequencyData(fb);
      var bars = 72;
      ctx.fillStyle = fam.color + "33";
      for (var b = 0; b < bars; b++) {
        var mag = fb[Math.floor(Math.pow(b / bars, 1.7) * (an.frequencyBinCount * 0.5))] / 255;
        var bh = mag * hh * 0.42;
        ctx.fillRect(b * (w / bars), hh - bh, (w / bars) - 1.5, bh);
      }
    }
    frame();
  }

  /* ------------------------------------------------------------ boot */

  document.getElementById("tabs").querySelectorAll("button").forEach(function (b) {
    b.addEventListener("click", function () {
      mode = b.dataset.mode;
      document.getElementById("tabs").querySelectorAll("button").forEach(function (o) {
        o.classList.toggle("on", o === b);
      });
      drawList();
    });
  });

  window.addEventListener("keydown", function (e) {
    if (e.key === " " && current) { e.preventDefault(); S.stopAll(); playMidi(BASE[current.id] || 60); }
  });

  select(INSTRUMENTS[0]);
})();
