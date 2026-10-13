import test from 'node:test';import assert from 'node:assert/strict';import {defaults,createState,advance,metrics,period,REFERENCE_LENGTH} from './physics.mjs';
function run(p,seconds=60){const s=createState();for(let i=0;i<seconds*240;i++)advance(s,p,1/240);return s;}
test('seconds pendulum and adjustment direction',()=>{assert.ok(Math.abs(period(REFERENCE_LENGTH)-2)<1e-12);assert.ok(period(1.05)>2);assert.ok(period(.95)<2)});
test('healthy escapement releases approximately once a second',()=>{const s=run(defaults);assert.ok(s.ticks>=58&&s.ticks<=61);assert.ok(s.reserve<.8);const m=metrics(s,defaults);assert.ok(Math.abs(m.intervals.at(-1)-1)<.02)});
test('no power permits coasting but no train advancement',()=>{const s=run({...defaults,drive:0},10);assert.equal(s.ticks,0);assert.equal(s.reserve,.8);assert.notEqual(s.theta,3*Math.PI/180)});
test('offset creates alternating unequal intervals',()=>{const p={...defaults,beat:1.7},m=metrics(run(p,20),p);assert.ok(Math.abs(m.intervals.at(-1)-m.intervals.at(-2))>.3)});
test('high friction dissipates swing energy',()=>{const high=run({...defaults,friction:100},60),normal=run(defaults,60);assert.ok(metrics(high,defaults).energy<metrics(normal,defaults).energy/4)});
test('empty reserve stops impulses without negative reserve',()=>{const s=createState();s.reserve=0;for(let i=0;i<2400;i++)advance(s,defaults,1/240);assert.equal(s.ticks,0);assert.equal(s.reserve,0)});
