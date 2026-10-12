'use strict';
const { Game, W, H, FLOOR, X, R, PIPE } = FlappyBirds;
const game = new Game(), $ = id => document.getElementById(id);
const canvas = $('flight'), ctx = canvas.getContext('2d');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let last = 0, best = 0, overlayMode = 'ready', previous = 'ready', displayTime = 0;
try { best = Math.max(0, Number(localStorage.getItem('flappy-sky-best-v1')) || 0); } catch {}
$('best').textContent = best;
function record() {
  if (game.score <= best) return;
  best = game.score; $('best').textContent = best;
  try { localStorage.setItem('flappy-sky-best-v1', String(best)); } catch {}
}
function focusBoard() { canvas.focus({ preventScroll: true }); }
function overlay(mode) {
  overlayMode = mode; $('overlay').hidden = false;
  const text = {
    ready: ['A LITTLE LIFT GOES A LONG WAY', 'Hello, blue sky.', 'Find a gap in the treetops. Tap to flap, hold to glide, and follow the stars.', 'Take flight ↗'],
    paused: ['NOT A CLOUD IN A HURRY', 'Float a moment.', 'Your flight is paused. The sky will wait for you.', 'Keep flying →'],
    over: ['A GOOD DAY TO TRY AGAIN', 'One more flight?', `${game.score} points · ${game.gates} gates · ${game.stars} stars. ${game.reason}`, 'Fly again ↗']
  }[mode];
  $('overlay-kicker').textContent = text[0]; $('overlay-title').textContent = text[1];
  $('overlay-copy').textContent = text[2]; $('play').textContent = text[3];
  if (mode !== 'ready') $('play').focus({ preventScroll: true });
}
function start() {
  record(); game.start(); previous = 'playing'; last = 0; overlayMode = '';
  $('overlay').hidden = true; $('message').textContent = 'Tap for lift. Hold to glide. Stars recharge your shield.'; focusBoard();
}
function pause() {
  if (!['playing', 'paused'].includes(game.state)) return;
  game.pause(); last = 0; previous = game.state;
  if (game.state === 'paused') overlay('paused');
  else { $('overlay').hidden = true; overlayMode = ''; focusBoard(); }
}
$('play').onclick = () => { if (overlayMode === 'paused') pause(); else start(); };
$('restart').onclick = start; $('pause').onclick = pause;
function down(e) {
  if (e.button !== 0 || game.state !== 'playing') return;
  e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); game.flap(); game.held = true;
  if (e.currentTarget === canvas) focusBoard();
}
function release() { game.held = false; }
for (const target of [canvas, $('flap')]) {
  target.addEventListener('pointerdown', down);
  target.addEventListener('pointerup', release);
  target.addEventListener('pointercancel', release);
  target.addEventListener('lostpointercapture', release);
}
// Native button activation supports keyboard and assistive technology too.
$('flap').addEventListener('click', e => { if (e.detail === 0) game.flap(); });
document.addEventListener('keydown', e => {
  if (e.target.closest('input,select,textarea') || e.altKey || e.metaKey || e.ctrlKey) return;
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (!e.repeat && ['playing', 'paused'].includes(game.state)) { e.preventDefault(); pause(); } return;
  }
  if (e.target !== canvas && e.target !== $('flap')) return;
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault(); if (!e.repeat) game.flap(); game.held = game.state === 'playing';
  }
});
document.addEventListener('keyup', e => { if (e.code === 'Space' || e.code === 'ArrowUp') release(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && game.state === 'playing') pause(); last = 0; });
window.addEventListener('blur', () => { if (game.state === 'playing') pause(); release(); });
function resize() {
  const rect = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
}
new ResizeObserver(resize).observe(canvas);
function ellipse(x, y, rx, ry, color) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}
function cloud(x, y, scale) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ellipse(0, 0, 34, 12, '#fffef2b0'); ellipse(-15, -10, 15, 16, '#fffef2b0'); ellipse(10, -15, 22, 22, '#fffef2b0'); ctx.restore();
}
function star(x, y, time) {
  ctx.save(); ctx.translate(x, y); if (!reduced.matches) ctx.rotate(Math.sin(time * 2) * .12);
  ctx.fillStyle = '#fff0a860'; ctx.beginPath(); ctx.arc(0, 0, 21, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 6 : 13; const x = Math.cos(a) * r, y = Math.sin(a) * r; if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  ctx.closePath(); ctx.fillStyle = '#ffca54'; ctx.fill(); ctx.strokeStyle = '#bd7e22'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
}
function treeGate(p) {
  // The collision boundary is exactly the visible trunk and its flat canopy edge.
  const x = p.x;
  for (const [y, height, top] of [[0, p.top, true], [p.bottom, FLOOR - p.bottom, false]]) {
    ctx.fillStyle = '#337869'; ctx.fillRect(x, y, PIPE, height);
    ctx.fillStyle = '#4b9480'; ctx.fillRect(x + 5, y, PIPE - 14, height);
    ctx.fillStyle = '#64aa8b'; ctx.fillRect(x + 10, y, 8, height);
    ctx.fillStyle = '#235d58'; ctx.fillRect(x + PIPE - 8, y, 8, height);
    const edge = top ? y + height - 15 : y;
    ctx.fillStyle = '#245f57'; ctx.fillRect(x, edge, PIPE, 15);
    ctx.fillStyle = '#79b68c'; ctx.fillRect(x + 2, edge + 2, PIPE - 4, 6);
    ctx.strokeStyle = '#2b7163'; ctx.lineWidth = 2;
    for (let sy = y + 34; sy < y + height - 20; sy += 48) { ctx.beginPath(); ctx.moveTo(x + 25, sy); ctx.lineTo(x + 25, sy + 18); ctx.stroke(); }
  }
}
function bird(y, time) {
  ctx.save(); ctx.translate(X, y);
  const ready = game.state === 'ready'; ctx.rotate(ready ? -.08 : Math.max(-.35, Math.min(.7, game.vy / 600)));
  if (game.shield || game.invulnerable > 0) {
    ctx.strokeStyle = '#f9fcdf'; ctx.lineWidth = 3; ctx.fillStyle = '#f9fcdf30';
    ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  // A coral songbird, drawn from shapes rather than external image assets.
  ctx.fillStyle = '#a84232'; ctx.beginPath(); ctx.moveTo(-19, 2); ctx.lineTo(-35, -8); ctx.lineTo(-31, 9); ctx.closePath(); ctx.fill();
  ellipse(0, 0, 24, 19, '#e9734f'); ellipse(7, 7, 15, 10, '#ffd8a2');
  const wing = game.held ? -6 : Math.sin(time * 18) * 4;
  ellipse(-8, 3 + (reduced.matches ? 0 : wing), 13, 8, '#b84f3e');
  ctx.fillStyle = '#e0a640'; ctx.beginPath(); ctx.moveTo(20, -2); ctx.lineTo(34, 3); ctx.lineTo(20, 7); ctx.closePath(); ctx.fill();
  ellipse(11, -6, 6, 7, '#fff9de'); ellipse(13, -6, 2.5, 3.5, '#233e42');
  ctx.strokeStyle = '#e9734f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-4, -17); ctx.lineTo(-10, -25); ctx.moveTo(1, -17); ctx.lineTo(-1, -26); ctx.stroke(); ctx.restore();
}
function draw() {
  const t = displayTime, travel = game.state === 'ready' ? t * 25 : game.distance;
  const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#b6e0e6'); sky.addColorStop(1, '#e6edce'); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  ellipse(570, 82, 44, 44, '#fff2be'); ellipse(570, 82, 58, 58, '#fff3c329');
  for (let i = 0; i < 5; i++) cloud(((i * 205 + 90 - travel * .13) % 1030 + 1030) % 1030 - 130, 75 + (i % 3) * 44, .7 + (i % 2) * .3);
  for (let layer = 0; layer < 2; layer++) {
    ctx.fillStyle = layer ? '#95bfa9' : '#b2cec0'; ctx.beginPath(); ctx.moveTo(0, FLOOR);
    for (let x = 0; x <= W + 10; x += 10) { const y = (layer ? 378 : 324) + Math.sin((x + travel * (layer ? .15 : .07)) / 95) * 24 + Math.sin(x / 170) * 28; ctx.lineTo(x, y); }
    ctx.lineTo(W, FLOOR); ctx.closePath(); ctx.fill();
  }
  const pipes = game.state === 'ready' ? [{ x: 480, top: 128, bottom: 315, star: true }, { x: 760, top: 170, bottom: 355, star: true }] : game.pipes;
  for (const p of pipes) { treeGate(p); if (p.star) star(p.x + PIPE / 2, (p.top + p.bottom) / 2, t); }
  ctx.fillStyle = '#6f9976'; ctx.fillRect(0, FLOOR, W, 5); ctx.fillStyle = '#d2cca4'; ctx.fillRect(0, FLOOR + 5, W, H - FLOOR);
  ctx.strokeStyle = '#b3b18c'; ctx.lineWidth = 2;
  for (let x = -(travel % 28); x < W; x += 28) { ctx.beginPath(); ctx.moveTo(x, FLOOR + 12); ctx.lineTo(x + 9, FLOOR + 12); ctx.stroke(); }
  bird(game.state === 'ready' ? 218 + (reduced.matches ? 0 : Math.sin(t * 2) * 8) : game.y, t);
  if (game.held && game.vy > 0 && game.state === 'playing') {
    ctx.fillStyle = '#31595e'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.fillText('GLIDING', X, game.y + 45);
  }
}
function frame(ts) {
  const dt = last ? Math.min((ts - last) / 1000, .25) : 0; last = ts;
  if (game.state === 'playing' || game.state === 'ready') displayTime += reduced.matches ? 0 : dt;
  game.update(dt); record();
  if (game.state !== previous) { if (game.state === 'over') { record(); overlay('over'); } previous = game.state; }
  $('score').textContent = game.score; $('gates').textContent = game.gates; $('stars').textContent = game.stars;
  $('shield').textContent = game.shield ? 'READY' : `${game.charge} / 3`;
  $('flight-state').textContent = game.state === 'ready' ? 'READY WHEN YOU ARE' : game.state === 'paused' ? 'FLIGHT PAUSED' : game.state === 'over' ? 'BACK TO THE NEST' : game.shield ? 'SHIELD READY' : game.held && game.vy > 0 ? 'RIDING THE AIR' : `${Math.floor(game.distance / 10)} m FLOWN`;
  if (game.event && $('message').textContent !== game.event) $('message').textContent = game.event;
  $('pause').disabled = !['playing', 'paused'].includes(game.state); $('flap').disabled = game.state !== 'playing';
  $('pause').setAttribute('aria-label', game.state === 'paused' ? 'Resume game' : 'Pause game'); $('pause').textContent = game.state === 'paused' ? '▶' : 'Ⅱ';
  draw(); requestAnimationFrame(frame);
}
resize(); requestAnimationFrame(frame);
