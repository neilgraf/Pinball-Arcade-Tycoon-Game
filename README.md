# 🕹️ Pinball Palace Tycoon

A browser-based tycoon/simulation game: grow a tiny corner-shop arcade into a
world-class competitive pinball venue capable of hosting the **World Championship**.

No frameworks, no build step — pure HTML5 Canvas + vanilla JavaScript.

## How to run

Any static file server works. With Node installed:

```
npx serve .
```

then open the printed URL (e.g. http://localhost:3000). Opening `index.html`
directly from disk also works in most browsers.

## The strategic loop

- **🕹️ Arcade appeal** — arcade cabinets, claw machines, neon signs and amenities
  are the ONLY things that attract customers and build reputation.
- **🎯 Pinball quality** — pinball tables attract nobody. They exist to take money
  per play and to win **tournaments**: Local Showdown → Regional Masters →
  National Open → **World Championship**.
- **😊 Happiness** — pricing, cleanliness, amenities and working machines keep
  guests spending. Gouging or filth drains happiness AND reputation.
- **👥 Staff management** — nothing runs itself. Technicians and janitors only
  work jobs you assign; amenities only function with attendants behind them.

You must build both halves: an arcade section to fill the room, and a pinball
stable to compete.

## How to play

| Action | How |
|---|---|
| Buy a machine | Click it in the left shop, then click a floor tile (Shift-click to place several) |
| Fix a breakdown | Click the broken machine → **Assign Repair** — a technician walks over and fixes it (or pay a steep emergency fee) |
| Keep machines healthy | Click a worn machine → **Assign Maintenance** before it hits Poor condition |
| Clean the floor | Click a dirt/trash tile — or **drag a box** over several — to flag them; janitors clean only what you flag |
| Inspect / upgrade / move / sell | Click any placed machine |
| Set pricing | Slider at the bottom of the shop (cheap = crowds + happiness, pricey = margins − reputation) |
| Hire staff | 👥 Staff — technicians, janitors, attendants (one per service amenity), event managers |
| Host events | 🏆 Tournaments — meet the variety/upgrade/condition checklist, then watch the bracket |
| Expand | 🏗️ Expand button under the shop (4 venue sizes) |
| Speed | ⏸ ▶ ▶▶ ▶▶▶ up top, Space to pause |
| Finances | 📊 Dashboard — daily profit chart, category breakdown, best machines |

The game auto-saves at the end of every in-game day (localStorage).

## Tournament requirements (a smooth ramp)

| Tier | Different pinball tables | ★★★ upgraded | Reputation | Condition |
|---|---|---|---|---|
| Local Showdown | 4 | none | 50 (low) | no table below Poor (40%) |
| Regional Masters | 8 | 25%+ of tables | 260 | no table below Poor |
| National Open | 12 | 40%+ of tables | 560 | no table below Poor |
| World Championship | **all 16** | 50%+ of tables | 880 | no table below Poor |

The Local Showdown is deliberately reachable early — the 3rd and 4th pinball
tables unlock at reputation 25 and 50, right in step with its requirements.
Worn tables (below Good, 65%) also drag event quality — and payouts — down.

## Difficulty scaling

A single difficulty scalar grows with customers, machines, reputation, venue
size and tournament tier reached. It drives dirt spawn rates, machine wear,
breakdown chances, overnight decay and emergency repair pricing — so a
two-machine corner shop is relaxed and forgiving (one janitor, one technician
is plenty), while a packed Championship Complex demands a full crew and
constant attention.

## Systems under the hood

- **Machines** — 16 pinball tables with exponentially scaling costs (late tables
  are major investments that earn accordingly), 8 arcade cabinets & claw
  machines, 6 amenities. Machines wear down fast, break, and can be upgraded to
  ★★★ (+50% revenue per star — for a serious price).
- **Manual staff tasks** — broken machines wait in a repair queue you build by
  clicking them; technicians travel across the floor (bigger venue = slower
  response). Dirt and trash appear as physical tiles you flag for janitors.
- **Needs** — guests get hungry and thirsty. Food/drink/snack stands satisfy
  them — if an attendant is behind the counter. Unmet needs cut happiness,
  visit length, and spending.
- **Guests** — casuals (arcade-leaning) and pros (pinball-obsessed) with
  individual budgets, needs, patience, and per-visit happiness that feeds a
  venue-wide rolling score. Happiness, reputation, arcade appeal, cleanliness
  and pricing drive spawn rate.
- **Pro circuit** — 28 persistent competitors with skill, consistency, and play
  style (aggressive/safe/chaotic…). They improve over time, accumulate win/loss
  records and titles, and appear across your events.
- **Tournaments** — seeded single-elimination brackets simulated match by match
  with pressure-scaled variance, upset detection, and commentary. Revenue comes
  from entry fees, spectator tickets (capped by venue size), sponsors, and
  concessions; rewards include big reputation jumps and multi-day traffic buzz.
- **Economy** — daily wages, utilities, repairs; full income/expense category
  tracking with a 30-day history.
- **Events** — random daily events: viral clips, power surges, critics, rain.

## AI-Assisted Development

This project was initially generated using AI (Claude) based on a detailed design prompt.

I then:

Reviewed and understood the full codebase
Iterated on systems and design
Made improvements and customizations
Used it as a foundation to explore simulation systems, architecture, and game design
This project reflects my ability to:

Design complex systems (economy, tournaments, simulation loops)
Work with large generated codebases
Extend and refine AI-generated software

## File map

```
index.html        page shell
css/style.css     neon UI theme
js/data.js        machine catalog, tiers, staff, names, commentary, events
js/state.js       game state, dirt/queue helpers, save/load
js/sim.js         customers, needs, machine wear, manual staff tasks, day cycle
js/tournament.js  requirements, seeding, match sim, rewards
js/render.js      canvas renderer (floor, machines, guests)
js/ui.js          shop, inspector, modals, brackets, ticker
js/main.js        boot + main loop
```
