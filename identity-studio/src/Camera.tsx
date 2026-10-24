import { useEffect, useRef, useState } from "react";
import {
  Camera as CameraIcon,
  SwitchCamera,
  Timer,
  ScanFace,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import type { Photo, Shot, Vision } from "./types";
import { alignment, analyze } from "./quality";
import { createDetector, detect } from "./vision";
interface Props {
  shot: Shot;
  photos: Photo[];
  onCapture: (photo: Photo) => Promise<void>;
  onSkip: () => void;
  onError: (message: string) => void;
}
export default function Camera({
  shot,
  photos,
  onCapture,
  onSkip,
  onError,
}: Props) {
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    detector = useRef<FaceLandmarker | null>(null),
    latest = useRef<Vision | null>(null),
    lock = useRef(false);
  const [facing, setFacing] = useState<"user" | "environment">("user"),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [visionStatus, setVisionStatus] = useState("Loading on-device guidance…"),
    [feedback, setFeedback] = useState("Preparing camera…"),
    [auto, setAuto] = useState(false),
    [delay, setDelay] = useState(0),
    [countdown, setCountdown] = useState<number | null>(null),
    [busy, setBusy] = useState(false),
    [voice, setVoice] = useState(false),
    [stability, setStability] = useState(0),
    [angles, setAngles] = useState<Vision | null>(null);
  const action = useRef<(automatic?: boolean) => Promise<void>>(async () => {}),
    autoRef = useRef(false),
    alive = useRef(true),
    shotRef = useRef(shot),
    generation = useRef(0);
  autoRef.current = auto;
  shotRef.current = shot;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      generation.current++;
    };
  }, []);
  useEffect(() => {
    generation.current++;
    setCountdown(null);
    latest.current = null;
    setStability(0);
    if (voice && "speechSynthesis" in window) {
      speechSynthesis.cancel();
      speechSynthesis.speak(new SpeechSynthesisUtterance(shot.instruction));
    }
    return () => {
      if ("speechSynthesis" in window) speechSynthesis.cancel();
    };
  }, [shot.id, voice]);
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError("");
    latest.current = null;
    generation.current++;
    async function start() {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
          throw new Error(
            "Camera access needs HTTPS or localhost. See the README for iPhone setup. You can still import photographs.",
          );
        const s = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play();
          if (!cancelled) setReady(true);
        }
      } catch (e) {
        if (!cancelled)
          setError(
            e instanceof Error
              ? e.message
              : "Unable to open camera. Check browser permissions.",
          );
      }
    }
    void start();
    return () => {
      cancelled = true;
      generation.current++;
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
    };
  }, [facing, retry]);
  useEffect(() => {
    let cancelled = false;
    createDetector()
      .then((d) => {
        if (cancelled) {
          d.close();
          return;
        }
        detector.current = d;
        setVisionStatus("On-device face guidance");
      })
      .catch(() => {
        if (!cancelled)
          setVisionStatus("Face guidance unavailable · manual capture works");
      });
    return () => {
      cancelled = true;
      detector.current?.close();
      detector.current = null;
    };
  }, []);
  action.current = async (automatic = false) => {
    if (lock.current || !ready || !video.current || document.hidden) return;
    lock.current = true;
    setBusy(true);
    const token = generation.current;
    try {
      for (let n = automatic ? 0 : delay; n > 0; n--) {
        if (token !== generation.current || !alive.current) return;
        setCountdown(n);
        await new Promise((r) => setTimeout(r, 1000));
      }
      if (token !== generation.current || !alive.current || !video.current)
        return;
      setCountdown(null);
      const current = shotRef.current;
      // A manual timer may outlast the previous landmark estimate.
      // Analyze the current frame; unavailable results must remain null.
      let capturedVision: Vision | null = null;
      try {
        if (detector.current)
          capturedVision = detect(detector.current, video.current);
      } catch {
        capturedVision = null;
      }
      const v = video.current;
      if (!v.videoWidth) throw new Error("Camera is not ready yet.");
      const c = document.createElement("canvas");
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      c.getContext("2d")!.drawImage(v, 0, 0);
      const blob = await new Promise<Blob>((resolve, reject) =>
        c.toBlob(
          (b) =>
            b ? resolve(b) : reject(new Error("Unable to capture image.")),
          "image/jpeg",
          0.95,
        ),
      );
      if (token !== generation.current || !alive.current) return;
      const quality = analyze(c, capturedVision, current, photos);
      await onCapture({
        shotId: current.id,
        blob,
        width: c.width,
        height: c.height,
        createdAt: new Date().toISOString(),
        source: "camera",
        quality,
      });
    } catch (e) {
      onError(e instanceof Error ? e.message : "Capture failed.");
    } finally {
      lock.current = false;
      if (alive.current) {
        setBusy(false);
        setCountdown(null);
      }
    }
  };
  useEffect(() => {
    if (!ready) return;
    let stableSince = 0,
      lastTime = -1,
      previous: Vision | null = null;
    const id = window.setInterval(() => {
      const v = video.current;
      if (
        !v ||
        v.readyState < 2 ||
        document.hidden ||
        v.currentTime === lastTime ||
        lock.current
      ) {
        stableSince = 0;
        return;
      }
      lastTime = v.currentTime;
      let result: Vision | null = null;
      try {
        if (detector.current) result = detect(detector.current, v);
      } catch {
        setVisionStatus("Face guidance failed · use manual capture");
        detector.current?.close();
        detector.current = null;
      }
      latest.current = result;
      setAngles(result);
      const a = alignment(result, shotRef.current);
      let message = a.message;
      let acceptable = a.ok;
      if (acceptable) {
        const c = document.createElement("canvas");
        c.width = 96;
        c.height = 96;
        c.getContext("2d")!.drawImage(v, 0, 0, 96, 96);
        const q = analyze(c, result, shotRef.current, []);
        if (q.exposure < 55 || q.exposure > 215 || q.sharpness < 65) {
          acceptable = false;
          message =
            q.exposure < 55
              ? "Lighting is too dark"
              : q.exposure > 215
                ? "Lighting is too bright"
                : "Hold still · image may be soft";
        }
      }
      const moving =
        previous &&
        result &&
        (Math.abs((previous.yaw ?? 0) - (result.yaw ?? 0)) > 4 ||
          Math.abs((previous.pitch ?? 0) - (result.pitch ?? 0)) > 4 ||
          Math.abs((previous.faceSize ?? 0) - (result.faceSize ?? 0)) > 0.025);
      previous = result;
      if (!acceptable || moving) {
        stableSince = 0;
        setStability(0);
      } else {
        if (!stableSince) stableSince = performance.now();
        const elapsed = performance.now() - stableSince;
        setStability(Math.min(100, elapsed / 15));
        if (elapsed >= 1500 && autoRef.current) {
          stableSince = 0;
          void action.current(true);
        }
      }
      setFeedback(message);
    }, 250);
    return () => window.clearInterval(id);
  }, [ready, shot.id]);
  return (
    <section className="capture-panel">
      <div className="viewfinder">
        <video
          ref={video}
          muted
          playsInline
          autoPlay
          className={facing === "user" ? "mirrored" : ""}
          aria-label="Live camera preview"
        />
        {!ready && (
          <div className="camera-placeholder">
            <CameraIcon size={40} />
            <h3>{error ? "Camera unavailable" : "Opening your camera"}</h3>
            <p>{error || "Your photographs stay on this device."}</p>
            {error && (
              <button onClick={() => setRetry((x) => x + 1)}>
                Try camera again
              </button>
            )}
          </div>
        )}
        {ready && (
          <>
            <div className="view-top">
              <span className="live">
                <i /> LIVE VIEW
              </span>
              <span>
                {facing === "user" ? "MIRRORED PREVIEW" : "REAR CAMERA"}
              </span>
            </div>
            <div
              className={
                "frame-guide " + (shot.group === "body" ? "body-guide" : "")
              }
            >
              <span />
              <span />
              <span />
              <span />
              {shot.group !== "body" && <div className="face-outline" />}
            </div>
            <div className="guide-label">
              {shot.group === "body"
                ? "Keep your whole frame inside the guide"
                : "Eyes level. Shoulders relaxed."}
            </div>
            <div className="view-bottom">
              <span>
                <ScanFace size={15} />
                {visionStatus}
              </span>
              <span>
                {angles?.yaw != null
                  ? `${Math.round(angles.yaw)}° turn · ${Math.round(angles.pitch ?? 0)}° tilt`
                  : shot.manual
                    ? "MANUAL FRAMING"
                    : "ALIGN TO GUIDE"}
              </span>
            </div>
          </>
        )}
        {countdown !== null && (
          <div className="countdown" aria-live="assertive">
            {countdown}
          </div>
        )}
      </div>
      <div className="camera-feedback" aria-live="polite">
        <i className={stability > 0 ? "good" : ""} />
        {ready ? feedback : "Camera preview will appear above"}
        <div className="stability" style={{ width: `${stability}%` }} />
      </div>
      <div className="capture-controls">
        <button
          className="icon-button"
          aria-label="Switch camera"
          disabled={busy}
          onClick={() =>
            setFacing((x) => (x === "user" ? "environment" : "user"))
          }
        >
          <SwitchCamera />
          <small>Flip</small>
        </button>
        <button
          className="shutter"
          aria-label="Capture photo"
          disabled={!ready || busy}
          onClick={() => void action.current()}
        >
          <span />
        </button>
        <button
          className="icon-button"
          aria-label={`Timer ${delay} seconds`}
          disabled={busy}
          onClick={() => setDelay((x) => (x === 0 ? 3 : x === 3 ? 10 : 0))}
        >
          <Timer />
          <small>{delay ? `${delay}s` : "Timer"}</small>
        </button>
      </div>
      <div className="capture-options">
        <label>
          <input
            type="checkbox"
            checked={auto}
            disabled={!!shot.manual}
            onChange={(e) => setAuto(e.target.checked)}
          />{" "}
          Auto capture {shot.manual ? "unavailable" : ""}
        </label>
        <button
          className="text-button"
          aria-label={voice ? "Turn voice off" : "Turn voice on"}
          onClick={() => setVoice((x) => !x)}
        >
          {voice ? <Volume2 size={16} /> : <VolumeX size={16} />} Voice{" "}
          {voice ? "on" : "off"}
        </button>
        <button className="text-button" onClick={onSkip} disabled={busy}>
          Skip shot →
        </button>
      </div>
      <p className="fine-print">
        Auto capture waits for 1.5 seconds of stable framing. Expressions and
        obstructions need your review. Saved photos are not mirrored.
      </p>
    </section>
  );
}
