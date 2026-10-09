/* =====================================================================
   Shared navigation bar.

   The page list lives here and nowhere else, so adding a project updates
   every menu in the repo at once. Drop this on a page with:

     <link rel="stylesheet" href="shared/site.css">
     <script src="shared/nav.js" defer></script>

   ...and from a subdirectory, with "../shared/..." instead. Links are
   resolved against this script's own URL rather than the page's, so the
   same include works at any depth and over file:// as well as http.

   Optional per-page overrides, set before the script runs or as data
   attributes on the <script> tag:
     data-title="Earth Speed"      – name shown in the bar
     data-tag="you are not standing still"
   ===================================================================== */
(function () {
  "use strict";

  var script = document.currentScript ||
    (function () { var s = document.getElementsByTagName("script"); return s[s.length - 1]; })();

  // Theme preference is shared by every page on this origin. Storage can be
  // unavailable in private/file contexts; the picker must still work there.
  var STYLES = [
    ["classic", "Original", "The original navy, blue and gold"],
    ["neo-brutalism", "Neo-Brutalism", "Bold ink, solid shadows, punchy yellow"],
    ["glassmorphism", "Glassmorphism", "Translucent panels and soft depth"],
    ["swiss", "Swiss Design", "Clean type, crisp grids, red accents"],
    ["pixel-art", "Pixel Art", "Arcade colors and square edges"],
    ["synthwave", "Synthwave", "Neon pink, cyan and midnight purple"]
  ];
  var STYLE_KEY = "vibegames-style";
  function validStyle(value) {
    return STYLES.some(function (style) { return style[0] === value; });
  }
  function applyStyle(value) {
    value = validStyle(value) ? value : "classic";
    if (value === "classic") document.documentElement.removeAttribute("data-style");
    else document.documentElement.setAttribute("data-style", value);
    if (styleSelect) styleSelect.value = value;
    return value;
  }
  var savedStyle = "classic";
  try { savedStyle = localStorage.getItem(STYLE_KEY) || "classic"; } catch (_) {}
  applyStyle(savedStyle);

  // Site root = the parent of /shared/. Works under file:// and http.
  var ROOT = new URL(script.dataset.root || "..", script.src).href;

  var PAGES = [
    { group: "Home", items: [
      { href: "index.html", name: "All projects" },
    ]},
    { group: "Tools & webapps", items: [
      { href: "chatgourdspt/", name: "chatgourdspt" },
      { href: "half-staff/", name: "For Every Life" },
      { href: "solar-system/",        name: "Solar System" },
      { href: "gardenplanner/",       name: "Summer Garden Planner" },
      { href: "instruments/",         name: "The Instrument Cabinet" },
      { href: "firescale/",           name: "Wildfire Scale" },
      { href: "animalterritory/",     name: "Local Animal Territory" },
      { href: "earth-speed.html",     name: "Earth Speed" },
      { href: "worldsignpost.html",   name: "World Signpost" },
      { href: "timeline.html",        name: "Deep Time" },
      { href: "tree-of-life.html",    name: "Tree of Life Explorer" },
      { href: "cousins-machine.html", name: "The Cousins Machine" },
      { href: "churchcousins/",       name: "Church Cousins" },
      { href: "weather-records.html", name: "US Weather Records" },
    ]},
    { group: "Games", items: [
      { href: "little-leaps/",    name: "Little Leaps" },
      { href: "jezzball.html",    name: "JezzBall Classic" },
      { href: "flappybirds.html", name: "Flappy Birds" },
      { href: "minesweeper.html", name: "ASCII Minesweeper" },
      { href: "headbop/",         name: "Head Bop" },
      { href: "mazecar/",         name: "Maze Car" },
      { href: "spookyforest/",    name: "Spooky Forest" },
      { href: "spookyforest2/",   name: "Spooky Forest 2" },
      { href: "gourds/",          name: "Gourd Garden" },
      { href: "theremin/",        name: "Theremin" },
      { href: "vibooding.html",   name: "Vibooding" },
    ]},
  ];

  // Which entry is the current page? Compare resolved URLs so that
  // "headbop/" and "headbop/index.html" match.
  function normalise(u) {
    return u.replace(/index\.html$/, "").replace(/\/$/, "");
  }
  var here = normalise(location.href.split(/[?#]/)[0]);

  function isCurrent(href) {
    return normalise(new URL(href, ROOT).href) === here;
  }

  var currentName = null;
  PAGES.forEach(function (g) {
    g.items.forEach(function (it) { if (isCurrent(it.href)) currentName = it.name; });
  });

  var title = script.dataset.title || currentName || document.title.split(/[—–|]/)[0].trim();
  var tag   = script.dataset.tag || "";

  /* ------------------------------------------------------------ build */
  var nav = document.createElement("nav");
  nav.className = "site-nav";

  var onHome = isCurrent("index.html");

  var back = document.createElement("a");
  back.className = "nav-btn";
  back.href = ROOT + "index.html";
  back.innerHTML = "← Back";
  // Prefer real history when we actually came from somewhere; the href
  // stays meaningful for a direct visit or a JS-less load.
  back.addEventListener("click", function (e) {
    if (history.length > 1 && document.referrer) { e.preventDefault(); history.back(); }
  });

  var brand = document.createElement("a");
  brand.className = "nav-brand";
  brand.href = ROOT + "index.html";
  brand.textContent = title;
  if (tag) {
    var dim = document.createElement("span");
    dim.className = "dim";
    dim.textContent = " · " + tag;
    brand.appendChild(dim);
  }

  var wrap = document.createElement("div");
  wrap.className = "nav-menu-wrap";

  var btn = document.createElement("button");
  btn.className = "nav-btn";
  btn.type = "button";
  btn.setAttribute("aria-haspopup", "true");
  btn.setAttribute("aria-expanded", "false");
  btn.textContent = "Menu ▾";

  var panel = document.createElement("div");
  panel.className = "nav-panel";
  panel.setAttribute("role", "menu");
  panel.hidden = true;

  PAGES.forEach(function (g) {
    var h = document.createElement("div");
    h.className = "nav-group";
    h.textContent = g.group;
    panel.appendChild(h);
    g.items.forEach(function (it) {
      var a = document.createElement("a");
      a.href = ROOT + it.href;
      a.textContent = it.name;
      if (isCurrent(it.href)) a.setAttribute("aria-current", "page");
      panel.appendChild(a);
    });
  });

  function close() { panel.hidden = true; btn.setAttribute("aria-expanded", "false"); }
  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    var open = panel.hidden;
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("click", function (e) { if (!panel.contains(e.target)) close(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });

  wrap.appendChild(btn);
  wrap.appendChild(panel);
  // "Back" to the homepage from the homepage is noise.
  if (!onHome) nav.appendChild(back);
  nav.appendChild(brand);
  var styleLabel = document.createElement("label");
  styleLabel.className = "nav-style";
  var styleCaption = document.createElement("span");
  styleCaption.textContent = "Style";
  var styleSelect = document.createElement("select");
  styleSelect.className = "nav-style-select";
  styleSelect.setAttribute("aria-label", "Site style");
  STYLES.forEach(function (style) {
    var option = document.createElement("option");
    option.value = style[0];
    option.textContent = style[1];
    option.title = style[2];
    styleSelect.appendChild(option);
  });
  styleSelect.value = validStyle(savedStyle) ? savedStyle : "classic";
  styleSelect.addEventListener("change", function () {
    var value = applyStyle(styleSelect.value);
    try { localStorage.setItem(STYLE_KEY, value); } catch (_) {}
  });
  window.addEventListener("storage", function (event) {
    if (event.key === STYLE_KEY || event.key === null) applyStyle(event.newValue);
  });
  styleLabel.appendChild(styleCaption);
  styleLabel.appendChild(styleSelect);
  nav.appendChild(styleLabel);
  nav.appendChild(wrap);

  function mount() {
    if (document.querySelector(".site-nav")) return;   // page supplied its own
    document.body.insertBefore(nav, document.body.firstChild);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
