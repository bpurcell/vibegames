# Komorebi

Integrated from the supplied `komorebi-deploy.tar.gz`. A browser-local ink landscape studio with procedural terrain and seeded fractal trees. The imported hosting manifest was intentionally excluded; this app is served at `/komorebi/` with the rest of this repository.

Choose Pine, Sakura, or Bamboo and click the canvas to plant. Ink draws freehand. Move, Shift-drag, the mouse wheel, or the footer arrows pan the landscape. With the canvas focused, Left/Right also pan. Undo works from its button or Ctrl/Cmd+Z. Clear removes your additions and can be undone. Export downloads the visible landscape as a PNG. Drawings persist in local storage on the current browser/origin.

The tree laboratory controls new pine and sakura trees. Bamboo uses its own fixed growth model. The shared site styles affect the shell; the artwork keeps its paper-and-ink palette. No external runtime dependencies or network requests are required.

Review fixes: isolated undo history from browser history, validated stored drawing data, rounded and bounded recursive tree depth, kept native input undo, exposed selected drawing tools to assistive technology, and adapted the canvas and toolbar to the shared navigation and mobile layout.
