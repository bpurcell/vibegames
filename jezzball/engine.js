/* Pure fixed-step simulation. Positions and speeds use board units / seconds. */
(function(root){
'use strict';
const W=800,H=560,R=9,T=4,STEP=1/120;
function hit(ball,rect){const x=Math.max(rect.x,Math.min(ball.x,rect.x+rect.w)),y=Math.max(rect.y,Math.min(ball.y,rect.y+rect.h));return (ball.x-x)**2+(ball.y-y)**2<=(R+T/2)**2;}
class Game {
 constructor(random=Math.random){this.random=random;this.level=1;this.score=0;this.state='ready';this.resetBoard();}
 resetBoard(){this.regions=[{x:0,y:0,w:W,h:H}];this.claimed=[];this.wall=null;this.lives=3;this.time=90;this.cleared=0;this.accumulator=0;this.event='';this.balls=Array.from({length:Math.min(this.level+1,16)},(_,i)=>{const angle=.4+this.random()*.7+(i%4)*Math.PI/2,speed=135+Math.min(this.level-1,15)*9;return {x:40+this.random()*(W-80),y:40+this.random()*(H-80),vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,region:this.regions[0],color:i%4};});}
 start(){this.level=1;this.score=0;this.resetBoard();this.state='playing';}
 next(){if(this.state!=='won')return;this.level++;this.resetBoard();this.state='playing';}
 pause(){if(this.state==='playing')this.state='paused';else if(this.state==='paused')this.state='playing';this.accumulator=0;}
 regionAt(x,y){return this.regions.find(c=>x>c.x&&x<c.x+c.w&&y>c.y&&y<c.y+c.h);}
 build(x,y,axis){if(this.state!=='playing'||this.wall||!['h','v'].includes(axis))return false;const c=this.regionAt(x,y);if(!c)return false;const p=axis==='h'?y:x,lo=axis==='h'?c.y:c.x,extent=axis==='h'?c.h:c.w;if(p-lo<R*2+T||lo+extent-p<R*2+T){this.event='Choose a little farther from the edge.';return false;}this.wall={x,y,axis,region:c,neg:0,pos:0,maxNeg:axis==='h'?x-c.x:y-c.y,maxPos:axis==='h'?c.x+c.w-x:c.y+c.h-y};return true;}
 wallRect(){const w=this.wall;return w.axis==='h'?{x:w.x-w.neg,y:w.y,w:w.neg+w.pos,h:0}:{x:w.x,y:w.y-w.neg,w:0,h:w.neg+w.pos};}
 update(dt){if(this.state!=='playing')return;this.accumulator+=Math.min(Math.max(dt,0),.25);while(this.accumulator+1e-10>=STEP&&this.state==='playing'){this.accumulator-=STEP;this.step(STEP);}}
 step(dt){this.time=Math.max(0,this.time-dt);if(this.time<=0){this.state='lost';this.event='Time ran out.';return;}
  for(const b of this.balls){const c=b.region;b.x+=b.vx*dt;b.y+=b.vy*dt;const left=c.x+R,right=c.x+c.w-R,top=c.y+R,bottom=c.y+c.h-R;if(b.x<left){b.x=left+(left-b.x);b.vx=Math.abs(b.vx);}if(b.x>right){b.x=right-(b.x-right);b.vx=-Math.abs(b.vx);}if(b.y<top){b.y=top+(top-b.y);b.vy=Math.abs(b.vy);}if(b.y>bottom){b.y=bottom-(b.y-bottom);b.vy=-Math.abs(b.vy);}}
  if(!this.wall)return;const w=this.wall;w.neg=Math.min(w.maxNeg,w.neg+460*dt);w.pos=Math.min(w.maxPos,w.pos+460*dt);
  // Test the final growth step too, before partitioning the region.
  if(this.balls.some(b=>b.region===w.region&&hit(b,this.wallRect()))){this.wall=null;this.lives=Math.max(0,this.lives-1);this.event='Wall hit — one life lost.';if(!this.lives)this.state='lost';return;}
  if(w.neg===w.maxNeg&&w.pos===w.maxPos)this.finish();
 }
 finish(){const w=this.wall,c=w.region;const parts=w.axis==='h'?[{x:c.x,y:c.y,w:c.w,h:w.y-T/2-c.y},{x:c.x,y:w.y+T/2,w:c.w,h:c.y+c.h-w.y-T/2}]:[{x:c.x,y:c.y,w:w.x-T/2-c.x,h:c.h},{x:w.x+T/2,y:c.y,w:c.x+c.w-w.x-T/2,h:c.h}];
  const occupants=this.balls.filter(b=>b.region===c);this.regions=this.regions.filter(r=>r!==c);
  for(const part of parts){const inside=occupants.filter(b=>w.axis==='h'?(part===parts[0]?b.y<w.y:b.y>w.y):(part===parts[0]?b.x<w.x:b.x>w.x));if(inside.length){this.regions.push(part);for(const b of inside)b.region=part;}else this.claimed.push(part);}
  const old=this.cleared;this.cleared=100*(1-this.regions.reduce((sum,r)=>sum+r.w*r.h,0)/(W*H));this.score+=Math.round((this.cleared-old)*100)*this.level;this.wall=null;this.event=this.cleared-old>1?'Territory captured.':'Wall secured. Keep dividing.';
  if(this.cleared>=75){this.score+=Math.ceil(this.time)*10+this.lives*250;this.state='won';this.event='Level complete!';}
 }
}
const api={Game,W,H,R,T,STEP};if(typeof module!=='undefined')module.exports=api;else root.JezzBall=api;
})(typeof window!=='undefined'?window:globalThis);
