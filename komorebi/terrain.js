// Original scroll terrain: seeded smooth noise, octave sums, and ridge contours.
(function(global){
function hash(i,seed){let n=Math.imul(i^seed,374761393);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967296}
function noise(x,seed){const i=Math.floor(x),t=x-i,u=t*t*(3-2*t);return hash(i,seed)*(1-u)+hash(i+1,seed)*u}
function fbm(x,seed){return noise(x,seed)*.57+noise(x*2,seed+97)*.27+noise(x*4,seed+193)*.11+noise(x*8,seed+317)*.05}
function mountain(c,x,base,w,h,seed,alpha){
 const shape=(t,k=0)=>Math.pow(Math.max(0,Math.sin(Math.PI*t)),.65)*( .55+fbm(t*6+k*.12,seed)*.65);
 c.save();c.translate(x,base);c.lineJoin='round';c.lineCap='round';
 c.beginPath();c.moveTo(-w/2,0);for(let i=0;i<=80;i++){let t=i/80;c.lineTo((t-.5)*w,-shape(t)*h)}c.lineTo(w/2,5);c.closePath();c.fillStyle='#efeadd';c.globalAlpha=alpha*.9;c.fill();
 c.strokeStyle='#605f53';c.globalAlpha=alpha*.65;c.lineWidth=.8;c.stroke();
 for(let j=1;j<19;j++){const p=1-j/21;c.beginPath();for(let i=0;i<=70;i++){let t=i/70,xx=(t-.5)*w*p+(noise(j*.4,seed+20)-.5)*w*.15*(1-p),yy=-shape(t,j)*h*p+(1-p)*12+(noise(t*16+j*.3,seed+31)-.5)*5; if(i)c.lineTo(xx,yy);else c.moveTo(xx,yy)}c.lineWidth=j%3===0?.7:.45;c.globalAlpha=alpha*(.12+hash(j,seed)*.2);c.stroke()}
 for(let k=0;k<32;k++){let t=.12+hash(k,seed+812)*.76,y=-shape(t)*h;c.beginPath();for(let j=0;j<10;j++){let progress=j/10,xx=(t-.5)*w+(noise(progress*5+k,seed+1)-.5)*w*.035,yy=y*(1-progress*.7)+j*.7;if(j)c.lineTo(xx,yy);else c.moveTo(xx,yy)}c.globalAlpha=alpha*.17;c.lineWidth=.6;c.stroke()}
 c.restore();
}
function render(c,w,h,view){const base=h*.77;c.save();
 for(let layer=0;layer<3;layer++){const step=layer===0?480:360,factor=.12+layer*.16,start=Math.floor((view*factor-300)/step),end=Math.ceil((view*factor+w+300)/step);for(let i=start;i<=end;i++){let seed=i*173+layer*997+41,x=i*step-view*factor+hash(i,layer+47)*120,ww=step*(1.05+hash(i,seed)*.6),hh=(layer===0?65:layer===1?170:115)*(0.65+hash(i,layer+891)*.8);mountain(c,x,base+layer*17,ww,Math.min(h*.43,hh),seed,layer===0?.16:layer===1?.42:.65)}}
 c.strokeStyle='#7d7966';for(let j=0;j<15;j++){c.beginPath();for(let x=-10;x<=w+10;x+=10){let wx=x+view*.7,y=base+55+j*4+Math.sin(wx*.007+j*.7)*3+noise(wx*.009+j*17,55)*3;if(x===-10)c.moveTo(x,y);else c.lineTo(x,y)}c.lineWidth=.45;c.globalAlpha=.035+(j%3)*.015;c.stroke()}c.restore();
}
global.ScrollTerrain={render,noise,fbm};
})(typeof window==='undefined'?globalThis:window);
