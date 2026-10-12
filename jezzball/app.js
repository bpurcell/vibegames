'use strict';
const { Game, W, H, R } = JezzBall;
const game = new Game();
const $ = id => document.getElementById(id);
const canvas = $('canvas'), ctx = canvas.getContext('2d');
let axis = 'h', aim = { x: W / 2, y: H / 2 }, showAim = false;
let last = 0, previous = 'ready', overlayMode = 'ready', best = 0, flash = 0, lastLives = 3;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const colors = ['#ffd07e', '#ff8a70', '#f2a8c6', '#c2dd93'];
try { best = Math.max(0, Number(localStorage.getItem('jezzball-best-v3')) || 0); } catch {}
$('best').textContent = best.toLocaleString();
function record() {
  if (game.score <= best) return;
  best = game.score;
  $('best').textContent = best.toLocaleString();
  try { localStorage.setItem('jezzball-best-v3', String(best)); } catch {}
}
function setAxis(value) {
  axis = value;
  $('horizontal').setAttribute('aria-pressed', String(axis === 'h'));
  $('vertical').setAttribute('aria-pressed', String(axis === 'v'));
}
function focusBoard() { canvas.focus({ preventScroll: true }); showAim = true; }
function showOverlay(mode) {
  overlayMode = mode;
  $('overlay').hidden = false;
  const text = {
    ready: ['OWN THE EMPTY SPACE', 'Make your cut.', 'Box in the bouncing balls. Capture 75% of the field to move up a level.', 'Let’s play ↗'],
    paused: ['ON YOUR OWN TIME', 'Take a breath.', 'The field is frozen. Pick up exactly where you left off.', 'Resume →'],
    won: ['TERRITORY SECURED', 'Nicely divided.', `${game.cleared.toFixed(1)}% captured. Level ${game.level + 1} brings another ball, three lives, and a fresh slow pulse.`, 'Next field →'],
    lost: ['ONE MORE CUT?', 'Close quarters.', `${game.event} Level ${game.level} · ${game.score.toLocaleString()} points · ${game.captures} captures on this field.`, 'Try again ↗'],
    restart: ['START FRESH?', 'A clean slate.', 'Return to level 1 with a new field. Your personal best stays saved.', 'Start new game ↗']
  }[mode];
  $('overlay-kicker').textContent = text[0];
  $('overlay-title').textContent = text[1];
  $('overlay-copy').textContent = text[2];
  $('play').textContent = text[3];
  $('cancel').hidden = mode !== 'restart';
  if (mode !== 'ready') $('play').focus({ preventScroll: true });
}
function resume() {
  game.state = 'playing'; game.accumulator = 0; last = 0;
  $('overlay').hidden = true; overlayMode = ''; previous = 'playing'; focusBoard();
}
$('play').onclick = () => {
  if (overlayMode === 'paused') { resume(); return; }
  if (overlayMode === 'won') game.next(); else game.start();
  lastLives = game.lives; flash = 0; resume();
  $('message').textContent = 'Choose a cut. S slows the balls when your pulse is full.';
};
$('cancel').onclick = resume;
function pause() {
  if (game.state === 'playing') { game.pause(); previous = 'paused'; showOverlay('paused'); }
  else if (game.state === 'paused') resume();
}
$('pause').onclick = pause;
$('restart').onclick = () => {
  record();
  if (game.state === 'ready' || game.state === 'lost' || game.state === 'won') {
    game.start(); lastLives = 3; resume(); return;
  }
  game.state = 'paused'; previous = 'paused'; showOverlay('restart');
};
$('horizontal').onclick = () => setAxis('h');
$('vertical').onclick = () => setAxis('v');
$('slow').onclick = () => { game.pulse(); focusBoard(); };
function point(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
}
canvas.addEventListener('pointermove', e => { aim = point(e); showAim = true; });
canvas.addEventListener('pointerleave', () => { if (document.activeElement !== canvas) showAim = false; });
canvas.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  e.preventDefault(); aim = point(e); focusBoard(); game.build(aim.x, aim.y, axis);
});
canvas.addEventListener('contextmenu', e => { e.preventDefault(); setAxis(axis === 'h' ? 'v' : 'h'); });
document.addEventListener('keydown', e => {
  if (e.target.closest('input,select,textarea') || e.altKey || e.metaKey || e.ctrlKey) return;
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (game.state === 'playing' || game.state === 'paused') { e.preventDefault(); pause(); } return;
  }
  if (e.code === 'KeyS' && game.state === 'playing' && !e.repeat) { e.preventDefault(); game.pulse(); return; }
  if (e.target !== canvas) return;
  if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) setAxis(axis === 'h' ? 'v' : 'h'); }
  else if (e.code === 'Enter') { e.preventDefault(); game.build(aim.x, aim.y, axis); }
  else if (e.key.startsWith('Arrow')) {
    e.preventDefault(); const step = e.shiftKey ? 4 : 16;
    aim.x = Math.max(1, Math.min(W - 1, aim.x + (e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0)));
    aim.y = Math.max(1, Math.min(H - 1, aim.y + (e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0))); showAim = true;
  }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && game.state === 'playing') pause(); last = 0; });
window.addEventListener('blur', () => { if (game.state === 'playing') pause(); });
function resize() {
  const r = canvas.getBoundingClientRect(), scale = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(r.width * scale); canvas.height = Math.round(r.height * scale);
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
}
new ResizeObserver(resize).observe(canvas);
function draw(dt, ts) {
  ctx.fillStyle = '#75b4a0'; ctx.fillRect(0, 0, W, H);
  // Occupied rectangles are islands in the reclaimed green field.
  for (const c of game.regions) {
    ctx.fillStyle = game.slow > 0 ? '#173e50' : '#14383a'; ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.save(); ctx.beginPath(); ctx.rect(c.x, c.y, c.w, c.h); ctx.clip();
    ctx.fillStyle = '#42615e';
    for (let x = 16; x < W; x += 24) for (let y = 16; y < H; y += 24) ctx.fillRect(x, y, 1.5, 1.5);
    ctx.restore(); ctx.strokeStyle = '#afcfb5'; ctx.lineWidth = 2; ctx.strokeRect(c.x, c.y, c.w, c.h);
  }
  for (const c of game.claimed) if (c.w > 70 && c.h > 40) {
    ctx.fillStyle = '#23584e'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
    ctx.fillText('✦ CAPTURED', c.x + c.w / 2, c.y + c.h / 2 + 4);
  }
  for (const b of game.balls) {
    if (!reduced.matches) {
      ctx.strokeStyle = colors[b.color] + '40'; ctx.lineWidth = R * 1.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(b.x - b.vx * .1, b.y - b.vy * .1); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.fillStyle = '#082a2f70'; ctx.beginPath(); ctx.arc(b.x + 2, b.y + 4, R + 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = colors[b.color]; ctx.beginPath(); ctx.arc(b.x, b.y, R, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff7d9'; ctx.beginPath(); ctx.arc(b.x - 2.5, b.y - 2.5, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  if (game.wall) {
    const w = game.wall; ctx.strokeStyle = '#fff2b6'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath();
    if (w.axis === 'h') { ctx.moveTo(w.x - w.neg, w.y); ctx.lineTo(w.x + w.pos, w.y); }
    else { ctx.moveTo(w.x, w.y - w.neg); ctx.lineTo(w.x, w.y + w.pos); } ctx.stroke();
  }
  if (showAim && game.state === 'playing' && !game.wall) {
    const c = game.regionAt(aim.x, aim.y);
    if (c) {
      ctx.save(); ctx.strokeStyle = '#fff4c9b0'; ctx.lineWidth = 1.5; ctx.setLineDash([7, 7]); ctx.beginPath();
      if (axis === 'h') { ctx.moveTo(c.x, aim.y); ctx.lineTo(c.x + c.w, aim.y); }
      else { ctx.moveTo(aim.x, c.y); ctx.lineTo(aim.x, c.y + c.h); } ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#fff4c9'; ctx.beginPath(); ctx.arc(aim.x, aim.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
  }
  if (game.slow > 0) {
    ctx.strokeStyle = '#a0dce3'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, W - 6, H - 6);
    ctx.fillStyle = '#b9eced'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
    ctx.fillText(`SLOW FIELD · ${game.slow.toFixed(1)}s`, W / 2, 25);
  }
  if (flash > 0) { flash = Math.max(0, flash - dt); ctx.fillStyle = `rgba(255,120,100,${flash * .5})`; ctx.fillRect(0, 0, W, H); }
}
function frame(ts) {
  const dt = last ? Math.min((ts - last) / 1000, .25) : 0; last = ts; game.update(dt); record();
  if (game.lives < lastLives) { flash = reduced.matches ? 0 : .3; lastLives = game.lives; }
  if (game.event && $('message').textContent !== game.event) $('message').textContent = game.event;
  if (game.state !== previous) { if (game.state === 'won' || game.state === 'lost') { record(); showOverlay(game.state); } previous = game.state; }
  $('level').textContent = String(game.level).padStart(2, '0'); $('score').textContent = game.score.toLocaleString();
  $('lives').textContent = game.lives + ' / 3';
  const sec = Math.ceil(game.time); $('time').textContent = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  $('area').textContent = game.cleared.toFixed(1); $('fill').style.width = Math.min(100, game.cleared / 75 * 100) + '%';
  document.querySelector('.meter').setAttribute('aria-valuenow', Math.min(75, game.cleared).toFixed(1));
  $('combo').textContent = '×' + Math.max(1, game.combo) + ' STREAK';
  $('slow').disabled = game.state !== 'playing' || game.charge < 100 || game.slow > 0;
  $('slow').dataset.active = String(game.slow > 0);
  $('slow').textContent = game.slow > 0 ? `◎ Slow · ${game.slow.toFixed(1)}s` : `◎ Slow · ${Math.floor(game.charge)}%`;
  $('pause').disabled = !['playing', 'paused'].includes(game.state);
  $('pause').setAttribute('aria-label', game.state === 'paused' ? 'Resume game' : 'Pause game');
  $('pause').textContent = game.state === 'paused' ? '▶' : 'Ⅱ'; draw(dt, ts); requestAnimationFrame(frame);
}
resize(); requestAnimationFrame(frame);
