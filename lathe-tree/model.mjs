export const defaults={h:6,d:3,n:3,t:.75,curve:.55};
export const fmt=n=>Number(n.toFixed(3)).toString();
export function validate(s){
 if(![s.h,s.d,s.n,s.t].every(Number.isFinite))throw Error('Enter a number in every dimension field.');
 if(s.h<3||s.h>8)throw Error('Height must be 3–8 inches to fit one Letter sheet at full size.');
 if(s.d<1||s.d>4.5)throw Error('Diameter must be 1–4.5 inches.');
 if(!Number.isInteger(s.n)||s.n<2||s.n>5)throw Error('Choose 2–5 branch tiers.');
 if(s.t<.25||s.t>1.5||s.t>=s.h)throw Error('Trunk height must be 0.25–1.5 inches and less than total height.');
 if(s.curve!==undefined&&(!Number.isFinite(s.curve)||s.curve<0||s.curve>1))throw Error('Curvature must be between 0 and 100%.');
 return s;
}
export function geometry(s){
 validate(s);
 const rows=[{name:'Bottom / trunk',z:0,d:s.d*.3},{name:'Trunk top',z:s.t,d:s.d*.3}];
 const pts=[[s.d*.15,0],[s.d*.15,s.t]];
 for(let i=0;i<s.n;i++){
  const z=s.t+(s.h-s.t)*i/s.n,diameter=s.d*Math.pow(1-i/s.n,.8);
  if(i){const neck=diameter*.62;pts.push([neck/2,z]);rows.push({name:`Valley ${i}`,z,d:neck});}
  pts.push([diameter/2,z]);rows.push({name:`Tier ${i+1} rim`,z,d:diameter});
 }
 pts.push([0,s.h]);rows.push({name:'Tip',z:s.h,d:0});
 const curved=[pts[0]],curve=s.curve??defaults.curve;
 for(let i=1;i<pts.length;i++){
  const [r0,z0]=pts[i-1],[r1,z1]=pts[i];
  if(z1>z0&&r0>r1&&curve>0){
   for(let j=1;j<32;j++){const q=j/32;curved.push([r1+(r0-r1)*Math.pow(1-q,1+1.8*curve),z0+(z1-z0)*q]);}
  }
  curved.push(pts[i]);
 }
 return {pts:curved,rows,stations:[...new Set(rows.map(r=>r.z))]};
}
// Page geometry uses PDF points: exactly 72 points per inch, origin at bottom left.
// The screen, browser print and downloadable PDF all consume these same commands.
export function pages(s){
 const {pts,rows,stations}=geometry(s),p=[[],[]];let out=p[0];
 const text=(x,y,size,value)=>out.push({kind:'text',x,y,size,value});
 const line=(x,y,x2,y2,gray=0,dash=false)=>out.push({kind:'line',x,y,x2,y2,gray,dash});
 const cx=220,base=118;
 text(36,757,17,'LITTLE PINE | FULL-SIZE LATHE PROFILE');
 text(36,737,10,`${fmt(s.h)} in tall | ${fmt(s.d)} in widest diameter | ${s.n} tiers | curve ${Math.round((s.curve??defaults.curve)*100)}% | US Letter`);
 text(36,720,10,'Print Actual Size / 100%. Disable Fit / Shrink. Check the square below.');
 const full=[...pts,...pts.slice(0,-1).reverse().map(([r,z])=>[-r,z])];
 out.push({kind:'path',pts:full.map(([r,z])=>[cx+r*72,base+z*72])});
 line(cx,base-12,cx,base+s.h*72+8,0,true);
 stations.forEach(z=>{const y=base+z*72;line(cx-s.d*36-8,y,442,y,.65);line(437,y,450,y);text(459,y-3,10,`${fmt(z)} in`);});
 line(442,base,442,base+s.h*72);text(403,base+s.h*72+12,10,'FROM BOTTOM');text(cx-38,96,10,'BOTTOM DATUM');
 out.push({kind:'rect',x:36,y:36,w:72,h:72});text(43,70,10,'1 in square');
 text(126,67,10,'Measure BOTH sides: each must be exactly 1 inch.');
 text(126,51,10,'Use only with the lathe stopped. Paper is a layout guide.');
 out=p[1];text(36,757,18,'CUT STATIONS & TURNING PLAN');
 text(36,732,11,`${fmt(s.h)} in height | ${fmt(s.d)} in maximum diameter | trunk ${fmt(s.t)} in tall`);
 text(36,702,11,'All axial distances start at the finished bottom, not the end of the blank.');
 text(36,685,11,'Diameters are full widths. They are NOT radial cutting depths.');
 text(36,652,11,'Station');text(280,652,11,'From bottom (in)');text(435,652,11,'Diameter (in)');
 let y=629;rows.forEach(r=>{text(36,y,11,r.name);text(280,y,11,fmt(r.z));text(435,y,11,fmt(r.d));y-=21;});y-=16;
 [
 '1. Select sound stock with grain along the spindle axis. Leave extra wood',
 '   at both ends for your mounting method; it is outside this finished profile.',
 '2. Rough to a cylinder slightly larger than the widest diameter. Establish',
 '   the finished bottom datum, then transfer the height marks from page 1.',
 '3. Work the tier slopes and valleys gradually. Valley and rim share a height:',
 '   they describe the inside and outside of the same branch shoulder.',
 '4. Stop to measure diameters and compare the profile. Soften sharp rims;',
 '   the drawn point is a design target, not a zero-diameter mounted support.',
 '5. Keep mounting waste until shaping and sanding are complete. Remove',
 '   from the lathe to finish the tip and bottom as your holding method requires.'
 ].forEach(t=>{text(36,y,10.5,t);y-=16;});
 text(36,88,10,'Original decorative profile. The preview shows shape, not a tool-cut sequence.');
 text(36,72,10,'Wear a face shield. Follow your lathe manual and safe mounting practices.');
 text(36,52,9,'Safety reference: American Association of Woodturners - woodturner.org/lathe-safety-basics');
 return p;
}
const xml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function pageSVG(commands,index){
 const shapes=commands.map(c=>{
  if(c.kind==='text')return `<text x="${c.x}" y="${792-c.y}" font-size="${c.size}" xml:space="preserve">${xml(c.value)}</text>`;
  if(c.kind==='line')return `<path d="M${c.x} ${792-c.y}L${c.x2} ${792-c.y2}" fill="none" stroke="rgb(${(c.gray||0)*255},${(c.gray||0)*255},${(c.gray||0)*255})" ${c.dash?'stroke-dasharray="4 3"':''}/>`;
  if(c.kind==='rect')return `<rect x="${c.x}" y="${792-c.y-c.h}" width="${c.w}" height="${c.h}" fill="none" stroke="black"/>`;
  return `<path d="${c.pts.map(([x,y],i)=>`${i?'L':'M'}${x} ${792-y}`).join(' ')}Z" fill="none" stroke="black"/>`;
 }).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="8.5in" height="11in" viewBox="0 0 612 792" role="img" aria-label="${index===0?'Full-size tree template':'Cut stations and turning plan'}"><rect width="612" height="792" fill="white"/><g font-family="Arial, Helvetica, sans-serif" fill="black" stroke-width="0.65">${shapes}</g></svg>`;
}
export function makePDF(s){
 const esc=t=>String(t).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
 const streams=pages(s).map(commands=>commands.map(c=>{
  if(c.kind==='text')return `BT /F1 ${c.size} Tf ${c.x} ${c.y} Td (${esc(c.value)}) Tj ET\n`;
  if(c.kind==='line')return `q ${c.gray||0} G ${c.dash?'[4 3] 0 d':''} ${c.x} ${c.y} m ${c.x2} ${c.y2} l S Q\n`;
  if(c.kind==='rect')return `${c.x} ${c.y} ${c.w} ${c.h} re S\n`;
  return c.pts.map(([x,y],i)=>`${x} ${y} ${i?'l':'m'}`).join('\n')+' h S\n';
 }).join(''));
 const objects=[null,'<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [4 0 R 6 0 R] /Count 2 >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 streams.forEach((s,i)=>{const stream='0 G 0 g 0.65 w\n'+s,id=4+i*2;objects[id]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${id+1} 0 R >>`;objects[id+1]=`<< /Length ${stream.length} >>\nstream\n${stream}endstream`;});
 let pdf='%PDF-1.4\n',offsets=[0];for(let i=1;i<objects.length;i++){offsets[i]=pdf.length;pdf+=`${i} 0 obj\n${objects[i]}\nendobj\n`;}
 const xref=pdf.length;pdf+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;for(let i=1;i<objects.length;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';return pdf+`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
}
