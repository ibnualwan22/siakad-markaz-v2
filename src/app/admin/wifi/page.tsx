"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";

type TabType = "PROFIL" | "SAKAN" | "SANTRI" | "VOUCHER" | "CIVITAS";

export default function AdminWifiDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>("PROFIL");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Data states
  const [profiles, setProfiles] = useState<any[]>([]);
  const [sakans, setSakans] = useState<any[]>([]);
  const [santriAccounts, setSantriAccounts] = useState<any[]>([]);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [civitasAccounts, setCivitasAccounts] = useState<any[]>([]);

  // Fetch data
  const fetchProfiles = async () => {
    try {
      const res = await fetch("/api/admin/wifi/profiles");
      const data = await res.json();
      setProfiles(data.profiles || []);
    } catch {}
  };

  const fetchSakans = async () => {
    try {
      const res = await fetch("/api/admin/wifi/sakan");
      const data = await res.json();
      setSakans(data.sakans || []);
    } catch {}
  };

  const fetchSantri = async () => {
    try {
      const res = await fetch("/api/admin/wifi/accounts");
      const data = await res.json();
      setSantriAccounts(data.accounts || []);
    } catch {}
  };

  const fetchVouchers = async () => {
    try {
      const res = await fetch("/api/admin/wifi/voucher");
      const data = await res.json();
      setVouchers(data.vouchers || []);
    } catch {}
  };

  const fetchCivitas = async () => {
    try {
      const res = await fetch("/api/admin/wifi/civitas");
      const data = await res.json();
      setCivitasAccounts(data.civitas || []);
    } catch {}
  };

  useEffect(() => {
    fetchProfiles();
    switch (activeTab) {
      case "SAKAN": fetchSakans(); break;
      case "SANTRI": fetchSantri(); break;
      case "VOUCHER": fetchVouchers(); break;
      case "CIVITAS": fetchCivitas(); break;
    }
  }, [activeTab]);

  const handleSyncRadius = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/wifi/sync-radius", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Sync Berhasil! ${data.summary.totaleAkunWifi} akun aktif.`);
      } else {
        toast.error(data.error || "Gagal sync");
      }
    } catch (err) {
      toast.error("Gagal koneksi ke server");
    } finally {
      setSyncing(false);
    }
  };

  // ================= TAB RENDERERS =================

  const renderProfiles = () => {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-gray-800">Profil Bandwidth RADIUS</h2>
          {/* Tambah fitur profil nanti bisa via modal, utk MVP kita tampilkan data saja */}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-semibold border-b">
              <tr>
                <th className="px-4 py-3">Nama Profil</th>
                <th className="px-4 py-3">RADIUS Group</th>
                <th className="px-4 py-3">Speed (Down/Up)</th>
                <th className="px-4 py-3">Max Dev</th>
                <th className="px-4 py-3">Ket</th>
              </tr>
            </thead>
            <tbody>
              {profiles.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-4 text-gray-400">Belum ada profil profil.</td></tr>
              ) : (
                profiles.map((p) => (
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold">{p.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{p.radiusGroup}</td>
                    <td className="px-4 py-3">{p.downloadKbps / 1000} Mbps / {p.uploadKbps / 1000} Mbps</td>
                    <td className="px-4 py-3">{p.maxDevices}</td>
                    <td className="px-4 py-3 text-gray-500">{p.description || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderSakan = () => {
    const toggleSakan = async (sakan: string, currentVal: boolean) => {
      try {
        const res = await fetch("/api/admin/wifi/sakan", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sakan, enabled: !currentVal })
        });
        if (res.ok) {
          toast.success(`Status WiFi Sakan ${sakan} diperbarui`);
          fetchSakans();
        } else {
          toast.error("Gagal update");
        }
      } catch (err) {
        toast.error("Error connecting server");
      }
    };

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-6">Manajemen Sakan (Asrama) WiFi</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sakans.map((s, i) => (
            <div key={i} className="border rounded-xl p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-800">{s.sakan || "Belum ada sakan"}</h3>
                <p className="text-sm text-gray-500">{s.count} Santri Aktif</p>
                {s.profileName && <p className="text-xs text-blue-600 mt-1">Profil: {s.profileName}</p>}
              </div>
              <div>
                <button
                  onClick={() => toggleSakan(s.sakan, s.enabled)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${s.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                >
                  {s.enabled ? "ON" : "OFF"}
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-4">* Perubahan akan memengaruhi santri di sakan setelah menekan tombol Sync RADIUS.</p>
      </div>
    );
  };

  const renderSantri = () => {
    const toggleIndividual = async (id: string, currentVal: boolean) => {
      try {
        const res = await fetch("/api/admin/wifi/santri-toggle", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ santriId: id, wifiEnabled: !currentVal })
        });
        if (res.ok) fetchSantri();
      } catch (err) {}
    };

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-6">Akses WiFi per Santri</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-semibold border-b">
              <tr>
                <th className="px-4 py-3">NIS</th>
                <th className="px-4 py-3">Nama Santri</th>
                <th className="px-4 py-3">Sakan</th>
                <th className="px-4 py-3">Status Siakad</th>
                <th className="px-4 py-3">Akses WiFi (Override)</th>
              </tr>
            </thead>
            <tbody>
              {santriAccounts.map((a, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{a.nis}</td>
                  <td className="px-4 py-3 font-semibold">{a.nama}</td>
                  <td className="px-4 py-3">{a.sakan}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${a.isAktif ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {a.isAktif ? 'Aktif' : 'Non-Aktif'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleIndividual(a.nis, a.wifiEnabled)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${a.wifiEnabled ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {a.wifiEnabled ? 'Aktif (Override)' : 'Diblokir'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderVoucher = () => {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-6">Manajemen Voucher Tamu</h2>
        {/* Form generate (simplified for MVP) */}
        <p className="text-sm text-gray-500 mb-4">API generator telah disiapkan, UI generator menyusul di iterasi berikutnya (Generate Batch, durasi dll).</p>
        
        <div className="overflow-x-auto mt-6">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-semibold border-b">
              <tr>
                <th className="px-4 py-3">Kode/Username</th>
                <th className="px-4 py-3">Durasi</th>
                <th className="px-4 py-3">Profil</th>
                <th className="px-4 py-3">Expired At</th>
                <th className="px-4 py-3">Catatan</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-4 text-gray-400">Belum ada voucher digenerate.</td></tr>
              ) : vouchers.map((v) => (
                <tr key={v.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-bold text-blue-600">{v.code}</td>
                  <td className="px-4 py-3">{v.durasiMenit} Menit</td>
                  <td className="px-4 py-3">{v.profile?.name}</td>
                  <td className="px-4 py-3">{v.expiresAt ? new Date(v.expiresAt).toLocaleString() : '-'}</td>
                  <td className="px-4 py-3">{v.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderCivitas = () => {
    const toggleCivitas = async (id: string, currentVal: boolean) => {
      try {
        const res = await fetch("/api/admin/wifi/civitas", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId: id, isActive: !currentVal })
        });
        if (res.ok) fetchCivitas();
      } catch (err) {}
    };

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-6">Akun WiFi Civitas (User Siakad)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-semibold border-b">
              <tr>
                <th className="px-4 py-3">Pemilik Akun</th>
                <th className="px-4 py-3">Username WiFi</th>
                <th className="px-4 py-3">Password (Radius)</th>
                <th className="px-4 py-3">Profil Bandwidth</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {civitasAccounts.map((c) => (
                <tr key={c.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{c.user?.nama}</p>
                    <p className="text-xs text-gray-500">{c.user?.role}</p>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold">{c.username}</td>
                  <td className="px-4 py-3 font-mono text-gray-500 text-xs">{c.password}</td>
                  <td className="px-4 py-3">{c.profile?.name || "Civitas Default"}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleCivitas(c.id, c.isActive)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                    >
                      {c.isActive ? 'Aktif' : 'Diblokir'}
                    </button>
                  </td>
                </tr>
              ))}
              {civitasAccounts.length === 0 && (
                <tr><td colSpan={5} className="text-center py-4 text-gray-400">Belum ada civitas yang membuat akun WiFi.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">WiFi Management Center</h1>
          <p className="text-sm text-gray-500 mt-1">Kelola akses WiFi untuk Santri, Guru, dan Tamu (FreeRADIUS)</p>
        </div>
        
        <button
          onClick={handleSyncRadius}
          disabled={syncing}
          className="flex items-center gap-2 bg-[#1a2744] hover:bg-[#25365e] text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-all w-full md:w-auto justify-center shadow-lg disabled:opacity-50"
        >
          {syncing ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Syncing...
            </span>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Sync ke RADIUS Server
            </>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-4 border-b">
        {(["PROFIL", "SAKAN", "SANTRI", "VOUCHER", "CIVITAS"] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2.5 rounded-xl font-semibold text-sm whitespace-nowrap transition-all ${
              activeTab === tab ? 'bg-[#c8a45a] text-[#0c1220] shadow-sm' : 'bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900 border'
            }`}
          >
            {tab.charAt(0) + tab.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="animate-fade-in">
        {activeTab === "PROFIL" && renderProfiles()}
        {activeTab === "SAKAN" && renderSakan()}
        {activeTab === "SANTRI" && renderSantri()}
        {activeTab === "VOUCHER" && renderVoucher()}
        {activeTab === "CIVITAS" && renderCivitas()}
      </div>
    </div>
  );
}
