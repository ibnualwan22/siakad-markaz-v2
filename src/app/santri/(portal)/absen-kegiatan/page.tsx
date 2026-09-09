"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "react-hot-toast";
import { MapPin, CheckCircle, Crosshair, AlertTriangle, Navigation, Wifi, WifiOff, RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { getReliablePosition, diagnoseGpsIssue, getAccuracyLevel, GpsDiagnosis } from "@/lib/gps-utils";

export default function SantriAbsenMandiriPage() {
  const [kode, setKode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const router = useRouter();

  // GPS States
  const [gpsStatus, setGpsStatus] = useState<"idle" | "acquiring" | "ready" | "denied" | "unavailable" | "error">("idle");
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Cek Status GPS saat awal load
  useEffect(() => {
    checkGpsPermission();
  }, []);

  const checkGpsPermission = async () => {
    const diagnostic = await diagnoseGpsIssue();
    if (diagnostic.code === "NOT_HTTPS" || diagnostic.code === "NOT_SUPPORTED") {
      setGpsStatus("unavailable");
      setGpsError(diagnostic.message);
    } else if (diagnostic.code === "PERMISSION_DENIED") {
      setGpsStatus("denied");
      setGpsError(diagnostic.message);
    } else if (diagnostic.code === "PERMISSION_NOT_ASKED") {
      setGpsStatus("idle");
      // Menunggu user menekan tombol untuk meminta izin (harus di-trigger oleh user interaction)
    } else if (diagnostic.code === "READY") {
      // Jika izin sudah ada, langsung mulai cari posisi
      acquireGps();
    } else {
      setGpsStatus("idle");
    }
  };

  const acquireGps = async () => {
    setGpsStatus("acquiring");
    setGpsError(null);
    try {
      const pos = await getReliablePosition();
      setPosition(pos);
      setGpsStatus("ready");
    } catch (error: any) {
      if (error.code === 1) { // PERMISSION_DENIED
        setGpsStatus("denied");
        setGpsError("Akses lokasi ditolak oleh browser. Silakan izinkan akses lokasi pada pengaturan browser (ikon gembok) dan refresh halaman ini.");
      } else {
        setGpsStatus("error");
        setGpsError(error.message === "NO_ACCURATE_READING" 
          ? "Gagal mendapatkan lokasi yang akurat. Pastikan GPS aktif dan Anda berada di area terbuka." 
          : "Gagal menghubungkan ke satelit GPS. Coba beberapa saat lagi.");
      }
    }
  };

  const handleAbsen = () => {
    if (!kode || kode.length !== 6) {
      toast.error("Kode harus terdiri dari 6 karakter");
      return;
    }

    if (gpsStatus !== "ready" || !position) {
      toast.error("Harap tunggu hingga lokasi GPS siap!");
      return;
    }

    setIsLoading(true);
    const toastId = toast.loading("Memvalidasi kode absen & lokasi...");

    fetch("/api/santri/absen-kegiatan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        kode: kode.toUpperCase(),
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          toast.success(data.message, { id: toastId });
          setIsSuccess(true);
          setSuccessMsg(data.message);
        } else {
          toast.error(data.detail || data.error, { id: toastId, duration: 5000 });
          setIsLoading(false);
          // Jika gagal karena lokasi di luar radius, auto-retry GPS untuk next attempt
          if (data.detail && data.detail.includes("meter dari titik")) {
            acquireGps();
          }
        }
      })
      .catch(() => {
        toast.error("Terjadi kesalahan koneksi.", { id: toastId });
        setIsLoading(false);
      });
  };

  // ========== SUCCESS VIEW ==========
  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 space-y-6">
        <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center mb-2">
          <CheckCircle size={48} className="text-emerald-500 animate-pulse" />
        </div>
        <h1 className="text-2xl font-black text-center text-[var(--color-text)]">Absensi Berhasil!</h1>
        <p className="text-center font-bold text-gray-500 max-w-sm">{successMsg}</p>
        <button onClick={() => router.push("/santri/absensi")} className="neu-button-primary px-8 py-3 rounded-2xl flex items-center gap-2 mt-4 text-sm">
          Lihat Riwayat Absensi
        </button>
      </div>
    );
  }

  // ========== MAIN VIEW ==========
  return (
    <div className="space-y-5 max-w-md mx-auto mt-4 px-2">
      {/* Header */}
      <div className="flex flex-col gap-2 items-center text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-2" style={{ background: "var(--color-primary-50)" }}>
          <CheckCircle size={32} className="text-[var(--color-primary)]" />
        </div>
        <h1 className="text-3xl font-black text-[var(--color-text)]">Absen Mandiri</h1>
        <p className="text-sm font-semibold text-[var(--color-text-muted)] mt-1">
          Sistem Absensi dengan Geofencing (GPS)
        </p>
      </div>

      {/* GPS Status Card */}
      <div className={`p-4 rounded-xl border-2 flex items-start gap-4 transition-all shadow-sm ${
        gpsStatus === 'ready' ? 'bg-emerald-50 border-emerald-500' :
        gpsStatus === 'acquiring' ? 'bg-blue-50 border-blue-400' :
        gpsStatus === 'denied' || gpsStatus === 'unavailable' ? 'bg-red-50 border-red-500' :
        'bg-yellow-50 border-yellow-500'
      }`}>
        <div className="shrink-0 mt-1">
          {gpsStatus === 'ready' ? <MapPin size={24} className="text-emerald-500" /> :
           gpsStatus === 'acquiring' ? <Crosshair size={24} className="text-blue-500 animate-spin" /> :
           <AlertTriangle size={24} className={gpsStatus === 'denied' || gpsStatus === 'unavailable' ? "text-red-500" : "text-yellow-500"} />}
        </div>
        
        <div className="flex-1 space-y-1 w-full">
          <h3 className="font-bold text-sm text-[var(--color-text)] uppercase tracking-wider">
            Status Lokasi Anda
          </h3>
          
          {gpsStatus === 'acquiring' && (
            <p className="text-xs font-bold text-blue-600 animate-pulse">Sedang mengunci satelit GPS terbaik...</p>
          )}

          {gpsStatus === 'ready' && position && (
            <div>
              <p className="text-[11px] font-bold text-emerald-700">GPS Terkunci.</p>
              <div className="flex items-center gap-2 mt-2 font-mono text-[10px] bg-white bg-opacity-60 p-2 rounded-lg text-emerald-800 border border-emerald-200">
                <span>Lat: {position.coords.latitude.toFixed(5)}</span>
                <span>Lng: {position.coords.longitude.toFixed(5)}</span>
                <span className={`px-1.5 py-0.5 rounded text-white ${
                  getAccuracyLevel(position.coords.accuracy) === 'good' ? 'bg-emerald-500' : 
                  getAccuracyLevel(position.coords.accuracy) === 'fair' ? 'bg-yellow-500' : 'bg-red-500'
                }`}>
                  ±{Math.round(position.coords.accuracy)}m
                </span>
              </div>
            </div>
          )}

          {(gpsStatus === 'denied' || gpsStatus === 'unavailable' || gpsStatus === 'error') && (
            <div className="space-y-3 pt-1">
              <p className="text-xs font-bold text-red-700 leading-relaxed">{gpsError}</p>
              {gpsStatus === 'denied' && (
                <div className="bg-red-100 p-2 rounded text-[10px] text-red-800 font-semibold italic border border-red-200">
                  ⚠️ Tips: Klik ikon gembok pada address bar browser Anda, lalu set lokasi (Location) ke "Allow/Izinkan". Jika sudah, muat ulang halaman ini.
                </div>
              )}
              {gpsStatus === 'error' && (
                <button onClick={acquireGps} className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold flex gap-2 items-center hover:bg-red-700 transition">
                  <RefreshCcw size={14} /> Coba Lagi
                </button>
              )}
            </div>
          )}

          {gpsStatus === 'idle' && (
            <div className="space-y-3 pt-1">
               <p className="text-xs font-semibold text-yellow-800">
                 Fitur absensi memerlukan akses lokasi perangkat Anda (GPS).
               </p>
               <button onClick={acquireGps} className="w-full py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-xs font-bold flex gap-2 items-center justify-center transition shadow-sm">
                 <Navigation size={14} /> Aktifkan Akses Lokasi (GPS)
               </button>
            </div>
          )}
        </div>
      </div>

      {/* ====== CODE INPUT & SUBMIT ====== */}
      <div className={`neu-card-white p-6 bg-white space-y-6 transition-opacity ${gpsStatus !== 'ready' ? 'opacity-50 pointer-events-none' : ''}`}>
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 block text-center">KODE AKSES</label>
          <input
            type="text"
            value={kode}
            onChange={(e) => setKode(e.target.value)}
            maxLength={6}
            placeholder="X X X X X X"
            disabled={isLoading || gpsStatus !== 'ready'}
            className="w-full text-center text-4xl tracking-[0.3em] font-mono font-black p-4 rounded-2xl border-2 border-[var(--color-surface-dark)] focus:border-[var(--color-primary)] outline-none transition-colors uppercase disabled:opacity-50"
            style={{ color: "var(--color-text)" }}
          />
        </div>

        <button
          onClick={handleAbsen}
          disabled={isLoading || kode.length !== 6 || gpsStatus !== 'ready'}
          className="w-full font-bold py-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all neu-button-primary"
        >
          {isLoading ? <Crosshair size={20} className="animate-spin" /> : <CheckCircle size={20} />}
          {isLoading ? "Memproses Absen..." : "Absen Sekarang"}
        </button>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3 text-blue-800 text-xs font-bold shadow-sm">
        <AlertTriangle size={20} className="shrink-0 mt-0.5 text-blue-500" />
        <div className="space-y-1">
          <p>Dapatkan kode akses 6 digit dari asatidz yang bertugas. Pastikan Anda berada tidak jauh dari asatidz agar proses validasi GPS berhasil.</p>
        </div>
      </div>
    </div>
  );
}
