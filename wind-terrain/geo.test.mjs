import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boundsFor, tilePlan, tileXY, decodeTerrarium, makeWindField, sampleGrid } from './geo.mjs';

test('dateline selection stays contiguous while DEM requests wrap', () => {
  const bounds = boundsFor(10, 179, 6);
  assert.equal(bounds.east - bounds.west, 6);
  const plan = tilePlan(bounds);
  assert.ok(plan.tiles.some(t => t.x >= 2**plan.zoom));
  assert.ok(plan.tiles.every(t => t.wrappedX >= 0 && t.wrappedX < 2**plan.zoom));
});
test('polar selections stay inside the supported elevation coverage', () => {
  for (const lat of [-90, 90]) {
    const b = boundsFor(lat, 0, 20);
    assert.ok(b.north <= 84 && b.south >= -84);
    assert.ok(tilePlan(b).tiles.every(t => t.y >= 0 && t.y < 2**t.zoom));
  }
});
test('default region resolves to the four bundled elevation tiles', () => {
  const plan = tilePlan(boundsFor(46, 10, 6));
  assert.equal(plan.tiles.length, 4);
  for (const t of plan.tiles) assert.ok(readFileSync(new URL(`./data/terrain/${t.zoom}-${t.wrappedX}-${t.y}.png`, import.meta.url)).length > 1000);
});
test('Terrarium elevation decodes signed heights and fractional meters', () => {
  assert.equal(decodeTerrarium(128,0,0),0);
  assert.equal(decodeTerrarium(137,219,68),2523.265625);
  assert.equal(decodeTerrarium(127,255,0),-1);
});
test('elevation interpolation preserves corners and blends cell centers', () => {
  const grid = [0,100,200,300];
  assert.equal(sampleGrid(grid,2,.5,.5),150);
  assert.equal(sampleGrid(grid,2,1,1),300);
  assert.equal(sampleGrid(grid,2,-1,-1),0);
});
test('wind interpolation reproduces grid nodes and wraps longitude', () => {
  const records=JSON.parse(readFileSync(new URL('./data/wind.json',import.meta.url))), field=makeWindField(records);
  const expected=records[0].data[(90-46)*360+10];
  assert.equal(field.sample(46,10).u,expected);
  assert.deepEqual(field.sample(20,-180),field.sample(20,180));
  assert.deepEqual(field.sample(20,0),field.sample(20,360));
  assert.ok(Number.isFinite(field.sample(-90,0).speed));
  const a=field.sample(46,10), b=field.sample(46,11), middle=field.sample(46,10.5);
  assert.ok(Math.abs(middle.u-(a.u+b.u)/2)<1e-10);
});
test('Mercator origin is equator and Greenwich at the tile midpoint', () => {
  assert.deepEqual(tileXY(0,0,6),[32,32]);
});
