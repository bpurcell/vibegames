export const G=9.80665,REFERENCE_LENGTH=G/Math.PI**2;
export const defaults={length:REFERENCE_LENGTH,mass:1,friction:1,beat:0,drive:1};
export const period=(length,amplitude=0)=>2*Math.PI*Math.sqrt(length/G)*(1+amplitude**2/16+11*amplitude**4/3072);
export function createState(){return {theta:3*Math.PI/180,omega:0,time:0,ticks:0,reserve:.8,events:[],nextDirection:-1,lastEvent:-100,energyIn:0};}
export function advance(s,p,dt){
 const before=s.theta,beta=.0005*p.friction;
 // Velocity Verlet with an explicit damping term; small fixed integration step.
 const acc=theta=>-G/p.length*Math.sin(theta);
 const half=(s.omega+acc(s.theta)*dt/2)*Math.exp(-beta*dt);
 s.theta+=half*dt;s.omega=(half+acc(s.theta)*dt/2)*Math.exp(-beta*dt);s.time+=dt;
 const target=p.beat*Math.PI/180,dir=Math.sign(s.omega);
 const crossed=dir>0?before<target&&s.theta>=target:before>target&&s.theta<=target;
 if(crossed&&dir===s.nextDirection&&s.time-s.lastEvent>.15){
  s.nextDirection=-dir;
  if(p.drive>0&&s.reserve>0){const drop=Math.min(s.reserve,.8/(8*86400));const input=4*G*drop*p.drive*.2;const I=p.mass*p.length*p.length;s.omega=dir*Math.sqrt(s.omega*s.omega+2*input/I);s.reserve-=drop;s.energyIn+=input;s.ticks++;s.lastEvent=s.time;s.events.push({time:s.time,dir});if(s.events.length>16)s.events.shift();return true;}
 }
 return false;
}
export function metrics(s,p){const E=.5*p.mass*p.length**2*s.omega**2+p.mass*G*p.length*(1-Math.cos(s.theta));const amplitude=Math.acos(Math.max(-1,Math.min(1,1-E/(p.mass*G*p.length))));const T=period(p.length,amplitude);const intervals=s.events.slice(1).map((e,i)=>e.time-s.events[i].time);return {energy:E,amplitude,period:T,drift:(2/T-1)*86400,intervals};}
