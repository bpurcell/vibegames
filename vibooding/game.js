(() => {
  'use strict';
  const E = window.ViboodingEngine, $ = id => document.getElementById(id);
  const canvas = $('board'), ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rand = n => Math.floor(Math.random() * n);
  const shuffle = list => { for (let i = list.length - 1; i > 0; i--) { const j = rand(i + 1); [list[i], list[j]] = [list[j], list[i]]; } return list; };
  const palette = ['#eeb85e', '#8cb6ad', '#df8b77', '#a8b873', '#aaa0c8', '#77a5c1'];
  let crew, board = new Map(), score = 0, level = 1, best = 0, ceiling = 8, misses = 0, streak = 0;
  let current = 0, next = 0, projectile = null, effects = [], angle = -Math.PI / 2;
  let state = 'playing', sound = false, audio, last = 0, toastTime = 0, pointer = null;
  const keys = new Set();
  try { best = Number(localStorage.getItem('vibooding-best-v2')) || 0; } catch (_) {}
  function makeCrew() {
    const eyes = shuffle([0, 1, 2, 3, 4, 5]), mouths = shuffle([0, 1, 2, 3, 4, 5]);
    crew = shuffle(palette.slice()).map((color, i) => ({ color, shape: i, eye: eyes[i], mouth: mouths[i], spacing: 6 + Math.random() * 2, tuft: rand(3), tilt: (Math.random() - .5) * .13 }));
    $('cast').replaceChildren();
    crew.forEach((_, i) => {
      const c = document.createElement('canvas'); c.width = 102; c.height = 116; c.setAttribute('aria-hidden', 'true');
      const g = c.getContext('2d'); g.scale(2, 2); drawFace(g, i, 25, 29, 23); $('cast').append(c);
    });
  }
  function path(g, points) { g.beginPath(); g.moveTo(...points[0]); points.slice(1).forEach(p => g.lineTo(...p)); g.stroke(); }
  function ellipse(g, x, y, rx, ry, fill = true) { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); fill ? g.fill() : g.stroke(); }
  // All characters are drawn from vector paths; a type keeps its identity for the entire run.
  function drawFace(g, type, x, y, size = 21, rotation = 0) {
    const f = crew[type]; g.save(); g.translate(x, y); g.rotate(f.tilt + rotation); g.scale(size / 22, size / 22);
    g.lineWidth = 1.6; g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = '#35493d'; g.fillStyle = f.color;
    g.beginPath();
    if (f.shape === 0) g.arc(0, 0, 20.5, 0, Math.PI * 2);
    if (f.shape === 1) g.roundRect(-20, -19, 40, 38, 11);
    if (f.shape === 2) { g.moveTo(0, -22); g.bezierCurveTo(7, -22, 23, 8, 20, 15); g.quadraticCurveTo(0, 25, -20, 15); g.bezierCurveTo(-23, 8, -7, -22, 0, -22); }
    if (f.shape === 3) { for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, r = i % 2 ? 17 : 22; i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); }
    if (f.shape === 4) g.ellipse(0, 0, 19, 22, 0, 0, Math.PI * 2);
    if (f.shape === 5) { g.moveTo(-19, -11); g.quadraticCurveTo(-17, -25, -5, -19); g.quadraticCurveTo(8, -26, 19, -12); g.quadraticCurveTo(25, 2, 16, 18); g.quadraticCurveTo(0, 25, -17, 17); g.quadraticCurveTo(-25, 2, -19, -11); }
    g.fill(); g.stroke();
    g.fillStyle = '#fff8df'; g.globalAlpha = .24; ellipse(g, -9, -12, 5, 2); g.globalAlpha = 1;
    g.fillStyle = '#34483d';
    for (const s of [-1, 1]) {
      const ex = s * f.spacing;
      if (f.eye === 0) ellipse(g, ex, -3, 2.2, 3.5);
      if (f.eye === 1) { g.beginPath(); g.arc(ex, -1, 3.5, Math.PI, Math.PI * 2); g.stroke(); }
      if (f.eye === 2) { g.fillStyle = '#fff9e8'; ellipse(g, ex, -3, 4.4, 5); g.fillStyle = '#34483d'; ellipse(g, ex + 1, -2, 2, 2.8); }
      if (f.eye === 3) { path(g, [[ex - 3, -5], [ex + 3, -4]]); ellipse(g, ex, -1, 1.6, 2); }
      if (f.eye === 4) { if (s < 0) path(g, [[ex - 3, -2], [ex, -4], [ex + 3, -2]]); else ellipse(g, ex, -3, 2, 3); }
      if (f.eye === 5) { ellipse(g, ex, -3, 5, 5, false); ellipse(g, ex, -3, 1.8, 2.3); }
    }
    if (f.eye === 5) path(g, [[-2, -3], [2, -3]]);
    g.beginPath();
    if (f.mouth === 0) { g.moveTo(-6, 6); g.quadraticCurveTo(0, 14, 6, 6); g.stroke(); }
    if (f.mouth === 1) { g.ellipse(0, 8, 3, 4, 0, 0, Math.PI * 2); g.fill(); }
    if (f.mouth === 2) { g.moveTo(-6, 6); g.lineTo(6, 6); g.quadraticCurveTo(0, 18, -6, 6); g.fill(); g.fillStyle = '#fff9e8'; g.fillRect(-3, 6, 6, 3); }
    if (f.mouth === 3) { g.moveTo(-5, 9); g.quadraticCurveTo(1, 11, 6, 5); g.stroke(); }
    if (f.mouth === 4) path(g, [[-5, 8], [0, 6], [5, 8]]);
    if (f.mouth === 5) { g.moveTo(-5, 6); g.quadraticCurveTo(-2, 12, 1, 7); g.quadraticCurveTo(4, 12, 7, 6); g.stroke(); }
    g.fillStyle = '#b86654'; g.globalAlpha = .3; ellipse(g, -12, 5, 3.5, 2); ellipse(g, 12, 5, 3.5, 2); g.globalAlpha = 1;
    if (f.tuft === 1) path(g, [[-3, -16], [-1, -20], [2, -16]]);
    g.restore();
  }
  function available() { return [...new Set([...board.values()].map(f => f.type))]; }
  function pick() { const types = available(); return types[rand(types.length)] ?? 0; }
  function refill() { const types = available(); if (!types.includes(current)) current = pick(); if (!types.includes(next)) next = pick(); }
  function notify(text, seconds = 2) { $('toast').textContent = text; toastTime = seconds; $('toast').style.opacity = 1; }
  function tone(freq, duration = .1) {
    if (!sound) return;
    try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); const o = audio.createOscillator(), gain = audio.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(freq, audio.currentTime); o.frequency.exponentialRampToValueAtTime(freq * .6, audio.currentTime + duration); gain.gain.setValueAtTime(.045, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration); o.connect(gain); gain.connect(audio.destination); o.start(); o.stop(audio.currentTime + duration); } catch (_) {}
  }
  function hud() {
    best = Math.max(best, score); $('score').textContent = score.toLocaleString(); $('best').textContent = best.toLocaleString(); $('level').textContent = String(level).padStart(2, '0');
    $('pressure-label').textContent = `${5 - misses} ${misses === 4 ? 'miss' : 'misses'} until drop`;
    $('pips').innerHTML = Array.from({length: 5}, (_, i) => `<i class="${i >= misses ? (misses >= 3 ? 'on warn' : 'on') : ''}"></i>`).join('');
    try { localStorage.setItem('vibooding-best-v2', String(best)); } catch (_) {}
  }
  function startLevel() {
    board.clear(); ceiling = 8; misses = 0; streak = 0; effects = []; projectile = null; angle = -Math.PI / 2;
    const rows = Math.min(5 + Math.floor((level - 1) / 2), 8), types = Math.min(4 + Math.floor(level / 2), 6);
    for (let r = 0; r < rows; r++) for (let c = 0; c < 11 - r % 2; c++) {
      // Occasional repeated neighbors create useful groups without pre-clearing them.
      const prior = board.get(E.key(r, c - 1));
      board.set(E.key(r, c), {r, c, type: prior && Math.random() < .28 ? prior.type : rand(types)});
    }
    current = pick(); next = pick(); state = 'playing'; $('overlay').hidden = true; $('pause').textContent = 'Ⅱ'; $('pause').setAttribute('aria-label', 'Pause game'); hud(); notify(level === 1 ? 'Find your people.' : `Level ${level}. The gang’s all here.`, 3);
  }
  function newGame() { score = 0; level = 1; makeCrew(); startLevel(); }
  function modal(kind, title, description, button) {
    state = kind; keys.clear(); $('overlay').hidden = false; $('overlay-kicker').textContent = kind === 'won' ? 'GOOD COMPANY, GREAT SHOT' : kind === 'lost' ? 'THAT WAS A GOOD RUN' : 'TAKE YOUR TIME'; $('overlay-title').textContent = title; $('overlay-description').textContent = description; $('continue').textContent = button;
  }
  function pause() {
    if (state === 'playing') { modal('paused', 'On a little break.', 'Your crew will be right here.', 'Keep playing →'); $('pause').textContent = '▶'; $('pause').setAttribute('aria-label', 'Resume game'); }
    else if (state === 'paused') { state = 'playing'; $('overlay').hidden = true; $('pause').textContent = 'Ⅱ'; $('pause').setAttribute('aria-label', 'Pause game'); }
  }
  function remove(k, falling) {
    const f = board.get(k), p = E.position(f.r, f.c, ceiling); board.delete(k);
    effects.push({...p, type: f.type, vx: (Math.random() - .5) * 150, vy: falling ? -55 : -90, life: falling ? 1.4 : .35, total: falling ? 1.4 : .35, falling, rotation: (Math.random() - .5) * 4});
  }
  function settle(cell) {
    const type = projectile.type; projectile = null;
    if (!cell) { modal('lost', 'A full house.', `You made ${score.toLocaleString()} points. A fresh crew is ready.`, 'Try a new crew →'); return; }
    const [r, c] = cell, k = E.key(r, c); board.set(k, {r, c, type});
    const matches = E.flood(board, [k], type);
    if (matches.size >= 3) {
      streak++; matches.forEach(k => remove(k, false)); const detached = E.loose(board); detached.forEach(k => remove(k, true));
      const gain = (matches.size * 10 + detached.length * 25) * Math.min(streak, 5); score += gain;
      notify(detached.length ? `${detached.length} dropped! +${gain}${streak > 1 ? ` · ${Math.min(streak, 5)}× streak` : ''}` : `Good match! +${gain}${streak > 1 ? ` · ${Math.min(streak, 5)}× streak` : ''}`); tone(520 + Math.min(streak, 5) * 90, .2);
    } else { streak = 0; misses++; tone(160, .08); }
    if (!board.size) { score += level * 500; hud(); modal('won', 'Everybody’s out!', `+${level * 500} clear bonus. ${score.toLocaleString()} points and counting.`, 'Next level →'); return; }
    if (misses === 5) { misses = 0; ceiling += E.STEP; notify('Heads up. The ceiling dropped.', 2.3); tone(100, .25); }
    refill(); hud();
    if ([...board.values()].some(f => E.position(f.r, f.c, ceiling).y + E.R >= 520)) modal('lost', 'A full house.', `You reached level ${level} with ${score.toLocaleString()} points. Meet another crew?`, 'Try a new crew →');
  }
  function shoot() { if (state !== 'playing' || projectile) return; projectile = {x: E.W / 2, y: 590, vx: Math.cos(angle), vy: Math.sin(angle), type: current}; current = next; next = pick(); tone(320, .07); }
  function swap() { if (state !== 'playing' || projectile) return; [current, next] = [next, current]; tone(240, .06); }
  function aim(event) { const rect = canvas.getBoundingClientRect(), x = (event.clientX - rect.left) * E.W / rect.width, y = (event.clientY - rect.top) * E.H / rect.height; angle = Math.max(-Math.PI + .16, Math.min(-.16, Math.atan2(Math.min(-10, y - 590), x - E.W / 2))); }
  canvas.addEventListener('pointerdown', event => { if (event.button !== 0 || state !== 'playing') return; pointer = event.pointerId; canvas.setPointerCapture(pointer); canvas.focus({preventScroll: true}); aim(event); });
  canvas.addEventListener('pointermove', event => { if (state === 'playing' && (event.pointerType === 'mouse' || pointer === event.pointerId)) aim(event); });
  canvas.addEventListener('pointerup', event => { if (pointer !== event.pointerId) return; aim(event); pointer = null; shoot(); });
  canvas.addEventListener('pointercancel', () => { pointer = null; });
  document.addEventListener('keydown', event => {
    if (event.target.closest('button, select, input, a')) return;
    if (['ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'KeyP', 'Escape'].includes(event.code)) event.preventDefault();
    if (event.repeat && !event.code.startsWith('Arrow')) return;
    keys.add(event.code);
    if (event.code === 'Space') swap(); if (event.code === 'Enter') shoot(); if (event.code === 'KeyP' || event.code === 'Escape') pause();
  });
  document.addEventListener('keyup', event => keys.delete(event.code));
  window.addEventListener('blur', () => { keys.clear(); pointer = null; if (state === 'playing') pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') pause(); });
  $('swap').onclick = swap; $('pause').onclick = pause; $('new-game').onclick = newGame;
  $('sound').onclick = () => { sound = !sound; $('sound').textContent = sound ? 'Sound on' : 'Sound off'; $('sound').setAttribute('aria-pressed', String(sound)); tone(440); };
  $('continue').onclick = () => { if (state === 'paused') pause(); else if (state === 'won') { level++; startLevel(); } else newGame(); canvas.focus({preventScroll: true}); };
  function render() {
    ctx.clearRect(0, 0, E.W, E.H);
    ctx.fillStyle = '#74876420'; for (let x = 22; x < E.W; x += 22) for (let y = 18; y < E.H; y += 22) { ctx.beginPath(); ctx.arc(x, y, .8, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#c9d4b7'; ctx.fillRect(0, 0, E.W, ceiling); ctx.strokeStyle = '#96ab82'; ctx.lineWidth = 2; path(ctx, [[0, ceiling], [E.W, ceiling]]);
    ctx.save(); ctx.setLineDash([4, 6]); ctx.strokeStyle = '#be8a6a70'; ctx.lineWidth = 1; path(ctx, [[12, 520], [E.W - 12, 520]]); ctx.restore();
    ctx.font = '9px system-ui'; ctx.fillStyle = '#a07c5e'; ctx.fillText('KEEP THE CREW ABOVE THIS LINE', 15, 536);
    if (!projectile && state === 'playing') {
      const ghost = {x: E.W / 2, y: 590, vx: Math.cos(angle), vy: Math.sin(angle)};
      for (let i = 0; i < 130; i++) {
        const hit = E.advance(ghost, 12, board, ceiling);
        if (hit) { if (hit.cell) { const p = E.position(...hit.cell, ceiling); ctx.save(); ctx.globalAlpha = .32; drawFace(ctx, current, p.x, p.y); ctx.restore(); } break; }
        if (i > 2) { ctx.fillStyle = '#62794f70'; ellipse(ctx, ghost.x, ghost.y, 1.7, 1.7); }
      }
    }
    for (const f of board.values()) { const p = E.position(f.r, f.c, ceiling); drawFace(ctx, f.type, p.x, p.y); }
    for (const f of effects) { ctx.save(); ctx.globalAlpha = Math.min(1, f.life / .25); drawFace(ctx, f.type, f.x, f.y, f.falling ? 21 : 21 * f.life / f.total, reduced ? 0 : f.rotation * (f.total - f.life)); ctx.restore(); }
    ctx.fillStyle = '#d3ddc6'; ellipse(ctx, E.W / 2, 611, 39, 9); ctx.strokeStyle = '#7f936c'; ctx.lineWidth = 1.5; ellipse(ctx, E.W / 2, 590, 30, 30, false);
    ctx.save(); ctx.translate(E.W / 2, 590); ctx.rotate(angle); ctx.fillStyle = '#617b53'; ctx.beginPath(); ctx.moveTo(40, 0); ctx.lineTo(29, -5); ctx.lineTo(29, 5); ctx.closePath(); ctx.fill(); ctx.restore();
    if (!projectile) drawFace(ctx, current, E.W / 2, 590);
    drawFace(ctx, next, 340, 594, 17); ctx.fillStyle = '#6e805e'; ctx.font = '9px system-ui'; ctx.textAlign = 'center'; ctx.fillText('NEXT', 340, 626); ctx.fillText('MAKE A CONNECTION', E.W / 2, 640); ctx.textAlign = 'left';
    if (projectile) drawFace(ctx, projectile.type, projectile.x, projectile.y);
  }
  function frame(time) {
    const dt = Math.min((time - last) / 1000 || 0, .04); last = time;
    if (state === 'playing') {
      if (keys.has('ArrowLeft')) angle = Math.max(-Math.PI + .16, angle - dt * 1.6);
      if (keys.has('ArrowRight')) angle = Math.min(-.16, angle + dt * 1.6);
      if (projectile) { const hit = E.advance(projectile, dt * 790, board, ceiling); if (hit) settle(hit.cell); }
      for (const f of effects) { f.life -= dt; if (!reduced) { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 800 * dt; } }
      effects = effects.filter(f => f.life > 0 && f.y < E.H + 30);
      toastTime -= dt; if (toastTime <= 0) $('toast').style.opacity = 0;
    }
    render(); requestAnimationFrame(frame);
  }
  // Keep vector strokes crisp on high-density displays without changing game coordinates.
  const dpr = Math.min(devicePixelRatio || 1, 3); canvas.width = E.W * dpr; canvas.height = E.H * dpr; ctx.scale(dpr, dpr);
  newGame(); requestAnimationFrame(frame);
})();
