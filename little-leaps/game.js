(() => {
  'use strict';
  const canvas = document.querySelector('#game'), ctx = canvas.getContext('2d');
  const $ = id => document.getElementById(id);
  const W = 960, H = 540, STEP = 1 / 120;
  const levels = [
    { name: 'First steps', platforms: [[0,450,230],[290,400,150],[500,350,160],[730,300,170],[980,350,160],[1220,400,270]], moving: [3], checkpoint: 2 },
    { name: 'A little lift', platforms: [[0,450,220],[285,390,145],[500,330,155],[720,360,155],[950,300,160],[1190,350,160],[1410,400,260]], moving: [2,4], checkpoint: 3 },
    { name: 'Home among the stars', platforms: [[0,450,210],[280,390,140],[490,320,145],[720,360,155],[960,300,150],[1190,350,150],[1420,300,155],[1640,390,270]], moving: [2,4,6], checkpoint: 3 }
  ];
  // Keep jumps forgiving: at most 35px rise + 32px platform travel,
  // 55–85px gaps, and a broad landing. Never put two lifts together.
  function generateLevel(number, random = Math.random) {
    const pick = (min, max) => min + Math.floor(random() * (max - min + 1));
    const count = pick(7, 10), checkpoint = Math.floor(count / 2);
    const platforms = [[0, 450, 230]], moving = [];
    for (let i = 1; i < count; i++) {
      const [x, y, width] = platforms[i - 1];
      platforms.push([x + width + pick(55, 85), Math.max(290, Math.min(450, y + pick(-35, 35))), i === count - 1 ? 270 : pick(155, 205)]);
      if (i > 1 && i < count - 1 && i !== checkpoint && !moving.includes(i - 1) && random() < .45) moving.push(i);
    }
    // Every adventure gets a lift, with stationary start, flag, and home.
    if (!moving.length) moving.push(2);
    const names = ['Starlight stroll', 'Blue sky bounce', 'Moonbeam meadow', 'Cloud hopping', 'The scenic route', 'A happy little detour'];
    return { name: names[(number - 3) % names.length], platforms, moving, checkpoint };
  }
  const keys = new Set(), touches = new Map();
  let index = 0, platforms, stars, player, checkpoint, camera = 0, time = 0, state = 'ready', accumulator = 0, last = 0, jumpBuffer = 0, coyote = 0;
  let currentLevel = levels[0];
  const held = key => keys.has(key) || [...touches.values()].includes(key);
  const round = (x,y,w,h,r,color) => { ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill(); };
  function clearInput() { keys.clear(); touches.clear(); jumpBuffer=0; document.querySelectorAll('.held').forEach(b=>b.classList.remove('held')); }
  function updateHUD() { $('level').textContent = `${String(index+1).padStart(2, '0')} · ${currentLevel.name}`; $('stars').textContent = `★ ${stars.filter(s=>s.got).length} / ${stars.length}`; }
  function load() {
    time=0;camera=0;checkpoint=0;coyote=0;clearInput();
    platforms=currentLevel.platforms.map(([x,y,w],i)=>({x,y,w,baseY:y,dy:0,moving:currentLevel.moving.includes(i)}));
    stars=platforms.slice(1).map(p=>({x:p.x+p.w/2,y:p.y-48,got:false}));
    respawn();updateHUD();$('message').textContent='Reach the gold house. Stars are a bonus!';
  }
  function respawn() { const p=platforms[checkpoint]; player={x:p.x+35,y:p.y-38,w:28,h:34,vx:0,vy:0,ground:p}; coyote=.12;jumpBuffer=0; }
  function show(label,title,text,button) { $('overlay-label').textContent=label;$('overlay-title').textContent=title;$('overlay-text').textContent=text;$('play').textContent=button;$('overlay').hidden=false; }
  function pause() {
    if(state!=='playing' && state!=='paused') return;
    if(state==='playing') {state='paused';clearInput();show('TAKE A BREATHER','A little pause.','Your adventure will be right here.','Keep going →');}
    else {state='playing';$('overlay').hidden=true;canvas.focus();}
    $('pause').textContent=state==='paused'?'Resume':'Pause';$('pause').setAttribute('aria-pressed',String(state==='paused'));
  }
  $('pause').onclick=pause;
  $('restart').onclick=()=>{load();state='playing';$('overlay').hidden=true;$('pause').textContent='Pause';$('pause').setAttribute('aria-pressed','false');canvas.focus();};
  $('play').onclick=()=>{if(state==='paused'){pause();return;}if(state==='won'){index++;currentLevel=levels[index] || generateLevel(index);load();}state='playing';$('overlay').hidden=true;canvas.focus();};
  const keyMap={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',Space:'jump',ArrowUp:'jump',KeyW:'jump'};
  document.addEventListener('keydown',e=>{
    if(e.target.closest('button,a,input'))return;
    if(e.code==='Escape'||e.code==='KeyP'){if(!e.repeat)pause();return;}
    const key=keyMap[e.code];if(!key||state!=='playing')return;
    e.preventDefault();if(key==='jump'&&!e.repeat)jumpBuffer=.14;keys.add(key);
  });
  document.addEventListener('keyup',e=>{const key=keyMap[e.code];if(key)keys.delete(key);});
  document.querySelectorAll('[data-key]').forEach(button=>{
    button.addEventListener('pointerdown',e=>{e.preventDefault();if(state!=='playing')return;button.setPointerCapture(e.pointerId);touches.set(e.pointerId,button.dataset.key);button.classList.add('held');if(button.dataset.key==='jump')jumpBuffer=.14;});
    const release=e=>{touches.delete(e.pointerId);button.classList.remove('held');};
    button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
  });
  window.addEventListener('blur',()=>{clearInput();if(state==='playing')pause();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(state==='playing')pause();}});
  function step(dt) {
    time+=dt;
    for(const p of platforms){const old=p.y;p.y=p.baseY+(p.moving?Math.sin(time*1.25)*32:0);p.dy=p.y-old;}
    if(player.ground)player.y+=player.ground.dy;
    coyote=player.ground ? .12 : Math.max(0,coyote-dt);jumpBuffer=Math.max(0,jumpBuffer-dt);
    const direction=Number(held('right'))-Number(held('left'));
    const target=direction*260, acceleration=direction?1900:2300;
    player.vx+=Math.sign(target-player.vx)*Math.min(Math.abs(target-player.vx),acceleration*dt);
    if(jumpBuffer>0&&coyote>0){player.vy=-570;player.ground=null;coyote=0;jumpBuffer=0;}
    const oldBottom=player.y+player.h;
    player.vy+=1450*dt;player.x+=player.vx*dt;player.y+=player.vy*dt;
    player.x=Math.max(0,Math.min(player.x,platforms.at(-1).x+platforms.at(-1).w-player.w));player.ground=null;
    for(const p of platforms){
      if(player.vy>=0&&player.x+player.w>p.x&&player.x<p.x+p.w&&oldBottom<=p.y-p.dy+2&&player.y+player.h>=p.y){player.y=p.y-player.h;player.vy=0;player.ground=p;break;}
    }
    if(player.ground===platforms[currentLevel.checkpoint]&&checkpoint===0){checkpoint=currentLevel.checkpoint;$('message').textContent='Checkpoint! Your next fresh start is here.';}
    for(let i=0;i<stars.length;i++){const s=stars[i];s.y=platforms[i+1].y-48;if(!s.got&&Math.abs(player.x+14-s.x)<28&&Math.abs(player.y+17-s.y)<35){s.got=true;updateHUD();}}
    if(player.y>H+100){respawn();$('message').textContent='A soft landing. Give it another hop!';}
    const end=platforms.at(-1);
    if(player.x>end.x+end.w-100&&player.ground===end){
      const collected=stars.filter(s=>s.got).length;clearInput();state='won';
      show('NICE LITTLE LEAPS', 'One hop happier.', `You found ${collected} of ${stars.length} stars. ${index >= 2 ? 'A freshly made sky adventure is up next!' : 'Another little adventure is waiting.'}`, 'Next adventure →');
    }
    const cameraTarget=Math.max(0,Math.min(player.x-W*.35,end.x+end.w-W));camera+=(cameraTarget-camera)*Math.min(1,dt*6);
  }
  function star(x,y,r,color){ctx.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,rr=i%2?r*.46:r;ctx.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);}ctx.closePath();ctx.fillStyle=color;ctx.fill();}
  function draw(){
    ctx.clearRect(0,0,W,H);ctx.fillStyle='#0b1424';ctx.fillRect(0,0,W,H);
    for(let i=0;i<38;i++){const x=((i*137-camera*.12)%W+W)%W,y=30+(i*71)%300;ctx.fillStyle=i%4?'#293d59':'#56708b';ctx.fillRect(x,y,2,2);}
    ctx.fillStyle='#ffc447';ctx.beginPath();ctx.arc(806-camera*.05,90,30,0,Math.PI*2);ctx.fill();
    for(let i=-1;i<7;i++){const x=i*230-camera*.2;round(x,470-(i%3)*28,300,170,90,'#111f33');}
    ctx.save();ctx.translate(-camera,0);
    platforms.forEach((p,i)=>{
      round(p.x,p.y,p.w,24,9,p.moving?'#245c7d':'#263952');round(p.x,p.y,p.w,5,2,p.moving?'#4db8ff':'#8198ac');
      if(p.moving){ctx.fillStyle='#96cfee';ctx.font='14px system-ui';ctx.textAlign='center';ctx.fillText('↕',p.x+p.w/2,p.y+20);}
      if(i===currentLevel.checkpoint){ctx.fillStyle='#8198ac';ctx.fillRect(p.x+20,p.y-58,3,58);ctx.fillStyle=checkpoint?'#ffc447':'#4db8ff';ctx.beginPath();ctx.moveTo(p.x+23,p.y-58);ctx.lineTo(p.x+51,p.y-47);ctx.lineTo(p.x+23,p.y-35);ctx.fill();}
    });
    stars.forEach(s=>{if(!s.got)star(s.x,s.y,11,'#ffc447');});
    const end=platforms.at(-1),hx=end.x+end.w-84,hy=end.y;
    round(hx,hy-58,52,58,5,'#ffc447');ctx.fillStyle='#ffe2a0';ctx.beginPath();ctx.moveTo(hx-8,hy-56);ctx.lineTo(hx+26,hy-85);ctx.lineTo(hx+60,hy-56);ctx.fill();round(hx+18,hy-30,17,30,7,'#6b542f');
    round(player.x,player.y,player.w,player.h,10,'#4db8ff');
    const look=player.vx>0?2:player.vx<0?-2:0;
    round(player.x+7+look,player.y+10,4,6,2,'#0b1424');round(player.x+18+look,player.y+10,4,6,2,'#0b1424');
    ctx.strokeStyle='#0b1424';ctx.lineWidth=2;ctx.beginPath();ctx.arc(player.x+14+look,player.y+19,4,0,Math.PI);ctx.stroke();
    ctx.restore();
  }
  function frame(timestamp){
    const dt=Math.min((timestamp-last)/1000||0,.05);last=timestamp;
    if(state==='playing'){accumulator+=dt;while(accumulator>=STEP){step(STEP);accumulator-=STEP;if(state!=='playing'){accumulator=0;break;}}}else accumulator=0;
    draw();requestAnimationFrame(frame);
  }
  load();requestAnimationFrame(frame);
})();
