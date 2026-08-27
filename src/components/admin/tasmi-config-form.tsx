"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Info, Save, Loader2 } from "lucide-react";

type MapelOption = {
  id: string;
  nama_indo: string;
  jumlah_tes: number;
};

type ProgramOption = {
  id: string;
  nama_indo: string;
  mapelList: MapelOption[];
};

type TasmiConfig = {
  programId: string;
  mapelId: string;
  kolom: string;
};

export function TasmiConfigForm({ 
  programList, 
  existingConfig 
}: { 
  programList: ProgramOption[];
  existingConfig: TasmiConfig[];
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  
  // State: Set of "programId-mapelId-kolom" strings
  const [selectedConfigs, setSelectedConfigs] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    existingConfig.forEach(c => initial.add(`${c.programId}-${c.mapelId}-${c.kolom}`));
    return initial;
  });

  const handleToggle = (programId: string, mapelId: string, kolom: string) => {
    const key = `${programId}-${mapelId}-${kolom}`;
    setSelectedConfigs(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const configurations = Array.from(selectedConfigs).map(key => {
        const [programId, mapelId, kolom] = key.split("-");
        return { programId, mapelId, kolom };
      });

      const res = await fetch("/api/admin/tasmi-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configurations })
      });

      if (!res.ok) throw new Error("Gagal menyimpan konfigurasi");
      
      toast.success("Konfigurasi Tasmi berhasil disimpan");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-900 shadow-sm flex gap-3 items-start">
        <Info className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
        <div className="flex-1">
          <p className="font-bold text-blue-900 mb-1">Informasi Konfigurasi</p>
          <p className="leading-relaxed text-blue-800">
            Pilih kolom mana saja yang akan dijadikan sebagai syarat wajib selesainya Tasmi' santri. <br/>
            Contoh: Jika Anda mencentang "Usbu 1" dan "Usbu 2" pada mapel Imla', maka santri dikatakan sudah Tasmi' jika nilai Imla Usbu 1 dan Usbu 2 sudah terisi.
          </p>
        </div>
      </div>

      <div className="pb-24">
        {programList.map(program => (
          <div key={program.id} className="neu-card-white overflow-hidden mb-6">
            <div className="bg-[var(--color-secondary)] px-6 py-4 border-b border-[var(--color-surface-dark)]">
              <h3 className="font-bold text-[var(--color-text)] text-lg">{program.nama_indo}</h3>
            </div>
            <div className="p-0">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--color-surface)]">
                  <tr>
                    <th className="px-6 py-3 font-semibold text-[var(--color-text-muted)] w-1/2">Mata Pelajaran</th>
                    <th className="px-6 py-3 font-semibold text-[var(--color-text-muted)] text-center">Kolom Tasmi'</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-surface)]">
                  {program.mapelList.map(mapel => (
                    <tr key={mapel.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3 font-bold text-[var(--color-text)]">
                        {mapel.nama_indo}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center justify-center gap-4">
                          {mapel.jumlah_tes === 3 ? (
                            <>
                              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-100">
                                <input 
                                  type="checkbox" 
                                  checked={selectedConfigs.has(`${program.id}-${mapel.id}-u1`)}
                                  onChange={() => handleToggle(program.id, mapel.id, 'u1')}
                                  className="h-4 w-4 rounded border-slate-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                                />
                                <span className="font-medium text-slate-700">Usbu' 1</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-100">
                                <input 
                                  type="checkbox" 
                                  checked={selectedConfigs.has(`${program.id}-${mapel.id}-u2`)}
                                  onChange={() => handleToggle(program.id, mapel.id, 'u2')}
                                  className="h-4 w-4 rounded border-slate-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                                />
                                <span className="font-medium text-slate-700">Usbu' 2</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-100">
                                <input 
                                  type="checkbox" 
                                  checked={selectedConfigs.has(`${program.id}-${mapel.id}-n`)}
                                  onChange={() => handleToggle(program.id, mapel.id, 'n')}
                                  className="h-4 w-4 rounded border-slate-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                                />
                                <span className="font-medium text-slate-700">Nihai</span>
                              </label>
                            </>
                          ) : (
                            <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-100">
                              <input 
                                type="checkbox" 
                                checked={selectedConfigs.has(`${program.id}-${mapel.id}-n`)}
                                onChange={() => handleToggle(program.id, mapel.id, 'n')}
                                className="h-4 w-4 rounded border-slate-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                              />
                              <span className="font-medium text-slate-700">Nilai Langsung / Nihai</span>
                            </label>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {program.mapelList.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-6 py-6 text-center text-slate-400">
                        Belum ada mapel di program ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Floating Action Bar */}
      <div className="fixed bottom-0 left-0 lg:left-72 right-0 z-20 border-t border-[var(--color-surface-dark)] bg-white/80 p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-[var(--color-text)]">Konfigurasi Tasmi'</p>
            <p className="text-xs text-[var(--color-text-muted)]">Pastikan setidaknya satu mapel/kolom dipilih agar automasi berfungsi.</p>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-[var(--color-primary-dark)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving ? "Menyimpan..." : "Simpan Konfigurasi"}
          </button>
        </div>
      </div>
    </div>
  );
}
