# CLAUDE.md

Guidance for working on this project with Claude Code.

## What this is

**The Cousins Machine** — a kid-friendly tree-of-life explorer. Pick two animals and it
shows their most recent common ancestor (MRCA), roughly when their lineages split, the
path between them as a branching diagram, and a rough "shared DNA" guess.

Audience: a young child (and a parent). Tone is playful but the science must stay honest.

## Architecture (read before editing)

- **One file: `index.html`.** It is the entire app and the canonical source. There is **no
  build step** — React 18 and Babel Standalone load from CDN, and the app code lives inline
  in the `<script type="text/babel">` block at the bottom of the file.
- This keeps it deployable anywhere (GitHub Pages, plain static host) and openable directly
  via `file://`. Do **not** introduce a bundler, npm dependencies, or split the app into
  imported modules unless the user explicitly asks to move to a real build (e.g. Vite).
- No browser storage, no network calls, no backend. Everything is computed client-side from
  the in-file data.

## Code map (inside the script block)

- `TREE` — the nested tree of life. Internal nodes have `{ common, sci, age, children }`;
  leaves are made with `L("Name", "emoji", "Group")`. `age` is the node's split time in
  millions of years (Ma). This is the single source of truth for topology and dates.
- One-time pass tags every node with `__id` and `__parent`; `LEAVES` is the flat, sorted
  list of selectable animals.
- `analyze(a, b)` — walks both root-paths and returns the MRCA plus the unique clades on
  each lineage. This is the same idea as the Open Tree of Life `mrca` endpoint, done locally.
- `simOf(t)` — the rough shared-DNA estimate: `50 + 50 * exp(-t / 263)`, pinned so
  human–chimp (6.4 Ma) ≈ 98.8%.
- Components: `CommonAncestorExplorer` (root, pickers, state), `Result` (headline + DNA bar +
  SVG diagram), plus `Card`, `Pill`, `Badge` helpers. Colors live in the `C` object.

## How to make common changes

- **Add an animal:** insert `L("Name", "🦦", "Mammals")` into the correct branch of `TREE`.
  Group must be one of `GROUP_ORDER`. Use `""` for the emoji if none exists (it falls back
  to a 3-letter badge). The MRCA math and diagram update automatically.
- **Add a whole clade:** add an internal node `{ common, sci, age, children: [...] }` in the
  right place. Keep `age` larger than its descendants and smaller than its parent.
- **Change a split time:** edit the `age` on the relevant node.
- **Tune the DNA guess:** adjust the `263` constant in `simOf` (smaller = falls off faster).

## Accuracy rules (important)

- Divergence ages follow TimeTree-style estimates. Do not invent or "round to look nicer"
  deep dates. If asked to change an age, prefer a sourced value; flag deep/uncertain nodes
  (especially invertebrates) as approximate.
- The DNA bar is deliberately a blend of two real metrics (sequence identity for close pairs,
  shared-gene fraction for distant ones). Keep it labeled as a rough guess, never a measurement.
- Topology should match the consensus tree of life. If unsure where a new animal goes, say so
  rather than guessing.

## Run / preview

No build. Either open `index.html` in a browser, or serve the folder:

```bash
npm run dev        # uses `npx serve` -> http://localhost:3000
# or:
python3 -m http.server 8000
```

`file://` works too, but the CDN scripts and Google Fonts need an internet connection.

## Deploy

Push to GitHub and enable Pages (Settings → Pages → Deploy from a branch → `main` / root).
Lives at `https://<user>.github.io/<repo>/`. See README.md for step-by-step.
