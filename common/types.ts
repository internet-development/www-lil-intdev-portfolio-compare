export interface PricePoint {
  date: string;
  close: number;
}

export interface SeriesData {
  ticker: string;
  points: PricePoint[];
  source: string;
}

export const VALID_BENCHMARKS = ['gold', 'eth', 'usd'] as const;
export type Benchmark = (typeof VALID_BENCHMARKS)[number];

export const VALID_RANGES = ['1m', '3m', '6m', 'ytd', '1y', '3y', '5y', 'max'] as const;
export type Range = (typeof VALID_RANGES)[number];

export const DEFAULT_RANGE: Range = '1y';

export const MAX_TICKERS = 10;
export const MAX_TICKER_LENGTH = 10;

export interface ParsedQuery {
  tickers: string[];
  benchmarks: Benchmark[];
  range: Range;
  warnings: string[];
}

export interface ParseError {
  error: string;
}

export type ParseResult = ParsedQuery | ParseError;

export function isParseError(result: ParseResult): result is ParseError {
  return 'error' in result;
}
