"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function WifiLoginForm() {
  const searchParams = useSearchParams();
  const [input, setInput] = useState("");
  const [password, setPassword] = useState(""); // Hanya untuk civitas
  const [status, setStatus] = useState<"idle" | "checking" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [isCivitasMode, setIsCivitasMode] = useState(false);

  // Ambil parameter dari Ruijie redirect
  const gwAddress = searchParams.get("gw_address") || "";
  const gwPort = searchParams.get("gw_port") || "";
  const gwId = searchParams.get("gw_id") || "";
  const userMac = searchParams.get("mac") || searchParams.get("client_mac") || "";
  const userIp = searchParams.get("ip") || searchParams.get("client_ip") || "";
  const redirectUrl = searchParams.get("url") || searchParams.get("redirect") || "";

  const gatewayAuthUrl = gwAddress ? `http://${gwAddress}:${gwPort}/wifidog/auth` : "";

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    setError("");
    
    // Auto-detect mode jika belum dimatikan explicit
    const hasLetters = /[a-zA-Z]/.test(val);
    if (val.length >= 3 && hasLetters) {
      if (!isCivitasMode) setIsCivitasMode(true);
    } else {
      if (isCivitasMode) setIsCivitasMode(false);
    }
  };

  const executeSubmit = (usernameParam: string, passwordParam: string) => {
    if (!gatewayAuthUrl) {
      setError("Halaman ini harus diakses melalui jaringan WiFi Markaz");
      setStatus("idle");
      return;
    }

    const form = document.createElement("form");
    form.method = "POST";
    form.action = gatewayAuthUrl;

    const fields: Record<string, string> = {
      username: usernameParam,
      password: passwordParam,
    };

    if (gwId) fields.gw_id = gwId;
    if (userMac) fields.mac = userMac;
    if (userIp) fields.ip = userIp;
    if (redirectUrl) fields.url = redirectUrl;

    Object.entries(fields).forEach(([key, value]) => {
      const inputEl = document.createElement("input");
      inputEl.type = "hidden";
      inputEl.name = key;
      inputEl.value = value;
      form.appendChild(inputEl);
    });

    document.body.appendChild(form);
    form.submit();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) {
      setError("Input tidak boleh kosong");
      return;
    }

    if (isCivitasMode) {
      if (!password) {
        setError("Password harus diisi");
        return;
      }
      setStatus("loading");
      // Jika mode Civitas, langsung submit via RADIUS (tidak perlu cek DB dulu, RADIUS yg akan nolak kalau salah)
      executeSubmit(trimmed, password);
      return;
    }

    // Jika mode Santri/Voucher, lakukan optimisasi pengecekan
    setStatus("checking");
    setError("");

    try {
      const res = await fetch("/api/wifi/check-type", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: trimmed }),
      });
      const data = await res.json();

      if (data.type === "santri" || data.type === "voucher") {
        setStatus("loading");
        executeSubmit(trimmed, trimmed); // NIS/Voucher password pakenya input itu sendiri
      } else if (data.type === "civitas") {
        // Ternyata ini civitas tapi usernya tidak ketik huruf (walau admin nyuruh pakai huruf, jaga-jaga)
        setIsCivitasMode(true);
        setError("Mohon masukkan password WiFi Anda");
        setStatus("idle");
      } else {
        setError("NIS atau Voucher tidak valid/kadaluarsa.");
        setStatus("idle");
      }
    } catch (err) {
      // Fallback jika API gagal, tempak langsung ke RADIUS
      setStatus("loading");
      executeSubmit(trimmed, trimmed);
    }
  };

  const renderTabs = () => (
    <div className="flex bg-white/5 rounded-xl p-1 mb-6">
      <button
        type="button"
        onClick={() => { setIsCivitasMode(false); setInput(""); setError("") }}
        className={`flex-1 text-xs font-semibold py-2.5 rounded-lg transition-all ${!isCivitasMode ? 'bg-[#c8a45a] text-[#0c1220] shadow-lg' : 'text-white/40 hover:text-white/60'}`}
      >
        Santri / Tamu
      </button>
      <button
        type="button"
        onClick={() => { setIsCivitasMode(true); setInput(""); setError("") }}
        className={`flex-1 text-xs font-semibold py-2.5 rounded-lg transition-all ${isCivitasMode ? 'bg-[#c8a45a] text-[#0c1220] shadow-lg' : 'text-white/40 hover:text-white/60'}`}
      >
        Civitas Asatid
      </button>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #0c1220 0%, #1a2744 50%, #0f1b30 100%)" }}
    >
      <div className="w-full max-w-sm">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{
              background: "linear-gradient(135deg, #c8a45a 0%, #e8c872 50%, #c8a45a 100%)",
              boxShadow: "0 8px 32px rgba(200, 164, 90, 0.3)",
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.55a11 11 0 0 1 14.08 0" />
              <path d="M1.42 9a16 16 0 0 1 21.16 0" />
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
              <line x1="12" y1="20" x2="12.01" y2="20" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-2" style={{ fontFamily: "'Amiri', serif" }}>
            مركز العربية
          </h1>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
            Portal Autentikasi Jaringan Internal
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl p-6"
          style={{
            background: "rgba(255,255,255,0.05)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {renderTabs()}

          <form onSubmit={handleSubmit}>
            {/* Input Universal / Username */}
            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                {isCivitasMode ? "Username WiFi" : "NIS / Kode Voucher"}
              </label>
              <input
                type={isCivitasMode ? "text" : "tel"}
                value={input}
                onChange={handleInputChange}
                placeholder={isCivitasMode ? "Misal: ustadz.budi" : "Ketik NIS atau Voucher"}
                readOnly={status === "loading" || status === "checking"}
                className="w-full px-4 py-3.5 rounded-xl text-white text-base font-medium outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: error ? "1px solid rgba(239,68,68,0.6)" : "1px solid rgba(255,255,255,0.1)",
                }}
                autoFocus
                autoComplete="off"
              />
            </div>

            {/* Password Khusus Civitas */}
            {isCivitasMode && (
              <div className="mb-5">
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                >
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ketik password WiFi"
                  readOnly={status === "loading"}
                  className="w-full px-4 py-3.5 rounded-xl text-white text-base font-medium outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                />
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-4 px-3 py-2 rounded-lg text-xs font-medium"
                style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}
              >
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={status === "loading" || status === "checking" || !input.trim()}
              className="w-full py-3.5 mt-2 rounded-xl text-sm font-bold uppercase tracking-wider transition-all disabled:opacity-50"
              style={{
                background: input.trim()
                  ? "linear-gradient(135deg, #c8a45a 0%, #e8c872 100%)"
                  : "rgba(255,255,255,0.08)",
                color: input.trim() ? "#0c1220" : "rgba(255,255,255,0.3)",
                boxShadow: input.trim() ? "0 4px 20px rgba(200, 164, 90, 0.4)" : "none",
              }}
            >
              {status === "checking" ? "Mengecek..." : status === "loading" ? "Menghubungkan..." : "Connect WiFi"}
            </button>
          </form>
        </div>

        {/* Footer Info */}
        <p className="text-center text-xs mt-6 px-4" style={{ color: "rgba(255,255,255,0.25)" }}>
          Fitur Captive Portal Otomatis
          <br/>
          Hubungi admin Markaz Jika mengalami kendala
        </p>

        {process.env.NODE_ENV === "development" && gwAddress && (
          <div className="mt-4 p-3 rounded-lg text-xs font-mono"
            style={{ background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.2)" }}
          >
            <p>GW: {gwAddress}:{gwPort}</p>
            <p>MAC: {userMac}</p>
            <p>IP: {userIp}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function WifiLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#0c1220]">
          <div className="animate-spin h-8 w-8 border-2 border-white/20 border-t-[#c8a45a] rounded-full" />
        </div>
      }
    >
      <WifiLoginForm />
    </Suspense>
  );
}
