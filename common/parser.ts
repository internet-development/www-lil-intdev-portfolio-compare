import { VALID_RANGES, VALID_BENCHMARKS } from '@common/types';
import type { RangeValue, BenchmarkValue } from '@common/types';

// --- v1 Limits ---
export const MAX_TICKERS_PER_PORTFOLIO = 20;
export const MAX_PORTFOLIOS = 5;
export const MAX_TICKER_LENGTH = 10;

// --- Allowed ticker characters: letters, digits, dot, hyphen ---
const TICKER_CHARS = /^[A-Za-z0-9.\-]+$/;

// --- Result types ---

export interface ParsedQuery {
  portfolios: string[][];
  benchmark: BenchmarkValue[] | null;
  range: RangeValue;
}

export interface ParseError {
  message: string;
}

export type ParseResult =
  | { ok: true; data: ParsedQuery }
  | { ok: false; error: ParseError };

// --- Helpers ---

function portfolioSuffix(index: number, total: number): string {
  return total > 1 ? ` in portfolio ${index + 1}` : '';
}

function findFirstInvalidChar(token: string): { char: string; isReserved: boolean } | null {
  for (const ch of token) {
    if (ch === ':') return { char: ':', isReserved: true };
    if (ch === '=') return { char: '=', isReserved: true };
    if (!TICKER_CHARS.test(ch)) return { char: ch, isReserved: false };
  }
  return null;
}

// --- Main parser ---

/**
 * Parse the `equity` query parameter(s) from a URLSearchParams instance.
 *
 * Follows the v1 acceptance contract in SCENARIOS.md sections 1–13.
 * Fail-fast: returns the first error encountered.
 */
export function parsePortfolios(params: URLSearchParams): ParseResult {
  const equityValues = params.getAll('equity');

  // 6.1 — No equity param at all → empty portfolios, no error
  if (equityValues.length === 0) {
    return {
      ok: true,
      data: {
        portfolios: [],
        benchmark: parseBenchmark(params),
        range: parseRange(params),
      },
    };
  }

  // 10.3 — Too many portfolios
  if (equityValues.length > MAX_PORTFOLIOS) {
    return fail(`Too many portfolios: ${equityValues.length} exceeds maximum of ${MAX_PORTFOLIOS}`);
  }

  const totalPortfolios = equityValues.length;
  const portfolios: string[][] = [];

  for (let pi = 0; pi < equityValues.length; pi++) {
    const raw = equityValues[pi];
    const suffix = portfolioSuffix(pi, totalPortfolios);

    // 6.2 / 10.5 — Empty equity value
    if (raw === '') {
      return fail(`Empty equity parameter${suffix}`);
    }

    // 3. Split on comma
    const tokens = raw.split(',');
    const seen = new Set<string>();
    const tickers: string[] = [];

    for (let ti = 0; ti < tokens.length; ti++) {
      // 4a. Trim whitespace
      const trimmed = tokens[ti].trim();

      // 4b. Empty token
      if (trimmed === '') {
        return fail(`Empty ticker at position ${ti + 1}${suffix}`);
      }

      // 4c. Reserved characters — check before general charset
      const invalid = findFirstInvalidChar(trimmed);
      if (invalid) {
        if (invalid.char === ':') {
          return fail(`Invalid character ':' in ticker '${trimmed}' — colons are reserved for v2 weight syntax`);
        }
        if (invalid.char === '=') {
          return fail(`Invalid character '=' in ticker '${trimmed}' — equals signs are reserved`);
        }
        // 4d. Illegal character
        return fail(`Invalid character '${invalid.char}' in ticker '${trimmed}'`);
      }

      // 4e. Must start with a letter
      if (!/^[A-Za-z]/.test(trimmed)) {
        return fail(`Invalid ticker format: '${trimmed}' — must start with a letter`);
      }

      // 4f. Max length
      if (trimmed.length > MAX_TICKER_LENGTH) {
        return fail(`Ticker too long: '${trimmed}' exceeds ${MAX_TICKER_LENGTH} character limit`);
      }

      // 4g. Normalize to uppercase
      const upper = trimmed.toUpperCase();

      // 4h. Duplicate check (within this portfolio)
      if (seen.has(upper)) {
        return fail(`Duplicate ticker: ${upper}`);
      }
      seen.add(upper);

      tickers.push(upper);
    }

    // 5. Ticker count per portfolio
    if (tickers.length > MAX_TICKERS_PER_PORTFOLIO) {
      return fail(`Too many tickers in portfolio ${pi + 1}: ${tickers.length} exceeds maximum of ${MAX_TICKERS_PER_PORTFOLIO}`);
    }

    portfolios.push(tickers);
  }

  return {
    ok: true,
    data: {
      portfolios,
      benchmark: parseBenchmark(params),
      range: parseRange(params),
    },
  };
}

// --- Benchmark parser ---

function parseBenchmark(params: URLSearchParams): BenchmarkValue[] | null {
  const raw = params.get('benchmark');
  if (raw === null || raw === '') return null;

  const parts = raw.split('|').map((s) => s.trim().toLowerCase());
  const result: BenchmarkValue[] = [];

  for (const part of parts) {
    if (!VALID_BENCHMARKS.includes(part as BenchmarkValue)) {
      return null; // Page integration will handle unknown benchmarks
    }
    result.push(part as BenchmarkValue);
  }

  return result;
}

// --- Range parser ---

function parseRange(params: URLSearchParams): RangeValue {
  const raw = params.get('range');
  if (raw === null || raw === '') return '1y';
  const lower = raw.trim().toLowerCase();
  if (VALID_RANGES.includes(lower as RangeValue)) return lower as RangeValue;
  return '1y'; // default
}

// --- Util ---

function fail(message: string): ParseResult {
  return { ok: false, error: { message } };
}
