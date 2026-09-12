"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";

export function WifiAccountWidget() {
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchAccount = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/user/wifi-account");
      const data = await res.json();
      if (data.account) setAccount(data.account);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccount();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return toast.error("Password tidak boleh kosong");
    if (!account && !username) return toast.error("Username tidak boleh kosong");

    setSubmitting(true);
    try {
      if (account) {
        // Update password
        const res = await fetch("/api/user/wifi-account", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password })
        });
        if (res.ok) {
          toast.success("Password WiFi berhasil diubah!");
          fetchAccount();
          setShowForm(false);
          setPassword("");
        } else {
          const err = await res.json();
          toast.error(err.error || "Gagal mengubah password");
        }
      } else {
        // Buat baru
        const res = await fetch("/api/user/wifi-account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password })
        });
        if (res.ok) {
          toast.success("Akun WiFi berhasil dibuat!");
          fetchAccount();
          setShowForm(false);
        } else {
          const err = await res.json();
          toast.error(err.error || "Gagal membuat akun");
        }
      }
    } catch {
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="border rounded-xl p-6 bg-white shadow-sm flex justify-center"><div className="animate-pulse h-4 bg-gray-200 rounded w-1/4"></div></div>;
  }

  return (
    <div className="border rounded-xl p-6 bg-white shadow-sm flex flex-col items-start gap-4" style={{
      background: "linear-gradient(145deg, #ffffff, #fdfbf7)",
      border: "1px solid #f0e6d2"
    }}>
      <div className="flex items-center gap-3 w-full">
        <div className="p-2 rounded-lg bg-[#f0e6d2] text-[#c8a45a]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9c5.857-5.857 15.355-5.857 21.213 0" /></svg>
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-800">Akses WiFi Markaz</h2>
          <p className="text-sm text-gray-500">Khusus untuk Civitas / Asatidza</p>
        </div>
      </div>

      {!account && !showForm && (
        <div className="w-full flex flex-col md:flex-row justify-between items-center bg-gray-50 p-4 rounded-lg border border-dashed border-gray-300">
          <p className="text-sm text-gray-600 mb-2 md:mb-0">Anda belum membuat akun WiFi.</p>
          <button 
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-[#c8a45a] hover:bg-[#b08d4b] text-white rounded-lg text-sm font-semibold transition-colors"
          >
            Buat Akun Sekarang
          </button>
        </div>
      )}

      {account && !showForm && (
        <div className="w-full bg-green-50/50 p-4 rounded-lg border border-green-100 flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
            <p className="text-xs text-green-600 font-bold uppercase tracking-wider mb-1">Status: Aktif</p>
            <p className="text-sm text-gray-700">Username Anda: <span className="font-mono font-bold">{account.username}</span></p>
          </div>
          <button 
            onClick={() => setShowForm(true)}
            className="mt-2 md:mt-0 px-4 py-2 border border-[#c8a45a] text-[#c8a45a] hover:bg-[#c8a45a] hover:text-white rounded-lg text-sm font-semibold transition-colors"
          >
            Ubah Password
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="w-full bg-gray-50 p-4 rounded-lg border border-gray-200 mt-2">
          <h3 className="font-bold text-gray-800 mb-4">{account ? "Ubah Password WiFi" : "Buat Akun WiFi Civitas"}</h3>
          
          <div className="space-y-3 shrink-0 w-full md:w-3/4">
            {!account && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Username Baru <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Misal: ustadz.budi (minimal 3 huruf)" 
                  className="w-full px-3 py-2 border rounded-md text-sm outline-none focus:border-[#c8a45a]"
                  required
                />
                <p className="text-[10px] text-gray-500 mt-1">Harus mengandung huruf dan tidak boleh berupa 11 digit angka (agar tidak bentrok dengan NIS Santri).</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Password Baru <span className="text-red-500">*</span></label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Buat password khusus WiFi..." 
                className="w-full px-3 py-2 border rounded-md text-sm outline-none focus:border-[#c8a45a]"
                required
              />
              <p className="text-[10px] text-gray-500 mt-1">Buat password yang mudah Anda ingat khusus untuk WiFi.</p>
            </div>
            
            <div className="flex gap-2 pt-2">
              <button 
                type="submit" 
                disabled={submitting}
                className="px-4 py-2 bg-[#1a2744] text-white rounded-md text-sm font-semibold hover:bg-[#203154] disabled:opacity-50"
              >
                {submitting ? "Menyimpan..." : "Simpan"}
              </button>
              <button 
                type="button" 
                onClick={() => { setShowForm(false); setPassword(""); }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm font-semibold hover:bg-gray-300"
              >
                Batal
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
