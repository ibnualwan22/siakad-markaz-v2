"use client";

import { useState, useEffect, useMemo } from "react";
import { Save, CheckCircle2, Search } from "lucide-react";
import toast from "react-hot-toast";

export default function InputNilaiTauziClient({ userName }: { userName: string }) {
  const [sesiList, setSesiList] = useState<any[]>([]);
  const [programList, setProgramList] = useState<any[]>([]);
  const [selectedSesi, setSelectedSesi] = useState("");
  const [selectedProgram, setSelectedProgram] = useState("");
  const [selectedKategori, setSelectedKategori] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  const [pesertaList, setPesertaList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);

  // States to keep track of changes
  const [editedData, setEditedData] = useState<{ [id: string]: any }>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    if (selectedSesi) {
      if (debouncedSearch.trim() !== "" || selectedProgram) {
        fetchPeserta();
      }
    } else {
      setPesertaList([]);
    }
  }, [selectedSesi, selectedProgram, debouncedSearch]);

  const fetchInitialData = async () => {
    try {
      const [sesiRes, progRes] = await Promise.all([
        fetch("/api/admin/tauzi/sesi"),
        fetch("/api/admin/program?bypassFilter=true")
      ]);
      const sesiData = await sesiRes.json();
      const progData = await progRes.json();
      setSesiList(sesiData || []);
      setProgramList(progData || []);
      
      const activeSesi = sesiData?.find((s: any) => s.isActive);
      if (activeSesi) setSelectedSesi(activeSesi.id);
      else if (sesiData?.length > 0) setSelectedSesi(sesiData[0].id);
      
      if (progData?.length > 0) setSelectedProgram(progData[0].id);
    } catch {
      toast.error("Gagal load initial data");
    } finally {
      setLoading(false);
    }
  };

  const fetchPeserta = async () => {
    setLoadingData(true);
    try {
      let url = `/api/admin/tauzi/peserta?sesiTauziId=${selectedSesi}`;
      if (debouncedSearch.trim() !== "") {
        url += `&search=${encodeURIComponent(debouncedSearch.trim())}`;
      } else if (selectedProgram) {
        url += `&programId=${selectedProgram}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setPesertaList(data);
        setEditedData({});
      } else {
        setPesertaList([]);
      }
    } catch {
      toast.error("Gagal load data peserta");
    } finally {
      setLoadingData(false);
    }
  };

  const handleInputChange = (id: string, field: string, value: any) => {
    setEditedData(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [field]: value
      }
    }));
  };

  const handleSaveNilai = async (pesertaId: string) => {
    const dataToSave = editedData[pesertaId] || {};

    setSavingId(pesertaId);
    try {
      // Dapatkan data eksisting untuk field yang tidak diubah
      const existing = pesertaList.find(p => p.id === pesertaId);
      const payload = {
        id: pesertaId,
        santriId: existing.santriId || (existing.santri && existing.santri.id),
        sesiTauziId: existing.sesiTauziId || selectedSesi,
        programId: existing.programId || selectedProgram,
        // Jika nilai tidak diubah, ambil dari database, ATAU abaikan.
        nilaiMuqobalah: dataToSave.nilaiMuqobalah !== undefined ? dataToSave.nilaiMuqobalah : existing.nilaiMuqobalah,
        // Fallback untuk program rekomendasi jika kosong adalah program awal peserta (sesuai req user)
        programRekomendasiId: dataToSave.programRekomendasiId !== undefined ? dataToSave.programRekomendasiId : (existing.programRekomendasiId || existing.programId || selectedProgram),
        // Fallback untuk penyimak otomatis menggunakan nama user saat ini
        penyimakNama: dataToSave.penyimakNama !== undefined ? dataToSave.penyimakNama : (existing.penyimakNama || userName),
      };

      const res = await fetch("/api/admin/tauzi/nilai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error((await res.json()).error);
      
      toast.success("Tersimpan");
      // Update local state by re-fetching
      fetchPeserta();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan");
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveAll = async () => {
    const ids = Object.keys(editedData);
    if (ids.length === 0) return;
    setLoadingData(true);
    let allOk = true;
    for (const id of ids) {
      const p = pesertaList.find(x => x.id === id);
      if (!p) continue;
      const dataToSave = editedData[id];
      const payload = {
        id: p.id,
        santriId: p.santri.id,
        sesiTauziId: selectedSesi,
        programId: p.programId || p.currentProgram?.id,
        nilaiMuqobalah: dataToSave.nilaiMuqobalah !== undefined ? parseFloat(dataToSave.nilaiMuqobalah) : (p.nilaiMuqobalah || 0),
        programRekomendasiId: dataToSave.programRekomendasiId !== undefined ? dataToSave.programRekomendasiId : (p.programRekomendasiId || p.programId),
        penyimakNama: dataToSave.penyimakNama !== undefined ? dataToSave.penyimakNama : (p.penyimakNama || userName),
      };
      
      try {
        const res = await fetch("/api/admin/tauzi/nilai", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!res.ok) allOk = false;
      } catch {
        allOk = false;
      }
    }
    setLoadingData(false);
    if (!allOk) toast.error("Beberapa baris gagal disimpan");
    else {
      toast.success("Semua perubahan berhasil disimpan (Batch)");
      setEditedData({});
      fetchPeserta();
    }
  };

  const filteredPeserta = useMemo(() => {
    let result = pesertaList;
    if (search) {
      result = result.filter(p => p.santri.nama.toLowerCase().includes(search.toLowerCase()));
    }
    if (selectedKategori === "baru") {
      result = result.filter(p => p.santri.bulanKe === 1);
    } else if (selectedKategori === "lama") {
      result = result.filter(p => p.santri.bulanKe !== 1);
    }
    return result;
  }, [pesertaList, search, selectedKategori]);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display" style={{ color: "var(--color-text)" }}>Input Nilai Muqobalah</h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-subtle)" }}>Masukkan nilai tes lisan dan rekomendasi kelas.</p>
        </div>
      </div>

      <div className="mb-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="neu-card p-4 rounded-xl flex-1">
            <label className="block text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--color-text-muted)" }}>Sesi Tauzi'</label>
            <select value={selectedSesi} onChange={e => setSelectedSesi(e.target.value)} className="neu-input w-full py-2.5 text-sm font-semibold">
              {sesiList.map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
            </select>
          </div>
          <div className="neu-card p-4 rounded-xl flex-1">
            <label className="block text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--color-text-muted)" }}>Kategori Santri (Durasi)</label>
            <select value={selectedKategori} onChange={e => setSelectedKategori(e.target.value)} className="neu-input w-full py-2.5 text-sm font-semibold">
               <option value="all">Semua Kategori</option>
               <option value="baru">Santri Baru (Bulan 1)</option>
               <option value="lama">Santri Lama (Bulan {'>'} 1)</option>
            </select>
          </div>
          <div className="neu-card p-4 rounded-xl flex-1">
            <label className="block text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--color-text-muted)" }}>Cari Nama Santri</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-subtle)]" />
              <input
                type="text"
                placeholder="Cari santri..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-surface-dark)] bg-white pl-9 pr-4 py-2 font-semibold outline-none transition focus:border-[var(--color-primary)] text-sm"
              />
            </div>
          </div>
        </div>

        {/* Horizontal Navigation Tabs for Program */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none mb-4">
          <button 
            onClick={() => setSelectedProgram("")}
            className={`flex-shrink-0 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${selectedProgram === "" ? "bg-amber-400 text-amber-950 shadow-md" : "bg-white border text-gray-500 hover:bg-gray-50"}`}
          >
            Semua Program
          </button>
          <button 
            onClick={() => setSelectedProgram("none")}
            className={`flex-shrink-0 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${selectedProgram === "none" ? "bg-amber-400 text-amber-950 shadow-md" : "bg-white border text-gray-500 hover:bg-gray-50"}`}
          >
            Belum Memilih Program
          </button>
          {programList.map(p => (
            <button 
              key={p.id}
              onClick={() => setSelectedProgram(p.id)}
              className={`flex-shrink-0 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${selectedProgram === p.id ? "bg-amber-400 text-amber-950 shadow-md" : "bg-white border text-gray-500 hover:bg-gray-50"}`}
            >
              {p.nama_indo}
            </button>
          ))}
        </div>
      </div>

      <div className="neu-card rounded-2xl p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase" style={{ background: "var(--color-surface-hover)", color: "var(--color-text-subtle)" }}>
              <tr>
                <th className="px-4 py-4 font-bold rounded-tl-2xl w-12 text-center">No</th>
                <th className="px-4 py-4 font-bold">Santri</th>
                <th className="px-4 py-4 font-bold text-center w-28">N. Tahriri</th>
                <th className="px-4 py-4 font-bold text-center w-32">N. Muqobalah</th>
                <th className="px-4 py-4 font-bold w-48">Rekomendasi</th>
                <th className="px-4 py-4 font-bold w-40">Penyimak</th>
                <th className="px-4 py-4 font-bold text-center rounded-tr-2xl w-24">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loadingData ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500 font-medium">Memuat data...</td></tr>
              ) : filteredPeserta.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500 font-medium">Tidak ada santri yang ditemukan/mengambil ujian di program/sesi ini.</td></tr>
              ) : (
                filteredPeserta.map((p, idx) => {
                  const edited = editedData[p.id];
                  // Kami anggap ada changes jika diedit, ATAU belum pernah tersimpan penyimakNya/nilainya. Tetapi untuk amannya "Save" tombol aktif jika diubah
                  const hasChanges = edited !== undefined;
                  const currentMuqobalah = edited?.nilaiMuqobalah !== undefined ? edited.nilaiMuqobalah : (p.nilaiMuqobalah ?? "");
                  const currentRek = (edited?.programRekomendasiId !== undefined ? edited.programRekomendasiId : (p.programRekomendasiId ?? p.programId)) || "";
                  const currentPenyimak = edited?.penyimakNama !== undefined ? edited.penyimakNama : (p.penyimakNama || userName || "");

                  return (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors" style={{ borderColor: "var(--color-surface-hover)" }}>
                      <td className="px-4 py-4 text-center font-medium text-gray-500">{idx + 1}</td>
                      <td className="px-4 py-4">
                        <div className="font-bold whitespace-nowrap" style={{ color: "var(--color-text)" }}>{p.santri.nama}</div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${p.santri.gender === "BANIN" ? "bg-blue-100/70 text-blue-700" : "bg-pink-100/70 text-pink-700"}`}>
                            {p.santri.gender || '-'}
                          </span>
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${p.santri.bulanKe === 1 ? "bg-amber-100/70 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                            {p.santri.bulanKe === 1 ? "BARU" : "LAMA"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        {p.sudahUjian ? (
                          <span className="font-bold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg border border-blue-200">{p.nilaiTahriri}</span>
                        ) : (
                          <span className="text-[11px] text-gray-400 font-semibold bg-gray-100 px-2 py-1 rounded-md border border-gray-200">Belum Ujian</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <input 
                          type="number" max={100} min={0} 
                          className="neu-input w-full p-2 text-center text-sm font-bold placeholder-gray-300"
                          placeholder="0-100"
                          value={currentMuqobalah}
                          onChange={(e) => handleInputChange(p.id, "nilaiMuqobalah", e.target.value)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select 
                          className="neu-input w-full p-2 text-xs font-semibold"
                          value={currentRek}
                          onChange={(e) => handleInputChange(p.id, "programRekomendasiId", e.target.value)}
                        >
                          <option value="">-- Pilih Program --</option>
                          {programList.map(prog => <option key={prog.id} value={prog.id}>{prog.nama_indo}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input 
                          type="text" 
                          className="neu-input w-full p-2 text-xs font-semibold placeholder-gray-300"
                          placeholder="Nama Ustadz..."
                          value={currentPenyimak}
                          onChange={(e) => handleInputChange(p.id, "penyimakNama", e.target.value)}
                        />
                      </td>
                      <td className="px-4 py-4 text-center">
                        {/* Kami buat disable kalau tidak ada change, TETAPI kalau pengajar ingin nge-save default values, mereka memodifikasi input setidaknya sedikit - atau kita bisa buat selalu aktif */}
                        <button 
                          disabled={savingId === p.id}
                          onClick={() => handleSaveNilai(p.id)}
                          className={`p-2 rounded-xl transition-all border ${hasChanges ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-md' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'}`}
                          title={hasChanges ? "Simpan Perubahan" : "Simpan Form Saat Ini"}
                        >
                          {savingId === p.id ? <span className="animate-spin inline-block">⚙</span> : (hasChanges ? <Save size={16}/> : <Save size={16}/>)}
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Action Button for saving all dirty data */}
      {Object.keys(editedData).length > 0 && (
        <button
          onClick={handleSaveAll}
          title="Simpan Semua Perubahan"
          className="fixed bottom-6 right-6 z-50 flex items-center justify-center gap-2 bg-[var(--color-primary)] text-white shadow-xl shadow-blue-500/30 hover:scale-105 active:scale-95 transition-transform px-5 py-3.5 rounded-full font-bold text-sm"
        >
          {loadingData ? <span className="animate-spin inline-block">⚙</span> : <Save size={20} />}
          Simpan ({Object.keys(editedData).length})
        </button>
      )}
    </div>
  );
}
