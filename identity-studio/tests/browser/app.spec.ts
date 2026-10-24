import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
const JSZip = createRequire(import.meta.url)("jszip") as typeof import("jszip");
import { readFile } from "node:fs/promises";
test("capture, reload, review, retake, export, remove and delete", async ({
  page,
}) => {
  await page.goto("/");
  await page.screenshot({
    path: "test-results/welcome-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Start Capture Session" }).click();
  const capture = page.getByRole("button", {
    name: "Capture photo",
    exact: true,
  });
  await expect(capture).toBeEnabled({ timeout: 30000 });
  await expect(
    page.getByText("On-device face guidance", { exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await page.screenshot({
    path: "test-results/capture-desktop.png",
    fullPage: true,
  });
  await capture.click();
  await expect(
    page.getByRole("heading", { name: "Left three-quarter", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Reference library/ }).click();
  await expect(
    page.getByRole("img", { name: "Front neutral", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Untitled identity/ }).click();
  await expect(
    page.getByRole("img", { name: "Front neutral", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Review Front neutral/ }).click();
  await page.getByRole("button", { name: "Retake photo", exact: true }).click();
  await expect(capture).toBeEnabled();
  await capture.click();
  await page
    .getByRole("button", { name: /Export pack/ })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: "Session name" })
    .fill("Test identity");
  await page.getByRole("heading", { name: "Make it yours" }).click();
  const d = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download reference pack" }).click();
  const file = await d;
  const zip = await JSZip.loadAsync(await readFile((await file.path())!));
  const manifest = JSON.parse(
    await zip.file("identity-pack/manifest.json")!.async("string"),
  );
  expect(manifest.name).toBe("Test identity");
  expect(manifest.images).toHaveLength(1);
  expect(manifest.images[0].width).toBeGreaterThan(0);
  await page.getByRole("button", { name: /Reference library/ }).click();
  await page.getByRole("button", { name: /Review Front neutral/ }).click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Front neutral", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: /Export pack/ })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Delete session", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(
    page.getByRole("button", { name: "Start Capture Session" }),
  ).toBeVisible();
});
test("mobile layout and imported photo survives reload", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.screenshot({
    path: "test-results/welcome-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Start Capture Session" }).click();
  await page.getByRole("button", { name: /Reference library/ }).click();
  await page.getByLabel("Import photograph file").setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      await page.evaluate(() => {
        const c = document.createElement("canvas");
        c.width = 800;
        c.height = 1000;
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = "#b9c9ab";
        ctx.fillRect(0, 0, 800, 1000);
        return c.toDataURL("image/png").split(",")[1];
      }),
      "base64",
    ),
  });
  await expect(
    page.getByRole("img", { name: "Front neutral", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/library-mobile.png",
    fullPage: true,
  });
  await page.reload();
  await page.getByRole("button", { name: /Untitled identity/ }).click();
  await expect(
    page.getByRole("img", { name: "Front neutral", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("camera denial leaves import accessible", async ({ browser }) => {
  const context = await browser.newContext({ permissions: [] });
  const page = await context.newPage();
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Permission denied", "NotAllowedError");
    };
  });
  await page.goto("http://localhost:5173");
  await page.getByRole("button", { name: "Start Capture Session" }).click();
  await expect(
    page.getByRole("heading", { name: "Camera unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Capture photo", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: /Reference library/ }).click();
  await expect(
    page.getByRole("button", { name: "Import photograph", exact: true }),
  ).toBeVisible();
  await context.close();
});

test("timer cancellation and unavailable detection cannot auto capture", async ({
  page,
}) => {
  await page.route("**/models/face_landmarker.task", (route) => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "Start Capture Session" }).click();
  await expect(
    page.getByRole("button", { name: "Capture photo", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByText("Face guidance unavailable · manual capture works", {
      exact: true,
    }),
  ).toBeVisible({ timeout: 30000 });
  await page.getByLabel("Auto capture", { exact: false }).check();
  await page.waitForTimeout(2000);
  await expect(
    page.getByRole("heading", { name: "Front neutral", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Timer 0 seconds", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Capture photo", exact: true })
    .click();
  await expect(page.locator(".countdown")).toHaveText("3");
  await page.getByRole("button", { name: /Reference library/ }).click();
  await page.waitForTimeout(3200);
  await expect(
    page.getByRole("img", { name: "Front neutral", exact: true }),
  ).toHaveCount(0);
});
