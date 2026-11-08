"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "react-hot-toast";
import {
  pushSupported,
  getPushState,
  subscribePushSantri,
  unsubscribePushSantri,
} from "@/lib/push-client";

// Kartu kecil pengatur notifikasi Web Push portal santri di halaman
// Pengumuman. Inbox tetap tampil penuh apa pun status push-nya — push
// BUKAN syarat melihat pengumuman.
export function PushPrompt() {
  const [supported, setSupported] = useState(true);
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!pushSupported()) {
      setSupported(false);
      return;
    }
    const st = await getPushState();
    setPermission(st.permission);
    setSubscribed(st.subscribed);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleAktifkan = async () => {
    setBusy(true);
    const result = await subscribePushSantri();
    setBusy(false);
    if (result === "subscribed") {
      setSubscribed(true);
      setPermission("granted");
      toast.success("Notifikasi aktif di perangkat ini.");
    } else if (result === "denied") {
      setPermission("denied");
      toast.error("Izin notifikasi ditolak browser.");
    } else {
      toast.error("Gagal mengaktifkan notifikasi, coba lagi.");
    }
  };

  const handleNonaktifkan = async () => {
    setBusy(true);
    const ok = await unsubscribePushSantri();
    setBusy(false);
    if (ok) {
      setSubscribed(false);
      toast.success("Notifikasi dinonaktifkan di perangkat ini.");
    } else {
      toast.error("Gagal menonaktifkan notifikasi.");
    }
  };

  // Browser tidak mendukung Web Push (mis. iOS Safari sebelum portal
  // dipasang ke layar utama): sampaikan secara halus, bukan error.
  if (!supported) {
    return (
      <div className="rounded-2xl border border-[var(--color-surface-dark)] bg-white px-4 py-3.5">
        <p className="text-sm text-[var(--color-text-muted)]">
          Aktifkan portal dari layar utama (PWA) untuk notifikasi di iOS.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--color-surface-dark)] bg-white px-4 py-3.5">
      {subscribed ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-bold text-emerald-700">
            Notifikasi aktif di perangkat ini.
          </p>
          <button
            onClick={handleNonaktifkan}
            disabled={busy}
            className="rounded-full border border-[var(--color-surface-dark)] px-4 py-1.5 text-xs font-bold text-[var(--color-text)] transition hover:bg-slate-50 disabled:opacity-50"
          >
            Nonaktifkan Notifikasi
          </button>
        </div>
      ) : permission === "denied" ? (
        <p className="text-sm text-[var(--color-text-muted)]">
          Notifikasi diblokir di browser ini. Untuk mengaktifkan lagi: ketuk
          ikon gembok di address bar → Izin situs → izinkan Notifikasi, lalu
          muat ulang halaman.
        </p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--color-text)]">
            Aktifkan notifikasi agar pengumuman baru langsung masuk ke
            perangkat ini.
          </p>
          <button
            onClick={handleAktifkan}
            disabled={busy}
            className="shrink-0 rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "Memproses..." : "Aktifkan Notifikasi"}
          </button>
        </div>
      )}
    </div>
  );
}
