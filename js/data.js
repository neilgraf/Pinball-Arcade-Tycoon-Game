/* =========================================================
   PINBALL PALACE TYCOON — static game data
   ========================================================= */

const DATA = {};

/* ---------- Machine catalog ----------
   type: 'pinball' | 'arcade' | 'amenity'
   cost: purchase price (pinball costs scale exponentially — late
         tables are major investments)
   price: $ per play (base)
   pop: popularity 1-10 (how often customers pick it)
   appeal: 1-10+ (draws foot traffic — ARCADE & AMENITY ONLY;
           pinball tables have zero appeal: they exist for
           tournaments and direct play revenue)
   rel: reliability 1-10 (higher = degrades slower)
   playTime: seconds of game time per play
   repReq: reputation required to unlock in the shop
   kind: 'claw' for claw machines (special render)
   service: 'drink' | 'food' | 'snack' | 'prize' for amenities that
            serve customer needs; needsStaff: requires an attendant
*/
DATA.MACHINES = [
  // ---- Pinball (tournament machines — 16 total, no appeal, no reputation) ----
  { id:'rustyflip',  name:'Rusty Flip',           type:'pinball', cost:200,   price:1.50,  pop:3,  appeal:0, rel:3,  playTime:3,   repReq:0,
    hue:20,  blurb:'A garage-sale classic. The left flipper has opinions.' },
  { id:'spacecadet', name:'Space Cadet 2000',     type:'pinball', cost:380,   price:2.00,  pop:4,  appeal:0, rel:5,  playTime:3,   repReq:0,
    hue:210, blurb:'Blast off on a budget. Mission control not included.' },
  { id:'ghost',      name:'Ghost Chaser',         type:'pinball', cost:650,   price:2.50,  pop:5,  appeal:0, rel:5,  playTime:3.5, repReq:25,
    hue:280, blurb:'Haunted by high scores of players past.' },
  { id:'dino',       name:'Dino Rampage',         type:'pinball', cost:1050,  price:3.00,  pop:5,  appeal:0, rel:6,  playTime:3.5, repReq:50,
    hue:110, blurb:'Multiball extinction event. Crowd favorite.' },
  { id:'pirate',     name:"Pirate's Plunder",     type:'pinball', cost:1600,  price:3.50,  pop:6,  appeal:0, rel:6,  playTime:3.5, repReq:120,
    hue:35,  blurb:'Cannonball lock, kraken ramp, actual doubloon sounds.' },
  { id:'neon',       name:'Neon Nights',          type:'pinball', cost:2400,  price:4.00,  pop:6,  appeal:0, rel:6,  playTime:3.5, repReq:180,
    hue:320, blurb:'So bright it counts as interior lighting.' },
  { id:'samurai',    name:'Samurai Steel',        type:'pinball', cost:3600,  price:4.75,  pop:7,  appeal:0, rel:7,  playTime:4,   repReq:250,
    hue:355, blurb:'Precision flipper work rewarded. Sloppy play punished.' },
  { id:'wizard',     name:"Wizard's Tower",       type:'pinball', cost:5200,  price:5.50,  pop:7,  appeal:0, rel:7,  playTime:4,   repReq:320,
    hue:260, blurb:'Tournament staple. Pros travel for this table.' },
  { id:'voltage',    name:'High Voltage',         type:'pinball', cost:7500,  price:6.50,  pop:8,  appeal:0, rel:7,  playTime:4,   repReq:400,
    hue:55,  blurb:'Tesla-coil backglass. Do not lick the plunger.' },
  { id:'deepsea',    name:'Deep Sea Legend',      type:'pinball', cost:10500, price:7.50,  pop:8,  appeal:0, rel:8,  playTime:4,   repReq:470,
    hue:190, blurb:'Kraken multiball. Insurance recommended.' },
  { id:'inferno',    name:'Inferno Rally',        type:'pinball', cost:14500, price:8.75,  pop:8,  appeal:0, rel:8,  playTime:4,   repReq:540,
    hue:10,  blurb:'Flame-painted cabinet, magma ramps, zero chill.' },
  { id:'galaxy',     name:'Grand Slam Galaxy',    type:'pinball', cost:19500, price:10.00, pop:9,  appeal:0, rel:8,  playTime:4,   repReq:610,
    hue:45,  blurb:'The table that decides careers.' },
  { id:'clockwork',  name:'Clockwork Empire',     type:'pinball', cost:26000, price:11.50, pop:9,  appeal:0, rel:9,  playTime:4.5, repReq:680,
    hue:85,  blurb:'Brass gears, ticking escapements, ruthless drain outlanes.' },
  { id:'cosmic',     name:'Cosmic Storm',         type:'pinball', cost:34000, price:13.50, pop:9,  appeal:0, rel:9,  playTime:4.5, repReq:750,
    hue:230, blurb:'Gravity-well multiball bends the laws of physics and wallets.' },
  { id:'dragon',     name:"Dragon's Hoard",       type:'pinball', cost:44000, price:16.00, pop:10, appeal:0, rel:9,  playTime:4.5, repReq:820,
    hue:140, blurb:'Guarded by a mechanical dragon. It keeps the high scores.' },
  { id:'millennium', name:'The Millennium Table', type:'pinball', cost:56000, price:19.00, pop:10, appeal:0, rel:10, playTime:4.5, repReq:900,
    hue:0,   blurb:'World Championship grade. Handle with reverence.' },

  // ---- Arcade cabinets & claw machines (PRIMARY source of appeal & reputation) ----
  { id:'blaster',    name:'Retro Blaster',        type:'arcade',  cost:150,   price:1.25,  pop:4,  appeal:3,  rel:5, playTime:2.5, repReq:0,
    hue:0,   blurb:'Pew pew. Sticks a little, charms a lot.' },
  { id:'claw1',      name:'Lucky Claw',           type:'arcade',  cost:320,   price:1.50,  pop:5,  appeal:5,  rel:6, playTime:2.5, repReq:0, kind:'claw',
    hue:305, blurb:'Plush prizes and rigged physics. People love it anyway.' },
  { id:'kungfu',     name:'Kung Fu Fury',         type:'arcade',  cost:480,   price:1.75,  pop:5,  appeal:4,  rel:5, playTime:2.8, repReq:25,
    hue:15,  blurb:'Button-mashing that borders on cardio.' },
  { id:'racer',      name:'Turbo Racer DX',       type:'arcade',  cost:900,   price:2.50,  pop:6,  appeal:6,  rel:6, playTime:3,   repReq:80,
    hue:200, blurb:'The seat rumbles. The profits too.' },
  { id:'zombie',     name:'Zombie Onslaught',     type:'arcade',  cost:1600,  price:3.25,  pop:7,  appeal:7,  rel:6, playTime:3,   repReq:170,
    hue:130, blurb:'Two plastic shotguns, infinite screaming teens.' },
  { id:'claw2',      name:'Mega Claw Deluxe',     type:'arcade',  cost:2600,  price:3.75,  pop:7,  appeal:8,  rel:7, playTime:2.8, repReq:260, kind:'claw',
    hue:165, blurb:'Twice the claws, giant prizes, a small crowd at all times.' },
  { id:'dance',      name:'Dance Mania Revolution',type:'arcade', cost:4200,  price:4.50,  pop:8,  appeal:9,  rel:5, playTime:3.5, repReq:350,
    hue:300, blurb:'A spectacle machine. Draws a crowd by itself.' },
  { id:'vrpod',      name:'VR Hyperpod',          type:'arcade',  cost:6800,  price:6.00,  pop:9,  appeal:10, rel:7, playTime:4,   repReq:470,
    hue:170, blurb:'The future, rented by the minute.' },

  // ---- Amenities (appeal + customer needs; most require an attendant) ----
  { id:'neonsign',   name:'Giant Neon Sign',      type:'amenity', cost:400,   price:0, pop:0, appeal:7,  rel:10, playTime:0, repReq:0,
    hue:315, blurb:'Pure foot-traffic magnetism. Does nothing else. Gloriously.' },
  { id:'drinkstand', name:'Drink Stand',          type:'amenity', cost:500,   price:0, pop:0, appeal:3,  rel:9,  playTime:0, repReq:0,
    service:'drink', needsStaff:true,
    hue:195, blurb:'Quenches thirsty guests. Needs an attendant or the line stalls.' },
  { id:'snackbar',   name:'Snack Counter',        type:'amenity', cost:700,   price:0, pop:0, appeal:4,  rel:9,  playTime:0, repReq:30,
    service:'snack', needsStaff:true,
    hue:35,  blurb:'Light bites for hungry players. Needs an attendant to run it.' },
  { id:'prizes',     name:'Prize Counter',        type:'amenity', cost:1100,  price:0, pop:0, appeal:5,  rel:9,  playTime:0, repReq:70,
    service:'prize', needsStaff:true,
    hue:55,  blurb:'Plush dinos and keychains. Staffed, it prints happiness.' },
  { id:'foodstand',  name:'Food Stand',           type:'amenity', cost:1400,  price:0, pop:0, appeal:5,  rel:9,  playTime:0, repReq:110,
    service:'food', needsStaff:true,
    hue:25,  blurb:'Proper meals keep guests in the building. Needs an attendant.' },
  { id:'neonarch',   name:'Neon Marquee Arch',    type:'amenity', cost:1500,  price:0, pop:0, appeal:12, rel:10, playTime:0, repReq:200,
    hue:275, blurb:'A landmark. People photograph it. Reputation loves it.' },
];

/* ---------- Expansions ---------- */
DATA.EXPANSIONS = [
  { level:0, w:14, h:10, cost:0,     name:'Corner Shop' },
  { level:1, w:18, h:12, cost:5000,  name:'Main Street Hall' },
  { level:2, w:22, h:14, cost:18000, name:'Grand Arcade' },
  { level:3, w:26, h:16, cost:45000, name:'Championship Complex' },
];

/* ---------- Staff ----------
   Technicians and janitors are MANUAL: they only work on tasks you
   assign (click broken machines / dirty tiles). Attendants staff
   amenities. Managers boost tournaments. */
DATA.STAFF = {
  tech:      { name:'Technician',    wage:45, icon:'🔧', desc:'Repairs and maintains machines — but only when YOU assign them. Click a broken machine and hit "Assign Repair"; the tech walks over and fixes it. Higher levels work faster and repair to better condition.' },
  janitor:   { name:'Janitor',       wage:30, icon:'🧹', desc:'Cleans dirt and trash tiles you flag. Click a dirty tile (or drag a box over several) to mark them; janitors walk over and scrub. Higher levels clean faster.' },
  attendant: { name:'Attendant',     wage:35, icon:'🍿', desc:'Runs your food, drink, snack and prize amenities. Each service amenity needs one attendant — understaffed stands serve slowly and frustrate guests.' },
  manager:   { name:'Event Manager', wage:90, icon:'📋', desc:'Boosts tournament revenue, attendance, quality and reputation gains. Multiple managers stack with diminishing returns. Required for National tier and above.' },
};

/* ---------- Tournament tiers ----------
   Variety is king: each tier requires DIFFERENT pinball tables.
   req extras:
     pinballUnique — distinct pinball models on the floor
     star3Pct      — % of pinball tables that must be MAX upgraded (★★★)
     minPinballCond — any pinball table below this condition DISQUALIFIES you
   qualifyRank — entrants are drawn from the top N ranked pros
                 (null = open field); World is strictly the top 32.
   pointsWin / pointsTitle — circuit ranking points awarded */
DATA.TIERS = [
  { id:'local', name:'Local Showdown', entrants:4, qualifyRank:null,
    req:{ pinballUnique:4, star3Pct:0, minPinballCond:40, rep:50, avgCond:55, expansion:0, hostedPrev:null, manager:false },
    hostCost:200, entryFee:30, ticket:6, prize:400, repReward:35, baseSpectators:60, sponsorPerRep:0,
    pointsWin:2, pointsTitle:8,
    desc:'Neighborhood flippers battle for bragging rights and a modest check. An easy first step — no upgrades required.' },
  { id:'regional', name:'Regional Masters', entrants:8, qualifyRank:24,
    req:{ pinballUnique:8, star3Pct:25, minPinballCond:40, rep:260, avgCond:65, expansion:1, hostedPrev:'local', manager:false },
    hostCost:800, entryFee:80, ticket:10, prize:1500, repReward:80, baseSpectators:180, sponsorPerRep:1.5,
    pointsWin:4, pointsTitle:20,
    desc:'The region’s best. Scouts in the crowd. Local news might show up.' },
  { id:'national', name:'National Open', entrants:16, qualifyRank:20,
    req:{ pinballUnique:12, star3Pct:40, minPinballCond:40, rep:560, avgCond:70, expansion:2, hostedPrev:'regional', manager:true },
    hostCost:2500, entryFee:160, ticket:16, prize:5000, repReward:150, baseSpectators:420, sponsorPerRep:6,
    pointsWin:9, pointsTitle:50,
    desc:'Televised. Sponsored. Sixteen killers and one trophy.' },
  { id:'world', name:'WORLD CHAMPIONSHIP', entrants:32, qualifyRank:32,
    req:{ pinballUnique:16, star3Pct:50, minPinballCond:40, rep:880, avgCond:78, expansion:3, hostedPrev:'national', manager:true },
    hostCost:6000, entryFee:350, ticket:30, prize:20000, repReward:260, baseSpectators:900, sponsorPerRep:12,
    pointsWin:20, pointsTitle:120,
    desc:'The summit of competitive pinball. All 16 tables on the floor, half of them tournament-tuned. Host this, and your name enters history.' },
];

/* Spectator capacity by expansion level */
DATA.SPECTATOR_CAP = [90, 240, 520, 1200];

/* Condition bands used by UI and tournament checks */
DATA.COND_BANDS = [
  { min:85, label:'Excellent', cls:'good' },
  { min:65, label:'Good',      cls:'good' },
  { min:40, label:'Worn',      cls:'warn' },
  { min:0,  label:'POOR',      cls:'bad'  },
];

/* ---------- Competitor generation pools ---------- */
/* Real-name pros seeded into every new circuit */
DATA.NAMED_PLAYERS = ['Tom Graf','Neil Graf','Eric Graf','Michelle Graf','Kassidy Milanowski','Ryan Graf'];
DATA.FIRST_NAMES = ['Max','Rosa','Kenji','Priya','Dmitri','Luna','Otis','Greta','Sami','Wren','Hugo','Ivy','Bram','Zoe','Rafael','Nadia','Chip','Mabel','Theo','Yuki','Salvatore','June','Ezra','Colette','Boris','Tilda','Andre','Faye','Gus','Marisol'];
DATA.LAST_NAMES  = ['Voltage','Okafor','Silverball','Nakamura','Petrov','Flint','McTilt','Larsson','Drainer','Castellano','Bumper','Reyes','Plunkett','Osei','Kickback','Moreau','Slingshot','Tanaka','Nudge','Whitfield','Ramos','Skillshot','Berg','Duval','Orbit','Halloway','Vex','Santini','Lockdown','Quiroga'];
DATA.NICKNAMES   = ['The Wizard','Iron Wrists','Tilt Whisperer','The Machine','Deadflip','Multiball Menace','The Professor','Nudge Queen','Ball Saver','The Surgeon','Flipper King','Miss Extra Ball','The Vault','Golden Plunge','Steady Eddie','The Hurricane'];
DATA.STYLES = [
  { id:'aggressive', name:'Aggressive', volMult:1.35, skillMult:1.05 },
  { id:'safe',       name:'Safe',       volMult:0.70, skillMult:0.97 },
  { id:'balanced',   name:'Balanced',   volMult:1.00, skillMult:1.00 },
  { id:'chaotic',    name:'Chaotic',    volMult:1.70, skillMult:1.02 },
  { id:'showboat',   name:'Showboat',   volMult:1.20, skillMult:1.00 },
];

/* ---------- Commentary templates ----------
   {W}=winner, {L}=loser, {WS}=winner score, {LS}=loser score */
DATA.COMMENTARY = {
  blowout: [
    '{W} absolutely dismantles {L}. That wasn’t a match, it was a lesson.',
    '{W} triples up {L}. Someone check on {L}, seriously.',
    'Total domination. {W} barely looked at the flippers.',
    '{L} is going home early. {W} made sure of it.',
  ],
  close: [
    'HEART-STOPPER! {W} edges out {L} by a razor-thin margin!',
    'Decided on the final ball! {W} survives against {L}!',
    'The crowd is on its feet — {W} steals it from {L} at the death!',
    '{L} left the door open a crack and {W} kicked it in. Photo finish!',
  ],
  upset: [
    'UPSET ALERT! {W} knocks out the heavily favored {L}! The crowd is in shock!',
    'NOBODY saw this coming — {W} takes down {L}! Brackets everywhere are ruined!',
    '{L} came in as the favorite. {W} didn’t read the script.',
    'Cinderella story! {W} sends the mighty {L} packing!',
  ],
  normal: [
    '{W} takes care of business against {L}.',
    'A clean, professional win for {W} over {L}.',
    '{W} advances. {L} heads to the snack bar to reflect.',
    'Solid flipper work from {W}. {L} never quite found the rhythm.',
    '{W} controls the tempo from ball one and closes it out.',
  ],
  final: [
    'CHAMPION! {W} lifts the trophy after a spectacular final against {L}!',
    'IT’S OVER! {W} is your champion! {L} fought valiantly but the night belongs to {W}!',
    'Confetti rains down — {W} defeats {L} in the final and etches their name in history!',
  ],
};

/* ---------- Random daily events ---------- */
DATA.EVENTS = [
  { id:'viral',   chance:0.05, run:(s)=>{ s.buzzDays = Math.max(s.buzzDays,1); s.buzzMult = 2.2;
      return '📱 A pinball clip from your arcade went VIRAL! Huge crowds expected today!'; } },
  { id:'surge',   chance:0.05, run:(s)=>{ const live = s.machines.filter(m=>!m.broken && Game.def(m.defId).type!=='amenity');
      if(!live.length) return null; const m = live[Math.floor(Math.random()*live.length)];
      m.condition = Math.max(5, m.condition-45); if(m.condition<15){m.broken=true;}
      return `⚡ Power surge overnight! ${Game.def(m.defId).name} took heavy damage.`; } },
  { id:'critic',  chance:0.04, run:(s)=>{ if(s.satisfaction>=72){ s.reputation=Math.min(1000,s.reputation+15);
        return '📰 A game journalist reviewed your arcade: "A gem!" +15 reputation.'; }
      else { s.reputation=Math.max(0,s.reputation-12);
        return '📰 A game journalist reviewed your arcade: "Sticky floors, long waits." -12 reputation.'; } },
  },
  { id:'party',   chance:0.05, run:(s)=>{ Game.income(200,'plays'); Game.spawnDirt(7);
      return '🎂 A birthday party booked the arcade! +$200, but the cake situation got out of hand.'; } },
  { id:'wizard',  chance:0.04, run:(s)=>{ s.reputation=Math.min(1000,s.reputation+12); s.buzzDays=Math.max(s.buzzDays,1); s.buzzMult=Math.max(s.buzzMult,1.5);
      return '🧙 A legendary pinball wizard dropped by unannounced and drew a crowd! +12 reputation.'; } },
  { id:'rain',    chance:0.05, run:(s)=>{ s.buzzDays=Math.max(s.buzzDays,1); s.buzzMult=Math.max(s.buzzMult,1.4);
      return '🌧️ Rainy day! Nothing drives arcade traffic like bad weather.'; } },
  { id:'sponsor', chance:0.04, run:(s)=>{ if(s.reputation<150) return null;
      const amt = Game.randInt(120, 120 + Math.round(s.reputation/2)); Game.income(amt,'sponsors');
      return `🤝 A local sponsor dropped off a promo check for $${amt}!`; } },
  { id:'inspect', chance:0.04, run:(s)=>{ if(s.cleanliness < 55){ const fine = Game.randInt(120,320); Game.expense(fine,'utilities'); s.reputation=Math.max(0,s.reputation-10);
        return `🧑‍⚖️ Surprise health inspection! Sticky floors cost you a $${fine} fine and -10 reputation.`; }
      s.reputation=Math.min(1000,s.reputation+6);
      return '🧑‍⚖️ Surprise health inspection — passed with flying colors! +6 reputation.'; } },
  { id:'flu',     chance:0.04, run:(s)=>{ s.dayVibe = Math.min(s.dayVibe, Game.rand(0.5,0.7));
      return '🤒 A nasty flu is going around town. Expect a quiet day.'; } },
  { id:'fieldtrip',chance:0.03, run:(s)=>{ s.dayVibe = Math.max(s.dayVibe, Game.rand(1.3,1.6)); Game.spawnDirt(6);
      return '🚌 A school field trip just pulled up! Busy (and messy) day ahead.'; } },
];

/* ---------- Flavor ticker lines ---------- */
DATA.FLAVOR = [
  'A customer just asked if the pinball machines "have wifi".',
  'Someone achieved a personal best and told literally everyone.',
  'The claw machine union has requested representation. Demands: softer plushies.',
  'A regular has named your Rusty Flip machine "Gerald".',
  'Overheard: "One more game. Okay two. Okay five."',
  'A kid paid entirely in nickels. The count is ongoing.',
  'Local pigeons have unionized outside the entrance. Demands unclear.',
  'Someone tried to pay for a game with exposure. Denied.',
  'The high score board has become a site of intense diplomacy.',
  'A customer described your arcade as "the good kind of loud."',
  'A janitor found $3.50 in quarters under Dance Mania. Finders keepers.',
  'Someone asked if the food stand does delivery. To the pinball row. Ten feet away.',
];

/* ---------- Customer palette ---------- */
DATA.CUSTOMER_COLORS = ['#ff6b9d','#4ecdc4','#ffe066','#a29bfe','#ff9f43','#55efc4','#fd79a8','#74b9ff','#e17055','#81ecec','#fab1a0','#00cec9'];

DATA.REP_TIERS = [
  { min:0,   label:'Unknown' },
  { min:40,  label:'Neighborhood Spot' },
  { min:180, label:'Local Legend' },
  { min:420, label:'Regional Powerhouse' },
  { min:650, label:'National Venue' },
  { min:800, label:'World-Class Venue' },
  { min:950, label:'Pinball Mecca' },
];
