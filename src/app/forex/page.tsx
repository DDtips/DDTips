import { Suspense } from "react";
import RatesCard from "./components/RatesCard";
import IndicatorsCard from "./components/IndicatorsCard";
import RiskCard from "./components/RiskCard";
import DxyCard from "./components/DxyCard";
import TradeBiasCard from "./components/TradeBiasCard";
import CalendarCard, { type EconomicEvent } from "./components/CalendarCard";
import FundamentalSimulator from "./components/FundamentalSimulator";

// PREMIUM KARTICE
import ForwardGuidanceCard from "./components/ForwardGuidanceCard";
import MacroBarometerCard from "./components/MacroBarometerCard";
import RetailSentimentCard from "./components/RetailSentimentCard";
import CarryTradeCard from "./components/CarryTradeCard";
import CotReportCard from "./components/CotReportCard";
import CurrencyStrengthCard from "./components/CurrencyStrengthCard";

import {
  CURRENCIES,
  POLICY_RATE_SERIES,
  FALLBACK_RATES,
  ECONOMIC_INDICATORS,
  RISK_INSTRUMENTS,
  CACHE_TIMES,
  type CurrencyCode,
} from "@/lib/forex/config";
import { fetchFredSeries, parseValue, calcYoYChange } from "@/lib/forex/fred-client";
import { fetchYahooQuote } from "@/lib/forex/yahoo-client";
import type { CentralBankRate, EconomicIndicator, RiskIndicators } from "@/lib/forex/types";

export const revalidate = 3600;

// -- DATA FETCHERS --
async function getRates() {
  try {
    const ratesPromises = (Object.keys(CURRENCIES) as CurrencyCode[]).map(
      async (currency): Promise<CentralBankRate> => {
        const seriesId = POLICY_RATE_SERIES[currency];
        const info = CURRENCIES[currency];
        const observations = await fetchFredSeries(seriesId, 1, CACHE_TIMES.rates);
        if (observations && observations.length > 0) {
          const value = parseValue(observations[0].value);
          if (value !== null) return { currency, flag: info.flag, bank: info.bank, rate: value, lastUpdate: observations[0].date, source: "fred" };
        }
        return { currency, flag: info.flag, bank: info.bank, rate: FALLBACK_RATES[currency], lastUpdate: "fallback", source: "fallback" };
      }
    );
    const rates = await Promise.all(ratesPromises);
    const ratesMap = Object.fromEntries(rates.map((r) => [r.currency, r.rate])) as Record<CurrencyCode, number>;
    return { rates, differentials: {} }; // Differentials niso več nujni z novo postavitvijo
  } catch (error) {
    return { rates: [], differentials: {} };
  }
}

async function getIndicators() {
  try {
    const allPromises: Promise<{ currency: CurrencyCode; indicator: EconomicIndicator }>[] = [];
    for (const currency of Object.keys(ECONOMIC_INDICATORS) as CurrencyCode[]) {
      const indicators = ECONOMIC_INDICATORS[currency];
      for (const [name, seriesId] of Object.entries(indicators)) {
        const promise = fetchFredSeries(seriesId, 13, CACHE_TIMES.indicators)
          .then((observations): { currency: CurrencyCode; indicator: EconomicIndicator } => {
            if (!observations || observations.length === 0) return { currency, indicator: { name, value: null, unit: "", date: "", yoyChange: null } };
            const value = parseValue(observations[0].value);
            const yoy = name.toLowerCase().includes("cpi") || name.toLowerCase().includes("inflation") ? calcYoYChange(observations) : null;
            return { currency, indicator: { name, value, unit: name.includes("Rate") || name.includes("CPI") ? "%" : "", date: observations[0].date, yoyChange: yoy } };
          }).catch(() => ({ currency, indicator: { name, value: null, unit: "", date: "", yoyChange: null } }));
        allPromises.push(promise);
      }
    }
    const resolvedIndicators = await Promise.all(allPromises);
    const result: Record<CurrencyCode, EconomicIndicator[]> = {} as Record<CurrencyCode, EconomicIndicator[]>;
    resolvedIndicators.forEach(({ currency, indicator }) => {
      if (!result[currency]) result[currency] = [];
      result[currency].push(indicator);
    });
    return result;
  } catch (error) {
    return {} as Record<CurrencyCode, EconomicIndicator[]>;
  }
}

async function getRisk(): Promise<RiskIndicators> {
  try {
    const [vixQuote, dxyQuote, spxQuote] = await Promise.all([
      fetchYahooQuote(RISK_INSTRUMENTS.VIX, CACHE_TIMES.risk),
      fetchYahooQuote(RISK_INSTRUMENTS.DXY, CACHE_TIMES.risk),
      fetchYahooQuote(RISK_INSTRUMENTS.SPX, CACHE_TIMES.risk),
    ]);
    const vixVal = vixQuote.price ?? 0;
    let sentiment: "risk-on" | "neutral" | "risk-off" = "neutral";
    if (vixVal > 0 && vixVal < 18) sentiment = "risk-on";
    else if (vixVal >= 25) sentiment = "risk-off";
    return {
      vix: { value: vixVal, change: vixQuote.changePct ?? 0, sentiment },
      dxy: { value: dxyQuote.price ?? 0, change: dxyQuote.changePct ?? 0 },
      spx: { value: spxQuote.price ?? 0, change: spxQuote.changePct ?? 0 },
    };
  } catch (error) {
    return { vix: { value: 0, change: 0, sentiment: "neutral" }, dxy: { value: 0, change: 0 }, spx: { value: 0, change: 0 } };
  }
}

async function getCalendarEvents(): Promise<EconomicEvent[]> {
  try {
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    if (apiKey) {
      const url = `https://www.alphavantage.co/query?function=EARNINGS_CALENDAR&horizon=3month&apikey=${apiKey}`;
      const res = await fetch(url, { next: { revalidate: 3600 } });
      if (res.ok) console.log("Alpha Vantage klic uspešen.");
    }
    // Tukaj ostanejo simulirani podatki, dokler ne sprogramiraš CSV parserja za Alpha Vantage
    return [
      { title: "Non-Farm Employment Change (NFP)", country: "USD", date: "2026-05-08", time: "14:30", impact: "High", estimate: "180K", previous: "210K" },
      { title: "Unemployment Rate", country: "USD", date: "2026-05-08", time: "14:30", impact: "High", estimate: "3.8%", previous: "3.8%" },
      { title: "CPI y/y", country: "USD", date: "2026-05-13", time: "14:30", impact: "High", estimate: "3.2%", previous: "3.4%" },
      { title: "ECB Interest Rate Decision", country: "EUR", date: "2026-05-14", time: "14:15", impact: "High", estimate: "3.75%", previous: "4.00%" },
      { title: "BOE Interest Rate Decision", country: "GBP", date: "2026-05-14", time: "13:00", impact: "High", estimate: "5.25%", previous: "5.25%" }
    ];
  } catch (error) {
    return [];
  }
}

// -- SECTIONS (ASYNC WRAPPERS) --
async function CalendarSection() { 
  const events = await getCalendarEvents(); 
  return <CalendarCard events={events} />; 
}
async function TradeBiasSection() { 
  const [indicators, ratesData, riskData] = await Promise.all([getIndicators(), getRates(), getRisk()]); 
  return <TradeBiasCard indicatorsData={indicators} ratesData={ratesData} riskData={riskData} />; 
}
async function DxySection() { 
  const risk = await getRisk(); 
  return <DxyCard dxyData={risk.dxy} />; 
}
async function RiskSection() { 
  const risk = await getRisk(); 
  return <RiskCard risk={risk} />; 
}
async function RatesSection() { 
  const { rates, differentials } = await getRates(); 
  return <RatesCard rates={rates} differentials={differentials} />; 
}
async function IndicatorsSection() { 
  const indicators = await getIndicators(); 
  return <IndicatorsCard indicators={indicators} />; 
}
async function CarryTradeSection() { 
  const [ratesData, riskData] = await Promise.all([getRates(), getRisk()]); 
  return <CarryTradeCard ratesData={ratesData} riskData={riskData} />; 
}

// Nalagalni Skeleton
function LoadingSkeleton() {
  return <div className="p-6 rounded-2xl bg-[#121316] border border-white/5 animate-pulse min-h-[250px] w-full"></div>;
}

export default function ForexPage() {
  return (
    <div className="min-h-screen bg-[#09090b] pt-[160px] pb-24 px-4 md:px-6 font-sans text-zinc-300">
      <div className="max-w-[1600px] mx-auto flex flex-col gap-6">
        
        {/* ROW 1: Bias (zavzame 2/3) + Koledar (zavzame 1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          <div className="lg:col-span-2 flex flex-col h-full">
            <Suspense fallback={<LoadingSkeleton />}>
              <TradeBiasSection />
            </Suspense>
          </div>
          <div className="flex flex-col h-full">
            <Suspense fallback={<LoadingSkeleton />}>
              <CalendarSection />
            </Suspense>
          </div>
        </div>

        {/* ROW 2: Simulator (zavzame 2/3) + DXY (zavzame 1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          <div className="lg:col-span-2 flex flex-col h-full">
            <FundamentalSimulator />
          </div>
          <div className="flex flex-col h-full">
            <Suspense fallback={<LoadingSkeleton />}>
              <DxySection />
            </Suspense>
          </div>
        </div>

        {/* ROW 3: Nove Premium Analitike (Forward Guidance, Makro Barometer, Retail Sentiment) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          <div className="flex flex-col h-full"><ForwardGuidanceCard /></div>
          <div className="flex flex-col h-full"><MacroBarometerCard /></div>
          <div className="flex flex-col h-full"><RetailSentimentCard /></div>
        </div>

        {/* ROW 4: X-RAY Analitika (Carry Trade, COT Report, Moč Valut) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          <div className="flex flex-col h-full">
            <Suspense fallback={<LoadingSkeleton />}>
              <CarryTradeSection />
            </Suspense>
          </div>
          <div className="flex flex-col h-full"><CotReportCard /></div>
          <div className="flex flex-col h-full"><CurrencyStrengthCard /></div>
        </div>

        {/* ROW 5: Osnovni podatki (Obrestne mere, Indikatorji, Risk Sentiment) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          <div className="flex flex-col h-full"><Suspense fallback={<LoadingSkeleton />}><RatesSection /></Suspense></div>
          <div className="flex flex-col h-full"><Suspense fallback={<LoadingSkeleton />}><IndicatorsSection /></Suspense></div>
          <div className="flex flex-col h-full"><Suspense fallback={<LoadingSkeleton />}><RiskSection /></Suspense></div>
        </div>

      </div>
    </div>
  );
}