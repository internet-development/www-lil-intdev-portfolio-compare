# SCENARIOS — v1 Query Parser Acceptance Contract

Strict, testable scenarios for the `equity=` URL query parameter parser.
These define the **v1 acceptance contract** — any behavior not listed here is undefined and must be rejected.

> **v1 is equal-weight only.** Every ticker in a portfolio receives weight 1/N. Custom weights are reserved for v2 (see [§7](#v1-reserved-syntax-rejection) and [§14](#v2-weight-syntax)).

> **URL format (single portfolio):** `?equity=TICKER,TICKER,...`
> **URL format (multi-portfolio):** `?equity=TICKER,TICKER,...&equity=TICKER,TICKER,...`

<a id="v1-parsing-invariants"></a>
### v1 Parsing Invariants

The following invariants are pinned by the v1 contract and enforced by unit tests. Any change to these is a breaking change. This section is the SCENARIOS.md counterpart to the [v1 Parsing Invariants (Contract)](./LIL-INTDEV-AGENTS.md#v1-parsing-invariants-contract) section in the agent doc.

- **Exact error strings are pinned.** The colon-rejection message (`"Weights (:) are not supported in v1. Use a comma-separated list of tickers like \"AAPL,MSFT\"."`) is established in #117/#114 and tested with exact-match assertions (`.toBe()`). See [§7](#v1-reserved-syntax-rejection) (especially §7.7–§7.10) for the full specification.
- **Reserved-character rejection covers all entry points.** Both the client-side parser (`common/parser.ts`) and the server-side validate endpoint (`app/api/compare/validate/route.ts`) reject `:` and `=` with the same pinned messages. See [§7.9](#v1-colon-entry-points) for the entry-point coverage table.
- **Validation pipeline order is the contract.** The fail-fast, left-to-right, first-error-wins pipeline defined [below](#v1-validation-pipeline) is normative. Implementation must follow it.
- **Test assertion strategy:** Colon-rejection tests use exact match (`.toBe()`), not substring matching. See [§7.10](#v1-test-assertion-strategy) for the rationale and policy.

### Canonical parameter name

The user-facing query parameter for specifying equities is **`equity`** (singular). This was chosen over alternatives (`portfolios`, `tickers`, `stocks`) for consistency with the codebase and URL brevity. The API route internally uses `tickers` (see LIL-INTDEV-AGENTS.md §3.1), but the client-side parser reads `equity` from the browser URL.

<a id="v1-validation-pipeline"></a>
### Validation pipeline order

When the parser processes the `equity` param(s), checks run in this order per portfolio, and the **first failure stops all processing** (fail-fast):

1. **Portfolio count** — reject if `> MAX_PORTFOLIOS` (5)
2. **Empty value** — reject if an `equity=` param has an empty string value
3. **Split on comma** — tokenize the value
4. **Per-token, left to right:**
   a. **Trim whitespace** (leading/trailing)
   b. **Empty token** — reject if token is empty after trim
   c. **Reserved characters** — reject if token contains `:` or `=` (v2-reserved). For `:`, use pinned error from #117 (see §7.7)
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

<a id="v1-reserved-syntax-rejection"></a>
## 7. Reserved Syntax Rejection (`:` and `=` — v2 Weight Syntax)

v1 is **strictly equal-weight**. The colon (`:`) and equals (`=`) characters are reserved for v2 weight syntax (e.g. `equity=AAPL:0.6,MSFT:0.4`). Any occurrence of `:` or `=` inside a ticker token — literal or URL-encoded (`%3A`, `%3D`) — must be rejected. For colons, the **pinned v1 error message** (established in #117/#114) is:

> `Weights (:) are not supported in v1. Use a comma-separated list of tickers like "AAPL,MSFT".`

### 7.1 Colon inside a token is rejected

```
Given the URL query string is "?equity=AAPL:0.5"
When the v1 query parser processes the input
Then an error is returned with message: "Weights (:) are not supported in v1. Use a comma-separated list of tickers like \"AAPL,MSFT\"."
```

### 7.2 URL-encoded colon (%3A) inside a token is rejected

```
Given the URL query string is "?equity=AAPL%3A0.5"
When the v1 query parser processes the input
Then an error is returned with message: "Weights (:) are not supported in v1. Use a comma-separated list of tickers like \"AAPL,MSFT\"."
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
Then an error is returned with message: "Weights (:) are not supported in v1. Use a comma-separated list of tickers like \"AAPL,MSFT\"."
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

### 7.7 Weight syntax with single ticker is rejected (v1 contract — #117)

> **Pinned error string:** The user-facing error for any `:` weight syntax MUST be exactly the message below. This was established in #117/#114 and is the canonical v1 rejection message for weight syntax.

```
Given the URL query string is "?equity=AAPL:0.5"
When the v1 query parser processes the input
Then an error is returned with message: "Weights (:) are not supported in v1. Use a comma-separated list of tickers like \"AAPL,MSFT\"."
And no API fetch is made
And no chart is rendered
```

### 7.8 Weight syntax with multiple tickers is rejected (v1 contract — #117)

```
Given the URL query string is "?equity=AAPL:0.5,MSFT"
When the v1 query parser processes the input
Then an error is returned with message: "Weights (:) are not supported in v1. Use a comma-separated list of tickers like \"AAPL,MSFT\"."
And no API fetch is made
And no chart is rendered
```

> **Implementation note:** The `:` is detected during per-token validation (step 4c in the validation pipeline). The error message is the same regardless of whether the colon appears in the first or a subsequent token — the pinned string from #117 takes precedence over the per-character error format used in §7.1–7.4. Scenarios 7.1–7.4 are updated to use this canonical message. See also #114, #118, #121.

<a id="v1-colon-entry-points"></a>
### 7.9 Colon rejection applies to all entry points that accept user tickers (#132)

The `:` rejection contract applies **everywhere user-entered tickers or portfolios are parsed**. In v1, the only query parameter that accepts ticker input is `equity=`. This parameter is parsed in two code paths:

| Entry point | File | How `:` is rejected |
| --- | --- | --- |
| **Client-side parser** | `common/parser.ts` → `parsePortfolios()` | Checks each token for `:` before any other character validation. Returns the pinned error string. |
| **Server-side validate endpoint** | `app/api/compare/validate/route.ts` | Delegates to `parsePortfolios()` — same parser, same error. Returns HTTP 400 with `{ "error": "..." }`. |

No other v1 query parameter (`benchmark`, `range`, `amount`) accepts ticker-like input, so `:` rejection is scoped to `equity=` only.

**Concrete example — full URL showing expected failure:**

```
URL:    http://localhost:10000/?equity=AAPL:0.6,MSFT:0.4&benchmark=gold&range=1y
Result: HTTP 400 (via validate endpoint) / "Invalid query" error banner (via client parser)
Error:  "Weights (:) are not supported in v1. Use a comma-separated list of tickers like \"AAPL,MSFT\"."
```

```sh
# Verify via the server-side validate endpoint:
curl -s "http://localhost:10000/api/compare/validate?equity=AAPL:0.6,MSFT:0.4" | jq '.error'
# Expected: "Weights (:) are not supported in v1. Use a comma-separated list of tickers like \"AAPL,MSFT\"."
```

**Why `:` is rejected:** The colon character is **reserved for v2 weight syntax** (e.g., `equity=AAPL:0.6,MSFT:0.4`). Rejecting it in v1 ensures forward compatibility — users receive a clear message explaining the v2 reservation rather than a confusing parse failure. See §14 for the full v2 design and [`docs/weights-v2.md`](./docs/weights-v2.md) for the detailed v2 contract.

<a id="v1-test-assertion-strategy"></a>
### 7.10 Test assertion strategy for the pinned error string (#132)

Tests for the `:` rejection use **exact string equality** (`.toBe()`), **not** substring matching (`.toContain()`). This is the default and recommended approach.

| Assertion method | Used for | Rationale |
| --- | --- | --- |
| **Exact match** (`.toBe()`) | All colon-rejection tests (§7.1, §7.2, §7.4, §7.7, §7.8, §9.4, §12.3, §12.4, §14 table rows) | The pinned error string is a **v1 contract commitment** — any change to the message wording, punctuation, or casing is a breaking change that must be intentional. Exact match catches unintended drift. |
| Substring match (`.toContain()`) | Only §13.2 (generic "error includes context" check) | Used in the meta-test that verifies errors are debuggable, where the exact message format varies by error type. |

**If a future change requires relaxing to substring matching**, update this section to document the decision and the stable substring to assert (e.g., `"Weights (:) are not supported in v1"`). Until then, **default to exact match**.

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
Then an error is returned with message: "Weights (:) are not supported in v1. Use a comma-separated list of tickers like \"AAPL,MSFT\"."
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
Then an error is returned with message: "Weights (:) are not supported in v1. Use a comma-separated list of tickers like \"AAPL,MSFT\"."
```

### 12.4 Multi-portfolio with per-portfolio error

```
Given the URL query string is "?equity=AAPL,MSFT&equity=GOOG:0.5"
When the v1 query parser processes the input
Then an error is returned with message: "Weights (:) are not supported in v1. Use a comma-separated list of tickers like \"AAPL,MSFT\"."
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

<a id="v2-weight-syntax"></a>
## 14. v2 Weight Syntax — Explicitly Reserved

v2 will introduce **custom per-ticker weights** using the colon syntax:

```
?equity=AAPL:0.6,MSFT:0.4
```

In v1, all of the following are **explicitly rejected**:

| Input pattern         | Rejection reason                                              | Pinned error message (#117)                                    |
| --------------------- | ------------------------------------------------------------- | -------------------------------------------------------------- |
| `AAPL:0.5`            | Colon reserved for v2 weight syntax                          | `Weights (:) are not supported in v1. Use a comma-separated list of tickers like "AAPL,MSFT".` |
| `AAPL%3A0.5`          | URL-encoded colon — same rule applies after decoding         | *(same as above)*                                              |
| `AAPL:60,MSFT:40`     | Colon reserved for v2 weight syntax                          | *(same as above)*                                              |
| `AAPL:0.5,MSFT`       | Colon in first token with valid second token                 | *(same as above)*                                              |
| `AAPL=0.5`            | Equals sign reserved                                         | `Invalid character '=' in ticker 'AAPL=0.5' — equals signs are reserved` |
| `AAPL%3D0.5`          | URL-encoded equals — same rule applies after decoding        | *(same as above)*                                              |

**v2 design notes (out of scope for v1 implementation):**

> The full v2 weights contract — including token grammar, validation rules, error messages, and rebalancing semantics — is specified in [`docs/weights-v2.md`](./docs/weights-v2.md). The summary below captures the key decisions.

- **Syntax:** Weight values follow the colon: `TICKER:WEIGHT` (e.g., `AAPL:0.6` or `AAPL:60%`)
- **Format:** Both decimal fractions (`0.6`) and explicit percent (`60%`) are accepted. Bare integers > 1 without `%` are rejected as ambiguous (e.g., `AAPL:60` → error; use `AAPL:60%` or `AAPL:0.6`)
- **Sum constraint:** All weights in a portfolio must sum to 1.0 (±0.01 tolerance for rounding)
- **No negatives:** Negative weights (short positions) are rejected
- **No zeros:** Zero-weight tickers are rejected — remove the ticker instead
- **No duplicates:** Same as v1 — duplicate tickers within a portfolio are rejected
- **No mixing:** Mixed weighted/unweighted tickers within a portfolio are rejected (all or nothing)
- **Equal-weight fallback:** If no ticker has a weight, v2 falls back to v1 equal-weight (1/N) behavior — full backward compatibility
- **Per-portfolio independence:** One portfolio can be weighted while another is equal-weight
- **Rebalancing:** Not in v2. Weights represent initial allocation; portfolio drifts with price changes (buy-and-hold). Rebalancing is deferred to v3 with a `rebalance=` param
- **Precision:** Max 4 decimal places per weight

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
| Reserved chars (`:`, `=`)      | Rejected — `:` uses pinned message from #117: `Weights (:) are not supported in v1. Use a comma-separated list of tickers like "AAPL,MSFT".` |
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

> **Full URL format:** `/?equity=TICKER,TICKER,...&benchmark=gold|eth|usd&range=1y&amount=10000`

Each scenario is a concrete **"do X, observe Y"** step list that a reviewer can execute locally against `http://localhost:10000`. Scenarios marked **[Implemented]** describe behavior that works today. Scenarios marked **[Not yet implemented]** describe expected future v1 behavior — the feature is designed but not yet built (currently only A23: chart hover/tooltip).

---

## A1. Happy path — equities vs gold benchmark [Implemented]

**Steps:**
1. Start the dev server: `npm run dev`
2. Open `http://localhost:10000/?equity=AAPL,MSFT&benchmark=gold` in a browser

**Expected:**
- A "PORTFOLIO COMPARE" card is displayed showing:
  - AAPL (50.0%) and MSFT (50.0%) with "equal weight (1/2)" label
  - Benchmarks: GOLD
  - Range: 1y
  - Investment: $10,000
  - Data loaded line showing tickers and source (Yahoo Finance)
- A "PERFORMANCE" card is displayed containing an SVG line chart
- The chart shows normalized % change lines for AAPL, MSFT, and Gold
- Each line is a different color; Gold is rendered with a dashed line
- Below the chart: a legend with color swatches and ticker labels
- Below the legend: attribution text "Indexed to % change from start date — Source: Yahoo Finance"
- A "SUMMARY" card is displayed with a table showing per-ticker start price, end price, return %, and simulated dollar value (equal-weight split of $10,000)
- No error banners are visible

**Verification:**
```sh
# Verify API routes return data independently:
curl -s "http://localhost:10000/api/market-data?tickers=AAPL,MSFT&range=1y" | jq '.series | length'
# Expected: 2

curl -s "http://localhost:10000/api/benchmark?benchmarks=gold&range=1y" | jq '.series | length'
# Expected: 1
```

---

## A2. Happy path — equities vs ETH benchmark [Implemented]

**Steps:**
1. Open `http://localhost:10000/?equity=TSMC,AAPL,MSFT&benchmark=eth`

**Expected:**
- Portfolio card shows TSMC (33.3%), AAPL (33.3%), MSFT (33.3%) with "equal weight (1/3)"
- Benchmarks: ETH
- Range: 1y (default)
- Investment: $10,000
- Chart shows four lines: TSMC, AAPL, MSFT (solid), ETH (dashed)

---

## A3. Happy path — equities vs USD (cash baseline) [Implemented]

**Steps:**
1. Open `http://localhost:10000/?equity=AAPL&benchmark=usd`

**Expected:**
- Portfolio card shows AAPL (100.0%) with "equal weight (1/1)"
- Benchmarks: USD
- Investment: $10,000
- Chart shows AAPL performance as a solid line and USD as a dashed flat line at 0%
- The 0% reference line is visible on the chart

**Verification:**
```sh
curl -s "http://localhost:10000/api/benchmark?benchmarks=usd&range=1y" | jq '.series[0].source'
# Expected: "Cash baseline"
```

---

## A4. Happy path — multiple benchmarks via pipe separator [Implemented]

**Steps:**
1. Open `http://localhost:10000/?equity=AAPL,MSFT&benchmark=gold|eth|usd`

**Expected:**
- Chart includes five lines: AAPL, MSFT (solid), Gold, ETH, USD (all dashed)
- Legend shows all five tickers with distinct colors
- Benchmark lines are visually distinct from equity lines (dashed vs solid)

---

## A5. Happy path — multi-portfolio comparison [Implemented]

**Steps:**
1. Open `http://localhost:10000/?equity=AAPL,MSFT&equity=GOOG,TSLA&benchmark=gold`

**Expected:**
- Portfolio card shows:
  - Portfolio 1: AAPL (50.0%), MSFT (50.0%) — equal weight (1/2)
  - Portfolio 2: GOOG (50.0%), TSLA (50.0%) — equal weight (1/2)
  - Benchmarks: GOLD
  - Investment: $10,000
- Chart shows individual ticker lines for AAPL, MSFT, GOOG, TSLA (solid) and Gold (dashed)
- Each line is visually distinguishable by color

> **Note:** v1 renders individual ticker lines, not composite portfolio-level lines. Composite equal-weight portfolio lines are a future enhancement.

---

## A6. Explicit time range — range param [Implemented]

**Steps:**
1. Open `http://localhost:10000/?equity=AAPL&benchmark=gold&range=5y`

**Expected:**
- Portfolio card shows Range: 5y
- Chart displays approximately 5 years of data (weekly interval from Yahoo)
- X-axis labels span ~5 years

**Verification:**
```sh
curl -s "http://localhost:10000/api/market-data?tickers=AAPL&range=5y" | jq '.series[0].points | length'
# Expected: ~250 weekly data points
```

---

## A7. Explicit time range — YTD [Implemented]

**Steps:**
1. Open `http://localhost:10000/?equity=MSFT&benchmark=eth&range=ytd`

**Expected:**
- Portfolio card shows Range: ytd
- Chart displays data from approximately January 1 of the current year to today
- X-axis labels begin around Jan of the current year

---

## A8. Chart attribution — clearly stated [Implemented]

**Steps:**
1. Open any valid URL, e.g. `http://localhost:10000/?equity=AAPL&benchmark=gold`

**Expected:**
- Below the chart and legend, attribution text reads:
  `"Indexed to % change from start date — Source: Yahoo Finance"`
- If both equity and benchmark data come from different sources (e.g., Yahoo Finance + Cash baseline), both sources are listed

---

## A9. Invalid equity ticker — fetch error [Implemented]

**Steps:**
1. Open `http://localhost:10000/?equity=ZZZZZZ&benchmark=gold`

**Expected:**
- The URL parses without error (ZZZZZZ is a valid format)
- A loading indicator appears while data is fetched
- After the fetch completes, a "Fetch error" banner is displayed with text:
  `"No data found for ticker: ZZZZZZ"`
- No chart is rendered

**Verification:**
```sh
curl -s "http://localhost:10000/api/market-data?tickers=ZZZZZZ&range=1y"
# Expected: HTTP 404, body: { "error": "No data found for ticker: ZZZZZZ" }
```

---

## A10. Mix of valid and invalid tickers [Implemented]

**Steps:**
1. Open `http://localhost:10000/?equity=AAPL,ZZZZZZ,MSFT&benchmark=gold`

**Expected:**
- A "Fetch error" banner is displayed: `"No data found for ticker: ZZZZZZ"`
- No chart is rendered — the entire request fails, no partial render
- The portfolio summary card may still be visible showing the parsed query

**Verification:**
```sh
curl -s "http://localhost:10000/api/market-data?tickers=AAPL,ZZZZZZ,MSFT&range=1y"
# Expected: HTTP 404 with error for ZZZZZZ (sequential fetch fails on first bad ticker)
```

---

## A11. Invalid benchmark — unrecognized name [Implemented]

**Steps:**
1. Open `http://localhost:10000/?equity=AAPL&benchmark=banana`

**Expected:**
- An "Invalid query" error banner is displayed with text:
  `"Unknown benchmark: 'banana'. Valid benchmarks: gold, eth, usd"`
- No chart is rendered
- No API fetch is made (the parser rejects before fetching)

---

## A12. Empty benchmark param [Implemented]

**Steps:**
1. Open `http://localhost:10000/?equity=AAPL&benchmark=`

**Expected:**
- The empty benchmark is treated as no benchmark (empty string tokens are skipped)
- The page displays AAPL performance without a benchmark line
- Portfolio card shows no Benchmarks section (or empty)

---

## A13. Missing benchmark param entirely [Implemented]

**Steps:**
1. Open `http://localhost:10000/?equity=AAPL`

**Expected:**
- The page displays AAPL performance chart without any benchmark lines
- No call is made to `/api/benchmark`
- Portfolio card shows AAPL (100.0%), Range: 1y, Investment: $10,000, with no Benchmarks line

---

## A14. No query params — idle state [Implemented]

**Steps:**
1. Open `http://localhost:10000/`

**Expected:**
- No error banners are displayed
- No chart is rendered
- No loading indicator appears
- No API fetches are made
- A `LandingState` card is displayed with:
  - Title: "PORTFOLIO COMPARE"
  - Instructional text: "Compare equity portfolio performance against benchmarks. Add equities to the URL to get started:"
  - Example URL: `?equity=AAPL,MSFT,GOOG&benchmark=gold&range=1y`
  - Hint text: "Add `&amount=10000` to simulate a dollar investment."

---

## A15. Only benchmark param — no equities [Implemented]

**Steps:**
1. Open `http://localhost:10000/?benchmark=gold`

**Expected:**
- The parser returns no error (missing equity param = empty portfolios, scenario 6.1)
- No equity fetch is made
- The benchmark is fetched and rendered as a single dashed line
- Because portfolios are empty, the `LandingState` card is shown (with example URL) instead of a portfolio summary card
- A "PERFORMANCE" card renders the benchmark line
- A "SUMMARY" card renders with the benchmark row

> **Note:** Unlike the original A15 which expected an error, the v1 implementation treats missing `equity=` as an empty portfolio list (not an error). This matches parser scenario 6.1. The portfolio summary card is replaced by `LandingState` when no equities are present.

---

## A16. Auth-free operation — no API key required [Implemented]

**Steps:**
1. Ensure no `MARKET_DATA_API_KEY` is set in `.env.local`
2. Start `npm run dev`
3. Open `http://localhost:10000/?equity=AAPL&benchmark=gold`

**Expected:**
- The page loads and displays the chart and summary
- No login, API key prompt, or auth wall is shown
- Data is fetched from Yahoo Finance (free, no key required)

---

## A17. API key required — clear env var prompt [Not yet testable]

> This scenario applies only when the data provider requires an API key. The current provider (Yahoo Finance) does not require one. If Yahoo becomes unavailable and a keyed provider is substituted, this scenario becomes active.

**Steps:**
1. Configure the app to use a provider that requires `MARKET_DATA_API_KEY`
2. Start the app **without** setting that variable
3. Open any valid URL

**Expected:**
- The page displays a configuration error:
  `"Missing API key. Set the MARKET_DATA_API_KEY environment variable."`
- No chart is rendered

---

## A18. API key present — data loads [Not yet testable]

> Same as A17 — only applies when using a keyed provider.

---

## A19. API rate limit or network error [Implemented]

**Steps:**
1. Open a valid URL while the Yahoo Finance endpoint is rate-limited or unreachable

**Expected:**
- A "Fetch error" banner is displayed: `"Data temporarily unavailable. Please try again."`
- No chart is rendered

**Verification (simulated):**
```sh
# Rate limit response from API route:
# If Yahoo returns 429, the API route returns:
# HTTP 429, { "error": "Data temporarily unavailable. Please try again." }
# If Yahoo returns 5xx, the API route returns:
# HTTP 502, { "error": "Data temporarily unavailable. Please try again." }
```

---

## A20. Shareable URL — state fully encoded in query params [Implemented]

**Steps:**
1. Open `http://localhost:10000/?equity=TSMC,AAPL,MSFT&benchmark=gold|eth&range=1y`
2. Copy the URL from the browser address bar
3. Open a new browser tab (or incognito window)
4. Paste the URL and press Enter

**Expected:**
- The exact same chart and summary are displayed (data may differ slightly due to cache timing)
- No server-side session or cookie is required
- The URL alone encodes the complete application state

---

## A21. URL change triggers re-render [Implemented]

**Steps:**
1. Open `http://localhost:10000/?equity=AAPL&benchmark=gold`
2. Wait for the chart to render
3. Manually change the URL to `http://localhost:10000/?equity=MSFT&benchmark=eth` and press Enter

**Expected:**
- The page re-renders: MSFT replaces AAPL, ETH replaces Gold
- A loading indicator appears while new data is fetched
- The chart and portfolio summary update with the new data

> **Note:** In v1, this requires a full page navigation (not SPA-style client-side routing). The `popstate` listener handles browser back/forward navigation within the same session.

---

## A22. Summary table content [Implemented]

**Steps:**
1. Open `http://localhost:10000/?equity=AAPL,MSFT&benchmark=gold&range=1y`

**Expected:**
- A summary table is displayed below the chart with columns: Ticker, Start, End, Return
- Each row shows:
  - **Ticker** — symbol (e.g., AAPL, MSFT, Gold)
  - **Start** — price at beginning of range, formatted as USD (e.g., "$123.45")
  - **End** — price at end of range, formatted as USD
  - **Return** — total return % with sign (e.g., "+15.23%" or "−3.45%")
- Positive returns are displayed in green; negative returns in red
- Both equity and benchmark rows appear in the same table

**With `?amount=` param (dollar-amount simulation):**
1. Open `http://localhost:10000/?equity=AAPL,MSFT&benchmark=gold&range=1y&amount=10000`

**Expected (additional):**
- A **Value** column appears showing the simulated end value for each equity
- The investment amount is split equally across equity tickers only ($5,000 each for 2 equities)
- Benchmark rows show "—" in the Value column (benchmarks do not receive an allocation)
- A **TOTAL** row appears at the bottom showing:
  - Average return % across equities
  - Total portfolio end value (sum of all equity end values)

---

## A23. Chart interaction — hover/tooltip [Not yet implemented — future v1]

> The v1 chart is a static SVG with no interactive features.

**Steps:**
1. Open a valid URL and hover over the chart

**Expected (current):**
- No tooltip appears — this is expected for v1
- The chart is a static SVG line chart

**Expected (future):**
- A tooltip shows the date and value for each line at that date

---

## A24. Mobile responsiveness [Implemented]

**Steps:**
1. Open a valid URL on a mobile device or in a browser with viewport < 768px

**Expected:**
- The chart SVG scales to fit the viewport width (uses `viewBox` with `preserveAspectRatio`)
- All text in the portfolio card remains legible
- The page scrolls vertically if content overflows

---

## A25. End-to-end sanity check — paste URL and verify full pipeline [Implemented]

> This is the definitive v1 smoke test. It verifies parse → fetch → normalize → render.

**Steps:**
1. Start the dev server: `npm run dev`
2. Open `http://localhost:10000/?equity=AAPL,MSFT&benchmark=gold&range=1y`

**Expected:**
- No error banners
- A "PORTFOLIO COMPARE" card showing:
  - AAPL (50.0%) and MSFT (50.0%) with "equal weight (1/2)" label
  - Benchmarks: GOLD
  - Range: 1y
  - Investment: $10,000
  - Data loaded: AAPL, MSFT, Gold — Source: Yahoo Finance
- A "PERFORMANCE" card with an SVG line chart:
  - Solid lines for AAPL and MSFT
  - Dashed line for Gold
  - Legend with color swatches
  - Attribution text
- A "SUMMARY" card with a table showing per-ticker start/end prices, return %, and simulated dollar value
- A loading indicator appeared briefly before the chart rendered

---

## A26. Parse error — v2 reserved syntax rejected [Implemented]

**Steps:**
1. Open `http://localhost:10000/?equity=AAPL:0.5`

**Expected:**
- An "Invalid query" error banner is displayed:
  `"Weights (:) are not supported in v1. Use a comma-separated list of tickers like "AAPL,MSFT"."`
- No portfolio summary is displayed
- No API fetch is made
- No chart is rendered

---

## A27. API routes return market data independently [Implemented]

> Verifies the fetch layer works independently of the page UI.

**Steps:**
```sh
# Equity data:
curl -s "http://localhost:10000/api/market-data?tickers=AAPL,MSFT&range=1y" | jq '.'
# Expected: HTTP 200, { "series": [ { "ticker": "AAPL", "points": [...], "source": "Yahoo Finance" }, { "ticker": "MSFT", ... } ] }

# Benchmark data:
curl -s "http://localhost:10000/api/benchmark?benchmarks=gold|eth&range=1y" | jq '.'
# Expected: HTTP 200, { "series": [ { "ticker": "Gold", "points": [...], "source": "Yahoo Finance" }, { "ticker": "ETH", ... } ] }

# USD baseline:
curl -s "http://localhost:10000/api/benchmark?benchmarks=usd&range=1y" | jq '.series[0].source'
# Expected: "Cash baseline"
```

**Verify response shape:**
- Each series entry has `ticker` (string), `points` (array of `{date, close}`), and `source` (string)
- Points are sorted oldest → newest
- Dates are ISO 8601 format (e.g., "2024-01-15")

---

## A28. Try It — three equities vs all benchmarks [Implemented]

> This is the most comprehensive "Try it" URL from the [README](./README.md#try-it). It exercises the full pipeline with multiple equities and all three benchmarks at once.

**Steps:**
1. Start the dev server: `npm run dev`
2. Open `http://localhost:10000/?equity=TSMC,AAPL,MSFT&benchmark=gold|eth|usd`

**Expected:**
- A "PORTFOLIO COMPARE" card is displayed showing:
  - TSMC (33.3%), AAPL (33.3%), MSFT (33.3%) with "equal weight (1/3)" label
  - Benchmarks: GOLD, ETH, USD
  - Range: 1y (default, since range param is omitted)
  - Investment: $10,000
- A "PERFORMANCE" card is displayed containing an SVG line chart
- The chart shows six lines: TSMC, AAPL, MSFT (solid) and Gold, ETH, USD (dashed)
- USD appears as a flat 0% baseline
- Each line is a different color; benchmark lines are visually distinct (dashed)
- Legend shows all six tickers with color swatches
- Attribution text is visible below the chart

**Verification:**
```sh
curl -s "http://localhost:10000/api/market-data?tickers=TSMC,AAPL,MSFT&range=1y" | jq '.series | length'
# Expected: 3

curl -s "http://localhost:10000/api/benchmark?benchmarks=gold|eth|usd&range=1y" | jq '.series | length'
# Expected: 3
```

---

## A29. Try It — landing page with no query params [Implemented]

> Matches the README "More examples" entry for `http://localhost:10000/` — verifies the idle state a first-time user sees.

**Steps:**
1. Start the dev server: `npm run dev`
2. Open `http://localhost:10000/`

**Expected:**
- No error banners are displayed
- No chart is rendered
- No loading indicator appears
- No API fetches are made
- A `LandingState` card is displayed with title "PORTFOLIO COMPARE", an example URL (`?equity=AAPL,MSFT,GOOG&benchmark=gold&range=1y`), and a hint about the `&amount=` param

---

## A30. Dollar-amount simulation via `?amount=` param [Implemented]

**Steps:**
1. Open `http://localhost:10000/?equity=AAPL,MSFT&benchmark=gold&range=1y&amount=25000`

**Expected:**
- The summary table includes a **Value** column
- Each equity ticker shows its simulated end value based on an equal split of $25,000 ($12,500 per ticker)
- Benchmark rows (Gold) show "—" in the Value column
- A **TOTAL** row at the bottom shows average return and total portfolio value
- The chart and portfolio summary card are unaffected by the `amount` param

**Default behavior (no `amount` param):**
1. Open `http://localhost:10000/?equity=AAPL,MSFT&benchmark=gold&range=1y`

**Expected:**
- The summary table's **Value** column still appears (default amount is 10000)
- Equal split: $5,000 per ticker for 2 equities

**Invalid amount:**
1. Open `http://localhost:10000/?equity=AAPL&amount=abc`

**Expected:**
- An "Invalid query" error banner: `"Invalid amount: 'abc'. Must be a positive number."`
- No chart or summary table rendered

2. Open `http://localhost:10000/?equity=AAPL&amount=-100`

**Expected:**
- An "Invalid query" error banner: `"Invalid amount: '-100'. Must be a positive number."`

3. Open `http://localhost:10000/?equity=AAPL&amount=0`

**Expected:**
- An "Invalid query" error banner: `"Invalid amount: '0'. Must be a positive number."`

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

## Amount parameter contract

| Aspect | Detail |
| --- | --- |
| Parameter name | `amount` |
| Type | Positive number |
| Default | `10000` (if omitted or empty) |
| Effect | Adds a **Value** column to the summary table showing simulated end value per equity |
| Allocation | Split equally across equity tickers only (benchmarks receive no allocation) |
| Invalid values | `0`, negative numbers, and non-numeric strings produce a clear error |

- The `amount` param does **not** affect the chart — it only affects the summary table
- Benchmarks show "—" in the Value column
- A TOTAL row appears when `amount > 0` and at least one equity is present

---
---

# End-to-End Compare View — UI Wiring Scenarios

The scenarios below cover the full compare page behavior across the wired pipeline: parse → fetch → compute → render. They define loading, success, error, and edge-case states for a reviewer running the app locally at `http://localhost:10000`.

---

## B1. Success — valid query fetches data and renders chart [Implemented]

**Steps:**
1. Open `http://localhost:10000/?equity=AAPL,MSFT&benchmark=gold&range=1y`

**Expected:**
- The page fetches data from `/api/market-data?tickers=AAPL,MSFT&range=1y`
- The page fetches data from `/api/benchmark?benchmarks=gold&range=1y`
- The fetched series are normalized to % change from start date
- A line chart is rendered with one solid line per equity (AAPL, MSFT) and one dashed line for Gold
- A "PORTFOLIO COMPARE" card is displayed with ticker weights, benchmarks, range, and investment amount
- A "SUMMARY" card is displayed with a table showing per-ticker start/end prices, return %, and simulated dollar value

**Verification:**
```sh
# Confirm both API routes return data:
curl -s -o /dev/null -w "%{http_code}" "http://localhost:10000/api/market-data?tickers=AAPL,MSFT&range=1y"
# Expected: 200

curl -s -o /dev/null -w "%{http_code}" "http://localhost:10000/api/benchmark?benchmarks=gold&range=1y"
# Expected: 200
```

---

## B2. Success — equities only, no benchmark [Implemented]

**Steps:**
1. Open `http://localhost:10000/?equity=AAPL,MSFT&range=1y`

**Expected:**
- The page fetches data from `/api/market-data?tickers=AAPL,MSFT&range=1y`
- No call is made to `/api/benchmark`
- The chart renders solid lines for AAPL and MSFT only
- No dashed benchmark lines appear

---

## B3. Success — multi-portfolio with benchmark [Implemented]

**Steps:**
1. Open `http://localhost:10000/?equity=AAPL,MSFT&equity=GOOG,TSLA&benchmark=eth&range=1y`

**Expected:**
- The page fetches data for all four tickers (AAPL, MSFT, GOOG, TSLA) and the ETH benchmark
- The chart shows individual ticker lines (solid for equities, dashed for ETH)
- The portfolio summary card shows two portfolio groups
- Each line is visually distinguishable by color

---

## B4. Loading — spinner visible while fetching [Implemented]

**Steps:**
1. Open `http://localhost:10000/?equity=AAPL,MSFT&benchmark=gold&range=1y`
2. Observe the page while data is being fetched

**Expected:**
- A "LOADING" card is displayed containing a `BlockLoader` animation and text "Fetching market data…"
- No empty or broken chart is shown during loading
- The loading card disappears once data arrives and is replaced by the chart

---

## B5. Loading — summary area during fetch [Implemented]

**Steps:**
1. Open a valid URL and observe the page during the loading phase

**Expected:**
- The portfolio summary card is displayed immediately (it shows parsed query info, not fetched data)
- The "Data loaded" line in the summary card only appears after the fetch completes
- No stale or placeholder data is displayed

---

## B6. Fetch error — network failure shows error state [Implemented]

**Steps:**
1. Open a valid URL while the API endpoint is unreachable (e.g., network disconnected)

**Expected:**
- A "Fetch error" banner is displayed (e.g., "Failed to fetch" or "Data temporarily unavailable. Please try again.")
- No empty chart is rendered
- The portfolio summary card may still be visible (it only depends on parse, not fetch)

---

## B7. Fetch error — benchmark fetch fails [Implemented]

**Steps:**
1. Open `http://localhost:10000/?equity=AAPL&benchmark=gold&range=1y` while the benchmark API endpoint fails

**Expected:**
- A "Fetch error" banner is displayed about the benchmark failure
- No chart is rendered with partial data

> **Implementation detail:** The `fetchCompareData` function in `common/compare-fetcher.ts` catches any fetch error and returns a single error. Both equity and benchmark fetches must succeed for the chart to render.

---

## B8. Fetch error — rate limit (HTTP 429) [Implemented]

**Steps:**
1. Open a valid URL when Yahoo Finance returns HTTP 429

**Expected:**
- A "Fetch error" banner is displayed: `"Data temporarily unavailable. Please try again."`
- No chart is rendered

---

## B9. Invalid query — no fetch occurs [Implemented]

**Steps:**
1. Open `http://localhost:10000/?equity=AAPL:0.5&benchmark=gold`

**Expected:**
- The client-side parser rejects the query immediately
- An "Invalid query" error banner shows: `"Weights (:) are not supported in v1. Use a comma-separated list of tickers like "AAPL,MSFT"."`
- No fetch is made to `/api/market-data` or `/api/benchmark` (parse error prevents fetch)
- No loading indicator is shown

---

## B10. Invalid query — empty equity param [Implemented]

**Steps:**
1. Open `http://localhost:10000/?equity=&benchmark=gold`

**Expected:**
- An "Invalid query" error banner shows: `"Empty equity parameter"`
- No fetch is made to any API route
- No chart is rendered

---

## B11. No query params — idle state [Implemented]

**Steps:**
1. Open `http://localhost:10000/`

**Expected:**
- The page shows the `LandingState` card — no chart, no error, no loading
- No fetch is made to any API route
- The landing card displays a title, example URL, and `&amount=` hint

---

## B12. Partial data — ticker has no data from provider [Implemented]

**Steps:**
1. Open `http://localhost:10000/?equity=AAPL,ZZZZZZ&benchmark=gold&range=1y`

**Expected:**
- A "Fetch error" banner shows: `"No data found for ticker: ZZZZZZ"`
- No chart is rendered (the API route fails the entire batch on the first bad ticker)

**Verification:**
```sh
curl -s "http://localhost:10000/api/market-data?tickers=AAPL,ZZZZZZ&range=1y"
# Expected: HTTP 404, { "error": "No data found for ticker: ZZZZZZ" }
```

---

## B13. Partial data — benchmark series is empty [Implemented]

**Steps:**
1. Open a valid URL where the benchmark provider returns no data points

**Expected:**
- A "Fetch error" banner shows a message about missing benchmark data
- No chart is rendered with a missing benchmark line

---

## B14. Partial data — date range mismatch across series [Implemented]

**Steps:**
1. Open `http://localhost:10000/?equity=AAPL,MSFT&benchmark=gold&range=5y`

**Expected:**
- The chart renders using only dates common to all series (`normalizeAllSeries` intersects date sets)
- Some data points at the edges may be dropped if one series has a shorter history
- The chart still renders correctly with the overlapping range

---

## B15. URL change triggers re-fetch [Implemented]

**Steps:**
1. Open `http://localhost:10000/?equity=AAPL&benchmark=gold&range=1y`
2. Wait for the chart to render
3. Change the URL to `http://localhost:10000/?equity=MSFT&benchmark=eth&range=3y` and press Enter

**Expected:**
- The page re-parses the new query
- A loading indicator appears while new data is fetched
- The chart and portfolio summary update with MSFT and ETH data
- No stale data from the previous query (AAPL / Gold) is visible

---
---

<a id="scenario-implementation-status"></a>
# Scenario Implementation Status

Quick reference for which scenarios are testable today vs. awaiting UI work.

| Scenario | Status | Notes |
| --- | --- | --- |
| **§1–§13** (parser) | **106 unit tests passing** | Run `npm test` to verify. All parser scenarios have dedicated tests. |
| **§14** (v2 reserved) | **Tested** | Parser rejects `:` and `=` with v2-reserved messages. |
| **A1–A8** (happy path) | **Implemented** | Chart renders, attribution visible, all ranges work. |
| **A9–A10** (invalid ticker) | **Implemented** | Fetch error displayed, no partial render. |
| **A11** (invalid benchmark) | **Implemented** | Parser rejects with valid-benchmark list. |
| **A12–A13** (empty/missing benchmark) | **Implemented** | Equity-only chart renders. |
| **A14** (landing state) | **Implemented** | `LandingState.tsx` component with example URLs and `?amount=` hint. |
| **A15** (benchmark only) | **Implemented** | Benchmark-only chart renders (no error — empty portfolios allowed). |
| **A16** (auth-free) | **Implemented** | Yahoo Finance requires no API key. |
| **A17–A18** (API key) | **Not testable** | Only relevant if keyed provider is configured. |
| **A19** (rate limit) | **Implemented** | API routes return appropriate error on 429. |
| **A20** (shareable URL) | **Implemented** | URL encodes all state. |
| **A21** (URL change) | **Implemented** | Page re-renders on navigation. |
| **A22** (summary table) | **Implemented** | `Summary.tsx` shows per-ticker start/end prices, return %, and simulated dollar value. |
| **A23** (hover/tooltip) | **Not yet implemented** | Chart is static SVG. |
| **A24** (mobile) | **Implemented** | SVG scales via viewBox. |
| **A25** (sanity check) | **Implemented** | Full pipeline works. |
| **A26** (v2 rejection) | **Implemented** | Parser error displayed in UI. |
| **A27** (API routes) | **Implemented** | curl-testable. |
| **A28** (all benchmarks Try It) | **Implemented** | 3 equities vs gold\|eth\|usd — README "Try it" example. |
| **A29** (landing Try It) | **Implemented** | `LandingState.tsx` component shows example URLs for first-time users. |
| **A30** (amount simulation) | **Implemented** | `?amount=` param adds Value column to Summary table; default 10000. |
| **B1–B5** (success + loading) | **Implemented** | Chart, loading, and summary all work. |
| **B6–B8** (fetch errors) | **Implemented** | Error banners displayed. |
| **B9–B11** (invalid/empty/idle) | **Implemented** | Parse errors prevent fetch; idle state works. |
| **B12–B14** (partial data) | **Implemented** | Batch fail on bad ticker; date alignment works. |
| **B15** (re-fetch) | **Implemented** | URL change triggers full re-render. |

---

<a id="local-verification-checklist"></a>
# Local Verification Checklist

> **This is the canonical "Try it" procedure.** README's [Quick Verification Checklist](./README.md#quick-verification-checklist) is a 3-item summary that points here. If the two ever diverge, this checklist is authoritative.

Run these steps to verify the v1 pipeline end-to-end:

```sh
# 1. Install dependencies
npm install

# 2. Run unit tests (parser + query + portfolio + validate endpoint)
npm test
# Expected: 106 tests passing, 0 failures

# 3. Start the dev server
npm run dev
# Expected: Server running on http://localhost:10000

# 4. Test API routes with curl
curl -s "http://localhost:10000/api/market-data?tickers=AAPL&range=1y" | jq '.series[0].ticker'
# Expected: "AAPL"

curl -s "http://localhost:10000/api/benchmark?benchmarks=gold&range=1y" | jq '.series[0].ticker'
# Expected: "Gold"

curl -s "http://localhost:10000/api/benchmark?benchmarks=usd&range=1y" | jq '.series[0].source'
# Expected: "Cash baseline"

# 5. Test error cases
curl -s "http://localhost:10000/api/market-data?tickers=ZZZZZZ&range=1y" | jq '.error'
# Expected: "No data found for ticker: ZZZZZZ"

curl -s "http://localhost:10000/api/market-data?range=1y"
# Expected: HTTP 400, { "error": "Missing tickers parameter" }

# 6. Test validation endpoint
curl -s "http://localhost:10000/api/compare/validate?equity=AAPL,MSFT&benchmark=gold&range=1y"
# Expected: HTTP 200 with validation result

curl -s "http://localhost:10000/api/compare/validate?equity=AAPL:0.5"
# Expected: HTTP 400, error: "Weights (:) are not supported in v1. Use a comma-separated list of tickers like \"AAPL,MSFT\"."

# 7. Open in browser — verify each scenario:
#    http://localhost:10000/?equity=AAPL,MSFT&benchmark=gold&range=1y          (A1 / A25 — full pipeline)
#    http://localhost:10000/?equity=TSMC,AAPL,MSFT&benchmark=gold|eth|usd      (A28 — all benchmarks, README "Try it")
#    http://localhost:10000/?equity=AAPL,MSFT&equity=GOOG,TSLA&benchmark=gold  (A5 — multi-portfolio)
#    http://localhost:10000/?equity=AAPL&benchmark=usd                         (A3 — USD baseline)
#    http://localhost:10000/?equity=AAPL:0.5                                   (A26 — v2 rejection)
#    http://localhost:10000/                                                   (A14 / A29 — idle state)
#    http://localhost:10000/?equity=ZZZZZZ                                     (A9 — invalid ticker)
#    http://localhost:10000/?equity=AAPL&benchmark=banana                      (A11 — invalid benchmark)
#    http://localhost:10000/?equity=AAPL,MSFT&benchmark=gold&amount=25000      (A30 — dollar-amount simulation)
```
