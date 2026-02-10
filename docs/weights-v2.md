# v2 Weights Contract — Reserved, Not Yet Shipped

> **Status: v2 / NOT IMPLEMENTED.** This document specifies the future weighted-portfolio feature. Nothing here is active in v1. The v1 parser **rejects** all weight syntax with a clear error (see [SCENARIOS.md §7](../SCENARIOS.md) and [parser.ts](../common/parser.ts)).

Origin: [Issue #10](https://github.com/internet-development/www-lil-intdev-portfolio-compare/issues/10)

---

## 1. URL Syntax

Weights use the **colon** (`:`) separator already reserved in v1:

```
?equity=AAPL:0.6,MSFT:0.4
?equity=AAPL:60,MSFT:40            ← percent form
?equity=AAPL,MSFT                   ← no weights → equal-weight (1/N), same as v1
```

Multiple portfolios follow the same `equity=…&equity=…` pattern:

```
?equity=AAPL:0.6,MSFT:0.4&equity=GOOG:0.5,TSLA:0.5&benchmark=gold
```

### 1.1 Token grammar

```
token       = TICKER
            | TICKER ":" WEIGHT

TICKER      = [A-Za-z][A-Za-z0-9.\-]{0,9}      ← same as v1 (max 10 chars, starts with letter)
WEIGHT      = DECIMAL | PERCENT
DECIMAL     = [0-9]+ "." [0-9]+                  ← e.g. 0.6, 0.25, 1.0
            | "0"                                 ← explicit zero (rejected — see §3.4)
            | "1"                                 ← shorthand for 1.0 (100%)
PERCENT     = [0-9]+ "%"                          ← e.g. 60%, 25%, 100%
```

---

## 2. Weight Format — Decisions

### 2.1 Both decimals and percents are accepted

The parser accepts **both** decimal fractions and integer-percent notation:

| Input | Interpreted as |
| --- | --- |
| `AAPL:0.6` | 60% weight |
| `AAPL:60%` | 60% weight |
| `AAPL:0.25` | 25% weight |
| `AAPL:25%` | 25% weight |
| `AAPL:1` | 100% weight (single-stock portfolio) |
| `AAPL:1.0` | 100% weight |
| `AAPL:100%` | 100% weight |

**Disambiguation rule:** A bare integer without `%` is treated as a decimal fraction if ≤ 1, and rejected as ambiguous if > 1 and missing `%`. This avoids confusion between `60` (is it 60% or 0.60?).

| Input | Interpretation |
| --- | --- |
| `AAPL:0.6` | Decimal → 60% |
| `AAPL:1` | Decimal → 100% |
| `AAPL:60` | **Rejected** — ambiguous. Use `60%` or `0.6` |
| `AAPL:60%` | Percent → 60% |

### 2.2 Internal representation

Weights are stored internally as decimal fractions (`0.0` to `1.0`). Percent inputs are divided by 100 before storage.

---

## 3. Validation Rules

All weight validation occurs **after** the existing v1 ticker validation passes (reserved-char check is replaced by weight parsing in v2).

### 3.1 Weights must sum to 1.0 (tolerance: ±0.01)

```
Given  ?equity=AAPL:0.6,MSFT:0.4
Then   sum = 1.0 → accepted

Given  ?equity=AAPL:0.6,MSFT:0.3
Then   sum = 0.9 → rejected
Error: "Portfolio weights sum to 0.9, must equal 1.0"

Given  ?equity=AAPL:0.601,MSFT:0.4
Then   sum = 1.001 → accepted (within ±0.01 tolerance)
```

Tolerance of ±0.01 accounts for user rounding. Internally, weights are re-normalized to sum to exactly 1.0 after tolerance check.

### 3.2 No negative weights

```
Given  ?equity=AAPL:-0.5,MSFT:1.5
Then   rejected
Error: "Negative weight for ticker 'AAPL': -0.5 — negative weights (short positions) are not supported"
```

Negative weights imply short-selling, which is out of scope.

### 3.3 No zero weights

```
Given  ?equity=AAPL:0,MSFT:1.0
Then   rejected
Error: "Zero weight for ticker 'AAPL' — remove tickers you don't want in the portfolio"
```

A zero-weighted ticker has no effect on portfolio performance and is misleading.

### 3.4 No duplicate tickers (same as v1)

```
Given  ?equity=AAPL:0.5,AAPL:0.5
Then   rejected
Error: "Duplicate ticker: AAPL"
```

This is unchanged from v1 — duplicates are rejected post-normalization.

### 3.5 Mixed weighted/unweighted tokens are rejected

```
Given  ?equity=AAPL:0.6,MSFT,GOOG:0.2
Then   rejected
Error: "Mixed weighted and unweighted tickers — either all tickers must have weights or none"
```

Mixing `:` and bare tickers within a single portfolio is not allowed. Each portfolio is either fully weighted or fully equal-weight.

### 3.6 All-unweighted falls back to v1 equal-weight

```
Given  ?equity=AAPL,MSFT,GOOG
Then   each ticker gets weight 1/3
```

This preserves full backward compatibility with v1 URLs.

### 3.7 Per-portfolio independence

Weight rules apply independently per portfolio. One portfolio can be weighted while another is equal-weight:

```
Given  ?equity=AAPL:0.6,MSFT:0.4&equity=GOOG,TSLA
Then   portfolio 1: AAPL=0.6, MSFT=0.4
  And  portfolio 2: GOOG=0.5, TSLA=0.5 (equal-weight)
```

### 3.8 Weight precision

Weights are parsed with up to 4 decimal places. More than 4 decimal places are rejected:

```
Given  ?equity=AAPL:0.12345
Then   rejected
Error: "Weight precision too high for 'AAPL': max 4 decimal places"
```

---

## 4. Ambiguous integer rejection — examples

| Input | Result | Reason |
| --- | --- | --- |
| `AAPL:0` | Rejected | Zero weight (§3.3) |
| `AAPL:1` | Accepted as 1.0 (100%) | Unambiguous — the only integer ≤ 1 that makes sense |
| `AAPL:2` | Rejected | Ambiguous — is it 200% or 2%? Use `2%` or `0.02` |
| `AAPL:50` | Rejected | Ambiguous — use `50%` or `0.5` |
| `AAPL:50%` | Accepted as 0.5 | Percent form is explicit |
| `AAPL:0.5` | Accepted as 0.5 | Decimal form is explicit |

---

## 5. Rebalancing Semantics

> **Decision: No rebalancing in v2 MVP.**

v2 weights represent the **initial allocation** at the start of the time range. As prices change, actual portfolio weights drift from the initial allocation. The chart shows this natural drift — it does **not** simulate periodic rebalancing.

### 5.1 Why no rebalancing for v2 MVP

- Rebalancing introduces complexity: frequency (daily, monthly, quarterly?), transaction costs, tax implications
- The primary use case is "how would this allocation have performed?" — buy-and-hold answers this simply
- Rebalancing can be added as a v3 feature with an explicit `rebalance=monthly` param

### 5.2 Future rebalancing (v3, not v2)

If introduced later, rebalancing would use a new query param:

```
?equity=AAPL:0.6,MSFT:0.4&rebalance=monthly
```

Valid rebalance values (tentative): `none` (default), `monthly`, `quarterly`, `annually`.

---

## 6. Error Messages

v2 weight errors follow the same conventions as v1 errors (fail-fast, first error wins, human-readable):

| Condition | Error message |
| --- | --- |
| Weights don't sum to 1.0 | `"Portfolio weights sum to {sum}, must equal 1.0"` |
| Negative weight | `"Negative weight for ticker '{TICKER}': {weight} — negative weights (short positions) are not supported"` |
| Zero weight | `"Zero weight for ticker '{TICKER}' — remove tickers you don't want in the portfolio"` |
| Mixed weighted/unweighted | `"Mixed weighted and unweighted tickers — either all tickers must have weights or none"` |
| Ambiguous integer > 1 | `"Ambiguous weight '{value}' for ticker '{TICKER}' — use '{value}%' for percent or '0.{padded}' for decimal"` |
| Precision too high | `"Weight precision too high for '{TICKER}': max 4 decimal places"` |
| Weight > 1.0 (after parsing) | `"Weight exceeds 1.0 for ticker '{TICKER}': {weight}"` |
| Multi-portfolio error | Same as above with `" in portfolio {N}"` suffix |

---

## 7. v2 Validation Pipeline (extends v1)

The v2 pipeline inserts weight parsing between v1 steps 4c and 4d:

1. **Portfolio count** — same as v1
2. **Empty value** — same as v1
3. **Split on comma** — same as v1
4. **Per-token, left to right:**
   a. **Trim whitespace** — same as v1
   b. **Empty token** — same as v1
   c. **Split on colon** — if token contains `:`, split into `TICKER:WEIGHT`
   d. **Ticker validation** — illegal chars, starts-with-letter, max-length, uppercase (same as v1, applied to ticker part only)
   e. **Weight parsing** — parse weight value, check format and range
   f. **Duplicate check** — same as v1
5. **Ticker count** — same as v1
6. **Weight-mode consistency** — all-weighted or all-unweighted per portfolio (§3.5)
7. **Weight sum** — must equal 1.0 ±0.01 (§3.1)

---

## 8. Backward Compatibility

| v1 URL | v2 behavior |
| --- | --- |
| `?equity=AAPL,MSFT` | Works identically — equal-weight 1/N |
| `?equity=AAPL,MSFT&benchmark=gold` | Works identically |
| `?equity=AAPL,MSFT&equity=GOOG,TSLA` | Works identically — both portfolios equal-weight |

**All v1 URLs continue to work in v2 with identical behavior.** The weight syntax is purely additive.

---

## 9. Open Questions for v2 Implementation

These items need decisions before v2 implementation begins:

1. **UI for weight display** — How are weights shown in the summary table? Separate column? Inline with ticker?
2. **Chart legend** — Should the legend show weights (e.g., "AAPL (60%)")?
3. **URL builder UI** — Should the landing page provide a weight-input form?
4. **Percent input in URL** — The `%` character is `%25` when URL-encoded. Should we accept both `AAPL:50%25` (encoded) and `AAPL:50%` (literal)? Recommendation: accept the literal form since `%` followed by non-hex chars won't be mis-decoded.
