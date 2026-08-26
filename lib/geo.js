// ==========================================================================
// VedicAstro — birth-place lookup
//
// HONESTY NOTE: there's no real geocoding API wired up (that needs a paid
// key we don't have). This is a hand-picked table of major cities as a
// practical stand-in. It resolves common Indian and global cities correctly;
// anything not in the table falls back to New Delhi's coordinates with
// `resolved: false` so callers can tell the user the location was a guess.
// Swap this for a real geocoding + timezone API (Google, OpenCage, etc.)
// when you're ready to support arbitrary birth places precisely.
//
// UTC offsets here are STANDARD TIME only — daylight saving time is not
// accounted for. For historical birth dates in DST-observing countries this
// can introduce up to a 1-hour error in the exact chart. Good enough for
// sign/Nakshatra-level astrology; not perfectly precise to the minute.
// ==========================================================================

const CITIES = {
  // India (all UTC+5.5)
  'mumbai':      { lat: 19.0760, lon: 72.8777, utcOffset: 5.5 },
  'delhi':       { lat: 28.6139, lon: 77.2090, utcOffset: 5.5 },
  'new delhi':   { lat: 28.6139, lon: 77.2090, utcOffset: 5.5 },
  'bangalore':   { lat: 12.9716, lon: 77.5946, utcOffset: 5.5 },
  'bengaluru':   { lat: 12.9716, lon: 77.5946, utcOffset: 5.5 },
  'chennai':     { lat: 13.0827, lon: 80.2707, utcOffset: 5.5 },
  'kolkata':     { lat: 22.5726, lon: 88.3639, utcOffset: 5.5 },
  'hyderabad':   { lat: 17.3850, lon: 78.4867, utcOffset: 5.5 },
  'pune':        { lat: 18.5204, lon: 73.8567, utcOffset: 5.5 },
  'ahmedabad':   { lat: 23.0225, lon: 72.5714, utcOffset: 5.5 },
  'jaipur':      { lat: 26.9124, lon: 75.7873, utcOffset: 5.5 },
  'lucknow':     { lat: 26.8467, lon: 80.9462, utcOffset: 5.5 },
  'kanpur':      { lat: 26.4499, lon: 80.3319, utcOffset: 5.5 },
  'nagpur':      { lat: 21.1458, lon: 79.0882, utcOffset: 5.5 },
  'indore':      { lat: 22.7196, lon: 75.8577, utcOffset: 5.5 },
  'bhopal':      { lat: 23.2599, lon: 77.4126, utcOffset: 5.5 },
  'patna':       { lat: 25.5941, lon: 85.1376, utcOffset: 5.5 },
  'surat':       { lat: 21.1702, lon: 72.8311, utcOffset: 5.5 },
  'vadodara':    { lat: 22.3072, lon: 73.1812, utcOffset: 5.5 },
  'coimbatore':  { lat: 11.0168, lon: 76.9558, utcOffset: 5.5 },
  'kochi':       { lat: 9.9312,  lon: 76.2673, utcOffset: 5.5 },
  'cochin':      { lat: 9.9312,  lon: 76.2673, utcOffset: 5.5 },
  'chandigarh':  { lat: 30.7333, lon: 76.7794, utcOffset: 5.5 },
  'amritsar':    { lat: 31.6340, lon: 74.8723, utcOffset: 5.5 },
  'varanasi':    { lat: 25.3176, lon: 82.9739, utcOffset: 5.5 },
  'agra':        { lat: 27.1767, lon: 78.0081, utcOffset: 5.5 },
  'thiruvananthapuram': { lat: 8.5241, lon: 76.9366, utcOffset: 5.5 },
  'trivandrum':  { lat: 8.5241, lon: 76.9366, utcOffset: 5.5 },
  'mysore':      { lat: 12.2958, lon: 76.6394, utcOffset: 5.5 },
  'mysuru':      { lat: 12.2958, lon: 76.6394, utcOffset: 5.5 },
  'mangalore':   { lat: 12.9141, lon: 74.8560, utcOffset: 5.5 },
  'nashik':      { lat: 19.9975, lon: 73.7898, utcOffset: 5.5 },
  'rajkot':      { lat: 22.3039, lon: 70.8022, utcOffset: 5.5 },
  'ludhiana':    { lat: 30.9010, lon: 75.8573, utcOffset: 5.5 },
  'jodhpur':     { lat: 26.2389, lon: 73.0243, utcOffset: 5.5 },
  'ranchi':      { lat: 23.3441, lon: 85.3096, utcOffset: 5.5 },
  'guwahati':    { lat: 26.1445, lon: 91.7362, utcOffset: 5.5 },
  'bhubaneswar': { lat: 20.2961, lon: 85.8245, utcOffset: 5.5 },
  'raipur':      { lat: 21.2514, lon: 81.6296, utcOffset: 5.5 },
  'dehradun':    { lat: 30.3165, lon: 78.0322, utcOffset: 5.5 },
  'shimla':      { lat: 31.1048, lon: 77.1734, utcOffset: 5.5 },
  'srinagar':    { lat: 34.0837, lon: 74.7973, utcOffset: 5.5 },
  'vijayawada':  { lat: 16.5062, lon: 80.6480, utcOffset: 5.5 },
  'visakhapatnam': { lat: 17.6868, lon: 83.2185, utcOffset: 5.5 },
  'madurai':     { lat: 9.9252,  lon: 78.1198, utcOffset: 5.5 },
  'jamshedpur':  { lat: 22.8046, lon: 86.2029, utcOffset: 5.5 },
  'noida':       { lat: 28.5355, lon: 77.3910, utcOffset: 5.5 },
  'gurgaon':     { lat: 28.4595, lon: 77.0266, utcOffset: 5.5 },
  'gurugram':    { lat: 28.4595, lon: 77.0266, utcOffset: 5.5 },
  'faridabad':   { lat: 28.4089, lon: 77.3178, utcOffset: 5.5 },

  // Global
  'new york':      { lat: 40.7128, lon: -74.0060, utcOffset: -5 },
  'los angeles':   { lat: 34.0522, lon: -118.2437, utcOffset: -8 },
  'chicago':       { lat: 41.8781, lon: -87.6298, utcOffset: -6 },
  'houston':       { lat: 29.7604, lon: -95.3698, utcOffset: -6 },
  'san francisco': { lat: 37.7749, lon: -122.4194, utcOffset: -8 },
  'washington':    { lat: 38.9072, lon: -77.0369, utcOffset: -5 },
  'boston':        { lat: 42.3601, lon: -71.0589, utcOffset: -5 },
  'seattle':       { lat: 47.6062, lon: -122.3321, utcOffset: -8 },
  'toronto':       { lat: 43.6532, lon: -79.3832, utcOffset: -5 },
  'london':        { lat: 51.5074, lon: -0.1278, utcOffset: 0 },
  'paris':         { lat: 48.8566, lon: 2.3522, utcOffset: 1 },
  'berlin':        { lat: 52.5200, lon: 13.4050, utcOffset: 1 },
  'moscow':        { lat: 55.7558, lon: 37.6173, utcOffset: 3 },
  'dubai':         { lat: 25.2048, lon: 55.2708, utcOffset: 4 },
  'riyadh':        { lat: 24.7136, lon: 46.6753, utcOffset: 3 },
  'doha':          { lat: 25.2854, lon: 51.5310, utcOffset: 3 },
  'singapore':     { lat: 1.3521, lon: 103.8198, utcOffset: 8 },
  'tokyo':         { lat: 35.6762, lon: 139.6503, utcOffset: 9 },
  'beijing':       { lat: 39.9042, lon: 116.4074, utcOffset: 8 },
  'hong kong':     { lat: 22.3193, lon: 114.1694, utcOffset: 8 },
  'sydney':        { lat: -33.8688, lon: 151.2093, utcOffset: 10 },
  'melbourne':     { lat: -37.8136, lon: 144.9631, utcOffset: 10 },
  'auckland':      { lat: -36.8485, lon: 174.7633, utcOffset: 12 },
  'karachi':       { lat: 24.8607, lon: 67.0011, utcOffset: 5 },
  'lahore':        { lat: 31.5497, lon: 74.3436, utcOffset: 5 },
  'dhaka':         { lat: 23.8103, lon: 90.4125, utcOffset: 6 },
  'colombo':       { lat: 6.9271, lon: 79.8612, utcOffset: 5.5 },
  'kathmandu':     { lat: 27.7172, lon: 85.3240, utcOffset: 5.75 },
};

const DEFAULT_LOCATION = { lat: 28.6139, lon: 77.2090, utcOffset: 5.5 }; // New Delhi

function resolvePlace(placeText) {
  const normalized = String(placeText || '').toLowerCase().trim();
  // try the part before the first comma first (e.g. "Bangalore, India" -> "bangalore"),
  // then fall back to checking if any known city name appears anywhere in the string.
  const firstPart = normalized.split(',')[0].trim();
  if (CITIES[firstPart]) return { ...CITIES[firstPart], resolved: true, matchedCity: firstPart };

  for (const city of Object.keys(CITIES)) {
    if (normalized.includes(city)) return { ...CITIES[city], resolved: true, matchedCity: city };
  }

  return { ...DEFAULT_LOCATION, resolved: false, matchedCity: null };
}

// ---------------------------------------------------------------------------
// AI-powered fallback geocoding, used only when the fast hardcoded table above
// doesn't recognise the place (e.g. a state, a small town, a misspelling).
// Uses the same Grok API already wired up for the AI Assistant. Returns null
// on any failure (missing key, network error, malformed/out-of-range response)
// so the caller can safely fall back to the default location — this must
// never be the reason a chart fails to generate.
// ---------------------------------------------------------------------------
const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
const GEOCODE_SYSTEM_PROMPT =
  'You are a precise geocoding assistant. Given a place description, respond with ONLY a compact ' +
  'JSON object (no markdown, no explanation, no code fences) with exactly these fields: ' +
  '{"latitude": <decimal degrees, north positive>, "longitude": <decimal degrees, east positive>, ' +
  '"utcOffset": <standard time UTC offset in decimal hours, NOT accounting for daylight saving>, ' +
  '"resolvedName": "<best-guess actual place name>"}. If the input is a state, region or country ' +
  'rather than a specific city, pick its capital or largest city as a reasonable representative point.';

function parseGeocodeResponse(text){
  if (!text) return null;
  const cleaned = text.replace(/^```(json)?\s*|\s*```$/g, '').trim();
  let parsed;
  try { parsed = JSON.parse(cleaned); } catch { return null; }

  const { latitude, longitude, utcOffset, resolvedName } = parsed || {};
  const inRange = typeof latitude === 'number' && latitude >= -90 && latitude <= 90
    && typeof longitude === 'number' && longitude >= -180 && longitude <= 180
    && typeof utcOffset === 'number' && utcOffset >= -12 && utcOffset <= 14;
  if (!inRange) return null;

  return { lat: latitude, lon: longitude, utcOffset, resolved: true, matchedCity: resolvedName || null, source: 'ai' };
}

async function resolvePlaceWithAI(placeText){
  if (!process.env.GROK_API_KEY || !placeText || !String(placeText).trim()) return null;
  try {
    const resp = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROK_API_KEY}` },
      body: JSON.stringify({
        model: process.env.GROK_MODEL || 'grok-4-1-fast',
        messages: [
          { role: 'system', content: GEOCODE_SYSTEM_PROMPT },
          { role: 'user', content: String(placeText).trim() },
        ],
        temperature: 0,
        max_tokens: 150,
      }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error('AI geocoding: upstream error', resp.status, data);
      return null;
    }
    const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    return parseGeocodeResponse(text);
  } catch (err) {
    console.error('AI geocoding error (non-fatal):', err);
    return null;
  }
}

module.exports = { resolvePlace, resolvePlaceWithAI, CITIES, DEFAULT_LOCATION };
