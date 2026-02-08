# SCENARIOS — v1 Query Parser Acceptance Contract

Strict, testable scenarios for the `equity=` URL query parameter parser.
These define the **v1 acceptance contract** — any behavior not listed here is undefined and must be rejected.

> **URL format:** `?equity=TICKER,TICKER,...`

---

## 1. Happy Path — Valid Input

### 1.1 Single ticker

```
Given the URL query string is "?equity=AAPL"
When the v1 query parser processes the input
Then the parsed tickers are ["AAPL"]
And no error is returned
```

### 1.2 Multiple tickers (comma-separated)

```
Given the URL query string is "?equity=AAPL,MSFT,GOOG"
When the v1 query parser processes the input
Then the parsed tickers are ["AAPL", "MSFT", "GOOG"]
And no error is returned
```

### 1.3 Ordering is preserved

```
Given the URL query string is "?equity=GOOG,AAPL,MSFT"
When the v1 query parser processes the input
Then the parsed tickers are ["GOOG", "AAPL", "MSFT"]
And the order matches the input order exactly
```

---

## 2. Ticker Normalization

### 2.1 Lowercase input is uppercased

```
Given the URL query string is "?equity=aapl,msft"
When the v1 query parser processes the input
Then the parsed tickers are ["AAPL", "MSFT"]
And no error is returned
```

### 2.2 Mixed-case input is uppercased

```
Given the URL query string is "?equity=Aapl,mSfT,gOOg"
When the v1 query parser processes the input
Then the parsed tickers are ["AAPL", "MSFT", "GOOG"]
And no error is returned
```

---

## 3. Whitespace Handling

### 3.1 Leading/trailing whitespace on tokens is trimmed

```
Given the URL query string is "?equity= AAPL , MSFT "
When the v1 query parser processes the input
Then the parsed tickers are ["AAPL", "MSFT"]
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
Then the parsed tickers are ["AAPL", "MSFT"]
And no error is returned
```

---

## 4. Deduplication

### 4.1 Exact duplicate tickers are rejected

```
Given the URL query string is "?equity=AAPL,MSFT,AAPL"
When the v1 query parser processes the input
Then an error is returned with message: "Duplicate ticker: AAPL"
```

### 4.2 Case-insensitive duplicates are rejected

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

---

## 5. Max Tickers Limit

### 5.1 At the maximum (10 tickers)

```
Given the URL query string is "?equity=A,B,C,D,E,F,G,H,I,J"
When the v1 query parser processes the input
Then the parsed tickers are ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]
And no error is returned
```

### 5.2 Exceeding the maximum

```
Given the URL query string is "?equity=A,B,C,D,E,F,G,H,I,J,K"
When the v1 query parser processes the input
Then an error is returned with message: "Too many tickers: 11 exceeds maximum of 10"
```

---

## 6. Empty and Missing Input

### 6.1 Missing equity parameter entirely

```
Given the URL query string is ""
When the v1 query parser processes the input
Then the parsed tickers are []
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

## 7. Reserved Syntax Rejection

These characters are reserved for v2 weight syntax and must be rejected in v1.

### 7.1 Colon inside a token is rejected

```
Given the URL query string is "?equity=AAPL:0.5"
When the v1 query parser processes the input
Then an error is returned with message: "Invalid character ':' in ticker 'AAPL:0.5' — colons are reserved for v2 weight syntax"
```

### 7.2 Equals sign inside a token is rejected

```
Given the URL query string is "?equity=AAPL=0.5"
When the v1 query parser processes the input
Then an error is returned with message: "Invalid character '=' in ticker 'AAPL=0.5' — equals signs are reserved"
```

### 7.3 Colon in one of multiple tokens

```
Given the URL query string is "?equity=AAPL,MSFT:0.3,GOOG"
When the v1 query parser processes the input
Then an error is returned with message: "Invalid character ':' in ticker 'MSFT:0.3' — colons are reserved for v2 weight syntax"
```

### 7.4 Semicolon is rejected

```
Given the URL query string is "?equity=AAPL;MSFT"
When the v1 query parser processes the input
Then an error is returned with message: "Invalid character ';' in ticker 'AAPL;MSFT'"
```

### 7.5 Pipe is rejected

```
Given the URL query string is "?equity=AAPL|MSFT"
When the v1 query parser processes the input
Then an error is returned with message: "Invalid character '|' in ticker 'AAPL|MSFT'"
```

---

## 8. Invalid Ticker Format

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

### 8.4 Ticker exceeding max length (10 chars) is rejected

```
Given the URL query string is "?equity=ABCDEFGHIJK"
When the v1 query parser processes the input
Then an error is returned with message: "Ticker too long: 'ABCDEFGHIJK' exceeds 10 character limit"
```

### 8.5 Valid ticker with dot (e.g., BRK.B)

```
Given the URL query string is "?equity=BRK.B"
When the v1 query parser processes the input
Then the parsed tickers are ["BRK.B"]
And no error is returned
```

### 8.6 Valid ticker with hyphen (e.g., BF-B)

```
Given the URL query string is "?equity=BF-B"
When the v1 query parser processes the input
Then the parsed tickers are ["BF-B"]
And no error is returned
```

---

## 9. URL Encoding

### 9.1 URL-encoded comma (%2C) works as separator

```
Given the URL query string is "?equity=AAPL%2CMSFT"
When the v1 query parser processes the input
Then the parsed tickers are ["AAPL", "MSFT"]
And no error is returned
```

### 9.2 URL-encoded space (%20) is trimmed

```
Given the URL query string is "?equity=%20AAPL%20"
When the v1 query parser processes the input
Then the parsed tickers are ["AAPL"]
And no error is returned
```

### 9.3 Plus sign (+) as space is trimmed

```
Given the URL query string is "?equity=+AAPL+"
When the v1 query parser processes the input
Then the parsed tickers are ["AAPL"]
And no error is returned
```

---

## 10. Multiple equity Parameters

### 10.1 Duplicate equity params — only the first is used

```
Given the URL query string is "?equity=AAPL&equity=MSFT"
When the v1 query parser processes the input
Then the parsed tickers are ["AAPL"]
And a warning is returned: "Multiple equity parameters found — only the first is used"
```

---

## 11. Unrecognized Query Parameters

### 11.1 Unknown parameters are silently ignored

```
Given the URL query string is "?equity=AAPL&foo=bar"
When the v1 query parser processes the input
Then the parsed tickers are ["AAPL"]
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
Given the URL query string is "?equity=A,B,C,D,E,F,G,H,I,J,"
When the v1 query parser processes the input
Then an error is returned with message: "Empty ticker at position 11"
```

### 12.3 Reserved char in dedup context

```
Given the URL query string is "?equity=AAPL:0.5,AAPL"
When the v1 query parser processes the input
Then an error is returned with message: "Invalid character ':' in ticker 'AAPL:0.5' — colons are reserved for v2 weight syntax"
```

> Note: The parser should reject on the **first** error encountered during left-to-right processing. It does not accumulate multiple errors.

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

---

## Summary of v1 Constraints

| Rule                        | Limit / Behavior                                     |
| --------------------------- | ---------------------------------------------------- |
| Parameter name              | `equity`                                             |
| Separator                   | `,` (comma)                                          |
| Max tickers                 | 10                                                   |
| Max ticker length           | 10 characters                                        |
| Allowed ticker chars        | Letters (`A-Z`), digits (`0-9`), dot (`.`), hyphen (`-`) |
| Ticker must start with      | A letter                                             |
| Case normalization          | All tickers uppercased                               |
| Whitespace                  | Trimmed per-token; inner whitespace rejected         |
| Duplicates                  | Rejected (post-normalization)                        |
| Empty tokens                | Rejected with position                               |
| Reserved chars (`:`, `=`)   | Rejected with v2 forward-compat message              |
| Other special chars         | Rejected                                             |
| Multiple `equity` params    | First wins, warning emitted                          |
| Unknown params              | Silently ignored                                     |
| Error strategy              | Fail-fast, first error wins                          |
| Ordering                    | Input order preserved                                |
