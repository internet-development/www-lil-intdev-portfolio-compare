# Portfolio Compare

Compare equity portfolio performance against commodity and crypto benchmarks. Built with [SRCL](https://sacred.computer) terminal aesthetics.

## URL Format

```
/?equity=TICKER,TICKER,...&benchmark=BENCHMARK|BENCHMARK&range=RANGE
```

All application state lives in the URL. Copy and share any URL to reproduce the exact same view.

### Query Parameters

| Parameter   | Required | Format                        | Default | Description                                      |
| ----------- | -------- | ----------------------------- | ------- | ------------------------------------------------ |
| `equity`    | Yes      | Comma-separated ticker list   | —       | Up to 10 equity tickers (e.g. `AAPL,MSFT,TSMC`) |
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

## Contact

Questions? Ping [@wwwjim](https://www.twitter.com/wwwjim) or [@internetxstudio](https://x.com/internetxstudio).
