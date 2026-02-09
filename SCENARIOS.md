# SCENARIOS — v1 Query Parser Acceptance Contract

Strict, testable scenarios for the `equity=` URL query parameter parser.
These define the **v1 acceptance contract** — any behavior not listed here is undefined and must be rejected.

> **v1 is equal-weight only.** Every ticker in a portfolio receives weight 1/N. Custom weights are reserved for v2 (see §7 and §14).

> **URL format (single portfolio):** `?equity=TICKER,TICKER,...`
> **URL format (multi-portfolio):** `?equity=TICKER,TICKER,...&equity=TICKER,TICKER,...`

### Canonical parameter name

The user-facing query parameter for specifying equities is **`equity`** (singular). This was chosen over alternatives (`portfolios`, `tickers`, `stocks`) for consistency with the codebase and URL brevity. The API route internally uses `tickers` (see LIL-INTDEV-AGENTS.md §3.1), but the client-side parser reads `equity` from the browser URL.

### Validation pipeline order

When the parser processes the `equity` param(s), checks run in this order per portfolio, and the **first failure stops all processing** (fail-fast):

1. **Portfolio count** — reject if `> MAX_PORTFOLIOS` (5)
2. **Empty value** — reject if an `equity=` param has an empty string value
3. **Split on comma** — tokenize the value
4. **Per-token, left to right:**
   a. **Trim whitespace** (leading/trailing)
   b. **Empty token** — reject if token is empty after trim
   c. **Reserved characters** — reject if token contains `:` or `=` (v2-reserved)
   d. **Illegal characters** — reject if token contains chars outside `[A-Za-z0-9.\-]`
   e. **Must start with letter** — reject if first char is not `[A-Za-z]`
   f. **Max length** — reject if token length > `MAX_TICKER_LENGTH` (10)
   g. **Uppercase** — normalize to uppercase
   h. **Duplicate check** — reject if ticker already seen in this portfolio (post-normalization)
5. **Ticker count** — reject if portfolio has `> MAX_TICKERS_PER_PORTFOLIO` (20)

Portfolios are processed left to right (first `equity=` param is portfolio 1, etc.). Processing halts on the first error across all portfolios.

---

## 1. Happy Path — Valid Input

### 1.1 Single ticker

```
Given the URL query string is "?equity=AAPL"
When the v1 query parser processes the input
Then portfolio 1 contains ["AAPL"]
And no error is returned
```

### 1.2 Multiple tickers (comma-separated)

```
Given the URL query string is "?equity=AAPL,MSFT,GOOG"
When the v1 query parser processes the input
Then portfolio 1 contains ["AAPL", "MSFT", "GOOG"]
And no error is returned
```

### 1.3 Ordering is preserved

```
Given the URL query string is "?equity=GOOG,AAPL,MSFT"
When the v1 query parser processes the input
Then portfolio 1 contains ["GOOG", "AAPL", "MSFT"]
And the order matches the input order exactly
```

### 1.4 Multiple portfolios via repeated equity params

```
Given the URL query string is "?equity=AAPL,MSFT&equity=GOOG,TSLA"
When the v1 query parser processes the input
Then portfolio 1 contains ["AAPL", "MSFT"]
And portfolio 2 contains ["GOOG", "TSLA"]
And no error is returned
```

### 1.5 Single ticker per portfolio, multiple portfolios

```
Given the URL query string is "?equity=AAPL&equity=MSFT&equity=GOOG"
When the v1 query parser processes the input
Then portfolio 1 contains ["AAPL"]
And portfolio 2 contains ["MSFT"]
And portfolio 3 contains ["GOOG"]
And no error is returned
```

---

## 2. Ticker Normalization

### 2.1 Lowercase input is uppercased

```
Given the URL query string is "?equity=aapl,msft"
When the v1 query parser processes the input
Then portfolio 1 contains ["AAPL", "MSFT"]
And no error is returned
```

### 2.2 Mixed-case input is uppercased

```
Given the URL query string is "?equity=Aapl,mSfT,gOOg"
When the v1 query parser processes the input
Then portfolio 1 contains ["AAPL", "MSFT", "GOOG"]
And no error is returned
```

---

## 3. Whitespace Handling

### 3.1 Leading/trailing whitespace on tokens is trimmed

```
Given the URL query string is "?equity= AAPL , MSFT "
When the v1 query parser processes the input
Then portfolio 1 contains ["AAPL", "MSFT"]
And no error is returned
```

### 3.2 Whitespace-only token between commas is treated as empty token

```
Given the URL query string is "?equity=AAPL, ,MSFT"
When the v1 query parser processes the input
Then an error is returned with message: "Empty ticker at position 2"
```

### 3.3 Leading/trailing whitespace on the entire value is trimmed

```
Given the URL query string is "?equity= AAPL,MSFT "
When the v1 query parser processes the input
Then portfolio 1 contains ["AAPL", "MSFT"]
And no error is returned
```

---

## 4. Deduplication

### 4.1 Exact duplicate tickers within a portfolio are rejected

```
Given the URL query string is "?equity=AAPL,MSFT,AAPL"
When the v1 query parser processes the input
Then an error is returned with message: "Duplicate ticker: AAPL"
```

### 4.2 Case-insensitive duplicates within a portfolio are rejected

```
Given the URL query string is "?equity=AAPL,aapl"
When the v1 query parser processes the input
Then an error is returned with message: "Duplicate ticker: AAPL"
```

### 4.3 Duplicates detected after normalization

```
Given the URL query string is "?equity=msft, Msft"
When the v1 query parser processes the input
Then an error is returned with message: "Duplicate ticker: MSFT"
```

### 4.4 Same ticker allowed across different portfolios

```
Given the URL query string is "?equity=AAPL,MSFT&equity=AAPL,GOOG"
When the v1 query parser processes the input
Then portfolio 1 contains ["AAPL", "MSFT"]
And portfolio 2 contains ["AAPL", "GOOG"]
And no error is returned
```

---

## 5. Max Tickers Limit

`MAX_TICKERS_PER_PORTFOLIO = 20`

### 5.1 At the maximum (20 tickers)

```
Given the URL query string is "?equity=A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T"
When the v1 query parser processes the input
Then portfolio 1 contains ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T"]
And no error is returned
```

### 5.2 Exceeding the maximum

```
Given the URL query string is "?equity=A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U"
When the v1 query parser processes the input
Then an error is returned with message: "Too many tickers in portfolio 1: 21 exceeds maximum of 20"
```

---

## 6. Empty and Missing Input

### 6.1 Missing equity parameter entirely

```
Given the URL query string is ""
When the v1 query parser processes the input
Then the parsed portfolios are []
And no error is returned
```

### 6.2 Empty equity value

```
Given the URL query string is "?equity="
When the v1 query parser processes the input
Then an error is returned with message: "Empty equity parameter"
```

### 6.3 Empty token from leading comma

```
Given the URL query string is "?equity=,AAPL"
When the v1 query parser processes the input
Then an error is returned with message: "Empty ticker at position 1"
```

### 6.4 Empty token from trailing comma

```
Given the URL query string is "?equity=AAPL,"
When the v1 query parser processes the input
Then an error is returned with message: "Empty ticker at position 2"
```

### 6.5 Empty token from consecutive commas

```
Given the URL query string is "?equity=AAPL,,MSFT"
When the v1 query parser processes the input
Then an error is returned with message: "Empty ticker at position 2"
```

### 6.6 Only commas

```
Given the URL query string is "?equity=,,,"
When the v1 query parser processes the input
Then an error is returned with message: "Empty ticker at position 1"
```

---

## 7. Reserved Syntax Rejection (`:` and `=` — v2 Weight Syntax)

v1 is **strictly equal-weight**. The colon (`:`) and equals (`=`) characters are reserved for v2 weight syntax (e.g. `equity=AAPL:0.6,MSFT:0.4`). Any occurrence of `:` or `=` inside a ticker token — literal or URL-encoded (`%3A`, `%3D`) — must be rejected with a message that explains it is reserved.

### 7.1 Colon inside a token is rejected

```
Given the URL query string is "?equity=AAPL:0.5"
When the v1 query parser processes the input
Then an error is returned with message: "Invalid character ':' in ticker 'AAPL:0.5' — colons are reserved for v2 weight syntax"
```

### 7.2 URL-encoded colon (%3A) inside a token is rejected

```
Given the URL query string is "?equity=AAPL%3A0.5"
When the v1 query parser processes the input
Then an error is returned with message: "Invalid character ':' in ticker 'AAPL:0.5' — colons are reserved for v2 weight syntax"
```

> **Implementation note:** URL decoding happens before parsing, so `%3A` becomes `:` and is caught by the same colon-rejection rule.

### 7.3 Equals sign inside a token is rejected

```
Given the URL query string is "?equity=AAPL=0.5"
When the v1 query parser processes the input
Then an error is returned with message: "Invalid character '=' in ticker 'AAPL=0.5' — equals signs are reserved"
```

### 7.3a URL-encoded equals (%3D) inside a token is rejected

```
Given the URL query string is "?equity=AAPL%3D0.5"
When the v1 query parser processes the input
Then an error is returned with message: "Invalid character '=' in ticker 'AAPL=0.5' — equals signs are reserved"
```

> **Implementation note:** Same as colon — URL decoding happens before parsing, so `%3D` becomes `=` and is caught by the same rule.

### 7.4 Colon in one of multiple tokens

```
Given the URL query string is "?equity=AAPL,MSFT:0.3,GOOG"
When the v1 query parser processes the input
Then an error is returned with message: "Invalid character ':' in ticker 'MSFT:0.3' — colons are reserved for v2 weight syntax"
```

### 7.5 Semicolon is rejected

```
Given the URL query string is "?equity=AAPL;MSFT"
When the v1 query parser processes the input
Then an error is returned with message: "Invalid character ';' in ticker 'AAPL;MSFT'"
```

### 7.6 Pipe is rejected

```
Given the URL query string is "?equity=AAPL|MSFT"
When the v1 query parser processes the input
Then an error is returned with message: "Invalid character '|' in ticker 'AAPL|MSFT'"
```

---

## 8. Invalid Ticker Format

`MAX_TICKER_LENGTH = 10`

### 8.1 Numeric-only ticker is rejected

```
Given the URL query string is "?equity=1234"
When the v1 query parser processes the input
Then an error is returned with message: "Invalid ticker format: '1234' — must start with a letter"
```

### 8.2 Ticker with special characters is rejected

```
Given the URL query string is "?equity=AA$PL"
When the v1 query parser processes the input
Then an error is returned with message: "Invalid character '$' in ticker 'AA$PL'"
```

### 8.3 Ticker with spaces inside is rejected (after trim)

```
Given the URL query string is "?equity=AA PL"
When the v1 query parser processes the input
Then an error is returned with message: "Invalid character ' ' in ticker 'AA PL'"
```

### 8.4 Ticker with hash is rejected

```
Given the URL query string is "?equity=AAPL#B"
When the v1 query parser processes the input
Then an error is returned with message: "Invalid character '#' in ticker 'AAPL#B'"
```

### 8.5 Ticker with at-sign is rejected

```
Given the URL query string is "?equity=@AAPL"
When the v1 query parser processes the input
Then an error is returned with message: "Invalid character '@' in ticker '@AAPL'"
```

### 8.6 Ticker exceeding max length (10 chars) is rejected

```
Given the URL query string is "?equity=ABCDEFGHIJK"
When the v1 query parser processes the input
Then an error is returned with message: "Ticker too long: 'ABCDEFGHIJK' exceeds 10 character limit"
```

### 8.7 Valid ticker with dot (e.g., BRK.B)

```
Given the URL query string is "?equity=BRK.B"
When the v1 query parser processes the input
Then portfolio 1 contains ["BRK.B"]
And no error is returned
```

### 8.8 Valid ticker with hyphen (e.g., BF-B)

```
Given the URL query string is "?equity=BF-B"
When the v1 query parser processes the input
Then portfolio 1 contains ["BF-B"]
And no error is returned
```

---

## 9. URL Encoding

### 9.1 URL-encoded comma (%2C) works as separator

```
Given the URL query string is "?equity=AAPL%2CMSFT"
When the v1 query parser processes the input
Then portfolio 1 contains ["AAPL", "MSFT"]
And no error is returned
```

### 9.2 URL-encoded space (%20) is trimmed

```
Given the URL query string is "?equity=%20AAPL%20"
When the v1 query parser processes the input
Then portfolio 1 contains ["AAPL"]
And no error is returned
```

### 9.3 Plus sign (+) as space is trimmed

```
Given the URL query string is "?equity=+AAPL+"
When the v1 query parser processes the input
Then portfolio 1 contains ["AAPL"]
And no error is returned
```

### 9.4 URL-encoded colon (%3A) is rejected (same as literal colon)

```
Given the URL query string is "?equity=MSFT%3A0.5"
When the v1 query parser processes the input
Then an error is returned with message: "Invalid character ':' in ticker 'MSFT:0.5' — colons are reserved for v2 weight syntax"
```

---

## 10. Multiple equity Parameters (Multi-Portfolio)

`MAX_PORTFOLIOS = 5`

Each `equity` query parameter defines one portfolio. Multiple `equity` params define multiple portfolios for comparison. Each portfolio is independently validated.

### 10.1 Two portfolios

```
Given the URL query string is "?equity=AAPL,MSFT&equity=GOOG,TSLA,NVDA"
When the v1 query parser processes the input
Then portfolio 1 contains ["AAPL", "MSFT"]
And portfolio 2 contains ["GOOG", "TSLA", "NVDA"]
And no error is returned
```

### 10.2 At the maximum (5 portfolios)

```
Given the URL query string is "?equity=AAPL&equity=MSFT&equity=GOOG&equity=TSLA&equity=NVDA"
When the v1 query parser processes the input
Then 5 portfolios are parsed, each with one ticker
And no error is returned
```

### 10.3 Exceeding the maximum number of portfolios

```
Given the URL query string is "?equity=A&equity=B&equity=C&equity=D&equity=E&equity=F"
When the v1 query parser processes the input
Then an error is returned with message: "Too many portfolios: 6 exceeds maximum of 5"
```

### 10.4 Error in second portfolio does not affect first

```
Given the URL query string is "?equity=AAPL,MSFT&equity=GOOG,,TSLA"
When the v1 query parser processes the input
Then an error is returned with message: "Empty ticker at position 2 in portfolio 2"
```

### 10.5 Empty second equity param

```
Given the URL query string is "?equity=AAPL&equity="
When the v1 query parser processes the input
Then an error is returned with message: "Empty equity parameter in portfolio 2"
```

---

## 11. Unrecognized Query Parameters

### 11.1 Unknown parameters are silently ignored

```
Given the URL query string is "?equity=AAPL&foo=bar"
When the v1 query parser processes the input
Then portfolio 1 contains ["AAPL"]
And no error is returned
And the "foo" parameter is ignored
```

---

## 12. Combined Edge Cases

### 12.1 Normalization + dedup detection

```
Given the URL query string is "?equity= aapl , AAPL "
When the v1 query parser processes the input
Then an error is returned with message: "Duplicate ticker: AAPL"
```

### 12.2 Trailing comma + max limit

```
Given the URL query string is "?equity=A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,"
When the v1 query parser processes the input
Then an error is returned with message: "Empty ticker at position 21"
```

### 12.3 Reserved char in dedup context

```
Given the URL query string is "?equity=AAPL:0.5,AAPL"
When the v1 query parser processes the input
Then an error is returned with message: "Invalid character ':' in ticker 'AAPL:0.5' — colons are reserved for v2 weight syntax"
```

### 12.4 Multi-portfolio with per-portfolio error

```
Given the URL query string is "?equity=AAPL,MSFT&equity=GOOG:0.5"
When the v1 query parser processes the input
Then an error is returned with message: "Invalid character ':' in ticker 'GOOG:0.5' — colons are reserved for v2 weight syntax"
```

> Note: The parser should reject on the **first** error encountered during left-to-right, portfolio-by-portfolio processing. It does not accumulate multiple errors.

---

## 13. Error Behavior Contract

### 13.1 First error wins (fail-fast)

```
Given the URL query string is "?equity=,AAPL:0.5,AAPL"
When the v1 query parser processes the input
Then an error is returned with message: "Empty ticker at position 1"
And parsing stops immediately
```

### 13.2 Error includes enough context to debug

```
Given any error is returned by the v1 query parser
Then the error message includes the offending value or position
And the error message is a single human-readable sentence
```

### 13.3 Multi-portfolio errors include the portfolio number

```
Given an error occurs in portfolio N (where N > 1)
Then the error message includes "in portfolio N"
And the position is relative to that portfolio's token list
```

---

## 14. v2 Weight Syntax — Explicitly Reserved

v2 will introduce **custom per-ticker weights** using the colon syntax:

```
?equity=AAPL:0.6,MSFT:0.4
```

In v1, all of the following are **explicitly rejected**:

| Input pattern         | Rejection reason                                              |
| --------------------- | ------------------------------------------------------------- |
| `AAPL:0.5`            | Colon reserved for v2 weight syntax                          |
| `AAPL%3A0.5`          | URL-encoded colon — same rule applies after decoding         |
| `AAPL:60,MSFT:40`     | Colon reserved for v2 weight syntax                          |
| `AAPL=0.5`            | Equals sign reserved                                         |
| `AAPL%3D0.5`          | URL-encoded equals — same rule applies after decoding        |

**v2 design notes (out of scope for v1 implementation):**
- Weight values will follow the colon: `TICKER:WEIGHT`
- Weights are decimal fractions (e.g., `0.6`) or integer percents (e.g., `60`)
- If all tickers have weights, they must sum to 1.0 (or 100%)
- If no ticker has a weight, v2 falls back to v1 equal-weight behavior
- Mixed weighted/unweighted tickers within a portfolio are undefined

---

## Summary of v1 Constraints

| Rule                           | Limit / Behavior                                     |
| ------------------------------ | ---------------------------------------------------- |
| Parameter name                 | `equity`                                             |
| Canonical meaning              | Each `equity` param = one portfolio                  |
| Separator (within portfolio)   | `,` (comma)                                          |
| Max tickers per portfolio      | 20 (`MAX_TICKERS_PER_PORTFOLIO`)                     |
| Max portfolios                 | 5 (`MAX_PORTFOLIOS`)                                 |
| Max ticker length              | 10 characters                                        |
| Allowed ticker chars           | Letters (`A-Z`), digits (`0-9`), dot (`.`), hyphen (`-`) |
| Ticker must start with         | A letter                                             |
| Case normalization             | All tickers uppercased                               |
| Whitespace                     | Trimmed per-token; inner whitespace rejected         |
| Duplicates (within portfolio)  | Rejected (post-normalization)                        |
| Duplicates (across portfolios) | Allowed                                              |
| Empty tokens                   | Rejected with position                               |
| Reserved chars (`:`, `=`)      | Rejected with v2 forward-compat message              |
| URL-encoded reserved (`%3A`, `%3D`) | Rejected (decoded before parsing)               |
| Other special chars            | Rejected                                             |
| Unknown params                 | Silently ignored                                     |
| Error strategy                 | Fail-fast, first error wins (see validation pipeline order above) |
| Ordering                       | Input order preserved within each portfolio          |
| Weight model                   | **Equal-weight (1/N) only — v2 reserved**            |

---
---

# Acceptance Scenarios — End-to-End

The scenarios below cover the full user experience: opening URLs with both `equity` and `benchmark` params, viewing charts and summaries, handling errors, and operating without API keys.

> **Full URL format:** `/?equity=TICKER,TICKER,...&benchmark=gold|eth|usd&range=1y`

---

## A1. Happy path — equities vs gold benchmark

```
Given  the URL is /?equity=aapl,msft&benchmark=gold
When   the page loads
Then   a performance chart is displayed
  And  the chart shows normalized % change lines for AAPL, MSFT, and Gold
  And  each line is visually distinguishable (color or label)
  And  a summary section is displayed below the chart
  And  the summary includes total return % for each equity and the benchmark
  And  the time range defaults to 1 year
```

## A2. Happy path — equities vs ETH benchmark

```
Given  the URL is /?equity=tsmc,aapl,msft&benchmark=eth
When   the page loads
Then   a performance chart is displayed
  And  the chart shows normalized % change lines for TSMC, AAPL, MSFT, and ETH
  And  the summary shows each ticker's total return over the default period
```

## A3. Happy path — equities vs USD (fiat / cash baseline)

```
Given  the URL is /?equity=aapl&benchmark=usd
When   the page loads
Then   the chart shows AAPL performance against a flat USD baseline (0% return)
  And  the summary clearly labels USD as the cash/fiat baseline
```

## A4. Happy path — multiple benchmarks via pipe separator

```
Given  the URL is /?equity=aapl,msft&benchmark=gold|eth|usd
When   the page loads
Then   the chart includes lines for AAPL, MSFT, Gold, ETH, and USD
  And  benchmarks are visually distinct from equities (e.g. dashed lines vs solid)
  And  the summary groups equities and benchmarks separately
```

## A5. Happy path — multi-portfolio comparison

```
Given  the URL is /?equity=aapl,msft&equity=goog,tsla&benchmark=gold
When   the page loads
Then   a performance chart is displayed
  And  portfolio 1 (AAPL, MSFT) is shown as a single equal-weight line
  And  portfolio 2 (GOOG, TSLA) is shown as a separate equal-weight line
  And  the Gold benchmark is shown as a third line
  And  each line is visually distinguishable
```

---

## A6. Explicit time range — range param

```
Given  the URL is /?equity=aapl&benchmark=gold&range=5y
When   the page loads
Then   the chart displays 5 years of historical data
  And  the summary reflects 5-year total returns
```

## A7. Explicit time range — YTD

```
Given  the URL is /?equity=msft&benchmark=eth&range=ytd
When   the page loads
Then   the chart displays data from January 1 of the current year to today
  And  the summary reflects year-to-date returns
```

---

## A8. Chart assumptions — clearly stated

```
Given  any valid URL with equity and benchmark params
When   the page loads successfully
Then   the chart header or footer displays the assumptions:
       - "All returns are total returns (dividends reinvested where applicable)"
       - "Benchmark prices are spot prices in USD"
       - "Data sourced from [provider name]"
  And  the normalization method is stated (e.g. "Indexed to 100 at start date")
```

---

## A9. Invalid equity ticker — helpful error

```
Given  the URL is /?equity=ZZZZZZ&benchmark=gold
When   the page loads
  And  the data provider returns no data for "ZZZZZZ"
Then   the page displays a clear error message
  And  the error says "No data found for ticker: ZZZZZZ"
  And  the error suggests checking the ticker symbol
  And  no chart is rendered
```

## A10. Mix of valid and invalid tickers

```
Given  the URL is /?equity=aapl,ZZZZZZ,msft&benchmark=gold
When   the page loads
  And  the data provider returns no data for "ZZZZZZ"
Then   the page displays an error for the invalid ticker
  And  the error says "No data found for ticker: ZZZZZZ"
  And  valid tickers are not partially rendered (fail as a group)
```

## A11. Invalid benchmark — unrecognized benchmark name

```
Given  the URL is /?equity=aapl&benchmark=banana
When   the page loads
Then   the page displays a clear error message
  And  the error says "Unknown benchmark: banana"
  And  the error lists valid benchmarks: gold, eth, usd
  And  no chart is rendered
```

## A12. Empty benchmark param

```
Given  the URL is /?equity=aapl&benchmark=
When   the page loads
Then   the page displays only the equity performance (no benchmark line)
  Or   the page displays an error requesting a benchmark value
```

## A13. Missing benchmark param entirely

```
Given  the URL is /?equity=aapl
When   the page loads
Then   the page displays the equity performance without a benchmark line
  And  the summary shows absolute returns only (no relative comparison)
```

---

## A14. No query params — landing state

```
Given  the URL is / (no query params)
When   the page loads
Then   the page displays a welcome/empty state
  And  the empty state explains the URL format:
       "Add ?equity=AAPL,MSFT&benchmark=gold to compare performance"
  And  example links are provided for the user to click
```

## A15. Only benchmark param — no equities

```
Given  the URL is /?benchmark=gold
When   the page loads
Then   the page displays an error: "equity param is required"
  And  no chart is rendered
```

---

## A16. Auth-free operation — no API key required for basic use

```
Given  the app is started with no environment variables set
  And  the data provider does not require authentication (free tier / public API)
When   a user opens /?equity=aapl&benchmark=gold
Then   the page loads and displays the chart and summary
  And  no login, API key prompt, or auth wall is shown
```

## A17. API key required — clear env var prompt

```
Given  the app is started without the required MARKET_DATA_API_KEY env var
  And  the data provider requires an API key
When   a user opens /?equity=aapl&benchmark=gold
Then   the page displays a clear configuration error
  And  the error says "Missing API key. Set the MARKET_DATA_API_KEY environment variable."
  And  the error includes a link or reference to where to obtain the key
  And  no chart is rendered
```

## A18. API key present — data loads successfully

```
Given  the app is started with MARKET_DATA_API_KEY=valid_key_here
When   a user opens /?equity=aapl&benchmark=gold
Then   the data provider is called with the configured key
  And  the chart and summary render successfully
```

## A19. API rate limit or network error

```
Given  the data provider returns a rate limit error (HTTP 429) or network timeout
When   the page attempts to load data
Then   the page displays a clear error: "Data temporarily unavailable. Please try again."
  And  no partial or stale chart is shown
  And  a retry button or auto-retry after delay is offered
```

---

## A20. Shareable URL — state fully encoded in query params

```
Given  a user is viewing /?equity=tsmc,aapl,msft&benchmark=gold|eth&range=1y
When   they copy the URL from the browser address bar
  And  paste it in a new browser tab
Then   the exact same chart and summary are displayed
  And  no server-side session or cookie is required
```

## A21. URL update — changing params updates the view

```
Given  the user is viewing /?equity=aapl&benchmark=gold
When   they manually change the URL to /?equity=msft&benchmark=eth
  And  press Enter
Then   the page re-renders with MSFT vs ETH data
  And  no full page reload is required (client-side navigation)
```

---

## A22. Summary table content

```
Given  a valid URL with equities and benchmark
When   the page loads successfully
Then   the summary table includes for each ticker:
       - Ticker symbol
       - Start price (at beginning of range)
       - End price (at end of range)
       - Total return %
       - Annualized return % (if range > 1 year)
  And  the benchmark rows are clearly separated from equity rows
```

## A23. Chart interaction — hover/tooltip

```
Given  a chart is displayed with multiple lines
When   the user hovers over a data point
Then   a tooltip shows the date and the value for each line at that date
  And  the tooltip is readable and does not obscure critical data
```

---

## A24. Mobile responsiveness

```
Given  the user opens a valid URL on a mobile device (viewport < 768px)
When   the page loads
Then   the chart scales to fit the viewport width
  And  the summary table is scrollable or stacks vertically
  And  all text remains legible
```

---

## Benchmark parameter contract

| Benchmark value | Description                              |
| --------------- | ---------------------------------------- |
| `gold`          | Spot gold price in USD (XAU/USD)         |
| `eth`           | Ethereum price in USD (ETH/USD)          |
| `usd`           | US Dollar cash baseline (flat 0% line)   |

- Benchmark names are **case-insensitive** (e.g. `Gold`, `GOLD`, `gold` all valid)
- Multiple benchmarks are separated by pipe: `benchmark=gold|eth|usd`
- Unknown benchmark names produce a clear error listing valid options
- The benchmark param is **optional** — omitting it shows equity-only performance

## Range parameter contract

| Range value | Description                    |
| ----------- | ------------------------------ |
| `1m`        | 1 month                       |
| `3m`        | 3 months                      |
| `6m`        | 6 months                      |
| `ytd`       | Year to date                  |
| `1y`        | 1 year (default)              |
| `3y`        | 3 years                       |
| `5y`        | 5 years                       |
| `max`       | Maximum available history      |

- Range values are **case-insensitive**
- Invalid range values produce a clear error listing valid options
- If omitted, defaults to `1y`
