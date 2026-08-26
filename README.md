# VedicAstro — Frontend (Phase 1)

A premium, cosmic-themed frontend for an AI-powered Vedic astrology platform. Pure HTML/CSS/JS — no build step, ready to deploy to Vercel as a static site.

## Pages
- `index.html` — landing page (hero, features, stats, how-it-works, learn, CTA)
- `kundli.html` — birth-details form → generated Kundli (North Indian diamond chart, planetary positions, dasha, AI insights)
- `assistant.html` — AI astrology chat assistant
- `horoscope.html` — daily/weekly/monthly/yearly horoscope by sign
- `matching.html` — two-chart compatibility matching with a score gauge
- `pricing.html` — Free / Premium / Ultimate plans

## Structure
```
vedicastro/
├── index.html
├── kundli.html
├── assistant.html
├── horoscope.html
├── matching.html
├── pricing.html
├── vercel.json
├── css/
│   ├── base.css      -- design tokens, nav, footer, buttons, shared components
│   └── pages.css      -- per-page layout & styling
└── js/
    ├── data.js         -- mock astrology "engine" + horoscope/compatibility data
    ├── chart.js         -- North Indian diamond chart SVG renderer
    ├── app.js            -- shared behaviour: nav, starfield, reveals, zodiac ring
    ├── kundli.js          -- kundli form + result rendering
    ├── assistant.js        -- chat UI + mock answer generator
    ├── horoscope.js         -- sign picker + horoscope rendering
    └── matching.js           -- compatibility form + result rendering
```

## Run locally
No build step needed. From this folder:
```bash
npx serve .
# or
python3 -m http.server 8080
```

## Deploy to Vercel
```bash
npx vercel --prod
```
Or connect the repo/folder in the Vercel dashboard — framework preset "Other", no build command, output directory `/`.

## About the mock data (`js/data.js`)
Real ephemeris calculation isn't wired up yet. `generateKundli()`, `getHoroscope()` and `computeCompatibility()` are **deterministic, seeded from the user's own input** — the same birth details always render the same chart, so the UI feels real while you build out the backend. Each function is written to be a drop-in replacement target:

- `generateKundli({name, gender, dob, tob, pob})` → replace with a call to your astrology API (Lagna, Rashi, Nakshatra, planets, houses, Dasha).
- `getHoroscope(sign, period)` → replace with your daily-horoscope content source.
- `computeCompatibility(person1, person2)` → replace with your real Kundli-matching / Ashtakoot logic.

The rendering code (`kundli.js`, `chart.js`, `horoscope.js`, `matching.js`) consumes these functions by shape, so swapping the implementation shouldn't require touching the HTML/CSS.

## Next phases (per the product plan)
1. Backend + database (users, saved charts, auth)
2. Real astrology/ephemeris API (Lagna, Rashi, Nakshatra, planets, houses, Dashas)
3. AI layer for chart explanations & chat (replace `craftAnswer()` in `assistant.js`)
4. Payments for Premium / Ultimate plans
