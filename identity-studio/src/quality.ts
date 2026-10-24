import type { Quality, Vision, Shot, Photo } from "./types";
export function pixelMetrics(
  data: Uint8ClampedArray,
  width: number,
  height: number,
) {
  const gray = new Float64Array(width * height);
  let sum = 0,
    lap = 0,
    lapSq = 0,
    n = 0;
  for (let i = 0; i < gray.length; i++) {
    gray[i] =
      0.2126 * data[i * 4] +
      0.7152 * data[i * 4 + 1] +
      0.0722 * data[i * 4 + 2];
    sum += gray[i];
  }
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const v =
        4 * gray[i] -
        gray[i - 1] -
        gray[i + 1] -
        gray[i - width] -
        gray[i + width];
      lap += v;
      lapSq += v * v;
      n++;
    }
  let hash = "";
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const a =
        gray[
          Math.floor(((y + 0.5) * height) / 8) * width +
            Math.floor(((x + 0.5) * width) / 9)
        ];
      const b =
        gray[
          Math.floor(((y + 0.5) * height) / 8) * width +
            Math.floor(((x + 1.5) * width) / 9)
        ];
      hash += a > b ? "1" : "0";
    }
  return {
    exposure: sum / gray.length,
    sharpness: n ? Math.max(0, lapSq / n - (lap / n) ** 2) : 0,
    hash,
  };
}
export function hashDistance(a: string, b: string) {
  return a.length !== b.length
    ? Infinity
    : [...a].reduce((n, c, i) => n + (c !== b[i] ? 1 : 0), 0);
}
export function alignment(v: Vision | null, shot: Shot) {
  if (shot.manual)
    return { ok: false, message: "Manual framing · use shutter or timer" };
  if (!v)
    return {
      ok: false,
      message: "Face guidance unavailable · manual capture ready",
    };
  if (!v.faceDetected)
    return { ok: false, message: "No face detected · face the camera" };
  if (!v.centered)
    return { ok: false, message: "Center your face in the guide" };
  if ((v.faceSize ?? 0) < 0.23) return { ok: false, message: "Move closer" };
  if ((v.faceSize ?? 0) > 0.72)
    return { ok: false, message: "Move a little farther away" };
  if (v.yaw === null || v.pitch === null)
    return { ok: false, message: "Head angle unavailable · capture manually" };
  if (Math.abs(v.yaw - (shot.yaw ?? 0)) > 15)
    return {
      ok: false,
      message: `Turn ${v.yaw < (shot.yaw ?? 0) ? "left" : "right"} a little more`,
    };
  if (Math.abs(v.pitch - (shot.pitch ?? 0)) > 12)
    return {
      ok: false,
      message:
        v.pitch < (shot.pitch ?? 0)
          ? "Lift your chin slightly"
          : "Lower your chin slightly",
    };
  if (v.eyesOpen !== true)
    return { ok: false, message: "Keep your eyes open and visible" };
  return { ok: true, message: "Aligned · hold still" };
}
export function analyze(
  canvas: HTMLCanvasElement,
  vision: Vision | null,
  shot: Shot,
  existing: Photo[],
): Quality {
  const sample = document.createElement("canvas");
  sample.width = 192;
  sample.height = 192;
  const ctx = sample.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(canvas, 0, 0, 192, 192);
  const m = pixelMetrics(ctx.getImageData(0, 0, 192, 192).data, 192, 192);
  const warnings: string[] = [];
  const resolution = Math.min(canvas.width, canvas.height) >= 720;
  if (!resolution)
    warnings.push(
      "Low resolution: aim for at least 720 pixels on the shorter edge.",
    );
  if (m.exposure < 55)
    warnings.push("Lighting is too dark. Move toward soft daylight.");
  if (m.exposure > 215)
    warnings.push("Lighting is too bright. Avoid direct light.");
  if (m.sharpness < 65)
    warnings.push("Image may be soft. Hold still and clean the lens.");
  if (!shot.manual) {
    const a = alignment(vision, shot);
    if (!a.ok) warnings.push(a.message);
  }
  const duplicate = existing.find(
    (p) => p.shotId !== shot.id && hashDistance(m.hash, p.quality.hash) <= 3,
  );
  if (duplicate)
    warnings.push(
      "Looks similar to another shot. Check that the angle or expression is different.",
    );
  const baseline = existing.find((p) => p.shotId === "front-neutral");
  const lightingDelta = baseline
    ? Math.abs(baseline.quality.exposure - m.exposure)
    : null;
  if (lightingDelta !== null && lightingDelta > 40)
    warnings.push(
      "Lighting differs from your front portrait. Keep the same light source.",
    );
  return {
    ...m,
    resolution,
    warnings,
    vision,
    obstruction: null,
    lightingDelta,
    duplicateOf: duplicate?.shotId ?? null,
  };
}
