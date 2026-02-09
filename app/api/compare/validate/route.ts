import { NextRequest, NextResponse } from 'next/server';

import { parsePortfolios } from '@common/parser';

/**
 * GET /api/compare/validate?equity=AAPL,MSFT&equity=GOOG,TSLA
 *
 * Validates the user-facing `equity=` query params using the strict v1 parser.
 * Returns 400 with an actionable error message on invalid input.
 * Returns 200 with parsed portfolios on success.
 *
 * This endpoint enables server-side validation of the compare URL before
 * fetching market data, and supports SSR error rendering.
 */
export async function GET(request: NextRequest) {
  const result = parsePortfolios(request.nextUrl.searchParams);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  if (result.portfolios.length === 0) {
    return NextResponse.json({ error: 'equity param is required' }, { status: 400 });
  }

  return NextResponse.json({ portfolios: result.portfolios });
}
