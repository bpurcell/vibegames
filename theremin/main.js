import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm";

// ---- DOM references ----
const videoEl = document.getElementById("webcam");
const canvasEl = document.getElementById("overlay");
const ctx = canvasEl.getContext("2d");

const noteDisplayEl = document.getElementById("noteDisplay");
const chordLabelEl = document.getElementById("chordLabel");
const filterDisplayEl = document.getElementById("filterDisplay");
const volumeBarEls = Array.from(document.querySelectorAll(".vol-bar"));
const startOverlayEl = document.getElementById("startOverlay");

const helpButton = document.getElementById("helpButton");
const helpModal = document.getElementById("helpModal");
const closeHelp = document.getElementById("closeHelp");

// ---- Finger landmark indices ----
const FINGERS = {
  index:  { pip: 6, tip: 8 },
  middle: { pip: 10, tip: 12 },
  ring:   { pip: 14, tip: 16 },
  pinky:  { pip: 18, tip: 20 },
};

function isFingerExtended(landmarks, name) {
  const { pip, tip } = FINGERS[name];
  return landmarks[tip].y < landmarks[pip].y;
}

function countExtendedFingers(landmarks) {
  return ["index", "middle", "ring", "pinky"]
    .filter((name) => isFingerExtended(landmarks, name))
    .length;
}

// ---- Pitch mapping: hand HEIGHT -> chromatic note (standard tuning) ----
// Higher hand = higher note. Range C3..C6, one key slot per semitone,
// aligned with the on-screen keyboard strip.
const MIDI_LOW = 48;   // C3
const MIDI_RANGE = 36; // 3 octaves up to C6
const NOTE_COUNT = MIDI_RANGE + 1;

// Hysteresis: the held note only changes once the raw pitch drifts
// more than this many semitones away, so hand jitter at a key
// boundary doesn't cause trills.
const NOTE_SWITCH_THRESHOLD = 0.6;

let heldMidi = null;

// Palm center: wrist + the four finger-base knuckles averaged. More
// stable than the wrist alone and sits in the middle of the hand.
const PALM_POINTS = [0, 5, 9, 13, 17];

function getPalmCenter(landmarks) {
  let x = 0, y = 0;
  for (const i of PALM_POINTS) {
    x += landmarks[i].x;
    y += landmarks[i].y;
  }
  return { x: x / PALM_POINTS.length, y: y / PALM_POINTS.length };
}

// Palm center in canvas space (same cover-crop mapping the video
// drawing uses), so the pitch always matches the key under your hand.
function handCanvasPos(landmarks, canvasWidth, canvasHeight) {
  const srcW = videoEl.videoWidth;
  const srcH = videoEl.videoHeight;
  if (!srcW || !srcH) return null;

  const { sx, sy, sWidth, sHeight } = computeCoverRect(srcW, srcH, canvasWidth, canvasHeight);
  const palm = getPalmCenter(landmarks);
  const canvasX = canvasWidth - ((palm.x * srcW - sx) / sWidth) * canvasWidth; // mirrored
  const canvasY = ((palm.y * srcH - sy) / sHeight) * canvasHeight;
  return { x: canvasX, y: canvasY };
}

// ---- Right-hand tilt (from Gesture Synth): drives the filter sweep ----
function getHandHorizontalTilt(landmarks, handedness) {
  if (!landmarks || typeof landmarks.length === "undefined" || landmarks.length < 18) {
    return 0;
  }

  try {
    const wrist = landmarks[0];
    const middleMcp = landmarks[9];
    const ringMcp = landmarks[13];

    if (!wrist || !middleMcp || !ringMcp) return 0;

    const minX = Math.min(middleMcp.x, ringMcp.x);
    const maxX = Math.max(middleMcp.x, ringMcp.x);

    let tiltFactor = 0;
    // Max travel distance past the boundaries before hitting 100%
    const MAX_TRAVEL = 0.12;

    if (wrist.x < minX) {
      tiltFactor = (wrist.x - minX) / MAX_TRAVEL;
    } else if (wrist.x > maxX) {
      tiltFactor = (wrist.x - maxX) / MAX_TRAVEL;
    }

    tiltFactor = Math.max(-1, Math.min(1, tiltFactor));

    if (handedness === "Right") {
      tiltFactor = -tiltFactor;
    }

    return tiltFactor;
  } catch {
    return 0;
  }
}

function getRawMidiFromCanvasY(canvasY, canvasHeight) {
  const frac = Math.max(0, Math.min(1, canvasY / canvasHeight));
  // Key i's vertical center sits at frac = 1 - (i + 0.5) / NOTE_COUNT
  return MIDI_LOW + (1 - frac) * NOTE_COUNT - 0.5;
}

function quantizePitch(rawMidi) {
  if (heldMidi === null || Math.abs(rawMidi - heldMidi) > NOTE_SWITCH_THRESHOLD) {
    heldMidi = Math.round(rawMidi);
  }
  heldMidi = Math.max(MIDI_LOW, Math.min(MIDI_LOW + MIDI_RANGE, heldMidi));
  return heldMidi;
}

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

function midiToName(midi) {
  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

// ---- Left hand: chord type from finger count ----
// Same finger vocabulary as Gesture Synth's right hand.
const CHORD_TYPES = {
  0: { label: "single note",    intervals: [0] },
  1: { label: "major",          intervals: [0, 4, 7] },
  2: { label: "minor",          intervals: [0, 3, 7] },
  3: { label: "dominant 7th",   intervals: [0, 4, 7, 10] },
  4: { label: "diminished 7th", intervals: [0, 3, 6, 9] },
};

// Chord changes need brief confidence so finger flicker doesn't
// stutter the harmony.
const CHORD_HOLD_TIME_MS = 120;

let stableChordCount = 0;
let candidateChordCount = 0;
let candidateChordSince = 0;

function stabilizeChordCount(rawCount, now) {
  if (rawCount !== candidateChordCount) {
    candidateChordCount = rawCount;
    candidateChordSince = now;
  }
  if (now - candidateChordSince >= CHORD_HOLD_TIME_MS) {
    stableChordCount = candidateChordCount;
  }
  return stableChordCount;
}

// ---- Volume from height ----
function getVolumeFromHeight(landmarks) {
  const wrist = landmarks[0];
  const TOP = 0.05;
  const BOTTOM = 0.95;

  const clamped = Math.max(TOP, Math.min(BOTTOM, wrist.y));
  const t = (clamped - TOP) / (BOTTOM - TOP);
  return 1 - t;
}

const DEFAULT_VOLUME = 0.75; // used when no left hand is in view

function updateVolumeMeter(volume01) {
  const litCount = Math.round(volume01 * volumeBarEls.length);
  volumeBarEls.forEach((bar) => {
    const index = Number(bar.dataset.index);
    bar.classList.toggle("lit", index >= volumeBarEls.length - litCount);
  });
}

// ---- Chord voice: pool of 4 always-running oscillators ----
const toneSelectEl = document.getElementById("toneSelect");
const MAX_VOICES = 4;

class ChordVoice {
  constructor() {
    this.ctx = null;
    this.oscs = [];
    this.oscGains = [];
    this.filter = null;
    this.masterGain = null;
  }

  ensureContext() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 3000;
    this.filter.Q.value = 0.5;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0;

    this.filter.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    for (let i = 0; i < MAX_VOICES; i++) {
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      gain.connect(this.filter);

      const osc = this.ctx.createOscillator();
      osc.type = toneSelectEl.value;
      osc.frequency.value = 220;
      osc.connect(gain);
      osc.start();

      this.oscs.push(osc);
      this.oscGains.push(gain);
    }
  }

  // freqs: 1-4 chord tones; unused oscillators fade to silence.
  setNotes(freqs) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Equal-power-ish share per sounding voice keeps chords from
    // being 4x louder than single notes.
    const share = 1 / Math.sqrt(freqs.length);

    for (let i = 0; i < MAX_VOICES; i++) {
      if (i < freqs.length) {
        this.oscs[i].frequency.setTargetAtTime(freqs[i], now, 0.02);
        this.oscGains[i].gain.setTargetAtTime(share, now, 0.03);
      } else {
        this.oscGains[i].gain.setTargetAtTime(0, now, 0.03);
      }
    }
  }

  setVolume(volume01) {
    if (!this.ctx) return;
    const clamped = Math.max(0, Math.min(1, volume01));
    this.masterGain.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.05);
  }

  // The Gesture Synth "weird modulation": tilt inward for acoustic
  // warmth, outward for a resonant EDM squelch.
  updateFilterSweep(tiltFactor) {
    if (!this.ctx) return;

    let targetFrequency = 3000; // neutral hand = the theremin's open tone
    let targetQ = 0.5;

    if (tiltFactor < 0) {
      // ---- INWARD TILT (Acoustic Warmth) ----
      const intensity = Math.abs(tiltFactor);
      targetFrequency = 3000 - intensity * 2500; // down to a woody 500 Hz
      targetQ = 0.5 + intensity * 1.7;
    } else if (tiltFactor > 0) {
      // ---- OUTWARD TILT (EDM Filter Sweep) ----
      targetFrequency = 3000 + tiltFactor * 3800;
      targetQ = 0.5 + tiltFactor * 4.7; // resonance spike for the squelch
    }

    const now = this.ctx.currentTime;
    this.filter.frequency.setTargetAtTime(targetFrequency, now, 0.04);
    this.filter.Q.setTargetAtTime(targetQ, now, 0.04);
  }

  setWaveform(type) {
    this.oscs.forEach((osc) => { osc.type = type; });
  }
}

const voice = new ChordVoice();

toneSelectEl.addEventListener("change", () => {
  voice.setWaveform(toneSelectEl.value);
});

// ---- Metronome: lookahead-scheduled click track ----
const metronomeToggleEl = document.getElementById("metronomeToggle");
const bpmInputEl = document.getElementById("bpmInput");
const beatDotEls = Array.from(document.querySelectorAll(".beat-dot"));

const metronome = {
  isRunning: false,
  bpm: Number(bpmInputEl.value),
  beatsPerBar: 4,
  nextNoteTime: 0,
  currentBeat: 0,
  timerId: null,
  lookaheadMs: 25,       // how often the scheduler wakes up
  scheduleAheadSec: 0.1, // how far ahead clicks are queued in audio time
  gainNode: null,

  ensureNodes() {
    voice.ensureContext();
    if (!this.gainNode) {
      this.gainNode = voice.ctx.createGain();
      this.gainNode.gain.value = 0.4;
      this.gainNode.connect(voice.ctx.destination);
    }
  },

  scheduleClick(beat, time) {
    const osc = voice.ctx.createOscillator();
    const env = voice.ctx.createGain();

    // Accented downbeat, softer for beats 2-4
    osc.type = "square";
    osc.frequency.value = beat === 0 ? 1000 : 760;

    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(beat === 0 ? 1 : 0.6, time + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);

    osc.connect(env);
    env.connect(this.gainNode);
    osc.start(time);
    osc.stop(time + 0.06);

    // Flash the matching dot when the click actually sounds
    const delayMs = Math.max(0, (time - voice.ctx.currentTime) * 1000);
    setTimeout(() => {
      if (!this.isRunning) return;
      beatDotEls.forEach((dot, i) => {
        dot.classList.toggle("active", i === beat && beat !== 0);
        dot.classList.toggle("accent", i === beat && beat === 0);
      });
    }, delayMs);
  },

  scheduler() {
    while (this.nextNoteTime < voice.ctx.currentTime + this.scheduleAheadSec) {
      this.scheduleClick(this.currentBeat, this.nextNoteTime);
      this.nextNoteTime += 60 / this.bpm;
      this.currentBeat = (this.currentBeat + 1) % this.beatsPerBar;
    }
  },

  start() {
    this.ensureNodes();
    if (voice.ctx.state === "suspended") voice.ctx.resume();
    this.isRunning = true;
    this.currentBeat = 0;
    this.nextNoteTime = voice.ctx.currentTime + 0.05;
    this.timerId = setInterval(() => this.scheduler(), this.lookaheadMs);
    metronomeToggleEl.textContent = "🕰 On";
    metronomeToggleEl.classList.add("running");
  },

  stop() {
    this.isRunning = false;
    clearInterval(this.timerId);
    this.timerId = null;
    beatDotEls.forEach((dot) => dot.classList.remove("active", "accent"));
    metronomeToggleEl.textContent = "🕰 Off";
    metronomeToggleEl.classList.remove("running");
  },

  setBpm(bpm) {
    const clamped = Math.max(40, Math.min(240, bpm));
    this.bpm = clamped;
    return clamped;
  },
};

metronomeToggleEl.addEventListener("click", () => {
  if (metronome.isRunning) {
    metronome.stop();
  } else {
    metronome.start();
  }
});

bpmInputEl.addEventListener("change", () => {
  const clamped = metronome.setBpm(Number(bpmInputEl.value) || 100);
  bpmInputEl.value = clamped;
});

// ---- UI events ----
startOverlayEl.addEventListener("click", () => {
  voice.ensureContext();
  startOverlayEl.style.display = "none";
  canvasEl.classList.remove("dimmed");
});

helpButton.addEventListener("click", () => {
  helpModal.classList.remove("hidden");
});

closeHelp.addEventListener("click", (e) => {
  e.stopPropagation();
  helpModal.classList.add("hidden");
});

helpModal.addEventListener("click", (e) => {
  if (e.target === helpModal) {
    helpModal.classList.add("hidden");
  }
});

// ---- Camera setup ----
async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480 },
    audio: false,
  });
  videoEl.srcObject = stream;
  return new Promise((resolve) => {
    videoEl.onloadedmetadata = () => {
      videoEl.play();
      resolve();
    };
  });
}

// ---- MediaPipe setup ----
async function setupHandLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
  );
  return HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numHands: 2,
  });
}

// Computes a "cover" crop rect in source-video pixel space: the largest
// centered rectangle matching the destination's aspect ratio, so the
// video fills the screen (height fit, width cropped) with zero stretch.
function computeCoverRect(srcW, srcH, dstW, dstH) {
  const srcRatio = srcW / srcH;
  const dstRatio = dstW / dstH;

  if (srcRatio > dstRatio) {
    const sHeight = srcH;
    const sWidth = srcH * dstRatio;
    return { sx: (srcW - sWidth) / 2, sy: 0, sWidth, sHeight };
  } else {
    const sWidth = srcW;
    const sHeight = srcW / dstRatio;
    return { sx: 0, sy: (srcH - sHeight) / 2, sWidth, sHeight };
  }
}

function drawFrame(results, canvasWidth, canvasHeight) {
  const srcW = videoEl.videoWidth;
  const srcH = videoEl.videoHeight;
  if (!srcW || !srcH) return;

  const { sx, sy, sWidth, sHeight } = computeCoverRect(srcW, srcH, canvasWidth, canvasHeight);

  ctx.save();
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.translate(canvasWidth, 0);
  ctx.scale(-1, 1);

  ctx.drawImage(videoEl, sx, sy, sWidth, sHeight, 0, 0, canvasWidth, canvasHeight);

  ctx.fillStyle = "#ffffff80";
  for (const landmarks of results.landmarks) {
    for (const point of landmarks) {
      const videoPx = point.x * srcW;
      const videoPy = point.y * srcH;
      const canvasX = ((videoPx - sx) / sWidth) * canvasWidth;
      const canvasY = ((videoPy - sy) / sHeight) * canvasHeight;

      ctx.beginPath();
      ctx.arc(canvasX, canvasY, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ---- Vertical keyboard strip along the left edge ----
const KEYBOARD_WIDTH = 56;
const BLACK_KEY_PCS = new Set([1, 3, 6, 8, 10]);

function keyCenterY(midi, canvasHeight) {
  const keyH = canvasHeight / NOTE_COUNT;
  return canvasHeight - (midi - MIDI_LOW + 0.5) * keyH;
}

// rootMidi/chordMidis may be null (no pitch hand) -> plain strip.
function drawKeyboard(rootMidi, chordMidis, canvasHeight) {
  const keyH = canvasHeight / NOTE_COUNT;

  ctx.save();
  for (let i = 0; i < NOTE_COUNT; i++) {
    const midi = MIDI_LOW + i;
    const y = canvasHeight - (i + 1) * keyH;
    const isBlack = BLACK_KEY_PCS.has(midi % 12);

    let fill = isBlack ? "rgba(8, 14, 18, 0.8)" : "rgba(255, 255, 255, 0.2)";
    if (chordMidis && chordMidis.includes(midi)) {
      fill = midi === rootMidi
        ? "rgba(126, 200, 227, 0.95)"
        : "rgba(126, 200, 227, 0.45)";
    }

    ctx.fillStyle = fill;
    ctx.fillRect(0, y, KEYBOARD_WIDTH, keyH);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
    ctx.strokeRect(0, y, KEYBOARD_WIDTH, keyH);

    // Label the C that starts each octave
    if (midi % 12 === 0) {
      ctx.fillStyle = midi === rootMidi ? "#08222c" : "rgba(255, 255, 255, 0.85)";
      ctx.font = "bold 11px monospace";
      ctx.fillText(midiToName(midi), 5, y + keyH - 4);
    }
  }
  ctx.restore();
}

// Horizontal glow line snapped to the selected key's center,
// thickness follows volume.
function drawPitchLine(rootMidi, volume01, canvasWidth, canvasHeight) {
  const y = keyCenterY(rootMidi, canvasHeight);

  ctx.save();
  ctx.strokeStyle = `rgba(126, 200, 227, ${0.25 + volume01 * 0.6})`;
  ctx.lineWidth = 1 + volume01 * 5;
  ctx.shadowBlur = 8 + volume01 * 18;
  ctx.shadowColor = "rgba(126, 200, 227, 0.8)";
  ctx.beginPath();
  ctx.moveTo(KEYBOARD_WIDTH, y);
  ctx.lineTo(canvasWidth, y);
  ctx.stroke();
  ctx.restore();
}

// ---- Main loop ----
function resizeCanvas() {
  canvasEl.width = window.innerWidth;
  canvasEl.height = window.innerHeight;
}

async function main() {
  await setupCamera();
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  const handLandmarker = await setupHandLandmarker();

  let lastVideoTime = -1;
  let lastResults = null;
  let cachedLeftLandmarks = null;
  let cachedRightLandmarks = null;

  function loop() {
    const timestampNow = performance.now();

    if (videoEl.currentTime !== lastVideoTime) {
      lastVideoTime = videoEl.currentTime;

      lastResults = handLandmarker.detectForVideo(videoEl, timestampNow);

      cachedLeftLandmarks = null;
      cachedRightLandmarks = null;

      lastResults.landmarks.forEach((landmarks, i) => {
        const handedness = lastResults.handedness[i][0].categoryName;
        if (handedness === "Left") cachedLeftLandmarks = landmarks;
        if (handedness === "Right") cachedRightLandmarks = landmarks;
      });
    }

    // Redraw video + overlays every tick so translucent overlays
    // never stack on an uncleared canvas.
    if (lastResults) {
      drawFrame(lastResults, canvasEl.width, canvasEl.height);
    }

    // RIGHT HAND = PITCH from height (snapped to standard tuning)
    //              + TILT modulates the filter
    // LEFT HAND = CHORD TYPE (fingers) + VOLUME (height)
    const handPos = cachedRightLandmarks
      ? handCanvasPos(cachedRightLandmarks, canvasEl.width, canvasEl.height)
      : null;

    const tilt = cachedRightLandmarks
      ? getHandHorizontalTilt(cachedRightLandmarks, "Right")
      : 0;
    voice.updateFilterSweep(tilt);
    if (filterDisplayEl) {
      const pct = Math.round(tilt * 100);
      filterDisplayEl.textContent = `Filter: ${pct > 0 ? "+" : ""}${pct}%`;
    }

    if (handPos) {
      const rawMidi = getRawMidiFromCanvasY(handPos.y, canvasEl.height);
      const midi = quantizePitch(rawMidi);
      const root = midiToFreq(midi);

      const rawCount = cachedLeftLandmarks
        ? countExtendedFingers(cachedLeftLandmarks)
        : 0;
      const chordCount = stabilizeChordCount(rawCount, timestampNow);
      const chord = CHORD_TYPES[chordCount] || CHORD_TYPES[0];

      const freqs = chord.intervals.map(
        (semi) => root * Math.pow(2, semi / 12)
      );
      const chordMidis = chord.intervals.map((semi) => midi + semi);

      const volume = cachedLeftLandmarks
        ? getVolumeFromHeight(cachedLeftLandmarks)
        : DEFAULT_VOLUME;

      voice.setNotes(freqs);
      voice.setVolume(volume);
      updateVolumeMeter(volume);
      drawKeyboard(midi, chordMidis, canvasEl.height);
      drawPitchLine(midi, volume, canvasEl.width, canvasEl.height);

      noteDisplayEl.textContent = midiToName(midi);
      chordLabelEl.textContent = chord.label;
    } else {
      heldMidi = null;
      voice.setVolume(0);
      updateVolumeMeter(0);
      drawKeyboard(null, null, canvasEl.height);
      noteDisplayEl.textContent = "--";
      chordLabelEl.textContent = "";
    }

    requestAnimationFrame(loop);
  }

  loop();
}

main().catch((err) => console.error(err));
