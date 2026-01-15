"use client";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function PendingPage() {
  const router = useRouter();

  const checkStatus = async () => {
     const { data: { user } } = await supabase.auth.getUser();
     if(!user) return;
     
     const { data } = await supabase.from('profiles').select('is_approved').eq('id', user.id).single();
     if (data?.is_approved) {
        router.push('/'); // Če je potrjen, ga vrži nazaj na dashboard
     } else {
        alert("Račun še vedno čaka na potrditev.");
     }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 text-center">
      <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-6 border border-zinc-800">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
      <h1 className="text-2xl font-bold mb-2">Račun čaka na potrditev</h1>
      <p className="text-zinc-400 max-w-md mb-8">
        Hvala za registracijo. Administrator mora ročno potrditi tvoj dostop. 
        Prejel boš obvestilo (ali pa poskusi znova kasneje).
      </p>
      
      <div className="flex gap-4">
          <button onClick={checkStatus} className="px-6 py-2 bg-emerald-500 text-black font-bold rounded-lg hover:bg-emerald-400">
            Preveri status
          </button>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="px-6 py-2 bg-zinc-800 text-white font-bold rounded-lg hover:bg-zinc-700">
            Odjava
          </button>
      </div>
    </div>
  );
}