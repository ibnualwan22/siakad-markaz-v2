"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Clock,
  BookOpen,
  Award,
  TrendingUp,
  Download,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
} from "lucide-react";

type TranskripGabungan = {
  dariDufah: string;
  sampaiDufah: string;
  nilaiRows: Array<{
    namaIndo: string;
    skor: number | null;
    predikat: { indo: string } | null;
  }>;
  average: number;
  averagePredikat: { indo: string; arab: string };
};

type RiwayatData = {
  id: string;
  dufahNama: string;
  dufahNamaArab: string | null;
  programNama: string;
  programNamaArab: string;
  kelasNama: string;
  isTasmi: boolean;
  statusKelulusan: string;
  canDownloadSyahadah: boolean;
  riwayatId: string;
  average: number;
  averagePredikat: { indo: string; arab: string };
  transkripGabungan: TranskripGabungan | null;
  nilaiRows: Array<{
    namaIndo: string;
    skor: number | null;
    predikat: { indo: string } | null;
  }>;
};

export default function SantriRiwayatPage() {
  const [riwayat, setRiwayat] = useState<RiwayatData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showTranskripId, setShowTranskripId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/santri/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setRiwayat(d.riwayat);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 border-3 rounded-full animate-spin" style={{ borderColor: "var(--color-primary-100)", borderTopColor: "var(--color-primary)" }} />
      </div>
    );
  }

  if (riwayat.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Clock size={32} style={{ color: "var(--color-text-subtle)" }} />
        <p className="text-sm font-semibold" style={{ color: "var(--color-text-muted)" }}>Belum ada riwayat</p>
      </div>
    );
  }

  const getStatusStyle = (status: string) => {
    if (status === "LULUS") return { bg: "var(--color-success-light)", color: "var(--color-success)", label: "Lulus", icon: CheckCircle };
    if (status === "TIDAK_LULUS") return { bg: "var(--color-danger-light)", color: "var(--color-danger)", label: "Tidak Lulus", icon: XCircle };
    return { bg: "var(--color-warning-light)", color: "var(--color-warning)", label: "Belum Lengkap", icon: AlertTriangle };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--color-text)" }}>Riwayat Duf&apos;ah</h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>Histori akademik per duf&apos;ah</p>
      </div>

      {/* Timeline */}
      <div className="space-y-3">
        {riwayat.map((r, idx) => {
          const isExpanded = expandedId === r.id;
          const statusStyle = getStatusStyle(r.statusKelulusan);
          const StatusIcon = statusStyle.icon;
          const isCurrent = idx === 0;

          return (
            <div key={r.id} className="neu-card overflow-hidden">
              {/* Card Header */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : r.id)}
                className="w-full p-4 flex items-start gap-4"
              >
                {/* Timeline dot */}
                <div className="flex flex-col items-center flex-shrink-0 pt-1">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{
                      background: isCurrent ? "var(--color-primary)" : "var(--color-surface-dark)",
                      boxShadow: isCurrent ? "0 0 0 4px var(--color-primary-50)" : "none",
                    }}
                  />
                  {idx < riwayat.length - 1 && (
                    <div className="w-0.5 flex-1 mt-2" style={{ background: "var(--color-surface-dark)", minHeight: 20 }} />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold" style={{ color: "var(--color-text)" }}>
                      {r.dufahNama}
                    </h3>
                    {isCurrent && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold" style={{ background: "var(--color-primary-50)", color: "var(--color-primary)" }}>
                        Aktif
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                      <BookOpen size={11} /> {r.programNama}
                    </span>
                    <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                      Kelas: {r.kelasNama}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: statusStyle.bg, color: statusStyle.color }}
                    >
                      <StatusIcon size={11} />
                      {statusStyle.label}
                    </span>
                    {r.average > 0 && (
                      <span className="text-[10px] font-bold" style={{ color: "var(--color-primary)" }}>
                        {r.average} ({r.averagePredikat.indo})
                      </span>
                    )}
                  </div>
                </div>

                {/* Toggle */}
                <div className="flex-shrink-0 pt-1">
                  {isExpanded ? (
                    <ChevronUp size={16} style={{ color: "var(--color-text-subtle)" }} />
                  ) : (
                    <ChevronDown size={16} style={{ color: "var(--color-text-subtle)" }} />
                  )}
                </div>
              </button>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-4" style={{ borderTop: "1px solid var(--color-surface-dark)" }}>
                  {/* Summary */}
                  <div className="pt-4 grid grid-cols-3 gap-3">
                    <div className="text-center rounded-xl p-3" style={{ background: "var(--color-primary-50)", boxShadow: "var(--shadow-inset-sm)" }}>
                      <TrendingUp size={16} className="mx-auto mb-1" style={{ color: "var(--color-primary)" }} />
                      <p className="text-lg font-bold" style={{ color: "var(--color-primary)" }}>{r.average || "-"}</p>
                      <p className="text-[9px] font-bold" style={{ color: "var(--color-text-muted)" }}>Rata-rata</p>
                    </div>
                    <div className="text-center rounded-xl p-3" style={{ background: statusStyle.bg, boxShadow: "var(--shadow-inset-sm)" }}>
                      <Award size={16} className="mx-auto mb-1" style={{ color: statusStyle.color }} />
                      <p className="text-xs font-bold" style={{ color: statusStyle.color }}>{statusStyle.label}</p>
                      <p className="text-[9px] font-bold" style={{ color: "var(--color-text-muted)" }}>Status</p>
                    </div>
                    <div className="text-center rounded-xl p-3" style={{ background: r.isTasmi ? "var(--color-success-light)" : "var(--color-surface-light)", boxShadow: "var(--shadow-inset-sm)" }}>
                      <BookOpen size={16} className="mx-auto mb-1" style={{ color: r.isTasmi ? "var(--color-success)" : "var(--color-text-subtle)" }} />
                      <p className="text-xs font-bold" style={{ color: r.isTasmi ? "var(--color-success)" : "var(--color-text-subtle)" }}>
                        {r.isTasmi ? "Ya" : "Tidak"}
                      </p>
                      <p className="text-[9px] font-bold" style={{ color: "var(--color-text-muted)" }}>Tasmi</p>
                    </div>
                  </div>

                  {/* Nilai Preview */}
                  {r.nilaiRows.length > 0 && (
                    <div className="space-y-1.5">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Nilai</h4>
                      {r.nilaiRows.slice(0, 5).map((n, i) => (
                        <div key={i} className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: "var(--color-surface-light)" }}>
                          <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>{n.namaIndo}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold" style={{ color: n.skor !== null && n.skor >= 70 ? "var(--color-success)" : n.skor !== null ? "var(--color-danger)" : "var(--color-text-subtle)" }}>
                              {n.skor !== null ? Math.round(n.skor) : "-"}
                            </span>
                            {n.predikat && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: "var(--color-primary-50)", color: "var(--color-primary)" }}>
                                {n.predikat.indo}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {r.nilaiRows.length > 5 && (
                        <p className="text-[10px] text-center pt-1" style={{ color: "var(--color-text-subtle)" }}>
                          +{r.nilaiRows.length - 5} mata pelajaran lainnya
                        </p>
                      )}
                    </div>
                  )}

                  {/* Transkrip Gabungan Akbarnas */}
                  {r.transkripGabungan && (
                    <div className="space-y-1.5">
                      <button
                        onClick={() => setShowTranskripId(showTranskripId === r.id ? null : r.id)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all"
                        style={{
                          background: "var(--color-primary-50)",
                          color: "var(--color-primary)",
                        }}
                      >
                        <BookOpen size={14} />
                        {showTranskripId === r.id ? "Tutup Transkrip Gabungan" : "Lihat Transkrip Gabungan"}
                        {showTranskripId === r.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      {showTranskripId === r.id && (
                        <div className="rounded-xl p-3 space-y-1.5" style={{ background: "var(--color-surface-light)" }}>
                          <p className="text-[10px] font-bold text-center" style={{ color: "var(--color-text-muted)" }}>
                            Gabungan {r.transkripGabungan.dariDufah} + {r.transkripGabungan.sampaiDufah}
                          </p>
                          <div className="flex items-center justify-between px-2 py-1.5 rounded-lg" style={{ background: "var(--color-primary-50)" }}>
                            <span className="text-xs font-bold" style={{ color: "var(--color-text)" }}>Rata-rata Gabungan</span>
                            <span className="text-xs font-bold" style={{ color: "var(--color-primary)" }}>
                              {r.transkripGabungan.average} ({r.transkripGabungan.averagePredikat.indo})
                            </span>
                          </div>
                          {r.transkripGabungan.nilaiRows.map((n, i) => (
                            <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white">
                              <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>{n.namaIndo}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold" style={{ color: n.skor !== null && n.skor >= 70 ? "var(--color-success)" : n.skor !== null ? "var(--color-danger)" : "var(--color-text-subtle)" }}>
                                  {n.skor !== null ? Math.round(n.skor) : "-"}
                                </span>
                                {n.predikat && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: "var(--color-primary-50)", color: "var(--color-primary)" }}>
                                    {n.predikat.indo}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Transkrip Nilai (program non-Akbarnas) */}
                  {!r.programNama.toLowerCase().includes("akbarnas") && r.nilaiRows.length > 0 && (
                    <Link
                      href={`/santri/transkrip/${r.riwayatId}`}
                      target="_blank"
                      className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold transition-all"
                      style={{
                        background: "var(--color-surface-light)",
                        color: "var(--color-primary)",
                        border: "1px solid var(--color-primary-100)",
                      }}
                    >
                      <FileText size={14} />
                      Lihat Transkrip Nilai
                    </Link>
                  )}

                  {/* Download Syahadah */}
                  {r.canDownloadSyahadah && (                    <Link
                      href={`/cetak/${r.riwayatId}`}
                      target="_blank"
                      className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold transition-all"
                      style={{
                        background: "var(--color-primary)",
                        color: "#fff",
                        boxShadow: "3px 3px 8px rgba(0,102,102,0.3), -2px -2px 6px rgba(0,133,133,0.15)",
                      }}
                    >
                      <Download size={14} />
                      Lihat Syahadah
                    </Link>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
