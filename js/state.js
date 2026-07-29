/* =========================================================
   Game state, helpers, save/load
   ========================================================= */

const Game = {
  TILE: 44,
  SAVE_KEY: 'pinballPalaceTycoonSave_v3',
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
  condBand(cond) {
    for (const b of DATA.COND_BANDS) if (cond >= b.min) return b;
    return DATA.COND_BANDS[DATA.COND_BANDS.length - 1];
  },

  /* ---------- global difficulty scaling ----------
     One scalar drives dirt spawn, machine wear, breakdowns and
     maintenance costs. A two-machine corner shop sits near the 0.3
     floor (relaxed, forgiving); a packed championship complex pushes
     toward the 2.5 cap (demands a full crew and active management). */
  difficulty() {
    const s = Game.state;
    const tierReached = DATA.TIERS.filter(t => (s.hosted[t.id] || 0) > 0).length;
    return Game.clamp(
      0.30
      + Game.machineCount() * 0.03
      + s.customers.length * 0.012
      + s.reputation * 0.0006
      + s.expansion * 0.08
      + tierReached * 0.10,
      0.3, 2.5);
  },

  /* ---------- new game ---------- */
  newGame() {
    const s = {
      version: 3,
      day: 1,
      time: 0,                // 0..1 through current day
      speed: 1,
      cash: 2000,
      reputation: 10,
      satisfaction: 70,       // the visible Happiness meter
      cleanliness: 100,       // derived from dirt tiles each tick
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
      dirtTiles: [],          // {x, y, amt, kind:'stain'|'trash', flagged, assigned}
      repairQueue: [],        // {machineId, kind:'repair'|'maintain'} — player-assigned
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

    Game.addNews('🎉 Welcome to your new arcade! Arcade machines pull the crowd in — pinball tables win the tournaments.', 'good');
    return s;
  },

  /* ---------- grid ---------- */
  gridSize() {
    const e = DATA.EXPANSIONS[Game.state.expansion];
    return { w: e.w, h: e.h };
  },
  interiorArea() {
    const g = Game.gridSize();
    return (g.w - 2) * (g.h - 2);
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

  /* ---------- dirt & cleanliness ----------
     Cleanliness is physical: dirt/trash tiles appear on the floor and
     must be flagged for janitors. The % score is derived from how much
     of the floor is filthy. */
  dirtAt(x, y) {
    return Game.state.dirtTiles.find(d => d.x === x && d.y === y) || null;
  },
  spawnDirt(n, nearX, nearY) {
    const s = Game.state;
    const g = Game.gridSize();
    const maxTiles = Math.floor(Game.interiorArea() * 0.5);
    for (let i = 0; i < n; i++) {
      let x, y;
      let tries = 0;
      do {
        if (nearX !== undefined && Math.random() < 0.7) {
          x = Game.clamp(Math.round(nearX + Game.rand(-2.5, 2.5)), 1, g.w - 2);
          y = Game.clamp(Math.round(nearY + Game.rand(-2.5, 2.5)), 1, g.h - 2);
        } else {
          x = Game.randInt(1, g.w - 2);
          y = Game.randInt(1, g.h - 2);
        }
        tries++;
      } while (Game.machineAt(x, y) && tries < 12);
      if (Game.machineAt(x, y)) continue;
      const existing = Game.dirtAt(x, y);
      if (existing) {
        existing.amt = Math.min(9, existing.amt + 2);
      } else if (s.dirtTiles.length < maxTiles) {
        s.dirtTiles.push({
          x, y,
          amt: Game.randInt(3, 6),
          kind: Math.random() < 0.45 ? 'trash' : 'stain',
          flagged: false,
          assigned: null,
        });
      }
    }
    Game.recalcCleanliness();
  },
  removeDirt(tile) {
    Game.state.dirtTiles = Game.state.dirtTiles.filter(d => d !== tile);
    Game.recalcCleanliness();
  },
  recalcCleanliness() {
    const s = Game.state;
    const points = s.dirtTiles.reduce((a, d) => a + d.amt, 0);
    const capacity = Game.interiorArea() * 1.1;
    s.cleanliness = Game.clamp(100 * (1 - points / capacity), 0, 100);
  },
  flaggedDirtCount() {
    return Game.state.dirtTiles.filter(d => d.flagged).length;
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
      assignedTech: null,  // staff id of tech en route / working
    };
    Game.state.machines.push(m);
    // Placing a machine covers any dirt on that tile
    const dirt = Game.dirtAt(x, y);
    if (dirt) Game.removeDirt(dirt);
    return m;
  },
  sellMachine(m) {
    const def = Game.def(m.defId);
    const refund = Math.round(def.cost * 0.5 * (0.4 + 0.6 * m.condition / 100));
    Game.income(refund, 'sales');
    Game.state.machines = Game.state.machines.filter(x => x.id !== m.id);
    Game.state.customers.forEach(c => { if (c.machineId === m.id) { c.machineId = null; c.phase = 'choose'; } });
    Game.state.repairQueue = Game.state.repairQueue.filter(q => q.machineId !== m.id);
    Game.state.staff.forEach(st => { if (st.task && st.task.machineId === m.id) st.task = null; });
    if (Game.state.selectedMachine === m.id) Game.state.selectedMachine = null;
    return refund;
  },
  upgradeCost(m) {
    // Upgrades are serious investments now — ★★★ costs ~4.5x the machine
    return Math.round(Game.def(m.defId).cost * 0.75 * (m.level + 1));
  },
  emergencyRepairCost(m) {
    // Contractors smell success: call-out fees climb as the business grows
    return Math.round((Game.def(m.defId).cost * 0.12 + 30) * (0.75 + 0.3 * Game.difficulty()));
  },
  machinePrice(m) {
    const def = Game.def(m.defId);
    // Upgrades matter: +50% revenue per star
    return def.price * 1.6 * (1 + 0.5 * m.level) * Game.state.priceLevel;
  },
  machineCount() { return Game.state.machines.filter(m => Game.def(m.defId).type !== 'amenity').length; },
  pinballCount() { return Game.state.machines.filter(m => Game.def(m.defId).type === 'pinball').length; },
  pinballMachines() { return Game.state.machines.filter(m => Game.def(m.defId).type === 'pinball'); },
  avgCondition() {
    const ms = Game.state.machines.filter(m => Game.def(m.defId).type !== 'amenity');
    if (!ms.length) return 0;
    return ms.reduce((a, m) => a + m.condition, 0) / ms.length;
  },
  uniquePinballTypes() {
    const set = new Set();
    for (const m of Game.state.machines) {
      if (Game.def(m.defId).type === 'pinball') set.add(m.defId);
    }
    return set.size;
  },
  pinballStar3Pct() {
    const pb = Game.pinballMachines();
    if (!pb.length) return 0;
    return 100 * pb.filter(m => m.level >= 3).length / pb.length;
  },
  worstPinballCond() {
    const pb = Game.pinballMachines();
    if (!pb.length) return 100;
    return Math.min(...pb.map(m => m.condition));
  },
  // Foot-traffic appeal comes ONLY from arcade machines and amenities.
  // Pinball tables draw nobody — they're for tournaments and play revenue.
  arcadeAppeal() {
    let a = 0;
    for (const m of Game.state.machines) {
      const def = Game.def(m.defId);
      if (def.type === 'pinball') continue;
      if (m.broken) continue;
      a += def.appeal + (def.type === 'arcade' ? m.level : 0);
    }
    return a;
  },
  brokenCount() { return Game.state.machines.filter(m => m.broken).length; },
  poorCondCount() {
    return Game.state.machines.filter(m =>
      Game.def(m.defId).type !== 'amenity' && !m.broken && m.condition < 40).length;
  },
  hasAmenity(defId) { return Game.state.machines.some(m => m.defId === defId && !m.broken); },
  serviceAmenities() {
    return Game.state.machines.filter(m => Game.def(m.defId).needsStaff);
  },

  /* ---------- repair queue (player-assigned tasks) ---------- */
  queueEntry(machineId) {
    const idx = Game.state.repairQueue.findIndex(q => q.machineId === machineId);
    return idx >= 0 ? { ...Game.state.repairQueue[idx], index: idx } : null;
  },
  techOnMachine(machineId) {
    return Game.state.staff.find(st => st.task && st.task.machineId === machineId) || null;
  },
  enqueueTask(machineId, kind) {
    const s = Game.state;
    if (Game.queueEntry(machineId) || Game.techOnMachine(machineId)) return false;
    s.repairQueue.push({ machineId, kind });
    return true;
  },
  cancelTask(machineId) {
    const s = Game.state;
    s.repairQueue = s.repairQueue.filter(q => q.machineId !== machineId);
    const tech = Game.techOnMachine(machineId);
    if (tech) tech.task = null;
    const m = s.machines.find(x => x.id === machineId);
    if (m) { m.assignedTech = null; m.repair = 0; }
  },

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
      const s = {
        ...Game.state,
        customers: [],   // transient
        dirtTiles: Game.state.dirtTiles.map(d => ({ ...d, assigned: null })),
        staff: Game.state.staff.map(st => ({ ...st, task: null })),
      };
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
      if (!Array.isArray(s.dirtTiles)) s.dirtTiles = [];
      if (!Array.isArray(s.repairQueue)) s.repairQueue = [];
      s.competitors.forEach(c => { if (c.points === undefined) c.points = 0; });
      s.machines.forEach(m => { m.busy = null; m.assignedTech = null; m.repair = 0; });
      s.dirtTiles.forEach(d => { d.assigned = null; });
      const e = { x: Math.floor(DATA.EXPANSIONS[s.expansion].w / 2), y: DATA.EXPANSIONS[s.expansion].h - 1 };
      s.staff.forEach(st => { st.task = null; st.x = e.x + Game.rand(-0.5, 0.5); st.y = e.y - 0.5; });
      s.speed = 1;
      Game.state = s;
      Game.recalcCleanliness();
      return true;
    } catch (e) { return false; }
  },
  wipeSave() { localStorage.removeItem(Game.SAVE_KEY); },
};
