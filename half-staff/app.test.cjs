const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const core=require('./core.js'),snapshot=require('./snapshot.json');
const expected=core.normalize(snapshot).incidents.filter(e=>e.date.startsWith(String(new Date().getUTCFullYear()))&&e.timestamp<=Date.now()).length;
async function boot(mode){
 const elements=new Map();function element(id){if(!elements.has(id))elements.set(id,{value:'',textContent:'',hidden:false,children:[],classList:{add(){},remove(){},toggle(){}},setAttribute(){},append(...items){this.children.push(...items)},replaceChildren(...items){this.children=items},addEventListener(){}});return elements.get(id);}
 const store=new Map();const sandbox={Memorial:core,document:{getElementById:element,createElement:()=>element(Symbol()),createElementNS:()=>element(Symbol()),hidden:false},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},setInterval(){},AbortSignal,Date,URL,fetch:async url=>{if(mode==='none'||(mode==='fallback'&&url!=='snapshot.json'))throw Error('Offline');return{ok:true,json:async()=>snapshot}}};
 vm.createContext(sandbox);vm.runInContext(fs.readFileSync(__dirname+'/app.js','utf8'),sandbox);await new Promise(resolve=>setTimeout(resolve,15));return elements;
}
(async()=>{
 let e=await boot('online');assert(e.get('data-status').textContent.startsWith('Source updated'));assert.equal(e.get('incident-count').textContent,expected);
 e.get('demo').onclick();assert.equal(e.get('position').textContent,'50.0% OF FULL HEIGHT');e.get('demo-add').onclick();assert.equal(e.get('position').textContent,'25.0% OF FULL HEIGHT');assert.equal(e.get('incident-count').textContent,expected);e.get('demo-exit').onclick();assert(e.get('demo-controls').hidden);
 e=await boot('fallback');assert(e.get('data-status').textContent.startsWith('Update unavailable.'));assert.equal(e.get('incident-count').textContent,expected);
 e=await boot('none');assert(e.get('data-status').textContent.includes('No flag position or totals'));assert.equal(e.get('flag-state').textContent,'Data unavailable');
 console.log('PASS: online feed, offline snapshot, total failure, demo isolation and return.');
})();
