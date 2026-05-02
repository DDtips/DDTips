"use client";
import React, { useEffect, useState } from 'react';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';

export interface EconomicEvent {
  title: string;
  country: string;
  date: string;
  time: string;
  impact: string; // "High", "Medium", "Low"
  estimate: string | null;
  previous: string | null;
}

interface CalendarCardProps {
  events: EconomicEvent[];
}

export default function CalendarCard({ events }: CalendarCardProps) {
  const [targetDateStr, setTargetDateStr] = useState("");
  const [displayDate, setDisplayDate] = useState("");

  useEffect(() => {
    const d = new Date();
    if (d.getDay() === 6) d.setDate(d.getDate() + 2); // Sobota -> Ponedeljek
    else if (d.getDay() === 0) d.setDate(d.getDate() + 1); // Nedelja -> Ponedeljek
    
    const isoDate = d.toISOString().split('T')[0];
    setTargetDateStr(isoDate);

    const formatted = d.toLocaleDateString('sl-SI', { weekday: 'long', day: 'numeric', month: 'long' });
    setDisplayDate(formatted.toUpperCase());
  }, []);

  // Funkcija za barvo impacta
  const getImpactStyle = (impact: string) => {
    if (impact === "High") return "bg-rose-500/10 border-rose-500/20 text-rose-400";
    if (impact === "Medium") return "bg-amber-500/10 border-amber-500/20 text-amber-400";
    return "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
  };

  const todaysEvents = events.slice(0, 5); 

  return (
    <div className="p-5 rounded-2xl bg-[#121316] border border-white/5 w-full h-full flex flex-col relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl pointer-events-none" />

      <div className="flex items-center justify-between mb-5 relative z-10">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-black text-white tracking-widest uppercase">
            Koledar
          </h2>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-bold text-zinc-500 tracking-wider">AKTUALNI DAN</span>
          <span className="text-xs font-black text-blue-400">{displayDate || "NALAGAM..."}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 flex-1 relative z-10">
        {todaysEvents.length > 0 ? (
          todaysEvents.map((event, index) => (
            <div key={index} className="group flex items-center justify-between p-3 rounded-xl bg-[#0b0e14] border border-white/5 hover:border-blue-500/30 transition-all">
              
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center justify-center w-10 h-10 rounded-lg bg-[#16181d] border border-white/5">
                  <span className={`text-[10px] font-black uppercase ${event.country === 'USD' ? 'text-emerald-400' : event.country === 'EUR' ? 'text-blue-400' : event.country === 'GBP' ? 'text-purple-400' : 'text-zinc-300'}`}>
                    {event.country}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <Clock className="w-3 h-3 text-zinc-500" />
                    <span className="text-[11px] font-mono font-bold text-zinc-300">{event.time}</span>
                    {/* IMPACT BADGE */}
                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${getImpactStyle(event.impact)}`}>
                      {event.impact}
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-zinc-400 line-clamp-1 max-w-[140px] group-hover:text-zinc-200 transition-colors">
                    {event.title}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-[11px] font-mono font-bold text-white mb-0.5">{event.estimate || '-'}</div>
                <div className="text-[9px] font-mono text-zinc-600">Prej: {event.previous || '-'}</div>
              </div>
            </div>
          ))
        ) : (
          <div className="flex-1 flex items-center justify-center text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
            Za ta dan ni pomembnih dogodkov.
          </div>
        )}
      </div>
    </div>
  );
}