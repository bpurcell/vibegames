// A bounded arithmetic parser. User formulas are data, never JavaScript.
(function(root){
'use strict';
const functions={sin:[Math.sin,1],cos:[Math.cos,1],abs:[Math.abs,1],sqrt:[Math.sqrt,1],min:[Math.min,2],max:[Math.max,2]};
const variables=new Set(['r','d','s','a','w','pi']);
function compile(source){
 if(typeof source!=='string'||!source.trim()||source.length>180)throw Error('Use a formula between 1 and 180 characters.');
 const tokens=[];let at=0;
 while(at<source.length){const match=/^(\s+|(?:\d+(?:\.\d*)?|\.\d+)|[a-z]+|[+\-*/^(),])/.exec(source.slice(at));if(!match)throw Error(`Unexpected character at position ${at+1}.`);at+=match[0].length;if(!/^\s/.test(match[0]))tokens.push(match[0]);}
 if(tokens.length>100)throw Error('This formula is too long.');let i=0;
 function expression(min=0,depth=0){
  if(depth>24)throw Error('Too many nested expressions.');
  let token=tokens[i++],node;
  if(token==='+'||token==='-')node={op:'unary',sign:token,value:expression(3,depth+1)};
  else if(token==='('){node=expression(0,depth+1);if(tokens[i++]!==')')throw Error('Missing closing parenthesis.');}
  else if(token&&/^\d|^\./.test(token))node={value:Number(token)};
  else if(variables.has(token))node={variable:token};
  else if(Object.hasOwn(functions,token)){if(tokens[i++]!=='(')throw Error(`${token} needs parentheses.`);const args=[expression(0,depth+1)];while(tokens[i]===','){i++;args.push(expression(0,depth+1));}if(tokens[i++]!==')'||args.length!==functions[token][1])throw Error(`${token} expects ${functions[token][1]} argument(s).`);node={fn:token,args};}
  else throw Error(`Unknown term ${token||'at end of formula'}.`);
  while(i<tokens.length){const op=tokens[i],precedence={'+':1,'-':1,'*':2,'/':2,'^':3}[op];if(!precedence||precedence<min)break;i++;node={op,left:node,right:expression(op==='^'?precedence:precedence+1,depth+1)};}
  return node;
 }
 const ast=expression();if(i!==tokens.length)throw Error(`Unexpected ${tokens[i]}.`);
 function evaluate(n,values){let result;if(n.variable)result=n.variable==='pi'?Math.PI:values[n.variable];else if(n.fn)result=functions[n.fn][0](...n.args.map(a=>evaluate(a,values)));else if(n.op==='unary')result=(n.sign==='-'?-1:1)*evaluate(n.value,values);else if(n.op){const a=evaluate(n.left,values),b=evaluate(n.right,values);result=n.op==='+'?a+b:n.op==='-'?a-b:n.op==='*'?a*b:n.op==='/'?a/b:Math.pow(a,b);}else result=n.value;if(!Number.isFinite(result)||Math.abs(result)>1e6)throw Error('Formula produced an undefined or excessively large value.');return result;}
 return values=>evaluate(ast,values);
}
function random(seed){let h=2166136261;for(const c of String(seed))h=Math.imul(h^c.charCodeAt(0),16777619);return()=>{h+=0x6D2B79F5;let t=Math.imul(h^h>>>15,1|h);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};}
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function generate(tree){
 const rules={length:compile(tree.length),angle:compile(tree.angle),bend:compile(tree.bend)};
 const branches=[],leaves=[];let clipped=0;
 function limited(n,min,max){const value=clamp(n,min,max);if(value!==n)clipped++;return value;}
 function grow(x,y,len,heading,level,side,path){
  const rng=random(tree.seed+':'+path),r=rng()*2-1;
  const values={r,d:level/tree.depth,s:side,a:tree.spread*Math.PI/180,w:tree.wind};
  const bend=limited(rules.bend(values),-.9,.9),endAngle=heading+bend;
  const ex=x+Math.cos(endAngle)*len,ey=y+Math.sin(endAngle)*len;
  const branch={x,y,ex,ey,cx:x+Math.cos(heading-bend)*len*.5,cy:y+Math.sin(heading-bend)*len*.5,width:Math.max(.32,4.6*Math.pow(.66,level))};branches.push(branch);
  if(level===tree.depth){const lr=random(tree.seed+':leaves:'+path);for(let j=0;j<10;j++){const a=lr()*Math.PI*2,rad=Math.sqrt(lr()),size=.8+lr()*1.9;const leaf={x:ex+Math.cos(a)*rad*10,y:ey+Math.sin(a)*rad*6,size,angle:lr()*Math.PI,color:Math.floor(lr()*3)};if(j<Math.round(tree.foliage*10))leaves.push(leaf);}return;}
  for(const s of [-1,1]){const childValues={...values,s,r:random(tree.seed+':'+path+s)()*2-1};const scale=limited(rules.length(childValues),.3,.86),turn=limited(rules.angle(childValues),-1.6,1.6);grow(ex,ey,len*scale,endAngle+turn,level+1,s,path+s);}
 }
 if(!Number.isInteger(tree.depth)||tree.depth<2||tree.depth>7)throw Error('Branch depth must be between 2 and 7.');
 grow(0,0,40,-Math.PI/2,0,0,'root');
 return {branches,leaves,clipped};
}
const api={compile,random,generate};if(typeof module!=='undefined')module.exports=api;else root.FormulaTrees=api;
})(typeof window==='undefined'?globalThis:window);
