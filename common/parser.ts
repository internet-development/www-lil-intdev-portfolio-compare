// v1 Query Parser — equity= URL parameter
// Contract defined in SCENARIOS.md sections 1–13
// See LIL-INTDEV-AGENTS.md §3 for architecture context

export const MAX_PORTFOLIOS = 5;
export const MAX_TICKERS_PER_PORTFOLIO = 20;
export const MAX_TICKER_LENGTH = 10;

const VALID_TICKER_CHARS = /^[A-Za-z0-9.\-]+$/;
const STARTS_WITH_LETTER = /^[A-Za-z]/;
const RESERVED_COLON = /:/;
const RESERVED_EQUALS = /=/;

export interface ParseSuccess {
  ok: true;
  portfolios: string[][];
}

export interface ParseError {
  ok: false;
  error: string;
}

export type ParseResult = ParseSuccess | ParseError;

/**
 * Parse the `equity` query parameter(s) from a URL search string.
 *
 * Follows the validation pipeline order defined in SCENARIOS.md:
 * 1. Portfolio count check
 * 2. Empty value check
 * 3. Split on comma
 * 4. Per-token validation (trim, empty, reserved chars, illegal chars, starts-with-letter, max-length, uppercase, dedup)
 * 5. Ticker count check
 */
export function parsePortfolios(searchParams: URLSearchParams): ParseResult {
  const equityValues = searchParams.getAll('equity');

  // No equity param at all → empty portfolios, no error (scenario 6.1)
  if (equityValues.length === 0) {
    return { ok: true, portfolios: [] };
  }

  // Step 1: Portfolio count check (scenario 10.3)
  if (equityValues.length > MAX_PORTFOLIOS) {
    return {
      ok: false,
      error: `Too many portfolios: ${equityValues.length} exceeds maximum of ${MAX_PORTFOLIOS}`,
    };
  }

  const portfolios: string[][] = [];
  const isMulti = equityValues.length > 1;

  for (let pIdx = 0; pIdx < equityValues.length; pIdx++) {
    const raw = equityValues[pIdx];
    const portfolioNum = pIdx + 1;
    const suffix = isMulti ? ` in portfolio ${portfolioNum}` : '';

    // Step 2: Empty value check (scenario 6.2, 10.5)
    if (raw === '') {
      return {
        ok: false,
        error: `Empty equity parameter${suffix}`,
      };
    }

    // Step 3: Split on comma
    const tokens = raw.split(',');

    // Step 5 (checked early before processing tokens): Ticker count (scenario 5.2)
    // Note: we check after per-token validation per the pipeline order,
    // but empty tokens would fail first anyway. We do the actual count check after token processing.

    const seen = new Set<string>();
    const tickers: string[] = [];

    for (let tIdx = 0; tIdx < tokens.length; tIdx++) {
      const position = tIdx + 1;
      const posSuffix = isMulti ? ` in portfolio ${portfolioNum}` : '';

      // Step 4a: Trim whitespace
      const trimmed = tokens[tIdx].trim();

      // Step 4b: Empty token check (scenarios 3.2, 6.3, 6.4, 6.5, 6.6)
      if (trimmed === '') {
        return {
          ok: false,
          error: `Empty ticker at position ${position}${posSuffix}`,
        };
      }

      // Step 4c: Reserved characters — colon (scenarios 7.1, 7.2, 7.4)
      if (RESERVED_COLON.test(trimmed)) {
        return {
          ok: false,
          error: `Invalid character ':' in ticker '${trimmed}' — colons are reserved for v2 weight syntax`,
        };
      }

      // Step 4c: Reserved characters — equals (scenario 7.3)
      if (RESERVED_EQUALS.test(trimmed)) {
        return {
          ok: false,
          error: `Invalid character '=' in ticker '${trimmed}' — equals signs are reserved`,
        };
      }

      // Step 4d: Illegal characters (scenarios 7.5, 7.6, 8.2, 8.3, 8.4, 8.5)
      if (!VALID_TICKER_CHARS.test(trimmed)) {
        // Find the first illegal character for the error message
        const illegalChar = trimmed.split('').find((ch) => !ch.match(/[A-Za-z0-9.\-]/));
        return {
          ok: false,
          error: `Invalid character '${illegalChar}' in ticker '${trimmed}'`,
        };
      }

      // Step 4e: Must start with letter (scenario 8.1)
      if (!STARTS_WITH_LETTER.test(trimmed)) {
        return {
          ok: false,
          error: `Invalid ticker format: '${trimmed}' — must start with a letter`,
        };
      }

      // Step 4f: Max length (scenario 8.6)
      if (trimmed.length > MAX_TICKER_LENGTH) {
        return {
          ok: false,
          error: `Ticker too long: '${trimmed}' exceeds ${MAX_TICKER_LENGTH} character limit`,
        };
      }

      // Step 4g: Uppercase normalization (scenarios 2.1, 2.2)
      const upper = trimmed.toUpperCase();

      // Step 4h: Duplicate check within this portfolio (scenarios 4.1, 4.2, 4.3)
      if (seen.has(upper)) {
        return {
          ok: false,
          error: `Duplicate ticker: ${upper}${posSuffix}`,
        };
      }

      seen.add(upper);
      tickers.push(upper);
    }

    // Step 5: Ticker count check (scenario 5.2)
    if (tickers.length > MAX_TICKERS_PER_PORTFOLIO) {
      return {
        ok: false,
        error: `Too many tickers in portfolio ${portfolioNum}: ${tickers.length} exceeds maximum of ${MAX_TICKERS_PER_PORTFOLIO}`,
      };
    }

    portfolios.push(tickers);
  }

  return { ok: true, portfolios };
}
