// ==========================================================================
// VedicAstro — real astronomical calculation engine
//
// This replaces the seeded-random mock chart generator with genuine celestial
// mechanics: Sun and Moon positions from standard low-precision solar/lunar
// theory, Mercury/Venus/Mars/Jupiter/Saturn from Keplerian orbital elements
// (the well-known method popularised by Paul Schlyter's "How to compute
// planetary positions"), the Moon's mean node for Rahu/Ketu, and the Lahiri
// ayanamsa to convert tropical (Western) longitudes to sidereal (Vedic) ones.
//
// HONESTY NOTE ON PRECISION: these are legitimate astronomical formulas, not
// random data — planetary sign and Nakshatra placements should be correct in
// the vast majority of cases. But they are the "low precision" tier of
// astronomical formulas (accurate to roughly arc-minutes to a degree over
// the modern era), not observatory-grade. The Ascendant calculation in
// particular is the hardest piece to self-verify without a reference
// ephemeris — if you need arc-second precision or are shipping this for
// paying customers, spot-check a few known charts against a tool like
// astro.com before fully trusting it, or swap this module for a real
// ephemeris library (e.g. Swiss Ephemeris) later.
// ==========================================================================

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

function norm360(deg) {
  let d = deg % 360;
  if (d < 0) d += 360;
  return d;
}
function sinD(d) { return Math.sin(d * DEG); }
function cosD(d) { return Math.cos(d * DEG); }
function tanD(d) { return Math.tan(d * DEG); }
function atan2D(y, x) { return norm360(Math.atan2(y, x) * RAD); }

// ---- Julian Day (Meeus' standard algorithm, Gregorian calendar) ----
function toJulianDay(year, month, day, hoursUT) {
  let y = year, m = month;
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + B - 1524.5 + hoursUT / 24;
}

function julianCenturies(jd) {
  return (jd - 2451545.0) / 36525;
}

// ---- Sun: geocentric apparent ecliptic longitude (degrees) ----
// Standard low-precision solar formula (Astronomical Almanac / Meeus ch.25 simplified).
function sunPosition(T) {
  const L0 = norm360(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
  const M = norm360(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
  const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * sinD(M)
          + (0.019993 - 0.000101 * T) * sinD(2 * M)
          + 0.000289 * sinD(3 * M);
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const apparentLong = norm360(trueLong - 0.00569 - 0.00478 * sinD(omega));
  // Sun's distance in AU (needed later to convert planet heliocentric -> geocentric)
  const v = M + C; // true anomaly
  const r = (1.000001018 * (1 - e * e)) / (1 + e * cosD(v));
  return { longitude: apparentLong, distanceAU: r, meanAnomaly: M };
}

// ---- Moon: geocentric ecliptic longitude (degrees) ----
// Truncated ELP2000/Chapront series (Meeus ch.47, main terms only — good to
// roughly a few arc-minutes, well within what's needed for sign/Nakshatra).
function moonLongitude(T) {
  const Lp = norm360(218.3164477 + 481267.88123421 * T - 0.0015786 * T * T + T ** 3 / 538841 - T ** 4 / 65194000);
  const D  = norm360(297.8501921 + 445267.1114034 * T - 0.0018819 * T * T + T ** 3 / 545868 - T ** 4 / 113065000);
  const M  = norm360(357.5291092 + 35999.0502909 * T - 0.0001536 * T * T + T ** 3 / 24490000);
  const Mp = norm360(134.9633964 + 477198.8675055 * T + 0.0087414 * T * T + T ** 3 / 69699 - T ** 4 / 14712000);
  const F  = norm360(93.2720950 + 483202.0175233 * T - 0.0036539 * T * T - T ** 3 / 3526000 + T ** 4 / 863310000);

  const dL =
      6.288774 * sinD(Mp)
    + 1.274027 * sinD(2 * D - Mp)
    + 0.658314 * sinD(2 * D)
    + 0.213618 * sinD(2 * Mp)
    - 0.185116 * sinD(M)
    - 0.114332 * sinD(2 * F)
    + 0.058793 * sinD(2 * D - 2 * Mp)
    + 0.057066 * sinD(2 * D - M - Mp)
    + 0.053322 * sinD(2 * D + Mp)
    + 0.045758 * sinD(2 * D - M)
    - 0.040923 * sinD(M - Mp)
    - 0.034720 * sinD(D)
    - 0.030383 * sinD(M + Mp)
    + 0.015327 * sinD(2 * D - 2 * F)
    - 0.012528 * sinD(Mp + 2 * F)
    + 0.010980 * sinD(Mp - 2 * F)
    + 0.010675 * sinD(4 * D - Mp)
    + 0.010034 * sinD(3 * Mp)
    + 0.008548 * sinD(4 * D - 2 * Mp)
    - 0.007888 * sinD(2 * D + M - Mp)
    - 0.006766 * sinD(2 * D + M);

  return norm360(Lp + dL);
}

// ---- Mercury/Venus/Mars/Jupiter/Saturn ----
// Keplerian elements at epoch J2000.0 with per-day rates (Paul Schlyter's
// well-known simplified planetary theory). Valid for roughly 1900-2100.
const PLANET_ELEMENTS = {
  Mercury: { N: [48.3313, 3.24587e-5], i: [7.0047, 5.00e-8], w: [29.1241, 1.01444e-5], a: 0.387098, e: [0.205635, 5.59e-10], M: [168.6562, 4.0923344368] },
  Venus:   { N: [76.6799, 2.46590e-5], i: [3.3946, 2.75e-8], w: [54.8910, 1.38374e-5], a: 0.723330, e: [0.006773, -1.302e-9], M: [48.0052, 1.6021302244] },
  Mars:    { N: [49.5574, 2.11081e-5], i: [1.8497, -1.78e-8], w: [286.5016, 2.92961e-5], a: 1.523688, e: [0.093405, 2.516e-9], M: [18.6021, 0.5240207766] },
  Jupiter: { N: [100.4542, 2.76854e-5], i: [1.3030, -1.557e-7], w: [273.8777, 1.64505e-5], a: 5.20256, e: [0.048498, 4.469e-9], M: [19.8950, 0.0830853001] },
  Saturn:  { N: [113.6634, 2.38980e-5], i: [2.4886, -1.081e-7], w: [339.3939, 2.97661e-5], a: 9.55475, e: [0.055546, -9.499e-9], M: [316.9670, 0.0334442282] },
};

function solveKepler(Mdeg, e) {
  // Solve Kepler's equation E - e*sin(E) = M for eccentric anomaly E (degrees).
  let E = Mdeg + (e * RAD) * sinD(Mdeg) * (1 + e * cosD(Mdeg));
  for (let i = 0; i < 6; i++) {
    const dM = Mdeg - (E - (e * RAD) * sinD(E));
    const dE = dM / (1 - e * cosD(E));
    E += dE;
  }
  return E;
}

function planetHeliocentricLongitude(name, d) {
  const el = PLANET_ELEMENTS[name];
  const N = norm360(el.N[0] + el.N[1] * d);
  const i = el.i[0] + el.i[1] * d;
  const w = norm360(el.w[0] + el.w[1] * d);
  const a = el.a;
  const e = el.e[0] + el.e[1] * d;
  const M = norm360(el.M[0] + el.M[1] * d);
  const E = solveKepler(M, e);
  const xv = a * (cosD(E) - e);
  const yv = a * (Math.sqrt(1 - e * e) * sinD(E));
  const v = atan2D(yv, xv);
  const r = Math.sqrt(xv * xv + yv * yv);
  const vw = v + w;
  const xh = r * (cosD(N) * cosD(vw) - sinD(N) * sinD(vw) * cosD(i));
  const yh = r * (sinD(N) * cosD(vw) + cosD(N) * sinD(vw) * cosD(i));
  return atan2D(yh, xh);
}

function planetGeocentricLongitude(name, d, sun) {
  const el = PLANET_ELEMENTS[name];
  const N = norm360(el.N[0] + el.N[1] * d);
  const i = el.i[0] + el.i[1] * d;
  const w = norm360(el.w[0] + el.w[1] * d);
  const a = el.a;
  const e = el.e[0] + el.e[1] * d;
  const M = norm360(el.M[0] + el.M[1] * d);

  const E = solveKepler(M, e);
  const xv = a * (cosD(E) - e);
  const yv = a * (Math.sqrt(1 - e * e) * sinD(E));
  const v = atan2D(yv, xv);
  const r = Math.sqrt(xv * xv + yv * yv);

  // heliocentric ecliptic coordinates
  const vw = v + w;
  const xh = r * (cosD(N) * cosD(vw) - sinD(N) * sinD(vw) * cosD(i));
  const yh = r * (sinD(N) * cosD(vw) + cosD(N) * sinD(vw) * cosD(i));

  // Sun's geocentric position -> Earth's heliocentric position is its negative;
  // geocentric planet = heliocentric planet + Sun's geocentric (x,y)
  const xs = sun.distanceAU * cosD(sun.longitude);
  const ys = sun.distanceAU * sinD(sun.longitude);

  const xg = xh + xs;
  const yg = yh + ys;

  return atan2D(yg, xg);
}

// ---- Mean lunar node (Rahu) ----
function meanLunarNode(T) {
  return norm360(125.04452 - 1934.136261 * T + 0.0020708 * T * T + (T ** 3) / 450000);
}

// ---- Lahiri ayanamsa (linear approximation, matches published values well for 1900-2050) ----
function lahiriAyanamsa(decimalYear) {
  return 22.4622 + 0.0139552 * (decimalYear - 1900);
}

// ---- Obliquity of the ecliptic ----
function obliquity(T) {
  return 23.439291 - 0.0130042 * T;
}

// ---- Greenwich Mean Sidereal Time (degrees) ----
function gmst(jd) {
  const T = julianCenturies(jd);
  return norm360(280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - (T ** 3) / 38710000);
}

// ---- Ascendant (tropical ecliptic longitude of the rising point) ----
function ascendant(jd, latitude, longitudeEast) {
  const T = julianCenturies(jd);
  const lst = norm360(gmst(jd) + longitudeEast); // Local Sidereal Time, i.e. RAMC in degrees
  const eps = obliquity(T);
  const y = cosD(lst);
  const x = -(sinD(lst) * cosD(eps) + tanD(latitude) * sinD(eps));
  return atan2D(y, x);
}

const SIGN_NAMES = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const NAKSHATRA_NAMES = ['Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra','Punarvasu','Pushya','Ashlesha',
  'Magha','Purva Phalguni','Uttara Phalguni','Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha',
  'Mula','Purva Ashadha','Uttara Ashadha','Shravana','Dhanishta','Shatabhisha','Purva Bhadrapada','Uttara Bhadrapada','Revati'];

function signIndex(siderealLon) { return Math.floor(norm360(siderealLon) / 30) + 1; } // 1-12
function nakshatraOf(siderealLon) {
  const span = 360 / 27;
  const lon = norm360(siderealLon);
  const idx = Math.floor(lon / span);
  const pada = Math.floor((lon % span) / (span / 4)) + 1;
  return { name: NAKSHATRA_NAMES[idx], index: idx + 1, pada };
}

/**
 * Compute a full sidereal (Vedic) chart.
 * @param {object} p
 * @param {number} p.year, p.month, p.day  — birth date (calendar, local)
 * @param {number} p.hour, p.minute        — birth time (local, 24h)
 * @param {number} p.utcOffsetHours        — e.g. India = 5.5
 * @param {number} p.latitude              — degrees, north positive
 * @param {number} p.longitude             — degrees, east positive
 */
function computeSiderealChart({ year, month, day, hour, minute, utcOffsetHours, latitude, longitude }) {
  const localHours = hour + minute / 60;
  const utHours = localHours - utcOffsetHours;
  const jd = toJulianDay(year, month, day, utHours);
  const T = julianCenturies(jd);
  const d = jd - 2451545.0; // days from J2000, used by the planetary element rates

  const sun = sunPosition(T);
  const moonLon = moonLongitude(T);
  const rahuLon = meanLunarNode(T);
  const ketuLon = norm360(rahuLon + 180);
  const ascLon = ascendant(jd, latitude, longitude);

  const decimalYear = year + (month - 1) / 12 + day / 365.25;
  const ayanamsa = lahiriAyanamsa(decimalYear);

  const tropical = {
    Su: sun.longitude,
    Mo: moonLon,
    Ma: planetGeocentricLongitude('Mars', d, sun),
    Me: planetGeocentricLongitude('Mercury', d, sun),
    Ju: planetGeocentricLongitude('Jupiter', d, sun),
    Ve: planetGeocentricLongitude('Venus', d, sun),
    Sa: planetGeocentricLongitude('Saturn', d, sun),
    Ra: rahuLon,
    Ke: ketuLon,
  };

  const sidereal = {};
  for (const key of Object.keys(tropical)) {
    sidereal[key] = norm360(tropical[key] - ayanamsa);
  }
  const ascSidereal = norm360(ascLon - ayanamsa);

  const lagnaSignIdx = signIndex(ascSidereal);
  const planets = Object.entries(sidereal).map(([key, lon]) => {
    const signIdx = signIndex(lon);
    const degInSign = norm360(lon) % 30;
    const house = ((signIdx - lagnaSignIdx + 12) % 12) + 1;
    return { key, longitude: lon, signIdx, signName: SIGN_NAMES[signIdx - 1], degInSign, house };
  });

  const moonEntry = planets.find(p => p.key === 'Mo');
  const nakshatra = nakshatraOf(moonEntry.longitude);

  const houses = Array.from({ length: 12 }, (_, idx) => {
    const houseNum = idx + 1;
    const signIdx = ((lagnaSignIdx - 1 + idx) % 12) + 1;
    const there = planets.filter(p => p.house === houseNum).map(p => p.key);
    return { num: houseNum, signIdx, signName: SIGN_NAMES[signIdx - 1], planets: there };
  });

  return {
    julianDay: jd,
    ayanamsa,
    lagna: { signIdx: lagnaSignIdx, signName: SIGN_NAMES[lagnaSignIdx - 1], longitude: ascSidereal },
    moonSign: { signIdx: moonEntry.signIdx, signName: moonEntry.signName },
    nakshatra,
    planets,
    houses,
  };
}

// ---- Vimshottari Dasha ----
// Standard 120-year cycle. Each of the 27 Nakshatras is ruled by one of 9
// grahas in a fixed repeating order; the Moon's exact position within its
// birth Nakshatra determines how much of that first Dasha was already
// "used up" before birth.
const DASHA_ORDER = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];
const DASHA_YEARS = { Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17 };
const DAYS_PER_YEAR = 365.2425;

function vimshottariDasha(moonSiderealLon, birthDate) {
  const span = 360 / 27;
  const lon = norm360(moonSiderealLon);
  const nakIdx = Math.floor(lon / span); // 0-26
  const fractionElapsed = (lon % span) / span; // how far through this nakshatra the Moon already is

  const startLordIdx = nakIdx % 9;
  const firstDashaLord = DASHA_ORDER[startLordIdx];
  const firstDashaRemainingYears = DASHA_YEARS[firstDashaLord] * (1 - fractionElapsed);

  // Walk the sequence of Dasha periods forward from birth until we pass "today".
  const periods = [];
  let cursor = new Date(birthDate);
  let lordIdx = startLordIdx;
  let years = firstDashaRemainingYears;
  const today = new Date();
  // safety cap: 120 years of periods is one full cycle, plenty to reach "today"
  for (let i = 0; i < 20; i++) {
    const start = new Date(cursor);
    const end = new Date(cursor.getTime() + years * DAYS_PER_YEAR * 86400000);
    periods.push({ lord: DASHA_ORDER[lordIdx % 9], start, end });
    if (end > today) break;
    cursor = end;
    lordIdx += 1;
    years = DASHA_YEARS[DASHA_ORDER[lordIdx % 9]];
  }

  const current = periods.find(p => today >= p.start && today < p.end) || periods[periods.length - 1];
  return { current, allUpcoming: periods };
}

module.exports = {
  toJulianDay, julianCenturies, sunPosition, moonLongitude,
  planetGeocentricLongitude, planetHeliocentricLongitude, meanLunarNode, lahiriAyanamsa, obliquity, gmst, ascendant,
  signIndex, nakshatraOf, computeSiderealChart, vimshottariDasha,
  SIGN_NAMES, NAKSHATRA_NAMES, DASHA_ORDER, DASHA_YEARS,
};
