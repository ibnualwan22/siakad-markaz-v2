"use client";

import { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ScanLine, X, Sun, CheckCircle2 } from "lucide-react";
import type Pusher from "pusher-js";

type Kehadiran = { kategoriId: string; kategoriNama: string };

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
  const [berhasil, setBerhasil] = useState<{ kategoriNama: string; waktu: string } | null>(null);
  // Polling status scan: snapshot saat masuk Mode Scan = baseline; hanya rekaman
  // BARU (kategoriId yang belum ada di baseline) yang memicu modal berhasil.
  const baselineRef = useRef<Set<string> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!scanMode) return;
    let berhenti = false;
    let pusher: Pusher | null = null;
    let channel: ReturnType<Pusher["subscribe"]> | null = null;
    // Hentikan kedua jalur (Pusher + polling) begitu berhasil / keluar Mode Scan
    const hentikan = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      try {
        channel?.unbind_all?.();
        channel?.unsubscribe?.();
      } catch {
        /* abaikan */
      }
      try {
        pusher?.disconnect?.();
      } catch {
        /* abaikan */
      }
      channel = null;
      pusher = null;
    };
    const tampilkanBerhasil = (kategoriNama: string, waktu: string) => {
      setBerhasil({ kategoriNama, waktu });
      try {
        navigator.vibrate?.(200);
      } catch {
        /* abaikan */
      }
      hentikan();
    };
    const cek = async () => {
      try {
        const res = await fetch("/api/santri/qr-saya/status");
        const data = await res.json();
        if (!data.success || berhenti) return;
        if (baselineRef.current === null) {
          // Pengambilan pertama = baseline (rekaman lama tidak memicu modal)
          baselineRef.current = new Set<string>(data.hadir.map((h: Kehadiran) => h.kategoriId));
          return;
        }
        const baru = data.hadir.find((h: Kehadiran) => !baselineRef.current!.has(h.kategoriId));
        if (baru) {
          tampilkanBerhasil(
            baru.kategoriNama,
            new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
          );
        }
      } catch {
        /* abaikan: polling berikutnya mencoba lagi */
      }
    };
    // Jalur utama realtime: Pusher (private channel milik santri ini).
    // Gagal apa pun di jalur ini tidak masalah — polling di bawah tetap jalan.
    const mulaiPusher = async () => {
      try {
        const cfgRes = await fetch("/api/santri/qr-saya/pusher-config");
        const cfg = await cfgRes.json();
        if (!cfg.success || !cfg.configured || berhenti) return;
        const PusherMod = await import("pusher-js");
        const Pusher = PusherMod.default;
        if (berhenti) return;
        pusher = new Pusher(cfg.key, {
          cluster: cfg.cluster,
          authEndpoint: "/api/santri/qr-saya/pusher-auth",
        });
        channel = pusher.subscribe(cfg.channel);
        channel.bind("scan-berhasil", (data: { kategoriNama: string; waktu: string }) => {
          if (berhenti) return;
          tampilkanBerhasil(data.kategoriNama, data.waktu);
        });
      } catch {
        /* abaikan: polling tetap jalan sebagai cadangan */
      }
    };
    baselineRef.current = null;
    setBerhasil(null);
    void cek();
    intervalRef.current = setInterval(cek, 5000);
    void mulaiPusher();
    return () => {
      berhenti = true;
      hentikan();
    };
  }, [scanMode]);

  // A screen lock is released when hidden. Acquire it again on return, and
  // release late permission results if Mode Scan has already been closed.
  useEffect(() => {
    if (!scanMode) return;
    let disposed = false;
    let pending = false;
    let lock: WakeLockSentinel | null = null;
    const acquire = async () => {
      if (disposed || pending || lock || document.hidden || !("wakeLock" in navigator)) return;
      pending = true;
      try {
        const granted = await navigator.wakeLock.request("screen");
        if (disposed || document.hidden) { await granted.release(); return; }
        lock = granted;
        granted.addEventListener("release", () => { if (lock === granted) lock = null; });
      } catch { /* The QR remains usable when screen lock is unavailable. */ }
      finally { pending = false; }
    };
    const onVisible = () => { if (!document.hidden) void acquire(); };
    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => {});
    };
  }, [scanMode]);

  // Fullscreen saat masuk Mode Scan
  const enterScanMode = async () => {
    setScanMode(true);
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch { /* abaikan jika ditolak */ }
  };
  const exitScanMode = () => {
    setScanMode(false);
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
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [scanMode]);

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
      {/* Animasi modal berhasil: pop singkat, gaya sama dengan kartu hasil admin */}
      <style>{`
        @keyframes scan-pop { 0% { transform: scale(0.96); opacity: 0.4; } 100% { transform: scale(1); opacity: 1; } }
        .animasi-scan-pop { animation: scan-pop 0.3s ease-out; }
      `}</style>
      <div className="rounded-2xl border bg-white p-6 text-center shadow-sm">
        <p className="text-sm text-gray-500">QR Absensi</p>
        <h2 className="mt-1 text-xl font-bold text-gray-900">{nama}</h2>
        <div className="mx-auto mt-4 w-full max-w-[304px] bg-white">
          <QRCodeSVG value={payload} size={304} marginSize={4} style={{ width: "100%", height: "auto" }} />
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
            <QRCodeSVG
              value={payload}
              size={512}
              marginSize={4}
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

          {/* Modal berhasil: muncul begitu scan petugas tercatat (polling) */}
          {berhasil && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-6">
              <div className="animasi-scan-pop w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl">
                <CheckCircle2 size={64} className="mx-auto text-green-600" />
                <h2 className="mt-3 text-2xl font-black text-gray-900">Absensi Berhasil!</h2>
                <p className="mt-1 text-sm font-semibold text-gray-600">
                  {berhasil.kategoriNama} • {berhasil.waktu}
                </p>
                <button
                  onClick={exitScanMode}
                  className="mt-6 w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-bold text-white"
                >
                  Selesai
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
