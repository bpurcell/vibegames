import test from 'node:test';
import assert from 'node:assert/strict';
import { boundsFor } from './geo.mjs';
import { WIND_LAYERS, PRESSURE_LEVELS, windComponents, interpolateProfile, profileRequest, makeAtmosphere } from './atmosphere.mjs';

const bounds = boundsFor(46,10,6);
function fixture() {
  const heights = [100,800,1500,3000,5500,9000,12000,16000];
  return Array.from({length:4},()=>{
    const hourly = {time:['2026-10-10T22:00'],wind_speed_10m:[2],wind_direction_10m:[0]};
    const hourly_units = {wind_speed_10m:'m/s',wind_direction_10m:'°'};
    PRESSURE_LEVELS.forEach((level,i)=>{
      hourly[`wind_speed_${level}hPa`] = [10+i*3];
      hourly[`wind_direction_${level}hPa`] = [90+i*10];
      hourly[`geopotential_height_${level}hPa`] = [heights[i]];
      hourly_units[`wind_speed_${level}hPa`] = 'm/s';
      hourly_units[`wind_direction_${level}hPa`] = '°';
      hourly_units[`geopotential_height_${level}hPa`] = 'm';
    });
    return {elevation:0,hourly,hourly_units};
  });
}
test('meteorological winds move away from the reported source direction',()=>{
  const north=windComponents(10,0),west=windComponents(10,270);
  assert.equal(north.v,-10);assert.ok(Math.abs(north.u)<1e-10);
  assert.ok(Math.abs(west.u-10)<1e-10);
  assert.equal(windComponents(null,90),null);
});
test('vertical interpolation blends vector components across the direction seam',()=>{
  const a=windComponents(10,359),b=windComponents(10,1);
  const wind=interpolateProfile([{height:100,...a},{height:300,...b}],200);
  assert.ok(Math.abs(wind.u)<1e-10);assert.ok(wind.v < -9.99);
  assert.equal(interpolateProfile([{height:100,...a},{height:300,...b}],400),null);
});
test('all five AGL layers use distinct vertical samples above local terrain',()=>{
  const field=makeAtmosphere(fixture(),bounds,2);
  const speeds=WIND_LAYERS.map(layer=>field.sample(46,10,layer.height,200).speed);
  assert.equal(speeds[0],2);assert.equal(new Set(speeds.map(n=>n.toFixed(3))).size,5);
  const wind=field.sample(46,10,2800,200); // 200 m ground + 2800 m AGL = 700 hPa at 3000 m.
  assert.ok(Math.abs(wind.speed-19)<1e-10);
});
test('pressure levels below model ground cannot supply displayed winds',()=>{
  const data=fixture();data.forEach(node=>{node.elevation=2000;node.hourly.wind_speed_850hPa=[999];});
  const field=makeAtmosphere(data,bounds,2);
  assert.ok(field.sample(46,10,1500,0).speed<20);
});
test('no upper data is never replaced by surface wind or zero values',()=>{
  const data=fixture();data.forEach(node=>{
    for(const level of [300,200,100])node.hourly[`wind_speed_${level}hPa`]=[null];
  });
  const field=makeAtmosphere(data,bounds,2);
  assert.equal(field.sample(46,10,6000,200),null);
  assert.equal(field.sample(46,10,10,200).speed,2);
});
test('forecasts must use consistent timestamps and physical units',()=>{
  let data=fixture();data[1].hourly.time=['2026-10-10T23:00'];
  assert.throws(()=>makeAtmosphere(data,bounds,2),/Inconsistent/);
  data=fixture();data[0].hourly_units.wind_speed_850hPa='km/h';
  assert.throws(()=>makeAtmosphere(data,bounds,2),/units/);
  assert.throws(()=>makeAtmosphere([],bounds,2),/Incomplete/);
});
test('request covers the entire region, wraps the dateline, and requests real level heights',()=>{
  const url=new URL(profileRequest(boundsFor(10,179,6)));
  const lat=url.searchParams.get('latitude').split(',').map(Number);
  const lon=url.searchParams.get('longitude').split(',').map(Number);
  assert.equal(lat.length,25);assert.equal(lon.length,25);
  assert.ok(lon.every(n=>n>=-180&&n<=180));assert.ok(lon.some(n=>n<0));
  assert.equal(url.searchParams.get('wind_speed_unit'),'ms');
  assert.equal(url.searchParams.get('forecast_hours'),'1');
  for(const level of PRESSURE_LEVELS)assert.ok(url.searchParams.get('hourly').includes(`geopotential_height_${level}hPa`));
});
