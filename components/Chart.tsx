import styles from '@components/Chart.module.css';

import * as React from 'react';

import type { NormalizedSeries } from '@common/types';

const SERIES_COLORS = [
  'var(--color-neon-green-70, #39FF14)',
  'var(--color-blue-50, #3B82F6)',
  'var(--color-orange-50, #F97316)',
  'var(--color-purple-50, #A855F7)',
  'var(--color-pink-50, #EC4899)',
  'var(--color-yellow-50, #EAB308)',
  'var(--color-cyan-50, #06B6D4)',
  'var(--color-red-50, #EF4444)',
];

const MARGIN = { top: 20, right: 60, bottom: 30, left: 60 };
const CHART_WIDTH = 640;
const CHART_HEIGHT = 300;

interface ChartProps {
  series: NormalizedSeries[];
  sources?: string[];
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`;
}

function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function niceScale(min: number, max: number, ticks: number): number[] {
  const range = max - min;
  if (range === 0) return [min];
  const rough = range / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const residual = rough / mag;
  let nice: number;
  if (residual <= 1.5) nice = 1 * mag;
  else if (residual <= 3) nice = 2 * mag;
  else if (residual <= 7) nice = 5 * mag;
  else nice = 10 * mag;

  const start = Math.floor(min / nice) * nice;
  const end = Math.ceil(max / nice) * nice;
  const result: number[] = [];
  for (let v = start; v <= end + nice * 0.01; v += nice) {
    result.push(Math.round(v * 1000) / 1000);
  }
  return result;
}

const Chart: React.FC<ChartProps> = ({ series, sources }) => {
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = React.useState<{ x: number; y: number } | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);

  if (!series || series.length === 0) {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>No data to display</div>
      </div>
    );
  }

  const allDates = series[0]?.points.map((p) => p.date) ?? [];
  const dateCount = allDates.length;
  if (dateCount === 0) {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>No data points available</div>
      </div>
    );
  }

  let yMin = Infinity;
  let yMax = -Infinity;
  for (const s of series) {
    for (const p of s.points) {
      if (p.value < yMin) yMin = p.value;
      if (p.value > yMax) yMax = p.value;
    }
  }

  const yPad = (yMax - yMin) * 0.1 || 10;
  yMin = yMin - yPad;
  yMax = yMax + yPad;

  const innerW = CHART_WIDTH - MARGIN.left - MARGIN.right;
  const innerH = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;

  const xScale = (i: number) => MARGIN.left + (i / Math.max(dateCount - 1, 1)) * innerW;
  const yScale = (v: number) => MARGIN.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

  const yTicks = niceScale(yMin, yMax, 5);

  const xTickCount = Math.min(6, dateCount);
  const xTickIndices: number[] = [];
  for (let i = 0; i < xTickCount; i++) {
    xTickIndices.push(Math.round((i / Math.max(xTickCount - 1, 1)) * (dateCount - 1)));
  }

  function buildPath(points: { date: string; value: number }[]): string {
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(2)},${yScale(p.value).toFixed(2)}`).join(' ');
  }

  function handleMouseMove(e: React.MouseEvent<SVGRectElement>) {
    const svg = svgRef.current;
    const root = rootRef.current;
    if (!svg || !root) return;
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const svgWidth = rect.width;
    const scaledX = (mouseX / svgWidth) * CHART_WIDTH;
    const idx = Math.round(((scaledX - MARGIN.left) / innerW) * (dateCount - 1));
    const clampedIdx = Math.max(0, Math.min(dateCount - 1, idx));
    setHoverIndex(clampedIdx);
    setTooltipPos({ x: e.clientX - root.getBoundingClientRect().left, y: e.clientY - root.getBoundingClientRect().top });
  }

  function handleMouseLeave() {
    setHoverIndex(null);
    setTooltipPos(null);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (hoverIndex === null) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        setHoverIndex(0);
        e.preventDefault();
      }
      return;
    }
    if (e.key === 'ArrowRight') {
      setHoverIndex(Math.min(hoverIndex + 1, dateCount - 1));
      e.preventDefault();
    } else if (e.key === 'ArrowLeft') {
      setHoverIndex(Math.max(hoverIndex - 1, 0));
      e.preventDefault();
    } else if (e.key === 'Escape') {
      setHoverIndex(null);
      setTooltipPos(null);
    }
  }

  const sourceText = sources && sources.length > 0 ? sources.join(', ') : 'Market data provider';

  return (
    <div className={styles.root} ref={rootRef}>
      <svg
        ref={svgRef}
        className={styles.chart}
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Performance comparison chart showing normalized percentage returns over time"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        {yTicks.map((v) => (
          <line key={`grid-${v}`} className={styles.gridLine} x1={MARGIN.left} x2={CHART_WIDTH - MARGIN.right} y1={yScale(v)} y2={yScale(v)} />
        ))}

        {yMin <= 0 && yMax >= 0 && <line className={styles.zeroLine} x1={MARGIN.left} x2={CHART_WIDTH - MARGIN.right} y1={yScale(0)} y2={yScale(0)} />}

        <line className={styles.axisLine} x1={MARGIN.left} x2={MARGIN.left} y1={MARGIN.top} y2={CHART_HEIGHT - MARGIN.bottom} />
        <line className={styles.axisLine} x1={MARGIN.left} x2={CHART_WIDTH - MARGIN.right} y1={CHART_HEIGHT - MARGIN.bottom} y2={CHART_HEIGHT - MARGIN.bottom} />

        {yTicks.map((v) => (
          <text key={`ytick-${v}`} className={styles.axisLabel} x={MARGIN.left - 4} y={yScale(v) + 3} textAnchor="end">
            {formatPercent(v)}
          </text>
        ))}

        {xTickIndices.map((idx) => (
          <text key={`xtick-${idx}`} className={styles.axisLabel} x={xScale(idx)} y={CHART_HEIGHT - MARGIN.bottom + 16} textAnchor="middle">
            {formatDateLabel(allDates[idx])}
          </text>
        ))}

        {series.map((s, si) => {
          const color = SERIES_COLORS[si % SERIES_COLORS.length];
          return <path key={s.ticker} className={s.isBenchmark ? styles.seriesBenchmark : styles.seriesLine} d={buildPath(s.points)} stroke={color} />;
        })}

        {hoverIndex !== null && (
          <line className={styles.crosshair} x1={xScale(hoverIndex)} x2={xScale(hoverIndex)} y1={MARGIN.top} y2={CHART_HEIGHT - MARGIN.bottom} />
        )}

        {hoverIndex !== null &&
          series.map((s, si) => {
            if (!s.points[hoverIndex]) return null;
            const color = SERIES_COLORS[si % SERIES_COLORS.length];
            return <circle key={`dot-${s.ticker}`} cx={xScale(hoverIndex)} cy={yScale(s.points[hoverIndex].value)} r={3} fill={color} stroke="var(--theme-background)" strokeWidth={1} />;
          })}

        <rect className={styles.hitArea} x={MARGIN.left} y={MARGIN.top} width={innerW} height={innerH} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} />
      </svg>

      {hoverIndex !== null && tooltipPos && (
        <div
          className={styles.tooltip}
          style={{
            left: tooltipPos.x + 12,
            top: tooltipPos.y - 10,
          }}
          role="tooltip"
        >
          <div className={styles.tooltipDate}>{formatDateFull(allDates[hoverIndex])}</div>
          {series.map((s, si) => {
            if (!s.points[hoverIndex]) return null;
            const color = SERIES_COLORS[si % SERIES_COLORS.length];
            return (
              <div key={s.ticker} className={styles.tooltipRow}>
                <span className={styles.tooltipSwatch} style={{ backgroundColor: color }} />
                {s.ticker}: {formatPercent(s.points[hoverIndex].value)}
              </div>
            );
          })}
        </div>
      )}

      <div className={styles.legend} role="list" aria-label="Chart legend">
        {series.map((s, si) => {
          const color = SERIES_COLORS[si % SERIES_COLORS.length];
          return (
            <div key={s.ticker} className={styles.legendItem} role="listitem">
              <span className={s.isBenchmark ? styles.legendSwatchDashed : styles.legendSwatch} style={{ backgroundColor: !s.isBenchmark ? color : undefined, borderColor: s.isBenchmark ? color : undefined }} />
              <span className={styles.legendLabel}>{s.ticker}{s.isBenchmark ? ' (benchmark)' : ''}</span>
            </div>
          );
        })}
      </div>

      <div className={styles.assumptions}>
        Indexed to 0% at start date. All returns are total returns (dividends reinvested where applicable). Benchmark prices are spot prices in USD. Data sourced from {sourceText}.
      </div>
    </div>
  );
};

export default Chart;
