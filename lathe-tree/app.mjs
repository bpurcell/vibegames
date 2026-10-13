import {defaults,fmt,geometry,pages,pageSVG,makePDF} from './model.mjs';
const $=id=>document.getElementById(id),key='little-pine-settings-v1';
let state={...defaults},g=null,commands=[],view='tree',pageIndex=0,tilt=.19,angle=.4;
try{const saved=JSON.parse(localStorage.getItem(key));if(saved){geometry(saved);state={h:saved.h,d:saved.d,n:saved.n,t:saved.t,curve:saved.curve??defaults.curve};}}catch{}
const fields={height:'h',diameter:'d',tiers:'n',trunk:'t'},presets={small:{h:4,d:2,n:3,t:.5,curve:.55},classic:defaults,tall:{h:8,d:3.5,n:4,t:1,curve:.55}};
const canvas=$('tree'),ctx=canvas.getContext('2d');
function sync(){for(const [id,k]of Object.entries(fields))$(id).value=state[k];$('heightRange').value=state.h;$('diameterRange').value=state.d;$('curve').value=Math.round(state.curve*100);}
function setView(next){view=next;for(const name of ['tree','profile','paper']){$(name+'Tab').classList.toggle('active',name===view);$(name+'Tab').setAttribute('aria-pressed',name===view);$(name+'View').hidden=name!==view;}draw();}
function renderPaper(){if(!g)return;$('paperSheet').innerHTML=pageSVG(commands[pageIndex],pageIndex);$('pageLabel').textContent=`${pageIndex===0?'Profile':'Cut plan'} · page ${pageIndex+1} of 2`;$('previous').disabled=pageIndex===0;$('next').disabled=pageIndex===1;}
function update(){
 try{g=geometry(state);commands=pages(state);$('error').textContent='';document.querySelector('.workspace').classList.remove('invalid');for(const id of ['print','download','previewPrint'])$(id).disabled=false;}
 catch(e){g=null;commands=[];$('error').textContent=e.message;document.querySelector('.workspace').classList.add('invalid');for(const id of ['print','download','previewPrint'])$(id).disabled=true;$('printPages').innerHTML='';$('stations').innerHTML='';$('status').textContent='';return;}
 try{localStorage.setItem(key,JSON.stringify(state));}catch{}
 $('heightRange').value=state.h;$('diameterRange').value=state.d;
 $('curveValue').textContent=`${Math.round(state.curve*100)}%`;
 for(const button of document.querySelectorAll('[data-preset]')){const p=presets[button.dataset.preset],active=Object.keys(defaults).every(k=>p[k]===state[k]);button.classList.toggle('active',active);button.setAttribute('aria-pressed',active);}
 $('statHeight').textContent=fmt(state.h)+'″';$('statDiameter').textContent=fmt(state.d)+'″';$('statTiers').textContent=state.n;
 $('stations').innerHTML=g.rows.map(r=>`<tr><td>${r.name}</td><td>${fmt(r.z)}</td><td>${fmt(r.d)}</td></tr>`).join('');
 $('printPages').innerHTML=commands.map((p,i)=>`<div class="sheet">${pageSVG(p,i)}</div>`).join('');
 $('status').textContent='';renderPaper();draw();
}
function drawProfile(){
 const host=$('profile'),w=host.clientWidth-24,h=485,sc=Math.min((w-116)/state.d,(h-80)/state.h),cx=w/2-8,base=h-40;
 const full=[...g.pts,...g.pts.slice(0,-1).reverse().map(([r,z])=>[-r,z])];
 let svg=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Tree profile and heights of cut stations in inches"><path d="${full.map(([r,z],i)=>`${i?'L':'M'}${cx+r*sc},${base-z*sc}`).join(' ')}Z" fill="#dbc69c" fill-opacity=".6" stroke="#716147" stroke-width="1.3"/><path d="M${cx},${base+7}V${base-state.h*sc-10}" stroke="#647557" stroke-dasharray="4 4"/>`;
 g.stations.forEach(z=>{const y=base-z*sc;svg+=`<path d="M${cx-state.d*sc/2-8},${y}H${cx+state.d*sc/2+10}" stroke="#aebba2"/><text x="${cx+state.d*sc/2+15}" y="${y+4}" font-family="Arial" font-size="12" fill="#425039">${fmt(z)}″</text>`;});
 svg+=`<text x="${cx}" y="${h-10}" text-anchor="middle" font-family="Arial" font-size="12" fill="#647557">Bottom datum · ${fmt(state.d)}″ maximum width</text></svg>`;host.innerHTML=svg;
}
function drawTree(){
 const w=canvas.clientWidth,h=canvas.clientHeight,dpr=window.devicePixelRatio||1;canvas.width=w*dpr;canvas.height=h*dpr;ctx.scale(dpr,dpr);
 const sc=Math.min((w-85)/state.d,(h-80)/(state.h+state.d*.4)),center=w/2,bottom=(h+state.h*sc*Math.cos(tilt))/2-12;
 const project=(r,z,a)=>[center+r*Math.cos(a)*sc,bottom-z*Math.cos(tilt)*sc-r*Math.sin(a)*Math.sin(tilt)*sc];
 ctx.save();ctx.translate(center,bottom+8);ctx.scale(1,.2);const shadow=ctx.createRadialGradient(0,0,0,0,0,state.d*sc*.7);shadow.addColorStop(0,'#43533130');shadow.addColorStop(1,'#43533100');ctx.fillStyle=shadow;ctx.beginPath();ctx.arc(0,0,state.d*sc*.7,0,Math.PI*2);ctx.fill();ctx.restore();
 const faces=[],segments=100;
 for(let j=0;j<g.pts.length-1;j++){
  const [r1,z1]=g.pts[j],[r2,z2]=g.pts[j+1],dr=r2-r1,dz=z2-z1,norm=Math.hypot(dr,dz)||1;
  for(let i=0;i<segments;i++){
   const a=i/segments*2*Math.PI+angle,b=(i+1)/segments*2*Math.PI+angle,mid=(a+b)/2;
   const points=[project(r1,z1,a),project(r1,z1,b),project(r2,z2,b),project(r2,z2,a)];
   const light=(dz/norm)*(-.5*Math.cos(mid)+.65*Math.sin(mid))+.48*(-dr/norm);
   const grain=Math.sin(mid*14+z1*2.3)*1.4+Math.sin(mid*37+z1)*.7;
   const l=Math.max(37,Math.min(79,62+light*17+grain));
   faces.push({points,depth:(r1+r2)/2*Math.sin(mid)*Math.cos(tilt)-(z1+z2)/2*Math.sin(tilt),color:`hsl(36 39% ${l}%)`});
  }
 }
 faces.sort((a,b)=>a.depth-b.depth);
 for(const f of faces){ctx.beginPath();f.points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fillStyle=f.color;ctx.fill();ctx.strokeStyle=f.color;ctx.lineWidth=.4;ctx.stroke();}
}
function draw(){if(!g)return;if(view==='tree')drawTree();else if(view==='profile')drawProfile();}
for(const [id,k]of Object.entries(fields))$(id).addEventListener('input',()=>{state[k]=$(id).value===''?NaN:Number($(id).value);update();});
$('curve').addEventListener('input',()=>{state.curve=Number($('curve').value)/100;update();});
for(const [id,k]of [['height','h'],['diameter','d']])$(id+'Range').addEventListener('input',()=>{state[k]=Number($(id+'Range').value);$(id).value=state[k];update();});
for(const b of document.querySelectorAll('[data-preset]'))b.addEventListener('click',()=>{state={...presets[b.dataset.preset]};sync();update();});
for(const name of ['tree','profile','paper'])$(name+'Tab').addEventListener('click',()=>setView(name));
$('previewPrint').addEventListener('click',()=>{pageIndex=0;renderPaper();setView('paper');$('paperTab').focus();});
$('previous').addEventListener('click',()=>{pageIndex=0;renderPaper();});$('next').addEventListener('click',()=>{pageIndex=1;renderPaper();});
$('print').addEventListener('click',()=>{if(g)window.print();});
$('download').addEventListener('click',()=>{if(!g)return;const url=URL.createObjectURL(new Blob([makePDF(state)],{type:'application/pdf'}));const a=document.createElement('a');a.href=url;a.download=`little-pine-${fmt(state.h)}in-letter.pdf`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);$('status').textContent='PDF ready. Print at 100% and check the 1-inch square.';});
let drag=null;canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(!drag)return;angle+=(e.clientX-drag.x)*.012;tilt=Math.min(.7,Math.max(.04,tilt+(e.clientY-drag.y)*.004));drag={x:e.clientX,y:e.clientY};draw();});for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>drag=null);
canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();if(e.key==='ArrowLeft')angle-=.15;if(e.key==='ArrowRight')angle+=.15;if(e.key==='ArrowUp')tilt=Math.min(.7,tilt+.05);if(e.key==='ArrowDown')tilt=Math.max(.04,tilt-.05);draw();});
new ResizeObserver(draw).observe(document.querySelector('.visual'));sync();update();
