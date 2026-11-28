"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { sortSyahadahSantri } from "@/lib/syahadah-offline";
import {
  lembagaFromProgramKategori,
  type LembagaId,
} from "@/lib/lembaga";

type StatusKelulusan = "LULUS" | "TIDAK_LULUS" | "MUSYAROKAH";

type DashboardSantri = {
  id: string;
  nama: string;
  gender: string;
  lokasi: string;
  programNama: string;
  programId: string | null;
  programKategori?: string;
  kelasNama: string;
  kelasId: string | null;
  statusKelulusan: StatusKelulusan;
  nilaiAkumulatif: number;
  isBulanPertamaAkbarnas: boolean;
  isTasmi: boolean;
  canPrintSyahadah: boolean;
  canPrintMcSyahadah: boolean;
  mcRiwayatId: string | null;
  canViewIjazah: boolean;
  isAktif: boolean;
  juzTeks?: string | null;
};

type ProgramItem = {
  id: string;
  nama_indo: string;
  kategori?: string;
  kelasList: Array<{
    id: string;
    nama: string;
  }>;
};

function statusClass(status: string) {
  if (status === "LULUS") return "bg-[var(--color-primary-100)] text-[var(--color-primary)]";
  if (status === "MUSYAROKAH") return "bg-[var(--color-warning-light)] text-[var(--color-warning)]";
  return "bg-[var(--color-danger-light)] text-[var(--color-danger)]";
}

function lembagaDotClass(lembaga: LembagaId) {
  if (lembaga === "TURATS") return "bg-amber-400";
  if (lembaga === "HUFADZ") return "bg-emerald-400";
  return "bg-sky-400";
}

function IconCheck({ className }: { className?: string }) {
  return <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;
}
function IconAlert({ className }: { className?: string }) {
  return <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
}
function IconX({ className }: { className?: string }) {
  return <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}
function IconPrinter({ className }: { className?: string }) {
  return <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>;
}

export function SyahadahClient({
  santriRows,
  programList,
}: {
  santriRows: DashboardSantri[];
  programList: ProgramItem[];
}) {
  const [globalLembaga, setGlobalLembaga] = useState<"ALL" | LembagaId>("ALL");

  // Hitung jumlah Bulk Global (2 Fase: Lulus vs Musyarokah) sesuai filter lembaga
  const globalBulkStats = useMemo(() => {
    const scoped =
      globalLembaga === "ALL"
        ? santriRows
        : santriRows.filter(
            (s) => lembagaFromProgramKategori(s.programKategori) === globalLembaga,
          );
    const lulus = scoped.filter(
      (s) =>
        (s.canPrintSyahadah && s.statusKelulusan === "LULUS") ||
        s.canPrintMcSyahadah,
    ).length;
    const musyarokah = scoped.filter(
      (s) => s.canPrintSyahadah && s.statusKelulusan === "MUSYAROKAH",
    ).length;
    return { lulus, musyarokah, total: scoped.length };
  }, [santriRows, globalLembaga]);

  // Build class chips ordered Arabiyah -> Turats -> Hufadz
  const classChips = useMemo(() => {
    const lembagaRank = (l: LembagaId) =>
      l === "ARABIYAH" ? 0 : l === "TURATS" ? 1 : 2;
    const chips: {
      id: string;
      label: string;
      group: string;
      lembaga: LembagaId;
      count: number;
    }[] = [];

    for (const program of programList) {
      const lembaga = lembagaFromProgramKategori(program.kategori);
      if (program.kelasList.length > 0) {
        for (const k of program.kelasList) {
          const count = santriRows.filter((s) => s.kelasId === k.id).length;
          if (count > 0) {
            chips.push({
              id: k.id,
              label: k.nama,
              group: program.nama_indo,
              lembaga,
              count,
            });
          }
        }
      } else {
        const count = santriRows.filter(
          (s) => s.programId === program.id && !s.kelasId,
        ).length;
        if (count > 0) {
          chips.push({
            id: `PROGRAM_${program.id}`,
            label: program.nama_indo,
            group: "Program",
            lembaga,
            count,
          });
        }
      }
    }

    chips.sort(
      (a, b) =>
        lembagaRank(a.lembaga) - lembagaRank(b.lembaga) ||
        a.label.localeCompare(b.label, "id"),
    );

    const unassigned = santriRows.filter((s) => s.programId === null).length;
    if (unassigned > 0) {
      chips.push({
        id: "UNASSIGNED",
        label: "Belum Ditempatkan",
        group: "",
        lembaga: "ARABIYAH",
        count: unassigned,
      });
    }

    return chips;
  }, [santriRows, programList]);

  const [filterKelasId, setFilterKelasId] = useState<string>(
    classChips[0]?.id ?? "ALL",
  );

  const filteredSantri = useMemo(() => {
    return santriRows.filter((santri) => {
      if (filterKelasId === "ALL") return true;
      if (filterKelasId === "UNASSIGNED") return santri.programId === null;
      if (filterKelasId.startsWith("PROGRAM_")) {
        const programId = filterKelasId.replace("PROGRAM_", "");
        return santri.programId === programId;
      }
      return santri.kelasId === filterKelasId;
    });
  }, [santriRows, filterKelasId]);

  // Urutan resmi: Banin Lulus -> Banin Musyarokah -> Banin Tidak Lulus ->
  // Banat Lulus -> Banat Musyarokah -> Banat Tidak Lulus (nilai tertinggi -> terendah).
  const sortedSantri = useMemo(
    () => sortSyahadahSantri(filteredSantri),
    [filteredSantri],
  );

  // Compute stats for filtered class
  const stats = useMemo(() => {
    const lulus = filteredSantri.filter(
      (s) =>
        (s.canPrintSyahadah && s.statusKelulusan === "LULUS") ||
        s.canPrintMcSyahadah,
    ).length;
    const musyarokah = filteredSantri.filter(
      (s) => s.canPrintSyahadah && s.statusKelulusan === "MUSYAROKAH",
    ).length;
    const tidakLulus = filteredSantri.filter(
      (s) => s.statusKelulusan === "TIDAK_LULUS" && !s.canPrintMcSyahadah,
    ).length;
    const siapCetak = lulus + musyarokah;
    const totalTasmi = filteredSantri.filter((s) => s.isTasmi).length;
    return {
      lulus,
      musyarokah,
      tidakLulus,
      siapCetak,
      totalTasmi,
      total: filteredSantri.length,
    };
  }, [filteredSantri]);

  const canBulkCurrentClass =
    filterKelasId !== "ALL" && filterKelasId !== "UNASSIGNED";

  const globalLembagaQuery =
    globalLembaga === "ALL" ? "" : `&lembaga=${globalLembaga}`;

  return (
    <div className="space-y-5">
      {/* Cetak Bulk Global (2 Fase) */}
      <section className="neu-card-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-primary)]">
              Cetak Massal Global (F4 Portrait · 2 Fase)
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">
              Fase 1 mencetak semua santri <strong>Lulus</strong> (kertas pre-printed, tanpa background).
              Fase 2 mencetak semua santri <strong>Musyarokah</strong> (kertas polos, dengan background).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: "ALL" as const, label: "Semua" },
                { id: "ARABIYAH" as const, label: "Arabiyah" },
                { id: "TURATS" as const, label: "Turats" },
                { id: "HUFADZ" as const, label: "Hufadz" },
              ]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setGlobalLembaga(opt.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold border transition ${
                  globalLembaga === opt.id
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {opt.label}
              </button>
            ))}

            <a
              href={`/cetak-offline/bulk?mode=lulus${globalLembagaQuery}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 shadow-sm"
            >
              🖨️ Fase 1: Global Lulus ({globalBulkStats.lulus})
            </a>
            <a
              href={`/cetak-offline/bulk?mode=musyarokah${globalLembagaQuery}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-amber-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-amber-700 shadow-sm"
            >
              🖨️ Fase 2: Global Musyarokah ({globalBulkStats.musyarokah})
            </a>
          </div>
        </div>
      </section>

      {/* Class Chips */}
      <section className="neu-card-white overflow-hidden">
        <div className="px-6 py-5 border-b border-[var(--color-surface-dark)]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              Pilih Kelas / Ruangan
            </label>
            <div className="flex items-center gap-3 text-[11px] font-semibold text-[var(--color-text-muted)]">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-sky-400" /> Arabiyah
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-400" /> Turats
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> Hufadz
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {classChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setFilterKelasId(chip.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 border ${
                  filterKelasId === chip.id
                    ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-md shadow-emerald-200/50"
                    : "bg-[var(--color-secondary)] text-[var(--color-text)] border-[var(--color-surface-dark)] hover:border-[var(--color-primary-100)] hover:bg-white"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    filterKelasId === chip.id
                      ? "bg-white"
                      : lembagaDotClass(chip.lembaga)
                  }`}
                />
                <span>{chip.label}</span>
                <span
                  className={`inline-flex items-center justify-center rounded-full px-1.5 min-w-[20px] h-5 text-[10px] font-bold ${
                    filterKelasId === chip.id
                      ? "bg-white/20 text-white"
                      : "bg-[var(--color-surface)] text-[var(--color-text-muted)]"
                  }`}
                >
                  {chip.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Stats Bar */}
        <div className="px-6 py-4 flex flex-wrap items-center gap-x-6 gap-y-3 bg-[var(--color-surface)]/30">
          <div className="flex items-center gap-5 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-600">
                <IconCheck />
              </span>
              <span className="text-sm font-bold text-emerald-700">{stats.lulus}</span>
              <span className="text-xs text-[var(--color-text-muted)]">Lulus</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-600">
                <IconAlert />
              </span>
              <span className="text-sm font-bold text-amber-700">{stats.musyarokah}</span>
              <span className="text-xs text-[var(--color-text-muted)]">Musyarokah</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-600">
                <IconX />
              </span>
              <span className="text-sm font-bold text-red-700">{stats.tidakLulus}</span>
              <span className="text-xs text-[var(--color-text-muted)]">Tidak Lulus</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600">
                <IconPrinter />
              </span>
              <span className="text-sm font-bold text-blue-700">{stats.siapCetak}</span>
              <span className="text-xs text-[var(--color-text-muted)]">Siap Cetak</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 ml-auto">
            <Link
              href="/admin/input-nilai-kelas"
              className="rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-dark)] shadow-sm"
            >
              Input Nilai Masal
            </Link>
            <Link
              href="/admin/manajemen-kelas"
              className="rounded-full border border-[var(--color-surface-dark)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-text)] transition hover:border-[var(--color-primary-100)] hover:text-[var(--color-primary)]"
            >
              Atur Kelas
            </Link>
            <Link
              href="/admin/syahadah-offline"
              className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-[var(--color-info)] transition hover:border-blue-300 hover:bg-blue-100"
            >
              Layout Syahadah
            </Link>
            {canBulkCurrentClass && (
              <>
                <a
                  href={`/cetak-offline/bulk?kelasId=${encodeURIComponent(filterKelasId)}&mode=lulus`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 shadow-sm"
                >
                  Cetak Lulus ({stats.lulus})
                </a>
                <a
                  href={`/cetak-offline/bulk?kelasId=${encodeURIComponent(filterKelasId)}&mode=musyarokah`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 shadow-sm"
                >
                  Cetak Musyarokah ({stats.musyarokah})
                </a>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Table */}
      <section className="overflow-hidden neu-card-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--color-surface-dark)] text-left">
            <thead className="bg-[var(--color-secondary)] text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              <tr>
                <th className="px-4 py-4 text-center">#</th>
                <th className="px-6 py-4">Santri</th>
                <th className="px-6 py-4">Lokasi</th>
                <th className="px-6 py-4">Kelas</th>
                <th className="px-6 py-4">Tasmi&apos;</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Nilai Akumulatif</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-surface)] text-sm text-[var(--color-text-muted)]">
              {sortedSantri.map((santri, index) => {
                const isHufadz = santri.programKategori === "HUFADZ";
                const isMusyarokah = santri.statusKelulusan === "MUSYAROKAH";
                return (
                  <tr
                    key={santri.id}
                    className="align-top hover:bg-[var(--color-secondary)]/80"
                  >
                    {/* No urut */}
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-surface)] text-xs font-bold text-[var(--color-text-muted)]">
                        {index + 1}
                      </span>
                    </td>
                    {/* Nama */}
                    <td className="px-6 py-4">
                      <p className="font-bold text-[var(--color-text)]">{santri.nama}</p>
                      <p className="mt-1 text-xs font-medium uppercase tracking-[0.2em] text-[var(--color-text-subtle)]">
                        {santri.gender}
                      </p>
                    </td>
                    {/* Lokasi */}
                    <td className="px-6 py-4 text-[var(--color-text-muted)]">{santri.lokasi}</td>
                    {/* Kelas */}
                    <td className="px-6 py-4">
                      {santri.kelasId ? (
                        <div>
                          <span className="inline-flex rounded-full bg-[var(--color-surface)] px-3 py-1 text-xs font-bold text-[var(--color-text)]">
                            {santri.kelasNama}
                          </span>
                          {santri.programId && (
                            <p className="mt-1 text-xs text-[var(--color-text-subtle)]">
                              {santri.programNama}
                            </p>
                          )}
                        </div>
                      ) : santri.programId !== null ? (
                        <span className="inline-flex rounded-full bg-[var(--color-surface)] px-3 py-1 text-xs font-bold text-[var(--color-text)]">
                          {santri.programNama}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-[var(--color-danger-light)] px-3 py-1 text-xs font-bold text-[var(--color-danger)]">
                          Tanpa Kelas
                        </span>
                      )}
                    </td>
                    {/* Tasmi */}
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                          santri.isTasmi
                            ? "bg-[var(--color-primary-100)] text-[var(--color-primary)]"
                            : "bg-[var(--color-danger-light)] text-[var(--color-danger)]"
                        }`}
                      >
                        {santri.isTasmi ? "Sudah" : "Belum"}
                      </span>
                    </td>
                    {/* Status */}
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusClass(
                          santri.statusKelulusan,
                        )}`}
                      >
                        {santri.statusKelulusan}
                      </span>
                      {isHufadz && santri.juzTeks && (
                        <p className="mt-1 text-[11px] font-semibold text-emerald-700">
                          Juz: {santri.juzTeks}
                        </p>
                      )}
                    </td>
                    {/* Nilai Akumulatif */}
                    <td className="px-6 py-4">
                      <span className="font-bold text-[var(--color-text)]">
                        {santri.nilaiAkumulatif.toFixed(2)}
                      </span>
                    </td>
                    {/* Aksi */}
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link
                          href={
                            isHufadz
                              ? "/admin/munaqosah-hufadz"
                              : `/admin/input-nilai/${santri.id}`
                          }
                          className="rounded-full border border-[var(--color-surface-dark)] px-4 py-2 text-xs font-bold text-[var(--color-text)] transition hover:border-[var(--color-primary-100)] hover:bg-[var(--color-primary-50)] hover:text-[var(--color-primary)]"
                        >
                          {isHufadz ? "Munaqosah" : "Input Nilai"}
                        </Link>
                        {santri.canViewIjazah && !isHufadz ? (
                          <>
                            <Link
                              href={`/admin/syahadah/${santri.id}/transkrip`}
                              className="rounded-full bg-blue-100 px-4 py-2 text-xs font-bold text-[var(--color-info)] transition hover:bg-blue-200"
                            >
                              Transkrip Detail
                            </Link>
                            <Link
                              href={`/ijazah/${santri.id}`}
                              className="rounded-full bg-[var(--color-text)] px-4 py-2 text-xs font-bold text-white transition hover:bg-[var(--color-text)]"
                            >
                              Ijazah Online
                            </Link>
                          </>
                        ) : !isHufadz ? (
                          <span className="rounded-full bg-[var(--color-surface-dark)] px-4 py-2 text-xs font-bold text-[var(--color-text-muted)]">
                            Ijazah Terkunci
                          </span>
                        ) : null}

                        {santri.canPrintMcSyahadah && santri.mcRiwayatId ? (
                          <Link
                            href={`/cetak-template/akbarnas-mc/${santri.mcRiwayatId}`}
                            target="_blank"
                            className="rounded-full px-4 py-2 text-xs font-bold transition bg-indigo-100 text-indigo-800 hover:bg-indigo-200"
                          >
                            Cetak Syahadah MC
                          </Link>
                        ) : santri.canPrintSyahadah ? (
                          <Link
                            href={`/cetak-offline/${santri.id}`}
                            target="_blank"
                            className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                              isMusyarokah
                                ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                                : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                            }`}
                          >
                            {isMusyarokah ? "Cetak Musyarokah" : "Cetak Lulus"}
                          </Link>
                        ) : (
                          <span className="rounded-full bg-[var(--color-surface-dark)] px-4 py-2 text-xs font-bold text-[var(--color-text-muted)]">
                            Cetak Terkunci
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {sortedSantri.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-8 text-center text-[var(--color-text-muted)]"
                  >
                    Tidak ada santri di kelas ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
