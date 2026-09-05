"use client";

import React, { useState, useEffect, Fragment } from "react";
import { useRouter } from "next/navigation";
import { GabunganTable } from "./gabungan-table";
import { calcMapelNilaiAkhir, calcAkumulatif, calcMapelNilaiAkhirUsbuain2 } from "@/lib/grade-calculator";

type MapelOption = {
  id: string;
  nama_indo: string;
  nama_arab: string;
  jumlah_tes: number;
  bulan_aktif?: number;
  jumlah_tes_b2?: number | null;
  bobot?: number;
  bobot_usbu?: number;
  masuk_akumulasi?: boolean;
};

type KelasOption = {
  id: string;
  nama: string;
};

type ProgramOption = {
  id: string;
  nama_indo: string;
  kkm: number;
  mapelList: MapelOption[];
  kelasList: KelasOption[];
};

type NilaiData = {
  u1: number | null;
  u2: number | null;
  n: number | null;
  a: number | null;
  tambahan: number;
};

type SantriRow = {
  riwayatId: string;
  santriId: string;
  nama: string;
  is_tasmi: boolean;
  jumlah_kolom_usbu: number;
  isCheckedOut?: boolean;
  nilai: Record<string, NilaiData>;
};

type ChangesRow = {
  is_tasmi?: boolean;
  jumlah_kolom_usbu?: number;
  nilai?: Record<string, Partial<NilaiData>>;
};

export function InputNilaiBulkClient({
  programList,
  allowedKelasId,
  isAdmin,
  activeFlags,
  hasUsbuainPermission
}: {
  programList: ProgramOption[];
  allowedKelasId: string | null;
  isAdmin: boolean;
  activeFlags: { u1: boolean; u2: boolean; u3: boolean };
  hasUsbuainPermission?: boolean;
}) {
  const router = useRouter();
  const [selectedKelasId, setSelectedKelasId] = useState<string>("");
  const [santriList, setSantriList] = useState<SantriRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [changes, setChanges] = useState<Record<string, ChangesRow>>({});
  const [akbarnasMonth, setAkbarnasMonth] = useState<1 | 2 | "gabungan">(1);

  // Filter program & kelas based on allowedKelasId
  const availablePrograms = programList.map(p => {
    return {
      ...p,
      kelasList: isAdmin ? p.kelasList : p.kelasList.filter(k => k.id === allowedKelasId)
    };
  }).filter(p => p.kelasList.length > 0);

  // Auto select class if only 1 is allowed
  useEffect(() => {
    if (!isAdmin && allowedKelasId) {
      setSelectedKelasId(allowedKelasId);
    }
  }, [isAdmin, allowedKelasId]);

  const selectedProgram = availablePrograms.find(p => p.kelasList.some(k => k.id === selectedKelasId));

  // Fetch data when Kelas or akbarnasMonth is selected
  useEffect(() => {
    if (selectedKelasId) {
      fetchData();
    } else {
      setSantriList([]);
      setChanges({});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKelasId, akbarnasMonth]);

  const fetchData = async () => {
    setIsLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/admin/input-nilai-kelas?kelasId=${selectedKelasId}&month=${akbarnasMonth}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Gagal mengambil data");
      const data = await res.json();
      setSantriList(data);
      setChanges({});
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat memuat data santri");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTasmiChange = (riwayatId: string, checked: boolean) => {
    setChanges(prev => ({
      ...prev,
      [riwayatId]: {
        ...prev[riwayatId],
        is_tasmi: checked
      }
    }));
  };

  const handleUsbuainChange = (riwayatId: string, value: number) => {
    setChanges(prev => ({
      ...prev,
      [riwayatId]: {
        ...(prev[riwayatId] || {}),
        jumlah_kolom_usbu: value
      }
    }));
  };

  const handleSetAllUsbuain = (value: number) => {
    setChanges(prev => {
      const newChanges = { ...prev };
      santriList.forEach(s => {
        newChanges[s.riwayatId] = {
          ...(newChanges[s.riwayatId] || {}),
          jumlah_kolom_usbu: value
        };
      });
      return newChanges;
    });
  };

  const handleNilaiChange = (riwayatId: string, mapelId: string, field: keyof NilaiData, value: number | null) => {
    setChanges(prev => {
      const rowChanges = prev[riwayatId] || {};
      const rowNilaiChanges = rowChanges.nilai || {};
      const mapelChanges = rowNilaiChanges[mapelId] || {};
      
      return {
        ...prev,
        [riwayatId]: {
          ...rowChanges,
          nilai: {
            ...rowNilaiChanges,
            [mapelId]: {
              ...mapelChanges,
              [field]: value
            }
          }
        }
      };
    });
  };

  const getTasmiVal = (row: SantriRow) => {
    if (changes[row.riwayatId] && changes[row.riwayatId].is_tasmi !== undefined) {
      return changes[row.riwayatId].is_tasmi;
    }
    return row.is_tasmi;
  };

  const getNilaiVal = (row: SantriRow, mapelId: string, field: keyof NilaiData) => {
    if (changes[row.riwayatId]?.nilai?.[mapelId]?.[field] !== undefined) {
      return changes[row.riwayatId].nilai![mapelId][field] as number | null;
    }
    return row.nilai?.[mapelId]?.[field] ?? null;
  };

  const handleSave = async () => {
    if (Object.keys(changes).length === 0) {
      setSuccess("Tidak ada perubahan untuk disimpan.");
      return;
    }

    setIsSaving(true);
    setError("");
    setSuccess("");

    const updates = Object.entries(changes).map(([riwayatId, partialUpdate]) => {
      return {
        riwayatId,
        ...partialUpdate
      };
    });

    try {
      const res = await fetch("/api/admin/input-nilai-kelas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates
        })
      });

      if (!res.ok) throw new Error("Gagal menyimpan data");
      
      setSuccess("Berhasil menyimpan seluruh nilai kelas.");
      setChanges({});
      // Refresh underlying data
      fetchData();
    } catch (err: any) {
      setError(err.message || "Gagal menyimpan data");
    } finally {
      setIsSaving(false);
    }
  };

  const isAkbarnas = selectedProgram?.nama_indo.toLowerCase().includes("akbarnas") ?? false;
  const isGabunganMode = isAkbarnas && akbarnasMonth === "gabungan";
  const kkm = selectedProgram?.kkm ?? 60;

  let mapels = selectedProgram?.mapelList || [];

  if (isAkbarnas && !isGabunganMode) {
    mapels = mapels.filter((mapel) => {
      if (akbarnasMonth === 2) {
        return mapel.bulan_aktif !== 1;
      } else {
        return mapel.bulan_aktif !== 2;
      }
    }).map((mapel) => {
      if (akbarnasMonth === 2 && mapel.jumlah_tes_b2 !== null && mapel.jumlah_tes_b2 !== undefined) {
        return { ...mapel, jumlah_tes: mapel.jumlah_tes_b2 };
      }
      return mapel;
    });
  } else if (isGabunganMode) {
    // Show all mapels with masuk_akumulasi for gabungan view
    mapels = mapels.filter(m => m.masuk_akumulasi !== false);
  }

  const getUsbuainVal = (row: SantriRow) => {
    if (changes[row.riwayatId] && changes[row.riwayatId].jumlah_kolom_usbu !== undefined) {
      return changes[row.riwayatId].jumlah_kolom_usbu;
    }
    return row.jumlah_kolom_usbu;
  };

  // Helper: compute summary for a santri row (used in both normal and gabungan mode)
  const computeSummary = (row: SantriRow) => {
    const mapelSummaries: { mapelId: string; nilaiAkhir: number; tambahan: number; final: number; belowKkm: boolean }[] = [];
    const akumulatifItems: { score: number; bobot: number }[] = [];
    const currentRowUsbuain = getUsbuainVal(row) ?? 0;

    const accMapels = (selectedProgram?.mapelList || []).filter(m => m.masuk_akumulasi !== false);

    for (const m of accMapels) {
      const nd = row.nilai?.[m.id];
      let nilaiAkhir = nd?.a ?? 0;
      const tambahan = changes[row.riwayatId]?.nilai?.[m.id]?.tambahan !== undefined
        ? (changes[row.riwayatId].nilai![m.id].tambahan as number)
        : (nd?.tambahan ?? 0);

      // For non-gabungan: compute from U1/U2/Nihai if nilaiAkhir not set
      if (!isGabunganMode && nilaiAkhir === 0) {
        if (m.jumlah_tes === 1 || currentRowUsbuain === 1) {
          nilaiAkhir = changes[row.riwayatId]?.nilai?.[m.id]?.n !== undefined 
            ? (changes[row.riwayatId].nilai![m.id].n as number) 
            : (nd?.n ?? 0);
        } else if (currentRowUsbuain === 2) {
          const u1 = changes[row.riwayatId]?.nilai?.[m.id]?.u1 !== undefined ? changes[row.riwayatId].nilai![m.id].u1 as number : (nd?.u1 ?? null);
          const u2 = changes[row.riwayatId]?.nilai?.[m.id]?.u2 !== undefined ? changes[row.riwayatId].nilai![m.id].u2 as number : (nd?.u2 ?? null);
          const calculated = calcMapelNilaiAkhirUsbuain2({ u1, u2 });
          if (calculated !== null) nilaiAkhir = calculated;
        } else {
          const u1 = changes[row.riwayatId]?.nilai?.[m.id]?.u1 !== undefined ? changes[row.riwayatId].nilai![m.id].u1 as number : (nd?.u1 ?? null);
          const u2 = changes[row.riwayatId]?.nilai?.[m.id]?.u2 !== undefined ? changes[row.riwayatId].nilai![m.id].u2 as number : (nd?.u2 ?? null);
          const n = changes[row.riwayatId]?.nilai?.[m.id]?.n !== undefined ? changes[row.riwayatId].nilai![m.id].n as number : (nd?.n ?? null);
          const calculated = calcMapelNilaiAkhir({ u1, u2, n }, isAkbarnas);
          if (calculated !== null) nilaiAkhir = calculated;
        }
      }

      const final_ = nilaiAkhir + tambahan;
      const bobot = m.bobot ?? 1;
      akumulatifItems.push({ score: final_, bobot });
      mapelSummaries.push({ mapelId: m.id, nilaiAkhir, tambahan, final: final_, belowKkm: final_ < kkm });
    }

    const rataRata = calcAkumulatif(akumulatifItems);
    const hasMusyarokah = mapelSummaries.some(s => s.belowKkm && s.nilaiAkhir > 0);
    return { mapelSummaries, rataRata, hasMusyarokah };
  };

  return (
    <div className="space-y-6">
      {/* Filter Section */}
      <section className="neu-card-white p-6">
        <div className="grid gap-6 md:grid-cols-2">
          <label className="space-y-2 text-sm font-semibold text-[var(--color-text)]">
            <span>Pilih Ruangan Kelas</span>
            <select
              value={selectedKelasId}
              onChange={(e) => setSelectedKelasId(e.target.value)}
              disabled={!isAdmin && !!allowedKelasId}
              className="w-full rounded-2xl border border-[var(--color-surface-dark)] bg-[var(--color-secondary)] px-4 py-3 text-base font-bold outline-none transition focus:border-[var(--color-primary)] focus:bg-white disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <option value="">-- Pilih Kelas --</option>
              {availablePrograms.map((p) => (
                <optgroup key={p.id} label={p.nama_indo}>
                  {p.kelasList.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          {isAkbarnas && (
            <label className="space-y-2 text-sm font-semibold text-[var(--color-text)]">
              <span>Bulan Pembelajaran (Khusus Akbarnas)</span>
              <select
                value={akbarnasMonth}
                onChange={(e) => {
                  const v = e.target.value;
                  setAkbarnasMonth(v === "gabungan" ? "gabungan" : Number(v) as 1 | 2);
                }}
                className="w-full rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-base font-bold text-indigo-900 outline-none transition focus:border-indigo-500 focus:bg-white"
              >
                <option value={1}>Bulan 1 (Riwayat Baru)</option>
                <option value={2}>Bulan 2 (Riwayat Lanjutan)</option>
                <option value="gabungan">📊 Gabungan (Final + Nilai Tambahan)</option>
              </select>
            </label>
          )}
        </div>
      </section>

      {/* Messages */}
      {error && <div className="rounded-3xl border border-[var(--color-danger)] bg-[var(--color-danger-light)] px-4 py-3 text-sm font-medium text-[var(--color-danger)]">{error}</div>}
      {success && <div className="rounded-3xl border border-[var(--color-primary-100)] bg-[var(--color-primary-50)] px-4 py-3 text-sm font-medium text-[var(--color-primary)]">{success}</div>}

      {/* Table Section */}
      {selectedKelasId && selectedProgram && (
        <section className="neu-card-white overflow-hidden flex flex-col">
          <div className="p-6 border-b border-[var(--color-surface)] flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-xl font-bold text-[var(--color-text)]">
                {isGabunganMode ? "📊 Ledger Final — Gabungan & Nilai Tambahan" : "Master Sheet Penilaian Kelas"}
              </h3>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                {isGabunganMode ? `KKM: ${kkm} — Klik kolom tambahan untuk menambah nilai (maks +5)` : "Gunakan tombol Tab untuk berpindah antar kolom secara cepat."}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {!isGabunganMode && isAdmin && (
                <div className="flex items-center gap-2 border border-[var(--color-surface-dark)] bg-white rounded-full px-3 py-1.5 shrink-0">
                  <span className="text-xs font-bold text-[var(--color-text-muted)]">Set Sekelas:</span>
                  <select 
                    onChange={(e) => handleSetAllUsbuain(Number(e.target.value))}
                    className="text-xs font-bold bg-transparent outline-none cursor-pointer text-[var(--color-primary)]"
                    defaultValue=""
                  >
                    <option value="" disabled>-- Pilih Mode --</option>
                    <option value={0}>Normal (3)</option>
                    <option value={2}>Usbuain (2)</option>
                    <option value={1}>Usbuain (1)</option>
                  </select>
                </div>
              )}
              <button
                onClick={handleSave}
                disabled={isSaving || Object.keys(changes).length === 0}
                className="rounded-full bg-[var(--color-primary)] px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-[var(--color-primary-dark)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
              >
                {isSaving ? "Menyimpan..." : "Simpan Semua Perubahan"}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto overflow-y-auto w-full custom-scrollbar" style={{ maxHeight: 'calc(100vh - 280px)' }}>
            {isGabunganMode ? (
              <GabunganTable mapels={mapels} santriList={santriList} isLoading={isLoading} kkm={kkm} changes={changes} computeSummary={computeSummary} handleNilaiChange={handleNilaiChange} />
            ) : (
            <table className="w-full text-left text-sm text-[var(--color-text-muted)] border-collapse min-w-max">
              <thead className="bg-[var(--color-secondary)] text-xs uppercase tracking-[0.1em] text-[var(--color-text-muted)] sticky top-0 z-30">
                <tr>
                  <th className="px-2 md:px-4 py-3 font-semibold text-center border-b border-[var(--color-surface-dark)] sticky left-0 bg-[var(--color-secondary)] z-20 border-r min-w-[40px] w-[40px] md:min-w-[50px] md:w-[50px]" rowSpan={2}>No</th>
                  <th className="px-3 md:px-4 py-3 font-semibold border-b border-[var(--color-surface-dark)] sticky left-[40px] md:left-[50px] bg-[var(--color-secondary)] z-20 border-r min-w-[140px] w-[140px] md:min-w-[250px] md:w-[250px] text-xs md:text-sm" rowSpan={2}>Nama Peserta Didik</th>
                  <th className="px-4 py-3 font-semibold text-center border-b border-r border-[var(--color-surface-dark)] md:sticky md:left-[300px] bg-[var(--color-secondary)] md:z-20 min-w-[80px] w-[80px]" rowSpan={2}>Tasmi'</th>
                  {mapels.map(m => (
                    <th key={m.id} className="px-2 py-2 font-bold text-center border-b border-r border-[var(--color-surface-dark)] bg-[var(--color-surface)]" colSpan={m.jumlah_tes === 3 ? 4 : 2}>
                      <div>{m.nama_indo}</div>
                    </th>
                  ))}
                  <th className="px-3 py-3 font-bold text-center border-b border-[var(--color-surface-dark)] bg-emerald-50 min-w-[65px]" rowSpan={2}>Rata²</th>
                  <th className="px-3 py-3 font-bold text-center border-b border-[var(--color-surface-dark)] bg-emerald-50 min-w-[90px]" rowSpan={2}>Status</th>
                </tr>
                <tr>
                  {mapels.map(m => {
                    if (m.jumlah_tes === 3) {
                      const wUsbu = m.bobot_usbu ?? 0;
                      const wNihai = m.bobot ?? 0;
                      return (
                        <Fragment key={`sub_${m.id}`}>
                          <th className="px-2 py-2 font-semibold text-center border-b border-[var(--color-surface-dark)] bg-[var(--color-secondary)] w-20 text-[10px]">
                            <div>U1</div>
                            <div className="text-[9px] text-[var(--color-text-subtle)] font-medium">({wUsbu}%)</div>
                          </th>
                          <th className="px-2 py-2 font-semibold text-center border-b border-[var(--color-surface-dark)] bg-[var(--color-secondary)] w-20 text-[10px]">
                            <div>U2</div>
                            <div className="text-[9px] text-[var(--color-text-subtle)] font-medium">({wUsbu}%)</div>
                          </th>
                          <th className="px-2 py-2 font-semibold text-center border-b border-[var(--color-surface-dark)] bg-[var(--color-secondary)] w-20 text-[10px]">
                            <div>Nihai</div>
                            <div className="text-[9px] text-[var(--color-primary)] font-bold">({wNihai}%)</div>
                          </th>
                          <th className="px-1 py-2 font-semibold text-center border-b border-r border-[var(--color-surface-dark)] bg-amber-50 w-[70px] text-[9px] text-amber-700">
                            <div>Rata</div>
                            <div className="text-[8px]">+Tambah</div>
                          </th>
                        </Fragment>
                      );
                    }
                    return (
                      <Fragment key={`sub_${m.id}`}>
                        <th className="px-2 py-2 font-semibold text-center border-b border-[var(--color-surface-dark)] bg-[var(--color-secondary)] w-24 text-[10px]">Akhir</th>
                        <th className="px-1 py-2 font-semibold text-center border-b border-r border-[var(--color-surface-dark)] bg-amber-50 w-[70px] text-[9px] text-amber-700"><div>+Tambah</div></th>
                      </Fragment>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-surface)]">
                {isLoading ? (
                  <tr><td colSpan={3 + mapels.reduce((a, b) => a + (b.jumlah_tes === 3 ? 3 : 1), 0)} className="text-center py-12 text-[var(--color-text-muted)]">Memuat data santri...</td></tr>
                ) : santriList.length === 0 ? (
                  <tr><td colSpan={3 + mapels.reduce((a, b) => a + (b.jumlah_tes === 3 ? 3 : 1), 0)} className="text-center py-12 text-[var(--color-text-muted)]">Tidak ada santri aktif di kelas ini.</td></tr>
                ) : (
                  santriList.map((row, index) => {
                    const tasmi = getTasmiVal(row);
                    const hasChange = !!changes[row.riwayatId];

                    return (
                      <tr key={row.riwayatId} className={`transition hover:bg-[var(--color-secondary)]/80 ${hasChange ? 'bg-[var(--color-warning-light)]/10' : ''} ${row.isCheckedOut ? 'bg-red-50/50 hover:bg-red-100' : ''}`}>
                        <td className={`px-2 md:px-4 py-2 text-center font-medium sticky left-0 z-10 border-r border-[var(--color-surface)] shadow-[1px_0_0_0_#f1f5f9] min-w-[40px] md:min-w-[50px] ${row.isCheckedOut ? 'bg-red-50 text-red-900' : 'bg-white text-[var(--color-text-subtle)]'}`}>{index + 1}</td>
                        <td className={`px-3 md:px-4 py-2 font-bold sticky left-[40px] md:left-[50px] z-10 border-r border-[var(--color-surface)] shadow-[1px_0_0_0_#f1f5f9] min-w-[140px] w-[140px] md:min-w-[250px] md:w-[250px] whitespace-normal leading-snug text-xs md:text-sm ${row.isCheckedOut ? 'text-red-900 bg-red-50' : 'text-[var(--color-text)] bg-white'}`}>
                          <div className="flex flex-col gap-1">
                            <span className="flex items-center gap-1.5 flex-wrap">
                              {row.nama}
                              {row.isCheckedOut && (
                                <span className="px-1 py-0.5 text-[8px] font-black tracking-wide bg-red-200 text-red-700 rounded-sm">CHECK OUT</span>
                              )}
                            </span>
                            {isAdmin && !row.isCheckedOut && (
                              <select 
                                value={getUsbuainVal(row) ?? 0}
                                onChange={(e) => handleUsbuainChange(row.riwayatId, Number(e.target.value))}
                                className="text-[10px] bg-slate-100 border border-slate-200 rounded px-1 py-0.5 outline-none max-w-[120px] text-[var(--color-text-muted)] cursor-pointer hover:bg-slate-200 focus:border-[var(--color-primary)]"
                              >
                                <option value={0}>Mode: Normal</option>
                                <option value={2}>Mode: Usbuain (2)</option>
                                <option value={1}>Mode: Usbuain (1)</option>
                              </select>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-center md:sticky md:left-[300px] bg-white md:z-10 border-r border-[var(--color-surface-dark)] md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] min-w-[80px]">
                          <label className="inline-flex cursor-pointer items-center justify-center w-full h-full">
                            <input 
                              type="checkbox" 
                              checked={tasmi}
                              disabled={row.isCheckedOut}
                              onChange={(e) => handleTasmiChange(row.riwayatId, e.target.checked)}
                              className="h-5 w-5 rounded border-[var(--color-surface-dark)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                          </label>
                        </td>
                        
                        {mapels.map(m => {
                          if (m.jumlah_tes === 3) {
                            const u1 = getNilaiVal(row, m.id, "u1");
                            const u2 = getNilaiVal(row, m.id, "u2");
                            const n = getNilaiVal(row, m.id, "n");
                            const curRowMode = getUsbuainVal(row) ?? 0;
                            return (
                              <Fragment key={`td_${m.id}`}>
                                <td className="px-1 py-2">
                                  {curRowMode === 1 ? (
                                    <div className="w-full rounded-lg bg-gray-50/50 px-2 py-1.5 text-center font-bold text-gray-300">X</div>
                                  ) : activeFlags.u1 ? (
                                    <input 
                                      type="number" min={0} max={100} 
                                      value={u1 === null ? "" : u1}
                                      disabled={row.isCheckedOut}
                                      onChange={(e) => handleNilaiChange(row.riwayatId, m.id, "u1", e.target.value === "" ? null : Number(e.target.value))}
                                      onWheel={(e) => e.currentTarget.blur()}
                                      className="w-full rounded-lg border border-[var(--color-surface-dark)] bg-white px-2 py-1.5 text-center font-bold text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-emerald-100 focus:bg-[var(--color-primary-50)]/30 hover:border-[var(--color-surface-dark)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500" 
                                    />
                                  ) : (
                                    <div className="w-full rounded-lg border border-[var(--color-surface)] bg-[var(--color-secondary)] px-2 py-1.5 text-center font-bold text-[var(--color-text-subtle)]">{u1 === null ? "-" : u1}</div>
                                  )}
                                </td>
                                <td className="px-1 py-2">
                                  {curRowMode === 1 ? (
                                    <div className="w-full rounded-lg bg-gray-50/50 px-2 py-1.5 text-center font-bold text-gray-300">X</div>
                                  ) : activeFlags.u2 ? (
                                    <input 
                                      type="number" min={0} max={100} 
                                      value={u2 === null ? "" : u2}
                                      disabled={row.isCheckedOut}
                                      onChange={(e) => handleNilaiChange(row.riwayatId, m.id, "u2", e.target.value === "" ? null : Number(e.target.value))}
                                      onWheel={(e) => e.currentTarget.blur()}
                                      className="w-full rounded-lg border border-[var(--color-surface-dark)] bg-white px-2 py-1.5 text-center font-bold text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-emerald-100 focus:bg-[var(--color-primary-50)]/30 hover:border-[var(--color-surface-dark)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500" 
                                    />
                                  ) : (
                                    <div className="w-full rounded-lg border border-[var(--color-surface)] bg-[var(--color-secondary)] px-2 py-1.5 text-center font-bold text-[var(--color-text-subtle)]">{u2 === null ? "-" : u2}</div>
                                  )}
                                </td>
                                <td className="px-1 py-2">
                                  {curRowMode === 2 ? (
                                    <div className="w-full rounded-lg bg-gray-50/50 px-2 py-1.5 text-center font-bold text-gray-300">X</div>
                                  ) : activeFlags.u3 ? (
                                    <input 
                                      type="number" min={0} max={100}
                                      value={n !== null ? n : ""}
                                      disabled={row.isCheckedOut}
                                      onChange={(e) => handleNilaiChange(row.riwayatId, m.id, "n", e.target.value === "" ? null : Number(e.target.value))}
                                      onFocus={(e) => e.target.select()}
                                      onWheel={(e) => e.currentTarget.blur()}
                                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-center text-sm font-bold text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] bg-white disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
                                    />
                                  ) : (
                                    <div className="w-full rounded-lg bg-gray-50/50 px-2 py-1.5 text-center font-bold text-gray-300">X</div>
                                  )}
                                </td>
                                {/* Rata + Tambahan column */}
                                {(() => {
                                  let avg = row.nilai?.[m.id]?.a ?? null;
                                  
                                  if (avg === null && curRowMode !== 1) {
                                    const u1 = getNilaiVal(row, m.id, "u1");
                                    const u2 = getNilaiVal(row, m.id, "u2");
                                    const n = getNilaiVal(row, m.id, "n");
                                    
                                    if (curRowMode === 2 && u1 !== null && u2 !== null) {
                                      avg = Number(((u1 * 0.4) + (u2 * 0.6)).toFixed(2));
                                    } else if (curRowMode === 0 && u1 !== null && u2 !== null && n !== null) {
                                      if (isAkbarnas) {
                                        avg = Number(((u1 + u2 + n) / 3).toFixed(2));
                                      } else {
                                        avg = Number(((u1 * 0.3) + (u2 * 0.3) + (n * 0.4)).toFixed(2));
                                      }
                                    }
                                  }

                                  const curTambahan = changes[row.riwayatId]?.nilai?.[m.id]?.tambahan !== undefined
                                    ? (changes[row.riwayatId].nilai![m.id].tambahan as number) : (row.nilai?.[m.id]?.tambahan ?? 0);
                                  const maxTambahan = 5;
                                  const exactFinal = avg !== null ? Number((avg + curTambahan).toFixed(2)) : null;
                                  const kkmDiff = avg !== null ? Math.max(0, Number((kkm - avg).toFixed(2))) : 0;
                                  return (
                                    <td className="px-0.5 py-1 border-r border-[var(--color-surface-dark)] bg-amber-50/30">
                                      {curRowMode === 1 ? (
                                        <div className="mb-0.5 px-0.5 text-center">
                                          {/* In mode 1, Nilai Akhir is determined entirely by Nihai */}
                                          <div className="w-full rounded px-1 py-1 text-xs font-bold text-gray-400">
                                            {getNilaiVal(row, m.id, "n") ?? "-"}
                                          </div>
                                        </div>
                                      ) : curRowMode === 2 ? (
                                        <div className="mb-0.5 px-0.5 text-center">
                                          <input 
                                            type="number" min={0} max={100}
                                            value={avg === null ? "" : Math.round(avg)}
                                            disabled={row.isCheckedOut}
                                            onChange={(e) => handleNilaiChange(row.riwayatId, m.id, "a", e.target.value === "" ? null : Number(e.target.value))}
                                            onWheel={(e) => e.currentTarget.blur()}
                                            placeholder="Nilai"
                                            className="w-full rounded border border-emerald-300 bg-white px-1 py-1 text-center text-[10px] font-bold text-emerald-800 outline-none focus:border-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
                                          />
                                        </div>
                                      ) : (
                                        <div className={`text-center text-[10px] font-bold mb-0.5 ${exactFinal !== null && exactFinal < kkm ? 'text-red-600' : 'text-[var(--color-text)]'}`}>
                                          {exactFinal !== null ? exactFinal : '-'}
                                        </div>
                                      )}
                                      {avg !== null && (
                                        <>
                                          <input type="number" min={0} max={maxTambahan} step="any"
                                            value={curTambahan || ""}
                                            placeholder="+"
                                            disabled={row.isCheckedOut}
                                            onChange={(e) => handleNilaiChange(row.riwayatId, m.id, "tambahan" as any, e.target.value === "" ? 0 : Math.min(maxTambahan, Math.max(0, Number(e.target.value))))}
                                            onWheel={(e) => e.currentTarget.blur()}
                                            className="w-full rounded border border-amber-300 bg-amber-50 px-0.5 py-0.5 text-center text-[10px] font-bold text-amber-800 outline-none focus:border-amber-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
                                          />
                                          {exactFinal !== null && exactFinal < kkm && kkmDiff > 0 && !row.isCheckedOut && (
                                            <button
                                              type="button"
                                              onClick={() => handleNilaiChange(row.riwayatId, m.id, "tambahan" as any, Number(kkmDiff.toFixed(2)))}
                                              className="w-full mt-0.5 rounded border border-blue-300 bg-blue-50 px-0.5 py-0 text-[8px] font-bold text-blue-700 hover:bg-blue-100 transition"
                                              title={`Sesuaikan KKM (+${kkmDiff})`}
                                            >
                                              ≈KKM
                                            </button>
                                          )}
                                        </>
                                      )}
                                    </td>
                                  );
                                })()}
                              </Fragment>
                            );
                          } else {
                            const a = getNilaiVal(row, m.id, "a");
                            const nd2 = row.nilai?.[m.id];
                            const curT = changes[row.riwayatId]?.nilai?.[m.id]?.tambahan !== undefined
                              ? (changes[row.riwayatId].nilai![m.id].tambahan as number) : (nd2?.tambahan ?? 0);
                            const maxT = 5;
                            const exactFinalT = a !== null ? Number((a + curT).toFixed(2)) : null;
                            const kkmDiffT = a !== null ? Math.max(0, Number((kkm - a).toFixed(2))) : 0;
                            return (
                              <Fragment key={`td_${m.id}`}>
                                <td className="px-1 py-2">
                                  <input 
                                    type="number" min={0} max={100} 
                                    value={a === null ? "" : a}
                                    disabled={row.isCheckedOut}
                                    onChange={(e) => handleNilaiChange(row.riwayatId, m.id, "a", e.target.value === "" ? null : Number(e.target.value))}
                                    onWheel={(e) => e.currentTarget.blur()}
                                    className="w-full rounded-lg border border-[var(--color-surface-dark)] bg-white px-2 py-1.5 text-center font-bold text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-emerald-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500" 
                                  />
                                </td>
                                <td className="px-0.5 py-1 border-r border-[var(--color-surface-dark)] bg-amber-50/30">
                                  {a !== null && (
                                    <>
                                      <input type="number" min={0} max={maxT} step="any"
                                        value={curT || ""} placeholder="+"
                                        disabled={row.isCheckedOut}
                                        onChange={(e) => handleNilaiChange(row.riwayatId, m.id, "tambahan" as any, e.target.value === "" ? 0 : Math.min(maxT, Math.max(0, Number(e.target.value))))}
                                        onWheel={(e) => e.currentTarget.blur()}
                                        className="w-full rounded border border-amber-300 bg-amber-50 px-0.5 py-0.5 text-center text-[10px] font-bold text-amber-800 outline-none focus:border-amber-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
                                      />
                                      {exactFinalT !== null && exactFinalT < kkm && kkmDiffT > 0 && !row.isCheckedOut && (
                                        <button
                                          type="button"
                                          onClick={() => handleNilaiChange(row.riwayatId, m.id, "tambahan" as any, Number(kkmDiffT.toFixed(2)))}
                                          className="w-full mt-0.5 rounded border border-blue-300 bg-blue-50 px-0.5 py-0 text-[8px] font-bold text-blue-700 hover:bg-blue-100 transition"
                                          title={`Sesuaikan KKM (+${kkmDiffT})`}
                                        >
                                          ≈KKM
                                        </button>
                                      )}
                                    </>
                                  )}
                                </td>
                              </Fragment>
                            );
                          }
                        })}
                        {/* Summary columns */}
                        {(() => { const s = computeSummary(row); return (<>
                          <td className="px-2 py-2 text-center font-extrabold text-sm bg-emerald-50/50">{s.rataRata > 0 ? Math.round(s.rataRata) : "-"}</td>
                          <td className="px-2 py-2 text-center bg-emerald-50/50">
                            {s.hasMusyarokah ? <span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-100 text-red-700">MUSYAROKAH</span>
                            : s.rataRata > 0 ? <span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-700">LULUS</span>
                            : <span className="text-[10px] text-gray-400">-</span>}
                          </td>
                        </>); })()}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            )}
          </div>
          
          <div className="p-4 bg-[var(--color-secondary)] border-t border-[var(--color-surface)] flex justify-end">
             <button
              onClick={handleSave}
              disabled={isSaving || Object.keys(changes).length === 0}
              className="rounded-full bg-[var(--color-primary)] px-8 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[var(--color-primary-dark)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "Menyimpan..." : "Simpan Semua Perubahan"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
