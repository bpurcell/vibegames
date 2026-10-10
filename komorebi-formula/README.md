# Komorebi: Equations

A separate, buildless mathematical forest editor at `/komorebi-formula/`.

Every tree in the SVG illustration is selectable and editable, including all seven initial trees. Each stores its own seed, three arithmetic formulas, depth, spread, foliage, wind, palette, scale, and position. Click a tree or use the accessible tree picker, edit it, and press **Apply equations**. Keyboard users can also focus a tree and press Enter/Space. Presets populate editable formulas without changing a tree until Apply.

Formulas set child-length ratio, child turn in radians, and branch curvature in radians. Variables: `r` (seeded −1…1), `d` (normalized depth), `s` (branch side), `a` (spread radians), `w` (wind), and `pi`. Operators: `+ - * / ^`; functions: `sin`, `cos`, `abs`, `sqrt`, `min`, `max`. A bounded parser evaluates arithmetic without eval/Function or executable user code. Length is constrained to 0.3–0.86, turn to ±1.6, and bend to ±0.9; active limits are reported. Undefined results reject the whole edit.

Randomness is keyed to each tree seed and branch path. Editing one tree never changes its neighbors. Foliage changes do not alter branches. A landscape seed recreates the initial composition, while project JSON preserves all edits. Projects autosave to the current browser origin and can be downloaded/reopened. Undo covers edits, additions, duplication, removal, regeneration, and project import. Limits: 24 trees, depth 2–7, 180 characters per formula, 250 KB project imports.

Export clean SVG or a 2400×1520 PNG; selection controls are excluded. Explicit download links remain available if automatic downloads are blocked. All assets and rendering are local; no third-party dependencies or services.

Run the repository with `python3 -m http.server 8043`. Test the formula parser and seeded geometry with `node komorebi-formula/math.test.cjs`.
