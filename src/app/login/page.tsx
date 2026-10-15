"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Lock, User } from "lucide-react";
import toast from "react-hot-toast";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [formData, setFormData] = useState({ username: "", password: "" });

  // Tampilkan pesan jika sesi kedaluwarsa
  useEffect(() => {
    if (searchParams.get("expired") === "1") {
      setErrorMsg("Sesi Anda telah berakhir. Silakan login kembali.");
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, username: formData.username.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Gagal login");
        throw new Error(data.error || "Gagal login");
      }

      toast.success("Login berhasil!");
      // Kembali ke halaman terakhir sebelum sesi habis (jika ada)
      let target = data.redirect;
      try {
        const saved = sessionStorage.getItem("redirectAfterLogin");
        if (saved && saved.startsWith("/") && !saved.startsWith("/login")) {
          target = saved;
          sessionStorage.removeItem("redirectAfterLogin");
        }
      } catch { /* abaikan */ }
      router.push(target);
      router.refresh();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" 
      style={{ 
        backgroundColor: "var(--bg-app)",
        backgroundImage: "linear-gradient(rgba(0, 102, 102, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 102, 102, 0.04) 1px, transparent 1px)",
        backgroundSize: "32px 32px"
      }}
    >
      {/* Glow effect behind the card */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] max-w-[600px] max-h-[600px] bg-[var(--color-primary-50)] rounded-full blur-[120px] opacity-70 pointer-events-none"></div>

      <div className="max-w-md w-full relative z-10">
        {/* Card */}
        <div className="neu-card p-8 md:p-10">
          {/* Logo & Title */}
          <div className="flex flex-col items-center mb-8">
            <div className="neu-card p-4 mb-5 rounded-2xl">
              <Image
                src="/images/Logo Markaz.png"
                alt="Logo Markaz Arabiyah"
                width={64}
                height={64}
                className="rounded-lg"
              />
            </div>
            <h1 className="text-2xl font-bold tracking-wide font-display" style={{ color: "var(--color-text)" }}>
              SIAKAD
            </h1>
            <p className="mt-1 text-sm font-semibold" style={{ color: "var(--color-primary)" }}>
              Markaz Arabiyah
            </p>
          </div>

          {/* Error */}
          {errorMsg && (
            <div className="mb-6 rounded-xl p-4 text-sm font-semibold" style={{ background: "var(--color-danger-light)", color: "var(--color-danger)", boxShadow: "var(--shadow-inset-sm)" }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-[0.15em] mb-2" style={{ color: "var(--color-text-muted)" }}>
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none" style={{ color: "var(--color-text-subtle)" }}>
                  <User size={18} />
                </div>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="neu-input w-full !pl-11 !pr-4 !py-3"
                  placeholder="Masukkan username"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-[0.15em] mb-2" style={{ color: "var(--color-text-muted)" }}>
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none" style={{ color: "var(--color-text-subtle)" }}>
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="neu-input w-full !pl-11 !pr-4 !py-3"
                  placeholder="Masukkan password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="neu-button-primary w-full py-3.5 px-4 rounded-xl text-sm flex justify-center items-center"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                "Masuk ke Dashboard"
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center mt-6 text-[11px] font-semibold" style={{ color: "var(--color-text-subtle)" }}>
          Developed by <span className="font-bold" style={{ color: "var(--color-primary)" }}>Aksara X</span> KSU Batch 10
        </p>
      </div>
    </div>
  );
}
