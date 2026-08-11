import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm";

// ---- DOM references ----
const videoEl = document.getElementById("webcam");
const canvasEl = document.getElementById("overlay");
const ctx = canvasEl.getContext("2d");

const noteDisplayEl = document.getElementById("noteDisplay");
const centsDisplayEl = document.getElementById("centsDisplay");
const volumeBarEls = Array.from(document.querySelectorAll(".vol-bar"));
const startOverlayEl = document.getElementById("startOverlay");

const helpButton = document.getElementById("helpButton");
const helpModal = document.getElementById("helpModal");
const closeHelp = document.getElementById("closeHelp");

// ---- Pitch mapping ----
// Screen x position (mirrored, so moving your hand right raises pitch)
// maps exponentially across three octaves, like a theremin's antenna field.
const PITCH_MIN_HZ = 130.81; // C3
const PITCH_OCTAVES = 3;     // up to C6

// Horizontal dead margins so the full range is reachable without
// pushing your hand off camera.
const X_MARGIN = 0.08;

function getPitchFromScreenX(landmarks) {
  const wrist = landmarks[0];
  // Landmark x is in unmirrored video space; the view is mirrored.
  const screenX = 1 - wrist.x;
  const t = Math.max(0, Math.min(1, (screenX - X_MARGIN) / (1 - 2 * X_MARGIN)));
  return PITCH_MIN_HZ * Math.pow(2, PITCH_OCTAVES * t);
}

// ---- Volume from height (same feel as Gesture Synth) ----
function getVolumeFromHeight(landmarks) {
  const wrist = landmarks[0];
  const TOP = 0.05;
  const BOTTOM = 0.95;

  const clamped = Math.max(TOP, Math.min(BOTTOM, wrist.y));
  const t = (clamped - TOP) / (BOTTOM - TOP);
  return 1 - t;
}

const DEFAULT_VOLUME = 0.75; // used when no volume hand is in view

function updateVolumeMeter(volume01) {
  const litCount = Math.round(volume01 * volumeBarEls.length);
  volumeBarEls.forEach((bar) => {
    const index = Number(bar.dataset.index);
    bar.classList.toggle("lit", index >= volumeBarEls.length - litCount);
  });
}

// ---- Note name / cents readout ----
const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

function describePitch(freq) {
  const midi = 69 + 12 * Math.log2(freq / 440);
  const nearest = Math.round(midi);
  const cents = Math.round((midi - nearest) * 100);
  const name = NOTE_NAMES[((nearest % 12) + 12) % 12];
  const octave = Math.floor(nearest / 12) - 1;
  return { label: `${name}${octave}`, cents };
}

// ---- Theremin voice: one always-running oscillator, gain-gated ----
const toneSelectEl = document.getElementById("toneSelect");

class ThereminVoice {
  constructor() {
    this.ctx = null;
    this.osc = null;
    this.filter = null;
    this.gain = null;
  }

  ensureContext() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 3000;
    this.filter.Q.value = 0.5;

    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0;

    this.osc = this.ctx.createOscillator();
    this.osc.type = toneSelectEl.value;
    this.osc.frequency.value = PITCH_MIN_HZ;

    this.osc.connect(this.filter);
    this.filter.connect(this.gain);
    this.gain.connect(this.ctx.destination);
    this.osc.start();
  }

  setPitch(freq) {
    if (!this.ctx) return;
    // Short time constant = continuous glide without zipper noise
    this.osc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.03);
  }

  setVolume(volume01) {
    if (!this.ctx) return;
    const clamped = Math.max(0, Math.min(1, volume01));
    this.gain.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.05);
  }

  setWaveform(type) {
    if (this.osc) this.osc.type = type;
  }
}

const voice = new ThereminVoice();

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

// Glowing vertical line at the pitch hand's position; thickness follows volume.
function drawPitchLine(pitchLandmarks, volume01, canvasWidth, canvasHeight) {
  if (!pitchLandmarks) return;

  const srcW = videoEl.videoWidth;
  const srcH = videoEl.videoHeight;
  if (!srcW || !srcH) return;

  const { sx, sWidth } = computeCoverRect(srcW, srcH, canvasWidth, canvasHeight);
  const wrist = pitchLandmarks[0];
  const videoPx = wrist.x * srcW;
  const canvasX = canvasWidth - ((videoPx - sx) / sWidth) * canvasWidth; // mirrored

  ctx.save();
  ctx.strokeStyle = `rgba(126, 200, 227, ${0.25 + volume01 * 0.6})`;
  ctx.lineWidth = 1 + volume01 * 6;
  ctx.shadowBlur = 8 + volume01 * 18;
  ctx.shadowColor = "rgba(126, 200, 227, 0.8)";
  ctx.beginPath();
  ctx.moveTo(canvasX, 0);
  ctx.lineTo(canvasX, canvasHeight);
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
  let cachedLeftLandmarks = null;
  let cachedRightLandmarks = null;

  function loop() {
    const timestampNow = performance.now();

    if (videoEl.currentTime !== lastVideoTime) {
      lastVideoTime = videoEl.currentTime;

      const results = handLandmarker.detectForVideo(videoEl, timestampNow);

      drawFrame(results, canvasEl.width, canvasEl.height);

      cachedLeftLandmarks = null;
      cachedRightLandmarks = null;

      results.landmarks.forEach((landmarks, i) => {
        const handedness = results.handedness[i][0].categoryName;
        if (handedness === "Left") cachedLeftLandmarks = landmarks;
        if (handedness === "Right") cachedRightLandmarks = landmarks;
      });
    }

    // Right hand = pitch. If only the left hand is up, it plays pitch instead,
    // so the theremin works one-handed either way.
    const pitchLandmarks = cachedRightLandmarks || cachedLeftLandmarks;
    const volumeLandmarks = cachedRightLandmarks ? cachedLeftLandmarks : null;

    if (pitchLandmarks) {
      const freq = getPitchFromScreenX(pitchLandmarks);
      const volume = volumeLandmarks
        ? getVolumeFromHeight(volumeLandmarks)
        : DEFAULT_VOLUME;

      voice.setPitch(freq);
      voice.setVolume(volume);
      updateVolumeMeter(volume);
      drawPitchLine(pitchLandmarks, volume, canvasEl.width, canvasEl.height);

      const { label, cents } = describePitch(freq);
      noteDisplayEl.textContent = label;
      centsDisplayEl.textContent =
        cents === 0 ? "in tune" : `${cents > 0 ? "+" : ""}${cents}¢`;
    } else {
      voice.setVolume(0);
      updateVolumeMeter(0);
      noteDisplayEl.textContent = "--";
      centsDisplayEl.textContent = "";
    }

    requestAnimationFrame(loop);
  }

  loop();
}

main().catch((err) => console.error(err));
