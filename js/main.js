/* =========================================================
   Boot + main loop
   ========================================================= */

(function () {
  let lastTime = 0;
  let lastFrameAt = 0;

  function boot() {
    const loaded = Game.hasSave() && Game.load();
    if (!loaded) Game.newGame();

    Render.init();
    UI.init();
    UI.setSpeed(1);
    if (!loaded) UI.showWelcome();

    requestAnimationFrame(frame);

    // rAF stops in hidden/background tabs — keep the simulation ticking
    setInterval(() => {
      if (performance.now() - lastFrameAt < 500) return;
      step(0.25);
    }, 250);
  }

  function step(rawDt) {
    // Simulation pauses while a modal is open or speed is 0
    const paused = UI.modalOpen || Game.state.speed === 0;
    if (!paused) {
      Sim.tick(rawDt * Game.state.speed);
      UI.refreshStats();
    }
  }

  function frame(now) {
    const rawDt = Math.min(0.1, (now - lastTime) / 1000 || 0);
    lastTime = now;
    lastFrameAt = performance.now();

    // Simulation pauses while a modal is open or speed is 0
    const paused = UI.modalOpen || Game.state.speed === 0;
    if (!paused) {
      Sim.tick(rawDt * Game.state.speed);
      UI.refreshStats();
      // Keep the inspector live while a machine is selected
      if (Game.state.selectedMachine != null && !UI._inspTick) UI._inspTick = 0;
      UI._inspTick = (UI._inspTick || 0) + rawDt;
      if (UI._inspTick > 0.5) {
        UI._inspTick = 0;
        UI.refreshInspector();
      }
    }

    Render.draw(rawDt);
    requestAnimationFrame(frame);
  }

  window.addEventListener('DOMContentLoaded', boot);
})();
