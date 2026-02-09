'use client';

import '@root/global-fonts.css';
import '@root/global.css';

import * as React from 'react';

import Card from '@components/Card';
import Chart from '@components/Chart';
import DefaultActionBar from '@components/page/DefaultActionBar';
import DefaultLayout from '@components/page/DefaultLayout';
import Grid from '@components/Grid';
import Row from '@components/Row';
import Summary from '@components/Summary';

import type { NormalizedSeries, SummaryRow, PricePoint, SeriesData } from '@common/types';

const VALID_BENCHMARKS = ['gold', 'eth', 'usd'];
const VALID_RANGES = ['1m', '3m', '6m', 'ytd', '1y', '3y', '5y', 'max'];

function generateDemoSeries(ticker: string, days: number, trend: number, volatility: number): PricePoint[] {
  const points: PricePoint[] = [];
  let price = 100 + Math.random() * 100;
  const now = new Date();

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    const change = (trend + (Math.random() - 0.5) * volatility) / 100;
    price = price * (1 + change);
    points.push({
      date: date.toISOString().split('T')[0],
      close: Math.round(price * 100) / 100,
    });
  }
  return points;
}

function getRangeDays(range: string): number {
  switch (range) {
    case '1m': return 30;
    case '3m': return 90;
    case '6m': return 180;
    case 'ytd': {
      const now = new Date();
      const jan1 = new Date(now.getFullYear(), 0, 1);
      return Math.ceil((now.getTime() - jan1.getTime()) / (1000 * 60 * 60 * 24));
    }
    case '1y': return 365;
    case '3y': return 365 * 3;
    case '5y': return 365 * 5;
    case 'max': return 365 * 10;
    default: return 365;
  }
}

function normalizeSeries(series: SeriesData[], benchmarkTickers: string[]): { normalized: NormalizedSeries[]; summaryRows: SummaryRow[] } {
  const allDates = series.reduce<Set<string>>((acc, s) => {
    for (const p of s.points) acc.add(p.date);
    return acc;
  }, new Set());
  const sortedDates = Array.from(allDates).sort();

  const normalized: NormalizedSeries[] = [];
  const summaryRows: SummaryRow[] = [];
  const benchmarkSet = new Set(benchmarkTickers.map((b) => b.toUpperCase()));

  for (const s of series) {
    if (s.points.length === 0) continue;
    const priceMap = new Map<string, number>();
    for (const p of s.points) priceMap.set(p.date, p.close);

    const firstPrice = s.points[0].close;
    const lastPrice = s.points[s.points.length - 1].close;
    const isBenchmark = benchmarkSet.has(s.ticker.toUpperCase());

    const normPoints: { date: string; value: number }[] = [];
    let lastKnown = firstPrice;
    for (const date of sortedDates) {
      const price = priceMap.get(date);
      if (price !== undefined) {
        lastKnown = price;
      }
      normPoints.push({
        date,
        value: ((lastKnown - firstPrice) / firstPrice) * 100,
      });
    }

    normalized.push({ ticker: s.ticker, points: normPoints, source: s.source, isBenchmark });
    summaryRows.push({
      ticker: s.ticker,
      startDate: s.points[0].date,
      endDate: s.points[s.points.length - 1].date,
      startPrice: firstPrice,
      endPrice: lastPrice,
      totalReturn: ((lastPrice - firstPrice) / firstPrice) * 100,
      isBenchmark,
    });
  }

  return { normalized, summaryRows };
}

function getDemoData(equities: string[], benchmarks: string[], range: string): SeriesData[] {
  const days = getRangeDays(range);
  const series: SeriesData[] = [];

  const equityProfiles: Record<string, { trend: number; volatility: number }> = {
    AAPL: { trend: 0.08, volatility: 2.0 },
    MSFT: { trend: 0.07, volatility: 1.8 },
    TSMC: { trend: 0.1, volatility: 2.5 },
    GOOG: { trend: 0.06, volatility: 2.2 },
    AMZN: { trend: 0.09, volatility: 2.4 },
    NVDA: { trend: 0.12, volatility: 3.0 },
  };

  for (const ticker of equities) {
    const profile = equityProfiles[ticker] || { trend: 0.05, volatility: 2.0 };
    series.push({
      ticker,
      points: generateDemoSeries(ticker, days, profile.trend, profile.volatility),
      source: 'Demo Data',
    });
  }

  for (const bm of benchmarks) {
    const upper = bm.toUpperCase();
    if (upper === 'USD') {
      const points: PricePoint[] = [];
      const now = new Date();
      for (let i = days; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        if (date.getDay() === 0 || date.getDay() === 6) continue;
        points.push({ date: date.toISOString().split('T')[0], close: 1.0 });
      }
      series.push({ ticker: 'USD', points, source: 'Cash Baseline' });
    } else if (upper === 'GOLD') {
      series.push({
        ticker: 'GOLD',
        points: generateDemoSeries('GOLD', days, 0.04, 1.2),
        source: 'Demo Data',
      });
    } else if (upper === 'ETH') {
      series.push({
        ticker: 'ETH',
        points: generateDemoSeries('ETH', days, 0.06, 4.0),
        source: 'Demo Data',
      });
    }
  }

  return series;
}

export default function Page() {
  const [equities, setEquities] = React.useState<string[]>([]);
  const [benchmarks, setBenchmarks] = React.useState<string[]>([]);
  const [range, setRange] = React.useState<string>('1y');
  const [error, setError] = React.useState<string | null>(null);
  const [warning, setWarning] = React.useState<string | null>(null);
  const [normalized, setNormalized] = React.useState<NormalizedSeries[]>([]);
  const [summaryRows, setSummaryRows] = React.useState<SummaryRow[]>([]);
  const [sources, setSources] = React.useState<string[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const equityParam = params.get('equity');
    const benchmarkParam = params.get('benchmark');
    const rangeParam = params.get('range');

    if (!equityParam && !benchmarkParam) {
      setIsLoading(false);
      return;
    }

    if (!equityParam && benchmarkParam) {
      setError('equity param is required');
      setIsLoading(false);
      return;
    }

    if (equityParam !== null && equityParam.trim() === '') {
      setError('Empty equity parameter');
      setIsLoading(false);
      return;
    }

    const tickers = equityParam!.split(',').map((t) => t.trim().toUpperCase()).filter(Boolean);
    if (tickers.length === 0) {
      setError('Empty equity parameter');
      setIsLoading(false);
      return;
    }

    if (tickers.length > 10) {
      setError(`Too many tickers: ${tickers.length} exceeds maximum of 10`);
      setIsLoading(false);
      return;
    }

    let parsedBenchmarks: string[] = [];
    if (benchmarkParam && benchmarkParam.trim() !== '') {
      parsedBenchmarks = benchmarkParam.split('|').map((b) => b.trim().toLowerCase());
      for (const bm of parsedBenchmarks) {
        if (!VALID_BENCHMARKS.includes(bm)) {
          setError(`Unknown benchmark: ${bm}. Valid benchmarks: ${VALID_BENCHMARKS.join(', ')}`);
          setIsLoading(false);
          return;
        }
      }
    }

    let parsedRange = '1y';
    if (rangeParam) {
      const r = rangeParam.trim().toLowerCase();
      if (!VALID_RANGES.includes(r)) {
        setError(`Invalid range: ${rangeParam}. Valid ranges: ${VALID_RANGES.join(', ')}`);
        setIsLoading(false);
        return;
      }
      parsedRange = r;
    }

    setEquities(tickers);
    setBenchmarks(parsedBenchmarks);
    setRange(parsedRange);

    const benchmarkTickers = parsedBenchmarks.map((b) => b.toUpperCase());
    const rawData = getDemoData(tickers, parsedBenchmarks, parsedRange);
    const sourceSet = new Set(rawData.map((s) => s.source));
    setSources(Array.from(sourceSet));

    const { normalized: norm, summaryRows: rows } = normalizeSeries(rawData, benchmarkTickers);
    setNormalized(norm);
    setSummaryRows(rows);
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <DefaultLayout previewPixelSRC="https://intdev-global.s3.us-west-2.amazonaws.com/template-app-icon.png">
        <DefaultActionBar />
        <br />
        <Grid>
          <Row>PORTFOLIO COMPARE</Row>
          <Row>Loading...</Row>
        </Grid>
      </DefaultLayout>
    );
  }

  if (equities.length === 0 && !error) {
    return (
      <DefaultLayout previewPixelSRC="https://intdev-global.s3.us-west-2.amazonaws.com/template-app-icon.png">
        <DefaultActionBar />
        <br />
        <Grid>
          <Row>PORTFOLIO COMPARE</Row>
          <Row>Compare equity performance against benchmarks over time.</Row>
        </Grid>
        <Grid>
          <Row>
            Add query parameters to compare performance:
            <br />
            <br />
            ?equity=AAPL,MSFT&benchmark=gold to compare performance
          </Row>
          <Row>
            <strong>Examples:</strong>
            <br />
            <br />
            <a href="/?equity=AAPL,MSFT&benchmark=gold&range=1y">?equity=AAPL,MSFT&benchmark=gold&range=1y</a>
            <br />
            <a href="/?equity=TSMC,AAPL,MSFT&benchmark=gold|eth&range=1y">?equity=TSMC,AAPL,MSFT&benchmark=gold|eth&range=1y</a>
            <br />
            <a href="/?equity=AAPL&benchmark=gold|eth|usd&range=5y">?equity=AAPL&benchmark=gold|eth|usd&range=5y</a>
            <br />
            <a href="/?equity=NVDA,AAPL&benchmark=eth&range=ytd">?equity=NVDA,AAPL&benchmark=eth&range=ytd</a>
          </Row>
          <Row>
            <strong>Benchmarks:</strong> gold, eth, usd
            <br />
            <strong>Ranges:</strong> 1m, 3m, 6m, ytd, 1y, 3y, 5y, max
          </Row>
        </Grid>
      </DefaultLayout>
    );
  }

  if (error) {
    return (
      <DefaultLayout previewPixelSRC="https://intdev-global.s3.us-west-2.amazonaws.com/template-app-icon.png">
        <DefaultActionBar />
        <br />
        <Grid>
          <Row>PORTFOLIO COMPARE</Row>
        </Grid>
        <Grid>
          <Card title="ERROR">
            {error}
            <br />
            <br />
            <a href="/">Return to start</a>
          </Card>
        </Grid>
      </DefaultLayout>
    );
  }

  return (
    <DefaultLayout previewPixelSRC="https://intdev-global.s3.us-west-2.amazonaws.com/template-app-icon.png">
      <DefaultActionBar />
      <br />
      <Grid>
        <Row>
          PORTFOLIO COMPARE — {equities.join(', ')}
          {benchmarks.length > 0 ? ` vs ${benchmarks.map((b) => b.toUpperCase()).join(', ')}` : ''}
          {' '}({range.toUpperCase()})
        </Row>
      </Grid>

      <Grid>
        <Card title="PERFORMANCE">
          <Chart series={normalized} sources={sources} />
        </Card>
      </Grid>

      <Grid>
        <Card title="SUMMARY">
          <Summary rows={summaryRows} />
        </Card>
      </Grid>
    </DefaultLayout>
  );
}
