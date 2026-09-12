/* =====================================================================
   Local Animal Territory — how much ground one animal needs, drawn on
   the map around wherever you are standing.

   The one piece of real arithmetic here: a home range given as an area
   is turned into the circle of the same area, r = sqrt(A / pi), and
   drawn on the map in metres. Leaflet's L.circle takes a radius in
   metres and handles the projection, so the circle stays true to scale
   as you zoom and as you move north or south — which a circle drawn in
   pixels would not.

   Everything the app claims is either that arithmetic or a figure out
   of species.js. Where a number is uncertain the UI shows the low-high
   span rather than pretending the typical value is exact.
   ===================================================================== */
(function () {
  "use strict";

  var SPECIES = (window.SPECIES || []).slice().sort(function (a, b) {
    return a.home.typical - b.home.typical;
  });

  // Ten hues that stay apart on a pale map. Colour is never the only cue —
  // every circle also carries a name label — so this does not have to
  // survive colour blindness on its own.
  var COLORS = ["#e6194b", "#3cb44b", "#4363d8", "#f58231", "#911eb4",
                "#00a5a5", "#bfa100", "#f032e6", "#9a6324", "#46a0ff"];

  var DEFAULT = { lat: 42.36, lon: -71.06 };      // a fallback, replaced on locate

  var map, pin, ring = {}, selected = {}, nearOnly = false;
  var here = { lat: DEFAULT.lat, lon: DEFAULT.lon, known: false };

  var elList = document.getElementById("list");
  var elCoords = document.getElementById("coords");
  var elHint = document.getElementById("mapHint");
  var elWarn = document.getElementById("tileWarn");
  var elNearBtn = document.getElementById("nearBtn");
  var elSheetCount = document.getElementById("sheetCount");

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) { /* private browsing */ }
    return null;
  }

  /* -------------------------------------------------------- formatting */

  function radiusM(hectares) { return Math.sqrt(hectares * 10000 / Math.PI); }

  function fmtArea(ha) {
    var acres = ha * 2.47105;
    if (ha < 1) return ha.toFixed(2) + " ha (" + acres.toFixed(1) + " acres)";
    if (ha < 100) return Math.round(ha) + " ha (" + Math.round(acres) + " acres)";
    var km2 = ha / 100, mi2 = km2 * 0.386102;
    return km2.toFixed(km2 < 10 ? 1 : 0) + " km² (" + mi2.toFixed(mi2 < 10 ? 1 : 0) + " sq mi)";
  }

  function fmtLen(m) {
    if (m < 1000) return Math.round(m) + " m (" + Math.round(m * 3.28084) + " ft)";
    return (m / 1000).toFixed(1) + " km (" + (m / 1609.34).toFixed(1) + " mi)";
  }

  // A distance nobody can picture becomes one everybody can: how long it
  // takes to walk across at an ordinary 5 km/h.
  function walkAcross(m) {
    var mins = (m * 2 / 1000) / 5 * 60;
    if (mins < 1) return "under a minute to walk across";
    if (mins < 90) return Math.round(mins) + " min walk across";
    return (mins / 60).toFixed(1) + " hour walk across";
  }

  function shortArea(ha) {
    if (ha < 1) return ha.toFixed(2) + " ha";
    if (ha < 1000) return Math.round(ha) + " ha";
    return Math.round(ha / 100) + " km²";
  }

  function inBox(sp, lat, lon) {
    var b = sp.box;
    return lat >= b.s && lat <= b.n && lon >= b.w && lon <= b.e;
  }

  /* --------------------------------------------------------------- map */

  function initMap() {
    map = L.map("map", { zoomControl: true, worldCopyJump: true })
           .setView([here.lat, here.lon], 14);

    var tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });
    // If imagery cannot load the app is still useful — the circles and the
    // scale bar carry the actual information — so say so rather than
    // leaving a grey void that looks broken.
    var misses = 0;
    tiles.on("tileerror", function () {
      if (++misses >= 3) elWarn.hidden = false;
    });
    tiles.on("tileload", function () { elWarn.hidden = true; misses = 0; });
    tiles.addTo(map);

    L.control.scale({ imperial: true, metric: true }).addTo(map);

    pin = L.marker([here.lat, here.lon], { draggable: true }).addTo(map);
    pin.bindTooltip("Your spot", { direction: "top", offset: [0, -34] });
    pin.on("dragend", function () {
      var p = pin.getLatLng();
      setHere(p.lat, p.lng, true);
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
    store("territory.at", lat.toFixed(5) + "," + lon.toFixed(5));
    Object.keys(ring).forEach(function (id) {
      ring[id].layers.forEach(function (c) { c.setLatLng([lat, lon]); });
      ring[id].label.setLatLng(northOf(lat, lon, ring[id].r));
    });
    relabel();
    render();
  }

  /* ------------------------------------------------------------ circles */

  function colorFor(sp) { return COLORS[SPECIES.indexOf(sp) % COLORS.length]; }

  // A label at the centre would sit on top of every other species' label,
  // since all the circles share one centre. Pinning each to the top of its
  // own circle spreads them out by size, which also makes the ordering
  // legible at a glance.
  function northOf(lat, lon, metres) {
    return [lat + metres / 111320, lon];
  }

  function addRings(sp) {
    var c = colorFor(sp), r = radiusM(sp.home.typical), layers = [];
    layers.push(L.circle([here.lat, here.lon], {
      radius: r,
      color: c, weight: 2, opacity: 0.95,
      fillColor: c, fillOpacity: 0.10
    }).addTo(map));

    // The defended core, where the species actually defends one. Dashed so
    // it reads as a different kind of claim from the home range.
    if (sp.territory && sp.territory < sp.home.typical * 0.9) {
      layers.push(L.circle([here.lat, here.lon], {
        radius: radiusM(sp.territory),
        color: c, weight: 1.5, opacity: 0.8, dashArray: "5 4",
        fillColor: c, fillOpacity: 0.06
      }).addTo(map));
    }

    var label = L.tooltip({ permanent: true, direction: "top", className: "terr-label", offset: [0, -2] })
      .setLatLng(northOf(here.lat, here.lon, r))
      .setContent(sp.icon + " " + sp.name)
      .addTo(map);

    ring[sp.id] = { layers: layers, label: label, r: r };
    restack();
    relabel();
  }

  // At a zoom that fits a coyote's range, a chipmunk's is six pixels across
  // and its label lands on top of everything else's. Label only what is
  // actually big enough to see; the labels come back as you zoom in.
  function relabel() {
    Object.keys(ring).forEach(function (id) {
      var e = ring[id], b = e.layers[0].getBounds();
      var nw = map.latLngToLayerPoint(b.getNorthWest());
      var se = map.latLngToLayerPoint(b.getSouthEast());
      e.label.setOpacity((se.x - nw.x) / 2 >= 20 ? 1 : 0);
    });
  }

  // Small circles drawn last, so a chipmunk is not buried under a bear.
  function restack() {
    Object.keys(ring)
      .sort(function (a, b) { return ring[b].r - ring[a].r; })
      .forEach(function (id) {
        ring[id].layers.forEach(function (l) { l.bringToFront(); });
      });
  }

  function dropRings(sp) {
    var e = ring[sp.id];
    if (!e) return;
    e.layers.forEach(function (l) { map.removeLayer(l); });
    map.removeLayer(e.label);
    delete ring[sp.id];
  }

  function fit() {
    var all = [];
    Object.keys(ring).forEach(function (id) { all.push(ring[id].layers[0]); });
    if (!all.length) { map.setView([here.lat, here.lon], 15); return; }
    var b = all[0].getBounds();
    all.forEach(function (l) { b.extend(l.getBounds()); });
    // A lone chipmunk would otherwise zoom to the point where the map is
    // just one grey square.
    map.fitBounds(b.pad(0.15), { maxZoom: 18 });
    relabel();
  }

  /* --------------------------------------------------------------- list */

  function toggle(sp) {
    if (selected[sp.id]) { delete selected[sp.id]; dropRings(sp); }
    else { selected[sp.id] = true; addRings(sp); }
    store("territory.picked", Object.keys(selected).join(","));
    render();
    if (Object.keys(selected).length) fit();
  }

  function render() {
    var near = SPECIES.filter(function (sp) { return inBox(sp, here.lat, here.lon); });
    var show = nearOnly ? near : SPECIES;
    elNearBtn.textContent = nearOnly
      ? "Showing " + near.length + " near you"
      : "Showing all " + SPECIES.length;

    var n = Object.keys(selected).length;
    elSheetCount.textContent = n ? n + " shown" : "none shown";

    elList.innerHTML = "";
    if (!show.length) {
      var none = document.createElement("div");
      none.className = "foot";
      none.textContent = "None of these animals live near this spot — the list " +
        "covers North America. Move the pin back to that continent, or switch " +
        "to showing all.";
      elList.appendChild(none);
      return;
    }

    show.forEach(function (sp) {
      var on = !!selected[sp.id];
      var b = document.createElement("button");
      b.type = "button";
      b.className = "sp" + (on ? " on" : "");
      b.style.borderLeftColor = on ? colorFor(sp) : "transparent";
      b.setAttribute("aria-pressed", String(on));

      var top = document.createElement("div");
      top.className = "top";
      top.innerHTML =
        '<span class="ico">' + sp.icon + '</span>' +
        '<span><span class="nm">' + sp.name + '</span><br>' +
        '<span class="sci">' + sp.sci + '</span></span>' +
        '<span class="area">' + shortArea(sp.home.typical) +
        (inBox(sp, here.lat, here.lon) ? "" : '<br><span class="far">outside range</span>') +
        '</span>';
      b.appendChild(top);

      if (on) {
        var r = radiusM(sp.home.typical);
        var d = document.createElement("div");
        d.className = "detail";
        var label = sp.foraging ? "Foraging reach" : "Home range";
        var dl =
          "<dt>" + label + "</dt><dd>" + fmtArea(sp.home.typical) + "</dd>" +
          "<dt>Varies</dt><dd>" + shortArea(sp.home.low) + " – " + shortArea(sp.home.high) + "</dd>" +
          "<dt>Radius</dt><dd>" + fmtLen(r) + "</dd>" +
          "<dt>Across</dt><dd>" + walkAcross(r) + "</dd>";
        if (sp.territory && sp.territory < sp.home.typical * 0.9) {
          dl += "<dt>Defends</dt><dd>" + fmtArea(sp.territory) + " (dashed)</dd>";
        }
        dl += "<dt>Found</dt><dd>" + sp.where + "</dd>";
        d.innerHTML = "<dl>" + dl + "</dl><p>" + sp.note + "</p>";
        b.appendChild(d);
      }

      b.addEventListener("click", function () { toggle(sp); });
      elList.appendChild(b);
    });
  }

  /* --------------------------------------------------------------- flow */

  document.getElementById("fitBtn").addEventListener("click", fit);

  document.getElementById("clearBtn").addEventListener("click", function () {
    Object.keys(selected).forEach(function (id) {
      var sp = SPECIES.filter(function (s) { return s.id === id; })[0];
      if (sp) dropRings(sp);
    });
    selected = {};
    store("territory.picked", "");
    render();
  });

  elNearBtn.addEventListener("click", function () { nearOnly = !nearOnly; render(); });

  document.getElementById("locBtn").addEventListener("click", locate);

  var sheet = document.getElementById("sheet"), side = document.getElementById("side");
  sheet.addEventListener("click", function () {
    side.classList.toggle("shut");
    document.getElementById("sheetChev").textContent = side.classList.contains("shut") ? "▴" : "▾";
    // Leaflet needs telling when its container changes size.
    setTimeout(function () { map.invalidateSize(); }, 210);
  });

  function locate() {
    if (!navigator.geolocation) {
      elCoords.textContent = "This browser can’t share a location — tap the map instead.";
      return;
    }
    elCoords.textContent = "Finding you…";
    navigator.geolocation.getCurrentPosition(function (p) {
      setHere(p.coords.latitude, p.coords.longitude, true);
      map.setView([here.lat, here.lon], 15);
      if (Object.keys(selected).length) fit();
    }, function (err) {
      elCoords.textContent = (err && err.code === 1)
        ? "Location permission denied — tap the map to drop your spot."
        : "Couldn’t get a location — tap the map to drop your spot.";
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  }

  /* --------------------------------------------------------------- boot */

  var saved = (store("territory.at") || "").split(",");
  if (saved.length === 2 && !isNaN(parseFloat(saved[0]))) {
    here.lat = parseFloat(saved[0]); here.lon = parseFloat(saved[1]); here.known = true;
  }

  initMap();
  setHere(here.lat, here.lon, here.known);

  (store("territory.picked") || "").split(",").forEach(function (id) {
    var sp = SPECIES.filter(function (s) { return s.id === id; })[0];
    if (sp) { selected[sp.id] = true; addRings(sp); }
  });

  render();
  if (Object.keys(selected).length) fit();
  locate();                       // ask straight away; the pin moves if allowed

  setTimeout(function () { elHint.hidden = true; }, 9000);
})();
