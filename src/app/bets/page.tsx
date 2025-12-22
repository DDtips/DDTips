"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

type WL = "OPEN" | "WIN" | "LOSS" | "VOID";
type PreLive = "PREMATCH" | "LIVE";

type BetRow = {
  id: string;
  created_at?: string;
  datum: string; // YYYY-MM-DD
  wl: WL;
  dogodek: string;
  tip: string;
  kvota1: number;
  vplacilo1: number;
  lay_kvota: number | null;
  vplacilo2: number | null; // lay stake
  komisija: number | null; // ✅ zdaj se odšteva
  sport: string;
  cas_stave: PreLive;
  tipster: string;
  stavnica: string;
};

const TIPSTERJI = ["DAVID", "DEJAN", "KLEMEN", "MJ", "ZIMA", "BALKAN"] as const;

const SPORTI = [
  "NOGOMET",
  "TENIS",
  "KOŠARKA",
  "SM. SKOKI",
  "SMUČANJE",
  "BIATLON",
  "OSTALO",
] as const;

const STAVNICE = ["SHARP", "PINNACLE", "BET365", "WINAMAX"] as const;

const PRELIVE: PreLive[] = ["PREMATCH", "LIVE"];

function eur(n: number) {
  const sign = n < 0 ? "-" : "";
  const v = Math.abs(n);
  return `${sign}${v.toLocaleString("sl-SI", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}

function parseNum(x: string) {
  // sprejme tudi "2,3"
  const s = (x ?? "").toString().trim().replace(/\s+/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function calcProfit(b: BetRow) {
  // OPEN in VOID ne štejejo v profit
  if (b.wl === "OPEN" || b.wl === "VOID") return 0;

  const stake = Number(b.vplacilo1 || 0);
  const odds = Number(b.kvota1 || 0);

  const hasLay = (b.lay_kvota ?? 0) > 0 && (b.vplacilo2 ?? 0) > 0;
  const layOdds = Number(b.lay_kvota || 0);
  const layStake = Number(b.vplacilo2 || 0);

  // lay liability: (layOdds - 1) * layStake
  const layLiability = hasLay ? (layOdds - 1) * layStake : 0;

  // ✅ komisija vedno odšteta
  const kom = Number(b.komisija ?? 0);

  if (b.wl === "WIN") {
    // čisti profit (ne izplačilo)
    const backProfit = (odds - 1) * stake;
    return backProfit - layLiability - kom;
  }

  // LOSS
  // če ima lay: lay bet zmaga in dobiš layStake
  const base = -stake + (hasLay ? layStake : 0);
  return base - kom;
}

export default function BetsPage() {
  const [user, setUser] = useState<User | null>(null);

  const [rows, setRows] = useState<BetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // form
  const [datum, setDatum] = useState(() => new Date().toISOString().slice(0, 10));
  const [wl, setWl] = useState<WL>("OPEN");
  const [sport, setSport] = useState<(typeof SPORTI)[number]>("NOGOMET");
  const [casStave, setCasStave] = useState<PreLive>("PREMATCH");
  const [dogodek, setDogodek] = useState("");
  const [tip, setTip] = useState("");
  const [kvota1, setKvota1] = useState("2.00");
  const [vplacilo1, setVplacilo1] = useState("100");
  const [layKvota, setLayKvota] = useState(""); // opcijsko
  const [vplacilo2, setVplacilo2] = useState(""); // opcijsko
  const [komisija, setKomisija] = useState("0");
  const [tipster, setTipster] = useState<(typeof TIPSTERJI)[number]>("DAVID");
  const [stavnica, setStavnica] = useState<(typeof STAVNICE)[number]>("SHARP");

  // modal edit
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editWl, setEditWl] = useState<WL>("OPEN");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        window.location.href = "/login";
        return;
      }
      setUser(data.user);
      await loadBets();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadBets() {
    setLoading(true);
    setMsg(null);

    const { data, error } = await supabase
      .from("bets")
      .select("*")
      .order("datum", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      setMsg(error.message);
      setLoading(false);
      return;
    }

    setRows((data || []) as BetRow[]);
    setLoading(false);
  }

  async function addBet() {
    setMsg(null);

    if (!dogodek.trim() || !tip.trim()) {
      setMsg("Manjka dogodek ali tip.");
      return;
    }

    const payload = {
      datum,
      wl,
      dogodek: dogodek.trim(),
      tip: tip.trim(),
      kvota1: parseNum(kvota1),
      vplacilo1: parseNum(vplacilo1),
      lay_kvota: layKvota.trim() ? parseNum(layKvota) : null,
      vplacilo2: vplacilo2.trim() ? parseNum(vplacilo2) : null,
      komisija: komisija.trim() ? parseNum(komisija) : 0,
      sport,
      cas_stave: casStave,
      tipster,
      stavnica,
    };

    const { data, error } = await supabase
      .from("bets")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      setMsg(error.message);
      return;
    }

    // dodaj na vrh
    setRows((prev) => [data as BetRow, ...prev]);

    // reset minimalno
    setWl("OPEN");
    setDogodek("");
    setTip("");
  }

  async function deleteBet(id: string) {
    const ok = confirm("Si prepričan, da želiš izbrisati to stavo?");
    if (!ok) return;

    setMsg(null);

    const { error } = await supabase.from("bets").delete().eq("id", id);

    if (error) {
      setMsg(error.message);
      return;
    }

    // takoj odstrani iz UI
    setRows((prev) => prev.filter((r) => r.id !== id));

    // ✅ in še reload iz baze (da se ne “vrne” drugje)
    await loadBets();
  }

  function openEdit(b: BetRow) {
    setEditId(b.id);
    setEditWl(b.wl);
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editId) return;
    setMsg(null);

    const { error } = await supabase.from("bets").update({ wl: editWl }).eq("id", editId);

    if (error) {
      setMsg(error.message);
      return;
    }

    setRows((prev) => prev.map((r) => (r.id === editId ? { ...r, wl: editWl } : r)));
    setEditOpen(false);
    setEditId(null);
  }

  const computed = useMemo(() => {
    const withProfit = rows.map((r) => ({ ...r, profit: calcProfit(r) }));
    return { withProfit };
  }, [rows]);

  const headers = [
    "Datum",
    "W/L",
    "Dogodek",
    "Tip",
    "Kvota1",
    "Vplačilo1",
    "Lay kvota",
    "Vplačilo2",
    "Komisija",
    "Šport",
    "Dobiček",
    "PRE/LIVE",
    "Tipster",
    "Stavnica",
    "Akcije",
  ];

  return (
    <main style={{ padding: 18, maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 34, fontWeight: 900, margin: 0 }}>Stave</h1>
          <div style={{ opacity: 0.8, marginTop: 6 }}>
            Prijavljen kot: <b>{user?.email || "-"}</b>
          </div>
        </div>

        {/* ✅ navigacija/odjava je zdaj v Headerju -> tukaj nič */}
      </div>

      {msg && (
        <div style={{ marginTop: 12, padding: 10, borderRadius: 12, border: "1px solid rgba(255,255,255,0.2)" }}>
          {msg}
        </div>
      )}

      {/* DODAJ STAVO */}
      <section style={{ marginTop: 16, padding: 14, border: "1px solid rgba(255,255,255,0.2)", borderRadius: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>Dodaj stavo</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
          <div>
            <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 6 }}>Datum</div>
            <input value={datum} onChange={(e) => setDatum(e.target.value)} type="date" style={inputStyle} />
          </div>

          <div>
            <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 6 }}>W/L</div>
            <select value={wl} onChange={(e) => setWl(e.target.value as WL)} style={inputStyle}>
              <option value="OPEN">OPEN</option>
              <option value="WIN">WIN</option>
              <option value="LOSS">LOSS</option>
              <option value="VOID">VOID (storno)</option>
            </select>
          </div>

          <div>
            <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 6 }}>Šport</div>
            <select value={sport} onChange={(e) => setSport(e.target.value as any)} style={inputStyle}>
              {SPORTI.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 6 }}>Prematch/Live</div>
            <select value={casStave} onChange={(e) => setCasStave(e.target.value as PreLive)} style={inputStyle}>
              {PRELIVE.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div style={{ gridColumn: "1 / span 2" }}>
            <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 6 }}>Dogodek</div>
            <input
              value={dogodek}
              onChange={(e) => setDogodek(e.target.value)}
              placeholder="npr. Dinamo : Hajduk"
              style={inputStyle}
            />
          </div>

          <div style={{ gridColumn: "3 / span 2" }}>
            <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 6 }}>Tip</div>
            <input
              value={tip}
              onChange={(e) => setTip(e.target.value)}
              placeholder="npr. Dinamo to win"
              style={inputStyle}
            />
          </div>

          <div>
            <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 6 }}>Kvota 1</div>
            <input value={kvota1} onChange={(e) => setKvota1(e.target.value)} placeholder="2.00" style={inputStyle} />
          </div>

          <div>
            <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 6 }}>Vplačilo 1</div>
            <input value={vplacilo1} onChange={(e) => setVplacilo1(e.target.value)} placeholder="100" style={inputStyle} />
          </div>

          <div>
            <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 6 }}>Lay kvota (opcijsko)</div>
            <input value={layKvota} onChange={(e) => setLayKvota(e.target.value)} placeholder="1.10" style={inputStyle} />
          </div>

          <div>
            <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 6 }}>Vplačilo 2 (lay stake, opcijsko)</div>
            <input value={vplacilo2} onChange={(e) => setVplacilo2(e.target.value)} placeholder="100" style={inputStyle} />
          </div>

          <div>
            <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 6 }}>Komisija</div>
            <input value={komisija} onChange={(e) => setKomisija(e.target.value)} placeholder="0" style={inputStyle} />
          </div>

          <div>
            <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 6 }}>Tipster</div>
            <select value={tipster} onChange={(e) => setTipster(e.target.value as any)} style={inputStyle}>
              {TIPSTERJI.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 6 }}>Stavnica</div>
            <select value={stavnica} onChange={(e) => setStavnica(e.target.value as any)} style={inputStyle}>
              {STAVNICE.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "end", gap: 10 }}>
            <button onClick={addBet} style={primaryBtn}>
              Dodaj stavo
            </button>
            <button onClick={loadBets} style={ghostBtn}>
              Osveži
            </button>
          </div>
        </div>
      </section>

      {/* TABELA */}
      <section style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>Vse stave</h2>
          <div style={{ opacity: 0.8 }}>{loading ? "Nalagam..." : `${computed.withProfit.length} vrstic`}</div>
        </div>

        <div style={{ marginTop: 10, border: "1px solid rgba(255,255,255,0.2)", borderRadius: 16, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1200 }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.06)" }}>
                {headers.map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: 10, whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {computed.withProfit.map((r) => {
                const hasLay = (r.lay_kvota ?? 0) > 0 && (r.vplacilo2 ?? 0) > 0;
                const profit = (r as any).profit as number;

                return (
                  <tr key={r.id}>
                    <td style={tdStyle}>{r.datum}</td>

                    <td style={tdStyle}>
                      <button
                        onClick={() => openEdit(r)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.2)",
                          background: "transparent",
                          color: "#fff",
                          cursor: "pointer",
                          fontWeight: 900,
                        }}
                        title="Klikni za spremembo (WIN/LOSS/VOID)"
                      >
                        {r.wl}
                      </button>
                    </td>

                    <td style={tdStyle}>{r.dogodek}</td>
                    <td style={tdStyle}>{r.tip}</td>
                    <td style={tdStyle}>{r.kvota1}</td>
                    <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{eur(r.vplacilo1)}</td>
                    <td style={tdStyle}>{hasLay ? r.lay_kvota : "-"}</td>
                    <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{hasLay ? eur(r.vplacilo2 || 0) : "-"}</td>
                    <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{eur(Number(r.komisija ?? 0))}</td>
                    <td style={tdStyle}>{r.sport}</td>

                    <td style={{ ...tdStyle, whiteSpace: "nowrap", fontWeight: 900 }}>
                      {eur(profit)}
                    </td>

                    <td style={tdStyle}>{r.cas_stave}</td>
                    <td style={tdStyle}>{r.tipster}</td>
                    <td style={tdStyle}>{r.stavnica}</td>

                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <button onClick={() => deleteBet(r.id)} style={ghostBtn}>
                        Izbriši
                      </button>
                    </td>
                  </tr>
                );
              })}

              {!computed.withProfit.length && (
                <tr>
                  <td colSpan={headers.length} style={{ padding: 14, opacity: 0.7 }}>
                    Ni še nobene stave.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* MODAL (OPEN → WIN/LOSS/VOID) */}
      {editOpen && (
        <div
          onClick={() => setEditOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(520px, 100%)",
              padding: 16,
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(20,20,20,0.95)",
              color: "#fff",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 900 }}>Zapri stavo</div>
              <button onClick={() => setEditOpen(false)} style={ghostBtn}>
                ✕
              </button>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ opacity: 0.8, marginBottom: 6 }}>Rezultat</div>
              <select value={editWl} onChange={(e) => setEditWl(e.target.value as WL)} style={inputStyle}>
                <option value="OPEN">OPEN</option>
                <option value="WIN">WIN</option>
                <option value="LOSS">LOSS</option>
                <option value="VOID">VOID (storno)</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button onClick={() => setEditOpen(false)} style={ghostBtn}>
                Prekliči
              </button>
              <button onClick={saveEdit} style={primaryBtn}>
                Shrani
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "transparent",
  color: "#fff",
  outline: "none",
};

const tdStyle: React.CSSProperties = {
  padding: 10,
  borderBottom: "1px solid rgba(255,255,255,0.1)",
  verticalAlign: "top",
};

const primaryBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "rgba(255,255,255,0.08)",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const ghostBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "transparent",
  color: "#fff",
  cursor: "pointer",
  whiteSpace: "nowrap",
};
