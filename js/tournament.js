/* =========================================================
   Tournament system: requirements, brackets, match simulation,
   commentary, rewards
   ========================================================= */

const Tournament = {
  active: null,   // live tournament object while modal is open

  // Days the circuit needs before it will sanction your next event
  COOLDOWN: { local: 5, regional: 6, national: 8, world: 12 },

  tier(id) { return DATA.TIERS.find(t => t.id === id); },

  /* ---------- circuit rankings ----------
     Ranking blends earned points with win/loss record; raw skill only
     breaks ties. Updated live as matches happen (yours and off-screen). */
  rankScore(p) {
    return p.points + (p.wins - p.losses) * 0.5 + p.skill * 0.01;
  },
  rankings() {
    return [...Game.state.competitors].sort((a, b) => Tournament.rankScore(b) - Tournament.rankScore(a));
  },
  rankOf(p) {
    return Tournament.rankings().indexOf(p) + 1;
  },

  /* ---------- skill progression with soft caps ----------
     Winners improve, losers regress — both taper off near the caps,
     so nobody rockets to 99 or craters to zero. */
  skillShift(winner, loser) {
    winner.skill = Math.min(99, winner.skill + 0.45 * Math.max(0.05, (99 - winner.skill) / 45));
    loser.skill = Math.max(28, loser.skill - 0.35 * Math.max(0.05, (loser.skill - 28) / 45));
  },

  /* ---------- hosting requirements ---------- */
  checkRequirements(tier) {
    const s = Game.state;
    const r = tier.req;
    const checks = [
      { label: `${r.machines}+ machines`, ok: Game.machineCount() >= r.machines,
        now: `${Game.machineCount()}` },
      { label: `${r.pinball}+ pinball tables`, ok: Game.pinballCount() >= r.pinball,
        now: `${Game.pinballCount()}` },
      { label: `${r.unique}+ different machine models`, ok: Game.uniqueMachineTypes() >= r.unique,
        now: `${Game.uniqueMachineTypes()}` },
      { label: `${r.rep}+ reputation`, ok: s.reputation >= r.rep,
        now: `${Math.round(s.reputation)}` },
      { label: `${r.avgCond}%+ avg machine condition`, ok: Game.avgCondition() >= r.avgCond,
        now: `${Math.round(Game.avgCondition())}%` },
      { label: `Venue: ${DATA.EXPANSIONS[r.expansion].name}+`, ok: s.expansion >= r.expansion,
        now: DATA.EXPANSIONS[s.expansion].name },
    ];
    if (r.star2 > 0) {
      checks.push({ label: `${r.star2}+ machines upgraded to ★★`, ok: Game.starCount(2) >= r.star2,
        now: `${Game.starCount(2)}` });
    }
    if (r.star3 > 0) {
      checks.push({ label: `${r.star3}+ machines upgraded to ★★★`, ok: Game.starCount(3) >= r.star3,
        now: `${Game.starCount(3)}` });
    }
    if (r.hostedPrev) {
      const prev = Tournament.tier(r.hostedPrev);
      checks.push({ label: `Hosted a ${prev.name}`, ok: (s.hosted[r.hostedPrev] || 0) > 0,
        now: `${s.hosted[r.hostedPrev] || 0}x` });
    }
    if (r.manager) {
      checks.push({ label: 'Event Manager on staff', ok: Sim.hasManager(),
        now: Sim.hasManager() ? 'Yes' : 'No' });
    }
    checks.push({ label: `Host fee: ${Game.money(tier.hostCost)}`, ok: s.cash >= tier.hostCost,
      now: Game.money(s.cash) });
    const daysLeft = (s.nextEventDay || 0) - s.day;
    checks.push({ label: 'Circuit schedule open', ok: daysLeft <= 0,
      now: daysLeft <= 0 ? 'Ready' : `${daysLeft} day${daysLeft > 1 ? 's' : ''} to go` });
    return checks;
  },
  canHost(tier) {
    return Tournament.checkRequirements(tier).every(c => c.ok);
  },

  /* ---------- start a tournament ---------- */
  start(tierId) {
    const tier = Tournament.tier(tierId);
    if (!Tournament.canHost(tier)) return null;
    const s = Game.state;
    Game.expense(tier.hostCost, 'tournament');

    // Field selection: entrants must QUALIFY by ranking.
    // World is strictly the top 32; other tiers draw from the qualified pool
    // with a little randomness in who shows up.
    const ranked = Tournament.rankings();
    let entrants;
    if (tier.id === 'world') {
      entrants = ranked.slice(0, tier.entrants);
    } else {
      const pool = tier.qualifyRank ? ranked.slice(0, tier.qualifyRank) : ranked;
      entrants = [...pool]
        .sort((a, b) => (Tournament.rankScore(b) + Game.rand(0, 12)) - (Tournament.rankScore(a) + Game.rand(0, 12)))
        .slice(0, tier.entrants);
    }
    // Seed by ranking: 1 vs n, 4 vs 5 style pairing
    entrants.sort((a, b) => Tournament.rankScore(b) - Tournament.rankScore(a));
    const seeds = Tournament.seedOrder(tier.entrants);
    const firstRound = [];
    for (let i = 0; i < tier.entrants; i += 2) {
      firstRound.push({
        p1: entrants[seeds[i] - 1], p2: entrants[seeds[i + 1] - 1],
        winner: null, s1: 0, s2: 0, comment: null,
      });
    }

    const t = {
      tier,
      rounds: [firstRound],
      roundNames: Tournament.roundNames(tier.entrants),
      currentRound: 0,
      finished: false,
      excitement: 1,
      upsets: 0,
      highlights: [],
      champion: null,
      revenue: null,
    };
    Tournament.active = t;
    Game.addNews(`🏆 The ${tier.name} is underway at your arcade!`, 'event');
    return t;
  },

  seedOrder(n) {
    // Standard bracket seeding (1 vs n, etc.)
    let order = [1];
    while (order.length < n) {
      const next = [];
      const len = order.length * 2;
      for (const s of order) { next.push(s); next.push(len + 1 - s); }
      order = next;
    }
    return order;
  },

  roundNames(entrants) {
    const names = { 32: ['Round of 32', 'Round of 16', 'Quarterfinals', 'Semifinals', 'GRAND FINAL'],
                    16: ['Round of 16', 'Quarterfinals', 'Semifinals', 'GRAND FINAL'],
                    8:  ['Quarterfinals', 'Semifinals', 'GRAND FINAL'],
                    4:  ['Semifinals', 'GRAND FINAL'] };
    return names[entrants];
  },

  /* ---------- match simulation ---------- */
  simMatch(match, roundIdx, totalRounds, tier) {
    const pressure = 1 + roundIdx * 0.35;   // later rounds get wilder
    const score = (p) => {
      const style = DATA.STYLES.find(st => st.id === p.style);
      const vol = (1.15 - p.consistency) * style.volMult * pressure;
      const perf = p.skill * style.skillMult * (1 + Game.rand(-vol, vol));
      // Convert performance into a pinball-looking score
      return Math.max(1, Math.round(perf * perf * Game.rand(90, 140)));
    };
    match.s1 = score(match.p1);
    match.s2 = score(match.p2);
    if (match.s1 === match.s2) match.s1 += 1000;
    match.winner = match.s1 > match.s2 ? match.p1 : match.p2;
    const loser = match.winner === match.p1 ? match.p2 : match.p1;
    match.winner.wins++; loser.losses++;
    // Circuit consequences: ranking points scale with tier and round depth
    match.winner.points += tier.pointsWin * (roundIdx + 1);
    Tournament.skillShift(match.winner, loser);

    // Commentary selection
    const favored = match.p1.skill >= match.p2.skill ? match.p1 : match.p2;
    const skillGap = Math.abs(match.p1.skill - match.p2.skill);
    const ws = Math.max(match.s1, match.s2), ls = Math.min(match.s1, match.s2);
    const isFinal = roundIdx === totalRounds - 1;
    const isUpset = match.winner !== favored && skillGap >= 8;
    const isClose = ls / ws > 0.88;
    const isBlowout = ls / ws < 0.35;
    let kind = 'normal';
    if (isFinal) kind = 'final';
    else if (isUpset) kind = 'upset';
    else if (isClose) kind = 'close';
    else if (isBlowout) kind = 'blowout';
    match.kind = kind;
    match.comment = Game.pick(DATA.COMMENTARY[kind])
      .replaceAll('{W}', Tournament.displayName(match.winner))
      .replaceAll('{L}', Tournament.displayName(loser));
    return match;
  },

  displayName(p) {
    return p.nickname ? `${p.name} "${p.nickname}"` : p.name;
  },

  /* ---------- advance one round ---------- */
  playNextRound() {
    const t = Tournament.active;
    if (!t || t.finished) return;
    const round = t.rounds[t.currentRound];
    const totalRounds = t.roundNames.length;

    for (const match of round) {
      Tournament.simMatch(match, t.currentRound, totalRounds, t.tier);
      if (match.kind === 'upset') { t.upsets++; t.excitement += 0.08; }
      if (match.kind === 'close') t.excitement += 0.05;
      if (match.kind === 'upset' || match.kind === 'close' || match.kind === 'final') {
        t.highlights.push({ round: t.roundNames[t.currentRound], text: match.comment });
      }
    }

    if (t.currentRound === totalRounds - 1) {
      Tournament.finish();
    } else {
      // Build next round from winners
      const next = [];
      for (let i = 0; i < round.length; i += 2) {
        next.push({ p1: round[i].winner, p2: round[i + 1].winner, winner: null, s1: 0, s2: 0, comment: null });
      }
      t.rounds.push(next);
      t.currentRound++;
    }
  },

  /* ---------- wrap up: money, reputation, history ---------- */
  finish() {
    const t = Tournament.active;
    const s = Game.state;
    const tier = t.tier;
    const finalMatch = t.rounds[t.rounds.length - 1][0];
    t.champion = finalMatch.winner;
    t.champion.titles++;
    t.champion.points += tier.pointsTitle;
    t.champion.skill = Math.min(99, t.champion.skill + 1);
    t.finished = true;

    const mgr = Sim.managerBonus();
    const revMult = mgr.rev;
    const repMult = mgr.rep;

    // Tournament quality: machine condition, cleanliness and event managers
    // decide how professional the whole thing feels
    const quality = Game.clamp(
      0.5 + Game.avgCondition() / 220 + s.cleanliness / 320 + mgr.quality, 0.55, 1.4);
    t.quality = quality;

    // Spectators: tier draw + reputation + quality + managers, capped by venue size
    const repFactor = 0.55 + s.reputation / tier.req.rep * 0.45;
    let spectators = Math.round(tier.baseSpectators * repFactor * Game.rand(0.8, 1.2)
      * t.excitement * quality * mgr.spect);
    spectators = Math.min(spectators, DATA.SPECTATOR_CAP[s.expansion]);

    const entryRev = tier.entrants * tier.entryFee;
    const ticketRev = Math.round(spectators * tier.ticket * revMult);
    const sponsorRev = Math.round(tier.sponsorPerRep * s.reputation * revMult * quality);
    let snackRev = 0;
    if (Game.hasAmenity('snackbar')) snackRev += Math.round(spectators * 1.1);
    if (Game.hasAmenity('prizes')) snackRev += Math.round(spectators * 0.4);

    Game.income(entryRev, 'tournament');
    Game.income(ticketRev, 'tournament');
    if (sponsorRev > 0) Game.income(sponsorRev, 'sponsors');
    if (snackRev > 0) Game.income(snackRev, 'snacks');
    Game.expense(tier.prize, 'tournament');

    const repGain = Math.round(tier.repReward * Math.min(t.excitement, 1.4) * quality * repMult);
    s.reputation = Game.clamp(s.reputation + repGain, 0, 1000);

    // Event wear: machines take a beating, place gets messy
    for (const m of s.machines) {
      if (Game.def(m.defId).type === 'amenity') continue;
      m.condition = Math.max(5, m.condition - Game.rand(5, 12));
    }
    s.cleanliness = Math.max(0, s.cleanliness - (20 + spectators / 40));

    // Post-event buzz drives traffic for days
    const buzzLen = { local: 2, regional: 3, national: 4, world: 6 }[tier.id];
    s.buzzDays = Math.max(s.buzzDays, buzzLen);
    s.buzzMult = Math.max(s.buzzMult, 1.5 + 0.15 * DATA.TIERS.indexOf(tier));

    s.nextEventDay = s.day + Tournament.COOLDOWN[tier.id];
    s.hosted[tier.id] = (s.hosted[tier.id] || 0) + 1;
    s.totalStats.tournaments++;
    s.champions.unshift({ day: s.day, tier: tier.name, name: Tournament.displayName(t.champion), tierId: tier.id });
    if (s.champions.length > 20) s.champions.length = 20;

    t.revenue = {
      spectators, entryRev, ticketRev, sponsorRev, snackRev,
      prize: tier.prize, hostCost: tier.hostCost,
      net: entryRev + ticketRev + sponsorRev + snackRev - tier.prize - tier.hostCost,
      repGain,
      quality,
      mgrEff: mgr.eff,
      mgrRevPct: Math.round((mgr.rev - 1) * 100),
    };

    Game.addNews(`🏆 ${Tournament.displayName(t.champion)} wins the ${tier.name}! +${repGain} reputation.`, 'good');

    if (tier.id === 'world' && !s.worldChampionHosted) {
      s.worldChampionHosted = true;
    }
    Game.save();
  },

  close() {
    const wasWorld = Tournament.active && Tournament.active.tier.id === 'world' && Tournament.active.finished;
    Tournament.active = null;
    if (wasWorld) UI.showVictory();
  },
};
