import { rename } from "node:fs/promises";
await rename(
  new URL("../dist/studio.html", import.meta.url),
  new URL("../dist/index.html", import.meta.url),
);
