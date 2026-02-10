// Equal-weight portfolio construction for v1
// Each equity in a portfolio receives weight 1/N (explicitly computed, not implicit).
// See SCENARIOS.md §1 and LIL-INTDEV-AGENTS.md "Equal-weight only" constraint.

export interface WeightedTicker {
  ticker: string;
  weight: number;
}

export interface WeightedPortfolio {
  tickers: WeightedTicker[];
}

/**
 * Given a list of ticker symbols, compute equal weights (1/N each).
 * Returns an explicit WeightedPortfolio where all weights sum to 1.
 *
 * Precondition: tickers.length >= 1 (caller must validate).
 */
export function buildEqualWeightPortfolio(tickers: string[]): WeightedPortfolio {
  const n = tickers.length;
  const weight = 1 / n;

  return {
    tickers: tickers.map((ticker) => ({ ticker, weight })),
  };
}

/**
 * Compute the weighted portfolio return for a single date,
 * given per-ticker returns (% change from start) and weights.
 *
 * Formula: sum(weight_i * return_i) for all i
 */
export function computePortfolioReturn(
  tickerReturns: Map<string, number>,
  portfolio: WeightedPortfolio
): number {
  let portfolioReturn = 0;
  for (const { ticker, weight } of portfolio.tickers) {
    const ret = tickerReturns.get(ticker);
    if (ret !== undefined) {
      portfolioReturn += weight * ret;
    }
  }
  return portfolioReturn;
}
