import { NextResponse } from "next/server";
import {
  ECONOMIC_INDICATORS,
  CACHE_TIMES,
  type CurrencyCode,
} from "@/lib/forex/config";
import {
  fetchFredSeries,
  parseValue,
  calcYoYChange,
} from "@/lib/forex/fred-client";
import type { EconomicIndicator, IndicatorsResponse } from "@/lib/forex/types";

export const revalidate = 3600;

export async function GET() {
  const result: Record<CurrencyCode, EconomicIndicator[]> = {} as Record<
    CurrencyCode,
    EconomicIndicator[]
  >;

  for (const currency of Object.keys(ECONOMIC_INDICATORS) as CurrencyCode[]) {
    const indicators = ECONOMIC_INDICATORS[currency];
    const indicatorPromises = Object.entries(indicators).map(
      async ([name, seriesId]): Promise<EconomicIndicator> => {
        const observations = await fetchFredSeries(
          seriesId,
          13,
          CACHE_TIMES.indicators
        );
        if (observations.length === 0) {
          return { name, value: null, unit: "", date: "", yoyChange: null };
        }
        const value = parseValue(observations[0].value);
        const yoy =
          name.toLowerCase().includes("cpi") ||
          name.toLowerCase().includes("inflation")
            ? calcYoYChange(observations)
            : null;

        return {
          name,
          value,
          unit: name.includes("Rate") || name.includes("CPI") ? "%" : "",
          date: observations[0].date,
          yoyChange: yoy,
        };
      }
    );
    result[currency] = await Promise.all(indicatorPromises);
  }

  const response: IndicatorsResponse = {
    indicators: result,
    fetchedAt: new Date().toISOString(),
  };

  return NextResponse.json(response);
}
