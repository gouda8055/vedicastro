// POST /api/kundli/generate  { name, gender, dob, tob, pob }
// dob: "YYYY-MM-DD"   tob: "HH:MM" (24h, local time at birth place)
// -> 200 { chart data }  — computed with real orbital mechanics, not mock data.
// If a valid session token is provided, the chart is also saved to the
// signed-in user's account.

const { query } = require('../../lib/db');
const { verifyToken } = require('../../lib/auth');
const { computeSiderealChart, vimshottariDasha } = require('../../lib/astro');
const { resolvePlace, resolvePlaceWithAI } = require('../../lib/geo');

const DOB_RE = /^\d{4}-\d{2}-\d{2}$/;
const TOB_RE = /^\d{2}:\d{2}$/;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, gender, dob, tob, pob } = req.body || {};

  if (!dob || !DOB_RE.test(dob)) return res.status(400).json({ error: 'A valid date of birth (YYYY-MM-DD) is required.' });
  if (!tob || !TOB_RE.test(tob)) return res.status(400).json({ error: 'A valid time of birth (HH:MM) is required.' });
  if (!pob || !String(pob).trim()) return res.status(400).json({ error: 'Birth place is required.' });

  const [year, month, day] = dob.split('-').map(Number);
  const [hour, minute] = tob.split(':').map(Number);

  let place = resolvePlace(pob);
  if (!place.resolved) {
    // Fast table missed — ask the AI, which has much broader place knowledge
    // (states, small towns, alternate spellings). Never let this block or
    // fail chart generation: any problem here just keeps the safe default.
    const aiPlace = await resolvePlaceWithAI(pob);
    if (aiPlace) place = aiPlace;
  }

  let chart;
  try {
    chart = computeSiderealChart({
      year, month, day, hour, minute,
      utcOffsetHours: place.utcOffset,
      latitude: place.lat,
      longitude: place.lon,
    });
  } catch (err) {
    console.error('chart calculation error:', err);
    return res.status(500).json({ error: 'Could not calculate a chart for those details. Please double-check the date and time.' });
  }

  const birthDateForDasha = new Date(Date.UTC(year, month - 1, day, hour - place.utcOffset, minute));
  const dasha = vimshottariDasha(chart.planets.find(p => p.key === 'Mo').longitude, birthDateForDasha);

  const responseBody = {
    name: name || '',
    gender: gender || '',
    dob, tob, pob,
    place: { resolved: place.resolved, matchedCity: place.matchedCity, latitude: place.lat, longitude: place.lon, utcOffset: place.utcOffset, source: place.source || 'table' },
    lagna: chart.lagna,
    moonSign: chart.moonSign,
    nakshatra: chart.nakshatra,
    planets: chart.planets,
    houses: chart.houses,
    ayanamsa: chart.ayanamsa,
    dasha: {
      lord: dasha.current.lord,
      start: dasha.current.start.toISOString(),
      end: dasha.current.end.toISOString(),
    },
  };

  // If signed in, save this chart to the user's account (best-effort — don't
  // fail the whole request if saving doesn't work, e.g. DB hiccup).
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token && process.env.AUTH_SECRET) {
    const payload = verifyToken(token, process.env.AUTH_SECRET);
    if (payload && payload.userId) {
      try {
        await query(
          `INSERT INTO kundlis (user_id, name, gender, dob, tob, pob, chart_data) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [payload.userId, name || 'Untitled', gender || null, dob, tob, pob, JSON.stringify(responseBody)]
        );
        responseBody.saved = true;
      } catch (err) {
        console.error('kundli save error (non-fatal):', err);
        responseBody.saved = false;
      }
    }
  }

  return res.status(200).json(responseBody);
};
