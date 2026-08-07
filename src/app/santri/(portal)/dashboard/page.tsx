"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  User,
  BookOpen,
  MapPin,
  FileText,
  CalendarCheck,
  Clock,
  Shield,
  TrendingUp,
  Award,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Hourglass,
  Calendar,
  ClipboardList,
} from "lucide-react";

type SantriData = {
  santri: {
    id: string;
    nama: string;
    gender: string;
    sakan: string;
    kamar: string;
    nomorLemari: string;
    kategori: string;
    isAktif: boolean;
    tempatLahir: string;
    tanggalLahir: string;
    alamat: string;
  };
  riwayat: Array<{
    id: string;
    dufahNama: string;
    programNama: string;
    kelasNama: string;
    statusKelulusan: string;
    average: number;
    averagePredikat: { indo: string; arab: string };
    rekapAbsenKelas: { hadir: number; total: number };
    rekapAbsenSakan: { hadir: number; total: number };
  }>;
};

type StatusData = {
  masaAktif?: {
    sisaKoutaBulan?: number;
    berakhirPadaDufahNama?: string;
    dufahSekarangSistem?: {
      id: number;
      nama: string;
    };
  };
  [key: string]: any;
};

export default function SantriDashboardPage() {
  const [data, setData] = useState<SantriData | null>(null);
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState(false);
  const [loading, setLoading] = useState(true);

  // Tauzi UI State
  const [tauziData, setTauziData] = useState<any>(null);
  const [tauziLoading, setTauziLoading] = useState(true);
  const [selectedTauziProg, setSelectedTauziProg] = useState("");
  const [submittingTauzi, setSubmittingTauzi] = useState(false);

  useEffect(() => {
    fetch("/api/santri/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetch("/api/santri/me/status")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setStatusData(d.data);
        else setStatusError(true);
        setStatusLoading(false);
      })
      .catch(() => {
        setStatusError(true);
        setStatusLoading(false);
      });

    // Fetch tauzi/program Data
    fetch("/api/santri/me/tauzi")
      .then(res => res.json())
      .then(data => {
        if (!data.error && data.programs) {
          setTauziData(data);
          if (data.riwayat?.programId) {
            setSelectedTauziProg(data.riwayat.programId);
          }
        }
      })
      .catch()
      .finally(() => setTauziLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div
          className="h-8 w-8 border-3 rounded-full animate-spin"
          style={{
            borderColor: "var(--color-primary-100)",
            borderTopColor: "var(--color-primary)",
          }}
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <AlertTriangle size={32} style={{ color: "var(--color-warning)" }} />
        <p
          className="text-sm font-semibold"
          style={{ color: "var(--color-text-muted)" }}
        >
          Gagal memuat data
        </p>
      </div>
    );
  }

  const { santri, riwayat } = data;
  const currentRiwayat = riwayat[0];

  const statusColor =
    currentRiwayat?.statusKelulusan === "LULUS"
      ? "var(--color-success)"
      : currentRiwayat?.statusKelulusan === "TIDAK_LULUS"
        ? "var(--color-danger)"
        : "var(--color-warning)";

  const statusBg =
    currentRiwayat?.statusKelulusan === "LULUS"
      ? "var(--color-success-light)"
      : currentRiwayat?.statusKelulusan === "TIDAK_LULUS"
        ? "var(--color-danger-light)"
        : "var(--color-warning-light)";

  const statusLabel =
    currentRiwayat?.statusKelulusan === "LULUS"
      ? "Lulus"
      : currentRiwayat?.statusKelulusan === "TIDAK_LULUS"
        ? "Tidak Lulus"
        : "Belum Lengkap";

  const kehadiranKelas =
    currentRiwayat && currentRiwayat.rekapAbsenKelas.total > 0
      ? Math.round(
        (currentRiwayat.rekapAbsenKelas.hadir /
          currentRiwayat.rekapAbsenKelas.total) *
        100
      )
      : 0;

  const kehadiranSakan =
    currentRiwayat && currentRiwayat.rekapAbsenSakan.total > 0
      ? Math.round(
        (currentRiwayat.rekapAbsenSakan.hadir /
          currentRiwayat.rekapAbsenSakan.total) *
        100
      )
      : 0;

  const adjustDufahName = (name?: string) => {
    if (!name || name === "Belum Ditentukan") return name;
    return name.replace(/\d+/, (match) => {
      const num = parseInt(match, 10);
      return num < 80 ? (num + 80).toString() : num.toString();
    });
  };

  const sisaBulan = statusData?.masaAktif?.sisaKoutaBulan;
  const berakhirDufah = adjustDufahName(statusData?.masaAktif?.berakhirPadaDufahNama);
  const dufahSekarang = adjustDufahName(statusData?.masaAktif?.dufahSekarangSistem?.nama);

  const isDurasiLow = sisaBulan !== undefined && sisaBulan !== null && sisaBulan <= 2;

  const daftarUlangLink = santri.kategori?.toUpperCase() === 'TUROTS'
    ? 'https://ppdb.markazarabiyah.site/daftar-ulang?kategori=TUROTS'
    : 'https://ppdb.markazarabiyah.site/daftar-ulang?kategori=REGULER';

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1
          className="text-xl font-bold"
          style={{ color: "var(--color-text)" }}
        >
          Beranda
        </h1>
        <p
          className="text-xs mt-0.5"
          style={{ color: "var(--color-text-muted)" }}
        >
          Selamat datang di SIAKAD Markaz Arabiyah
        </p>
      </div>

      {/* Inactive Banner */}
      {!santri.isAktif && (
        <div
          className="rounded-xl p-4 flex items-start gap-3"
          style={{
            background: "var(--color-warning-light)",
            boxShadow: "var(--shadow-inset-sm)",
          }}
        >
          <AlertTriangle
            size={18}
            className="flex-shrink-0 mt-0.5"
            style={{ color: "var(--color-warning)" }}
          />
          <div>
            <p
              className="text-xs font-bold"
              style={{ color: "var(--color-warning)" }}
            >
              Status Tidak Aktif
            </p>
            <p
              className="text-[11px] mt-0.5"
              style={{ color: "var(--color-text-muted)" }}
            >
              Anda tercatat tidak aktif. Silakan lakukan daftar ulang untuk
              mengaktifkan kembali status santri.
            </p>
            <a
              href={daftarUlangLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg text-[11px] font-bold"
              style={{
                background: "var(--color-warning)",
                color: "#fff",
              }}
            >
              <RefreshCw size={12} />
              Daftar Ulang (Eksternal)
            </a>
          </div>
        </div>
      )}

      {/* Profile Card */}
      <div className="neu-card p-5">
        <div className="flex items-start gap-4">
          <div
            className="flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{
              background: "var(--color-primary-50)",
              boxShadow: "var(--shadow-inset-sm)",
            }}
          >
            <User size={24} style={{ color: "var(--color-primary)" }} />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              className="text-base font-bold truncate"
              style={{ color: "var(--color-text)" }}
            >
              {santri.nama}
            </h2>
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center gap-2 text-xs">
                <BookOpen
                  size={13}
                  style={{ color: "var(--color-text-subtle)" }}
                />
                <span style={{ color: "var(--color-text-muted)" }}>
                  {currentRiwayat?.programNama ?? "Belum diatur"} /{" "}
                  {currentRiwayat?.kelasNama ?? "-"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <MapPin
                  size={13}
                  style={{ color: "var(--color-text-subtle)" }}
                />
                <span style={{ color: "var(--color-text-muted)" }}>
                  {santri.sakan || "-"} / {santri.kamar || "-"} /{" "}
                  {santri.nomorLemari || "-"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Clock
                  size={13}
                  style={{ color: "var(--color-text-subtle)" }}
                />
                <span style={{ color: "var(--color-text-muted)" }}>
                  Duf&apos;ah: {currentRiwayat?.dufahNama ?? "-"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Status Durasi Card */}
        {!statusLoading && !statusError && statusData?.masaAktif && (
          <div
            className="neu-card p-5 flex flex-col h-full"
            style={{
              background: isDurasiLow
                ? "linear-gradient(135deg, var(--color-danger-light), var(--bg-card))"
                : "linear-gradient(135deg, var(--color-primary-50), var(--bg-card))",
            }}
          >
            <div className="flex items-start gap-4 flex-1">
              <div
                className="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{
                  background: isDurasiLow ? "var(--color-danger-light)" : "var(--color-primary-50)",
                  boxShadow: "var(--shadow-inset-sm)",
                }}
              >
                <Hourglass
                  size={22}
                  style={{
                    color: isDurasiLow ? "var(--color-danger)" : "var(--color-primary)",
                  }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Masa Aktif Asrama
                </h3>
                <div className="mt-2 flex items-baseline gap-2">
                  <span
                    className="text-3xl font-bold"
                    style={{
                      color: isDurasiLow ? "var(--color-danger)" : "var(--color-primary)",
                    }}
                  >
                    {sisaBulan ?? "-"}
                  </span>
                  <span
                    className="text-sm font-semibold"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    bulan tersisa
                  </span>
                </div>
                {berakhirDufah && (
                  <div className="mt-2 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={12} style={{ color: "var(--color-text-subtle)" }} />
                      <span
                        className="text-[11px]"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        Berakhir pada {berakhirDufah}
                      </span>
                    </div>
                    {dufahSekarang && (
                      <div className="flex items-center gap-1.5">
                        <Hourglass size={12} style={{ color: "var(--color-text-subtle)" }} />
                        <span
                          className="text-[11px]"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          Sedang berjalan: {dufahSekarang}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                {isDurasiLow && (
                  <a
                    href={daftarUlangLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center w-full gap-1.5 mt-3 px-3.5 py-2.5 rounded-xl text-[11px] font-bold transition-all"
                    style={{
                      background: "var(--color-danger)",
                      color: "#fff",
                      boxShadow: "2px 2px 6px rgba(255,33,87,0.25)",
                    }}
                  >
                    <RefreshCw size={13} />
                    Segera Daftar Ulang
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Program Info Card */}
        {!tauziLoading && tauziData && (
          <div className="neu-card p-5 flex flex-col h-full" style={{ background: "linear-gradient(135deg, var(--bg-card), var(--color-primary-50))", border: "2px solid var(--color-primary)" }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl" style={{ background: "var(--color-primary)", color: "white" }}>
                <ClipboardList size={22} />
              </div>
              <div>
                <h3 className="font-bold text-sm" style={{ color: "var(--color-text)" }}>Program Pembelajaran</h3>
                <p className="text-[11px] font-semibold" style={{ color: "var(--color-text-muted)" }}>
                  {tauziData.riwayat?.program?.nama_indo ? 'Pilih ulang jika ingin mengubah kategori' : 'Silakan pilih kategori/program tujuan Anda'}
                </p>
              </div>
            </div>

            <div className="space-y-3 mt-auto">
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">Pilih Tujuan Program Anda</label>
              <select
                value={selectedTauziProg}
                onChange={e => setSelectedTauziProg(e.target.value)}
                className="neu-input w-full p-2.5 text-sm font-bold"
                style={{ color: "var(--color-text)" }}
              >
                <option value="">-- Pilih Kategori Program --</option>
                {tauziData.programs.map((p: any) => <option key={p.id} value={p.id}>{p.nama_indo}</option>)}
              </select>
              <button
                onClick={async () => {
                  if (!selectedTauziProg) return;
                  setSubmittingTauzi(true);
                  try {
                    const res = await fetch("/api/santri/me/tauzi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ programId: selectedTauziProg }) });
                    if (res.ok) {
                      const updated = await res.json();
                      setTauziData((prev: any) => ({ ...prev, riwayat: updated.riwayat }));
                      alert("Berhasil menyimpan program Anda!");
                      window.location.reload();
                    } else {
                      alert("Gagal menyimpan program. Silakan coba lagi.");
                    }
                  } finally { setSubmittingTauzi(false); }
                }}
                disabled={!selectedTauziProg || submittingTauzi || selectedTauziProg === tauziData.riwayat?.programId}
                className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all ${(!selectedTauziProg || submittingTauzi || selectedTauziProg === tauziData.riwayat?.programId) ? "bg-gray-100 text-gray-400" : "neu-button-primary"}`}
              >
                {submittingTauzi ? "Menyimpan..." : (selectedTauziProg === tauziData.riwayat?.programId ? "Program Telah Disimpan" : "Simpan Pilihan Program")}
              </button>

              {tauziData.riwayat?.programId && (
                <div className="pt-3 mt-1 border-t border-slate-200">
                  <Link
                    href="/tauzi/login"
                    className="w-full inline-flex justify-center items-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md hover:scale-[1.02] hover:shadow-lg"
                    style={{ background: "var(--color-primary)", color: "white" }}
                  >
                    <ClipboardList size={18} /> Mengerjakan Tauzi&apos; Fushul
                  </Link>
                  <p className="text-[10px] text-center mt-1.5 font-semibold" style={{ color: "var(--color-text-muted)" }}>Tekan tombol di atas untuk masuk ke portal ujian</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Kartu Santri Digital */}
      <div className="neu-card p-4 sm:p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="p-2 sm:p-2.5 rounded-xl"
            style={{
              background: "var(--color-primary-50)",
              color: "var(--color-primary)",
            }}
          >
            <Award size={20} className="sm:w-6 sm:h-6" />
          </div>
          <div>
            <h3
              className="text-xs sm:text-sm font-bold"
              style={{ color: "var(--color-text)" }}
            >
              Kartu Santri Digital
            </h3>
            <p className="text-[10px] sm:text-[11px] font-semibold mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              Download kartu identitas santri Anda
            </p>
          </div>
        </div>
        <a
          href={`https://ppdb.markazarabiyah.site/api/digital-card/siakad/${santri.id}?download=1`}
          className="inline-flex flex-shrink-0 items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white transition-all hover:scale-[1.02] shadow-md hover:shadow-lg"
          style={{ background: "var(--color-primary)", whiteSpace: 'nowrap' }}
        >
          Download Kartu
        </a>
      </div>

      {/* Summary Cards */}
      {currentRiwayat && (
        <div className="grid grid-cols-2 gap-3">
          {/* Rata-rata Nilai */}
          <div className="neu-card-white p-4">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="p-1.5 rounded-lg"
                style={{
                  background: "var(--color-primary-50)",
                  color: "var(--color-primary)",
                }}
              >
                <TrendingUp size={14} />
              </div>
              <span
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: "var(--color-text-muted)" }}
              >
                Rata-rata
              </span>
            </div>
            <p
              className="text-2xl font-bold"
              style={{ color: "var(--color-text)" }}
            >
              {currentRiwayat.average || "-"}
            </p>
            <p
              className="text-[10px] font-semibold mt-0.5"
              style={{ color: "var(--color-primary)" }}
            >
              {currentRiwayat.averagePredikat?.indo || "-"}
            </p>
          </div>

          {/* Status Kelulusan */}
          <div className="neu-card-white p-4">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="p-1.5 rounded-lg"
                style={{ background: statusBg, color: statusColor }}
              >
                <Award size={14} />
              </div>
              <span
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: "var(--color-text-muted)" }}
              >
                Status
              </span>
            </div>
            <p className="text-sm font-bold" style={{ color: statusColor }}>
              {statusLabel}
            </p>
          </div>

          {/* Kehadiran Kelas */}
          <div className="neu-card-white p-4">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="p-1.5 rounded-lg"
                style={{
                  background: "var(--color-success-light)",
                  color: "var(--color-success)",
                }}
              >
                <CalendarCheck size={14} />
              </div>
              <span
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: "var(--color-text-muted)" }}
              >
                Kelas
              </span>
            </div>
            <p
              className="text-2xl font-bold"
              style={{ color: "var(--color-text)" }}
            >
              {kehadiranKelas}%
            </p>
            <p
              className="text-[10px] mt-0.5"
              style={{ color: "var(--color-text-subtle)" }}
            >
              {currentRiwayat.rekapAbsenKelas.hadir}/
              {currentRiwayat.rekapAbsenKelas.total} sesi
            </p>
          </div>

          {/* Kehadiran Sakan */}
          <div className="neu-card-white p-4">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="p-1.5 rounded-lg"
                style={{
                  background: "var(--color-primary-50)",
                  color: "var(--color-primary)",
                }}
              >
                <CheckCircle size={14} />
              </div>
              <span
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: "var(--color-text-muted)" }}
              >
                Sakan
              </span>
            </div>
            <p
              className="text-2xl font-bold"
              style={{ color: "var(--color-text)" }}
            >
              {kehadiranSakan}%
            </p>
            <p
              className="text-[10px] mt-0.5"
              style={{ color: "var(--color-text-subtle)" }}
            >
              {currentRiwayat.rekapAbsenSakan.hadir}/
              {currentRiwayat.rekapAbsenSakan.total} hari
            </p>
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="space-y-2">
        <h3
          className="text-xs font-bold uppercase tracking-wider"
          style={{ color: "var(--color-text-muted)" }}
        >
          Menu Cepat
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            {
              href: "/santri/nilai",
              icon: FileText,
              label: "Lihat Nilai",
              desc: "Detail nilai per mata pelajaran",
            },
            {
              href: "/santri/absensi",
              icon: CalendarCheck,
              label: "Rekap Absensi",
              desc: "Kehadiran kelas, sakan & kegiatan",
            },
            {
              href: "/santri/riwayat",
              icon: Clock,
              label: "Riwayat Duf'ah",
              desc: "Histori per duf'ah sebelumnya",
            },
            {
              href: "/santri/perizinan",
              icon: Shield,
              label: "Riwayat Perizinan",
              desc: "Status izin dan tasrih",
            },
            {
              href: daftarUlangLink,
              icon: RefreshCw,
              label: "Daftar Ulang",
              desc: "Via Website PPDB Pusat",
            },
          ].map((item) => {
            const Icon = item.icon;

            const isExternal = item.href.startsWith("http");

            if (isExternal) {
              return (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="neu-card-white p-4 flex items-center gap-3 hover:scale-[1.01] transition-transform"
                >
                  <div
                    className="flex-shrink-0 p-2 rounded-xl"
                    style={{
                      background: "var(--color-primary-50)",
                      color: "var(--color-primary)",
                    }}
                  >
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <p
                      className="text-xs font-bold"
                      style={{ color: "var(--color-text)" }}
                    >
                      {item.label}
                    </p>
                    <p
                      className="text-[10px]"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {item.desc}
                    </p>
                  </div>
                </a>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className="neu-card-white p-4 flex items-center gap-3 hover:scale-[1.01] transition-transform"
              >
                <div
                  className="flex-shrink-0 p-2 rounded-xl"
                  style={{
                    background: "var(--color-primary-50)",
                    color: "var(--color-primary)",
                  }}
                >
                  <Icon size={18} />
                </div>
                <div className="min-w-0">
                  <p
                    className="text-xs font-bold"
                    style={{ color: "var(--color-text)" }}
                  >
                    {item.label}
                  </p>
                  <p
                    className="text-[10px]"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {item.desc}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
