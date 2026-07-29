/* =========================================================
   Real-time simulation: customers, machines, staff, day cycle

   V3: staff are MANUAL. Technicians only fix machines the player
   assigns (repair queue); janitors only clean dirt tiles the player
   flags. Customers have hunger/thirst needs served by staffed
   amenities. Arcade machines drive traffic & reputation; pinball
   drives tournaments & direct revenue.
   ========================================================= */

const Sim = {
  spawnAccum: 0,
  litterAccum: 0,
  flavorTimer: 20,

  /* ================= MAIN TICK (dt = scaled seconds) ================= */
  tick(dt) {
    const s = Game.state;
    s.time += dt / Game.DAY_LENGTH;

    Sim.spawnCustomers(dt);
    Sim.updateCustomers(dt);
    Sim.updateStaff(dt);
    Sim.passiveDecay(dt);
    Sim.flavor(dt);

    if (s.time >= 1) Sim.endDay();
  },

  /* ================= CUSTOMER SPAWNING ================= */
  spawnRate() {
    const s = Game.state;
    // Traffic model: reputation + ARCADE appeal draw people in (pinball
    // attracts nobody); happiness and pricing decide whether they come back.
    const repFactor = 0.5 + s.reputation / 155;
    const appealFactor = 1 + Game.arcadeAppeal() / 40;
    const satFactor = 0.40 + s.satisfaction / 100;
    const priceFactor = Game.clamp(1.7 - 0.7 * s.priceLevel, 0.25, 1.45);
    const buzz = s.buzzDays > 0 ? s.buzzMult : 1;
    // Grimy floors turn people away at the door
    const cleanFactor = Game.clamp(0.45 + s.cleanliness / 120, 0.45, 1.3);
    // Day curve: quiet open, packed evening
    const curve = Math.pow(Math.sin(Math.PI * Game.clamp(s.time, 0.02, 0.98)), 0.7) * 1.35;
    return 0.45 * repFactor * appealFactor * satFactor * priceFactor * cleanFactor * buzz * (s.dayVibe || 1) * curve;
  },
  capacity() {
    // Keep the crowd close to what the machines can actually serve,
    // so guests spend their visit playing instead of fuming in line
    const s = Game.state;
    return Math.floor(3 + Game.machineCount() * 1.3 + s.expansion * 4);
  },
  spawnCustomers(dt) {
    const s = Game.state;
    if (Game.machineCount() === 0) return;
    if (s.customers.length >= Sim.capacity()) return;
    Sim.spawnAccum += Sim.spawnRate() * dt;
    while (Sim.spawnAccum >= 1) {
      Sim.spawnAccum -= 1;
      Sim.spawnOne();
    }
  },
  spawnOne() {
    const s = Game.state;
    const e = Game.entrance();
    const pro = Math.random() < Game.clamp(0.05 + s.reputation / 1600, 0.05, 0.6);
    const c = {
      id: s.nextCustomerId++,
      type: pro ? 'pro' : 'casual',
      x: e.x + Game.rand(-0.3, 0.3), y: e.y + 0.4,
      tx: 0, ty: 0,
      phase: 'choose',
      machineId: null,
      amenityId: null,
      timer: 0,
      // Pros come for the pinball; casuals came for the arcade lights
      prefPinball: pro ? 0.9 : Game.rand(0.15, 0.45),
      budget: pro ? Game.rand(20, 45) : Game.rand(8, 26),
      playsTarget: pro ? Game.randInt(5, 9) : Game.randInt(2, 6),
      patience: pro ? 4 : Game.randInt(3, 5),
      hunger: Game.rand(10, 45),
      thirst: Game.rand(15, 50),
      grumbledFood: false,
      grumbledDrink: false,
      mood: 0,          // accumulated happiness modifiers
      playsDone: 0,
      speed: Game.rand(1.8, 2.6),
      color: Game.pick(DATA.CUSTOMER_COLORS),
      bobSeed: Math.random() * 10,
    };
    s.customers.push(c);
    s.today.customers++;
    s.totalStats.customers++;
  },

  /* ================= CUSTOMER BEHAVIOR ================= */
  updateCustomers(dt) {
    const s = Game.state;
    for (let i = s.customers.length - 1; i >= 0; i--) {
      const c = s.customers[i];
      // Needs build over the visit
      c.hunger = Math.min(100, c.hunger + 1.6 * dt);
      c.thirst = Math.min(100, c.thirst + 2.1 * dt);
      switch (c.phase) {
        case 'choose':  Sim.customerChoose(c); break;
        case 'walk':    Sim.customerWalk(c, dt); break;
        case 'play':    Sim.customerPlay(c, dt); break;
        case 'amenity': Sim.customerAmenity(c, dt); break;
        case 'browse':  Sim.customerBrowse(c, dt); break;
        case 'leave':   Sim.customerLeave(c, dt, i); break;
      }
    }
  },

  /* ---- amenity helpers ---- */
  attendantRatio() {
    const needed = Game.serviceAmenities().length;
    if (needed === 0) return 1;
    return Math.min(1, Sim.staffCount('attendant') / needed);
  },
  findAmenity(services) {
    // First matching, working amenity by service priority list
    for (const svc of services) {
      const m = Game.state.machines.find(m => {
        const def = Game.def(m.defId);
        return def.service === svc && !m.broken;
      });
      if (m) return m;
    }
    return null;
  },

  customerChoose(c) {
    const s = Game.state;
    if (c.budget <= 0.4 || c.patience <= 0 || c.playsDone >= c.playsTarget) { Sim.startLeaving(c); return; }

    // Unmet needs come first: thirsty/hungry guests stop playing
    if (c.thirst >= 70) {
      const stand = Sim.findAmenity(['drink']);
      if (stand) { Sim.walkToAmenity(c, stand, 'drink'); return; }
      if (!c.grumbledDrink) {
        // Nowhere to buy a drink: unhappy, and they'll leave earlier
        c.grumbledDrink = true;
        c.mood -= 6;
        c.thirst = 50;
        c.playsTarget = Math.max(c.playsDone + 1, c.playsTarget - 1);
      }
    }
    if (c.hunger >= 75) {
      const stand = Sim.findAmenity(['food', 'snack']);
      if (stand) { Sim.walkToAmenity(c, stand, Game.def(stand.defId).service); return; }
      if (!c.grumbledFood) {
        c.grumbledFood = true;
        c.mood -= 6;
        c.hunger = 55;
        c.playsTarget = Math.max(c.playsDone + 1, c.playsTarget - 1);
      }
    }

    // Score every free, working machine
    let best = null, bestScore = -1;
    for (const m of s.machines) {
      const def = Game.def(m.defId);
      if (def.type === 'amenity') continue;
      if (m.broken || m.busy !== null) continue;
      if (Game.machinePrice(m) > c.budget) continue;
      const typeAff = def.type === 'pinball' ? c.prefPinball : 1 - c.prefPinball;
      const condFactor = 0.4 + 0.6 * m.condition / 100;
      const score = (def.pop + m.level * 1.5) * typeAff * condFactor * Game.rand(0.7, 1.3);
      if (score > bestScore) { bestScore = score; best = m; }
    }
    if (!best) {
      // Nothing available — wander a bit, lose patience
      c.patience--;
      c.mood -= 3;
      if (c.patience <= 0) { Sim.startLeaving(c); return; }
      const g = Game.gridSize();
      c.tx = Game.rand(2, g.w - 2); c.ty = Game.rand(2, g.h - 2);
      c.phase = 'browse';
      c.timer = Game.rand(1.5, 3);
      return;
    }
    best.busy = c.id;
    c.machineId = best.id;
    c.tx = best.x + 0.5 + Game.rand(-0.15, 0.15);
    c.ty = best.y + 1.15;
    c.phase = 'walk';
  },

  walkToAmenity(c, amenity, service) {
    c.amenityId = amenity.id;
    c.amenityService = service;
    c.tx = amenity.x + 0.5 + Game.rand(-0.25, 0.25);
    c.ty = amenity.y + 1.1;
    c.phase = 'amenity';
    c.timer = -1; // walking; service timer set on arrival
  },

  customerAmenity(c, dt) {
    const s = Game.state;
    if (c.timer < 0) {
      if (!Sim.moveToward(c, dt)) return;
      c.timer = 1.3; // being served
      return;
    }
    c.timer -= dt;
    if (c.timer > 0) return;
    const amenity = s.machines.find(m => m.id === c.amenityId);
    c.amenityId = null;
    c.phase = 'choose';
    if (!amenity) return;
    // Understaffed stands serve slowly and badly
    const quality = 0.25 + 0.75 * Sim.attendantRatio();
    const served = Math.random() < quality;
    switch (c.amenityService) {
      case 'drink':
        if (served) { Game.income(3 * s.priceLevel, 'drinks'); c.thirst = 15; c.mood += 2 + 3 * quality; }
        else { c.thirst = Math.max(20, c.thirst - 30); c.mood -= 4; }
        break;
      case 'snack':
        if (served) { Game.income(4 * s.priceLevel, 'food'); c.hunger = Math.max(15, c.hunger - 45); c.mood += 2 + 3 * quality; }
        else { c.hunger = Math.max(30, c.hunger - 20); c.mood -= 4; }
        break;
      case 'food':
        if (served) { Game.income(7 * s.priceLevel, 'food'); c.hunger = 10; c.mood += 3 + 4 * quality; }
        else { c.hunger = Math.max(30, c.hunger - 25); c.mood -= 4; }
        break;
    }
  },

  customerWalk(c, dt) {
    const arrived = Sim.moveToward(c, dt);
    if (!arrived) return;
    const m = Game.state.machines.find(m => m.id === c.machineId);
    if (!m || m.broken) { // machine vanished or broke while walking
      if (m) m.busy = null;
      c.machineId = null; c.mood -= 4; c.phase = 'choose';
      return;
    }
    c.phase = 'play';
    c.timer = Game.def(m.defId).playTime * Game.rand(0.8, 1.3);
  },

  customerPlay(c, dt) {
    c.timer -= dt;
    if (c.timer > 0) return;
    const s = Game.state;
    const m = s.machines.find(m => m.id === c.machineId);
    if (m) {
      const def = Game.def(m.defId);
      // Poorly maintained machines earn less per play, and takings fluctuate
      const condFactor = 0.6 + 0.4 * m.condition / 100;
      const price = Game.machinePrice(m) * condFactor * Game.rand(0.94, 1.08);
      Game.income(price, 'plays');
      m.revenue += price;
      m.plays++;
      c.budget -= price;
      c.playsDone++;

      // Wear and tear scales with how big the operation has grown:
      // a quiet corner shop barely dents its machines; a packed
      // championship venue chews through them
      const diff = Game.difficulty();
      const wear = Game.rand(1.3, 2.4) * (11 - def.rel) / 20 * (0.35 + 0.55 * diff);
      m.condition = Math.max(0, m.condition - wear);
      // Breakdowns: near-impossible on a healthy machine in a small
      // arcade; a real threat once the operation (or neglect) grows
      const breakChance = (m.condition < 20 ? 0.35 : m.condition < 45 ? 0.03 : 0.003)
        * Game.clamp(diff - 0.15, 0.25, 2);
      if (Math.random() < breakChance) {
        m.broken = true;
        m.repair = 0;
        // A pending maintenance assignment becomes a repair job
        const q = s.repairQueue.find(q => q.machineId === m.id);
        if (q) q.kind = 'repair';
        Game.addNews(`🔴 ${def.name} just broke down! Click it to assign a repair.`, 'bad');
      }
      // Foot traffic makes a mess — dirt appears on the floor for real,
      // but a small early-game arcade stays nearly spotless on its own
      if (Math.random() < 0.10 * diff) {
        Game.spawnDirt(1, m.x, m.y + 1);
      }

      // Per-play happiness contribution; pricing cuts deep both ways
      c.mood += (m.condition - 55) * 0.06
              + (def.pop + m.level * 1.5) * 0.5
              + (1 - s.priceLevel) * (s.priceLevel > 1 ? 9 : 7);
      m.busy = null;
      c.machineId = null;
    }
    // Prize counter impulse visit (needs an attendant to actually work)
    if (Math.random() < 0.10 && Game.hasAmenity('prizes')) {
      if (Math.random() < Sim.attendantRatio()) {
        Game.income(5 * s.priceLevel, 'snacks');
        c.mood += 4;
      }
    }
    c.phase = 'choose';
  },

  customerBrowse(c, dt) {
    if (Sim.moveToward(c, dt)) {
      c.timer -= dt;
      if (c.timer <= 0) c.phase = 'choose';
    }
  },

  startLeaving(c) {
    const m = c.machineId != null ? Game.state.machines.find(m => m.id === c.machineId) : null;
    if (m && m.busy === c.id) m.busy = null;
    c.machineId = null;
    const e = Game.entrance();
    c.tx = e.x + 0.5; c.ty = e.y + 0.9;
    c.phase = 'leave';
  },

  customerLeave(c, dt, idx) {
    if (!Sim.moveToward(c, dt)) return;
    const s = Game.state;
    // Litterbugs: some guests drop trash on the way out (more of them
    // once the place gets crowded)
    if (Math.random() < 0.08 * Game.difficulty()) Game.spawnDirt(1, c.x, c.y - 1);
    // Final happiness score for this visit
    let sat = 55 + c.mood + (s.cleanliness - 60) * 0.3;
    if (c.playsDone === 0) sat -= 20;
    sat = Game.clamp(sat, 0, 100);
    s.satisfaction = s.satisfaction * 0.96 + sat * 0.04;
    s.customers.splice(idx, 1);
  },

  moveToward(c, dt) {
    const dx = c.tx - c.x, dy = c.ty - c.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.08) return true;
    const step = Math.min(dist, c.speed * dt);
    c.x += dx / dist * step;
    c.y += dy / dist * step;
    return false;
  },

  /* ================= STAFF (manual task system) =================
     Techs pull from the player-built repair queue; janitors pull the
     nearest player-flagged dirt tile. Both physically travel there —
     bigger arcades mean longer response times. */
  staffSpeed(st) { return 2.0 + 0.3 * st.level; },

  updateStaff(dt) {
    const s = Game.state;
    let idleIdx = 0;
    for (const st of s.staff) {
      if (st.x === undefined) { const e = Game.entrance(); st.x = e.x; st.y = e.y - 0.5; }
      if (st.type === 'tech') Sim.updateTech(st, dt);
      else if (st.type === 'janitor') Sim.updateJanitor(st, dt);
      // attendants stand at their amenity (render-only); managers work off-screen
      if ((st.type === 'tech' || st.type === 'janitor') && !st.task) {
        Sim.idleWander(st, dt, idleIdx++);
      }
    }
  },

  idleWander(st, dt, idx) {
    // Off-duty staff hang out along the top wall, out of the way
    const tx = 1.7 + (idx % 8) * 1.1;
    const ty = 1.5;
    Sim.staffMove(st, tx, ty, dt);
  },

  staffMove(st, tx, ty, dt) {
    const dx = tx - st.x, dy = ty - st.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.12) return true;
    const step = Math.min(dist, Sim.staffSpeed(st) * dt);
    st.x += dx / dist * step;
    st.y += dy / dist * step;
    return false;
  },

  updateTech(st, dt) {
    const s = Game.state;
    if (!st.task) {
      // Take the next valid job from the queue
      while (s.repairQueue.length > 0) {
        const job = s.repairQueue[0];
        const m = s.machines.find(x => x.id === job.machineId);
        const valid = m && (job.kind === 'repair' ? m.broken : (!m.broken && m.condition < 99));
        if (!valid) { s.repairQueue.shift(); continue; }
        s.repairQueue.shift();
        st.task = { kind: job.kind, machineId: m.id, phase: 'travel' };
        m.assignedTech = st.id;
        break;
      }
      if (!st.task) return;
    }
    const m = s.machines.find(x => x.id === st.task.machineId);
    if (!m || (st.task.kind === 'repair' && !m.broken)) { // job vanished / resolved
      if (m) { m.assignedTech = null; m.repair = 0; }
      st.task = null;
      return;
    }
    if (st.task.phase === 'travel') {
      if (Sim.staffMove(st, m.x + 0.5, m.y + 1.1, dt)) st.task.phase = 'work';
      return;
    }
    // Working
    if (st.task.kind === 'repair') {
      const repairTime = 10 / (0.7 + 0.3 * st.level);
      m.repair += dt / repairTime;
      if (m.repair >= 1) {
        m.broken = false;
        m.repair = 0;
        m.condition = Math.max(m.condition, 60 + 12 * st.level);
        m.assignedTech = null;
        st.task = null;
        Game.addNews(`🔧 ${st.name} repaired ${Game.def(m.defId).name}.`, 'good');
      }
    } else { // maintain
      if (m.broken) {
        // It died under their hands — the assigned tech rolls straight into a repair
        st.task.kind = 'repair';
        m.repair = 0;
        return;
      }
      m.condition = Math.min(100, m.condition + (5 + 2 * st.level) * dt);
      if (m.condition >= 100) {
        m.assignedTech = null;
        m.repair = 0;
        st.task = null;
      }
    }
  },

  updateJanitor(st, dt) {
    const s = Game.state;
    if (!st.task) {
      // Nearest flagged, unassigned dirt tile
      let best = null, bestDist = Infinity;
      for (const d of s.dirtTiles) {
        if (!d.flagged || d.assigned !== null) continue;
        const dist = Math.hypot(d.x + 0.5 - st.x, d.y + 0.5 - st.y);
        if (dist < bestDist) { bestDist = dist; best = d; }
      }
      if (!best) return;
      best.assigned = st.id;
      st.task = { kind: 'clean', tile: best, phase: 'travel' };
    }
    const d = st.task.tile;
    if (!s.dirtTiles.includes(d)) { st.task = null; return; }
    if (st.task.phase === 'travel') {
      if (Sim.staffMove(st, d.x + 0.5, d.y + 0.5, dt)) {
        st.task.phase = 'work';
        st.task.progress = 0;
      }
      return;
    }
    const cleanTime = 1.8 / (0.7 + 0.3 * st.level);
    st.task.progress += dt / cleanTime;
    if (st.task.progress >= 1) {
      Game.removeDirt(d);
      st.task = null;
    }
  },

  hasManager() { return Game.state.staff.some(st => st.type === 'manager'); },

  /* ---- staffing guidance: one of each carries you a long way early;
     only a genuinely big operation needs a crew ---- */
  techsNeeded() {
    const n = Game.machineCount();
    return n <= 3 ? 0 : Math.ceil(n / 12);
  },
  janitorsNeeded() {
    return Game.machineCount() <= 3 ? 0 : Math.ceil(Game.interiorArea() / 110);
  },
  attendantsNeeded() { return Game.serviceAmenities().length; },
  staffCount(type) { return Game.state.staff.filter(st => st.type === type).length; },
  techDeficit() { return Math.max(0, Sim.techsNeeded() - Sim.staffCount('tech')); },
  janitorDeficit() { return Math.max(0, Sim.janitorsNeeded() - Sim.staffCount('janitor')); },
  attendantDeficit() { return Math.max(0, Sim.attendantsNeeded() - Sim.staffCount('attendant')); },

  /* ---- Event Manager bonuses: stack with diminishing returns ---- */
  managerBonus() {
    const mgrs = Game.state.staff
      .filter(st => st.type === 'manager')
      .sort((a, b) => b.level - a.level);
    let eff = 0, weight = 1;
    for (const m of mgrs) {
      eff += m.level * weight;
      weight *= 0.55;                 // each extra manager counts a little less
    }
    return {
      eff,
      rev:     1 + 0.12 * eff,        // entry-adjacent revenue (tickets, sponsors)
      rep:     1 + 0.08 * eff,        // reputation gains from events
      spect:   1 + 0.06 * eff,        // attendance draw
      quality: 0.05 * eff,            // added tournament quality score
    };
  },

  hire(type) {
    const s = Game.state;
    const info = DATA.STAFF[type];
    const e = Game.entrance();
    const st = {
      id: s.nextStaffId++,
      type,
      name: Game.pick(DATA.FIRST_NAMES) + ' ' + Game.pick(DATA.LAST_NAMES),
      level: 1,
      xp: 0,
      x: e.x + Game.rand(-0.4, 0.4),
      y: e.y - 0.5,
      task: null,
    };
    s.staff.push(st);
    Game.addNews(`${info.icon} Hired ${st.name} as ${info.name}.`, 'good');
    return st;
  },
  fire(id) {
    const s = Game.state;
    const st = s.staff.find(x => x.id === id);
    if (st && st.task) {
      // Put their unfinished job back where it belongs
      if (st.task.kind === 'clean') { st.task.tile.assigned = null; }
      else {
        const m = s.machines.find(x => x.id === st.task.machineId);
        if (m) { m.assignedTech = null; m.repair = 0; s.repairQueue.unshift({ machineId: m.id, kind: st.task.kind }); }
      }
    }
    s.staff = s.staff.filter(x => x.id !== id);
    if (st) Game.addNews(`👋 ${st.name} has left the team.`, '');
  },

  /* ================= PASSIVE DECAY & LITTER ================= */
  passiveDecay(dt) {
    const s = Game.state;
    // Ambient litter: crowds make a mess even between plays. Scaled by
    // overall difficulty so an empty starter shop stays clean while a
    // packed complex needs a janitor squad on constant patrol
    Sim.litterAccum += s.customers.length * 0.0035 * Game.difficulty() * dt;
    while (Sim.litterAccum >= 1) {
      Sim.litterAccum -= 1;
      Game.spawnDirt(1);
    }
    Game.recalcCleanliness();
  },

  flavor(dt) {
    Sim.flavorTimer -= dt;
    if (Sim.flavorTimer <= 0) {
      Sim.flavorTimer = Game.rand(35, 70);
      UI.pushTicker(Game.pick(DATA.FLAVOR), 'flavor');
    }
  },

  /* ================= END OF DAY ================= */
  endDay() {
    const s = Game.state;

    // Wages & utilities
    let wages = 0;
    for (const st of s.staff) {
      wages += DATA.STAFF[st.type].wage;
      st.xp++;
      const newLevel = Math.min(3, 1 + Math.floor(st.xp / 12));
      if (newLevel > st.level) {
        st.level = newLevel;
        Game.addNews(`⭐ ${st.name} leveled up to Lv.${newLevel} ${DATA.STAFF[st.type].name}!`, 'good');
      }
    }
    if (wages > 0) Game.expense(wages, 'wages');
    const utilities = 15 + Game.state.machines.length * 4 + s.expansion * 25;
    Game.expense(utilities, 'utilities');

    // Idle machine decay — gentle early, real upkeep pressure at scale
    const idleDecay = 0.4 + 0.3 * Game.difficulty();
    for (const m of s.machines) m.condition = Math.max(0, m.condition - idleDecay);

    // Word of mouth fades toward neutral overnight
    s.satisfaction += (55 - s.satisfaction) * 0.08;

    // Reputation drift — the core loop:
    //   + happiness, arcade appeal, amenities, cheap pricing, foot traffic
    //   − dirt, broken machines, gouging, fame decay
    let repDelta = -0.8 - s.reputation * 0.004;                     // fame fades fast at the top
    repDelta += (s.satisfaction - 55) / 8;                          // happiness is the engine
    repDelta += Math.min(2.0, Game.arcadeAppeal() / 40);            // arcade cabinets, claws, neon, amenities
    repDelta -= Game.brokenCount() * 0.5;                           // broken machines embarrass you
    repDelta += Game.clamp((s.cleanliness - 60) / 45, -1.5, 0.6);   // filth is remembered
    if (s.priceLevel <= 0.85) repDelta += (0.9 - s.priceLevel) * 3; // cheap = word of mouth
    if (s.priceLevel >= 1.25) repDelta -= (s.priceLevel - 1.2) * 4; // gouging catches up with you
    repDelta += Math.min(2.0, s.today.customers / 30);              // word of mouth builds fast early
    s.reputation = Game.clamp(s.reputation + repDelta, 0, 1000);

    // Record the day
    const record = {
      day: s.day,
      income: Math.round(s.today.income),
      expense: Math.round(s.today.expense),
      profit: Math.round(s.today.income - s.today.expense),
      customers: s.today.customers,
      sat: Math.round(s.satisfaction),
      cats: s.today.cats,
    };
    s.history.push(record);
    if (s.history.length > 30) s.history.shift();

    UI.showDaySummary(record, wages, utilities, repDelta);

    // Reset for tomorrow
    s.day++;
    s.time = 0;
    s.today = { income: 0, expense: 0, customers: 0, cats: {} };
    if (s.buzzDays > 0) { s.buzzDays--; if (s.buzzDays === 0) s.buzzMult = 1; }

    // Every day feels a little different — roll tomorrow's traffic vibe first
    // so events (flu, field trips) can override it
    s.dayVibe = Game.rand(0.82, 1.18);

    // Roll a random event for the new day
    for (const ev of DATA.EVENTS) {
      if (Math.random() < ev.chance) {
        const msg = ev.run(s);
        if (msg) Game.addNews(msg, 'event');
        break;
      }
    }

    // Morning briefing: what needs the boss's attention
    const brokenN = Game.brokenCount();
    const unassignedBroken = s.machines.filter(m => m.broken && !Game.queueEntry(m.id) && !Game.techOnMachine(m.id)).length;
    if (unassignedBroken > 0)
      Game.addNews(`🔴 ${unassignedBroken} broken machine${unassignedBroken > 1 ? 's' : ''} with no repair assigned — click them and send a technician!`, 'bad');
    else if (brokenN > 0 && Sim.staffCount('tech') === 0)
      Game.addNews('🔴 Machines are broken and you have no technicians on payroll!', 'bad');
    const unflaggedDirt = s.dirtTiles.filter(d => !d.flagged).length;
    if (s.cleanliness < 55 && unflaggedDirt > 3)
      Game.addNews(`🧹 The floor is filthy — ${unflaggedDirt} dirty spots need flagging for the janitors.`, 'bad');
    if (Sim.attendantDeficit() > 0)
      Game.addNews(`🍿 Amenities understaffed! You need ${Sim.attendantsNeeded()} attendant${Sim.attendantsNeeded() > 1 ? 's' : ''} — guests are walking away from empty counters.`, 'bad');
    if (Game.poorCondCount() > 0)
      Game.addNews(`⚠️ ${Game.poorCondCount()} machine${Game.poorCondCount() > 1 ? 's are' : ' is'} in POOR condition — tournaments will disqualify you.`, 'bad');

    // Off-screen circuit: pros play events elsewhere, so rankings shift between your tournaments
    if (s.day % 3 === 0) Sim.offscreenCircuit();
    // Slow natural drift keeps the meta from freezing
    if (s.day % 5 === 0) {
      for (const comp of s.competitors) {
        comp.skill = Game.clamp(comp.skill + Game.rand(-0.3, 0.5), 25, 99);
      }
    }

    Game.save();
    UI.refreshAll();
  },

  /* An 8-player event somewhere else in the world: win/loss records,
     ranking points and skill all move without the player hosting anything. */
  offscreenCircuit() {
    const s = Game.state;
    const field = [...s.competitors].sort(() => Math.random() - 0.5).slice(0, 8);
    let round = field;
    let stage = 0;
    while (round.length > 1) {
      const winners = [];
      for (let i = 0; i < round.length; i += 2) {
        const a = round[i], b = round[i + 1];
        const pa = a.skill * Game.rand(0.8, 1.2), pb = b.skill * Game.rand(0.8, 1.2);
        const w = pa >= pb ? a : b, l = w === a ? b : a;
        w.wins++; l.losses++;
        w.points += 2 * (stage + 1);
        Tournament.skillShift(w, l);
        winners.push(w);
      }
      round = winners;
      stage++;
    }
    round[0].points += 6;
  },
};
