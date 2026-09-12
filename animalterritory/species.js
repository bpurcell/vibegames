/* =====================================================================
   Home-range figures for common North American animals.

   WHAT THESE NUMBERS ARE. Each entry carries the area one individual
   (or, for colonial birds, one bird from its colony) typically uses in
   the course of normal life — foraging, mating, raising young. They are
   typical values drawn from the wildlife literature, and the low/high
   pair is as important as the typical: home range varies enormously
   with habitat quality, season, sex, age and food supply. A suburban
   red fox with reliable food may work 50 hectares; the same species on
   poor ground can range over 1,500.

   HOME RANGE IS NOT TERRITORY. The home range is everywhere an animal
   goes. The territory is the smaller part it actively defends against
   its own kind, and plenty of species defend nothing at all. Where the
   distinction is real and documented, `territory` carries the defended
   core; where an animal simply tolerates overlap, it is left out.

   RANGE BOXES ARE BOXES. `box` is a crude lat/lon rectangle used only
   to say "this animal plausibly occurs where you are standing". It is
   not a range map — real distributions follow habitat, elevation and
   history, and no rectangle has ever described one. Treated as a hint
   and labelled as such in the UI.

   Areas are in hectares (1 ha = 10,000 m² = 2.47 acres).
   ===================================================================== */
window.SPECIES = [
  {
    id: "chipmunk", name: "Eastern chipmunk", sci: "Tamias striatus",
    icon: "🐿️", group: "Mammal",
    home: { low: 0.1, typical: 0.25, high: 0.5 },
    territory: 0.05,
    box: { w: -100, e: -60, s: 29, n: 52 },
    where: "Eastern North America",
    note: "Lives its whole life within a short dash of the burrow. It defends only the ground immediately around the entrance — the rest it shares, grudgingly, with every other chipmunk on the slope."
  },
  {
    id: "robin", name: "American robin", sci: "Turdus migratorius",
    icon: "🐦", group: "Bird",
    home: { low: 0.1, typical: 0.25, high: 0.6 },
    territory: 0.2,
    box: { w: -168, e: -52, s: 25, n: 68 },
    where: "Most of North America",
    note: "The breeding territory is small and genuinely defended — the singing you hear at 4am is the boundary being re-stated. Outside the breeding season robins abandon territories entirely and roam in flocks."
  },
  {
    id: "groundhog", name: "Groundhog", sci: "Marmota monax",
    icon: "🦫", group: "Mammal",
    home: { low: 0.2, typical: 0.5, high: 1.5 },
    box: { w: -120, e: -60, s: 33, n: 62 },
    where: "Eastern US and much of Canada",
    note: "Rarely more than 50 to 150 metres from a burrow entrance, because the burrow is the entire survival strategy. Ranges shrink further where burrows are close together."
  },
  {
    id: "cardinal", name: "Northern cardinal", sci: "Cardinalis cardinalis",
    icon: "🐦‍🔥", group: "Bird",
    home: { low: 0.2, typical: 0.6, high: 1.5 },
    territory: 0.5,
    box: { w: -105, e: -62, s: 25, n: 47 },
    where: "Eastern and central US",
    note: "Holds a territory year-round rather than only in spring, which is unusual. Pairs often stay together on the same patch across seasons."
  },
  {
    id: "cottontail", name: "Eastern cottontail", sci: "Sylvilagus floridanus",
    icon: "🐇", group: "Mammal",
    home: { low: 0.5, typical: 1.2, high: 3 },
    box: { w: -115, e: -60, s: 25, n: 50 },
    where: "Eastern and central North America",
    note: "Small range, heavily shaped by cover — a cottontail will not cross open ground it cannot bolt back across. Males range further in the breeding season."
  },
  {
    id: "graysquirrel", name: "Eastern gray squirrel", sci: "Sciurus carolinensis",
    icon: "🐿️", group: "Mammal",
    home: { low: 0.5, typical: 1.5, high: 5 },
    box: { w: -100, e: -60, s: 28, n: 50 },
    where: "Eastern North America (introduced further west)",
    note: "Ranges overlap heavily and are not defended; squirrels sort themselves by dominance at food sources instead. Autumn ranges expand as they cache nuts."
  },
  {
    id: "beaver", name: "North American beaver", sci: "Castor canadensis",
    icon: "🦫", group: "Mammal",
    home: { low: 4, typical: 10, high: 20 },
    territory: 10,
    box: { w: -168, e: -52, s: 25, n: 70 },
    where: "Most of North America",
    note: "The one range here that is genuinely a line rather than a blob: a colony holds roughly half a kilometre to a kilometre and a half of stream or shoreline, and defends it. Read the circle as area only."
  },
  {
    id: "opossum", name: "Virginia opossum", sci: "Didelphis virginiana",
    icon: "🐀", group: "Mammal",
    home: { low: 5, typical: 20, high: 50 },
    box: { w: -125, e: -60, s: 25, n: 47 },
    where: "Eastern US, spreading north and west",
    note: "Barely holds a range at all — opossums drift, using a different den most nights and shifting the whole area they use over a season."
  },
  {
    id: "screechowl", name: "Eastern screech-owl", sci: "Megascops asio",
    icon: "🦉", group: "Bird",
    home: { low: 10, typical: 25, high: 50 },
    territory: 15,
    box: { w: -105, e: -62, s: 25, n: 48 },
    where: "Eastern US and southern Canada",
    note: "Small enough to hold a territory inside a suburb, and often does — a large yard with old trees and a cavity can sit inside one."
  },
  {
    id: "raccoon", name: "Raccoon", sci: "Procyon lotor",
    icon: "🦝", group: "Mammal",
    home: { low: 5, typical: 60, high: 400 },
    box: { w: -128, e: -60, s: 22, n: 55 },
    where: "Most of the US and southern Canada",
    note: "The widest spread of any animal here, and the reason is us: a city raccoon with bins and storm drains may use 5 hectares, while a rural one covers hundreds."
  },
  {
    id: "deer", name: "White-tailed deer", sci: "Odocoileus virginianus",
    icon: "🦌", group: "Mammal",
    home: { low: 40, typical: 120, high: 400 },
    box: { w: -125, e: -55, s: 15, n: 55 },
    where: "Most of the US, southern Canada, into Central America",
    note: "Famously faithful to one patch — a doe often spends her life within a kilometre or two of where she was born. Bucks range wider and expand sharply during the autumn rut."
  },
  {
    id: "skunk", name: "Striped skunk", sci: "Mephitis mephitis",
    icon: "🦨", group: "Mammal",
    home: { low: 50, typical: 150, high: 400 },
    box: { w: -125, e: -60, s: 25, n: 58 },
    where: "Most of the US and southern Canada",
    note: "Ranges contract hard in winter, when skunks go dormant in dens for weeks at a time, and expand again in spring."
  },
  {
    id: "redtail", name: "Red-tailed hawk", sci: "Buteo jamaicensis",
    icon: "🦅", group: "Bird",
    home: { low: 100, typical: 200, high: 400 },
    territory: 100,
    box: { w: -168, e: -52, s: 15, n: 62 },
    where: "Most of North America",
    note: "Defends the area around the nest and hunts across the rest. The bird on the highway light pole is very likely inside the range of the one on the next pole along."
  },
  {
    id: "barredowl", name: "Barred owl", sci: "Strix varia",
    icon: "🦉", group: "Bird",
    home: { low: 100, typical: 220, high: 400 },
    territory: 200,
    box: { w: -128, e: -58, s: 28, n: 58 },
    where: "Eastern North America and the Pacific Northwest",
    note: "Holds the same territory year after year and defends it all year, which is why the same stretch of woods keeps producing the same call."
  },
  {
    id: "redfox", name: "Red fox", sci: "Vulpes vulpes",
    icon: "🦊", group: "Mammal",
    home: { low: 50, typical: 300, high: 1500 },
    territory: 300,
    box: { w: -168, e: -52, s: 25, n: 72 },
    where: "Most of North America",
    note: "Range size tracks food almost exactly: rich suburban ground supports a fox family in 50 hectares, poor open country demands twenty times that."
  },
  {
    id: "turkey", name: "Wild turkey", sci: "Meleagris gallopavo",
    icon: "🦃", group: "Bird",
    home: { low: 200, typical: 500, high: 1500 },
    box: { w: -125, e: -60, s: 25, n: 50 },
    where: "Most of the US and into southern Canada",
    note: "Uses different ground season by season — winter flocks concentrate near food, then spread out to nest, so the year's range is far larger than any month's."
  },
  {
    id: "bobcat", name: "Bobcat", sci: "Lynx rufus",
    icon: "🐆", group: "Mammal",
    home: { low: 300, typical: 700, high: 4000 },
    territory: 700,
    box: { w: -125, e: -60, s: 18, n: 52 },
    where: "Most of the US, into Mexico and southern Canada",
    note: "Males hold ranges two to three times the size of females' and overlap several of them. Present in far more suburbs than people realise, and almost never seen."
  },
  {
    id: "coyote", name: "Coyote", sci: "Canis latrans",
    icon: "🐺", group: "Mammal",
    home: { low: 300, typical: 1200, high: 3000 },
    territory: 1200,
    box: { w: -168, e: -55, s: 10, n: 70 },
    where: "All of North America",
    note: "Territorial packs hold ground; lone transients slip between those territories and may cover far more. Urban coyotes run at the small end of this range."
  },
  {
    id: "heron", name: "Great blue heron", sci: "Ardea herodias",
    icon: "🪶", group: "Bird",
    home: { low: 700, typical: 5000, high: 30000 },
    foraging: true,
    box: { w: -168, e: -52, s: 15, n: 62 },
    where: "Most of North America",
    note: "This one is not a home range. Herons nest in colonies and commute out to feed, commonly 3 to 8 kilometres and sometimes much further, so the circle shows how far the daily flight reaches — not ground the bird holds."
  },
  {
    id: "blackbear", name: "American black bear", sci: "Ursus americanus",
    icon: "🐻", group: "Mammal",
    home: { low: 500, typical: 2000, high: 20000 },
    box: { w: -168, e: -55, s: 25, n: 70 },
    where: "Forested North America",
    note: "The figure here is for a female. Males range from five to ten times wider and wander enormously in the breeding season, which is when one turns up in a suburb."
  }
];
