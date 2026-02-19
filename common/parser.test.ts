// Unit tests for the v1 query parser — maps 1:1 to SCENARIOS.md sections 1–13
// Each test references the scenario ID it covers.

import { describe, it, expect } from 'vitest';
import { parsePortfolios, MAX_PORTFOLIOS, MAX_TICKERS_PER_PORTFOLIO, MAX_TICKER_LENGTH } from './parser';

function parse(query: string) {
  return parsePortfolios(new URLSearchParams(query));
}

// ─── §1. Happy Path — Valid Input ────────────────────────────────────────────

describe('§1 Happy Path — Valid Input', () => {
  it('1.1 Single ticker', () => {
    const result = parse('equity=AAPL');
    expect(result).toEqual({ ok: true, portfolios: [['AAPL']] });
  });

  it('1.2 Multiple tickers (comma-separated)', () => {
    const result = parse('equity=AAPL,MSFT,GOOG');
    expect(result).toEqual({ ok: true, portfolios: [['AAPL', 'MSFT', 'GOOG']] });
  });

  it('1.3 Ordering is preserved', () => {
    const result = parse('equity=GOOG,AAPL,MSFT');
    expect(result).toEqual({ ok: true, portfolios: [['GOOG', 'AAPL', 'MSFT']] });
  });

  it('1.4 Multiple portfolios via repeated equity params', () => {
    const result = parse('equity=AAPL,MSFT&equity=GOOG,TSLA');
    expect(result).toEqual({
      ok: true,
      portfolios: [
        ['AAPL', 'MSFT'],
        ['GOOG', 'TSLA'],
      ],
    });
  });

  it('1.5 Single ticker per portfolio, multiple portfolios', () => {
    const result = parse('equity=AAPL&equity=MSFT&equity=GOOG');
    expect(result).toEqual({
      ok: true,
      portfolios: [['AAPL'], ['MSFT'], ['GOOG']],
    });
  });
});

// ─── §2. Ticker Normalization ────────────────────────────────────────────────

describe('§2 Ticker Normalization', () => {
  it('2.1 Lowercase input is uppercased', () => {
    const result = parse('equity=aapl,msft');
    expect(result).toEqual({ ok: true, portfolios: [['AAPL', 'MSFT']] });
  });

  it('2.2 Mixed-case input is uppercased', () => {
    const result = parse('equity=Aapl,mSfT,gOOg');
    expect(result).toEqual({ ok: true, portfolios: [['AAPL', 'MSFT', 'GOOG']] });
  });
});

// ─── §3. Whitespace Handling ─────────────────────────────────────────────────

describe('§3 Whitespace Handling', () => {
  it('3.1 Leading/trailing whitespace on tokens is trimmed', () => {
    const result = parse('equity= AAPL , MSFT ');
    expect(result).toEqual({ ok: true, portfolios: [['AAPL', 'MSFT']] });
  });

  it('3.2 Whitespace-only token between commas is treated as empty token', () => {
    const result = parse('equity=AAPL, ,MSFT');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Empty ticker at position 2');
    }
  });

  it('3.3 Leading/trailing whitespace on the entire value is trimmed', () => {
    const result = parse('equity= AAPL,MSFT ');
    expect(result).toEqual({ ok: true, portfolios: [['AAPL', 'MSFT']] });
  });
});

// ─── §4. Deduplication ───────────────────────────────────────────────────────

describe('§4 Deduplication', () => {
  it('4.1 Exact duplicate tickers within a portfolio are rejected', () => {
    const result = parse('equity=AAPL,MSFT,AAPL');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Duplicate ticker: AAPL');
    }
  });

  it('4.2 Case-insensitive duplicates within a portfolio are rejected', () => {
    const result = parse('equity=AAPL,aapl');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Duplicate ticker: AAPL');
    }
  });

  it('4.3 Duplicates detected after normalization', () => {
    const result = parse('equity=msft, Msft');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Duplicate ticker: MSFT');
    }
  });

  it('4.4 Same ticker allowed across different portfolios', () => {
    const result = parse('equity=AAPL,MSFT&equity=AAPL,GOOG');
    expect(result).toEqual({
      ok: true,
      portfolios: [
        ['AAPL', 'MSFT'],
        ['AAPL', 'GOOG'],
      ],
    });
  });
});

// ─── §5. Max Tickers Limit ──────────────────────────────────────────────────

describe('§5 Max Tickers Limit', () => {
  it('5.1 At the maximum (20 tickers)', () => {
    const tickers = 'A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T';
    const result = parse(`equity=${tickers}`);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.portfolios[0]).toHaveLength(20);
      expect(result.portfolios[0]).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T']);
    }
  });

  it('5.2 Exceeding the maximum', () => {
    const tickers = 'A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U';
    const result = parse(`equity=${tickers}`);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Too many tickers in portfolio 1: 21 exceeds maximum of 20');
    }
  });
});

// ─── §6. Empty and Missing Input ─────────────────────────────────────────────

describe('§6 Empty and Missing Input', () => {
  it('6.1 Missing equity parameter entirely', () => {
    const result = parse('');
    expect(result).toEqual({ ok: true, portfolios: [] });
  });

  it('6.2 Empty equity value', () => {
    const result = parse('equity=');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Empty equity parameter');
    }
  });

  it('6.3 Empty token from leading comma', () => {
    const result = parse('equity=,AAPL');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Empty ticker at position 1');
    }
  });

  it('6.4 Empty token from trailing comma', () => {
    const result = parse('equity=AAPL,');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Empty ticker at position 2');
    }
  });

  it('6.5 Empty token from consecutive commas', () => {
    const result = parse('equity=AAPL,,MSFT');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Empty ticker at position 2');
    }
  });

  it('6.6 Only commas', () => {
    const result = parse('equity=,,,');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Empty ticker at position 1');
    }
  });
});

// ─── §7. Reserved Syntax Rejection (`:` and `=` — v2 Weight Syntax) ─────────

describe('§7 Reserved Syntax Rejection', () => {
  it('7.1 Colon inside a token is rejected', () => {
    const result = parse('equity=AAPL:0.5');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Weights (:) are not supported in v1. Use a comma-separated list of tickers like "AAPL,MSFT".');
    }
  });

  it('7.2 URL-encoded colon (%3A) inside a token is rejected', () => {
    // URLSearchParams decodes %3A → :
    const result = parse('equity=AAPL%3A0.5');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Weights (:) are not supported in v1. Use a comma-separated list of tickers like "AAPL,MSFT".');
    }
  });

  it('7.3 Equals sign inside a token is rejected', () => {
    const result = parse('equity=AAPL%3D0.5');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Invalid character '=' in ticker 'AAPL=0.5' — equals signs are reserved");
    }
  });

  it('7.3a URL-encoded equals (%3D) inside a token is rejected', () => {
    const result = parse('equity=AAPL%3D0.5');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Invalid character '=' in ticker 'AAPL=0.5' — equals signs are reserved");
    }
  });

  it('7.4 Colon in one of multiple tokens', () => {
    const result = parse('equity=AAPL,MSFT:0.3,GOOG');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Weights (:) are not supported in v1. Use a comma-separated list of tickers like "AAPL,MSFT".');
    }
  });

  it('7.5 Semicolon is rejected', () => {
    const result = parse('equity=AAPL;MSFT');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Invalid character ';' in ticker 'AAPL;MSFT'");
    }
  });

  it('7.6 Pipe is rejected', () => {
    const result = parse('equity=AAPL|MSFT');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Invalid character '|' in ticker 'AAPL|MSFT'");
    }
  });

  // §7.7 and §7.8: Pinned v1 error string enforcement (#117/#114)
  // These tests use exact string equality (.toBe), NOT substring matching (.toContain)
  it('7.7 Weight syntax with single ticker is rejected — exact pinned error (#117)', () => {
    const result = parse('equity=AAPL:0.5');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(
        'Weights (:) are not supported in v1. Use a comma-separated list of tickers like "AAPL,MSFT".'
      );
    }
  });

  it('7.8 Weight syntax with multiple tickers is rejected — exact pinned error (#117)', () => {
    const result = parse('equity=AAPL:0.5,MSFT');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(
        'Weights (:) are not supported in v1. Use a comma-separated list of tickers like "AAPL,MSFT".'
      );
    }
  });
});

// ─── §8. Invalid Ticker Format ───────────────────────────────────────────────

describe('§8 Invalid Ticker Format', () => {
  it('8.1 Numeric-only ticker is rejected', () => {
    const result = parse('equity=1234');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Invalid ticker format: '1234' — must start with a letter");
    }
  });

  it('8.2 Ticker with special characters is rejected', () => {
    const result = parse('equity=AA$PL');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Invalid character '$' in ticker 'AA$PL'");
    }
  });

  it('8.3 Ticker with spaces inside is rejected (after trim)', () => {
    const result = parse('equity=AA PL');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Invalid character ' ' in ticker 'AA PL'");
    }
  });

  it('8.4 Ticker with hash is rejected', () => {
    // Note: # in URLs truncates at the fragment, so we use URL-encoded %23
    const result = parsePortfolios(new URLSearchParams([['equity', 'AAPL#B']]));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Invalid character '#' in ticker 'AAPL#B'");
    }
  });

  it('8.5 Ticker with at-sign is rejected', () => {
    const result = parse('equity=@AAPL');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Invalid character '@' in ticker '@AAPL'");
    }
  });

  it('8.6 Ticker exceeding max length (10 chars) is rejected', () => {
    const result = parse('equity=ABCDEFGHIJK');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Ticker too long: 'ABCDEFGHIJK' exceeds 10 character limit");
    }
  });

  it('8.7 Valid ticker with dot (e.g., BRK.B)', () => {
    const result = parse('equity=BRK.B');
    expect(result).toEqual({ ok: true, portfolios: [['BRK.B']] });
  });

  it('8.8 Valid ticker with hyphen (e.g., BF-B)', () => {
    const result = parse('equity=BF-B');
    expect(result).toEqual({ ok: true, portfolios: [['BF-B']] });
  });
});

// ─── §9. URL Encoding ────────────────────────────────────────────────────────

describe('§9 URL Encoding', () => {
  it('9.1 URL-encoded comma (%2C) works as separator', () => {
    // URLSearchParams decodes %2C → ,
    const result = parse('equity=AAPL%2CMSFT');
    expect(result).toEqual({ ok: true, portfolios: [['AAPL', 'MSFT']] });
  });

  it('9.2 URL-encoded space (%20) is trimmed', () => {
    const result = parse('equity=%20AAPL%20');
    expect(result).toEqual({ ok: true, portfolios: [['AAPL']] });
  });

  it('9.3 Plus sign (+) as space is trimmed', () => {
    const result = parse('equity=+AAPL+');
    expect(result).toEqual({ ok: true, portfolios: [['AAPL']] });
  });

  it('9.4 URL-encoded colon (%3A) is rejected (same as literal colon)', () => {
    const result = parse('equity=MSFT%3A0.5');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Weights (:) are not supported in v1. Use a comma-separated list of tickers like "AAPL,MSFT".');
    }
  });
});

// ─── §10. Multiple equity Parameters (Multi-Portfolio) ───────────────────────

describe('§10 Multiple equity Parameters (Multi-Portfolio)', () => {
  it('10.1 Two portfolios', () => {
    const result = parse('equity=AAPL,MSFT&equity=GOOG,TSLA,NVDA');
    expect(result).toEqual({
      ok: true,
      portfolios: [
        ['AAPL', 'MSFT'],
        ['GOOG', 'TSLA', 'NVDA'],
      ],
    });
  });

  it('10.2 At the maximum (5 portfolios)', () => {
    const result = parse('equity=AAPL&equity=MSFT&equity=GOOG&equity=TSLA&equity=NVDA');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.portfolios).toHaveLength(5);
      expect(result.portfolios).toEqual([['AAPL'], ['MSFT'], ['GOOG'], ['TSLA'], ['NVDA']]);
    }
  });

  it('10.3 Exceeding the maximum number of portfolios', () => {
    const result = parse('equity=A&equity=B&equity=C&equity=D&equity=E&equity=F');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Too many portfolios: 6 exceeds maximum of 5');
    }
  });

  it('10.4 Error in second portfolio does not affect first', () => {
    const result = parse('equity=AAPL,MSFT&equity=GOOG,,TSLA');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Empty ticker at position 2 in portfolio 2');
    }
  });

  it('10.5 Empty second equity param', () => {
    const result = parse('equity=AAPL&equity=');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Empty equity parameter in portfolio 2');
    }
  });
});

// ─── §11. Unrecognized Query Parameters ──────────────────────────────────────

describe('§11 Unrecognized Query Parameters', () => {
  it('11.1 Unknown parameters are silently ignored', () => {
    const result = parse('equity=AAPL&foo=bar');
    expect(result).toEqual({ ok: true, portfolios: [['AAPL']] });
  });
});

// ─── §12. Combined Edge Cases ────────────────────────────────────────────────

describe('§12 Combined Edge Cases', () => {
  it('12.1 Normalization + dedup detection', () => {
    const result = parse('equity= aapl , AAPL ');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Duplicate ticker: AAPL');
    }
  });

  it('12.2 Trailing comma + max limit', () => {
    const tickers = 'A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,';
    const result = parse(`equity=${tickers}`);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Empty ticker at position 21');
    }
  });

  it('12.3 Reserved char in dedup context', () => {
    const result = parse('equity=AAPL:0.5,AAPL');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Weights (:) are not supported in v1. Use a comma-separated list of tickers like "AAPL,MSFT".');
    }
  });

  it('12.4 Multi-portfolio with per-portfolio error', () => {
    const result = parse('equity=AAPL,MSFT&equity=GOOG:0.5');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Weights (:) are not supported in v1. Use a comma-separated list of tickers like "AAPL,MSFT".');
    }
  });
});

// ─── §13. Error Behavior Contract ────────────────────────────────────────────

describe('§13 Error Behavior Contract', () => {
  it('13.1 First error wins (fail-fast)', () => {
    // Input has empty token at position 1, colon at position 2, duplicate at position 3
    // Only the first error (empty token) should be returned
    const result = parse('equity=,AAPL:0.5,AAPL');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Empty ticker at position 1');
    }
  });

  it('13.2 Error includes enough context to debug', () => {
    // Verify various error types include the offending value or position
    const cases = [
      { query: 'equity=AAPL,,MSFT', should_include: 'position 2' },
      { query: 'equity=AA$PL', should_include: "ticker 'AA$PL'" },
      { query: 'equity=AAPL:0.5', should_include: 'Weights (:) are not supported in v1' },
      { query: 'equity=AAPL,AAPL', should_include: 'AAPL' },
    ];
    for (const { query, should_include } of cases) {
      const result = parse(query);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain(should_include);
      }
    }
  });

  it('13.3 Multi-portfolio errors include the portfolio number', () => {
    const result = parse('equity=AAPL&equity=GOOG,,TSLA');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('in portfolio 2');
    }
  });
});

// ─── §14. v2 Weight Syntax — Explicitly Reserved (rejection coverage) ────────

describe('§14 v2 Weight Syntax — Explicitly Reserved', () => {
  const PINNED_COLON_ERROR = 'Weights (:) are not supported in v1. Use a comma-separated list of tickers like "AAPL,MSFT".';

  it('AAPL:0.5 is rejected with exact pinned error', () => {
    const result = parse('equity=AAPL:0.5');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(PINNED_COLON_ERROR);
    }
  });

  it('AAPL%3A0.5 (URL-encoded) is rejected with exact pinned error', () => {
    const result = parse('equity=AAPL%3A0.5');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(PINNED_COLON_ERROR);
    }
  });

  it('AAPL:60,MSFT:40 is rejected with exact pinned error', () => {
    const result = parse('equity=AAPL:60,MSFT:40');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(PINNED_COLON_ERROR);
    }
  });

  it('AAPL:0.5,MSFT (mixed weighted/unweighted) is rejected with exact pinned error', () => {
    const result = parse('equity=AAPL:0.5,MSFT');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(PINNED_COLON_ERROR);
    }
  });

  it('AAPL=0.5 is rejected with exact equals error', () => {
    const result = parse('equity=AAPL%3D0.5');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Invalid character '=' in ticker 'AAPL=0.5' — equals signs are reserved");
    }
  });

  it('AAPL%3D0.5 (URL-encoded) is rejected with exact equals error', () => {
    const result = parse('equity=AAPL%3D0.5');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Invalid character '=' in ticker 'AAPL=0.5' — equals signs are reserved");
    }
  });
});

// ─── Exported Constants ──────────────────────────────────────────────────────

describe('Exported constants match SCENARIOS.md', () => {
  it('MAX_PORTFOLIOS is 5', () => {
    expect(MAX_PORTFOLIOS).toBe(5);
  });

  it('MAX_TICKERS_PER_PORTFOLIO is 20', () => {
    expect(MAX_TICKERS_PER_PORTFOLIO).toBe(20);
  });

  it('MAX_TICKER_LENGTH is 10', () => {
    expect(MAX_TICKER_LENGTH).toBe(10);
  });
});
