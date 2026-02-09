'use client';

import styles from '@components/PortfolioCompare.module.css';

import * as React from 'react';

import { useSearchParams } from 'next/navigation';

import { parseQuery } from '@common/parser';
import { isParseError } from '@common/types';
import type { ParsedQuery } from '@common/types';

import Card from '@components/Card';
import Table from '@components/Table';
import TableRow from '@components/TableRow';
import TableColumn from '@components/TableColumn';
import Grid from '@components/Grid';

function LandingState() {
  return (
    <div className={styles.section}>
      <Card title="PORTFOLIO COMPARE">
        <div className={styles.content}>
          <p className={styles.text}>Compare equity performance against benchmarks over time.</p>
          <p className={styles.text}>
            Add <code className={styles.code}>?equity=AAPL,MSFT&benchmark=gold</code> to the URL to get started.
          </p>
          <div className={styles.examples}>
            <p className={styles.label}>EXAMPLES</p>
            <a className={styles.link} href="/?equity=AAPL,MSFT&benchmark=gold">
              ?equity=AAPL,MSFT&benchmark=gold
            </a>
            <a className={styles.link} href="/?equity=TSMC,AAPL,MSFT&benchmark=gold|eth|usd">
              ?equity=TSMC,AAPL,MSFT&benchmark=gold|eth|usd
            </a>
            <a className={styles.link} href="/?equity=AAPL&benchmark=eth&range=5y">
              ?equity=AAPL&benchmark=eth&range=5y
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className={styles.section}>
      <Card title="ERROR">
        <div className={styles.content}>
          <p className={styles.error}>{message}</p>
        </div>
      </Card>
    </div>
  );
}

function CompareView({ query }: { query: ParsedQuery }) {
  const benchmarkLabels: Record<string, string> = {
    gold: 'Gold (XAU/USD)',
    eth: 'Ethereum (ETH/USD)',
    usd: 'US Dollar (cash baseline)',
  };

  return (
    <div className={styles.section}>
      {query.warnings.length > 0 && (
        <Card title="WARNINGS">
          <div className={styles.content}>
            {query.warnings.map((w, i) => (
              <p key={i} className={styles.warning}>{w}</p>
            ))}
          </div>
        </Card>
      )}

      <Card title="CHART">
        <div className={styles.content}>
          <p className={styles.text}>
            Normalized % change &middot; Range: {query.range.toUpperCase()} &middot; Indexed to 0% at start date
          </p>
          <div className={styles.placeholder}>
            <p className={styles.placeholderText}>Chart placeholder &mdash; data fetching not yet implemented</p>
            <p className={styles.placeholderText}>
              Equities: {query.tickers.join(', ')}
              {query.benchmarks.length > 0 ? ` | Benchmarks: ${query.benchmarks.map((b) => b.toUpperCase()).join(', ')}` : ''}
            </p>
          </div>
          <p className={styles.assumptions}>
            All returns are total returns (dividends reinvested where applicable). Benchmark prices are spot prices in USD.
          </p>
        </div>
      </Card>

      <Card title="SUMMARY">
        <Table>
          <TableRow>
            <TableColumn>TYPE</TableColumn>
            <TableColumn>TICKER</TableColumn>
            <TableColumn>DESCRIPTION</TableColumn>
            <TableColumn>RETURN %</TableColumn>
          </TableRow>
          {query.tickers.map((ticker) => (
            <TableRow key={ticker}>
              <TableColumn>Equity</TableColumn>
              <TableColumn>{ticker}</TableColumn>
              <TableColumn>{ticker}</TableColumn>
              <TableColumn>&mdash;</TableColumn>
            </TableRow>
          ))}
          {query.benchmarks.map((b) => (
            <TableRow key={b}>
              <TableColumn>Benchmark</TableColumn>
              <TableColumn>{b.toUpperCase()}</TableColumn>
              <TableColumn>{benchmarkLabels[b] || b}</TableColumn>
              <TableColumn>&mdash;</TableColumn>
            </TableRow>
          ))}
        </Table>
      </Card>
    </div>
  );
}

export default function PortfolioCompare() {
  const searchParams = useSearchParams();
  const result = parseQuery(searchParams);

  if (isParseError(result)) {
    return <ErrorState message={result.error} />;
  }

  if (result.tickers.length === 0) {
    return <LandingState />;
  }

  return <CompareView query={result} />;
}
