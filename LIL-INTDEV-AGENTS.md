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

The full, testable query contract lives in [`SCENARIOS.md`](./SCENARIOS.md) — sections 1–15 for the parser (§1–§13 core rules, §14 v2-reserved syntax, §15 pipeline-order drift guardrails), A1–A30 for end-to-end behavior, B1–B15 for UI wiring. **That file is the single source of truth.** When in doubt, defer to SCENARIOS.md. See also the [v1 Parsing Invariants](./SCENARIOS.md#v1-parsing-invariants) section for pinned error strings and enforcement points.

### v1 Parsing Invariants (Contract)

The following invariants are pinned by the v1 contract and enforced by unit tests. Any change to these is a breaking change.

- **Exact error strings are pinned in [`SCENARIOS.md`](./SCENARIOS.md#v1-parsing-invariants) and enforced by unit tests.** The colon-rejection message (`"Weights (:) are not supported in v1. Use a comma-separated list of tickers like \"AAPL,MSFT\"."`) is established in #117/#114 and tested with exact-match assertions (`.toBe()`), not substring matching. See [SCENARIOS.md §7](./SCENARIOS.md#v1-reserved-syntax-rejection) (especially §7.7–§7.10) for the full specification.
- **Reserved-character rejection is tested across all entry points.** Both the client-side parser ([`common/parser.ts`](./common/parser.ts)) and the server-side validate endpoint ([`app/api/compare/validate/route.ts`](./app/api/compare/validate/route.ts)) reject `:` and `=` with the same pinned messages. See [SCENARIOS.md §7.9](./SCENARIOS.md#v1-colon-entry-points) for the entry-point coverage table.
- **Test files enforcing these invariants:**
  - [`common/parser.test.ts`](./common/parser.test.ts) — 74 tests covering SCENARIOS.md §1–§15, including all colon/equals rejection scenarios and drift guardrail tests
  - [`common/query.test.ts`](./common/query.test.ts) — 16 tests for full query parsing (equity + benchmark + range + amount)
  - [`common/portfolio.test.ts`](./common/portfolio.test.ts) — 11 tests for equal-weight construction and return computation
  - [`app/api/compare/validate/route.test.ts`](./app/api/compare/validate/route.test.ts) — 9 tests for the server-side validation endpoint
- **Validation pipeline order is defined in [SCENARIOS.md](./SCENARIOS.md#v1-validation-pipeline)** — fail-fast, left-to-right, first error wins. The pipeline order (portfolio count → empty value → split → per-token checks → ticker count) is the contract; implementation must follow it.

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
| **`:` is reserved for v2 weight syntax** | The colon character (`:`) inside a ticker token (e.g. `AAPL:0.5`) must be **rejected** in v1 with a clear forward-compat message. **Do not silently accept, strip, or ignore colons.** This reserves the syntax for the v2 weighted-portfolio feature. See SCENARIOS.md §7 and §14, and [`docs/weights-v2.md`](./docs/weights-v2.md) for the full v2 contract. | Issue [#10](https://github.com/internet-development/www-lil-intdev-portfolio-compare/issues/10), scenario 7.1 |
| **`=` is also reserved** | Same treatment as `:`. Reject with a clear message, never silently accept. | Scenario 7.3 |

### Auth-Free and Data-Source Constraints

The app **must not require any user-provided API keys, logins, or auth walls**. All data fetching uses free, public-tier endpoints with server-side keys invisible to the visitor (scenario A16).

| Constraint | Detail |
| --- | --- |
| **No user authentication** | No login flows, no OAuth, no API-key prompts. The app works the instant a URL is opened. |
| **Allowed data sources** | Free/public endpoints only. The current provider is Yahoo Finance (unofficial v8 chart endpoint — no key required). See §4.2 for the provider hierarchy and §4.2.1 for discovered constraints. |
| **Server-side keys only** | If a future provider requires a key, it lives in a server-side env var (`MARKET_DATA_API_KEY`) and is never exposed to the client. See §6. |
| **Caching** | API route responses are cached for 1 hour (`revalidate: 3600`). No external cache (Redis, etc.) for MVP. See §5. |
| **Graceful degradation** | When the data source is unavailable (429, 5xx, network error), the app displays a clear error state and keeps the URL visible so the user can retry. See scenarios A19, B6–B8. |

### Reserved v2 Query Parameters

The following query parameters and syntaxes are **reserved for v2** and must not be implemented in v1. If encountered, the parser either rejects them (for `:` and `=`) or ignores them (for unknown params per scenario 11.1):

| Reserved syntax | Purpose | v1 behavior |
| --- | --- | --- |
| `TICKER:WEIGHT` (`:` in equity token) | Per-ticker weight assignment | **Rejected** — pinned error from [SCENARIOS.md §7](./SCENARIOS.md#v1-reserved-syntax-rejection): `"Weights (:) are not supported in v1. Use a comma-separated list of tickers like \"AAPL,MSFT\"."` |
| `TICKER=WEIGHT` (`=` in equity token) | Alternate weight syntax | **Rejected** — `"Invalid character '=' in ticker … — equals signs are reserved"` |
| `weights=` / `w=` param | Standalone weight specification | **Ignored** (unknown params are silently ignored per scenario 11.1). Reserved for possible v2 use. |
| `rebalance=` param | Periodic rebalancing frequency | **Ignored** (unknown param). Reserved for v3 — see [`docs/weights-v2.md` §5](./docs/weights-v2.md). |

> **Cross-reference:** The full v2 weights contract (token grammar, validation rules, error messages, rebalancing semantics) is specified in [`docs/weights-v2.md`](./docs/weights-v2.md). The v1 rejection behavior is defined in [SCENARIOS.md §7](./SCENARIOS.md#v1-reserved-syntax-rejection) and [§14](./SCENARIOS.md#v2-weight-syntax).

---

## Where to Start

New contributor or agent? Read these files in order:

| # | File | Why |
| --- | --- | --- |
| 1 | [`SCENARIOS.md`](./SCENARIOS.md) | **The acceptance contract.** Sections 1–13 define every valid/invalid parser input. Sections A1–A30 define end-to-end behavior. Sections B1–B15 define UI wiring scenarios. This is the single source of truth — when in doubt, defer here. |
| 2 | `app/page.tsx` | **The compare page.** Fully wired client component: URL parsing → data fetch → normalization → chart render. Start here to understand the end-to-end flow. |
| 3 | `common/parser.ts` | **The v1 query parser.** Strict validation of `equity=` input. Rejects reserved v2 syntax (`:`, `=`). 74 unit tests in `parser.test.ts`. |
| 4 | `app/api/market-data/route.ts` | **Server-side data proxy.** Fetches equity prices from Yahoo Finance, keeps API keys off the client, 1-hour cache. |
| 5 | `common/market-data.ts` | **Normalization engine.** Converts raw price series to indexed % change for apples-to-apples comparison. |

After these five files you'll understand the full pipeline: URL → parse → fetch → normalize → render.

### Verification quick-reference

Before submitting any PR, run through the verification loop to confirm nothing is broken:

1. **Quick check (3 items):** [`README.md` → Quick Verification Checklist](./README.md#quick-verification-checklist) — happy path, error path, unit tests.
2. **Full procedure:** [`SCENARIOS.md` → Local Verification Checklist](./SCENARIOS.md#local-verification-checklist) — curl-based API tests, validation endpoint, and browser scenarios. This is the authoritative checklist; when in doubt, follow SCENARIOS.md.
3. **Acceptance criteria:** [`SCENARIOS.md`](./SCENARIOS.md) sections A1–A30 and B1–B15 define every observable behavior. The [Scenario Implementation Status](./SCENARIOS.md#scenario-implementation-status) table shows which scenarios are testable today. The [v1 Parsing Invariants](./SCENARIOS.md#v1-parsing-invariants) section lists the pinned error strings and enforcement points.

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

- **v1 acceptance contract** — `SCENARIOS.md` sections 1–15 define every valid and invalid input for the `equity=` query parser (§1–§13 core rules, §14 v2-reserved syntax, §15 pipeline-order drift guardrails). Any behavior not listed there is undefined and must be rejected.
- **End-to-end scenarios** — `SCENARIOS.md` sections A1–A30 cover the full user experience including benchmarks, time ranges, error states, auth-free operation, and dollar-amount simulation.
- **When adding or changing parser behavior**, update `SCENARIOS.md` first, then update tests to match. Tests must cover every scenario listed in the document.
- **When tests fail**, check `SCENARIOS.md` to determine whether the test or the implementation is wrong. The scenarios file is the contract — implementation follows it, not the other way around.

### 3.1 Query parameter names

| Param | User-facing URL | API route internal param | Separator | Notes |
| --- | --- | --- | --- | --- |
| Equities | `equity=AAPL,MSFT` | `tickers=AAPL,MSFT` (in `/api/market-data`) | `,` (comma) | Client parser validates `equity=`, then forwards as `tickers=` to the API route |
| Benchmarks | `benchmark=gold\|eth` | `benchmarks=gold\|eth` (in `/api/benchmark`) | `\|` (pipe) | Benchmark names are case-insensitive |
| Time range | `range=1y` | `range=1y` | — | Same name on both sides. Defaults to `1y` |
| Amount | `amount=10000` | — (client-side only) | — | Simulated lump-sum investment. Defaults to `10000`. Affects Summary table only, not chart. |

> **Note:** The user-facing param is `equity` (singular) and `benchmark` (singular). The API routes accept `tickers` and `benchmarks` (plural). The client-side parser (`common/query.ts` → `common/compare-fetcher.ts`) handles this translation. This mapping is stable for v1.

### 3.2 Parser location

The client-side query parser lives at `common/parser.ts` (equity validation) and `common/query.ts` (full query entry point). Together they are responsible for:

1. Reading `equity=`, `benchmark=`, `range=`, and `amount=` from the browser URL
2. Validating inputs per SCENARIOS.md sections 1–15 (equity), benchmark/range/amount contracts
3. Returning either a parsed `CompareQuery` or a fail-fast error
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

### 4.2.1 Yahoo Finance constraints (discovered)

| Constraint | Detail |
| --- | --- |
| **Rate limit** | ~2,000 requests/day per IP (undocumented, observed). Individual ticker fetches are sequential in the API route, so a portfolio of N tickers = N requests. |
| **No API key** | The v8 chart endpoint does not require authentication. A `User-Agent` header is sent to avoid bot-detection blocks. |
| **Date range mapping** | Ranges ≥ 3y use weekly intervals; `max` uses monthly. This reduces data points but is sufficient for trend comparison. |
| **Null data points** | Some trading days have `null` closes (holidays, halts). These are silently skipped during parsing — no gap-fill is applied. |
| **Ticker validation** | Yahoo does not return a clean 404 for unknown tickers — behavior varies. The API route catches this and surfaces `"No data found for ticker: X"`. |

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
  page.tsx                 ✓ compare page ('use client') — parse → fetch → normalize → render
  head.tsx                 ✓ head metadata
  manifest.ts              ✓ web manifest
  robots.ts                ✓ robots config
  sitemap.ts               ✓ sitemap config
  api/
    market-data/route.ts   ✓ proxies equity price requests (Yahoo Finance)
    benchmark/route.ts     ✓ proxies benchmark price requests (Yahoo Finance + USD baseline)
    compare/validate/route.ts ✓ server-side query validation endpoint
    compare/validate/route.test.ts ✓ 9 tests for the validation endpoint
common/
  constants.ts             ✓ app-wide constants (API URLs, limits)
  utilities.ts             ✓ utility functions
  hooks.ts                 ✓ custom React hooks
  queries.ts               ✓ data-fetching helpers
  server.ts                ✓ server-side utilities
  position.ts              ✓ position utilities
  market-data.ts           ✓ normalization helpers (normalizeSeries, normalizeAllSeries)
  types.ts                 ✓ shared TypeScript interfaces (PricePoint, SeriesData, RangeValue, BenchmarkValue) + validation constants (VALID_RANGES, VALID_BENCHMARKS)
  parser.ts                ✓ v1 strict equity parser (see §3.2)
  parser.test.ts           ✓ 74 unit tests covering SCENARIOS.md §1–§15
  query.ts                 ✓ full query entry point: equity + benchmark + range + amount parsing
  query.test.ts            ✓ 16 unit tests for full query parsing
  portfolio.ts             ✓ equal-weight portfolio construction (1/N weights)
  portfolio.test.ts        ✓ 11 unit tests for portfolio construction and returns
  compare-fetcher.ts       ✓ client-side fetch helper — calls /api/market-data + /api/benchmark
components/
  Chart.tsx                ✓ SVG line chart (normalized % change vs time)
  Chart.module.css         ✓ chart styles
  CopyURLExamples.tsx      ✓ utility for copying URL examples
  Summary.tsx              ✓ summary table (per-ticker prices, returns, dollar values)
  Summary.module.css       ✓ summary styles
  ErrorState.tsx           ✓ error display component (parse + fetch errors)
  LandingState.tsx         ✓ empty/welcome state (scenario A14)
  (100+ SRCL components)   ✓ Card, Table, Grid, Row, Button, etc.
```

Place new files in the pattern above. Reuse existing SRCL components (Card, Table, Grid, Row, DataTable, AlertBanner, etc.) for layout. Browse `components/` to discover available primitives before creating new ones.

---

## 8. Existing Codebase Notes

The repo is a fork of the **SRCL** component library (sacred.computer). Key things to know:

- **`app/page.tsx`** is the portfolio compare page (`'use client'`). It is **fully wired end-to-end**: parse → fetch → normalize → render. It uses `useCompareQuery()` to parse URL params, `useCompareData()` (backed by `fetchCompareData()` from `common/compare-fetcher.ts`) to fetch market data, `normalizeAllSeries()` to compute % change, and `Chart.tsx` to render an SVG line chart. Loading (`BlockLoader`), error (`AlertBanner`), and empty/idle states are all handled.
- **`useCompareQuery()`** returns `{ query: CompareQuery | null, error: string | null }`. The `CompareQuery` contains `portfolios: WeightedPortfolio[]`, `benchmarks: BenchmarkValue[]`, and `range: RangeValue` — all the info needed to build API fetch URLs.
- **`common/compare-fetcher.ts`** is the client-side fetch abstraction. It calls `/api/market-data` and `/api/benchmark` and returns typed `SeriesData[]`.
- **`app/layout.tsx`** wraps everything in `<Providers>` with `className="theme-light"`. Do not modify the root layout unless necessary.
- **`next.config.js`** is minimal (`devIndicators: false`). No special configuration needed for API routes.
- **`components/page/DefaultLayout.tsx`** and **`components/page/DefaultActionBar.tsx`** provide the standard page shell. `DefaultLayout` is used by the compare page.
- **Domain-specific components:** `Chart.tsx` (SVG line chart), `Summary.tsx` (per-ticker price/return/value table), `ErrorState.tsx` (error display), `LandingState.tsx` (empty/welcome state). The page also uses generic SRCL primitives (`Card`, `BlockLoader`) for layout.

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

## 11.1 v2 Weights — Reserved, Not Implemented

The v2 weighted-portfolio feature is **fully specified but not yet shipped**. Key references:

| Document | What it covers |
| --- | --- |
| [`docs/weights-v2.md`](./docs/weights-v2.md) | Full v2 contract: token grammar, validation rules, error messages, rebalancing semantics, open questions |
| [`SCENARIOS.md` §14](./SCENARIOS.md#v2-weight-syntax) | Summary of v2 decisions + v1 rejection table |
| [`SCENARIOS.md` §7](./SCENARIOS.md#v1-reserved-syntax-rejection) | v1 tests that enforce `:` and `=` rejection |
| [`common/parser.ts`](./common/parser.ts) | v1 implementation — rejects `:` with v2-reserved message |

**For agents:** Do not implement v2 weight parsing. The v1 parser must continue to reject `:` with the pinned error message: `"Weights (:) are not supported in v1. Use a comma-separated list of tickers like \"AAPL,MSFT\"."` (established in #117/#114). When v2 implementation begins, start from `docs/weights-v2.md` as the contract. See also the [Reserved v2 Query Parameters](#reserved-v2-query-parameters) table in §1 for the full list of reserved syntaxes and params (`weights=`, `rebalance=`, etc.).

---

## 11.2 v1 Pipeline Status

> Updated after task 7 end-to-end sanity check.

| Stage | Status | Key files | Notes |
| --- | --- | --- | --- |
| **Parse** | Done | `common/parser.ts`, `common/query.ts`, `common/portfolio.ts` | 110 unit tests passing (Vitest). Covers SCENARIOS.md §1–§15. |
| **Fetch** | Done | `app/api/market-data/route.ts`, `app/api/benchmark/route.ts` | Yahoo Finance (free, no key). 1-hour cache. See §4.2.1 for constraints. |
| **Compute** | Done | `common/market-data.ts`, `common/portfolio.ts` | Normalization to % change + equal-weight return computation. |
| **Render** | Done | `app/page.tsx`, `components/Chart.tsx`, `components/Summary.tsx`, `components/ErrorState.tsx`, `components/LandingState.tsx` | Full pipeline: parse → fetch → normalize → Chart + Summary table. Error and landing states extracted to dedicated components. Dollar-amount simulation via `?amount=` param. |
| **Validate API** | Done | `app/api/compare/validate/route.ts` | Server-side query validation endpoint. |

---

## 11.3 Compare View Dataflow — Intended Wiring

> This section describes the end-to-end data flow for the compare page. Use it as the blueprint when wiring UI to data routes. Each numbered step maps to a file; PRs should touch as few steps as possible.

### Dataflow diagram

```
 URL in browser address bar
 /?equity=AAPL,MSFT&benchmark=gold&range=1y&amount=10000
              │
              ▼
 ┌─────────────────────────────────────────────┐
 │ 1. PARSE (client)                           │
 │    common/query.ts  → parseCompareQuery()   │
 │    common/parser.ts → parsePortfolios()     │
 │    common/portfolio.ts → buildEqualWeight…() │
 │                                             │
 │    Output: CompareQuery {                   │
 │      portfolios: WeightedPortfolio[]        │
 │      benchmarks: BenchmarkValue[]           │
 │      range: RangeValue                      │
 │      amount: number                         │
 │    }                                        │
 └───────────────┬─────────────────────────────┘
                 │ on success
                 ▼
 ┌─────────────────────────────────────────────┐
 │ 2. FETCH (client → server → Yahoo Finance)  │
 │                                             │
 │  For each portfolio:                        │
 │    GET /api/market-data                     │
 │      ?tickers=AAPL,MSFT&range=1y            │
 │    → { series: SeriesData[] }               │
 │                                             │
 │  If benchmarks present:                     │
 │    GET /api/benchmark                       │
 │      ?benchmarks=gold&range=1y              │
 │    → { series: SeriesData[] }               │
 │                                             │
 │  Key files:                                 │
 │    app/api/market-data/route.ts             │
 │    app/api/benchmark/route.ts               │
 └───────────────┬─────────────────────────────┘
                 │ SeriesData[] for each series
                 ▼
 ┌─────────────────────────────────────────────┐
 │ 3. COMPUTE (client)                         │
 │                                             │
 │  a. Normalize each series to % change:      │
 │     common/market-data.ts                   │
 │       → normalizeSeries(series)             │
 │       → normalizeAllSeries(allSeries)       │
 │     Output: NormalizedSeries[]              │
 │       { ticker, points: [{date, value}] }   │
 │                                             │
 │  b. Compute portfolio-level returns:        │
 │     common/portfolio.ts                     │
 │       → computePortfolioReturn(returns, wt) │
 │     Aggregates per-ticker % into one line   │
 │     per portfolio using 1/N weights.        │
 │                                             │
 │  c. Align dates across all series:          │
 │     normalizeAllSeries() keeps only dates   │
 │     present in ALL series.                  │
 └───────────────┬─────────────────────────────┘
                 │ NormalizedSeries[] (aligned)
                 ▼
 ┌─────────────────────────────────────────────┐
 │ 4. RENDER (client)                          │
 │                                             │
 │  a. Chart — line chart of normalized series │
 │     components/Chart.tsx  (implemented)     │
 │     <svg>, one line per series              │
 │     X-axis: date, Y-axis: % change         │
 │     Benchmarks dashed, equities solid       │
 │                                             │
 │  b. Summary — tabular performance stats     │
 │     components/Summary.tsx (implemented)    │
 │     Per-ticker: start price, end price,     │
 │     total return %, simulated dollar value  │
 │                                             │
 │  c. States:                                 │
 │     Loading  → BlockLoader / skeleton       │
 │     Error    → AlertBanner (fetch failures) │
 │     Empty    → LandingState (no query)      │
 └─────────────────────────────────────────────┘
```

### File map — who owns what

Each file below is tagged with its pipeline stage. When making changes, limit PRs to one stage at a time to keep diffs small and reviewable.

| Stage | File | Exists | Role |
| --- | --- | --- | --- |
| **Parse** | `common/parser.ts` | ✓ | Strict v1 equity parser (token validation, reserved-char rejection) |
| **Parse** | `common/query.ts` | ✓ | Entry point: `parseCompareQuery(searchParams) → QueryResult`. Parses equity, benchmark, range, and amount. |
| **Parse** | `common/portfolio.ts` | ✓ | `buildEqualWeightPortfolio()`, `computePortfolioReturn()` |
| **Parse** | `common/types.ts` | ✓ | `PricePoint`, `SeriesData`, `RangeValue`, `BenchmarkValue` |
| **Fetch** | `common/compare-fetcher.ts` | ✓ | Client-side fetch helper — calls `/api/market-data` + `/api/benchmark`, returns typed `SeriesData[]` |
| **Fetch** | `app/api/market-data/route.ts` | ✓ | `GET ?tickers=…&range=…` → `{ series: SeriesData[] }`. Yahoo Finance, 1h cache. |
| **Fetch** | `app/api/benchmark/route.ts` | ✓ | `GET ?benchmarks=…&range=…` → `{ series: SeriesData[] }`. Gold/ETH via Yahoo; USD = synthetic flat baseline. |
| **Fetch** | `app/api/compare/validate/route.ts` | ✓ | Server-side validation only (optional pre-check before fetching data). |
| **Compute** | `common/market-data.ts` | ✓ | `normalizeSeries()`, `normalizeAllSeries()`, `isValidRange()`, `isValidBenchmark()`. Also exports `NormalizedPoint`, `NormalizedSeries` types. |
| **Compute** | `common/portfolio.ts` | ✓ | `computePortfolioReturn()` — weighted sum of per-ticker returns |
| **Render** | `app/page.tsx` | ✓ | Compare page — fully wired: parse → fetch → normalize → Chart |
| **Render** | `components/Chart.tsx` | ✓ | SVG line chart (normalized % change vs time) |
| **Render** | `components/Chart.module.css` | ✓ | Chart styles |
| **Render** | `components/Summary.tsx` | ✓ | Per-ticker price/return/value summary table |
| **Render** | `components/Summary.module.css` | ✓ | Summary styles |
| **Render** | `components/ErrorState.tsx` | ✓ | Error display (parse + fetch errors) |
| **Render** | `components/LandingState.tsx` | ✓ | Empty/welcome state when no query params (scenario A14) |

### Param translation — client URL to API route

The client-side parser reads user-facing param names; the API routes accept different names. The wiring layer in `app/page.tsx` must translate:

| User URL param | API route param | Translation |
| --- | --- | --- |
| `equity=AAPL,MSFT` | `tickers=AAPL,MSFT` | Rename `equity` → `tickers`; value unchanged |
| `benchmark=gold\|eth` | `benchmarks=gold\|eth` | Rename `benchmark` → `benchmarks`; value unchanged |
| `range=1y` | `range=1y` | Same name, pass through |
| `amount=10000` | — (client-side only) | Not sent to API routes; used by Summary table for dollar-value simulation |

### Wiring checklist for `app/page.tsx`

Current status of the parse → fetch → compute → render pipeline:

1. **Parse** — done (`useCompareQuery()` returns `CompareQuery`)
2. **Fetch** — done (`useCompareData()` calls `fetchCompareData()` from `common/compare-fetcher.ts`; handles loading, error, and success states)
3. **Compute** — done (raw `SeriesData[]` passed through `normalizeAllSeries()` to produce chart-ready data)
4. **Render** — done (`NormalizedSeries[]` passed to `Chart.tsx`; `Summary.tsx` shows per-ticker prices/returns/value; `ErrorState.tsx` for parse/fetch errors; `LandingState.tsx` for empty/welcome state; `BlockLoader` while loading).

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

Open `http://localhost:10000/?equity=AAPL,MSFT&benchmark=gold` to verify the app is running. For a step-by-step verification procedure, see the [README → Quick Verification Checklist](./README.md#quick-verification-checklist) (3-item summary) or the [SCENARIOS.md → Local Verification Checklist](./SCENARIOS.md#local-verification-checklist) (full procedure with curl tests and browser scenarios).

### 13.1 Available npm scripts

| Script | Command | What it does |
| --- | --- | --- |
| `npm run dev` | `next -p 10000` | Start dev server on port 10000 |
| `npm run build` | `next build` | Production build |
| `npm run start` | `PORT=10000 next start` | Start production server on port 10000 |
| `npm run lint` | `next lint` | Run ESLint via Next.js |
| `npm test` | `vitest run` | Run all unit tests (single run) |
| `npm run test:watch` | `vitest` | Run tests in watch mode |

### 13.2 Tests

**Test runner:** Vitest 4.x (configured in `vitest.config.ts`). Run with:

```sh
npm test              # single run
npm run test:watch    # watch mode
```

**Current test coverage (110 tests passing):**

| Test file | Tests | Covers |
| --- | --- | --- |
| `common/parser.test.ts` | 74 | SCENARIOS.md §1–§15 (all v1 parser scenarios + drift guardrails) |
| `common/query.test.ts` | 16 | Full query parsing: equity + benchmark + range + amount |
| `common/portfolio.test.ts` | 11 | Equal-weight construction + weighted return computation |
| `app/api/compare/validate/route.test.ts` | 9 | Server-side validation endpoint |

- Every scenario in `SCENARIOS.md` sections 1–15 has a corresponding unit test.
- End-to-end scenarios (A1–A30, B1–B15) should have integration or e2e tests as the UI is built out.

### 13.3 Entrypoints

| What | File | Notes |
| --- | --- | --- |
| Main page | `app/page.tsx` | Compare page — parses URL, fetches data, renders chart + summary |
| Root layout | `app/layout.tsx` | Providers wrapper, `theme-light` body class |
| Equity data API | `app/api/market-data/route.ts` | GET `?tickers=…&range=…` |
| Benchmark data API | `app/api/benchmark/route.ts` | GET `?benchmarks=…&range=…` |
| Shared types | `common/types.ts` | `PricePoint`, `SeriesData`, `RangeValue`, `BenchmarkValue`, `VALID_RANGES`, `VALID_BENCHMARKS` |
| Normalization | `common/market-data.ts` | `normalizeSeries()`, `normalizeAllSeries()` |
| Equity parser | `common/parser.ts` | Strict v1 parser — see §3.2 |
| Query entry point | `common/query.ts` | Full URL parsing (equity + benchmark + range + amount) |
| Fetch helper | `common/compare-fetcher.ts` | Client-side fetch — calls `/api/market-data` + `/api/benchmark` |
| Portfolio weights | `common/portfolio.ts` | Equal-weight (1/N) portfolio construction |

---

## 14. Doc Audit Checklist (Task 2)

> Audit performed 2026-02-11. Each item is a concrete drift between docs and current code.

### LIL-INTDEV-AGENTS.md — Fixed by Task 3

- [x] **§7 Directory Structure — `Chart.tsx` / `Chart.module.css` marked `○` but exist.** Updated to `✓`.
- [x] **§7 Directory Structure — `common/compare-fetcher.ts` missing from listing.** Added with `✓`.
- [x] **§8 Existing Codebase Notes — first bullet outdated.** Rewritten to reflect fully wired state.
- [x] **§8 — "No domain-specific UI components exist yet" is wrong.** Updated to list `Chart.tsx` as existing.
- [x] **§11.2 v1 Pipeline Status — Render row says "Not started".** Updated to "Partial" with accurate notes.
- [x] **§11.2 — "Next steps for the render layer" block is stale.** Replaced with remaining render work only.
- [x] **§11.3 Wiring Checklist — steps 2-4 described as TODO.** Updated to reflect completed status.
- [x] **§11.3 File map — `Chart.tsx` and `Chart.module.css` listed as `○`.** Updated to `✓`.
- [x] **§11.3 File map — `common/compare-fetcher.ts` not listed.** Added to Fetch stage with `✓`.

### SCENARIOS.md — Fixed by Task 2

- [x] **A-section / B-section scenario status tracking.** Updated Scenario Implementation Status table — A14 (LandingState), A22 (Summary table), and A29 (landing Try It) now marked as Implemented to match current codebase.

### README.md — Accurate

- [x] **README is accurate.** The "v1 Pipeline Status" table, "Try It" section, and "Known v1 Limitations" all match the current codebase. No changes required.

### package.json — Fixed by Prior PRs

- [x] **`name` field updated.** Now `"www-lil-intdev-portfolio-compare"`.
- [x] **`description` field updated.** Now describes the portfolio compare tool.

### LIL-INTDEV-AGENTS.md + SCENARIOS.md — Fixed by Task 2 (second pass)

- [x] **§3.1 — Note said "client-side parser (not yet implemented — see §7)".** Parser has been implemented since task 7. Updated to reference `common/query.ts` → `common/compare-fetcher.ts`.
- [x] **§11.3 Dataflow diagram — Chart.tsx and Summary.tsx marked "(to be created)".** Both exist. Updated to "(implemented)". Also corrected Summary description from "annualized return %" to "simulated dollar value" to match actual implementation.
- [x] **SCENARIOS.md — Preamble about "[Not yet implemented]" scenarios was generic.** Updated to note that only A23 (chart hover/tooltip) remains unimplemented.

### Summary

| Area | Severity | Items |
| --- | --- | --- |
| **LIL-INTDEV-AGENTS.md** — §7, §8, §11.2, §11.3 | ~~High~~ Fixed | 9 items — all resolved by Task 3 |
| **LIL-INTDEV-AGENTS.md** — §3.1, §11.3 diagram | ~~Low~~ Fixed | 3 items — resolved by Task 2 (second pass) |
| **SCENARIOS.md** | ~~Low~~ Fixed | 2 items — status table (Task 2) + preamble (Task 2 second pass) |
| **README.md** | None | Accurate — no changes needed |
| **package.json** | ~~Low~~ Fixed | 2 items — name/description updated by prior PRs |

---

## 15. v1 Completion Status

> Updated 2026-02-17 — all remaining work resolved. Plan #100 fully executed.

### Remaining-work resolution (#69)

Issue [#69](https://github.com/internet-development/www-lil-intdev-portfolio-compare/issues/69) ("Feedback from #68: remaining work identified") tracked all outstanding v1 work items. **All items are now complete and #69 is closed.**

| Category | Items | Status | PRs |
| --- | --- | --- | --- |
| **Core product gaps** | Summary table, dollar-amount simulation, README maintainers | Done | #101, #103, #106 |
| **UI component extraction** | ErrorState.tsx, LandingState.tsx | Done | #103, #106 |
| **Repo hygiene** | Dead concept routes, ts-node removal, package.json metadata | Done | Prior PRs |
| **Doc sync** | SCENARIOS.md, LIL-INTDEV-AGENTS.md drift corrections | Done | #85–#93, #108, #119 |

### Finish sentinel (#99)

Issue [#99](https://github.com/internet-development/www-lil-intdev-portfolio-compare/issues/99) was the "LIL INTDEV FINISHED" sentinel. It flagged that the workspace was not actually complete while #69 remained open. **#99 is now closed** — rolled into plan #100.

### Plan #100 execution summary

| Task | Description | Status |
| --- | --- | --- |
| Task 1 | Make #69 actionable (restate checklist) | Completed |
| Task 2 | Execute remaining-work items | Completed |
| Task 3 | Update SCENARIOS.md for shipped behavior | Completed |
| Task 4 | Update LIL-INTDEV-AGENTS.md for current architecture | Completed |
| Task 5 | Close loop: close #69 and re-assert completion | Completed |

### Open issues (not v1 blockers)

Remaining open issues are `memo`-labeled items (v2 weight syntax pinning), `discussion` threads, and `plan` tracking — none are v1 work blockers. The v1 product is complete: parse → fetch → normalize → chart + summary, with 110 passing tests covering SCENARIOS.md §1–§15.
