/* =====================================================================
   Plant data and season maths for the summer garden planner.

   ONE THING TO UNDERSTAND BEFORE EDITING THESE NUMBERS.

   A USDA hardiness zone describes the average annual MINIMUM WINTER
   temperature. It tells you which perennials survive the winter. It does
   not, by itself, tell you anything about growing tomatoes — every plant
   in this file is an annual that lives and dies inside one summer, and
   what actually governs those is the frost-free window:

       last spring frost  ->  first autumn frost

   Zone is used here only as the thing people actually know off the top
   of their head, and it is converted immediately into a typical frost
   window, which is what every date in the plan is computed from. The
   window is an average for the zone and can be off by two or three weeks
   for a given garden — a hilltop and the valley below it are frequently
   a zone apart — so the app says so and lets the date be overridden.

   SPACING is in inches: `spacing` between plants along a row,
   `rowSpacing` between one row and the next. Both are the roomy end of
   what seed packets advise, because crowded plants in a home bed lose
   more to mildew and competition than the extra plants ever return.

   `out` is in WEEKS relative to the last frost: negative means it can go
   out before the frost date (hardy), positive means wait until after
   (tender). `indoorWeeks` is how long before the last frost to start
   seeds inside.

   YIELDS are per plant, over a season, as a wide low-high span. They are
   the least reliable numbers here — a tomato's output varies several
   fold with variety, soil and water — and are presented as rough.
   ===================================================================== */

/* Typical frost dates by USDA zone (month/day), for the contiguous US.
   Averages: roughly half of years are frostier than this. */
window.ZONES = [
  { z: "3",  last: [5, 22], first: [9, 18], label: "Zone 3 · very cold (−40 to −30°F)" },
  { z: "4",  last: [5, 15], first: [9, 26], label: "Zone 4 · cold (−30 to −20°F)" },
  { z: "5",  last: [5,  6], first: [10, 6], label: "Zone 5 · cold (−20 to −10°F)" },
  { z: "6",  last: [4, 24], first: [10,17], label: "Zone 6 · temperate (−10 to 0°F)" },
  { z: "7",  last: [4,  9], first: [11, 1], label: "Zone 7 · mild (0 to 10°F)" },
  { z: "8",  last: [3, 23], first: [11,16], label: "Zone 8 · warm (10 to 20°F)" },
  { z: "9",  last: [2, 22], first: [12,10], label: "Zone 9 · hot (20 to 30°F)" },
  { z: "10", last: [1, 20], first: [12,31], label: "Zone 10 · nearly frost-free (30 to 40°F)" }
];

window.PLANTS = [
  /* ------------------------------------------------------------ food */
  {
    id: "cherrytomato", name: "Cherry tomatoes", emoji: "🍅", kind: "veg",
    family: "nightshade", raw: true, spacing: 24, rowSpacing: 36, height: 72,
    dtm: 65, start: "transplant", indoorWeeks: 6, out: 1, sun: 6,
    support: "cage", yield: [4, 8, "lb"],
    note: "The one crop that reliably out-produces what you expected. One or two plants feed a household; four will defeat you."
  },
  {
    id: "tomato", name: "Slicing tomatoes", emoji: "🍅", kind: "veg",
    family: "nightshade", raw: true, spacing: 24, rowSpacing: 36, height: 60,
    dtm: 80, start: "transplant", indoorWeeks: 6, out: 1, sun: 6,
    support: "cage", yield: [8, 15, "lb"],
    note: "Needs the longest warm run of anything here. In a short season, buy transplants rather than starting seed."
  },
  {
    id: "bushbean", name: "Bush beans", emoji: "🫘", kind: "veg",
    family: "legume", raw: true, spacing: 4, rowSpacing: 18, height: 20,
    dtm: 55, start: "direct", out: 1, sun: 6, succession: 14,
    yield: [0.3, 0.6, "lb"],
    note: "Sow a new short row every two weeks and you pick beans all summer instead of all at once in August."
  },
  {
    id: "polebean", name: "Pole beans", emoji: "🫛", kind: "veg",
    family: "legume", raw: true, spacing: 6, rowSpacing: 30, height: 84,
    dtm: 65, start: "direct", out: 1, sun: 6, support: "trellis",
    yield: [1, 2, "lb"],
    note: "Three times the crop of bush beans from the same floor space, because the growing happens upward. Needs something 6ft+ to climb."
  },
  {
    id: "snappea", name: "Sugar snap peas", emoji: "🫛", kind: "veg",
    family: "legume", raw: true, spacing: 2, rowSpacing: 24, height: 60,
    dtm: 60, start: "direct", out: -4, sun: 6, support: "trellis",
    yield: [0.3, 0.5, "lb"],
    note: "A spring crop, not a summer one: sow as early as the ground can be worked and it is finished by the time the heat arrives. Follow it with beans in the same space."
  },
  {
    id: "cucumber", name: "Cucumbers", emoji: "🥒", kind: "veg",
    family: "cucurbit", raw: true, spacing: 12, rowSpacing: 36, height: 60,
    dtm: 58, start: "direct", out: 1, sun: 6, support: "trellis",
    pollinated: "insect", yield: [3, 8, "lb"],
    note: "Grow them up a trellis: straighter fruit, far less mildew, and a fraction of the ground space."
  },
  {
    id: "zucchini", name: "Zucchini / summer squash", emoji: "🥒", kind: "veg",
    family: "cucurbit", spacing: 30, rowSpacing: 42, height: 30,
    dtm: 52, start: "direct", out: 1, sun: 6, pollinated: "insect",
    yield: [6, 12, "lb"],
    note: "Two plants is a generous supply. Every gardener who planted six has a story about it."
  },
  {
    id: "pepper", name: "Sweet peppers", emoji: "🫑", kind: "veg",
    family: "nightshade", raw: true, spacing: 18, rowSpacing: 24, height: 30,
    dtm: 75, start: "transplant", indoorWeeks: 8, out: 2, sun: 6,
    yield: [2, 4, "lb"],
    note: "Slower and fussier about cold than tomatoes — wait for genuinely warm nights before setting them out, or they sulk for a month."
  },
  {
    id: "hotpepper", name: "Hot peppers", emoji: "🌶️", kind: "veg",
    family: "nightshade", spacing: 18, rowSpacing: 24, height: 30,
    dtm: 70, start: "transplant", indoorWeeks: 8, out: 2, sun: 6,
    yield: [1, 3, "lb"],
    note: "Hotter and more productive in a hot summer; a cool damp year gives mild fruit."
  },
  {
    id: "lettuce", name: "Leaf lettuce", emoji: "🥬", kind: "veg",
    family: "aster", raw: true, spacing: 8, rowSpacing: 12, height: 10,
    dtm: 50, start: "direct", out: -3, sun: 4, succession: 14,
    yield: [0.5, 0.8, "lb"],
    note: "Turns bitter and bolts in high summer. Sow in spring, stop, then start again in late summer for an autumn crop."
  },
  {
    id: "spinach", name: "Spinach", emoji: "🥬", kind: "veg",
    family: "amaranth", raw: true, spacing: 4, rowSpacing: 12, height: 8,
    dtm: 42, start: "direct", out: -4, sun: 4,
    yield: [0.2, 0.4, "lb"],
    note: "Faster to bolt than lettuce. Treat it as a spring and autumn crop and do not fight it in July."
  },
  {
    id: "kale", name: "Kale", emoji: "🥬", kind: "veg",
    family: "brassica", raw: true, spacing: 18, rowSpacing: 24, height: 30,
    dtm: 60, start: "transplant", indoorWeeks: 5, out: -2, sun: 5,
    yield: [1, 3, "lb"],
    note: "Picks all season from the same plants if you take the lower leaves and leave the crown. Sweeter after a frost."
  },
  {
    id: "chard", name: "Swiss chard", emoji: "🥬", kind: "veg",
    family: "amaranth", spacing: 10, rowSpacing: 18, height: 24,
    dtm: 55, start: "direct", out: -2, sun: 5,
    yield: [1, 2, "lb"],
    note: "The one leafy green that shrugs off summer heat. Cut outer stems and it keeps producing until hard frost."
  },
  {
    id: "carrot", name: "Carrots", emoji: "🥕", kind: "veg",
    family: "umbel", raw: true, spacing: 3, rowSpacing: 12, height: 12,
    dtm: 75, start: "direct", out: -2, sun: 6,
    yield: [0.25, 0.4, "lb"],
    note: "The seed is tiny and slow — keep the surface damp for the two to three weeks it takes to come up, and thin ruthlessly or you get orange string."
  },
  {
    id: "radish", name: "Radishes", emoji: "🌶️", kind: "veg",
    family: "brassica", raw: true, spacing: 2, rowSpacing: 8, height: 8,
    dtm: 28, start: "direct", out: -4, sun: 5, succession: 10,
    yield: [0.05, 0.1, "lb"],
    note: "Ready in under a month — the fastest thing in the garden, and the best crop to hand a child."
  },
  {
    id: "beet", name: "Beets", emoji: "🍠", kind: "veg",
    family: "amaranth", raw: true, spacing: 4, rowSpacing: 12, height: 14,
    dtm: 58, start: "direct", out: -3, sun: 6,
    yield: [0.25, 0.5, "lb"],
    note: "Each 'seed' is a cluster of several, so thinning is not optional. The thinnings are good in salad."
  },
  {
    id: "scallion", name: "Scallions", emoji: "🧅", kind: "veg",
    family: "allium", raw: true, spacing: 2, rowSpacing: 12, height: 18,
    dtm: 65, start: "direct", out: -3, sun: 5,
    yield: [0.05, 0.1, "lb"],
    note: "Takes almost no room, and you pull them as you need them rather than all at once."
  },
  {
    id: "corn", name: "Sweet corn", emoji: "🌽", kind: "veg",
    family: "grass", spacing: 12, rowSpacing: 30, height: 84,
    dtm: 80, start: "direct", out: 1, sun: 6, pollinated: "wind", minRows: 3,
    yield: [1, 2, "ears"],
    note: "Wind-pollinated, so it must go in a block of at least three or four short rows — a single long row gives half-empty cobs. Hungry, thirsty, and a poor use of a small bed."
  },
  {
    id: "eggplant", name: "Eggplant", emoji: "🍆", kind: "veg",
    family: "nightshade", spacing: 24, rowSpacing: 30, height: 36,
    dtm: 80, start: "transplant", indoorWeeks: 8, out: 2, sun: 6,
    yield: [3, 6, "lb"],
    note: "The most heat-hungry thing on this list. Below zone 6 it needs a warm sheltered spot to be worth the space."
  },
  {
    id: "potato", name: "Potatoes", emoji: "🥔", kind: "veg",
    family: "nightshade", spacing: 12, rowSpacing: 30, height: 24,
    dtm: 95, start: "tuber", out: -2, sun: 6,
    yield: [2, 4, "lb"],
    note: "Grown from seed potatoes, not seed. Keep the developing tubers covered with soil or they green and turn inedible."
  },
  {
    id: "wintersquash", name: "Winter squash / pumpkin", emoji: "🎃", kind: "veg",
    family: "cucurbit", spacing: 48, rowSpacing: 72, height: 24,
    dtm: 100, start: "direct", out: 1, sun: 6, pollinated: "insect",
    yield: [10, 20, "lb"],
    note: "Sprawls ten feet in every direction and occupies its ground from June to October. Wonderful, and a serious commitment of space."
  },
  {
    id: "basil", name: "Basil", emoji: "🌿", kind: "herb",
    family: "mint", raw: true, spacing: 12, rowSpacing: 18, height: 24,
    dtm: 60, start: "transplant", indoorWeeks: 6, out: 2, sun: 6,
    yield: [0.3, 0.6, "lb"],
    note: "Pinch the growing tip the moment you see flower buds and the plant stays leafy for months instead of going woody."
  },
  {
    id: "cilantro", name: "Cilantro", emoji: "🌿", kind: "herb",
    family: "umbel", raw: true, spacing: 6, rowSpacing: 12, height: 18,
    dtm: 45, start: "direct", out: -2, sun: 5, succession: 21,
    yield: [0.1, 0.2, "lb"],
    note: "Bolts within weeks in warm weather no matter what you do. The answer is a new small sowing every three weeks, not a bigger patch."
  },

  /* --------------------------------------------------------- flowers */
  {
    id: "zinnia", name: "Zinnias", emoji: "🌸", kind: "flower",
    spacing: 10, rowSpacing: 14, height: 30, dtm: 65, start: "direct",
    out: 1, sun: 6, cut: true, pollinator: true,
    note: "The most forgiving cut flower there is, and the more you cut the more it makes. Cut hard, down to a leaf pair, not just the bloom."
  },
  {
    id: "sunflower", name: "Branching sunflowers", emoji: "🌻", kind: "flower",
    spacing: 15, rowSpacing: 24, height: 72, dtm: 70, start: "direct",
    out: 1, sun: 6, cut: true, pollinator: true,
    note: "Branching varieties give a dozen stems each; the single-stem giants give one huge head and nothing else. Sow a new row every three weeks."
  },
  {
    id: "cosmos", name: "Cosmos", emoji: "🌸", kind: "flower",
    spacing: 12, rowSpacing: 18, height: 42, dtm: 70, start: "direct",
    out: 1, sun: 6, cut: true, pollinator: true,
    note: "Thrives on poor soil and neglect — rich ground gives you four feet of foliage and few flowers."
  },
  {
    id: "marigold", name: "Marigolds", emoji: "🌼", kind: "flower",
    spacing: 10, rowSpacing: 12, height: 14, dtm: 60, start: "transplant",
    indoorWeeks: 5, out: 1, sun: 6, pollinator: true,
    note: "Dependable low colour for a bed edge. The folklore about repelling every garden pest is mostly that; the flowers themselves are still worth the edge."
  },
  {
    id: "nasturtium", name: "Nasturtiums", emoji: "🌼", kind: "flower",
    spacing: 12, rowSpacing: 14, height: 12, dtm: 55, start: "direct",
    out: 1, sun: 5, pollinator: true, edible: true,
    note: "Leaves and flowers are both edible and peppery. Like cosmos, it flowers better on thin soil."
  },
  {
    id: "calendula", name: "Calendula", emoji: "🌼", kind: "flower",
    spacing: 10, rowSpacing: 14, height: 20, dtm: 60, start: "direct",
    out: -2, sun: 5, cut: true, pollinator: true, edible: true,
    note: "Hardy enough to sow before the last frost, and it keeps going into the cold at the other end of the season."
  },
  {
    id: "alyssum", name: "Sweet alyssum", emoji: "🤍", kind: "flower",
    spacing: 6, rowSpacing: 8, height: 6, dtm: 60, start: "transplant",
    out: -1, sun: 5, pollinator: true,
    note: "Low white froth for the front edge, and genuinely useful: the tiny flowers feed hoverflies, whose larvae eat aphids."
  },
  {
    id: "snapdragon", name: "Snapdragons", emoji: "🌷", kind: "flower",
    spacing: 8, rowSpacing: 12, height: 30, dtm: 90, start: "transplant",
    indoorWeeks: 8, out: -2, sun: 6, cut: true,
    note: "Slow from seed and worth buying as plants. Tolerates cold well, so it can go out before the frost date."
  },
  {
    id: "celosia", name: "Celosia", emoji: "🌺", kind: "flower",
    spacing: 10, rowSpacing: 14, height: 30, dtm: 80, start: "transplant",
    indoorWeeks: 6, out: 1, sun: 6, cut: true,
    note: "Holds its colour dried as well as fresh, and stands up to real heat."
  },
  {
    id: "cornflower", name: "Bachelor's buttons", emoji: "💙", kind: "flower",
    spacing: 8, rowSpacing: 12, height: 30, dtm: 70, start: "direct",
    out: -3, sun: 6, cut: true, pollinator: true,
    note: "One of the earliest things you can sow, and a true blue, which is rare."
  },
  {
    id: "dahlia", name: "Dahlias", emoji: "🌺", kind: "flower",
    spacing: 20, rowSpacing: 26, height: 42, dtm: 100, start: "tuber",
    out: 1, sun: 6, cut: true,
    note: "Grown from tubers planted after frost. Needs staking and deadheading, and repays both from midsummer until frost kills it."
  },
  {
    id: "gomphrena", name: "Globe amaranth", emoji: "💜", kind: "flower",
    spacing: 10, rowSpacing: 14, height: 24, dtm: 85, start: "transplant",
    indoorWeeks: 6, out: 1, sun: 6, cut: true,
    note: "Unbothered by heat and drought once established, and the papery heads last indefinitely dried."
  },
  {
    id: "salvia", name: "Annual salvia", emoji: "❤️", kind: "flower",
    spacing: 10, rowSpacing: 14, height: 24, dtm: 75, start: "transplant",
    indoorWeeks: 8, out: 1, sun: 6, pollinator: true,
    note: "The red tubular kinds are hummingbird flowers — shaped for a bird's bill rather than a bee's tongue."
  },
  {
    id: "borage", name: "Borage", emoji: "💙", kind: "flower",
    spacing: 15, rowSpacing: 20, height: 30, dtm: 55, start: "direct",
    out: -1, sun: 5, pollinator: true, edible: true,
    note: "Among the best bee plants you can sow, and it refills its nectar within minutes of being emptied. Self-seeds enthusiastically."
  },
  {
    id: "tithonia", name: "Mexican sunflower", emoji: "🧡", kind: "flower",
    spacing: 20, rowSpacing: 28, height: 60, dtm: 85, start: "direct",
    out: 1, sun: 6, cut: true, pollinator: true,
    note: "A magnet for monarchs and other big butterflies late in the season, when little else is still feeding them."
  },
  {
    id: "amaranthflower", name: "Ornamental amaranth", emoji: "🌾", kind: "flower",
    spacing: 14, rowSpacing: 20, height: 60, dtm: 80, start: "direct",
    out: 1, sun: 6, cut: true,
    note: "Tall, heavy, dramatic drooping tassels. Give it the back row and something to lean on in wind."
  },
  {
    id: "statice", name: "Statice", emoji: "💜", kind: "flower",
    spacing: 10, rowSpacing: 12, height: 24, dtm: 100, start: "transplant",
    indoorWeeks: 8, out: -1, sun: 6, cut: true,
    note: "The classic everlasting — cut it, hang it upside down in the dark, and it keeps its colour for a year."
  }
];
