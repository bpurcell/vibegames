const {test} = require('node:test');
const assert = require('node:assert/strict');
const E = require('./engine.js');
const boardOf = rows => new Map(rows.map(([r, c, type]) => [E.key(r, c), {r, c, type}]));
test('hex neighbors are reciprocal, touch, and stay inside the board', () => {
  for (let r = 0; r < 14; r++) for (let c = 0; c < 11 - r % 2; c++) {
    const p = E.position(r, c);
    for (const [rr, cc] of E.neighbors(r, c)) {
      const q = E.position(rr, cc);
      assert.ok(E.valid(rr, cc));
      assert.ok(E.neighbors(rr, cc).some(([a, b]) => a === r && b === c));
      assert.ok(Math.abs(Math.hypot(p.x - q.x, p.y - q.y) - E.D) < 1e-8);
    }
  }
});
test('matches follow all six neighbors but exclude other types', () => {
  const board = boardOf([[0, 0, 1], [1, 0, 1], [2, 1, 1], [2, 2, 2], [0, 5, 1]]);
  assert.equal(E.flood(board, ['0,0'], 1).size, 3);
});
test('removing a bridge detaches the whole hanging cluster', () => {
  const board = boardOf([[0, 0, 0], [1, 0, 0], [2, 0, 1], [2, 1, 2], [3, 0, 3]]);
  assert.equal(E.loose(board).length, 0);
  board.delete('1,0');
  assert.deepEqual(new Set(E.loose(board)), new Set(['2,0', '2,1', '3,0']));
});
test('wall reflections remain inside the playfield and preserve speed', () => {
  const shot = {x: 23, y: 590, vx: -.8, vy: -.6};
  E.advance(shot, 100, new Map(), 8);
  assert.ok(shot.x >= E.R && shot.x <= E.W - E.R);
  assert.equal(shot.vx, .8); assert.equal(shot.vy, -.6);
});
test('ceiling shots attach to empty ceiling cells', () => {
  const shot = {x: 242, y: 590, vx: 0, vy: -1};
  assert.deepEqual(E.advance(shot, 1000, new Map(), 8).cell, [0, 5]);
});
test('a wide sweep of direct and bank shots resolves without overlap', () => {
  const board = new Map();
  for (let r = 0; r < 5; r++) for (let c = 0; c < 11 - r % 2; c++) board.set(E.key(r, c), {r, c, type: c % 4});
  for (let i = 0; i <= 200; i++) {
    const angle = -Math.PI + .16 + i / 200 * (Math.PI - .32);
    const shot = {x: 242, y: 590, vx: Math.cos(angle), vy: Math.sin(angle)};
    const hit = E.advance(shot, 5000, board, 8);
    assert.ok(hit?.cell); assert.ok(!board.has(E.key(...hit.cell)));
    const p = E.position(...hit.cell);
    for (const f of board.values()) { const q = E.position(f.r, f.c); assert.ok(Math.hypot(p.x - q.x, p.y - q.y) >= E.D - .001); }
    const guide = {x: 242, y: 590, vx: Math.cos(angle), vy: Math.sin(angle)};
    let preview; for (let n = 0; n < 500 && !preview; n++) preview = E.advance(guide, 12, board, 8);
    assert.deepEqual(preview.cell, hit.cell);
  }
});

// Exercise the browser controller with lightweight DOM/canvas stand-ins.
const fs = require('node:fs'), vm = require('node:vm');
function controller() {
  const elements = new Map(), drawing = new Proxy({}, {get: () => () => {}});
  const element = () => ({textContent: '', style: {}, hidden: true, setAttribute() {}, replaceChildren() {}, append() {}, addEventListener() {}, getContext: () => drawing, focus() {}});
  const document = {getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); }, createElement: element, addEventListener() {}};
  const context = {window: {ViboodingEngine: E, addEventListener() {}}, document, matchMedia: () => ({matches: false}), localStorage: {getItem() {}, setItem() {}}, devicePixelRatio: 1, requestAnimationFrame() {}, Math, Map, Set};
  vm.createContext(context);
  const source = fs.readFileSync(require.resolve('./game.js'), 'utf8').replace('newGame(); requestAnimationFrame(frame);', `newGame(); window.testGame = {
    fixture(rows, points = 0) { board = new Map(rows.map(([r,c,type]) => [E.key(r,c), {r,c,type}])); score=points; projectile={type:0}; },
    settle, shoot, swap, pause, startLevel, frame,
    nextLevel() { level++; startLevel(); },
    get() { return {state, score, level, ceiling, misses, current, next, projectile, board, crew}; }
  };`);
  vm.runInContext(source, context); return context.window.testGame;
}
test('clear bonus and score survive progression to the next level', () => {
  const game = controller(); game.fixture([[0,0,0], [0,1,0]], 125); game.settle([0,2]);
  assert.equal(game.get().state, 'won'); assert.equal(game.get().score, 655);
  game.nextLevel(); assert.equal(game.get().score, 655); assert.equal(game.get().level, 2); assert.equal(game.get().state, 'playing');
});
test('danger line ends the run and blocks further shooting', () => {
  const game = controller(); game.fixture([[0,0,1], [13,0,1]]); game.settle([13,1]);
  assert.equal(game.get().state, 'lost'); game.shoot(); assert.equal(game.get().projectile, null);
});
test('five misses lower the ceiling and reset the pressure meter', () => {
  const game = controller();
  for (let i = 0; i < 5; i++) { game.fixture([[0,0,1]]); game.settle([1,0]); }
  assert.equal(game.get().ceiling, 8 + E.STEP); assert.equal(game.get().misses, 0);
});
test('pause blocks shots, resume restores play, and extinct types leave the queue', () => {
  const game = controller(); game.pause(); game.shoot(); assert.equal(game.get().projectile, null); game.pause();
  assert.equal(game.get().state, 'playing'); game.fixture([[0,0,2], [0,1,0], [0,2,0]]); game.settle([0,3]);
  assert.equal(game.get().current, 2); assert.equal(game.get().next, 2);
});
