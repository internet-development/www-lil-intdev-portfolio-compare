import { describe, it, expect } from 'vitest';
import { parsePortfolios, MAX_TICKERS_PER_PORTFOLIO, MAX_PORTFOLIOS, MAX_TICKER_LENGTH } from './parser';

/** Helper: parse a query string and return the result. */
function parse(qs: string) {
  const params = new URLSearchParams(qs);
  return parsePortfolios(params);
}

/** Helper: assert success and return portfolios. */
function expectOk(qs: string) {
  const result = parse(qs);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('expected ok');
  return result.data.portfolios;
}

/** Helper: assert failure and return error message. */
function expectError(qs: string) {
  const result = parse(qs);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('expected error');
  return result.error.message;
}

// ============================================================
// §1 — Happy Path
// ============================================================

describe('§1 Happy Path — Valid Input', () => {
  it('1.1 Single ticker', () => {
    const portfolios = expectOk('equity=AAPL');
    expect(portfolios).toEqual([['AAPL']]);
  });

  it('1.2 Multiple tickers (comma-separated)', () => {
    const portfolios = expectOk('equity=AAPL,MSFT,GOOG');
    expect(portfolios).toEqual([['AAPL', 'MSFT', 'GOOG']]);
  });

  it('1.3 Ordering is preserved', () => {
    const portfolios = expectOk('equity=GOOG,AAPL,MSFT');
    expect(portfolios).toEqual([['GOOG', 'AAPL', 'MSFT']]);
  });

  it('1.4 Multiple portfolios via repeated equity params', () => {
    const portfolios = expectOk('equity=AAPL,MSFT&equity=GOOG,TSLA');
    expect(portfolios).toEqual([['AAPL', 'MSFT'], ['GOOG', 'TSLA']]);
  });

  it('1.5 Single ticker per portfolio, multiple portfolios', () => {
    const portfolios = expectOk('equity=AAPL&equity=MSFT&equity=GOOG');
    expect(portfolios).toEqual([['AAPL'], ['MSFT'], ['GOOG']]);
  });
});

// ============================================================
// §2 — Ticker Normalization
// ============================================================

describe('§2 Ticker Normalization', () => {
  it('2.1 Lowercase input is uppercased', () => {
    const portfolios = expectOk('equity=aapl,msft');
    expect(portfolios).toEqual([['AAPL', 'MSFT']]);
  });

  it('2.2 Mixed-case input is uppercased', () => {
    const portfolios = expectOk('equity=Aapl,mSfT,gOOg');
    expect(portfolios).toEqual([['AAPL', 'MSFT', 'GOOG']]);
  });
});

// ============================================================
// §3 — Whitespace Handling
// ============================================================

describe('§3 Whitespace Handling', () => {
  it('3.1 Leading/trailing whitespace on tokens is trimmed', () => {
    const portfolios = expectOk('equity= AAPL , MSFT ');
    expect(portfolios).toEqual([['AAPL', 'MSFT']]);
  });

  it('3.2 Whitespace-only token between commas is treated as empty token', () => {
    const msg = expectError('equity=AAPL, ,MSFT');
    expect(msg).toBe('Empty ticker at position 2');
  });

  it('3.3 Leading/trailing whitespace on the entire value is trimmed', () => {
    const portfolios = expectOk('equity= AAPL,MSFT ');
    expect(portfolios).toEqual([['AAPL', 'MSFT']]);
  });
});

// ============================================================
// §4 — Deduplication
// ============================================================

describe('§4 Deduplication', () => {
  it('4.1 Exact duplicate tickers within a portfolio are rejected', () => {
    const msg = expectError('equity=AAPL,MSFT,AAPL');
    expect(msg).toBe('Duplicate ticker: AAPL');
  });

  it('4.2 Case-insensitive duplicates within a portfolio are rejected', () => {
    const msg = expectError('equity=AAPL,aapl');
    expect(msg).toBe('Duplicate ticker: AAPL');
  });

  it('4.3 Duplicates detected after normalization', () => {
    const msg = expectError('equity=msft, Msft');
    expect(msg).toBe('Duplicate ticker: MSFT');
  });

  it('4.4 Same ticker allowed across different portfolios', () => {
    const portfolios = expectOk('equity=AAPL,MSFT&equity=AAPL,GOOG');
    expect(portfolios).toEqual([['AAPL', 'MSFT'], ['AAPL', 'GOOG']]);
  });
});

// ============================================================
// §5 — Max Tickers Limit
// ============================================================

describe('§5 Max Tickers Limit', () => {
  it('5.1 At the maximum (20 tickers)', () => {
    const tickers = 'A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T';
    const portfolios = expectOk(`equity=${tickers}`);
    expect(portfolios[0]).toHaveLength(20);
    expect(portfolios[0]).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T']);
  });

  it('5.2 Exceeding the maximum', () => {
    const tickers = 'A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U';
    const msg = expectError(`equity=${tickers}`);
    expect(msg).toBe('Too many tickers in portfolio 1: 21 exceeds maximum of 20');
  });
});

// ============================================================
// §6 — Empty and Missing Input
// ============================================================

describe('§6 Empty and Missing Input', () => {
  it('6.1 Missing equity parameter entirely', () => {
    const portfolios = expectOk('');
    expect(portfolios).toEqual([]);
  });

  it('6.2 Empty equity value', () => {
    const msg = expectError('equity=');
    expect(msg).toBe('Empty equity parameter');
  });

  it('6.3 Empty token from leading comma', () => {
    const msg = expectError('equity=,AAPL');
    expect(msg).toBe('Empty ticker at position 1');
  });

  it('6.4 Empty token from trailing comma', () => {
    const msg = expectError('equity=AAPL,');
    expect(msg).toBe('Empty ticker at position 2');
  });

  it('6.5 Empty token from consecutive commas', () => {
    const msg = expectError('equity=AAPL,,MSFT');
    expect(msg).toBe('Empty ticker at position 2');
  });

  it('6.6 Only commas', () => {
    const msg = expectError('equity=,,,');
    expect(msg).toBe('Empty ticker at position 1');
  });
});

// ============================================================
// §7 — Reserved Syntax Rejection (: and = — v2 Weight Syntax)
// ============================================================

describe('§7 Reserved Syntax Rejection', () => {
  it('7.1 Colon inside a token is rejected', () => {
    const msg = expectError('equity=AAPL:0.5');
    expect(msg).toBe("Invalid character ':' in ticker 'AAPL:0.5' — colons are reserved for v2 weight syntax");
  });

  it('7.2 URL-encoded colon (%3A) inside a token is rejected', () => {
    // URLSearchParams automatically decodes %3A to :
    const msg = expectError('equity=AAPL%3A0.5');
    expect(msg).toBe("Invalid character ':' in ticker 'AAPL:0.5' — colons are reserved for v2 weight syntax");
  });

  it('7.3 Equals sign inside a token is rejected', () => {
    const msg = expectError('equity=AAPL%3D0.5');
    expect(msg).toBe("Invalid character '=' in ticker 'AAPL=0.5' — equals signs are reserved");
  });

  it('7.3a URL-encoded equals (%3D) inside a token is rejected', () => {
    const msg = expectError('equity=AAPL%3D0.5');
    expect(msg).toBe("Invalid character '=' in ticker 'AAPL=0.5' — equals signs are reserved");
  });

  it('7.4 Colon in one of multiple tokens', () => {
    const msg = expectError('equity=AAPL,MSFT:0.3,GOOG');
    expect(msg).toBe("Invalid character ':' in ticker 'MSFT:0.3' — colons are reserved for v2 weight syntax");
  });

  it('7.5 Semicolon is rejected', () => {
    const msg = expectError('equity=AAPL;MSFT');
    expect(msg).toBe("Invalid character ';' in ticker 'AAPL;MSFT'");
  });

  it('7.6 Pipe is rejected', () => {
    const msg = expectError('equity=AAPL|MSFT');
    expect(msg).toBe("Invalid character '|' in ticker 'AAPL|MSFT'");
  });
});

// ============================================================
// §8 — Invalid Ticker Format
// ============================================================

describe('§8 Invalid Ticker Format', () => {
  it('8.1 Numeric-only ticker is rejected', () => {
    const msg = expectError('equity=1234');
    expect(msg).toBe("Invalid ticker format: '1234' — must start with a letter");
  });

  it('8.2 Ticker with special characters is rejected', () => {
    const msg = expectError('equity=AA$PL');
    expect(msg).toBe("Invalid character '$' in ticker 'AA$PL'");
  });

  it('8.3 Ticker with spaces inside is rejected (after trim)', () => {
    const msg = expectError('equity=AA PL');
    expect(msg).toBe("Invalid character ' ' in ticker 'AA PL'");
  });

  it('8.4 Ticker with hash is rejected', () => {
    // Note: # in URL is a fragment, so URLSearchParams won't see it.
    // We test with the raw value directly by encoding it.
    const msg = expectError('equity=AAPL%23B');
    expect(msg).toBe("Invalid character '#' in ticker 'AAPL#B'");
  });

  it('8.5 Ticker with at-sign is rejected', () => {
    const msg = expectError('equity=@AAPL');
    expect(msg).toBe("Invalid character '@' in ticker '@AAPL'");
  });

  it('8.6 Ticker exceeding max length (10 chars) is rejected', () => {
    const msg = expectError('equity=ABCDEFGHIJK');
    expect(msg).toBe("Ticker too long: 'ABCDEFGHIJK' exceeds 10 character limit");
  });

  it('8.7 Valid ticker with dot (e.g., BRK.B)', () => {
    const portfolios = expectOk('equity=BRK.B');
    expect(portfolios).toEqual([['BRK.B']]);
  });

  it('8.8 Valid ticker with hyphen (e.g., BF-B)', () => {
    const portfolios = expectOk('equity=BF-B');
    expect(portfolios).toEqual([['BF-B']]);
  });
});

// ============================================================
// §9 — URL Encoding
// ============================================================

describe('§9 URL Encoding', () => {
  it('9.1 URL-encoded comma (%2C) works as separator', () => {
    const portfolios = expectOk('equity=AAPL%2CMSFT');
    expect(portfolios).toEqual([['AAPL', 'MSFT']]);
  });

  it('9.2 URL-encoded space (%20) is trimmed', () => {
    const portfolios = expectOk('equity=%20AAPL%20');
    expect(portfolios).toEqual([['AAPL']]);
  });

  it('9.3 Plus sign (+) as space is trimmed', () => {
    const portfolios = expectOk('equity=+AAPL+');
    expect(portfolios).toEqual([['AAPL']]);
  });

  it('9.4 URL-encoded colon (%3A) is rejected (same as literal colon)', () => {
    const msg = expectError('equity=MSFT%3A0.5');
    expect(msg).toBe("Invalid character ':' in ticker 'MSFT:0.5' — colons are reserved for v2 weight syntax");
  });
});

// ============================================================
// §10 — Multiple equity Parameters (Multi-Portfolio)
// ============================================================

describe('§10 Multiple equity Parameters', () => {
  it('10.1 Two portfolios', () => {
    const portfolios = expectOk('equity=AAPL,MSFT&equity=GOOG,TSLA,NVDA');
    expect(portfolios).toEqual([['AAPL', 'MSFT'], ['GOOG', 'TSLA', 'NVDA']]);
  });

  it('10.2 At the maximum (5 portfolios)', () => {
    const portfolios = expectOk('equity=AAPL&equity=MSFT&equity=GOOG&equity=TSLA&equity=NVDA');
    expect(portfolios).toHaveLength(5);
    expect(portfolios[0]).toEqual(['AAPL']);
    expect(portfolios[4]).toEqual(['NVDA']);
  });

  it('10.3 Exceeding the maximum number of portfolios', () => {
    const msg = expectError('equity=A&equity=B&equity=C&equity=D&equity=E&equity=F');
    expect(msg).toBe('Too many portfolios: 6 exceeds maximum of 5');
  });

  it('10.4 Error in second portfolio does not affect first', () => {
    const msg = expectError('equity=AAPL,MSFT&equity=GOOG,,TSLA');
    expect(msg).toBe('Empty ticker at position 2 in portfolio 2');
  });

  it('10.5 Empty second equity param', () => {
    const msg = expectError('equity=AAPL&equity=');
    expect(msg).toBe('Empty equity parameter in portfolio 2');
  });
});

// ============================================================
// §11 — Unrecognized Query Parameters
// ============================================================

describe('§11 Unrecognized Query Parameters', () => {
  it('11.1 Unknown parameters are silently ignored', () => {
    const portfolios = expectOk('equity=AAPL&foo=bar');
    expect(portfolios).toEqual([['AAPL']]);
  });
});

// ============================================================
// §12 — Combined Edge Cases
// ============================================================

describe('§12 Combined Edge Cases', () => {
  it('12.1 Normalization + dedup detection', () => {
    const msg = expectError('equity= aapl , AAPL ');
    expect(msg).toBe('Duplicate ticker: AAPL');
  });

  it('12.2 Trailing comma + max limit', () => {
    const tickers = 'A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,';
    const msg = expectError(`equity=${tickers}`);
    expect(msg).toBe('Empty ticker at position 21');
  });

  it('12.3 Reserved char in dedup context', () => {
    const msg = expectError('equity=AAPL:0.5,AAPL');
    expect(msg).toBe("Invalid character ':' in ticker 'AAPL:0.5' — colons are reserved for v2 weight syntax");
  });

  it('12.4 Multi-portfolio with per-portfolio error', () => {
    const msg = expectError('equity=AAPL,MSFT&equity=GOOG:0.5');
    expect(msg).toBe("Invalid character ':' in ticker 'GOOG:0.5' — colons are reserved for v2 weight syntax");
  });
});

// ============================================================
// §13 — Error Behavior Contract
// ============================================================

describe('§13 Error Behavior Contract', () => {
  it('13.1 First error wins (fail-fast)', () => {
    const msg = expectError('equity=,AAPL:0.5,AAPL');
    expect(msg).toBe('Empty ticker at position 1');
  });

  it('13.2 Error includes enough context to debug', () => {
    const msg = expectError('equity=AAPL:0.5');
    expect(msg).toContain('AAPL:0.5');
    expect(msg.length).toBeGreaterThan(0);
  });

  it('13.3 Multi-portfolio errors include the portfolio number', () => {
    const msg = expectError('equity=AAPL&equity=,MSFT');
    expect(msg).toContain('in portfolio 2');
  });
});

// ============================================================
// Constants
// ============================================================

describe('Constants', () => {
  it('MAX_TICKERS_PER_PORTFOLIO is 20', () => {
    expect(MAX_TICKERS_PER_PORTFOLIO).toBe(20);
  });

  it('MAX_PORTFOLIOS is 5', () => {
    expect(MAX_PORTFOLIOS).toBe(5);
  });

  it('MAX_TICKER_LENGTH is 10', () => {
    expect(MAX_TICKER_LENGTH).toBe(10);
  });
});

// ============================================================
// Benchmark + Range parsing (basic coverage)
// ============================================================

describe('Benchmark and Range parsing', () => {
  it('parses benchmark param', () => {
    const result = parse('equity=AAPL&benchmark=gold');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.benchmark).toEqual(['gold']);
    }
  });

  it('parses multiple benchmarks via pipe', () => {
    const result = parse('equity=AAPL&benchmark=gold|eth|usd');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.benchmark).toEqual(['gold', 'eth', 'usd']);
    }
  });

  it('defaults range to 1y', () => {
    const result = parse('equity=AAPL');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.range).toBe('1y');
    }
  });

  it('parses valid range', () => {
    const result = parse('equity=AAPL&range=5y');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.range).toBe('5y');
    }
  });

  it('defaults to 1y for invalid range', () => {
    const result = parse('equity=AAPL&range=banana');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.range).toBe('1y');
    }
  });
});
