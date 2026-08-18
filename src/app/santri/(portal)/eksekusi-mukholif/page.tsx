"use client";

import { useState, useEffect } from "react";
import { Loader2, Shield, AlertTriangle, CheckSquare, Square, Clock } from "lucide-react";
import toast from "react-hot-toast";

export default function EksekusiIqobPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/santri/eksekusi-mukholif");
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch (e) {
      toast.error("Gagal memuat tugas iqob");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEksekusi = async (pelanggarId: string, iqobType: string) => {
    if (!confirm("Konfirmasi eksekusi iqob ini?")) return;
    
    setIsSubmitting(`${pelanggarId}-${iqobType}`);
    try {
      const res = await fetch("/api/santri/eksekusi-mukholif", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pelanggarId, iqobType })
      });
      if (res.ok) {
        toast.success("Iqob berhasil dieksekusi!");
        fetchTasks();
      } else {
        toast.error("Gagal mengeksekusi");
      }
    } catch (e) {
      toast.error("Gagal mengeksekusi");
    } finally {
      setIsSubmitting(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-[var(--color-surface-dark)]">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-orange-100 text-orange-500 shadow-sm border border-orange-200">
            <Shield size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Tugas Lajnah</h1>
            <p className="text-[var(--color-text-muted)] text-sm mt-1">Daftar pelanggar yang belum tuntas menjalani hukuman (iqob) bahasanya.</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-[var(--color-surface-dark)] min-h-[400px]">
        {isLoading ? (
          <div className="pt-12 pb-24 flex justify-center"><Loader2 className="w-8 h-8 text-orange-500 animate-spin" /></div>
        ) : tasks.length === 0 ? (
          <div className="pt-12 pb-24 flex flex-col items-center justify-center text-slate-400">
            <Shield className="w-12 h-12 mb-3 text-slate-200" />
            <p className="text-sm font-bold">Semua eksekusi iqob telah tuntas. Santai sejenak! 🌴</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tasks.map(t => (
              <div key={t.id} className="p-4 border border-slate-200 rounded-2xl bg-slate-50 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-gradient-to-bl from-orange-100 to-transparent w-16 h-16 rounded-bl-3xl opacity-50 pointer-events-none"></div>
                
                <div className="flex items-start justify-between mb-2 relative z-10">
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">{t.santriNama}</h3>
                    <p className="text-[10px] uppercase font-bold tracking-wide text-slate-500">
                      {t.santriAsrama} • {t.santriKelas}
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-500 shrink-0">
                    <AlertTriangle size={14} />
                  </div>
                </div>

                <div className="text-xs text-slate-500 mb-4 border-b border-slate-200/60 pb-3 flex flex-col gap-1.5 relative z-10">
                  <p className="flex items-center gap-1.5"><Clock size={12}/> Dilaporkan: {new Date(t.laporan.waktuMelanggar).toLocaleDateString('id-ID')}</p>
                </div>

                <div className="space-y-2 relative z-10">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Iqob yang harus Dieksekusi:</p>
                  
                  {t.iqobSounding && !t.iqobSoundingDone && (
                    <button 
                      onClick={() => handleEksekusi(t.id, 'SOUNDING')}
                      disabled={isSubmitting !== null}
                      className="w-full flex items-center justify-between p-3 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 rounded-xl transition text-left group"
                    >
                      <span className="text-sm font-semibold text-slate-700 group-hover:text-emerald-700">Sounding Bahasa</span>
                      {isSubmitting === `${t.id}-SOUNDING` ? <Loader2 size={18} className="animate-spin text-emerald-500" /> : <Square size={18} className="text-slate-300 group-hover:text-emerald-500" />}
                    </button>
                  )}
                  {t.iqobJawal && !t.iqobJawalDone && (
                    <button 
                      onClick={() => handleEksekusi(t.id, 'JAWAL')}
                      disabled={isSubmitting !== null}
                      className="w-full flex items-center justify-between p-3 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 rounded-xl transition text-left group"
                    >
                      <span className="text-sm font-semibold text-slate-700 group-hover:text-emerald-700">Pencabutan Jawal</span>
                      {isSubmitting === `${t.id}-JAWAL` ? <Loader2 size={18} className="animate-spin text-emerald-500" /> : <Square size={18} className="text-slate-300 group-hover:text-emerald-500" />}
                    </button>
                  )}
                  {t.iqobPenyetoran && !t.iqobPenyetoranDone && (
                    <button 
                      onClick={() => handleEksekusi(t.id, 'PENYETORAN')}
                      disabled={isSubmitting !== null}
                      className="w-full flex items-center justify-between p-3 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 rounded-xl transition text-left group"
                    >
                      <span className="text-sm font-semibold text-slate-700 group-hover:text-emerald-700">Penyetoran Mufrodat</span>
                      {isSubmitting === `${t.id}-PENYETORAN` ? <Loader2 size={18} className="animate-spin text-emerald-500" /> : <Square size={18} className="text-slate-300 group-hover:text-emerald-500" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
