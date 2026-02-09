# LIL-INTDEV Agent Guidelines

Agent-facing reference for **www-lil-intdev-portfolio-compare** — a small web app that accepts `?equity=TSMC,AAPL,MSFT&benchmark=gold|eth|usd` and displays comparable performance over time.

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
| Path aliases     | `@common/*`, `@components/*`, etc. | Defined in `tsconfig.json`                                 |

---

## 3. URL / Query Parser Rules

The source of truth for all URL and query-parameter parsing behavior is [`SCENARIOS.md`](./SCENARIOS.md).

- **v1 acceptance contract** — `SCENARIOS.md` sections 1–13 define every valid and invalid input for the `equity=` query parser. Any behavior not listed there is undefined and must be rejected.
- **End-to-end scenarios** — `SCENARIOS.md` sections A1–A23 cover the full user experience including benchmarks, time ranges, error states, and auth-free operation.
- **When adding or changing parser behavior**, update `SCENARIOS.md` first, then update tests to match. Tests must cover every scenario listed in the document.
- **When tests fail**, check `SCENARIOS.md` to determine whether the test or the implementation is wrong. The scenarios file is the contract — implementation follows it, not the other way around.

---

## 4. Data Fetching Approach

### 4.1 API route pattern

Create Next.js Route Handlers under `app/api/` to proxy external market data requests. This keeps API keys off the client and gives us a place to add caching.

```
app/api/market-data/route.ts   — equity price history
app/api/benchmark/route.ts     — gold, ETH, USD price history
```

### 4.2 Free-tier-first for MVP

The MVP must work without a paid API key wherever possible (scenario A15). Prefer providers that offer free-tier access for historical price data. If a key is required, fail gracefully with a clear env-var message (scenario A16).

Candidate free/freemium data sources (evaluate in order of preference):

1. **Yahoo Finance** (unofficial endpoints) — no key required, covers equities and some commodities
2. **Alpha Vantage** — free tier with 25 requests/day (key required but free to obtain)
3. **CoinGecko** — free tier for crypto (ETH), no key required for basic access

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

## 7. Directory Structure (target)

```
app/
  page.tsx                 ← landing / compare page (reads query params)
  api/
    market-data/route.ts   ← proxies equity price requests
    benchmark/route.ts     ← proxies benchmark price requests
common/
  constants.ts             ← app-wide constants (API URLs, limits)
  parser.ts                ← v1 query parser (equity, benchmark, range)
  types.ts                 ← shared TypeScript interfaces
components/
  Chart.tsx                ← performance chart component
  Chart.module.css
  Summary.tsx              ← summary table component
  Summary.module.css
  ErrorState.tsx           ← error display component
  LandingState.tsx         ← empty/welcome state (scenario A13)
```

Place new files in the pattern above. Reuse existing SRCL components (Card, Table, Grid, etc.) for layout.

---

## 8. Roles and Responsibilities

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

## 9. How to Add a New Data Source

1. Create or extend a Route Handler under `app/api/`.
2. Normalize the response to the `SeriesData` interface (§4.3).
3. If the source requires an API key, add the env var to §6 and handle the missing-key case per scenario A16.
4. Add the source name to the `source` field so the chart attribution (scenario A7) stays accurate.
5. Update SCENARIOS.md if the new source changes any observable behavior.

---

## 10. How to Add a New Chart or UI Component

1. Create the component in `components/` with a matching `.module.css` file.
2. Follow the SRCL monospace aesthetic — use the existing CSS custom properties and the terminal-style design language.
3. Use existing SRCL primitives (Card, Grid, Row, Table, etc.) for layout.
4. Wire it into `app/page.tsx` or the relevant page.
5. Ensure mobile responsiveness (scenario A23) — viewport < 768px must remain usable.

---

## 11. Guardrails

- **No paid keys required for MVP.** If every free option is exhausted, document the cheapest path and make it optional.
- **No additional runtime dependencies** without justification. Charting can be done with `<canvas>` or `<svg>` directly — avoid adding a charting library unless the team agrees.
- **No server-side sessions or databases.** The app is stateless; URL params encode everything.
- **Fail-fast error handling.** The parser and data layer both return the first error encountered and stop processing (scenario 13.1).
- **All returns in USD.** Benchmark prices are spot prices in USD. Equity prices are closing prices in USD.
- **Test coverage.** Every scenario in SCENARIOS.md must have a corresponding test. Do not merge code that breaks existing scenario tests.
- **Commit hygiene.** Each PR should address one task. Reference the task number in the commit message.
