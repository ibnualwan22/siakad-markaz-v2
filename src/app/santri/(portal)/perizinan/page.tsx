"use client";

import { useEffect, useState } from "react";
import {
  Shield,
  Calendar,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Timer,
  FileText,
  Plus
} from "lucide-react";
import SantriPerizinanForm from "@/components/santri/santri-perizinan-form";
import TasrihDigital from "@/components/public/tasrih-digital";
import SelfieCamera from "@/components/santri/selfie-camera";
import { Camera } from "lucide-react";

type PerizinanItem = {
  id: string;
  nomorTasrih: string;
  tipeIzin: string;
  alasan: string;
  tanggalMulai: string;
  tanggalSelesai: string | null;
  statusIzin: string;
  tanggalKembali: string | null;
  statusAbsen: string;
  createdAt: string;
  selfieUrl: string | null;
  selfieAt: string | null;
};

type RiwayatData = {
  id: string;
  dufahNama: string;
  kelasNama: string;
  perizinan: PerizinanItem[];
};

const tipeLabel: Record<string, string> = {
  HARIAN: "Harian",
  BERHARI_HARI: "Berhari-hari",
  KELUAR_PARE: "Keluar Pare",
  TABIROT: "Ta'birot",
};

const statusConfig: Record<string, { color: string; bg: string; label: string; icon: any }> = {
  MENUNGGU: { color: "var(--color-warning)", bg: "var(--color-warning-light)", label: "Menunggu", icon: Timer },
  AKTIF: { color: "var(--color-info)", bg: "#eff6ff", label: "Aktif", icon: AlertCircle },
  SUDAH_KEMBALI: { color: "var(--color-success)", bg: "var(--color-success-light)", label: "Sudah Kembali", icon: CheckCircle },
  SELESAI: { color: "var(--color-text-muted)", bg: "var(--color-surface-light)", label: "Selesai", icon: CheckCircle },
  DITOLAK: { color: "var(--color-danger)", bg: "var(--color-danger-light)", label: "Ditolak", icon: XCircle },
  KADALUARSA: { color: "var(--color-danger)", bg: "var(--color-danger-light)", label: "Kadaluarsa", icon: XCircle },
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export default function SantriPerizinanPage() {
  const [riwayat, setRiwayat] = useState<RiwayatData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDufah, setActiveDufah] = useState(0);
  const [viewMode, setViewMode] = useState<"RIWAYAT" | "FORM">("RIWAYAT");
  const [santriData, setSantriData] = useState<any>(null);
  const [selectedTasrihData, setSelectedTasrihData] = useState<any>(null);
  const [selfieTarget, setSelfieTarget] = useState<string | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    fetch("/api/santri/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setRiwayat(d.riwayat);
          setSantriData(d.santri);
        }
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

  const allPerizinan = riwayat.flatMap((r) =>
    r.perizinan.map((p) => ({ ...p, dufahNama: r.dufahNama }))
  );



  const current = riwayat[activeDufah];
  const perizinanListRaw = current?.perizinan ?? [];
  
  // Hitung jumlah izian dengan KADALUARSA
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  const perizinanList = perizinanListRaw.map((p) => {
    let isExpired = false;
    if ((p.tipeIzin === "HARIAN" || p.tipeIzin === "TABIROT") && (p.statusIzin === "AKTIF" || p.statusIzin === "MENUNGGU")) {
      const pDate = new Date(p.tanggalMulai);
      pDate.setHours(0, 0, 0, 0);
      if (pDate < todayDate) isExpired = true;
    }
    return {
      ...p,
      computedStatus: isExpired ? "KADALUARSA" : p.statusIzin
    };
  });

  // Calculate Pagination Data
  const totalPages = Math.ceil(perizinanList.length / itemsPerPage);
  const paginatedPerizinan = perizinanList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Ambil kelas dari riwayat aktif, fallback ke santriData kalo ada
  const kelasNama = current?.kelasNama || "Tanpa Kelas";

  // Stats
  const totalIzin = perizinanList.length;
  const aktifCount = perizinanList.filter((p) => p.computedStatus === "AKTIF" || p.computedStatus === "MENUNGGU").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--color-text)" }}>Perizinan Santri</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>Kelola pengajuan izin dan riwayat tasrih</p>
        </div>
      </div>

      <div className="flex bg-slate-100/50 p-1 rounded-xl w-full sm:w-fit border border-slate-200/60 shadow-sm">
        <button
          onClick={() => setViewMode("RIWAYAT")}
          className={`flex-1 sm:flex-none px-6 py-2.5 text-sm font-bold rounded-lg transition-all ${viewMode === "RIWAYAT" ? "bg-white shadow-sm text-[var(--color-primary)] border border-slate-200" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}
        >
          Riwayat Izin
        </button>
        <button
          onClick={() => setViewMode("FORM")}
          className={`flex-1 sm:flex-none px-6 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${viewMode === "FORM" ? "bg-white shadow-sm text-[var(--color-primary)] border border-slate-200" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}
        >
          <Plus size={16} /> Buat Izin
        </button>
      </div>

      {viewMode === "FORM" && current && santriData ? (
        <SantriPerizinanForm
          currentSantri={{
            riwayatId: current.id,
            nama: santriData.nama,
            kelasNama: kelasNama,
            sakan: santriData.sakan || "-"
          }}
          onSuccess={() => {
            // Refresh data upon success
            setLoading(true);
            fetch("/api/santri/me").then(r => r.json()).then(d => {
              if (d.success) {
                setRiwayat(d.riwayat);
                setSantriData(d.santri);
              }
              setLoading(false);
              setViewMode("RIWAYAT");
            }).catch(() => {
              setLoading(false);
              setViewMode("RIWAYAT");
            });
          }}
        />
      ) : (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Dufah Selector */}
          {riwayat.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {riwayat.map((r, i) => (
                <button
                  key={r.id}
                  onClick={() => setActiveDufah(i)}
                  className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all ${i === activeDufah ? "" : "neu-button"}`}
                  style={i === activeDufah ? { background: "var(--color-primary)", color: "#fff", boxShadow: "3px 3px 8px rgba(0,102,102,0.3)" } : { color: "var(--color-text-muted)" }}
                >
                  {r.dufahNama}
                </button>
              ))}
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="neu-card-white p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText size={14} style={{ color: "var(--color-primary)" }} />
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Total Izin</span>
              </div>
              <p className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>{totalIzin}</p>
            </div>
            <div className="neu-card-white p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={14} style={{ color: "var(--color-info)" }} />
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Sedang Aktif</span>
              </div>
              <p className="text-2xl font-bold" style={{ color: aktifCount > 0 ? "var(--color-info)" : "var(--color-text)" }}>{aktifCount}</p>
            </div>
          </div>

          {/* Perizinan List */}
          <div className="space-y-3">
            {paginatedPerizinan.length === 0 ? (
              <div className="neu-card p-8 text-center">
                <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>Tidak ada perizinan di duf&apos;ah ini</p>
              </div>
            ) : (
              paginatedPerizinan.map((p) => {
                const cfg = statusConfig[p.computedStatus] || statusConfig.SELESAI;
                const StatusIcon = cfg.icon;

                return (
                  <div
                    key={p.id}
                    className="neu-card p-4 space-y-3 cursor-pointer hover:bg-slate-50 transition-colors relative"
                    onClick={() => {
                      setSelectedTasrihData({
                        grupId: p.id,
                        tipeIzin: p.tipeIzin,
                        statusIzin: p.statusIzin,
                        alasan: p.alasan,
                        tanggalMulai: p.tanggalMulai,
                        tanggalSelesai: p.tanggalSelesai,
                        batasJamAkhir: p.tipeIzin === "KELUAR_PARE" ? "22:00" : null,
                        nomorTasrih: p.nomorTasrih,
                        createdAt: p.createdAt,
                        createdBy: null,
                        records: [
                          {
                            id: p.id,
                            sakan: santriData?.sakan || "-",
                            riwayat: {
                              santri: {
                                nama: santriData?.nama || "Santri",
                                kelas: { nama: kelasNama }
                              },
                              kelas: { nama: kelasNama }
                            }
                          }
                        ]
                      });
                    }}
                  >
                    {/* Top Row */}
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-bold" style={{ color: "var(--color-text)" }}>
                          {p.nomorTasrih}
                        </p>
                        <span
                          className="inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-bold"
                          style={{
                            background: p.tipeIzin === "KELUAR_PARE" || p.tipeIzin === "BERHARI_HARI" ? "var(--color-danger-light)" : "var(--color-primary-50)",
                            color: p.tipeIzin === "KELUAR_PARE" || p.tipeIzin === "BERHARI_HARI" ? "var(--color-danger)" : "var(--color-primary)",
                          }}
                        >
                          {tipeLabel[p.tipeIzin] || p.tipeIzin}
                        </span>
                      </div>
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold"
                        style={{ background: cfg.bg, color: cfg.color }}
                      >
                        <StatusIcon size={12} />
                        {cfg.label}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                        <Calendar size={12} style={{ color: "var(--color-text-subtle)" }} />
                        <span>
                          {formatDate(p.tanggalMulai)}
                          {p.tanggalSelesai && ` - ${formatDate(p.tanggalSelesai)}`}
                        </span>
                      </div>
                      <div className="flex items-start gap-2 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                        <FileText size={12} className="flex-shrink-0 mt-0.5" style={{ color: "var(--color-text-subtle)" }} />
                        <span className="line-clamp-1">{p.alasan}</span>
                      </div>
                      {p.tanggalKembali && (
                        <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--color-success)" }}>
                          <CheckCircle size={12} />
                          <span>Kembali: {formatDate(p.tanggalKembali)}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--color-text-subtle)" }}>
                        <Clock size={12} />
                        <span>Dicatat: {formatDate(p.createdAt)}</span>
                      </div>
                    </div>

                    {((p.tipeIzin === "KELUAR_PARE" || p.tipeIzin === "BERHARI_HARI") && (p.computedStatus === "AKTIF" || p.computedStatus === "SUDAH_KEMBALI")) && (
                      <div className="pt-2">
                        {p.selfieUrl ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-200">
                            <CheckCircle size={14} /> Terkonfirmasi {p.selfieAt ? new Date(p.selfieAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB" : ""}
                          </div>
                        ) : p.computedStatus === "AKTIF" ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelfieTarget(p.id);
                            }}
                            className="w-full mt-1.5 py-2.5 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 transition flex items-center justify-center gap-2 shadow-md shadow-slate-800/20 active:scale-95"
                          >
                            <Camera size={14} /> Konfirmasi Kehadiran
                          </button>
                        ) : null}
                      </div>
                    )}

                    <div className="absolute top-1/2 -translate-y-1/2 right-4 opacity-50 sm:hidden">
                      <Plus size={16} /> {/* just a placeholder to indicate clickable if we want, or do nothing */}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center bg-slate-100 p-2 rounded-xl mt-4 border border-slate-200">
              <button 
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50 transition-colors"
              >
                Sebelumnya
              </button>
              <div className="text-xs font-bold text-slate-500">
                Hal {currentPage} / {totalPages}
              </div>
              <button 
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50 transition-colors"
              >
                Selanjutnya
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal Tasrih */}
      {selectedTasrihData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedTasrihData(null)}>
          <div className="relative w-full max-w-md animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setSelectedTasrihData(null)}
              className="absolute -top-12 right-0 text-white hover:text-slate-200 flex items-center gap-2 text-sm font-bold bg-slate-800/50 px-3 py-1.5 rounded-full backdrop-blur-md"
            >
              Tutup <XCircle size={18} />
            </button>
            <TasrihDigital data={selectedTasrihData} hideQR={true} hideDownload={true} />
          </div>
        </div>
      )}

      {/* Selfie Camera */}
      {selfieTarget && (
        <SelfieCamera
          perizinanId={selfieTarget}
          onClose={() => setSelfieTarget(null)}
          onSuccess={(url, at) => {
            // Update local state without full refetch for smoother UX
            setRiwayat(prevRiwayat => 
              prevRiwayat.map(r => ({
                ...r,
                perizinan: r.perizinan.map(p => 
                  p.id === selfieTarget 
                    ? { ...p, selfieUrl: url, selfieAt: at, statusIzin: "SUDAH_KEMBALI", tanggalKembali: new Date().toISOString() } 
                    : p
                )
              }))
            );
            setSelfieTarget(null);
          }}
        />
      )}
    </div>
  );
}
