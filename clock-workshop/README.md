# The Clockmaker’s Bench

Buildless educational grandfather-clock simulation. Serve the repository and open `/clock-workshop/`. Includes a working model-time dial, cabinet cutaway, schematic anchor escapement, measured beat intervals, optional synthesized ticks, adjustable physics, and a sourced general repair primer.

## Model

`physics.mjs` integrates the nonlinear simple-pendulum equation with split exponential damping and velocity Verlet at 240 Hz. The equivalent 1 kg pendulum uses an effective length; the real physical-pendulum relationship is I/(m d). Idealized alternating crossings at an adjustable release angle advance the time train and receive a small energy impulse. No driving power or remaining weight travel means no train advancement, though the pendulum can coast.

Each release advances the dial by one indicated second. Model time starts at local time; changing length changes the rate against simulated elapsed time. Animation speed changes simulated time, not the rate formula. Hidden tabs pause and frame gaps above 100 ms are capped. This is an educational model, not a wall-clock synchronization service.

A 4 kg weight descends 0.8 m over 691,200 releases (eight days at one release/sec). The impulse uses an illustrative 20% conversion of that potential-energy drop, scaled by the delivered-drive control. Damping is viscous only; there is no dry friction/stiction model. High friction reduces amplitude; at zero beat offset an idealized model may continue at very small amplitude where a real escapement would stop. Beat offset can prevent further crossings when swing amplitude falls below the offset. The visual gear train does not define actual tooth ratios; the 30-tooth escape wheel is explicitly shown advancing half a tooth per release.

Period readout includes the first two finite-amplitude correction terms. Estimated daily rate compares the predicted pendulum period to a nominal two-second period. Healthy defaults can therefore show a small amplitude-related loss rather than exactly zero error.

The mechanism drawing does not solve pallet contact, lock/drop, recoil, backlash, suspension springs, temperature effects, or wear. Outer strike/chime weights are illustrative and stationary. All these limits are stated in the app. Advice is general; users need their maker’s specific movement instructions before adjustments or disassembly.

Sources are linked in the page: OpenStax pendulum physics, Klockit beat adjustment, and Howard Miller winding and troubleshooting guidance.

## Verify

`node --test clock-workshop/physics.test.mjs`

`node --check clock-workshop/app.mjs`

Tests cover nominal cadence, length/rate direction, drive loss, beat asymmetry, damping, and empty-weight behavior. UI verification includes fault presets, pause/resume, cutaway, and mobile layout.
