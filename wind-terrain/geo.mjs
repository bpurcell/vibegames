export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const wrap = (v, n = 360) => ((v % n) + n) % n;
export const longitude = v => wrap(v + 180) - 180;
export const radians = Math.PI / 180;
export function boundsFor(lat, lon, span) {
  const halfHeight = span * .35;
  lat = clamp(lat, -84 + halfHeight, 84 - halfHeight);
  return { north: lat + halfHeight, south: lat - halfHeight, west: longitude(lon) - span / 2, east: longitude(lon) + span / 2, lat, lon: longitude(lon), span };
}
export function tileXY(lat, lon, zoom) {
  const n = 2 ** zoom, phi = clamp(lat, -85.0511, 85.0511) * radians;
  return [(lon + 180) / 360 * n, (1 - Math.asinh(Math.tan(phi)) / Math.PI) / 2 * n];
}
export function tilePlan(bounds) {
  const zoom = clamp(Math.ceil(Math.log2(360 / bounds.span)), 3, 9);
  const [left, top] = tileXY(bounds.north, bounds.west, zoom);
  const [right, bottom] = tileXY(bounds.south, bounds.east, zoom);
  const tiles = [];
  for (let y = Math.floor(top); y <= Math.floor(bottom); y++)
    for (let x = Math.floor(left); x <= Math.floor(right); x++) tiles.push({ x, y, wrappedX: wrap(x, 2 ** zoom), zoom });
  return { zoom, tiles };
}
export const decodeTerrarium = (r, g, b) => r * 256 + g + b / 256 - 32768;
export function makeWindField(records) {
  const u = records.find(r => r.header.parameterNumber === 2);
  const v = records.find(r => r.header.parameterNumber === 3);
  if (!u || !v || u.data.length !== u.header.nx * u.header.ny || v.data.length !== u.data.length) throw Error('Invalid wind grid');
  const h = u.header;
  return { header: h, sample(lat, lon) {
    const x = wrap(lon - h.lo1) / h.dx, y = clamp((h.la1 - lat) / h.dy, 0, h.ny - 1);
    const x0 = Math.floor(x) % h.nx, x1 = (x0 + 1) % h.nx, y0 = Math.min(Math.floor(y), h.ny - 2), y1 = y0 + 1;
    const fx = x - Math.floor(x), fy = y - y0;
    const interpolate = data => (data[y0*h.nx+x0]*(1-fx)+data[y0*h.nx+x1]*fx)*(1-fy)+(data[y1*h.nx+x0]*(1-fx)+data[y1*h.nx+x1]*fx)*fy;
    const east = interpolate(u.data), north = interpolate(v.data);
    return { u: east, v: north, speed: Math.hypot(east, north) };
  }};
}
export function sampleGrid(grid, n, x, y) {
  x = clamp(x, 0, 1) * (n - 1); y = clamp(y, 0, 1) * (n - 1);
  const ix = Math.min(Math.floor(x), n - 2), iy = Math.min(Math.floor(y), n - 2), fx = x - ix, fy = y - iy;
  return (grid[iy*n+ix]*(1-fx)+grid[iy*n+ix+1]*fx)*(1-fy)+(grid[(iy+1)*n+ix]*(1-fx)+grid[(iy+1)*n+ix+1]*fx)*fy;
}
