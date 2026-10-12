/* Pure fixed-step flight simulation. Same world and physics on every screen. */
(function (root) {
  'use strict';
  const W = 720, H = 480, FLOOR = 444, X = 170, R = 14, PIPE = 64, STEP = 1 / 120;
  class Game {
    constructor(random = Math.random) { this.random = random; this.reset(); this.state = 'ready'; }
    reset() {
      this.y = 220; this.vy = 0; this.held = false; this.pipes = []; this.score = 0;
      this.gates = 0; this.stars = 0; this.charge = 0; this.shield = false;
      this.invulnerable = 0; this.distance = 0; this.time = 0; this.cooldown = 0;
      this.accumulator = 0; this.lastGap = 220; this.event = ''; this.reason = '';
    }
    start() { this.reset(); this.state = 'playing'; this.spawn(650); this.flap(); }
    get speed() { return 150 + Math.min(this.gates, 30) * 2; }
    flap() {
      if (this.state !== 'playing' || this.cooldown > 0) return false;
      this.vy = -265; this.cooldown = .12; return true;
    }
    pause() {
      if (this.state === 'playing') this.state = 'paused';
      else if (this.state === 'paused') this.state = 'playing';
      this.held = false; this.accumulator = 0;
    }
    spawn(x = W + 40) {
      const gap = Math.max(155, 185 - this.gates);
      const center = Math.max(60 + gap / 2, Math.min(FLOOR - 55 - gap / 2, this.lastGap + (this.random() - .5) * 130));
      this.lastGap = center;
      this.pipes.push({ x, top: center - gap / 2, bottom: center + gap / 2, star: true, passed: false });
    }
    end(reason) { this.state = 'over'; this.reason = reason; this.event = reason; this.held = false; }
    update(dt) {
      if (this.state !== 'playing') return;
      this.accumulator += Math.max(0, Math.min(.25, dt));
      while (this.accumulator + 1e-10 >= STEP && this.state === 'playing') {
        this.accumulator -= STEP; this.step(STEP);
      }
    }
    step(dt) {
      this.time += dt; this.cooldown = Math.max(0, this.cooldown - dt);
      this.invulnerable = Math.max(0, this.invulnerable - dt);
      const glide = this.held && this.vy > 0;
      this.vy += (glide ? 260 : 820) * dt;
      if (glide) this.vy = Math.min(this.vy, 92);
      this.y += this.vy * dt;
      // The open sky gives a soft ceiling; the ground remains a hard boundary.
      if (this.y < R) { this.y = R; this.vy = Math.max(0, this.vy); }
      if (this.y + R >= FLOOR) { this.y = FLOOR - R; this.end('A grassy landing. Try a little more lift.'); return; }
      const move = this.speed * dt; this.distance += move;
      for (const p of this.pipes) {
        p.x -= move;
        if (p.star && Math.hypot(X - (p.x + PIPE / 2), this.y - (p.top + p.bottom) / 2) < R + 13) {
          p.star = false; this.stars++; this.score += 5;
          if (!this.shield) {
            this.charge++;
            if (this.charge >= 3) { this.shield = true; this.event = 'Shield ready! One tree hit is on us.'; }
            else this.event = `Starlight collected · ${this.charge} / 3 toward a shield`;
          } else this.event = 'Another star · +5 points';
        }
        if (p.x < X + R && p.x + PIPE > X - R && (this.y - R < p.top || this.y + R > p.bottom)) {
          if (this.invulnerable <= 0) {
            if (this.shield) {
              this.shield = false; this.charge = 0; this.invulnerable = 1.2;
              this.event = 'Shield saved you. Three more stars to recharge.';
            } else { this.end('A close encounter with a treetop.'); return; }
          }
        }
        if (!p.passed && p.x + PIPE < X - R) { p.passed = true; this.gates++; this.score += 10; }
      }
      this.pipes = this.pipes.filter(p => p.x + PIPE > -20);
      if (!this.pipes.length || this.pipes[this.pipes.length - 1].x <= W - 220) this.spawn();
    }
  }
  const api = { Game, W, H, FLOOR, X, R, PIPE, STEP };
  if (typeof module !== 'undefined') module.exports = api; else root.FlappyBirds = api;
})(typeof window !== 'undefined' ? window : globalThis);
