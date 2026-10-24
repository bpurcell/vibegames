import { mkdir, cp, writeFile } from "node:fs/promises";
await mkdir("public/models", { recursive: true });
await cp("node_modules/@mediapipe/tasks-vision/wasm", "public/wasm", {
  recursive: true,
});
const url =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const response = await fetch(url);
if (!response.ok) throw new Error(`Model download failed: ${response.status}`);
await writeFile(
  "public/models/face_landmarker.task",
  Buffer.from(await response.arrayBuffer()),
);
console.log(
  "Vision model and WASM saved locally. No remote requests are needed at runtime.",
);
