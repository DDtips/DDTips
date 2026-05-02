/**
 * Yahoo Finance klient
 */

const YAHOO_BASE_URL = "https://query1.finance.yahoo.com/v8/finance/chart";

export interface YahooQuote {
  symbol: string;
  price: number | null;
  previousClose: number | null;
  change: number | null;
  changePct: number | null;
  high24h: number | null;
  low24h: number | null;
}

export async function fetchYahooQuote(
  symbol: string,
  revalidate: number = 300
): Promise<YahooQuote> {
  const url = `${YAHOO_BASE_URL}/${encodeURIComponent(symbol)}?interval=1d&range=2d`;

  const empty: YahooQuote = {
    symbol,
    price: null,
    previousClose: null,
    change: null,
    changePct: null,
    high24h: null,
    low24h: null,
  };

  try {
    const res = await fetch(url, {
      next: { revalidate },
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ForexDashboard/1.0)",
      },
    });

    if (!res.ok) {
      console.error(`[Yahoo] HTTP ${res.status} za ${symbol}`);
      return empty;
    }

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    
    if (!result) return empty;
    
    const meta = result.meta || {};
    const price = meta.regularMarketPrice ?? null;
    const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? null;
    
    const change = price !== null && previousClose !== null 
      ? price - previousClose 
      : null;
    const changePct = change !== null && previousClose !== null && previousClose !== 0
      ? (change / previousClose) * 100
      : null;

    return {
      symbol,
      price,
      previousClose,
      change,
      changePct,
      high24h: meta.regularMarketDayHigh ?? null,
      low24h: meta.regularMarketDayLow ?? null,
    };
  } catch (err) {
    console.error(`[Yahoo] Napaka za ${symbol}:`, err);
    return empty;
  }
}
