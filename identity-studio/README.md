# Identity Studio

One identity. Every model.

A private, mobile-first React + TypeScript application for creating portable identity reference packs. This directory is independent of the other Vibe Gaming experiments. Nothing is uploaded automatically; there is no backend, analytics, external font, or third-party runtime storage.

## Run locally

Use Node **22.12 or newer** (the workspace has Node 22.17 installed). If your shell defaults to Node 18, run `nvm use` first.

```sh
cd /Users/benningtonpurcell/Documents/GitHub/vibegames/identity-studio
nvm use
npm ci
npm run setup:vision
npm run dev
```

Open **http://localhost:5173** on the Mac. Start Capture Session requests the camera. Opening the welcome page does not. The setup script downloads Google's face model and copies the installed MediaPipe WASM into `public/`. The application subsequently loads these assets from its own origin; images never leave the browser for analysis. If setup is omitted or detection fails, manual capture and imports remain available and face results are marked unavailable.

## Use on iPhone (HTTPS required)

`http://<Mac-IP>:5173` is **not** a secure context on an iPhone. Plain LAN HTTP cannot enable its camera. Either serve the production build from an HTTPS static host, or use a locally trusted certificate:

1. Install `mkcert` with Homebrew (`brew install mkcert`), then run `mkcert -install` on the Mac.
2. Find the Mac's Wi-Fi address with `ipconfig getifaddr en0` (or Network settings).
3. In this directory, run `mkdir -p .cert`, then `mkcert -key-file .cert/key.pem -cert-file .cert/cert.pem localhost 127.0.0.1 YOUR_MAC_LAN_IP`, substituting the actual IP.
4. Transfer **only** `rootCA.pem` from the directory printed by `mkcert -CAROOT` to your own iPhone. Install the profile in Settings → General → VPN & Device Management, then enable full trust in Settings → General → About → Certificate Trust Settings. Never share or transfer `rootCA-key.pem`.
5. Run `npm run dev:https`. Connect the phone to the same Wi-Fi and open `https://YOUR_MAC_LAN_IP:5173` in Safari. Allow the camera when prompted. Allow local network access through the Mac firewall if requested.

Certificate generation and trust installation are intentionally user-managed. Merely dismissing a certificate warning is not a reliable camera setup. Certificates are ignored by Git. Reissue the certificate if your Mac's IP changes. Data belongs to each browser/origin: localhost, LAN IP, HTTP, and HTTPS have separate session stores.

## Capture workflow

- Prepare soft even light, a neutral wall, and an eye-level camera.
- Follow 21 essential shots: seven angles, six expressions, three upper-body views, five full-body views. Four optional slots cover glasses, hair, clothing, and hands.
- Capture manually, select a 3- or 10-second timer, or enable auto capture for supported face views. Auto capture requires acceptable detected framing, estimated angle, open-eye estimate, exposure and sharpness for 1.5 seconds. It is opt-in. Automatic capture uses its own stability delay; the 3/10-second timer applies only to the manual shutter.
- Left/right instructions refer to the subject's own left/right. Front-camera preview is mirrored for usability; stored photographs are unmirrored.
- Profiles, body views, and optional variants use manual/timed capture. No body detector is claimed.
- Optional spoken instructions use the browser speech synthesis engine. Text instructions always remain available.
- Skip moves to the next unfinished essential slot. Skipped slots remain missing in coverage. Use the checklist to revisit any shot.
- In Reference library, inspect an image, retake, remove, or replace it. The import selector assigns JPEG, PNG, or WebP photos to a particular slot and preserves original bytes. HEIC/HEIF should first be converted to JPEG using Photos. Imports are limited to 40 MB / 60 MP each.
- Export accepts incomplete sessions. The manifest lists missing essential and preset shots. Presets are editable in `src/export.ts` and are **suggested selections, not verified provider requirements**.

## What the quality checks actually mean

MediaPipe estimates one face's landmarks, transformation matrix (head yaw/pitch), bounding box, and eye blink blendshapes. Head angles and eye openness are estimates, not calibrated measurements. Extreme angles, glasses, low light, camera perspective and occlusion can reduce reliability. Imported images currently get pixel analysis only, with `vision: null`.

Exposure is mean sampled luminance. Sharpness is sampled Laplacian variance. Lighting consistency compares mean luminance with the front neutral reference. A small difference hash flags near duplicates. These whole-image heuristics can be affected by backgrounds, textures, camera processing and compression; they are review prompts, not certification. Resolution is flagged below 720 pixels on the shorter edge.

Expression accuracy, facial obstruction, identity matching and body pose are **not assessed**. `obstruction: null` is explicit in every manifest. No synthetic features, beautification, background replacement, or automatic appearance alteration occurs. Camera frames are saved at the actual video resolution as JPEG quality 0.95, not at full still-camera sensor resolution. The exported quality record includes raw metrics, warnings, and unavailable fields.

## Storage and deletion

Sessions, notes, metadata, and image Blobs live in IndexedDB (`identity-studio`, version 1). Reload and close/reopen preserve data when browser storage is available. Save failures are surfaced; no success is claimed before the transaction completes. Local browser storage is not an encrypted vault and may be evicted by the OS or browser. Private browsing, clearing site data, or changing origins can remove or hide sessions. Export valuable packs as backups. Downloaded packs are outside the app's storage and must be deleted separately.

Delete Session is on the Export screen. Delete All Data is beside the saved sessions on the welcome screen. Both require an in-app confirmation. Camera tracks stop when leaving capture or switching cameras. Image object URLs are revoked on cleanup.

## Export structure

```text
identity-pack/
  portraits/front-neutral.jpg
  expressions/smile.jpg
  body/full-front.jpg
  variants/hair.png
  manifest.json
  identity-description.txt
  prompts/universal.txt
  prompts/higgsfield.txt
  prompts/runway.txt
  prompts/kling.txt
```

Only captured images selected by a preset are included. Original import file types are preserved. The manifest includes pack version, session and capture timestamps, exported IDs, dimensions, source type, quality metrics, optional notes and coverage. User-entered notes are not inferred from the photos.

## Build and test

```sh
npm test                  # session / IndexedDB / quality / ZIP logic
npx playwright install chromium
npm run test:e2e          # fake-camera browser workflows + mobile viewport
npm run build            # strict TypeScript and Vite production bundle
npm run preview          # built app on http://localhost:4173
```

The browser suite uses synthetic camera input; it does not access your actual webcam or validate landmark accuracy on real people. It covers capture, persistence after reload, retake, import, download/manifest contents, removal, session deletion, mobile overflow, and denied permission. Real iPhone camera permission, portrait orientation, physical left/right angle accuracy and download behavior still need device testing. Detector inference runs on the UI thread, throttled to four times per second; slower devices may benefit from moving it to a worker later.

The Vite build uses relative asset URLs. Serve the contents of `dist/` at any static HTTPS path (for example `/identity-studio/`). Run `setup:vision` before building to include local model assets. This repository uses GitHub Pages from the root of `main`. Run `npm run publish:pages` to build and copy the generated `index.html`, `assets/`, `models/`, and `wasm/` into this directory, then commit only `identity-studio/` and push. The source template is `studio.html`; Vite serves it at `/` during development and emits `index.html` for production. Never edit the generated `index.html` manually.

Live URL: **https://random.bennpurcell.com/identity-studio/**. It is deliberately not linked from the workspace homepage or shared navigation. The URL is public, not access-controlled; captured photos still remain in the visitor’s browser. No personal photographs are included in the repository.

## Architecture

- `src/App.tsx`: session views, library, imports, review dialogs, export controls.
- `src/Camera.tsx`: media lifecycle, overlay, timer, optional voice, stable auto capture.
- `src/shots.ts`: declarative checklist and session coverage/traversal.
- `src/vision.ts`: lazily loaded MediaPipe adapter, keeping detector concerns separate.
- `src/quality.ts`: pixel metrics and honest alignment feedback.
- `src/storage.ts`: versioned IndexedDB persistence.
- `src/export.ts`: configuration-driven provider selections, manifest, prompts, ZIP.
- `src/types.ts`: source-photo and session contracts for future modalities/versioning.

Future work: on-device body pose, calibrated angle guidance, worker inference, persistent-storage requests, reference-pack import, video/voice modalities, and optional cloud backup only with explicit consent.

MediaPipe API reference: https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js
