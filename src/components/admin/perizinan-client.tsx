"use client";

import { useState, useEffect } from "react";
import { Loader2, Users, User, Calendar, Save, FileText, CheckSquare, Search, BookOpen, Activity, PlusSquare } from "lucide-react";
import toast from "react-hot-toast";

type SantriOption = {
  riwayatId: string;
  nama: string;
  kelasNama: string | null;
  sakan: string;
};

type PerizinanClientProps = {
  santriOptions: SantriOption[];
  sakanList: string[];
  kelasList: string[];
  permissions: string[];
};

export default function PerizinanClient({ santriOptions, sakanList, kelasList, permissions }: PerizinanClientProps) {
  const isAdmin = permissions.includes("*");
  const canHarian = isAdmin || permissions.includes("perizinan_harian_edit");
  const canBerhari = isAdmin || permissions.includes("perizinan_berhari_edit");
  const canKeluarPare = isAdmin || permissions.includes("perizinan_keluar_pare_edit");
  const canTabirot = isAdmin || permissions.includes("perizinan_tabirot_edit");

  // Defaults to whatever they have access to
  const initialTab = (canHarian || canTabirot) ? "HARIAN" : canBerhari ? "BERHARI_HARI" : canKeluarPare ? "KELUAR_PARE" : "";

  const [activeTab, setActiveTab] = useState(initialTab);
  const [kategoriHarian, setKategoriHarian] = useState<"SEKOLAH" | "KEGIATAN" | "TABIROT">("SEKOLAH");
  const [mode, setMode] = useState<"INDIVIDU" | "BATCH">("INDIVIDU");

  const [search, setSearch] = useState("");
  const [selectedSantri, setSelectedSantri] = useState<SantriOption | null>(null);

  const [batchSakan, setBatchSakan] = useState("ALL");
  const [batchKelas, setBatchKelas] = useState("ALL");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const getTodayWIB = () => {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  };

  const [alasan, setAlasan] = useState("");
  const [tanggalMulai, setTanggalMulai] = useState(getTodayWIB());
  const [tanggalSelesai, setTanggalSelesai] = useState("");
  const [globalBatasJamAkhir, setGlobalBatasJamAkhir] = useState("22:00");
  const [statusAbsen, setStatusAbsen] = useState<"IZIN" | "SAKIT">("IZIN");

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/admin/perizinan/pengaturan")
      .then(res => res.json())
      .then(data => {
        if (data.batasJamAkhirKeluarPare) {
          setGlobalBatasJamAkhir(data.batasJamAkhirKeluarPare);
        }
      })
      .catch(console.error);
  }, []);

  if (!initialTab) {
    return <div className="p-8 text-center text-red-500 font-bold bg-red-50 rounded-xl">Anda tidak memiliki akses untuk membuat izin.</div>;
  }

  const filteredSantri = santriOptions.filter(s => {
    if (search && !s.nama.toLowerCase().includes(search.toLowerCase())) return false;
    if (mode === "BATCH") {
      if (batchSakan !== "ALL" && s.sakan !== batchSakan) return false;
      if (batchKelas !== "ALL" && s.kelasNama !== batchKelas) return false;
    }
    return true;
  }).slice(0, mode === "INDIVIDU" ? 10 : undefined); // Limit individu search to 10

  const toggleBatchSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredSantri.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSantri.map(s => s.riwayatId)));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const riwayatIds = mode === "INDIVIDU"
      ? (selectedSantri ? [selectedSantri.riwayatId] : [])
      : Array.from(selectedIds);

    if (riwayatIds.length === 0) {
      return toast.error("Pilih minimal satu santri");
    }

    if ((activeTab === "BERHARI_HARI" || activeTab === "KELUAR_PARE") && !tanggalSelesai) {
      return toast.error("Pilih tanggal sampai");
    }

    if ((activeTab === "BERHARI_HARI" || activeTab === "KELUAR_PARE") && new Date(tanggalMulai) > new Date(tanggalSelesai)) {
      return toast.error("Tanggal selesai tidak boleh sebelum tanggal mulai");
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/perizinan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          riwayatIds,
          tipeIzin: activeTab,
          alasan,
          tanggalMulai,
          tanggalSelesai: (activeTab === "BERHARI_HARI" || activeTab === "KELUAR_PARE") ? tanggalSelesai : null,
          statusAbsen,
          kategoriHarian: activeTab === "HARIAN" ? kategoriHarian : undefined,
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");

      toast.success(`Berhasil membuat ${data.count} tasrih izin`);

      // Reset form
      setAlasan("");
      setTanggalMulai(getTodayWIB());
      setTanggalSelesai("");
      setStatusAbsen("IZIN");
      if (mode === "INDIVIDU") {
        setSelectedSantri(null);
        setSearch("");
      } else {
        setSelectedIds(new Set());
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[var(--color-surface-dark)] p-6">

      {/* TABS */}
      <div className="flex gap-2 mb-6 border-b border-slate-100 pb-4">
        {(canHarian || canTabirot) && (
          <button
            onClick={() => setActiveTab("HARIAN")}
            className={`px-4 py-2 text-sm font-bold rounded-xl transition-all ${activeTab === "HARIAN" ? "bg-[var(--color-primary-100)] text-[var(--color-primary)] shadow-sm" : "text-[var(--color-text-muted)] hover:bg-slate-50"}`}
          >
            Izin Harian
          </button>
        )}
        {canBerhari && (
          <button
            onClick={() => setActiveTab("BERHARI_HARI")}
            className={`px-4 py-2 text-sm font-bold rounded-xl transition-all ${activeTab === "BERHARI_HARI" ? "bg-[var(--color-primary-100)] text-[var(--color-primary)] shadow-sm" : "text-[var(--color-text-muted)] hover:bg-slate-50"}`}
          >
            Izin Berhari-hari
          </button>
        )}
        {canKeluarPare && (
          <button
            onClick={() => setActiveTab("KELUAR_PARE")}
            className={`px-4 py-2 text-sm font-bold rounded-xl transition-all ${activeTab === "KELUAR_PARE" ? "bg-[var(--color-primary-100)] text-[var(--color-primary)] shadow-sm" : "text-[var(--color-text-muted)] hover:bg-slate-50"}`}
          >
            Izin Keluar Pare
          </button>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-8">

        {/* LEFT PANEL - SANTRI SELECTION */}
        <div className="flex-1 space-y-4">
          <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setMode("INDIVIDU")}
              className={`flex-1 py-1.5 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${mode === "INDIVIDU" ? "bg-white shadow-sm text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"}`}
            >
              <User size={16} /> Individu
            </button>
            <button
              onClick={() => setMode("BATCH")}
              className={`flex-1 py-1.5 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${mode === "BATCH" ? "bg-white shadow-sm text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"}`}
            >
              <Users size={16} /> Batch
            </button>
          </div>

          {mode === "INDIVIDU" ? (
            <div className="space-y-3">
              <label className="block text-sm font-bold text-[var(--color-text)]">Pilih Santri</label>
              {!selectedSantri ? (
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--color-text-subtle)]" />
                  <input
                    type="text"
                    placeholder="Cari nama santri..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-[var(--color-surface-dark)] rounded-xl focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] text-sm"
                  />
                  {search && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 shadow-lg rounded-xl max-h-60 overflow-y-auto">
                      {filteredSantri.map(s => (
                        <button
                          key={s.riwayatId}
                          onClick={() => setSelectedSantri(s)}
                          className="w-full text-left px-4 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0"
                        >
                          <div className="font-bold text-sm text-[var(--color-text)]">{s.nama}</div>
                          <div className="text-xs text-[var(--color-text-subtle)]">{s.kelasNama} • {s.sakan}</div>
                        </button>
                      ))}
                      {filteredSantri.length === 0 && <div className="px-4 py-3 text-sm text-center text-[var(--color-text-muted)]">Tidak ditemukan</div>}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 border border-[var(--color-primary-100)] bg-[var(--color-primary-50)] rounded-xl">
                  <div>
                    <div className="font-bold text-sm text-[var(--color-primary-dark)]">{selectedSantri.nama}</div>
                    <div className="text-xs text-[var(--color-primary)] opacity-80">{selectedSantri.kelasNama} • {selectedSantri.sakan}</div>
                  </div>
                  <button onClick={() => setSelectedSantri(null)} className="text-xs font-bold px-2 py-1 bg-white rounded-lg text-[var(--color-danger)] shadow-sm hover:bg-red-50">Batal</button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <select value={batchSakan} onChange={(e) => setBatchSakan(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none">
                  <option value="ALL">Semua Sakan</option>
                  {sakanList.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={batchKelas} onChange={(e) => setBatchKelas(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none">
                  <option value="ALL">Semua Kelas</option>
                  {kelasList.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--color-text-subtle)]" />
                <input type="text" placeholder="Cari nama santri..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-[var(--color-surface-dark)] rounded-xl focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] text-sm" />
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col h-[280px]">
                <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex justify-between items-center">
                  <span className="text-xs font-bold text-[var(--color-text-muted)]">Pilih {selectedIds.size} dari {filteredSantri.length}</span>
                  <button onClick={handleSelectAll} className="text-xs font-bold text-[var(--color-primary)] hover:underline flex items-center gap-1">
                    <CheckSquare size={14} /> Pilih Semua
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-1">
                  {filteredSantri.map(s => (
                    <label key={s.riwayatId} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(s.riwayatId)}
                        onChange={() => toggleBatchSelect(s.riwayatId)}
                        className="w-4 h-4 rounded border-slate-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                      />
                      <div>
                        <div className="font-bold text-sm text-[var(--color-text)]">{s.nama}</div>
                        <div className="text-xs text-[var(--color-text-subtle)]">{s.kelasNama} • {s.sakan}</div>
                      </div>
                    </label>
                  ))}
                  {filteredSantri.length === 0 && <div className="p-4 text-center text-sm text-slate-400">Tidak ada santri yang cocok</div>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL - FORM IZIN */}
        <div className="flex-1">
          <form onSubmit={handleSubmit} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">

            {activeTab === "HARIAN" && (
              <div>
                <label className="block text-sm font-bold text-[var(--color-text)] mb-2">Pilih Kategori Izin</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setKategoriHarian("SEKOLAH")}
                    className={`flex-1 py-2 text-sm font-bold rounded-xl border flex items-center justify-center gap-1.5 transition-all ${kategoriHarian === "SEKOLAH" ? "bg-white border-[var(--color-primary)] text-[var(--color-primary)] shadow-sm" : "bg-transparent border-slate-200 text-[var(--color-text-muted)] hover:border-slate-300 hover:bg-white"}`}
                  >
                    <BookOpen size={16} /> Sekolah
                  </button>
                  <button
                    type="button"
                    onClick={() => setKategoriHarian("KEGIATAN")}
                    className={`flex-1 py-2 text-sm font-bold rounded-xl border flex items-center justify-center gap-1.5 transition-all ${kategoriHarian === "KEGIATAN" ? "bg-white border-[var(--color-primary)] text-[var(--color-primary)] shadow-sm" : "bg-transparent border-slate-200 text-[var(--color-text-muted)] hover:border-slate-300 hover:bg-white"}`}
                  >
                    <Activity size={16} /> Kegiatan
                  </button>
                  {canTabirot && (
                    <button
                      type="button"
                      onClick={() => setKategoriHarian("TABIROT")}
                      className={`flex-1 py-2 text-sm font-bold rounded-xl border flex items-center justify-center gap-1.5 transition-all ${kategoriHarian === "TABIROT" ? "bg-white border-[var(--color-primary)] text-[var(--color-primary)] shadow-sm" : "bg-transparent border-slate-200 text-[var(--color-text-muted)] hover:border-slate-300 hover:bg-white"}`}
                    >
                      <Users size={16} /> Ta'birot
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Pilihan Izin / Sakit */}
            <div>
              <label className="block text-sm font-bold text-[var(--color-text)] mb-2">Status di Absen</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStatusAbsen("IZIN")}
                  className={`flex-1 py-2.5 text-sm font-bold rounded-xl border-2 flex items-center justify-center gap-1.5 transition-all ${statusAbsen === "IZIN" ? "bg-indigo-50 border-indigo-400 text-indigo-700 shadow-sm" : "border-slate-200 text-slate-400 hover:border-slate-300 bg-white"}`}
                >
                  <FileText size={16} /> Izin
                </button>
                <button
                  type="button"
                  onClick={() => setStatusAbsen("SAKIT")}
                  className={`flex-1 py-2.5 text-sm font-bold rounded-xl border-2 flex items-center justify-center gap-1.5 transition-all ${statusAbsen === "SAKIT" ? "bg-amber-50 border-amber-400 text-amber-700 shadow-sm" : "border-slate-200 text-slate-400 hover:border-slate-300 bg-white"}`}
                >
                  <PlusSquare size={16} /> Sakit
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-[var(--color-text)] mb-1">Alasan {statusAbsen === "SAKIT" ? "Sakit" : "Izin"}</label>
              <textarea
                required
                value={alasan}
                onChange={(e) => setAlasan(e.target.value)}
                placeholder={statusAbsen === "SAKIT" ? "Contoh: Demam, Sakit perut, dll..." : "Contoh: Mengurus ijazah, Berobat, dll..."}
                rows={3}
                className="w-full px-4 py-3 border border-[var(--color-surface-dark)] rounded-xl focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] text-sm resize-none"
              />
            </div>

            {activeTab === "BERHARI_HARI" || activeTab === "KELUAR_PARE" ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-[var(--color-text)] mb-1">Dari Tanggal</label>
                  <input type="date" required value={tanggalMulai} onChange={(e) => setTanggalMulai(e.target.value)} className="w-full px-4 py-3 border border-[var(--color-surface-dark)] rounded-xl focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] text-sm font-medium" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[var(--color-text)] mb-1">Sampai Tanggal</label>
                  <input type="date" required value={tanggalSelesai} onChange={(e) => setTanggalSelesai(e.target.value)} className="w-full px-4 py-3 border border-[var(--color-surface-dark)] rounded-xl focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] text-sm font-medium" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-[var(--color-text)] mb-1">Tanggal Izin</label>
                  <input type="date" required value={tanggalMulai} onChange={(e) => setTanggalMulai(e.target.value)} className="w-full px-4 py-3 border border-[var(--color-surface-dark)] rounded-xl focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] text-sm font-medium" />
                </div>
              </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 leading-relaxed mt-4">
              <strong>Info:</strong>
              {activeTab === "HARIAN" && kategoriHarian === "SEKOLAH" && " Izin otomatis berlaku untuk semua sesi kelas pada tanggal yang dipilih."}
              {activeTab === "HARIAN" && kategoriHarian === "KEGIATAN" && " Izin otomatis berlaku untuk absensi kegiatan pada tanggal yang dipilih."}
              {activeTab === "HARIAN" && kategoriHarian === "TABIROT" && " Izin otomatis berlaku untuk absensi Ta'birot pada tanggal/sesi ini."}
              {activeTab === "BERHARI_HARI" && " Izin otomatis berlaku untuk absensi Kelas, Sakan, Kegiatan, dan Ta'birot pada rentang tanggal yang dipilih."}
              {activeTab === "KELUAR_PARE" && ` Izin keluar Pare otomatis mengizinkan santri di absen Kelas, Sakan, Kegiatan & Ta'birot pada tanggal tersebut. Batas waktu kepulangan akan diset ke jam ${globalBatasJamAkhir} WIB.`}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-4 flex items-center justify-center gap-2 bg-[var(--color-primary)] text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
              {isSubmitting ? "Memproses..." : "Buat Tasrih Izin"}
            </button>
          </form>
        </div>
      </div>

    </div>
  );
}
