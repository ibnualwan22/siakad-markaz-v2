"use client";

import { useMemo, useState } from "react";
import TemplateSyahadahOfflineTab from "./template-syahadah-offline-tab";
import {
  offlineMusyarokahProgramKey,
  offlineProgramKey,
} from "@/lib/syahadah-offline";
import { lembagaFromProgramKategori, lembagaLabel } from "@/lib/lembaga";

export type OfflineProgramOption = {
  id: string;
  nama_indo: string;
  nama_arab: string;
  kategori?: string;
  mapelList: Array<{
    id: string;
    nama_indo: string;
    nama_arab: string;
    urutan: number;
    jumlah_tes: number;
    tampil_di_syahadah: boolean;
    masuk_akumulasi: boolean;
    bobot: number;
    bobot_usbu: number;
    bulan_aktif: number;
    jumlah_tes_b2: number | null;
  }>;
};

type DesignVariant = "lulus" | "musyarokah";

export default function SyahadahOfflineClient({
  programs,
}: {
  programs: OfflineProgramOption[];
}) {
  // Urutkan program: Arabiyah -> Turats -> Hufadz lalu nama
  const sortedPrograms = useMemo(() => {
    const rank = (kat?: string) => {
      const l = lembagaFromProgramKategori(kat);
      return l === "ARABIYAH" ? 0 : l === "TURATS" ? 1 : 2;
    };
    return [...programs].sort(
      (a, b) =>
        rank(a.kategori) - rank(b.kategori) ||
        a.nama_indo.localeCompare(b.nama_indo, "id"),
    );
  }, [programs]);

  const [programId, setProgramId] = useState<string>(sortedPrograms[0]?.id || "");
  const [variant, setVariant] = useState<DesignVariant>("lulus");

  const program = useMemo(
    () => sortedPrograms.find((p) => p.id === programId) || sortedPrograms[0],
    [sortedPrograms, programId],
  );

  const lembaga = program
    ? lembagaFromProgramKategori(program.kategori)
    : "ARABIYAH";
  const isHufadz = lembaga === "HUFADZ";
  const isMusyarokah = variant === "musyarokah";

  const baseProgramKey = program ? offlineProgramKey(program.nama_indo) : "";
  const programKey = program
    ? isMusyarokah
      ? offlineMusyarokahProgramKey(program.nama_indo)
      : baseProgramKey
    : "";

  const tampilCount = program
    ? isHufadz
      ? 4
      : (program.mapelList ?? []).filter((m) => m.tampil_di_syahadah !== false)
          .length
    : 12;

  return (
    <div className="space-y-6 offline-print-reset">
      <div className="no-print bg-white rounded-2xl border p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 flex-1 min-w-[260px]">
            <h3 className="font-bold text-base">Pilih Program &amp; Varian Desain</h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              Setiap program memiliki 2 template F4 portrait (215 × 330 mm):{" "}
              <strong>Desain Lulus</strong> (kertas pre-printed) dan{" "}
              <strong>Desain Musyarokah</strong> (kertas polos, tanpa tabel mapel/nilai/predikat).
            </p>
            <select
              value={program?.id || ""}
              onChange={(e) => setProgramId(e.target.value)}
              className="w-full max-w-lg px-3.5 py-2.5 border rounded-xl font-bold bg-slate-50 focus:bg-white outline-none focus:border-[var(--color-primary)]"
            >
              {sortedPrograms.map((p) => {
                const l = lembagaFromProgramKategori(p.kategori);
                return (
                  <option key={p.id} value={p.id}>
                    [{lembagaLabel(l)}] {p.nama_indo}
                    {p.nama_arab ? ` — ${p.nama_arab}` : ""}
                  </option>
                );
              })}
            </select>
          </div>

          {program && (
            <div className="flex flex-col items-end gap-1.5">
              <a
                href={`/cetak-offline/tes/${programKey}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 shadow-sm"
              >
                🖨️ Buka Halaman Cetak Tes ({isMusyarokah ? "Musyarokah" : "Lulus"})
              </a>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Key: <code>{programKey}</code>
              </p>
            </div>
          )}
        </div>

        {/* 2 Design Tabs: Lulus vs Musyarokah */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setVariant("lulus")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold border transition ${
              variant === "lulus"
                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <span>Desain Lulus (Non-Musyarokah)</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                variant === "lulus"
                  ? "bg-white/20 text-white"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              Kertas Pre-Printed
            </span>
          </button>

          <button
            type="button"
            onClick={() => setVariant("musyarokah")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold border transition ${
              variant === "musyarokah"
                ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <span>Desain Musyarokah</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                variant === "musyarokah"
                  ? "bg-white/20 text-white"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              Kertas Polos · Tanpa Nilai
            </span>
          </button>
        </div>
      </div>

      {program && (
        <TemplateSyahadahOfflineTab
          key={programKey}
          programKey={programKey}
          baseProgramKey={baseProgramKey}
          programLabel={`${program.nama_indo} (${isMusyarokah ? "Musyarokah" : "Lulus"})`}
          apiBase="/api/admin/syahadah-offline/template"
          canEdit
          slotCount={tampilCount}
          isMusyarokah={isMusyarokah}
          isHufadz={isHufadz}
        />
      )}
    </div>
  );
}
