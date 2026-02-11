// Full query parsing entry point for the compare page.
// Wraps the v1 equity parser and adds benchmark + range extraction.
// This is the single entry point for all URL → app-state conversion.

import { parsePortfolios } from '@common/parser';
import type { ParseResult } from '@common/parser';
import { isValidRange, isValidBenchmark } from '@common/market-data';
import type { RangeValue, BenchmarkValue } from '@common/types';
import { VALID_RANGES, VALID_BENCHMARKS } from '@common/types';
import { buildEqualWeightPortfolio } from '@common/portfolio';
import type { WeightedPortfolio } from '@common/portfolio';

export interface CompareQuery {
  portfolios: WeightedPortfolio[];
  benchmarks: BenchmarkValue[];
  range: RangeValue;
  amount: number;
}

export interface QuerySuccess {
  ok: true;
  query: CompareQuery;
}

export interface QueryError {
  ok: false;
  error: string;
}

export type QueryResult = QuerySuccess | QueryError;

/**
 * Parse the full set of compare-page query parameters from the URL.
 *
 * Reads: equity=, benchmark=, range=
 * Returns a typed CompareQuery on success or a fail-fast error.
 *
 * This is the single entry point — all URL parsing flows through here.
 */
export function parseCompareQuery(searchParams: URLSearchParams): QueryResult {
  // 1. Parse equity portfolios via the strict v1 parser
  const equityResult: ParseResult = parsePortfolios(searchParams);

  if (!equityResult.ok) {
    return { ok: false, error: equityResult.error };
  }

  // 2. Build explicit equal-weight portfolios (1/N per ticker)
  const portfolios: WeightedPortfolio[] = equityResult.portfolios.map(
    (tickers) => buildEqualWeightPortfolio(tickers)
  );

  // 3. Parse benchmark parameter (pipe-separated, case-insensitive)
  const benchmarks: BenchmarkValue[] = [];
  const benchmarkRaw = searchParams.get('benchmark');

  if (benchmarkRaw !== null && benchmarkRaw !== '') {
    const tokens = benchmarkRaw.split('|').map((b) => b.trim().toLowerCase());

    for (const token of tokens) {
      if (token === '') continue;
      if (!isValidBenchmark(token)) {
        return {
          ok: false,
          error: `Unknown benchmark: '${token}'. Valid benchmarks: ${VALID_BENCHMARKS.join(', ')}`,
        };
      }
      benchmarks.push(token as BenchmarkValue);
    }
  }

  // 4. Parse range parameter (defaults to '1y')
  const rangeRaw = searchParams.get('range') ?? '1y';

  if (!isValidRange(rangeRaw)) {
    return {
      ok: false,
      error: `Invalid range: '${rangeRaw}'. Valid ranges: ${VALID_RANGES.join(', ')}`,
    };
  }

  // 5. Parse amount parameter (defaults to 10000)
  const amountRaw = searchParams.get('amount');
  let amount = 10000;

  if (amountRaw !== null && amountRaw !== '') {
    const parsed = Number(amountRaw);
    if (isNaN(parsed) || parsed <= 0) {
      return {
        ok: false,
        error: `Invalid amount: '${amountRaw}'. Must be a positive number.`,
      };
    }
    amount = parsed;
  }

  return {
    ok: true,
    query: {
      portfolios,
      benchmarks,
      range: rangeRaw as RangeValue,
      amount,
    },
  };
}
