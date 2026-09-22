/* =====================================================================
   A small software synthesiser. No samples, no oscillator nodes —
   every note is rendered sample by sample into an AudioBuffer and then
   played once. That is slower per note than wiring up Web Audio nodes,
   and it buys complete freedom: Karplus-Strong delay lines, per-partial
   decay rates, stretched inharmonic overtones and swept formants are all
   just arithmetic in a loop.

   A note is 1–5 seconds, so a buffer is a few hundred thousand samples
   and renders in a couple of milliseconds. Cheap enough to do on click.

   Three engines:

     ks          a plucked string, simulated rather than imitated: a
                 buffer one period long, filled with noise, circulated
                 through a lowpass. Each lap loses a little more of the
                 top end, which is exactly what a real string does.
     additive    a stack of sine partials, each with its own amplitude
                 and its own decay rate, plus optional noise, vibrato,
                 stiffness and level-dependent brightness.
     inharmonic  the same, with partial ratios that are not whole
                 numbers, so no pitch emerges at all.
   ===================================================================== */
(function () {
  "use strict";

  var ctx = null, master = null, analyser = null;

  function audio() {
    if (!ctx) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
      master = ctx.createGain();
      master.gain.value = 0.9;
      analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.72;
      master.connect(analyser);
      analyser.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  /* ------------------------------------------------------ primitives */

  // One-pole lowpass, used for the string loop and for noise colouring.
  function onePole(x, state, coef) { return state + coef * (x - state); }

  // Amplitude envelope: a short attack so nothing clicks, then whatever
  // the partials' own decays do, then a release ramp to silence.
  function edge(i, n, sr, attack, release) {
    var a = Math.max(1, attack * sr), r = Math.max(1, release * sr);
    var e = 1;
    if (i < a) e *= i / a;
    var tail = n - i;
    if (tail < r) e *= tail / r;
    return e;
  }

  /* ------------------------------------------- engine: plucked string */

  function renderKS(v, freq, dur, sr) {
    var N = Math.max(2, Math.round(sr / freq));
    var line = new Float32Array(N);

    // Excitation. `bright` sets how much top end is in the initial
    // pluck: a fingernail is bright, a thumb pad is dark.
    var s = 0;
    for (var i = 0; i < N; i++) {
      s = onePole(Math.random() * 2 - 1, s, Math.max(0.02, v.bright));
      line[i] = s;
    }

    var n = Math.ceil(dur * sr);
    var out = new Float32Array(n);
    var idx = 0, damp = v.damping == null ? 0.495 : v.damping;
    var decay = v.decay || 3;

    for (var j = 0; j < n; j++) {
      var cur = line[idx];
      var nxt = line[(idx + 1) % N];
      line[idx] = damp * (cur + nxt);          // the lossy round trip
      // `decay` reads as "how long it rings", so it divides rather than
      // multiplies — as a rate it made the harp die faster than the banjo,
      // which is backwards.
      out[j] = cur * Math.exp(-(j / sr) / decay * 1.6);
      idx = (idx + 1) % N;
    }

    // The sitar's bridge re-excites the string within every cycle. This
    // is a waveshaper, which is not that — see the entry's caveat.
    if (v.buzz) {
      for (var k = 0; k < n; k++) {
        var x = out[k] * (1 + v.buzz * 6);
        out[k] = Math.tanh(x) * 0.8;
      }
    }
    return out;
  }

  /* ---------------------------------------------- engine: partial stack */

  function renderPartials(v, freq, dur, sr, inharmonicEngine) {
    var n = Math.ceil(dur * sr);
    var out = new Float32Array(n);
    var stiff = v.inharmonicity || 0;
    var vib = v.vibrato;

    v.partials.forEach(function (p) {
      var mult = p[0], amp = p[1];
      var dec = inharmonicEngine ? (v.decay || 0.5) * (1 + (mult - 1) * 0.18)
                                 : (p[2] == null ? 1 : p[2]);

      // Real strings are stiff, so their overtones run progressively
      // sharp: f_k = k*f0*sqrt(1 + B*k^2). This is why pianos are tuned
      // with stretched octaves.
      var f = freq * mult * Math.sqrt(1 + stiff * mult * mult);
      if (f >= sr * 0.475 || f <= 0) return;

      var phase = Math.random() * Math.PI * 2;
      var base = 2 * Math.PI * f / sr;

      for (var i = 0; i < n; i++) {
        var t = i / sr;
        var env = Math.exp(-dec * t);
        var a = amp;
        // Brass gets brighter as it gets louder, because the wave
        // steepens in the bore. Upper partials follow the envelope
        // more steeply than the fundamental does.
        if (v.brightenWithLevel && mult > 1) a *= Math.pow(env, (mult - 1) * 0.22);
        var w = base;
        if (vib && t > vib.onset) {
          var ramp = Math.min(1, (t - vib.onset) * 3);
          w *= 1 + vib.depth * ramp * Math.sin(2 * Math.PI * vib.rate * t);
        }
        phase += w;
        out[i] += a * env * Math.sin(phase);
      }
    });

    // Breath, bow scrape, hammer thump — the unpitched part of the note.
    if (v.noise && v.noise.amount) {
      var st = 0, hpState = 0;
      var coef = Math.min(0.99, (v.noise.hp || 1000) / (sr / 2));
      for (var m = 0; m < n; m++) {
        var w2 = Math.random() * 2 - 1;
        st = onePole(w2, st, coef);
        hpState = w2 - st;                       // highpass = input minus lowpass
        out[m] += hpState * v.noise.amount * Math.exp(-(v.noise.decay || 8) * (m / sr));
      }
    }

    // A tam-tam's energy migrates upward through its modes for seconds
    // after the strike. A rising lowpass is a crude stand-in.
    if (v.bloom) {
      var lp = 0;
      for (var b = 0; b < n; b++) {
        var c = 0.02 + 0.5 * Math.min(1, (b / sr) / 1.6);
        lp = onePole(out[b], lp, c);
        out[b] = lp;
      }
    }

    // The didgeridoo player moves resonances with the tongue. Two swept
    // resonators, not a vocal tract.
    if (v.formant) {
      out = sweepFormants(out, v.formant, sr);
    }
    return out;
  }

  // Two state-variable bandpass resonators whose centres drift.
  function sweepFormants(buf, fm, sr) {
    var n = buf.length, out = new Float32Array(n);
    var l1 = 0, b1 = 0, l2 = 0, b2 = 0;
    for (var i = 0; i < n; i++) {
      var t = i / sr;
      var mod = Math.sin(2 * Math.PI * fm.rate * t);
      var f1 = fm.f1 * (1 + fm.depth * mod);
      var f2 = fm.f2 * (1 - fm.depth * 0.6 * mod);
      var q = 0.18;

      var g1 = 2 * Math.sin(Math.PI * Math.min(f1, sr * 0.45) / sr);
      l1 += g1 * b1; var h1 = buf[i] - l1 - q * b1; b1 += g1 * h1;

      var g2 = 2 * Math.sin(Math.PI * Math.min(f2, sr * 0.45) / sr);
      l2 += g2 * b2; var h2 = buf[i] - l2 - q * b2; b2 += g2 * h2;

      out[i] = buf[i] * 0.45 + b1 * 0.5 + b2 * 0.28;
    }
    return out;
  }

  /* ------------------------------------------------------------ render */

  var cache = {};

  function render(inst, freq, dur) {
    var a = audio();
    if (!a) return null;
    var sr = a.sampleRate;
    var key = inst.id + "@" + freq.toFixed(2) + "@" + dur;
    if (cache[key]) return cache[key];

    var v = inst.voice, data;
    if (v.engine === "ks") data = renderKS(v, freq, dur, sr);
    else data = renderPartials(v, freq, dur, sr, v.engine === "inharmonic");

    // Normalise, then apply the top-and-tail ramp so nothing clicks.
    var peak = 0;
    for (var i = 0; i < data.length; i++) { var x = Math.abs(data[i]); if (x > peak) peak = x; }
    var g = peak > 0 ? 0.82 / peak : 1;
    for (var j = 0; j < data.length; j++) {
      data[j] = Math.tanh(data[j] * g) * edge(j, data.length, sr, v.attack || 0.004, v.release || 0.12);
    }

    var buf = a.createBuffer(1, data.length, sr);
    buf.copyToChannel ? buf.copyToChannel(data, 0) : buf.getChannelData(0).set(data);
    // Keep the cache small; these are megabytes each.
    var keys = Object.keys(cache);
    if (keys.length > 40) delete cache[keys[0]];
    cache[key] = buf;
    return buf;
  }

  var voices = [];

  function play(inst, freq, dur, when, gain) {
    var a = audio();
    if (!a) return;
    var buf = render(inst, freq, dur);
    if (!buf) return;
    var src = a.createBufferSource();
    src.buffer = buf;
    var g = a.createGain();
    g.gain.value = gain == null ? 1 : gain;
    src.connect(g); g.connect(master);
    src.start(a.currentTime + (when || 0));
    voices.push(src);
    src.onended = function () {
      var i = voices.indexOf(src);
      if (i >= 0) voices.splice(i, 1);
    };
    return src;
  }

  function stopAll() {
    voices.slice().forEach(function (s) { try { s.stop(); } catch (e) {} });
    voices.length = 0;
  }

  function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  window.Synth = {
    audio: audio, play: play, stopAll: stopAll, render: render,
    midiToFreq: midiToFreq,
    analyser: function () { return analyser; },
    ready: function () { return !!ctx; }
  };
})();
