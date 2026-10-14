# Vibooding

Open `../vibooding.html` directly, or serve the repository with any static server. No build step, packages, network assets, or account required.

A Snood-inspired face-matching game. Each run generates six vector characters from shuffled colors, silhouettes, eyes, mouths, and small facial variations. Identities stay consistent throughout a run, and the shot queue only uses types remaining on the board.

- Point and click, or drag and release on a touchscreen, to aim and shoot.
- Left/right arrows aim; Enter shoots; Space swaps; P or Escape pauses.
- Match at least three faces; disconnected clusters fall.
- Five non-matching shots lower the ceiling. Reaching the marked line ends the run.
- Matches earn 10 points per face; dropped faces earn 25. Consecutive matches multiply points up to 5×. Clearing a level awards 500 × level.
- Scores carry across levels. Best score is stored locally when storage is available.
- New crew starts a new run and generates new faces. Sound is opt-in; reduced motion is respected.

`engine.js` owns hex geometry, graph traversal, collision, and wall reflection. `game.js` handles drawing, input, scoring, and game state. The dotted trajectory uses the same collision routine as actual shots.

Run checks with `node --test vibooding/engine.test.cjs`.
