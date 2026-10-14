/* Shared geometric rules for the board, projectile, and aim preview. */
(function (root) {
  'use strict';
  const R = 22, D = R * 2, W = 484, H = 650, STEP = Math.sqrt(3) * R;
  const key = (r, c) => `${r},${c}`;
  const valid = (r, c) => r >= 0 && c >= 0 && c < 11 - (r % 2);
  const position = (r, c, ceiling = 8) => ({ x: R + c * D + (r % 2) * R, y: ceiling + R + r * STEP });
  function neighbors(r, c) {
    const offset = r % 2 ? 1 : -1;
    return [[r, c - 1], [r, c + 1], [r - 1, c], [r - 1, c + offset], [r + 1, c], [r + 1, c + offset]].filter(([a, b]) => valid(a, b));
  }
  function flood(board, seeds, type) {
    const seen = new Set(), stack = seeds.slice();
    while (stack.length) {
      const k = stack.pop(), face = board.get(k);
      if (!face || seen.has(k) || (type !== undefined && face.type !== type)) continue;
      seen.add(k);
      for (const [r, c] of neighbors(face.r, face.c)) stack.push(key(r, c));
    }
    return seen;
  }
  function loose(board) {
    const anchored = flood(board, [...board].filter(([, f]) => f.r === 0).map(([k]) => k));
    return [...board.keys()].filter(k => !anchored.has(k));
  }
  // Small fixed spatial steps prevent tunneling and keep the guide and shot identical.
  function advance(shot, distance, board, ceiling) {
    for (let left = distance; left > 0; left -= 3) {
      const step = Math.min(3, left);
      shot.x += shot.vx * step; shot.y += shot.vy * step;
      if (shot.x < R) { shot.x = R * 2 - shot.x; shot.vx *= -1; }
      if (shot.x > W - R) { shot.x = 2 * (W - R) - shot.x; shot.vx *= -1; }
      let hit = null;
      for (const f of board.values()) {
        const p = position(f.r, f.c, ceiling);
        if (Math.hypot(p.x - shot.x, p.y - shot.y) <= D - .2) { hit = f; break; }
      }
      if (hit || shot.y <= ceiling + R) {
        const candidates = hit ? neighbors(hit.r, hit.c) : Array.from({length: 11}, (_, c) => [0, c]);
        const empty = candidates.filter(([r, c]) => !board.has(key(r, c)));
        empty.sort(([r, c], [rr, cc]) => {
          const a = position(r, c, ceiling), b = position(rr, cc, ceiling);
          return Math.hypot(a.x - shot.x, a.y - shot.y) - Math.hypot(b.x - shot.x, b.y - shot.y);
        });
        return { cell: empty[0] || null };
      }
    }
    return null;
  }
  const api = { R, D, W, H, STEP, key, valid, position, neighbors, flood, loose, advance };
  if (typeof module !== 'undefined') module.exports = api;
  else root.ViboodingEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
