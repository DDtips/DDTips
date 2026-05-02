import { NextResponse } from "next/server";
import {
  CURRENCIES,
  PAIRS,
  POLICY_RATE_SERIES,
  FALLBACK_RATES,
  CACHE_TIMES,
  type CurrencyCode,
  type PairCode,
} from "@/lib/forex/config";
import { fetchFredSeries, parseValue } from "@/lib/forex/fred-client";
import type { CentralBankRate, RatesResponse } from "@/lib/forex/types";

export const revalidate = 3600;

export async function GET() {
  const ratesPromises = (Object.keys(CURRENCIES) as CurrencyCode[]).map(
    async (currency): Promise<CentralBankRate> => {
      const seriesId = POLICY_RATE_SERIES[currency];
      const info = CURRENCIES[currency];

      const observations = await fetchFredSeries(seriesId, 1, CACHE_TIMES.rates);
      
      if (observations.length > 0) {
        const value = parseValue(observations[0].value);
        if (value !== null) {
          return {
            currency,
            flag: info.flag,
            bank: info.bank,
            rate: value,
            lastUpdate: observations[0].date,
            source: "fred",
          };
        }
      }

      return {
        currency,
        flag: info.flag,
        bank: info.bank,
        rate: FALLBACK_RATES[currency],
        lastUpdate: "fallback",
        source: "fallback",
      };
    }
  );

  const rates = await Promise.all(ratesPromises);

  const ratesMap = Object.fromEntries(
    rates.map((r) => [r.currency, r.rate])
  ) as Record<CurrencyCode, number>;

  const differentials: Record<PairCode, number> = {} as Record<PairCode, number>;
  for (const pair of Object.values(PAIRS)) {
    differentials[pair.code] = ratesMap[pair.base] - ratesMap[pair.quote];
  }

  const response: RatesResponse = {
    rates,
    differentials,
    fetchedAt: new Date().toISOString(),
  };

  return NextResponse.json(response);
}
