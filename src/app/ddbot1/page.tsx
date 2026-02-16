"use client";

import { useEffect, useMemo, useState } from "react";

type PickRow = {
  match_id: number | null;
  match_date: string;
  home_team: string;
  away_team: string;
  league: string | null;
  side: "OVER" | "UNDER";
  edge_pct: number;
  model_probability: number;
  implied_probability: number | null;
  book_odds: number;
  ai_odds: number | null;
  lambda_total: number;
};

type ApiResponse = {
  meta: {
    from: string;
    to: string;
    days: number;
    minEdgePct: number;
    limit: number;
    count: number;
  };
  rows: PickRow[];
  error?: string;
};

function fmt(n: number | null | undefined, digits = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return Number(n).toFixed(digits);
}

function pct(n: number | null | undefined, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${Number(n).toFixed(digits)}%`;
}

function formatDateSl(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Danes";
  if (d.toDateString() === tomorrow.toDateString()) return "Jutri";
  return d.toLocaleDateString("sl-SI", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

export default function DDBot1Page() {
  const [days, setDays] = useState(3);
  const [minEdgePct, setMinEdgePct] = useState(10);
  const [limit, setLimit] = useState(12);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<ApiResponse["meta"] | null>(null);
  const [rows, setRows] = useState<PickRow[]>([]);

  useEffect(() => {
    let alive = true;
    const fetchRows = async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        qs.set("days", String(days));
        qs.set("minEdgePct", String(minEdgePct));
        qs.set("limit", String(limit));

        const response = await fetch(`/api/ddbot1?${qs.toString()}`, { cache: "no-store" });
        const json: ApiResponse = await response.json();
        if (!alive) return;

        if (!response.ok || json.error) {
          setRows([]);
          setMeta(null);
          setError(json.error || "Napaka pri nalaganju DDBot1 podatkov.");
        } else {
          setRows(json.rows || []);
          setMeta(json.meta);
          setError(null);
        }
      } catch {
        if (!alive) return;
        setRows([]);
        setMeta(null);
        setError("Napaka povezave do API.");
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchRows();
    return () => {
      alive = false;
    };
  }, [days, minEdgePct, limit]);

  const totals = useMemo(() => {
    const over = rows.filter((r) => r.side === "OVER").length;
    const under = rows.length - over;
    const avgEdge = rows.length > 0 ? rows.reduce((acc, r) => acc + r.edge_pct, 0) / rows.length : 0;
    const bestEdge = rows.length > 0 ? Math.max(...rows.map((r) => r.edge_pct)) : 0;
    return { over, under, avgEdge, bestEdge };
  }, [rows]);

  const topPicks = useMemo(() => rows.slice(0, 3), [rows]);
  const edgeScaleMax = useMemo(() => Math.max(20, ...rows.map((r) => r.edge_pct), 0), [rows]);

  return (
    <div className="relative min-h-screen text-white overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(16,185,129,0.18),transparent_42%),radial-gradient(circle_at_88%_8%,rgba(34,197,94,0.12),transparent_32%),linear-gradient(180deg,#09090f_0%,#070a0f_100%)]" />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.04] mix-blend-overlay pointer-events-none" />

      <div className="relative z-10 max-w-[1500px] mx-auto px-4 sm:px-6 pt-44 pb-20">
        <div className="mb-6 rounded-3xl border border-emerald-500/20 bg-zinc-950/70 backdrop-blur-xl p-6 lg:p-7 shadow-[0_0_80px_-35px_rgba(16,185,129,0.35)]">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-black tracking-[0.18em] uppercase text-emerald-300">
                Value Desk
              </span>
              <h1 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight bg-gradient-to-r from-emerald-200 via-emerald-400 to-lime-300 text-transparent bg-clip-text">
                DDBot1
              </h1>
              <p className="text-sm text-zinc-400 mt-2 max-w-2xl">
                Over/Under 2.5 value signali na podlagi modelskih verjetnosti in market kvot.
              </p>
            </div>
            <div className="text-xs sm:text-sm text-zinc-400 rounded-xl border border-zinc-800 bg-black/35 px-4 py-3">
              {meta ? (
                <span>
                  Obdobje: <span className="text-zinc-100">{meta.from}</span> <span className="text-zinc-600">→</span>{" "}
                  <span className="text-zinc-100">{meta.to}</span>
                </span>
              ) : (
                <span>Obdobje: —</span>
              )}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-zinc-800 bg-black/25 px-4 py-3">
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">Picks</div>
              <div className="text-2xl font-black mt-1">{loading ? "—" : rows.length}</div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-black/25 px-4 py-3">
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">Over / Under</div>
              <div className="text-xl font-black mt-1">
                <span className="text-emerald-400">{loading ? "—" : totals.over}</span>
                <span className="text-zinc-600 mx-1">/</span>
                <span className="text-sky-400">{loading ? "—" : totals.under}</span>
              </div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-black/25 px-4 py-3">
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">Avg edge</div>
              <div className="text-2xl font-black mt-1 text-emerald-300">
                {loading ? "—" : `+${fmt(totals.avgEdge, 1)}%`}
              </div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-black/25 px-4 py-3">
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">Best edge</div>
              <div className="text-2xl font-black mt-1 text-emerald-400">
                {loading ? "—" : `+${fmt(totals.bestEdge, 1)}%`}
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 backdrop-blur p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1 text-xs text-zinc-500 uppercase tracking-wide">
              Dni naprej
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="bg-zinc-800 rounded-lg px-3 py-2 text-sm text-white border border-zinc-700"
              >
                {[1, 2, 3, 5, 7, 14, 21, 30].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs text-zinc-500 uppercase tracking-wide">
              Min edge %
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={minEdgePct}
                onChange={(e) => setMinEdgePct(Number(e.target.value))}
                className="bg-zinc-800 rounded-lg px-3 py-2 text-sm text-white border border-zinc-700"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs text-zinc-500 uppercase tracking-wide">
              Max picks
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="bg-zinc-800 rounded-lg px-3 py-2 text-sm text-white border border-zinc-700"
              >
                {[5, 8, 10, 12, 20, 30, 50].map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {!loading && !error && topPicks.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-500 mb-3">Top Picks</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {topPicks.map((pick, index) => (
                <div
                  key={`${pick.match_id}-${index}`}
                  className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/12 to-zinc-900/80 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                        #{index + 1} Value
                      </div>
                      <div className="mt-1 font-semibold leading-tight">
                        {pick.home_team} <span className="text-zinc-500">vs</span> {pick.away_team}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-md text-xs font-bold ${
                        pick.side === "OVER"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                      }`}
                    >
                      {pick.side} 2.5
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg border border-zinc-800 bg-black/30 py-2">
                      <div className="text-[10px] text-zinc-500 uppercase">Edge</div>
                      <div className="text-sm font-black text-emerald-300">+{fmt(pick.edge_pct, 1)}%</div>
                    </div>
                    <div className="rounded-lg border border-zinc-800 bg-black/30 py-2">
                      <div className="text-[10px] text-zinc-500 uppercase">Book</div>
                      <div className="text-sm font-mono text-zinc-200">{fmt(pick.book_odds)}</div>
                    </div>
                    <div className="rounded-lg border border-zinc-800 bg-black/30 py-2">
                      <div className="text-[10px] text-zinc-500 uppercase">AI</div>
                      <div className="text-sm font-mono text-zinc-200">{fmt(pick.ai_odds)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/45 overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-zinc-400">Nalagam DDBot1 picke...</div>
          ) : error ? (
            <div className="p-10 text-center text-rose-400">{error}</div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-zinc-500">
              Trenutno ni tekem nad izbranim value pragom.
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-auto">
                <table className="w-full min-w-[980px]">
                  <thead>
                    <tr className="text-xs uppercase tracking-wider text-zinc-500 bg-zinc-950/70">
                      <th className="text-left p-3 pl-4">Tekma</th>
                      <th className="text-center p-3">Datum</th>
                      <th className="text-center p-3">Signal</th>
                      <th className="text-center p-3">Book / AI</th>
                      <th className="text-center p-3">Edge</th>
                      <th className="text-center p-3">P(model)</th>
                      <th className="text-center p-3 pr-4">xG</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {rows.map((row) => (
                      <tr key={`${row.match_id}-${row.home_team}-${row.away_team}`} className="hover:bg-zinc-800/20">
                        <td className="p-3 pl-4">
                          <div className="font-medium text-zinc-100">
                            {row.home_team} <span className="text-zinc-500">vs</span> {row.away_team}
                          </div>
                          <div className="text-xs text-zinc-500 mt-0.5">{row.league || "—"}</div>
                        </td>
                        <td className="p-3 text-center text-zinc-300">{formatDateSl(row.match_date)}</td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-1 rounded-md text-xs font-semibold ${
                              row.side === "OVER"
                                ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-sky-500/15 text-sky-400"
                            }`}
                          >
                            {row.side} 2.5
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono text-zinc-200">
                          {fmt(row.book_odds)} <span className="text-zinc-600">/</span> {fmt(row.ai_odds)}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-3 justify-center">
                            <span className="font-mono font-semibold text-emerald-400 min-w-[70px] text-right">
                              +{fmt(row.edge_pct, 1)}%
                            </span>
                            <div className="h-1.5 w-20 rounded-full bg-zinc-800 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-lime-400"
                                style={{ width: `${Math.min(100, (row.edge_pct / edgeScaleMax) * 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-center font-mono text-zinc-300">{pct(row.model_probability * 100)}</td>
                        <td className="p-3 pr-4 text-center font-mono text-zinc-400">{fmt(row.lambda_total, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden divide-y divide-zinc-800/60">
                {rows.map((row) => (
                  <div key={`${row.match_id}-${row.home_team}-${row.away_team}`} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-zinc-100">
                          {row.home_team} <span className="text-zinc-500">vs</span> {row.away_team}
                        </div>
                        <div className="text-xs text-zinc-500 mt-1">
                          {formatDateSl(row.match_date)} {row.league ? `• ${row.league}` : ""}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-md text-xs font-semibold ${
                          row.side === "OVER"
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-sky-500/15 text-sky-400"
                        }`}
                      >
                        {row.side} 2.5
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg border border-zinc-800 bg-black/25 px-3 py-2">
                        <div className="text-zinc-500 uppercase">Book / AI</div>
                        <div className="mt-1 font-mono text-zinc-200">
                          {fmt(row.book_odds)} / {fmt(row.ai_odds)}
                        </div>
                      </div>
                      <div className="rounded-lg border border-zinc-800 bg-black/25 px-3 py-2">
                        <div className="text-zinc-500 uppercase">Edge</div>
                        <div className="mt-1 font-mono text-emerald-400">+{fmt(row.edge_pct, 1)}%</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <p className="mt-4 text-xs text-zinc-600 text-center">
          DDBot1 je informativen model. Stave so tvegane in niso finančni nasvet.
        </p>
      </div>
    </div>
  );
}
