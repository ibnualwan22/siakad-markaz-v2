"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Crown, Trophy } from "lucide-react";

type MartabahUlaRow = {
  id: string; // santriId
  nama: string;
  programNama: string;
  programId: string;
  average: number;
  averagePredikat: { indo: string; arab: string };
  statusKelulusan: string;
  isAktif: boolean;
  canViewIjazah: boolean;
  riwayatId: string;
  lokasi: string;
  programKategori?: string;
};

function computeMartabahUla(rows: MartabahUlaRow[]) {
  const completed = rows.filter((s) => s.canViewIjazah && s.statusKelulusan !== "TIDAK_LULUS");

  const byProgram = new Map<string, MartabahUlaRow[]>();
  for (const santri of completed) {
    if (!byProgram.has(santri.programId)) {
      byProgram.set(santri.programId, []);
    }
    byProgram.get(santri.programId)!.push(santri);
  }

  const topStudents: MartabahUlaRow[] = [];
  for (const [, students] of byProgram.entries()) {
    students.sort((a, b) => b.average - a.average);
    if (students.length > 0) {
      topStudents.push(students[0]);
    }
  }

  const sorted = topStudents.sort((a, b) => a.programNama.localeCompare(b.programNama, "id"));

  let globalTopId: string | null = null;
  if (sorted.length > 0) {
    const highest = sorted.reduce((best, curr) => curr.average > best.average ? curr : best, sorted[0]);
    globalTopId = highest.id;
  }

  return { martabahUlaList: sorted, globalTopId };
}

function MartabahUlaTable({
  list,
  globalTopId,
  emptyMessage,
}: {
  list: MartabahUlaRow[];
  globalTopId: string | null;
  emptyMessage: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-[var(--color-secondary)] text-[var(--color-text-muted)]">
          <tr>
            <th className="px-6 py-4 font-semibold rounded-tl-2xl">Program</th>
            <th className="px-6 py-4 font-semibold">Nama Santri</th>
            <th className="px-6 py-4 font-semibold text-center">Rata-rata</th>
            <th className="px-6 py-4 font-semibold text-center">Predikat</th>
            <th className="px-6 py-4 font-semibold text-right rounded-tr-2xl">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-surface-dark)]">
          {list.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-12 text-center text-[var(--color-text-muted)]">
                <div className="flex flex-col items-center justify-center gap-2">
                  <span className="text-2xl">🏆</span>
                  <p>{emptyMessage}</p>
                  <p className="text-xs">Pastikan Usbu&apos; Nihai sudah terisi untuk semua mapel.</p>
                </div>
              </td>
            </tr>
          ) : (
            list.map((santri) => {
              const isGlobalTop = santri.id === globalTopId;
              return (
                <tr
                  key={santri.programId}
                  className={`transition ${isGlobalTop
                    ? "bg-gradient-to-r from-amber-50/80 via-yellow-50/60 to-amber-50/80 hover:from-amber-100/80 hover:via-yellow-100/60 hover:to-amber-100/80"
                    : "hover:bg-[var(--color-secondary)]"
                  }`}
                >
                  <td className="px-6 py-4">
                    <span className="font-semibold text-[var(--color-primary)] bg-[var(--color-primary-50)] px-3 py-1 rounded-full text-xs">
                      {santri.programNama}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {isGlobalTop && (
                        <span className="relative flex-shrink-0" title="Nilai Tertinggi dari Seluruh Program">
                          <Crown className="w-6 h-6 text-amber-500 drop-shadow-sm" fill="#f59e0b" strokeWidth={1.5} />
                          <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                          </span>
                        </span>
                      )}
                      <div>
                        <div className={`font-bold ${isGlobalTop ? "text-amber-800" : "text-[var(--color-text)]"}`}>
                          {santri.nama}
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)]">{santri.lokasi}</div>
                        {isGlobalTop && (
                          <div className="text-[10px] font-bold text-amber-600 mt-0.5 tracking-wider uppercase flex items-center gap-1">
                            <Trophy className="w-3 h-3" />
                            Nilai Tertinggi Seluruh Program
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`font-black text-lg ${isGlobalTop ? "text-amber-700" : "text-[var(--color-text)]"}`}>
                      {santri.average.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`font-bold px-3 py-1 rounded-full text-[10px] uppercase tracking-wider ${isGlobalTop
                        ? "text-amber-800 bg-amber-200/80 ring-1 ring-amber-300"
                        : "text-[var(--color-warning)] bg-[var(--color-warning-light)]"
                      }`}>
                        Martabah Ula
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)] font-arabic" dir="rtl">
                        الامتياز مع مرتبة الشرف الأولى
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/syahadah/${santri.id}/transkrip`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-100"
                      >
                        Transkrip
                      </Link>
                      <Link
                        href={`/admin/martabah-ula/${santri.id}/cetak`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-xs font-semibold text-amber-600 transition hover:bg-amber-100 hover:border-amber-300 shadow-sm"
                      >
                        Cetak Penghargaan
                      </Link>
                      <Link
                        href={`/admin/martabah-ula/${santri.id}/cetak-cac`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-orange-50 border border-orange-200 px-4 py-2 text-xs font-semibold text-orange-700 transition hover:bg-orange-100 hover:border-orange-300 shadow-sm"
                      >
                        Cetak CAC
                      </Link>
                      <Link
                        href={`/cetak/${santri.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-4 py-2 text-xs font-semibold text-[var(--color-info)] transition hover:bg-blue-100"
                      >
                        Lihat Syahadah
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export function MartabahUlaClient({
  santriRows,
}: {
  santriRows: MartabahUlaRow[];
}) {
  const { regulerRows, turatsRows, usbuainRows } = useMemo(() => {
    const reguler = santriRows.filter((s) => (s.programKategori ?? "REGULER") !== "TURATS" && (s.programKategori ?? "REGULER") !== "USBUAIN");
    const turats = santriRows.filter((s) => (s.programKategori ?? "REGULER") === "TURATS");
    const usbuain = santriRows.filter((s) => (s.programKategori ?? "REGULER") === "USBUAIN");
    return { regulerRows: reguler, turatsRows: turats, usbuainRows: usbuain };
  }, [santriRows]);

  const regulerData = useMemo(() => computeMartabahUla(regulerRows), [regulerRows]);
  const turatsData = useMemo(() => computeMartabahUla(turatsRows), [turatsRows]);
  const usbuainData = useMemo(() => computeMartabahUla(usbuainRows), [usbuainRows]);

  return (
    <div className="space-y-8 mt-6">
      {/* Reguler Section */}
      <div className="neu-card-white p-6">
        <div className="mb-6 flex flex-col gap-2">
          <h2 className="text-2xl font-bold text-[var(--color-text)]">Peraih Martabah Ula — Reguler</h2>
          <p className="text-sm text-[var(--color-text-muted)] max-w-2xl">
            Daftar santri dengan nilai tertinggi di setiap program Reguler (Markaz Arabiyah).
          </p>
        </div>
        <MartabahUlaTable
          list={regulerData.martabahUlaList}
          globalTopId={regulerData.globalTopId}
          emptyMessage="Belum ada santri peraih Martabah Ula di program Reguler."
        />
      </div>

      {/* Turats Section */}
      <div className="neu-card-white p-6">
        <div className="mb-6 flex flex-col gap-2">
          <h2 className="text-2xl font-bold text-[var(--color-text)]">Peraih Martabah Ula — Turats</h2>
          <p className="text-sm text-[var(--color-text-muted)] max-w-2xl">
            Daftar santri dengan nilai tertinggi di setiap program Turats (Markaz Turats).
          </p>
        </div>
        <MartabahUlaTable
          list={turatsData.martabahUlaList}
          globalTopId={turatsData.globalTopId}
          emptyMessage="Belum ada santri peraih Martabah Ula di program Turats."
        />
      </div>

      {/* Usbuain Section */}
      <div className="neu-card-white p-6">
        <div className="mb-6 flex flex-col gap-2">
          <h2 className="text-2xl font-bold text-[var(--color-text)]">Peraih Martabah Ula — Usbu&apos;ain</h2>
          <p className="text-sm text-[var(--color-text-muted)] max-w-2xl">
            Daftar santri dengan nilai tertinggi gabungan untuk seluruh program Usbu&apos;ain.
          </p>
        </div>
        <MartabahUlaTable
          list={usbuainData.martabahUlaList}
          globalTopId={usbuainData.globalTopId}
          emptyMessage="Belum ada santri peraih Martabah Ula di program Usbu'ain."
        />
      </div>
    </div>
  );
}
