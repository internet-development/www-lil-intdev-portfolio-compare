import { describe, it, expect } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';
import { COLON_REJECTION_ERROR } from '@common/parser';

function makeRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost:10000/api/compare/validate?${query}`);
}

describe('/api/compare/validate', () => {
  it('returns 200 with parsed portfolios for valid input', async () => {
    const res = await GET(makeRequest('equity=AAPL,MSFT'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.portfolios).toEqual([['AAPL', 'MSFT']]);
  });

  it('returns 200 for multiple portfolios', async () => {
    const res = await GET(makeRequest('equity=AAPL,MSFT&equity=GOOG,TSLA'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.portfolios).toEqual([['AAPL', 'MSFT'], ['GOOG', 'TSLA']]);
  });

  it('returns 400 when equity param is missing', async () => {
    const res = await GET(makeRequest(''));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('equity param is required');
  });

  it('returns 400 for empty equity value', async () => {
    const res = await GET(makeRequest('equity='));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Empty equity parameter');
  });

  it('returns 400 for colon (v2 reserved syntax) — exact pinned error', async () => {
    const res = await GET(makeRequest('equity=AAPL:0.5'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe(COLON_REJECTION_ERROR);
  });

  it('returns 400 for duplicate tickers', async () => {
    const res = await GET(makeRequest('equity=AAPL,aapl'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Duplicate ticker: AAPL');
  });

  it('returns 400 for too many portfolios', async () => {
    const res = await GET(makeRequest('equity=A&equity=B&equity=C&equity=D&equity=E&equity=F'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Too many portfolios: 6 exceeds maximum of 5');
  });

  it('returns 400 for invalid ticker characters', async () => {
    const res = await GET(makeRequest('equity=AA$PL'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid character '$'");
  });

  it('normalizes tickers to uppercase', async () => {
    const res = await GET(makeRequest('equity=aapl,msft'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.portfolios).toEqual([['AAPL', 'MSFT']]);
  });
});
