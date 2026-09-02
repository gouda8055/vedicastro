# VedicAstro

A full-stack, AI-powered Vedic astrology platform: real astronomical calculations, real authentication, a real AI assistant grounded in each user's actual birth chart, real classical compatibility matching, and an admin dashboard.

## What's live
- **Real astrology engine** (`lib/astro.js`) — genuine orbital mechanics (Sun/Moon/planets, Lahiri ayanamsa, Nakshatra, Vimshottari Dasha), validated against independent astronomical references, not mock data.
- **Real auth** (`lib/auth.js`, `api/auth/*`) — signup/login/sessions, zero extra dependencies (Node's built-in `crypto` only). Includes admin role support.
- **Real database** (Postgres via `lib/db.js`) — users, saved Kundlis, chat history, compatibility reports.
- **AI Assistant** (`api/assistant/chat.js`) — Grok-powered, automatically grounded in the person's real saved (or just-generated) chart. Limited to 3 questions per Kundli, enforced server-side for signed-in users.
- **AI-generated horoscopes for all 4 periods** (`api/horoscope.js`) — Daily, Weekly, Monthly, and Yearly, each with all 12 signs generated in a single AI call and cached for the whole period (never regenerated per visitor, never more than once per day/week/month/year no matter the traffic).
- **Daily Panchang** (`panchang.html`) — Tithi, Nakshatra, Yoga, Karana, sunrise/sunset, and the Rahu Kaal/Gulika Kaal/Yamaganda Kaal/Abhijit Muhurat windows, all computed with real astronomy (same engine as Kundli) — only the short daily overview text is AI-written. Cached once per day.
- **Ultimate PDF report** (`api/kundli.js`, `?action=pdf`) — a 5-page professional PDF (cover, chart summary with a drawn diamond chart, planetary positions, AI-written life predictions, personalised remedies), gated to Ultimate-plan accounts and verified server-side against the database. Generated with `pdfkit` (added to `package.json` as a normal dependency — Vercel installs it at deploy time).
- **Privacy Policy & Terms of Service** (`privacy.html`, `terms.html`) — tailored to this app's actual data practices, not generic boilerplate. Still needs a real lawyer's review and your contact details filled in before you rely on them commercially — see the notice at the top of each page.
- **AI-assisted geocoding** (`lib/geo.js`) — a fast hardcoded table for common cities, falling back to AI for anything it doesn't recognize (states, small towns, misspellings).
- **Kundli history** (`my-kundlis.html`) — signed-in users can revisit any chart they've generated.
- **Real Compatibility Matching** (`lib/matching.js`) — the traditional Ashtakoot Milan system (8 classical factors, 36 points), computed from both people's real charts. Limited to 1 free check per signed-in user, enforced server-side.
- **Admin dashboard** (`admin.html`) — stats overview plus tables of all users, Kundlis, and compatibility reports. Gated by a database-verified `is_admin` flag on every request — see Setup below for how to grant it. All 4 admin views are served from one consolidated `api/admin.js` (see the function-count note below).
- **Password reset** (`forgot-password.html`, `reset-password.html`) — real emailed reset links via Resend, hashed single-use tokens, 1-hour expiry.

## Pages
- `index.html` — landing page
- `kundli.html` — generate a chart, or view a saved one via `?id=<uuid>`
- `my-kundlis.html` — history of saved charts (signed in only)
- `assistant.html` — AI chat, grounded in your chart
- `horoscope.html` — daily (AI-generated)/weekly/monthly/yearly by sign
- `matching.html` — real Ashtakoot compatibility matching
- `pricing.html` — Free / Premium / Ultimate plans
- `signin.html` — sign in / create account
- `admin.html` — internal dashboard (admin accounts only; not linked in public nav)

## Structure
```
vedicastro/
├── api/
│   ├── auth/          signup, login, session check
│   ├── kundli/         generate, list, get (history)
│   ├── assistant/        chat (Grok, chart-grounded)
│   ├── horoscope/          daily (Grok, all 12 signs, cached per day)
│   ├── matching/            generate (real Ashtakoot Milan)
│   └── admin/                 stats, users, kundlis, matching (all require is_admin)
├── lib/
│   ├── astro.js        real astronomical calculations
│   ├── geo.js            birth-place lookup (table + AI fallback)
│   ├── matching.js         Ashtakoot Milan compatibility engine
│   ├── auth.js               password hashing + session tokens
│   ├── adminAuth.js             shared admin authorization check
│   └── db.js                      Postgres connection pool
├── db/schema.sql        run this against your database
├── css/, js/               frontend
└── *.html                  pages
```

## Setup
1. `cp .env.example .env` and fill in:
   - `DATABASE_URL` — any Postgres connection string (Supabase, Neon, etc.)
   - `AUTH_SECRET` — random string: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
   - `GROK_API_KEY` — from console.x.ai → API Keys
2. Run `db/schema.sql` against your database (SQL editor, or `psql`).
3. To access the admin dashboard, manually promote your account after signing up:
   ```sql
   UPDATE users SET is_admin = true WHERE email = 'your-email@example.com';
   ```
   There's intentionally no self-service way to become admin.
4. Deploy to Vercel (connects automatically via `vercel.json`, zero build config needed) or run locally with `npx serve .` for the frontend + a local Node server for `/api`.

## Known gaps / next steps
- **Payments** — pricing tiers exist on the page (Free / Premium ₹49 / Ultimate ₹200) but nothing enforces them yet (Stripe not integrated). There's no way to actually become Premium/Ultimate except manually via SQL: `UPDATE users SET plan = 'ultimate' WHERE email = '...';`
- Compatibility Matching's Varna/Vashya/Yoni sub-scores use documented simplified versions of the classical rules (see comments in `lib/matching.js`) — the highest-weight factors (Nadi, Gana, Bhakoot, Graha Maitri, Tara) follow the precise classical tables.
- `admin.html` isn't linked in the public nav on other pages (intentional extra obscurity layer) — navigate to it directly once signed in as an admin.
- **Password reset emails currently send from Resend's shared `onboarding@resend.dev` address**, which only reliably delivers to the email you signed up to Resend with. Verify your own domain in Resend and set `EMAIL_FROM` to actually email real users.
- **Panchang uses New Delhi as a fixed reference location** — not personalized per visitor's actual location. Sunrise/sunset use a single-pass approximation (accurate to within a few minutes), and the weekday→segment mapping for Rahu Kaal etc. follows the commonly published table.
- **The PDF report's `pdfkit` dependency was added to `package.json` but never installed/tested in this sandbox** — external package registries (npm, GitHub raw content, GitHub codeload) were all blocked in this environment. The generation *logic* was thoroughly tested using a realistic fake stub (same approach used for `pg` throughout this project), but the actual PDF byte output has only been verified once this deploys to Vercel, where `npm install` runs for real. If the first real PDF download looks wrong, that's the first place to check.
- **Vercel Hobby plan caps a deployment at 12 serverless functions — this project is currently at 10**, with headroom for Payments.
