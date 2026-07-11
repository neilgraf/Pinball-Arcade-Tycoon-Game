/* =========================================================
   Game state, helpers, save/load
   ========================================================= */

const Game = {
  TILE: 44,
  SAVE_KEY: 'pinballPalaceTycoonSave_v2',
  DAY_LENGTH: 60,          // seconds of real time per in-game day at 1x speed
  state: null,

  /* ---------- utility ---------- */
  rand(a, b) { return a + Math.random() * (b - a); },
  randInt(a, b) { return Math.floor(this.rand(a, b + 1)); },
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  clamp(v, a, b) { return Math.max(a, Math.min(b, v)); },
  money(v) {
    const n = Math.round(v);
    const s = Math.abs(n).toLocaleString('en-US');
    return (n < 0 ? '-$' : '$') + s;
  },
  def(id) { return DATA.MACHINES.find(m => m.id === id); },

  /* ---------- new game ---------- */
  newGame() {
    const s = {
      version: 2,
      day: 1,
      time: 0,                // 0..1 through current day
      speed: 1,
      cash: 1600,
      reputation: 10,
      satisfaction: 70,
      cleanliness: 100,
      dayVibe: 1,             // daily random traffic multiplier
      priceLevel: 1.0,        // 0.5 .. 2.0 global price multiplier
      expansion: 0,
      buzzDays: 0,
      buzzMult: 1,
      nextMachineId: 1,
      nextCustomerId: 1,
      nextStaffId: 1,
      machines: [],
      customers: [],
      staff: [],
      competitors: [],
      hosted: {},             // tierId -> times hosted
      nextEventDay: 0,        // circuit cooldown between hosted events
      champions: [],          // {day, tier, name, prize}
      worldChampionHosted: false,
      news: [],
      today: { income: 0, expense: 0, customers: 0, cats: {} },
      history: [],            // last 30 daily records
      totalStats: { revenue: 0, customers: 0, tournaments: 0 },
      selectedMachine: null,
    };
    Game.state = s;

    // Generate the competitive circuit roster (must exceed 32 for the World Championship field)
    const makeCompetitor = (id, name, skill) => ({
      id,
      name,
      nickname: skill > 80 ? Game.pick(DATA.NICKNAMES) : null,
      skill,
      consistency: +Game.rand(0.55, 0.98).toFixed(2), // higher = less variance
      style: Game.pick(DATA.STYLES).id,
      wins: 0, losses: 0, titles: 0,
      points: 0,                                      // circuit ranking points
    });
    const usedNames = new Set(DATA.NAMED_PLAYERS);
    let nextId = 0;
    for (const name of DATA.NAMED_PLAYERS) {
      s.competitors.push(makeCompetitor(nextId++, name, Math.round(Game.rand(55, 88))));
    }
    for (let i = 0; i < 34; i++) {
      let name;
      do {
        name = Game.pick(DATA.FIRST_NAMES) + ' ' + Game.pick(DATA.LAST_NAMES);
      } while (usedNames.has(name));
      usedNames.add(name);
      s.competitors.push(makeCompetitor(nextId++, name, Math.round(Game.rand(42, 92))));
    }

    // Starter machines, pre-placed near the entrance
    Game.placeMachine('rustyflip', 4, 3, true);
    Game.placeMachine('blaster', 8, 3, true);

    Game.addNews('🎉 Welcome to your new arcade! Buy machines, attract players, and chase the World Championship.', 'good');
    return s;
  },

  /* ---------- grid ---------- */
  gridSize() {
    const e = DATA.EXPANSIONS[Game.state.expansion];
    return { w: e.w, h: e.h };
  },
  entrance() {
    const g = Game.gridSize();
    return { x: Math.floor(g.w / 2), y: g.h - 1 };
  },
  machineAt(x, y) {
    return Game.state.machines.find(m => m.x === x && m.y === y) || null;
  },
  tileFree(x, y) {
    const g = Game.gridSize();
    if (x < 1 || y < 1 || x >= g.w - 1 || y >= g.h - 1) return false; // keep 1-tile wall border
    const e = Game.entrance();
    if (Math.abs(x - e.x) <= 1 && y >= g.h - 3) return false;        // keep entrance clear
    return !Game.machineAt(x, y);
  },

  /* ---------- machines ---------- */
  placeMachine(defId, x, y, free) {
    const def = Game.def(defId);
    if (!free) {
      if (Game.state.cash < def.cost) return null;
      Game.expense(def.cost, 'machines');
    }
    const m = {
      id: Game.state.nextMachineId++,
      defId, x, y,
      condition: 100,
      level: 0,
      broken: false,
      plays: 0,
      revenue: 0,
      busy: null,          // customer id currently playing
      repair: 0,           // technician repair progress 0..1
    };
    Game.state.machines.push(m);
    return m;
  },
  sellMachine(m) {
    const def = Game.def(m.defId);
    const refund = Math.round(def.cost * 0.5 * (0.4 + 0.6 * m.condition / 100));
    Game.income(refund, 'sales');
    Game.state.machines = Game.state.machines.filter(x => x.id !== m.id);
    Game.state.customers.forEach(c => { if (c.machineId === m.id) { c.machineId = null; c.phase = 'choose'; } });
    if (Game.state.selectedMachine === m.id) Game.state.selectedMachine = null;
    return refund;
  },
  upgradeCost(m) {
    return Math.round(Game.def(m.defId).cost * 0.4 * (m.level + 1));
  },
  repairCost(m) {
    return Math.round(Game.def(m.defId).cost * 0.06 + 20);
  },
  machinePrice(m) {
    const def = Game.def(m.defId);
    return def.price * 1.6 * (1 + 0.25 * m.level) * Game.state.priceLevel;
  },
  machineCount() { return Game.state.machines.filter(m => Game.def(m.defId).type !== 'amenity').length; },
  pinballCount() { return Game.state.machines.filter(m => Game.def(m.defId).type === 'pinball').length; },
  avgCondition() {
    const ms = Game.state.machines.filter(m => Game.def(m.defId).type !== 'amenity');
    if (!ms.length) return 0;
    return ms.reduce((a, m) => a + m.condition, 0) / ms.length;
  },
  uniqueMachineTypes() {
    const set = new Set();
    for (const m of Game.state.machines) {
      if (Game.def(m.defId).type !== 'amenity') set.add(m.defId);
    }
    return set.size;
  },
  starCount(minLevel) {
    return Game.state.machines.filter(m =>
      Game.def(m.defId).type !== 'amenity' && m.level >= minLevel).length;
  },
  totalAppeal() {
    let a = 0;
    for (const m of Game.state.machines) a += Game.def(m.defId).appeal + m.level;
    return a;
  },
  hasAmenity(defId) { return Game.state.machines.some(m => m.defId === defId); },

  /* ---------- money ---------- */
  income(amt, cat) {
    const s = Game.state;
    s.cash += amt;
    s.today.income += amt;
    s.today.cats[cat] = (s.today.cats[cat] || 0) + amt;
    s.totalStats.revenue += amt;
  },
  expense(amt, cat) {
    const s = Game.state;
    s.cash -= amt;
    s.today.expense += amt;
    s.today.cats[cat] = (s.today.cats[cat] || 0) - amt;
  },

  /* ---------- reputation ---------- */
  repTier() {
    let t = DATA.REP_TIERS[0];
    for (const tier of DATA.REP_TIERS) if (Game.state.reputation >= tier.min) t = tier;
    return t;
  },

  /* ---------- news ---------- */
  addNews(text, cls) {
    Game.state.news.unshift({ day: Game.state.day, text, cls: cls || '' });
    if (Game.state.news.length > 60) Game.state.news.length = 60;
    if (typeof UI !== 'undefined') UI.pushTicker(text, cls);
  },

  /* ---------- save / load ---------- */
  save() {
    try {
      const s = { ...Game.state, customers: [] }; // customers are transient
      localStorage.setItem(Game.SAVE_KEY, JSON.stringify(s));
      return true;
    } catch (e) { return false; }
  },
  hasSave() { return !!localStorage.getItem(Game.SAVE_KEY); },
  load() {
    try {
      const raw = localStorage.getItem(Game.SAVE_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);
      s.customers = [];
      if (s.nextEventDay === undefined) s.nextEventDay = 0;
      if (s.dayVibe === undefined) s.dayVibe = 1;
      s.competitors.forEach(c => { if (c.points === undefined) c.points = 0; });
      s.machines.forEach(m => { m.busy = null; });
      s.speed = 1;
      Game.state = s;
      return true;
    } catch (e) { return false; }
  },
  wipeSave() { localStorage.removeItem(Game.SAVE_KEY); },
};
