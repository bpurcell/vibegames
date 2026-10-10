# Earth / relief

A static WebGL app inspired by [cambecc/earth](https://github.com/cambecc/earth). Select a region on a rotating wind globe and render it as an elevation mesh with animated wind vectors.

## Run

From the repository root:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open http://127.0.0.1:8765/wind-terrain/. No build, API key, package install, or backend is required. Serve over HTTP rather than opening the HTML as a file. The directory can be deployed unchanged with the repository's existing static hosting.

## Use

1. Drag the globe to rotate, scroll/pinch to zoom, and click/tap to center a selected region. Preset regions and latitude/longitude fields provide alternatives.
2. Set the selection width, then choose **Build 3D landscape**.
3. Drag to orbit the terrain, scroll/pinch to zoom, and right-drag/two-finger drag to pan. **Reset camera** restores the initial view.
4. Adjust elevation exaggeration, animation speed, wireframe, or wind visibility. Hover over terrain for elevation and wind speed. **Save view** downloads the canvas as a PNG with its data date.
5. Return to **Globe** to choose another region. Changing the selection invalidates the previous terrain until rebuilt.

## Data and interpretation

- **Wind:** bundled NOAA GFS sample from cambecc/earth; reference time 2014-01-31 00:00 UTC, forecast +3 hours, valid **2014-01-31 03:00 UTC**. This is historical data, not a current forecast. Eastward and northward wind components are bilinearly interpolated from a 1° global grid at 10 m above ground. Longitude interpolation wraps around the date line.
- **Elevation:** [Mapzen Terrain Tiles on AWS](https://registry.opendata.aws/terrain-tiles/), using the [Terrarium format](https://github.com/tilezen/joerd/blob/master/docs/formats.md). RGB is decoded into meters before interpolation. The default Alps region's four tiles are included locally. All other regions fetch public tiles directly with a timeout and explicit retry messaging. [Full elevation-source attribution](https://github.com/tilezen/joerd/blob/master/docs/attribution.md) includes USGS, SRTM, GMTED, ETOPO, and other regional contributors.
- **Globe imagery:** NASA Blue Marble, downloaded from [WebGL Earth](https://github.com/turban/webgl-earth/blob/master/images/2_no_clouds_4k.jpg).
- **Renderer:** vendored Three.js 0.170.0 and OrbitControls; MIT license at `vendor/LICENSE.txt`. Earth's MIT notice is included at `data/EARTH-LICENSE.txt`. Application code is a new implementation; the bundled wind sample comes from Earth.
- Optional Google Fonts fall back to system sans-serif if unavailable. Rendering dependencies, imagery, wind, and default Alps elevation are local.

The terrain is a 161 × 161 sampled grid in a local equirectangular approximation: X east, Y north, Z elevation. Internally Three.js uses its conventional Y-up scene coordinates. Horizontal distances use center-latitude scaling. Elevation exaggeration is a real multiplier of the vertical-to-horizontal scale; `1×` preserves that scale. Negative DEM heights are clamped to sea level. Latitude selection stays within ±84°.

Particles follow the horizontal wind field and are lifted to the sampled terrain surface for display. They **do not represent vertical wind measurements, airflow simulation, or terrain-resolved forecasts**. Low-resolution GFS winds cannot resolve individual valleys. Animation is accelerated and trail length varies with frame rate. Displayed maximum elevation is the maximum of the sampled mesh, not a surveyed peak height.

## Validation

```sh
node --check wind-terrain/app.js
node --test wind-terrain/geo.test.mjs
```

Tests cover date-line tile wrapping, polar bounds, the bundled Alps tile set, Terrarium decoding, elevation interpolation, GFS grid interpolation, and Mercator coordinates. Browser checks cover the default Alps, remote Himalayas, custom globe selection, and view controls.
