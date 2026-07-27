"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bed, BookOpen, Activity, TrendingUp, ChevronRight, FileText } from "lucide-react";

type StatusCounts = {
  HADIR: number;
  IZIN: number;
  SAKIT: number;
  ALPHA: number;
};

type KegiatanRekap = {
  id: string;
  nama: string;
  counts: StatusCounts;
};

type RekapData = {
  sakan: StatusCounts;
  kelas: StatusCounts;
  kegiatan: KegiatanRekap[];
  liburCount?: number;
};

const STATUS_CONFIG = [
  { key: "HADIR" as const, label: "Hadir", color: "bg-[var(--color-primary)]", light: "bg-[var(--color-primary-50)] text-[var(--color-primary)] border-[var(--color-primary-100)]" },
  { key: "IZIN" as const,  label: "Izin",  color: "bg-indigo-500",  light: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { key: "SAKIT" as const, label: "Sakit", color: "bg-[var(--color-warning)]",   light: "bg-[var(--color-warning-light)] text-[var(--color-warning)] border-[var(--color-warning)]" },
  { key: "ALPHA" as const, label: "Alpha", color: "bg-[var(--color-danger)]",    light: "bg-[var(--color-danger-light)] text-[var(--color-danger)] border-[var(--color-danger)]" },
];

function getTotalFromCounts(counts: StatusCounts) {
  return (counts.HADIR || 0) + (counts.IZIN || 0) + (counts.SAKIT || 0) + (counts.ALPHA || 0);
}

function StatusBar({ counts }: { counts: StatusCounts }) {
  const total = getTotalFromCounts(counts);
  return (
    <div className="mt-4 space-y-2">
      {STATUS_CONFIG.map((s) => {
        const val = counts[s.key] || 0;
        const pct = total > 0 ? (val / total) * 100 : 0;
        return (
          <div key={s.key} className="flex items-center gap-3">
            <span className="w-12 shrink-0 text-xs font-bold text-[var(--color-text-muted)]">{s.label}</span>
            <div className="flex-1 h-2 rounded-full bg-[var(--color-surface)] overflow-hidden">
              <div
                className={`h-full rounded-full ${s.color} transition-all duration-500`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-8 shrink-0 text-right text-xs font-bold text-[var(--color-text)]">{val}</span>
          </div>
        );
      })}
    </div>
  );
}

function StatusBadges({ counts }: { counts: StatusCounts }) {
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {STATUS_CONFIG.map((s) => (
        <span
          key={s.key}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${s.light}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${s.color}`} />
          {s.label}: {counts[s.key] || 0}
        </span>
      ))}
    </div>
  );
}

function RekapCard({
  title,
  description,
  icon: Icon,
  iconBg,
  counts,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  iconBg: string;
  counts: StatusCounts;
  onClick: () => void;
}) {
  const total = getTotalFromCounts(counts);
  const hadirPct = total > 0 ? Math.round((counts.HADIR / total) * 100) : 0;

  return (
    <div className="neu-card-white p-6 md:p-8 relative group transition-all hover:border-violet-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${iconBg}`}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[var(--color-text)]">{title}</h3>
            <p className="text-sm text-[var(--color-text-muted)]">{description}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-black text-[var(--color-text)]">{total.toLocaleString("id-ID")}</p>
          <p className="text-xs font-semibold text-[var(--color-text-subtle)]">total catatan</p>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-[var(--color-surface)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-700"
            style={{ width: `${hadirPct}%` }}
          />
        </div>
        <span className="text-xs font-bold text-[var(--color-primary)]">{hadirPct}% hadir</span>
      </div>

      <StatusBar counts={counts} />
      
      {/* Lihat Rincian Button */}
      <button 
        onClick={onClick}
        disabled={total === 0}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-secondary)] py-3 text-sm font-bold text-[var(--color-text-muted)] border border-[var(--color-surface)] transition-all hover:bg-violet-50 hover:text-violet-700 disabled:opacity-50 disabled:cursor-not-allowed group-hover:border-violet-100"
      >
        <FileText className="h-4 w-4" />
        Lihat Rincian Nama
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

// Inline function to get today WIB as YYYY-MM-DD
function getWibDateString(offsetDays = 0): string {
  const wib = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
  wib.setDate(wib.getDate() + offsetDays);
  return wib.toISOString().split("T")[0];
}

// First day of this month
function getFirstDayOfMonth(): string {
  const wib = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
  return `${wib.getFullYear()}-${String(wib.getMonth() + 1).padStart(2, "0")}-01`;
}

export function RekapAbsenClient() {
  const [dari, setDari] = useState(getFirstDayOfMonth());
  const [sampai, setSampai] = useState(getWibDateString());
  const [data, setData] = useState<RekapData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleViewDetail = (type: "sakan" | "kelas" | "kegiatan", title: string, kategoriId?: string) => {
    const params = new URLSearchParams({ type, dari, sampai, title });
    if (kategoriId) params.append("kategoriId", kategoriId);
    router.push(`/admin/absensi/rekap/detail?${params.toString()}`);
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ dari, sampai });
        const res = await fetch(`/api/admin/absensi/rekap?${params}`);
        const json = await res.json();
        setData(json);
      } catch {
        console.error("Gagal memuat rekap absensi");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [dari, sampai]);

  const totalKegiatan: StatusCounts = (data?.kegiatan ?? []).reduce(
    (acc, k) => ({
      HADIR: acc.HADIR + (k.counts.HADIR || 0),
      IZIN: acc.IZIN + (k.counts.IZIN || 0),
      SAKIT: acc.SAKIT + (k.counts.SAKIT || 0),
      ALPHA: acc.ALPHA + (k.counts.ALPHA || 0),
    }),
    { HADIR: 0, IZIN: 0, SAKIT: 0, ALPHA: 0 }
  );

  return (
    <div className="space-y-6">
      {/* Filter Tanggal */}
      <section className="neu-card-white p-6">
        <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
          Filter Rentang Tanggal
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-muted)]">Dari</label>
            <input
              type="date"
              value={dari}
              onChange={(e) => setDari(e.target.value)}
              className="rounded-2xl border border-[var(--color-surface-dark)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--color-text)] outline-none transition focus:border-violet-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-muted)]">Sampai</label>
            <input
              type="date"
              value={sampai}
              onChange={(e) => setSampai(e.target.value)}
              className="rounded-2xl border border-[var(--color-surface-dark)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--color-text)] outline-none transition focus:border-violet-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setDari(getFirstDayOfMonth()); setSampai(getWibDateString()); }}
              className="rounded-full bg-[var(--color-surface)] px-4 py-2.5 text-xs font-bold text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-dark)]"
            >
              Bulan Ini
            </button>
            <button
              onClick={() => { setDari(getWibDateString()); setSampai(getWibDateString()); }}
              className="rounded-full bg-violet-100 px-4 py-2.5 text-xs font-bold text-violet-700 transition hover:bg-violet-200"
            >
              Hari Ini
            </button>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-sm font-semibold text-[var(--color-text-subtle)]">
          <span className="animate-pulse">Memuat data rekap...</span>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {(data.liburCount ?? 0) > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 border border-rose-100 rounded-lg text-rose-600 text-xs font-semibold shadow-sm animate-pulse-slow">
              <span className="font-bold text-rose-500 bg-rose-100 px-1.5 py-0.5 rounded">LBR</span> {data.liburCount} hari libur dikecualikan dari perhitungan statistik kehadiran.
            </div>
          )}
          {/* Sakan */}
          <RekapCard
            title="Absen Sakan"
            description="Kehadiran di asrama per hari"
            icon={Bed}
            iconBg="bg-blue-100 text-[var(--color-info)]"
            counts={data.sakan}
            onClick={() => handleViewDetail("sakan", "Rincian Absen Sakan")}
          />

          {/* Kelas */}
          <RekapCard
            title="Absen Kelas"
            description="Kehadiran di kelas per hissoh"
            icon={BookOpen}
            iconBg="bg-[var(--color-primary-100)] text-[var(--color-primary)]"
            counts={data.kelas}
            onClick={() => handleViewDetail("kelas", "Rincian Absen Kelas")}
          />

          {/* Kegiatan - tampilkan per kategori */}
          <div className="neu-card-white p-6 md:p-8">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-warning-light)] text-[var(--color-warning)]">
                  <Activity className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[var(--color-text)]">Absen Kegiatan</h3>
                  <p className="text-sm text-[var(--color-text-muted)]">Kehadiran per kategori kegiatan</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-black text-[var(--color-text)]">
                  {getTotalFromCounts(totalKegiatan).toLocaleString("id-ID")}
                </p>
                <p className="text-xs font-semibold text-[var(--color-text-subtle)]">total catatan</p>
              </div>
            </div>

            {data.kegiatan.length === 0 ? (
              <p className="text-sm text-[var(--color-text-subtle)] font-medium text-center py-4">
                Belum ada data kegiatan.
              </p>
            ) : (
              <div className="divide-y divide-[var(--color-surface)]">
                {data.kegiatan.map((k) => {
                  const total = getTotalFromCounts(k.counts);
                  return (
                    <div key={k.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                          <span className="font-bold text-[var(--color-text)] text-sm">{k.nama}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-[var(--color-text-subtle)]">
                            {total} catatan
                          </span>
                          <button
                            onClick={() => handleViewDetail("kegiatan", `Rincian: ${k.nama}`, k.id)}
                            disabled={total === 0}
                            className="flex items-center gap-1 rounded-full bg-[var(--color-secondary)] px-3 py-1.5 text-[11px] font-bold text-[var(--color-warning)] border border-amber-100 transition-all hover:bg-[var(--color-warning-light)] disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <FileText className="h-3 w-3" />
                            Rincian <ChevronRight className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      <StatusBadges counts={k.counts} />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Global summary bar */}
            {getTotalFromCounts(totalKegiatan) > 0 && (
              <div className="mt-6 border-t border-[var(--color-surface)] pt-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--color-text-subtle)]">
                    Total Keseluruhan Kegiatan
                  </p>
                  <button
                    onClick={() => handleViewDetail("kegiatan", "Rincian Global Semua Kegiatan")}
                    className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--color-warning-light)] px-4 py-2.5 text-xs font-bold text-[var(--color-warning)] border border-amber-100 transition-all hover:bg-[var(--color-warning-light)]/80 group"
                  >
                    <FileText className="h-4 w-4" />
                    Buka Matriks Global
                    <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
                <StatusBar counts={totalKegiatan} />
              </div>
            )}
          </div>

          {/* Grand Summary */}
          <div className="rounded-[var(--radius-2xl)] border border-violet-200 bg-violet-50 p-6 shadow-sm md:p-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-violet-900">Ringkasan Global</h3>
                <p className="text-xs text-violet-500 font-medium">Gabungan semua jenis absensi</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {STATUS_CONFIG.map((s) => {
                const val =
                  (data.sakan[s.key] || 0) +
                  (data.kelas[s.key] || 0) +
                  (totalKegiatan[s.key] || 0);
                return (
                  <div key={s.key} className="rounded-2xl bg-white border border-violet-100 p-4 text-center shadow-sm">
                    <p className="text-2xl font-black text-[var(--color-text)]">{val.toLocaleString("id-ID")}</p>
                    <div className="flex items-center justify-center gap-1.5 mt-1">
                      <span className={`h-2 w-2 rounded-full ${s.color}`} />
                      <span className="text-xs font-bold text-[var(--color-text-muted)]">{s.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
