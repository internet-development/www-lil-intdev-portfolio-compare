# LIL-INTDEV Agent Guidelines

Agent-facing reference for **www-lil-intdev-portfolio-compare** — a small web app that accepts `?equity=TSMC,AAPL,MSFT&benchmark=gold|eth|usd` and displays comparable equity-vs-benchmark performance over time.

**Repo purpose:** Compare equity portfolio performance against commodity and crypto benchmarks (gold, ETH, USD cash). All state lives in the URL — no accounts, no sessions. See [`README.md`](./README.md) for the public-facing overview.

---

## v1 Contract at a Glance

> **Read this first.** These four rules define v1. Do not violate them.

| Rule | What it means |
| --- | --- |
| **Auth-free** | No login, no API key prompt, no auth wall for the end user. Server-side keys are invisible. |
| **Equal-weight only** | Every equity in `equity=` gets weight 1/N. There is no custom-weight syntax in v1. |
| **`:` is reserved** | A colon inside a ticker token (e.g. `AAPL:0.5`) must be **rejected** with a clear v2-reserved message. Never silently accept it. |
| **`=` is reserved** | Same treatment as `:`. |

The full, testable query contract lives in [`SCENARIOS.md`](./SCENARIOS.md) — sections 1–13 for the parser, A1–A24 for end-to-end behavior. **That file is the single source of truth.** When in doubt, defer to SCENARIOS.md.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────┐
│  Browser                                        │
│  /?equity=AAPL,MSFT&benchmark=gold&range=1y     │
│                                                 │
│  ┌───────────────┐   ┌───────────────────────┐  │
│  │ Query Parser   │──▶│ Chart + Summary View  │  │
│  │ (client-side)  │   │ (React components)    │  │
│  └───────────────┘   └──────────┬────────────┘  │
│                                 │               │
└─────────────────────────────────┼───────────────┘
                                  │ fetch
                    ┌─────────────▼──────────────┐
                    │ Next.js Route Handlers      │
                    │ /api/market-data             │
                    │ (server-side, cached)        │
                    └─────────────┬──────────────┘
                                  │
                    ┌─────────────▼──────────────┐
                    │ External Market Data API    │
                    │ (free-tier or keyed)         │
                    └────────────────────────────┘
```

### Key principles

- **URL is the entire state.** No server sessions, no cookies, no local storage for app state. A URL produces the same view for every visitor (scenario A19).
- **Client-side query parsing, server-side data fetching.** The parser runs in the browser so the page can show validation errors instantly. Actual market data is fetched through a Next.js API route to keep API keys server-side.
- **Minimal dependencies.** This repo follows the Internet Development Studio convention of keeping `package.json` as small as possible. Do not add libraries unless absolutely necessary.

### v1 Constraints

These constraints define v1 and **must not be violated** without a new version bump (see also the one-page summary at the top of this file):

| Constraint | Detail | Origin |
| --- | --- | --- |
| **Auth-free** | The app works without login, API keys, or any auth wall for the end user. Server-side keys for data providers are invisible to visitors. | Issue [#5](https://github.com/internet-development/www-lil-intdev-portfolio-compare/issues/5), scenario A16 |
| **Equal-weight only** | Every equity in `equity=` gets weight 1/N. There is no syntax for custom weights in v1. | Issue [#5](https://github.com/internet-development/www-lil-intdev-portfolio-compare/issues/5) |
| **`:` is reserved for v2 weight syntax** | The colon character (`:`) inside a ticker token (e.g. `AAPL:0.5`) must be **rejected** in v1 with a clear forward-compat message. **Do not silently accept, strip, or ignore colons.** This reserves the syntax for the v2 weighted-portfolio feature. See SCENARIOS.md §7 and §14. | Issue [#10](https://github.com/internet-development/www-lil-intdev-portfolio-compare/issues/10), scenario 7.1 |
| **`=` is also reserved** | Same treatment as `:`. Reject with a clear message, never silently accept. | Scenario 7.3 |

---

## 2. Stack

| Layer            | Technology                         | Notes                                                      |
| ---------------- | ---------------------------------- | ---------------------------------------------------------- |
| Framework        | **Next.js 16** (App Router)        | See `package.json` — `next@16.1.3`                         |
| Language         | **TypeScript**                     | `strict: false`, `strictNullChecks: true` in tsconfig      |
| React            | **React 19**                       | `react@^19.2.3`                                            |
| Styling          | **CSS Modules** (`.module.css`)    | Monospace terminal aesthetic from SRCL component library    |
| Component lib    | **SRCL** (in-repo)                 | `components/` — reuse existing components where possible   |
| Hosting          | **Vercel**                         | Zero-config deployment; see README                         |
| Dev server port  | `10000`                            | `npm run dev` → `http://localhost:10000`                   |
| Path aliases     | `@root/*`, `@common/*`, `@components/*`, `@system/*`, `@demos/*`, `@data/*`, `@pages/*`, `@modules/*` | Defined in `tsconfig.json` — use these instead of relative paths |

---

## 3. URL / Query Parser Rules

The source of truth for all URL and query-parameter parsing behavior is [`SCENARIOS.md`](./SCENARIOS.md).

- **v1 acceptance contract** — `SCENARIOS.md` sections 1–13 define every valid and invalid input for the `equity=` query parser. Any behavior not listed there is undefined and must be rejected.
- **End-to-end scenarios** — `SCENARIOS.md` sections A1–A23 cover the full user experience including benchmarks, time ranges, error states, and auth-free operation.
- **When adding or changing parser behavior**, update `SCENARIOS.md` first, then update tests to match. Tests must cover every scenario listed in the document.
- **When tests fail**, check `SCENARIOS.md` to determine whether the test or the implementation is wrong. The scenarios file is the contract — implementation follows it, not the other way around.

### 3.1 Query parameter names

| Param | User-facing URL | API route internal param | Separator | Notes |
| --- | --- | --- | --- | --- |
| Equities | `equity=AAPL,MSFT` | `tickers=AAPL,MSFT` (in `/api/market-data`) | `,` (comma) | Client parser validates `equity=`, then forwards as `tickers=` to the API route |
| Benchmarks | `benchmark=gold\|eth` | `benchmarks=gold\|eth` (in `/api/benchmark`) | `\|` (pipe) | Benchmark names are case-insensitive |
| Time range | `range=1y` | `range=1y` | — | Same name on both sides. Defaults to `1y` |

> **Note:** The user-facing param is `equity` (singular) and `benchmark` (singular). The API routes accept `tickers` and `benchmarks` (plural). The client-side parser (not yet implemented — see §7) is responsible for this translation. This mapping is stable for v1.

### 3.2 Parser location

The client-side query parser will live at `common/parser.ts` (not yet created — see §7). It is responsible for:

1. Reading `equity=`, `benchmark=`, and `range=` from the browser URL
2. Validating inputs per SCENARIOS.md sections 1–13
3. Returning either a parsed result or a fail-fast error
4. Translating param names before calling the API routes

---

## 4. Data Fetching Approach

### 4.1 API route pattern

Next.js Route Handlers under `app/api/` proxy external market data requests. This keeps API keys off the client and gives us a place to add caching.

```
app/api/market-data/route.ts   — equity price history  (accepts ?tickers=AAPL,MSFT&range=1y)
app/api/benchmark/route.ts     — benchmark price history (accepts ?benchmarks=gold|eth&range=1y)
```

Both routes are implemented and use Yahoo Finance as the data provider. The USD benchmark is generated as a synthetic flat-line baseline (close = 1 for every date in range).

### 4.2 Free-tier-first for MVP

The MVP must work without a paid API key wherever possible (scenario A15). If a key is required, fail gracefully with a clear env-var message (scenario A16).

**Current provider:** Yahoo Finance (unofficial v8 chart endpoint) — no API key required. Covers equities, gold (`GC=F`), and ETH (`ETH-USD`). If Yahoo becomes unavailable, evaluate in this order:

1. **Alpha Vantage** — free tier with 25 requests/day (key required but free to obtain)
2. **CoinGecko** — free tier for crypto (ETH), no key required for basic access

### 4.3 Data shape

All data returned to the client should be normalized to this shape:

```ts
interface PricePoint {
  date: string;   // ISO 8601 date, e.g. "2024-01-15"
  close: number;  // closing price in USD
}

interface SeriesData {
  ticker: string;         // "AAPL" or "GOLD"
  points: PricePoint[];   // sorted oldest → newest
  source: string;         // attribution, e.g. "Yahoo Finance"
}
```

### 4.4 Normalization for charting

The chart normalizes all series to **indexed % change from the start date** (i.e., the first data point = 0%). This makes equity-to-benchmark comparison meaningful regardless of absolute price. State this assumption visibly (scenario A7).

---

## 5. Caching Strategy

| What                | Where                     | TTL                                 |
| ------------------- | ------------------------- | ----------------------------------- |
| API route responses | Next.js `fetch()` cache   | `revalidate: 3600` (1 hour)         |
| Static assets       | Vercel CDN (automatic)    | Immutable for hashed assets         |
| Client data         | None (MVP)                | Re-fetch on URL change              |

For the API route, use Next.js built-in fetch caching:

```ts
const res = await fetch(url, { next: { revalidate: 3600 } });
```

Do **not** add Redis, an in-memory LRU, or any external cache for MVP. Keep it simple.

---

## 6. Environment Variables

| Variable              | Required | Default | Purpose                                                     |
| --------------------- | -------- | ------- | ----------------------------------------------------------- |
| `MARKET_DATA_API_KEY` | No*      | —       | API key for the market data provider, if the chosen provider requires one. Not needed if using a keyless provider. |

*If the chosen data provider requires a key, the app must detect its absence and show a clear error (scenario A16): `"Missing API key. Set the MARKET_DATA_API_KEY environment variable."`

### Env var rules for agents

- **Never commit `.env` files.** They are in `.gitignore`.
- **Never hardcode secrets** in source files.
- **Document any new env var** in this table before merging.
- For local development, create `.env.local` (already gitignored).

---

## 7. Directory Structure

Files marked ✓ exist. Files marked ○ need to be created.

```
app/
  layout.tsx               ✓ root layout (Providers wrapper, theme-light body)
  page.tsx                 ✓ currently SRCL kitchen sink — will become compare page
  head.tsx                 ✓ head metadata
  manifest.ts              ✓ web manifest
  robots.ts                ✓ robots config
  sitemap.ts               ✓ sitemap config
  api/
    market-data/route.ts   ✓ proxies equity price requests (Yahoo Finance)
    benchmark/route.ts     ✓ proxies benchmark price requests (Yahoo Finance + USD baseline)
common/
  constants.ts             ✓ app-wide constants (API URLs, limits)
  utilities.ts             ✓ utility functions
  hooks.ts                 ✓ custom React hooks
  queries.ts               ✓ data-fetching helpers
  server.ts                ✓ server-side utilities
  position.ts              ✓ position utilities
  market-data.ts           ✓ normalization helpers (normalizeSeries, normalizeAllSeries)
  types.ts                 ✓ shared TypeScript interfaces (PricePoint, SeriesData, RangeValue, BenchmarkValue)
  parser.ts                ○ v1 query parser (equity, benchmark, range) — see §3.2
components/
  Chart.tsx                ○ performance chart component
  Chart.module.css         ○
  Summary.tsx              ○ summary table component
  Summary.module.css       ○
  ErrorState.tsx           ○ error display component
  LandingState.tsx         ○ empty/welcome state (scenario A13)
  (100+ SRCL components)   ✓ Card, Table, Grid, Row, Button, etc.
```

Place new files in the pattern above. Reuse existing SRCL components (Card, Table, Grid, Row, DataTable, AlertBanner, etc.) for layout. Browse `components/` to discover available primitives before creating new ones.

---

## 8. Existing Codebase Notes

The repo is a fork of the **SRCL** component library (sacred.computer). Key things to know:

- **`app/page.tsx`** is currently a kitchen-sink demo of all SRCL components with `export const dynamic = 'force-static'`. The Page Integration SOUL will replace this content with the portfolio compare UI. Remove `force-static` since the compare page reads query params at request time.
- **`app/concept-1/` and `app/concept-2/`** are alternative layout demos. Leave them in place — they don't interfere with the compare page.
- **`app/layout.tsx`** wraps everything in `<Providers>` with `className="theme-light"`. Do not modify the root layout unless necessary.
- **`next.config.js`** is minimal (`devIndicators: false`). No special configuration needed for API routes.
- **`components/page/DefaultLayout.tsx`** and **`components/page/DefaultActionBar.tsx`** provide the standard page shell. Consider reusing `DefaultLayout` for the compare page.

---

## 9. Roles and Responsibilities

Each SOUL (agent) owns a vertical slice. Coordinate through this doc and SCENARIOS.md.

| Role                    | Owns                                         | Reads from                       |
| ----------------------- | -------------------------------------------- | -------------------------------- |
| **Docs / Architecture** | This file, SCENARIOS.md                      | All source files                 |
| **Parser**              | `common/parser.ts`, parser tests             | SCENARIOS.md (the contract)      |
| **Data Layer**          | `app/api/` routes, data-fetching utilities   | This file §4, env vars §6       |
| **Chart UI**            | `Chart.tsx`, `Chart.module.css`              | Data shape §4.3, normalization §4.4 |
| **Summary UI**          | `Summary.tsx`, `Summary.module.css`          | Data shape §4.3, scenario A21   |
| **Page Integration**    | `app/page.tsx` (compare page)                | All of the above                 |

---

## 10. How to Add a New Data Source

1. Create or extend a Route Handler under `app/api/`.
2. Normalize the response to the `SeriesData` interface (§4.3).
3. If the source requires an API key, add the env var to §6 and handle the missing-key case per scenario A16.
4. Add the source name to the `source` field so the chart attribution (scenario A7) stays accurate.
5. Update SCENARIOS.md if the new source changes any observable behavior.

---

## 11. How to Add a New Chart or UI Component

1. Create the component in `components/` with a matching `.module.css` file.
2. Follow the SRCL monospace aesthetic — use the existing CSS custom properties and the terminal-style design language.
3. Use existing SRCL primitives (Card, Grid, Row, Table, etc.) for layout.
4. Wire it into `app/page.tsx` or the relevant page.
5. Ensure mobile responsiveness (scenario A23) — viewport < 768px must remain usable.

---

## 12. Guardrails

- **No paid keys required for MVP.** If every free option is exhausted, document the cheapest path and make it optional.
- **No additional runtime dependencies** without justification. Charting can be done with `<canvas>` or `<svg>` directly — avoid adding a charting library unless the team agrees.
- **No server-side sessions or databases.** The app is stateless; URL params encode everything.
- **Fail-fast error handling.** The parser and data layer both return the first error encountered and stop processing (scenario 13.1).
- **All returns in USD.** Benchmark prices are spot prices in USD. Equity prices are closing prices in USD.
- **Test coverage.** Every scenario in SCENARIOS.md must have a corresponding test. Do not merge code that breaks existing scenario tests.
- **Commit hygiene.** Each PR should address one task. Reference the task number in the commit message.

---

## 13. Running the App

### 13.0 Quick start

```sh
npm install                 # install dependencies (node >= 18)
npm run dev                 # dev server → http://localhost:10000
```

Open `http://localhost:10000/?equity=AAPL,MSFT&benchmark=gold` to verify the app is running.

### 13.1 Available npm scripts

| Script | Command | What it does |
| --- | --- | --- |
| `npm run dev` | `next -p 10000` | Start dev server on port 10000 |
| `npm run build` | `next build` | Production build |
| `npm run start` | `PORT=10000 next start` | Start production server on port 10000 |
| `npm run lint` | `next lint` | Run ESLint via Next.js |

### 13.2 Tests

**No test runner is configured yet.** `package.json` has no `test` script and no testing libraries (Jest, Vitest, etc.) are installed.

When a test runner is added:
- Parser tests should live next to the parser (e.g. `common/parser.test.ts`).
- Every scenario in `SCENARIOS.md` sections 1–13 must have a corresponding unit test.
- End-to-end scenarios (A1–A24) should have integration or e2e tests as the UI is built out.
- Run tests with `npm test` (once configured).

### 13.3 Entrypoints

| What | File | Notes |
| --- | --- | --- |
| Main page | `app/page.tsx` | Currently SRCL kitchen sink; will become compare page |
| Root layout | `app/layout.tsx` | Providers wrapper, `theme-light` body class |
| Equity data API | `app/api/market-data/route.ts` | GET `?tickers=…&range=…` |
| Benchmark data API | `app/api/benchmark/route.ts` | GET `?benchmarks=…&range=…` |
| Shared types | `common/types.ts` | `PricePoint`, `SeriesData`, `RangeValue`, `BenchmarkValue` |
| Normalization | `common/market-data.ts` | `normalizeSeries()`, `normalizeAllSeries()` |
| Parser (planned) | `common/parser.ts` | Not yet created — see §3.2 |
