"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { 
  Check, 
  X, 
  Trash2, 
  Users, 
  Loader2, 
  ShieldCheck, 
  Mail, 
  ArrowLeft 
} from "lucide-react";
import { toast } from "sonner";

// TVOJ EMAIL - Samo ta email ima dostop do te strani
const ADMIN_EMAIL = "skolnik.dejan40@gmail.com";

type Profile = {
  id: string;
  email: string;
  is_approved: boolean;
  role: string;
};

export default function AdminPanel() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      // Preveri, če je uporabnik prijavljen in če je to tvoj email
      if (!user || user.email !== ADMIN_EMAIL) {
        toast.error("Nimate dovoljenja za dostop.");
        router.push("/");
        return;
      }

      setIsAdmin(true);
      await fetchProfiles();
      setLoading(false);
    };

    checkAdmin();
  }, [router]);

  // Naloži vse uporabnike iz tabele profiles
  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("is_approved", { ascending: true });

    if (error) {
      toast.error("Napaka pri nalaganju profilov.");
    } else {
      setProfiles(data || []);
    }
  };

  // Funkcija za potrditev ali preklic dostopa
  const toggleApproval = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("profiles")
      .update({ is_approved: !currentStatus })
      .eq("id", id);

    if (error) {
      toast.error("Napaka pri posodabljanju statusa.");
    } else {
      toast.success(currentStatus ? "Dostop preklican" : "Uporabnik potrjen!");
      fetchProfiles();
    }
  };

  // Funkcija za brisanje profila
  const deleteProfile = async (id: string) => {
    if (!confirm("Ali si prepričan, da želiš izbrisati tega uporabnika?")) return;

    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Napaka pri brisanju.");
    } else {
      toast.success("Uporabnik izbrisan.");
      fetchProfiles();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <main className="min-h-screen bg-black text-white p-6 md:p-12 pt-32 selection:bg-emerald-500/30">
      {/* OZADJE */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-zinc-900/40 via-black to-black pointer-events-none" />
      
      <div className="relative max-w-5xl mx-auto z-10">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 border-b border-zinc-800 pb-8">
            <div>
                <button 
                  onClick={() => router.push("/")}
                  className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest mb-4"
                >
                  <ArrowLeft className="w-4 h-4" /> Nazaj na domov
                </button>
                <h1 className="text-4xl font-black uppercase tracking-tighter flex items-center gap-3">
                    <ShieldCheck className="w-10 h-10 text-emerald-500" /> Admin Panel
                </h1>
                <p className="text-zinc-500 text-sm mt-1">Upravljanje uporabnikov in dostopov do sistema.</p>
            </div>
            <div className="bg-zinc-900/50 backdrop-blur-sm px-4 py-3 rounded-2xl border border-zinc-800 flex items-center gap-3">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs font-bold text-zinc-400">Admin: {ADMIN_EMAIL}</span>
            </div>
        </div>

        {/* LIST OF USERS */}
        <div className="grid gap-4">
          {profiles.length === 0 ? (
            <div className="text-center py-24 bg-zinc-900/20 rounded-[2.5rem] border border-zinc-900/50 backdrop-blur-sm">
                <Users className="w-16 h-16 text-zinc-800 mx-auto mb-4" />
                <h3 className="text-zinc-400 font-bold uppercase tracking-widest text-sm">Ni registriranih uporabnikov</h3>
            </div>
          ) : (
            profiles.map((profile) => (
              <div 
                key={profile.id} 
                className="group bg-zinc-900/40 border border-zinc-800/60 backdrop-blur-sm rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 transition-all hover:border-zinc-700 hover:bg-zinc-900/60 shadow-xl"
              >
                <div className="flex items-center gap-5 flex-1 w-full">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all ${
                      profile.is_approved 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                    }`}>
                        <Mail className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-lg font-bold text-white truncate">{profile.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${
                            profile.is_approved 
                            ? 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5' 
                            : 'text-amber-500 border-amber-500/20 bg-amber-500/5'
                          }`}>
                              {profile.is_approved ? 'Potrjen' : 'Čaka na potrditev'}
                          </span>
                          <span className="text-[10px] text-zinc-600 font-mono">ID: {profile.id.slice(0, 8)}...</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
                    <button 
                        onClick={() => toggleApproval(profile.id, profile.is_approved)}
                        className={`flex-1 md:flex-none px-8 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.1em] transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95 ${
                            profile.is_approved 
                            ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 border border-zinc-700' 
                            : 'bg-emerald-500 text-black hover:bg-emerald-400 shadow-emerald-500/20'
                        }`}
                    >
                        {profile.is_approved ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                        {profile.is_approved ? 'Prekliči' : 'Potrdi dostop'}
                    </button>

                    <button 
                        onClick={() => deleteProfile(profile.id)}
                        className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 text-zinc-600 hover:text-rose-500 hover:border-rose-500/30 transition-all shadow-lg active:scale-95"
                        title="Izbriši profil"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>
              </div>
            ))
          )}
        </div>

        <footer className="mt-20 pt-8 border-t border-zinc-900 text-center">
            <p className="text-[10px] text-zinc-700 font-bold uppercase tracking-[0.3em]">
                &copy; {new Date().getFullYear()} DD Tips Admin Security
            </p>
        </footer>
      </div>
    </main>
  );
}