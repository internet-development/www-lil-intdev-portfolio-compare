// Unit tests for the full compare-page query parser (parseCompareQuery).
// Ensures the parser is the single entry point and produces explicit equal-weight portfolios.

import { describe, it, expect } from 'vitest';
import { parseCompareQuery } from './query';
import { COLON_REJECTION_ERROR } from './parser';

function parse(query: string) {
  return parseCompareQuery(new URLSearchParams(query));
}

describe('parseCompareQuery — equity parsing (delegates to v1 parser)', () => {
  it('valid single portfolio produces equal-weight tickers', () => {
    const result = parse('equity=AAPL,MSFT,GOOG');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.query.portfolios).toHaveLength(1);
    const p = result.query.portfolios[0];
    expect(p.tickers).toHaveLength(3);
    expect(p.tickers[0]).toEqual({ ticker: 'AAPL', weight: 1 / 3 });
    expect(p.tickers[1]).toEqual({ ticker: 'MSFT', weight: 1 / 3 });
    expect(p.tickers[2]).toEqual({ ticker: 'GOOG', weight: 1 / 3 });
  });

  it('multi-portfolio produces separate equal-weight portfolios', () => {
    const result = parse('equity=AAPL,MSFT&equity=GOOG');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.query.portfolios).toHaveLength(2);
    expect(result.query.portfolios[0].tickers).toEqual([
      { ticker: 'AAPL', weight: 0.5 },
      { ticker: 'MSFT', weight: 0.5 },
    ]);
    expect(result.query.portfolios[1].tickers).toEqual([{ ticker: 'GOOG', weight: 1 }]);
  });

  it('no equity param returns empty portfolios', () => {
    const result = parse('benchmark=gold');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.query.portfolios).toHaveLength(0);
  });

  it('invalid equity propagates parser error — exact pinned colon error', () => {
    const result = parse('equity=AAPL:0.5');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(COLON_REJECTION_ERROR);
  });
});

describe('parseCompareQuery — benchmark parsing', () => {
  it('single benchmark', () => {
    const result = parse('equity=AAPL&benchmark=gold');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.query.benchmarks).toEqual(['gold']);
  });

  it('multiple benchmarks (pipe-separated)', () => {
    const result = parse('equity=AAPL&benchmark=gold|eth|usd');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.query.benchmarks).toEqual(['gold', 'eth', 'usd']);
  });

  it('benchmark names are case-insensitive', () => {
    const result = parse('equity=AAPL&benchmark=GOLD|ETH');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.query.benchmarks).toEqual(['gold', 'eth']);
  });

  it('no benchmark param returns empty benchmarks array', () => {
    const result = parse('equity=AAPL');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.query.benchmarks).toEqual([]);
  });

  it('unknown benchmark returns error', () => {
    const result = parse('equity=AAPL&benchmark=bitcoin');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("Unknown benchmark: 'bitcoin'");
  });

  it('empty benchmark param returns empty benchmarks array', () => {
    const result = parse('equity=AAPL&benchmark=');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.query.benchmarks).toEqual([]);
  });
});

describe('parseCompareQuery — range parsing', () => {
  it('defaults to 1y when not specified', () => {
    const result = parse('equity=AAPL');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.query.range).toBe('1y');
  });

  it('valid range is preserved', () => {
    const result = parse('equity=AAPL&range=5y');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.query.range).toBe('5y');
  });

  it('all valid range values are accepted', () => {
    const validRanges = ['1m', '3m', '6m', 'ytd', '1y', '3y', '5y', 'max'];
    for (const range of validRanges) {
      const result = parse(`equity=AAPL&range=${range}`);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.query.range).toBe(range);
      }
    }
  });

  it('invalid range returns error', () => {
    const result = parse('equity=AAPL&range=2y');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("Invalid range: '2y'");
  });
});

describe('parseCompareQuery — full query integration', () => {
  it('complete valid query', () => {
    const result = parse('equity=AAPL,MSFT&benchmark=gold|eth&range=3y');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.query.portfolios).toHaveLength(1);
    expect(result.query.portfolios[0].tickers).toEqual([
      { ticker: 'AAPL', weight: 0.5 },
      { ticker: 'MSFT', weight: 0.5 },
    ]);
    expect(result.query.benchmarks).toEqual(['gold', 'eth']);
    expect(result.query.range).toBe('3y');
  });

  it('equity error takes precedence over other params', () => {
    const result = parse('equity=AAPL:0.5&benchmark=invalid&range=bad');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // Equity error comes first since we parse equity first
    expect(result.error).toBe(COLON_REJECTION_ERROR);
  });
});
