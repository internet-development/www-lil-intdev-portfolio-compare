import type { SeriesData, RangeValue, BenchmarkValue } from '@common/types';
import { VALID_RANGES, VALID_BENCHMARKS } from '@common/types';

export interface NormalizedPoint {
  date: string;
  value: number;
}

export interface NormalizedSeries {
  ticker: string;
  points: NormalizedPoint[];
  source: string;
}

/**
 * Normalizes a series so the first data point = 0% and subsequent points
 * represent % change from that start. E.g. a value of 15.5 means +15.5%.
 */
export function normalizeSeries(series: SeriesData): NormalizedSeries {
  if (series.points.length === 0) {
    return { ticker: series.ticker, points: [], source: series.source };
  }

  const startPrice = series.points[0].close;

  return {
    ticker: series.ticker,
    source: series.source,
    points: series.points.map((p) => ({
      date: p.date,
      value: ((p.close - startPrice) / startPrice) * 100,
    })),
  };
}

/**
 * Normalizes multiple series and aligns them to a common date range.
 * Only dates present in ALL series are included.
 */
export function normalizeAllSeries(allSeries: SeriesData[]): NormalizedSeries[] {
  if (allSeries.length === 0) return [];

  const normalized = allSeries.map(normalizeSeries);

  const dateSets = normalized.map((s) => new Set(s.points.map((p) => p.date)));
  const commonDates = new Set(Array.from(dateSets[0]).filter((date) => dateSets.every((set) => set.has(date))));

  return normalized.map((s) => ({
    ...s,
    points: s.points.filter((p) => commonDates.has(p.date)),
  }));
}

export function isValidRange(value: string): value is RangeValue {
  return VALID_RANGES.includes(value as RangeValue);
}

export function isValidBenchmark(value: string): value is BenchmarkValue {
  return VALID_BENCHMARKS.includes(value as BenchmarkValue);
}
