/* =====================================================================
   Wildfire sizes, for drawing to scale on a map.

   WHAT THESE NUMBERS ARE. Final reported burned area for each fire, in
   acres, which is the unit US fire agencies report in. Figures come from
   the agencies that manage the incident — CAL FIRE, the National
   Interagency Fire Center, provincial agencies in Canada, state agencies
   in Australia — and are rounded here. Final acreage is itself revised
   for months after a fire is out as mapping is refined, so treat every
   number as good to about the nearest percent, not the nearest acre.

   THIS IS NOT LIVE DATA, AND THE FILE IS HONEST ABOUT WHICH YEAR EACH
   FIRE IS FROM. A page calling itself "the biggest fires of the year"
   would need a feed from NIFC or a national agency, refreshed daily.
   This is a fixed set of fires whose final sizes are settled and
   well documented, each labelled with its year, so nothing here goes
   quietly stale or claims to know about a season still burning.

   AREA IS NOT SEVERITY, and the set is chosen to make that obvious.
   The Lahaina fire is the smallest entry here by a wide margin and
   killed more people than any other US fire in over a century. A
   hundred thousand acres of remote forest and six thousand acres of
   a town are not comparable things, and the app says so.

   `kind: "season"` marks entries that are a whole fire season across a
   country rather than one fire. They are included because the scale is
   the point, and they are drawn and labelled differently.
   ===================================================================== */

window.ACRE_KM2 = 0.00404686;

/* Familiar areas, in square kilometres, for "this fire would have covered…".
   City figures are the municipality proper unless noted. */
window.YARDSTICKS = [
  { name: "Central Park", km2: 3.41 },
  { name: "Manhattan", km2: 59.1 },
  { name: "Paris, inside the Périphérique", km2: 105.4 },
  { name: "San Francisco", km2: 121.4 },
  { name: "Washington, DC", km2: 177 },
  { name: "Chicago", km2: 589 },
  { name: "New York City, all five boroughs", km2: 778 },
  { name: "Los Angeles", km2: 1214 },
  { name: "Greater London", km2: 1572 },
  { name: "Yosemite National Park", km2: 3029 },
  { name: "Rhode Island", km2: 4001 },
  { name: "Delaware", km2: 6446 },
  { name: "Connecticut", km2: 14357 },
  { name: "Massachusetts", km2: 27336 },
  { name: "Switzerland", km2: 41285 },
  { name: "Ireland", km2: 70273 },
  { name: "England", km2: 130279 }
];

window.FIRES = [
  {
    id: "lahaina", name: "Lahaina Fire", year: 2023, where: "Maui, Hawaii",
    acres: 2170, deaths: 102, structures: 2200,
    note: "The smallest fire on this list by a factor of a thousand, and the deadliest US wildfire in more than a century. A dry, wind-driven grass fire reached a town built to the water's edge with one road out. Keep this one in mind whenever a number below looks more frightening."
  },
  {
    id: "marshall", name: "Marshall Fire", year: 2021, where: "Boulder County, Colorado",
    acres: 6026, deaths: 2, structures: 1084,
    note: "A grass fire in suburbs, in December, with no snow on the ground and gusts over 100 mph. The most destructive fire in Colorado history burned an area you could walk across in two hours."
  },
  {
    id: "eaton", name: "Eaton Fire", year: 2025, where: "Altadena, California",
    acres: 14021, deaths: 19, structures: 9400,
    note: "One of two fires that burned in Los Angeles County in the same January windstorm, in the middle of what should have been the wet season."
  },
  {
    id: "palisades", name: "Palisades Fire", year: 2025, where: "Los Angeles, California",
    acres: 23448, deaths: 12, structures: 6800,
    note: "Burned through the Pacific Palisades in Santa Ana winds that grounded the firefighting aircraft on which Southern California normally depends."
  },
  {
    id: "tubbs", name: "Tubbs Fire", year: 2017, where: "Napa and Sonoma, California",
    acres: 36807, deaths: 22, structures: 5600,
    note: "Ran twelve miles in three hours and crossed a six-lane freeway into the Coffey Park neighbourhood of Santa Rosa, which is not hillside chaparral but ordinary suburban street grid."
  },
  {
    id: "camp", name: "Camp Fire", year: 2018, where: "Butte County, California",
    acres: 153336, deaths: 85, structures: 18800,
    note: "Destroyed the town of Paradise in a morning. The deadliest and most destructive fire in California history, started by a transmission line failure and driven by wind through a town with limited evacuation routes."
  },
  {
    id: "rim", name: "Rim Fire", year: 2013, where: "Sierra Nevada, California",
    acres: 257314,
    note: "Burned deep into Yosemite National Park's backcountry. Largely remote forest — a great deal of land and very few buildings, which is the opposite trade from the fires above."
  },
  {
    id: "cedar", name: "Cedar Fire", year: 2003, where: "San Diego County, California",
    acres: 273246, deaths: 15, structures: 2820,
    note: "Held the record as California's largest fire for fifteen years. Started by a lost hunter's signal fire."
  },
  {
    id: "thomas", name: "Thomas Fire", year: 2017, where: "Ventura and Santa Barbara, California",
    acres: 281893, deaths: 2, structures: 1063,
    note: "Burned into January. Its real toll came afterwards: rain on the bared slopes brought the Montecito debris flows, which killed 23 people three weeks after the fire was contained."
  },
  {
    id: "bootleg", name: "Bootleg Fire", year: 2021, where: "Southern Oregon",
    acres: 413765,
    note: "Large enough to generate its own weather, including fire clouds that collapsed and drove the flames in unpredictable directions. Its smoke turned the sky orange over New York City, 2,500 miles away."
  },
  {
    id: "park", name: "Park Fire", year: 2024, where: "Northern California",
    acres: 429603, structures: 709,
    note: "Burned much of the same ground as the Camp Fire six years earlier, in a landscape that had not recovered."
  },
  {
    id: "mendocino", name: "Mendocino Complex", year: 2018, where: "Northern California",
    acres: 459123,
    note: "Two fires that merged. Briefly the largest in California's recorded history, a record that stood for two years."
  },
  {
    id: "yellowstone", name: "Yellowstone fires", year: 1988, where: "Wyoming and Montana", kind: "complex",
    acres: 793880,
    note: "Burned roughly a third of Yellowstone National Park and changed how the US thinks about fire suppression. The park did not need saving: lodgepole pine cones open in fire, and the forest that came back was the point."
  },
  {
    id: "dixie", name: "Dixie Fire", year: 2021, where: "Northern California",
    acres: 963309, structures: 1329,
    note: "The first fire recorded to burn across the crest of the Sierra Nevada. Consumed the town of Greenville in about half an hour."
  },
  {
    id: "augustcomplex", name: "August Complex", year: 2020, where: "Northern California",
    acres: 1032648, kind: "complex",
    note: "California's first recorded gigafire — over a million acres. It began as 38 separate lightning fires that grew together over two months."
  },
  {
    id: "smokehouse", name: "Smokehouse Creek Fire", year: 2024, where: "Texas Panhandle",
    acres: 1058482, deaths: 2,
    note: "The largest fire in Texas history, and it burned grassland rather than forest — it crossed a million acres in about 48 hours, far faster than any timber fire on this list."
  },
  {
    id: "taylor", name: "Taylor Complex", year: 2004, where: "Interior Alaska", kind: "complex",
    acres: 1305000,
    note: "Part of a season that burned over six million acres in Alaska. Boreal fires of this size barely register in the news because almost nobody lives underneath them."
  },
  {
    id: "gospers", name: "Gospers Mountain Fire", year: 2019, where: "New South Wales, Australia",
    acres: 1265000,
    note: "A single fire the Australian press called a megafire, burning north-west of Sydney for nearly three months during the Black Summer."
  },
  {
    id: "donniecreek", name: "Donnie Creek Fire", year: 2023, where: "British Columbia, Canada",
    acres: 1435000,
    note: "The largest fire in British Columbia's recorded history, in a season that broke every Canadian record at once."
  },
  {
    id: "fortmcmurray", name: "Horse River Fire", year: 2016, where: "Alberta, Canada",
    acres: 1456000, structures: 2400,
    note: "Forced the evacuation of Fort McMurray — 88,000 people out in a day, the largest wildfire evacuation in Canadian history, and the costliest disaster in the country's history."
  },
  {
    id: "chinchaga", name: "Chinchaga Fire", year: 1950, where: "British Columbia and Alberta",
    acres: 3500000,
    note: "The largest single recorded fire in North American history, burning for five months through country so empty it was largely left to run. Its smoke dimmed the sun across the eastern seaboard and Europe — the 'great smoke pall' of 1950."
  },

  /* ----------------------------------------------------- whole seasons */
  {
    id: "canada2023", name: "Canada's 2023 season", year: 2023, where: "All of Canada", kind: "season",
    acres: 45000000, deaths: 8,
    note: "Not one fire but a whole country's year: roughly 18.5 million hectares, more than six times the previous Canadian average, with smoke that closed schools as far south as Washington DC."
  },
  {
    id: "blacksummer", name: "Australia's Black Summer", year: 2020, where: "Eastern Australia", kind: "season",
    acres: 59000000, deaths: 34, structures: 3500,
    note: "A season, not a fire: roughly 24 million hectares. Estimates of animals killed or displaced run to around three billion."
  }
];
