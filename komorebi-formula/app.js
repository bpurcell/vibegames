'use strict';
const $=id=>document.getElementById(id),{random,generate}=FormulaTrees;
const NS='http://www.w3.org/2000/svg',KEY='komorebi-equations-v1',W=1200,H=760;
const presets={branching:{length:'0.69 + 0.08*r',angle:'s*a + 0.1*r',bend:'0.08*r + w*0.12'},pine:{length:'0.66 + 0.12*s',angle:'s*a*(1.1+s*0.5) + w*0.1',bend:'0.05*r + w*0.1'},wind:{length:'0.72 + 0.06*r',angle:'s*a*(1-d*0.5) + w*0.25',bend:'0.12*r + w*0.3'},coral:{length:'0.72 + 0.04*cos(d*pi)',angle:'s*a + 0.15*sin(d*pi) + 0.06*r',bend:'0.09*r'}};
const colors={moss:['#4e5947','#7f8664','#a0a383'],rose:['#9c756c','#b89586','#c7aba0'],gold:['#867043','#ac955c','#c1b285'],slate:['#536b70','#839799','#a4b2ac']};
let grove,selected,undoStack=[],models=new Map();
const clone=value=>JSON.parse(JSON.stringify(value));
function newTree(seed,i=0){return {id:'tree-'+i,name:'Tree '+String(i+1).padStart(2,'0'),seed,preset:'branching',...presets.branching,depth:5,spread:28,wind:0,foliage:.65,scale:120,x:50,y:75,palette:'moss'};}
function makeGrove(seed){const r=random(seed);return {version:1,seed,trees:Array.from({length:7},(_,i)=>{const type=['pine','branching','coral','wind'][Math.floor(r()*4)];return {...newTree(seed+'-'+(i+1),i),preset:type,...presets[type],x:12+i*12.5+(r()-.5)*4,y:64+r()*17,scale:80+r()*75,spread:20+r()*20,depth:4+Math.floor(r()*2),wind:(r()-.5)*.6,palette:type==='coral'?'rose':'moss'};})};}
function validateProject(value){
 if(!value||value.version!==1||typeof value.seed!=='string'||value.seed.length>48||!Array.isArray(value.trees)||value.trees.length>24)throw Error('Choose a version 1 project with at most 24 trees.');
 const ids=new Set();
 const trees=value.trees.map(t=>{if(!t||typeof t.id!=='string'||t.id.length>80||ids.has(t.id))throw Error('Tree IDs must be unique.');ids.add(t.id);
  for(const [key,max] of [['name',35],['seed',48],['length',180],['angle',180],['bend',180]])if(typeof t[key]!=='string'||!t[key].trim()||t[key].length>max)throw Error('Invalid tree '+key+'.');
  for(const [key,min,max] of [['depth',2,7],['spread',8,70],['wind',-1,1],['foliage',0,1],['scale',65,180],['x',8,92],['y',45,87]])if(!Number.isFinite(t[key])||t[key]<min||t[key]>max)throw Error('Invalid tree '+key+'.');
  if(!Object.hasOwn(colors,t.palette))throw Error('Unknown ink palette.');
  const clean={};for(const key of ['id','name','seed','length','angle','bend','depth','spread','wind','foliage','scale','x','y','palette'])clean[key]=t[key];clean.preset=Object.hasOwn(presets,t.preset)?t.preset:'custom';generate(clean);return clean;
 });return {version:1,seed:value.seed,trees};
}
let loadWarning='';try{const raw=localStorage.getItem(KEY);grove=raw?validateProject(JSON.parse(raw)):makeGrove('quiet-equations');}catch{grove=makeGrove('quiet-equations');loadWarning='The saved project could not be read. A new landscape is ready.';}
selected=grove.trees[0]?.id||null;
function announce(text){$('status').textContent=text;}
function save(){try{localStorage.setItem(KEY,JSON.stringify(grove));$('storage-status').textContent='Saved in this browser';}catch{$('storage-status').textContent='Browser save unavailable — save a project file';}}
function checkpoint(){undoStack.push({grove:clone(grove),selected});if(undoStack.length>40)undoStack.shift();$('undo').disabled=false;}
function node(tag,attrs={},text){const e=document.createElementNS(NS,tag);for(const [key,value]of Object.entries(attrs))e.setAttribute(key,String(value));if(text!==undefined)e.textContent=text;return e;}
const n=value=>Number(value.toFixed(2));
function background(svg){
 const defs=node('defs');const gradient=node('linearGradient',{id:'paper',x2:'0%',y2:'100%'});gradient.append(node('stop',{offset:'0%','stop-color':'#f6f1e5'}),node('stop',{offset:'100%','stop-color':'#e5e0d0'}));defs.append(gradient);svg.append(defs,node('rect',{width:W,height:H,fill:'url(#paper)'}));
 const r=random(grove.seed+':land');svg.append(node('circle',{cx:900+r()*90,cy:130+r()*65,r:34,fill:'#b65f48',opacity:.62}));
 for(let layer=0;layer<3;layer++){const y=330+layer*65,phase=r()*6.28;let points='M0 '+H;for(let x=0;x<=W;x+=8){const ridge=y-Math.sin(x*.003+phase)*65-Math.sin(x*.009+phase)*24;points+=` L${x} ${n(ridge)}`;}points+=` L${W} ${H} Z`;svg.append(node('path',{d:points,fill:['#d4d6c7','#c6cdbb','#b6c2ac'][layer],opacity:.28,stroke:'#81917c','stroke-width':.6}));}
 for(let j=0;j<12;j++){let d='';for(let x=0;x<=W;x+=12)d+=`${x?'L':'M'}${x} ${n(565+j*8+Math.sin(x*.006+j*.45)*6)}`;svg.append(node('path',{d,fill:'none',stroke:'#85927c','stroke-width':.5,opacity:.16}));}
 // Seeded flecks live in the artwork, so SVG and PNG exports match the view.
 let grain='';for(let j=0;j<1500;j++){const x=n(r()*W),y=n(r()*H);grain+=`M${x} ${y}h${n(.4+r())}`;}svg.append(node('path',{d:grain,stroke:'#6a705b','stroke-width':.5,opacity:.09}));
 svg.append(node('text',{x:44,y:55,fill:'#7b826e','font-family':'Georgia, serif','font-size':12,'letter-spacing':3},'KOMOREBI  /  EQUATIONS'),node('text',{x:44,y:718,fill:'#7b826e','font-family':'Georgia, serif','font-size':11,'letter-spacing':1.5},'A STUDY IN SEEDED GROWTH'));
}
function treeGroup(tree,interactive){
 let model=models.get(JSON.stringify(tree));if(!model){model=generate(tree);if(models.size>80)models.clear();models.set(JSON.stringify(tree),model);}
 const scale=tree.scale/100*2.25,group=node('g',{transform:`translate(${n(tree.x/100*W)} ${n(tree.y/100*H)}) scale(${n(scale)})`});
 let bounds={left:0,right:0,top:0,bottom:0},outlines='',twigs='';
 for(const b of model.branches){bounds.left=Math.min(bounds.left,b.x,b.ex,b.cx);bounds.right=Math.max(bounds.right,b.x,b.ex,b.cx);bounds.top=Math.min(bounds.top,b.y,b.ey,b.cy);bounds.bottom=Math.max(bounds.bottom,b.y,b.ey,b.cy);
  if(b.width>.8){const dx=b.ex-b.x,dy=b.ey-b.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len,w=b.width/2;outlines+=`M${n(b.x+nx*w)} ${n(b.y+ny*w)}Q${n(b.cx+nx*w*.8)} ${n(b.cy+ny*w*.8)} ${n(b.ex+nx*w*.6)} ${n(b.ey+ny*w*.6)}L${n(b.ex-nx*w*.6)} ${n(b.ey-ny*w*.6)}Q${n(b.cx-nx*w*.8)} ${n(b.cy-ny*w*.8)} ${n(b.x-nx*w)} ${n(b.y-ny*w)}Z`;}
  else twigs+=`M${n(b.x)} ${n(b.y)}Q${n(b.cx)} ${n(b.cy)} ${n(b.ex)} ${n(b.ey)}`;
 }
 group.append(node('path',{d:outlines,fill:'#6c6b58','fill-opacity':.15,stroke:'#4b5043','stroke-width':.38,'stroke-opacity':.77}),node('path',{d:twigs,fill:'none',stroke:'#4b5043','stroke-width':.32,'stroke-opacity':.65}));
 const leafPaths=['','',''];for(const l of model.leaves){bounds.left=Math.min(bounds.left,l.x-4);bounds.right=Math.max(bounds.right,l.x+4);bounds.top=Math.min(bounds.top,l.y-4);bounds.bottom=Math.max(bounds.bottom,l.y+4);const dx=Math.cos(l.angle)*l.size,dy=Math.sin(l.angle)*l.size;leafPaths[l.color]+=`M${n(l.x-dx)} ${n(l.y-dy)}Q${n(l.x-dy)} ${n(l.y+dx)} ${n(l.x+dx)} ${n(l.y+dy)}Q${n(l.x+dy*.45)} ${n(l.y-dx*.45)} ${n(l.x-dx)} ${n(l.y-dy)}Z`;}
 leafPaths.forEach((d,i)=>group.append(node('path',{d,fill:colors[tree.palette][i],opacity:.55})));
 group.append(node('path',{d:'M-8 2Q0 -1 10 1',stroke:'#63735b','stroke-width':.4,fill:'none',opacity:.6}));
 if(interactive){group.setAttribute('class','tree'+(selected===tree.id?' selected':''));group.setAttribute('role','button');group.setAttribute('tabindex','0');group.setAttribute('aria-label','Edit '+tree.name);group.setAttribute('aria-pressed',String(selected===tree.id));
  group.append(node('rect',{x:bounds.left-7,y:bounds.top-7,width:bounds.right-bounds.left+14,height:bounds.bottom-bounds.top+14,fill:'transparent','pointer-events':'all'}));
  group.append(node('rect',{class:'selection',x:bounds.left-7,y:bounds.top-7,width:bounds.right-bounds.left+14,height:bounds.bottom-bounds.top+14,'vector-effect':'non-scaling-stroke'}),node('text',{class:'tree-label',x:0,y:bounds.bottom+15,'text-anchor':'middle','font-size':9},tree.name));
  const select=()=>selectTree(tree.id);group.addEventListener('click',select);group.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}});
 }
 return group;
}
function artwork(interactive=true){const svg=node('svg',{xmlns:NS,viewBox:`0 0 ${W} ${H}`,width:W,height:H,role:interactive?'group':'img','aria-label':'Seeded ink landscape with individually editable trees'});background(svg);[...grove.trees].sort((a,b)=>a.y-b.y).forEach(t=>svg.append(treeGroup(t,interactive)));return svg;}
function render(){ $('art').replaceChildren(artwork());$('tree-count').textContent=grove.trees.length+' EDITABLE TREES';$('scene-seed').value=grove.seed;const list=$('tree-list');list.replaceChildren();for(const t of grove.trees){const o=document.createElement('option');o.value=t.id;o.textContent=t.name;list.append(o);}if(!selected){const o=document.createElement('option');o.value='';o.textContent=grove.trees.length?'Choose a tree':'Add your first tree';list.prepend(o);}list.value=selected||'';$('undo').disabled=!undoStack.length;$('add').disabled=grove.trees.length>=24;}
function selectTree(id){selected=grove.trees.some(t=>t.id===id)?id:null;render();syncEditor();}
function syncEditor(){const tree=grove.trees.find(t=>t.id===selected);$('editor').hidden=!tree;$('duplicate').disabled=!tree||grove.trees.length>=24;$('delete').disabled=!tree;$('error').textContent='';if(!tree)return;
 for(const key of ['name','seed','preset','length','angle','bend','depth','spread','palette'])$(key).value=tree[key];for(const key of ['wind','foliage'])$(key).value=Math.round(tree[key]*100);for(const key of ['scale','x','y'])$(key).value=Math.round(tree[key]);outputs();const m=generate(tree);$('tree-stats').textContent=`${m.branches.length} branches · ${m.leaves.length} leaves${m.clipped?' · '+m.clipped+' formula values limited to safe growth ranges':''}`;}
function outputs(){for(const key of ['depth','spread','wind','foliage','scale','x','y'])$(key+'-out').textContent=$(key).value+(key==='spread'?'°':key==='depth'?'':'%');}
for(const key of ['depth','spread','wind','foliage','scale','x','y'])$(key).addEventListener('input',outputs);
$('tree-list').onchange=()=>selectTree($('tree-list').value);
$('deselect').onclick=()=>selectTree(null);
$('preset').onchange=()=>{const p=presets[$('preset').value];if(p)for(const key of ['length','angle','bend'])$(key).value=p[key];};
for(const key of ['length','angle','bend'])$(key).oninput=()=>{$('preset').value='custom';};
$('editor').onsubmit=e=>{e.preventDefault();const index=grove.trees.findIndex(t=>t.id===selected);if(index<0)return;try{const t={...grove.trees[index]};for(const key of ['name','seed','preset','length','angle','bend','palette'])t[key]=$(key).value.trim();for(const key of ['depth','spread','scale','x','y'])t[key]=Number($(key).value);for(const key of ['wind','foliage'])t[key]=Number($(key).value)/100;validateProject({...grove,trees:[t]});checkpoint();grove.trees[index]=t;render();syncEditor();save();announce('Updated '+t.name+'. Every other tree is unchanged.');}catch(error){$('error').textContent=error.message+' Your last applied tree is preserved.';}};
function uniqueId(){return 'tree-'+crypto.randomUUID();}
$('add').onclick=()=>{if(grove.trees.length>=24)return;checkpoint();const t=newTree(grove.seed+'-'+crypto.randomUUID().slice(0,8),grove.trees.length);t.id=uniqueId();grove.trees.push(t);selectTree(t.id);save();announce('A new tree is ready to edit.');};
$('duplicate').onclick=()=>{const original=grove.trees.find(t=>t.id===selected);if(!original||grove.trees.length>=24)return;checkpoint();const t={...original,id:uniqueId(),name:(original.name+' copy').slice(0,35),x:Math.min(92,original.x+7)};grove.trees.push(t);selectTree(t.id);save();};
$('delete').onclick=()=>{checkpoint();grove.trees=grove.trees.filter(t=>t.id!==selected);selectTree(grove.trees[0]?.id);save();announce('Tree removed. Undo restores it.');};
$('grow-scene').onclick=()=>{const seed=$('scene-seed').value.trim()||'quiet-equations';checkpoint();grove=makeGrove(seed);selectTree(grove.trees[0].id);save();announce('Landscape grown from “'+seed+'”. The same seed recreates this composition.');};
$('undo').onclick=()=>{const last=undoStack.pop();if(!last)return;grove=last.grove;selected=last.selected;render();syncEditor();save();announce('Previous edit restored.');};
let downloadURL;
function download(blob,filename){if(downloadURL)URL.revokeObjectURL(downloadURL);downloadURL=URL.createObjectURL(blob);announce('Ready: ');const a=document.createElement('a');a.href=downloadURL;a.download=filename;a.textContent='Download '+filename;$('status').append(a);a.click();}
const svgText=()=>new XMLSerializer().serializeToString(artwork(false));
$('export-svg').onclick=()=>download(new Blob([svgText()],{type:'image/svg+xml'}),'komorebi-equations.svg');
$('export-png').onclick=()=>{const button=$('export-png');button.disabled=true;const url=URL.createObjectURL(new Blob([svgText()],{type:'image/svg+xml'})),image=new Image();image.onload=()=>{try{const canvas=document.createElement('canvas');canvas.width=W*2;canvas.height=H*2;canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);canvas.toBlob(blob=>{if(blob)download(blob,'komorebi-equations.png');else announce('PNG export failed. SVG artwork is available.');button.disabled=false;},'image/png');}catch{announce('PNG export failed. Try SVG artwork.');button.disabled=false;}finally{URL.revokeObjectURL(url);}};image.onerror=()=>{URL.revokeObjectURL(url);button.disabled=false;announce('PNG export failed. Try SVG artwork.');};image.src=url;};
$('save-project').onclick=()=>download(new Blob([JSON.stringify(grove,null,2)],{type:'application/json'}),'komorebi-equations.json');
$('import').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>250000)throw Error('Project files must be smaller than 250 KB.');const project=validateProject(JSON.parse(await file.text()));checkpoint();grove=project;selectTree(grove.trees[0]?.id);save();announce('Editable project restored.');}catch(error){announce('Could not open project: '+error.message);}finally{e.target.value='';}};
render();syncEditor();save();if(loadWarning)announce(loadWarning);
