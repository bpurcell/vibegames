import * as THREE from 'three';
import { WIND_LAYERS, profileRequest, makeAtmosphere } from './atmosphere.mjs';
import { OrbitControls } from './vendor/OrbitControls.js';
import { clamp, wrap, longitude, radians, boundsFor, tilePlan, tileXY, decodeTerrarium, makeWindField, sampleGrid } from './geo.mjs';

const $ = id => document.getElementById(id);
const canvas = $('scene');
const presets = { alps: [46, 10, 6, 'The Alps'], himalaya: [28, 86, 6, 'Himalayas'], andes: [-32.5, -70, 6, 'Andes'], rockies: [40, -106, 6, 'Rockies'] };
let selection = boundsFor(46, 10, 6), selectionName = 'The Alps', mode = 'globe';
let field, renderer, scene, camera, controls, globe, regionOutline, terrainGroup, terrain, terrainData, windLines;
let globeParticles = [], terrainParticles = [], paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
let requestId = 0, building = false, terrainStale = true, last = 0, buildController;
const atmosphereCache = new Map();
const tiles = new Map(), N = 161, globeCount = 2600, terrainCount = 1800, trailLength = 12;
const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
const colorStops = ['#438cb8', '#62d3c6', '#bced99', '#f5cf72', '#f37d65'].map(c => new THREE.Color(c));
const color = new THREE.Color();
function windColor(speed) { const t = clamp(speed / 8, 0, 3.999), i = Math.floor(t); return color.copy(colorStops[i]).lerp(colorStops[i+1], t-i); }
function spherePoint(lat, lon, r = 100) { const phi = lat * radians, theta = lon * radians; return new THREE.Vector3(r*Math.cos(phi)*Math.cos(theta), r*Math.sin(phi), -r*Math.cos(phi)*Math.sin(theta)); }
function notify(message) { $('status').textContent = message; $('status').hidden = !message; }
function dispose(object) { if (!object) return; object.traverse(o => { o.geometry?.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); }); object.removeFromParent(); }
function coordinates(lat, lon) { return `${Math.abs(lat).toFixed(2)}°${lat < 0 ? 'S' : 'N'} / ${Math.abs(longitude(lon)).toFixed(2)}°${longitude(lon) < 0 ? 'W' : 'E'}`; }

function init() {
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true }); }
  catch { notify('WebGL is unavailable. Please enable hardware acceleration or try another browser.'); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, 1, .1, 2000);
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = .08; controls.enablePan = false;
  scene.add(new THREE.AmbientLight(0xb4cbd3, 1.8));
  const light = new THREE.DirectionalLight(0xfff2d2, 2.4); light.position.set(-120, 250, 130); scene.add(light);
  globe = new THREE.Mesh(new THREE.SphereGeometry(100, 96, 64), new THREE.MeshBasicMaterial({ color: 0x708d94 }));
  scene.add(globe);
  new THREE.TextureLoader().load('./data/earth.jpg', texture => { texture.colorSpace = THREE.SRGBColorSpace; globe.material.map = texture; globe.material.needsUpdate = true; }, undefined, () => notify('Globe imagery could not load. Reload the page to retry.'));
  const grid = new THREE.Group(); globe.add(grid);
  const gridMaterial = new THREE.LineBasicMaterial({ color: 0x87a8ac, transparent: true, opacity: .11 });
  for (let lat = -60; lat <= 60; lat += 30) grid.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 181 }, (_, i) => spherePoint(lat, i*2, 100.15))), gridMaterial));
  for (let lon = 0; lon < 360; lon += 30) grid.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 91 }, (_, i) => spherePoint(i*2-90, lon, 100.15))), gridMaterial));
  new ResizeObserver(resize).observe($('viewport'));
  setSelection(selection, selectionName); resetCamera(); resize();
  animate(0);
  fetch('./data/wind.json').then(response => { if (!response.ok) throw Error('Wind download failed'); return response.json(); }).then(data => {
    field = makeWindField(data); globeParticles = Array.from({ length: globeCount }, () => newParticle(false));
    setupWind(); updateMetrics(); $('render').disabled = false; notify('');
  }).catch(() => notify('Wind data could not load. Reload this page to retry.'));
}
function resize() {
  const { width, height } = $('viewport').getBoundingClientRect();
  renderer.setSize(width, height, false); camera.aspect = width / height; camera.zoom = Math.min(1, camera.aspect / 1.2); camera.updateProjectionMatrix();
}
function resetCamera() {
  controls.target.set(0, 0, 0);
  if (mode === 'globe') {
    camera.position.copy(spherePoint(selection.lat, selection.lon, 340)); controls.minDistance = 145; controls.maxDistance = 520; controls.maxPolarAngle = Math.PI; controls.enablePan = false;
  } else {
    const top = (terrainData.maxHeight + Math.max(10, ...visibleHeights())) * terrainData.vertical * Number($('exaggeration').value);
    controls.target.y = top * .3;
    camera.position.set(130, 100 + top * .4, 195).multiplyScalar(Math.max(1, top / 120)); controls.minDistance = 35; controls.maxDistance = Math.max(450, top * 5); controls.maxPolarAngle = Math.PI*.48; controls.enablePan = true;
  }
  camera.lookAt(controls.target); controls.update();
}
function updateOutline() {
  dispose(regionOutline);
  const b = selection, points = [];
  for (let i=0;i<=48;i++) points.push(spherePoint(b.north, b.west+(b.east-b.west)*i/48, 100.8));
  for (let i=0;i<=48;i++) points.push(spherePoint(b.north-(b.north-b.south)*i/48, b.east, 100.8));
  for (let i=0;i<=48;i++) points.push(spherePoint(b.south, b.east-(b.east-b.west)*i/48, 100.8));
  for (let i=0;i<=48;i++) points.push(spherePoint(b.south+(b.north-b.south)*i/48, b.west, 100.8));
  regionOutline = new THREE.Group();
  regionOutline.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0xdbffb7 })));
  const pin = new THREE.Mesh(new THREE.SphereGeometry(.75, 10, 8), new THREE.MeshBasicMaterial({ color: 0xdbffb7 })); pin.position.copy(spherePoint(b.lat, b.lon, 101)); regionOutline.add(pin); scene.add(regionOutline);
}
function setSelection(bounds, name = 'Custom region') {
  if (building) { requestId++; buildController?.abort(); building = false; notify(''); }
  selection = bounds; selectionName = name; terrainStale = true;
  $('latitude').value = bounds.lat.toFixed(2); $('longitude').value = bounds.lon.toFixed(2); $('extent').value = bounds.span; $('extentValue').textContent = `${bounds.span}°`;
  $('regionName').textContent = name;
  $('bounds').textContent = `${coordinates(bounds.north, bounds.west)} → ${coordinates(bounds.south, bounds.east)}`;
  document.querySelectorAll('[data-preset]').forEach(button => button.classList.toggle('active', presets[button.dataset.preset][3] === name));
  $('render').disabled = !field; $('render').innerHTML = 'Build and view wind <span aria-hidden="true">↗</span>';
  WIND_LAYERS.forEach(layer => $('layer'+layer.height).textContent = '—');
  $('layerNote').textContent = 'Build to load winds at every height. Speeds are sampled at the region center.';
  if (mode !== 'globe') switchMode('globe');
  updateOutline(); updateMetrics(); $('elevationMetric').innerHTML = '— <small>m</small>';
  $('probe').textContent = `${name} · ${coordinates(bounds.lat, bounds.lon)}`;
}
function updateMetrics() {
  const b = selection;
  $('area').innerHTML = `${Math.round(b.span * 111.195 * Math.cos(b.lat * radians))} × ${Math.round(b.span * .7 * 111.195)} <small>km</small>`;
  const wind = mode === 'terrain' ? sampleRegionalWind(b.lat, b.lon, 10) : field?.sample(b.lat, b.lon);
  $('metric2Label').textContent = mode === 'terrain' ? 'CENTER WIND · 10 M AGL' : 'GLOBE WIND · 10 M AGL';
  if (wind) $('windMetric').innerHTML = `${wind.speed.toFixed(1)} <small>m/s</small>`;
}
function switchMode(next) {
  if (next === 'terrain' && (!terrainData || terrainStale)) return;
  mode = next; const isGlobe = mode === 'globe';
  globe.visible = isGlobe; regionOutline.visible = isGlobe; if (terrainGroup) terrainGroup.visible = !isGlobe;
  $('globeTab').hidden = isGlobe;
  $('viewStep').textContent = isGlobe ? '01 / SELECT A REGION' : '02 / WIND IN THREE DIMENSIONS';
  $('viewEyebrow').textContent = isGlobe ? 'THE BIG PICTURE' : 'A CLOSER PERSPECTIVE';
  $('viewTitle').textContent = isGlobe ? 'Earth, in motion.' : `${selectionName}, in relief.`;
  $('sceneHint').textContent = isGlobe ? 'Drag to rotate · Scroll to zoom · Click to select' : 'Drag to orbit · Scroll to zoom · Right-drag to pan';
  canvas.setAttribute('aria-label', isGlobe ? 'Interactive globe. Click to select a region, or use coordinate fields.' : 'Interactive elevation terrain. Drag to orbit, scroll to zoom, right-drag to pan.');
  document.querySelector('.compass').hidden = !isGlobe;
  $('probe').textContent = isGlobe ? `${selectionName} · ${coordinates(selection.lat, selection.lon)}` : 'Move over terrain to inspect elevation & wind';
  setupWind(); resetCamera(); updateDataLabels(); updateMetrics();
  if (!isGlobe && matchMedia('(max-width:700px)').matches) $('viewport').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function visibleHeights() {
  return [...document.querySelectorAll('[data-height]:checked')].map(input => Number(input.dataset.height));
}
function groundAt(lat, lon) {
  const d = terrainData;
  return sampleGrid(d.heights, N, (lon-d.b.west)/d.b.span, (d.b.north-lat)/(d.b.north-d.b.south));
}
function sampleRegionalWind(lat, lon, height) {
  return terrainData.atmosphere.sample(lat, lon, height, groundAt(lat, lon));
}
function forecastLabel() { return `${terrainData.atmosphere.time.replace('T', ' ')} UTC`; }
function updateDataLabels() {
  const regional = mode === 'terrain';
  $('dataBadge').textContent = regional ? 'GFS FORECAST · WINDS ALOFT' : 'GLOBE · HISTORICAL SURFACE WIND';
  $('dataTime').textContent = regional ? `GFS / OPEN-METEO · ${forecastLabel()}` : 'GLOBE · GFS · 31 JAN 2014 · 03:00 UTC';
  if (!terrainData || terrainStale) return;
  const b = terrainData.b;
  for (const layer of WIND_LAYERS) {
    const wind = sampleRegionalWind(b.lat, b.lon, layer.height);
    $('layer'+layer.height).textContent = wind ? `${wind.speed.toFixed(1)} m/s` : 'No data';
  }
  $('layerNote').textContent = `Center wind speeds · ${forecastLabel()}. Uncheck heights to isolate a layer.`;
}
async function loadAtmosphere(bounds, signal) {
  const key = `${bounds.lat}/${bounds.lon}/${bounds.span}/${Math.floor(Date.now()/3600000)}`;
  if (atmosphereCache.has(key)) return atmosphereCache.get(key);
  const response = await fetch(profileRequest(bounds), { signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]) });
  if (!response.ok) throw Error(`Wind forecast unavailable (${response.status})`);
  const atmosphere = makeAtmosphere(await response.json(), bounds);
  atmosphereCache.set(key, atmosphere);
  if (atmosphereCache.size > 6) atmosphereCache.delete(atmosphereCache.keys().next().value);
  return atmosphere;
}

async function loadTile(tile) {
  const key = `${tile.zoom}/${tile.wrappedX}/${tile.y}`;
  if (tiles.has(key)) return tiles.get(key);
  const promise = (async () => {
    // The default Alps region is bundled; other areas use the public DEM endpoint.
    const bundled = tile.zoom === 6 && tile.wrappedX >= 33 && tile.wrappedX <= 34 && tile.y >= 22 && tile.y <= 23;
    const url = bundled ? `./data/terrain/${tile.zoom}-${tile.wrappedX}-${tile.y}.png` : `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${key}.png`;
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw Error(`Elevation tile unavailable (${response.status})`);
    const bitmap = await createImageBitmap(await response.blob(), { colorSpaceConversion: 'none' });
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const context = c.getContext('2d', { willReadFrequently: true }); context.drawImage(bitmap, 0, 0); bitmap.close();
    const rgba = context.getImageData(0, 0, 256, 256).data;
    const heights = new Float32Array(256*256);
    for (let i=0;i<heights.length;i++) heights[i] = decodeTerrarium(rgba[i*4], rgba[i*4+1], rgba[i*4+2]);
    return heights;
  })();
  tiles.set(key, promise);
  try { const value = await promise; if (tiles.size > 96) tiles.delete(tiles.keys().next().value); return value; }
  catch (error) { tiles.delete(key); throw error; }
}
async function buildTerrain() {
  if (!field || building || !$('coordinates').reportValidity()) return;
  const lat = Number($('latitude').value), lon = Number($('longitude').value);
  if (Math.abs(lat-selection.lat) > .006 || Math.abs(lon-selection.lon) > .006) setSelection(boundsFor(lat, lon, Number($('extent').value)));
  const id = ++requestId, b = { ...selection }, name = selectionName;
  building = true; buildController = new AbortController();
  $('render').disabled = true; $('render').textContent = 'Building wind view…';
  notify('Loading terrain and winds at eight atmospheric levels…');
  try {
    const plan = tilePlan(b), loaded = new Map(); let completed = 0;
    const [, atmosphere] = await Promise.all([Promise.all(plan.tiles.map(async tile => {
      const heights = await loadTile(tile); loaded.set(`${tile.x}/${tile.y}`, heights); completed++;
      if (id === requestId && building) notify(`Elevation ${completed} / ${plan.tiles.length} · Loading atmospheric winds…`);
    })), loadAtmosphere(b, buildController.signal)]);
    if (id !== requestId) return;
    const heights = new Float32Array(N*N); let maxHeight = 0;
    // Decode before bilinear interpolation: interpolating encoded RGB creates false cliffs.
    const pixel = (x, y) => {
      const tx = Math.floor(x/256), ty = Math.floor(y/256), data = loaded.get(`${tx}/${ty}`);
      if (!data) { const nearestX = clamp(tx, Math.floor(tileXY(b.north,b.west,plan.zoom)[0]), Math.floor(tileXY(b.south,b.east,plan.zoom)[0])); const nearestY = clamp(ty, Math.floor(tileXY(b.north,b.west,plan.zoom)[1]), Math.floor(tileXY(b.south,b.east,plan.zoom)[1])); const edge = loaded.get(`${nearestX}/${nearestY}`); return edge[clamp(y-nearestY*256,0,255)*256+clamp(x-nearestX*256,0,255)]; }
      return data[wrap(y,256)*256+wrap(x,256)];
    };
    for (let row=0;row<N;row++) for (let col=0;col<N;col++) {
      const lat = b.north-(b.north-b.south)*row/(N-1), lon = b.west+(b.east-b.west)*col/(N-1);
      const [tx,ty] = tileXY(lat,lon,plan.zoom), px=tx*256, py=ty*256, x=Math.floor(px), y=Math.floor(py), fx=px-x, fy=py-y;
      const h = Math.max(0, (pixel(x,y)*(1-fx)+pixel(x+1,y)*fx)*(1-fy)+(pixel(x,y+1)*(1-fx)+pixel(x+1,y+1)*fx)*fy);
      heights[row*N+col] = h; maxHeight = Math.max(maxHeight,h);
    }
    const widthKm = b.span * 111.195 * Math.cos(b.lat*radians), depthKm = b.span*.7*111.195;
    const scale = 160 / Math.max(widthKm,depthKm);
    terrainData = { b, heights, width: widthKm*scale, depth: depthKm*scale, vertical: scale/1000, maxHeight, name, atmosphere };
    terrainStale = false; rebuildMesh(); resetTerrainParticles();
    $('elevationMetric').innerHTML = `${Math.round(maxHeight).toLocaleString()} <small>m</small>`;
    switchMode('terrain'); notify('');
  } catch (error) {
    if (id === requestId) notify('Could not load terrain or upper-air wind data. Check your connection and choose Build and view wind to retry. Upper layers require the forecast service; surface winds are not used as a substitute.');
    if (error.name !== 'AbortError') console.error(error);
  } finally {
    if (id === requestId) { building = false; $('render').disabled = false; $('render').innerHTML = 'Build and view wind <span aria-hidden="true">↗</span>'; }
  }
}
function elevationColor(h) {
  const stops = [[0, '#294b4e'],[300,'#416b58'],[1200,'#78906b'],[2300,'#a6ac8c'],[3500,'#c4c7b4'],[5000,'#eef0e4']];
  let index = stops.findIndex(([height]) => height > h); if (index < 0) return new THREE.Color(stops.at(-1)[1]); if (index === 0) index=1;
  const [a, ca]=stops[index-1], [b, cb]=stops[index]; return new THREE.Color(ca).lerp(new THREE.Color(cb), clamp((h-a)/(b-a),0,1));
}
function terrainPoint(lat, lon, aboveGround = 10) {
  const d = terrainData, b = d.b, x=(lon-b.west)/b.span, y=(b.north-lat)/(b.north-b.south);
  const h = sampleGrid(d.heights,N,x,y);
  return new THREE.Vector3((x-.5)*d.width,(h+aboveGround)*d.vertical*Number($('exaggeration').value)+.4,(y-.5)*d.depth);
}
function labelSprite(text, position) {
  const c=document.createElement('canvas'); c.width=256;c.height=64; const ctx=c.getContext('2d'); ctx.font='24px sans-serif';ctx.textAlign='center';ctx.fillStyle='#abc2bd';ctx.fillText(text,128,40);
  const map=new THREE.CanvasTexture(c), material=new THREE.SpriteMaterial({map,transparent:true,depthTest:false}); const sprite=new THREE.Sprite(material);sprite.scale.set(29,7,1);sprite.position.copy(position); sprite.userData.labelTexture=map; return sprite;
}
function rebuildMesh() {
  if (!terrainData) return;
  terrainGroup?.traverse(o=>o.userData.labelTexture?.dispose()); dispose(terrainGroup); terrainGroup=new THREE.Group();scene.add(terrainGroup);terrainGroup.visible=mode==='terrain';
  const d=terrainData, ex=Number($('exaggeration').value);
  const geometry=new THREE.PlaneGeometry(d.width,d.depth,N-1,N-1);geometry.rotateX(-Math.PI/2);
  const positions=geometry.attributes.position, colors=new Float32Array(N*N*3);
  for(let i=0;i<N*N;i++){positions.setY(i,d.heights[i]*d.vertical*ex);elevationColor(d.heights[i]).toArray(colors,i*3);}
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.computeVertexNormals();
  terrain=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,side:THREE.DoubleSide,wireframe:$('meshToggle').checked}));terrainGroup.add(terrain);
  // Close all four edges down to the section's base to make the elevation slice legible.
  const edge=[];for(let i=0;i<N;i++)edge.push(i);for(let i=1;i<N;i++)edge.push(i*N+N-1);for(let i=N-2;i>=0;i--)edge.push((N-1)*N+i);for(let i=N-2;i>=0;i--)edge.push(i*N);
  const wall=[];for(let i=0;i<edge.length-1;i++){const a=edge[i],b=edge[i+1];const ax=positions.getX(a),ay=positions.getY(a),az=positions.getZ(a),bx=positions.getX(b),by=positions.getY(b),bz=positions.getZ(b);wall.push(ax,ay,az,ax,-3,az,bx,by,bz,bx,by,bz,ax,-3,az,bx,-3,bz);}
  const wallGeometry=new THREE.BufferGeometry();wallGeometry.setAttribute('position',new THREE.Float32BufferAttribute(wall,3));wallGeometry.computeVertexNormals();terrainGroup.add(new THREE.Mesh(wallGeometry,new THREE.MeshStandardMaterial({color:0x243e3d,side:THREE.DoubleSide,roughness:1})));
  const grid=new THREE.GridHelper(230,23,0x385452,0x213638);grid.position.y=-3.2;terrainGroup.add(grid);
  terrainGroup.add(labelSprite('Y / NORTH',new THREE.Vector3(0,-2,-d.depth/2-9)),labelSprite('X / EAST',new THREE.Vector3(d.width/2+12,-2,0)));
  const zTop=Math.max(18,d.maxHeight*d.vertical*ex);const axis=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-d.width/2-7,-3,d.depth/2),new THREE.Vector3(-d.width/2-7,zTop,d.depth/2)]),new THREE.LineBasicMaterial({color:0x9cbd91}));terrainGroup.add(axis);terrainGroup.add(labelSprite('Z / ELEVATION',new THREE.Vector3(-d.width/2-7,zTop+5,d.depth/2)));
  addLayerGuides();
  terrainParticles.forEach(p=>p.history=[]);
}
function addLayerGuides() {
  const d = terrainData, b = d.b;
  for (const layer of WIND_LAYERS.filter(layer => visibleHeights().includes(layer.height))) {
    const points = [];
    for (let i=0;i<=40;i++) points.push(terrainPoint(b.north,b.west+b.span*i/40,layer.height));
    for (let i=0;i<=40;i++) points.push(terrainPoint(b.north-(b.north-b.south)*i/40,b.east,layer.height));
    for (let i=0;i<=40;i++) points.push(terrainPoint(b.south,b.east-b.span*i/40,layer.height));
    for (let i=0;i<=40;i++) points.push(terrainPoint(b.south+(b.north-b.south)*i/40,b.west,layer.height));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: layer.color, transparent: true, opacity: .38, depthWrite: false }));
    terrainGroup.add(line);
  }
  const highest = Math.max(0,...visibleHeights());
  if (highest) {
    const point = terrainPoint(b.south,b.east,highest);
    point.x += 16;
    terrainGroup.add(labelSprite(`+${highest.toLocaleString()} m AGL`, point));
  }
}
function resetTerrainParticles() {
  const heights = visibleHeights();
  terrainParticles = heights.length ? Array.from({length:terrainCount}, (_, i) => newParticle(true, heights[i % heights.length])) : [];
}
function newParticle(regional, height = 10) {
  const b=terrainData?.b || selection;
  return {lat:regional?b.south+Math.random()*(b.north-b.south):Math.asin(Math.random()*2-1)/radians,lon:regional?b.west+Math.random()*b.span:Math.random()*360-180,age:Math.random()*140,history:[],height};
}
function setupWind() {
  dispose(windLines); if (!field) return;
  const count=mode==='globe'?globeParticles.length:terrainParticles.length, geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*(trailLength-1)*6),3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('color',new THREE.BufferAttribute(new Float32Array(count*(trailLength-1)*6),3).setUsage(THREE.DynamicDrawUsage));
  windLines=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.85,depthWrite:false}));windLines.frustumCulled=false;windLines.visible=$('windToggle').checked;scene.add(windLines);
  (mode==='globe'?globeParticles:terrainParticles).forEach(p=>p.history=[]);
  // Prime visible trails even when reduced-motion preference starts the view paused.
  for (let i=0;i<trailLength;i++) updateWind(1/60);
}
function updateWind(dt) {
  if (!windLines || !field) return;
  const regional=mode==='terrain', particles=regional?terrainParticles:globeParticles;
  const positions=windLines.geometry.attributes.position, colors=windLines.geometry.attributes.color;
  const seconds=dt*Number($('speed').value)*(regional?18000:90000);let vertex=0;
  for(let i=0;i<particles.length;i++) {
    let p=particles[i];const b=terrainData?.b;
    if(p.age>160 || Math.abs(p.lat)>85 || (regional && (p.lat<b.south||p.lat>b.north||p.lon<b.west||p.lon>b.east))) p=particles[i]=newParticle(regional,p.height);
    const wind=regional?sampleRegionalWind(p.lat,p.lon,p.height):field.sample(p.lat,p.lon);
    if (!wind) {
      p.age = 161; p.history = [];
      for (let t=0;t<(trailLength-1)*2;t++) { positions.setXYZ(vertex,0,0,0); colors.setXYZ(vertex++,0,0,0); }
      continue;
    }
    p.age+=dt*24;
    p.lon+=wind.u*seconds/(111195*Math.max(.08,Math.cos(p.lat*radians)));p.lat+=wind.v*seconds/111195;
    if(!regional)p.lon=longitude(p.lon);
    const point=regional?terrainPoint(p.lat,p.lon,p.height):spherePoint(p.lat,p.lon,100.45);
    p.history.unshift(point);if(p.history.length>trailLength)p.history.pop();
    const c=windColor(wind.speed);
    for(let t=0;t<trailLength-1;t++) {
      const a=p.history[t]||point, next=p.history[t+1]||a, fade=1-t/trailLength;
      positions.setXYZ(vertex,a.x,a.y,a.z);colors.setXYZ(vertex++,c.r*fade,c.g*fade,c.b*fade);
      positions.setXYZ(vertex,next.x,next.y,next.z);colors.setXYZ(vertex++,c.r*fade,c.g*fade,c.b*fade);
    }
  }
  positions.needsUpdate=true;colors.needsUpdate=true;
}
function animate(time) {
  requestAnimationFrame(animate);const dt=Math.min((time-last)/1000,.04);last=time;
  controls.update();if(!paused && !document.hidden && $('windToggle').checked)updateWind(dt);renderer.render(scene,camera);
}

let down;
canvas.addEventListener('pointerdown',event=>{down={x:event.clientX,y:event.clientY};});
canvas.addEventListener('pointerup',event=>{
  if(!down || Math.hypot(event.clientX-down.x,event.clientY-down.y)>5 || mode!=='globe')return;
  cast(event); const hit=raycaster.intersectObject(globe,false)[0];if(!hit)return;
  const p=hit.point.clone().normalize(), lat=Math.asin(p.y)/radians, lon=Math.atan2(-p.z,p.x)/radians;
  setSelection(boundsFor(lat,lon,Number($('extent').value)));
});
function cast(event){const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);}
let lastProbe=0;
canvas.addEventListener('pointermove',event=>{
  if(mode!=='terrain'||!terrain||performance.now()-lastProbe<80)return;lastProbe=performance.now();cast(event);
  const hit=raycaster.intersectObject(terrain,false)[0];if(!hit)return;
  const d=terrainData,x=hit.point.x/d.width+.5,y=hit.point.z/d.depth+.5,lat=d.b.north-y*(d.b.north-d.b.south),lon=d.b.west+x*d.b.span;
  $('probe').textContent=`${coordinates(lat,lon)} · ${Math.round(sampleGrid(d.heights,N,x,y)).toLocaleString()} m · 10 m wind ${sampleRegionalWind(lat,lon,10)?.speed.toFixed(1) ?? '—'} m/s`;
});
document.querySelectorAll('[data-preset]').forEach(button=>button.addEventListener('click',()=>{const [lat,lon,span,name]=presets[button.dataset.preset];setSelection(boundsFor(lat,lon,span),name);resetCamera();}));
$('coordinates').addEventListener('submit',event=>{event.preventDefault();buildTerrain();});
$('extent').addEventListener('input',()=>setSelection(boundsFor(selection.lat,selection.lon,Number($('extent').value)),selectionName));
$('render').addEventListener('click',buildTerrain);
$('globeTab').addEventListener('click',()=>switchMode('globe'));
document.querySelectorAll('[data-height]').forEach(input=>input.addEventListener('change',()=>{
  if (!terrainData || terrainStale) return;
  resetTerrainParticles(); rebuildMesh(); setupWind();
}));
$('exaggeration').addEventListener('input',()=>{$('exaggerationValue').textContent=`${$('exaggeration').value}×`;rebuildMesh();setupWind();if(mode === 'terrain') resetCamera();});
$('speed').addEventListener('input',()=>{$('speedValue').textContent=`${$('speed').value}×`;});
$('windToggle').addEventListener('change',()=>{if(windLines)windLines.visible=$('windToggle').checked;});
$('meshToggle').addEventListener('change',()=>{if(terrain)terrain.material.wireframe=$('meshToggle').checked;});
function pauseUI(){$('pause').textContent=paused?'▶ Play wind':'Ⅱ Pause wind';$('pause').setAttribute('aria-pressed',paused);}
$('pause').addEventListener('click',()=>{paused=!paused;pauseUI();});pauseUI();
$('reset').addEventListener('click',resetCamera);
$('snapshot').addEventListener('click',()=>{
  renderer.render(scene,camera);const out=document.createElement('canvas');out.width=canvas.width;out.height=canvas.height;const ctx=out.getContext('2d');ctx.fillStyle='#0b191e';ctx.fillRect(0,0,out.width,out.height);ctx.drawImage(canvas,0,0);ctx.fillStyle='#c5d8d0';ctx.font=`${Math.max(12,out.width/75)}px sans-serif`;ctx.fillText(`Earth / relief · ${selectionName} · ${mode === 'terrain' ? 'GFS '+forecastLabel()+' · heights '+visibleHeights().join('/')+' m AGL' : 'GFS 2014-01-31 03:00 UTC'} · vertical ${$('exaggeration').value}×`,24,out.height-24);out.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`earth-relief-${mode}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
});
init();
