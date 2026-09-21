/* =====================================================================
   Wildfire Scale — a real fire's burned area, drawn over your own map.

   The arithmetic is one line: a burned area becomes the circle of the
   same area, r = sqrt(A / pi), handed to Leaflet in metres so it stays
   true as you zoom and as you move north or south.

   The circle is a deliberate simplification and the UI says so more than
   once. A wildfire is not a blob: it runs downwind into long fingers,
   stops dead at a river and jumps a six-lane freeway somewhere else. The
   Tubbs Fire covered 36,807 acres but the part that mattered was twelve
   miles of running in three hours. Area is what this app can honestly
   show; shape is what it cannot.

   Circles are coloured by size on a yellow-to-deep-red ramp, and drawn
   smallest last so a two-thousand-acre fire is not buried under a
   million-acre one.
   ===================================================================== */
(function () {
  "use strict";

  var FIRES = (window.FIRES || []).slice().sort(function (a, b) { return a.acres - b.acres; });
  var ACRE = window.ACRE_KM2, YARD = window.YARDSTICKS;

  var DEFAULT = { lat: 39.83, lon: -98.58 };     // geographic centre of the US

  var map, pin, ring = {}, selected = {};
  var here = { lat: DEFAULT.lat, lon: DEFAULT.lon, known: false };

  var elList = document.getElementById("list");
  var elCoords = document.getElementById("coords");
  var elHint = document.getElementById("mapHint");
  var elWarn = document.getElementById("tileWarn");
  var elSheetCount = document.getElementById("sheetCount");

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) { /* private browsing */ }
    return null;
  }

  /* -------------------------------------------------------- numbers */

  function km2(f) { return f.acres * ACRE; }
  function radiusM(f) { return Math.sqrt(km2(f) * 1e6 / Math.PI); }

  function commas(n) { return Math.round(n).toLocaleString("en-US"); }

  function fmtArea(f) {
    var k = km2(f), mi2 = k * 0.386102;
    return commas(f.acres) + " acres · " + commas(k) + " km² (" + commas(mi2) + " sq mi)";
  }
  function shortArea(f) {
    if (f.acres >= 1e6) return (f.acres / 1e6).toFixed(f.acres < 1e7 ? 2 : 0) + "M ac";
    if (f.acres >= 1000) return commas(f.acres / 1000) + "k ac";
    return commas(f.acres) + " ac";
  }
  function fmtLen(m) {
    if (m < 1000) return commas(m) + " m";
    return (m / 1000).toFixed(1) + " km (" + (m / 1609.34).toFixed(1) + " mi)";
  }
  // A distance nobody can picture becomes one everybody can.
  function driveAcross(m) {
    var mins = (m * 2 / 1609.34) / 60 * 60;       // at 60 mph
    if (mins < 60) return Math.round(mins) + " min drive across";
    return (mins / 60).toFixed(1) + " hour drive across";
  }

  // The largest familiar area that fits inside this fire — except that a
  // big multiple of a small thing is a bad picture. "17x Central Park"
  // means nothing; "just under Manhattan" is the same fact, seen.
  function yardstick(f) {
    var k = km2(f), fit = -1;
    for (var i = YARD.length - 1; i >= 0; i--) {
      if (YARD[i].km2 <= k) { fit = i; break; }
    }
    if (fit < 0) return (k / YARD[0].km2).toFixed(2) + "× the area of " + YARD[0].name;

    var n = k / YARD[fit].km2;
    var up = fit + 1 < YARD.length ? k / YARD[fit + 1].km2 : 0;
    // A near-miss on the next size up beats any multiple of the one below:
    // the Chinchaga fire is 99% of Connecticut, not "2.2x Delaware".
    if (up >= 0.92 || (n >= 4 && up >= 0.75)) {
      return "just under the area of " + YARD[fit + 1].name;
    }
    return n < 1.15 ? "about the area of " + YARD[fit].name
                    : (n < 10 ? n.toFixed(1) : commas(n)) + "× the area of " + YARD[fit].name;
  }

  // Yellow through orange to deep red, by size. Colour carries the same
  // information as the radius, which helps when circles are nested.
  function colorFor(f) {
    var t = Math.min(1, Math.log10(f.acres / 2000) / Math.log10(30000));
    var stops = [[255, 214, 92], [255, 158, 46], [232, 93, 38], [168, 34, 34], [92, 16, 28]];
    var x = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x)), u = x - i;
    var c = stops[i].map(function (v, j) { return Math.round(v + (stops[i + 1][j] - v) * u); });
    return "rgb(" + c.join(",") + ")";
  }

  /* ------------------------------------------------------------- map */

  function initMap() {
    map = L.map("map", { zoomControl: true, worldCopyJump: true })
           .setView([here.lat, here.lon], 11);

    var tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });
    var misses = 0;
    tiles.on("tileerror", function () { if (++misses >= 3) elWarn.hidden = false; });
    tiles.on("tileload", function () { elWarn.hidden = true; misses = 0; });
    tiles.addTo(map);

    L.control.scale({ imperial: true, metric: true }).addTo(map);

    pin = L.marker([here.lat, here.lon], { draggable: true }).addTo(map);
    pin.bindTooltip("Your spot", { direction: "top", offset: [0, -34] });
    pin.on("dragend", function () {
      var p = pin.getLatLng(); setHere(p.lat, p.lng, true);
    });
    map.on("click", function (e) { setHere(e.latlng.lat, e.latlng.lng, true); });
    map.on("movestart", function () { elHint.hidden = true; });
    map.on("zoomend moveend", relabel);
  }

  function setHere(lat, lon, known) {
    here.lat = lat; here.lon = lon;
    if (known) here.known = true;
    pin.setLatLng([lat, lon]);
    elCoords.textContent = lat.toFixed(4) + ", " + lon.toFixed(4) +
      (here.known ? "" : " · guessed — tap the map to fix it");
    store("firescale.at", lat.toFixed(5) + "," + lon.toFixed(5));
    Object.keys(ring).forEach(function (id) {
      ring[id].layer.setLatLng([lat, lon]);
      ring[id].label.setLatLng(northOf(lat, lon, ring[id].r));
    });
    relabel();
    render();
  }

  /* --------------------------------------------------------- circles */

  function northOf(lat, lon, metres) { return [lat + metres / 111320, lon]; }

  function addRing(f) {
    var c = colorFor(f), r = radiusM(f);
    var layer = L.circle([here.lat, here.lon], {
      radius: r, color: c, weight: 2.5, opacity: 0.95,
      fillColor: c, fillOpacity: 0.09,
      dashArray: f.kind === "season" ? "8 6" : null   // a season is not one fire
    }).addTo(map);
    var label = L.tooltip({ permanent: true, direction: "top", className: "fire-label", offset: [0, -2] })
      .setLatLng(northOf(here.lat, here.lon, r))
      .setContent(f.name + " · " + f.year)
      .addTo(map);
    ring[f.id] = { layer: layer, label: label, r: r };
    restack(); relabel();
  }

  function dropRing(f) {
    var e = ring[f.id];
    if (!e) return;
    map.removeLayer(e.layer); map.removeLayer(e.label);
    delete ring[f.id];
  }

  function restack() {
    Object.keys(ring).sort(function (a, b) { return ring[b].r - ring[a].r; })
      .forEach(function (id) { ring[id].layer.bringToFront(); });
  }

  // Don't label a circle too small to see; the labels come back on zoom.
  function relabel() {
    Object.keys(ring).forEach(function (id) {
      var e = ring[id], b = e.layer.getBounds();
      var nw = map.latLngToLayerPoint(b.getNorthWest());
      var se = map.latLngToLayerPoint(b.getSouthEast());
      e.label.setOpacity((se.x - nw.x) / 2 >= 22 ? 1 : 0);
    });
  }

  function fit() {
    var ids = Object.keys(ring);
    if (!ids.length) { map.setView([here.lat, here.lon], 12); return; }
    var b = ring[ids[0]].layer.getBounds();
    ids.forEach(function (id) { b.extend(ring[id].layer.getBounds()); });
    map.fitBounds(b.pad(0.12), { maxZoom: 15 });
    relabel();
  }

  /* ------------------------------------------------------------ list */

  function toggle(f) {
    if (selected[f.id]) { delete selected[f.id]; dropRing(f); }
    else { selected[f.id] = true; addRing(f); }
    store("firescale.picked", Object.keys(selected).join(","));
    render();
    if (Object.keys(selected).length) fit();
  }

  function render() {
    var n = Object.keys(selected).length;
    elSheetCount.textContent = n ? n + " shown" : "none shown";
    document.getElementById("countNote").textContent = FIRES.length + " fires";

    elList.innerHTML = "";
    FIRES.forEach(function (f) {
      var on = !!selected[f.id];
      var b = document.createElement("button");
      b.type = "button";
      b.className = "fire" + (on ? " on" : "");
      b.style.borderLeftColor = on ? colorFor(f) : "transparent";
      b.setAttribute("aria-pressed", String(on));

      var toll = [];
      if (f.deaths) toll.push(f.deaths + (f.deaths === 1 ? " death" : " deaths"));
      if (f.structures) toll.push(commas(f.structures) + " buildings");

      b.innerHTML =
        '<div class="top"><span><span class="nm">' + f.name + '</span> ' +
        '<span class="yr">' + f.year + '</span><br>' +
        '<span class="wh">' + f.where + '</span>' +
        (f.kind === "season" ? '<br><span class="season">a whole season</span>' : "") +
        (toll.length ? '<br><span class="toll">' + toll.join(" · ") + "</span>" : "") +
        '</span><span class="ac">' + shortArea(f) + "</span></div>";

      if (on) {
        var r = radiusM(f);
        var d = document.createElement("div");
        d.className = "detail";
        d.innerHTML = "<dl>" +
          "<dt>Burned</dt><dd>" + fmtArea(f) + "</dd>" +
          "<dt>That is</dt><dd>" + yardstick(f) + "</dd>" +
          "<dt>Radius</dt><dd>" + fmtLen(r) + "</dd>" +
          "<dt>Across</dt><dd>" + driveAcross(r) + "</dd>" +
          "</dl><p>" + f.note + "</p>";
        b.appendChild(d);
      }

      b.addEventListener("click", function () { toggle(f); });
      elList.appendChild(b);
    });
  }

  /* ------------------------------------------------------------ flow */

  document.getElementById("fitBtn").addEventListener("click", fit);
  document.getElementById("clearBtn").addEventListener("click", function () {
    Object.keys(selected).forEach(function (id) {
      var f = FIRES.filter(function (x) { return x.id === id; })[0];
      if (f) dropRing(f);
    });
    selected = {};
    store("firescale.picked", "");
    render();
  });
  document.getElementById("locBtn").addEventListener("click", locate);

  var sheet = document.getElementById("sheet"), side = document.getElementById("side");
  sheet.addEventListener("click", function () {
    side.classList.toggle("shut");
    document.getElementById("sheetChev").textContent = side.classList.contains("shut") ? "▴" : "▾";
    setTimeout(function () { map.invalidateSize(); relabel(); }, 210);
  });

  function locate() {
    if (!navigator.geolocation) {
      elCoords.textContent = "This browser can’t share a location — tap the map instead.";
      return;
    }
    elCoords.textContent = "Finding you…";
    navigator.geolocation.getCurrentPosition(function (p) {
      setHere(p.coords.latitude, p.coords.longitude, true);
      map.setView([here.lat, here.lon], 12);
      if (Object.keys(selected).length) fit();
    }, function (err) {
      elCoords.textContent = (err && err.code === 1)
        ? "Location permission denied — tap the map to drop your spot."
        : "Couldn’t get a location — tap the map to drop your spot.";
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  }

  /* ------------------------------------------------------------ boot */

  var saved = (store("firescale.at") || "").split(",");
  if (saved.length === 2 && !isNaN(parseFloat(saved[0]))) {
    here.lat = parseFloat(saved[0]); here.lon = parseFloat(saved[1]); here.known = true;
  }

  initMap();
  setHere(here.lat, here.lon, here.known);

  (store("firescale.picked") || "").split(",").forEach(function (id) {
    var f = FIRES.filter(function (x) { return x.id === id; })[0];
    if (f) { selected[f.id] = true; addRing(f); }
  });

  render();
  if (Object.keys(selected).length) fit();
  locate();

  setTimeout(function () { elHint.hidden = true; }, 9000);
})();
