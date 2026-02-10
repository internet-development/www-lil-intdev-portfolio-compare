// Fetch helper for the compare page.
// Encapsulates request building to /api/market-data and /api/benchmark,
// translating client-side query params to API route params.

import type { SeriesData, RangeValue, BenchmarkValue } from '@common/types';
import type { CompareQuery } from '@common/query';

export interface CompareDataSuccess {
  ok: true;
  equitySeries: SeriesData[];
  benchmarkSeries: SeriesData[];
}

export interface CompareDataError {
  ok: false;
  error: string;
}

export type CompareDataResult = CompareDataSuccess | CompareDataError;

interface ApiSuccessResponse {
  series: SeriesData[];
}

interface ApiErrorResponse {
  error: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = await res.json();

  if (!res.ok) {
    const message = (body as ApiErrorResponse).error ?? 'Data temporarily unavailable. Please try again.';
    throw new Error(message);
  }

  return body as T;
}

function buildMarketDataUrl(tickers: string[], range: RangeValue): string {
  const params = new URLSearchParams();
  params.set('tickers', tickers.join(','));
  params.set('range', range);
  return `/api/market-data?${params.toString()}`;
}

function buildBenchmarkUrl(benchmarks: BenchmarkValue[], range: RangeValue): string {
  const params = new URLSearchParams();
  params.set('benchmarks', benchmarks.join('|'));
  params.set('range', range);
  return `/api/benchmark?${params.toString()}`;
}

/**
 * Fetch equity and benchmark data for a parsed CompareQuery.
 * Returns all series on success, or a descriptive error on failure.
 */
export async function fetchCompareData(query: CompareQuery): Promise<CompareDataResult> {
  try {
    const allTickers = query.portfolios.flatMap((p) => p.tickers.map((t) => t.ticker));

    let equitySeries: SeriesData[] = [];
    if (allTickers.length > 0) {
      const equityResult = await fetchJson<ApiSuccessResponse>(buildMarketDataUrl(allTickers, query.range));
      equitySeries = equityResult.series;
    }

    let benchmarkSeries: SeriesData[] = [];
    if (query.benchmarks.length > 0) {
      const benchmarkResult = await fetchJson<ApiSuccessResponse>(buildBenchmarkUrl(query.benchmarks, query.range));
      benchmarkSeries = benchmarkResult.series;
    }

    return { ok: true, equitySeries, benchmarkSeries };
  } catch (error: any) {
    return { ok: false, error: error?.message ?? 'Data temporarily unavailable. Please try again.' };
  }
}
