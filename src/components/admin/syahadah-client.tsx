"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

type StatusKelulusan = "LULUS" | "TIDAK_LULUS" | "MUSYAROKAH";

type DashboardSantri = {
  id: string;
  nama: string;
  gender: string;
  lokasi: string;
  programNama: string;
  programId: string | null;
  kelasNama: string;
  kelasId: string | null;
  statusKelulusan: StatusKelulusan;
  nilaiAkumulatif: number;
  isBulanPertamaAkbarnas: boolean;
  isTasmi: boolean;
  canPrintSyahadah: boolean;
  // Akbarnas bulan pertama: tombol cetak mengarah ke syahadah MC.
  canPrintMcSyahadah: boolean;
  mcRiwayatId: string | null;
  canViewIjazah: boolean;
  isAktif: boolean;
};

type ProgramItem = {
  id: string;
  nama_indo: string;
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

// Simple SVG icons
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
  // Build class chips data
  const classChips = useMemo(() => {
    const chips: { id: string; label: string; group: string; count: number }[] = [];

    for (const program of programList) {
      if (program.kelasList.length > 0) {
        for (const k of program.kelasList) {
          const count = santriRows.filter(s => s.kelasId === k.id).length;
          if (count > 0) {
            chips.push({ id: k.id, label: k.nama, group: program.nama_indo, count });
          }
        }
      } else {
        const count = santriRows.filter(s => s.programId === program.id && !s.kelasId).length;
        if (count > 0) {
          chips.push({ id: `PROGRAM_${program.id}`, label: program.nama_indo, group: "Program", count });
        }
      }
    }

    const unassigned = santriRows.filter(s => s.programId === null).length;
    if (unassigned > 0) {
      chips.push({ id: "UNASSIGNED", label: "Belum Ditempatkan", group: "", count: unassigned });
    }

    return chips;
  }, [santriRows, programList]);

  // Default to first class chip instead of ALL
  const [filterKelasId, setFilterKelasId] = useState<string>(classChips[0]?.id ?? "ALL");

  const filteredSantri = santriRows.filter((santri) => {
    if (filterKelasId === "ALL") return true;
    if (filterKelasId === "UNASSIGNED") return santri.programId === null;
    if (filterKelasId.startsWith("PROGRAM_")) {
      const programId = filterKelasId.replace("PROGRAM_", "");
      return santri.programId === programId;
    }
    return santri.kelasId === filterKelasId;
  });

  // Urutan tampil: Banin dulu, baru Banat (tanpa gender: paling akhir);
  // di dalam tiap kelompok: peringkat nilai akumulatif menurun, seri -> abjad.
  // Baris Akbarnas bulan 1 tidak ikut pemeringkatan (syahadahnya MC) —
  // mereka diletakkan di bawah, tetap Banin dulu baru Banat, berurutan abjad.
  const genderRank = (g: string) => (g === "BANIN" ? 0 : g === "BANAT" ? 1 : 2);
  const sortedSantri = useMemo(() => {
    const ranked = filteredSantri.filter((s) => !s.isBulanPertamaAkbarnas);
    const bulanPertama = filteredSantri.filter((s) => s.isBulanPertamaAkbarnas);
    ranked.sort(
      (a, b) =>
        genderRank(a.gender) - genderRank(b.gender) ||
        b.nilaiAkumulatif - a.nilaiAkumulatif ||
        a.nama.localeCompare(b.nama, "id")
    );
    bulanPertama.sort(
      (a, b) => genderRank(a.gender) - genderRank(b.gender) || a.nama.localeCompare(b.nama, "id")
    );
    return [...ranked, ...bulanPertama];
  }, [filteredSantri]);

  // Compute stats for filtered
  const stats = useMemo(() => {
    const lulus = filteredSantri.filter(s => s.statusKelulusan === "LULUS").length;
    const musyarokah = filteredSantri.filter(s => s.statusKelulusan === "MUSYAROKAH").length;
    const tidakLulus = filteredSantri.filter(s => s.statusKelulusan === "TIDAK_LULUS").length;
    const siapCetak = filteredSantri.filter(s => s.canPrintSyahadah || s.canPrintMcSyahadah).length;
    const totalTasmi = filteredSantri.filter(s => s.isTasmi).length;
    return { lulus, musyarokah, tidakLulus, siapCetak, totalTasmi, total: filteredSantri.length };
  }, [filteredSantri]);

  const isRealKelas = filterKelasId !== "ALL" && filterKelasId !== "UNASSIGNED" && !filterKelasId.startsWith("PROGRAM_");

  return (
    <div className="space-y-5">
      {/* Class Chips */}
      <section className="neu-card-white overflow-hidden">
        <div className="px-6 py-5 border-b border-[var(--color-surface-dark)]">
          <label className="mb-3 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
            Pilih Kelas / Ruangan
          </label>
          <div className="flex flex-wrap gap-2">
            {classChips.map(chip => (
              <button
                key={chip.id}
                onClick={() => setFilterKelasId(chip.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 border ${
                  filterKelasId === chip.id
                    ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-md shadow-emerald-200/50"
                    : "bg-[var(--color-secondary)] text-[var(--color-text)] border-[var(--color-surface-dark)] hover:border-[var(--color-primary-100)] hover:bg-white"
                }`}
              >
                <span>{chip.label}</span>
                <span className={`inline-flex items-center justify-center rounded-full px-1.5 min-w-[20px] h-5 text-[10px] font-bold ${
                  filterKelasId === chip.id
                    ? "bg-white/20 text-white"
                    : "bg-[var(--color-surface)] text-[var(--color-text-muted)]"
                }`}>
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
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-600"><IconCheck /></span>
              <span className="text-sm font-bold text-emerald-700">{stats.lulus}</span>
              <span className="text-xs text-[var(--color-text-muted)]">Lulus</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-600"><IconAlert /></span>
              <span className="text-sm font-bold text-amber-700">{stats.musyarokah}</span>
              <span className="text-xs text-[var(--color-text-muted)]">Musyarokah</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-600"><IconX /></span>
              <span className="text-sm font-bold text-red-700">{stats.tidakLulus}</span>
              <span className="text-xs text-[var(--color-text-muted)]">Tidak Lulus</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600"><IconPrinter /></span>
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
              href="/layout-editor"
              className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-[var(--color-info)] transition hover:border-blue-300 hover:bg-blue-100"
            >
              Layout Syahadah
            </Link>
            {filteredSantri.some((s) => s.programNama.toLowerCase().includes("akbarnas")) && (
              <Link
                href="/admin/akbarnas-mc"
                className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-[var(--color-info)] transition hover:border-blue-300 hover:bg-blue-100"
              >
                Layout Syahadah MC
              </Link>
            )}
            {isRealKelas && (
              <a
                href={`/cetak-bulk/${filterKelasId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-[var(--color-warning)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 shadow-sm"
              >
                Cetak Syahadah ({stats.siapCetak})
              </a>
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
              {sortedSantri.map((santri, index) => (
                <tr key={santri.id} className="align-top hover:bg-[var(--color-secondary)]/80">
                  {/* No urut */}
                  <td className="px-4 py-4 text-center">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-surface)] text-xs font-bold text-[var(--color-text-muted)]">
                      {index + 1}
                    </span>
                  </td>
                  {/* Nama */}
                  <td className="px-6 py-4">
                    <p className="font-bold text-[var(--color-text)]">{santri.nama}</p>
                    <p className="mt-1 text-xs font-medium uppercase tracking-[0.2em] text-[var(--color-text-subtle)]">{santri.gender}</p>
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
                          <p className="mt-1 text-xs text-[var(--color-text-subtle)]">{santri.programNama}</p>
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
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${santri.isTasmi ? "bg-[var(--color-primary-100)] text-[var(--color-primary)]" : "bg-[var(--color-danger-light)] text-[var(--color-danger)]"}`}>
                      {santri.isTasmi ? "Sudah" : "Belum"}
                    </span>
                  </td>
                  {/* Status */}
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusClass(santri.statusKelulusan)}`}>
                      {santri.statusKelulusan}
                    </span>
                  </td>
                  {/* Nilai Akumulatif (patokan peringkat; bulan 1 tidak diperingkat) */}
                  <td className="px-6 py-4">
                    {santri.isBulanPertamaAkbarnas ? (
                      <span className="text-[var(--color-text-subtle)]">-</span>
                    ) : (
                      <span className="font-bold text-[var(--color-text)]">{santri.nilaiAkumulatif.toFixed(2)}</span>
                    )}
                  </td>
                  {/* Aksi */}
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Link
                        href={`/admin/input-nilai/${santri.id}`}
                        className="rounded-full border border-[var(--color-surface-dark)] px-4 py-2 text-xs font-bold text-[var(--color-text)] transition hover:border-[var(--color-primary-100)] hover:bg-[var(--color-primary-50)] hover:text-[var(--color-primary)]"
                      >
                        Input Nilai
                      </Link>
                      {santri.canViewIjazah ? (
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
                      ) : (
                        <span className="rounded-full bg-[var(--color-surface-dark)] px-4 py-2 text-xs font-bold text-[var(--color-text-muted)]">
                          Ijazah Terkunci
                        </span>
                      )}
                      {santri.canPrintMcSyahadah && santri.mcRiwayatId ? (
                        // Akbarnas bulan pertama: tombol cetak yang sama,
                        // tapi yang terbuka adalah syahadah MC.
                        <Link
                          href={`/cetak-template/akbarnas-mc/${santri.mcRiwayatId}`}
                          className="rounded-full bg-[var(--color-warning)] px-4 py-2 text-xs font-bold text-white transition hover:bg-[var(--color-warning)]"
                        >
                          Cetak Syahadah MC
                        </Link>
                      ) : santri.canPrintSyahadah ? (
                        <Link
                          href={`/cetak/${santri.id}`}
                          className="rounded-full bg-[var(--color-warning)] px-4 py-2 text-xs font-bold text-white transition hover:bg-[var(--color-warning)]"
                        >
                          Cetak Syahadah
                        </Link>
                      ) : (
                        <span className="rounded-full bg-[var(--color-surface-dark)] px-4 py-2 text-xs font-bold text-[var(--color-text-muted)]">
                          Cetak Terkunci
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {sortedSantri.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-[var(--color-text-muted)]">
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
