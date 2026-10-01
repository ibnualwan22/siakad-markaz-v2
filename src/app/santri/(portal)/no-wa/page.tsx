"use client";

import { useEffect, useState } from "react";
import {
  MessageCircle,
  Send,
  ShieldCheck,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Info,
  RefreshCw,
} from "lucide-react";

export default function SantriNoWaPage() {
  const [loading, setLoading] = useState(true);
  const [noWaMasked, setNoWaMasked] = useState<string | null>(null);
  const [terhubung, setTerhubung] = useState(false);

  const [step, setStep] = useState<1 | 2>(1);
  const [noWa, setNoWa] = useState("");
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [sukses, setSukses] = useState(false);

  const muat = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/santri/me/no-wa");
      const d = await r.json();
      if (d.success) {
        setNoWaMasked(d.noWaMasked);
        setTerhubung(d.terhubung);
      }
    } catch {
      /* abaikan */
    }
    setLoading(false);
  };

  useEffect(() => {
    muat();
  }, []);

  const mintaOtp = async () => {
    setError(null);
    setInfo(null);
    if (!noWa.trim()) {
      setError("Isi nomor WhatsApp dulu.");
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch("/api/santri/me/no-wa/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noWa }),
      });
      const d = await r.json();
      if (d.success) {
        setStep(2);
        setInfo(d.message);
      } else {
        setError(d.error || "Gagal mengirim kode OTP.");
      }
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
    }
    setSubmitting(false);
  };

  const verifikasi = async () => {
    setError(null);
    setInfo(null);
    if (otp.trim().length !== 6) {
      setError("Kode OTP terdiri dari 6 angka.");
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch("/api/santri/me/no-wa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noWa, otp }),
      });
      const d = await r.json();
      if (d.success) {
        setSukses(true);
        muat();
      } else {
        setError(d.error || "Verifikasi gagal.");
      }
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
    }
    setSubmitting(false);
  };

  const ulangi = () => {
    setStep(1);
    setOtp("");
    setError(null);
    setInfo(null);
    setSukses(false);
  };

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-[var(--color-primary)]" />
          WhatsApp AI
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Hubungkan nomor WhatsApp Anda ke Bot Siakad agar bisa cek nilai & absen lewat WA.
        </p>
      </div>

      <div className="p-4 bg-[var(--color-primary-50)] text-sm rounded-2xl border border-[var(--color-primary-100)] flex gap-3">
        <Info className="w-5 h-5 shrink-0 text-[var(--color-primary)]" />
        <div>
          Bot WA mengenali Anda dari <b>nomor pengirim</b>. Pastikan nomor di bawah ini
          adalah nomor WhatsApp yang Anda pakai untuk chat dengan bot.
          Nomor harus <b>diverifikasi dengan kode OTP</b> sebelum tersimpan.
        </div>
      </div>

      <div className="p-5 rounded-2xl border bg-white shadow-sm">
        <div className="text-sm text-gray-500">Nomor terdaftar saat ini</div>
        <div className="mt-1 flex items-center gap-2">
          {loading ? (
            <span className="text-gray-400">Memuat…</span>
          ) : (
            <>
              <span className="text-lg font-bold font-mono">{noWaMasked || "—"}</span>
              {terhubung ? (
                <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 font-semibold">
                  Terhubung
                </span>
              ) : (
                <span className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-200 font-semibold">
                  Belum ada nomor
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {sukses ? (
        <div className="p-5 rounded-2xl border border-emerald-200 bg-emerald-50 flex items-start gap-3">
          <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-emerald-700">Nomor berhasil diverifikasi!</div>
            <p className="text-sm text-emerald-700 mt-1">
              Sekarang kirim pesan apa saja (misal “halo”) ke nomor Bot WA Siakad
              untuk mulai memakai bot.
            </p>
            <button
              onClick={ulangi}
              className="mt-3 text-sm font-semibold text-[var(--color-primary)] flex items-center gap-1"
            >
              <RefreshCw className="w-4 h-4" /> Ganti nomor lagi
            </button>
          </div>
        </div>
      ) : (
        <div className="p-5 rounded-2xl border bg-white shadow-sm space-y-4">
          {step === 1 ? (
            <>
              <label className="block">
                <span className="text-sm font-semibold">Nomor WhatsApp baru</span>
                <input
                  type="tel"
                  value={noWa}
                  onChange={(e) => setNoWa(e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  className="neu-input mt-1 w-full rounded-xl p-3 text-sm font-mono focus:border-[var(--color-primary)] focus:ring-[var(--color-primary-50)] transition"
                />
              </label>
              <button
                onClick={mintaOtp}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white px-5 py-3 rounded-xl font-bold text-sm shadow-md transition disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Kirim Kode OTP
              </button>
            </>
          ) : (
            <>
              <div className="text-sm text-gray-600">
                Kode OTP dikirim ke <b className="font-mono">{noWa}</b>.
              </div>
              <label className="block">
                <span className="text-sm font-semibold">Kode OTP (6 angka)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••••"
                  className="neu-input mt-1 w-full rounded-xl p-3 text-sm font-mono tracking-[0.5em] text-center focus:border-[var(--color-primary)] focus:ring-[var(--color-primary-50)] transition"
                />
              </label>
              <button
                onClick={verifikasi}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white px-5 py-3 rounded-xl font-bold text-sm shadow-md transition disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
                Verifikasi & Simpan
              </button>
              <div className="flex justify-between text-sm">
                <button onClick={ulangi} className="text-gray-500 font-semibold">
                  ← Ubah nomor
                </button>
                <button
                  onClick={mintaOtp}
                  disabled={submitting}
                  className="text-[var(--color-primary)] font-semibold disabled:opacity-50"
                >
                  Kirim ulang kode
                </button>
              </div>
            </>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
            </div>
          )}
          {info && (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-700 flex gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" /> {info}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
