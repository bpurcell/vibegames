/* =====================================================================
   Church Cousins — the relationship arithmetic.

   The genealogy is standard and worth stating, because the interesting
   results come straight out of it. With `a` splits from one body up to
   the shared ancestor and `b` from the other:

     a = 0            one is a direct ancestor of the other
     a = b = 1        siblings: both left the same body
     otherwise        cousin degree = min(a, b) - 1
                      removed       = |a - b|

   Two consequences that surprise people, and that the app leans on:

   Depth is not chronology. Baptists (1609) sit FURTHER down the tree
   than Methodists (1784), because Baptists came through the Separatists
   while Methodism came straight off the Church of England. So the older
   body is the junior relation.

   And the Reformation bodies are not cousins of Rome at all. They are
   its children. Cousinhood between Protestants only starts one
   generation below that.
   ===================================================================== */
(function () {
  "use strict";

  var TREE = window.TREE, TRAD = window.TRADITIONS;
  var byId = {};
  TREE.forEach(function (n) { byId[n.id] = n; });

  var $ = function (id) { return document.getElementById(id); };

  var ORD = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh"];
  var TIMES = ["", "once", "twice", "three times", "four times", "five times"];

  function ancestorWord(n) {
    if (n === 1) return "parent";
    if (n === 2) return "grandparent";
    return new Array(n - 2).fill("great").join("-") + "-grandparent";
  }
  function childWord(n) {
    if (n === 1) return "child";
    if (n === 2) return "grandchild";
    return new Array(n - 2).fill("great").join("-") + "-grandchild";
  }

  function pathUp(id) {                       // [self, parent, ..., root]
    var out = [], c = byId[id];
    while (c) { out.push(c.id); c = c.parent ? byId[c.parent] : null; }
    return out;
  }

  function relate(aId, bId) {
    var A = byId[aId], B = byId[bId];
    if (aId === bId) return { kind: "same", A: A, B: B };
    if (A.offTree || B.offTree) {
      return { kind: "offtree", A: A, B: B, off: A.offTree ? A : B };
    }
    var pa = pathUp(aId), pb = pathUp(bId);
    var inB = {}; pb.forEach(function (id, i) { inB[id] = i; });
    var lca = null, da = 0, db = 0;
    for (var i = 0; i < pa.length; i++) {
      if (inB[pa[i]] !== undefined) { lca = pa[i]; da = i; db = inB[pa[i]]; break; }
    }
    if (!lca) return { kind: "unrelated", A: A, B: B };

    var r = { A: A, B: B, lca: byId[lca], da: da, db: db,
              upA: pa.slice(0, da + 1).reverse(), upB: pb.slice(0, db + 1).reverse() };

    if (da === 0) { r.kind = "ancestor"; r.older = A; r.younger = B; r.steps = db; }
    else if (db === 0) { r.kind = "ancestor"; r.older = B; r.younger = A; r.steps = da; }
    else if (da === 1 && db === 1) { r.kind = "siblings"; }
    else {
      r.kind = "cousins";
      r.degree = Math.min(da, db) - 1;
      r.removed = Math.abs(da - db);
      r.senior = da < db ? A : B;            // the one nearer the shared ancestor
      r.junior = da < db ? B : A;
    }
    return r;
  }

  function headline(r) {
    if (r.kind === "same") return "The same church";
    if (r.kind === "offtree") return "Not on this tree";
    if (r.kind === "unrelated") return "No shared branch here";
    if (r.kind === "ancestor") {
      return r.steps === 1 ? "Parent and child"
           : r.steps === 2 ? "Grandparent and grandchild"
           : "Ancestor and descendant, " + r.steps + " splits apart";
    }
    if (r.kind === "siblings") return "Siblings";
    if (r.degree === 0) {
      var g = new Array(Math.max(0, r.removed - 1)).fill("great").join("-");
      return (g ? g + "-aunt and " + g + "-niece" : "Aunt and niece") + ", in effect";
    }
    return (ORD[r.degree] || r.degree + "th") + " cousins" +
           (r.removed ? ", " + (TIMES[r.removed] || r.removed + " times") + " removed" : "");
  }

  function explain(r) {
    var p = [];
    if (r.kind === "same") { p.push("Pick two different ones."); return p; }

    if (r.kind === "offtree") {
      p.push("<b>" + r.off.name + "</b> has no branch on this tree, and that is the honest answer rather than a gap in the data.");
      p.push(r.off.note);
      return p;
    }

    // Two lines are separate from the moment the SECOND of them leaves the
    // shared body — until then one of them still is that body.
    function leftAt(chain) { return chain.length > 1 ? byId[chain[1]].year : byId[chain[0]].year; }
    var parted = Math.max(leftAt(r.upA), leftAt(r.upB));
    var apart = new Date().getFullYear() - parted;

    if (r.kind === "ancestor") {
      var chain = (r.older === r.A) ? r.upB : r.upA;
      var first = byId[chain[1]];
      p.push("<b>" + r.younger.name + "</b> came out of <b>" + r.older.name + "</b>" +
             (r.steps === 1 ? " directly" : " through " + (r.steps - 1) + " intervening " +
              (r.steps - 1 === 1 ? "body" : "bodies")) + " — so they are not cousins at all. " +
             r.older.short + " is " + r.younger.short + "'s " + ancestorWord(r.steps) +
             ", and " + r.younger.short + " is its " + childWord(r.steps) + ".");
      if (first) {
        p.push("The parting began in <b>" + first.year + "</b> with " + first.name +
               " — about <b>" + (new Date().getFullYear() - first.year) + " years</b> ago.");
      }
      return p;
    }

    if (r.kind === "siblings") {
      p.push("Both left <b>" + r.lca.name + "</b>, which makes them siblings rather than cousins.");
    } else if (r.degree === 0) {
      p.push("<b>" + r.senior.short + "</b> branched straight off <b>" + r.lca.name +
             "</b>. <b>" + r.junior.short + "</b> is " + (Math.max(r.da, r.db)) +
             " splits down from that same body — so the senior one is, in family terms, the other's aunt.");
    } else {
      p.push("Their lines last ran together in <b>" + r.lca.name + "</b>. From there one line took " +
             r.da + " split" + (r.da === 1 ? "" : "s") + " and the other took " + r.db +
             (r.removed ? ", which is what makes them removed rather than plain " +
                          (ORD[r.degree] || "") + " cousins" : "") + ".");
    }
    p.push("Separate bodies for roughly <b>" + apart + " years</b>, since " + parted + ".");
    return p;
  }

  /* ---------------------------------------------------------- render */

  function stepChip(id, isShared) {
    var n = byId[id];
    var b = document.createElement("button");
    b.type = "button";
    b.className = "stepbtn" + (isShared ? " shared" : "");
    b.style.borderLeftColor = isShared ? "" : TRAD[n.tradition].color;
    b.innerHTML = '<span class="yr">' + (n.year < 100 ? "c. " : "") + n.year + "</span>" +
                  '<span class="nm">' + n.short + "</span>";
    b.addEventListener("click", function () { showWhy(n); });
    return b;
  }

  var whyBox = null;
  function showWhy(n) {
    if (!whyBox) return;
    var h = [];
    if (n.over) h.push('<span class="tag">What the split was over</span><br>' + n.over);
    else h.push('<span class="tag">' + n.short + "</span><br>");
    if (n.merged) {
      h.push("<br><br><b>A merger, not a split.</b> Formed from: " + n.merged.join(" + ") +
             ". The tree above can only draw one parent.");
    }
    h.push("<br><br>" + n.note);
    if (n.size) h.push("<br><br><b>Today:</b> " + n.size + " (rough).");
    whyBox.innerHTML = h.join("");
    whyBox.hidden = false;
  }

  function lineage(label, ids, lcaId) {
    var box = document.createElement("div");
    box.className = "lin";
    var t = document.createElement("div");
    t.className = "who"; t.textContent = label;
    box.appendChild(t);
    var chain = document.createElement("div");
    chain.className = "chain";
    ids.forEach(function (id, i) {
      if (i) {
        var a = document.createElement("span");
        a.className = "arrow"; a.textContent = "→";
        chain.appendChild(a);
      }
      chain.appendChild(stepChip(id, id === lcaId));
    });
    box.appendChild(chain);
    return box;
  }

  function render() {
    var r = relate($("a").value, $("b").value);
    var box = $("result");
    box.innerHTML = "";

    var v = document.createElement("div");
    v.className = "verdict";
    var head = headline(r);
    var h = '<p class="big">' + head.charAt(0).toUpperCase() + head.slice(1) + "</p>";
    explain(r).forEach(function (s) { h += "<p>" + s + "</p>"; });
    v.innerHTML = h;
    box.appendChild(v);

    if (r.kind === "offtree" || r.kind === "same" || r.kind === "unrelated") return;

    var st = document.createElement("div");
    st.className = "stats";
    st.innerHTML =
      '<div class="stat"><div class="k">Shared ancestor</div><div class="v">' + r.lca.short + "</div></div>" +
      '<div class="stat"><div class="k">' + r.A.short + '</div><div class="v">' + r.da + " split" + (r.da === 1 ? "" : "s") + " on</div></div>" +
      '<div class="stat"><div class="k">' + r.B.short + '</div><div class="v">' + r.db + " split" + (r.db === 1 ? "" : "s") + " on</div></div>";
    box.appendChild(st);

    var hh = document.createElement("h2");
    hh.textContent = "How each one got there";
    box.appendChild(hh);
    box.appendChild(lineage(r.A.name, r.upA, r.lca.id));
    box.appendChild(lineage(r.B.name, r.upB, r.lca.id));

    whyBox = document.createElement("div");
    whyBox.className = "why";
    whyBox.hidden = true;
    box.appendChild(whyBox);

    var tip = document.createElement("p");
    tip.className = "lede";
    tip.style.cssText = "font-size:12.5px;margin:10px 0 0";
    tip.textContent = "Tap any step to see what that argument was about.";
    box.appendChild(tip);

    if (r.A.contested || r.B.contested) {
      var c = document.createElement("div");
      c.className = "caveat";
      c.style.marginTop = "12px";
      c.innerHTML = "<b>Contested placement.</b> " +
        (r.A.contested ? r.A.short : r.B.short) +
        " does not describe itself as descending from the body shown above it. " +
        "The position here follows the documented historical milieu, not the movement's own account.";
      box.appendChild(c);
    }
  }

  /* ----------------------------------------------------------- setup */

  function fill(sel, chosen) {
    var groups = {};
    TREE.forEach(function (n) {
      (groups[n.tradition] = groups[n.tradition] || []).push(n);
    });
    Object.keys(TRAD).forEach(function (t) {
      if (!groups[t]) return;
      var g = document.createElement("optgroup");
      g.label = TRAD[t].label;
      groups[t].sort(function (x, y) { return x.year - y.year; }).forEach(function (n) {
        var o = document.createElement("option");
        o.value = n.id;
        o.textContent = n.short + " · " + (n.year < 100 ? "c. " : "") + n.year;
        g.appendChild(o);
      });
      sel.appendChild(g);
    });
    sel.value = chosen;
  }

  fill($("a"), "methodist");
  fill($("b"), "amish");
  $("a").addEventListener("change", render);
  $("b").addEventListener("change", render);
  $("swap").addEventListener("click", function () {
    var t = $("a").value; $("a").value = $("b").value; $("b").value = t; render();
  });

  [["Methodist ↔ Amish", "methodist", "amish"],
   ["Methodist ↔ Baptist", "methodist", "baptist"],
   ["Amish ↔ Baptist", "amish", "baptist"],
   ["Catholic ↔ Lutheran", "catholic", "lutheran"],
   ["Catholic ↔ Orthodox", "catholic", "orthodox"],
   ["Baptist ↔ Pentecostal", "baptist", "pentecostal"],
   ["Quaker ↔ Southern Baptist", "quaker", "sbc"]
  ].forEach(function (q) {
    var b = document.createElement("button");
    b.type = "button"; b.textContent = q[0];
    b.addEventListener("click", function () {
      $("a").value = q[1]; $("b").value = q[2]; render();
      $("result").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    $("quick").appendChild(b);
  });

  /* ------------------------------------------------------- full tree */

  var leg = $("legend");
  Object.keys(TRAD).forEach(function (t) {
    var s = document.createElement("span");
    s.innerHTML = '<i style="background:' + TRAD[t].color + '"></i>' + TRAD[t].label;
    leg.appendChild(s);
  });

  function treeNode(n, into) {
    var el = document.createElement("div");
    el.className = "tnode";
    el.style.borderLeftColor = TRAD[n.tradition].color + "44";
    var row = document.createElement("div");
    row.className = "row";
    row.innerHTML = '<span class="dot" style="background:' + TRAD[n.tradition].color + '"></span>' +
      '<span class="yr">' + (n.year < 100 ? "c." + n.year : n.year) + "</span>" +
      '<span class="nm">' + n.name + "</span>" +
      // Without this an off-tree entry looks like a missing parent rather
      // than a deliberate refusal to place it.
      (n.offTree ? '<span class="sz" style="color:var(--accent-2)">stands apart — claims a separate origin</span>' : "") +
      (n.size ? '<span class="sz">' + n.size + "</span>" : "");
    var det = document.createElement("div");
    det.className = "det"; det.hidden = true;
    det.innerHTML = (n.over ? "<b>Parted over:</b> " + n.over + "<br><br>" : "") +
      (n.merged ? "<b>A merger of:</b> " + n.merged.join(" + ") + "<br><br>" : "") + n.note;
    row.addEventListener("click", function () { det.hidden = !det.hidden; });
    el.appendChild(row);
    el.appendChild(det);
    into.appendChild(el);
    TREE.filter(function (c) { return c.parent === n.id; })
        .sort(function (x, y) { return x.year - y.year; })
        .forEach(function (c) { treeNode(c, el); });
  }
  var troot = $("tree");
  TREE.filter(function (n) { return !n.parent; })
      .forEach(function (n) { treeNode(n, troot); });

  render();
})();
