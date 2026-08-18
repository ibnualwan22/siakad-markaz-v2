"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Clock, MapPin, MessageSquare, Image as ImageIcon, Users, CheckCircle2, ChevronRight, X, Loader2, BarChart3, Filter, Award, Search } from "lucide-react";
import toast from "react-hot-toast";

type Pelanggar = {
  id: string;
  santriId: string;
  santriNama: string;
  santriKelas: string | null;
  santriAsrama: string | null;
  statusTabayun: string | null;
  jumlahTidakHadir: number;
  iqobSounding: boolean;
  iqobJawal: boolean;
  iqobPenyetoran: boolean;
  tabayunAt?: string | null;
};

type Laporan = {
  id: string;
  waktuMelanggar: string;
  tempatMelanggar: string;
  perkataanYgDiucapkan: string;
  detailKejadian: string | null;
  jasusNama: string;
  jasus?: {
    sakan: string | null;
    kamar: string | null;
    riwayatRecords: { kelas: { nama: string } }[];
  };
  status: string;
  createdAt: string;
  pelanggarList: Pelanggar[];
};

export default function TabayunMukholifPage() {
  const [activeTab, setActiveTab] = useState<"daftar" | "statistik">("daftar");
  const [filterStatus, setFilterStatus] = useState<"MENUNGGU" | "SELESAI" | "ALL">("MENUNGGU");
  const [laporanList, setLaporanList] = useState<Laporan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Modal State
  const [selectedLaporan, setSelectedLaporan] = useState<Laporan | null>(null);
  const [tabayunForm, setTabayunForm] = useState<Record<string, Partial<Pelanggar>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stats State
  const [statsData, setStatsData] = useState<any>(null);
  const [statsUsbu, setStatsUsbu] = useState("ALL");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    if (activeTab === "daftar") {
      fetchLaporan();
    } else {
      fetchStats();
    }
  }, [activeTab, filterStatus, statsUsbu, debouncedQuery]);

  const fetchLaporan = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/mukholif?status=${filterStatus}&q=${encodeURIComponent(debouncedQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setLaporanList(data);
      }
    } catch (error) {
      toast.error("Gagal mengambil data laporan");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/mukholif/stats?usbu=${statsUsbu}`);
      if (res.ok) {
        const data = await res.json();
        setStatsData(data);
      }
    } catch (error) {
      toast.error("Gagal menngambil data statistik");
    } finally {
      setIsLoading(false);
    }
  };

  const openTabayun = async (id: string) => {
    setSelectedLaporan(null);
    setTabayunForm({});
    try {
      const res = await fetch(`/api/admin/mukholif/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedLaporan(data);
        
        // initialize form
        const initialForm: Record<string, Partial<Pelanggar>> = {};
        data.pelanggarList.forEach((p: Pelanggar) => {
          initialForm[p.id] = {
            statusTabayun: p.statusTabayun,
            iqobSounding: p.iqobSounding,
            iqobJawal: p.iqobJawal,
            iqobPenyetoran: p.iqobPenyetoran,
            jumlahTidakHadir: p.jumlahTidakHadir
          };
        });
        setTabayunForm(initialForm);
      }
    } catch (error) {
      toast.error("Gagal membuka detail laporan");
    }
  };

  const updateForm = (pelanggarId: string, field: string, value: any) => {
    setTabayunForm(prev => ({
      ...prev,
      [pelanggarId]: {
        ...prev[pelanggarId],
        [field]: value
      }
    }));
  };

  const submitTabayun = async () => {
    if (!selectedLaporan) return;
    
    // Prepare payload
    const results = Object.keys(tabayunForm).map(id => ({
      pelanggarId: id,
      ...tabayunForm[id]
    }));

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/mukholif/${selectedLaporan.id}/tabayun`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan tabayun");
      
      toast.success("Berhasil menyimpan tabayun");
      setSelectedLaporan(null); // close modal
      fetchLaporan(); // refresh list
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "var(--color-primary)" }}>
            <AlertTriangle className="h-7 w-7" />
            Tabayun Mukholif Lughoh
          </h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">Verifikasi laporan pelanggaran bahasa dari Jasus.</p>
        </div>
        
        <div className="flex bg-[var(--color-surface)] p-1 rounded-xl shadow-inner border border-slate-200">
          <button
            onClick={() => setActiveTab("daftar")}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === "daftar" ? "bg-white text-slate-800 shadow-sm border border-slate-200/50" : "text-gray-500 hover:text-slate-700 hover:bg-slate-50/50"}`}
          >
            <AlertTriangle size={16} /> Daftar Laporan
          </button>
          <button
            onClick={() => setActiveTab("statistik")}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === "statistik" ? "bg-white text-slate-800 shadow-sm border border-slate-200/50" : "text-gray-500 hover:text-slate-700 hover:bg-slate-50/50"}`}
          >
            <BarChart3 size={16} /> Statistik
          </button>
        </div>
      </div>

      {activeTab === "daftar" && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-[var(--color-surface-dark)]">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-slate-800 self-start md:self-center">Daftar Laporan Jasus</h2>
            
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama pelanggar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 border border-slate-200 rounded-xl text-sm font-medium bg-slate-50 text-slate-700 outline-none hover:border-emerald-300 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-100)] transition-all"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Filter className="w-4 h-4 text-gray-400" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="text-sm font-bold bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-1.5 outline-none hover:border-emerald-300 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-100)] transition-all cursor-pointer box-border"
                  title="Filter Status"
                >
                  <option value="MENUNGGU">Menunggu Tabayun</option>
                  <option value="SELESAI">Sudah Selesai</option>
                  <option value="ALL">Semua Status</option>
                </select>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
            </div>
          ) : laporanList.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <CheckCircle2 className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-500 font-bold mb-1">Tidak ada laporan yang sesuai</p>
              <p className="text-sm text-slate-400">Semua laporan sudah diselesaikan atau filter kosong.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {(() => {
                const groups: Record<string, typeof laporanList> = {
                  "Panggilan Ulang (Tidak Hadir)": [],
                  "Panggilan Pertama (Belum Verif)": [],
                  "Selesai": []
                };

                laporanList.forEach(laporan => {
                  if (laporan.status === "SELESAI") {
                    groups["Selesai"].push(laporan);
                  } else {
                    const mangkirCount = laporan.pelanggarList.filter(p => (!p.statusTabayun || p.statusTabayun === "TIDAK_HADIR") && p.jumlahTidakHadir > 0).length;
                    if (mangkirCount > 0) {
                      groups["Panggilan Ulang (Tidak Hadir)"].push(laporan);
                    } else {
                      groups["Panggilan Pertama (Belum Verif)"].push(laporan);
                    }
                  }
                });

                return Object.entries(groups).filter(([_, items]) => items.length > 0).map(([groupName, items]) => (
                  <div key={groupName} className="space-y-4">
                    <div className="flex items-center gap-4">
                       <div className="h-px bg-slate-200 flex-1"></div>
                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{groupName}</span>
                       <div className="h-px bg-slate-200 flex-1"></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {items.map((laporan) => {
                        const totalPelanggar = laporan.pelanggarList.length;
                        const belumDitabayunList = laporan.pelanggarList.filter(p => !p.statusTabayun || p.statusTabayun === "TIDAK_HADIR");
                        const murniBelum = belumDitabayunList.filter(p => p.jumlahTidakHadir === 0).length;
                        const mangkirCountState = belumDitabayunList.filter(p => p.jumlahTidakHadir > 0).length;
                        const maxMangkirX = mangkirCountState > 0 ? Math.max(...belumDitabayunList.map(p => p.jumlahTidakHadir)) : 0;
                        
                        const latestTabayunAt = mangkirCountState > 0 
                          ? belumDitabayunList
                              .filter(p => p.jumlahTidakHadir > 0 && p.tabayunAt)
                              .map(p => new Date(p.tabayunAt!).getTime())
                              .sort((a, b) => b - a)[0]
                          : null;
                        
                        return (
                          <div 
                            key={laporan.id}
                            onClick={() => openTabayun(laporan.id)}
                            className="p-5 border border-gray-200 rounded-2xl cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all group relative bg-white"
                          >
                            <div className="absolute top-4 right-4 text-xs font-bold px-2.5 py-1 rounded-full border bg-slate-50 text-slate-600 group-hover:bg-emerald-50 group-hover:text-emerald-700 group-hover:border-emerald-200 transition-colors">
                              {laporan.status === "SELESAI" ? "Selesai" : (
                                <div className="flex items-center gap-1.5">
                                  {murniBelum > 0 && <span>{murniBelum} Belum Verif</span>}
                                  {murniBelum > 0 && mangkirCountState > 0 && <span className="text-gray-300">•</span>}
                                  {mangkirCountState > 0 && (
                                    <span className="text-amber-600 font-bold">
                                      Tdk Hadir {maxMangkirX}x 
                                      {latestTabayunAt && <span className="font-medium text-amber-500/80 ml-1">({new Date(latestTabayunAt).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})})</span>}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-3 mb-3 pr-2">
                              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-500 shrink-0">
                                <AlertTriangle className="w-5 h-5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs text-gray-500 mb-0.5 uppercase tracking-wide font-bold">Tersangka Pelanggar</p>
                                <p className="text-sm font-bold text-slate-800 line-clamp-1">
                                  {laporan.pelanggarList.map((p: any) => p.santri?.nama).join(", ") || "Tanpa Nama"}
                                </p>
                              </div>
                            </div>
                            
                            <div className="space-y-2 mt-4 ml-2">
                              <p className="text-xs text-gray-600 flex items-center gap-2">
                                <Clock className="w-4 h-4 text-gray-400 shrink-0" /> 
                                {new Date(laporan.waktuMelanggar).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', hour12: false })}
                              </p>
                              <p className="text-xs text-gray-600 flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-gray-400 shrink-0" /> {laporan.tempatMelanggar}
                              </p>
                              <p className="text-xs text-gray-600 flex items-start gap-2 pr-2">
                                <Users className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" /> 
                                <span className="line-clamp-2 leading-relaxed">
                                  <span className="text-slate-400 mr-1">Dilaporkan oleh:</span>
                                  <span className="font-bold text-slate-700">{laporan.jasusNama}</span>
                                </span>
                              </p>
                            </div>

                            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                              <div className="text-xs text-gray-500 flex items-center gap-1.5">
                                <span className="font-bold text-slate-700">{totalPelanggar}</span> orang dilaporkan
                              </div>
                              <span className="text-xs font-bold text-[var(--color-primary)] flex items-center gap-1 group-hover:underline">
                                Lihat Detail <ChevronRight size={14} />
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      )}

      {/* Tabayun Modal */}
      {selectedLaporan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50 relative overflow-hidden">
              {/* background pattern */}
              <div className="absolute top-0 right-0 -mr-8 -mt-8 opacity-10">
                <AlertTriangle className="w-32 h-32" />
              </div>
              
              <div className="relative">
                <h3 className="text-xl font-bold text-slate-800">Detail & Tabayun Laporan</h3>
                <p className="text-xs text-gray-500 mt-1">Selesaikan verifikasi untuk setiap santri yang dilaporkan.</p>
              </div>
              <button 
                onClick={() => setSelectedLaporan(null)}
                className="p-2 bg-white rounded-full text-gray-500 hover:text-red-500 shadow-sm border border-gray-200 transition-colors z-10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-white">
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 mb-8 grid grid-cols-1 md:grid-cols-12 gap-6">
                 <div className="md:col-span-8 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Dilaporkan oleh</p>
                        <div className="flex items-center gap-3 p-2.5 bg-white rounded-xl border border-slate-100 shadow-sm h-full">
                          <div className="w-8 h-8 rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary)] flex items-center justify-center shrink-0">
                            <Users size={16} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800 line-clamp-1">{selectedLaporan.jasusNama}</p>
                            <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">{selectedLaporan.jasus?.riwayatRecords[0]?.kelas?.nama || "N/A"} • {selectedLaporan.jasus?.sakan || "Tanpa Asrama"}</p>
                          </div>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Perkataan yang diucapkan</p>
                        <div className="p-2.5 bg-white rounded-xl border border-slate-100 shadow-sm h-full flex items-center">
                          <p className="text-sm font-bold text-slate-800 line-clamp-2">
                            "{selectedLaporan.perkataanYgDiucapkan}"
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Waktu Kejadian</p>
                        <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-emerald-500" />
                          {new Date(selectedLaporan.waktuMelanggar).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', hour12: false })}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Tempat Kejadian</p>
                        <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-emerald-500" />
                          {selectedLaporan.tempatMelanggar}
                        </p>
                      </div>
                    </div>
                 </div>
                 
                 <div className="md:col-span-4 flex flex-col items-start justify-start border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 pl-0 md:pl-6">
                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2 w-full text-left">Detail Keterangan Kejadian</p>
                    <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm w-full min-h-[100px]">
                      {selectedLaporan.detailKejadian ? (
                        <p className="text-sm font-medium text-slate-700 whitespace-pre-wrap leading-relaxed">
                          {selectedLaporan.detailKejadian}
                        </p>
                      ) : (
                        <p className="text-sm font-medium text-gray-400 italic">
                          Tidak ada keterangan tambahan.
                        </p>
                      )}
                    </div>
                 </div>
              </div>

              {/* Tabel Pelanggar */}
              <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-[var(--color-primary)]" />
                Daftar Pelapor & Tabayun
              </h4>
              
              <div className="space-y-6">
                {(() => {
                  const groups: Record<string, typeof selectedLaporan.pelanggarList> = {
                    "Sudah Diverifikasi": [],
                    "Belum Tabayun Panggilan Pertama": [],
                  };
                  selectedLaporan.pelanggarList.forEach(p => {
                    if (p.statusTabayun === "PELANGGAR" || p.statusTabayun === "BUKAN_PELANGGAR") {
                      groups["Sudah Diverifikasi"].push(p);
                    } else if (p.jumlahTidakHadir === 0) {
                      groups["Belum Tabayun Panggilan Pertama"].push(p);
                    } else {
                      const key = `Peringatan Tidak Hadir Ke-${p.jumlahTidakHadir}x`;
                      if (!groups[key]) groups[key] = [];
                      groups[key].push(p);
                    }
                  });

                  return Object.entries(groups).filter(([_, items]) => items.length > 0).map(([groupName, items]) => (
                    <div key={groupName} className="space-y-4 mb-8">
                      <div className="flex items-center gap-4">
                         <div className="h-px bg-slate-200 flex-1"></div>
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{groupName}</span>
                         <div className="h-px bg-slate-200 flex-1"></div>
                      </div>
                      
                      {items.map((pelanggar, idx) => {
                        const formState = tabayunForm[pelanggar.id] || {};
                        const isPelanggar = formState.statusTabayun === "PELANGGAR";
                        const belumPilih = !formState.statusTabayun;
                        
                        return (
                          <div key={pelanggar.id} className="border border-slate-200 rounded-2xl overflow-hidden bg-white hover:border-slate-300 transition-colors">
                            <div className="bg-slate-50/50 p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-500 font-black flex items-center justify-center text-xs">
                                  {idx + 1}
                                </div>
                                <div>
                                  <p className="font-bold text-slate-800">{pelanggar.santriNama}</p>
                                  <p className="text-xs text-gray-500">{pelanggar.santriKelas || 'N/A'} • {pelanggar.santriAsrama || 'N/A'}</p>
                                </div>
                              </div>
                              
                              <div className="flex flex-col md:items-end gap-1.5">
                                {( (formState.jumlahTidakHadir ?? pelanggar.jumlahTidakHadir) > 0 || formState.statusTabayun === "TIDAK_HADIR" ) && formState.statusTabayun !== "PELANGGAR" && formState.statusTabayun !== "BUKAN_PELANGGAR" && (
                                  <div className="flex items-center gap-1">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); updateForm(pelanggar.id, "jumlahTidakHadir", Math.max(0, (formState.jumlahTidakHadir ?? pelanggar.jumlahTidakHadir) - 1)); }} 
                                      className="w-5 h-5 flex items-center justify-center rounded bg-slate-100 text-slate-500 hover:bg-slate-200 font-bold transition-colors"
                                    >-</button>
                                    <div className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold w-fit min-w-[100px] text-center">
                                      Tidak Hadir {formState.jumlahTidakHadir ?? pelanggar.jumlahTidakHadir}x
                                    </div>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); updateForm(pelanggar.id, "jumlahTidakHadir", (formState.jumlahTidakHadir ?? pelanggar.jumlahTidakHadir) + 1); }} 
                                      className="w-5 h-5 flex items-center justify-center rounded bg-slate-100 text-slate-500 hover:bg-slate-200 font-bold transition-colors"
                                    >+</button>
                                  </div>
                                )}
                                {pelanggar.jumlahTidakHadir > 0 && pelanggar.tabayunAt && (
                                  <p className="text-[10px] text-gray-500 font-medium">
                                    Terakhir dipanggil: {new Date(pelanggar.tabayunAt).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'})}
                                  </p>
                                )}
                              </div>
                            </div>
                      
                      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <p className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">Hasil Tabayun</p>
                          <div className="flex flex-wrap gap-2">
                            {["PELANGGAR", "BUKAN_PELANGGAR", "TIDAK_HADIR"].map(status => (
                              <label key={status} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer border transition-all ${
                                formState.statusTabayun === status 
                                  ? "bg-[var(--color-primary-50)] border-[var(--color-primary-100)] ring-1 ring-[var(--color-primary)] text-[var(--color-primary-dark)]" 
                                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                              }`}>
                                <input
                                  type="radio"
                                  name={`status-${pelanggar.id}`}
                                  value={status}
                                  checked={formState.statusTabayun === status}
                                  onChange={() => {
                                    updateForm(pelanggar.id, "statusTabayun", status);
                                    if (status === "TIDAK_HADIR" && pelanggar.statusTabayun !== "TIDAK_HADIR") {
                                      updateForm(pelanggar.id, "jumlahTidakHadir", pelanggar.jumlahTidakHadir + 1);
                                    }
                                  }}
                                  className="hidden"
                                />
                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                  formState.statusTabayun === status ? "border-[var(--color-primary)]" : "border-slate-300"
                                }`}>
                                  {formState.statusTabayun === status && <div className="w-2 h-2 rounded-full bg-[var(--color-primary)]" />}
                                </div>
                                <span className="text-sm font-bold">
                                  {status === "PELANGGAR" ? "Pelanggar" : status === "BUKAN_PELANGGAR" ? "Bukan Pelanggar" : "Tidak Hadir"}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                        
                        <div className={`transition-all duration-300 ${!isPelanggar ? 'opacity-30 pointer-events-none grayscale' : ''}`}>
                          <p className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">Pilih Hukuman</p>
                          <div className="space-y-2">
                            {[
                              { id: "iqobSounding", label: "Iqob Sounding" },
                              { id: "iqobJawal", label: "Jawal" },
                              { id: "iqobPenyetoran", label: "Penyetoran Mukholif" }
                            ].map(iqob => (
                              <label key={iqob.id} className="flex items-center gap-3 cursor-pointer group">
                                <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                                  // @ts-ignore
                                  formState[iqob.id] 
                                    ? "bg-[var(--color-primary)] border-[var(--color-primary)]" 
                                    : "bg-white border-slate-300 group-hover:border-slate-400"
                                }`}>
                                  {/* @ts-ignore */}
                                  {formState[iqob.id] && <CheckCircle2 size={14} className="text-white" />}
                                </div>
                                <input
                                  type="checkbox"
                                  // @ts-ignore
                                  checked={!!formState[iqob.id]}
                                  onChange={(e) => updateForm(pelanggar.id, iqob.id, e.target.checked)}
                                  className="hidden"
                                  disabled={!isPelanggar}
                                />
                                <span className={`text-sm font-semibold ${
                                  // @ts-ignore
                                  formState[iqob.id] ? "text-slate-800" : "text-slate-600"
                                }`}>
                                  {iqob.label}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ));
          })()}
        </div>
      </div>
            
            <div className="px-6 py-4 bg-slate-50 border-t flex justify-end gap-3 z-10 sticky bottom-0">
              <button 
                onClick={() => setSelectedLaporan(null)}
                className="px-5 py-2 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-200 transition-colors"
                disabled={isSubmitting}
              >
                Batal
              </button>
              <button 
                onClick={submitTabayun}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2 bg-[var(--color-primary)] text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all text-sm disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Simpan Hasil Tabayun
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Statistik */}
      {activeTab === "statistik" && (
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-[var(--color-surface-dark)]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 pb-4 border-b gap-4">
            <h2 className="text-xl font-bold text-slate-800">
              Persentase Pelanggar Bahasa {statsData?.activeDufah && `(${statsData.activeDufah})`}
            </h2>
            <select 
              value={statsUsbu} 
              onChange={(e) => setStatsUsbu(e.target.value)} 
              className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 text-slate-700 outline-none hover:border-emerald-300 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-100)] transition-all cursor-pointer box-border"
            >
              <option value="ALL">Semua Usbu'</option>
              <option value="usbu1">Usbu' 1</option>
              <option value="usbu2">Usbu' 2</option>
              <option value="usbu3">Usbu' 3</option>
            </select>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
            </div>
          ) : !statsData || statsData.chartData.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500">Belum ada data pelanggaran di 5 minggu terakhir.</p>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex items-center justify-between p-4 bg-[var(--color-primary-50)] border border-[var(--color-primary-100)] rounded-xl">
                <div>
                  <p className="text-xs font-bold text-[var(--color-primary)] uppercase tracking-wider mb-1">Total Santri Aktif</p>
                  <p className="text-2xl font-black text-slate-800">{statsData.totalSantriAktif} Santri</p>
                </div>
                <Users className="w-10 h-10 text-[var(--color-primary)] opacity-50" />
              </div>
              
              <div className="w-full overflow-x-auto pb-4">
                <div className="relative h-[250px] sm:h-[300px] w-max min-w-full flex items-end justify-start pr-8 pl-12 gap-1.5 mt-12 pb-8 border-b border-slate-200">
                  {/* Y-Axis labels (approx) */}
                  <div className="sticky left-0 bottom-8 top-0 h-full w-10 bg-white z-20 border-r border-slate-100 -ml-12 shrink-0">
                     <span className="absolute top-[0%] -translate-y-1/2 right-2 text-[10px] text-slate-400 font-bold">100%</span>
                     <span className="absolute top-[25%] -translate-y-1/2 right-2 text-[10px] text-slate-400 font-bold">75%</span>
                     <span className="absolute top-[50%] -translate-y-1/2 right-2 text-[10px] text-slate-400 font-bold">50%</span>
                     <span className="absolute top-[75%] -translate-y-1/2 right-2 text-[10px] text-slate-400 font-bold">25%</span>
                     <span className="absolute bottom-0 translate-y-[20%] right-2 text-[10px] text-slate-400 font-bold">0%</span>
                  </div>
                  
                  {/* Horizontal Guide lines */}
                  <div className="absolute left-10 right-0 top-[0%] h-px bg-slate-100" />
                  <div className="absolute left-10 right-0 top-[25%] h-px bg-slate-100" />
                  <div className="absolute left-10 right-0 top-[50%] h-px bg-slate-100" />
                  <div className="absolute left-10 right-0 top-[75%] h-px bg-slate-100" />
                  
                  {statsData.chartData.map((d: any) => (
                    <div key={d.name} className="relative z-10 w-full h-full min-w-[32px] sm:min-w-[40px] max-w-[48px] flex flex-col justify-end items-center group">
                      
                      {/* Values container */}
                      <div 
                        className="absolute w-full flex flex-col items-center justify-end z-30 pointer-events-none"
                        style={{ bottom: `calc(${Math.max(d.persentase, 1)}% + 4px)` }}
                      >
                        {/* Hover state */}
                        <div className="absolute bottom-0 flex flex-col items-center opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-white/90 px-1 rounded-md shadow-sm">
                          <p className="text-sm font-black text-[var(--color-primary)] leading-none mb-1">{d.pelanggar}</p>
                          <p className="text-[10px] font-bold text-slate-500 leading-none mb-1">{d.persentase}%</p>
                        </div>
                        {/* Default state */}
                        <div className="absolute bottom-0 flex flex-col items-center group-hover:opacity-0 transition-opacity">
                          <p className="text-[10px] font-bold text-slate-400 leading-none">{d.pelanggar > 0 ? d.pelanggar : ""}</p>
                        </div>
                      </div>
                      
                      {/* Bar */}
                      <div 
                        className="w-full bg-[var(--color-primary)] rounded-t-sm sm:rounded-t-md transition-all duration-1000 ease-out hover:opacity-90 relative overflow-hidden shadow-sm shadow-[var(--color-primary-400)]"
                        style={{ height: `${Math.max(d.persentase, 1)}%` }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                      </div>
                      
                      {/* Label */}
                      <p className="absolute -bottom-8 text-[9px] font-bold text-slate-500 text-center w-12 left-1/2 -translate-x-1/2 break-words leading-tight">
                        {d.name.split(' ')[0]}<br/>{d.name.split(' ')[1]}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-center text-slate-400 mt-6 pt-4 font-medium italic">
                * Persentase diambil dari jumlah santri yang melanggar dan berstatus "Sudah Tabayun/Pelanggar", dibandingkan dengan total santri aktif saat ini.
              </p>
              
              <div className="mt-16 pt-8 border-t border-slate-100">
                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-500" />
                  Top 10 Jasus Teraktif (Laporan Valid)
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {statsData.topJasus && statsData.topJasus.length > 0 ? statsData.topJasus.map((jasus: any, idx: number) => (
                    <div key={idx} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center justify-between hover:border-amber-200 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${idx === 0 ? 'bg-amber-100 text-amber-600 ring-2 ring-amber-300 ring-offset-1' : idx === 1 ? 'bg-slate-200 text-slate-600' : idx === 2 ? 'bg-orange-100 text-orange-600' : 'bg-white border text-slate-400'}`}>
                          #{idx + 1}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm line-clamp-1">{jasus.nama}</p>
                          <p className="text-[10px] text-gray-500 line-clamp-1">{jasus.sakan}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className="text-lg font-black text-[var(--color-primary)]">{jasus.score}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Valid</p>
                      </div>
                    </div>
                  )) : (
                    <div className="col-span-full py-8 text-sm font-bold text-slate-400 text-center">Belum ada jasus dengan laporan teguran yang valid sejauh ini.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
