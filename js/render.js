/* =========================================================
   Canvas renderer — top-down neon arcade view
   ========================================================= */

const Render = {
  canvas: null, ctx: null,
  scale: 1, offX: 0, offY: 0,
  time: 0,
  placingDef: null,    // machine def id while in placement mode
  movingMachine: null, // machine being repositioned
  hoverTile: null,

  init() {
    Render.canvas = document.getElementById('gameCanvas');
    Render.ctx = Render.canvas.getContext('2d');
    window.addEventListener('resize', Render.fit);
    Render.fit();
  },

  fit() {
    const wrap = document.getElementById('canvasWrap');
    const dpr = window.devicePixelRatio || 1;
    Render.canvas.width = wrap.clientWidth * dpr;
    Render.canvas.height = wrap.clientHeight * dpr;
    Render.canvas.style.width = wrap.clientWidth + 'px';
    Render.canvas.style.height = wrap.clientHeight + 'px';
    Render.dpr = dpr;
  },

  // Layout can settle after init (fonts, panes); re-fit whenever sizes drift
  checkFit() {
    const wrap = document.getElementById('canvasWrap');
    const dpr = window.devicePixelRatio || 1;
    if (Render.canvas.width !== wrap.clientWidth * dpr ||
        Render.canvas.height !== wrap.clientHeight * dpr) {
      Render.fit();
    }
  },

  computeCamera() {
    const g = Game.gridSize();
    const T = Game.TILE;
    const gw = g.w * T, gh = g.h * T;
    const cw = Render.canvas.width, ch = Render.canvas.height;
    Render.scale = Math.min(cw / (gw + 30), ch / (gh + 30));
    Render.offX = (cw - gw * Render.scale) / 2;
    Render.offY = (ch - gh * Render.scale) / 2;
  },

  toWorld(clientX, clientY) {
    const rect = Render.canvas.getBoundingClientRect();
    const px = (clientX - rect.left) * Render.dpr;
    const py = (clientY - rect.top) * Render.dpr;
    const T = Game.TILE;
    return {
      x: (px - Render.offX) / Render.scale / T,
      y: (py - Render.offY) / Render.scale / T,
    };
  },

  /* ================= FRAME ================= */
  draw(dt) {
    Render.time += dt;
    Render.checkFit();
    const ctx = Render.ctx;
    const s = Game.state;
    const T = Game.TILE;
    const g = Game.gridSize();

    Render.computeCamera();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b0716';
    ctx.fillRect(0, 0, Render.canvas.width, Render.canvas.height);
    ctx.setTransform(Render.scale, 0, 0, Render.scale, Render.offX, Render.offY);

    Render.drawFloor(g, T);
    Render.drawWalls(g, T);

    // Draw machines sorted by y so lower ones overlap correctly
    const sorted = [...s.machines].sort((a, b) => a.y - b.y);
    for (const m of sorted) Render.drawMachine(m, T);

    for (const c of s.customers) Render.drawCustomer(c, T);

    if (Render.placingDef || Render.movingMachine) Render.drawGhost(T);
    Render.drawSelection(T);
  },

  drawFloor(g, T) {
    const ctx = Render.ctx;
    for (let y = 1; y < g.h - 1; y++) {
      for (let x = 1; x < g.w - 1; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#1b1230' : '#171029';
        ctx.fillRect(x * T, y * T, T, T);
      }
    }
    // subtle carpet dots
    ctx.fillStyle = 'rgba(120,80,220,0.10)';
    for (let y = 1; y < g.h - 1; y++) {
      for (let x = 1; x < g.w - 1; x++) {
        if ((x * 7 + y * 13) % 5 === 0) {
          ctx.beginPath();
          ctx.arc(x * T + T / 2, y * T + T / 2, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // entrance mat + glow
    const e = Game.entrance();
    const grad = ctx.createRadialGradient(
      (e.x + 0.5) * T, e.y * T, 4, (e.x + 0.5) * T, e.y * T, T * 2.4);
    grad.addColorStop(0, 'rgba(255,110,200,0.30)');
    grad.addColorStop(1, 'rgba(255,110,200,0)');
    ctx.fillStyle = grad;
    ctx.fillRect((e.x - 2) * T, (e.y - 2) * T, T * 5, T * 3);
    ctx.fillStyle = '#3d2a5c';
    ctx.fillRect((e.x - 0.5) * T, (e.y - 0.1) * T, T * 2, T * 1.1);
    ctx.fillStyle = '#ff6ec8';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ENTRANCE', (e.x + 0.5) * T, (e.y + 0.55) * T);
  },

  drawWalls(g, T) {
    const ctx = Render.ctx;
    ctx.fillStyle = '#241740';
    ctx.fillRect(0, 0, g.w * T, T);                    // top
    ctx.fillRect(0, 0, T, g.h * T);                    // left
    ctx.fillRect((g.w - 1) * T, 0, T, g.h * T);        // right
    const e = Game.entrance();
    ctx.fillRect(0, (g.h - 1) * T, (e.x - 0.5) * T, T);          // bottom left of door
    ctx.fillRect((e.x + 1.5) * T, (g.h - 1) * T, g.w * T, T);    // bottom right of door
    // neon strip
    const pulse = 0.55 + 0.45 * Math.sin(Render.time * 2);
    ctx.strokeStyle = `rgba(0,255,224,${0.35 + 0.3 * pulse})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(T - 2, T - 2, (g.w - 2) * T + 4, (g.h - 2) * T + 4);
  },

  drawMachine(m, T) {
    const ctx = Render.ctx;
    const def = Game.def(m.defId);
    const x = m.x * T, y = m.y * T;
    const blink = Math.sin(Render.time * 3 + m.id * 1.7) > 0;
    const hue = def.hue;

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(x + T / 2, y + T * 0.92, T * 0.42, T * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();

    if (def.type === 'pinball') {
      // Cabinet body (playfield slopes toward the player)
      ctx.fillStyle = m.broken ? '#4a3038' : `hsl(${hue},55%,${28 + m.level * 4}%)`;
      Render.rrect(x + 5, y + T * 0.30, T - 10, T * 0.62, 5);
      // playfield glass
      ctx.fillStyle = m.broken ? '#2a2030' : `hsl(${hue},75%,${blink ? 52 : 40}%)`;
      Render.rrect(x + 8, y + T * 0.36, T - 16, T * 0.48, 4);
      // backbox
      ctx.fillStyle = m.broken ? '#3a2830' : `hsl(${hue},65%,${blink ? 46 : 34}%)`;
      Render.rrect(x + 6, y + 2, T - 12, T * 0.30, 3);
      // backbox glow
      if (!m.broken) {
        ctx.fillStyle = `hsla(${hue},100%,70%,${blink ? 0.85 : 0.4})`;
        Render.rrect(x + 9, y + 5, T - 18, T * 0.16, 2);
      }
      // flipper dots
      if (!m.broken) {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x + T * 0.35, y + T * 0.80, 2, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(x + T * 0.65, y + T * 0.80, 2, 0, 7); ctx.fill();
      }
    } else if (def.type === 'arcade') {
      // Upright cabinet
      ctx.fillStyle = m.broken ? '#4a3038' : `hsl(${hue},50%,${25 + m.level * 4}%)`;
      Render.rrect(x + 7, y + 4, T - 14, T * 0.86, 4);
      // screen
      ctx.fillStyle = m.broken ? '#1a1420' : `hsl(${(hue + Render.time * 40 + m.id * 60) % 360},80%,${blink ? 55 : 42}%)`;
      Render.rrect(x + 11, y + 9, T - 22, T * 0.38, 3);
      // control panel
      ctx.fillStyle = m.broken ? '#332530' : `hsl(${hue},45%,20%)`;
      Render.rrect(x + 9, y + T * 0.55, T - 18, T * 0.16, 2);
      if (!m.broken) {
        ctx.fillStyle = '#ff5555';
        ctx.beginPath(); ctx.arc(x + T * 0.38, y + T * 0.63, 2.5, 0, 7); ctx.fill();
        ctx.fillStyle = '#55aaff';
        ctx.beginPath(); ctx.arc(x + T * 0.58, y + T * 0.63, 2.5, 0, 7); ctx.fill();
      }
    } else { // amenity
      ctx.fillStyle = `hsl(${hue},60%,35%)`;
      Render.rrect(x + 4, y + T * 0.2, T - 8, T * 0.7, 6);
      ctx.fillStyle = `hsl(${hue},90%,${blink ? 65 : 55}%)`;
      ctx.font = `bold ${T * 0.42}px sans-serif`;
      ctx.textAlign = 'center';
      const icon = { snackbar: '🍿', prizes: '🧸', neonsign: '✨' }[def.id] || '★';
      ctx.fillText(icon, x + T / 2, y + T * 0.68);
    }

    // condition warning / broken sign
    if (m.broken) {
      ctx.fillStyle = blink ? '#ff3355' : '#aa2244';
      ctx.font = `bold ${T * 0.24}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('OUT OF', x + T / 2, y + T * 0.45);
      ctx.fillText('ORDER', x + T / 2, y + T * 0.68);
      if (m.repair > 0) { // technician progress bar
        ctx.fillStyle = '#222';
        ctx.fillRect(x + 6, y - 6, T - 12, 4);
        ctx.fillStyle = '#4be38a';
        ctx.fillRect(x + 6, y - 6, (T - 12) * m.repair, 4);
      }
    } else if (m.condition < 40 && def.type !== 'amenity') {
      ctx.fillStyle = '#ffcc00';
      ctx.font = `bold ${T * 0.3}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('⚠', x + T * 0.85, y + T * 0.25);
    }

    // upgrade stars
    if (m.level > 0) {
      ctx.fillStyle = '#ffd700';
      ctx.font = `${T * 0.2}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText('★'.repeat(m.level), x + 4, y + T * 0.18);
    }
  },

  drawCustomer(c, T) {
    const ctx = Render.ctx;
    const x = c.x * T, y = c.y * T;
    const playing = c.phase === 'play';
    const bob = playing ? Math.sin(Render.time * 9 + c.bobSeed) * 1.5 : 0;

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + 6, 6.5, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // body
    ctx.fillStyle = c.color;
    Render.rrect(x - 5, y - 8 + bob, 10, 12, 4);
    // head
    ctx.fillStyle = '#ffdbac';
    ctx.beginPath();
    ctx.arc(x, y - 12 + bob, 4.5, 0, Math.PI * 2);
    ctx.fill();
    // pro players wear a cap
    if (c.type === 'pro') {
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(x, y - 13.5 + bob, 4.5, Math.PI, Math.PI * 2);
      ctx.fill();
    }
  },

  drawGhost(T) {
    if (!Render.hoverTile) return;
    const ctx = Render.ctx;
    const { x, y } = Render.hoverTile;
    const ok = Game.tileFree(x, y);
    ctx.fillStyle = ok ? 'rgba(80,255,160,0.30)' : 'rgba(255,60,80,0.30)';
    ctx.fillRect(x * T, y * T, T, T);
    ctx.strokeStyle = ok ? '#50ffa0' : '#ff3c50';
    ctx.lineWidth = 2;
    ctx.strokeRect(x * T + 1, y * T + 1, T - 2, T - 2);
  },

  drawSelection(T) {
    const s = Game.state;
    if (s.selectedMachine == null) return;
    const m = s.machines.find(x => x.id === s.selectedMachine);
    if (!m) return;
    const ctx = Render.ctx;
    const pulse = 0.6 + 0.4 * Math.sin(Render.time * 5);
    ctx.strokeStyle = `rgba(0,255,224,${pulse})`;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(m.x * T + 2, m.y * T + 2, T - 4, T - 4);
  },

  rrect(x, y, w, h, r) {
    const ctx = Render.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  },
};
