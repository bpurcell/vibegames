import {design} from './geometry.mjs';
const field=(id,label,min,max,value)=>({id,label,min,max,value});
export const forms={
 cup:{name:'Cup',fields:[field('height','Height',40,220,95),field('top','Rim diameter',40,180,85),field('bottom','Base diameter',40,180,85)],description:'A straight or flared everyday cup.',notes:['Join the wall with a butt seam; no overlap is added.','Stand the wall on the floor disk. Score, slip, compress, and bevel the contact edges.']},
 butter:{name:'Butter dish',box:true,fields:[field('length','Cover length',100,260,170),field('width','Cover width',60,160,90),field('height','Cover height',35,100,60),field('margin','Plate border',5,30,12)],description:'A lift-off rectangular cover on a flat serving plate. Dimensions describe the outside of the cover; the plate extends by the border on each side.',notes:['Long cover walls run the full length. Short walls fit between them.','Attach the roof over all four walls. Keep the bottom open.','Keep the plate flat. The cover rests freely on it; no locking rim is included. Measure your butter against the clear interior shown below.']},
 bowl:{name:'Shallow bowl',fields:[field('height','Height',20,100,45),field('top','Rim diameter',80,300,180),field('bottom','Base diameter',40,240,110)],description:'A straight-sided, flared bowl for snacks or small treasures.',notes:['The larger curved edge is the rim. Join the straight edges with a butt seam.','Stand the wall on the floor disk; bevel and compress the lower joint. This is a conical bowl, not a rounded or spherical form.']},
 vase:{name:'Vase',fields:[field('height','Height',60,320,180),field('top','Opening diameter',35,200,65),field('bottom','Base diameter',40,200,100)],description:'A tall vessel with a straight, flared, or narrowing profile.',notes:['For a narrowing vase, the smaller curved edge is the opening. Label the top before joining.','Join the straight edges with a butt seam, then attach the floor underneath. Compress the base joint carefully.']},
 planter:{name:'Rectangular planter',box:true,fields:[field('length','Length',80,320,180),field('width','Width',60,240,100),field('height','Height',40,200,100)],description:'An open rectangular planter with three drainage holes in the floor.',notes:['Stand the four walls on top of the floor. The short walls fit between the full-length long walls.','Cut the three marked drainage holes in the floor. No saucer is included.','Score, slip, and compress the corners and floor joints.']},
 box:{name:'Lidded box',box:true,fields:[field('length','Body length',70,260,130),field('width','Body width',60,220,100),field('height','Body height',35,160,65),field('clearance','Lid clearance / side',1,5,2)],description:'A rectangular box with a flat lid and two underside locator strips. Body height excludes the lid; clearance is the fired gap on each side.',notes:['Stand the walls on the floor; short walls fit between the long walls.','The lid rests on the wall tops. Attach the two locator strips underneath, parallel to the long edges.','Set each strip’s outside edge one fired wall thickness plus the chosen clearance inward from the lid edge; center the strips lengthwise.','Dry the lid and body together with a separator. Keep mating surfaces free of glaze; test the fit after firing.']}
};
const rect=(key,title,w,h,qty=1,note='')=>({key,title,w,h,qty,note,path:`M0 0H${w}V${h}H0Z`});
export function buildForm(type,v){
 const f=forms[type];if(!f)throw new Error('Choose a form.');
 for(const p of f.fields)if(!Number.isFinite(v[p.id])||v[p.id]<p.min||v[p.id]>p.max)throw new Error(`${p.label} must be ${p.min}–${p.max} mm (use the equivalent in inches).`);
 if(!Number.isFinite(v.thickness)||v.thickness<2||v.thickness>12||!Number.isFinite(v.shrink)||v.shrink<0||v.shrink>25)throw new Error('Wet slab thickness must be 2–12 mm; shrinkage must be 0–25%.');
 const scale=1/(1-v.shrink/100),t=v.thickness,ft=t/scale;
 if(!f.box){
  if(type!=='vase'&&v.top<v.bottom)throw new Error('The rim must be at least as wide as the base.');
  const g=design({...v,extended:true});
  return {...g,type,parts:[{key:'wall',title:'Wall',w:g.w,h:g.bh,qty:1,path:g.path,note:`Butt seam. ${v.top<v.bottom?'Smaller':'Larger'} curved edge is the rim; straight form edges are interchangeable.`},{key:'floor',title:'Floor',w:g.B,h:g.B,qty:1,circle:g.B/2,note:'Wall sits on top of this disk.'}],info:`Approximate brim capacity: ${Math.round(g.volume)} ml.`,notes:f.notes};
 }
 const L=v.length*scale,W=v.width*scale,H=v.height*scale;
 if(Math.min(L,W)<=4*t||H<=2*t)throw new Error('Increase dimensions or reduce slab thickness to leave room for joints and an interior.');
 const wallH=H-t;
 const parts=[rect('long','Long wall',L,wallH,2,'Full length. Short walls fit between these.'),rect('short','Short wall',W-2*t,wallH,2,'Fits between the two long walls.')];
 if(type==='butter'){parts.push(rect('roof','Cover roof',L,W,1,'Attach over the four cover walls.'),rect('plate','Serving plate',L+2*v.margin*scale,W+2*v.margin*scale,1,'Flat plate; leave the cover separate.'));}
 else {const floor=rect('floor','Floor',L,W,1,'All walls stand on top of this floor.');if(type==='planter'){floor.holes=[.25,.5,.75].map(k=>({x:L*k,y:W/2,r:3*scale}));floor.note+=' Cut three 6 mm fired drainage holes.';}parts.push(floor);}
 if(type==='box'){
  const c=v.clearance*scale,stripLength=L-2*t-2*c,stripWidth=t;
  if(stripLength<=2*t||W-2*t-2*c<=2*stripWidth)throw new Error('Reduce clearance or slab thickness to leave room for the lid locators.');
  parts.push(rect('lid','Lid',L,W,1,'Rests on the wall tops. Locator strips attach underneath.'),rect('locator','Lid locator strip',stripLength,stripWidth,2,`Center lengthwise beneath lid; outer strip edge ${(t+c).toFixed(1)} mm from each long lid edge (wet).`));
 }
 return {type,scale,t,L,W,H,ft,parts,volume:(v.length-2*ft)*(v.width-2*ft)*(v.height-ft)/1000,info:`Clear interior: ${(v.length-2*ft).toFixed(1)} × ${(v.width-2*ft).toFixed(1)} × ${(v.height-ft).toFixed(1)} mm.`,notes:f.notes};
}
export function partMarkup(p){return (p.circle?`<circle cx="${p.circle}" cy="${p.circle}" r="${p.circle}"/>`:`<path d="${p.path}"/>`)+(p.holes||[]).map(h=>`<circle cx="${h.x}" cy="${h.y}" r="${h.r}"/>`).join('');}
