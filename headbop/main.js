import { PoseLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm";

// ---- DOM references ----
const videoEl = document.getElementById("webcam");
const canvasEl = document.getElementById("overlay");
const ctx = canvasEl.getContext("2d");

const startOverlayEl = document.getElementById("startOverlay");
const sensitivitySelectEl = document.getElementById("sensitivitySelect");

const helpButton = document.getElementById("helpButton");
const helpModal = document.getElementById("helpModal");
const closeHelp = document.getElementById("closeHelp");

// ---- Pose landmark indices ----
const NOSE = 0;
const LEFT_EAR = 7;
const RIGHT_EAR = 8;
const LEFT_WRIST = 15;
const RIGHT_WRIST = 16;

const VISIBLE = 0.5; // minimum landmark visibility score

// ---- Audio ----
let audioCtx = null;
let masterGain = null;

function ensureAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.9;
  masterGain.connect(audioCtx.destination);
  handVoices.forEach((v) => v.ensure());
}

// Synthesized bass drum for head bobs
function playKick() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;

  // Body: sine pitch-drop 150 -> 45 Hz, the classic synth kick
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  gain.gain.setValueAtTime(1, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(t);
  osc.stop(t + 0.4);

  // Beater click: tiny square blip for punch
  const click = audioCtx.createOscillator();
  const clickGain = audioCtx.createGain();
  click.type = "square";
  click.frequency.value = 1200;
  clickGain.gain.setValueAtTime(0.25, t);
  clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
  click.connect(clickGain);
  clickGain.connect(masterGain);
  click.start(t);
  click.stop(t + 0.03);
}

// ---- Kid theremin: hands play a pentatonic scale ----
// C major pentatonic, two octaves: no wrong notes, everything
// sounds good over the drum.
const PENTA_MIDI = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84]; // C4..C6
const NOTE_COUNT = PENTA_MIDI.length;

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// One rainbow hue per scale note (bottom red -> top violet)
function noteHue(i) {
  return (i / NOTE_COUNT) * 300;
}

// Hysteresis so a hand hovering between stripes doesn't trill
const NOTE_SWITCH_THRESHOLD = 0.6;

class HandVoice {
  constructor() {
    this.osc = null;
    this.gain = null;
    this.heldIndex = null;
  }

  ensure() {
    if (this.osc || !audioCtx) return;
    this.gain = audioCtx.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(masterGain);

    this.osc = audioCtx.createOscillator();
    this.osc.type = "triangle";
    this.osc.frequency.value = midiToFreq(PENTA_MIDI[0]);
    this.osc.connect(this.gain);
    this.osc.start();
  }

  // canvasFrac: 0 at top of screen, 1 at bottom. Always tracks the
  // aimed note; only sounds continuously when audible is true
  // (bounce mode aims silently and plucks on the bob instead).
  play(canvasFrac, audible) {
    const rawIndex = (1 - canvasFrac) * NOTE_COUNT - 0.5;
    if (
      this.heldIndex === null ||
      Math.abs(rawIndex - this.heldIndex) > NOTE_SWITCH_THRESHOLD
    ) {
      this.heldIndex = Math.round(rawIndex);
    }
    this.heldIndex = Math.max(0, Math.min(NOTE_COUNT - 1, this.heldIndex));

    if (!this.osc) return;
    const now = audioCtx.currentTime;
    this.osc.frequency.setTargetAtTime(
      midiToFreq(PENTA_MIDI[this.heldIndex]), now, 0.03
    );
    this.gain.gain.setTargetAtTime(audible ? 0.22 : 0, now, 0.05);
  }

  stop() {
    if (!this.osc) return;
    this.gain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.08);
    this.heldIndex = null;
  }
}

const handVoices = [new HandVoice(), new HandVoice()]; // [left, right]

// One-shot plucked note for bounce mode: fires on the head bob
function playPluck(midi) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "triangle";
  osc.frequency.value = midiToFreq(midi);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.35, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(t);
  osc.stop(t + 0.55);
}

// ---- Bounce mode: notes only play on the head bob ----
const bounceModeToggleEl = document.getElementById("bounceModeToggle");
let bounceMode = false;

bounceModeToggleEl.addEventListener("click", () => {
  bounceMode = !bounceMode;
  bounceModeToggleEl.textContent = bounceMode ? "🎵 On Bounce" : "🎵 Always On";
  bounceModeToggleEl.classList.toggle("bounce", bounceMode);
});

// ---- Head-bob detection ----
// Nose y is tracked in normalized video space (0 top, 1 bottom).
// A quick downward move past the velocity threshold fires a hit; the
// trigger re-arms once the head starts moving back up.
let bobThreshold = Number(sensitivitySelectEl.value); // normalized units/sec

sensitivitySelectEl.addEventListener("change", () => {
  bobThreshold = Number(sensitivitySelectEl.value);
});

const HIT_COOLDOWN_MS = 180;
const VEL_SMOOTHING = 0.5; // EMA factor for velocity smoothing

let prevFaceY = null;
let prevFaceTime = null;
let smoothVel = 0;
let armed = true;
let lastHitTime = 0;

function detectBob(faceY, now) {
  if (prevFaceY === null) {
    prevFaceY = faceY;
    prevFaceTime = now;
    return false;
  }

  const dt = (now - prevFaceTime) / 1000;
  if (dt <= 0) return false;

  const rawVel = (faceY - prevFaceY) / dt; // positive = moving down
  smoothVel = smoothVel * (1 - VEL_SMOOTHING) + rawVel * VEL_SMOOTHING;
  prevFaceY = faceY;
  prevFaceTime = now;

  // Re-arm on upward (or stopped) motion after the cooldown
  if (!armed && smoothVel < 0.05 && now - lastHitTime > HIT_COOLDOWN_MS) {
    armed = true;
  }

  if (armed && smoothVel > bobThreshold) {
    armed = false;
    lastHitTime = now;
    return true;
  }

  return false;
}

function resetBobTracking() {
  prevFaceY = null;
  prevFaceTime = null;
  smoothVel = 0;
  armed = true;
}

// ---- Boom visuals ----
const ripples = []; // { x, y, start }
let lastBoomTime = -Infinity;

function spawnBoom(x, y, now) {
  ripples.push({ x, y, start: now });
  if (ripples.length > 8) ripples.shift();
  lastBoomTime = now;
}

const BOOM_COLORS = ["#ff6b35", "#ffd23f", "#ff3f8e", "#35d0ff"];

function drawBooms(now) {
  for (let i = ripples.length - 1; i >= 0; i--) {
    const age = (now - ripples[i].start) / 1000;
    if (age > 0.6) {
      ripples.splice(i, 1);
      continue;
    }
    const progress = age / 0.6;
    const radius = 40 + progress * 260;
    const alpha = 1 - progress;

    ctx.save();
    ctx.strokeStyle = BOOM_COLORS[i % BOOM_COLORS.length];
    ctx.globalAlpha = alpha * 0.9;
    ctx.lineWidth = 10 * (1 - progress) + 2;
    ctx.beginPath();
    ctx.arc(ripples[i].x, ripples[i].y, radius, 0, Math.PI * 2);
    ctx.stroke();

    if (progress < 0.5) {
      ctx.globalAlpha = 1 - progress * 2;
      ctx.font = `bold ${36 + progress * 30}px monospace`;
      ctx.fillStyle = "#ffd23f";
      ctx.textAlign = "center";
      ctx.fillText("BOOM!", ripples[i].x, ripples[i].y - radius - 12);
    }
    ctx.restore();
  }
}

// Big drum at the bottom center that squashes on every hit
function drawDrum(now, canvasWidth, canvasHeight) {
  const sinceHit = (now - lastBoomTime) / 1000;
  const squash = Math.max(0, 1 - sinceHit * 5); // 1 right at hit -> 0
  const scale = 1 + squash * 0.35;

  ctx.save();
  ctx.translate(canvasWidth / 2, canvasHeight - 60);
  ctx.scale(scale, 1 / (1 + squash * 0.2)); // grow wide, squash flat
  ctx.font = "72px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🥁", 0, 0);
  ctx.restore();
}

// Rainbow note stripes: one translucent band per pentatonic note,
// lighting up where hands are playing.
function drawNoteStripes(activeIndices, canvasWidth, canvasHeight) {
  const stripeH = canvasHeight / NOTE_COUNT;
  ctx.save();
  for (let i = 0; i < NOTE_COUNT; i++) {
    const y = canvasHeight - (i + 1) * stripeH;
    const active = activeIndices.includes(i);
    ctx.fillStyle = `hsla(${noteHue(i)}, 85%, 60%, ${active ? 0.4 : 0.07})`;
    ctx.fillRect(0, y, canvasWidth, stripeH);
  }
  ctx.restore();
}

// Glowing bubble at a playing hand
function drawHandBubble(pos, noteIndex) {
  ctx.save();
  const hue = noteHue(noteIndex);
  ctx.shadowBlur = 25;
  ctx.shadowColor = `hsl(${hue}, 85%, 60%)`;
  ctx.fillStyle = `hsla(${hue}, 85%, 65%, 0.9)`;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.font = "20px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🎵", pos.x, pos.y);
  ctx.restore();
}

// Friendly ring around the tracked head
function drawFaceRing(center, radius, now) {
  const sinceHit = (now - lastBoomTime) / 1000;
  const pulse = Math.max(0, 1 - sinceHit * 4);

  ctx.save();
  ctx.strokeStyle = pulse > 0 ? "#ffd23f" : "#ff6b35";
  ctx.lineWidth = 4 + pulse * 6;
  ctx.setLineDash([14, 10]);
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius * (1 + pulse * 0.15), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ---- UI events ----
startOverlayEl.addEventListener("click", () => {
  ensureAudio();
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
  lookaheadMs: 25,
  scheduleAheadSec: 0.1,
  gainNode: null,

  ensureNodes() {
    ensureAudio();
    if (!this.gainNode) {
      this.gainNode = audioCtx.createGain();
      this.gainNode.gain.value = 0.4;
      this.gainNode.connect(audioCtx.destination);
    }
  },

  scheduleClick(beat, time) {
    const osc = audioCtx.createOscillator();
    const env = audioCtx.createGain();

    osc.type = "square";
    osc.frequency.value = beat === 0 ? 1000 : 760;

    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(beat === 0 ? 1 : 0.6, time + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);

    osc.connect(env);
    env.connect(this.gainNode);
    osc.start(time);
    osc.stop(time + 0.06);

    const delayMs = Math.max(0, (time - audioCtx.currentTime) * 1000);
    setTimeout(() => {
      if (!this.isRunning) return;
      beatDotEls.forEach((dot, i) => {
        dot.classList.toggle("active", i === beat && beat !== 0);
        dot.classList.toggle("accent", i === beat && beat === 0);
      });
    }, delayMs);
  },

  scheduler() {
    while (this.nextNoteTime < audioCtx.currentTime + this.scheduleAheadSec) {
      this.scheduleClick(this.currentBeat, this.nextNoteTime);
      this.nextNoteTime += 60 / this.bpm;
      this.currentBeat = (this.currentBeat + 1) % this.beatsPerBar;
    }
  },

  start() {
    this.ensureNodes();
    if (audioCtx.state === "suspended") audioCtx.resume();
    this.isRunning = true;
    this.currentBeat = 0;
    this.nextNoteTime = audioCtx.currentTime + 0.05;
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
  const clamped = metronome.setBpm(Number(bpmInputEl.value) || 90);
  bpmInputEl.value = clamped;
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
// One PoseLandmarker gives us the nose (drum) AND both wrists
// (theremin) in a single inference pass.
async function setupPoseLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
  );
  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numPoses: 1,
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

// Map a normalized video-space landmark to (mirrored) canvas space.
function landmarkToCanvas(lm, canvasWidth, canvasHeight) {
  const srcW = videoEl.videoWidth;
  const srcH = videoEl.videoHeight;
  const { sx, sy, sWidth, sHeight } = computeCoverRect(srcW, srcH, canvasWidth, canvasHeight);
  return {
    x: canvasWidth - ((lm.x * srcW - sx) / sWidth) * canvasWidth, // mirrored
    y: ((lm.y * srcH - sy) / sHeight) * canvasHeight,
  };
}

function drawVideo(canvasWidth, canvasHeight) {
  const srcW = videoEl.videoWidth;
  const srcH = videoEl.videoHeight;
  if (!srcW || !srcH) return;

  const { sx, sy, sWidth, sHeight } = computeCoverRect(srcW, srcH, canvasWidth, canvasHeight);

  ctx.save();
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.translate(canvasWidth, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(videoEl, sx, sy, sWidth, sHeight, 0, 0, canvasWidth, canvasHeight);
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

  const poseLandmarker = await setupPoseLandmarker();

  let lastVideoTime = -1;
  let cachedPose = null;
  let bobFiredThisFrame = false;

  function loop() {
    const timestampNow = performance.now();

    if (videoEl.currentTime !== lastVideoTime) {
      lastVideoTime = videoEl.currentTime;

      const results = poseLandmarker.detectForVideo(videoEl, timestampNow);
      cachedPose = results.landmarks.length > 0 ? results.landmarks[0] : null;

      if (cachedPose && (cachedPose[NOSE].visibility ?? 1) > VISIBLE) {
        if (detectBob(cachedPose[NOSE].y, timestampNow)) {
          playKick();
          bobFiredThisFrame = true;
          const center = landmarkToCanvas(cachedPose[NOSE], canvasEl.width, canvasEl.height);
          spawnBoom(center.x, center.y, timestampNow);
        }
      } else {
        resetBobTracking();
      }
    }

    drawVideo(canvasEl.width, canvasEl.height);

    // Theremin hands: each visible wrist plays a note from its height
    const activeIndices = [];
    const playingHands = []; // { pos, noteIndex } for bubble drawing
    const wristIndices = [LEFT_WRIST, RIGHT_WRIST];

    for (let h = 0; h < 2; h++) {
      const voiceObj = handVoices[h];
      const lm = cachedPose ? cachedPose[wristIndices[h]] : null;

      const inPlay =
        lm &&
        (lm.visibility ?? 1) > VISIBLE &&
        lm.y > 0 && lm.y < 0.9; // near the bottom edge = "hand down", rests

      if (inPlay) {
        const pos = landmarkToCanvas(lm, canvasEl.width, canvasEl.height);
        const frac = Math.max(0, Math.min(1, pos.y / canvasEl.height));
        voiceObj.play(frac, !bounceMode);
        if (voiceObj.heldIndex !== null) {
          activeIndices.push(voiceObj.heldIndex);
          playingHands.push({ pos, noteIndex: voiceObj.heldIndex });
        }
      } else {
        voiceObj.stop();
      }
    }

    // Bounce mode: the bob strums whatever the hands are aiming at
    if (bobFiredThisFrame) {
      if (bounceMode) {
        playingHands.forEach(({ pos, noteIndex }) => {
          playPluck(PENTA_MIDI[noteIndex]);
          spawnBoom(pos.x, pos.y, timestampNow);
        });
      }
      bobFiredThisFrame = false;
    }

    drawNoteStripes(activeIndices, canvasEl.width, canvasEl.height);
    playingHands.forEach(({ pos, noteIndex }) => drawHandBubble(pos, noteIndex));

    if (cachedPose && (cachedPose[NOSE].visibility ?? 1) > VISIBLE) {
      const center = landmarkToCanvas(cachedPose[NOSE], canvasEl.width, canvasEl.height);
      const leftEar = landmarkToCanvas(cachedPose[LEFT_EAR], canvasEl.width, canvasEl.height);
      const rightEar = landmarkToCanvas(cachedPose[RIGHT_EAR], canvasEl.width, canvasEl.height);
      const headRadius = Math.max(
        40,
        Math.hypot(leftEar.x - rightEar.x, leftEar.y - rightEar.y) * 0.9
      );
      drawFaceRing(center, headRadius, timestampNow);
    }

    drawBooms(timestampNow);
    drawDrum(timestampNow, canvasEl.width, canvasEl.height);

    requestAnimationFrame(loop);
  }

  loop();
}

main().catch((err) => console.error(err));
