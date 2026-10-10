"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, FileText, Printer } from "lucide-react";

type StatusKelulusan = "LULUS" | "TIDAK_LULUS" | "MUSYAROKAH" | "BELUM_LENGKAP";

type AbsenSummary = { hadir: number; izin: number; sakit: number; alpha: number; total: number };
type AbsenHissoh = { hissoh: string; hadir: number; alpha: number; total: number };
type AbsenKegiatan = { nama: string; hadir: number; alpha: number; total: number };

type RiwayatRecord = {
  riwayatId: string;
  dufahNama: string;
  programNama: string;
  programId: string | null;
  kelasNama: string;
  kelasId: string | null;
  statusKelulusan: StatusKelulusan;
  isTasmi: boolean;
  canPrintSyahadah: boolean;
  canViewIjazah: boolean;
  nilaiList: Array<{ mapelNama: string; skor: number }>;
  rataRata: string | null;
  absenSakan?: AbsenSummary;
  absenKelasByHissoh?: AbsenHissoh[];
  absenKegiatan?: AbsenKegiatan[];
};

export type SantriListItem = {
  santriId: string;
  nama: string;
  gender: string;
  isAktif: boolean;
  lokasi: string;
  programNama: string;
  kelasNama: string;
  riwayatId: string;
};

function statusClass(status: string) {
  if (status === "LULUS") return "bg-[var(--color-primary-100)] text-[var(--color-primary)]";
  if (status === "MUSYAROKAH") return "bg-[var(--color-warning-light)] text-[var(--color-warning)]";
  if (status === "BELUM_LENGKAP") return "bg-slate-100 text-slate-500";
  return "bg-[var(--color-danger-light)] text-[var(--color-danger)]";
}

function statusLabel(status: string) {
  if (status === "BELUM_LENGKAP") return "Belum Lengkap";
  return status;
}

function AbsenBadge({ hadir, total }: { hadir: number; total: number }) {
  if (total === 0) return <span className="text-xs text-[var(--color-text-subtle)] italic">Tidak ada data</span>;
  const pct = Math.round((hadir / total) * 100);
  const color = pct >= 75 ? "text-[var(--color-primary)] bg-[var(--color-primary-50)] border-[var(--color-primary-100)]"
              : pct >= 50 ? "text-[var(--color-warning)] bg-[var(--color-warning-light)] border-[var(--color-warning)]"
              : "text-[var(--color-danger)] bg-[var(--color-danger-light)] border-[var(--color-danger)]";
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-bold ${color}`}>
      {hadir}/{total} ({pct}%)
    </span>
  );
}

function RecordDetailCard({ record }: { record: RiwayatRecord }) {
  return (
    <div className="rounded-xl border border-[var(--color-surface)] bg-[var(--color-secondary)] p-4 space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1.5">
          <span className="inline-block rounded bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700">
            {record.dufahNama}
          </span>
          <p className="text-sm font-semibold text-[var(--color-text)]">
            {record.programNama}{" "}
            <span className="text-[var(--color-text-subtle)] font-normal ml-1">— {record.kelasNama}</span>
          </p>
          <div className="flex items-center gap-2">
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusClass(record.statusKelulusan)}`}>
              {statusLabel(record.statusKelulusan)}
            </span>
            {record.isTasmi && (
              <span className="inline-flex rounded-full bg-[var(--color-primary-100)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary)]">
                Tasmi&apos;
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {record.canViewIjazah ? (
            <Link href={`/ijazah/${record.riwayatId}`} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-text)] px-3 py-1.5 text-xs font-bold text-white hover:bg-[var(--color-text)]">
              <FileText className="h-3.5 w-3.5" /> Ijazah Online
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-surface-dark)] px-3 py-1.5 text-xs font-bold text-[var(--color-text-muted)] cursor-not-allowed">
              <FileText className="h-3.5 w-3.5" /> Ijazah Terkunci
            </span>
          )}
          {record.canPrintSyahadah ? (
            <Link href={`/cetak/${record.riwayatId}`} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-warning)] px-3 py-1.5 text-xs font-bold text-white hover:bg-[var(--color-warning)]">
              <Printer className="h-3.5 w-3.5" /> Syahadah
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-surface-dark)] px-3 py-1.5 text-xs font-bold text-[var(--color-text-muted)] cursor-not-allowed">
              <Printer className="h-3.5 w-3.5" /> Cetak Terkunci
            </span>
          )}
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold text-[var(--color-text-muted)]">Nilai Mapel:</p>
        <div className="flex flex-wrap gap-2">
          {record.nilaiList.length === 0 ? (
            <span className="text-xs italic text-[var(--color-text-subtle)]">Belum ada nilai</span>
          ) : (
            record.nilaiList.map((n, idx) => (
              <span key={idx} className="inline-flex rounded border border-[var(--color-surface-dark)] bg-white px-2 py-1 text-xs text-[var(--color-text-muted)]">
                {n.mapelNama}: <strong className="ml-1">{n.skor}</strong>
              </span>
            ))
          )}
          {record.rataRata && (
            <span className="inline-flex rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-700">
              Rata-rata: {record.rataRata}
            </span>
          )}
        </div>
      </div>
      <div className="border-t border-[var(--color-surface-dark)] pt-3">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Rekap Absensi</p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <div className="rounded-lg border border-[var(--color-surface-dark)] bg-white p-3">
            <p className="text-xs font-bold text-[var(--color-text)] mb-2">Sakan</p>
            {record.absenSakan?.total === 0 || !record.absenSakan ? (
              <span className="text-xs text-[var(--color-text-subtle)] italic">Belum ada data</span>
            ) : (
              <div className="space-y-0.5">
                <div className="flex justify-between text-xs"><span>Hadir</span><AbsenBadge hadir={record.absenSakan.hadir} total={record.absenSakan.total} /></div>
                <div className="flex justify-between text-xs text-[var(--color-text-muted)]"><span>Izin</span><span className="font-bold">{record.absenSakan.izin}</span></div>
                <div className="flex justify-between text-xs text-[var(--color-text-muted)]"><span>Sakit</span><span className="font-bold">{record.absenSakan.sakit}</span></div>
                <div className="flex justify-between text-xs text-[var(--color-text-muted)]"><span>Alpha</span><span className="font-bold text-[var(--color-danger)]">{record.absenSakan.alpha}</span></div>
              </div>
            )}
          </div>
          <div className="rounded-lg border border-[var(--color-surface-dark)] bg-white p-3">
            <p className="text-xs font-bold text-[var(--color-text)] mb-2">Kelas (per Hissoh)</p>
            {!record.absenKelasByHissoh || record.absenKelasByHissoh.length === 0 ? (
              <span className="text-xs text-[var(--color-text-subtle)] italic">Belum ada data</span>
            ) : (
              <div className="space-y-0.5">
                {record.absenKelasByHissoh.map((h) => (
                  <div key={h.hissoh} className="flex justify-between text-xs">
                    <span className="text-[var(--color-text-muted)]">{h.hissoh}</span>
                    <AbsenBadge hadir={h.hadir} total={h.total} />
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-lg border border-[var(--color-surface-dark)] bg-white p-3">
            <p className="text-xs font-bold text-[var(--color-text)] mb-2">Kegiatan</p>
            {!record.absenKegiatan || record.absenKegiatan.length === 0 ? (
              <span className="text-xs text-[var(--color-text-subtle)] italic">Belum ada data</span>
            ) : (
              <div className="space-y-0.5">
                {record.absenKegiatan.map((k, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-[var(--color-text-muted)] truncate mr-2">{k.nama}</span>
                    <AbsenBadge hadir={k.hadir} total={k.total} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RiwayatRow({ santri, index, dufah }: { santri: SantriListItem; index: number; dufah: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [records, setRecords] = useState<RiwayatRecord[] | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const toggleExpand = async () => {
    if (isExpanded) {
      setIsExpanded(false);
      return;
    }
    setIsExpanded(true);
    if (records === null && !loadingDetail) {
      setLoadingDetail(true);
      try {
        const res = await fetch(`/api/admin/riwayat/detail?santriId=${santri.santriId}&dufah=${encodeURIComponent(dufah)}`);
        if (res.ok) {
          setRecords(await res.json());
        }
      } catch {
        // biarkan kosong
      } finally {
        setLoadingDetail(false);
      }
    }
  };

  return (
    <>
      <tr className="align-top hover:bg-[var(--color-secondary)]/80 cursor-pointer" onClick={toggleExpand}>
        <td className="px-4 py-4 text-center">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-surface)] text-xs font-bold text-[var(--color-text-muted)]">
            {index + 1}
          </span>
        </td>
        <td className="px-6 py-4">
          <p className="font-bold text-[var(--color-text)]">{santri.nama}</p>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--color-text-subtle)]">{santri.gender}</p>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${santri.isAktif ? "bg-[var(--color-primary-100)] text-[var(--color-primary)]" : "bg-slate-100 text-slate-500"}`}>
              {santri.isAktif ? "Aktif" : "Nonaktif"}
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">{santri.programNama} — {santri.kelasNama}</p>
        </td>
        <td className="px-6 py-4 text-[var(--color-text-muted)]">{santri.lokasi}</td>
        <td className="px-6 py-4 text-right">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-surface-dark)] bg-white px-4 py-2 text-xs font-bold text-[var(--color-text)] shadow-sm hover:bg-[var(--color-secondary)]"
          >
            {isExpanded ? "Tutup Detail" : "Detail"}
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={4} className="bg-[var(--color-surface-light)] p-4 sm:p-6">
            {loadingDetail ? (
              <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">Memuat detail...</p>
            ) : records && records.length > 0 ? (
              <div className="rounded-2xl border border-[var(--color-surface-dark)] bg-white p-4 shadow-sm">
                <h4 className="mb-4 text-sm font-bold tracking-tight text-[var(--color-text)]">Detail Riwayat</h4>
                <div className="space-y-4">
                  {records.map((record) => (
                    <RecordDetailCard key={record.riwayatId} record={record} />
                  ))}
                </div>
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">Tidak ada detail riwayat.</p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export function RiwayatClient({
  santriList,
  dufahList = [],
  programList = [],
  initialDufah = "",
  initialStatus = "all",
  initialProgram = "",
  initialQuery = "",
}: {
  santriList: SantriListItem[];
  dufahList?: string[];
  programList?: Array<{ id: string; nama_indo: string }>;
  initialDufah?: string;
  initialStatus?: string;
  initialProgram?: string;
  initialQuery?: string;
}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState(initialQuery);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchQuery !== initialQuery) {
        navigate({ q: searchQuery });
      }
    }, 500);
    return () => clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const navigate = (overrides: { dufah?: string; status?: string; program?: string; q?: string }) => {
    const params = new URLSearchParams();
    const dufah = overrides.dufah !== undefined ? overrides.dufah : initialDufah;
    const status = overrides.status !== undefined ? overrides.status : initialStatus;
    const program = overrides.program !== undefined ? overrides.program : initialProgram;
    const q = overrides.q !== undefined ? overrides.q : initialQuery;
    if (dufah) params.set("dufah", dufah);
    if (status && status !== "all") params.set("status", status);
    if (program) params.set("program", program);
    if (q) params.set("q", q);
    const qs = params.toString();
    router.push(`/admin/riwayat${qs ? `?${qs}` : ""}`);
  };

  const selectClass = "w-full rounded-2xl border border-[var(--color-surface-dark)] bg-[var(--color-secondary)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:bg-white";
  const labelClass = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]";

  return (
    <div className="space-y-6">
      <section className="overflow-hidden neu-card-white">
        <div className="flex flex-col gap-4 border-b border-[var(--color-surface-dark)] px-6 py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className={labelClass}>Dufah / Gelombang</label>
              <select
                value={initialDufah || ""}
                onChange={(e) => navigate({ dufah: e.target.value })}
                className={selectClass}
              >
                <option value="">-- Pilih Dufah --</option>
                {dufahList.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Status Santri</label>
              <select
                value={initialStatus}
                onChange={(e) => navigate({ status: e.target.value })}
                className={selectClass}
              >
                <option value="all">Semua</option>
                <option value="aktif">Aktif</option>
                <option value="nonaktif">Nonaktif</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Program</label>
              <select
                value={initialProgram}
                onChange={(e) => navigate({ program: e.target.value })}
                className={selectClass}
              >
                <option value="">Semua Program</option>
                {programList.map(p => (
                  <option key={p.id} value={p.id}>{p.nama_indo}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Cari Santri</label>
              <input
                type="text"
                placeholder="Masukkan nama santri..."
                className={selectClass}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex shrink-0 gap-3 text-sm">
            <span className="rounded-2xl bg-[var(--color-surface)] px-4 py-2 font-semibold text-[var(--color-text)]">
              {santriList.length} Santri
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--color-surface-dark)] text-left">
            <thead className="bg-[var(--color-secondary)] text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              <tr>
                <th className="px-4 py-4 text-center">#</th>
                <th className="px-6 py-4">Santri</th>
                <th className="px-6 py-4">Lokasi</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-surface)] text-sm text-[var(--color-text-muted)]">
              {santriList.map((santri, index) => (
                <RiwayatRow key={santri.santriId} santri={santri} index={index} dufah={initialDufah} />
              ))}
              {santriList.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-[var(--color-text-muted)]">
                    {!initialDufah ? "Silakan pilih Dufah (gelombang) untuk menampilkan arsip riwayat." : "Tidak ada data riwayat santri yang cocok."}
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
