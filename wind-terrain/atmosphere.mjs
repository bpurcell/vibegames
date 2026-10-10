import { clamp, longitude, radians } from './geo.mjs';

export const WIND_LAYERS = [
  { height: 10, label: '10 m', color: '#96cbe5' },
  { height: 500, label: '500 m', color: '#6bddd3' },
  { height: 1500, label: '1,500 m', color: '#bbed9c' },
  { height: 3000, label: '3,000 m', color: '#f0d182' },
  { height: 6000, label: '6,000 m', color: '#ee9e85' },
];
export const PRESSURE_LEVELS = [1000, 925, 850, 700, 500, 300, 200, 100];
export const PROFILE_SIZE = 5;

// Meteorological direction is where wind comes FROM. Interpolate components,
// never direction angles, so north winds at 359° and 1° average correctly.
export function windComponents(speed, direction) {
  if (!Number.isFinite(speed) || speed < 0 || !Number.isFinite(direction)) return null;
  return { u: -speed * Math.sin(direction * radians), v: -speed * Math.cos(direction * radians) };
}
export function interpolateProfile(profile, altitude) {
  for (let i = 0; i < profile.length; i++) {
    const lower = profile[i];
    if (Math.abs(altitude - lower.height) < 1e-6) return { u: lower.u, v: lower.v, speed: Math.hypot(lower.u, lower.v) };
    const upper = profile[i + 1];
    if (!upper || altitude < lower.height || altitude > upper.height) continue;
    const t = (altitude - lower.height) / (upper.height - lower.height);
    const u = lower.u + t * (upper.u - lower.u), v = lower.v + t * (upper.v - lower.v);
    return { u, v, speed: Math.hypot(u, v) };
  }
  return null; // Never extrapolate beyond available atmospheric data.
}
export function profileRequest(bounds, size = PROFILE_SIZE) {
  const latitude = [], lon = [];
  for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
    latitude.push((bounds.north - row / (size - 1) * (bounds.north - bounds.south)).toFixed(5));
    lon.push(longitude(bounds.west + col / (size - 1) * bounds.span).toFixed(5));
  }
  const hourly = ['wind_speed_10m', 'wind_direction_10m', ...PRESSURE_LEVELS.flatMap(level => [
    `wind_speed_${level}hPa`, `wind_direction_${level}hPa`, `geopotential_height_${level}hPa`,
  ])];
  const params = new URLSearchParams({ latitude: latitude.join(','), longitude: lon.join(','),
    hourly: hourly.join(','), models: 'gfs_global', wind_speed_unit: 'ms', forecast_hours: '1',
    timezone: 'GMT', cell_selection: 'nearest' });
  return `https://api.open-meteo.com/v1/gfs?${params}`;
}
export function makeAtmosphere(responses, bounds, size = PROFILE_SIZE) {
  if (!Array.isArray(responses) || responses.length !== size * size) throw Error('Incomplete atmospheric grid');
  const time = responses[0]?.hourly?.time?.[0];
  if (!time || !Number.isFinite(Date.parse(`${time}Z`))) throw Error('Missing forecast timestamp');
  const nodes = responses.map(response => {
    if (response.hourly?.time?.[0] !== time || !Number.isFinite(response.elevation)) throw Error('Inconsistent forecast grid');
    const h = response.hourly, units = response.hourly_units;
    const wind = suffix => {
      if (units?.[`wind_speed_${suffix}`] !== 'm/s' || units?.[`wind_direction_${suffix}`] !== '°') throw Error('Unexpected wind units');
      return windComponents(h[`wind_speed_${suffix}`]?.[0], h[`wind_direction_${suffix}`]?.[0]);
    };
    const surface = wind('10m');
    if (!surface) throw Error('Missing surface wind');
    const levels = PRESSURE_LEVELS.map(level => {
      const height = h[`geopotential_height_${level}hPa`]?.[0], vector = wind(`${level}hPa`);
      if (units?.[`geopotential_height_${level}hPa`] !== 'm') throw Error('Unexpected height units');
      // Below-model-ground pressure winds are extrapolated, not atmospheric samples.
      return vector && Number.isFinite(height) && height > response.elevation + 10 ? { height, ...vector } : null;
    });
    if (!levels.some(Boolean)) throw Error('No above-ground pressure levels');
    return { surface, levels, ground: response.elevation };
  });
  return { time, bounds, size, sample(lat, lon, aboveGround, groundHeight) {
    const x = clamp((lon - bounds.west) / bounds.span, 0, 1) * (size - 1);
    const y = clamp((bounds.north - lat) / (bounds.north - bounds.south), 0, 1) * (size - 1);
    const ix = Math.min(Math.floor(x), size - 2), iy = Math.min(Math.floor(y), size - 2);
    const fx = x - ix, fy = y - iy;
    const nearby = [nodes[iy*size+ix], nodes[iy*size+ix+1], nodes[(iy+1)*size+ix], nodes[(iy+1)*size+ix+1]];
    const weights = [(1-fx)*(1-fy), fx*(1-fy), (1-fx)*fy, fx*fy];
    const blend = getter => {
      let value = 0;
      for (let i=0; i<4; i++) {
        if (weights[i] < 1e-10) continue;
        const next = getter(nearby[i]);
        if (!Number.isFinite(next)) return null;
        value += next * weights[i];
      }
      return value;
    };
    const profile = [{ height: groundHeight + 10, u: blend(n=>n.surface.u), v: blend(n=>n.surface.v) }];
    for (let level=0; level<PRESSURE_LEVELS.length; level++) {
      const height = blend(n=>n.levels[level]?.height);
      if (height === null || height <= groundHeight + 10) continue;
      const u = blend(n=>n.levels[level]?.u), v = blend(n=>n.levels[level]?.v);
      if (u !== null && v !== null) profile.push({ height, u, v });
    }
    profile.sort((a,b)=>a.height-b.height);
    return interpolateProfile(profile, groundHeight + aboveGround);
  }};
}
