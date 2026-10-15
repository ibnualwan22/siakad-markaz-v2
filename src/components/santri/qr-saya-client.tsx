"use client";

import { useState, useEffect, useRef } from "react";
import QRCode from "react-qr-code";
import { ScanLine, X, Sun } from "lucide-react";

export function QrSayaClient({
  nama,
  payload,
  error,
}: {
  nama: string;
  payload: string | null;
  error: string | null;
}) {
  const [scanMode, setScanMode] = useState(false);
  const wakeLockRef = useRef<any>(null);

  // Wake Lock: jaga layar tetap menyala saat Mode Scan
  const requestWakeLock = async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
      }
    } catch { /* abaikan jika tidak didukung */ }
  };
  const releaseWakeLock = () => {
    wakeLockRef.current?.release?.().catch(() => {});
    wakeLockRef.current = null;
  };

  // Fullscreen saat masuk Mode Scan
  const enterScanMode = async () => {
    setScanMode(true);
    requestWakeLock();
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch { /* abaikan jika ditolak */ }
  };
  const exitScanMode = () => {
    setScanMode(false);
    releaseWakeLock();
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch { /* abaikan */ }
  };

  // Keluar Mode Scan jika fullscreen dibatalkan manual (tombol back HP)
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement && scanMode) {
        setScanMode(false);
        releaseWakeLock();
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [scanMode]);

  // Cleanup saat unmount
  useEffect(() => {
    return () => releaseWakeLock();
  }, []);

  if (error || !payload) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="font-semibold text-red-700">QR belum bisa ditampilkan</p>
        <p className="mt-1 text-sm text-red-600">
          {error || "Terjadi kesalahan."} Hubungi admin.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl border bg-white p-6 text-center shadow-sm">
        <p className="text-sm text-gray-500">QR Absensi</p>
        <h2 className="mt-1 text-xl font-bold text-gray-900">{nama}</h2>
        <div className="mx-auto mt-4 w-fit rounded-xl border-4 border-gray-900 bg-white p-3">
          <QRCode value={payload} size={240} />
        </div>
        <p className="mt-4 text-sm text-gray-500">
          Tunjukkan QR ini ke petugas saat absensi kegiatan.
          Jangan bagikan ke orang lain.
        </p>
        <button
          onClick={enterScanMode}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white"
        >
          <ScanLine size={16} /> Mode Scan
        </button>
      </div>

      {scanMode && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white p-6">
          {/* Tombol tutup */}
          <button
            className="absolute right-4 top-4 rounded-full bg-gray-100 p-3 text-gray-700 shadow"
            onClick={exitScanMode}
            aria-label="Tutup Mode Scan"
          >
            <X size={24} />
          </button>

          {/* QR sebesar mungkin */}
          <div className="w-full max-w-[85vw] sm:max-w-[420px]">
            <QRCode
              value={payload}
              size={512}
              style={{ width: "100%", height: "auto" }}
            />
          </div>

          <p className="mt-4 text-center text-lg font-bold text-gray-900">{nama}</p>

          {/* Instruksi brightness */}
          <div className="mt-6 flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
            <Sun size={20} className="text-amber-500 shrink-0" />
            <p className="text-sm font-medium text-amber-800">
              Naikkan brightness HP hingga maksimal agar mudah terbaca scanner
            </p>
          </div>

          <p className="mt-3 text-xs text-gray-400">
            Ketuk tombol × di atas untuk keluar dari Mode Scan
          </p>
        </div>
      )}
    </div>
  );
}
