"use client";

import { useState, useEffect, useRef } from "react";
import { AlertTriangle, Plus, X, Loader2, Calendar, MapPin, MessageSquare, CheckCircle2, FileText, Trash2, Users } from "lucide-react";
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
  jasusNama?: string;
  pelanggarList: { id: string, santriNama: string }[];
};

type FormPayload = {
  id: number;
  tanggalKejadian: string;
  jamKejadian: string;
  menitKejadian: string;
  tempatMelanggar: string;
  perkataan: string;
  detailKejadian: string;
  selectedPelanggar: Santri[];
  pelaporKustomId: string;
  pelaporKustomNama: string;
};

const defaultInitialPayload = (): FormPayload => ({
  id: Date.now() + Math.random(),
  tanggalKejadian: "",
  jamKejadian: "12",
  menitKejadian: "00",
  tempatMelanggar: "",
  perkataan: "",
  detailKejadian: "",
  selectedPelanggar: [],
  pelaporKustomId: "",
  pelaporKustomNama: ""
});

function ReportFormBlock({ 
  index, data, isLajnah, onUpdate, onRemove, canRemove 
}: { 
  index: number; data: FormPayload; isLajnah: boolean; 
  onUpdate: (id: number, field: string, value: any) => void;
  onRemove: (id: number) => void;
  canRemove: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Santri[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const [pelaporSearchQuery, setPelaporSearchQuery] = useState("");
  const [pelaporSearchResults, setPelaporSearchResults] = useState<Santri[]>([]);
  const [isPelaporSearching, setIsPelaporSearching] = useState(false);
  const pelaporSearchTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (q.length < 2) { setSearchResults([]); return; }
    
    setIsSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/santri/mukholif/search-santri?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const fetched = await res.json();
          const filtered = fetched.filter((s: Santri) => !data.selectedPelanggar.some(p => p.id === s.id));
          setSearchResults(filtered);
        }
      } catch (err) {} finally { setIsSearching(false); }
    }, 400);
  };

  const handlePelaporSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setPelaporSearchQuery(q);
    if (pelaporSearchTimeout.current) clearTimeout(pelaporSearchTimeout.current);
    if (q.length < 2) { setPelaporSearchResults([]); return; }
    
    setIsPelaporSearching(true);
    pelaporSearchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/santri/mukholif/search-santri?q=${encodeURIComponent(q)}`);
        if (res.ok) { setPelaporSearchResults(await res.json()); }
      } catch (err) {} finally { setIsPelaporSearching(false); }
    }, 400);
  };

  return (
    <div className="bg-white border ring-1 ring-slate-100 rounded-2xl p-5 sm:p-6 mb-6 shadow-sm relative animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex justify-between items-center mb-6 pb-3 border-b border-slate-100">
        <h3 className="font-bold text-slate-700 flex items-center gap-2">
           <span className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs">{index + 1}</span>
           Detil Laporan Lughoh
        </h3>
        {canRemove && (
           <button type="button" onClick={() => onRemove(data.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors flex gap-1.5 items-center text-xs font-bold">
              <Trash2 size={16} /> <span className="hidden sm:inline">Hapus Form</span>
           </button>
        )}
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Nama Pelanggar *</label>
          <div className="relative">
            <input type="text" placeholder="Ketik nama santri/pelanggar (min 2 huruf)..." value={searchQuery} onChange={handleSearch}
                   className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm" />
            {isSearching && <Loader2 className="absolute right-4 top-3.5 h-5 w-5 animate-spin text-gray-400" />}
            {searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                {searchResults.map(santri => (
                  <button type="button" key={santri.id} 
                     onClick={() => { onUpdate(data.id, 'selectedPelanggar', [...data.selectedPelanggar, santri]); setSearchQuery(""); setSearchResults([]); }}
                     className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-gray-50 flex justify-between items-center group">
                    <div>
                      <p className="font-bold text-sm text-slate-800 group-hover:text-emerald-600 transition-colors">{santri.nama}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{santri.kelas} • {santri.asrama}</p>
                    </div>
                    <Plus className="h-5 w-5 text-gray-300 group-hover:text-emerald-600" />
                  </button>
                ))}
              </div>
            )}
          </div>
          {data.selectedPelanggar.length > 0 && (
             <div className="flex flex-wrap gap-2 mt-3">
               {data.selectedPelanggar.map(p => (
                 <div key={p.id} className="bg-red-50 text-red-700 border border-red-100 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm">
                   <span className="font-bold">{p.nama}</span>
                   <button type="button" onClick={() => onUpdate(data.id, 'selectedPelanggar', data.selectedPelanggar.filter(x => x.id !== p.id))}>
                     <X size={14} className="hover:text-red-900" />
                   </button>
                 </div>
               ))}
             </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Tanggal & Waktu Kejadian *</label>
            <div className="flex gap-2 relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Calendar size={18} className="text-gray-400" />
              </div>
              <input type="date" required value={data.tanggalKejadian} onChange={e => onUpdate(data.id, 'tanggalKejadian', e.target.value)}
                     className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium text-slate-700" />
              <div className="flex items-center gap-1 shrink-0">
                <select value={data.jamKejadian} onChange={e => onUpdate(data.id, 'jamKejadian', e.target.value)}
                        className="w-[70px] px-2 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold text-center appearance-none bg-slate-50 cursor-pointer text-slate-700">
                  {Array.from({length: 24}).map((_, i) => <option key={i} value={i.toString().padStart(2, '0')}>{i.toString().padStart(2, '0')}</option>)}
                </select>
                <span className="font-bold text-slate-400">:</span>
                <select value={data.menitKejadian} onChange={e => onUpdate(data.id, 'menitKejadian', e.target.value)}
                        className="w-[70px] px-2 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold text-center appearance-none bg-slate-50 cursor-pointer text-slate-700">
                  {Array.from({length: 60}).map((_, i) => <option key={i} value={i.toString().padStart(2, '0')}>{i.toString().padStart(2, '0')}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Tempat Melanggar *</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><MapPin size={18} className="text-gray-400" /></div>
              <input type="text" required placeholder="Contoh: Depan Mat'am" value={data.tempatMelanggar} onChange={e => onUpdate(data.id, 'tempatMelanggar', e.target.value)}
                     className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm" />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Perkataan yang diucapkan *</label>
          <div className="relative">
            <div className="absolute top-3.5 left-4 pointer-events-none"><MessageSquare size={18} className="text-gray-400" /></div>
            <textarea required rows={2} placeholder="Tuliskan ucapan (bahasa Indonesia/daerah) yang diucapkan pelanggar..." value={data.perkataan} onChange={e => onUpdate(data.id, 'perkataan', e.target.value)}
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm resize-none" />
          </div>
        </div>

        <div>
           <label className="block text-sm font-bold text-slate-700 mb-2">Detail Keterangan Kejadian</label>
           <div className="relative">
             <div className="absolute top-3.5 left-4 pointer-events-none"><FileText size={18} className="text-gray-400" /></div>
             <textarea required rows={3} placeholder="Ceritakan detail kejadian secara kronologis..." value={data.detailKejadian} onChange={e => onUpdate(data.id, 'detailKejadian', e.target.value)}
                       className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm resize-none" />
           </div>
        </div>

        {isLajnah && (
           <div className="pt-4 border-t border-slate-100 pb-2">
             <label className="block text-sm font-bold text-slate-700 flex items-center gap-2 mb-2">
                <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md text-[10px] uppercase font-black tracking-wider">Khusus Lajnah</span>
                Mewakili Laporan Dari Siapa?
             </label>
             <p className="text-xs text-slate-400 mb-3 leading-relaxed">Kolom ini <b>WAJIB dikosongkan</b> jika Anda melapor langsung apa yang Anda dengar. Namun wajib diisi nama Jasus (pelapor asli) jika Anda membantu menuliskan laporan jasus lain yang tidak membawa HP.</p>
             
             {data.pelaporKustomId ? (
                <div className="flex items-center gap-2 mt-2">
                   <div className="bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl flex items-center gap-3 w-full max-w-sm">
                      <Users size={16} className="text-emerald-500 shrink-0" />
                      <div className="flex-1">
                         <p className="text-xs text-emerald-600 font-bold uppercase mb-0.5 tracking-wider">Jasus Asli (Telah Dipilih)</p>
                         <p className="text-sm font-bold text-slate-700 line-clamp-1">{data.pelaporKustomNama}</p>
                      </div>
                   </div>
                   <button type="button" onClick={() => { onUpdate(data.id, 'pelaporKustomId', ''); onUpdate(data.id, 'pelaporKustomNama', ''); }}
                       className="p-3 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-transparent hover:border-rose-200 transition">
                      <X size={18} />
                   </button>
                </div>
             ) : (
                <div className="relative max-w-sm">
                  <input type="text" placeholder="Ketik nama Jasus asli di sini..." value={pelaporSearchQuery} onChange={handlePelaporSearch}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-slate-50" />
                  {isPelaporSearching && <Loader2 className="absolute right-4 top-3.5 h-5 w-5 animate-spin text-gray-400" />}
                  {pelaporSearchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                      {pelaporSearchResults.map(santri => (
                        <button type="button" key={santri.id} 
                          onClick={() => { 
                             onUpdate(data.id, 'pelaporKustomId', santri.id); 
                             onUpdate(data.id, 'pelaporKustomNama', santri.nama); 
                             setPelaporSearchQuery(""); setPelaporSearchResults([]); 
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-gray-50 flex justify-between items-center group">
                            <div>
                               <p className="font-bold text-sm text-slate-800 group-hover:text-emerald-600 transition-colors">{santri.nama}</p>
                               <p className="text-xs text-gray-400 mt-0.5">{santri.kelas}{santri.asrama ? ` • ${santri.asrama}` : ''}</p>
                            </div>
                            <CheckCircle2 size={16} className="text-gray-300 group-hover:text-emerald-500" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
             )}
           </div>
        )}
      </div>
    </div>
  );
}

export default function MukholifSantriPage() {
  const [laporanList, setLaporanList] = useState<Laporan[]>([]);
  const [isLajnah, setIsLajnah] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  const [forms, setForms] = useState<FormPayload[]>([defaultInitialPayload()]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchLaporan();
  }, []);

  const fetchLaporan = async () => {
    try {
      const res = await fetch("/api/santri/mukholif");
      if (res.ok) {
        const data = await res.json();
        setLaporanList(data.laporanList || []);
        setIsLajnah(data.isLajnah || false);
      }
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateForm = (id: number, field: string, value: any) => {
    setForms(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const handleRemoveForm = (id: number) => {
    if (forms.length <= 1) return;
    setForms(forms.filter(f => f.id !== id));
  };

  const handleAddForm = () => {
    const lastForm = forms[forms.length - 1];
    setForms([...forms, { 
      ...defaultInitialPayload(),
      tanggalKejadian: lastForm.tanggalKejadian,
      jamKejadian: lastForm.jamKejadian,
      menitKejadian: lastForm.menitKejadian,
      tempatMelanggar: lastForm.tempatMelanggar,
    }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validasi Global
    for (let i = 0; i < forms.length; i++) {
        const f = forms[i];
        if (f.selectedPelanggar.length === 0) {
            toast.error(`Form ke-${i+1} : Pilih minimal 1 nama pelanggar`);
            return;
        }
        if (!f.tanggalKejadian || !f.jamKejadian || !f.menitKejadian) {
            toast.error(`Form ke-${i+1} : Waktu kejadian wajib diisi lengkap`);
            return;
        }
    }
    
    const payloadLaporan = forms.map(f => ({
       waktuMelanggar: new Date(`${f.tanggalKejadian}T${f.jamKejadian}:${f.menitKejadian}:00`).toISOString(),
       tempatMelanggar: f.tempatMelanggar,
       perkataanYgDiucapkan: f.perkataan,
       detailKejadian: f.detailKejadian,
       pelanggarIds: f.selectedPelanggar.map(p => p.id),
       pelaporKustomId: f.pelaporKustomId || undefined,
       pelaporKustomNama: f.pelaporKustomNama || undefined
    }));

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/santri/mukholif", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ laporan: payloadLaporan })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan laporan");
      
      toast.success(`${data.count} Laporan berhasil dibuat sekaligus`);
      
      setForms([defaultInitialPayload()]);
      setShowForm(false);
      
      fetchLaporan();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "var(--color-primary)" }}>
            <AlertTriangle className="h-7 w-7" />
            Lapor Mukholif Lughoh
          </h1>
          <p className="text-xs text-gray-500 mt-1">Catat santri yang melanggar disiplin kebahasaan.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 font-bold text-sm bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-500/30 hover:scale-105 hover:bg-emerald-700 active:scale-95 transition-all w-full sm:w-auto overflow-hidden justify-center"
        >
          {showForm ? <X size={18} /> : <Plus size={18} />}
          <span>{showForm ? "Tutup Halaman Form" : "Buat Laporan Baru"}</span>
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-[2rem] p-4 sm:p-8 shadow-sm border border-gray-100 ring-4 ring-[var(--color-primary-50)]">
           <form onSubmit={handleSubmit}>
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                  <FileText size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800 leading-tight">Pengisian Tersangka Jasus</h2>
                  <p className="text-xs text-gray-400 mt-1">Anda bisa mengisi banyak form lalu mengirimnya secara massal.</p>
                </div>
              </div>
              
              {forms.map((form, index) => (
                 <ReportFormBlock 
                    key={form.id} 
                    index={index} 
                    data={form} 
                    isLajnah={isLajnah}
                    onUpdate={handleUpdateForm}
                    onRemove={handleRemoveForm}
                    canRemove={forms.length > 1}
                 />
              ))}

              <div className="flex flex-col sm:flex-row gap-3 pt-6 pb-2">
                 <button 
                   type="button"
                   onClick={handleAddForm}
                   className="w-full px-6 py-3.5 rounded-2xl font-bold text-sm text-emerald-600 bg-emerald-50 border-2 border-emerald-100 hover:bg-emerald-100 hover:border-emerald-200 flex items-center justify-center gap-2 transition-all group"
                 >
                    <Plus size={18} className="group-hover:rotate-90 transition-transform" />
                    Tambah Form Laporan Lain
                 </button>
                 <button
                   type="submit"
                   disabled={isSubmitting}
                   className="w-full px-6 py-3.5 rounded-2xl font-bold text-sm bg-emerald-600 shadow-xl shadow-emerald-500/20 text-white hover:bg-emerald-700 hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                 >
                    {isSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5" />
                    )}
                    Submit Sekaligus ( {forms.length} Laporan )
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
            Riwayat Laporan Yang Anda Entri
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
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${laporan.status === 'SELESAI' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                        {laporan.status === 'SELESAI' ? 'Selesai (Sudah Tabayun)' : 'Menunggu Tabayun'}
                      </span>
                      <span className="text-xs text-gray-400 font-medium">
                        Dibuat: {new Date(laporan.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </span>
                      {isLajnah && (
                        <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md text-[10px] uppercase font-bold flex items-center gap-1">
                          <Users size={12} /> {laporan.jasusNama}
                        </span>
                      )}
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
