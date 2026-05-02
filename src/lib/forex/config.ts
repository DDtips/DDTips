/**
 * Forex modul — konfiguracija
 * Definira valutne pare, valute in FRED API serijske ID-je
 */

export type CurrencyCode = "USD" | "EUR" | "GBP" | "JPY";
export type PairCode = "EUR/USD" | "GBP/USD" | "USD/JPY";

export interface CurrencyInfo {
  code: CurrencyCode;
  flag: string;
  bank: string;
  name: string;
}

export interface PairInfo {
  code: PairCode;
  base: CurrencyCode;
  quote: CurrencyCode;
  yahooSymbol: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  USD: { code: "USD", flag: "🇺🇸", bank: "Fed", name: "US Dollar" },
  EUR: { code: "EUR", flag: "🇪🇺", bank: "ECB", name: "Euro" },
  GBP: { code: "GBP", flag: "🇬🇧", bank: "BoE", name: "British Pound" },
  JPY: { code: "JPY", flag: "🇯🇵", bank: "BoJ", name: "Japanese Yen" },
};

export const PAIRS: Record<PairCode, PairInfo> = {
  "EUR/USD": { code: "EUR/USD", base: "EUR", quote: "USD", yahooSymbol: "EURUSD=X" },
  "GBP/USD": { code: "GBP/USD", base: "GBP", quote: "USD", yahooSymbol: "GBPUSD=X" },
  "USD/JPY": { code: "USD/JPY", base: "USD", quote: "JPY", yahooSymbol: "USDJPY=X" },
};

/**
 * FRED API serijski ID-ji za policy rate centralnih bank
 */
export const POLICY_RATE_SERIES: Record<CurrencyCode, string> = {
  USD: "DFEDTARU",       // Fed funds target upper bound
  EUR: "ECBDFR",         // ECB Deposit Facility Rate
  GBP: "BOERUKM",        // Bank of England Bank Rate
  JPY: "INTDSRJPM193N",  // Japan discount rate proxy
};

/**
 * Fallback vrednosti za primere, ko FRED API ne odgovori
 */
export const FALLBACK_RATES: Record<CurrencyCode, number> = {
  USD: 4.50,
  EUR: 2.25,
  GBP: 4.50,
  JPY: 0.50,
};

/**
 * Ekonomski kazalniki — FRED ID-ji
 */
export const ECONOMIC_INDICATORS: Record<CurrencyCode, Record<string, string>> = {
  USD: {
    "CPI (Inflacija)": "CPIAUCSL",
    "Core CPI": "CPILFESL",
    "Unemployment Rate": "UNRATE",
    "Non-Farm Payrolls": "PAYEMS",
    "GDP": "GDP",
  },
  EUR: {
    "CPI Eurozone": "CP0000EZ19M086NEST",
    "Unemployment Rate": "LRHUTTTTEZM156S",
  },
  GBP: {
    "CPI UK": "GBRCPIALLMINMEI",
    "Unemployment Rate": "LRHUTTTTGBM156S",
  },
  JPY: {
    "CPI Japan": "JPNCPIALLMINMEI",
    "Unemployment Rate": "LRUNTTTTJPM156S",
  },
};

/**
 * Risk sentiment instrumenti (Yahoo Finance simboli)
 */
export const RISK_INSTRUMENTS = {
  VIX: "^VIX",
  DXY: "DX-Y.NYB",
  SPX: "^GSPC",
};

/**
 * Cache čas v sekundah
 */
export const CACHE_TIMES = {
  rates: 3600,
  indicators: 3600,
  prices: 300,
  risk: 300,
};
