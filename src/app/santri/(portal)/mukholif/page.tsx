"use client";

import { useState, useEffect, useRef } from "react";
import { AlertTriangle, Plus, X, Upload, Loader2, Calendar, MapPin, MessageSquare, CheckCircle2, FileText } from "lucide-react";
import toast from "react-hot-toast";

type Santri = {
  id: string;
  nama: string;
  kelas: string;
  asrama: string;
};

type Laporan = {
  id: string;
  waktuMelanggar: string;
  tempatMelanggar: string;
  perkataanYgDiucapkan: string;
  status: string;
  createdAt: string;
  pelanggarList: { id: string, santriNama: string }[];
};

export default function MukholifSantriPage() {
  const [laporanList, setLaporanList] = useState<Laporan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [waktuMelanggar, setWaktuMelanggar] = useState("");
  const [tempatMelanggar, setTempatMelanggar] = useState("");
  const [perkataan, setPerkataan] = useState("");
  const [fotoBukti, setFotoBukti] = useState<string | null>(null);
  
  // Autocomplete State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Santri[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPelanggar, setSelectedPelanggar] = useState<Santri[]>([]);
  
  // Debounce ref
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchLaporan();
  }, []);

  const fetchLaporan = async () => {
    try {
      const res = await fetch("/api/santri/mukholif");
      if (res.ok) {
        const data = await res.json();
        setLaporanList(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/santri/mukholif/search-santri?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          // filter out already selected
          const filtered = data.filter((s: Santri) => !selectedPelanggar.some(p => p.id === s.id));
          setSearchResults(filtered);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setIsSearching(false);
      }
    }, 400);
  };

  const selectPelanggar = (santri: Santri) => {
    if (!selectedPelanggar.some(p => p.id === santri.id)) {
      setSelectedPelanggar([...selectedPelanggar, santri]);
    }
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Ukuran foto maksimal 2MB");
        return;
      }
      const reader = newFileReader();
      reader.onloadend = () => {
        setFotoBukti(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const newFileReader = () => new FileReader();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPelanggar.length === 0) {
      toast.error("Pilih minimal 1 nama pelanggar");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/santri/mukholif", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          waktuMelanggar: new Date(waktuMelanggar).toISOString(),
          tempatMelanggar,
          perkataanYgDiucapkan: perkataan,
          fotoBuktiUrl: fotoBukti,
          pelanggarIds: selectedPelanggar.map(p => p.id)
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan laporan");
      
      toast.success("Laporan berhasil dibuat");
      
      // Reset form
      setWaktuMelanggar("");
      setTempatMelanggar("");
      setPerkataan("");
      setFotoBukti(null);
      setSelectedPelanggar([]);
      
      fetchLaporan();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "var(--color-primary)" }}>
            <AlertTriangle className="h-7 w-7" />
            Lapor Mukholif Lughoh
          </h1>
          <p className="text-xs text-gray-500 mt-1">Catat santri yang melanggar disiplin kebahasaan.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="neu-button flex items-center gap-2 px-4 py-2 font-bold text-sm bg-[var(--color-primary)] text-white rounded-xl shadow-lg shadow-emerald-500/30 hover:scale-105 active:scale-95 transition-all"
        >
          {showForm ? <X size={18} /> : <Plus size={18} />}
          <span className="hidden sm:inline">{showForm ? "Tutup Form" : "Buat Laporan Baru"}</span>
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 ring-4 ring-[var(--color-primary-50)]">
          <div className="flex items-center gap-2 mb-6 border-b pb-4">
            <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
              <AlertTriangle size={18} strokeWidth={2.5} />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Form Pencatatan</h2>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Pilih Pelanggar */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Nama Pelanggar *</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ketik nama santri (min 2 huruf)..."
                  value={searchQuery}
                  onChange={handleSearch}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all outline-none text-sm"
                />
                {isSearching && (
                  <Loader2 className="absolute right-4 top-3.5 h-5 w-5 animate-spin text-gray-400" />
                )}
                
                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                    {searchResults.map(santri => (
                      <button
                        type="button"
                        key={santri.id}
                        onClick={() => selectPelanggar(santri)}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-gray-50 last:border-0 flex justify-between items-center group"
                      >
                        <div>
                          <p className="font-bold text-sm text-slate-800 group-hover:text-[var(--color-primary)] transition-colors">{santri.nama}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{santri.kelas} • {santri.asrama}</p>
                        </div>
                        <Plus className="h-5 w-5 text-gray-300 group-hover:text-[var(--color-primary)]" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Selected Pelanggar Tags */}
              {selectedPelanggar.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {selectedPelanggar.map(p => (
                    <div key={p.id} className="bg-red-50 text-red-700 border border-red-100 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm">
                      <span className="font-bold">{p.nama}</span>
                      <button type="button" onClick={() => setSelectedPelanggar(prev => prev.filter(x => x.id !== p.id))}>
                        <X size={14} className="hover:text-red-900" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Waktu */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Tanggal & Waktu Kejadian *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Calendar size={18} className="text-gray-400" />
                  </div>
                  <input
                    type="datetime-local"
                    required
                    value={waktuMelanggar}
                    onChange={e => setWaktuMelanggar(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none text-sm font-medium text-slate-700"
                  />
                </div>
              </div>

              {/* Tempat */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Tempat Melanggar *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <MapPin size={18} className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Depan Mat'am"
                    value={tempatMelanggar}
                    onChange={e => setTempatMelanggar(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none text-sm placeholder-gray-300"
                  />
                </div>
              </div>
            </div>

            {/* Perkataan */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Perkataan yang diucapkan *</label>
              <div className="relative">
                <div className="absolute top-3.5 left-4 pointer-events-none">
                  <MessageSquare size={18} className="text-gray-400" />
                </div>
                <textarea
                  required
                  rows={3}
                  placeholder="Tuliskan ucapan bahasa Indonesia atau daerah yang diucapkan..."
                  value={perkataan}
                  onChange={e => setPerkataan(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none text-sm placeholder-gray-300 resize-none"
                />
              </div>
            </div>

            {/* Foto Bukti */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Foto Barang Bukti / Kondisi (Opsional)</label>
              <label className="flex items-center justify-center w-full h-32 px-4 transition bg-white border-2 border-gray-300 border-dashed rounded-xl appearance-none cursor-pointer hover:border-gray-400 focus:outline-none">
                {fotoBukti ? (
                  <div className="relative w-full h-full flex justify-center items-center">
                    <img src={fotoBukti} alt="Preview" className="h-full object-contain rounded-lg" />
                    <div className="absolute top-2 right-2 bg-white/90 p-1.5 rounded-lg shadow-sm backdrop-blur-sm text-xs font-bold text-slate-700">Preview</div>
                  </div>
                ) : (
                  <span className="flex items-center space-x-2">
                    <Upload className="w-6 h-6 text-gray-400" />
                    <span className="font-medium text-gray-500 text-sm">
                      Tap untuk upload foto
                    </span>
                  </span>
                )}
                <input type="file" name="file_upload" className="hidden" accept="image/*" onChange={handleFileChange} />
              </label>
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => setShowForm(false)}
                className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm bg-[var(--color-primary)] text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
                Kirim Laporan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Histori Laporan */}
      {!showForm && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mt-6">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2 border-b pb-4">
            <Calendar size={20} className="text-[var(--color-primary)]" />
            Riwayat Laporan Anda
          </h2>

          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
            </div>
          ) : laporanList.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <FileText className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-500 font-medium">Anda belum mencatat laporan apapun.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {laporanList.map((laporan) => (
                <div key={laporan.id} className="p-4 sm:p-5 rounded-2xl border border-gray-100 hover:shadow-md transition-shadow group flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${laporan.status === 'SELESAI' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                        {laporan.status === 'SELESAI' ? 'Selesai (Sudah Tabayun)' : 'Menunggu Tabayun'}
                      </span>
                      <span className="text-xs text-gray-400 font-medium">
                        {new Date(laporan.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                    
                    <p className="text-sm font-bold text-slate-800 line-clamp-1">"{laporan.perkataanYgDiucapkan}"</p>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                      <MapPin size={12} /> {laporan.tempatMelanggar}
                    </p>
                  </div>
                  
                  <div className="bg-slate-50 px-3 py-2 rounded-xl text-xs sm:text-right flex-shrink-0">
                    <p className="text-gray-400 font-medium mb-1">Pelanggar:</p>
                    <div className="font-bold text-slate-700">
                      {laporan.pelanggarList.map(p => p.santriNama).join(", ")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
