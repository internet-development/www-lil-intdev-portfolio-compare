import { VALID_BENCHMARKS, VALID_RANGES, DEFAULT_RANGE, MAX_TICKERS, MAX_TICKER_LENGTH } from '@common/types';
import type { Benchmark, Range, ParsedQuery, ParseError, ParseResult } from '@common/types';

const RESERVED_CHARS: Record<string, string> = {
  ':': "colons are reserved for v2 weight syntax",
  '=': "equals signs are reserved",
};

function parseEquity(searchParams: URLSearchParams): { tickers: string[]; warnings: string[] } | ParseError {
  const warnings: string[] = [];

  const allEquity = searchParams.getAll('equity');
  if (allEquity.length === 0) {
    return { tickers: [], warnings };
  }

  if (allEquity.length > 1) {
    warnings.push('Multiple equity parameters found — only the first is used');
  }

  const raw = allEquity[0];
  if (raw === '') {
    return { error: 'Empty equity parameter' };
  }

  const tokens = raw.split(',');

  if (tokens.length > MAX_TICKERS) {
    return { error: `Too many tickers: ${tokens.length} exceeds maximum of ${MAX_TICKERS}` };
  }

  const seen = new Set<string>();
  const tickers: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const trimmed = tokens[i].trim();
    const position = i + 1;

    if (trimmed === '') {
      return { error: `Empty ticker at position ${position}` };
    }

    // Check reserved characters first
    for (const char of Object.keys(RESERVED_CHARS)) {
      if (trimmed.includes(char)) {
        const msg = RESERVED_CHARS[char];
        return { error: `Invalid character '${char}' in ticker '${trimmed}' — ${msg}` };
      }
    }

    // Check for other invalid characters (allowed: A-Z, a-z, 0-9, dot, hyphen)
    for (const char of trimmed) {
      if (!/[A-Za-z0-9.\-]/.test(char)) {
        return { error: `Invalid character '${char}' in ticker '${trimmed}'` };
      }
    }

    // Must start with a letter
    if (!/^[A-Za-z]/.test(trimmed)) {
      return { error: `Invalid ticker format: '${trimmed}' — must start with a letter` };
    }

    const upper = trimmed.toUpperCase();

    if (upper.length > MAX_TICKER_LENGTH) {
      return { error: `Ticker too long: '${upper}' exceeds ${MAX_TICKER_LENGTH} character limit` };
    }

    if (seen.has(upper)) {
      return { error: `Duplicate ticker: ${upper}` };
    }

    seen.add(upper);
    tickers.push(upper);
  }

  return { tickers, warnings };
}

function parseBenchmark(searchParams: URLSearchParams): Benchmark[] | ParseError {
  const raw = searchParams.get('benchmark');
  if (raw === null || raw === '') {
    return [];
  }

  const tokens = raw.split('|');
  const benchmarks: Benchmark[] = [];

  for (const token of tokens) {
    const lower = token.trim().toLowerCase();
    if (!VALID_BENCHMARKS.includes(lower as Benchmark)) {
      return { error: `Unknown benchmark: ${token.trim()}. Valid benchmarks: ${VALID_BENCHMARKS.join(', ')}` };
    }
    benchmarks.push(lower as Benchmark);
  }

  return benchmarks;
}

function parseRange(searchParams: URLSearchParams): Range | ParseError {
  const raw = searchParams.get('range');
  if (raw === null || raw === '') {
    return DEFAULT_RANGE;
  }

  const lower = raw.trim().toLowerCase();
  if (!VALID_RANGES.includes(lower as Range)) {
    return { error: `Unknown range: ${raw.trim()}. Valid ranges: ${VALID_RANGES.join(', ')}` };
  }

  return lower as Range;
}

export function parseQuery(searchParams: URLSearchParams): ParseResult {
  const equityResult = parseEquity(searchParams);
  if ('error' in equityResult) {
    return equityResult;
  }

  // If benchmark is present but no equity, that's an error (scenario A14)
  const hasBenchmark = searchParams.has('benchmark');
  if (hasBenchmark && equityResult.tickers.length === 0) {
    return { error: 'equity param is required' };
  }

  const benchmarkResult = parseBenchmark(searchParams);
  if ('error' in benchmarkResult) {
    return benchmarkResult as ParseError;
  }

  const rangeResult = parseRange(searchParams);
  if (typeof rangeResult === 'object' && 'error' in rangeResult) {
    return rangeResult;
  }

  return {
    tickers: equityResult.tickers,
    benchmarks: benchmarkResult,
    range: rangeResult,
    warnings: equityResult.warnings,
  };
}
