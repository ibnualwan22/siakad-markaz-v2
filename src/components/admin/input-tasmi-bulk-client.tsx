"use client";

import React, { useState, useEffect } from "react";
import { Loader2, Save, AlertCircle, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";

type MapelOption = {
  id: string;
  nama_indo: string;
};

type KelasOption = {
  id: string;
  nama: string;
};

type ProgramOption = {
  id: string;
  nama_indo: string;
  mapelList: MapelOption[];
  kelasList: KelasOption[];
};

type TasmiConfig = {
  id: string;
  programId: string;
  mapelId: string;
  kolom: string; // 'u1', 'u2', 'n'
};

type NilaiData = {
  u1: number | null;
  u2: number | null;
  n: number | null;
};

type SantriRow = {
  riwayatId: string;
  santriId: string;
  nama: string;
  is_tasmi: boolean;
  auto_qualifies: boolean;
  isCheckedOut?: boolean;
  nilai: Record<string, NilaiData>;
};

type ChangesRow = {
  is_tasmi?: boolean; // When manual overridden by admin
  is_tasmi_auto?: boolean; // Internal flag to trigger auto calculation on backend
  nilai?: Record<string, Partial<NilaiData>>;
};

export function InputTasmiBulkClient({
  programList,
  allowedKelasId,
  isAdmin,
  hasEditPermission
}: {
  programList: ProgramOption[];
  allowedKelasId: string | null;
  isAdmin: boolean;
  hasEditPermission: boolean;
}) {
  const [selectedKelasId, setSelectedKelasId] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("1");
  const [santriList, setSantriList] = useState<SantriRow[]>([]);
  const [tasmiConfigs, setTasmiConfigs] = useState<TasmiConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [changes, setChanges] = useState<Record<string, ChangesRow>>({});

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

  // Fetch data when Kelas or Month is selected
  useEffect(() => {
    if (selectedKelasId) {
      fetchData();
    } else {
      setSantriList([]);
      setTasmiConfigs([]);
      setChanges({});
    }
  }, [selectedKelasId, selectedMonth]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/input-tasmi?kelasId=${selectedKelasId}&month=${selectedMonth}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Gagal mengambil data");
      const data = await res.json();
      setTasmiConfigs(data.tasmiConfigs || []);
      setSantriList(data.santriList || []);
      setChanges({});
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan saat memuat data santri");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTasmiOverrideChange = (riwayatId: string, checked: boolean) => {
    if (!hasEditPermission) return;
    setChanges(prev => ({
      ...prev,
      [riwayatId]: {
        ...prev[riwayatId],
        is_tasmi: checked,
        is_tasmi_auto: false
      }
    }));
  };

  const handleNilaiChange = (riwayatId: string, mapelId: string, field: keyof NilaiData, value: number | null) => {
    setChanges(prev => {
      const rowChanges = prev[riwayatId] || {};
      const currentNilai = rowChanges.nilai || {};
      const currentMapel = currentNilai[mapelId] || {};

      return {
        ...prev,
        [riwayatId]: {
          ...rowChanges,
          is_tasmi_auto: true, // Mark this for auto calculation
          nilai: {
            ...currentNilai,
            [mapelId]: {
              ...currentMapel,
              [field]: value
            }
          }
        }
      };
    });
  };

  const handleSave = async () => {
    if (Object.keys(changes).length === 0) return;
    
    setIsSaving(true);
    try {
      const updates = Object.entries(changes).map(([riwayatId, payload]) => ({
        riwayatId,
        ...payload
      }));

      const res = await fetch("/api/admin/input-tasmi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kelasId: selectedKelasId, month: selectedMonth, updates }),
      });

      if (!res.ok) throw new Error("Gagal menyimpan data");
      
      toast.success("Berhasil menyimpan data tasmi'");
      fetchData(); // reload to get new auto_qualifies
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan data");
    } finally {
      setIsSaving(false);
    }
  };

  const getColTitle = (kolom: string) => {
    if (kolom === 'u1') return "Usbu' 1";
    if (kolom === 'u2') return "Usbu' 2";
    if (kolom === 'n') return "Nihai";
    return "";
  };

  const mapMapelIdToName = (id: string) => {
    return selectedProgram?.mapelList.find(m => m.id === id)?.nama_indo || "Unknown";
  };

  const hasUnsavedChanges = Object.keys(changes).length > 0;
  
  const isAkbarnas = selectedProgram?.nama_indo.toLowerCase().includes("akbarnas");

  return (
    <div className="space-y-6 pb-24">
      {/* Control Panel */}
      <div className="neu-card-white flex flex-wrap items-end gap-6 border border-slate-200 p-6">
        <div className="flex-1 min-w-[200px]">
          <label className="mb-2 block text-sm font-bold text-slate-700">Pilih Kelas</label>
          <select
            className="neu-input w-full bg-slate-50 text-[var(--color-primary)] font-bold text-lg cursor-pointer hover:bg-slate-100 transition"
            value={selectedKelasId}
            onChange={(e) => setSelectedKelasId(e.target.value)}
            disabled={!isAdmin && !!allowedKelasId}
          >
            <option value="" disabled>-- Pilih Kelas --</option>
            {availablePrograms.map(p => (
              <optgroup key={p.id} label={p.nama_indo}>
                {p.kelasList.map(k => (
                  <option key={k.id} value={k.id}>{k.nama}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {isAkbarnas && (
          <div className="flex-1 min-w-[200px]">
            <label className="mb-2 block text-sm font-bold text-slate-700">Bulan Pembelajaran (Khusus Akbarnas)</label>
            <select
              className="neu-input w-full bg-slate-50 text-[var(--color-primary)] font-bold text-lg cursor-pointer hover:bg-slate-100 transition"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              <option value="1">Bulan 1 (Riwayat Baru)</option>
              <option value="2">Bulan 2 (Riwayat Aktif)</option>
            </select>
          </div>
        )}
      </div>

      {selectedProgram && !isLoading && tasmiConfigs.length === 0 && (
         <div className="neu-card-white border border-amber-200 bg-amber-50 p-6 text-center text-amber-800">
           Belum ada konfigurasi kolom tasmi' untuk program ini. Hubungi Administrator atau atur di halaman <span className="font-bold">Konfigurasi Tasmi'</span>.
         </div>
      )}

      {selectedProgram && !isLoading && tasmiConfigs.length > 0 && (
        <div className="neu-card-white overflow-hidden border border-[var(--color-surface-dark)] p-0">
          <div className="overflow-x-auto w-full custom-scrollbar">
            <table className="w-full text-left text-sm text-[var(--color-text)] whitespace-nowrap min-w-max">
              <thead className="bg-[var(--color-surface)] sticky top-0 z-20 shadow-sm">
                <tr>
                  <th className="sticky left-0 bg-[var(--color-surface)] px-4 md:px-6 py-4 font-bold min-w-[140px] w-[140px] max-w-[140px] md:min-w-[250px] md:w-[250px] md:max-w-[250px] z-20 border-r border-[var(--color-surface-dark)]">NAMA SANTRI</th>
                  {tasmiConfigs.map(config => (
                    <th key={config.id} className="px-6 py-4 font-bold border-l border-slate-300 text-center min-w-[120px]">
                      <div className="text-xs text-[var(--color-text-muted)] tracking-wider uppercase mb-1">
                        {mapMapelIdToName(config.mapelId)}
                      </div>
                      <div className="text-[var(--color-primary)]">
                        {getColTitle(config.kolom)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {santriList.map(santri => {
                  const riwayatChanges = changes[santri.riwayatId] || {};
                  // The actual display value checks for override first, then falls back to auto_qualify or current DB state
                  const isOverridden = riwayatChanges.is_tasmi !== undefined;
                  const displayTasmi = isOverridden ? riwayatChanges.is_tasmi : santri.is_tasmi;
                  
                  return (
                    <tr key={santri.santriId} className={`hover:bg-slate-50 transition-colors ${santri.isCheckedOut ? 'opacity-60 bg-red-50/50 grayscale-[50%]' : ''}`}>
                      <td className="sticky left-0 bg-white px-3 md:px-6 py-4 group-hover:bg-slate-50 border-r border-slate-200 z-10 min-w-[140px] w-[140px] max-w-[140px] md:min-w-[250px] md:w-[250px] md:max-w-[250px]">
                         <div className="font-bold truncate" title={santri.nama}>
                            {santri.nama} {santri.isCheckedOut && <span className="text-red-500 text-xs ml-1">(Out)</span>}
                         </div>
                      </td>
                      {tasmiConfigs.map(config => {
                        const mapelNilai = santri.nilai[config.mapelId] || { u1: null, u2: null, n: null };
                        const changesForMapel = riwayatChanges.nilai?.[config.mapelId] || {};
                        const val = (changesForMapel[config.kolom as keyof NilaiData] !== undefined) 
                                      ? changesForMapel[config.kolom as keyof NilaiData] 
                                      : mapelNilai[config.kolom as keyof NilaiData];
                        const isEdited = changesForMapel[config.kolom as keyof NilaiData] !== undefined;

                        return (
                          <td key={config.id} className={`px-4 py-3 border-l border-slate-100 text-center ${isEdited ? 'bg-amber-50/50' : ''}`}>
                             <input 
                                type="number" 
                                min={0} 
                                max={100} 
                                value={val === null ? "" : val}
                                onChange={(e) => {
                                  const numVal = e.target.value === "" ? null : Number(e.target.value);
                                  handleNilaiChange(santri.riwayatId, config.mapelId, config.kolom as keyof NilaiData, numVal);
                                }}
                                disabled={santri.isCheckedOut}
                                className={`neu-input w-20 text-center font-bold text-lg p-2 ${
                                  val === null || (val as any) === "" 
                                    ? "bg-rose-50 border-rose-200 text-rose-700" 
                                    : "bg-emerald-50 border-emerald-200 text-emerald-700"
                                } disabled:opacity-50`}
                                placeholder="-"
                                onWheel={(e) => (e.target as HTMLElement).blur()}
                             />
                          </td>
                        )
                      })}
                    </tr>
                  );
                })}
                {santriList.length === 0 && (
                  <tr>
                    <td colSpan={tasmiConfigs.length + 1} className="px-6 py-12 text-center text-slate-400">
                      Data santri tidak ditemukan untuk kelas ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
        </div>
      )}

      {/* Floating Action Bar */}
      {selectedKelasId && (
        <div className="fixed bottom-0 left-0 lg:left-72 right-0 z-20 border-t border-[var(--color-surface-dark)] bg-white/80 p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div>
              {hasUnsavedChanges ? (
                <div className="flex items-center gap-2 text-amber-600 font-medium">
                  <AlertCircle className="h-5 w-5" />
                  Ada perubahan yang belum disimpan
                </div>
              ) : (
                <p className="text-sm font-medium text-slate-500">Semua perubahan telah disimpan</p>
              )}
            </div>
            
            <button
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
              className="flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-[var(--color-primary-dark)] disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-300"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSaving ? "Menyimpan Data..." : "Simpan Data Tasmi'"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
