import { NextRequest, NextResponse } from 'next/server';

import { COLON_REJECTION_ERROR } from '@common/parser';
import { VALID_RANGES } from '@common/types';
import type { PricePoint, RangeValue, SeriesData } from '@common/types';

const YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';

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

function parseYahooChart(data: any, ticker: string): SeriesData {
  const result = data?.chart?.result?.[0];
  if (!result) {
    throw new Error(`No data found for ticker: ${ticker}`);
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
    throw new Error(`No data found for ticker: ${ticker}`);
  }

  return {
    ticker: ticker.toUpperCase(),
    points,
    source: 'Yahoo Finance',
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tickers = searchParams.get('tickers');
  const range = (searchParams.get('range') ?? '1y') as RangeValue;

  if (!tickers) {
    return NextResponse.json({ error: 'Missing tickers parameter' }, { status: 400 });
  }

  if (!VALID_RANGES.includes(range)) {
    return NextResponse.json({ error: `Invalid range: ${range}. Valid ranges: ${VALID_RANGES.join(', ')}` }, { status: 400 });
  }

  const tickerList = tickers
    .split(',')
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

  if (tickerList.length === 0) {
    return NextResponse.json({ error: 'No valid tickers provided' }, { status: 400 });
  }

  // Reject reserved `:` syntax at the API boundary (v1 contract — #117)
  for (const t of tickerList) {
    if (t.includes(':')) {
      return NextResponse.json(
        { error: COLON_REJECTION_ERROR },
        { status: 400 }
      );
    }
  }

  const yahooParams = RANGE_TO_YAHOO[range];

  try {
    const results: SeriesData[] = [];

    for (const ticker of tickerList) {
      const url = `${YAHOO_CHART_URL}/${encodeURIComponent(ticker)}?range=${yahooParams.range}&interval=${yahooParams.interval}&events=div`;

      const res = await fetch(url, {
        next: { revalidate: 3600 },
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
      });

      if (res.status === 404) {
        return NextResponse.json({ error: `No data found for ticker: ${ticker}` }, { status: 404 });
      }

      if (res.status === 429) {
        return NextResponse.json({ error: 'Data temporarily unavailable. Please try again.' }, { status: 429 });
      }

      if (!res.ok) {
        return NextResponse.json({ error: `Data temporarily unavailable. Please try again.` }, { status: 502 });
      }

      const data = await res.json();
      const series = parseYahooChart(data, ticker);
      results.push(series);
    }

    return NextResponse.json({ series: results });
  } catch (error: any) {
    const message = error?.message ?? 'Data temporarily unavailable. Please try again.';

    if (message.startsWith('No data found for ticker:')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
