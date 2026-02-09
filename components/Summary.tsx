import styles from '@components/Summary.module.css';

import * as React from 'react';

import type { SummaryRow } from '@common/types';

interface SummaryProps {
  rows: SummaryRow[];
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function formatPrice(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function returnClassName(value: number): string {
  if (value > 0) return styles.positive;
  if (value < 0) return styles.negative;
  return styles.neutral;
}

const Summary: React.FC<SummaryProps> = ({ rows }) => {
  if (!rows || rows.length === 0) return null;

  const equities = rows.filter((r) => !r.isBenchmark);
  const benchmarks = rows.filter((r) => r.isBenchmark);

  function renderRows(items: SummaryRow[]) {
    return items.map((row) => (
      <tr key={row.ticker} className={styles.row} tabIndex={0}>
        <td className={styles.cell}>{row.ticker}</td>
        <td className={styles.cell}>{formatDateShort(row.startDate)}</td>
        <td className={styles.cell}>{formatDateShort(row.endDate)}</td>
        <td className={styles.cell}>{formatPrice(row.startPrice)}</td>
        <td className={styles.cell}>{formatPrice(row.endPrice)}</td>
        <td className={`${styles.cell} ${returnClassName(row.totalReturn)}`}>{formatPercent(row.totalReturn)}</td>
      </tr>
    ));
  }

  return (
    <div className={styles.root}>
      <table className={styles.table} role="table" aria-label="Performance summary">
        <thead className={styles.thead}>
          <tr className={styles.headerRow}>
            <th className={styles.headerCell} scope="col">TICKER</th>
            <th className={styles.headerCell} scope="col">START</th>
            <th className={styles.headerCell} scope="col">END</th>
            <th className={styles.headerCell} scope="col">START $</th>
            <th className={styles.headerCell} scope="col">END $</th>
            <th className={styles.headerCell} scope="col">RETURN</th>
          </tr>
        </thead>
        <tbody className={styles.tbody}>
          {equities.length > 0 && (
            <>
              <tr>
                <td className={styles.sectionLabel} colSpan={6}>EQUITIES</td>
              </tr>
              {renderRows(equities)}
            </>
          )}
          {benchmarks.length > 0 && (
            <>
              <tr className={styles.dividerRow}>
                <td className={styles.dividerCell} colSpan={6}>
                  <hr className={styles.dividerLine} />
                </td>
              </tr>
              <tr>
                <td className={styles.sectionLabel} colSpan={6}>BENCHMARKS</td>
              </tr>
              {renderRows(benchmarks)}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Summary;
