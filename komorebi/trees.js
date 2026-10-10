// Seeded recursive branching: each child shrinks, rotates, and inherits wind.
// Geometry is independent of canvas size, so pan, reload, and export agree.
(function(global){
const cache=new Map();
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
// Bamboo shares the trees' ink palette and branch renderer, but grows in
// jointed culms rather than a recursive crown. Leaf RNG never changes stems.
function generateBamboo(seed,p){
 const r=rng(seed),branches=[],leaves=[],nodes=[];
 const count=3+Math.floor(r()*3),joints=p.depth+3;
 for(let j=0;j<count;j++){
  const base=(j-(count-1)/2)*9+(r()-.5)*5;
  const height=76+r()*36,lean=(r()-.5)*(8+p.wildness*19)+p.wind*22;
  const thickness=1.6+r()*1.5,phase=r()*6.28;
  const point=t=>({x:base+lean*t*t+Math.sin(t*4+phase)*p.wildness*2*t,y:-height*t});
  for(let k=0;k<joints;k++){
   const t0=k/joints,t1=(k+1)/joints,a=point(t0),b=point(t1),mid=point((t0+t1)/2);
   const width=thickness*(1-t0*.55);
   branches.push({x:a.x,y:a.y,ex:b.x,ey:b.y,cx:mid.x,cy:mid.y,width});
   if(k>0)nodes.push({x:a.x,y:a.y,width:width*.66,tilt:(b.x-a.x)/Math.max(1,a.y-b.y)});
   if(k<2 || k===joints-1)continue;
   const side=(k+j)%2?1:-1,reach=10+r()*13;
   const angle=-Math.PI/2+side*(p.spread*Math.PI/180+.35);
   const tip={x:a.x+Math.cos(angle)*reach+p.wind*4,y:a.y+Math.sin(angle)*reach};
   branches.push({x:a.x,y:a.y,ex:tip.x,ey:tip.y,cx:a.x+(tip.x-a.x)*.5,cy:a.y-3,width:.42});
   const leafRng=rng(seed^Math.imul(j*31+k+1,7919));
   for(let n=0;n<7;n++){
    const t=.22+n*.1,start={x:a.x+(tip.x-a.x)*t,y:a.y+(tip.y-a.y)*t};
    const flip=n%2?1:-1;
    const leafAngle=angle+flip*(.45+leafRng()*.65)+(leafRng()-.5)*p.wildness*.5;
    const length=7+leafRng()*9,width=.6+leafRng()*.75,alpha=.3+leafRng()*.3,color=Math.floor(leafRng()*4);
    if(n>=Math.round(p.fullness*7))continue;
    leaves.push({x:start.x,y:start.y,angle:leafAngle,length,width,alpha,color});
   }
  }
 }
 return {branches,leaves,nodes,settings:p};
}
function generate(type,seed,settings={}){
 settings=settings&&typeof settings==='object'?settings:{};
 const bounded=(value,min,max,fallback)=>{const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback};
 const p={fullness:bounded(settings.fullness??.6,0,1,.6),depth:Math.round(bounded(settings.depth??5,3,7,5)),spread:bounded(settings.spread??35,15,65,35),wildness:bounded(settings.wildness??.45,0,1,.45),wind:bounded(settings.wind??0,-1,1,0)};
 const key=JSON.stringify([type,seed,p]);if(cache.has(key))return cache.get(key);
 if(type==='bamboo'){const model=generateBamboo(seed,p);if(cache.size>=512)cache.delete(cache.keys().next().value);cache.set(key,model);return model;}
 const r=rng(seed),branches=[],leaves=[];const lean=(r()-.5)*(.25+p.wildness*.65)+p.wind*.12,ratio=.62+r()*.16,spread=p.spread*Math.PI/180*(.8+r()*.4);
 function branch(x,y,len,angle,thickness,depth){
  const bend=(r()-.5)*p.wildness*.55+p.wind*.07;
  const a=angle+bend,ex=x+Math.cos(a)*len,ey=y+Math.sin(a)*len;
  branches.push({x,y,ex,ey,cx:x+Math.cos(angle-bend)*len*.5,cy:y+Math.sin(angle-bend)*len*.5,width:thickness});
  if(depth===0){
   const count=type==='sakura'?18:24,target=Math.round(count*p.fullness/.6);
   function leaf(next){const theta=next()*Math.PI*2,rad=Math.sqrt(next());return {x:ex+Math.cos(theta)*rad*(type==='sakura'?7:9),y:ey+Math.sin(theta)*rad*4,size:.6+next()*1.5,angle:theta,color:Math.floor(next()*4),alpha:.45+next()*.45}}
   // Consume the same growth RNG at every fullness: changing foliage never reshapes branches.
   for(let i=0;i<count;i++){const l=leaf(r);if(i<target)leaves.push(l)}
   const extra=rng(seed^Math.imul(branches.length,7919));for(let i=count;i<target;i++)leaves.push(leaf(extra));
   return;
  }
  const noise=()=>1+(r()-.5)*p.wildness*.65;
  if(type==='pine'){
   const side=r()<.5?-1:1;
   branch(ex,ey,len*(ratio+.035)*noise(),a+(r()-.5)*.22+p.wind*.035,thickness*.72,depth-1);
   branch(ex,ey,len*.58*noise(),a+side*spread*(1+r()*.4)+p.wind*.07,thickness*.56,depth-1);
  }else{
   branch(ex,ey,len*ratio*noise(),a-spread*(.65+r()*.5)+p.wind*.05,thickness*.68,depth-1);
   branch(ex,ey,len*ratio*noise(),a+spread*(.65+r()*.5)+p.wind*.05,thickness*.68,depth-1);
  }
 }
 branch(0,0,34,-Math.PI/2+lean,4.8,p.depth);
 let model={branches,leaves,settings:p};if(cache.size>=512)cache.delete(cache.keys().next().value);cache.set(key,model);return model;
}
function render(c,x,y,size,type,seed,opacity=1,settings={}){
 const model=generate(type,seed,settings);c.save();c.translate(x,y);c.scale(size/100,size/100);c.lineCap='round';c.strokeStyle='#494b41';c.globalAlpha=opacity;
 for(const b of model.branches){
  const dx=b.ex-b.x,dy=b.ey-b.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
  if(b.width>1){const left=[],right=[];for(let i=0;i<=10;i++){const t=i/10,u=1-t,px=u*u*b.x+2*u*t*b.cx+t*t*b.ex,py=u*u*b.y+2*u*t*b.cy+t*t*b.ey,edge=b.width*(1-t*.4)*(.5+Math.sin(t*17+seed)*.07);left.push([px+nx*edge,py+ny*edge]);right.push([px-nx*edge,py-ny*edge])}c.beginPath();left.concat(right.reverse()).forEach((v,i)=>i?c.lineTo(...v):c.moveTo(...v));c.closePath();c.fillStyle='#777565';c.globalAlpha=opacity*.18;c.fill();c.globalAlpha=opacity*.8;c.lineWidth=.55;c.stroke()}
  else{c.globalAlpha=opacity*.65;c.lineWidth=Math.max(.22,b.width*.65);c.beginPath();c.moveTo(b.x,b.y);c.quadraticCurveTo(b.cx,b.cy,b.ex,b.ey);c.stroke()}
 }
 const colors=type==='sakura'?['#9d8179','#b4a095','#b9ab99','#867267']:['#484b42','#5a5b4f','#6b6b5b','#83816c'];
 for(const n of model.nodes||[]){
  c.globalAlpha=opacity*.65;c.strokeStyle='#494b41';c.lineWidth=.45;
  c.beginPath();c.moveTo(n.x-n.width,n.y-n.tilt*n.width);
  c.quadraticCurveTo(n.x,n.y+1,n.x+n.width,n.y+n.tilt*n.width);c.stroke();
 }
 for(const l of model.leaves){
  c.globalAlpha=opacity*l.alpha*.8;c.fillStyle=colors[l.color];c.beginPath();
  if(type==='bamboo'){
   const dx=Math.cos(l.angle),dy=Math.sin(l.angle),nx=-dy,ny=dx;
   const ex=l.x+dx*l.length,ey=l.y+dy*l.length;
   c.moveTo(l.x,l.y);
   c.quadraticCurveTo(l.x+dx*l.length*.45+nx*l.width,l.y+dy*l.length*.45+ny*l.width,ex,ey);
   c.quadraticCurveTo(l.x+dx*l.length*.6-nx*l.width,l.y+dy*l.length*.6-ny*l.width,l.x,l.y);
   c.fill();c.strokeStyle='#5a5b4f';c.lineWidth=.25;c.stroke();
   c.globalAlpha=opacity*l.alpha*.45;c.beginPath();c.moveTo(l.x,l.y);c.lineTo(ex,ey);c.stroke();
  }else{c.ellipse(l.x,l.y,type==='sakura'?l.size:l.size*2,type==='sakura'?l.size*.8:.6,l.angle,0,Math.PI*2);c.fill()}
 }
 c.globalAlpha=opacity*.5;c.lineWidth=.7;c.beginPath();c.moveTo(-9,2);c.quadraticCurveTo(0,-2,12,1);c.stroke();c.restore();
}
 global.ForestFractal={generate,render};
})(typeof window==='undefined'?globalThis:window);
