import styles from '@components/Chart.module.css';

import * as React from 'react';

import type { NormalizedSeries } from '@common/market-data';

const SERIES_COLORS = [
  'var(--theme-text)',
  '#2563eb',
  '#d946ef',
  '#ea580c',
  '#16a34a',
  '#eab308',
  '#06b6d4',
  '#f43f5e',
];

interface ChartProps {
  series: NormalizedSeries[];
  benchmarkTickers?: string[];
}

const PADDING = { top: 20, right: 16, bottom: 36, left: 54 };
const VIEW_WIDTH = 640;
const VIEW_HEIGHT = 300;

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`;
}

function niceStep(range: number, targetTicks: number): number {
  const rough = range / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const normalized = rough / mag;

  if (normalized <= 1.5) return mag;
  if (normalized <= 3.5) return 2.5 * mag;
  if (normalized <= 7.5) return 5 * mag;
  return 10 * mag;
}

const Chart: React.FC<ChartProps> = ({ series, benchmarkTickers = [] }) => {
  if (series.length === 0 || series.every((s) => s.points.length === 0)) {
    return null;
  }

  const benchmarkSet = new Set(benchmarkTickers.map((t) => t.toUpperCase()));

  const allDates = series[0].points.map((p) => p.date);
  const dateCount = allDates.length;

  if (dateCount === 0) return null;

  let yMin = Infinity;
  let yMax = -Infinity;
  for (const s of series) {
    for (const p of s.points) {
      if (p.value < yMin) yMin = p.value;
      if (p.value > yMax) yMax = p.value;
    }
  }

  // Ensure 0% is always visible
  if (yMin > 0) yMin = 0;
  if (yMax < 0) yMax = 0;

  // Add some breathing room
  const yRange = yMax - yMin || 1;
  yMin -= yRange * 0.05;
  yMax += yRange * 0.05;

  const plotW = VIEW_WIDTH - PADDING.left - PADDING.right;
  const plotH = VIEW_HEIGHT - PADDING.top - PADDING.bottom;

  const xScale = (i: number) => PADDING.left + (i / (dateCount - 1)) * plotW;
  const yScale = (v: number) => PADDING.top + ((yMax - v) / (yMax - yMin)) * plotH;

  // Y-axis ticks
  const step = niceStep(yMax - yMin, 5);
  const yTicks: number[] = [];
  const firstTick = Math.ceil(yMin / step) * step;
  for (let v = firstTick; v <= yMax; v += step) {
    yTicks.push(Math.round(v * 100) / 100);
  }

  // X-axis ticks — pick ~5-6 evenly spaced dates
  const xTickCount = Math.min(6, dateCount);
  const xTicks: number[] = [];
  for (let i = 0; i < xTickCount; i++) {
    xTicks.push(Math.round((i / (xTickCount - 1)) * (dateCount - 1)));
  }

  // Build path strings
  const paths = series.map((s) => {
    const d = s.points
      .map((p, i) => {
        const x = xScale(i).toFixed(2);
        const y = yScale(p.value).toFixed(2);
        return `${i === 0 ? 'M' : 'L'}${x},${y}`;
      })
      .join('');
    return d;
  });

  // Zero line y position
  const zeroY = yScale(0);
  const showZeroLine = zeroY > PADDING.top && zeroY < PADDING.top + plotH;

  // Source attribution
  const sources = Array.from(new Set(series.map((s) => s.source)));

  return (
    <div className={styles.chart}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Performance comparison chart showing % change over time"
      >
        {/* Grid lines */}
        {yTicks.map((v) => (
          <line
            key={`grid-${v}`}
            className={styles.gridLine}
            x1={PADDING.left}
            y1={yScale(v)}
            x2={PADDING.left + plotW}
            y2={yScale(v)}
          />
        ))}

        {/* Zero reference line */}
        {showZeroLine && (
          <line className={styles.zeroLine} x1={PADDING.left} y1={zeroY} x2={PADDING.left + plotW} y2={zeroY} />
        )}

        {/* Axes */}
        <line
          className={styles.axisLine}
          x1={PADDING.left}
          y1={PADDING.top}
          x2={PADDING.left}
          y2={PADDING.top + plotH}
        />
        <line
          className={styles.axisLine}
          x1={PADDING.left}
          y1={PADDING.top + plotH}
          x2={PADDING.left + plotW}
          y2={PADDING.top + plotH}
        />

        {/* Y-axis labels */}
        {yTicks.map((v) => (
          <text
            key={`y-${v}`}
            className={styles.axisLabel}
            x={PADDING.left - 6}
            y={yScale(v) + 3}
            textAnchor="end"
          >
            {v.toFixed(1)}%
          </text>
        ))}

        {/* X-axis labels */}
        {xTicks.map((idx) => (
          <text
            key={`x-${idx}`}
            className={styles.axisLabel}
            x={xScale(idx)}
            y={PADDING.top + plotH + 16}
            textAnchor="middle"
          >
            {formatDate(allDates[idx])}
          </text>
        ))}

        {/* Series lines */}
        {paths.map((d, i) => {
          const isBenchmark = benchmarkSet.has(series[i].ticker.toUpperCase());
          return (
            <path
              key={series[i].ticker}
              d={d}
              className={`${styles.seriesLine}${isBenchmark ? ` ${styles.seriesDashed}` : ''}`}
              stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
            />
          );
        })}
      </svg>

      {/* Legend */}
      <div className={styles.legend}>
        {series.map((s, i) => {
          const isBenchmark = benchmarkSet.has(s.ticker.toUpperCase());
          const color = SERIES_COLORS[i % SERIES_COLORS.length];
          return (
            <div key={s.ticker} className={styles.legendItem}>
              <span
                className={`${styles.legendSwatch}${isBenchmark ? ` ${styles.legendSwatchDashed}` : ''}`}
                style={{ backgroundColor: isBenchmark ? 'transparent' : color, borderColor: color }}
              />
              <span className={styles.legendLabel}>{s.ticker}</span>
            </div>
          );
        })}
      </div>

      {/* Attribution (scenario A7) */}
      <div className={styles.attribution}>
        Indexed to % change from start date — Source: {sources.join(', ')}
      </div>
    </div>
  );
};

export default Chart;
