"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Download, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";

export default function HasilTauziPage({ hasEditAccess }: { hasEditAccess: boolean }) {
  const [sesiList, setSesiList] = useState<any[]>([]);
  const [programList, setProgramList] = useState<any[]>([]);
  const [selectedSesi, setSelectedSesi] = useState("");
  const [selectedProgram, setSelectedProgram] = useState("");
  const [selectedKategori, setSelectedKategori] = useState("all");
  
  const [pesertaList, setPesertaList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);

  // States to keep track of changes for inline-editing
  const [editedData, setEditedData] = useState<{ [id: string]: any }>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedSesi) {
      fetchPeserta();
    }
  }, [selectedSesi, selectedProgram]);

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
      
    } catch {
      toast.error("Gagal load initial data");
    } finally {
      setLoading(false);
    }
  };

  const fetchPeserta = async () => {
    setLoadingData(true);
    try {
      // Jika program null, ambil semua
      const url = selectedProgram 
        ? `/api/admin/tauzi/peserta?sesiTauziId=${selectedSesi}&programId=${selectedProgram}`
        : `/api/admin/tauzi/peserta?sesiTauziId=${selectedSesi}`;
      const res = await fetch(url);
      if (res.ok) {
        setPesertaList(await res.json());
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

  const filteredPesertaClient = pesertaList.filter(p => {
    if (selectedKategori === "baru" && p.santri?.bulanKe !== 1) return false;
    if (selectedKategori === "lama" && p.santri?.bulanKe === 1) return false;
    return true;
  });

  const handleExport = () => {
    if (filteredPesertaClient.length === 0) {
      toast.error("Tidak ada data untuk di-export");
      return;
    }

    const exportedData = filteredPesertaClient.map((p, index) => ({
      "No": index + 1,
      "Nama": p.santri.nama,
      "Nilai Tahriri": p.nilaiTahriri ?? "-",
      "Nilai Muqobalah": p.nilaiMuqobalah ?? "-",
      "Kategori": p.santri.bulanKe === 1 ? "Santri Baru" : "Santri Lama",
      "Program Pilihan": p.program?.nama_indo || "-",
      "Kelas": p.currentKelas?.nama || "-",
      "Program Rekomendasi": p.programRekomendasi?.nama_indo || "Belum ditentukan",
      "Penyimak": p.penyimakNama || "-"
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportedData);
    
    // Auto-size columns
    const cols = Object.keys(exportedData[0] || {}).map(key => ({ wch: Math.max(key.length, 15) }));
    worksheet["!cols"] = cols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Hasil Tauzi");
    
    const activeSesiName = sesiList.find(s => s.id === selectedSesi)?.nama || "Sesi";
    XLSX.writeFile(workbook, `Hasil_Tauzi_${activeSesiName.replace(/\s+/g, '_')}.xlsx`);
    toast.success("Berhasil mengekspor data");
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

  const performSave = async (id: string, p: any) => {
    const edit = editedData[id];
    if (!edit || Object.keys(edit).length === 0) return;

    setSavingId(id);
    try {
      const payload = {
        id: p.id,
        sesiTauziId: selectedSesi,
        santriId: p.santriId,
        programId: p.programId || p.currentProgram?.id,
        nilaiTahriri: edit.nilaiTahriri !== undefined ? edit.nilaiTahriri : p.nilaiTahriri,
        nilaiMuqobalah: edit.nilaiMuqobalah !== undefined ? edit.nilaiMuqobalah : p.nilaiMuqobalah,
        // Fallbacks since we only edit Nilai
        programRekomendasiId: p.programRekomendasiId,
        penyimakNama: p.penyimakNama
      };

      const res = await fetch("/api/admin/tauzi/nilai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Gagal menyimpan data");
      toast.success("Tersimpan!");
      
      // Update local state
      setPesertaList(prev => prev.map(item => {
        if (item.santriId === id) {
          return {
            ...item,
            nilaiTahriri: payload.nilaiTahriri,
            nilaiMuqobalah: payload.nilaiMuqobalah,
            sudahUjian: true
          };
        }
        return item;
      }));

      // Clear edit state
      setEditedData(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

    } catch (e: any) {
      toast.error(e.message || "Gagal menyimpan data");
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display" style={{ color: "var(--color-text)" }}>Laporan Hasil Tauzi'</h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-subtle)" }}>Lihat rekapitulasi nilai dan rekomendasi program santri.</p>
        </div>
        <button 
          onClick={handleExport}
          className="neu-button-primary font-bold text-sm px-5 py-2.5 rounded-xl flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
        >
          <FileSpreadsheet size={18} /> Export Excel
        </button>
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
                <th className="px-6 py-4 font-bold rounded-tl-2xl">Nama</th>
                <th className="px-6 py-4 font-bold text-center">N. Tahriri</th>
                <th className="px-6 py-4 font-bold text-center">N. Muqobalah</th>
                <th className="px-6 py-4 font-bold">Prog. Asal</th>
                <th className="px-6 py-4 font-bold">Kelas Rekomendasi</th>
                <th className="px-6 py-4 font-bold rounded-tr-2xl">Status</th>
              </tr>
            </thead>
            <tbody>
              {loadingData ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500 font-bold">Memuat data...</td></tr>
              ) : filteredPesertaClient.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500 font-bold">Tidak ada data santri terkait.</td></tr>
              ) : (
                filteredPesertaClient.map((p) => {
                  return (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors" style={{ borderColor: "var(--color-surface-hover)" }}>
                      <td className="px-6 py-4">
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
                      
                      <td className="px-6 py-4">
                        <div className="flex justify-center">
                          {hasEditAccess ? (
                             <input 
                               type="number"
                               className="neu-input w-20 py-1.5 px-2 text-center text-sm font-bold mx-auto border-dashed hover:border-blue-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                               placeholder="--"
                               value={(editedData[p.santriId] && 'nilaiTahriri' in editedData[p.santriId]) ? (editedData[p.santriId].nilaiTahriri ?? '') : (p.nilaiTahriri ?? '')}
                               onChange={(e) => handleInputChange(p.santriId, 'nilaiTahriri', e.target.value ? Number(e.target.value) : null)}
                               onBlur={() => performSave(p.santriId, p)}
                               onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
                               disabled={savingId === p.santriId}
                               style={{ opacity: savingId === p.santriId ? 0.5 : 1 }}
                             />
                          ) : (
                            p.nilaiTahriri !== null ? (
                              <span className="font-bold text-sm bg-gray-100 border border-gray-200 px-4 py-1.5 rounded-lg text-gray-700 shadow-sm">{p.nilaiTahriri}</span>
                            ) : (
                              <span className="text-[11px] font-bold text-gray-400 bg-gray-50 border border-gray-100 px-4 py-1.5 rounded-lg shadow-sm">Kosong</span>
                            )
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center">
                          {hasEditAccess ? (
                             <input 
                               type="number"
                               className="neu-input w-20 py-1.5 px-2 text-center text-sm font-bold mx-auto border-dashed hover:border-blue-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                               placeholder="--"
                               value={(editedData[p.santriId] && 'nilaiMuqobalah' in editedData[p.santriId]) ? (editedData[p.santriId].nilaiMuqobalah ?? '') : (p.nilaiMuqobalah ?? '')}
                               onChange={(e) => handleInputChange(p.santriId, 'nilaiMuqobalah', e.target.value ? Number(e.target.value) : null)}
                               onBlur={() => performSave(p.santriId, p)}
                               onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
                               disabled={savingId === p.santriId}
                               style={{ opacity: savingId === p.santriId ? 0.5 : 1 }}
                             />
                          ) : (
                            p.nilaiMuqobalah !== null ? (
                              <span className="font-bold text-sm bg-gray-100 border border-gray-200 px-4 py-1.5 rounded-lg text-gray-700 shadow-sm">{p.nilaiMuqobalah}</span>
                            ) : (
                              <span className="text-[11px] font-bold text-gray-400 bg-gray-50 border border-gray-100 px-4 py-1.5 rounded-lg shadow-sm">Kosong</span>
                            )
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600 font-medium">
                        <div className="font-bold">{p.program?.nama_indo || '-'}</div>
                        {p.currentKelas?.nama && (
                          <div className="text-xs bg-gray-100 mt-1 px-2 py-0.5 rounded inline-block text-gray-500 font-bold border border-gray-200">
                            {p.currentKelas.nama}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {p.programRekomendasi ? (
                          <div className="inline-flex items-center justify-between w-[200px] bg-white border border-gray-200 px-4 py-2.5 rounded-xl text-xs font-bold text-gray-700 shadow-sm">
                             <span className="truncate">{p.programRekomendasi.nama_indo}</span>
                             <span className="text-[9px] text-gray-400 ml-2 uppercase">▼</span>
                          </div>
                        ) : (
                           <div className="inline-flex items-center justify-between w-[200px] bg-gray-50 border border-gray-200 px-4 py-2.5 rounded-xl text-xs font-bold text-gray-400 shadow-sm opacity-60">
                             <span className="italic">Belum Direkomendasikan</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {p.sudahUjian || (p.nilaiTahriri !== null || p.nilaiMuqobalah !== null) ? (
                          <span className="text-[10px] font-bold bg-green-100 text-green-700 px-3 py-1.5 rounded-lg border border-green-200 uppercase tracking-widest">Selesai</span>
                        ) : (
                          <span className="text-[10px] font-bold bg-gray-100 text-gray-400 px-3 py-1.5 rounded-lg border border-gray-200 uppercase tracking-widest">Belum</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
