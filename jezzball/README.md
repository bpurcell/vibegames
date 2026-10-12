# JezzBall — Cut & Capture

Open `../jezzball.html` using a static server. No build or dependencies.

The 120 Hz simulation grows walls inside rectangular regions, checks ball contact
before completing cuts, and captures regions with no balls. Clear 75% to advance.
Each level has three lives, 90 seconds, and another ball (up to 16).

New mechanics:
- Consecutive captures of more than 1% build a multiplier up to 5×. A hit or a
  partition with no meaningful empty territory resets the streak.
- Captures earn 1–8 seconds, with a maximum remaining time of 99 seconds.
- A full slow pulse reduces ball movement to 28% for four seconds without slowing
  wall growth or the timer. Captures recharge it by 25 points plus area gained.
- Best scores use `jezzball-best-v3`, separate from the old scoring system.

Tap/click to build. Direction buttons, Space, or right-click rotate. Arrow keys aim,
Shift+arrows make fine adjustments, Enter builds, S triggers the pulse, and P/Escape
pauses. Changing tabs or windows also pauses. Restart has a cancelable prompt.

`node jezzball/engine.test.cjs` checks physics, partitioning, collision, progression,
pause, timeouts, pulse behavior, streak scoring, recharge, and earned time.
