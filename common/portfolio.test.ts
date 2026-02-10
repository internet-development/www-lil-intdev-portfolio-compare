// Unit tests for equal-weight portfolio construction
// Ensures weights are computed explicitly as 1/N, not implicitly.

import { describe, it, expect } from 'vitest';
import { buildEqualWeightPortfolio, computePortfolioReturn } from './portfolio';
import type { WeightedPortfolio } from './portfolio';

describe('buildEqualWeightPortfolio', () => {
  it('single ticker gets weight 1.0', () => {
    const portfolio = buildEqualWeightPortfolio(['AAPL']);
    expect(portfolio.tickers).toHaveLength(1);
    expect(portfolio.tickers[0]).toEqual({ ticker: 'AAPL', weight: 1 });
  });

  it('two tickers each get weight 0.5', () => {
    const portfolio = buildEqualWeightPortfolio(['AAPL', 'MSFT']);
    expect(portfolio.tickers).toHaveLength(2);
    expect(portfolio.tickers[0]).toEqual({ ticker: 'AAPL', weight: 0.5 });
    expect(portfolio.tickers[1]).toEqual({ ticker: 'MSFT', weight: 0.5 });
  });

  it('three tickers each get weight 1/3', () => {
    const portfolio = buildEqualWeightPortfolio(['AAPL', 'MSFT', 'GOOG']);
    expect(portfolio.tickers).toHaveLength(3);
    const expectedWeight = 1 / 3;
    for (const t of portfolio.tickers) {
      expect(t.weight).toBe(expectedWeight);
    }
  });

  it('weights sum to 1 for N tickers', () => {
    const tickers = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    const portfolio = buildEqualWeightPortfolio(tickers);
    const totalWeight = portfolio.tickers.reduce((sum, t) => sum + t.weight, 0);
    expect(totalWeight).toBeCloseTo(1, 10);
  });

  it('preserves ticker order', () => {
    const portfolio = buildEqualWeightPortfolio(['GOOG', 'AAPL', 'MSFT']);
    expect(portfolio.tickers.map((t) => t.ticker)).toEqual(['GOOG', 'AAPL', 'MSFT']);
  });

  it('twenty tickers each get weight 1/20 = 0.05', () => {
    const tickers = Array.from({ length: 20 }, (_, i) => String.fromCharCode(65 + i));
    const portfolio = buildEqualWeightPortfolio(tickers);
    expect(portfolio.tickers).toHaveLength(20);
    for (const t of portfolio.tickers) {
      expect(t.weight).toBe(0.05);
    }
  });
});

describe('computePortfolioReturn', () => {
  it('single ticker return is the ticker return itself', () => {
    const portfolio = buildEqualWeightPortfolio(['AAPL']);
    const returns = new Map([['AAPL', 10]]);
    expect(computePortfolioReturn(returns, portfolio)).toBe(10);
  });

  it('equal-weight average of two tickers', () => {
    const portfolio = buildEqualWeightPortfolio(['AAPL', 'MSFT']);
    const returns = new Map([
      ['AAPL', 20],
      ['MSFT', 10],
    ]);
    expect(computePortfolioReturn(returns, portfolio)).toBe(15);
  });

  it('equal-weight average of three tickers with mixed returns', () => {
    const portfolio = buildEqualWeightPortfolio(['A', 'B', 'C']);
    const returns = new Map([
      ['A', 30],
      ['B', -10],
      ['C', 10],
    ]);
    expect(computePortfolioReturn(returns, portfolio)).toBeCloseTo(10, 10);
  });

  it('all zero returns gives zero portfolio return', () => {
    const portfolio = buildEqualWeightPortfolio(['AAPL', 'MSFT']);
    const returns = new Map([
      ['AAPL', 0],
      ['MSFT', 0],
    ]);
    expect(computePortfolioReturn(returns, portfolio)).toBe(0);
  });

  it('missing ticker data is skipped (partial data)', () => {
    const portfolio = buildEqualWeightPortfolio(['AAPL', 'MSFT']);
    const returns = new Map([['AAPL', 20]]);
    // Only AAPL contributes: 0.5 * 20 = 10
    expect(computePortfolioReturn(returns, portfolio)).toBe(10);
  });
});
