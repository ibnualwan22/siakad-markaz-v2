"use client";

import { useState, useEffect } from "react";
import { Monitor, RefreshCw, ShieldAlert, CheckCircle2, LayoutTemplate, ClockAlert, Info, Timer, Play, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";

export default function MonitoringPengejaanPage() {
  const [paketList, setPaketList] = useState<any[]>([]);
  const [selectedPaket, setSelectedPaket] = useState("");
  const [monitoringData, setMonitoringData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [mounted, setMounted] = useState(false);
  const [filterKelas, setFilterKelas] = useState("SEMUA");
  const [sisaGlobalStr, setSisaGlobalStr] = useState<string>("");

  useEffect(() => {
    setMounted(true);
    fetchActivePakets();
  }, []);

  useEffect(() => {
    if (selectedPaket) {
      fetchMonitoringData(selectedPaket);
      const intv = setInterval(() => fetchMonitoringData(selectedPaket, false), 15000); // 15s refresh
      return () => clearInterval(intv);
    } else {
      setMonitoringData([]);
    }
  }, [selectedPaket]);

  const fetchActivePakets = async () => {
    try {
      const res = await fetch("/api/admin/ujian-usbu/sesi");
      const data = await res.json();
      setPaketList(data || []);
      // Auto select first active
      const active = data.find((p: any) => p.isActive);
      if (active) setSelectedPaket(active.id);
      else if (data.length > 0) setSelectedPaket(data[0].id);
    } catch {
      toast.error("Gagal memuat daftar ujian");
    }
  };

  const fetchMonitoringData = async (paketId: string, showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch(`/api/admin/ujian-usbu/monitoring?sesiGlobalId=${paketId}`);
      if (res.ok) {
        const data = await res.json();
        setMonitoringData(data);
        setLastUpdate(new Date());

        if (data.length > 0) {
          const unique = Array.from(new Set(data.map((d: any) => d.kelasNama))).sort() as string[];
          setFilterKelas(prev => (prev === "SEMUA" && unique.length > 0) ? unique[0] : prev);
        }
      }
    } catch {
      if (showLoading) toast.error("Gagal load data monitoring");
    } finally {
      setLoading(false);
    }
  };

  const handleForceSubmit = async (sesiId: string) => {
    if (!confirm("Paksa kumpulkan ujian santri ini sekarang? Santri tidak akan bisa melanjutkan ujian.")) return;
    try {
      const res = await fetch("/api/admin/ujian-usbu/monitoring/paksa-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sesiId })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Ujian berhasil dipaksa submit!");
      fetchMonitoringData(selectedPaket);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAction = async (sesiId: string, action: "RETRY" | "RESUME") => {
    const msg = action === "RETRY" 
      ? "Reset ujian santri ini? Santri harus mengulang dari awal." 
      : "Lanjutkan ujian santri ini? Sisa waktu akan dilanjutkan.";
    if (!confirm(msg)) return;
    
    try {
      const res = await fetch("/api/admin/ujian-usbu/monitoring/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sesiId, action })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(action === "RETRY" ? "Ujian di-reset!" : "Ujian dilanjutkan!");
      fetchMonitoringData(selectedPaket);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const currentPaket = paketList.find(p => p.id === selectedPaket);

  const uniqueClasses = Array.from(new Set(monitoringData.map((d: any) => d.kelasNama))).sort();
  const displayedData = filterKelas === "SEMUA" ? monitoringData : monitoringData.filter((d: any) => d.kelasNama === filterKelas);

  useEffect(() => {
    if (!currentPaket?.waktuSelesai) {
      setSisaGlobalStr("");
      return;
    }
    const updateCountdown = () => {
      const end = new Date(currentPaket.waktuSelesai).getTime();
      const diff = Math.max(0, Math.floor((end - Date.now()) / 1000));
      if (diff === 0) setSisaGlobalStr("Waktu Habis");
      else {
        const h = Math.floor(diff / 3600);
        const m = Math.floor((diff % 3600) / 60);
        const s = diff % 60;
        setSisaGlobalStr(`Sisa: ${h > 0 ? h + 'j ' : ''}${m}m ${s.toString().padStart(2, '0')}s`);
      }
    };
    updateCountdown();
    const intv = setInterval(updateCountdown, 1000);
    return () => clearInterval(intv);
  }, [currentPaket]);

  const formatDurasi = (mulai: string, selesai: string | null, status: string) => {
    const start = new Date(mulai).getTime();
    const end = (selesai && status !== 'MENGERJAKAN') ? new Date(selesai).getTime() : Date.now();
    const diffSec = Math.max(0, Math.floor((end - start) / 1000));
    const m = Math.floor(diffSec / 60);
    const s = diffSec % 60;
    return `${m}m ${s.toString().padStart(2, '0')}s`;
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display" style={{ color: "var(--color-text)" }}>Live Monitoring Ujian</h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-subtle)" }}>Pantau aktivitas pengerjaan ujian santri secara real-time</p>
        </div>
      </div>

      <div className="neu-card rounded-2xl p-4 mb-6 relative overflow-hidden bg-white shadow-sm">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-primary)] opacity-5 rounded-bl-full pointer-events-none"></div>
        
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="flex-1 w-full relative z-10">
            <label className="block text-[11px] font-bold uppercase tracking-wider mb-2 text-gray-500">Pilih Paket Ujian</label>
            <select value={selectedPaket} onChange={e => setSelectedPaket(e.target.value)} className="neu-input w-full p-2.5 text-sm font-semibold bg-gray-50">
              <option value="">-- Pilih Paket --</option>
              {paketList.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nama} {p.isActive ? "(AKTIF)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 w-full relative z-10">
            <label className="block text-[11px] font-bold uppercase tracking-wider mb-2 text-gray-500">Filter Kelas</label>
            <div className="flex items-center gap-3">
              <select value={filterKelas} onChange={e => setFilterKelas(e.target.value)} className="neu-input flex-1 p-2.5 text-sm font-semibold bg-gray-50" disabled={!selectedPaket || monitoringData.length === 0}>
                {uniqueClasses.map((cls: any) => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
                <option value="SEMUA">Semua Kelas</option>
              </select>
              {sisaGlobalStr && (
                <div className="shrink-0 px-3 py-2.5 bg-orange-50 text-orange-600 border border-orange-100 rounded-xl font-bold text-sm tracking-wide shadow-sm flex items-center gap-1.5">
                  <Timer size={16}/>
                  {sisaGlobalStr}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col md:items-end w-full md:w-auto mt-2 md:mt-0 relative z-10">
            <button 
              onClick={() => fetchMonitoringData(selectedPaket)} 
              disabled={!selectedPaket || loading}
              className="flex items-center gap-2 bg-blue-50 text-blue-600 hover:bg-blue-100 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh Data
            </button>
            <div className="text-[10px] text-gray-400 font-medium mt-2">
              Update terakhir: {mounted && lastUpdate.toLocaleTimeString()} (auto-refresh 15s)
            </div>
          </div>
        </div>
      </div>

      {!selectedPaket ? (
        <div className="neu-card border-dashed p-12 text-center rounded-2xl bg-white shadow-sm">
          <LayoutTemplate size={32} className="text-gray-300 mx-auto mb-4"/>
          <h3 className="font-bold text-lg text-gray-700">Pilih Paket Ujian</h3>
          <p className="text-sm text-gray-500 mt-2">Pilih paket ujian dari dropdown di atas untuk melihat live monitoring</p>
        </div>
      ) : monitoringData.length === 0 ? (
        <div className="neu-card border-dashed p-12 text-center rounded-2xl bg-white shadow-sm">
          <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
            <Info size={28} className="text-blue-400"/>
          </div>
          <h3 className="font-bold text-lg text-gray-700">Belum Ada Sesi</h3>
          <p className="text-sm text-gray-500 mt-2">Belum ada santri yang login dan mengerjakan paket ujian ini.</p>
          {currentPaket && !currentPaket.isActive && (
             <div className="mt-4 px-4 py-2 bg-yellow-50 text-yellow-700 text-xs font-bold rounded-lg inline-block border border-yellow-100">
               Status ujian saat ini: DITUTUP
             </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50/80 border-b text-gray-500 uppercase tracking-wider text-[11px] font-bold">
                  <th className="px-6 py-4">No</th>
                  <th className="px-6 py-4">Nama Santri</th>
                  <th className="px-6 py-4">Kelas</th>
                  <th className="px-6 py-4">Status & Waktu</th>
                  <th className="px-6 py-4">Progress Pengerjaan</th>
                  <th className="px-6 py-4">Durasi</th>
                  <th className="px-6 py-4 text-center">Deteksi Cheat Tab</th>
                  <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {displayedData.map((d: any, i: number) => (
                  <tr key={d.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-6 py-4 font-medium text-gray-500">{i + 1}</td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-800">{d.namaSantri}</div>
                      <div className="text-[10px] text-gray-400 font-medium mt-0.5">{d.lokasi}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded w-fit">{d.kelasNama}</div>
                    </td>
                    <td className="px-6 py-4">
                      {d.status === "BELUM_MULAI" && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-gray-100 text-gray-500 w-fit">⌛ Belum Mulai</span>}
                      {d.status === "MENGERJAKAN" && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-blue-100 text-blue-700 w-fit"><RefreshCw size={12} className="animate-spin"/> Mengerjakan</span>}
                      {d.status === "SELESAI" && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-green-100 text-green-700 w-fit"><CheckCircle2 size={12}/> Selesai / Dikumpulkan</span>}
                      {d.status === "AUTO_SUBMIT" && d.tabCloseCount > 0 && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-100 text-rose-700 w-fit"><ShieldAlert size={12}/> Tersita: Pelanggaran</span>}
                      {d.status === "AUTO_SUBMIT" && d.tabCloseCount === 0 && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-orange-100 text-orange-700 w-fit"><ClockAlert size={12}/> Waktu Habis</span>}
                      {d.waktuMulai && (
                        <div className="text-[10px] text-gray-400 mt-1 font-medium flex items-center gap-1">
                          <ClockAlert size={10}/> Mulai: {new Date(d.waktuMulai).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {d.status !== "BELUM_MULAI" ? (
                        <div className="flex flex-col gap-1 w-56">
                          <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden flex">
                            <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${(d.dijawab / d.totalSoal) * 100}%` }}></div>
                            <div className="h-full bg-orange-400 transition-all duration-500" style={{ width: `${(d.ragu / d.totalSoal) * 100}%` }}></div>
                          </div>
                          <div className="flex items-center justify-between text-[10px] font-bold">
                            <span className="text-green-600">{d.dijawab} Terjawab</span>
                            <span className="text-orange-500">{d.ragu} Ragu</span>
                            <span className="text-gray-400">{d.belum} Belum</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {d.status !== "BELUM_MULAI" ? (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                          <Timer size={14} className="text-blue-500"/>
                          {mounted && formatDurasi(d.waktuMulai, d.waktuSelesai, d.status)}
                        </div>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {d.tabCloseCount > 0 ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-600 border border-rose-100" title="Terdeteksi keluar dari layar fullscreen ujian">
                          <ShieldAlert size={12}/> {d.tabCloseCount}x Pelanggaran
                        </div>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {d.status === "BELUM_MULAI" ? (
                        <span className="text-gray-300">-</span>
                      ) : d.status === "MENGERJAKAN" ? (
                        <button 
                          onClick={() => handleForceSubmit(d.id)}
                          className="px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 rounded-lg text-xs font-bold transition-colors"
                        >
                          Paksa Submit
                        </button>
                      ) : d.status === "AUTO_SUBMIT" && d.tabCloseCount > 0 ? (
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => handleAction(d.id, "RETRY")}
                            className="p-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200 rounded-lg transition-colors" title="Ulangi Ujian (Reset)"
                          >
                            <RotateCcw size={16}/>
                          </button>
                          <button 
                            onClick={() => handleAction(d.id, "RESUME")}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors"
                          >
                            <Play size={14}/> Lanjutkan
                          </button>
                        </div>
                      ) : (
                        <div className="font-bold text-[15px]" style={{ color: d.nilaiTotal < 60 ? 'var(--color-danger)' : 'var(--color-primary)' }}>
                          Nilai rata2: {d.nilaiTotal}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
