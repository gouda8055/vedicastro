// POST /api/kundli                              { name, gender, dob, tob, pob }
// GET  /api/kundli?action=list                   Header: Authorization: Bearer <token>
// GET  /api/kundli?action=get&id=<uuid>          Header: Authorization: Bearer <token>
// GET  /api/kundli?action=pdf&id=<uuid>          Header: Authorization: Bearer <token>  (Ultimate plan only)
//
// Consolidated into ONE file (was 3: generate.js, get.js, list.js) — Vercel's
// Hobby plan caps a deployment at 12 serverless functions, and this frees up
// budget for new features (like the PDF report below) without exceeding it.
// Same behavior and security properties as before for generate/get/list.

const { parse } = require('url');
const crypto = require('crypto');
const { query } = require('../lib/db');
const { verifyToken } = require('../lib/auth');
const { computeSiderealChart, vimshottariDasha } = require('../lib/astro');
const { resolvePlace, resolvePlaceWithAI } = require('../lib/geo');

const DOB_RE = /^\d{4}-\d{2}-\d{2}$/;
const TOB_RE = /^\d{2}:\d{2}$/;
const GROK_MODEL = process.env.GROK_MODEL || 'grok-4-1-fast';
const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';

function getAuth(req){
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || !process.env.AUTH_SECRET) return null;
  const payload = verifyToken(token, process.env.AUTH_SECRET);
  return payload && payload.userId ? payload.userId : null;
}

// ---------------- POST: generate ----------------

async function handleGenerate(req, res){
  const { name, gender, dob, tob, pob } = req.body || {};

  if (!dob || !DOB_RE.test(dob)) return res.status(400).json({ error: 'A valid date of birth (YYYY-MM-DD) is required.' });
  if (!tob || !TOB_RE.test(tob)) return res.status(400).json({ error: 'A valid time of birth (HH:MM) is required.' });
  if (!pob || !String(pob).trim()) return res.status(400).json({ error: 'Birth place is required.' });

  const [year, month, day] = dob.split('-').map(Number);
  const [hour, minute] = tob.split(':').map(Number);

  let place = resolvePlace(pob);
  if (!place.resolved) {
    const aiPlace = await resolvePlaceWithAI(pob);
    if (aiPlace) place = aiPlace;
  }

  let chart;
  try {
    chart = computeSiderealChart({ year, month, day, hour, minute, utcOffsetHours: place.utcOffset, latitude: place.lat, longitude: place.lon });
  } catch (err) {
    console.error('chart calculation error:', err);
    return res.status(500).json({ error: 'Could not calculate a chart for those details. Please double-check the date and time.' });
  }

  const birthDateForDasha = new Date(Date.UTC(year, month - 1, day, hour - place.utcOffset, minute));
  const dasha = vimshottariDasha(chart.planets.find(p => p.key === 'Mo').longitude, birthDateForDasha);

  const responseBody = {
    name: name || '', gender: gender || '', dob, tob, pob,
    place: { resolved: place.resolved, matchedCity: place.matchedCity, latitude: place.lat, longitude: place.lon, utcOffset: place.utcOffset, source: place.source || 'table' },
    lagna: chart.lagna, moonSign: chart.moonSign, nakshatra: chart.nakshatra,
    planets: chart.planets, houses: chart.houses, ayanamsa: chart.ayanamsa,
    dasha: { lord: dasha.current.lord, start: dasha.current.start.toISOString(), end: dasha.current.end.toISOString() },
  };

  const userId = getAuth(req);
  if (userId) {
    try {
      const insertResult = await query(
        `INSERT INTO kundlis (user_id, name, gender, dob, tob, pob, chart_data) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [userId, name || 'Untitled', gender || null, dob, tob, pob, JSON.stringify(responseBody)]
      );
      responseBody.saved = true;
      responseBody.chartId = insertResult.rows[0].id;
    } catch (err) {
      console.error('kundli save error (non-fatal):', err);
      responseBody.saved = false;
    }
  }
  if (!responseBody.chartId) responseBody.chartId = crypto.randomUUID();

  return res.status(200).json(responseBody);
}

// ---------------- GET: list ----------------

async function handleList(req, res, userId){
  try {
    const result = await query(
      `SELECT id, name, gender, dob::text AS dob, tob::text AS tob, pob, chart_data, created_at
       FROM kundlis WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    const kundlis = result.rows.map(row => ({
      id: row.id, name: row.name, gender: row.gender, dob: row.dob, tob: row.tob, pob: row.pob,
      createdAt: row.created_at,
      lagna: row.chart_data && row.chart_data.lagna ? row.chart_data.lagna.signName : null,
      moonSign: row.chart_data && row.chart_data.moonSign ? row.chart_data.moonSign.signName : null,
    }));
    return res.status(200).json({ kundlis });
  } catch (err) {
    console.error('kundli list error:', err);
    return res.status(500).json({ error: 'Could not load your saved charts.' });
  }
}

// ---------------- GET: get one ----------------

async function loadOwnedChart(id, userId){
  const result = await query(`SELECT chart_data FROM kundlis WHERE id = $1 AND user_id = $2`, [id, userId]);
  return result.rows.length ? result.rows[0].chart_data : null;
}

async function handleGet(req, res, userId, id){
  if (!id) return res.status(400).json({ error: 'Missing kundli id.' });
  try {
    const chart = await loadOwnedChart(id, userId);
    if (!chart) return res.status(404).json({ error: 'Chart not found.' });
    return res.status(200).json(chart);
  } catch (err) {
    console.error('kundli get error:', err);
    return res.status(500).json({ error: 'Could not load that chart.' });
  }
}

// ---------------- GET: pdf (Ultimate plan only) ----------------

async function callGrokForReport(chart){
  if (!process.env.GROK_API_KEY) return null;
  const prompt = `Write a professional Vedic astrology report for someone with this real birth chart: `
    + `Lagna (Ascendant) ${chart.lagna.signName}, Moon Sign ${chart.moonSign.signName}, Nakshatra ${chart.nakshatra.name} `
    + `(Pada ${chart.nakshatra.pada}), currently running ${chart.dasha.lord} Mahadasha. `
    + `Respond with ONLY a compact JSON object (no markdown, no code fences) with exactly these string fields: `
    + `{"career": "...", "wealth": "...", "relationships": "...", "health": "...", "yearAhead": "...", "remedies": "..."}. `
    + `Each field should be a well-written paragraph (4-6 sentences), specific to this chart, warm but honest, `
    + `avoiding absolute predictions and specific medical or financial advice. "remedies" should suggest general, `
    + `traditional, non-harmful practices (gemstones, mantras, charitable acts) commonly associated with the chart's `
    + `placements, clearly framed as traditional suggestions rather than guarantees.`;
  try {
    const resp = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROK_API_KEY}` },
      body: JSON.stringify({ model: GROK_MODEL, messages: [{ role: 'user', content: prompt }], temperature: 0.8, max_tokens: 2000 }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) { console.error('PDF report AI error:', resp.status, data); return null; }
    const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!text) return null;
    const cleaned = text.replace(/^```(json)?\s*|\s*```$/g, '').trim();
    const parsed = JSON.parse(cleaned);
    const fields = ['career', 'wealth', 'relationships', 'health', 'yearAhead', 'remedies'];
    return fields.every(f => typeof parsed[f] === 'string' && parsed[f].trim()) ? parsed : null;
  } catch (err) {
    console.error('PDF report AI generation failed:', err);
    return null;
  }
}

const FALLBACK_REPORT_TEXT = {
  career: 'Career insights are being finalized for this report — please regenerate shortly.',
  wealth: 'Financial insights are being finalized for this report — please regenerate shortly.',
  relationships: 'Relationship insights are being finalized for this report — please regenerate shortly.',
  health: 'Health insights are being finalized for this report — please regenerate shortly.',
  yearAhead: 'Your year-ahead overview is being finalized — please regenerate shortly.',
  remedies: 'Personalised remedies are being finalized — please regenerate shortly.',
};

// Standard North Indian diamond chart layout, matching the site's own SVG
// chart exactly (same centroids, same kite/non-kite label offsets).
const HOUSE_CENTROIDS = [
  { x: 200, y: 100, kite: true },  { x: 300, y: 33,  kite: false }, { x: 367, y: 100, kite: false },
  { x: 300, y: 200, kite: true },  { x: 367, y: 300, kite: false }, { x: 300, y: 367, kite: false },
  { x: 200, y: 300, kite: true },  { x: 100, y: 367, kite: false }, { x: 33,  y: 300, kite: false },
  { x: 100, y: 200, kite: true },  { x: 33,  y: 100, kite: false }, { x: 100, y: 33,  kite: false },
];

function drawDiamondChart(doc, houses, originX, originY, size){
  const scale = size / 400;
  const px = (x) => originX + x * scale;
  const py = (y) => originY + y * scale;

  doc.save();
  doc.lineWidth(1).strokeColor('#8a7a5c');
  doc.rect(px(2), py(2), 396 * scale, 396 * scale).stroke();
  doc.moveTo(px(2), py(2)).lineTo(px(398), py(398)).stroke();
  doc.moveTo(px(398), py(2)).lineTo(px(2), py(398)).stroke();
  doc.moveTo(px(200), py(2)).lineTo(px(398), py(200)).lineTo(px(200), py(398)).lineTo(px(2), py(200)).closePath().stroke();

  doc.fontSize(7 * scale * 3).fillColor('#111');
  houses.forEach((h, idx) => {
    const c = HOUSE_CENTROIDS[idx];
    const signY = c.kite ? c.y - 42 : c.y - 26;
    doc.fontSize(11).fillColor('#333').text(String(h.signIdx), px(c.x) - 6, py(signY) - 6, { width: 12, align: 'center' });
    const planetY = c.kite ? c.y - 8 : c.y + 4;
    if (h.planets && h.planets.length) {
      doc.fontSize(8).fillColor('#a6721f').text(h.planets.join(' '), px(c.x) - 30, py(planetY) - 4, { width: 60, align: 'center' });
    }
  });
  doc.restore();
}

async function handlePdf(req, res, userId, id){
  if (!id) return res.status(400).json({ error: 'Missing kundli id.' });

  let userPlan;
  try {
    const userResult = await query('SELECT plan FROM users WHERE id = $1', [userId]);
    userPlan = userResult.rows[0] && userResult.rows[0].plan;
  } catch (err) {
    console.error('PDF plan check failed:', err);
    return res.status(500).json({ error: 'Could not verify your plan. Please try again.' });
  }
  if (userPlan !== 'ultimate') {
    return res.status(403).json({ error: 'The PDF report is an Ultimate plan feature. Upgrade your plan to download it.' });
  }

  let chart;
  try {
    chart = await loadOwnedChart(id, userId);
  } catch (err) {
    console.error('PDF chart load failed:', err);
    return res.status(500).json({ error: 'Could not load that chart.' });
  }
  if (!chart) return res.status(404).json({ error: 'Chart not found.' });

  const report = (await callGrokForReport(chart)) || FALLBACK_REPORT_TEXT;

  let PDFDocument;
  try {
    PDFDocument = require('pdfkit');
  } catch (err) {
    console.error('pdfkit not available:', err);
    return res.status(500).json({ error: 'PDF generation is temporarily unavailable.' });
  }

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${(chart.name || 'VedicAstro-Report').replace(/[^a-z0-9]/gi, '_')}.pdf"`);
  doc.pipe(res);

  const GOLD = '#a6721f';
  const INK = '#222';

  // ---- Page 1: Cover ----
  doc.fontSize(28).fillColor(GOLD).text('VedicAstro', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(16).fillColor(INK).text('Complete Vedic Astrology Report', { align: 'center' });
  doc.moveDown(3);
  doc.fontSize(20).fillColor(INK).text(chart.name || 'Your Kundli', { align: 'center' });
  doc.moveDown(1);
  doc.fontSize(11).fillColor('#555')
    .text(`Date of Birth: ${chart.dob}`, { align: 'center' })
    .text(`Time of Birth: ${chart.tob}`, { align: 'center' })
    .text(`Place of Birth: ${chart.pob}`, { align: 'center' });
  doc.moveDown(4);
  doc.fontSize(9).fillColor('#888').text(`Generated on ${new Date().toLocaleDateString('en-US', { day:'numeric', month:'long', year:'numeric' })}`, { align: 'center' });

  // ---- Page 2: Chart Summary ----
  doc.addPage();
  doc.fontSize(18).fillColor(GOLD).text('Chart Summary');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor(INK);
  doc.text(`Lagna (Ascendant): ${chart.lagna.signName}`);
  doc.text(`Moon Sign: ${chart.moonSign.signName}`);
  doc.text(`Nakshatra: ${chart.nakshatra.name} (Pada ${chart.nakshatra.pada})`);
  doc.text(`Current Mahadasha: ${chart.dasha.lord}`);
  doc.moveDown(1);
  drawDiamondChart(doc, chart.houses, 100, doc.y, 300);
  doc.y += 320;
  doc.fontSize(8).fillColor('#888').text('Numbers mark each house\'s zodiac sign; letters mark planets present.', { align: 'center' });

  // ---- Page 3: Planetary Positions ----
  doc.addPage();
  doc.fontSize(18).fillColor(GOLD).text('Planetary Positions');
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor(INK);
  const colX = [50, 200, 320, 440];
  doc.font('Helvetica-Bold');
  doc.text('Planet', colX[0], doc.y, { continued: false });
  doc.text('Sign', colX[1], doc.y - doc.currentLineHeight());
  doc.text('Degree', colX[2], doc.y - doc.currentLineHeight());
  doc.text('House', colX[3], doc.y - doc.currentLineHeight());
  doc.moveDown(0.5);
  doc.font('Helvetica');
  chart.planets.forEach(p => {
    const rowY = doc.y;
    doc.text(p.key, colX[0], rowY);
    doc.text(p.signName, colX[1], rowY);
    doc.text(`${Math.floor(p.degInSign)}°${Math.round((p.degInSign % 1) * 60)}'`, colX[2], rowY);
    doc.text(String(p.house), colX[3], rowY);
    doc.moveDown(0.6);
  });

  // ---- Page 4: Life Predictions ----
  doc.addPage();
  doc.fontSize(18).fillColor(GOLD).text('Life Predictions');
  doc.moveDown(0.5);
  [['Career & Profession', report.career], ['Wealth & Finance', report.wealth],
   ['Relationships', report.relationships], ['Health & Wellbeing', report.health],
   ['Year Ahead', report.yearAhead]].forEach(([label, text]) => {
    doc.fontSize(13).fillColor(GOLD).text(label);
    doc.fontSize(10).fillColor(INK).text(text, { align: 'justify' });
    doc.moveDown(1);
  });

  // ---- Page 5: Remedies + Disclaimer ----
  doc.addPage();
  doc.fontSize(18).fillColor(GOLD).text('Personalised Remedies');
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor(INK).text(report.remedies, { align: 'justify' });
  doc.moveDown(3);
  doc.fontSize(8).fillColor('#888').text(
    'This report is generated using a mix of real astronomical calculation and AI-generated text, for '
    + 'entertainment and informational purposes only. It is not professional medical, legal, or financial advice.',
    { align: 'center' }
  );

  doc.end();
}

module.exports = async (req, res) => {
  if (req.method === 'POST') return handleGenerate(req, res);

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = getAuth(req);
  if (!userId) return res.status(401).json({ error: 'Not signed in.' });

  const { query: urlQuery } = parse(req.url, true);
  const action = urlQuery.action;

  if (action === 'list') return handleList(req, res, userId);
  if (action === 'get') return handleGet(req, res, userId, urlQuery.id);
  if (action === 'pdf') return handlePdf(req, res, userId, urlQuery.id);
  return res.status(400).json({ error: 'Unknown or missing action parameter.' });
};
