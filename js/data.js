/* =========================================================
   PINBALL PALACE TYCOON — static game data
   ========================================================= */

const DATA = {};

/* ---------- Machine catalog ----------
   type: 'pinball' | 'arcade' | 'amenity'
   cost: purchase price
   price: $ per play (base)
   pop: popularity 1-10 (how often customers pick it)
   appeal: 1-10 (draws foot traffic into the arcade)
   rel: reliability 1-10 (higher = degrades slower)
   playTime: seconds of game time per play
   repReq: reputation required to unlock in the shop
*/
DATA.MACHINES = [
  // ---- Pinball (primary focus) ----
  { id:'rustyflip',  name:'Rusty Flip',           type:'pinball', cost:175,  price:1.25, pop:3,  appeal:2,  rel:3, playTime:3, repReq:0,
    hue:20,  blurb:'A garage-sale classic. The left flipper has opinions.' },
  { id:'spacecadet', name:'Space Cadet 2000',     type:'pinball', cost:325,  price:1.75, pop:4,  appeal:4,  rel:5, playTime:3, repReq:0,
    hue:210, blurb:'Blast off on a budget. Mission control not included.' },
  { id:'ghost',      name:'Ghost Chaser',         type:'pinball', cost:475,  price:2.25, pop:5,  appeal:5,  rel:5, playTime:3.5, repReq:30,
    hue:280, blurb:'Haunted by high scores of players past.' },
  { id:'dino',       name:'Dino Rampage',         type:'pinball', cost:725, price:2.75, pop:6,  appeal:6,  rel:6, playTime:3.5, repReq:80,
    hue:110, blurb:'Multiball extinction event. Crowd favorite.' },
  { id:'neon',       name:'Neon Nights',          type:'pinball', cost:1050, price:3.25, pop:7,  appeal:8,  rel:6, playTime:3.5, repReq:160,
    hue:320, blurb:'So bright it counts as interior lighting.' },
  { id:'wizard',     name:"Wizard's Tower",       type:'pinball', cost:1450, price:3.50, pop:8,  appeal:8,  rel:7, playTime:4, repReq:260,
    hue:260, blurb:'Tournament staple. Pros travel for this table.' },
  { id:'deepsea',    name:'Deep Sea Legend',      type:'pinball', cost:1850, price:4.00, pop:8,  appeal:9,  rel:8, playTime:4, repReq:400,
    hue:190, blurb:'Kraken multiball. Insurance recommended.' },
  { id:'galaxy',     name:'Grand Slam Galaxy',    type:'pinball', cost:2450, price:4.50, pop:9,  appeal:9,  rel:8, playTime:4, repReq:550,
    hue:45,  blurb:'The table that decides careers.' },
  { id:'millennium', name:'The Millennium Table', type:'pinball', cost:3250, price:5.50, pop:10, appeal:10, rel:9, playTime:4.5, repReq:750,
    hue:0,   blurb:'World Championship grade. Handle with reverence.' },

  // ---- Arcade cabinets (secondary) ----
  { id:'blaster',    name:'Retro Blaster',        type:'arcade',  cost:125,  price:1.00, pop:3,  appeal:3,  rel:5, playTime:2.5, repReq:0,
    hue:0,   blurb:'Pew pew. Sticks a little, charms a lot.' },
  { id:'kungfu',     name:'Kung Fu Fury',         type:'arcade',  cost:250,  price:1.25, pop:5,  appeal:4,  rel:5, playTime:2.8, repReq:20,
    hue:15,  blurb:'Button-mashing that borders on cardio.' },
  { id:'racer',      name:'Turbo Racer DX',       type:'arcade',  cost:525, price:2.25, pop:6,  appeal:6,  rel:6, playTime:3, repReq:100,
    hue:200, blurb:'The seat rumbles. The profits too.' },
  { id:'zombie',     name:'Zombie Onslaught',     type:'arcade',  cost:825, price:2.75, pop:7,  appeal:7,  rel:6, playTime:3, repReq:220,
    hue:130, blurb:'Two plastic shotguns, infinite screaming teens.' },
  { id:'dance',      name:'Dance Mania Revolution',type:'arcade', cost:1200, price:3.50, pop:8,  appeal:8,  rel:5, playTime:3.5, repReq:350,
    hue:300, blurb:'A spectacle machine. Draws a crowd by itself.' },
  { id:'vrpod',      name:'VR Hyperpod',          type:'arcade',  cost:2000, price:5.00, pop:9,  appeal:9,  rel:7, playTime:4, repReq:500,
    hue:170, blurb:'The future, rented by the minute.' },

  // ---- Amenities ----
  { id:'snackbar',   name:'Snack Bar',            type:'amenity', cost:450,  price:0,    pop:0,  appeal:4,  rel:9, playTime:0, repReq:0,
    hue:35,  blurb:'Customers buy snacks (~$2 each visit). +satisfaction. Big earner on tournament days.' },
  { id:'prizes',     name:'Prize Counter',        type:'amenity', cost:650, price:0,    pop:0,  appeal:5,  rel:9, playTime:0, repReq:60,
    hue:55,  blurb:'Plush dinos and keychains. +satisfaction, small steady income.' },
  { id:'neonsign',   name:'Giant Neon Sign',      type:'amenity', cost:250,  price:0,    pop:0,  appeal:7,  rel:10, playTime:0, repReq:0,
    hue:315, blurb:'Pure foot-traffic magnetism. Does nothing else. Gloriously.' },
];

/* ---------- Expansions ---------- */
DATA.EXPANSIONS = [
  { level:0, w:14, h:10, cost:0,     name:'Corner Shop' },
  { level:1, w:18, h:12, cost:2500,  name:'Main Street Hall' },
  { level:2, w:22, h:14, cost:7500,  name:'Grand Arcade' },
  { level:3, w:26, h:16, cost:18000, name:'Championship Complex' },
];

/* ---------- Staff ---------- */
DATA.STAFF = {
  tech:    { name:'Technician',    wage:40, icon:'🔧', desc:'Repairs broken machines and performs preventive maintenance. Levels up to work faster.' },
  janitor: { name:'Janitor',       wage:25, icon:'🧹', desc:'Keeps the arcade clean. Dirty arcades tank satisfaction and reputation.' },
  manager: { name:'Event Manager', wage:80, icon:'📋', desc:'+30% tournament revenue, +25% tournament reputation. Required for National tier and above.' },
};

/* ---------- Tournament tiers ---------- */
DATA.TIERS = [
  { id:'local', name:'Local Showdown', entrants:8,
    req:{ machines:4, pinball:2, rep:25, avgCond:50, expansion:0, hostedPrev:null, manager:false },
    hostCost:100, entryFee:25, ticket:5, prize:200, repReward:40, baseSpectators:70, sponsorPerRep:0,
    desc:'Neighborhood flippers battle for bragging rights and a modest check.' },
  { id:'regional', name:'Regional Masters', entrants:8,
    req:{ machines:8, pinball:4, rep:180, avgCond:60, expansion:1, hostedPrev:'local', manager:false },
    hostCost:400, entryFee:60, ticket:8, prize:800, repReward:90, baseSpectators:200, sponsorPerRep:1.2,
    desc:'The region’s best. Scouts in the crowd. Local news might show up.' },
  { id:'national', name:'National Open', entrants:16,
    req:{ machines:12, pinball:6, rep:420, avgCond:70, expansion:2, hostedPrev:'regional', manager:true },
    hostCost:1200, entryFee:120, ticket:14, prize:2500, repReward:170, baseSpectators:450, sponsorPerRep:5,
    desc:'Televised. Sponsored. Sixteen killers and one trophy.' },
  { id:'world', name:'WORLD CHAMPIONSHIP', entrants:16,
    req:{ machines:16, pinball:9, rep:800, avgCond:80, expansion:3, hostedPrev:'national', manager:true },
    hostCost:3000, entryFee:250, ticket:28, prize:10000, repReward:300, baseSpectators:900, sponsorPerRep:10,
    desc:'The summit of competitive pinball. Host this, and your name enters history.' },
];

/* Spectator capacity by expansion level */
DATA.SPECTATOR_CAP = [90, 240, 520, 1200];

/* ---------- Competitor generation pools ---------- */
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
      else { s.reputation=Math.max(0,s.reputation-10);
        return '📰 A game journalist reviewed your arcade: "Sticky floors, long waits." -10 reputation.'; } },
  },
  { id:'party',   chance:0.05, run:(s)=>{ Game.income(150,'plays'); s.cleanliness=Math.max(0,s.cleanliness-18);
      return '🎂 A birthday party booked the arcade! +$150, but the cake situation got out of hand.'; } },
  { id:'wizard',  chance:0.04, run:(s)=>{ s.reputation=Math.min(1000,s.reputation+12); s.buzzDays=Math.max(s.buzzDays,1); s.buzzMult=Math.max(s.buzzMult,1.5);
      return '🧙 A legendary pinball wizard dropped by unannounced and drew a crowd! +12 reputation.'; } },
  { id:'rain',    chance:0.05, run:(s)=>{ s.buzzDays=Math.max(s.buzzDays,1); s.buzzMult=Math.max(s.buzzMult,1.4);
      return '🌧️ Rainy day! Nothing drives arcade traffic like bad weather.'; } },
];

/* ---------- Flavor ticker lines ---------- */
DATA.FLAVOR = [
  'A customer just asked if the pinball machines "have wifi".',
  'Someone achieved a personal best and told literally everyone.',
  'The claw machine union has requested representation. You don’t own a claw machine.',
  'A regular has named your Rusty Flip machine "Gerald".',
  'Overheard: "One more game. Okay two. Okay five."',
  'A kid paid entirely in nickels. The count is ongoing.',
  'Local pigeons have unionized outside the entrance. Demands unclear.',
  'Someone tried to pay for a game with exposure. Denied.',
  'The high score board has become a site of intense diplomacy.',
  'A customer described your arcade as "the good kind of loud."',
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
