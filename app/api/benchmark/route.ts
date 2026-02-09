import { NextRequest, NextResponse } from 'next/server';

import { VALID_BENCHMARKS, VALID_RANGES } from '@common/types';
import type { PricePoint, RangeValue, SeriesData } from '@common/types';

const YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';

const BENCHMARK_TO_YAHOO: Record<string, string> = {
  gold: 'GC=F',
  eth: 'ETH-USD',
};

const BENCHMARK_DISPLAY: Record<string, string> = {
  gold: 'Gold',
  eth: 'ETH',
  usd: 'USD',
};

const RANGE_TO_YAHOO: Record<RangeValue, { range: string; interval: string }> = {
  '1m': { range: '1mo', interval: '1d' },
  '3m': { range: '3mo', interval: '1d' },
  '6m': { range: '6mo', interval: '1d' },
  ytd: { range: 'ytd', interval: '1d' },
  '1y': { range: '1y', interval: '1d' },
  '3y': { range: '3y', interval: '1wk' },
  '5y': { range: '5y', interval: '1wk' },
  max: { range: 'max', interval: '1mo' },
};

function parseYahooChart(data: any, displayName: string): PricePoint[] {
  const result = data?.chart?.result?.[0];
  if (!result) {
    throw new Error(`No data found for benchmark: ${displayName}`);
  }

  const timestamps: number[] = result.timestamp ?? [];
  const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];

  const points: PricePoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i];
    if (close == null || !isFinite(close)) continue;

    const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
    points.push({ date, close });
  }

  if (points.length === 0) {
    throw new Error(`No data found for benchmark: ${displayName}`);
  }

  return points;
}

function generateUsdBaseline(range: RangeValue): PricePoint[] {
  const now = new Date();
  const start = new Date();

  switch (range) {
    case '1m':
      start.setMonth(start.getMonth() - 1);
      break;
    case '3m':
      start.setMonth(start.getMonth() - 3);
      break;
    case '6m':
      start.setMonth(start.getMonth() - 6);
      break;
    case 'ytd':
      start.setMonth(0, 1);
      break;
    case '1y':
      start.setFullYear(start.getFullYear() - 1);
      break;
    case '3y':
      start.setFullYear(start.getFullYear() - 3);
      break;
    case '5y':
      start.setFullYear(start.getFullYear() - 5);
      break;
    case 'max':
      start.setFullYear(start.getFullYear() - 20);
      break;
  }

  const points: PricePoint[] = [];
  const current = new Date(start);
  while (current <= now) {
    points.push({
      date: current.toISOString().split('T')[0],
      close: 1,
    });
    current.setDate(current.getDate() + 1);
  }

  return points;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const benchmarks = searchParams.get('benchmarks');
  const range = (searchParams.get('range') ?? '1y') as RangeValue;

  if (!benchmarks) {
    return NextResponse.json({ error: 'Missing benchmarks parameter' }, { status: 400 });
  }

  if (!VALID_RANGES.includes(range)) {
    return NextResponse.json({ error: `Invalid range: ${range}. Valid ranges: ${VALID_RANGES.join(', ')}` }, { status: 400 });
  }

  const benchmarkList = benchmarks
    .split('|')
    .map((b) => b.trim().toLowerCase())
    .filter(Boolean);

  if (benchmarkList.length === 0) {
    return NextResponse.json({ error: 'No valid benchmarks provided' }, { status: 400 });
  }

  for (const b of benchmarkList) {
    if (!VALID_BENCHMARKS.includes(b as any)) {
      return NextResponse.json({ error: `Unknown benchmark: ${b}. Valid benchmarks: ${VALID_BENCHMARKS.join(', ')}` }, { status: 400 });
    }
  }

  const yahooParams = RANGE_TO_YAHOO[range];

  try {
    const results: SeriesData[] = [];

    for (const benchmark of benchmarkList) {
      const displayName = BENCHMARK_DISPLAY[benchmark];

      if (benchmark === 'usd') {
        results.push({
          ticker: 'USD',
          points: generateUsdBaseline(range),
          source: 'Cash baseline',
        });
        continue;
      }

      const yahooSymbol = BENCHMARK_TO_YAHOO[benchmark];
      const url = `${YAHOO_CHART_URL}/${encodeURIComponent(yahooSymbol)}?range=${yahooParams.range}&interval=${yahooParams.interval}`;

      const res = await fetch(url, {
        next: { revalidate: 3600 },
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
      });

      if (res.status === 429) {
        return NextResponse.json({ error: 'Data temporarily unavailable. Please try again.' }, { status: 429 });
      }

      if (!res.ok) {
        return NextResponse.json({ error: 'Data temporarily unavailable. Please try again.' }, { status: 502 });
      }

      const data = await res.json();
      const points = parseYahooChart(data, displayName);

      results.push({
        ticker: displayName,
        points,
        source: 'Yahoo Finance',
      });
    }

    return NextResponse.json({ series: results });
  } catch (error: any) {
    const message = error?.message ?? 'Data temporarily unavailable. Please try again.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
