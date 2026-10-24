import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import JSZip from "jszip";
import { newSession, coverage, shots, nextShot } from "../src/shots";
import {
  saveSession,
  listSessions,
  deleteSession,
  deleteAll,
} from "../src/storage";
import { buildPack } from "../src/export";
import { alignment, hashDistance, pixelMetrics } from "../src/quality";
import type { Photo } from "../src/types";
const photo: Photo = {
  shotId: "front-neutral",
  blob: new Blob(["original source bytes"], { type: "image/jpeg" }),
  width: 1920,
  height: 1080,
  createdAt: "2026-01-01T00:00:00Z",
  source: "camera",
  quality: {
    exposure: 125,
    sharpness: 100,
    resolution: true,
    hash: "1010",
    warnings: [],
    vision: null,
    obstruction: null,
    lightingDelta: null,
    duplicateOf: null,
  },
};
beforeEach(() => deleteAll());
describe("session lifecycle", () => {
  it("has 21 essential shots and 4 optional variants", () => {
    expect(shots.filter((s) => !s.optional)).toHaveLength(21);
    expect(new Set(shots.map((s) => s.id)).size).toBe(25);
  });
  it("persists blobs, replaces slots, deletes sessions and all data", async () => {
    const s = newSession();
    s.photos[photo.shotId] = photo;
    await saveSession(s);
    let all = await listSessions();
    expect(await all[0].photos[photo.shotId].blob.text()).toBe(
      "original source bytes",
    );
    s.photos[photo.shotId] = { ...photo, width: 1000 };
    await saveSession(s);
    all = await listSessions();
    expect(Object.keys(all[0].photos)).toHaveLength(1);
    expect(all[0].photos[photo.shotId].width).toBe(1000);
    await deleteSession(s.id);
    expect(await listSessions()).toHaveLength(0);
    await saveSession(newSession());
    await deleteAll();
    expect(await listSessions()).toHaveLength(0);
  });
  it("skipping does not count as coverage and traversal wraps", () => {
    const s = newSession();
    s.skipped = ["left-45"];
    s.photos["front-neutral"] = photo;
    expect(nextShot(s, "front-neutral")).toBe("right-45");
    expect(coverage(s).complete).toBe(1);
    expect(coverage(s).missing).toContain("left-45");
    expect(nextShot(s, "full-three-quarter")).toBe("right-45");
  });
});
describe("quality honesty", () => {
  it("never allows automatic capture without detection or for body shots", () => {
    expect(alignment(null, shots[0]).ok).toBe(false);
    expect(
      alignment(
        {
          faceDetected: true,
          centered: true,
          yaw: 0,
          pitch: 0,
          eyesOpen: true,
          faceSize: 0.4,
        },
        shots[16],
      ).ok,
    ).toBe(false);
  });
  it("requires the right angle, eyes and framing", () => {
    const v = {
      faceDetected: true,
      centered: true,
      yaw: 0,
      pitch: 0,
      eyesOpen: true,
      faceSize: 0.4,
    };
    expect(alignment(v, shots[0]).ok).toBe(true);
    expect(alignment({ ...v, yaw: 40 }, shots[0]).ok).toBe(false);
    expect(alignment({ ...v, eyesOpen: null }, shots[0]).ok).toBe(false);
    expect(alignment({ ...v, faceSize: 0.1 }, shots[0]).message).toBe(
      "Move closer",
    );
  });
  it("identifies flat dark images and hash distance", () => {
    const m = pixelMetrics(new Uint8ClampedArray(16 * 16 * 4), 16, 16);
    expect(m.exposure).toBe(0);
    expect(m.sharpness).toBe(0);
    expect(hashDistance("1010", "1110")).toBe(1);
  });
});
describe("portable pack", () => {
  it("exports original bytes, structured manifest and four prompt files", async () => {
    const s = newSession();
    s.photos[photo.shotId] = photo;
    s.details = "Visible freckles";
    const blob = await buildPack(s, "universal");
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(
      await zip
        .file("identity-pack/portraits/front-neutral.jpg")!
        .async("string"),
    ).toBe("original source bytes");
    const m = JSON.parse(
      await zip.file("identity-pack/manifest.json")!.async("string"),
    );
    expect(m.images[0].quality.obstruction).toBeNull();
    expect(m.identityDetails).toBe("Visible freckles");
    expect(m.images[0].width).toBe(1920);
    expect(
      Object.keys(zip.files).filter((n) => n.endsWith(".txt")),
    ).toHaveLength(5);
  });
  it("preserves imported PNG files and applies preset selections", async () => {
    const s = newSession();
    s.photos["hair"] = {
      ...photo,
      shotId: "hair",
      blob: new Blob(["png"], { type: "image/png" }),
    };
    s.photos["front-neutral"] = photo;
    const zip = await JSZip.loadAsync(
      await (await buildPack(s, "universal")).arrayBuffer(),
    );
    expect(zip.file("identity-pack/variants/hair.png")).not.toBeNull();
    const preset = await JSZip.loadAsync(
      await (await buildPack(s, "runway")).arrayBuffer(),
    );
    expect(preset.file("identity-pack/variants/hair.png")).toBeNull();
  });
  it("rejects empty exports", async () => {
    await expect(buildPack(newSession(), "universal")).rejects.toThrow(
      "Capture or import",
    );
  });
});
