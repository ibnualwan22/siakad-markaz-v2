export type GpsDiagnosis = 
  | "READY"
  | "NOT_SUPPORTED"
  | "PERMISSION_DENIED"
  | "PERMISSION_NOT_ASKED"
  | "NOT_HTTPS"
  | "UNKNOWN_ERROR";

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

  // 3. Cek Permission API (hanya jika disupport oleh browser, eg. Safari iOS mungkin tidak support)
  if ('permissions' in navigator) {
    try {
      const result = await navigator.permissions.query({ name: "geolocation" });
      if (result.state === "denied") {
        return {
          code: "PERMISSION_DENIED",
          message: "Anda / browser telah menolak akses lokasi. Silakan ubah izin lokasi (Site Settings) pada browser Anda dan tahan/muat ulang halaman ini."
        };
      }
      if (result.state === "prompt") {
        return {
          code: "PERMISSION_NOT_ASKED",
          message: "Akses lokasi belum diberikan. Browser akan meminta izin saat Anda menekan tombol absen."
        };
      }
      if (result.state === "granted") {
        return {
          code: "READY",
          message: "GPS Siap."
        };
      }
    } catch (e) {
      console.warn("Permission API query failed, falling back to manual detection.", e);
    }
  }

  return {
    code: "UNKNOWN_ERROR",
    message: "Status GPS tidak diketahui. Coba jalankan absen."
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

export function getReliablePosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    // Parameter
    const ACCURACY_THRESHOLD_M = 150; // Jangan terima koordinat dengan akurasi lebih dari ini (Wifi/Cell tower sering >200m)
    const MAX_WAIT_TIME_MS = 6000;    // Tunggu maksimal x ms untuk dapatkan posisi terbaik
    const BEST_ACCURACY_THRESHOLD_M = 30; // Jika akurasi <= segini, langsung exit jangan nunggu lama

    const readings: GeolocationPosition[] = [];
    let prevPos: GeolocationPosition | null = null;
    let watchId: number;
    let timeoutId: NodeJS.Timeout;

    const cleanup = () => {
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
      if (timeoutId) clearTimeout(timeoutId);
    };

    const handleSuccess = (pos: GeolocationPosition) => {
      // 1. Jump detection: Jika posisi "mental" terlalu jauh dalam waktu singkat (contoh: fallback dari GPS ke Cell Tower)
      if (prevPos) {
        const distance = calculateDistance(prevPos.coords.latitude, prevPos.coords.longitude, pos.coords.latitude, pos.coords.longitude);
        if (distance > 500) { // Lompat > 500 meter
          console.warn(`GPS Jump detected: ${Math.round(distance)}m. Mengabaikan posisi ini.`);
          return;
        }
      }
      prevPos = pos;

      // 2. Accuracy check
      if (pos.coords.accuracy <= ACCURACY_THRESHOLD_M) {
        readings.push(pos);
      } else {
        console.warn(`Akurasi terlalu rendah: ${Math.round(pos.coords.accuracy)}m. Mengabaikan posisi ini.`);
        return; // Jangan masuk ke pembacaan
      }

      // 3. Early exit
      if (pos.coords.accuracy <= BEST_ACCURACY_THRESHOLD_M) {
        cleanup();
        resolve(pos);
      }
    };

    const handleError = (err: GeolocationPositionError) => {
      cleanup();
      reject(err);
    };

    // Jalankan GPS Watch
    watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 20000, 
      maximumAge: 0
    });

    // Timeout untuk memilah posisi
    timeoutId = setTimeout(() => {
      cleanup();
      if (readings.length > 0) {
        // Pilih yang akurasinya paling bagus (paling kecil)
        readings.sort((a, b) => a.coords.accuracy - b.coords.accuracy);
        resolve(readings[0]);
      } else {
        const err = new Error("NO_ACCURATE_READING");
        (err as any).code = 999;
        reject(err);
      }
    }, MAX_WAIT_TIME_MS);
  });
}
