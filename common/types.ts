export interface PricePoint {
  date: string;
  close: number;
}

export interface SeriesData {
  ticker: string;
  points: PricePoint[];
  source: string;
}

export interface NormalizedPoint {
  date: string;
  value: number;
}

export interface NormalizedSeries {
  ticker: string;
  points: NormalizedPoint[];
  source: string;
  isBenchmark: boolean;
}

export interface SummaryRow {
  ticker: string;
  startDate: string;
  endDate: string;
  startPrice: number;
  endPrice: number;
  totalReturn: number;
  isBenchmark: boolean;
}
