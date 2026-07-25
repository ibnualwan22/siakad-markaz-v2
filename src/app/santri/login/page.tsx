"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { GraduationCap, ArrowRight, BookOpen } from "lucide-react";

export default function SantriLoginPage() {
  const router = useRouter();
  const [nis, setNis] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nis.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/santri/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nis: nis.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Gagal login");
        return;
      }

      router.push(data.redirect);
      router.refresh();
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        backgroundColor: "var(--bg-app)",
        backgroundImage:
          "radial-gradient(circle at 20% 80%, rgba(0,102,102,0.06) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(0,102,102,0.04) 0%, transparent 50%)",
      }}
    >
      {/* Decorative background elements */}
      <div
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,102,102,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,102,102,0.03) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="max-w-sm w-full relative z-10">
        {/* Logo Section */}
        <div className="flex flex-col items-center mb-8">
          <div className="neu-card p-5 rounded-2xl mb-6">
            <Image
              src="/images/Logo Markaz.png"
              alt="Logo Markaz Arabiyah"
              width={72}
              height={72}
              className="rounded-lg"
            />
          </div>
          <h1
            className="text-2xl font-bold tracking-wide font-display"
            style={{ color: "var(--color-text)" }}
          >
            SIAKAD
          </h1>
          <p
            className="mt-1 text-xs font-semibold tracking-widest uppercase"
            style={{ color: "var(--color-primary)" }}
          >
            Markaz Arabiyah
          </p>
          <p
            className="mt-2 text-xs text-center"
            style={{ color: "var(--color-text-muted)" }}
          >
            Sistem Informasi Akademik
          </p>
        </div>

        {/* Login Card */}
        <div className="neu-card p-7">
          <div className="flex items-center gap-2 mb-6">
            <div
              className="p-2 rounded-lg"
              style={{
                background: "var(--color-primary-50)",
                color: "var(--color-primary)",
              }}
            >
              <BookOpen size={18} />
            </div>
            <div>
              <h2
                className="text-sm font-bold"
                style={{ color: "var(--color-text)" }}
              >
                Portal Santri
              </h2>
              <p
                className="text-[11px]"
                style={{ color: "var(--color-text-muted)" }}
              >
                Masuk dengan NIS
              </p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              className="mb-5 rounded-xl p-3.5 text-xs font-semibold"
              style={{
                background: "var(--color-danger-light)",
                color: "var(--color-danger)",
                boxShadow: "var(--shadow-inset-sm)",
              }}
            >
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                className="block text-[10px] font-bold uppercase tracking-[0.15em] mb-2"
                style={{ color: "var(--color-text-muted)" }}
              >
                Nomor Induk Santri
              </label>
              <div className="relative">
                <div
                  className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"
                  style={{ color: "var(--color-text-subtle)" }}
                >
                  <GraduationCap size={18} />
                </div>
                <input
                  id="nis-input"
                  name="username"
                  type="text"
                  required
                  value={nis}
                  onChange={(e) => setNis(e.target.value)}
                  className="neu-input w-full !pl-11 !pr-4 !py-3.5 text-sm"
                  placeholder="Masukkan NIS"
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            <button
              id="login-button"
              type="submit"
              disabled={loading || !nis.trim()}
              className="neu-button-primary w-full py-3.5 px-4 rounded-xl text-sm flex justify-center items-center gap-2"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  Masuk
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p
          className="text-center mt-6 text-[10px] font-semibold"
          style={{ color: "var(--color-text-subtle)" }}
        >
          Developed by{" "}
          <span className="font-bold" style={{ color: "var(--color-primary)" }}>
            Aksara X
          </span>{" "}
          KSU Batch 10
        </p>
      </div>
    </div>
  );
}
