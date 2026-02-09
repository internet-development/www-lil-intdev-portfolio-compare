# Portfolio Compare

A small web app that accepts `?equity=TSMC,AAPL,MSFT&benchmark=gold|eth|usd` and displays comparable performance over time.

Built with [SRCL](https://sacred.computer) — a React component library with terminal aesthetics.

## Usage

```
/?equity=AAPL,MSFT&benchmark=gold
/?equity=TSMC,AAPL,MSFT&benchmark=gold|eth|usd
/?equity=AAPL&benchmark=eth&range=5y
```

### Query parameters

| Parameter   | Description                        | Example            |
| ----------- | ---------------------------------- | ------------------ |
| `equity`    | Comma-separated ticker symbols     | `AAPL,MSFT,GOOG`  |
| `benchmark` | Pipe-separated benchmark names     | `gold\|eth\|usd`  |
| `range`     | Time range (default: `1y`)         | `1m,3m,6m,ytd,1y,3y,5y,max` |

### Benchmarks

| Value  | Description                    |
| ------ | ------------------------------ |
| `gold` | Spot gold price (XAU/USD)      |
| `eth`  | Ethereum price (ETH/USD)       |
| `usd`  | US Dollar cash baseline (0%)   |

## Development

```sh
npm install
npm run dev
```

Go to `http://localhost:10000` in your browser.

We use [Vercel](https://vercel.com/home) for hosting.
