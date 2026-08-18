"use client";

import { useState, useEffect } from "react";
import { Eye, Plus, Trash2, Search, X, Loader2, Users, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";

type AnggotaJasus = {
  id: string;
  santriId: string;
  dufahNama: string;
  santri: { nama: string; sakan: string; kamar: string; }
};

export default function JasusPage() {
  const [dufahList, setDufahList] = useState<any[]>([]);
  const [activeDufah, setActiveDufah] = useState("");
  const [jasusList, setJasusList] = useState<AnggotaJasus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Multi-select search
  const [addMode, setAddMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedSantriList, setSelectedSantriList] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { fetchInit(); }, []);
  useEffect(() => { if (activeDufah) fetchJasus(); }, [activeDufah]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchQuery.length >= 2) searchSantri(searchQuery);
      else setSearchResults([]);
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
      if (ctxData?.activeDufah) setActiveDufah(ctxData.activeDufah);
      else if (dufahData.length > 0) setActiveDufah(dufahData[0].nama);
    } catch (e) { toast.error("Gagal memuat dufah"); }
  };

  const fetchJasus = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/jasus?dufah=${encodeURIComponent(activeDufah)}`);
      const data = await res.json();
      setJasusList(data);
    } catch (e) { toast.error("Gagal memuat jasus"); }
    finally { setIsLoading(false); }
  };

  const searchSantri = async (query: string) => {
    setIsSearching(true);
    try {
      const res = await fetch(`/api/admin/lajnah/search-santri?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSearchResults(data);
    } catch (e) { toast.error("Gagal mencari santri"); }
    finally { setIsSearching(false); }
  };

  const toggleSelect = (santri: any) => {
    setSelectedSantriList(prev => {
      const exists = prev.find(s => s.id === santri.id);
      if (exists) return prev.filter(s => s.id !== santri.id);
      return [...prev, santri];
    });
  };

  const isAlreadyJasus = (santriId: string) => jasusList.some(j => j.santriId === santriId);
  const isSelected = (santriId: string) => selectedSantriList.some(s => s.id === santriId);

  const handleBulkSubmit = async () => {
    if (selectedSantriList.length === 0 || !activeDufah) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/jasus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ santriIds: selectedSantriList.map(s => s.id), dufahNama: activeDufah })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`${data.added} Jasus berhasil ditambahkan!`);
      setAddMode(false); setSearchQuery(""); setSelectedSantriList([]); setSearchResults([]);
      fetchJasus();
    } catch (e: any) {
      toast.error(e.message || "Gagal menambahkan");
    } finally { setIsSubmitting(false); }
  };

  const handleDelete = async (id: string, nama: string) => {
    if (!confirm(`Hapus ${nama} dari Jasus?`)) return;
    setJasusList(prev => prev.filter(j => j.id !== id));
    try {
      await fetch(`/api/admin/jasus/${id}`, { method: "DELETE" });
      toast.success("Jasus dihapus");
    } catch (e) { toast.error("Gagal menghapus"); fetchJasus(); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-[var(--color-surface-dark)]">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-500 shadow-sm border border-indigo-200">
                <Eye size={20} />
              </div>
              Manajemen Jasus
            </h1>
            <p className="text-[var(--color-text-muted)] text-sm mt-1">Kelola santri yang bertugas memata-matai dan melaporkan pelanggaran bahasa per Duf'ah.</p>
          </div>
          <div className="w-full md:w-auto flex items-center">
            <select value={activeDufah} onChange={(e) => setActiveDufah(e.target.value)}
              className="w-full md:w-auto px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 text-slate-700 outline-none hover:border-indigo-300 focus:border-indigo-500 transition-all cursor-pointer">
              <option value="" disabled>Pilih Duf'ah</option>
              {dufahList.map(df => <option key={df.nama} value={df.nama}>Angkatan: {df.nama}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-[var(--color-surface-dark)] relative min-h-[500px]">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-slate-800">Daftar Jasus ({jasusList.length})</h2>
          <button onClick={() => { setAddMode(true); setSelectedSantriList([]); }}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-700 transition shadow-md shadow-slate-200">
            <Plus size={16} /> Tambah Jasus
          </button>
        </div>

        {addMode && (
          <div className="mb-8 bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">Cari & Pilih Santri (Bisa Banyak Sekaligus)</h3>
              <button onClick={() => { setAddMode(false); setSelectedSantriList([]); setSearchQuery(""); setSearchResults([]); }} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            
            <div className="relative">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input autoFocus type="text" placeholder="Cari nama santri (min. 2 huruf)..."
                  value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-3 border border-slate-200 rounded-xl bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm transition-all shadow-inner" />
                {isSearching && <Loader2 className="w-4 h-4 text-indigo-500 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />}
              </div>

              {searchResults.length > 0 && (
                <div className="mt-2 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg p-2 space-y-1">
                  {searchResults.map((s) => {
                    const alreadyExists = isAlreadyJasus(s.id);
                    const selected = isSelected(s.id);
                    return (
                      <div key={s.id} onClick={() => !alreadyExists && toggleSelect(s)}
                        className={`flex items-center justify-between p-3 rounded-lg transition-colors border ${
                          alreadyExists ? 'opacity-40 cursor-not-allowed border-transparent bg-slate-50' :
                          selected ? 'bg-indigo-50 border-indigo-200 cursor-pointer' :
                          'border-transparent hover:bg-indigo-50 hover:border-indigo-100 cursor-pointer'
                        }`}>
                        <div>
                          <p className="font-bold text-sm text-slate-800">{s.nama}</p>
                          <p className="text-[10px] text-slate-500">{s.asrama} • {s.kelas}</p>
                        </div>
                        {alreadyExists ? (
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-200 px-2 py-0.5 rounded-md">Sudah Jasus</span>
                        ) : selected ? (
                          <CheckCircle2 size={18} className="text-indigo-600" />
                        ) : (
                          <span className="text-xs font-bold text-indigo-600 border border-indigo-200 bg-indigo-50 px-2 py-0.5 rounded-md">Pilih</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedSantriList.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <p className="text-xs font-bold text-slate-500 mb-3 uppercase">Dipilih ({selectedSantriList.length} orang):</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedSantriList.map(s => (
                    <div key={s.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-200">
                      {s.nama}
                      <button onClick={() => toggleSelect(s)} className="hover:text-rose-500 transition"><X size={12} /></button>
                    </div>
                  ))}
                </div>
                <button onClick={handleBulkSubmit} disabled={isSubmitting}
                  className="w-full sm:w-auto px-6 py-3 bg-[var(--color-primary)] text-white rounded-xl font-bold shadow-md hover:opacity-90 active:scale-95 transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                  {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  Jadikan {selectedSantriList.length} orang sebagai Jasus
                </button>
              </div>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="pt-12 pb-24 flex justify-center"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>
        ) : jasusList.length === 0 ? (
          <div className="pt-12 pb-24 flex flex-col items-center justify-center text-slate-400">
            <Users className="w-12 h-12 mb-3 text-slate-200" />
            <p className="text-sm font-bold">Belum ada Jasus untuk Duf'ah ini.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {jasusList.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-4 border border-slate-100 hover:border-indigo-200 rounded-2xl bg-slate-50 hover:bg-indigo-50/10 transition group">
                <div className="w-12 h-12 rounded-full bg-slate-200 group-hover:bg-indigo-100 flex items-center justify-center text-slate-400 group-hover:text-indigo-500 transition-colors">
                  <Eye className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-slate-800 line-clamp-1 leading-tight mb-0.5">{item.santri.nama}</p>
                  <p className="text-[10px] text-slate-500 font-medium">Asrama: {item.santri.sakan} {item.santri.kamar}</p>
                </div>
                <button onClick={() => handleDelete(item.id, item.santri.nama)}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl opacity-0 group-hover:opacity-100 transition-all shrink-0" title="Hapus Jasus">
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
