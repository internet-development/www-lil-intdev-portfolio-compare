import styles from '@components/Summary.module.css';

import * as React from 'react';

import type { SeriesData } from '@common/types';

interface SummaryProps {
  series: SeriesData[];
  amount?: number;
  benchmarkTickers?: string[];
}

function formatPrice(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

function formatPct(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

const Summary: React.FC<SummaryProps> = ({ series, amount, benchmarkTickers = [] }) => {
  if (series.length === 0) return null;

  const benchmarkSet = new Set(benchmarkTickers.map((t) => t.toUpperCase()));

  const rows = series.map((s) => {
    const pts = s.points;
    if (pts.length === 0) return null;

    const startPrice = pts[0].close;
    const endPrice = pts[pts.length - 1].close;
    const returnPct = ((endPrice - startPrice) / startPrice) * 100;
    const isBenchmark = benchmarkSet.has(s.ticker.toUpperCase());

    return {
      ticker: s.ticker,
      startPrice,
      endPrice,
      returnPct,
      isBenchmark,
    };
  }).filter(Boolean) as { ticker: string; startPrice: number; endPrice: number; returnPct: number; isBenchmark: boolean }[];

  if (rows.length === 0) return null;

  const equityRows = rows.filter((r) => !r.isBenchmark);
  const hasAmount = amount !== undefined && amount > 0;
  const equityCount = equityRows.length;
  const perTickerAmount = equityCount > 0 && hasAmount ? amount / equityCount : 0;

  return (
    <div className={styles.root}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Ticker</th>
            <th>Start</th>
            <th>End</th>
            <th>Return</th>
            {hasAmount && <th>Value</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const pctClass = row.returnPct >= 0 ? styles.positive : styles.negative;
            const invested = row.isBenchmark ? 0 : perTickerAmount;
            const endValue = invested > 0 ? invested * (1 + row.returnPct / 100) : 0;

            return (
              <tr key={row.ticker}>
                <td>{row.ticker}</td>
                <td>{formatPrice(row.startPrice)}</td>
                <td>{formatPrice(row.endPrice)}</td>
                <td className={pctClass}>{formatPct(row.returnPct)}</td>
                {hasAmount && <td>{row.isBenchmark ? '—' : formatPrice(endValue)}</td>}
              </tr>
            );
          })}
          {hasAmount && equityCount > 0 && (
            <tr className={styles.total}>
              <td>TOTAL</td>
              <td></td>
              <td></td>
              <td className={
                equityRows.reduce((sum, r) => sum + r.returnPct, 0) / equityCount >= 0
                  ? styles.positive
                  : styles.negative
              }>
                {formatPct(equityRows.reduce((sum, r) => sum + r.returnPct, 0) / equityCount)}
              </td>
              <td>
                {formatPrice(
                  equityRows.reduce((sum, r) => sum + perTickerAmount * (1 + r.returnPct / 100), 0)
                )}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Summary;
