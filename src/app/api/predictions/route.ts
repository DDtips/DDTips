// DATOTEKA: src/app/predictions/page.tsx
"use client";

import { useEffect, useState } from "react";

export default function PredictionsPage() {
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Kličemo naš novi API, ki smo ga ustvarili v koraku 1
    fetch("/api/predictions?days=3")
      .then((res) => res.json())
      .then((data) => {
        if (data.rows) {
          setPredictions(data.rows);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-10 text-white">Nalaganje napovedi...</div>;

  return (
    <div className="p-8 text-white">
      <h1 className="text-2xl font-bold mb-4">Napovedi Tekem</h1>
      
      <div className="grid gap-4">
        {predictions.map((p) => (
          <div key={p.id} className="border border-zinc-700 p-4 rounded bg-zinc-900">
            <div className="text-sm text-zinc-400">
              {new Date(p.matches.match_date).toLocaleString()}
            </div>
            <div className="font-bold text-lg">
              {p.matches.home_team} vs {p.matches.away_team}
            </div>
            <div className="mt-2 flex gap-4">
               <span>Over 2.5: {p.p_over_25}%</span>
               <span>Under 2.5: {p.p_under_25}%</span>
            </div>
          </div>
        ))}
      </div>
      
      {predictions.length === 0 && (
        <p>Ni prihajajočih tekem v bazi.</p>
      )}
    </div>
  );
}