"use client";

import { useEffect, useMemo, useState } from "react";

type Row = {
  match_id: number;
  lambda_home: number;
  lambda_away: number;
  p_over_25: number;
  p_under_25: number;
  over_odds: number | null;
  under_odds: number | null;
  edge_over?: number | null;
  edge_under?: number | null;
  value_side?: "OVER" | "UNDER" | null;
  report: string | null;
  matches: {
    match_date: string;
    home_team: string;
    away_team: string;
    status: string;
    league?: string;
  };
};

type ApiResponse = {
  from: string;
  to: string;
  meta?: {
    totalInRange: number;
    withOdds: number;
    onlyOdds: boolean;
    onlyValue: boolean;
    valueThresholdPct: number;
  };
  rows: Row[];
};

/* ─────────────────────────────────────────────────────────────────────────────
   UTILS
───────────────────────────────────────────────────────────────────────────── */

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function fmt(n: number | null | undefined, digits = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return Number(n).toFixed(digits);
}

function impliedProb(odds: number | null) {
  if (!odds || odds <= 1) return null;
  return 1 / odds;
}

function aiOddsFromProb(p: number | null) {
  if (!p || p <= 0) return null;
  return 1 / p;
}

function valuePct(modelProb: number | null, bookOdds: number | null) {
  const ip = impliedProb(bookOdds);
  if (!modelProb || !ip || ip <= 0) return null;
  return ((modelProb / ip) - 1) * 100;
}

function bestSide(r: Row, thresholdPct = 10) {
  const overVal = valuePct(r.p_over_25, r.over_odds);
  const underVal = valuePct(r.p_under_25, r.under_odds);

  const best =
    (overVal ?? -999) >= (underVal ?? -999)
      ? { side: "OVER" as const, val: overVal }
      : { side: "UNDER" as const, val: underVal };

  const isValue = (best.val ?? -999) >= thresholdPct;
  return { ...best, isValue, overVal, underVal };
}

// Slovenski dnevi in meseci
const DAYS_SL = ["Nedelja", "Ponedeljek", "Torek", "Sreda", "Četrtek", "Petek", "Sobota"];

function formatDateSlovene(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (date.toDateString() === today.toDateString()) {
    return "Danes";
  }
  
  if (date.toDateString() === tomorrow.toDateString()) {
    return "Jutri";
  }
  
  const dayName = DAYS_SL[date.getDay()];
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  
  return `${dayName}, ${day}.${month}.${year}`;
}

const LEAGUE_TEAMS: Record<string, string[]> = {
  "Premier League": [
    "Arsenal", "Aston Villa", "Bournemouth", "Brentford", "Brighton",
    "Chelsea", "Crystal Palace", "Everton", "Fulham", "Ipswich",
    "Leicester", "Liverpool", "Manchester City", "Manchester United",
    "Newcastle", "Nottingham Forest", "Southampton", "Tottenham",
    "West Ham", "Wolves", "Man City", "Man United", "Man Utd",
    "Sunderland", "Burnley", "Leeds", "Sheffield", "Norwich", "Watford"
  ],
  "La Liga": [
    "Real Madrid", "Barcelona", "Atletico Madrid", "Athletic Bilbao",
    "Real Sociedad", "Villarreal", "Real Betis", "Sevilla", "Valencia",
    "Osasuna", "Celta Vigo", "Mallorca", "Girona", "Rayo Vallecano",
    "Getafe", "Alaves", "Las Palmas", "Leganes", "Espanyol", "Valladolid"
  ],
  "Champions League": [
    "Bayern Munich", "Borussia Dortmund", "PSG", "Paris Saint-Germain",
    "Inter Milan", "AC Milan", "Juventus", "Napoli", "Benfica", "Porto",
    "Ajax", "Feyenoord", "PSV", "Club Brugge", "Celtic", "Rangers",
    "RB Leipzig", "Bayer Leverkusen", "Sporting CP", "Shakhtar"
  ],
  "Serie A": [
    "Inter Milan", "AC Milan", "Juventus", "Napoli", "Roma", "Lazio",
    "Atalanta", "Fiorentina", "Bologna", "Torino", "Monza", "Udinese",
    "Sassuolo", "Empoli", "Salernitana", "Lecce", "Cagliari", "Verona",
    "Frosinone", "Genoa"
  ],
  "Bundesliga": [
    "Bayern Munich", "Borussia Dortmund", "RB Leipzig", "Bayer Leverkusen",
    "Eintracht Frankfurt", "Wolfsburg", "Freiburg", "Union Berlin",
    "Hoffenheim", "Mainz", "Augsburg", "Werder Bremen", "Bochum",
    "Koln", "Stuttgart", "Darmstadt", "Heidenheim", "Monchengladbach"
  ],
};

function detectLeague(homeTeam: string, awayTeam: string, providedLeague?: string): string {
  if (providedLeague) return providedLeague;
  
  for (const [league, teams] of Object.entries(LEAGUE_TEAMS)) {
    const homeMatch = teams.some(t => homeTeam.toLowerCase().includes(t.toLowerCase()));
    const awayMatch = teams.some(t => awayTeam.toLowerCase().includes(t.toLowerCase()));
    if (homeMatch || awayMatch) return league;
  }
  return "Other";
}

const LEAGUE_ORDER = ["Champions League", "Premier League", "La Liga", "Serie A", "Bundesliga", "Other"];

const LEAGUE_ICONS: Record<string, string> = {
  "Champions League": "⭐",
  "Premier League": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "La Liga": "🇪🇸",
  "Serie A": "🇮🇹",
  "Bundesliga": "🇩🇪",
  "Other": "⚽",
};

/* ─────────────────────────────────────────────────────────────────────────────
   AI ODDS CALCULATOR - Custom variables
───────────────────────────────────────────────────────────────────────────── */

function AIoddsCalculator() {
  // Poisson model inputs
  const [lambdaHome, setLambdaHome] = useState<string>("1.5");
  const [lambdaAway, setLambdaAway] = useState<string>("1.2");
  
  // Adjustments
  const [homeAdvantage, setHomeAdvantage] = useState<string>("1.1"); // multiplier
  const [formFactor, setFormFactor] = useState<string>("1.0"); // recent form adjustment
  const [injuryImpact, setInjuryImpact] = useState<string>("0"); // % reduction
  const [margin, setMargin] = useState<string>("5"); // bookmaker margin %

  const lH = parseFloat(lambdaHome) || 0;
  const lA = parseFloat(lambdaAway) || 0;
  const hAdv = parseFloat(homeAdvantage) || 1;
  const form = parseFloat(formFactor) || 1;
  const injury = (parseFloat(injuryImpact) || 0) / 100;
  const marg = (parseFloat(margin) || 0) / 100;

  // Adjusted lambdas
  const adjLambdaHome = lH * hAdv * form * (1 - injury);
  const adjLambdaAway = lA * form * (1 - injury);

  // Poisson probability calculation for over/under 2.5
  const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1));
  const poisson = (lambda: number, k: number): number => 
    (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);

  let pUnder25 = 0;
  for (let i = 0; i <= 2; i++) {
    for (let j = 0; j <= 2 - i; j++) {
      pUnder25 += poisson(adjLambdaHome, i) * poisson(adjLambdaAway, j);
    }
  }
  const pOver25 = 1 - pUnder25;

  // Fair odds (without margin)
  const fairOverOdds = pOver25 > 0 ? 1 / pOver25 : 0;
  const fairUnderOdds = pUnder25 > 0 ? 1 / pUnder25 : 0;

  // Odds with margin (what bookmaker would offer)
  const bookOverOdds = fairOverOdds > 0 ? fairOverOdds / (1 + marg) : 0;
  const bookUnderOdds = fairUnderOdds > 0 ? fairUnderOdds / (1 + marg) : 0;

  const expectedGoals = adjLambdaHome + adjLambdaAway;

  return (
    <div className="space-y-4">
      {/* Lambda inputs */}
      <div>
        <label className="text-xs text-zinc-500 block mb-2">Pričakovani goli (λ)</label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-zinc-600 block mb-1">Domači</label>
            <input
              type="number"
              step="0.1"
              value={lambdaHome}
              onChange={(e) => setLambdaHome(e.target.value)}
              className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <div>
            <label className="text-[10px] text-zinc-600 block mb-1">Gosti</label>
            <input
              type="number"
              step="0.1"
              value={lambdaAway}
              onChange={(e) => setLambdaAway(e.target.value)}
              className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>
      </div>

      {/* Adjustments */}
      <div className="pt-3 border-t border-zinc-800">
        <label className="text-xs text-zinc-500 block mb-2">Prilagoditve</label>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-zinc-400">Prednost domačih (×)</label>
            <input
              type="number"
              step="0.05"
              value={homeAdvantage}
              onChange={(e) => setHomeAdvantage(e.target.value)}
              className="w-20 bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-2 py-1 text-sm text-white text-right focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <label className="text-xs text-zinc-400">Faktor forme (×)</label>
            <input
              type="number"
              step="0.05"
              value={formFactor}
              onChange={(e) => setFormFactor(e.target.value)}
              className="w-20 bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-2 py-1 text-sm text-white text-right focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <label className="text-xs text-zinc-400">Poškodbe (%)</label>
            <input
              type="number"
              step="1"
              value={injuryImpact}
              onChange={(e) => setInjuryImpact(e.target.value)}
              className="w-20 bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-2 py-1 text-sm text-white text-right focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <label className="text-xs text-zinc-400">Marža stavnice (%)</label>
            <input
              type="number"
              step="0.5"
              value={margin}
              onChange={(e) => setMargin(e.target.value)}
              className="w-20 bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-2 py-1 text-sm text-white text-right focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="pt-3 border-t border-zinc-800">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="p-2 rounded-lg bg-zinc-800/30 text-center">
            <div className="text-[10px] text-zinc-500 uppercase">xG Total</div>
            <div className="text-lg font-mono text-white">{fmt(expectedGoals, 2)}</div>
          </div>
          <div className="p-2 rounded-lg bg-zinc-800/30 text-center">
            <div className="text-[10px] text-zinc-500 uppercase">Adj. λ</div>
            <div className="text-sm font-mono text-zinc-400">
              {fmt(adjLambdaHome, 2)} / {fmt(adjLambdaAway, 2)}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center p-2 rounded-lg bg-emerald-500/10">
            <div>
              <div className="text-xs text-emerald-400 font-medium">OVER 2.5</div>
              <div className="text-[10px] text-zinc-500">P: {fmt(pOver25 * 100, 1)}%</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-mono text-white">{fmt(fairOverOdds)}</div>
              <div className="text-[10px] text-zinc-500">Book: {fmt(bookOverOdds)}</div>
            </div>
          </div>
          
          <div className="flex justify-between items-center p-2 rounded-lg bg-blue-500/10">
            <div>
              <div className="text-xs text-blue-400 font-medium">UNDER 2.5</div>
              <div className="text-[10px] text-zinc-500">P: {fmt(pUnder25 * 100, 1)}%</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-mono text-white">{fmt(fairUnderOdds)}</div>
              <div className="text-[10px] text-zinc-500">Book: {fmt(bookUnderOdds)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   CALCULATORS (Left Side)
───────────────────────────────────────────────────────────────────────────── */

function LayCalculator() {
  const [backOdds, setBackOdds] = useState<string>("2.00");
  const [stake, setStake] = useState<string>("100");
  const [commission, setCommission] = useState<string>("5");

  const layOdds = parseFloat(backOdds) || 0;
  const backStake = parseFloat(stake) || 0;
  const comm = parseFloat(commission) || 0;

  const layStake = layOdds > 1 ? (backStake * layOdds) / (layOdds - comm / 100) : 0;
  const liability = layStake * (layOdds - 1);

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-zinc-500 block mb-1">Back kvota</label>
        <input
          type="number"
          step="0.01"
          value={backOdds}
          onChange={(e) => setBackOdds(e.target.value)}
          className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
        />
      </div>
      <div>
        <label className="text-xs text-zinc-500 block mb-1">Vložek (€)</label>
        <input
          type="number"
          value={stake}
          onChange={(e) => setStake(e.target.value)}
          className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
        />
      </div>
      <div>
        <label className="text-xs text-zinc-500 block mb-1">Provizija (%)</label>
        <input
          type="number"
          step="0.1"
          value={commission}
          onChange={(e) => setCommission(e.target.value)}
          className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
        />
      </div>
      <div className="pt-3 border-t border-zinc-800 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">Lay stake:</span>
          <span className="text-white font-mono">{fmt(layStake)}€</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">Liability:</span>
          <span className="text-amber-400 font-mono">{fmt(liability)}€</span>
        </div>
      </div>
    </div>
  );
}

function KellyCalculator() {
  const [probability, setProbability] = useState<string>("55");
  const [odds, setOdds] = useState<string>("2.00");
  const [bankroll, setBankroll] = useState<string>("1000");
  const [fraction, setFraction] = useState<string>("25");

  const prob = (parseFloat(probability) || 0) / 100;
  const dec = parseFloat(odds) || 0;
  const bank = parseFloat(bankroll) || 0;
  const frac = (parseFloat(fraction) || 0) / 100;

  const b = dec - 1;
  const q = 1 - prob;
  const fullKelly = b > 0 ? (prob * b - q) / b : 0;
  const kellyPct = Math.max(0, fullKelly) * 100;
  const fractionalKelly = kellyPct * frac;
  const betAmount = (fractionalKelly / 100) * bank;

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-zinc-500 block mb-1">Verjetnost zmage (%)</label>
        <input
          type="number"
          value={probability}
          onChange={(e) => setProbability(e.target.value)}
          className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
        />
      </div>
      <div>
        <label className="text-xs text-zinc-500 block mb-1">Kvota</label>
        <input
          type="number"
          step="0.01"
          value={odds}
          onChange={(e) => setOdds(e.target.value)}
          className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
        />
      </div>
      <div>
        <label className="text-xs text-zinc-500 block mb-1">Bankroll (€)</label>
        <input
          type="number"
          value={bankroll}
          onChange={(e) => setBankroll(e.target.value)}
          className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
        />
      </div>
      <div>
        <label className="text-xs text-zinc-500 block mb-1">Kelly delež (%)</label>
        <input
          type="number"
          value={fraction}
          onChange={(e) => setFraction(e.target.value)}
          className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
        />
      </div>
      <div className="pt-3 border-t border-zinc-800 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">Full Kelly:</span>
          <span className="text-white font-mono">{fmt(kellyPct, 1)}%</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">Priporočen vložek:</span>
          <span className="text-emerald-400 font-mono">{fmt(betAmount)}€</span>
        </div>
      </div>
    </div>
  );
}

function OddsConverter() {
  const [decimal, setDecimal] = useState<string>("2.50");

  const dec = parseFloat(decimal) || 0;
  const fractionalNum = dec > 1 ? dec - 1 : 0;
  const american = dec >= 2 ? `+${((dec - 1) * 100).toFixed(0)}` : dec > 1 ? `-${(100 / (dec - 1)).toFixed(0)}` : "—";
  const impliedProbability = dec > 0 ? (1 / dec) * 100 : 0;

  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const num = Math.round(fractionalNum * 100);
  const denom = 100;
  const divisor = gcd(num, denom);
  const fractional = `${num / divisor}/${denom / divisor}`;

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-zinc-500 block mb-1">Decimalna kvota</label>
        <input
          type="number"
          step="0.01"
          value={decimal}
          onChange={(e) => setDecimal(e.target.value)}
          className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
        />
      </div>
      <div className="pt-3 border-t border-zinc-800 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">Fractional:</span>
          <span className="text-white font-mono">{fractional}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">American:</span>
          <span className="text-white font-mono">{american}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">Implied prob:</span>
          <span className="text-amber-400 font-mono">{fmt(impliedProbability, 1)}%</span>
        </div>
      </div>
    </div>
  );
}

function MarginCalculator() {
  const [odds1, setOdds1] = useState<string>("1.90");
  const [odds2, setOdds2] = useState<string>("2.00");
  const [oddsX, setOddsX] = useState<string>("");

  const o1 = parseFloat(odds1) || 0;
  const o2 = parseFloat(odds2) || 0;
  const oX = parseFloat(oddsX) || 0;

  const hasThreeWay = oX > 0;
  const margin = hasThreeWay
    ? (1 / o1 + 1 / oX + 1 / o2 - 1) * 100
    : o1 > 0 && o2 > 0
    ? (1 / o1 + 1 / o2 - 1) * 100
    : 0;

  const fairOdds1 = o1 > 0 ? o1 * (1 + margin / 100) : 0;
  const fairOdds2 = o2 > 0 ? o2 * (1 + margin / 100) : 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Kvota 1</label>
          <input
            type="number"
            step="0.01"
            value={odds1}
            onChange={(e) => setOdds1(e.target.value)}
            className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Kvota 2</label>
          <input
            type="number"
            step="0.01"
            value={odds2}
            onChange={(e) => setOdds2(e.target.value)}
            className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-zinc-500 block mb-1">Kvota X (opcijsko)</label>
        <input
          type="number"
          step="0.01"
          value={oddsX}
          placeholder="Za 3-way"
          onChange={(e) => setOddsX(e.target.value)}
          className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
        />
      </div>
      <div className="pt-3 border-t border-zinc-800 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">Marža stavnice:</span>
          <span className={`font-mono ${margin > 5 ? "text-red-400" : "text-emerald-400"}`}>
            {fmt(margin, 2)}%
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">Fer kvota 1:</span>
          <span className="text-white font-mono">{fmt(fairOdds1)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">Fer kvota 2:</span>
          <span className="text-white font-mono">{fmt(fairOdds2)}</span>
        </div>
      </div>
    </div>
  );
}

function DutchingCalculator() {
  const [totalStake, setTotalStake] = useState<string>("100");
  const [odds1, setOdds1] = useState<string>("3.00");
  const [odds2, setOdds2] = useState<string>("4.00");
  const [odds3, setOdds3] = useState<string>("");

  const total = parseFloat(totalStake) || 0;
  const o1 = parseFloat(odds1) || 0;
  const o2 = parseFloat(odds2) || 0;
  const o3 = parseFloat(odds3) || 0;

  const odds = [o1, o2, o3].filter((o) => o > 0);
  const sumInverse = odds.reduce((acc, o) => acc + 1 / o, 0);
  const stakes = odds.map((o) => (total * (1 / o)) / sumInverse);
  const profit = odds.length > 0 ? stakes[0] * odds[0] - total : 0;
  const roi = total > 0 ? (profit / total) * 100 : 0;

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-zinc-500 block mb-1">Skupni vložek (€)</label>
        <input
          type="number"
          value={totalStake}
          onChange={(e) => setTotalStake(e.target.value)}
          className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Kvota 1</label>
          <input
            type="number"
            step="0.01"
            value={odds1}
            onChange={(e) => setOdds1(e.target.value)}
            className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Kvota 2</label>
          <input
            type="number"
            step="0.01"
            value={odds2}
            onChange={(e) => setOdds2(e.target.value)}
            className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Kvota 3</label>
          <input
            type="number"
            step="0.01"
            value={odds3}
            placeholder="—"
            onChange={(e) => setOdds3(e.target.value)}
            className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
          />
        </div>
      </div>
      <div className="pt-3 border-t border-zinc-800 space-y-2">
        {stakes.map((s, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-zinc-500">Vložek {i + 1}:</span>
            <span className="text-white font-mono">{fmt(s)}€</span>
          </div>
        ))}
        <div className="flex justify-between text-sm pt-2 border-t border-zinc-800">
          <span className="text-zinc-500">Profit:</span>
          <span className={`font-mono ${profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {fmt(profit)}€ ({fmt(roi, 1)}%)
          </span>
        </div>
      </div>
    </div>
  );
}

function SurebetCalculator() {
  const [backOdds, setBackOdds] = useState<string>("2.30");
  const [backStake, setBackStake] = useState<string>("100");
  const [layOdds, setLayOdds] = useState<string>("2.35");
  const [commission, setCommission] = useState<string>("5"); // Betfair komisija %

  const bOdds = parseFloat(backOdds) || 0;
  const bStake = parseFloat(backStake) || 0;
  const lOdds = parseFloat(layOdds) || 0;
  const comm = (parseFloat(commission) || 0) / 100;

  // Lay stake formula za enak profit ne glede na izid
  // Back wins: backStake * (backOdds - 1) - layLiability = profit
  // Lay wins: layStake * (1 - comm) - backStake = profit
  // Za enak profit: layStake = backStake * backOdds / (layOdds - comm)
  
  const layStake = lOdds > 1 
    ? (bStake * bOdds) / (lOdds - comm) 
    : 0;
  
  const layLiability = layStake * (lOdds - 1);

  // Profit izračun
  const profitIfBackWins = (bStake * (bOdds - 1)) - layLiability;
  const profitIfLayWins = (layStake * (1 - comm)) - bStake;

  // Qualifying loss (za matched betting free bet promocije)
  const qualifyingLoss = Math.min(profitIfBackWins, profitIfLayWins);
  const isProfit = qualifyingLoss >= 0;

  return (
    <div className="space-y-3">
      {/* Back stava */}
      <div>
        <label className="text-xs text-zinc-500 block mb-2">BACK stava (stavnica)</label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-zinc-600 block mb-1">Kvota</label>
            <input
              type="number"
              step="0.01"
              value={backOdds}
              onChange={(e) => setBackOdds(e.target.value)}
              className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <div>
            <label className="text-[10px] text-zinc-600 block mb-1">Vložek (€)</label>
            <input
              type="number"
              value={backStake}
              onChange={(e) => setBackStake(e.target.value)}
              className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>
      </div>

      {/* Lay stava */}
      <div>
        <label className="text-xs text-zinc-500 block mb-2">LAY stava (borza)</label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-zinc-600 block mb-1">Kvota</label>
            <input
              type="number"
              step="0.01"
              value={layOdds}
              onChange={(e) => setLayOdds(e.target.value)}
              className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <div>
            <label className="text-[10px] text-zinc-600 block mb-1">Komisija (%)</label>
            <input
              type="number"
              step="0.5"
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
              className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>
      </div>

      {/* Rezultati */}
      <div className="pt-3 border-t border-zinc-800">
        {/* Lay stake - GLAVNI REZULTAT */}
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 mb-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-emerald-400 font-medium">LAY vložek:</span>
            <span className="text-xl font-bold text-emerald-400 font-mono">{fmt(layStake)}€</span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-zinc-500">Liability:</span>
            <span className="text-sm text-amber-400 font-mono">{fmt(layLiability)}€</span>
          </div>
        </div>

        {/* Profit scenariji */}
        <div className="space-y-2">
          <div className="text-xs text-zinc-500 uppercase mb-2">Profit po scenariju</div>
          
          <div className="flex justify-between items-center p-2 rounded-lg bg-zinc-800/30">
            <span className="text-xs text-zinc-400">Če BACK zmaga:</span>
            <span className={`font-mono text-sm ${profitIfBackWins >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {profitIfBackWins >= 0 ? "+" : ""}{fmt(profitIfBackWins)}€
            </span>
          </div>
          
          <div className="flex justify-between items-center p-2 rounded-lg bg-zinc-800/30">
            <span className="text-xs text-zinc-400">Če LAY zmaga:</span>
            <span className={`font-mono text-sm ${profitIfLayWins >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {profitIfLayWins >= 0 ? "+" : ""}{fmt(profitIfLayWins)}€
            </span>
          </div>

          <div className={`
            flex justify-between items-center p-2 rounded-lg mt-2
            ${isProfit ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-rose-500/10 border border-rose-500/20"}
          `}>
            <span className="text-xs text-zinc-300 font-medium">
              {isProfit ? "Garantiran profit:" : "Qualifying loss:"}
            </span>
            <span className={`font-mono text-sm font-bold ${isProfit ? "text-emerald-400" : "text-rose-400"}`}>
              {qualifyingLoss >= 0 ? "+" : ""}{fmt(qualifyingLoss)}€
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CalculatorPanel() {
  const [activeCalc, setActiveCalc] = useState<string>("ai");
  

const calculators = [
  { id: "ai", name: "AI Odds", icon: "🤖" },
  { id: "surebet", name: "Surebet", icon: "💰" },
  { id: "kelly", name: "Kelly", icon: "📊" },
  { id: "lay", name: "Lay", icon: "🔄" },
  { id: "odds", name: "Kvote", icon: "🔢" },
  { id: "margin", name: "Marža", icon: "📉" },
  { id: "dutch", name: "Dutch", icon: "🎯" },
];

  return (
    <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden">
      <div className="p-4 border-b border-zinc-800">
        <h3 className="font-semibold text-white text-sm">🧮 Kalkulatorji</h3>
      </div>
      
      <div className="flex flex-wrap border-b border-zinc-800">
        {calculators.map((calc) => (
          <button
            key={calc.id}
            onClick={() => setActiveCalc(calc.id)}
            className={`
              flex-1 min-w-[50px] px-1 py-2 text-xs font-medium transition-colors
              ${activeCalc === calc.id 
                ? "bg-zinc-800 text-white border-b-2 border-emerald-500" 
                : "text-zinc-500 hover:text-zinc-400 hover:bg-zinc-800/50"
              }
            `}
          >
            <span className="block text-sm">{calc.icon}</span>
            <span className="block mt-0.5 truncate text-[9px]">{calc.name}</span>
          </button>
        ))}
      </div>

      <div className="p-4">
        {activeCalc === "ai" && <AIoddsCalculator />}
        {activeCalc === "surebet" && <SurebetCalculator />}
        {activeCalc === "kelly" && <KellyCalculator />}
        {activeCalc === "lay" && <LayCalculator />}
        {activeCalc === "odds" && <OddsConverter />}
        {activeCalc === "margin" && <MarginCalculator />}
        {activeCalc === "dutch" && <DutchingCalculator />}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   TOP VALUE BETS (Right Side)
───────────────────────────────────────────────────────────────────────────── */

function TopValueBets({ rows, threshold }: { rows: Row[]; threshold: number }) {
  const topValue = useMemo(() => {
    return rows
      .map((row) => ({
        row,
        best: bestSide(row, threshold),
      }))
      .filter(({ best }) => best.isValue)
      .sort((a, b) => (b.best.val ?? 0) - (a.best.val ?? 0))
      .slice(0, 3);
  }, [rows, threshold]);

  if (topValue.length === 0) {
    return (
      <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-4">
        <h3 className="font-semibold text-white text-sm mb-3">🔥 Top Value</h3>
        <p className="text-xs text-zinc-500">Ni najdenih value betov.</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden">
      <div className="p-4 border-b border-zinc-800">
        <h3 className="font-semibold text-white text-sm">🔥 Top 3 Value</h3>
      </div>
      
      <div className="divide-y divide-zinc-800/50">
        {topValue.map(({ row, best }, index) => {
          const aiOdds = best.side === "OVER" 
            ? aiOddsFromProb(row.p_over_25) 
            : aiOddsFromProb(row.p_under_25);
          const betOdds = best.side === "OVER" ? row.over_odds : row.under_odds;
          
          return (
            <div key={row.match_id} className="p-4">
              <div className="flex items-start gap-3">
                <div className={`
                  w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                  ${index === 0 ? "bg-amber-500/20 text-amber-400" : 
                    index === 1 ? "bg-zinc-500/20 text-zinc-400" : 
                    "bg-orange-900/20 text-orange-400"}
                `}>
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">
                    {row.matches.home_team}
                  </div>
                  <div className="text-sm text-zinc-500 truncate">
                    vs {row.matches.away_team}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`
                      text-xs font-semibold px-1.5 py-0.5 rounded
                      ${best.side === "OVER" 
                        ? "bg-emerald-500/20 text-emerald-400" 
                        : "bg-blue-500/20 text-blue-400"}
                    `}>
                      {best.side}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {fmt(betOdds)} → {fmt(aiOdds)}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-emerald-400 font-mono">
                    +{fmt(best.val, 1)}%
                  </div>
                  <div className="text-[10px] text-zinc-500 uppercase">value</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   REPORT MODAL
───────────────────────────────────────────────────────────────────────────── */

interface ParsedReport {
  summary?: string;
  recommendation?: string;
  confidence?: string;
  factors?: { label: string; value: string; sentiment: "positive" | "negative" | "neutral" }[];
  stats?: { label: string; value: string }[];
  rawText?: string;
}

function parseReport(report: string): ParsedReport {
  const result: ParsedReport = { factors: [], stats: [] };
  const lines = report.split('\n').filter(l => l.trim());
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.toLowerCase().includes('recommendation:') || trimmed.toLowerCase().includes('priporočilo:')) {
      result.recommendation = trimmed.split(':').slice(1).join(':').trim();
      continue;
    }
    
    if (trimmed.toLowerCase().includes('confidence:') || trimmed.toLowerCase().includes('zaupanje:')) {
      result.confidence = trimmed.split(':').slice(1).join(':').trim();
      continue;
    }
    
    if (trimmed.toLowerCase().includes('summary:') || trimmed.toLowerCase().includes('povzetek:')) {
      result.summary = trimmed.split(':').slice(1).join(':').trim();
      continue;
    }
    
    if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
      const content = trimmed.substring(1).trim();
      let sentiment: "positive" | "negative" | "neutral" = "neutral";
      
      if (content.toLowerCase().includes('✓') || content.toLowerCase().includes('good') || 
          content.toLowerCase().includes('strong') || content.toLowerCase().includes('+')) {
        sentiment = "positive";
      } else if (content.toLowerCase().includes('✗') || content.toLowerCase().includes('weak') || 
                 content.toLowerCase().includes('bad') || content.toLowerCase().includes('-')) {
        sentiment = "negative";
      }
      
      result.factors?.push({ label: content, value: "", sentiment });
      continue;
    }
    
    if (trimmed.includes(':') && !trimmed.toLowerCase().includes('http')) {
      const [label, ...valueParts] = trimmed.split(':');
      const value = valueParts.join(':').trim();
      if (label.length < 30 && value.length < 50) {
        result.stats?.push({ label: label.trim(), value });
      }
    }
  }
  
  if (!result.recommendation && !result.summary && (result.factors?.length || 0) < 2) {
    result.rawText = report;
  }
  
  return result;
}

function ReportModal({ 
  report, 
  matchName,
  row,
  threshold,
  onClose 
}: { 
  report: string; 
  matchName: string;
  row: Row;
  threshold: number;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const parsed = parseReport(report);
  const best = bestSide(row, threshold);
  const aiOdds = best.side === "OVER" ? aiOddsFromProb(row.p_over_25) : aiOddsFromProb(row.p_under_25);
  const betOdds = best.side === "OVER" ? row.over_odds : row.under_odds;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-2xl max-h-[85vh] bg-zinc-900 rounded-2xl border border-zinc-700/50 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative p-6 border-b border-zinc-800 bg-gradient-to-r from-zinc-900 to-zinc-800">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-zinc-700/50 text-zinc-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
              <span className="text-xl">🤖</span>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-white">{matchName}</h3>
              <p className="text-sm text-zinc-500 mt-1">AI Analiza • {formatDateSlovene(row.matches.match_date)}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 border-b border-zinc-800">
          <div className="p-4 text-center border-r border-zinc-800">
            <div className="text-xs text-zinc-500 mb-1">Priporočilo</div>
            <div className={`text-lg font-bold ${best.side === "OVER" ? "text-emerald-400" : "text-blue-400"}`}>
              {best.side} 2.5
            </div>
          </div>
          <div className="p-4 text-center border-r border-zinc-800">
            <div className="text-xs text-zinc-500 mb-1">Kvota stavnice</div>
            <div className="text-lg font-bold text-white font-mono">{fmt(betOdds)}</div>
          </div>
          <div className="p-4 text-center border-r border-zinc-800">
            <div className="text-xs text-zinc-500 mb-1">AI kvota</div>
            <div className="text-lg font-bold text-white font-mono">{fmt(aiOdds)}</div>
          </div>
          <div className="p-4 text-center">
            <div className="text-xs text-zinc-500 mb-1">Value</div>
            <div className={`text-lg font-bold font-mono ${best.isValue ? "text-emerald-400" : "text-zinc-400"}`}>
              {(best.val ?? 0) > 0 ? "+" : ""}{fmt(best.val, 1)}%
            </div>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[50vh]">
          {best.isValue && (
            <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <span className="text-emerald-400 text-lg">✓</span>
                </div>
                <div>
                  <div className="font-semibold text-emerald-400">Value Bet Detected</div>
                  <div className="text-sm text-zinc-400">
                    AI model je zaznal {fmt(best.val, 1)}% prednost nad kvoto stavnice
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mb-6">
            <h4 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">Model Statistika</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                <div className="text-xs text-zinc-500">Pričakovani goli (dom)</div>
                <div className="text-lg font-mono text-white">{fmt(row.lambda_home)}</div>
              </div>
              <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                <div className="text-xs text-zinc-500">Pričakovani goli (gost)</div>
                <div className="text-lg font-mono text-white">{fmt(row.lambda_away)}</div>
              </div>
              <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                <div className="text-xs text-zinc-500">P(Over 2.5)</div>
                <div className="text-lg font-mono text-emerald-400">{fmt(row.p_over_25 * 100, 1)}%</div>
              </div>
              <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                <div className="text-xs text-zinc-500">P(Under 2.5)</div>
                <div className="text-lg font-mono text-blue-400">{fmt(row.p_under_25 * 100, 1)}%</div>
              </div>
            </div>
          </div>

          {parsed.summary && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-2">Povzetek</h4>
              <p className="text-zinc-300 leading-relaxed">{parsed.summary}</p>
            </div>
          )}

          {parsed.factors && parsed.factors.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">Ključni faktorji</h4>
              <div className="space-y-2">
                {parsed.factors.map((factor, i) => (
                  <div 
                    key={i}
                    className={`
                      p-3 rounded-lg border-l-2 bg-zinc-800/30
                      ${factor.sentiment === "positive" ? "border-l-emerald-500" : 
                        factor.sentiment === "negative" ? "border-l-red-500" : "border-l-zinc-600"}
                    `}
                  >
                    <span className="text-zinc-300">{factor.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {parsed.stats && parsed.stats.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">Dodatne statistike</h4>
              <div className="space-y-2">
                {parsed.stats.map((stat, i) => (
                  <div key={i} className="flex justify-between py-2 border-b border-zinc-800/50">
                    <span className="text-zinc-500">{stat.label}</span>
                    <span className="text-white font-mono">{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {parsed.rawText && (
            <div>
              <h4 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">AI Analiza</h4>
              <div className="p-4 rounded-xl bg-zinc-800/30 border border-zinc-700/30">
                <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">{parsed.rawText}</p>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center justify-between">
            <div className="text-xs text-zinc-500">
              Napoved generirana z AI modelom
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-zinc-800 text-white text-sm font-medium hover:bg-zinc-700 transition-colors"
            >
              Zapri
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   LEAGUE SECTION
───────────────────────────────────────────────────────────────────────────── */

function LeagueSection({
  league,
  matches,
  threshold,
  defaultOpen = false,
}: {
  league: string;
  matches: Row[];
  threshold: number;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [reportModal, setReportModal] = useState<{ report: string; match: string; row: Row } | null>(null);

  const valueCount = matches.filter((r) => bestSide(r, threshold).isValue).length;

  return (
    <>
      <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900/30">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between p-4 hover:bg-zinc-800/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">{LEAGUE_ICONS[league] || "⚽"}</span>
            <span className="font-semibold text-white">{league}</span>
            <span className="text-sm text-zinc-500">({matches.length} tekm)</span>
            {valueCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {valueCount} value
              </span>
            )}
          </div>
          <svg
            className={`w-5 h-5 text-zinc-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="border-t border-zinc-800">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-zinc-500 uppercase tracking-wider bg-zinc-900/50">
                  <th className="text-left p-3 pl-4 font-medium">Tekma</th>
                  <th className="text-center p-3 font-medium w-20">Side</th>
                  <th className="text-center p-3 font-medium w-24">Bet Odds</th>
                  <th className="text-center p-3 font-medium w-24">AI Odds</th>
                  <th className="text-center p-3 font-medium w-20">Value</th>
                  <th className="text-center p-3 pr-4 font-medium w-16">Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {matches.map((row) => {
                  const best = bestSide(row, threshold);
                  const aiOdds = best.side === "OVER" 
                    ? aiOddsFromProb(row.p_over_25) 
                    : aiOddsFromProb(row.p_under_25);
                  const betOdds = best.side === "OVER" ? row.over_odds : row.under_odds;
                  const matchName = `${row.matches.home_team} vs ${row.matches.away_team}`;

                  return (
                    <tr
                      key={row.match_id}
                      className={`
                        hover:bg-zinc-800/20 transition-colors
                        ${best.isValue ? "bg-emerald-500/5" : ""}
                      `}
                    >
                      <td className="p-3 pl-4">
                        <div className="font-medium text-white">
                          {row.matches.home_team}
                          <span className="text-zinc-600 mx-2">:</span>
                          {row.matches.away_team}
                        </div>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          {formatDateSlovene(row.matches.match_date)}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`
                            inline-block px-2 py-1 text-xs font-semibold rounded
                            ${best.side === "OVER"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-blue-500/20 text-blue-400"
                            }
                          `}
                        >
                          {best.side}
                        </span>
                      </td>
                      <td className="p-3 text-center font-mono text-zinc-300">
                        {fmt(betOdds)}
                      </td>
                      <td className="p-3 text-center font-mono text-zinc-300">
                        {fmt(aiOdds)}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`
                            font-mono font-semibold
                            ${best.isValue
                              ? "text-emerald-400"
                              : (best.val ?? 0) > 0
                              ? "text-amber-400/70"
                              : "text-zinc-500"
                            }
                          `}
                        >
                          {(best.val ?? 0) > 0 ? "+" : ""}
                          {fmt(best.val, 1)}%
                        </span>
                      </td>
                      <td className="p-3 pr-4 text-center">
                        {row.report ? (
                          <button
                            onClick={() => setReportModal({ report: row.report!, match: matchName, row })}
                            className="p-2 rounded-lg hover:bg-zinc-700/50 text-zinc-400 hover:text-white transition-all hover:scale-110"
                            title="Poglej AI analizo"
                          >
                            📋
                          </button>
                        ) : (
                          <span className="text-zinc-700">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {reportModal && (
        <ReportModal
          report={reportModal.report}
          matchName={reportModal.match}
          row={reportModal.row}
          threshold={threshold}
          onClose={() => setReportModal(null)}
        />
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────────────────────────────────────── */

export default function PredictionsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState<ApiResponse["meta"]>();
  const [loading, setLoading] = useState(true);

  const [days, setDays] = useState(30);
  const [threshold, setThreshold] = useState(10);
  const [onlyOdds, setOnlyOdds] = useState(true);
  const [onlyValue, setOnlyValue] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    const qs = new URLSearchParams();
    qs.set("days", String(days));
    qs.set("limit", "500");
    qs.set("onlyOdds", onlyOdds ? "1" : "0");
    qs.set("onlyValue", onlyValue ? "1" : "0");
    qs.set("valueThresholdPct", String(threshold));

    fetch(`/api/predictions?${qs.toString()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j: ApiResponse) => {
        if (!alive) return;
        setRows(j.rows ?? []);
        setMeta(j.meta);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setRows([]);
        setMeta(undefined);
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [days, threshold, onlyOdds, onlyValue]);

  const groupedByLeague = useMemo(() => {
    const groups: Record<string, Row[]> = {};

    rows.forEach((row) => {
      const league = detectLeague(
        row.matches.home_team,
        row.matches.away_team,
        row.matches.league
      );
      if (!groups[league]) groups[league] = [];
      groups[league].push(row);
    });

    Object.values(groups).forEach((matches) => {
      matches.sort((a, b) => {
        const d = a.matches.match_date.localeCompare(b.matches.match_date);
        if (d !== 0) return d;
        const aa = bestSide(a, threshold).val ?? -999;
        const bb = bestSide(b, threshold).val ?? -999;
        return bb - aa;
      });
    });

    const sorted = LEAGUE_ORDER
      .filter((league) => groups[league]?.length > 0)
      .map((league) => ({ league, matches: groups[league] }));

    Object.keys(groups)
      .filter((league) => !LEAGUE_ORDER.includes(league))
      .forEach((league) => {
        sorted.push({ league, matches: groups[league] });
      });

    return sorted;
  }, [rows, threshold]);

  const totalValueBets = useMemo(() => {
    return rows.filter((r) => bestSide(r, threshold).isValue).length;
  }, [rows, threshold]);

  return (
    <div className="min-h-screen text-white">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6">
        <div className="pt-44">
          {/* All three columns aligned at the top with items-start */}
          <div className="flex gap-6 items-start">
            {/* LEFT SIDEBAR - Calculators */}
            <div className="hidden lg:block w-64 flex-shrink-0">
              <div className="sticky top-48 space-y-4">
                <CalculatorPanel />
                
                {/* Legend */}
                <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
                  <h4 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Legenda</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span className="text-zinc-400">Value bet (nad pragom)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      <span className="text-zinc-400">Pozitiven edge</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-zinc-600"></span>
                      <span className="text-zinc-400">Negativen edge</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CENTER - Main content */}
            <div className="flex-1 min-w-0">
              {/* Filters */}
              <div className="mb-6 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setOnlyOdds(!onlyOdds)}
                      className={`
                        px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                        ${onlyOdds
                          ? "bg-zinc-800 text-white"
                          : "text-zinc-500 hover:text-zinc-400"
                        }
                      `}
                    >
                      Samo s kvotami
                    </button>
                    <button
                      onClick={() => setOnlyValue(!onlyValue)}
                      className={`
                        px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                        ${onlyValue
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "text-zinc-500 hover:text-zinc-400"
                        }
                      `}
                    >
                      Samo VALUE
                    </button>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-zinc-500">Dni:</label>
                      <select
                        value={days}
                        onChange={(e) => setDays(Number(e.target.value))}
                        className="bg-zinc-800 border-0 rounded-lg px-2 py-1 text-sm text-white"
                      >
                        {[7, 14, 30, 60, 90].map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-zinc-500">Prag:</label>
                      <input
                        type="number"
                        value={threshold}
                        min={1}
                        max={50}
                        onChange={(e) => setThreshold(clamp(Number(e.target.value), 1, 50))}
                        className="w-14 bg-zinc-800 border-0 rounded-lg px-2 py-1 text-sm text-white text-center"
                      />
                      <span className="text-sm text-zinc-500">%</span>
                    </div>
                    
                    <div className="hidden sm:flex items-center gap-4 pl-4 border-l border-zinc-800">
                      <div className="text-right">
                        <div className="text-xs text-zinc-500">Tekme</div>
                        <div className="text-sm font-semibold tabular-nums">{loading ? "—" : rows.length}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-zinc-500">Value</div>
                        <div className="text-sm font-semibold tabular-nums text-emerald-400">
                          {loading ? "—" : totalValueBets}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Leagues */}
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="flex items-center gap-3 text-zinc-500">
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Nalagam napovedi...</span>
                  </div>
                </div>
              ) : groupedByLeague.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center mb-4 border border-zinc-800">
                    <span className="text-3xl">😢</span>
                  </div>
                  <p className="text-zinc-500">Ni najdenih napovedi za izbrane filtre.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {groupedByLeague.map(({ league, matches }, index) => (
                    <LeagueSection
                      key={league}
                      league={league}
                      matches={matches}
                      threshold={threshold}
                      defaultOpen={index < 2}
                    />
                  ))}
                </div>
              )}

              <footer className="mt-8 py-6 text-center">
                <p className="text-xs text-zinc-600">
                  Napovedi temeljijo na statističnem modelu. Stave so tvegane — igraj odgovorno.
                </p>
              </footer>
            </div>

            {/* RIGHT SIDEBAR - Top Value Bets */}
            <div className="hidden xl:block w-72 flex-shrink-0">
              <div className="sticky top-48 space-y-4">
                <TopValueBets rows={rows} threshold={threshold} />
                
                <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
                  <h4 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Povzetek</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500">Skupno tekem:</span>
                      <span className="text-white font-mono">{rows.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500">S kvotami:</span>
                      <span className="text-white font-mono">{meta?.withOdds ?? "—"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500">Value bets:</span>
                      <span className="text-emerald-400 font-mono">{totalValueBets}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500">Prag:</span>
                      <span className="text-white font-mono">{threshold}%</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
                  <h4 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Formula</h4>
                  <code className="text-xs text-zinc-400 block bg-black/30 p-2 rounded font-mono">
                    Value = (AI prob / Implied) - 1
                  </code>
                  <p className="text-xs text-zinc-600 mt-2">
                    Implied = 1 / Bet Odds
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}