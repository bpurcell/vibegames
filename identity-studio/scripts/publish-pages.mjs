import { cp, readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url);
// Only these generated app files are replaced. No workspace navigation is edited.
const targets = ["index.html", "assets", "models", "wasm"];
for (const name of [
  "index.html",
  "models/face_landmarker.task",
  "wasm/vision_wasm_internal.wasm",
]) {
  await readFile(new URL(`dist/${name}`, root));
}
for (const name of targets) {
  const destination = new URL(name, root);
  if (name !== "index.html")
    await rm(destination, { recursive: true, force: true });
  await cp(new URL(`dist/${name}`, root), destination, { recursive: true });
}
console.log(
  `Pages files prepared in ${fileURLToPath(root)}. Commit only Identity Studio and push main.`,
);
