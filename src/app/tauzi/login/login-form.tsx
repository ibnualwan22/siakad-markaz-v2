"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, ArrowRight, ClipboardList, Loader2 } from "lucide-react";

export default function TauziLoginForm({ initialNis = "" }: { initialNis?: string }) {
  const router = useRouter();
  const [nis, setNis] = useState(initialNis);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(!!initialNis);

  const performLogin = async (nisString: string) => {
    if (!nisString.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/tauzi/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nis: nisString.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Gagal masuk");
        setIsAutoLoggingIn(false);
        return;
      }

      router.push(data.redirect);
      router.refresh();
    } catch {
      setError("Kesalahan jaringan");
      setIsAutoLoggingIn(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialNis) {
      performLogin(initialNis);
    }
  }, [initialNis]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await performLogin(nis);
  };

  if (isAutoLoggingIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <Loader2 className="animate-spin text-teal-600" size={32} />
        <p className="font-semibold text-gray-500 text-sm">Mengalihkan secara otomatis...</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="w-full max-w-sm neu-card p-6 md:p-8 rounded-3xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600">
            <ClipboardList size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold" style={{ color: "var(--color-text)" }}>Tes Penempatan</h2>
            <p className="text-xs font-medium text-gray-500">Masuk dengan NIS</p>
          </div>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-xl text-xs font-semibold bg-red-50 text-red-600 border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider mb-2 text-gray-500">Nomor Induk Santri</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <GraduationCap size={18} />
              </div>
              <input
                type="text"
                required
                value={nis}
                onChange={e => setNis(e.target.value)}
                className="neu-input w-full !pl-11 !pr-4 !py-3.5 text-sm font-semibold"
                placeholder="210XXXXX"
                autoFocus
                autoComplete="off"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || !nis.trim()}
            className="neu-button-primary w-full py-3.5 rounded-xl font-bold flex justify-center items-center gap-2"
          >
            {loading ? "Memproses..." : (
              <>Mulai Tes <ArrowRight size={16} /></>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
