"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "react-hot-toast";
import { MapPin, CheckCircle, Crosshair, AlertTriangle, Navigation, Wifi, WifiOff, RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";

// ===================================================================
// GPS / GEOLOCATION TYPES & UTILITIES — DIPERTAHANKAN UNTUK PENGGUNAAN
// MASA DEPAN. Saat ini fitur absensi mandiri TIDAK MEMERLUKAN deteksi
// lokasi. Untuk mengaktifkan kembali, hapus komentar di bagian yang
// ditandai "GEOFENCING DISABLED".
// ===================================================================

type LokasiAktif = {
  id: string;
  nama: string;
  latitude: number;
  longitude: number;
  radius: number;
};

type LokasiWithDistance = LokasiAktif & {
  distance: number;
  isInRange: boolean;
};

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (n: number) => (Math.PI / 180) * n;
  const R = 6371e3;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function SantriAbsenMandiriPage() {
  const [kode, setKode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const router = useRouter();

  // ===================================================================
  // [GEOFENCING DISABLED] — GPS live tracking state
  // Uncomment blok ini dan blok-blok terkait di bawah untuk
  // mengaktifkan kembali deteksi lokasi GPS.
  // ===================================================================
  // const [lokasiAktif, setLokasiAktif] = useState<LokasiAktif[]>([]);
  // const [hasSesiAktif, setHasSesiAktif] = useState<boolean | null>(null);
  // const [userLat, setUserLat] = useState<number | null>(null);
  // const [userLng, setUserLng] = useState<number | null>(null);
  // const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  // const [gpsStatus, setGpsStatus] = useState<"loading" | "active" | "denied" | "unavailable">("loading");
  // const watchRef = useRef<number | null>(null);

  // ===================================================================
  // [GEOFENCING DISABLED] — Fetch active session locations
  // ===================================================================
  // useEffect(() => {
  //   fetch("/api/santri/absen-kegiatan")
  //     .then(res => res.json())
  //     .then(data => {
  //       if (data.success) {
  //         setLokasiAktif(data.lokasiAktif || []);
  //         setHasSesiAktif(data.hasSesiAktif);
  //       }
  //     })
  //     .catch(() => {});
  // }, []);

  // ===================================================================
  // [GEOFENCING DISABLED] — Start GPS watch
  // ===================================================================
  // const startGpsWatch = useCallback(() => {
  //   if (!navigator.geolocation) {
  //     setGpsStatus("unavailable");
  //     return;
  //   }
  //   if (watchRef.current !== null) {
  //     navigator.geolocation.clearWatch(watchRef.current);
  //   }
  //   setGpsStatus("loading");
  //   setGpsAccuracy(null);
  //   watchRef.current = navigator.geolocation.watchPosition(
  //     (pos) => {
  //       setUserLat(pos.coords.latitude);
  //       setUserLng(pos.coords.longitude);
  //       setGpsAccuracy(pos.coords.accuracy);
  //       setGpsStatus("active");
  //     },
  //     (err) => {
  //       if (err.code === err.PERMISSION_DENIED) setGpsStatus("denied");
  //       else setGpsStatus("unavailable");
  //     },
  //     { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  //   );
  // }, []);

  // useEffect(() => {
  //   startGpsWatch();
  //   return () => {
  //     if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
  //   };
  // }, [startGpsWatch]);

  // ===================================================================
  // [GEOFENCING DISABLED] — Calculate distances
  // ===================================================================
  // const lokasiWithDistance: LokasiWithDistance[] = lokasiAktif.map(lok => {
  //   if (userLat === null || userLng === null) return { ...lok, distance: Infinity, isInRange: false };
  //   const dist = haversineDistance(userLat, userLng, lok.latitude, lok.longitude);
  //   return { ...lok, distance: dist, isInRange: dist <= lok.radius };
  // }).sort((a, b) => a.distance - b.distance);
  //
  // const nearest = lokasiWithDistance.length > 0 ? lokasiWithDistance[0] : null;
  // const anyInRange = lokasiWithDistance.some(l => l.isInRange);
  // const isGpsWarmingUp = gpsStatus === "active" && (!gpsAccuracy || gpsAccuracy > 50);

  const handleAbsen = () => {
    if (!kode || kode.length !== 6) {
      toast.error("Kode harus terdiri dari 6 karakter");
      return;
    }

    // [GEOFENCING DISABLED] — Validasi GPS dinonaktifkan sementara
    // if (userLat === null || userLng === null) {
    //   toast.error("GPS belum aktif. Izinkan akses lokasi terlebih dahulu.");
    //   return;
    // }
    // if (isGpsWarmingUp) {
    //   toast.error("Akurasi GPS masih rendah. Tunggu beberapa detik agar warna akurasi hijau.");
    //   return;
    // }

    setIsLoading(true);
    const toastId = toast.loading("Memvalidasi kode absen...");

    fetch("/api/santri/absen-kegiatan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kode: kode.toUpperCase() })
      // [GEOFENCING DISABLED] — Kirim koordinat saat geofencing aktif:
      // body: JSON.stringify({ kode, latitude: userLat, longitude: userLng })
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
          Masukkan kode akses 6 digit yang diberikan oleh ustadz/ah.
        </p>
      </div>

      {/* ====================================================================
        [GEOFENCING DISABLED] — LIVE LOCATION STATUS CARD
        Seluruh kartu status GPS dan daftar jarak lokasi dinonaktifkan.
        Untuk mengaktifkan kembali, salin blok JSX dari git history atau
        lihat komentar di atas.
      ==================================================================== */}

      {/* ====== CODE INPUT & SUBMIT ====== */}
      <div className="neu-card-white p-6 bg-white space-y-6">
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 block text-center">KODE AKSES</label>
          <input
            type="text"
            value={kode}
            onChange={(e) => setKode(e.target.value)}
            maxLength={6}
            placeholder="X X X X X X"
            disabled={isLoading}
            className="w-full text-center text-4xl tracking-[0.3em] font-mono font-black p-4 rounded-2xl border-2 border-[var(--color-surface-dark)] focus:border-[var(--color-primary)] outline-none transition-colors uppercase disabled:opacity-50"
            style={{ color: "var(--color-text)" }}
          />
        </div>

        <button
          onClick={handleAbsen}
          disabled={isLoading || kode.length !== 6}
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
          <p>Dapatkan kode akses 6 digit dari ustadz/ah yang bertugas. Kode ini berlaku selama sesi absensi masih terbuka.</p>
        </div>
      </div>
    </div>
  );
}
