import { NextResponse } from "next/server";
import { PAIRS, CACHE_TIMES, type PairCode } from "@/lib/forex/config";
import { fetchYahooQuote } from "@/lib/forex/yahoo-client";
import type { PairPrice, PricesResponse } from "@/lib/forex/types";

export const revalidate = 300;

export async function GET() {
  const pricePromises = Object.values(PAIRS).map(
    async (pair): Promise<PairPrice> => {
      const quote = await fetchYahooQuote(pair.yahooSymbol, CACHE_TIMES.prices);
      return {
        pair: pair.code as PairCode,
        price: quote.price,
        change: quote.change,
        changePct: quote.changePct,
        high24h: quote.high24h,
        low24h: quote.low24h,
      };
    }
  );

  const prices = await Promise.all(pricePromises);

  const response: PricesResponse = {
    prices,
    fetchedAt: new Date().toISOString(),
  };

  return NextResponse.json(response);
}
