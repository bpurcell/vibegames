import JSZip from "jszip";
import { shots, coverage } from "./shots";
import type { Session } from "./types";
export const presets = [
  {
    id: "universal",
    label: "Universal",
    description: "Every captured reference, organized by category.",
    ids: null,
  },
  {
    id: "higgsfield",
    label: "Higgsfield",
    description: "A compact selection of portraits and full-body references.",
    ids: ["front-neutral", "left-45", "right-45", "smile", "full-front"],
  },
  {
    id: "runway",
    label: "Runway",
    description: "Front, three-quarter, expression, and body references.",
    ids: ["front-neutral", "left-45", "right-45", "serious", "full-front"],
  },
  {
    id: "kling",
    label: "Kling",
    description: "A focused set of front-facing and three-quarter references.",
    ids: ["front-neutral", "left-45", "right-45", "smile", "upper-front"],
  },
];
export function prompt(session: Session, provider: string) {
  return `Identity reference guidance — ${provider}

Use the attached source photographs as identity references for the same person. Preserve facial structure, skin tone, hair, and distinguishing features. Keep the person's natural appearance consistent across shots. Do not infer traits absent from the references.

User-provided appearance notes (optional):
${session.details || "None supplied."}

Describe the desired scene, clothing, lighting, camera, and action separately. Select the references supported by your chosen model and current interface. These are organizational presets, not verified provider specifications or a guarantee of compatibility.
`;
}
export async function buildPack(session: Session, presetId: string) {
  const preset = presets.find((p) => p.id === presetId);
  if (!preset) throw new Error("Unknown export preset");
  const selected = shots.filter(
    (s) => session.photos[s.id] && (!preset.ids || preset.ids.includes(s.id)),
  );
  if (!selected.length)
    throw new Error("Capture or import a photo included in this preset first.");
  const zip = new JSZip();
  const root = zip.folder("identity-pack")!;
  const images = await Promise.all(
    selected.map(async (s) => {
      const p = session.photos[s.id];
      const extension =
        p.blob.type === "image/png"
          ? "png"
          : p.blob.type === "image/webp"
            ? "webp"
            : "jpg";
      const filename = `${s.group}/${s.id}.${extension}`;
      root.file(filename, await p.blob.arrayBuffer());
      return {
        filename,
        shotId: s.id,
        category: s.group,
        width: p.width,
        height: p.height,
        capturedAt: p.createdAt,
        source: p.source,
        quality: p.quality,
      };
    }),
  );
  root.file(
    "manifest.json",
    JSON.stringify(
      {
        packVersion: "1.0.0",
        sessionId: session.id,
        name: session.name,
        captureTimestamp: session.createdAt,
        exportedAt: new Date().toISOString(),
        preset: preset.id,
        identityDetails: session.details,
        coverage: coverage(session),
        exportedShotIds: selected.map((s) => s.id),
        missingPresetShots:
          preset.ids?.filter((id) => !session.photos[id]) ??
          coverage(session).missing,
        images,
        notes:
          "Source photographs. No synthetic features, retouching, or appearance alterations. Metrics are heuristic; null means unavailable. Obstruction and body pose are not assessed.",
      },
      null,
      2,
    ),
  );
  root.file(
    "identity-description.txt",
    `${session.name}

${session.details || "No identity details supplied."}

Only source photographs. No generated identity assets.
`,
  );
  for (const p of presets)
    root.file(`prompts/${p.id}.txt`, prompt(session, p.label));
  return zip.generateAsync({ type: "blob", compression: "STORE" });
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
