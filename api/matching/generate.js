// POST /api/matching/generate
// Body: { person1: {name, dob, tob, pob}, person2: {name, dob, tob, pob} }
// -> 200 { person1, person2, result: {...Ashtakoot Milan...}, saved }
//
// Computes real synastry using the same tested astronomy engine as Kundli
// generation — no mock data. Signed-in users are limited to 1 free
// compatibility check, enforced server-side against the database (can't be
// bypassed). Anonymous users aren't blocked here — there's no durable
// server-side identity to enforce against without an account — the
// frontend applies a soft client-side limit for that case instead.

const { query } = require('../../lib/db');
const { verifyToken } = require('../../lib/auth');
const { computeSiderealChart } = require('../../lib/astro');
const { resolvePlace, resolvePlaceWithAI } = require('../../lib/geo');
const { computeAshtakootMatch } = require('../../lib/matching');

const DOB_RE = /^\d{4}-\d{2}-\d{2}$/;
const TOB_RE = /^\d{2}:\d{2}$/;
const FREE_MATCHES_PER_USER = 1;

function validatePerson(p, label){
  if (!p || typeof p !== 'object') return `${label}'s details are required.`;
  if (!p.dob || !DOB_RE.test(p.dob)) return `A valid date of birth (YYYY-MM-DD) is required for ${label}.`;
  if (!p.tob || !TOB_RE.test(p.tob)) return `A valid time of birth (HH:MM) is required for ${label}.`;
  if (!p.pob || !String(p.pob).trim()) return `A birth place is required for ${label}.`;
  return null;
}

async function resolvedPlace(pobText){
  let place = resolvePlace(pobText);
  if (!place.resolved) {
    const aiPlace = await resolvePlaceWithAI(pobText);
    if (aiPlace) place = aiPlace;
  }
  return place;
}

async function chartFor(person){
  const [year, month, day] = person.dob.split('-').map(Number);
  const [hour, minute] = person.tob.split(':').map(Number);
  const place = await resolvedPlace(person.pob);
  const chart = computeSiderealChart({
    year, month, day, hour, minute,
    utcOffsetHours: place.utcOffset, latitude: place.lat, longitude: place.lon,
  });
  return { chart, place };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { person1, person2 } = req.body || {};
  const err1 = validatePerson(person1, "the first person");
  if (err1) return res.status(400).json({ error: err1 });
  const err2 = validatePerson(person2, "the second person");
  if (err2) return res.status(400).json({ error: err2 });

  // --- server-side enforcement (signed-in users only) ---
  let userId = null;
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token && process.env.AUTH_SECRET) {
    const payload = verifyToken(token, process.env.AUTH_SECRET);
    if (payload && payload.userId) {
      userId = payload.userId;
      try {
        const existing = await query(`SELECT COUNT(*) AS count FROM compatibility_reports WHERE user_id = $1`, [userId]);
        const usedCount = parseInt(existing.rows[0].count, 10) || 0;
        if (usedCount >= FREE_MATCHES_PER_USER) {
          return res.status(403).json({
            error: "You've already used your free compatibility check. Upgrade your plan for unlimited checks.",
            limitReached: true,
          });
        }
      } catch (err) {
        console.error('matching: limit check failed (allowing, fail-open):', err);
      }
    }
  }

  // --- real computation ---
  let chart1, chart2, place1, place2;
  try {
    ({ chart: chart1, place: place1 } = await chartFor(person1));
    ({ chart: chart2, place: place2 } = await chartFor(person2));
  } catch (err) {
    console.error('matching: chart calculation error:', err);
    return res.status(500).json({ error: 'Could not calculate a match for those details. Please double-check the dates and times.' });
  }

  const result = computeAshtakootMatch(chart1, chart2);

  const responseBody = {
    person1: { name: person1.name || 'Person 1', moonSign: chart1.moonSign.signName, nakshatra: chart1.nakshatra.name, placeResolved: place1.resolved },
    person2: { name: person2.name || 'Person 2', moonSign: chart2.moonSign.signName, nakshatra: chart2.nakshatra.name, placeResolved: place2.resolved },
    result,
  };

  // --- save (best-effort, only for signed-in users) ---
  if (userId) {
    try {
      await query(
        `INSERT INTO compatibility_reports
          (user_id, person1_name, person1_dob, person1_tob, person1_pob, person2_name, person2_dob, person2_tob, person2_pob, result)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [userId, person1.name || 'Person 1', person1.dob, person1.tob, person1.pob,
         person2.name || 'Person 2', person2.dob, person2.tob, person2.pob, JSON.stringify(responseBody)]
      );
      responseBody.saved = true;
    } catch (err) {
      console.error('matching: save error (non-fatal):', err);
      responseBody.saved = false;
    }
  }

  return res.status(200).json(responseBody);
};
