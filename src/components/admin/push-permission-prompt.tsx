"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "react-hot-toast";
import {
  pushSupported,
  getPushState,
  subscribePush,
  unsubscribePush,
} from "@/lib/push-client";

const SNOOZE_KEY = "siakad-push-snooze";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

function isSnoozed(): boolean {
  try {
    const raw = window.localStorage.getItem(SNOOZE_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < SNOOZE_MS;
  } catch {
    return false;
  }
}

function setSnooze() {
  try {
    window.localStorage.setItem(SNOOZE_KEY, String(Date.now()));
  } catch {
    // abaikan
  }
}

// Penawaran izin notifikasi dua tahap:
// 1) modal buatan Siakad dulu (manfaat konkret + Aktifkan/Nanti Saja),
// 2) prompt browser hanya setelah pengguna menekan Aktifkan.
// Prompt browser yang ditolak = tidak bisa diminta lagi (hanya lewat
// setelan situs), jadi tahap 1 tidak pernah dilewati.
// Props:
// - benefitText: kalimat manfaat sesuai peran/pemakaian.
// - autoOfferSignal: berubah (mis. jumlah simpan berhasil) untuk memunculkan
//   modal otomatis bila kondisi memenuhi (izin masih default, belum
//   berlangganan, tidak sedang snooze).
export function PushPermissionPrompt({
  benefitText,
  autoOfferSignal,
  banner = true,
  autoOpenOnMount = false,
}: {
  benefitText: string;
  autoOfferSignal?: number;
  // banner=false: hanya logika modal (untuk layout global); tanpa kartu.
  banner?: boolean;
  // autoOpenOnMount: buka modal saat pertama mount bila masih undecided
  // (izin default, belum berlangganan, tidak snooze).
  autoOpenOnMount?: boolean;
}) {
  const [supported, setSupported] = useState(true);
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [showModal, setShowModal] = useState(false);
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

  // Penawaran global saat pertama membuka (layout admin).
  useEffect(() => {
    if (!autoOpenOnMount) return;
    if (!pushSupported()) return;
    getPushState().then((st) => {
      setPermission(st.permission);
      setSubscribed(st.subscribed);
      if (
        st.permission === "default" &&
        !st.subscribed &&
        !isSnoozed()
      ) {
        setShowModal(true);
      }
    });
  }, [autoOpenOnMount]);

  // Penawaran otomatis (mis. setelah submit absen berhasil).
  useEffect(() => {
    if (!autoOfferSignal || autoOfferSignal <= 0) return;
    if (!pushSupported()) return;
    getPushState().then((st) => {
      setPermission(st.permission);
      setSubscribed(st.subscribed);
      if (
        st.permission === "default" &&
        !st.subscribed &&
        !isSnoozed()
      ) {
        setShowModal(true);
      }
    });
  }, [autoOfferSignal]);

  const handleAktifkan = async () => {
    setBusy(true);
    const result = await subscribePush();
    setBusy(false);
    if (result === "subscribed") {
      setShowModal(false);
      setSubscribed(true);
      setPermission("granted");
      toast.success("Notifikasi aktif di perangkat ini.");
    } else if (result === "denied") {
      setShowModal(false);
      setPermission("denied");
      toast.error("Izin notifikasi ditolak browser.");
    } else {
      toast.error("Gagal mengaktifkan notifikasi, coba lagi.");
    }
  };

  const handleNanti = () => {
    setSnooze();
    setShowModal(false);
  };

  const handleNonaktifkan = async () => {
    setBusy(true);
    const ok = await unsubscribePush();
    setBusy(false);
    if (ok) {
      setSubscribed(false);
      toast.success("Notifikasi dinonaktifkan di perangkat ini.");
    } else {
      toast.error("Gagal menonaktifkan notifikasi.");
    }
  };

  if (!supported) return null;

  return (
    <>
      {banner && (
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
              Nonaktifkan
            </button>
          </div>
        ) : permission === "denied" ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            Notifikasi diblokir di browser ini. Untuk mengaktifkan lagi:
            ketuk ikon gembok di address bar → Izin situs → izinkan
            Notifikasi, lalu muat ulang halaman.
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--color-text)]">{benefitText}</p>
            <button
              onClick={() => setShowModal(true)}
              className="shrink-0 rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-blue-700"
            >
              Aktifkan Notifikasi
            </button>
          </div>
        )}
      </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-black text-[var(--color-text)]">
              Aktifkan Notifikasi?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
              {benefitText}
            </p>
            <p className="mt-2 text-xs text-[var(--color-text-subtle)]">
              Browser akan meminta izin setelah ini. Bila ditolak, izin
              hanya bisa diubah lewat setelan situs.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={handleAktifkan}
                disabled={busy}
                className="flex-1 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? "Memproses..." : "Aktifkan"}
              </button>
              <button
                onClick={handleNanti}
                disabled={busy}
                className="flex-1 rounded-full border border-[var(--color-surface-dark)] px-4 py-2.5 text-sm font-bold text-[var(--color-text)] transition hover:bg-slate-50 disabled:opacity-50"
              >
                Nanti Saja
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
