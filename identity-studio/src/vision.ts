import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import type { Vision } from "./types";
export async function createDetector() {
  const { FaceLandmarker, FilesetResolver } =
    await import("@mediapipe/tasks-vision");
  const files = await FilesetResolver.forVisionTasks(
    `${import.meta.env.BASE_URL}wasm`,
  );
  return FaceLandmarker.createFromOptions(files, {
    baseOptions: {
      modelAssetPath: `${import.meta.env.BASE_URL}models/face_landmarker.task`,
      delegate: "CPU",
    },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  });
}
export function detect(
  detector: FaceLandmarker,
  video: HTMLVideoElement,
): Vision {
  const result = detector.detectForVideo(video, performance.now());
  const points = result.faceLandmarks[0];
  if (!points)
    return {
      faceDetected: false,
      centered: null,
      yaw: null,
      pitch: null,
      eyesOpen: null,
      faceSize: null,
    };
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y);
  const left = Math.min(...xs),
    right = Math.max(...xs),
    top = Math.min(...ys),
    bottom = Math.max(...ys);
  const m = result.facialTransformationMatrixes[0]?.data;
  const scores = result.faceBlendshapes[0]?.categories;
  const blink = (name: string) =>
    scores?.find((x) => x.categoryName === name)?.score;
  const l = blink("eyeBlinkLeft"),
    r = blink("eyeBlinkRight");
  return {
    faceDetected: true,
    centered:
      Math.abs((left + right) / 2 - 0.5) < 0.15 &&
      Math.abs((top + bottom) / 2 - 0.45) < 0.18,
    faceSize: bottom - top,
    yaw: m ? (Math.atan2(-m[8], m[10]) * 180) / Math.PI : null,
    pitch: m
      ? (Math.atan2(m[9], Math.hypot(m[8], m[10])) * 180) / Math.PI
      : null,
    eyesOpen: l !== undefined && r !== undefined ? l < 0.45 && r < 0.45 : null,
  };
}
