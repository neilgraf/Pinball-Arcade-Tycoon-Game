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

## The two paths to victory

- **💰 Profit** — buy machines, tune pricing, keep guests happy, expand the venue.
- **🏆 Prestige** — build reputation, host tournaments, climb the ladder:
  Local Showdown → Regional Masters → National Open → **World Championship**.

The best players balance both: tournaments need money and machines; growth needs
the reputation and traffic tournaments bring.

## How to play

| Action | How |
|---|---|
| Buy a machine | Click it in the left shop, then click a floor tile (Shift-click to place several) |
| Inspect / upgrade / repair / move / sell | Click any placed machine |
| Set pricing | Slider at the bottom of the shop (cheap = crowds, pricey = margins) |
| Hire staff | 👥 Staff — technicians repair, janitors clean, the event manager boosts tournaments |
| Host events | 🏆 Tournaments — meet the requirement checklist, then watch the bracket round by round |
| Expand | 🏗️ button under the shop (4 venue sizes) |
| Speed | ⏸ ▶ ▶▶ ▶▶▶ up top, Space to pause |
| Finances | 📊 Dashboard — daily profit chart, category breakdown, best machines |

The game auto-saves at the end of every in-game day (localStorage).

## Systems under the hood

- **Machines** — 9 pinball tables + 6 arcade cabinets + 3 amenities, each with
  cost, price/play, popularity, appeal, reliability. Machines wear down with
  every play, break, and can be upgraded to ★★★.
- **Guests** — casuals and pros with individual budgets, pinball/arcade
  preferences, patience, and per-visit satisfaction that feeds a venue-wide
  rolling score. Satisfaction, reputation, appeal, and pricing drive spawn rate.
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
js/state.js       game state, helpers, save/load
js/sim.js         customers, machine wear, staff, day cycle
js/tournament.js  requirements, seeding, match sim, rewards
js/render.js      canvas renderer (floor, machines, guests)
js/ui.js          shop, inspector, modals, brackets, ticker
js/main.js        boot + main loop
```
