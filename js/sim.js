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
    const repFactor = 0.5 + s.reputation / 140;
    const appealFactor = 1 + Game.totalAppeal() / 55;
    const satFactor = 0.45 + s.satisfaction / 110;
    const priceFactor = Game.clamp(1.6 - 0.6 * s.priceLevel, 0.35, 1.4);
    const buzz = s.buzzDays > 0 ? s.buzzMult : 1;
    // Day curve: quiet open, packed evening
    const curve = Math.pow(Math.sin(Math.PI * Game.clamp(s.time, 0.02, 0.98)), 0.7) * 1.35;
    return 0.55 * repFactor * appealFactor * satFactor * priceFactor * buzz * curve;
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
      const price = Game.machinePrice(m);
      Game.income(price, 'plays');
      m.revenue += price;
      m.plays++;
      c.budget -= price;
      c.playsDone++;

      // Wear and tear — reliability slows it, upgrades refurbish
      const wear = Game.rand(0.8, 1.6) * (11 - def.rel) / 22;
      m.condition = Math.max(0, m.condition - wear);
      if (m.condition < 18 && Math.random() < 0.25) {
        m.broken = true;
        m.repair = 0;
        Game.addNews(`🔴 ${def.name} just broke down!`, 'bad');
      }
      s.cleanliness = Math.max(0, s.cleanliness - 0.12);

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
    s.cleanliness = Math.max(0, s.cleanliness - 0.03 * dt * (1 + s.customers.length / 15));
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

    // Reputation drift: earned by quality + happy customers, decays otherwise
    let repDelta = -0.5;
    repDelta += (s.satisfaction - 50) / 8;
    repDelta += Game.clamp((Game.avgCondition() - 60) / 40, -0.5, 1);
    repDelta += Math.min(2, s.today.customers / 30);   // word of mouth
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

    // Roll a random event for the new day
    for (const ev of DATA.EVENTS) {
      if (Math.random() < ev.chance) {
        const msg = ev.run(s);
        if (msg) Game.addNews(msg, 'event');
        break;
      }
    }

    // Off-screen circuit: competitors grind and improve between your events
    if (s.day % 5 === 0) {
      for (const comp of s.competitors) {
        comp.skill = Math.min(99, comp.skill + Game.rand(0, 0.6));
      }
    }

    Game.save();
    UI.refreshAll();
  },
};
