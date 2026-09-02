/* ==========================================================================
   VedicAstro — mock astrology data & deterministic "engine"
   NOTE: This is a placeholder generator so the frontend has real-feeling,
   *stable* data to render before the real ephemeris/astrology API is wired
   up. Every function here is pure and seeded from the user's own input, so
   the same birth details always render the same chart. Swap generateKundli()
   for a real API call later — the rendering code doesn't need to change.
   ========================================================================== */

const SIGNS = [
  { i:1,  name:'Aries',       sym:'♈', element:'Fire',  ruler:'Mars',    range:'Mar 21 – Apr 19' },
  { i:2,  name:'Taurus',      sym:'♉', element:'Earth', ruler:'Venus',   range:'Apr 20 – May 20' },
  { i:3,  name:'Gemini',      sym:'♊', element:'Air',   ruler:'Mercury', range:'May 21 – Jun 20' },
  { i:4,  name:'Cancer',      sym:'♋', element:'Water', ruler:'Moon',    range:'Jun 21 – Jul 22' },
  { i:5,  name:'Leo',         sym:'♌', element:'Fire',  ruler:'Sun',     range:'Jul 23 – Aug 22' },
  { i:6,  name:'Virgo',       sym:'♍', element:'Earth', ruler:'Mercury', range:'Aug 23 – Sep 22' },
  { i:7,  name:'Libra',       sym:'♎', element:'Air',   ruler:'Venus',   range:'Sep 23 – Oct 22' },
  { i:8,  name:'Scorpio',     sym:'♏', element:'Water', ruler:'Mars',    range:'Oct 23 – Nov 21' },
  { i:9,  name:'Sagittarius', sym:'♐', element:'Fire',  ruler:'Jupiter', range:'Nov 22 – Dec 21' },
  { i:10, name:'Capricorn',   sym:'♑', element:'Earth', ruler:'Saturn',  range:'Dec 22 – Jan 19' },
  { i:11, name:'Aquarius',    sym:'♒', element:'Air',   ruler:'Saturn',  range:'Jan 20 – Feb 18' },
  { i:12, name:'Pisces',      sym:'♓', element:'Water', ruler:'Jupiter', range:'Feb 19 – Mar 20' },
];

const PLANETS = [
  { key:'Su', name:'Sun',     glyph:'☉' },
  { key:'Mo', name:'Moon',    glyph:'☽' },
  { key:'Ma', name:'Mars',    glyph:'♂' },
  { key:'Me', name:'Mercury', glyph:'☿' },
  { key:'Ju', name:'Jupiter', glyph:'♃' },
  { key:'Ve', name:'Venus',   glyph:'♀' },
  { key:'Sa', name:'Saturn',  glyph:'♄' },
  { key:'Ra', name:'Rahu',    glyph:'☊' },
  { key:'Ke', name:'Ketu',    glyph:'☋' },
];

const NAKSHATRAS = ['Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra','Punarvasu','Pushya','Ashlesha',
  'Magha','Purva Phalguni','Uttara Phalguni','Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha',
  'Mula','Purva Ashadha','Uttara Ashadha','Shravana','Dhanishta','Shatabhisha','Purva Bhadrapada','Uttara Bhadrapada','Revati'];

const DASHA_ORDER = ['Ketu','Venus','Sun','Moon','Mars','Rahu','Jupiter','Saturn','Mercury'];
const DASHA_YEARS = {Ketu:7, Venus:20, Sun:6, Moon:10, Mars:7, Rahu:18, Jupiter:16, Saturn:19, Mercury:17};

function signOf(i){ return SIGNS[((i-1)%12+12)%12]; }

/* deterministic seed + PRNG so the same birth details always render the same chart */
function seedFromString(str){
  let h = 1779033703 ^ str.length;
  for(let i=0;i<str.length;i++){
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}
function mulberry32(seed){
  let a = seed;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeRand(str){
  const seeder = seedFromString(str);
  return mulberry32(seeder());
}

const INSIGHT_BANK = {
  house1:  ["You come across as naturally confident, and first impressions tend to work in your favour.",
            "Your personality carries quiet authority — people notice you before you say a word."],
  house2:  ["Financial stability builds steadily through your own discipline rather than luck.",
            "You have a strong instinct for value — in money, relationships, and time."],
  house3:  ["Communication is one of your real strengths; writing, speaking or teaching suit you well.",
            "Courage grows on you with practice — the more you try, the bolder you become."],
  house4:  ["Home and emotional roots matter deeply to your sense of security.",
            "You're happiest when your inner circle feels stable and cared for."],
  house5:  ["Creativity and clear thinking work well together for you — ideas turn into real plans.",
            "Romance, learning and self-expression are areas where you naturally shine."],
  house6:  ["You handle pressure better than you give yourself credit for.",
            "Discipline around health and daily routine pays off more than it seems to at first."],
  house7:  ["Partnerships — business or personal — play a defining role in your story.",
            "You do your best work and thinking in the presence of the right partner."],
  house8:  ["You're drawn to what's hidden — research, psychology, or the ‘why’ behind things.",
            "Transformation doesn't scare you; you tend to come back stronger after change."],
  house9:  ["A strong moral compass and love of learning guide your bigger decisions.",
            "Travel, higher study or philosophy could open doors later in life."],
  house10: ["Career and public reputation carry real weight in your chart — ambition suits you.",
            "Hard work here compounds; recognition tends to arrive a little later than expected, but it holds."],
  house11: ["Friendships and networks bring opportunity — your circle matters more than you think.",
            "Gains often arrive through people rather than plans alone."],
  house12: ["You process the world inwardly — rest and solitude genuinely recharge you.",
            "A quiet spiritual or reflective streak runs underneath your daily life."],
};

function ordinalHouse(n){ return ['1st','2nd','3rd','4th','5th','6th','7th','8th','9th','10th','11th','12th'][n-1]; }

function generateKundli({name='', gender='', dob, tob, pob}){
  const seedStr = `${name}|${gender}|${dob}|${tob}|${pob}`;
  const rand = makeRand(seedStr || 'vedicastro');

  const lagnaIdx = 1 + Math.floor(rand()*12);
  const planetPlacements = PLANETS.map(p=>{
    const signIdx = 1 + Math.floor(rand()*12);
    const deg = +(rand()*29 + 0.3).toFixed(2);
    const house = ((signIdx - lagnaIdx + 12) % 12) + 1;
    return { ...p, signIdx, sign: signOf(signIdx), deg, house };
  });
  const moon = planetPlacements.find(p=>p.key==='Mo');
  const nakIdx = Math.floor(rand()*27);
  const nakshatra = NAKSHATRAS[nakIdx];
  const nakPada = 1 + Math.floor(rand()*4);

  // build 12-house layout for chart rendering: each house -> its zodiac sign + planets sitting there
  const houses = Array.from({length:12}, (_,idx)=>{
    const houseNum = idx+1;
    const signIdx = ((lagnaIdx - 1 + idx) % 12) + 1;
    const there = planetPlacements.filter(p=>p.house===houseNum).map(p=>p.key);
    return { num: houseNum, signIdx, sign: signOf(signIdx), planets: there };
  });

  // dasha: pick a mahadasha in progress using birth year as an anchor
  const birthYear = dob ? new Date(dob).getFullYear() : 1995;
  const startIdx = Math.floor(rand()*9);
  let cursor = birthYear + Math.floor(rand()*8) - 4;
  let dashaLord = DASHA_ORDER[startIdx];
  const today = new Date().getFullYear();
  let idx = startIdx;
  let dStart = cursor;
  while(cursor + DASHA_YEARS[DASHA_ORDER[idx % 9]] < today){
    cursor += DASHA_YEARS[DASHA_ORDER[idx % 9]];
    idx++;
  }
  dashaLord = DASHA_ORDER[idx % 9];
  dStart = cursor;
  const dEnd = dStart + DASHA_YEARS[dashaLord];
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dMonth = MONTHS[Math.floor(rand()*12)];
  const dDay = 1 + Math.floor(rand()*28);

  // insights: pick house-based lines for a handful of meaningful houses
  const focusHouses = [1, 10, 7, 5, 2].map(h => houses[h-1]);
  const insights = focusHouses.map(h => {
    const bank = INSIGHT_BANK['house'+h.num];
    return bank[Math.floor(rand()*bank.length)];
  });

  return {
    name, gender, dob, tob, pob,
    lagna: signOf(lagnaIdx),
    moonSign: moon.sign,
    nakshatra, nakPada,
    planets: planetPlacements,
    houses,
    dasha: { lord: dashaLord, start: dStart, end: dEnd, startLabel: `${dDay} ${dMonth} ${dStart}`, endLabel: `${dDay} ${dMonth} ${dEnd}` },
    insights,
  };
}

/* ---------------- horoscope mock bank ---------------- */
const HORO_BANK = {
  general: [
    "Today favours clear thinking over quick reaction — pause before you commit to anything big.",
    "A small, ordinary moment could open a door you weren't expecting. Stay observant.",
    "Your energy is steady today; use it to finish something you've been putting off.",
    "Conversations carry more weight than usual — choose your words with care.",
    "A minor setback early on gives way to a smoother afternoon. Don't overreact to the first sign of trouble.",
    "This is a good day to plan rather than push — lay groundwork for next week.",
  ],
  love: [
    "Romance is in the air; express your feelings instead of assuming they're understood.",
    "A little patience with a partner or crush goes a long way today.",
    "Single? A conversation today could turn into something worth following up on.",
    "Old feelings might resurface — sit with them before deciding what they mean.",
    "Honesty, gently delivered, strengthens a close relationship today.",
  ],
  career: [
    "New opportunities may lead to career growth — stay visible and say yes to the right ask.",
    "A pending decision at work benefits from one more day of thought.",
    "Your ideas land well in front of the right audience today — speak up in meetings.",
    "Collaboration outperforms solo effort today; loop others in early.",
    "A change in routine at work turns out better than it first seems.",
  ],
  finance: [
    "Financial stability is indicated — plan investments rather than reacting to trends.",
    "Avoid impulsive spending today; a planned purchase will feel far more satisfying next week.",
    "A pending payment or refund is likely to resolve in your favour.",
    "Review a subscription or recurring cost today — small savings add up.",
    "Good day to talk money with a partner or family member; clarity now avoids friction later.",
  ],
  health: [
    "Take care of your health and avoid stress — a short walk resets your mood more than caffeine will.",
    "Sleep is your best remedy tonight; don't trade it for one more scroll.",
    "Minor tension in the neck or shoulders asks for a stretch break, not a painkiller.",
    "Hydration and a lighter meal serve you better than usual today.",
    "Your energy dips mid-afternoon — plan lighter tasks for that window.",
  ],
};
function pickDaily(bank, seedStr){
  const rand = makeRand(seedStr);
  return bank[Math.floor(rand()*bank.length)];
}
function todaySeed(sign, period){
  const d = new Date();
  const bucket = period==='daily' ? d.toISOString().slice(0,10)
               : period==='weekly' ? `${d.getFullYear()}-W${Math.ceil(d.getDate()/7)}`
               : period==='monthly' ? d.toISOString().slice(0,7)
               : String(d.getFullYear());
  return `${sign}|${period}|${bucket}`;
}
function getHoroscope(signName, period='daily'){
  const seed = todaySeed(signName, period);
  return {
    general: pickDaily(HORO_BANK.general, seed+'g'),
    love: pickDaily(HORO_BANK.love, seed+'l'),
    career: pickDaily(HORO_BANK.career, seed+'c'),
    finance: pickDaily(HORO_BANK.finance, seed+'f'),
    health: pickDaily(HORO_BANK.health, seed+'h'),
  };
}

/* ---------------- compatibility mock ---------------- */
function computeCompatibility(p1, p2){
  const rand = makeRand(`${p1.dob}|${p1.tob}|${p1.pob}|${p2.dob}|${p2.tob}|${p2.pob}`);
  const mk = () => Math.round(58 + rand()*40);
  const overall = mk();
  const scores = {
    physical: mk(), emotional: mk(), financial: mk(), mental: mk(), spiritual: mk(),
  };
  let verdict = 'Fair Match';
  if(overall>=85) verdict='Excellent Match';
  else if(overall>=70) verdict='Good Match';
  else if(overall>=55) verdict='Average Match';
  else verdict='Needs Effort';
  return { overall, verdict, scores };
}
