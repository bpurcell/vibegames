# The Cousins Machine 🌳

A kid-friendly tree-of-life explorer. Pick any two animals and see:

- their **most recent common ancestor** (the group they both belong to),
- roughly **when their lineages split** (millions of years ago),
- the **path between them** drawn as a branching tree,
- a **very rough guess at shared DNA**.

The whole app is one self-contained `index.html` — no build step, no server, no API keys.

---

## Run it

Open `index.html` in a browser, or serve the folder:

```bash
npm run dev              # npx serve  ->  http://localhost:3000
# or
python3 -m http.server 8000
```

(`file://` works too, but the CDN scripts and Google Fonts need internet.)

## Work on it with Claude Code

Open this folder in Claude Code. It reads `CLAUDE.md`, which explains the architecture,
the code map, and the rules for adding animals or editing split times. The short version:
all the app code lives in the `<script type="text/babel">` block at the bottom of
`index.html`, and the `TREE` object is the single source of truth for the tree.

## Deploy to GitHub Pages

1. Create a repo and push these files (or drag them into **Add file → Upload files**).
2. **Settings → Pages → Build and deployment → Source: Deploy from a branch → `main` / root → Save.**
3. Live in ~1 minute at `https://<your-username>.github.io/<repo>/`.

```bash
git init && git add -A && git commit -m "Cousins Machine"
git branch -M main
git remote add origin https://github.com/<your-username>/cousins-machine.git
git push -u origin main
```

---

## Editing cheatsheet

- **Add an animal:** drop `L("Name", "🦦", "Mammals")` into the right branch of `TREE`.
  Use `""` for the emoji if there isn't one (it falls back to a letter badge).
- **Change a split time:** edit the `age:` (in millions of years) on any node.
- **Tune the DNA guess:** change the `263` in `simOf` (smaller = falls off faster).

## A note on the science

- **Split times** are approximate divergence estimates in the spirit of
  [TimeTree](https://timetree.org). Recent splits (human–chimp ≈ 6 Ma) are firm; the very
  deep ones — especially invertebrates — are debated, so treat the oldest numbers as ballpark.
- **"Shared DNA"** has no single correct value. Close relatives are compared letter-by-letter
  (humans & chimps ≈ 99%); distant ones by *shared genes* (we share ~half our genes even with
  a chicken). The bar blends both — a conversation starter, not a measurement.

## License

MIT — see [LICENSE](LICENSE).
