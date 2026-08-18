"use client";

import { useState, useEffect } from "react";
import { Shield, Plus, Trash2, Search, X, Loader2, Users } from "lucide-react";
import toast from "react-hot-toast";

type AnggotaLajnah = {
  id: string;
  santriId: string;
  dufahNama: string;
  santri: {
    nama: string;
    sakan: string;
    kamar: string;
  }
};

export default function LajnahPage() {
  const [dufahList, setDufahList] = useState<any[]>([]);
  const [activeDufah, setActiveDufah] = useState("");
  const [lajnahList, setLajnahList] = useState<AnggotaLajnah[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search Santri State
  const [addMode, setAddMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedSantri, setSelectedSantri] = useState<any | null>(null);

  useEffect(() => {
    fetchInit();
  }, []);

  useEffect(() => {
    if (activeDufah) fetchLajnah();
  }, [activeDufah]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchQuery.length >= 2) {
        searchSantri(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const fetchInit = async () => {
    try {
      const [dufahRes, ctxRes] = await Promise.all([
        fetch("/api/admin/dufah"),
        fetch("/api/admin/active-context")
      ]);
      const dufahData = await dufahRes.json();
      const ctxData = await ctxRes.json();

      setDufahList(dufahData);
      
      if (ctxData?.activeDufah) {
        setActiveDufah(ctxData.activeDufah);
      } else if (dufahData.length > 0) {
        setActiveDufah(dufahData[0].nama);
      }
    } catch (e) {
      toast.error("Gagal memuat dufah");
    }
  };

  const fetchLajnah = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/lajnah?dufah=${encodeURIComponent(activeDufah)}`);
      const data = await res.json();
      setLajnahList(data);
    } catch (e) {
      toast.error("Gagal memuat lajnah");
    } finally {
      setIsLoading(false);
    }
  };

  const searchSantri = async (query: string) => {
    setIsSearching(true);
    try {
      const res = await fetch(`/api/admin/lajnah/search-santri?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSearchResults(data);
    } catch (e) {
      toast.error("Gagal mencari santri");
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddSubmit = async () => {
    if (!selectedSantri || !activeDufah) return;
    
    // Optimistic / Loading
    const tempId = `temp-${Date.now()}`;
    setLajnahList(prev => [{
      id: tempId,
      santriId: selectedSantri.id,
      dufahNama: activeDufah,
      santri: {
        nama: selectedSantri.nama,
        sakan: selectedSantri.asrama.split(' - ')[0],
        kamar: selectedSantri.asrama.split(' - ')[1] || ''
      }
    }, ...prev]);
    
    setAddMode(false);
    setSearchQuery("");
    setSelectedSantri(null);
    setSearchResults([]);

    try {
      const res = await fetch("/api/admin/lajnah", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ santriId: selectedSantri.id, dufahNama: activeDufah })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error);
      
      fetchLajnah();
      toast.success("Anggota Lajnah berhasil ditambahkan");
    } catch (e: any) {
      fetchLajnah(); // Revert
      toast.error(e.message || "Gagal menambahkan");
    }
  };

  const handleDelete = async (id: string, santriNama: string) => {
    if (!confirm(`Hapus ${santriNama} dari Lajnah?`)) return;

    setLajnahList(prev => prev.filter(l => l.id !== id));
    toast.success("Lajnah dihapus");
    
    try {
      await fetch(`/api/admin/lajnah/${id}`, { method: "DELETE" });
    } catch (e) {
      toast.error("Gagal menghapus");
      fetchLajnah();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-[var(--color-surface-dark)]">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-500 shadow-sm border border-orange-200">
                <Shield size={20} />
              </div>
              Manajemen Lajnah
            </h1>
            <p className="text-[var(--color-text-muted)] text-sm mt-1">Kelola santri yang ditunjuk sebagai eksekutor Mukholif per Duf'ah.</p>
          </div>
          
          <div className="w-full md:w-auto flex items-center">
             <select 
                value={activeDufah}
                onChange={(e) => setActiveDufah(e.target.value)}
                className="w-full md:w-auto px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 text-slate-700 outline-none hover:border-emerald-300 focus:border-emerald-500 transition-all cursor-pointer"
             >
                <option value="" disabled>Pilih Duf'ah</option>
                {dufahList.map(df => (
                  <option key={df.nama} value={df.nama}>Angkatan: {df.nama}</option>
                ))}
             </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-[var(--color-surface-dark)] relative min-h-[500px]">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-slate-800">Daftar Anggota ({lajnahList.length})</h2>
          <button 
            onClick={() => setAddMode(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-700 transition shadow-md shadow-slate-200"
          >
            <Plus size={16} /> Anggota Baru
          </button>
        </div>

        {addMode && (
          <div className="mb-8 bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">Pilih Santri (Lajnah)</h3>
              <button onClick={() => { setAddMode(false); setSelectedSantri(null); }} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            
            <div className="relative">
              {!selectedSantri ? (
                <>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      autoFocus
                      type="text" 
                      placeholder="Cari nama santri (min. 2 huruf)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-3 border border-slate-200 rounded-xl bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm transition-all shadow-inner"
                    />
                    {isSearching && <Loader2 className="w-4 h-4 text-emerald-500 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />}
                  </div>

                  {searchResults.length > 0 && (
                    <div className="absolute top-12 left-0 right-0 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg z-20 p-2 space-y-1">
                      {searchResults.map((s) => (
                        <div 
                          key={s.id}
                          onClick={() => setSelectedSantri(s)}
                          className="flex items-center justify-between p-3 rounded-lg hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer transition-colors border border-transparent hover:border-emerald-100"
                        >
                          <div>
                            <p className="font-bold text-sm text-slate-800">{s.nama}</p>
                            <p className="text-[10px] text-slate-500">{s.asrama} • {s.kelas}</p>
                          </div>
                          <span className="text-xs font-bold text-emerald-600 border border-emerald-200 bg-emerald-50 px-2 py-0.5 rounded-md">Pilih</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="flex-1 border border-emerald-200 bg-emerald-50/50 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                        <Shield size={20} />
                      </div>
                      <div>
                        <p className="font-black text-slate-800">{selectedSantri.nama}</p>
                        <p className="text-xs text-slate-500 font-medium">{selectedSantri.asrama} • {selectedSantri.kelas}</p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedSantri(null)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition"><X size={16} /></button>
                  </div>
                  <button onClick={handleAddSubmit} className="w-full sm:w-auto px-6 py-4 bg-[var(--color-primary)] text-white rounded-xl font-bold shadow-md hover:opacity-90 active:scale-95 transition-all text-sm shrink-0">
                    Jadikan Lajnah
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="pt-12 pb-24 flex justify-center"><Loader2 className="w-8 h-8 text-[var(--color-primary)] animate-spin" /></div>
        ) : lajnahList.length === 0 ? (
          <div className="pt-12 pb-24 flex flex-col items-center justify-center text-slate-400">
            <Users className="w-12 h-12 mb-3 text-slate-200" />
            <p className="text-sm font-bold">Belum ada anggota Lajnah untuk Duf'ah ini.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lajnahList.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-4 border border-slate-100 hover:border-orange-200 rounded-2xl bg-slate-50 hover:bg-orange-50/10 transition group">
                <div className="w-12 h-12 rounded-full bg-slate-200 group-hover:bg-orange-100 flex items-center justify-center text-slate-400 group-hover:text-orange-500 transition-colors">
                  <Shield className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-slate-800 line-clamp-1 leading-tight mb-0.5">{item.santri.nama}</p>
                  <p className="text-[10px] text-slate-500 font-medium">Asrama: {item.santri.sakan} {item.santri.kamar}</p>
                </div>
                <button 
                  onClick={() => handleDelete(item.id, item.santri.nama)}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl opacity-0 group-hover:opacity-100 transition-all shrink-0"
                  title="Hapus Lajnah"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
