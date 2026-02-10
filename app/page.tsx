'use client';

import '@root/global-fonts.css';
import '@root/global.css';

import * as React from 'react';

import AlertBanner from '@components/AlertBanner';
import Card from '@components/Card';
import DefaultLayout from '@components/page/DefaultLayout';

import { parseCompareQuery } from '@common/query';
import type { CompareQuery } from '@common/query';

function useCompareQuery(): { query: CompareQuery | null; error: string | null } {
  const [query, setQuery] = React.useState<CompareQuery | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const result = parseCompareQuery(searchParams);

    if (result.ok) {
      setQuery(result.query);
      setError(null);
    } else {
      setQuery(null);
      setError(result.error);
    }
  }, []);

  return { query, error };
}

function PortfolioSummary({ query }: { query: CompareQuery }) {
  if (query.portfolios.length === 0) {
    return (
      <Card title="PORTFOLIO COMPARE">
        <p>
          Add equities to the URL to get started. Example:{' '}
          <code>?equity=AAPL,MSFT,GOOG&benchmark=gold&range=1y</code>
        </p>
      </Card>
    );
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
      <div>
        <strong>Range:</strong> {query.range}
      </div>
    </Card>
  );
}

export default function Page() {
  const { query, error } = useCompareQuery();

  return (
    <DefaultLayout previewPixelSRC="https://intdev-global.s3.us-west-2.amazonaws.com/template-app-icon.png">
      {error && (
        <AlertBanner>
          <strong>Invalid query:</strong> {error}
        </AlertBanner>
      )}
      {query && <PortfolioSummary query={query} />}
    </DefaultLayout>
  );
}
