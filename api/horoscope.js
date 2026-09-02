// GET /api/horoscope?type=daily|weekly|monthly|yearly|panchang
//
// Consolidated into ONE file (not five) — Vercel's Hobby plan caps a
// deployment at 12 serverless functions, and this project sits right at
// that ceiling. Same behavior either way:
//   - daily/weekly/monthly/yearly: ALL 12 signs generated in a SINGLE AI
//     call, cached for the whole period (day/week/month/year) — never
//     regenerated per visitor, and never regenerated more than once per
//     period no matter how much traffic the page gets.
//   - panchang: Tithi, Yoga, Karana, sunrise/sunset, and the muhurat
//     windows are computed with real astronomy (see lib/astro.js), not AI —
//     only the short "overview" text is AI-written. Cached once per day.

const { query } = require('../lib/db');
const { computePanchang } = require('../lib/astro');
const { DEFAULT_LOCATION } = require('../lib/geo');

const GROK_MODEL = process.env.GROK_MODEL || 'grok-4-1-fast';
const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';

const SIGN_NAMES = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const CATEGORIES = ['general', 'love', 'career', 'finance', 'health'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function todayIST(){
  const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
  return { year: ist.getUTCFullYear(), month: ist.getUTCMonth() + 1, day: ist.getUTCDate(), weekday: ist.getUTCDay(), dateObj: ist };
}

function fmtShort(dateObj){
  return `${MONTH_NAMES[dateObj.getUTCMonth()].slice(0,3)} ${dateObj.getUTCDate()}`;
}

function getPeriodInfo(type, todayIstDate){
  if (type === 'weekly') {
    const day = todayIstDate.getUTCDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(todayIstDate);
    monday.setUTCDate(todayIstDate.getUTCDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    return { key: monday.toISOString().slice(0, 10), label: `${fmtShort(monday)} – ${fmtShort(sunday)}, ${sunday.getUTCFullYear()}` };
  }
  if (type === 'monthly') {
    const y = todayIstDate.getUTCFullYear(), m = todayIstDate.getUTCMonth();
    return { key: `${y}-${String(m + 1).padStart(2, '0')}`, label: `${MONTH_NAMES[m]} ${y}` };
  }
  if (type === 'yearly') {
    const y = todayIstDate.getUTCFullYear();
    return { key: String(y), label: String(y) };
  }
  return null;
}

function isValidSignShape(obj){
  return !!(obj && typeof obj === 'object' && CATEGORIES.every(c => typeof obj[c] === 'string' && obj[c].trim().length > 0));
}
function isValidAllSignsShape(obj){
  return !!(obj && typeof obj === 'object' && SIGN_NAMES.every(sign => isValidSignShape(obj[sign])));
}

function parseAIJson(text){
  if (!text) return null;
  const cleaned = text.replace(/^```(json)?\s*|\s*```$/g, '').trim();
  try { return JSON.parse(cleaned); } catch { return null; }
}

async function callGrok(prompt, maxTokens){
  if (!process.env.GROK_API_KEY) return null;
  try {
    const resp = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROK_API_KEY}` },
      body: JSON.stringify({ model: GROK_MODEL, messages: [{ role: 'user', content: prompt }], temperature: 0.9, max_tokens: maxTokens }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) { console.error('horoscope/panchang AI error:', resp.status, data); return null; }
    return data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  } catch (err) {
    console.error('horoscope/panchang AI generation failed:', err);
    return null;
  }
}

// ---------------- daily/weekly/monthly/yearly horoscopes ----------------

function buildHoroscopePrompt(type, dateOrLabel){
  const timeframe = { daily: `today (${dateOrLabel})`, weekly: `this week (${dateOrLabel})`, monthly: `this month (${dateOrLabel})`, yearly: `this year (${dateOrLabel})` }[type];
  return `Write a ${type} Vedic astrology horoscope for ALL 12 zodiac signs at once, covering ${timeframe}. `
    + `Respond with ONLY a compact JSON object (no markdown, no code fences, no explanation) with exactly `
    + `this structure — one key per sign, using these exact names: ${SIGN_NAMES.join(', ')}. `
    + `Each sign's value must be an object with exactly these five string fields: `
    + `{"general": "...", "love": "...", "career": "...", "finance": "...", "health": "..."}. `
    + `Each field should be ${type === 'daily' ? '1-2' : '2-3'} warm, plain-language sentences, specific to that `
    + `sign's traits and this timeframe — not generic filler. Be encouraging but honest; avoid absolute `
    + `predictions and avoid specific medical or financial advice.`;
}

async function loadCachedDaily(dateStr){
  const result = await query(`SELECT sign, general, love, career, finance, health FROM daily_horoscopes WHERE horoscope_date = $1`, [dateStr]);
  const bySign = {};
  result.rows.forEach(r => { bySign[r.sign] = { general: r.general, love: r.love, career: r.career, finance: r.finance, health: r.health }; });
  return bySign;
}
async function saveDaily(sign, dateStr, data){
  try {
    await query(
      `INSERT INTO daily_horoscopes (sign, horoscope_date, general, love, career, finance, health)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (sign, horoscope_date) DO NOTHING`,
      [sign, dateStr, data.general, data.love, data.career, data.finance, data.health]
    );
  } catch (err) { console.error(`daily horoscope save failed for ${sign}:`, err); }
}

async function loadCachedPeriod(periodType, periodKey){
  const result = await query(
    `SELECT sign, period_label, general, love, career, finance, health FROM period_horoscopes WHERE period_type = $1 AND period_key = $2`,
    [periodType, periodKey]
  );
  const bySign = {};
  let label = null;
  result.rows.forEach(r => { bySign[r.sign] = { general: r.general, love: r.love, career: r.career, finance: r.finance, health: r.health }; label = r.period_label; });
  return { bySign, label };
}
async function savePeriod(periodType, sign, periodKey, periodLabel, data){
  try {
    await query(
      `INSERT INTO period_horoscopes (period_type, sign, period_key, period_label, general, love, career, finance, health)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (period_type, sign, period_key) DO NOTHING`,
      [periodType, sign, periodKey, periodLabel, data.general, data.love, data.career, data.finance, data.health]
    );
  } catch (err) { console.error(`${periodType} horoscope save failed for ${sign}:`, err); }
}

async function handleHoroscope(type, res){
  const today = todayIST();
  const dateStr = `${today.year}-${String(today.month).padStart(2,'0')}-${String(today.day).padStart(2,'0')}`;

  if (type === 'daily') {
    let cached = {};
    try { cached = await loadCachedDaily(dateStr); } catch (err) { console.error('daily cache lookup failed:', err); }
    const missing = SIGN_NAMES.filter(s => !cached[s]);
    if (missing.length === 0) return res.status(200).json({ period: 'daily', label: 'Today', date: dateStr, source: 'cache', horoscopes: cached });

    const raw = await callGrok(buildHoroscopePrompt('daily', dateStr), 3000);
    const generated = isValidAllSignsShape(parseAIJson(raw)) ? parseAIJson(raw) : null;
    if (!generated) {
      if (Object.keys(cached).length) return res.status(200).json({ period: 'daily', label: 'Today', date: dateStr, source: 'partial-cache', horoscopes: cached });
      return res.status(503).json({ error: "Today's horoscopes aren't ready yet — please try again shortly." });
    }
    await Promise.all(missing.map(sign => saveDaily(sign, dateStr, generated[sign])));
    return res.status(200).json({ period: 'daily', label: 'Today', date: dateStr, source: 'ai', horoscopes: { ...generated, ...cached } });
  }

  // weekly / monthly / yearly
  const { key, label } = getPeriodInfo(type, today.dateObj);
  let cachedResult = { bySign: {}, label };
  try { cachedResult = await loadCachedPeriod(type, key); } catch (err) { console.error(`${type} cache lookup failed:`, err); }
  const cached = cachedResult.bySign;
  const missing = SIGN_NAMES.filter(s => !cached[s]);
  if (missing.length === 0) return res.status(200).json({ period: type, label: cachedResult.label || label, periodKey: key, source: 'cache', horoscopes: cached });

  const raw = await callGrok(buildHoroscopePrompt(type, label), 4000);
  const generated = isValidAllSignsShape(parseAIJson(raw)) ? parseAIJson(raw) : null;
  if (!generated) {
    if (Object.keys(cached).length) return res.status(200).json({ period: type, label, periodKey: key, source: 'partial-cache', horoscopes: cached });
    return res.status(503).json({ error: `This ${type} horoscope isn't ready yet — please try again shortly.` });
  }
  await Promise.all(missing.map(sign => savePeriod(type, sign, key, label, generated[sign])));
  return res.status(200).json({ period: type, label, periodKey: key, source: 'ai', horoscopes: { ...generated, ...cached } });
}

// ---------------- Panchang ----------------

async function handlePanchang(res){
  const today = todayIST();
  const dateStr = `${today.year}-${String(today.month).padStart(2,'0')}-${String(today.day).padStart(2,'0')}`;

  try {
    const cached = await query(`SELECT * FROM daily_panchang WHERE panchang_date = $1`, [dateStr]);
    if (cached.rows.length) {
      const r = cached.rows[0];
      return res.status(200).json({
        date: dateStr, source: 'cache',
        tithi: r.tithi, paksha: r.paksha, nakshatra: r.nakshatra, yoga: r.yoga, karana: r.karana,
        sunrise: r.sunrise, sunset: r.sunset, rahuKaal: r.rahu_kaal, gulikaKaal: r.gulika_kaal,
        yamagandaKaal: r.yamaganda_kaal, abhijitMuhurat: r.abhijit_muhurat, overview: r.overview,
      });
    }
  } catch (err) {
    console.error('panchang cache lookup failed:', err);
  }

  let computed;
  try {
    computed = computePanchang({
      year: today.year, month: today.month, day: today.day,
      utcOffsetHours: DEFAULT_LOCATION.utcOffset, latitude: DEFAULT_LOCATION.lat, longitude: DEFAULT_LOCATION.lon,
    });
  } catch (err) {
    console.error('panchang calculation failed:', err);
    return res.status(500).json({ error: "Could not calculate today's Panchang." });
  }

  const prompt = `Today's Vedic Panchang (${dateStr}) is: Tithi ${computed.tithi.name} (${computed.tithi.paksha} paksha), `
    + `Nakshatra ${computed.nakshatra.name}, Yoga ${computed.yoga.name}, Karana ${computed.karana.name}. `
    + `Write a short (2-3 sentence) plain-language overview of what today's Panchang suggests — general tone for `
    + `the day, without specific medical, financial, or absolute predictions. Respond with ONLY the overview text, `
    + `no labels, no markdown, no JSON.`;
  const overviewRaw = await callGrok(prompt, 300);
  const overview = (overviewRaw && overviewRaw.trim()) || `Today's Tithi is ${computed.tithi.name} (${computed.tithi.paksha} paksha) under ${computed.nakshatra.name} nakshatra.`;

  try {
    await query(
      `INSERT INTO daily_panchang (panchang_date, tithi, paksha, nakshatra, yoga, karana, sunrise, sunset, rahu_kaal, gulika_kaal, yamaganda_kaal, abhijit_muhurat, overview)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (panchang_date) DO NOTHING`,
      [dateStr, computed.tithi.name, computed.tithi.paksha, computed.nakshatra.name, computed.yoga.name, computed.karana.name,
       computed.sunrise, computed.sunset, computed.rahuKaal, computed.gulikaKaal, computed.yamagandaKaal, computed.abhijitMuhurat, overview]
    );
  } catch (err) {
    console.error('panchang save failed (non-fatal):', err);
  }

  return res.status(200).json({
    date: dateStr, source: 'ai',
    tithi: computed.tithi.name, paksha: computed.tithi.paksha, nakshatra: computed.nakshatra.name,
    yoga: computed.yoga.name, karana: computed.karana.name, sunrise: computed.sunrise, sunset: computed.sunset,
    rahuKaal: computed.rahuKaal, gulikaKaal: computed.gulikaKaal, yamagandaKaal: computed.yamagandaKaal,
    abhijitMuhurat: computed.abhijitMuhurat, overview,
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const type = req.url.includes('?') ? new URLSearchParams(req.url.split('?')[1]).get('type') : null;

  if (type === 'panchang') return handlePanchang(res);
  if (['daily', 'weekly', 'monthly', 'yearly'].includes(type)) return handleHoroscope(type, res);
  return res.status(400).json({ error: 'type must be one of: daily, weekly, monthly, yearly, panchang.' });
};
