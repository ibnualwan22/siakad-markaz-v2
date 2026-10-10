"use client";

import { useEffect, useState } from "react";
import {
  RefreshCw,
  Hourglass,
  Calendar,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Loader2,
  Info,
} from "lucide-react";

type PPDBProgram = {
  id: string;
  nama: string;
  kategoriProgram?: string;
  durasiBulanFormatted: string;
  tglProgramFormatted: string;
  hargaFormatted: string;
  harga: number;
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
  logikaSistem?: {
    butuhDaftarUlang: boolean;
    statusKoneksi: string;
  };
  [key: string]: any;
};

type MetaData = {
  informasiPendaftaranBuka?: {
    nama: string;
  };
  programTersedia?: PPDBProgram[];
};

type PendingTagihan = {
  id: string;
  noKwitansi: string;
  nominalProgram: number;
  kodeUnik: number;
  totalTagihan: number;
  createdAt: string;
  program: { id: string; nama: string };
  dufah: { id: number; nama: string } | null;
};

export default function SantriDaftarUlangPage() {
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [metaData, setMetaData] = useState<MetaData | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [activeKategori, setActiveKategori] = useState<string>("ALL");
  const [selectedProgram, setSelectedProgram] = useState("");
  const [isBeliAtribut, setIsBeliAtribut] = useState(false);
  const [isAgreed, setIsAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Tagihan PENDING — bila ada, wizard diganti layar "Menunggu Verifikasi"
  const [pendingTagihan, setPendingTagihan] = useState<PendingTagihan | null>(null);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const fetchPending = async () => {
    try {
      const r = await fetch("/api/santri/me/daftar-ulang", { cache: "no-store" });
      const d = await r.json();
      if (d.success && d.data?.pending) {
        setPendingTagihan(d.data.pending);
      } else {
        setPendingTagihan(null);
      }
    } catch {
      // abaikan — wizard tetap tampil bila cek gagal
    } finally {
      setPendingLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
    // Fetch status directly from the PPDB Integration API
    fetch("/api/santri/me/status")
      .then((r) => r.json())
      .then((d) => {
        if (d.data) setStatusData(d.data);
        if (d.meta) setMetaData(d.meta);
        if (!d.success && d.error) {
           setStatusError(d.error);
        }
        setStatusLoading(false);
      })
      .catch(() => {
        setStatusError("Tidak dapat terhubung ke server PPDB");
        setStatusLoading(false);
      });
  }, []);

  const handleSubmit = async () => {
    if (!selectedProgram) return;
    if (!isAgreed) return;
    setSubmitting(true);
    setResult(null);

    try {
      const res = await fetch("/api/santri/me/daftar-ulang", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programId: selectedProgram, isBeliAtribut }),
      });

      const data = await res.json();

      if (!res.ok) {
        // 409 = sudah ada tagihan PENDING — tampilkan layar pembayaran
        if (res.status === 409) {
          await fetchPending();
          setResult({
            success: false,
            message: "Anda sudah memiliki tagihan yang menunggu pembayaran.",
          });
        } else {
          setResult({
            success: false,
            message: data.error || "Gagal melakukan pendaftaran ulang",
          });
        }
      } else {
        setResult({
          success: true,
          message:
            "Pendaftaran berhasil! Segera lunasi tagihan di bawah ini.",
        });
        await fetchPending();
      }
    } catch {
      setResult({
        success: false,
        message: "Tidak dapat terhubung ke server",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelTagihan = async () => {
    if (!confirm("Batalkan tagihan ini dan ganti program?")) return;
    setCancelling(true);
    try {
      const res = await fetch("/api/santri/me/daftar-ulang", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Gagal membatalkan tagihan");
      } else {
        setPendingTagihan(null);
        setSelectedProgram("");
        setIsAgreed(false);
        setResult(null);
      }
    } catch {
      alert("Tidak dapat terhubung ke server");
    } finally {
      setCancelling(false);
    }
  };

  const copyRekening = () => {
    navigator.clipboard.writeText("055501001108569").catch(() => {});
  };

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
  
  const isDurasiLow =
    sisaBulan !== undefined && sisaBulan !== null && sisaBulan <= 2;
  const requiresRenewal = statusData?.logikaSistem?.butuhDaftarUlang;
  
  const programs = metaData?.programTersedia || [];
  const selectedProgramData = programs.find((p) => p.id === selectedProgram);

  // Kategori filter logic
  const validPrograms = programs.map(p => ({
    ...p,
    // Safely fallback to 'REGULER' if kategoriProgram is undefined/empty from API
    kategori: p.kategoriProgram && p.kategoriProgram.trim() !== '' ? p.kategoriProgram.toUpperCase() : 'REGULER'
  }));
  const kategoriList = ["ALL", ...new Set(validPrograms.map((p) => p.kategori))];
  const filteredPrograms =
    activeKategori === "ALL"
      ? validPrograms
      : validPrograms.filter((p) => p.kategori === activeKategori);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1
          className="text-xl font-bold"
          style={{ color: "var(--color-text)" }}
        >
          Daftar Ulang
        </h1>
        <p
          className="text-xs mt-0.5"
          style={{ color: "var(--color-text-muted)" }}
        >
          Perpanjang masa aktif asrama
        </p>
      </div>

      {/* ===== LAYAR MENUNGGU VERIFIKASI (ada tagihan PENDING) ===== */}
      {!pendingLoading && pendingTagihan ? (
        <div className="space-y-4">
          <div
            className="neu-card p-6 text-center"
            style={{
              background:
                "linear-gradient(135deg, var(--color-warning-light), var(--bg-card))",
            }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{
                background: "var(--color-warning-light)",
                color: "var(--color-warning)",
              }}
            >
              <Hourglass size={28} />
            </div>
            <h2
              className="text-lg font-bold"
              style={{ color: "var(--color-text)" }}
            >
              Menunggu Verifikasi Admin
            </h2>
            <p
              className="text-xs mt-1"
              style={{ color: "var(--color-text-muted)" }}
            >
              Tagihan daftar ulang Anda sudah diterbitkan. Segera lakukan
              pembayaran agar masa aktif diperbarui.
            </p>
          </div>

          <div className="neu-card p-5 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <p
                  className="text-[11px] font-semibold"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Program yang diambil
                </p>
                <p
                  className="text-sm font-bold"
                  style={{ color: "var(--color-text)" }}
                >
                  {pendingTagihan.program.nama}
                </p>
                {pendingTagihan.dufah && (
                  <p
                    className="text-[11px]"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {pendingTagihan.dufah.nama}
                  </p>
                )}
              </div>
              <span
                className="px-2.5 py-1 rounded-full text-[10px] font-bold"
                style={{
                  background: "var(--color-warning-light)",
                  color: "var(--color-warning)",
                }}
              >
                BELUM LUNAS
              </span>
            </div>

            <div
              className="rounded-xl p-4"
              style={{
                background: "var(--color-surface-light)",
                boxShadow: "var(--shadow-inset-sm)",
              }}
            >
              <p
                className="text-[11px] font-semibold"
                style={{ color: "var(--color-text-muted)" }}
              >
                Nomor Kwitansi
              </p>
              <p
                className="font-mono text-sm font-bold"
                style={{ color: "var(--color-primary)" }}
              >
                {pendingTagihan.noKwitansi}
              </p>
              <p
                className="text-[11px] font-semibold mt-3"
                style={{ color: "var(--color-text-muted)" }}
              >
                Nominal yang harus dibayar
              </p>
              <p
                className="text-2xl font-black"
                style={{ color: "var(--color-success)" }}
              >
                Rp{" "}
                {new Intl.NumberFormat("id-ID").format(
                  pendingTagihan.totalTagihan
                )}
              </p>
              <p
                className="text-[10px] mt-1 italic"
                style={{ color: "var(--color-text-subtle)" }}
              >
                Termasuk kode unik +{pendingTagihan.kodeUnik} — pastikan
                transfer tepat hingga 3 digit terakhir agar otomatis terbaca
                oleh admin.
              </p>
            </div>

            <div
              className="rounded-xl p-4 text-center"
              style={{
                background: "var(--color-surface-light)",
                boxShadow: "var(--shadow-inset-sm)",
              }}
            >
              <p
                className="text-[10px] uppercase tracking-widest font-bold mb-2"
                style={{ color: "var(--color-text-muted)" }}
              >
                Transfer ke Rekening
              </p>
              <p
                className="text-lg font-black font-mono tracking-widest"
                style={{ color: "var(--color-text)" }}
              >
                0555-01-001108-569
              </p>
              <p
                className="text-xs font-bold mt-1"
                style={{ color: "var(--color-primary)" }}
              >
                BANK BRI a.n Markaz Arabiyah
              </p>
              <button
                onClick={copyRekening}
                className="mt-3 px-4 py-2 rounded-lg text-xs font-bold"
                style={{
                  background: "var(--color-surface-dark)",
                  color: "var(--color-text)",
                }}
              >
                Salin No. Rekening
              </button>
            </div>

            <a
              href="https://wa.me/6281212887788?text=Assalamualaikum%20Admin,%20saya%20sudah%20transfer%20daftar%20ulang."
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
              style={{
                background: "var(--color-success)",
                color: "#fff",
              }}
            >
              Konfirmasi via WhatsApp Admin
            </a>

            <button
              onClick={handleCancelTagihan}
              disabled={cancelling}
              className="w-full py-3 px-4 rounded-xl text-sm font-bold"
              style={{
                background: "transparent",
                color: "var(--color-danger)",
                border: "1px solid var(--color-danger)",
                opacity: cancelling ? 0.5 : 1,
              }}
            >
              {cancelling ? "Membatalkan..." : "Batalkan / Ganti Program"}
            </button>
          </div>
        </div>
      ) : (
      <>
      {/* Status Card */}
      <div
        className="neu-card p-5"
        style={{
          background: isDurasiLow
            ? "linear-gradient(135deg, var(--color-danger-light), var(--bg-card))"
            : "linear-gradient(135deg, var(--color-primary-50), var(--bg-card))",
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <div
            className="p-2 rounded-lg"
            style={{
              background: isDurasiLow
                ? "var(--color-danger-light)"
                : "var(--color-primary-50)",
              color: isDurasiLow
                ? "var(--color-danger)"
                : "var(--color-primary)",
            }}
          >
            <Hourglass size={18} />
          </div>
          <h2
            className="text-sm font-bold"
            style={{ color: "var(--color-text)" }}
          >
            Status Masa Aktif
          </h2>
        </div>

        {statusLoading ? (
          <div className="flex items-center gap-2 py-4">
            <Loader2
              size={16}
              className="animate-spin"
              style={{ color: "var(--color-primary)" }}
            />
            <span
              className="text-xs"
              style={{ color: "var(--color-text-muted)" }}
            >
              Memuat status PPDB...
            </span>
          </div>
        ) : statusError ? (
          <div
            className="rounded-xl p-3 flex items-center gap-2"
            style={{
              background: "var(--color-warning-light)",
              boxShadow: "var(--shadow-inset-sm)",
            }}
          >
            <AlertTriangle
              size={14}
              style={{ color: "var(--color-warning)" }}
            />
            <span
              className="text-xs font-semibold"
              style={{ color: "var(--color-warning)" }}
            >
              {statusError}
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-baseline gap-3">
              <span
                className="text-4xl font-bold"
                style={{
                  color: isDurasiLow
                    ? "var(--color-danger)"
                    : "var(--color-primary)",
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
              <div className="flex flex-col gap-1.5 mt-2">
                <div className="flex items-center gap-2 text-xs">
                  <Calendar
                    size={13}
                    style={{ color: "var(--color-text-subtle)" }}
                  />
                  <span style={{ color: "var(--color-text-muted)" }}>
                    Berakhir pada: <strong>{berakhirDufah}</strong>
                  </span>
                </div>
                {dufahSekarang && (
                  <div className="flex items-center gap-2 text-xs">
                    <Hourglass
                      size={13}
                      style={{ color: "var(--color-text-subtle)" }}
                    />
                    <span style={{ color: "var(--color-text-muted)" }}>
                      Sedang berjalan: <strong>{dufahSekarang}</strong>
                    </span>
                  </div>
                )}
              </div>
            )}

            {requiresRenewal && (
              <div
                className="rounded-lg p-3 flex items-start gap-2 mt-2"
                style={{
                  background: "var(--color-danger-light)",
                  boxShadow: "var(--shadow-inset-sm)",
                }}
              >
                <AlertTriangle
                  size={14}
                  className="flex-shrink-0 mt-0.5"
                  style={{ color: "var(--color-danger)" }}
                />
                <span
                  className="text-[11px] font-semibold"
                  style={{ color: "var(--color-danger)" }}
                >
                  Sistem menandakan Anda WALIB untuk mendaftar ulang pada periode ini.
                </span>
              </div>
            )}

            {/* Progress bar */}
            {sisaBulan !== undefined && sisaBulan !== null && (
              <div className="mt-1">
                <div
                  className="h-2 rounded-full overflow-hidden"
                  style={{ background: "var(--color-surface-dark)" }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (sisaBulan / 12) * 100)}%`,
                      background: isDurasiLow
                        ? "linear-gradient(90deg, var(--color-danger), var(--color-warning))"
                        : "linear-gradient(90deg, var(--color-primary), var(--color-success))",
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* PPDB Programs List (Siakad Theme) */}
      <div className="space-y-4 pt-2">
        <h2 className="text-sm font-bold" style={{ color: "var(--color-text)" }}>
          Memilih Program Pendaftaran
        </h2>

        {/* Kategori Filter */}
        {!statusLoading && programs.length > 0 && kategoriList.length > 2 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {kategoriList.map((kat) => (
              <button
                key={kat}
                onClick={() => setActiveKategori(kat)}
                className="flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                style={
                  activeKategori === kat
                    ? {
                        background: "var(--color-primary)",
                        color: "#fff",
                        boxShadow:
                          "3px 3px 8px rgba(0,102,102,0.3), -2px -2px 6px rgba(0,133,133,0.15)",
                      }
                    : {
                        background: "var(--color-surface-light)",
                        color: "var(--color-text-muted)",
                        boxShadow: "var(--shadow-inset-sm)",
                      }
                }
              >
                {kat === "ALL" ? "Semua" : kat}
              </button>
            ))}
          </div>
        )}
        
        {statusLoading ? (
            <div className="neu-card p-8 flex flex-col items-center justify-center gap-3">
              <Loader2 size={24} className="animate-spin" style={{ color: "var(--color-primary)" }} />
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Mensinkronisasi program dengan pusat keuangan...</p>
            </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPrograms.map((prog) => {
              const isSelected = selectedProgram === prog.id;
              const isTurats = prog.kategori === 'TUROTS';
              
              return (
                <button
                  key={prog.id}
                  onClick={() => setSelectedProgram(prog.id)}
                  className="text-left w-full transition-all overflow-hidden relative group"
                  style={{
                    backgroundColor: isSelected ? "var(--bg-card)" : "var(--color-surface-light)",
                    borderRadius: "16px",
                    border: isSelected ? "2px solid var(--color-primary)" : "2px solid transparent",
                    boxShadow: isSelected 
                        ? "3px 3px 10px rgba(0,102,102,0.25), -2px -2px 6px rgba(0,133,133,0.12)"
                        : "var(--shadow-inset-sm)",
                  }}
                >
                  <div className="p-5">
                    {/* Header: Title and Duration Badge */}
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-md font-bold tracking-tight" style={{ color: "var(--color-text)" }}>
                            {prog.nama}
                        </h3>
                        <span 
                            className="px-2 py-0.5 rounded-full text-[9px] font-bold"
                            style={{
                                background: isTurats ? "#fef3c7" : "var(--color-primary-50)",
                                color: isTurats ? "#b45309" : "var(--color-primary)",
                            }}
                        >
                            {prog.kategori}
                        </span>
                      </div>
                      <div 
                        className="px-2.5 py-1 rounded" 
                        style={{ 
                            backgroundColor: isSelected ? "var(--color-primary)" : "var(--color-surface-dark)",
                            transition: "background 0.3s"
                        }}
                      >
                        <span className="text-[9px] uppercase font-bold tracking-wider" style={{ color: isSelected ? "#fff" : "var(--color-text-muted)" }}>
                          {prog.durasiBulanFormatted}
                        </span>
                      </div>
                    </div>
                    
                    {/* Periode Badge */}
                    <div className="mb-3">
                      <span className="inline-block px-3 py-1.5 rounded-lg text-[10px] font-semibold" style={{ backgroundColor: "var(--color-surface-dark)", color: "var(--color-text-muted)" }}>
                        Periode {metaData?.informasiPendaftaranBuka?.nama || "Sedang Berjalan"}
                      </span>
                    </div>

                    {/* Tgl Program */}
                    <div className="mb-4">
                      <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>Tgl Program: </span>
                      <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>{prog.tglProgramFormatted}</span>
                    </div>

                    {/* Harga */}
                    <div>
                      <p className="text-xl font-black tracking-tight" style={{ color: "var(--color-primary)" }}>
                        {prog.hargaFormatted}
                      </p>
                    </div>
                  </div>
                  
                  {/* Selection Indicator overlay */}
                  {isSelected && (
                    <div className="absolute top-4 right-14">
                      <CheckCircle size={20} style={{ color: "var(--color-primary)" }} className="drop-shadow-sm" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Submission Panel */}
      <div className="neu-card p-5 space-y-4">
        {/* Info */}
        <div
          className="rounded-xl p-3.5 flex items-start gap-2.5"
          style={{
            background: "var(--color-primary-50)",
            boxShadow: "var(--shadow-inset-sm)",
          }}
        >
          <Info
            size={14}
            className="flex-shrink-0 mt-0.5"
            style={{ color: "var(--color-primary)" }}
          />
          <p
            className="text-[11px] leading-relaxed"
            style={{ color: "var(--color-text-muted)" }}
          >
            Pastikan pilihan program Anda sudah benar sebelum menekan tombol "Daftar Ulang Sekarang".
          </p>
        </div>

        {/* Opsi Atribut */}
        <label
          className="rounded-xl p-3.5 flex items-start gap-3 cursor-pointer"
          style={{
            background: "var(--color-surface-light)",
            boxShadow: "var(--shadow-inset-sm)",
          }}
        >
          <input
            type="checkbox"
            checked={isBeliAtribut}
            onChange={(e) => setIsBeliAtribut(e.target.checked)}
            className="mt-0.5 w-5 h-5 accent-teal-700 cursor-pointer shrink-0"
          />
          <span className="text-xs leading-relaxed" style={{ color: "var(--color-text)" }}>
            <span className="font-bold">Ambil paket atribut</span> (dresscode, tote bag, pin, peci/khimar, malzamah, ta'birot).
            <br />
            <span style={{ color: "var(--color-text-muted)" }}>
              {isBeliAtribut
                ? "Harga program sudah termasuk paket atribut."
                : "Tidak mengambil atribut — nominal dikurangi Rp 100.000."}
            </span>
          </span>
        </label>

        {/* Persetujuan */}
        <label
          className="flex items-start gap-2.5 cursor-pointer"
        >
          <input
            type="checkbox"
            checked={isAgreed}
            onChange={(e) => setIsAgreed(e.target.checked)}
            className="mt-0.5 w-5 h-5 accent-teal-700 cursor-pointer shrink-0"
          />
          <span className="text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
            <span className="font-bold" style={{ color: "var(--color-text)" }}>Saya setuju</span> untuk
            tidak merefund atau mengalihkan pembayaran.
          </span>
        </label>

        {/* Selected Summary */}
        {selectedProgramData && (
          <div
            className="rounded-xl p-3.5 flex items-center justify-between"
            style={{
              background: "var(--color-success-light)",
              boxShadow: "var(--shadow-inset-sm)",
            }}
          >
            <div className="flex items-center gap-3">
                <CheckCircle
                size={16}
                style={{ color: "var(--color-success)" }}
                />
                <div>
                <p
                    className="text-xs font-bold"
                    style={{ color: "var(--color-success)" }}
                >
                    Program Terpilih
                </p>
                <p
                    className="text-[11px] font-semibold mt-0.5"
                    style={{ color: "var(--color-text)" }}
                >
                    {selectedProgramData?.nama}
                </p>
                </div>
            </div>
            <p className="text-sm font-bold" style={{ color: "var(--color-success)" }}>
                {selectedProgramData && !isBeliAtribut && selectedProgramData.harga
                  ? `Rp ${new Intl.NumberFormat("id-ID").format(Math.max(0, selectedProgramData.harga - 100000))}`
                  : selectedProgramData?.hargaFormatted}
            </p>
          </div>
        )}
        {!isBeliAtribut && selectedProgramData && (
          <p className="text-[11px] text-right -mt-2" style={{ color: "var(--color-text-muted)" }}>
            Sudah dikurangi Rp 100.000 (tanpa atribut)
          </p>
        )}

        {/* Result */}
        {result && (
          <div
            className="rounded-xl p-4 flex items-start gap-3"
            style={{
              background: result?.success
                ? "var(--color-success-light)"
                : "var(--color-danger-light)",
              boxShadow: "var(--shadow-inset-sm)",
            }}
          >
            {result?.success ? (
              <CheckCircle
                size={18}
                className="flex-shrink-0 mt-0.5"
                style={{ color: "var(--color-success)" }}
              />
            ) : (
              <AlertTriangle
                size={18}
                className="flex-shrink-0 mt-0.5"
                style={{ color: "var(--color-danger)" }}
              />
            )}
            <p
              className="text-xs font-semibold"
              style={{
                color: result?.success
                  ? "var(--color-success)"
                  : "var(--color-danger)",
              }}
            >
              {result?.message}
            </p>
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={!selectedProgram || !isAgreed || submitting || result?.success}
          className="w-full py-3.5 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
          style={
            !selectedProgram || !isAgreed || submitting || result?.success
              ? {
                  background: "var(--color-surface-dark)",
                  color: "var(--color-text-subtle)",
                  cursor: "not-allowed",
                }
              : {
                  background: "var(--color-primary)",
                  color: "#fff",
                  boxShadow:
                    "3px 3px 8px rgba(0,102,102,0.3), -2px -2px 6px rgba(0,133,133,0.15)",
                }
          }
        >
          {submitting ? (
            <Loader2 size={18} className="animate-spin" />
          ) : result?.success ? (
            <>
              <CheckCircle size={16} />
              Pendaftaran Terkirim
            </>
          ) : (
            <>
              Daftar Ulang Sekarang
              <ArrowRight size={16} />
            </>
          )}
        </button>
        {!isAgreed && selectedProgram && !result?.success && (
          <p className="text-[11px] text-center" style={{ color: "var(--color-warning)" }}>
            Centang persetujuan di atas untuk melanjutkan.
          </p>
        )}
      </div>
      </>
      )}
    </div>
  );
}
