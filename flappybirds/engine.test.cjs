const assert = require('node:assert/strict');
const { Game, X, R, PIPE, FLOOR } = require('./engine.js');
const fresh = () => { const g = new Game(() => .5); g.start(); return g; };
function run(g, seconds, hz = 60) { for (let i = 0; i < seconds * hz; i++) g.update(1 / hz); }
// Fixed simulation remains identical across display refresh rates.
const a = fresh(), b = fresh(); a.held = b.held = true; run(a, 1, 30); run(b, 1, 144);
assert(Math.abs(a.y - b.y) < 1e-7); assert(Math.abs(a.distance - b.distance) < 1e-7);
// Holding only slows the descent, and release restores normal gravity.
const glide = fresh(), fall = fresh(); glide.vy = fall.vy = 80; glide.held = true;
run(glide, .5); run(fall, .5); assert(glide.y < fall.y); assert(glide.vy <= 92);
glide.held = false; run(glide, .1); assert(glide.vy > 92);
// Three collectible stars award points and a shield; each is collectible once.
const stars = fresh();
for (let i = 0; i < 3; i++) {
  stars.pipes = [{ x: X - PIPE / 2, top: stars.y - 90, bottom: stars.y + 90, star: true, passed: false }];
  stars.vy = 0; stars.update(1 / 120); assert.equal(stars.stars, i + 1);
  stars.update(1 / 120); assert.equal(stars.stars, i + 1);
}
assert.equal(stars.score, 15); assert.equal(stars.shield, true);
// A shield prevents one hit, grants escape time, and consumes its charge.
stars.pipes = [{ x: X, top: stars.y + 20, bottom: stars.y + 180, star: false, passed: false }];
stars.update(1 / 120); assert.equal(stars.state, 'playing'); assert.equal(stars.shield, false);
assert.equal(stars.charge, 0); assert(stars.invulnerable > 1);
stars.update(1 / 120); assert.equal(stars.state, 'playing');
stars.invulnerable = 0; stars.update(1 / 120); assert.equal(stars.state, 'over');
// Collision-free gates score once. No scoring after death.
const gate = fresh(); gate.pipes = [{ x: X - R - PIPE - 1, top: 50, bottom: 400, star: false, passed: false }];
gate.update(1 / 120); assert.equal(gate.gates, 1); assert.equal(gate.score, 10);
gate.update(1 / 120); assert.equal(gate.score, 10);
// Pause freezes time, position, and pipes, clearing held input on resume.
const paused = fresh(); paused.held = true; paused.pause();
const snapshot = [paused.y, paused.distance, paused.pipes[0].x]; run(paused, 10);
assert.deepEqual([paused.y, paused.distance, paused.pipes[0].x], snapshot); assert.equal(paused.held, false);
paused.pause(); assert.equal(paused.state, 'playing');
// Ceiling is forgiving, but even a charged shield cannot save a ground hit.
const ceiling = fresh(); ceiling.y = R; ceiling.vy = -200; ceiling.update(1 / 120); assert.equal(ceiling.y, R); assert.equal(ceiling.state, 'playing');
ceiling.y = FLOOR - R; ceiling.vy = 100; ceiling.shield = true; ceiling.update(1 / 120); assert.equal(ceiling.state, 'over');
const frozenScore = ceiling.score; run(ceiling, 10); assert.equal(ceiling.score, frozenScore);
// Retry clears all run state. Reachable gaps stay inside the field at max speed.
stars.start(); assert.equal(stars.score, 0); assert.equal(stars.stars, 0); assert.equal(stars.charge, 0); assert.equal(stars.invulnerable, 0);
const gaps = new Game(() => .999); gaps.start(); gaps.gates = 100;
for (let i = 0; i < 100; i++) gaps.spawn();
for (const p of gaps.pipes) { assert(p.top >= 59); assert(p.bottom <= FLOOR - 54); assert(p.bottom - p.top >= 155); }
assert(gaps.speed <= 210);
console.log('Flight tests passed: fixed steps, glide, stars, shields, collision, gate scoring, pause, ceiling, ground, reset, and reachable gaps.');
