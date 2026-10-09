# chatgourdspt

A standalone, procedural 3D gourd laboratory for Halloween. Inspired by the generative spirit of Lingdong Huang’s fishdraw; the gourd algorithm is original.

Run from the repository root with `python3 -m http.server 8043`, then visit `http://localhost:8043/chatgourdspt/`. No build step, account, or API key is needed. Requires WebGL.

Features: six gourd families, seeded geometry, adjustable ribbing/plumpness/warts, six palettes, glowing Halloween faces, orbit/zoom controls, reduced-motion support, reproducible URL settings, and PNG portrait downloads. Arrow keys rotate the focused viewer; + and - zoom.

Three.js 0.169.0 is bundled in `vendor/` under its MIT license. The app shares the parent site’s system fonts, theme, and navigation. Serve the repository unchanged on GitHub Pages, or run `node chatgourdspt/build.mjs` to bundle the shared assets in `chatgourdspt/dist/` for a standalone static host. Standalone navigation links back to the site domain from `CNAME`.
