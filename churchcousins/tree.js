/* =====================================================================
   A family tree of Christian bodies — and the places it lies.

   READ THIS BEFORE TRUSTING THE SHAPE.

   Biological trees split and never rejoin, which is what makes "cousin"
   arithmetic work on them. Church history does not behave that way:

   * Bodies MERGE. The United Methodist Church (1968) and the United
     Church of Christ (1957) each have several parents. A single-parent
     tree can only show the largest one, so those nodes carry `merged`
     and the app says so rather than pretending.
   * Both sides of a split usually claim to BE the original. The 1054
     entry is modelled as a mutual division, with neither the Catholic
     nor the Orthodox Church shown as the parent of the other, because
     each holds that it is the continuing church and the other departed.
   * Some movements reject descent altogether. Restorationists teach a
     recovery of the first-century church that bypasses every later body.
     Where that claim is central, `offTree` marks it and the app refuses
     to compute a relationship rather than inventing one.
   * `kind: "branch"` means a new body formed while the parent carried on
     (Lutherans out of a continuing Catholic Church). `kind: "divide"`
     means one body became two and neither is simply the survivor.

   Dates are the conventional marker for a process that usually took
   decades — 1054 had been building for centuries and was not settled for
   centuries more. Sizes are rough and the definitions behind them are
   contested; they are here for scale, not precision.
   ===================================================================== */

window.TRADITIONS = {
  ancient:      { label: "Ancient churches",   color: "#c9a227" },
  orthodox:     { label: "Orthodox",           color: "#d9773b" },
  catholic:     { label: "Catholic",           color: "#d4b483" },
  lutheran:     { label: "Lutheran",           color: "#5b8dd9" },
  reformed:     { label: "Reformed",           color: "#4fa3a3" },
  anabaptist:   { label: "Anabaptist",         color: "#7ec87e" },
  anglican:     { label: "Anglican",           color: "#9b8ad4" },
  baptist:      { label: "Baptist",            color: "#e0728f" },
  methodist:    { label: "Methodist & Holiness", color: "#e8a13a" },
  pentecostal:  { label: "Pentecostal",        color: "#e05c5c" },
  restoration:  { label: "Restorationist",     color: "#8fa3bf" }
};

window.TREE = [
  {
    id: "early", name: "The early Church", short: "Early Church", year: 33,
    tradition: "ancient", parent: null,
    over: null,
    note: "One communion in principle, and argumentative in practice from the beginning — the New Testament letters are already settling disputes between congregations."
  },

  /* ---------------------------------------------- the ancient splits */
  {
    id: "east", name: "Church of the East", short: "Church of the East", year: 431,
    tradition: "ancient", parent: "early", kind: "divide",
    over: "The Council of Ephesus and how to describe Christ's divine and human natures — and whether Mary could be called Theotokos, 'God-bearer'.",
    note: "Spread east along the Silk Road as far as China while Europe was still converting. Survives as the Assyrian Church of the East.",
    size: "~600,000"
  },
  {
    id: "oriental", name: "Oriental Orthodox churches", short: "Oriental Orthodox", year: 451,
    tradition: "ancient", parent: "early", kind: "divide",
    over: "The Council of Chalcedon's formula of two natures in one person, which these churches rejected as dividing Christ.",
    note: "Coptic, Armenian, Syriac, Ethiopian and Eritrean churches. Modern dialogue has found the 1,500-year quarrel to rest largely on what the Greek word for 'nature' was taken to mean.",
    size: "~60 million"
  },
  {
    id: "chalcedon", name: "The Chalcedonian Church", short: "Chalcedonian Church", year: 451,
    tradition: "ancient", parent: "early", kind: "divide",
    over: null,
    note: "The imperial church of east and west that accepted Chalcedon. It held together, with growing strain, for another six centuries."
  },

  /* ------------------------------------------------------ 1054 ----- */
  {
    id: "orthodox", name: "Eastern Orthodox Church", short: "Eastern Orthodox", year: 1054,
    tradition: "orthodox", parent: "chalcedon", kind: "divide",
    over: "The authority claimed by the bishop of Rome, and the Latin addition of 'and the Son' — the filioque — to the creed.",
    note: "Holds that it is the continuing church and that Rome departed. The 1054 excommunications were between two legations, not two peoples; the sack of Constantinople by crusaders in 1204 did more lasting damage.",
    size: "~220 million"
  },
  {
    id: "catholic", name: "Roman Catholic Church", short: "Roman Catholic", year: 1054,
    tradition: "catholic", parent: "chalcedon", kind: "divide",
    over: "The same quarrel from the other side: Rome held that the pope's authority over the whole church was ancient and that the East had broken from it.",
    note: "Holds that it is the continuing church and that the East departed. Reshaped itself sharply at the Council of Trent (1545–63) in answer to the Reformation.",
    size: "~1.4 billion"
  },

  /* ------------------------------------------- before the Reformation */
  {
    id: "waldensian", name: "Waldensians", short: "Waldensian", year: 1173,
    tradition: "reformed", parent: "catholic", kind: "branch",
    over: "Peter Waldo's insistence on preaching in the common tongue and on apostolic poverty, without a bishop's licence.",
    note: "Declared heretical in 1184 and hunted for centuries. Survived in Alpine valleys and joined the Reformed family in 1532 — a Protestant church three and a half centuries older than Protestantism.",
    size: "~30,000"
  },
  {
    id: "moravian", name: "Moravian Church", short: "Moravian", year: 1457,
    tradition: "reformed", parent: "catholic", kind: "branch",
    over: "The execution of Jan Hus in 1415 for preaching reform, and the wars that followed.",
    note: "The Unity of the Brethren organised sixty years before Luther. Later a missionary force far out of proportion to its size — and the people whose calm in an Atlantic storm shook John Wesley into his own conversion.",
    size: "~1 million"
  },

  /* ------------------------------------------------- the Reformation */
  {
    id: "lutheran", name: "Lutheran churches", short: "Lutheran", year: 1517,
    tradition: "lutheran", parent: "catholic", kind: "branch",
    over: "Indulgences, and behind them the question of whether a person is made right with God by faith alone or by faith and works together.",
    note: "Luther meant to argue, not to leave; the break hardened over the following decade and was set out in the Augsburg Confession of 1530.",
    size: "~75 million"
  },
  {
    id: "reformed", name: "Reformed churches", short: "Reformed", year: 1523,
    tradition: "reformed", parent: "catholic", kind: "branch",
    over: "A more thorough reform than Luther's: the Lord's Supper as memorial rather than bodily presence, and worship stripped to what Scripture commands.",
    note: "Zwingli in Zurich from 1523, Calvin in Geneva from 1536. Lutherans and Reformed failed to agree on the Supper at Marburg in 1529 and have been separate ever since.",
    size: "~80 million"
  },
  {
    id: "anabaptist", name: "Anabaptists", short: "Anabaptist", year: 1525,
    tradition: "anabaptist", parent: "catholic", kind: "branch",
    over: "Baptism on profession of faith rather than in infancy — and with it, a church of the committed rather than of everyone born in the parish.",
    note: "The Radical Reformation, so called because it went to the root. Persecuted by Catholics and Protestants alike; rebaptism was a capital offence. Its separation of church and state was centuries early.",
    size: "~2.1 million today"
  },
  {
    id: "anglican", name: "Church of England", short: "Anglican", year: 1534,
    tradition: "anglican", parent: "catholic", kind: "branch",
    over: "Henry VIII's demand for an annulment, settled by the Act of Supremacy making the king head of the church in England.",
    note: "It began as a jurisdictional break with Catholic doctrine intact, and became genuinely Protestant under Edward VI and Elizabeth I. The resulting via media is why Anglicans argue about whether they are Protestant at all.",
    size: "~85 million"
  },

  /* ----------------------------------------------- Reformed children */
  {
    id: "presbyterian", name: "Presbyterian churches", short: "Presbyterian", year: 1560,
    tradition: "reformed", parent: "reformed", kind: "branch",
    over: "Not doctrine so much as government: rule by elders in graded courts rather than by bishops.",
    note: "John Knox and the Scots Confession of 1560. Split north and south over slavery in 1861 and did not reunite until 1983.",
    size: "~75 million in the wider Reformed family"
  },
  {
    id: "dutchreformed", name: "Continental Reformed churches", short: "Continental Reformed", year: 1571,
    tradition: "reformed", parent: "reformed", kind: "branch",
    over: "Organising the Reformed churches of the Netherlands and the Rhineland under their own synods while under Spanish rule.",
    note: "The Synod of Dort (1618–19) here produced the five points later remembered by the acronym TULIP."
  },

  /* --------------------------------------------- Anabaptist children */
  {
    id: "hutterite", name: "Hutterites", short: "Hutterite", year: 1528,
    tradition: "anabaptist", parent: "anabaptist", kind: "branch",
    over: "Holding goods in common, as the church in Acts is described doing.",
    note: "Still farming communally on the northern plains five centuries later, and among the fastest-growing groups here by birth rate.",
    size: "~50,000"
  },
  {
    id: "mennonite", name: "Mennonites", short: "Mennonite", year: 1536,
    tradition: "anabaptist", parent: "anabaptist", kind: "branch",
    over: "Gathering the scattered peaceful Anabaptists after the disaster at Münster discredited the violent wing.",
    note: "Named for Menno Simons, a Dutch priest who joined them in 1536. Committed to nonviolence from the start.",
    size: "~2.1 million"
  },
  {
    id: "amish", name: "Amish", short: "Amish", year: 1693,
    tradition: "anabaptist", parent: "mennonite", kind: "divide",
    over: "How strictly to shun a member under discipline. Jakob Ammann wanted social avoidance enforced; Hans Reist and the Swiss elders did not.",
    note: "A quarrel about church discipline, not about technology — the plain dress and the horses came later, as a deliberate refusal to move with the surrounding culture.",
    size: "~400,000, doubling roughly every twenty years"
  },

  /* ------------------------------------------------ English children */
  {
    id: "separatist", name: "English Separatists", short: "English Separatists", year: 1581,
    tradition: "baptist", parent: "anglican", kind: "branch",
    over: "Whether a true church could be a national one. Puritans wanted to purify the Church of England from inside; Separatists left it.",
    note: "Illegal, and dangerous: several leaders were hanged in the 1590s. Many fled to the Netherlands, where the next two branches began.",
    hidden: false
  },
  {
    id: "congregational", name: "Congregationalists", short: "Congregationalist", year: 1592,
    tradition: "reformed", parent: "separatist", kind: "branch",
    over: "Each local congregation governing itself under Christ, with no bishop, synod or presbytery above it.",
    note: "The Pilgrims of 1620 were these people. They shaped New England, and with it a good deal of American self-government."
  },
  {
    id: "baptist", name: "Baptists", short: "Baptist", year: 1609,
    tradition: "baptist", parent: "separatist", kind: "branch",
    over: "Baptism of believers only — the Anabaptist conclusion reached again, by English Separatists living among Dutch Mennonites in Amsterdam.",
    note: "John Smyth's congregation, 1609. Some Baptists hold instead to a succession of like-minded churches reaching back to the apostles; the documentary record supports the English Separatist account.",
    size: "~100 million"
  },
  {
    id: "quaker", name: "Quakers", short: "Quaker", year: 1652,
    tradition: "baptist", parent: "separatist", kind: "branch",
    over: "George Fox's conviction that Christ teaches each person directly, which made clergy, sacraments and set liturgy unnecessary.",
    note: "Waiting worship in silence, refusal of oaths and of war, and an early insistence that women could preach. Far out in front on the abolition of slavery.",
    size: "~400,000"
  },
  {
    id: "unitarian", name: "Unitarianism", short: "Unitarian", year: 1825,
    tradition: "restoration", parent: "congregational", kind: "divide",
    over: "The Trinity. New England Congregational churches divided over whether Christ is God, and the liberal wing organised separately.",
    note: "Kept the meeting houses and the town elites in much of eastern Massachusetts. Later merged with the Universalists in 1961.",
    size: "~800,000"
  },
  {
    id: "ucc", name: "United Church of Christ", short: "UCC", year: 1957,
    tradition: "reformed", parent: "congregational", kind: "merge",
    merged: ["Congregational Christian Churches", "Evangelical and Reformed Church"],
    over: "Not a split at all — a union of four streams: Congregational, Christian, German Reformed and Evangelical.",
    note: "Ordained the first openly gay minister in a mainline American denomination in 1972.",
    size: "~700,000"
  },

  /* --------------------------------------------------- Baptist lines */
  {
    id: "sbc", name: "Southern Baptist Convention", short: "Southern Baptist", year: 1845,
    tradition: "baptist", parent: "baptist", kind: "divide",
    over: "Slavery, explicitly: whether a slaveholder could be appointed a missionary. Northern Baptists said no; southern churches left and formed their own convention.",
    note: "Apologised for that founding in 1995. Still the largest Protestant body in the United States.",
    size: "~13 million"
  },
  {
    id: "nationalbaptist", name: "National Baptist Convention", short: "National Baptist", year: 1895,
    tradition: "baptist", parent: "baptist", kind: "branch",
    over: "Black Baptists organising their own national body rather than remaining junior partners in white-led societies.",
    note: "Out of these churches came much of the leadership and nearly all of the music of the civil rights movement.",
    size: "~8 million"
  },
  {
    id: "adventist", name: "Seventh-day Adventists", short: "Seventh-day Adventist", year: 1863,
    tradition: "restoration", parent: "baptist", kind: "branch",
    over: "Saturday as the sabbath, and the expectation of an imminent second coming, after the Baptist preacher William Miller's prediction of 1844 failed.",
    note: "Rebuilt from that Great Disappointment into a worldwide church with an unusual emphasis on health — the longevity of Adventists in California is a well-studied epidemiological finding.",
    size: "~22 million"
  },
  {
    id: "jw", name: "Jehovah's Witnesses", short: "Jehovah's Witnesses", year: 1879,
    tradition: "restoration", parent: "adventist", kind: "branch",
    over: "Charles Taze Russell's break with the Adventist movement over the nature of Christ's return, and a rejection of the Trinity.",
    note: "Places itself outside Protestantism entirely and regards the historic creeds as corruptions. The placement here follows the documented Adventist milieu Russell came from, not the movement's own account of itself.",
    contested: true,
    size: "~8.8 million"
  },

  /* ------------------------------------------------- Methodist lines */
  {
    id: "methodist", name: "Methodist churches", short: "Methodist", year: 1784,
    tradition: "methodist", parent: "anglican", kind: "branch",
    over: "Nothing doctrinal at first. Wesley's revival ran inside the Church of England for decades; the break came when he ordained ministers for America because no bishop would.",
    note: "Wesley died an Anglican priest insisting he had founded no new church. The American conference of 1784 and the British settlement of 1795 made it one anyway.",
    size: "~80 million in the wider Methodist family"
  },
  {
    id: "ame", name: "African Methodist Episcopal Church", short: "AME", year: 1816,
    tradition: "methodist", parent: "methodist", kind: "divide",
    over: "Racial segregation in worship. Richard Allen and others were pulled from their knees at prayer in a Philadelphia church and walked out.",
    note: "The first denomination in the world founded on racial grounds rather than doctrinal ones — and founded by those excluded, not those excluding.",
    size: "~2.5 million"
  },
  {
    id: "salvationarmy", name: "The Salvation Army", short: "Salvation Army", year: 1865,
    tradition: "methodist", parent: "methodist", kind: "branch",
    over: "Taking the Methodist revival to the London poor who would never enter a chapel, organised on military lines.",
    note: "A church, not only a charity, though it abandoned baptism and communion altogether rather than let them become barriers.",
    size: "~1.7 million"
  },
  {
    id: "holiness", name: "The Holiness movement", short: "Holiness", year: 1867,
    tradition: "methodist", parent: "methodist", kind: "branch",
    over: "Recovering Wesley's teaching on entire sanctification — a second work of grace after conversion — which mainstream Methodism had grown quiet about.",
    note: "Camp meetings, and a suspicion that respectability had cost Methodism its fire."
  },
  {
    id: "nazarene", name: "Church of the Nazarene", short: "Nazarene", year: 1908,
    tradition: "methodist", parent: "holiness", kind: "branch",
    over: "Gathering the scattered Holiness associations into one denomination at Pilot Point, Texas.",
    note: "Kept the Holiness doctrine of sanctification while declining the Pentecostal claim about tongues.",
    size: "~2.6 million"
  },
  {
    id: "umc", name: "United Methodist Church", short: "United Methodist", year: 1968,
    tradition: "methodist", parent: "methodist", kind: "merge",
    merged: ["The Methodist Church", "Evangelical United Brethren Church"],
    over: "A union, not a split — though it also ended the segregated Central Jurisdiction that had existed since 1939.",
    note: "Divided again from 2019 over sexuality, with around a quarter of US congregations leaving by 2023.",
    size: "~9 million"
  },

  /* ------------------------------------------------------ Pentecostal */
  {
    id: "pentecostal", name: "Pentecostalism", short: "Pentecostal", year: 1906,
    tradition: "pentecostal", parent: "holiness", kind: "branch",
    over: "Baptism in the Holy Spirit as an experience after conversion, marked by speaking in tongues.",
    note: "The Azusa Street revival in Los Angeles, led by William Seymour, the son of former slaves — and for a few remarkable years racially integrated in a segregated city. The fastest-growing branch on this tree by a wide margin.",
    size: "estimates run from 280 million to over 600 million, depending entirely on who is counted as Pentecostal or Charismatic"
  },
  {
    id: "cogic", name: "Church of God in Christ", short: "COGIC", year: 1907,
    tradition: "pentecostal", parent: "pentecostal", kind: "branch",
    over: "Charles Harrison Mason brought the Azusa Street experience back to his Holiness church in Memphis, and it became Pentecostal.",
    note: "The largest Pentecostal body in the United States.",
    size: "~6 million"
  },
  {
    id: "aog", name: "Assemblies of God", short: "Assemblies of God", year: 1914,
    tradition: "pentecostal", parent: "pentecostal", kind: "branch",
    over: "White Pentecostal ministers — many of them originally credentialed by COGIC — organising separately at Hot Springs, Arkansas.",
    note: "The racial separation of 1914 was repented of publicly in 1994, in what participants called the Memphis Miracle.",
    size: "~69 million worldwide"
  },

  /* ---------------------------------------------------- Restoration */
  {
    id: "stonecampbell", name: "Stone-Campbell movement", short: "Stone-Campbell", year: 1832,
    tradition: "restoration", parent: "presbyterian", kind: "branch",
    over: "Abolishing denominations altogether: no creed but the Bible, no name but Christian.",
    note: "Barton Stone and Alexander Campbell, both out of Presbyterianism, merged their movements in Kentucky in 1832. A movement founded to end division has since divided three times."
  },
  {
    id: "churchesofchrist", name: "Churches of Christ", short: "Churches of Christ", year: 1906,
    tradition: "restoration", parent: "stonecampbell", kind: "divide",
    over: "Instrumental music in worship and centralised missionary societies — both rejected as without New Testament warrant.",
    note: "Counted separately in the 1906 census, which is the conventional date for a separation that had been growing since the Civil War.",
    size: "~2 million"
  },
  {
    id: "disciples", name: "Disciples of Christ", short: "Disciples of Christ", year: 1968,
    tradition: "restoration", parent: "stonecampbell", kind: "divide",
    over: "Whether to become a denomination with a national structure — which this wing did, and the more conservative Christian Churches would not.",
    note: "An irony the movement is well aware of: restoring the undivided church produced three separate bodies.",
    size: "~350,000"
  },

  /* -------------------------------------------------------- off-tree */
  {
    id: "lds", name: "Latter-day Saints", short: "Latter-day Saints", year: 1830,
    tradition: "restoration", parent: null, offTree: true,
    over: null,
    note: "Teaches that the authority of the early church was lost entirely and restored directly to Joseph Smith in 1830 — not a reform of any existing body, and not descended from one. It has no branch on this tree because placing it on one would misrepresent both its own account and the history around it. It arose in the revival culture of western New York, and most other Christian bodies do not regard it as part of the Protestant family.",
    contested: true,
    size: "~17 million"
  }
];
