export interface PricePoint {
  date: string;
  close: number;
}

export interface SeriesData {
  ticker: string;
  points: PricePoint[];
  source: string;
}

export type RangeValue = '1m' | '3m' | '6m' | 'ytd' | '1y' | '3y' | '5y' | 'max';

export const VALID_RANGES: RangeValue[] = ['1m', '3m', '6m', 'ytd', '1y', '3y', '5y', 'max'];

export const VALID_BENCHMARKS = ['gold', 'eth', 'usd'] as const;
export type BenchmarkValue = (typeof VALID_BENCHMARKS)[number];
