/* =========================================================
   Real-time simulation: customers, machines, staff, day cycle
   ========================================================= */

const Sim = {
  spawnAccum: 0,
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
    // Traffic model: reputation + machine appeal draw people in;
    // satisfaction and pricing decide whether they bother coming back.
    const repFactor = 0.5 + s.reputation / 155;
    const appealFactor = 1 + Game.totalAppeal() / 60;
    const satFactor = 0.45 + s.satisfaction / 110;
    const priceFactor = Game.clamp(1.6 - 0.6 * s.priceLevel, 0.35, 1.4);
    const buzz = s.buzzDays > 0 ? s.buzzMult : 1;
    // Grimy floors turn people away at the door
    const cleanFactor = Game.clamp(0.55 + s.cleanliness / 130, 0.55, 1.3);
    // Day curve: quiet open, packed evening
    const curve = Math.pow(Math.sin(Math.PI * Game.clamp(s.time, 0.02, 0.98)), 0.7) * 1.35;
    return 0.5 * repFactor * appealFactor * satFactor * priceFactor * cleanFactor * buzz * (s.dayVibe || 1) * curve;
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
      timer: 0,
      // Pros prefer pinball hard, spend more, and are pickier
      prefPinball: pro ? 0.9 : Game.rand(0.35, 0.75),
      budget: pro ? Game.rand(14, 32) : Game.rand(6, 20),
      playsTarget: pro ? Game.randInt(5, 9) : Game.randInt(2, 6),
      patience: pro ? 4 : Game.randInt(3, 5),
      mood: 0,          // accumulated satisfaction modifiers
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
      switch (c.phase) {
        case 'choose': Sim.customerChoose(c); break;
        case 'walk':   Sim.customerWalk(c, dt); break;
        case 'play':   Sim.customerPlay(c, dt); break;
        case 'browse': Sim.customerBrowse(c, dt); break;
        case 'leave':  Sim.customerLeave(c, dt, i); break;
      }
    }
  },

  customerChoose(c) {
    const s = Game.state;
    if (c.budget <= 0.4 || c.patience <= 0 || c.playsDone >= c.playsTarget) { Sim.startLeaving(c); return; }
    // Score every free, working machine
    let best = null, bestScore = -1;
    for (const m of s.machines) {
      const def = Game.def(m.defId);
      if (def.type === 'amenity') continue;
      if (m.broken || m.busy !== null) continue;
      if (Game.machinePrice(m) > c.budget) continue;
      const typeAff = def.type === 'pinball' ? c.prefPinball : 1 - c.prefPinball;
      const condFactor = 0.4 + 0.6 * m.condition / 100;
      const score = (def.pop + m.level * 1.2) * typeAff * condFactor * Game.rand(0.7, 1.3);
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
      const condFactor = 0.7 + 0.3 * m.condition / 100;
      const price = Game.machinePrice(m) * condFactor * Game.rand(0.94, 1.08);
      Game.income(price, 'plays');
      m.revenue += price;
      m.plays++;
      c.budget -= price;
      c.playsDone++;

      // Wear and tear — reliability slows it; big fleets stretch upkeep thin
      const fleetMult = 1 + Game.machineCount() / 30;
      const staffMult = Sim.techDeficit() > 0 ? 1.35 : 1;
      const wear = Game.rand(0.9, 1.8) * (11 - def.rel) / 22 * fleetMult * staffMult;
      m.condition = Math.max(0, m.condition - wear);
      // Breakdowns: rare when healthy, likely when neglected
      const breakChance = m.condition < 20 ? 0.3 : m.condition < 45 ? 0.02 : 0.002;
      if (Math.random() < breakChance * staffMult) {
        m.broken = true;
        m.repair = 0;
        Game.addNews(`🔴 ${def.name} just broke down!`, 'bad');
      }
      // Foot traffic makes a mess, and big rooms take more to keep clean
      const dirt = 0.10 * (1 + s.customers.length / 20) * (1 + s.expansion * 0.15);
      s.cleanliness = Math.max(0, s.cleanliness - dirt);

      // Per-play mood contribution
      c.mood += (m.condition - 55) * 0.06
              + (def.pop + m.level) * 0.5
              - (s.priceLevel - 1) * 5;
      m.busy = null;
      c.machineId = null;
    }
    // Snack bar / prize counter visits
    if (Math.random() < 0.30 && Game.hasAmenity('snackbar')) {
      Game.income(2 * Game.state.priceLevel, 'snacks'); c.mood += 3; c.budget -= 1;
    }
    if (Math.random() < 0.12 && Game.hasAmenity('prizes')) {
      Game.income(3, 'snacks'); c.mood += 4;
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
    // Final satisfaction score for this visit
    let sat = 58 + c.mood
            + (s.cleanliness - 60) * 0.25
            + (Game.hasAmenity('snackbar') ? 3 : 0)
            + (Game.hasAmenity('prizes') ? 3 : 0);
    if (c.playsDone === 0) sat -= 15;
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

  /* ================= STAFF ================= */
  updateStaff(dt) {
    const s = Game.state;
    for (const st of s.staff) {
      if (st.type === 'janitor') {
        s.cleanliness = Math.min(100, s.cleanliness + 0.22 * st.level * dt);
      } else if (st.type === 'tech') {
        // Fix broken machines first, then top up the worst one
        let target = s.machines.find(m => m.broken);
        if (target) {
          target.repair += dt / (14 / st.level);
          if (target.repair >= 1) {
            target.broken = false;
            target.repair = 0;
            target.condition = Math.max(target.condition, 70 + st.level * 8);
            Game.addNews(`🔧 Technician repaired ${Game.def(target.defId).name}.`, 'good');
          }
        } else {
          let worst = null;
          for (const m of s.machines) {
            if (Game.def(m.defId).type === 'amenity' || m.condition >= 96) continue;
            if (!worst || m.condition < worst.condition) worst = m;
          }
          if (worst) worst.condition = Math.min(100, worst.condition + 0.9 * st.level * dt);
        }
      }
      // manager has no per-tick effect; bonuses apply in tournaments
    }
  },

  hasManager() { return Game.state.staff.some(st => st.type === 'manager'); },

  /* ---- staffing requirements: bigger arcades need bigger crews ---- */
  techsNeeded() {
    const n = Game.machineCount();
    return n <= 3 ? 0 : Math.ceil(n / 6);
  },
  janitorsNeeded() {
    const n = Game.machineCount();
    return n <= 3 ? 0 : Math.ceil((n + Game.state.expansion * 4) / 10);
  },
  staffCount(type) { return Game.state.staff.filter(st => st.type === type).length; },
  techDeficit() { return Math.max(0, Sim.techsNeeded() - Sim.staffCount('tech')); },
  janitorDeficit() { return Math.max(0, Sim.janitorsNeeded() - Sim.staffCount('janitor')); },

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
    const st = {
      id: s.nextStaffId++,
      type,
      name: Game.pick(DATA.FIRST_NAMES) + ' ' + Game.pick(DATA.LAST_NAMES),
      level: 1,
      xp: 0,
    };
    s.staff.push(st);
    Game.addNews(`${info.icon} Hired ${st.name} as ${info.name}.`, 'good');
    return st;
  },
  fire(id) {
    const s = Game.state;
    const st = s.staff.find(x => x.id === id);
    s.staff = s.staff.filter(x => x.id !== id);
    if (st) Game.addNews(`👋 ${st.name} has left the team.`, '');
  },

  /* ================= PASSIVE DECAY ================= */
  passiveDecay(dt) {
    const s = Game.state;
    // Dirt builds with crowd size and venue footprint; understaffed janitors make it worse
    const sizeMult = 1 + s.expansion * 0.2;
    const janMult = 1 + 0.5 * Sim.janitorDeficit();
    s.cleanliness = Math.max(0, s.cleanliness - 0.035 * dt * (1 + s.customers.length / 12) * sizeMult * janMult);
    // Understaffed technicians: the whole fleet slowly falls behind on upkeep
    const deficit = Sim.techDeficit();
    if (deficit > 0) {
      const extra = 0.05 * deficit * dt;
      for (const m of s.machines) {
        if (Game.def(m.defId).type === 'amenity') continue;
        m.condition = Math.max(0, m.condition - extra);
      }
    }
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
    const utilities = 12 + Game.state.machines.length * 3 + s.expansion * 15;
    Game.expense(utilities, 'utilities');

    // Idle machine decay
    for (const m of s.machines) m.condition = Math.max(0, m.condition - 0.4);

    // Word of mouth fades toward neutral overnight
    s.satisfaction += (55 - s.satisfaction) * 0.08;

    // Reputation drift: earned by quality + happy customers, decays otherwise.
    // High reputation is expensive to hold — fame fades fast at the top.
    let repDelta = -0.6 - s.reputation * 0.003;
    repDelta += (s.satisfaction - 52) / 9;
    repDelta += Game.clamp((Game.avgCondition() - 62) / 45, -0.8, 0.9);
    repDelta += Game.clamp((s.cleanliness - 55) / 60, -0.8, 0.5);
    repDelta += Math.min(1.5, s.today.customers / 40);   // word of mouth
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

    // Staffing & upkeep warnings for the morning
    const techDef = Sim.techDeficit(), janDef = Sim.janitorDeficit();
    if (techDef > 0)
      Game.addNews(`⚠️ Maintenance understaffed! You need ${Sim.techsNeeded()} technician${Sim.techsNeeded() > 1 ? 's' : ''} for ${Game.machineCount()} machines — wear and breakdowns are accelerating.`, 'bad');
    if (janDef > 0)
      Game.addNews(`⚠️ Cleaning crew understaffed! You need ${Sim.janitorsNeeded()} janitor${Sim.janitorsNeeded() > 1 ? 's' : ''} for an arcade this size.`, 'bad');
    if (s.cleanliness < 40)
      Game.addNews('🧹 Cleanliness critical! Guests are turning away at the door and your reputation is suffering.', 'bad');

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
