# v2 Weight Syntax — Contract & Acceptance Criteria

> **Status: v2 / NOT YET SHIPPED.** This document specifies the reserved weight syntax for a future version. v1 **rejects** all weight syntax (`:` and `=` inside ticker tokens). See [SCENARIOS.md §7](../SCENARIOS.md) and [SCENARIOS.md §14](../SCENARIOS.md) for the v1 rejection rules.

> **Source:** Issue [#10](https://github.com/internet-development/www-lil-intdev-portfolio-compare/issues/10)

---

## 1. URL Syntax

v2 extends the `equity` parameter to support per-ticker weights using a colon separator:

```
?equity=TICKER:WEIGHT,TICKER:WEIGHT,...
```

Examples:

```
?equity=AAPL:0.6,MSFT:0.4
?equity=AAPL:60,MSFT:40
?equity=AAPL:0.5,MSFT:0.3,GOOG:0.2&benchmark=gold
```

The colon (`:`) is the weight delimiter. This character is reserved in v1 and rejected with a forward-compatibility message.

---

## 2. Weight Format

### 2.1 Decimal fractions (canonical form)

Weights are expressed as decimal fractions where the portfolio sums to `1.0`:

```
AAPL:0.6,MSFT:0.4          → AAPL 60%, MSFT 40%
AAPL:0.5,MSFT:0.3,GOOG:0.2 → AAPL 50%, MSFT 30%, GOOG 20%
```

### 2.2 Integer percents (convenience form)

Weights may also be expressed as integers that sum to `100`:

```
AAPL:60,MSFT:40             → AAPL 60%, MSFT 40%
AAPL:50,MSFT:30,GOOG:20     → AAPL 50%, MSFT 30%, GOOG 20%
```

### 2.3 Format detection

The parser determines the format by inspecting whether any weight contains a decimal point:

| Condition | Interpretation |
| --- | --- |
| **Any** weight contains `.` | All weights treated as **decimal fractions** (must sum to ~1.0) |
| **No** weight contains `.` | All weights treated as **integer percents** (must sum to ~100) |

### 2.4 Mixed format rejection

Mixing decimal fractions and integer percents within a single portfolio is **rejected**:

```
?equity=AAPL:0.6,MSFT:40    → ERROR: "Mixed weight formats in portfolio — use all decimals (e.g. 0.6) or all integers (e.g. 60)"
```

**Decision:** Decimals and percents are both allowed, but not mixed within one portfolio. This avoids ambiguity (is `AAPL:0.6,MSFT:40` a 0.6 + 40 = 40.6 portfolio, or a typo?).

---

## 3. Validation Rules

### 3.1 Sum constraint

| Format | Target sum | Tolerance |
| --- | --- | --- |
| Decimal fractions | `1.0` | ± `0.01` (i.e., `0.99` to `1.01`) |
| Integer percents | `100` | ± `1` (i.e., `99` to `101`) |

The tolerance accounts for floating-point rounding when users split thirds or other non-terminating divisions.

If the sum falls outside tolerance:

```
ERROR: "Portfolio weights sum to 0.8 — expected 1.0 (±0.01)"
ERROR: "Portfolio weights sum to 110 — expected 100 (±1)"
```

### 3.2 No negative weights

All weights must be `> 0`. Zero and negative values are rejected:

```
AAPL:-0.5,MSFT:1.5          → ERROR: "Negative weight not allowed: AAPL:-0.5"
AAPL:0,MSFT:1.0             → ERROR: "Zero weight not allowed: AAPL:0 — remove the ticker instead"
```

**Decision:** No short-selling semantics in v2. Negative weights are out of scope.

### 3.3 No duplicate tickers (unchanged from v1)

Duplicate detection remains post-normalization, same as v1. The weight value does not affect dedup:

```
AAPL:0.5,AAPL:0.5           → ERROR: "Duplicate ticker: AAPL"
```

### 3.4 Weight precision

Weights are stored as IEEE 754 doubles. The parser accepts up to 4 decimal places. Weights with more than 4 decimal places are rejected:

```
AAPL:0.33333                 → ERROR: "Weight has too many decimal places: 0.33333 — maximum 4"
AAPL:0.3333,MSFT:0.6667     → OK (sums to 1.0 within tolerance)
```

### 3.5 Weight must be a valid number

Non-numeric weight values are rejected:

```
AAPL:abc                     → ERROR: "Invalid weight 'abc' for ticker AAPL — must be a number"
AAPL:,MSFT:0.5               → ERROR: "Empty weight for ticker AAPL"
AAPL:0.5.5                   → ERROR: "Invalid weight '0.5.5' for ticker AAPL — must be a number"
```

---

## 4. Omitted Weights — Equal-Weight Fallback

### 4.1 All weights omitted → equal-weight (v1 behavior)

If no ticker in a portfolio has a weight, v2 falls back to v1 equal-weight (1/N):

```
?equity=AAPL,MSFT,GOOG      → 1/3 each (same as v1)
```

### 4.2 All weights present → custom allocation

If every ticker in a portfolio has a weight, custom allocation applies:

```
?equity=AAPL:0.5,MSFT:0.3,GOOG:0.2  → custom weights
```

### 4.3 Partial weights → rejected

If some tickers have weights and others don't, the input is rejected:

```
?equity=AAPL:0.6,MSFT,GOOG  → ERROR: "Mixed weighted and unweighted tickers in portfolio — assign weights to all tickers or none"
```

**Decision:** No implicit remainder allocation. Partial weights are ambiguous (does MSFT get 0.4? do MSFT and GOOG split the remainder?). Reject and force the user to be explicit.

---

## 5. Multi-Portfolio Weights

Each portfolio is independently weighted. Portfolios can mix weight strategies:

```
?equity=AAPL:0.6,MSFT:0.4&equity=GOOG,TSLA    → portfolio 1: custom, portfolio 2: equal-weight
```

Weight validation (sum, no negatives, no mixed formats) applies per-portfolio.

---

## 6. Rebalancing Semantics

> **Status: DEFERRED.** Rebalancing is explicitly out of scope for v2 initial launch.

v2 weights define the **initial allocation at the start of the range period**. As prices change over the range, the effective weights drift. This is **buy-and-hold** semantics:

- On day 1, invest according to specified weights
- No rebalancing occurs during the period
- Returns reflect the drift

**Future consideration (v3 or later):**

| Rebalance option | URL syntax (tentative) | Behavior |
| --- | --- | --- |
| None (buy-and-hold) | `rebalance=none` (default) | Weights drift with price |
| Monthly | `rebalance=monthly` | Reset to target weights on 1st of each month |
| Quarterly | `rebalance=quarterly` | Reset to target weights at quarter start |
| Annual | `rebalance=annual` | Reset to target weights on Jan 1 |

This is documented here for future reference but **must not be implemented in v2**.

---

## 7. v2 Acceptance Scenarios

These scenarios define the v2 acceptance contract. They are **not active** — v1 rejects all of these inputs.

### 7.1 Valid weighted portfolio (decimal)

```
Given  the URL query string is "?equity=AAPL:0.6,MSFT:0.4"
When   the v2 query parser processes the input
Then   portfolio 1 contains [("AAPL", 0.6), ("MSFT", 0.4)]
And    no error is returned
```

### 7.2 Valid weighted portfolio (integer percent)

```
Given  the URL query string is "?equity=AAPL:60,MSFT:40"
When   the v2 query parser processes the input
Then   portfolio 1 contains [("AAPL", 0.6), ("MSFT", 0.4)]
And    weights are normalized to decimal fractions internally
And    no error is returned
```

### 7.3 Equal-weight fallback (no weights specified)

```
Given  the URL query string is "?equity=AAPL,MSFT,GOOG"
When   the v2 query parser processes the input
Then   portfolio 1 contains [("AAPL", 0.3333), ("MSFT", 0.3333), ("GOOG", 0.3334)]
And    no error is returned
```

### 7.4 Weights don't sum to 1.0

```
Given  the URL query string is "?equity=AAPL:0.5,MSFT:0.3"
When   the v2 query parser processes the input
Then   an error is returned with message: "Portfolio weights sum to 0.8 — expected 1.0 (±0.01)"
```

### 7.5 Negative weight

```
Given  the URL query string is "?equity=AAPL:-0.5,MSFT:1.5"
When   the v2 query parser processes the input
Then   an error is returned with message: "Negative weight not allowed: AAPL:-0.5"
```

### 7.6 Zero weight

```
Given  the URL query string is "?equity=AAPL:0,MSFT:1.0"
When   the v2 query parser processes the input
Then   an error is returned with message: "Zero weight not allowed: AAPL:0 — remove the ticker instead"
```

### 7.7 Mixed weighted and unweighted

```
Given  the URL query string is "?equity=AAPL:0.6,MSFT,GOOG"
When   the v2 query parser processes the input
Then   an error is returned with message: "Mixed weighted and unweighted tickers in portfolio — assign weights to all tickers or none"
```

### 7.8 Mixed decimal and integer formats

```
Given  the URL query string is "?equity=AAPL:0.6,MSFT:40"
When   the v2 query parser processes the input
Then   an error is returned with message: "Mixed weight formats in portfolio — use all decimals (e.g. 0.6) or all integers (e.g. 60)"
```

### 7.9 Duplicate ticker with weights

```
Given  the URL query string is "?equity=AAPL:0.5,AAPL:0.5"
When   the v2 query parser processes the input
Then   an error is returned with message: "Duplicate ticker: AAPL"
```

### 7.10 Multi-portfolio with mixed strategies

```
Given  the URL query string is "?equity=AAPL:0.6,MSFT:0.4&equity=GOOG,TSLA"
When   the v2 query parser processes the input
Then   portfolio 1 contains [("AAPL", 0.6), ("MSFT", 0.4)]
And    portfolio 2 contains [("GOOG", 0.5), ("TSLA", 0.5)]
And    no error is returned
```

### 7.11 Weight with too many decimal places

```
Given  the URL query string is "?equity=AAPL:0.33333,MSFT:0.66667"
When   the v2 query parser processes the input
Then   an error is returned with message: "Weight has too many decimal places: 0.33333 — maximum 4"
```

### 7.12 Invalid weight value

```
Given  the URL query string is "?equity=AAPL:abc"
When   the v2 query parser processes the input
Then   an error is returned with message: "Invalid weight 'abc' for ticker AAPL — must be a number"
```

---

## 8. Open Decisions for v2 Implementation

These are decisions that should be revisited when v2 work begins:

| Decision | Current answer | Notes |
| --- | --- | --- |
| Weight delimiter | `:` (colon) | Already reserved in v1 |
| Decimal vs percent | Both allowed, not mixed | See §2.3 |
| Sum tolerance | ±0.01 / ±1 | May need adjustment based on user feedback |
| Max decimal places | 4 | Balances precision vs usability |
| Partial weights | Rejected | No implicit remainder allocation |
| Rebalancing | Deferred to v3+ | See §6 |
| Short selling (negatives) | Not allowed | Out of scope |
| Weight on URL-encoded `:` (`%3A`) | Decoded before parsing (same as v1) | Consistent with v1 behavior |

---

## 9. Migration Path: v1 → v2

When v2 is implemented:

1. **v1 URLs remain valid.** Any URL that works in v1 (no `:` in tickers) continues to work in v2 with identical equal-weight behavior.
2. **v1 rejection messages become acceptance.** The parser stops rejecting `:` and instead parses weight syntax.
3. **Parser version detection is implicit.** There is no `?version=` param. The presence of `:` in ticker tokens activates weight parsing.
4. **SCENARIOS.md §7 updates.** The v1 rejection scenarios (7.1–7.6) become pass-through scenarios, and the v2 scenarios in this document (§7 above) become the active contract.
5. **Tests update.** v1 rejection tests are replaced by v2 acceptance tests.
