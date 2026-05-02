/**
 * TypeScript tipi za Forex modul
 */

import { CurrencyCode, PairCode } from "./config";

export interface CentralBankRate {
  currency: CurrencyCode;
  flag: string;
  bank: string;
  rate: number;
  lastUpdate: string;
  source: "fred" | "fallback";
}

export interface RatesResponse {
  rates: CentralBankRate[];
  differentials: Record<PairCode, number>;
  fetchedAt: string;
}

export interface EconomicIndicator {
  name: string;
  value: number | null;
  unit: string;
  date: string;
  yoyChange: number | null;
}

export interface IndicatorsResponse {
  indicators: Record<CurrencyCode, EconomicIndicator[]>;
  fetchedAt: string;
}

export interface PairPrice {
  pair: PairCode;
  price: number | null;
  change: number | null;
  changePct: number | null;
  high24h: number | null;
  low24h: number | null;
}

export interface PricesResponse {
  prices: PairPrice[];
  fetchedAt: string;
}

export interface RiskIndicators {
  vix: { value: number; change: number; sentiment: "risk-on" | "neutral" | "risk-off" };
  dxy: { value: number; change: number };
  spx: { value: number; change: number };
}

export interface RiskResponse {
  risk: RiskIndicators;
  fetchedAt: string;
}
