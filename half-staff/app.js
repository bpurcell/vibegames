(() => {
'use strict';
const $=id=>document.getElementById(id), {normalize,model,HOUR}=Memorial;
const FEED='https://www.gannett-cdn.com/experiments/usatoday/_data/mass-killings/incidents.json';
const SOURCE='https://cssh.northeastern.edu/sccj/mass-killing-database/';
const YEAR=new Date().getUTCFullYear();
let data=null,busy=false,demo=null,settings={hold:24,rise:48,year:YEAR};
try{const saved=JSON.parse(localStorage.getItem('memorial-settings-v1'));if(saved){for(const k of ['hold','rise'])if(Number.isInteger(saved[k])&&saved[k]>=1&&saved[k]<=168)settings[k]=saved[k];if(Number.isInteger(saved.year)&&saved.year>=2006&&saved.year<=YEAR)settings.year=saved.year;}}catch{}
$('hold').value=settings.hold;$('rise').value=settings.rise;
const dateLabel=date=>new Date(date).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'});
function savedSettings(){try{localStorage.setItem('memorial-settings-v1',JSON.stringify(settings))}catch{$('save-note').textContent='Storage unavailable. Settings will last for this visit only.';}}
function status(text,warning=false){$('data-status').textContent=text;$('data-status').classList.toggle('warning',warning);}
function selected(){return data?data.incidents.filter(e=>e.date.startsWith(String(settings.year))&&e.timestamp<=Date.now()):[];}
function timeText(ms){const hours=Math.max(0,Math.ceil(ms/HOUR));return hours>=24?`${Math.floor(hours/24)} days${hours%24?`, ${hours%24} hours`:''}`:`${hours} hours`;}
function draw(){
 $('hold-value').textContent=`${settings.hold} hours per person`;$('rise-value').textContent=`${settings.rise} hours from 0% to 100%`;
 if(!data&&!demo)return;
 const now=demo?demo.now:Math.min(Date.now(),Date.UTC(settings.year+1,0,1)-1);
 const state=model(demo?demo.events:selected(),now,settings.hold,settings.rise);
 const pct=state.height*100, formatted=pct>0&&pct<.1?'<0.1%':`${pct.toFixed(1)}%`;
 $('flag').setAttribute('transform',`translate(238 ${70+(1-state.height)*295})`);$('flag').classList.add('ready');
 $('position').textContent=`${formatted} OF FULL HEIGHT`;
 $('mode-label').textContent=demo?'FICTIONAL EXAMPLE':`${settings.year} · RECORDED INCIDENTS`;
 $('flag-state').textContent=state.holding?'Held in remembrance':state.height<1?'Rising, remembering':'At full height';
 $('countdown').textContent=(demo?'Example: ':settings.year<YEAR?'At the end of this year: ':'')+(state.holding?`${timeText(state.holdUntil-now)} of mourning remain before the flag rises.`:state.height<1?`${timeText(state.fullAt-now)} until full height, if no further incidents are recorded.`:'No mourning time remains under these settings.');
 $('flag-desc').textContent=`${demo?'Fictional example. ':''}Flag at ${formatted} of full height. ${$('flag-state').textContent}.`;
}
function records(){
 const events=selected();$('incident-count').textContent=events.length;$('death-count').textContent=events.reduce((sum,e)=>sum+e.deaths,0).toLocaleString();$('latest').textContent=events.length?dateLabel(events.at(-1).timestamp):'None recorded';
 $('records-title').textContent=`The ${settings.year} incident record`;
 $('record-note').textContent='Victim fatalities only. Counts and classifications follow the source and can change. Dates shown in UTC.';
 const container=$('incidents');container.replaceChildren();
 if(!events.length){const p=document.createElement('p');p.textContent='No qualifying incidents appear for this year in the loaded data. This does not establish that none occurred.';container.append(p);return;}
 for(const e of [...events].reverse()){
  const row=document.createElement('article');row.className='incident';
  const date=document.createElement('time');date.dateTime=e.date;date.textContent=dateLabel(e.timestamp);
  const info=document.createElement('div'),title=document.createElement('h3'),link=document.createElement('a'),count=document.createElement('b');
  title.textContent=`${e.city}, ${e.state}`;link.textContent=e.links.length?'Read source reporting ↗':'View source database ↗';link.href=e.links[0]||SOURCE;link.target='_blank';link.rel='noopener noreferrer';count.textContent=`${e.deaths} people killed`;
  info.append(title,link);row.append(date,info,count);container.append(row);
 }
}
function accept(next){
 data=next;const years=[...new Set([YEAR,...data.incidents.map(e=>Number(e.date.slice(0,4))).filter(y=>y<=YEAR)])].sort((a,b)=>b-a);
 $('year').replaceChildren(...years.map(y=>{const o=document.createElement('option');o.value=y;o.textContent=String(y);return o;}));
 if(!years.includes(settings.year))settings.year=YEAR;$('year').value=settings.year;records();draw();
}
async function fetchJSON(url){const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Data request failed');return response.json();}
async function refresh(){
 if(busy)return;busy=true;$('refresh').disabled=true;status('Checking the public incident feed…');
 try{
  const raw=await fetchJSON(FEED),next=normalize(raw);
  if(data&&Date.parse(next.updatedAt)<Date.parse(data.updatedAt))throw Error('Source is older than saved data');
  accept(next);try{localStorage.setItem('memorial-data-v1',JSON.stringify(raw))}catch{}
  const stale=Date.now()-Date.parse(data.updatedAt)>72*HOUR;
  status(`Source updated ${dateLabel(data.updatedAt)} · Checked ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}. ${stale?'Source data is more than 3 days old. ':''}Reporting may lag; this is not a real-time alert service.`,stale);
 }catch{
  if(!data){
   try{const raw=JSON.parse(localStorage.getItem('memorial-data-v1'));accept(normalize(raw))}catch{}
   try{const next=normalize(await fetchJSON('snapshot.json'));if(!data||Date.parse(next.updatedAt)>Date.parse(data.updatedAt))accept(next)}catch{}
  }
  if(data)status(`Update unavailable. Showing a saved source copy dated ${dateLabel(data.updatedAt)}. Newer incidents may be missing.`,true);
  else{status('Incident data is unavailable. No flag position or totals can be established. Please try again.',true);$('flag-state').textContent='Data unavailable';$('countdown').textContent='Use the fictional example to explore the controls.';}
 }finally{busy=false;$('refresh').disabled=false;}
}
for(const key of ['hold','rise'])$(key).addEventListener('input',()=>{settings[key]=Number($(key).value);savedSettings();draw();});
$('year').addEventListener('change',()=>{settings.year=Number($('year').value);savedSettings();records();draw();});
$('defaults').onclick=()=>{settings.hold=24;settings.rise=48;$('hold').value=24;$('rise').value=48;savedSettings();draw();};
$('refresh').onclick=refresh;
$('demo').onclick=()=>{demo={now:0,events:[{id:'example-1',timestamp:0,deaths:4}]};$('demo-controls').hidden=false;draw();};
$('demo-add').onclick=()=>{if(demo){demo.events.push({id:`example-${demo.events.length+1}`,timestamp:demo.now,deaths:4});draw();}};
$('demo-time').onclick=()=>{if(demo){demo.now+=24*HOUR;draw();}};
$('demo-exit').onclick=()=>{demo=null;$('demo-controls').hidden=true;if(!data){$('flag').classList.remove('ready');$('position').textContent='—';$('flag-state').textContent='Data unavailable';$('countdown').textContent='Please check for updates.';$('mode-label').textContent='RECORDED INCIDENTS';}draw();};
// Draw all 50 stars with alternating rows of six and five.
for(let row=0;row<9;row++){const count=row%2?5:6;for(let col=0;col<count;col++){const star=document.createElementNS('http://www.w3.org/2000/svg','path'),cx=7+(row%2?6:0)+col*12.3,cy=5+row*7.4;let path='';for(let i=0;i<10;i++){const angle=-Math.PI/2+i*Math.PI/5,r=i%2?1.15:2.7;path+=`${i?'L':'M'}${cx+Math.cos(angle)*r} ${cy+Math.sin(angle)*r}`;}star.setAttribute('d',path+'Z');$('stars').append(star);}}
draw();refresh();setInterval(draw,30000);setInterval(()=>{if(!document.hidden)refresh()},15*60*1000);
})();
