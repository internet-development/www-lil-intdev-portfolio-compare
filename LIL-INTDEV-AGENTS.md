# LIL-INTDEV Agent Guidelines

## Project Overview

Portfolio vs Benchmark Comparer — a web app that accepts URL query params (`?equity=tsmc,aapl,msft&benchmark=gold|eth|usd`) and displays comparable performance over time.

---

## Stack

| Layer             | Technology                         |
| ----------------- | ---------------------------------- |
| Framework         | Next.js 16 (App Router)            |
| Language          | TypeScript                         |
| UI library        | React 19                           |
| Component system  | SRCL (terminal-aesthetic components — see `components/`) |
| Styling           | CSS Modules (`.module.css` per component) |
| Hosting           | Vercel                             |
| Node requirement  | >= 18                              |
| Package manager   | npm                                |
| Formatter         | Prettier (config in `.prettierrc`) |
| Dev server port   | 10000                              |

### Path Aliases (tsconfig.json)

| Alias           | Maps to        |
| --------------- | -------------- |
| `@root/*`       | `./*`          |
| `@common/*`     | `./common/*`   |
| `@components/*` | `./components/*` |
| `@modules/*`    | `./modules/*`  |
| `@data/*`       | `./data/*`     |
| `@pages/*`      | `./pages/*`    |

---

## Architecture

```
app/
  page.tsx              ← main SRCL kitchen-sink demo (will be replaced with comparer page)
  concept-1/            ← example concept page
  concept-2/            ← example concept page
  layout.tsx            ← root layout (html, body, Providers)
  manifest.ts / robots.ts / sitemap.ts
common/
  constants.ts          ← shared constants
  queries.ts            ← data-fetching helpers (POST-based, api.internet.dev)
  server.ts             ← server-side middleware, CORS, session setup
  utilities.ts          ← general utility functions
  hooks.ts              ← React hooks
  position.ts           ← popover/tooltip position calculation
components/
  *.tsx + *.module.css   ← SRCL component library
  page/                 ← page-level layout components (DefaultLayout, DefaultActionBar)
  examples/             ← full-page example compositions
  modals/               ← modal components
  svg/                  ← SVG components
```

### Key Patterns

- **`export const dynamic = 'force-static'`** is used on existing pages. The comparer page will need **`'force-dynamic'`** or no dynamic export so query params are available at request time.
- **CSS Modules** — every component owns its styles via `ComponentName.module.css`. Follow the same pattern for new components.
- **No external charting library exists yet.** A charting solution must be added. Prefer a lightweight library (e.g., `recharts`, `lightweight-charts`, or SVG-based custom rendering) that fits the terminal aesthetic.
- **Existing data layer** (`common/queries.ts`) uses POST requests to `api.internet.dev`. Market data fetching is separate and will use a different provider.

---

## Data Fetching Approach

### Market Data Provider

For MVP, use a **free, auth-free API** so the app works without any API keys. Recommended options in priority order:

1. **Yahoo Finance (unofficial)** — free, no key required, good historical data. Access via `query1.finance.yahoo.com` or a lightweight wrapper.
2. **Alpha Vantage free tier** — requires a free API key (env var `ALPHA_VANTAGE_API_KEY`), limited to 25 requests/day.
3. **Twelve Data free tier** — requires a free API key, 800 requests/day.

For **commodity/crypto benchmarks** (gold, ETH):
- Gold (XAU/USD): same provider as equities, or a free metals API.
- ETH/USD: same provider, or CoinGecko free API (no key required).
- USD baseline: computed client-side as flat 0% — no API call needed.

### Caching

| Strategy                    | Details                                                     |
| --------------------------- | ----------------------------------------------------------- |
| Server-side cache           | Use Next.js `fetch` with `next.revalidate` (ISR). Cache market data for **1 hour** during market hours, **24 hours** outside. |
| API route (if used)         | Place under `app/api/market/route.ts`. Return JSON with `Cache-Control` headers. |
| Client cache                | Let `fetch` honor HTTP cache headers. No additional client state library needed for MVP. |
| Stale-while-revalidate      | Acceptable for historical data; freshness matters less for ranges > 1 day. |

### Data Flow

```
URL query params
  → parse equity + benchmark params (see SCENARIOS.md)
  → fetch historical price data (server-side or API route)
  → normalize to % change from start date
  → render chart + summary table
```

---

## Environment Variables

| Variable                 | Required | Default   | Description                                  |
| ------------------------ | -------- | --------- | -------------------------------------------- |
| `MARKET_DATA_API_KEY`    | No (MVP) | —         | API key for market data provider (if needed)  |
| `ALPHA_VANTAGE_API_KEY`  | No       | —         | Alpha Vantage free-tier key (alternative)     |
| `NEXT_PUBLIC_BASE_URL`   | No       | —         | Public base URL for OG meta (Vercel sets automatically) |

**MVP goal: zero required env vars.** If a provider requires a key, gracefully degrade or show the configuration error described in scenario A16.

---

## URL / Query Parser Rules

The source of truth for all URL and query-parameter parsing behavior is [`SCENARIOS.md`](./SCENARIOS.md).

- **v1 acceptance contract** — `SCENARIOS.md` sections 1–13 define every valid and invalid input for the `equity=` query parser. Any behavior not listed there is undefined and must be rejected.
- **End-to-end scenarios** — `SCENARIOS.md` sections A1–A23 cover the full user experience including benchmarks, time ranges, error states, and auth-free operation.
- **When adding or changing parser behavior**, update `SCENARIOS.md` first, then update tests to match. Tests must cover every scenario listed in the document.
- **When tests fail**, check `SCENARIOS.md` to determine whether the test or the implementation is wrong. The scenarios file is the contract — implementation follows it, not the other way around.

---

## Guardrails

1. **No paid API keys required for MVP.** If the chosen provider has a free tier that needs a key, document the signup URL and make it optional with a helpful error (see scenario A16).
2. **Minimal dependencies.** This repo follows a low-dependency philosophy (currently only `next`, `react`, `react-dom` in production deps). Any new dependency must be justified. Prefer:
   - Built-in Next.js features over external libraries
   - Single-purpose packages over large frameworks
   - SVG or canvas rendering over heavy charting bundles
3. **No server-side secrets in client bundles.** Prefix client-safe env vars with `NEXT_PUBLIC_`. Keep API keys server-side only.
4. **All state in the URL.** The app must be fully shareable via URL (scenario A19). No server-side session, cookies, or local storage for core state.
5. **Fail-fast error handling.** Parser errors follow the fail-fast contract in SCENARIOS.md. Data-fetch errors show clear messages (scenarios A8–A10, A18).
6. **Terminal aesthetic.** All new UI must use existing SRCL components or follow their visual language (monospace fonts, box-drawing characters, MS-DOS-inspired cards). Do not introduce a conflicting design system.
7. **Formatting.** Run `prettier` before committing. Config is in `.prettierrc` (single quotes, 2-space indent, trailing commas in ES5).

---

## How to Add a New Data Source

1. Create a module under `common/` (e.g., `common/market-data.ts`) that exports an async function returning normalized price data:
   ```ts
   export interface PricePoint {
     date: string;    // ISO 8601 date (YYYY-MM-DD)
     close: number;   // closing price in USD
   }

   export async function fetchHistoricalPrices(
     ticker: string,
     range: string
   ): Promise<PricePoint[]>;
   ```
2. If the provider requires an API key, read it from `process.env` (never `NEXT_PUBLIC_`).
3. Add caching via Next.js `fetch` options or a simple in-memory cache with TTL.
4. Register the data source in a lookup/registry so the page can resolve tickers and benchmarks to the correct fetcher.
5. Handle errors by returning `null` or throwing a typed error that the page can catch and display per SCENARIOS.md.

---

## How to Add a Chart Component

1. Create the component under `components/` following the pattern: `ChartPerformance.tsx` + `ChartPerformance.module.css`.
2. Accept normalized data as props — the chart should not fetch data itself:
   ```ts
   interface ChartPerformanceProps {
     series: Array<{
       label: string;
       data: Array<{ date: string; value: number }>;
       type: 'equity' | 'benchmark';
     }>;
   }
   ```
3. Use the SRCL visual language:
   - Monospace labels
   - Card or CardDouble wrappers
   - Distinguish equities (solid lines) from benchmarks (dashed lines) per scenario A4
4. Support hover/tooltip for data points (scenario A22).
5. Ensure mobile responsiveness (scenario A23) — the chart must scale to viewport width.

---

## SOUL Collaboration Notes

- **Parser / URL logic** → governed by SCENARIOS.md. Update scenarios first, then code.
- **Data layer** → add fetchers in `common/`. Keep them pure async functions with typed returns.
- **UI / chart** → build with SRCL components. Place under `components/`.
- **Page assembly** → wire everything together in `app/` page files. Use `searchParams` from Next.js App Router to read query params.
- **Tests** → place under `__tests__/` or colocated `*.test.ts` files. Every SCENARIOS.md scenario should have a corresponding test.
