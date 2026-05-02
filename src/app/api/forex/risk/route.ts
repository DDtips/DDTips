import { NextResponse } from "next/server";
import { RISK_INSTRUMENTS, CACHE_TIMES } from "@/lib/forex/config";
import { fetchYahooQuote } from "@/lib/forex/yahoo-client";
import type { RiskResponse, RiskIndicators } from "@/lib/forex/types";

export const revalidate = 300;

export async function GET() {
  const [vixQuote, dxyQuote, spxQuote] = await Promise.all([
    fetchYahooQuote(RISK_INSTRUMENTS.VIX, CACHE_TIMES.risk),
    fetchYahooQuote(RISK_INSTRUMENTS.DXY, CACHE_TIMES.risk),
    fetchYahooQuote(RISK_INSTRUMENTS.SPX, CACHE_TIMES.risk),
  ]);

  const vixVal = vixQuote.price ?? 0;
  let sentiment: "risk-on" | "neutral" | "risk-off" = "neutral";
  if (vixVal > 0 && vixVal < 18) sentiment = "risk-on";
  else if (vixVal >= 25) sentiment = "risk-off";

  const risk: RiskIndicators = {
    vix: {
      value: vixQuote.price ?? 0,
      change: vixQuote.changePct ?? 0,
      sentiment,
    },
    dxy: {
      value: dxyQuote.price ?? 0,
      change: dxyQuote.changePct ?? 0,
    },
    spx: {
      value: spxQuote.price ?? 0,
      change: spxQuote.changePct ?? 0,
    },
  };

  const response: RiskResponse = {
    risk,
    fetchedAt: new Date().toISOString(),
  };

  return NextResponse.json(response);
}
