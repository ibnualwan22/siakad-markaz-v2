"use client";

import { useState, useEffect } from "react";
import { Search, Loader2, CheckCircle2, Circle, Clock, ClipboardCheck, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

export default function MonitoringMukholifPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [statusEks, setStatusEks] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    fetchMonitoring();
  }, [statusEks, debouncedQuery]);

  const fetchMonitoring = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/monitoring-mukholif?statusEks=${statusEks}&q=${encodeURIComponent(debouncedQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data);
      }
    } catch (e) {
      toast.error("Gagal memuat monitoring");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-[var(--color-surface-dark)]">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-blue-100 text-blue-500 shadow-sm border border-blue-200">
            <ClipboardCheck size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Monitoring Eksekusi</h1>
            <p className="text-[var(--color-text-muted)] text-sm mt-1">Pantau jalannya pelaksanaan hukuman bahasa oleh Lajnah.</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-[var(--color-surface-dark)] min-h-[500px]">
        <div className="flex flex-col xl:flex-row items-center justify-between gap-4 mb-8 pb-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-slate-800">Kartu Pelanggar Aktif</h2>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama santri..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm font-medium bg-slate-50 text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
            <div className="flex items-center p-1 bg-slate-100/80 rounded-xl border border-slate-200/60 shadow-sm overflow-x-auto custom-scrollbar w-full sm:w-auto shrink-0">
              {['ALL', 'BELUM', 'TUNTAS'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusEks(status)}
                  className={`px-4 py-1.5 min-w-[max-content] text-xs font-bold transition-all rounded-lg ${
                    statusEks === status ? 'bg-white text-slate-700 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {status === 'ALL' ? 'Semua' : status === 'BELUM' ? 'Belum Eksekusi' : 'Tuntas'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="pt-12 pb-24 flex justify-center"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
        ) : records.length === 0 ? (
          <div className="pt-12 pb-24 flex flex-col items-center justify-center text-slate-400">
            <ClipboardCheck className="w-12 h-12 mb-3 text-slate-200" />
            <p className="text-sm font-bold">Tidak ada data pelanggar yang sesuai filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {records.map(p => {
              const hasIqob = p.iqobSounding || p.iqobJawal || p.iqobPenyetoran;
              const allDone = (!p.iqobSounding || p.iqobSoundingDone) && 
                              (!p.iqobJawal || p.iqobJawalDone) && 
                              (!p.iqobPenyetoran || p.iqobPenyetoranDone);
              const isVerified = p.verifikasiAt !== null;

              return (
                <div key={p.id} className="p-4 border border-slate-200 rounded-2xl flex flex-col sm:flex-row gap-4 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <h3 className="font-bold text-slate-800 text-base line-clamp-1">{p.santri?.nama || p.santriNama}</h3>
                        <p className="text-[10px] uppercase font-bold tracking-wide mt-1 text-slate-400">
                          {p.santriAsrama} • {p.santriKelas}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        {!hasIqob ? (
                          <span className="text-[10px] font-bold px-2.5 py-1 bg-slate-200 text-slate-500 rounded-full">Tidak Ada Iqob</span>
                        ) : allDone ? (
                          <span className="text-[10px] font-bold px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full ring-1 ring-emerald-300">Tuntas ✅</span>
                        ) : (
                          <span className="text-[10px] font-bold px-2.5 py-1 bg-rose-100 text-rose-700 rounded-full ring-1 ring-rose-300">Belum Selesai ❌</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-xs text-slate-500 space-y-1 mb-4">
                      <p className="flex items-center gap-1.5"><Clock size={12} className="text-slate-400"/> {new Date(p.laporan.waktuMelanggar).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'})}</p>
                    </div>

                    {hasIqob && (
                      <div className="space-y-2 border-t pt-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Status Eksekusi Lajnah</p>
                        
                        {p.iqobSounding && (
                          <div className="flex items-center gap-2">
                            {p.iqobSoundingDone ? <CheckCircle2 size={16} className="text-emerald-500"/> : <Circle size={16} className="text-slate-300"/>}
                            <span className={`text-sm font-semibold ${p.iqobSoundingDone ? 'text-slate-800' : 'text-slate-500 line-through'}`}>Iqob Sounding</span>
                          </div>
                        )}
                        {p.iqobJawal && (
                          <div className="flex items-center gap-2">
                            {p.iqobJawalDone ? <CheckCircle2 size={16} className="text-emerald-500"/> : <Circle size={16} className="text-slate-300"/>}
                            <span className={`text-sm font-semibold ${p.iqobJawalDone ? 'text-slate-800' : 'text-slate-500 line-through'}`}>Jawal</span>
                          </div>
                        )}
                        {p.iqobPenyetoran && (
                          <div className="flex items-center gap-2">
                            {p.iqobPenyetoranDone ? <CheckCircle2 size={16} className="text-emerald-500"/> : <Circle size={16} className="text-slate-300"/>}
                            <span className={`text-sm font-semibold ${p.iqobPenyetoranDone ? 'text-slate-800' : 'text-slate-500 line-through'}`}>Penyetoran Mukholif</span>
                          </div>
                        )}
                        
                        {p.eksekusiAt && (
                          <p className="text-[10px] italic text-slate-400 mt-2">Dieksekusi pada: {new Date(p.eksekusiAt).toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'})}</p>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {hasIqob && allDone && (
                    <div className="sm:border-l border-emerald-200 bg-emerald-50/50 sm:pl-4 pt-4 sm:pt-0 border-t sm:border-t-0 flex flex-col items-center justify-center shrink-0 p-3 sm:w-[130px] rounded-r-xl">
                       <CheckCircle2 size={24} className="text-emerald-500 mb-1" />
                       <span className="text-[9px] font-bold text-emerald-600 uppercase text-center leading-tight">Terlaksana Oleh Lajnah</span>
                    </div>
                  )}

                  {!hasIqob && (
                    <div className="sm:border-l border-slate-200 bg-slate-100/50 sm:pl-4 pt-4 sm:pt-0 border-t sm:border-t-0 flex flex-col items-center justify-center shrink-0 p-3 sm:w-[130px] rounded-r-xl">
                       <AlertTriangle size={20} className="text-slate-400 mb-1 opacity-50" />
                       <span className="text-[9px] font-bold text-slate-500 uppercase text-center leading-tight">No Action<br/>Required</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
