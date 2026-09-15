/* Native WebGL 1, no runtime dependencies. Distances/sizes are illustrative.
   Periods and diameters: NASA Planetary Fact Sheet. */
'use strict';
(() => {
const $ = id => document.getElementById(id);
const bodies = [
 {name:'Sun',color:'#ffca6b',r:2.8,orbit:0,period:0,diameter:1392700,kind:1,category:'OUR HOME STAR',description:'The star at the center of it all. Its gravity keeps eight planets on their journeys through space.'},
 {name:'Mercury',color:'#a59c91',r:.43,orbit:5.2,period:88,diameter:4879,category:'01 / ROCKY PLANET',description:'A small, cratered world on the shortest journey around the Sun. Watch how quickly it laps the outer planets.'},
 {name:'Venus',color:'#e8be80',r:.68,orbit:7.4,period:224.7,diameter:12104,category:'02 / ROCKY PLANET',description:'A rocky world wrapped in thick clouds. Venus is almost as large as Earth, but has a very different atmosphere.'},
 {name:'Earth',color:'#65a9e6',r:.74,orbit:10,period:365.2,diameter:12756,kind:3,category:'03 / ROCKY PLANET',description:'Our home, a blue world with liquid oceans. One complete orbit is one Earth year.'},
 {name:'Mars',color:'#dc8262',r:.54,orbit:12.8,period:687,diameter:6792,category:'04 / ROCKY PLANET',description:'The red planet. Its smaller size and slower orbit make a useful comparison with its neighbor Earth.'},
 {name:'Jupiter',color:'#d6b394',r:1.65,orbit:17.3,period:4331,diameter:142984,kind:4,category:'05 / GAS GIANT',description:'The largest planet. Bands of clouds wrap around this giant, far beyond the rocky inner worlds.'},
 {name:'Saturn',color:'#e0c795',r:1.38,orbit:23,period:10747,diameter:120536,kind:4,category:'06 / GAS GIANT',description:'A gas giant surrounded by rings of ice and rock. Rotate the view to see its rings from a different angle.'},
 {name:'Uranus',color:'#91d6dc',r:1.02,orbit:28.5,period:30589,diameter:51118,category:'07 / ICE GIANT',description:'A pale blue ice giant in the outer solar system. It needs about 84 Earth years to circle the Sun.'},
 {name:'Neptune',color:'#537ce4',r:.98,orbit:33.5,period:59800,diameter:49528,category:'08 / ICE GIANT',description:'The most distant of the eight planets. A single orbit takes about 164 Earth years; turn up the speed to follow it.'}
];
const rates=[1,7,30,365,3650];
let selected=0, days=0, paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
let yaw=.3,pitch=.68,distance=78,last=0,raf=0,lost=false,viewProjection;
let width=1,height=1;
const target=[0,0,0],canvas=$('space');
bodies.forEach((b,i)=>{
 b.pos=[0,0,0]; b.rgb=b.color.match(/\w\w/g).map(h=>parseInt(h,16)/255);
 const button=document.createElement('button'); button.type='button';button.innerHTML=`<span class="dot" style="--planet:${b.color}"></span>${b.name}`;
 button.addEventListener('click',()=>select(i));$('planets').append(button);b.button=button;
 const label=document.createElement('span');label.className='planet-label';label.textContent=b.name;$('labels').append(label);b.label=label;
});
function select(i){selected=i;const b=bodies[i];bodies.forEach((p,j)=>{p.button.setAttribute('aria-pressed',String(i===j));p.label.classList.toggle('selected',i===j);});$('category').textContent=b.category;$('name').textContent=i?b.name:'The Sun';$('description').textContent=b.description;$('stat-label').textContent=i?'DIAMETER':'PLANETS';$('stat').textContent=i?b.diameter.toLocaleString()+' km':'8';$('period-label').textContent=i?'ONE ORBIT':'OUR VIEW';$('period').textContent=i?(b.period<1000?b.period.toLocaleString()+' days':(b.period/365.2).toFixed(1)+' years'):'All orbits';distance=i?Math.max(13,b.r*9):78;}
function syncPause(){$('pause').textContent=paused?'▶ Play':'Ⅱ Pause';$('pause').setAttribute('aria-pressed',String(paused));$('state').textContent=paused?'ORBITS PAUSED':'ORBITS RUNNING';}
$('pause').onclick=()=>{paused=!paused;syncPause();};$('speed').oninput=()=>{$('rate').textContent=rates[Number($('speed').value)].toLocaleString()+' days / sec';};
$('reset').onclick=()=>{select(0);yaw=.3;pitch=.68;};$('top').onclick=()=>{pitch=1.54;};
function zoom(factor){distance=Math.max(6,Math.min(140,distance*factor));}
$('zoom-in').onclick=()=>zoom(.82);$('zoom-out').onclick=()=>zoom(1.22);
$('names').onchange=()=>{$('labels').hidden=!$('names').checked;};
select(0);syncPause();
function failure(message){$('error').hidden=false;$('error').textContent=message;}
const gl=canvas.getContext('webgl',{alpha:false,antialias:true,powerPreference:'low-power'});
if(!gl){failure('3D graphics are unavailable in this browser. Try a browser with WebGL enabled. You can still explore planet facts below.');$('state').textContent='3D UNAVAILABLE';$('pause').disabled=true;return;}
const vertex=`attribute vec3 aPosition;
uniform mat4 uVP; uniform vec3 uCenter; uniform float uRadius; uniform float uSpin;
varying vec3 vLocal; varying vec3 vWorld; varying vec3 vNormal;
void main(){float c=cos(uSpin),s=sin(uSpin); mat3 rot=mat3(c,0.,-s,0.,1.,0.,s,0.,c);vLocal=aPosition;vNormal=rot*aPosition;vWorld=uCenter+vNormal*uRadius;gl_Position=uVP*vec4(vWorld,1.);gl_PointSize=1.5;}`;
const fragment=`precision mediump float;
uniform vec3 uColor;uniform float uKind;
varying vec3 vLocal;varying vec3 vWorld;varying vec3 vNormal;
void main(){vec3 col=uColor;if(uKind>1.5&&uKind<2.5){gl_FragColor=vec4(col,1.);return;}
float texture=sin(vLocal.y*31.+sin(vLocal.x*11.)*2.)*sin(vLocal.z*27.);
if(uKind>3.5){col*=.85+.15*sin(vLocal.y*45.+sin(vLocal.x*8.)*.8);}
else if(uKind>2.5){float land=sin(vLocal.x*9.+sin(vLocal.y*7.))+sin(vLocal.z*11.+vLocal.y*5.)+sin(vLocal.y*15.+vLocal.x*4.);col=mix(col,vec3(.23,.48,.32),smoothstep(.3,.65,land));col=mix(col,vec3(.9,.95,1.),smoothstep(.85,.97,abs(vLocal.y)));}
else {col*=.92+.08*texture;}
float light=.23+.77*max(dot(normalize(vNormal),normalize(-vWorld)),0.);
if(uKind>.5&&uKind<1.5)light=1.15;
gl_FragColor=vec4(col*light,1.);}`;
function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
let program;
try{program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));}catch(e){failure('The 3D renderer could not start. Please reload or try another browser.');console.error(e);return;}
gl.useProgram(program);
const loc={};['uVP','uCenter','uRadius','uSpin','uColor','uKind'].forEach(n=>loc[n]=gl.getUniformLocation(program,n));
const attr=gl.getAttribLocation(program,'aPosition');gl.enableVertexAttribArray(attr);
function mesh(vertices,mode){const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);return{buffer,count:vertices.length/3,mode};}
const vertices=[];function spherePoint(a,b){return[Math.sin(a)*Math.cos(b),Math.cos(a),Math.sin(a)*Math.sin(b)];}
for(let y=0;y<28;y++)for(let x=0;x<48;x++){const a=y*Math.PI/28,b=x*Math.PI*2/48,c=(y+1)*Math.PI/28,d=(x+1)*Math.PI*2/48;vertices.push(...spherePoint(a,b),...spherePoint(c,b),...spherePoint(a,d),...spherePoint(a,d),...spherePoint(c,b),...spherePoint(c,d));}
const sphere=mesh(vertices,gl.TRIANGLES),circle=[];
for(let i=0;i<192;i++){const a=i/192*Math.PI*2;circle.push(Math.cos(a),0,Math.sin(a));}
const orbit=mesh(circle,gl.LINE_LOOP),ringVertices=[];
function ringPoint(r,a){return[r*Math.cos(a),r*Math.sin(a)*.45,r*Math.sin(a)*.89];}
for(let j=0;j<5;j++)for(let i=0;i<192;i++){const a=i/192*Math.PI*2,b=(i+1)/192*Math.PI*2,r=1.45+j*.18,R=r+.12;ringVertices.push(...ringPoint(r,a),...ringPoint(R,a),...ringPoint(r,b),...ringPoint(r,b),...ringPoint(R,a),...ringPoint(R,b));}
const rings=mesh(ringVertices,gl.TRIANGLES),stars=[];let seed=42;
function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
for(let i=0;i<1200;i++){const y=random()*2-1,a=random()*Math.PI*2,r=Math.sqrt(1-y*y);stars.push(r*Math.cos(a)*220,y*220,r*Math.sin(a)*220);}
const starMesh=mesh(stars,gl.POINTS);
function draw(m,center,radius,color,kind=0,spin=0){gl.bindBuffer(gl.ARRAY_BUFFER,m.buffer);gl.vertexAttribPointer(attr,3,gl.FLOAT,false,0,0);gl.uniform3fv(loc.uCenter,center);gl.uniform1f(loc.uRadius,radius);gl.uniform3fv(loc.uColor,color);gl.uniform1f(loc.uKind,kind);gl.uniform1f(loc.uSpin,spin);gl.drawArrays(m.mode,0,m.count);}
function norm(v){const n=Math.hypot(...v);return v.map(x=>x/n);}function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}function dot(a,b){return a.reduce((sum,x,i)=>sum+x*b[i],0);}
function multiply(a,b){const out=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)out[c*4+r]+=a[k*4+r]*b[c*4+k];return out;}
function camera(){const cameraDistance=distance*(selected===0?Math.max(1,height/width):1);const eye=[target[0]+cameraDistance*Math.cos(pitch)*Math.sin(yaw),target[1]+cameraDistance*Math.sin(pitch),target[2]+cameraDistance*Math.cos(pitch)*Math.cos(yaw)];const z=norm(eye.map((x,i)=>x-target[i])),x=norm(cross([0,1,0],z)),y=cross(z,x);const view=[x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1];const f=1/Math.tan(Math.PI/7),aspect=width/height;const p=[f/aspect,0,0,0,0,f,0,0,0,0,-(600+.1)/(600-.1),-1,0,0,-120/(600-.1),0];return multiply(p,view);}
function project(p){const v=[...p,1],r=[0,0,0,0];for(let row=0;row<4;row++)for(let k=0;k<4;k++)r[row]+=viewProjection[k*4+row]*v[k];return{x:(r[0]/r[3]*.5+.5)*width,y:(-.5*r[1]/r[3]+.5)*height,w:r[3]};}
function resize(){const r=canvas.getBoundingClientRect();width=r.width;height=r.height;const ratio=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);gl.viewport(0,0,canvas.width,canvas.height);}
new ResizeObserver(resize).observe(canvas);resize();gl.enable(gl.DEPTH_TEST);gl.clearColor(.0235,.0392,.0706,1);
function frame(now){raf=0;if(lost||document.hidden)return;const dt=last?Math.min((now-last)/1000,.05):0;last=now;if(!paused)days+=dt*rates[Number($('speed').value)];
 bodies.forEach((b,i)=>{const angle=i*2.399+(b.period?days/b.period*Math.PI*2:0);b.pos=[Math.cos(angle)*b.orbit,0,Math.sin(angle)*b.orbit];});
 for(let i=0;i<3;i++)target[i]+=(bodies[selected].pos[i]-target[i])*Math.min(1,dt*8);
 viewProjection=camera();gl.uniformMatrix4fv(loc.uVP,false,viewProjection);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);draw(starMesh,[0,0,0],1,[.44,.52,.63],2);
 if($('orbits').checked)bodies.slice(1).forEach((b,i)=>draw(orbit,[0,0,0],b.orbit,selected===i+1?[.26,.46,.43]:[.10,.15,.20],2));
 bodies.forEach((b,i)=>{draw(sphere,b.pos,b.r,b.rgb,b.kind||0,days*.015);if(i===6)draw(rings,b.pos,b.r,[.60,.53,.39],2);const p=project(b.pos);const visible=p.w>0&&p.x>0&&p.x<width-40&&p.y>45&&p.y<height-60;b.screen=p;b.label.hidden=!visible;b.label.style.transform=`translate(${p.x+10}px,${p.y+10}px)`;});
 $('elapsed').textContent='DAY '+Math.floor(days).toLocaleString();raf=requestAnimationFrame(frame);
}
raf=requestAnimationFrame(frame);
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else if(!raf&&!lost){last=0;raf=requestAnimationFrame(frame);}});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;cancelAnimationFrame(raf);failure('The graphics session was interrupted. Reload this page to restart the solar system.');$('state').textContent='3D INTERRUPTED';});
const pointers=new Map();let start=null,moved=false,pinch=0;
canvas.addEventListener('pointerdown',e=>{canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);if(pointers.size===1){start=[e.clientX,e.clientY];moved=false;}else{moved=true;pinch=0;}});
canvas.addEventListener('pointermove',e=>{const previous=pointers.get(e.pointerId);if(!previous)return;pointers.set(e.pointerId,[e.clientX,e.clientY]);if(pointers.size===2){const [a,b]=[...pointers.values()],gap=Math.hypot(a[0]-b[0],a[1]-b[1]);if(pinch&&gap>0)zoom(pinch/gap);pinch=gap;moved=true;}else if(pointers.size===1){if(start&&Math.hypot(e.clientX-start[0],e.clientY-start[1])>5)moved=true;yaw-=(e.clientX-previous[0])*.006;pitch=Math.max(-1.54,Math.min(1.54,pitch+(e.clientY-previous[1])*.006));}});
canvas.addEventListener('pointerup',e=>{if(!moved&&pointers.size===1){const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;let nearest=-1,best=Infinity;bodies.forEach((b,i)=>{if(!b.screen||b.screen.w<=0)return;const d=Math.hypot(x-b.screen.x,y-b.screen.y),radius=Math.max(18,b.r*height/(b.screen.w*Math.tan(Math.PI/7)));if(d<radius&&d<best){nearest=i;best=d;}});if(nearest>=0)select(nearest);}pointers.delete(e.pointerId);pinch=0;});
for(const event of ['pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{pointers.delete(e.pointerId);pinch=0;});
canvas.addEventListener('wheel',e=>{e.preventDefault();const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?height:1);zoom(Math.exp(Math.max(-.5,Math.min(.5,delta*.001))));},{passive:false});
canvas.addEventListener('keydown',e=>{const actions={ArrowLeft:()=>yaw-=.12,ArrowRight:()=>yaw+=.12,ArrowUp:()=>pitch=Math.min(1.54,pitch+.1),ArrowDown:()=>pitch=Math.max(-1.54,pitch-.1),'+':()=>zoom(.85),'=':()=>zoom(.85),'-':()=>zoom(1.18),' ':()=>{paused=!paused;syncPause();},Home:()=>$('reset').click()};if(actions[e.key]){e.preventDefault();actions[e.key]();}});
})();
