export type GpsDiagnosis = 
  | "READY"
  | "NOT_SUPPORTED"
  | "PERMISSION_DENIED"
  | "PERMISSION_NOT_ASKED"
  | "NOT_HTTPS"
  | "UNKNOWN_ERROR";

// Deteksi iOS (iPhone/iPad) untuk memberikan instruksi spesifik
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPad modern
}

export async function diagnoseGpsIssue(): Promise<{ code: GpsDiagnosis; message: string }> {
  // 1. Cek HTTPS
  if (typeof window !== 'undefined' && location.protocol !== "https:" && location.hostname !== "localhost") {
    return {
      code: "NOT_HTTPS",
      message: "Browser memblokir akses lokasi karena situs tidak menggunakan koneksi aman (HTTPS)."
    };
  }

  // 2. Cek Support
  if (!('geolocation' in navigator)) {
    return {
      code: "NOT_SUPPORTED",
      message: "Browser perangkat Anda tidak mendukung deteksi lokasi."
    };
  }

  // 3. Cek Permission API
  // CATATAN: Safari iOS TIDAK mendukung navigator.permissions.query({name: "geolocation"})
  // sehingga akan masuk ke catch block. Kita tangani secara khusus untuk iOS.
  if ('permissions' in navigator) {
    try {
      const result = await navigator.permissions.query({ name: "geolocation" });
      if (result.state === "denied") {
        const msg = isIOS()
          ? "Akses lokasi ditolak. Pada iPhone, buka Pengaturan > Privasi & Keamanan > Layanan Lokasi, pastikan Safari diizinkan."
          : "Anda / browser telah menolak akses lokasi. Silakan ubah izin lokasi (Site Settings) pada browser Anda dan muat ulang halaman ini.";
        return { code: "PERMISSION_DENIED", message: msg };
      }
      if (result.state === "prompt") {
        return {
          code: "PERMISSION_NOT_ASKED",
          message: "Akses lokasi belum diberikan. Tekan tombol di bawah untuk mengaktifkan."
        };
      }
      if (result.state === "granted") {
        return { code: "READY", message: "GPS Siap." };
      }
    } catch (e) {
      // Safari iOS akan error di sini — ini NORMAL.
      // Jangan kembalikan UNKNOWN_ERROR, kembalikan PERMISSION_NOT_ASKED agar user bisa klik tombol.
      console.warn("Permission API query failed (expected on Safari/iOS).", e);
      return {
        code: "PERMISSION_NOT_ASKED",
        message: isIOS() 
          ? "Tekan tombol di bawah untuk mengaktifkan GPS. Pastikan Layanan Lokasi aktif di Pengaturan iPhone Anda."
          : "Tekan tombol di bawah untuk mengaktifkan GPS."
      };
    }
  }

  // Jika navigator.permissions tidak tersedia sama sekali (browser sangat lama)
  return {
    code: "PERMISSION_NOT_ASKED",
    message: "Tekan tombol di bawah untuk mengaktifkan GPS."
  };
}

export function getAccuracyLevel(accuracy: number): "good" | "fair" | "poor" {
  if (accuracy <= 30) return "good";
  if (accuracy <= 80) return "fair";
  return "poor";
}

// Menghitung jarak antar dua titik (Haversine formula), digunakan untuk jump detection
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRadian = (angle: number) => (Math.PI / 180) * angle;
  const R = 6371e3; // Radius bumi dalam meter
  const dLat = toRadian(lat2 - lat1);
  const dLon = toRadian(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRadian(lat1)) * Math.cos(toRadian(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// =====================================================================
// LIVE GPS WATCHER — continuous tracking with accuracy & jump filtering
// =====================================================================
export type GpsPosition = {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
};

export type GpsWatcherCallbacks = {
  onUpdate: (pos: GpsPosition) => void;
  onError: (error: GeolocationPositionError) => void;
};

export type GpsWatcherHandle = {
  start: () => void;
  stop: () => void;
};

const ACCURACY_THRESHOLD_M = 150;
const JUMP_THRESHOLD_M = 500;

export function createGpsWatcher(callbacks: GpsWatcherCallbacks): GpsWatcherHandle {
  let watchId: number | null = null;
  let lastAcceptedPos: GpsPosition | null = null;
  let bestAccuracySeen = Infinity;

  const handleSuccess = (pos: GeolocationPosition) => {
    const newPos: GpsPosition = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      timestamp: pos.timestamp
    };

    // 1. Filter: Accuracy harus di bawah threshold
    if (newPos.accuracy > ACCURACY_THRESHOLD_M) {
      return; // Terlalu tidak akurat, abaikan
    }

    // 2. Filter: Jump detection
    if (lastAcceptedPos) {
      const distance = calculateDistance(
        lastAcceptedPos.latitude, lastAcceptedPos.longitude,
        newPos.latitude, newPos.longitude
      );
      if (distance > JUMP_THRESHOLD_M) {
        console.warn(`GPS Jump terdeteksi: ${Math.round(distance)}m. Mengabaikan.`);
        return;
      }
    }

    // 3. Logika "Best Reading Wins":
    //    - SELALU terima jika belum ada posisi sama sekali
    //    - Terima jika akurasi LEBIH BAIK atau SAMA dengan yang sekarang
    //    - Jika posisi sudah >10 detik, terima HANYA jika akurasi masih wajar
    //      (max 2x dari akurasi terbaik yang pernah dilihat, atau max 80m)
    //    - JANGAN PERNAH ganti posisi bagus (15m) dengan yang jelek (120m)
    const timeSinceLastMs = lastAcceptedPos ? (newPos.timestamp - lastAcceptedPos.timestamp) : Infinity;
    
    if (!lastAcceptedPos) {
      // Belum ada posisi → terima apapun yang lolos filter
      lastAcceptedPos = newPos;
      if (newPos.accuracy < bestAccuracySeen) bestAccuracySeen = newPos.accuracy;
      callbacks.onUpdate(newPos);
    } else if (newPos.accuracy <= lastAcceptedPos.accuracy) {
      // Posisi baru LEBIH AKURAT → selalu terima
      lastAcceptedPos = newPos;
      if (newPos.accuracy < bestAccuracySeen) bestAccuracySeen = newPos.accuracy;
      callbacks.onUpdate(newPos);
    } else if (timeSinceLastMs > 10000) {
      // Posisi sudah lama (>10 detik) → terima hanya jika masih wajar
      const maxAllowedAccuracy = Math.min(bestAccuracySeen * 2, 80);
      if (newPos.accuracy <= maxAllowedAccuracy) {
        lastAcceptedPos = newPos;
        callbacks.onUpdate(newPos);
      }
      // Jika akurasi baru terlalu jelek → abaikan, tetap pakai posisi lama
    }
  };

  const handleError = (error: GeolocationPositionError) => {
    callbacks.onError(error);
  };

  return {
    start: () => {
      if (watchId !== null) return; // sudah berjalan
      watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0
      });
    },
    stop: () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
    }
  };
}
