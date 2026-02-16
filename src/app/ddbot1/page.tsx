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

function formatDateSl(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
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
    return { over, under };
  }, [rows]);

  return (
    <div className="min-h-screen text-white">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 pt-44 pb-20">
        <div className="mb-6 p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight">DDBot1</h1>
              <p className="text-sm text-zinc-400 mt-1">
                Value picks za Over/Under 2.5 na podlagi modelskih verjetnosti in kvot.
              </p>
            </div>
            <div className="text-sm text-zinc-400">
              {meta ? (
                <span>
                  Obdobje: <span className="text-zinc-200">{meta.from}</span> →{" "}
                  <span className="text-zinc-200">{meta.to}</span>
                </span>
              ) : (
                <span>Obdobje: —</span>
              )}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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

            <div className="rounded-lg border border-zinc-800 bg-black/25 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-zinc-500">Picks</div>
              <div className="text-lg font-semibold">{loading ? "—" : rows.length}</div>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-black/25 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-zinc-500">Over</div>
              <div className="text-lg font-semibold text-emerald-400">{loading ? "—" : totals.over}</div>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-black/25 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-zinc-500">Under</div>
              <div className="text-lg font-semibold text-blue-400">{loading ? "—" : totals.under}</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-zinc-400">Nalagam DDBot1 picke...</div>
          ) : error ? (
            <div className="p-10 text-center text-rose-400">{error}</div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-zinc-500">
              Trenutno ni tekem nad izbranim value pragom.
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-[980px]">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-zinc-500 bg-zinc-950/70">
                    <th className="text-left p-3 pl-4">Tekma</th>
                    <th className="text-center p-3">Datum</th>
                    <th className="text-center p-3">Liga</th>
                    <th className="text-center p-3">Side</th>
                    <th className="text-center p-3">Book</th>
                    <th className="text-center p-3">AI</th>
                    <th className="text-center p-3">Edge</th>
                    <th className="text-center p-3">P(model)</th>
                    <th className="text-center p-3 pr-4">xG</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {rows.map((row) => (
                    <tr key={`${row.match_id}-${row.home_team}-${row.away_team}`}>
                      <td className="p-3 pl-4">
                        <div className="font-medium text-zinc-100">
                          {row.home_team} <span className="text-zinc-500">vs</span> {row.away_team}
                        </div>
                      </td>
                      <td className="p-3 text-center text-zinc-300">{formatDateSl(row.match_date)}</td>
                      <td className="p-3 text-center text-zinc-400">{row.league || "—"}</td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-1 rounded-md text-xs font-semibold ${
                            row.side === "OVER"
                              ? "bg-emerald-500/15 text-emerald-400"
                              : "bg-blue-500/15 text-blue-400"
                          }`}
                        >
                          {row.side} 2.5
                        </span>
                      </td>
                      <td className="p-3 text-center font-mono text-zinc-200">{fmt(row.book_odds)}</td>
                      <td className="p-3 text-center font-mono text-zinc-300">{fmt(row.ai_odds)}</td>
                      <td className="p-3 text-center">
                        <span className="font-mono font-semibold text-emerald-400">
                          +{fmt(row.edge_pct, 1)}%
                        </span>
                      </td>
                      <td className="p-3 text-center font-mono text-zinc-300">
                        {fmt(row.model_probability * 100, 1)}%
                      </td>
                      <td className="p-3 pr-4 text-center font-mono text-zinc-400">
                        {fmt(row.lambda_total, 2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="mt-4 text-xs text-zinc-600 text-center">
          DDBot1 je informativen model. Stave so tvegane in niso finančni nasvet.
        </p>
      </div>
    </div>
  );
}
