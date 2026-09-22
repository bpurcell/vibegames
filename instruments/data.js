/* =====================================================================
   The Instrument Cabinet — an homage to the 1990s multimedia CD-ROM
   encyclopedias, with one important difference.

   THE SOUNDS HERE ARE NOT RECORDINGS. There isn't a byte of sampled
   audio in this project. Every note is computed in the browser from a
   model of how that instrument actually makes sound, and the `voice`
   block on each entry IS that model. Which means the parameters below
   are not arbitrary knob settings — most of them state something true
   about the physics:

   * A clarinet's bore is a cylinder stopped at one end, which suppresses
     the even harmonics. Its partial list is 1, 3, 5, 7 — and that, more
     than anything else, is why a clarinet sounds like a clarinet.
   * A marimba bar is undercut until its first overtone is two octaves
     above the fundamental — a 4:1 ratio. A xylophone bar is cut to 3:1,
     a twelfth. Same mallet, same wood, different tuning, and you can
     hear which is which instantly.
   * A plucked string is a delay line with losses, which is what the
     Karplus-Strong engine literally is: fill a buffer the length of one
     period with noise, then circulate it through a lowpass. That is not
     an imitation of a pluck, it's a simulation of one.
   * Brass instruments brighten as they get louder because the pressure
     wave steepens in the bore, so `brightenWithLevel` opens the filter
     with the envelope rather than holding it still.

   Where a model is a rough caricature rather than real physics, the
   entry's `caveat` says so. Nothing here should be mistaken for the
   real instrument, and the app says as much on every card.

   `partials` are [multiple of the fundamental, relative amplitude,
   decay rate] — higher partials decay faster on nearly every real
   instrument, which is why a note gets mellower as it rings.
   ===================================================================== */

window.FAMILIES = {
  strings:    { label: "Strings",     hs: "Chordophone",  color: "#d9a441",
                how: "A stretched string is set moving — bowed, plucked or struck — and the body amplifies it." },
  woodwind:   { label: "Woodwind",    hs: "Aerophone",    color: "#7fc4a0",
                how: "A column of air is set vibrating by a reed or by air splitting across an edge. Holes shorten the column." },
  brass:      { label: "Brass",       hs: "Aerophone",    color: "#e08a4a",
                how: "The player's lips buzz into a cup, and a long folded tube selects which harmonics sing." },
  percussion: { label: "Percussion",  hs: "Idiophone / Membranophone", color: "#c98ad4",
                how: "Something solid is struck — a bar, a membrane, a sheet of metal — and rings at its own modes." },
  keyboard:   { label: "Keyboard",    hs: "Chordophone / Aerophone",  color: "#7fa8e0",
                how: "A mechanism stands between the player and the sound: hammers, plectra, or valves admitting air to pipes." }
};

window.INSTRUMENTS = [
  /* -------------------------------------------------------- strings */
  {
    id: "violin", name: "Violin", family: "strings", emoji: "🎻",
    region: "Europe", origin: "Northern Italy, early 1500s", range: "G3 – A7",
    tuning: "G3 D4 A4 E5, in fifths",
    blurb: "The shape settled in Cremona within a couple of generations and has barely moved since — Stradivari's instruments of 1700 are still the working standard, which is true of almost no other technology of that age.",
    physics: "The bow doesn't scrape the string, it grabs and releases it hundreds of times a second — the rosin sticks, the string is dragged sideways, it snaps back, and the cycle repeats. That stick-slip motion produces a sawtooth wave, which is why the harmonic series here runs full and even.",
    voice: { engine: "additive", partials: [[1,1,1.0],[2,.72,1.3],[3,.55,1.6],[4,.40,1.9],[5,.30,2.2],[6,.22,2.6],[7,.16,3.0],[8,.12,3.4]],
             attack: .09, release: .28, vibrato: { rate: 5.5, depth: .011, onset: .25 }, noise: { amount: .035, hp: 2200, decay: 9 } },
    phrase: [[7,1],[12,1],[11,.5],[9,.5],[7,2]]
  },
  {
    id: "cello", name: "Cello", family: "strings", emoji: "🎻",
    region: "Europe", origin: "Northern Italy, 1500s", range: "C2 – C6",
    tuning: "C2 G2 D3 A3, in fifths",
    blurb: "Tuned an octave below the viola, and the instrument most often described as closest to the human voice — its range sits almost exactly over a choir's.",
    physics: "The same stick-slip bowing as the violin over a much longer string, so the harmonics are closer together and the body resonances fall lower. The bigger box radiates the low end that a violin cannot.",
    voice: { engine: "additive", partials: [[1,1,.85],[2,.78,1.1],[3,.52,1.4],[4,.34,1.7],[5,.24,2.0],[6,.17,2.4],[7,.11,2.8]],
             attack: .12, release: .35, vibrato: { rate: 4.8, depth: .009, onset: .3 }, noise: { amount: .03, hp: 1600, decay: 8 } },
    phrase: [[0,1.5],[3,.5],[7,1],[3,1],[0,2]]
  },
  {
    id: "guitar", name: "Classical guitar", family: "strings", emoji: "🎸",
    region: "Spain", origin: "Andalusia, 1800s in its modern form", range: "E2 – B5",
    tuning: "E2 A2 D3 G3 B3 E4",
    blurb: "Antonio de Torres fixed the modern proportions around 1850 — a bigger body and fan bracing — and every classical guitar since is a variation on his.",
    physics: "Pluck a string and you inject a sharp corner into it that runs up and down, losing its high frequencies a little more on each round trip. That decaying corner is exactly what the Karplus-Strong engine computes.",
    voice: { engine: "ks", damping: .4975, bright: .55, decay: 3.4, attack: .002 },
    phrase: [[0,.5],[4,.5],[7,.5],[12,.5],[7,.5],[4,.5],[0,1.5]]
  },
  {
    id: "harp", name: "Concert harp", family: "strings", emoji: "🎼",
    region: "Worldwide, ancient", origin: "Depicted in Egypt and Mesopotamia before 3000 BC", range: "C1 – G7",
    tuning: "47 strings, seven pedals",
    blurb: "One of the oldest instruments there is, and mechanically one of the most complicated: seven pedals, each with three notches, retune every string of that letter name across the whole instrument.",
    physics: "A plucked string again, but with no frets or fingerboard and a soundboard the length of the instrument, so the decay is long and the tone stays sweet. Less damping in the model than the guitar.",
    voice: { engine: "ks", damping: .4990, bright: .42, decay: 5.5, attack: .002 },
    phrase: [[0,.28],[4,.28],[7,.28],[12,.28],[16,.28],[19,.28],[24,1.6]]
  },
  {
    id: "banjo", name: "Five-string banjo", family: "strings", emoji: "🪕",
    region: "West Africa → America", origin: "Carried to the Americas by enslaved West Africans; the fifth string added in the 1800s", range: "C3 – A5",
    tuning: "gDGBD — the short fifth string is the highest, not the lowest",
    blurb: "Descended from West African lutes such as the akonting, and the odd short drone string beside the thumb is the survival of that ancestry.",
    physics: "The strings run over a bridge standing on a stretched drum head rather than a wooden plate. A membrane is light and lossy at low frequencies, so the bass drains away fast and the attack is all treble — hence the bright, short, cutting tone.",
    voice: { engine: "ks", damping: .4955, bright: .95, decay: 2.1, attack: .001 },
    phrase: [[0,.22],[7,.22],[12,.22],[7,.22],[0,.22],[7,.22],[12,.22],[16,.9]]
  },
  {
    id: "koto", name: "Koto", family: "strings", emoji: "🎋",
    region: "Japan", origin: "Arrived from China in the 7th–8th century", range: "About three octaves",
    tuning: "Thirteen strings over movable bridges, commonly in the pentatonic hirajōshi scale",
    blurb: "Japan's national instrument. The player retunes it by sliding the movable bridges rather than by turning pegs, so the scale itself is repositioned between pieces.",
    physics: "Silk or modern synthetic strings plucked with picks worn on three fingers, over a long hollow paulownia body. Comparatively heavy damping and a soft pluck give the characteristic woody, quickly-decaying note.",
    voice: { engine: "ks", damping: .4970, bright: .5, decay: 3.0, attack: .003 },
    phrase: [[0,.5],[2,.5],[5,.5],[7,.5],[10,.5],[12,1.5]],
    scaleOverride: [0,2,5,7,10,12]
  },
  {
    id: "sitar", name: "Sitar", family: "strings", emoji: "🎶",
    region: "North India", origin: "Mughal courts, roughly the 1700s", range: "About three octaves",
    tuning: "Six or seven played strings over eleven to thirteen sympathetic strings",
    blurb: "Beneath the played strings run a dozen more that nobody touches. They vibrate on their own whenever a matching pitch sounds, which is where the shimmering halo comes from.",
    physics: "The bridge is a wide curved plate, not a sharp edge — the string rolls along it as it vibrates, changing its speaking length within every cycle. That continuous re-excitation pumps energy into the upper harmonics and produces the buzzing jawari tone.",
    voice: { engine: "ks", damping: .4985, bright: 1.0, decay: 4.2, attack: .002, buzz: .32, sympathetic: true },
    phrase: [[0,.6],[1,.3],[4,.3],[5,.6],[7,1.2]],
    caveat: "The jawari buzz here is a crude waveshaper, not a rolling-bridge simulation, and the sympathetic strings are a fixed drone rather than true resonance."
  },

  /* ------------------------------------------------------- woodwind */
  {
    id: "flute", name: "Concert flute", family: "woodwind", emoji: "🪈",
    region: "Europe", origin: "Theobald Boehm's key system, 1847", range: "C4 – D7",
    tuning: "Transposes at concert pitch",
    blurb: "The only orchestral woodwind with no reed at all. Boehm's 1847 redesign put the holes where acoustics wanted them rather than where fingers could reach, and invented the key work to bridge the gap.",
    physics: "Air splits across the far edge of the blow hole and flips from one side to the other, driving the air column. It's an edge tone, and an inefficient one — a great deal of the breath never becomes sound, which is why the breathiness in the model is not an affectation.",
    voice: { engine: "additive", partials: [[1,1,1.0],[2,.28,1.8],[3,.10,2.6],[4,.05,3.4]],
             attack: .07, release: .18, vibrato: { rate: 5, depth: .008, onset: .3 }, noise: { amount: .16, hp: 1800, decay: 2.2 } },
    phrase: [[12,.5],[11,.25],[9,.25],[7,.5],[9,.5],[12,1.5]]
  },
  {
    id: "clarinet", name: "Clarinet", family: "woodwind", emoji: "🎷",
    region: "Europe", origin: "Nuremberg, around 1700", range: "D3 – B♭6",
    tuning: "Usually in B♭ — written C sounds B♭",
    blurb: "The instrument with the widest usable range of any woodwind, and the strangest register break: it overblows at the twelfth rather than the octave, so the fingerings change entirely halfway up.",
    physics: "A cylindrical tube closed at the reed end supports only odd harmonics — the even ones have a pressure node where the bore needs an antinode. That single fact gives the clarinet its hollow, woody low register AND explains the overblow at the twelfth, which is the third harmonic rather than the second.",
    voice: { engine: "additive", partials: [[1,1,1.0],[3,.55,1.5],[5,.28,2.0],[7,.16,2.6],[9,.09,3.2],[11,.05,3.8]],
             attack: .05, release: .16, noise: { amount: .05, hp: 2600, decay: 6 } },
    phrase: [[0,.5],[3,.5],[7,.5],[10,.5],[12,1],[10,.5],[7,1.5]]
  },
  {
    id: "oboe", name: "Oboe", family: "woodwind", emoji: "🎶",
    region: "Europe", origin: "The French court, mid-1600s", range: "B♭3 – A6",
    tuning: "Concert pitch; the orchestra tunes to its A",
    blurb: "The orchestra tunes to the oboe because its pitch is the least adjustable on the stage — the reed is so small and stiff that there is almost nowhere for it to go.",
    physics: "A conical bore with a double reed. The cone restores the even harmonics that the clarinet's cylinder suppresses, and the tiny reed aperture makes the spectrum extremely rich — the fundamental is weaker than several harmonics above it, which is what the ear hears as nasal.",
    voice: { engine: "additive", partials: [[1,.55,1.0],[2,1,1.2],[3,.85,1.5],[4,.6,1.8],[5,.45,2.1],[6,.3,2.5],[7,.22,2.9],[8,.15,3.3]],
             attack: .045, release: .14, vibrato: { rate: 5.2, depth: .007, onset: .3 }, noise: { amount: .04, hp: 3000, decay: 7 } },
    phrase: [[0,1],[4,.5],[7,.5],[5,.5],[4,.5],[0,2]]
  },
  {
    id: "bassoon", name: "Bassoon", family: "woodwind", emoji: "🎵",
    region: "Europe", origin: "Developed from the dulcian in the 1600s", range: "B♭1 – E5",
    tuning: "Concert pitch, reads bass and tenor clef",
    blurb: "Nearly eight feet of conical tube folded in half to make it playable. The finger holes are drilled at steep angles through thick wood so that the holes reach the bore where acoustics demands while the openings stay where hands can cover them.",
    physics: "A double reed on a long cone, like a very large oboe, but the length puts the harmonics close together and the wide bore favours the lower ones. The reedy edge survives; the nasal quality does not.",
    voice: { engine: "additive", partials: [[1,.8,.9],[2,1,1.1],[3,.6,1.4],[4,.42,1.7],[5,.26,2.1],[6,.15,2.5],[7,.09,3.0]],
             attack: .06, release: .2, noise: { amount: .045, hp: 1200, decay: 6 } },
    phrase: [[0,.5],[2,.5],[3,.5],[5,.5],[7,1],[3,1.5]]
  },
  {
    id: "didgeridoo", name: "Didgeridoo", family: "woodwind", emoji: "🪈",
    region: "Arnhem Land, Northern Australia", origin: "Aboriginal Australian; claims of great antiquity are common, firm evidence covers at least 1,500 years", range: "A single drone, usually D2 – F2",
    tuning: "Whatever pitch the termites left",
    blurb: "Made from a eucalyptus trunk hollowed out by termites, then cut and cleaned. The pitch of a given instrument is not chosen — it is whatever the insects happened to leave behind.",
    physics: "Lip-buzzed like a brass instrument, but the player shapes the mouth and tongue to move strong resonances — formants — across the fixed drone. Circular breathing keeps it unbroken for minutes. The model sweeps two formant filters over a steady buzz.",
    voice: { engine: "additive", partials: [[1,1,.35],[2,.5,.5],[3,.35,.6],[4,.28,.7],[5,.2,.85],[6,.16,1.0],[7,.12,1.2],[8,.1,1.4]],
             attack: .12, release: .3, formant: { f1: 320, f2: 1400, rate: .7, depth: .55 }, noise: { amount: .07, hp: 700, decay: 1.2 } },
    phrase: [[0,4]],
    caveat: "A real player's spectrum moves constantly with the tongue and voice. This sweeps two filters on a fixed cycle — the flavour, not the technique."
  },

  /* ---------------------------------------------------------- brass */
  {
    id: "trumpet", name: "Trumpet", family: "brass", emoji: "🎺",
    region: "Europe / worldwide", origin: "Valves invented around 1815; natural trumpets are ancient", range: "F♯3 – D6",
    tuning: "Usually in B♭",
    blurb: "Before valves, a trumpet could only play the notes of one harmonic series — which is why every baroque trumpet part lives high up, where those harmonics finally sit close enough together to make a tune.",
    physics: "The lips buzz and the tube decides which frequencies survive. The bell's flare matches the air inside to the air outside, radiating the high harmonics efficiently and outward — a trumpet is directional in a way a violin is not. Loud playing steepens the wave inside the bore, adding harmonics, so it gets brighter as well as louder.",
    voice: { engine: "additive", partials: [[1,.75,1.0],[2,1,1.1],[3,.85,1.25],[4,.7,1.4],[5,.55,1.6],[6,.42,1.85],[7,.3,2.1],[8,.22,2.4],[9,.15,2.8],[10,.1,3.2]],
             attack: .035, release: .16, brightenWithLevel: true, noise: { amount: .05, hp: 2500, decay: 12 } },
    phrase: [[0,.4],[4,.4],[7,.4],[12,1.2],[7,.4],[12,1.6]]
  },
  {
    id: "frenchhorn", name: "French horn", family: "brass", emoji: "📯",
    region: "Europe", origin: "From the hunting horn; valved from the 1800s", range: "B1 – F5",
    tuning: "In F, or a double horn in F and B♭",
    blurb: "Around twelve feet of tubing coiled into a circle, played with one hand inside the bell. Reckoned the hardest orchestral instrument to play cleanly, because the harmonics are packed so tightly that neighbouring notes are a hair apart on the lips.",
    physics: "A long narrow bore and a wide, slowly flaring bell. The flare radiates the top harmonics backwards into the room rather than forwards, which is why the horn sounds warm and unlocatable — you mostly hear it after it has bounced off something.",
    voice: { engine: "additive", partials: [[1,1,.9],[2,.8,1.05],[3,.55,1.25],[4,.35,1.45],[5,.22,1.7],[6,.14,2.0],[7,.08,2.4]],
             attack: .07, release: .28, brightenWithLevel: true, noise: { amount: .03, hp: 1500, decay: 9 } },
    phrase: [[0,1],[7,1],[12,1],[9,.5],[7,1.5]]
  },
  {
    id: "trombone", name: "Trombone", family: "brass", emoji: "🎺",
    region: "Europe", origin: "The sackbut, 1400s — essentially unchanged since", range: "E2 – F5",
    tuning: "Concert pitch, seven slide positions",
    blurb: "The only orchestral wind instrument that can play every pitch between two notes rather than only the notes themselves, because the slide is continuous where valves are discrete. It reached its modern form in the 1400s and has needed almost nothing since.",
    physics: "A mostly cylindrical bore, which keeps the tone bright and slightly harder than the horn's, and a slide that lengthens the tube smoothly instead of adding fixed loops.",
    voice: { engine: "additive", partials: [[1,.85,.9],[2,1,1.0],[3,.8,1.2],[4,.62,1.4],[5,.45,1.6],[6,.32,1.85],[7,.22,2.2],[8,.14,2.6]],
             attack: .05, release: .22, brightenWithLevel: true, noise: { amount: .04, hp: 1800, decay: 10 } },
    phrase: [[0,.75],[3,.25],[5,.5],[7,1.5]]
  },

  /* ----------------------------------------------------- percussion */
  {
    id: "marimba", name: "Marimba", family: "percussion", emoji: "🎼",
    region: "West Africa → Central America", origin: "African roots; the modern chromatic instrument developed in Guatemala and Mexico", range: "C2 – C7",
    tuning: "Bars tuned 1 : 4 : 10",
    blurb: "The underside of each bar is carved into an arch. How deeply it is cut sets not only the pitch but the relationship between the overtones, and a marimba is cut until the first overtone lands two octaves above the fundamental.",
    physics: "A free bar's natural overtones are wildly inharmonic — roughly 1 : 2.76 : 5.4, which sounds like a clank. Undercutting lowers the fundamental relative to the rest until the ratio reaches a musical 1 : 4 : 10. The tuned resonator tube beneath each bar reinforces the fundamental and little else, which is why the tone is round and dark.",
    voice: { engine: "additive", partials: [[1,1,2.6],[4,.32,6.5],[10,.09,12]],
             attack: .002, release: .05, noise: { amount: .07, hp: 3500, decay: 55 } },
    phrase: [[0,.3],[4,.3],[7,.3],[12,.3],[7,.3],[4,.3],[0,1.2]]
  },
  {
    id: "xylophone", name: "Xylophone", family: "percussion", emoji: "🎼",
    region: "Africa and Southeast Asia → worldwide", origin: "Ancient in both regions independently", range: "F4 – C8",
    tuning: "Bars tuned 1 : 3",
    blurb: "The same instrument as the marimba in every respect except the depth of the cut under the bar — and that one difference is audible from across a room.",
    physics: "Cut for a 1 : 3 ratio, putting the first overtone a twelfth above the fundamental rather than two octaves. An odd-numbered harmonic in a struck bar reads as hard and bright, and the bars are shorter and thicker, so everything decays faster too. Same mallet, same wood, different geometry.",
    voice: { engine: "additive", partials: [[1,1,4.5],[3,.5,9],[6,.16,16]],
             attack: .001, release: .04, noise: { amount: .12, hp: 5000, decay: 80 } },
    phrase: [[0,.22],[2,.22],[4,.22],[5,.22],[7,.22],[9,.22],[11,.22],[12,.9]]
  },
  {
    id: "timpani", name: "Timpani", family: "percussion", emoji: "🥁",
    region: "Middle East → Europe", origin: "From Arabic naqqara, in European orchestras from the 1600s", range: "D2 – A3 across a set",
    tuning: "Pedal-tuned; the only orchestral drums that play definite pitches",
    blurb: "A drum that plays actual notes, which is unusual — most drums have modes so far from a harmonic series that the ear refuses to hear a pitch at all.",
    physics: "A circular membrane's natural modes are ratios of Bessel function zeros — 1 : 1.59 : 2.14 : 2.30, nothing like a harmonic series. Two things fix it: the air enclosed in the kettle loads the membrane and pulls the modes toward 1 : 1.5 : 2 : 2.5, and striking a quarter of the way in from the rim rather than in the centre suppresses the worst offenders.",
    voice: { engine: "additive", partials: [[1,1,1.6],[1.5,.55,2.6],[2,.3,3.6],[2.5,.16,5],[3,.08,7]],
             attack: .004, release: .3, noise: { amount: .28, hp: 140, decay: 26 } },
    phrase: [[0,.5],[0,.5],[7,.5],[0,1.5]]
  },
  {
    id: "gong", name: "Tam-tam", family: "percussion", emoji: "🔔",
    region: "East and Southeast Asia", origin: "China, in use for well over a thousand years", range: "No definite pitch",
    tuning: "Deliberately untuned",
    blurb: "A tuned gong has a raised boss and sounds a note. A tam-tam is flat and is tuned to have no pitch at all — the sound climbs for several seconds after the strike, getting brighter as it goes.",
    physics: "A large flat sheet of bronze has modes so dense and so inharmonic that no pitch emerges. Strike it hard and it behaves nonlinearly: energy leaks from the low modes into higher ones over the seconds after impact, so the sound blooms upward instead of decaying away. The model fakes that with a rising filter.",
    voice: { engine: "inharmonic", partials: [[1,1],[1.73,.8],[2.41,.75],[3.14,.6],[4.07,.55],[5.31,.45],[6.88,.4],[8.9,.3],[11.4,.22]],
             attack: .01, decay: .55, bloom: true },
    phrase: [[0,4]],
    caveat: "The bloom is a filter sweep. Real nonlinear mode coupling in a bronze sheet is a research topic, not four lines of JavaScript."
  },
  {
    id: "steelpan", name: "Steel pan", family: "percussion", emoji: "🛢️",
    region: "Trinidad and Tobago", origin: "Invented in the 1930s–40s from oil drums",
    range: "About two and a half octaves on a lead pan",
    tuning: "Note areas hammered into the drum face",
    blurb: "The only entirely new acoustic instrument family to be invented and spread worldwide in the twentieth century, made from discarded oil barrels by people who had been banned from using drums.",
    physics: "The drum end is hammered into a bowl, then individual note areas are raised and grooved so each behaves as its own curved plate. The curvature is worked until the overtones fall on the octave and the twelfth — so unlike a flat sheet, a pan note has a clear pitch with a shimmering metallic halo above it.",
    voice: { engine: "additive", partials: [[1,1,2.2],[2,.62,3.4],[3,.4,4.6],[4,.2,6],[5.7,.12,8],[8.2,.07,11]],
             attack: .003, release: .12, noise: { amount: .09, hp: 4000, decay: 45 } },
    phrase: [[0,.3],[4,.3],[7,.3],[11,.3],[12,.3],[11,.3],[7,.9]]
  },

  /* ------------------------------------------------------- keyboard */
  {
    id: "piano", name: "Piano", family: "keyboard", emoji: "🎹",
    region: "Europe", origin: "Bartolomeo Cristofori, Florence, around 1700", range: "A0 – C8",
    tuning: "88 keys, equal temperament",
    blurb: "Cristofori's invention was not the sound but the escapement: a mechanism that throws the hammer at the string and lets go, so the hammer bounces clear instead of damping what it just struck. Everything else follows from that.",
    physics: "Real piano strings are stiff, not ideal, so their overtones run progressively sharp — the inharmonicity. Tuners answer it by stretching the octaves, tuning the top of the instrument sharp and the bottom flat so the overtones of one note line up with the fundamentals of another. A mathematically perfect piano sounds wrong.",
    voice: { engine: "additive", partials: [[1,1,1.1],[2,.62,1.5],[3,.42,1.9],[4,.28,2.3],[5,.19,2.8],[6,.13,3.3],[7,.09,3.9],[8,.06,4.5]],
             attack: .004, release: .25, inharmonicity: .00035, noise: { amount: .1, hp: 2500, decay: 45 } },
    phrase: [[0,.5],[4,.5],[7,.5],[12,.5],[11,.5],[7,.5],[4,1.5]]
  },
  {
    id: "harpsichord", name: "Harpsichord", family: "keyboard", emoji: "🎹",
    region: "Europe", origin: "1400s; displaced by the piano after 1750", range: "Usually four to five octaves",
    tuning: "Often unequal temperaments, where each key has its own colour",
    blurb: "Press a key and a quill plucks the string. Press it harder and the quill plucks it exactly as hard as before — the harpsichord has no dynamics from the fingers at all, which is precisely the problem the piano was invented to solve.",
    physics: "A plucked string rather than a struck one, with a very light case and no felt damping to speak of, so the attack is all edge and the spectrum stays bright for the whole note.",
    voice: { engine: "ks", damping: .4978, bright: 1.0, decay: 3.0, attack: .001 },
    phrase: [[0,.25],[2,.25],[4,.25],[5,.25],[7,.25],[9,.25],[11,.25],[12,1]]
  },
  {
    id: "organ", name: "Pipe organ", family: "keyboard", emoji: "⛪",
    region: "Europe / Mediterranean", origin: "The Greek hydraulis, 3rd century BC", range: "Whatever the builder gave it",
    tuning: "Stops named by the length of their longest pipe: 8′ sounds as written, 4′ an octave up",
    blurb: "Mechanically the most complex machine anyone built before the industrial revolution, and it predates the mechanical clock by a thousand years. Each stop is a complete rank of pipes, one per key.",
    physics: "A drawbar or stop adds a whole rank sounding at a fixed interval above the key — the octave, the twelfth, the fifteenth. The organist builds a timbre by choosing which harmonics to switch on, which is additive synthesis carried out with woodwork, several centuries before anyone had the word for it.",
    voice: { engine: "additive", partials: [[1,1,.1],[2,.6,.12],[3,.4,.15],[4,.32,.18],[6,.18,.22],[8,.14,.26]],
             attack: .07, release: .18, noise: { amount: .025, hp: 2000, decay: 4 } },
    phrase: [[0,1],[4,1],[7,1],[12,2]]
  }
];
