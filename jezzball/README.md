# JezzBall

Open `../jezzball.html` with the repository's static server. No build or dependencies.

The rebuilt game uses a 120 Hz fixed simulation step, radius-aware region boundaries,
and collision checks before committing a completed wall. A failed wall is removed
and costs exactly one life. Completed walls split rectangular regions; empty regions
and the wall itself count toward the 75% target. Each level adds a ball (up to 16),
with bounded speed increases, three lives, and 90 seconds. Score and best score are
shown separately; best score is stored locally when a round finishes or restarts.

Pointer/touch places walls. Direction buttons or right-click rotate. Focus the board
for arrow-key aiming, Shift+arrows for fine movement, Space to rotate, and Enter to
build. P/Escape pause, and switching tabs/windows automatically pauses.

Run `node jezzball/engine.test.cjs` for simulation regression tests.
