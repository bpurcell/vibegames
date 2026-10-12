# Flappy Birds — Sky Run

Open `../flappybirds.html` using a static server. No build, dependencies, or remote
assets. All artwork is drawn on canvas. The logical world remains 720 × 480 at
all screen sizes, with a 120 Hz fixed-step simulation and high-DPI rendering.

Tap the canvas, use the flap button, or press Space/Up to flap. Holding the input
limits descent speed for a glide; release to descend normally. The soft ceiling
is forgiving. A ground collision always ends the run.

Each gate earns 10 points. Stars earn 5 points and recharge a shield after three
collections. A shield absorbs one trunk collision and grants 1.2 seconds to pass
clear; three more stars recharge it. Speed increases gradually and is capped;
gap heights and changes are bounded. Sprite hitboxes are intentionally forgiving.

P/Escape and the pause button pause/resume. Backgrounding the page pauses and
releases held input. Best scores use `flappy-sky-best-v1`, separate from the old
Flappy score, because this version has different scoring.

Run `node flappybirds/engine.test.cjs` for refresh-rate, glide, collection, shield,
collision, scoring, pause, boundary, retry, and gap-generation regression tests.
