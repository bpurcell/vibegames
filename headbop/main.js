import { FaceDetector, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm";

// ---- DOM references ----
const videoEl = document.getElementById("webcam");
const canvasEl = document.getElementById("overlay");
const ctx = canvasEl.getContext("2d");

const startOverlayEl = document.getElementById("startOverlay");
const sensitivitySelectEl = document.getElementById("sensitivitySelect");

const helpButton = document.getElementById("helpButton");
const helpModal = document.getElementById("helpModal");
const closeHelp = document.getElementById("closeHelp");

// ---- Audio: synthesized bass drum ----
let audioCtx = null;
let masterGain = null;

function ensureAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.9;
  masterGain.connect(audioCtx.destination);
}

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

// ---- Head-bob detection ----
// Face center y is tracked in normalized video space (0 top, 1 bottom).
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
async function setupFaceDetector() {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
  );
  return FaceDetector.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
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

// Map a point in source-video pixel space to (mirrored) canvas space.
function videoToCanvas(px, py, canvasWidth, canvasHeight) {
  const srcW = videoEl.videoWidth;
  const srcH = videoEl.videoHeight;
  const { sx, sy, sWidth, sHeight } = computeCoverRect(srcW, srcH, canvasWidth, canvasHeight);
  return {
    x: canvasWidth - ((px - sx) / sWidth) * canvasWidth, // mirrored
    y: ((py - sy) / sHeight) * canvasHeight,
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

// Friendly ring around the tracked face
function drawFaceRing(faceCanvas, radius, now) {
  const sinceHit = (now - lastBoomTime) / 1000;
  const pulse = Math.max(0, 1 - sinceHit * 4);

  ctx.save();
  ctx.strokeStyle = pulse > 0 ? "#ffd23f" : "#ff6b35";
  ctx.lineWidth = 4 + pulse * 6;
  ctx.setLineDash([14, 10]);
  ctx.beginPath();
  ctx.arc(faceCanvas.x, faceCanvas.y, radius * (1 + pulse * 0.15), 0, Math.PI * 2);
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

  const faceDetector = await setupFaceDetector();

  let lastVideoTime = -1;
  let cachedFaceBox = null;

  function loop() {
    const timestampNow = performance.now();

    if (videoEl.currentTime !== lastVideoTime) {
      lastVideoTime = videoEl.currentTime;

      const results = faceDetector.detectForVideo(videoEl, timestampNow);
      cachedFaceBox = results.detections.length > 0
        ? results.detections[0].boundingBox
        : null;

      if (cachedFaceBox) {
        const srcH = videoEl.videoHeight || 1;
        const faceY = (cachedFaceBox.originY + cachedFaceBox.height / 2) / srcH;

        if (detectBob(faceY, timestampNow)) {
          playKick();
          const center = videoToCanvas(
            cachedFaceBox.originX + cachedFaceBox.width / 2,
            cachedFaceBox.originY + cachedFaceBox.height / 2,
            canvasEl.width,
            canvasEl.height
          );
          spawnBoom(center.x, center.y, timestampNow);
        }
      } else {
        resetBobTracking();
      }
    }

    drawVideo(canvasEl.width, canvasEl.height);

    if (cachedFaceBox) {
      const center = videoToCanvas(
        cachedFaceBox.originX + cachedFaceBox.width / 2,
        cachedFaceBox.originY + cachedFaceBox.height / 2,
        canvasEl.width,
        canvasEl.height
      );
      const srcW = videoEl.videoWidth || 1;
      const scale = canvasEl.width / srcW;
      drawFaceRing(center, (cachedFaceBox.width / 2) * scale * 1.25, timestampNow);
    }

    drawBooms(timestampNow);
    drawDrum(timestampNow, canvasEl.width, canvasEl.height);

    requestAnimationFrame(loop);
  }

  loop();
}

main().catch((err) => console.error(err));
