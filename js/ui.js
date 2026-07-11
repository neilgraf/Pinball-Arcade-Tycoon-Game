/* =========================================================
   UI: top bar, shop, inspector, modals, ticker, brackets
   ========================================================= */

const UI = {
  modalOpen: false,
  tickerQueue: [],
  tickerBusy: false,

  /* ================= INIT ================= */
  init() {
    UI.buildShop();
    UI.bindTopBar();
    UI.bindCanvas();
    UI.refreshAll();
  },

  bindTopBar() {
    document.getElementById('btnDashboard').onclick = UI.openDashboard;
    document.getElementById('btnStaff').onclick = UI.openStaff;
    document.getElementById('btnTournaments').onclick = UI.openTournaments;
    document.getElementById('btnSave').onclick = () => {
      Game.save();
      UI.pushTicker('💾 Game saved.', 'good');
    };
    document.getElementById('btnNew').onclick = () => {
      if (confirm('Start a completely new game? Your current save will be erased.')) {
        Game.wipeSave();
        location.reload();
      }
    };
    for (const spd of [0, 1, 2, 4]) {
      document.getElementById('spd' + spd).onclick = () => UI.setSpeed(spd);
    }
    const slider = document.getElementById('priceSlider');
    slider.oninput = () => {
      Game.state.priceLevel = slider.value / 100;
      UI.refreshPriceLabel();
    };
    document.getElementById('btnExpand').onclick = UI.tryExpand;
    document.getElementById('btnClean').onclick = () => {
      if (Game.state.cash < 60) { UI.pushTicker('Not enough cash for a deep clean ($60).', 'bad'); return; }
      Game.expense(60, 'utilities');
      Game.state.cleanliness = Math.min(100, Game.state.cleanliness + 45);
      UI.pushTicker('🧼 Deep clean complete! +45 cleanliness.', 'good');
      UI.refreshStats();
    };
  },

  setSpeed(spd) {
    Game.state.speed = spd;
    for (const v of [0, 1, 2, 4]) {
      document.getElementById('spd' + v).classList.toggle('active', v === spd);
    }
  },

  /* ================= CANVAS INTERACTION ================= */
  bindCanvas() {
    const cv = document.getElementById('gameCanvas');
    cv.addEventListener('mousemove', (e) => {
      const w = Render.toWorld(e.clientX, e.clientY);
      Render.hoverTile = { x: Math.floor(w.x), y: Math.floor(w.y) };
    });
    cv.addEventListener('mouseleave', () => { Render.hoverTile = null; });
    cv.addEventListener('click', (e) => {
      const w = Render.toWorld(e.clientX, e.clientY);
      const x = Math.floor(w.x), y = Math.floor(w.y);

      if (Render.placingDef) {
        if (Game.tileFree(x, y)) {
          const def = Game.def(Render.placingDef);
          if (Game.state.cash >= def.cost) {
            Game.placeMachine(Render.placingDef, x, y);
            UI.pushTicker(`🕹️ ${def.name} installed!`, 'good');
            if (!e.shiftKey || Game.state.cash < def.cost) UI.cancelPlacement();
            UI.refreshAll();
          } else {
            UI.pushTicker('Not enough cash!', 'bad');
            UI.cancelPlacement();
          }
        }
        return;
      }
      if (Render.movingMachine) {
        if (Game.tileFree(x, y)) {
          Render.movingMachine.x = x;
          Render.movingMachine.y = y;
          Render.movingMachine = null;
          document.getElementById('placeHint').style.display = 'none';
          UI.refreshAll();
        }
        return;
      }
      const m = Game.machineAt(x, y);
      Game.state.selectedMachine = m ? m.id : null;
      UI.refreshInspector();
    });
    cv.addEventListener('contextmenu', (e) => { e.preventDefault(); UI.cancelPlacement(); });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { UI.cancelPlacement(); UI.closeModalSafe(); }
      if (e.key === ' ' && !UI.modalOpen) { e.preventDefault(); UI.setSpeed(Game.state.speed === 0 ? 1 : 0); }
    });
  },

  cancelPlacement() {
    Render.placingDef = null;
    Render.movingMachine = null;
    document.getElementById('placeHint').style.display = 'none';
    document.querySelectorAll('.shop-item').forEach(el => el.classList.remove('placing'));
  },

  /* ================= SHOP ================= */
  buildShop() {
    const list = document.getElementById('shopList');
    list.innerHTML = '';
    const groups = [['pinball', '🎯 Pinball Tables'], ['arcade', '🕹️ Arcade Cabinets'], ['amenity', '🍿 Amenities']];
    for (const [type, label] of groups) {
      const h = document.createElement('div');
      h.className = 'shop-group';
      h.textContent = label;
      list.appendChild(h);
      for (const def of DATA.MACHINES.filter(d => d.type === type)) {
        const el = document.createElement('div');
        el.className = 'shop-item';
        el.id = 'shop_' + def.id;
        el.innerHTML = `
          <div class="shop-swatch" style="background:hsl(${def.hue},60%,45%)"></div>
          <div class="shop-info">
            <div class="shop-name">${def.name}</div>
            <div class="shop-meta">${Game.money(def.cost)}${def.price ? ' · ' + Game.money(def.price) + '/play' : ''}</div>
            <div class="shop-meta dim">${def.pop ? 'Pop ' + def.pop + ' · ' : ''}Appeal ${def.appeal}${def.rel < 10 ? ' · Rel ' + def.rel : ''}</div>
          </div>`;
        el.title = def.blurb;
        el.onclick = () => {
          if (el.classList.contains('locked')) {
            UI.pushTicker(`🔒 ${def.name} unlocks at ${def.repReq} reputation.`, 'bad');
            return;
          }
          if (Render.placingDef === def.id) { UI.cancelPlacement(); return; }
          UI.cancelPlacement();
          Render.placingDef = def.id;
          el.classList.add('placing');
          const hint = document.getElementById('placeHint');
          hint.style.display = 'block';
          hint.textContent = `Placing ${def.name} — click a floor tile (Shift-click to place several, right-click to cancel)`;
        };
        list.appendChild(el);
      }
    }
  },

  refreshShop() {
    const s = Game.state;
    for (const def of DATA.MACHINES) {
      const el = document.getElementById('shop_' + def.id);
      if (!el) continue;
      const locked = s.reputation < def.repReq;
      el.classList.toggle('locked', locked);
      el.classList.toggle('unaffordable', !locked && s.cash < def.cost);
      const nameEl = el.querySelector('.shop-name');
      nameEl.textContent = locked ? `🔒 ${def.name} (rep ${def.repReq})` : def.name;
    }
  },

  /* ================= EXPANSION ================= */
  tryExpand() {
    const s = Game.state;
    if (s.expansion >= DATA.EXPANSIONS.length - 1) return;
    const next = DATA.EXPANSIONS[s.expansion + 1];
    if (s.cash < next.cost) {
      UI.pushTicker(`Need ${Game.money(next.cost)} to expand to the ${next.name}.`, 'bad');
      return;
    }
    if (!confirm(`Expand to the ${next.name} (${next.w}×${next.h}) for ${Game.money(next.cost)}?`)) return;
    Game.expense(next.cost, 'expansion');
    s.expansion++;
    Game.addNews(`🏗️ Your arcade expanded into the ${next.name}!`, 'good');
    UI.refreshAll();
  },

  /* ================= STAT BAR ================= */
  refreshStats() {
    const s = Game.state;
    document.getElementById('statCash').textContent = Game.money(s.cash);
    document.getElementById('statCash').className = 'stat-value ' + (s.cash < 0 ? 'bad' : '');
    document.getElementById('statRep').textContent = Math.round(s.reputation);
    document.getElementById('statRepTier').textContent = Game.repTier().label;
    document.getElementById('statSat').textContent = Math.round(s.satisfaction) + '%';
    document.getElementById('statSat').className = 'stat-value ' + (s.satisfaction < 45 ? 'bad' : s.satisfaction > 70 ? 'good' : '');
    document.getElementById('statClean').textContent = Math.round(s.cleanliness) + '%';
    document.getElementById('statClean').className = 'stat-value ' + (s.cleanliness < 45 ? 'bad' : '');
    document.getElementById('statDay').textContent = 'Day ' + s.day;
    // Clock: arcade open 10:00 → 24:00
    const hours = 10 + s.time * 14;
    const hh = Math.floor(hours), mm = Math.floor((hours - hh) * 60);
    document.getElementById('statClock').textContent =
      `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    document.getElementById('statGuests').textContent = s.customers.length;
    if (s.buzzDays > 0) {
      document.getElementById('buzzBadge').style.display = 'inline-block';
      document.getElementById('buzzBadge').textContent = `🔥 BUZZ ×${s.buzzMult.toFixed(1)} (${s.buzzDays}d)`;
    } else {
      document.getElementById('buzzBadge').style.display = 'none';
    }
  },

  refreshPriceLabel() {
    const p = Game.state.priceLevel;
    const el = document.getElementById('priceLabel');
    el.textContent = `Pricing: ${Math.round(p * 100)}%`;
    el.className = p > 1.4 ? 'bad' : p < 0.8 ? 'good' : '';
  },

  refreshExpandBtn() {
    const s = Game.state;
    const btn = document.getElementById('btnExpand');
    if (s.expansion >= DATA.EXPANSIONS.length - 1) {
      btn.textContent = '🏟️ ' + DATA.EXPANSIONS[s.expansion].name + ' (MAX)';
      btn.disabled = true;
    } else {
      const next = DATA.EXPANSIONS[s.expansion + 1];
      btn.textContent = `🏗️ Expand: ${next.name} — ${Game.money(next.cost)}`;
      btn.disabled = false;
    }
  },

  refreshAll() {
    UI.refreshStats();
    UI.refreshShop();
    UI.refreshPriceLabel();
    UI.refreshExpandBtn();
    UI.refreshInspector();
  },

  /* ================= INSPECTOR PANEL ================= */
  refreshInspector() {
    const panel = document.getElementById('inspectPanel');
    const s = Game.state;
    const m = s.machines.find(x => x.id === s.selectedMachine);
    if (!m) { panel.style.display = 'none'; return; }
    const def = Game.def(m.defId);
    panel.style.display = 'block';
    const condClass = m.condition > 60 ? 'good' : m.condition > 30 ? 'warn' : 'bad';
    const upgCost = Game.upgradeCost(m);
    const repCost = Game.repairCost(m);
    const isAmenity = def.type === 'amenity';
    panel.innerHTML = `
      <div class="insp-head" style="border-color:hsl(${def.hue},70%,50%)">
        <span class="insp-title">${def.name}${m.level > 0 ? ' ' + '★'.repeat(m.level) : ''}</span>
        <button class="btn-x" onclick="UI.deselect()">✕</button>
      </div>
      <div class="insp-blurb">${def.blurb}</div>
      ${isAmenity ? '' : `
      <div class="insp-row"><span>Status</span><b class="${m.broken ? 'bad' : 'good'}">${m.broken ? '🔴 OUT OF ORDER' : m.busy !== null ? '🎮 In use' : '🟢 Ready'}</b></div>
      <div class="insp-row"><span>Condition</span><b class="${condClass}">${Math.round(m.condition)}%</b></div>
      <div class="insp-bar"><div class="insp-bar-fill ${condClass}" style="width:${m.condition}%"></div></div>
      <div class="insp-row"><span>Price/play</span><b>${Game.money(Game.machinePrice(m))}</b></div>
      <div class="insp-row"><span>Total plays</span><b>${m.plays}</b></div>
      <div class="insp-row"><span>Lifetime revenue</span><b>${Game.money(m.revenue)}</b></div>
      `}
      <div class="insp-actions">
        ${m.broken ? `<button class="btn primary" onclick="UI.repairMachine(${m.id})" ${s.cash < repCost ? 'disabled' : ''}>🔧 Repair ${Game.money(repCost)}</button>` : ''}
        ${!isAmenity && m.level < 3 ? `<button class="btn" onclick="UI.upgradeMachine(${m.id})" ${s.cash < upgCost ? 'disabled' : ''}>⬆ Upgrade ${Game.money(upgCost)}</button>` : ''}
        <button class="btn" onclick="UI.moveMachine(${m.id})">↔ Move</button>
        <button class="btn danger" onclick="UI.sellMachine(${m.id})">💸 Sell</button>
      </div>`;
  },

  deselect() {
    Game.state.selectedMachine = null;
    UI.refreshInspector();
  },
  repairMachine(id) {
    const m = Game.state.machines.find(x => x.id === id);
    if (!m) return;
    const cost = Game.repairCost(m);
    if (Game.state.cash < cost) return;
    Game.expense(cost, 'repairs');
    m.broken = false;
    m.repair = 0;
    m.condition = 100;
    UI.pushTicker(`🔧 ${Game.def(m.defId).name} repaired to mint condition.`, 'good');
    UI.refreshAll();
  },
  upgradeMachine(id) {
    const m = Game.state.machines.find(x => x.id === id);
    if (!m || m.level >= 3) return;
    const cost = Game.upgradeCost(m);
    if (Game.state.cash < cost) return;
    Game.expense(cost, 'upgrades');
    m.level++;
    m.condition = Math.min(100, m.condition + 25);
    UI.pushTicker(`⬆ ${Game.def(m.defId).name} upgraded to ${'★'.repeat(m.level)}!`, 'good');
    UI.refreshAll();
  },
  moveMachine(id) {
    const m = Game.state.machines.find(x => x.id === id);
    if (!m) return;
    UI.cancelPlacement();
    Render.movingMachine = m;
    const hint = document.getElementById('placeHint');
    hint.style.display = 'block';
    hint.textContent = `Moving ${Game.def(m.defId).name} — click a new floor tile (right-click to cancel)`;
  },
  sellMachine(id) {
    const m = Game.state.machines.find(x => x.id === id);
    if (!m) return;
    const def = Game.def(m.defId);
    const refund = Math.round(def.cost * 0.5 * (0.4 + 0.6 * m.condition / 100));
    if (!confirm(`Sell ${def.name} for ${Game.money(refund)}?`)) return;
    Game.sellMachine(m);
    UI.pushTicker(`💸 Sold ${def.name} for ${Game.money(refund)}.`, '');
    UI.refreshAll();
  },

  /* ================= TICKER ================= */
  pushTicker(text, cls) {
    UI.tickerQueue.push({ text, cls });
    if (!UI.tickerBusy) UI.drainTicker();
  },
  drainTicker() {
    const el = document.getElementById('ticker');
    if (UI.tickerQueue.length === 0) { UI.tickerBusy = false; return; }
    UI.tickerBusy = true;
    const item = UI.tickerQueue.shift();
    if (UI.tickerQueue.length > 3) UI.tickerQueue.splice(0, UI.tickerQueue.length - 3);
    el.className = 'ticker show ' + (item.cls || '');
    el.textContent = item.text;
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(UI.drainTicker, 250);
    }, 3200);
  },

  /* ================= MODAL SYSTEM ================= */
  openModal(html, wide) {
    const ov = document.getElementById('modalOverlay');
    const box = document.getElementById('modalBox');
    box.className = 'modal-box' + (wide ? ' wide' : '');
    box.innerHTML = html;
    ov.style.display = 'flex';
    UI.modalOpen = true;
  },
  closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
    UI.modalOpen = false;
    UI.refreshAll();
  },
  closeModalSafe() {
    // Don't allow escaping an in-progress tournament
    if (Tournament.active && !Tournament.active.finished) return;
    if (Tournament.active) { Tournament.close(); }
    UI.closeModal();
  },

  /* ================= DASHBOARD ================= */
  openDashboard() {
    const s = Game.state;
    const hist = s.history.slice(-14);
    const maxAbs = Math.max(50, ...hist.map(h => Math.abs(h.profit)));
    const bars = hist.map(h => {
      const pct = Math.abs(h.profit) / maxAbs * 100;
      return `<div class="chart-col" title="Day ${h.day}: ${Game.money(h.profit)} profit, ${h.customers} guests">
        <div class="chart-bar ${h.profit >= 0 ? 'pos' : 'neg'}" style="height:${Math.max(3, pct)}%"></div>
        <div class="chart-label">${h.day}</div>
      </div>`;
    }).join('');

    const best = [...s.machines]
      .filter(m => Game.def(m.defId).type !== 'amenity')
      .sort((a, b) => b.revenue - a.revenue).slice(0, 6);
    const bestRows = best.map(m => {
      const def = Game.def(m.defId);
      return `<tr><td>${def.name}${m.level ? ' ' + '★'.repeat(m.level) : ''}</td>
        <td>${m.plays}</td><td>${Game.money(m.revenue)}</td>
        <td class="${m.condition > 60 ? 'good' : m.condition > 30 ? 'warn' : 'bad'}">${Math.round(m.condition)}%</td></tr>`;
    }).join('') || '<tr><td colspan="4" class="dim">No machines yet</td></tr>';

    const last = s.history[s.history.length - 1];
    const catRows = last ? Object.entries(last.cats).map(([k, v]) =>
      `<div class="insp-row"><span>${UI.catName(k)}</span><b class="${v >= 0 ? 'good' : 'bad'}">${Game.money(v)}</b></div>`
    ).join('') : '<div class="dim">Finish your first day to see a breakdown.</div>';

    UI.openModal(`
      <div class="modal-head"><h2>📊 Business Dashboard</h2><button class="btn-x" onclick="UI.closeModal()">✕</button></div>
      <div class="dash-grid">
        <div class="dash-card">
          <h3>Profit — last ${hist.length} days</h3>
          <div class="chart">${bars || '<span class="dim">No data yet</span>'}</div>
        </div>
        <div class="dash-card">
          <h3>Yesterday's breakdown ${last ? '(Day ' + last.day + ')' : ''}</h3>
          ${catRows}
          ${last ? `<div class="insp-row total"><span>Net profit</span><b class="${last.profit >= 0 ? 'good' : 'bad'}">${Game.money(last.profit)}</b></div>` : ''}
        </div>
        <div class="dash-card">
          <h3>Best-performing machines</h3>
          <table class="dash-table">
            <tr><th>Machine</th><th>Plays</th><th>Revenue</th><th>Cond.</th></tr>
            ${bestRows}
          </table>
        </div>
        <div class="dash-card">
          <h3>All-time</h3>
          <div class="insp-row"><span>Total revenue</span><b>${Game.money(s.totalStats.revenue)}</b></div>
          <div class="insp-row"><span>Total guests</span><b>${s.totalStats.customers.toLocaleString()}</b></div>
          <div class="insp-row"><span>Tournaments hosted</span><b>${s.totalStats.tournaments}</b></div>
          <div class="insp-row"><span>Venue</span><b>${DATA.EXPANSIONS[s.expansion].name}</b></div>
          <div class="insp-row"><span>Reputation</span><b>${Math.round(s.reputation)} / 1000 — ${Game.repTier().label}</b></div>
        </div>
      </div>`, true);
  },

  catName(k) {
    return { plays: '🕹️ Machine plays', snacks: '🍿 Concessions', tournament: '🏆 Tournament', sponsors: '🤝 Sponsors',
      sales: '💸 Machine sales', machines: '🛒 Machines bought', wages: '👥 Wages', utilities: '💡 Utilities',
      repairs: '🔧 Repairs', upgrades: '⬆ Upgrades', expansion: '🏗️ Expansion' }[k] || k;
  },

  /* ================= STAFF ================= */
  openStaff() {
    const s = Game.state;
    const cards = Object.entries(DATA.STAFF).map(([type, info]) => `
      <div class="dash-card">
        <h3>${info.icon} ${info.name} — ${Game.money(info.wage)}/day</h3>
        <div class="insp-blurb">${info.desc}</div>
        <button class="btn primary" onclick="UI.hireStaff('${type}')">Hire ${info.name}</button>
      </div>`).join('');
    const roster = s.staff.map(st => {
      const info = DATA.STAFF[st.type];
      return `<tr><td>${info.icon} ${st.name}</td><td>${info.name}</td><td>Lv.${st.level}</td>
        <td>${Game.money(info.wage)}/day</td>
        <td><button class="btn danger small" onclick="UI.fireStaff(${st.id})">Fire</button></td></tr>`;
    }).join('') || '<tr><td colspan="5" class="dim">No staff hired. The place runs on hope alone.</td></tr>';
    const totalWages = s.staff.reduce((a, st) => a + DATA.STAFF[st.type].wage, 0);

    UI.openModal(`
      <div class="modal-head"><h2>👥 Staff Management</h2><button class="btn-x" onclick="UI.closeModal()">✕</button></div>
      <div class="dash-grid three">${cards}</div>
      <div class="dash-card">
        <h3>Your team — ${Game.money(totalWages)}/day in wages</h3>
        <table class="dash-table">
          <tr><th>Name</th><th>Role</th><th>Level</th><th>Wage</th><th></th></tr>
          ${roster}
        </table>
      </div>`, true);
  },
  hireStaff(type) {
    Sim.hire(type);
    UI.openStaff();
    UI.refreshStats();
  },
  fireStaff(id) {
    Sim.fire(id);
    UI.openStaff();
  },

  /* ================= TOURNAMENTS HUB ================= */
  openTournaments(tab) {
    tab = typeof tab === 'string' ? tab : 'events';
    const s = Game.state;
    let body = '';

    if (tab === 'events') {
      body = DATA.TIERS.map(tier => {
        const checks = Tournament.checkRequirements(tier);
        const can = checks.every(c => c.ok);
        const hostedN = s.hosted[tier.id] || 0;
        const checkHtml = checks.map(c =>
          `<div class="req ${c.ok ? 'ok' : 'no'}">${c.ok ? '✓' : '✗'} ${c.label} <span class="dim">(${c.now})</span></div>`).join('');
        return `
        <div class="dash-card tier-card ${tier.id === 'world' ? 'world' : ''}">
          <h3>${tier.name} ${hostedN > 0 ? `<span class="hosted-badge">hosted ${hostedN}×</span>` : ''}</h3>
          <div class="insp-blurb">${tier.desc}</div>
          <div class="insp-row"><span>Entrants</span><b>${tier.entrants} players</b></div>
          <div class="insp-row"><span>Entry fees</span><b class="good">+${Game.money(tier.entrants * tier.entryFee)}</b></div>
          <div class="insp-row"><span>Tickets</span><b class="good">~${Game.money(tier.ticket)}/spectator</b></div>
          <div class="insp-row"><span>Prize pool</span><b class="bad">-${Game.money(tier.prize)}</b></div>
          <div class="req-list">${checkHtml}</div>
          <button class="btn ${can ? 'primary' : ''}" ${can ? '' : 'disabled'} onclick="UI.hostTournament('${tier.id}')">
            ${can ? '🏆 HOST NOW' : 'Requirements not met'}
          </button>
        </div>`;
      }).join('');
    } else if (tab === 'circuit') {
      const sorted = [...s.competitors].sort((a, b) => b.skill - a.skill);
      body = `<div class="dash-card"><h3>Pro Circuit Rankings</h3>
        <table class="dash-table">
        <tr><th>#</th><th>Player</th><th>Skill</th><th>Style</th><th>W–L</th><th>Titles</th></tr>
        ${sorted.map((p, i) => `<tr>
          <td>${i + 1}</td>
          <td>${Tournament.displayName(p)}</td>
          <td>${Math.round(p.skill)}</td>
          <td>${DATA.STYLES.find(st => st.id === p.style).name}</td>
          <td>${p.wins}–${p.losses}</td>
          <td>${p.titles > 0 ? '🏆'.repeat(Math.min(p.titles, 5)) + (p.titles > 5 ? '×' + p.titles : '') : '—'}</td>
        </tr>`).join('')}
        </table></div>`;
    } else {
      body = `<div class="dash-card"><h3>Hall of Champions</h3>
        ${s.champions.length === 0 ? '<div class="dim">No tournaments hosted yet. History awaits.</div>' :
        `<table class="dash-table"><tr><th>Day</th><th>Event</th><th>Champion</th></tr>
        ${s.champions.map(c => `<tr class="${c.tierId === 'world' ? 'world-row' : ''}">
          <td>${c.day}</td><td>${c.tier}</td><td>${c.name}</td></tr>`).join('')}</table>`}
      </div>`;
    }

    UI.openModal(`
      <div class="modal-head"><h2>🏆 Competitive Pinball</h2><button class="btn-x" onclick="UI.closeModal()">✕</button></div>
      <div class="tabs">
        <button class="tab ${tab === 'events' ? 'active' : ''}" onclick="UI.openTournaments('events')">Events</button>
        <button class="tab ${tab === 'circuit' ? 'active' : ''}" onclick="UI.openTournaments('circuit')">Pro Circuit</button>
        <button class="tab ${tab === 'history' ? 'active' : ''}" onclick="UI.openTournaments('history')">Hall of Champions</button>
      </div>
      ${body}`, true);
  },

  hostTournament(tierId) {
    const t = Tournament.start(tierId);
    if (!t) return;
    UI.renderBracket();
  },

  /* ================= BRACKET VIEW ================= */
  renderBracket() {
    const t = Tournament.active;
    if (!t) return;
    const totalRounds = t.roundNames.length;

    const cols = [];
    for (let r = 0; r < totalRounds; r++) {
      const round = t.rounds[r];
      let matchHtml;
      if (round) {
        matchHtml = round.map(m => {
          const done = m.winner !== null;
          const line = (p, score, won) => `
            <div class="bk-player ${done ? (won ? 'won' : 'lost') : ''}">
              <span class="bk-name">${p ? p.name : 'TBD'}</span>
              ${done ? `<span class="bk-score">${score.toLocaleString()}</span>` : ''}
            </div>`;
          return `<div class="bk-match ${done && m.kind === 'upset' ? 'upset' : ''}">
            ${line(m.p1, m.s1, m.winner === m.p1)}
            ${line(m.p2, m.s2, m.winner === m.p2)}
          </div>`;
        }).join('');
      } else {
        const count = t.rounds[0].length / Math.pow(2, r);
        matchHtml = Array.from({ length: count }, () =>
          `<div class="bk-match pending"><div class="bk-player"><span class="bk-name dim">TBD</span></div><div class="bk-player"><span class="bk-name dim">TBD</span></div></div>`).join('');
      }
      cols.push(`<div class="bk-round"><div class="bk-round-name">${t.roundNames[r]}</div>${matchHtml}</div>`);
    }

    const highlights = t.highlights.slice(-6).map(h =>
      `<div class="highlight"><b>${h.round}:</b> ${h.text}</div>`).join('');

    let footer;
    if (!t.finished) {
      const playedRounds = t.rounds.filter(r => r.every(m => m.winner)).length;
      footer = `<button class="btn primary big" onclick="UI.playRound()">
        ▶ ${playedRounds === 0 ? 'START ' + t.roundNames[0].toUpperCase() : 'PLAY ' + t.roundNames[playedRounds].toUpperCase()}
      </button>`;
    } else {
      const r = t.revenue;
      footer = `
      <div class="champ-banner">🏆 ${Tournament.displayName(t.champion)} is the ${t.tier.name} champion! 🏆</div>
      <div class="dash-grid">
        <div class="dash-card">
          <h3>💰 Event finances</h3>
          <div class="insp-row"><span>Entry fees</span><b class="good">+${Game.money(r.entryRev)}</b></div>
          <div class="insp-row"><span>Tickets (${r.spectators.toLocaleString()} spectators)</span><b class="good">+${Game.money(r.ticketRev)}</b></div>
          ${r.sponsorRev ? `<div class="insp-row"><span>Sponsors</span><b class="good">+${Game.money(r.sponsorRev)}</b></div>` : ''}
          ${r.snackRev ? `<div class="insp-row"><span>Concessions</span><b class="good">+${Game.money(r.snackRev)}</b></div>` : ''}
          <div class="insp-row"><span>Prize pool</span><b class="bad">-${Game.money(r.prize)}</b></div>
          <div class="insp-row"><span>Hosting costs</span><b class="bad">-${Game.money(r.hostCost)}</b></div>
          <div class="insp-row total"><span>Net</span><b class="${r.net >= 0 ? 'good' : 'bad'}">${Game.money(r.net)}</b></div>
        </div>
        <div class="dash-card">
          <h3>📈 Aftermath</h3>
          <div class="insp-row"><span>Reputation</span><b class="good">+${r.repGain}</b></div>
          <div class="insp-row"><span>Post-event buzz</span><b class="good">×${Game.state.buzzMult.toFixed(1)} traffic for ${Game.state.buzzDays} days</b></div>
          <div class="insp-row"><span>Excitement rating</span><b>${'⭐'.repeat(Game.clamp(Math.round(t.excitement * 3), 1, 5))}</b></div>
          <div class="insp-row"><span>Upsets</span><b>${t.upsets}</b></div>
          <div class="insp-blurb">Machines took some wear from the event — check their condition.</div>
        </div>
      </div>
      <button class="btn primary big" onclick="Tournament.close(); UI.closeModal();">Return to your arcade</button>`;
    }

    UI.openModal(`
      <div class="modal-head">
        <h2>${t.tier.id === 'world' ? '🌍 ' : '🏆 '}${t.tier.name}</h2>
        ${t.finished ? '<button class="btn-x" onclick="Tournament.close(); UI.closeModal();">✕</button>' : '<span class="live-badge">● LIVE</span>'}
      </div>
      <div class="bracket">${cols.join('')}</div>
      ${highlights ? `<div class="highlights"><h3>🎙️ Commentary</h3>${highlights}</div>` : ''}
      <div class="bk-footer">${footer}</div>`, true);
  },

  playRound() {
    Tournament.playNextRound();
    UI.renderBracket();
  },

  /* ================= DAY SUMMARY ================= */
  showDaySummary(record, wages, utilities, repDelta) {
    const el = document.getElementById('daySummary');
    el.innerHTML = `
      <b>🌙 Day ${record.day} closed</b> —
      <span class="${record.profit >= 0 ? 'good' : 'bad'}">${Game.money(record.profit)} profit</span>
      · ${record.customers} guests
      · rep ${repDelta >= 0 ? '+' : ''}${repDelta.toFixed(1)}`;
    el.classList.add('show');
    clearTimeout(UI._sumTimer);
    UI._sumTimer = setTimeout(() => el.classList.remove('show'), 5000);
  },

  /* ================= VICTORY ================= */
  showVictory() {
    const s = Game.state;
    UI.openModal(`
      <div class="victory">
        <div class="victory-trophy">🏆</div>
        <h1>WORLD CHAMPIONSHIP HOSTED!</h1>
        <p class="victory-sub">From a dusty corner shop to the epicenter of world pinball.</p>
        <div class="dash-grid">
          <div class="dash-card">
            <div class="insp-row"><span>Days to glory</span><b>${s.day}</b></div>
            <div class="insp-row"><span>Total revenue</span><b>${Game.money(s.totalStats.revenue)}</b></div>
            <div class="insp-row"><span>Guests served</span><b>${s.totalStats.customers.toLocaleString()}</b></div>
          </div>
          <div class="dash-card">
            <div class="insp-row"><span>Tournaments hosted</span><b>${s.totalStats.tournaments}</b></div>
            <div class="insp-row"><span>Reputation</span><b>${Math.round(s.reputation)} — ${Game.repTier().label}</b></div>
            <div class="insp-row"><span>Venue</span><b>${DATA.EXPANSIONS[s.expansion].name}</b></div>
          </div>
        </div>
        <p class="victory-sub">The circuit already wants next year's edition. Keep building — your legacy is just getting started.</p>
        <button class="btn primary big" onclick="UI.closeModal()">Continue playing</button>
      </div>`, true);
  },

  /* ================= WELCOME ================= */
  showWelcome() {
    UI.openModal(`
      <div class="modal-head"><h2>🕹️ PINBALL PALACE TYCOON</h2></div>
      <div class="insp-blurb" style="font-size:14px; line-height:1.7">
        You've just signed the lease on a tiny corner-shop arcade with two beat-up machines and big dreams.<br><br>
        <b>💰 Get rich:</b> buy machines, tune your pricing, keep guests happy, expand the venue.<br>
        <b>🏆 Get famous:</b> build reputation, host tournaments — Local ➜ Regional ➜ National ➜ <b>WORLD CHAMPIONSHIP</b>.<br><br>
        <b>Quick tips:</b><br>
        • Click a machine in the <b>shop</b> (left), then click the floor to place it.<br>
        • Click any placed machine to inspect, upgrade, repair, or move it.<br>
        • Machines wear out — hire a <b>technician</b> before things fall apart.<br>
        • Dirty floors and broken machines wreck satisfaction, and satisfaction drives everything.<br>
        • <b>Space</b> pauses. Speed buttons are up top. Your game auto-saves every night.
      </div>
      <button class="btn primary big" onclick="UI.closeModal()">Open the doors!</button>`);
  },
};
