# Portfolio Compare

Compare equity portfolio performance against commodity and crypto benchmarks. Built with [SRCL](https://sacred.computer) terminal aesthetics.

## Canonical Docs

| Document | Purpose |
| --- | --- |
| [LIL-INTDEV-AGENTS.md](./LIL-INTDEV-AGENTS.md) | Agent and contributor guidelines — architecture, stack, data flow, directory structure, and v1 constraints |
| [SCENARIOS.md](./SCENARIOS.md) | The v1 acceptance contract — every valid/invalid parser input (§1–§13), end-to-end scenarios (A1–A27, B1–B15), and the verification checklist |

Start here if you are a new collaborator or agent.

## URL Format

```
/?equity=TICKER,TICKER,...&benchmark=BENCHMARK|BENCHMARK&range=RANGE
```

All application state lives in the URL. Copy and share any URL to reproduce the exact same view.

### Query Parameters

| Parameter   | Required | Format                        | Default | Description                                      |
| ----------- | -------- | ----------------------------- | ------- | ------------------------------------------------ |
| `equity`    | Yes      | Comma-separated ticker list   | —       | Up to 20 tickers per portfolio (e.g. `AAPL,MSFT,TSMC`). Repeat for multi-portfolio (max 5). |
| `benchmark` | No       | Pipe-separated benchmark list | —       | One or more benchmarks: `gold`, `eth`, `usd`     |
| `range`     | No       | Time range code               | `1y`    | `1m`, `3m`, `6m`, `ytd`, `1y`, `3y`, `5y`, `max` |

### URL Examples

**Single equity vs gold:**
```
/?equity=AAPL&benchmark=gold
```

**Multiple equities vs gold:**
```
/?equity=TSMC,AAPL,MSFT&benchmark=gold
```

**Multiple equities vs multiple benchmarks:**
```
/?equity=TSMC,AAPL,MSFT&benchmark=gold|eth|usd
```

**Custom time range (5 years):**
```
/?equity=AAPL,MSFT&benchmark=gold&range=5y
```

**Year-to-date comparison:**
```
/?equity=MSFT&benchmark=eth&range=ytd
```

**Equity-only (no benchmark):**
```
/?equity=AAPL,GOOG
```

**Multi-portfolio comparison:**
```
/?equity=AAPL,MSFT&equity=GOOG,TSLA&benchmark=gold
```

See [SCENARIOS.md](./SCENARIOS.md) for the full v1 query contract, validation rules, and error semantics.

### Query Parsing

All URL query parameters are parsed client-side through a single entry point (`common/query.ts → parseCompareQuery`). The parsing flow:

1. **`equity=`** is validated by the strict v1 parser (`common/parser.ts`). Invalid input (reserved `:` or `=` characters, illegal characters, duplicates, etc.) is rejected with a descriptive error message displayed in-page via an `AlertBanner`.
2. **Equal-weight construction:** For a parsed portfolio of N tickers, each ticker is assigned explicit weight **1/N** (`common/portfolio.ts`). There is no implicit weighting — every portfolio carries an explicit `WeightedPortfolio` with per-ticker weights that sum to 1.
3. **`benchmark=`** is validated against the known benchmark list (`gold`, `eth`, `usd`).
4. **`range=`** defaults to `1y` and is validated against the known range list.

The API validation endpoint (`GET /api/compare/validate`) also uses the same parser and returns `400` with an error message for invalid queries.

### Benchmarks

| Value  | Description                              |
| ------ | ---------------------------------------- |
| `gold` | Spot gold price in USD (XAU/USD)         |
| `eth`  | Ethereum price in USD (ETH/USD)          |
| `usd`  | US Dollar cash baseline (flat 0% line)   |

Benchmark names are case-insensitive. Combine multiple with pipe: `benchmark=gold|eth|usd`.

## Assumptions

- **Equal-weight portfolio.** Each equity in the `equity=` list is given equal weight (1/N). There is no syntax for custom weights in v1.
- **No rebalancing.** The portfolio is buy-and-hold from the start date. Weights drift with price changes over the time range.
- **Normalized % change.** All series are indexed to 0% at the start date, making absolute price levels irrelevant for comparison.
- **Total returns.** Dividends are assumed reinvested where applicable.
- **Closing prices in USD.** All equity prices are daily closing prices denominated in USD.
- **Benchmark spot prices.** Gold and ETH use spot prices in USD. USD benchmark is a flat 0% return line representing cash.
- **No currency conversion.** All values are in USD. Non-USD-denominated equities use their USD-listed price.

## Try It

After starting the dev server, paste this URL in your browser to verify the end-to-end flow:

```
http://localhost:10000/?equity=AAPL,MSFT&benchmark=gold&range=1y
```

**What you should see:** The page parses the URL, fetches market data from the API routes, and renders a performance chart showing normalized % change over time for each equity and benchmark. A portfolio summary card displays each ticker with its equal weight (50.0% each), the benchmark (GOLD), the range (1y), and data source attribution. Invalid queries show an inline error banner. A loading indicator appears while data is being fetched.

**More examples to try:**

| URL | What it tests |
| --- | --- |
| `http://localhost:10000/?equity=AAPL,MSFT&benchmark=gold&range=1y` | Two equities vs gold, 1-year |
| `http://localhost:10000/?equity=TSMC,AAPL,MSFT&benchmark=gold\|eth\|usd` | Three equities vs all benchmarks |
| `http://localhost:10000/?equity=AAPL,MSFT&equity=GOOG,TSLA&benchmark=gold` | Multi-portfolio comparison |
| `http://localhost:10000/?equity=AAPL:0.5` | Reserved v2 syntax — should show error |
| `http://localhost:10000/` | Landing state — empty, shows example URL |

### Quick Verification Checklist

After setup, run through these three checks to confirm the app is working:

- [ ] **Happy path (A25):** Open `http://localhost:10000/?equity=AAPL,MSFT&benchmark=gold&range=1y` — you should see a portfolio summary card and a performance chart with solid lines for AAPL/MSFT and a dashed line for Gold.
- [ ] **Invalid input (A26):** Open `http://localhost:10000/?equity=AAPL:0.5` — you should see an error banner: *"colons are reserved for v2 weight syntax"*. No chart renders.
- [ ] **Unit tests:** Run `npm test` — all 98 tests should pass (parser, query, portfolio, validation endpoint).

> **Authoritative source:** The full verification procedure — including curl-based API tests, validation endpoint checks, and additional browser scenarios — lives in [SCENARIOS.md → Local Verification Checklist](./SCENARIOS.md#local-verification-checklist). The checklist above is a quick-reference summary; when in doubt, follow SCENARIOS.md.

## Setup

```sh
npm install
npm run dev
```

Open `http://localhost:10000` in your browser.

## Environment Variables

| Variable              | Required | Description                                                                 |
| --------------------- | -------- | --------------------------------------------------------------------------- |
| `MARKET_DATA_API_KEY` | No*      | API key for the market data provider (only if the chosen provider requires one) |

*If the data provider requires a key and it's missing, the app displays: `"Missing API key. Set the MARKET_DATA_API_KEY environment variable."`

Create a `.env.local` file for local development (gitignored):

```sh
MARKET_DATA_API_KEY=your_key_here
```

## Deployment

This app is designed for zero-config deployment on [Vercel](https://vercel.com):

1. Push your branch to GitHub.
2. Connect the repository to Vercel.
3. If your data provider requires an API key, add `MARKET_DATA_API_KEY` in Vercel's environment variable settings.
4. Deploy. No additional build configuration is needed.

The app works without a paid API key when using free-tier data providers.

## Tech Stack

| Layer       | Technology            |
| ----------- | --------------------- |
| Framework   | Next.js 16 (App Router) |
| Language    | TypeScript            |
| UI          | React 19, CSS Modules |
| Components  | SRCL                  |
| Hosting     | Vercel                |

## v1 Pipeline Status

| Stage | Status | Notes |
| --- | --- | --- |
| **Parse** (URL → validated query) | Done | `common/parser.ts`, `common/query.ts`, `common/portfolio.ts` — 98 unit tests passing |
| **Fetch** (API routes → market data) | Done | `/api/market-data` and `/api/benchmark` return JSON via Yahoo Finance (free, no key) |
| **Compute** (normalize + weight) | Done | `common/market-data.ts` normalizes to % change; `common/portfolio.ts` computes 1/N weights |
| **Render** (chart + summary) | Done | `app/page.tsx` wires parse → fetch → compute → render; `Chart.tsx` renders normalized % change line chart |

## Known v1 Limitations

- **Equal-weight only.** Custom per-ticker weights are not supported. The `:` and `=` characters in ticker tokens are reserved for v2 and will produce an error.
- **Yahoo Finance data source.** Data is fetched from an unofficial Yahoo Finance endpoint (no API key required). Rate limits (~2,000 requests/day per IP) and occasional null data points (holidays, halts) apply. Null closes are silently skipped — no gap-fill is applied.
- **Server-side 1-hour cache.** API route responses are cached for 1 hour (`revalidate: 3600`). Data may lag up to 1 hour behind real-time prices.
- **No client-side caching.** Changing the URL re-fetches all data. There is no client-side cache or deduplication across navigations.
- **Date alignment.** When series have different trading calendars, only dates present in all series are shown. Some data points may be dropped at the edges.
- **No hover tooltips or interactive chart features.** The v1 chart is a static SVG line chart without hover, zoom, or tooltip interactions.
- **No summary table.** The v1 render layer includes a portfolio summary card and chart but does not yet include a detailed summary table with per-ticker start/end prices and annualized returns.

## Contact

Questions? Ping [@wwwjim](https://www.twitter.com/wwwjim) or [@internetxstudio](https://x.com/internetxstudio).
