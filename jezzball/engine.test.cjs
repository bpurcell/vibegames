const assert=require('node:assert/strict');
const {Game,W,H,R}=require('./engine.js');
function fresh(){const g=new Game(()=>.5);g.start();return g;}
function run(g,seconds,rate=60){for(let i=0;i<seconds*rate;i++)g.update(1/rate);}
// Refresh rate must not affect physics or time.
const a=fresh(),b=fresh();run(a,5,30);run(b,5,144);assert(Math.abs(a.balls[0].x-b.balls[0].x)<1e-6);assert(Math.abs(a.time-b.time)<1e-6);
// Completed walls partition safely; empty space and wall area are counted.
const g=fresh();for(const ball of g.balls){ball.x=400;ball.y=460;ball.vx=10;ball.vy=1;}assert(g.build(400,350,'h'));run(g,1);assert(g.cleared>60);assert.equal(g.regions.length,1);assert(g.balls.every(b=>b.region===g.regions[0]));assert.equal(g.lives,3);
// A hit at the origin costs one life even when two balls touch both halves.
const collision=fresh();for(const ball of collision.balls){ball.x=400;ball.y=280;ball.vx=0;ball.vy=0;}collision.build(400,280,'h');collision.update(.02);assert.equal(collision.lives,2);assert.equal(collision.wall,null);assert.equal(collision.cleared,0);
// Check contact on the final growth step, not just while growing.
const final=fresh();for(const ball of final.balls){ball.x=5;ball.y=280;ball.vx=0;ball.vy=0;}final.build(400,280,'h');final.wall.neg=399;final.wall.pos=399;final.update(.01);assert.equal(final.lives,2);assert.equal(final.regions.length,1);
// Pause freezes both a growing wall and timer.
const p=fresh();p.build(400,50,'h');p.pause();const before=p.time;run(p,10);assert.equal(p.time,before);assert.equal(p.wall.neg,0);p.pause();assert.equal(p.state,'playing');
// Reject boundary slivers and double builds.
const edge=fresh();assert(!edge.build(400,1,'h'));assert(!edge.build(1,280,'v'));assert(edge.build(400,200,'h'));assert(!edge.build(400,300,'h'));
// Capture 75%, advance, and reset level resources while retaining score.
const win=fresh();for(const ball of win.balls){ball.x=400;ball.y=510;ball.vx=1;ball.vy=1;}win.build(400,440,'h');run(win,1);assert.equal(win.state,'won');const score=win.score;win.next();assert.equal(win.level,2);assert.equal(win.balls.length,3);assert.equal(win.lives,3);assert.equal(win.cleared,0);assert.equal(win.score,score);
// Balls never escape their captured region after repeated bounces.
run(g,20);for(const ball of g.balls){const r=ball.region;assert(ball.x>=r.x+R&&ball.x<=r.x+r.w-R);assert(ball.y>=r.y+R&&ball.y<=r.y+r.h-R);}
const timeout=fresh();timeout.time=.001;timeout.update(.02);assert.equal(timeout.state,'lost');assert.equal(timeout.time,0);
// A wall with balls on both sides retains both occupied regions.
const split=fresh();split.balls[0].y=80;split.balls[1].y=480;for(const ball of split.balls){ball.vx=1;ball.vy=1;}split.build(400,280,'h');run(split,1);assert.equal(split.regions.length,2);assert.notEqual(split.balls[0].region,split.balls[1].region);assert(split.cleared<1);
// Three failed attempts end the round, and a new game resets all progress.
for(let i=0;i<2;i++){collision.build(400,280,'h');collision.update(.02);}assert.equal(collision.state,'lost');assert.equal(collision.lives,0);collision.start();assert.equal(collision.state,'playing');assert.equal(collision.score,0);assert.equal(collision.lives,3);
console.log('Passed refresh independence, partitioning, hit handling, final-step collision, pause, edge guards, progression, containment, and timeout.');
