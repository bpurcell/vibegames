export function design({height,top,bottom,thickness,shrink,extended=false}) {
  if (![height,top,bottom,thickness,shrink].every(Number.isFinite) || height<(extended?20:40) || height>(extended?320:220) || bottom<40 || (!extended && top<bottom) || top<35 || top>(extended?300:180) || bottom>(extended?240:180) || thickness<2 || thickness>12 || shrink<0 || shrink>25 || height*(1-shrink/100)<=thickness || (!extended && top-bottom>100)) throw new Error('Use a height of 40–220 mm, diameters of 40–180 mm, slab thickness of 2–12 mm, and shrinkage of 0–25%. The rim must be at least as wide as the base, with at most 100 mm of taper.');
  const scale=1/(1-shrink/100), H=height*scale, T=top*scale, B=bottom*scale, t=thickness;
  const h=H-t, delta=Math.abs(T-B)/2, slope=(T-B)/2/h, normal=Math.sqrt(1+slope*slope);
  const r0=B/2-t*normal/2, r1=T/2-t*normal/2, slant=Math.hypot(h,delta);
  if (Math.min(r0,r1)-t*normal/2<=0) throw new Error("Reduce slab thickness or taper to leave an open interior.");
  let path,w,bh;
  if(delta<0.000001){w=2*Math.PI*r0;bh=h;path=`M 0 0 H ${w} V ${h} H 0 Z`;}
  else {
    const angle=2*Math.PI*delta/slant, a=angle/2, outer=slant*Math.max(r0,r1)/delta, inner=slant*Math.min(r0,r1)/delta;
    w=2*outer*(a>Math.PI/2?1:Math.sin(a));bh=outer-(Math.cos(a)>=0?inner:outer)*Math.cos(a);
    const x=w/2, y=outer;
    path=`M ${x-outer*Math.sin(a)} ${y-outer*Math.cos(a)} A ${outer} ${outer} 0 ${angle>Math.PI?1:0} 1 ${x+outer*Math.sin(a)} ${y-outer*Math.cos(a)} L ${x+inner*Math.sin(a)} ${y-inner*Math.cos(a)} A ${inner} ${inner} 0 ${angle>Math.PI?1:0} 0 ${x-inner*Math.sin(a)} ${y-inner*Math.cos(a)} Z`;
  }
  const firedT=t/scale, innerTop=top/2-firedT*normal, innerBottom=bottom/2-firedT*normal;
  const volume=Math.PI*(height-firedT)*(innerTop**2+innerTop*innerBottom+innerBottom**2)/3000;
  return {H,T,B,t,h,r0,r1,slant,path,w,bh,volume,scale};
}
export function tiles(w,h,paper){
  const pw=paper==='a4'?210:215.9, ph=paper==='a4'?297:279.4;
  const cw=pw-24,ch=ph-44,overlap=10;
  const cols=Math.max(1,Math.ceil((w-overlap)/(cw-overlap))),rows=Math.max(1,Math.ceil((h-overlap)/(ch-overlap)));
  return {pw,ph,cw,ch,cols,rows,stepX:cw-overlap,stepY:ch-overlap};
}
