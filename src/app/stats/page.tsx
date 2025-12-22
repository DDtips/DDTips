"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type WL = "OPEN" | "WIN" | "LOSS" | "VOID";
type Cas = "PREMATCH" | "LIVE";

type Bet = {
  id: string;
  datum: string; // YYYY-MM-DD
  wl: WL;

  kvota1: number;
  vplacilo1: number;

  lay_kvota: number;
  vplacilo2: number;

  komisija: number;

  sport: string;
  cas_stave: Cas;
  tipster: string;
  stavnica: string;
};

const CAPITAL_DAVID = 3500;
const CAPITAL_DEJAN = 3500;
const CAPITAL_TOTAL = CAPITAL_DAVID + CAPITAL_DEJAN;

// ZAČETNA STANJA
const BOOK_START: Record<string, number> = {
  SHARP: 2000,
  PINNACLE: 2000,
  BET365: 2000,
  WINAMAX: 1000,
};

function normBook(x: string) {
  return (x || "").toUpperCase().replace(/\s+/g, "");
}

function eur(n: number) {
  return n.toLocaleString("sl-SI", { style: "currency", currency: "EUR" });
}

function monthKey(d: string) {
  return d.slice(0, 7); // YYYY-MM
}

function hasLay(b: Bet) {
  return (b.lay_kvota ?? 0) > 1 && (b.vplacilo2 ?? 0) > 0;
}

// PROFIT: samo WIN/LOSS. OPEN/VOID = 0.
function calcProfit(b: Bet): number {
  const kom = b.komisija || 0;
  if (b.wl !== "WIN" && b.wl !== "LOSS") return 0;

  if (!hasLay(b)) {
    if (b.wl === "WIN") return b.vplacilo1 * (b.kvota1 - 1) - kom;
    if (b.wl === "LOSS") return -b.vplacilo1 - kom;
    return 0;
  }

  const backStake = b.vplacilo1;
  const backOdds = b.kvota1;

  const layStake = b.vplacilo2; // lay stake
  const layOdds = b.lay_kvota;
  const liability = (layOdds - 1) * layStake;

  if (b.wl === "WIN") return backStake * (backOdds - 1) - liability - kom;
  if (b.wl === "LOSS") return -backStake + layStake - kom;

  return 0;
}

function buildStats(rows: Bet[]) {
  const settled = rows.filter((r) => r.wl === "WIN" || r.wl === "LOSS");

  const n = settled.length;
  const wins = settled.filter((r) => r.wl === "WIN").length;
  const losses = settled.filter((r) => r.wl === "LOSS").length;

  const profit = settled.reduce((acc, r) => acc + calcProfit(r), 0);

  const avgOdds =
    n === 0 ? 0 : settled.reduce((acc, r) => acc + (Number(r.kvota1) || 0), 0) / n;

  const roi = CAPITAL_TOTAL === 0 ? 0 : profit / CAPITAL_TOTAL;
  const bankroll = CAPITAL_TOTAL + profit;

  // STANJE PO STAVNICAH = start + profit po stavnici
  const profitByBook = new Map<string, number>();
  settled.forEach((r) => {
    const key = normBook(r.stavnica || "NEZNANO");
    profitByBook.set(key, (profitByBook.get(key) ?? 0) + calcProfit(r));
  });

  const balanceByBook: { name: string; start: number; profit: number; balance: number }[] = [];

  Object.entries(BOOK_START).forEach(([name, start]) => {
    const p = profitByBook.get(name) ?? 0;
    balanceByBook.push({ name, start, profit: p, balance: start + p });
  });

  // Če se pojavi nova stavnica, ki je ni v BOOK_START
  profitByBook.forEach((p, name) => {
    if (!(name in BOOK_START)) balanceByBook.push({ name, start: 0, profit: p, balance: p });
  });

  balanceByBook.sort((a, b) => b.balance - a.balance);

  return { profit, n, wins, losses, avgOdds, roi, bankroll, balanceByBook };
}

function Kpi({
  title,
  value,
  color = "inherit",
}: {
  title: string;
  value: string;
  color?: string;
}) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 16, fontWeight: 900, color }}>{value}</div>
    </div>
  );
}

export default function StatsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // filtri
  const [sport, setSport] = useState("ALL");
  const [tipster, setTipster] = useState("ALL");
  const [stavnica, setStavnica] = useState("ALL");
  const [cas, setCas] = useState<"ALL" | Cas>("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login");
        return;
      }
      await loadRows();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function loadRows() {
    setLoading(true);
    setMsg(null);
    const { data, error } = await supabase
      .from("bets")
      .select("*")
      .order("datum", { ascending: true });
    setLoading(false);
    if (error) return setMsg(error.message);
    setRows((data ?? []) as Bet[]);
  }

  const options = useMemo(() => {
    const sports = new Set<string>();
    const tipsters = new Set<string>();
    const stavnice = new Set<string>();

    rows.forEach((r) => {
      if (r.sport) sports.add(r.sport);
      if (r.tipster) tipsters.add(r.tipster);
      if (r.stavnica) stavnice.add(r.stavnica);
    });

    return {
      sports: ["ALL", ...Array.from(sports).sort()],
      tipsters: ["ALL", ...Array.from(tipsters).sort()],
      stavnice: ["ALL", ...Array.from(stavnice).sort()],
    };
  }, [rows]);

  // skupna statistika
  const overall = useMemo(() => buildStats(rows), [rows]);

  // filtrirane vrstice
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (sport !== "ALL" && r.sport !== sport) return false;
      if (tipster !== "ALL" && r.tipster !== tipster) return false;
      if (stavnica !== "ALL" && r.stavnica !== stavnica) return false;
      if (cas !== "ALL" && r.cas_stave !== cas) return false;
      if (fromDate && r.datum < fromDate) return false;
      if (toDate && r.datum > toDate) return false;
      return true;
    });
  }, [rows, sport, tipster, stavnica, cas, fromDate, toDate]);

  // statistika po filtrih
  const filtered = useMemo(() => buildStats(filteredRows), [filteredRows]);

  // graf: profit po mesecih (filtrirano)
  const chartMonthly = useMemo(() => {
    const settled = filteredRows.filter((r) => r.wl === "WIN" || r.wl === "LOSS");
    const map = new Map<string, number>();
    settled.forEach((r) => {
      const key = monthKey(r.datum);
      map.set(key, (map.get(key) ?? 0) + calcProfit(r));
    });

    const arr = Array.from(map.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([m, profit]) => ({ month: m, profit }));

    let cum = 0;
    return arr.map((x) => {
      cum += x.profit;
      return { ...x, cum };
    });
  }, [filteredRows]);

  // graf: profit po športih (filtrirano)
  const chartBySport = useMemo(() => {
    const settled = filteredRows.filter((r) => r.wl === "WIN" || r.wl === "LOSS");
    const map = new Map<string, number>();
    settled.forEach((r) => {
      const key = r.sport || "OSTALO";
      map.set(key, (map.get(key) ?? 0) + calcProfit(r));
    });

    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([sport, profit]) => ({ sport, profit }));
  }, [filteredRows]);

  return (
    <main style={{ maxWidth: 1300, margin: "30px auto", padding: 16 }}>
      {/* TOP BAR (brez linkov do /bets in /stats) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Statistika</h1>
          <div style={{ fontSize: 13, opacity: 0.7 }}>Upošteva samo WIN/LOSS</div>
        </div>

        <button
          onClick={loadRows}
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.25)",
            background: "transparent",
            color: "white",
            cursor: "pointer",
          }}
        >
          Osveži
        </button>
      </div>

      {msg && <p style={{ marginTop: 10 }}>{msg}</p>}

      {/* SKUPNA STATISTIKA */}
      <section
        style={{
          marginTop: 16,
          padding: 16,
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 16,
          background: "rgba(255,255,255,0.03)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>Skupna statistika</h2>
          <div style={{ opacity: 0.7, fontSize: 13 }}>Kapital: {eur(CAPITAL_TOTAL)}</div>
        </div>

        <div
          style={{
            marginTop: 14,
            display: "grid",
            gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
            gap: 10,
          }}
        >
          <Kpi
            title="Profit"
            value={eur(overall.profit)}
            color={overall.profit >= 0 ? "#22c55e" : "#ef4444"}
          />
          <Kpi
            title="Bankroll"
            value={eur(overall.bankroll)}
            color={overall.bankroll >= CAPITAL_TOTAL ? "#22c55e" : "#ef4444"}
          />
          <Kpi title="ROI" value={`${(overall.roi * 100).toFixed(2)}%`} />
          <Kpi title="Stav (WIN/LOSS)" value={`${overall.n}`} />
          <Kpi title="WIN / LOSS" value={`${overall.wins} / ${overall.losses}`} />
          <Kpi title="Povp. kvota" value={overall.avgOdds ? overall.avgOdds.toFixed(2) : "-"} />
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Stanje na stavnicah</div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 10,
            }}
          >
            {overall.balanceByBook.map((x) => (
              <div
                key={x.name}
                style={{
                  padding: 12,
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontWeight: 900 }}>{x.name}</div>
                  <div style={{ fontWeight: 900 }}>{eur(x.balance)}</div>
                </div>

                <div
                  style={{
                    marginTop: 6,
                    display: "flex",
                    justifyContent: "space-between",
                    opacity: 0.75,
                    fontSize: 13,
                  }}
                >
                  <span>Start: {eur(x.start)}</span>
                  <span>Profit: {eur(x.profit)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FILTRI */}
      <section
        style={{
          marginTop: 16,
          padding: 14,
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 16,
          background: "rgba(255,255,255,0.03)",
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>Filtri</h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 10 }}>
          <label style={{ fontSize: 13, opacity: 0.85 }}>
            Od (datum)
            <input
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              type="date"
              style={{
                width: "100%",
                padding: 8,
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 10,
                background: "transparent",
                color: "white",
              }}
            />
          </label>

          <label style={{ fontSize: 13, opacity: 0.85 }}>
            Do (datum)
            <input
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              type="date"
              style={{
                width: "100%",
                padding: 8,
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 10,
                background: "transparent",
                color: "white",
              }}
            />
          </label>

          <label style={{ fontSize: 13, opacity: 0.85 }}>
            Šport
            <select
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              style={{
                width: "100%",
                padding: 8,
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 10,
                background: "transparent",
                color: "white",
              }}
            >
              {options.sports.map((s) => (
                <option key={s} value={s} style={{ color: "black" }}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label style={{ fontSize: 13, opacity: 0.85 }}>
            Tipster
            <select
              value={tipster}
              onChange={(e) => setTipster(e.target.value)}
              style={{
                width: "100%",
                padding: 8,
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 10,
                background: "transparent",
                color: "white",
              }}
            >
              {options.tipsters.map((t) => (
                <option key={t} value={t} style={{ color: "black" }}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label style={{ fontSize: 13, opacity: 0.85 }}>
            Stavnica
            <select
              value={stavnica}
              onChange={(e) => setStavnica(e.target.value)}
              style={{
                width: "100%",
                padding: 8,
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 10,
                background: "transparent",
                color: "white",
              }}
            >
              {options.stavnice.map((b) => (
                <option key={b} value={b} style={{ color: "black" }}>
                  {b}
                </option>
              ))}
            </select>
          </label>

          <label style={{ fontSize: 13, opacity: 0.85 }}>
            Prematch/Live
            <select
              value={cas}
              onChange={(e) => setCas(e.target.value as any)}
              style={{
                width: "100%",
                padding: 8,
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 10,
                background: "transparent",
                color: "white",
              }}
            >
              <option value="ALL" style={{ color: "black" }}>
                ALL
              </option>
              <option value="PREMATCH" style={{ color: "black" }}>
                PREMATCH
              </option>
              <option value="LIVE" style={{ color: "black" }}>
                LIVE
              </option>
            </select>
          </label>
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => {
              setSport("ALL");
              setTipster("ALL");
              setStavnica("ALL");
              setCas("ALL");
              setFromDate("");
              setToDate("");
            }}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.25)",
              background: "transparent",
              color: "white",
              cursor: "pointer",
            }}
          >
            Počisti filtre
          </button>
        </div>
      </section>

      {/* STATISTIKA PO FILTRIH */}
      <section
        style={{
          marginTop: 16,
          padding: 14,
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 16,
          background: "rgba(255,255,255,0.03)",
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>Statistika po filtrih</h2>

        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", opacity: 0.9 }}>
          <div>
            Profit: <b>{eur(filtered.profit)}</b>
          </div>
          <div>
            Vseh stav (WIN/LOSS): <b>{filtered.n}</b>
          </div>
          <div>
            WIN: <b>{filtered.wins}</b>
          </div>
          <div>
            LOSS: <b>{filtered.losses}</b>
          </div>
          <div>
            Povprečna kvota: <b>{filtered.avgOdds ? filtered.avgOdds.toFixed(2) : "-"}</b>
          </div>
          <div>
            ROI: <b>{(filtered.roi * 100).toFixed(2)}%</b>
          </div>
        </div>
      </section>

      {/* GRAFI */}
      <section style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div
          style={{
            padding: 16,
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.03)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>Profit po mesecih (filtri)</h3>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartMonthly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(v: number) => eur(Math.round(v * 100) / 100)} />
                <Bar dataKey="profit" fill="#22c55e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div
          style={{
            padding: 16,
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.03)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>Kumulativa po mesecih (filtri)</h3>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartMonthly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(v: number) => eur(Math.round(v * 100) / 100)} />
                <Line type="monotone" dataKey="cum" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section
        style={{
          marginTop: 16,
          padding: 16,
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.03)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>Profit po športih (filtri)</h3>
        <div style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartBySport} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="sport" width={120} />
              <Tooltip formatter={(v: number) => eur(Math.round(v * 100) / 100)} />
              <Bar dataKey="profit" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </main>
  );
}
