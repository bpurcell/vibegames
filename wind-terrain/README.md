# Earth / relief

A static WebGL app inspired by [cambecc/earth](https://github.com/cambecc/earth). Select a region on the globe and see forecast winds at multiple heights above real 3D terrain.

## Run

From the repository root:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open http://127.0.0.1:8765/wind-terrain/. No build, package install, API key, or backend is required for this noncommercial experiment. Serve over HTTP rather than opening HTML as a file. The directory deploys unchanged with the repository's existing static hosting.

## Use

1. Rotate the globe and click/tap a region, choose a preset, or enter coordinates. Set the region width.
2. Choose **Build and view wind**, the only primary action. It applies entered coordinates, loads terrain and upper-air winds, and opens the 3D view.
3. Use the height checkboxes to show any combination of **10 m, 500 m, 1,500 m, 3,000 m, and 6,000 m above local ground**. All five are initially visible. Read the center wind speed beside each height. Missing data reads **No data**.
4. Drag to orbit, scroll/pinch to zoom, and right-drag/two-finger drag to pan. Vertical exaggeration scales both terrain and wind-layer heights; animation speed, wireframe, pause, and camera reset are secondary controls.
5. **Change region** returns to the globe. Use the same primary button to build the next view. Changing layer visibility does not refetch forecasts. **Save view** exports an image with its data time and selected heights.

## Wind data

The globe retains Earth's bundled historical NOAA GFS surface sample, valid **2014-01-31 03:00 UTC**, on a 1° global grid. It is explicitly labeled historical and serves as the region picker.

The 3D view uses a **current NOAA GFS Global forecast** from the [Open-Meteo GFS API](https://open-meteo.com/en/docs/gfs-api). One multi-location request samples a 5 × 5 regional grid for the current forecast hour. Requested variables are 10 m surface wind plus wind speed, direction, and geopotential height at **1000, 925, 850, 700, 500, 300, 200, and 100 hPa**. Units and valid times are checked before display. Data is attributed to [Open-Meteo](https://open-meteo.com/) under CC BY 4.0; its public endpoint has usage limits and noncommercial terms.

Meteorological directions are converted to east/north vector components before horizontal or vertical interpolation. Pressure heights are meters above sea level, not heights above ground. For each particle, local DEM elevation plus the selected AGL height determines its target altitude. Reported pressure levels are interpolated horizontally, then vertically around that target altitude, with the interpolated 10 m surface vector anchored above local terrain. Pressure samples below the model terrain or below the displayed terrain are excluded. Missing samples are not treated as zero, and winds are never extrapolated beyond the available vertical range or replaced with historical surface winds.

These are horizontal forecast winds shown on terrain-following height surfaces, **not a simulation of vertical air motion or valley-scale turbulence**. Model terrain differs from the detailed DEM; low-altitude interpolation is an approximation. The regional 5 × 5 sample cannot resolve individual valleys. Advection is accelerated and trails vary with frame rate. The forecast valid time is shown in the sidebar and footer, distinct from the globe sample date.

Forecasts are cached in memory for up to six regions, keyed by bounds and request hour. Changing the selection cancels an active forecast fetch. Requests time out after 30 seconds and show a retry message. A successful build requires upper-air data; it does not silently fall back to surface-only wind. Surface wind, Earth imagery, rendering dependencies, and default Alps terrain are bundled, but upper-air forecasts require an internet connection.

## Terrain and attribution

- Elevation: [Mapzen Terrain Tiles on AWS](https://registry.opendata.aws/terrain-tiles/), using [Terrarium encoding](https://github.com/tilezen/joerd/blob/master/docs/formats.md). Decode RGB to meters before interpolation. The four default Alps tiles are bundled; other regions fetch public DEM tiles. [Full elevation attribution](https://github.com/tilezen/joerd/blob/master/docs/attribution.md).
- Globe imagery: NASA Blue Marble via [WebGL Earth](https://github.com/turban/webgl-earth/blob/master/images/2_no_clouds_4k.jpg).
- Renderer: vendored Three.js 0.170.0 and OrbitControls, MIT notice in `vendor/LICENSE.txt`. Earth's MIT notice is in `data/EARTH-LICENSE.txt`.
- Optional Google Fonts fall back to system fonts.

Terrain uses a 161 × 161 grid in a local equirectangular approximation: X east, Y north, Z elevation (internally Three.js uses Y-up). Horizontal scale uses center latitude. At `1×`, vertical scale matches horizontal scale. Negative DEM heights are clamped to sea level; selections stay within ±84° latitude. Maximum elevation reports the sampled mesh maximum, not a surveyed summit height.

## Validation

```sh
node --check wind-terrain/app.js
node --test wind-terrain/geo.test.mjs wind-terrain/atmosphere.test.mjs
```

Tests cover date-line wrapping, polar bounds, bundled terrain, elevation decoding, grid interpolation, meteorological directions, vertical wind interpolation, distinct altitude samples, below-ground filtering, missing upper-air data, consistent units/timestamps, and the multi-location forecast request.
