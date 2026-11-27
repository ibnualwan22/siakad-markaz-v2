"use client";

import { useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

type ReminderPengajarToggleProps = {
  initialActive: boolean;
  initialUpdatedAt: string | null;
  initialUpdatedBy: string | null;
};

function formatWibTimestamp(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso)) + " WIB";
  } catch {
    return null;
  }
}

export function ReminderPengajarToggle({
  initialActive,
  initialUpdatedAt,
  initialUpdatedBy,
}: ReminderPengajarToggleProps) {
  const [isActive, setIsActive] = useState(initialActive);
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt);
  const [updatedBy, setUpdatedBy] = useState<string | null>(initialUpdatedBy);
  const [isSaving, setIsSaving] = useState(false);

  const handleToggle = async () => {
    if (isSaving) return;
    const nextValue = !isActive;
    setIsSaving(true);
    try {
      const res = await fetch("/api/admin/absensi/rekap/pengajar/reminder-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextValue }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal memperbarui status reminder");
      }
      setIsActive(Boolean(json.isActive));
      setUpdatedAt(json.updatedAt ?? new Date().toISOString());
      setUpdatedBy(json.updatedBy ?? null);
      toast.success(
        json.isActive
          ? "Reminder otomatis WA pengajar diaktifkan"
          : "Reminder otomatis WA pengajar dinonaktifkan"
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan";
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const formattedTime = formatWibTimestamp(updatedAt);

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
        isActive
          ? "bg-emerald-50/70 border-emerald-200"
          : "bg-rose-50/70 border-rose-200"
      }`}
    >
      <div className="flex items-start gap-3.5 min-w-0">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isActive
              ? "bg-emerald-600 text-white shadow-sm"
              : "bg-rose-600 text-white shadow-sm"
          }`}
        >
          {isActive ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold text-[var(--color-text)]">
              Reminder WA Pengajar Belum Absen
            </h2>
            <span
              className={`text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                isActive
                  ? "bg-emerald-600 text-white"
                  : "bg-rose-600 text-white"
              }`}
            >
              {isActive ? "Aktif" : "Nonaktif"}
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
            {isActive
              ? "Cron otomatis akan mengirim pengingat WA kepada pengajar yang belum absen setelah sesi berakhir."
              : "Cron otomatis sedang dijeda — tidak ada pesan pengingat WA yang dikirim ke pengajar sampai diaktifkan kembali."}
          </p>
          {(updatedBy || formattedTime) && (
            <p className="text-[11px] text-[var(--color-text-subtle)] mt-1">
              Terakhir diubah{updatedBy ? ` oleh ${updatedBy}` : ""}
              {formattedTime ? ` • ${formattedTime}` : ""}
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={isActive}
        aria-label={isActive ? "Nonaktifkan reminder WA pengajar" : "Aktifkan reminder WA pengajar"}
        onClick={handleToggle}
        disabled={isSaving}
        className={`shrink-0 inline-flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all disabled:opacity-60 cursor-pointer ${
          isActive
            ? "bg-white text-rose-700 border border-rose-200 hover:bg-rose-50 shadow-sm"
            : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
        }`}
      >
        {isSaving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <span
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              isActive ? "bg-emerald-500" : "bg-white/30"
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                isActive ? "translate-x-4.5" : "translate-x-1"
              }`}
            />
          </span>
        )}
        <span>{isActive ? "Matikan Reminder" : "Aktifkan Reminder"}</span>
      </button>
    </div>
  );
}
