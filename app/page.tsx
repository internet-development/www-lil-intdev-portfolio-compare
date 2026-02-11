'use client';

import '@root/global-fonts.css';
import '@root/global.css';

import * as React from 'react';

import BlockLoader from '@components/BlockLoader';
import Card from '@components/Card';
import Chart from '@components/Chart';
import DefaultLayout from '@components/page/DefaultLayout';
import ErrorState from '@components/ErrorState';
import LandingState from '@components/LandingState';
import Summary from '@components/Summary';

import { parseCompareQuery } from '@common/query';
import type { CompareQuery } from '@common/query';
import { fetchCompareData } from '@common/compare-fetcher';
import type { CompareDataSuccess } from '@common/compare-fetcher';
import { normalizeAllSeries } from '@common/market-data';
import type { SeriesData } from '@common/types';

function useCompareQuery(): { query: CompareQuery | null; error: string | null } {
  const [query, setQuery] = React.useState<CompareQuery | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    function parse() {
      const searchParams = new URLSearchParams(window.location.search);
      const result = parseCompareQuery(searchParams);

      if (result.ok) {
        setQuery(result.query);
        setError(null);
      } else {
        setQuery(null);
        setError(result.error);
      }
    }

    parse();

    window.addEventListener('popstate', parse);
    return () => window.removeEventListener('popstate', parse);
  }, []);

  return { query, error };
}

type FetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'success'; data: CompareDataSuccess };

function useCompareData(query: CompareQuery | null): FetchState {
  const [state, setState] = React.useState<FetchState>({ status: 'idle' });

  React.useEffect(() => {
    if (!query) {
      setState({ status: 'idle' });
      return;
    }

    const hasTickers = query.portfolios.some((p) => p.tickers.length > 0);
    if (!hasTickers && query.benchmarks.length === 0) {
      setState({ status: 'idle' });
      return;
    }

    let cancelled = false;

    setState({ status: 'loading' });

    fetchCompareData(query).then((result) => {
      if (cancelled) return;

      if (result.ok) {
        setState({ status: 'success', data: result });
      } else {
        setState({ status: 'error', error: result.error });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [query]);

  return state;
}

function PortfolioSummary({ query, allSeries }: { query: CompareQuery; allSeries?: SeriesData[] }) {
  if (query.portfolios.length === 0) {
    return <LandingState />;
  }

  return (
    <Card title="PORTFOLIO COMPARE">
      {query.portfolios.map((portfolio, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
          <strong>Portfolio {query.portfolios.length > 1 ? i + 1 : ''}:</strong>{' '}
          {portfolio.tickers.map((t) => (
            <span key={t.ticker}>
              {t.ticker} ({(t.weight * 100).toFixed(1)}%){' '}
            </span>
          ))}
          <span style={{ opacity: 0.5 }}>— equal weight (1/{portfolio.tickers.length})</span>
        </div>
      ))}
      {query.benchmarks.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <strong>Benchmarks:</strong> {query.benchmarks.join(', ').toUpperCase()}
        </div>
      )}
      <div style={{ marginBottom: 8 }}>
        <strong>Range:</strong> {query.range}
      </div>
      <div style={{ marginBottom: allSeries ? 8 : 0 }}>
        <strong>Investment:</strong> ${query.amount.toLocaleString()}
      </div>
      {allSeries && allSeries.length > 0 && (
        <div style={{ marginTop: 8, opacity: 0.5, fontSize: '0.85em' }}>
          <strong>Data loaded:</strong> {allSeries.map((s) => s.ticker).join(', ')} — Source: {allSeries[0].source}
        </div>
      )}
    </Card>
  );
}

export default function Page() {
  const { query, error: parseError } = useCompareQuery();
  const fetchState = useCompareData(query);

  const allSeries: SeriesData[] | undefined =
    fetchState.status === 'success' ? [...fetchState.data.equitySeries, ...fetchState.data.benchmarkSeries] : undefined;

  const normalizedSeries = React.useMemo(() => {
    if (!allSeries || allSeries.length === 0) return [];
    return normalizeAllSeries(allSeries);
  }, [allSeries]);

  const benchmarkTickers = React.useMemo(() => {
    if (fetchState.status !== 'success') return [];
    return fetchState.data.benchmarkSeries.map((s) => s.ticker);
  }, [fetchState]);

  const isIdle = !query && !parseError;

  return (
    <DefaultLayout previewPixelSRC="https://intdev-global.s3.us-west-2.amazonaws.com/template-app-icon.png">
      {parseError && <ErrorState title="Invalid query" message={parseError} />}
      {fetchState.status === 'error' && <ErrorState title="Fetch error" message={fetchState.error} />}
      {fetchState.status === 'loading' && (
        <Card title="LOADING">
          <BlockLoader mode={1} /> Fetching market data…
        </Card>
      )}
      {isIdle && <LandingState />}
      {query && <PortfolioSummary query={query} allSeries={allSeries} />}
      {normalizedSeries.length > 0 && (
        <Card title="PERFORMANCE">
          <Chart series={normalizedSeries} benchmarkTickers={benchmarkTickers} />
        </Card>
      )}
      {allSeries && allSeries.length > 0 && query && (
        <Card title="SUMMARY">
          <Summary series={allSeries} amount={query.amount} benchmarkTickers={benchmarkTickers} />
        </Card>
      )}
    </DefaultLayout>
  );
}
