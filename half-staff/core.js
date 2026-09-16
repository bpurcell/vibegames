/* Deterministic memorial model. No storage, network or DOM dependencies. */
(function(root){
  'use strict';
  const HOUR=3600000;
  function normalize(data){
    if(!data || !Array.isArray(data.incidents) || !Number.isFinite(Date.parse(data.updated_at))) throw Error('Unrecognized feed');
    const seen=new Set(), incidents=[];
    for(const e of data.incidents){
      if(!['mass_shooting','mass_public_shooting'].includes(e.metaType))continue;
      const deaths=Number(e.victims), id=String(e.id), timestamp=Date.parse(e.date+'T00:00:00Z');
      if(e.id==null||!id||seen.has(id)||!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||!Number.isFinite(timestamp)||new Date(timestamp).toISOString().slice(0,10)!==e.date||!Number.isInteger(deaths)||deaths<4||!e.city||!e.state)throw Error('Invalid incident in feed');
      seen.add(id);
      const links=String(e.related_links||'').split(/\s+/).filter(url=>{try{return new URL(url).protocol==='https:'}catch{return false}});
      incidents.push({id,date:e.date,timestamp,city:e.city,state:e.state,deaths,links});
    }
    if(!incidents.length)throw Error('Feed contains no qualifying records');
    incidents.sort((a,b)=>a.timestamp-b.timestamp||a.id.localeCompare(b.id));
    return {updatedAt:data.updated_at,incidents};
  }
  function model(incidents,now,holdHours,riseHours){
    if(!Number.isFinite(holdHours)||holdHours<0||!Number.isFinite(riseHours)||riseHours<=0)throw Error('Invalid timing');
    let height=1,holdUntil=0,previous=0,count=0,deaths=0;
    for(const e of [...incidents].sort((a,b)=>a.timestamp-b.timestamp||a.id.localeCompare(b.id))){
      if(e.timestamp>now)continue;
      height=Math.min(1,height+Math.max(0,e.timestamp-Math.max(previous,holdUntil))/(riseHours*HOUR));
      height/=2;
      holdUntil=Math.max(holdUntil,e.timestamp)+e.deaths*holdHours*HOUR;
      previous=e.timestamp;count++;deaths+=e.deaths;
    }
    height=Math.min(1,height+Math.max(0,now-Math.max(previous,holdUntil))/(riseHours*HOUR));
    return {height,holdUntil,count,deaths,holding:count>0&&now<holdUntil,fullAt:Math.max(now,holdUntil)+(1-height)*riseHours*HOUR};
  }
  const api={normalize,model,HOUR};if(typeof module!=='undefined')module.exports=api;else root.Memorial=api;
})(typeof window!=='undefined'?window:globalThis);
