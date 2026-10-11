// Run with: node gourds/tests/render.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const canvas = { clientWidth: 640, style: {}, addEventListener() {}, getContext() { return context; } };
const context = new Proxy({}, { get: () => (...args) => {
  for (const value of args) if (typeof value === 'number') assert.ok(Number.isFinite(value));
}, set: () => true });
const element = { addEventListener() {}, classList: { add() {} } };
const sandbox = {
  document: { getElementById: id => id === 'c' ? canvas : { ...element } },
  window: { innerWidth: 640, devicePixelRatio: 1, addEventListener() {} },
  location: { hash: '#42' }, requestAnimationFrame() {}
};
const source = fs.readFileSync(require.resolve('../main.js'), 'utf8');
vm.runInNewContext(source.replace(/\}\)\(\);\s*$/, `
  globalThis.test = { grow, renderMesh, draw, view(g, y, p, ink) {
    G = g; yaw = y; pitch = p; inkOnly = ink; W = 640; H = 500;
  } };
})();`), sandbox);
const api = sandbox.test;
const kinds = new Set();
let views = 0;
for (let seed = 0; seed < 80; seed++) {
  const g = api.grow(seed);
  kinds.add(g.kind);
  assert.deepEqual(g.body.verts, api.grow(seed).body.verts, 'seed must reproduce geometry');
  for (const mesh of [g.body, g.stem]) {
    assert.ok([...mesh.verts].every(Number.isFinite));
    // Both body poles and the stem cut end must close at one shared point.
    const rings = mesh === g.body ? [0, mesh.U - 1] : [mesh.U - 1];
    for (const ring of rings) for (let j = 1; j < mesh.V; j++) {
      for (let axis = 0; axis < 3; axis++) {
        assert.ok(mesh.verts[(ring * mesh.V + j) * 3 + axis] === mesh.verts[ring * mesh.V * 3 + axis]);
      }
    }
  }
  for (const pitch of [-1.1, 0, 1.1]) for (const yaw of [0, 1.6, 3.2]) {
    api.view(g, yaw, pitch, views % 2 === 0);
    const faces = [];
    api.renderMesh(g, g.body, faces, false);
    assert.ok(faces.length > 0);
    for (const face of faces) {
      const p = face.p;
      let area = 0;
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        area += p[2*i] * p[2*j+1] - p[2*j] * p[2*i+1];
      }
      assert.ok(area < .01, 'visible face must agree with perspective winding');
    }
    api.draw();
    views++;
  }
}
assert.equal(kinds.size, 8);
console.log(`Verified ${kinds.size} varieties across ${views} views, both ink modes, closed ends and repeatable seeds.`);
