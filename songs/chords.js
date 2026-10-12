/* Standard-tuning guitar shapes, low E to high E; -1 means muted. */
(() => {
  const shapes = {
    C:[-1,3,2,0,1,0],D:[-1,-1,0,2,3,2],E:[0,2,2,1,0,0],G:[3,2,0,0,0,3],A:[-1,0,2,2,2,0],
    Am:[-1,0,2,2,1,0],Dm:[-1,-1,0,2,3,1],Em:[0,2,2,0,0,0],
    C7:[-1,3,2,3,1,0],D7:[-1,-1,0,2,1,2],E7:[0,2,0,1,0,0],G7:[3,2,0,0,0,1],A7:[-1,0,2,0,2,0],B7:[-1,2,1,2,0,2],
    Am7:[-1,0,2,0,1,0],Dm7:[-1,-1,0,2,1,1],Em7:[0,2,0,0,0,0],
    Cmaj7:[-1,3,2,0,0,0],Dmaj7:[-1,-1,0,2,2,2],Emaj7:[0,2,1,1,0,0],Gmaj7:[3,2,0,0,0,2],Amaj7:[-1,0,2,1,2,0],
    Asus2:[-1,0,2,2,0,0],Asus4:[-1,0,2,2,3,0],Dsus2:[-1,-1,0,2,3,0],Dsus4:[-1,-1,0,2,3,3],Esus4:[0,2,2,2,0,0],Cadd9:[-1,3,2,0,3,0],
    'C/G':[3,3,2,0,1,0],'D/F#':[2,-1,0,2,3,2],'G/B':[-1,2,0,0,0,3],'Am/G':[3,0,2,2,1,0],'C/E':[0,3,2,0,1,0],'D/A':[-1,0,0,2,3,2]
  };
  const pitches = {C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11};
  function shape(name) {
    name = name.replace(/♯/g,'#').replace(/♭/g,'b');
    if (shapes[name]) return shapes[name];
    const match = name.match(/^([A-G][#b]?)(m|7|m7|maj7|sus4|5)?$/);
    if (!match) return null;
    const fret = (pitches[match[1]] - 4 + 12) % 12;
    const offsets = {'':[0,2,2,1,0,0],m:[0,2,2,0,0,0],'7':[0,2,0,1,0,0],m7:[0,2,0,0,0,0],maj7:[0,2,1,1,0,0],sus4:[0,2,2,2,0,0],'5':[0,2,2,-1,-1,-1]};
    return offsets[match[2] || ''].map(n => n < 0 ? -1 : n + fret);
  }
  function names(source, isChordPro) {
    const valid = /^[A-G][#b♯♭]?(?:(?:maj|min|m|dim|aug|sus|add)?\d*)?(?:\/[A-G][#b♯♭]?)?$/;
    const candidates = isChordPro ? [...source.matchAll(/\[([^\]]+)\]/g)].map(m=>m[1]) : source.split('\n').filter(line => {const tokens=line.trim().split(/\s+/);return tokens.some(t=>valid.test(t)) && tokens.every(t=>valid.test(t)||/^[|:()\-\d]+$/.test(t));}).flatMap(line=>line.trim().split(/\s+/));
    return [...new Set(candidates.filter(n=>valid.test(n)))];
  }
  function diagram(name) {
    const frets = shape(name);
    if (!frets) return null;
    const positive = frets.filter(n=>n>0), start = Math.max(...positive)>5 ? Math.min(...positive) : 1;
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 180 195'); svg.setAttribute('role','img');
    svg.setAttribute('aria-label',`${name}, low E to high E: ${frets.map(n=>n<0?'muted':n===0?'open':`fret ${n}`).join(', ')}`);
    function add(tag, attrs, value) {const el=document.createElementNS(svg.namespaceURI,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);if(value!==undefined)el.textContent=value;svg.append(el);}
    for(let i=0;i<6;i++) add('line',{x1:35+i*23,x2:35+i*23,y1:35,y2:160,stroke:'currentColor','stroke-width':1});
    for(let i=0;i<=5;i++) add('line',{x1:35,x2:150,y1:35+i*25,y2:35+i*25,stroke:'currentColor','stroke-width':i===0&&start===1?4:1});
    if(start>1)add('text',{x:3,y:51,fill:'currentColor','font-size':12},`${start}fr`);
    frets.forEach((n,i)=>{const x=35+i*23;if(n<=0)add('text',{x,y:23,fill:'currentColor','text-anchor':'middle','font-size':16},n<0?'×':'○');else add('circle',{cx:x,cy:47.5+(n-start)*25,r:8,fill:'currentColor'});add('text',{x,y:184,fill:'currentColor','text-anchor':'middle','font-size':11},['E','A','D','G','B','e'][i]);});
    return svg;
  }
  window.SongChords = {names, shape, diagram};
})();
