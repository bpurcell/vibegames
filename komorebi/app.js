const canvas=document.querySelector('#forest'),ctx=canvas.getContext('2d');
let width=0,height=0,offset=0,tool='pine',items=[],undoHistory=[],drag=null,stroke=null;
const random=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
function save(){try{localStorage.setItem('komorebi-forest',JSON.stringify({items,offset}))}catch(e){}}
// Treat local saves as input: discard malformed entries before rendering.
const finite = Number.isFinite;
function validItem(o){
 if(!o || typeof o!=='object')return false;
 if(o.type==='stroke')return finite(o.size)&&o.size>0&&o.size<=10&&Array.isArray(o.points)&&o.points.length<=20000&&o.points.every(p=>Array.isArray(p)&&finite(p[0])&&finite(p[1]));
 return ['pine','sakura','bamboo'].includes(o.type)&&finite(o.x)&&finite(o.y)&&finite(o.size)&&o.size>0&&o.size<=200&&finite(o.seed)&&(!o.growth||typeof o.growth==='object');
}
try{const stored=JSON.parse(localStorage.getItem('komorebi-forest'));if(stored&&Array.isArray(stored.items)){items=stored.items.slice(0,2000).filter(validItem);offset=finite(stored.offset)?stored.offset:0}}catch(e){}

function checkpoint(){undoHistory.push(JSON.stringify(items));if(undoHistory.length>50)undoHistory.shift()}
function tree(c,x,y,size,type,seed,opacity=1,settings={}){
 ForestFractal.render(c,x,y,size,type,seed,opacity,settings);
}
function landscape(c,w,h,view){c.fillStyle='#f1ecdf';c.fillRect(0,0,w,h);let base=h*.76;
 c.fillStyle='#c87459';c.globalAlpha=.75;c.beginPath();c.arc(w*.78-view*.025,h*.27,30,0,Math.PI*2);c.fill();c.globalAlpha=1;
 ScrollTerrain.render(c,w,h,view);
 for(let layer=0;layer<2;layer++){let factor=layer?.55:.32,spacing=layer?140:95,start=Math.floor(view*factor/spacing)-2,end=start+Math.ceil(w/spacing)+5;for(let i=start;i<end;i++){let r=random(i*73+layer*917+412),x=i*spacing-view*factor+r()*60,y=base+12+layer*28+r()*12;tree(c,x,y,(layer?43:26)+r()*35,'pine',i*517+layer*93,layer?.48:.24,{depth:3+Math.floor(r()*2),spread:25+r()*30,wildness:.7})}}
 const presets=[{x:210,y:.79,s:155,t:'pine'},{x:360,y:.8,s:96,t:'pine'},{x:810,y:.82,s:127,t:'pine'},{x:970,y:.81,s:90,t:'sakura'},{x:1100,y:.8,s:108,t:'pine'}];for(let [i,p]of presets.entries()){let x=p.x-view;if(x>-200&&x<w+200)tree(c,x,h*p.y,p.s,p.t,i*293+78,.9)}
 for(let obj of items){if(obj.type==='stroke'){c.strokeStyle='#45463e';c.lineWidth=obj.size;c.lineCap='round';c.lineJoin='round';c.beginPath();obj.points.forEach((p,i)=>{if(i)c.lineTo(p[0]-view,p[1]*h);else c.moveTo(p[0]-view,p[1]*h)});c.stroke()}else if(obj.x-view>-250&&obj.x-view<w+250)tree(c,obj.x-view,obj.y*h,obj.size,obj.type,obj.seed,1,obj.growth||{})}
 // A light scatter of paper fibres keeps the ink feeling tactile.
 let grain=random(926);c.fillStyle='#5f6854';c.globalAlpha=.045;for(let i=0;i<2500;i++)c.fillRect(grain()*w,grain()*h,grain()*1.4+.3,.5);c.globalAlpha=1;
}
function draw(){landscape(ctx,width,height,offset);document.querySelector('#position').textContent=Math.round(offset/10)+' m'}
function resize(){let box=canvas.getBoundingClientRect();width=box.width;height=box.height;let d=Math.min(devicePixelRatio||1,2);canvas.width=width*d;canvas.height=height*d;ctx.setTransform(d,0,0,d,0,0);draw()}new ResizeObserver(resize).observe(canvas);
function point(e){let b=canvas.getBoundingClientRect();return[e.clientX-b.left,e.clientY-b.top]}
canvas.addEventListener('pointerdown',e=>{if(drag||stroke)return;if(e.button!==0&&e.button!==1)return;canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);let p=point(e);if(tool==='pan'||e.button===1||e.shiftKey){drag={x:p[0],offset};canvas.style.cursor='grabbing';return}checkpoint();if(tool==='ink'){stroke={type:'stroke',size:Number(document.querySelector('#size').value)/22,points:[[p[0]+offset,p[1]/height],[p[0]+offset+.01,p[1]/height]]};items.push(stroke)}else{items.push({type:tool,x:p[0]+offset,y:p[1]/height,size:Number(document.querySelector('#size').value)*1.4,seed:Number(document.querySelector('#seed').value)||1,growth:growthSettings()});document.querySelector('#seed').value=(Math.floor(Number(document.querySelector('#seed').value)||1)%999999)+1;save()}draw()});
canvas.addEventListener('pointermove',e=>{let p=point(e);if(drag){offset=drag.offset+drag.x-p[0];draw()}else if(stroke){stroke.points.push([p[0]+offset,p[1]/height]);draw()}});
function finish(){drag=null;stroke=null;canvas.style.cursor=tool==='pan'?'grab':'crosshair';save()}canvas.addEventListener('pointerup',finish);canvas.addEventListener('pointercancel',finish);
canvas.addEventListener('wheel',e=>{e.preventDefault();offset+=e.deltaX||e.deltaY;draw();save()},{passive:false});
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{tool=b.dataset.tool;document.querySelectorAll('[data-tool]').forEach(t=>(t.classList.toggle('active',t===b),t.setAttribute('aria-pressed',String(t===b))));canvas.style.cursor=tool==='pan'?'grab':'crosshair';document.querySelector('#hint').textContent=tool==='pan'?'Drag to follow the horizon':tool==='ink'?'Drag to draw with ink':'Click anywhere to plant '+(tool==='sakura'?'a cherry blossom':tool==='bamboo'?'bamboo':'a pine')});
function toast(t){let el=document.querySelector('#toast');el.textContent=t;el.style.opacity=1;clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.style.opacity=0,2400)}
function undo(){if(undoHistory.length){items=JSON.parse(undoHistory.pop());draw();save()}else toast('Nothing to undo yet')}
document.querySelector('#undo').onclick=undo;document.querySelector('#clear').onclick=()=>{if(items.length){checkpoint();items=[];draw();save();toast('A fresh canvas. Undo to restore your trees.')}else toast('Plant a tree to begin')};
document.querySelector('#left').onclick=()=>{offset-=width*.6;draw();save()};document.querySelector('#right').onclick=()=>{offset+=width*.6;draw();save()};
document.addEventListener('keydown',e=>{if(e.target.closest('input,textarea,select,[contenteditable]'))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo()}if(document.activeElement===canvas&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();offset+=e.key==='ArrowLeft'?-100:100;draw();save()}});
document.querySelector('#export').onclick=()=>{const out=document.createElement('canvas');out.width=width*2;out.height=height*2;const c=out.getContext('2d');c.scale(2,2);landscape(c,width,height,offset);out.toBlob(blob=>{if(!blob)return;const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download='komorebi-landscape.png';a.textContent='Download PNG';toast('Your landscape is ready. ');const notice=document.querySelector('#toast');clearTimeout(toast.timer);notice.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(url);a.remove();notice.style.opacity=0},60000)},'image/png')};

function growthSettings(){return {fullness:Number(document.querySelector('#fullness').value)/100,depth:Number(document.querySelector('#depth').value),spread:Number(document.querySelector('#spread').value),wildness:Number(document.querySelector('#wildness').value)/100,wind:Number(document.querySelector('#wind').value)/100}}
for(const id of ['depth','spread','wildness','wind','fullness']){const slider=document.querySelector('#'+id);slider.oninput=()=>{document.querySelector('#'+id+'-value').textContent=slider.value+(id==='spread'?'°':(id==='wildness'||id==='fullness')?'%':'');growthPreview()}}
function growthPreview(){const c=document.querySelector('#tree-preview'),g=c.getContext('2d');g.clearRect(0,0,c.width,c.height);ForestFractal.render(g,100,148,105,['pine','sakura','bamboo'].includes(tool)?tool:'pine',Number(document.querySelector('#seed').value)||1,1,growthSettings())}
document.querySelector('#seed').oninput=growthPreview;
document.querySelector('#random-seed').onclick=()=>{document.querySelector('#seed').value=Math.floor(Math.random()*999999)+1;growthPreview()};
document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',growthPreview));
canvas.addEventListener('pointerup',growthPreview);growthPreview();
