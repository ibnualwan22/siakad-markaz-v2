"use client";

import { useState, useEffect } from "react";
import { Clock, Save, Loader2, Edit3, XCircle, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

type JadwalSesi = { id: string; sesi: string; label: string; jamBuka: string; jamTutup: string; toleransiMenit: number; isActive: boolean; };
type SesiTambahan = { id: string; programId: string; sesi: string; jamBuka: string; jamTutup: string; toleransiMenit: number; isActive: boolean; program?: { nama_indo: string } };
type SesiTaqwim = { id: string; programId: string; jamBuka: string; jamTutup: string; toleransiMenit: number; isActive: boolean; program?: { nama_indo: string } };

export default function JadwalSesiPage() {
  const [activeTab, setActiveTab] = useState("GLOBAL");
  
  const [jadwalList, setJadwalList] = useState<JadwalSesi[]>([]);
  const [tambahanList, setTambahanList] = useState<SesiTambahan[]>([]);
  const [taqwimList, setTaqwimList] = useState<SesiTaqwim[]>([]);
  const [tanggalTaqwimList, setTanggalTaqwimList] = useState<any[]>([]);
  const [programList, setProgramList] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);

  // Edit states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingJadwal, setEditingJadwal] = useState<JadwalSesi | null>(null);

  const [isModalTambahanOpen, setIsModalTambahanOpen] = useState(false);
  const [editingTambahan, setEditingTambahan] = useState<Partial<SesiTambahan> | null>(null);

  const [isModalTaqwimOpen, setIsModalTaqwimOpen] = useState(false);
  const [editingTaqwim, setEditingTaqwim] = useState<Partial<SesiTaqwim> | null>(null);

  const [newTanggal, setNewTanggal] = useState("");

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [res1, res2, res3, resProg] = await Promise.all([
        fetch("/api/admin/jadwal-sesi"),
        fetch("/api/admin/sesi-tambahan"),
        fetch("/api/admin/sesi-taqwim"),
        fetch("/api/admin/program")
      ]);
      const data1 = await res1.json();
      const data2 = await res2.json();
      const data3 = await res3.json();
      const prog = await resProg.json();
      
      setJadwalList(data1);
      setTambahanList(data2);
      setTaqwimList(data3.taqwimList || []);
      setTanggalTaqwimList(data3.tanggalList || []);
      setProgramList(prog);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveGlobal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingJadwal) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/jadwal-sesi/${editingJadwal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingJadwal)
      });
      if (!res.ok) throw new Error("Gagal menyimpan");
      toast.success("Tersimpan!");
      setIsModalOpen(false);
      fetchData();
    } catch (e: any) { toast.error(e.message); } finally { setIsSubmitting(false); }
  };

  const handleSaveTambahan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTambahan?.programId || !editingTambahan.sesi || !editingTambahan.jamBuka || !editingTambahan.jamTutup) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/sesi-tambahan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingTambahan)
      });
      if (!res.ok) throw new Error("Gagal menyimpan");
      toast.success("Tersimpan!");
      setIsModalTambahanOpen(false);
      fetchData();
    } catch (e: any) { toast.error(e.message); } finally { setIsSubmitting(false); }
  };

  const handleDeleteTambahan = async (id: string) => {
    if (!confirm("Hapus sesi tambahan ini?")) return;
    try {
      await fetch(`/api/admin/sesi-tambahan?id=${id}`, { method: "DELETE" });
      toast.success("Terhapus");
      fetchData();
    } catch (e) { toast.error("Gagal menghapus"); }
  }

  const handleSaveTaqwim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTaqwim?.programId || !editingTaqwim.jamBuka || !editingTaqwim.jamTutup) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/sesi-taqwim", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingTaqwim)
      });
      if (!res.ok) throw new Error("Gagal menyimpan");
      toast.success("Tersimpan!");
      setIsModalTaqwimOpen(false);
      fetchData();
    } catch (e: any) { toast.error(e.message); } finally { setIsSubmitting(false); }
  };

  const handleDeleteTaqwim = async (id: string) => {
    if (!confirm("Hapus konfigurasi taqwim ini?")) return;
    try {
      await fetch(`/api/admin/sesi-taqwim?id=${id}`, { method: "DELETE" });
      toast.success("Terhapus");
      fetchData();
    } catch (e) { toast.error("Gagal menghapus"); }
  }

  const handleAddTanggal = async (programId: string) => {
    if (!newTanggal) return;
    try {
      await fetch("/api/admin/sesi-taqwim/tanggal", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programId, tanggal: newTanggal })
      });
      toast.success("Tanggal ditambahkan");
      setNewTanggal("");
      fetchData();
    } catch (e) { toast.error("Gagal menambah tanggal"); }
  };

  const handleDeleteTanggal = async (id: string) => {
    try {
      await fetch(`/api/admin/sesi-taqwim/tanggal?id=${id}`, { method: "DELETE" });
      toast.success("Tanggal dihapus");
      fetchData();
    } catch (e) { toast.error("Gagal menghapus tanggal"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)] flex items-center gap-2">
            <Clock className="h-6 w-6 text-[var(--color-primary)]" />
            Pengaturan Sesi Absensi
          </h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">
            Atur jam sesi global, sesi dinamis, dan jadwal khusus Taqwim.
          </p>
        </div>
      </div>

      <div className="flex space-x-2 border-b border-gray-200 overflow-x-auto">
        <button onClick={() => setActiveTab("GLOBAL")} className={`px-4 py-2 font-bold whitespace-nowrap ${activeTab === "GLOBAL" ? "border-b-2 border-emerald-500 text-emerald-600" : "text-gray-500"}`}>Sesi Global (1-6)</button>
        <button onClick={() => setActiveTab("TAMBAHAN")} className={`px-4 py-2 font-bold whitespace-nowrap ${activeTab === "TAMBAHAN" ? "border-b-2 border-emerald-500 text-emerald-600" : "text-gray-500"}`}>Sesi Tambahan (7-10)</button>
        <button onClick={() => setActiveTab("TAQWIM")} className={`px-4 py-2 font-bold whitespace-nowrap ${activeTab === "TAQWIM" ? "border-b-2 border-emerald-500 text-emerald-600" : "text-gray-500"}`}>Sesi Taqwim</button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
      ) : activeTab === "GLOBAL" ? (
        <div>
          {/* Desktop: tabel */}
          <div className="hidden md:block bg-white rounded-2xl shadow-sm border overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-4">Sesi</th><th className="px-6 py-4">Jam Buka</th><th className="px-6 py-4">Jam Tutup</th><th className="px-6 py-4">Toleransi</th><th className="px-6 py-4">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jadwalList.map((j) => (
                  <tr key={j.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-bold">{j.sesi}</td>
                    <td className="px-6 py-4">{j.jamBuka}</td>
                    <td className="px-6 py-4">{j.jamTutup}</td>
                    <td className="px-6 py-4">{j.toleransiMenit}m</td>
                    <td className="px-6 py-4"><button onClick={() => {setEditingJadwal(j); setIsModalOpen(true)}} className="text-blue-600"><Edit3 size={18} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile: kartu */}
          <div className="md:hidden space-y-3">
            {jadwalList.map((j) => (
              <div key={j.id} className="bg-white rounded-2xl shadow-sm border p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold">{j.sesi}</p>
                  <p className="text-sm text-gray-600">{j.jamBuka} - {j.jamTutup}</p>
                  <p className="text-xs text-gray-500">Toleransi {j.toleransiMenit} menit</p>
                </div>
                <button
                  onClick={() => {setEditingJadwal(j); setIsModalOpen(true)}}
                  className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-50 text-blue-700 font-bold text-sm"
                >
                  <Edit3 size={16} /> Edit
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === "TAMBAHAN" ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => {setEditingTambahan({ isActive: true, toleransiMenit: 15, jamBuka: '16:00', jamTutup: '17:30' }); setIsModalTambahanOpen(true)}} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold flex gap-2"><Plus size={18}/> Tambah Sesi Dinamis</button>
          </div>
          <div>
            {/* Desktop: tabel */}
            <div className="hidden md:block bg-white rounded-2xl shadow-sm border overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-4">Program</th><th className="px-6 py-4">Sesi</th><th className="px-6 py-4">Waktu</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tambahanList.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-bold text-indigo-600">{t.program?.nama_indo}</td>
                      <td className="px-6 py-4 font-bold">{t.sesi}</td>
                      <td className="px-6 py-4">{t.jamBuka} - {t.jamTutup} ({t.toleransiMenit}m)</td>
                      <td className="px-6 py-4">{t.isActive ? "Aktif" : "Nonaktif"}</td>
                      <td className="px-6 py-4 flex gap-2">
                        <button onClick={() => {setEditingTambahan(t); setIsModalTambahanOpen(true)}} className="text-blue-600"><Edit3 size={18} /></button>
                        <button onClick={() => handleDeleteTambahan(t.id)} className="text-red-600"><Trash2 size={18} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile: kartu */}
            <div className="md:hidden space-y-3">
              {tambahanList.map((t) => (
                <div key={t.id} className="bg-white rounded-2xl shadow-sm border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-indigo-600">{t.program?.nama_indo}</p>
                      <p className="font-bold text-sm mt-0.5">{t.sesi}</p>
                      <p className="text-sm text-gray-600">{t.jamBuka} - {t.jamTutup} ({t.toleransiMenit}m)</p>
                      <p className="text-xs mt-1">
                        <span className={`px-2 py-0.5 rounded-full font-bold ${t.isActive ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                          {t.isActive ? "Aktif" : "Nonaktif"}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => {setEditingTambahan(t); setIsModalTambahanOpen(true)}}
                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-50 text-blue-700 font-bold text-sm"
                    >
                      <Edit3 size={16} /> Edit
                    </button>
                    <button
                      onClick={() => handleDeleteTambahan(t.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-50 text-red-700 font-bold text-sm"
                    >
                      <Trash2 size={16} /> Hapus
                    </button>
                  </div>
                </div>
              ))}
              {tambahanList.length === 0 && (
                <p className="text-center text-sm text-gray-500 py-8">Belum ada sesi tambahan.</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => {setEditingTaqwim({ isActive: true, toleransiMenit: 15, jamBuka: '08:00', jamTutup: '09:30' }); setIsModalTaqwimOpen(true)}} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold flex gap-2"><Plus size={18}/> Tambah Konfigurasi Taqwim</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {taqwimList.map((t) => (
              <div key={t.id} className="bg-white rounded-2xl shadow-sm border p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg text-indigo-600">{t.program?.nama_indo}</h3>
                  <div className="flex gap-2">
                     <button onClick={() => {setEditingTaqwim(t); setIsModalTaqwimOpen(true)}} className="text-blue-600"><Edit3 size={16} /></button>
                     <button onClick={() => handleDeleteTaqwim(t.id)} className="text-red-600"><Trash2 size={16} /></button>
                  </div>
                </div>
                <p className="text-sm"><strong>Override Sesi 1:</strong> {t.jamBuka} - {t.jamTutup} (Dispensasi {t.toleransiMenit}m)</p>
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm font-bold mb-2">Tanggal Berlakunya Taqwim:</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                     {tanggalTaqwimList.filter(d => d.programId === t.programId).map(d => (
                       <span key={d.id} className="bg-gray-100 px-2 py-1 rounded text-xs flex items-center gap-1">
                         {new Date(d.tanggal).toISOString().split('T')[0]} 
                         <button onClick={() => handleDeleteTanggal(d.id)} className="text-red-500"><XCircle size={12}/></button>
                       </span>
                     ))}
                  </div>
                  <div className="flex gap-2">
                     <input type="date" value={newTanggal} onChange={e => setNewTanggal(e.target.value)} className="border px-2 py-1 text-sm rounded w-full" />
                     <button onClick={() => handleAddTanggal(t.programId)} className="bg-indigo-600 text-white px-3 py-1 rounded text-xs font-bold whitespace-nowrap">Tambah</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODALS */}
      {isModalOpen && editingJadwal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="font-bold text-lg">Edit {editingJadwal.sesi}</h2>
            <div><label className="text-xs font-bold">Jam Buka</label><input type="text" placeholder="15:30" maxLength={5} value={editingJadwal.jamBuka} onChange={e => {
              let val = e.target.value.replace(/[^0-9:]/g, '');
              if (val.length === 2 && !val.includes(':') && e.target.value.length > (editingJadwal.jamBuka || '').length) val += ':';
              setEditingJadwal({...editingJadwal, jamBuka: val})
            }} className="w-full border p-2 rounded" /></div>
            <div><label className="text-xs font-bold">Jam Tutup</label><input type="text" placeholder="15:30" maxLength={5} value={editingJadwal.jamTutup} onChange={e => {
              let val = e.target.value.replace(/[^0-9:]/g, '');
              if (val.length === 2 && !val.includes(':') && e.target.value.length > (editingJadwal.jamTutup || '').length) val += ':';
              setEditingJadwal({...editingJadwal, jamTutup: val})
            }} className="w-full border p-2 rounded" /></div>
            <div><label className="text-xs font-bold">Toleransi (m)</label><input type="number" value={editingJadwal.toleransiMenit} onChange={e => setEditingJadwal({...editingJadwal, toleransiMenit: +e.target.value})} className="w-full border p-2 rounded" /></div>
            <div className="flex justify-end gap-2 pt-2"><button onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded">Batal</button><button onClick={handleSaveGlobal} disabled={isSubmitting} className="px-4 py-2 bg-emerald-600 text-white rounded">Simpan</button></div>
          </div>
        </div>
      )}

      {isModalTambahanOpen && editingTambahan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="font-bold text-lg">{editingTambahan.id ? "Edit" : "Tambah"} Sesi Dinamis</h2>
            <div><label className="text-xs font-bold">Program</label>
              <select value={editingTambahan.programId || ""} onChange={e => setEditingTambahan({...editingTambahan, programId: e.target.value})} className="w-full border p-2 rounded">
                <option value="">-- Pilih Program --</option>
                {programList.map(p => <option key={p.id} value={p.id}>{p.nama_indo}</option>)}
              </select>
            </div>
            <div><label className="text-xs font-bold">Sesi</label>
              <select value={editingTambahan.sesi || ""} onChange={e => setEditingTambahan({...editingTambahan, sesi: e.target.value})} className="w-full border p-2 rounded">
                <option value="">-- Pilih Sesi --</option>
                <option value="SESI_7">Sesi 7</option>
                <option value="SESI_8">Sesi 8</option>
                <option value="SESI_9">Sesi 9</option>
                <option value="SESI_10">Sesi 10</option>
              </select>
            </div>
            <div><label className="text-xs font-bold">Jam Buka</label><input type="text" placeholder="15:30" maxLength={5} value={editingTambahan.jamBuka || ""} onChange={e => {
              let val = e.target.value.replace(/[^0-9:]/g, '');
              if (val.length === 2 && !val.includes(':') && e.target.value.length > (editingTambahan.jamBuka || "" || '').length) val += ':';
              setEditingTambahan({...editingTambahan, jamBuka: val})
            }} className="w-full border p-2 rounded" /></div>
            <div><label className="text-xs font-bold">Jam Tutup</label><input type="text" placeholder="15:30" maxLength={5} value={editingTambahan.jamTutup || ""} onChange={e => {
              let val = e.target.value.replace(/[^0-9:]/g, '');
              if (val.length === 2 && !val.includes(':') && e.target.value.length > (editingTambahan.jamTutup || "" || '').length) val += ':';
              setEditingTambahan({...editingTambahan, jamTutup: val})
            }} className="w-full border p-2 rounded" /></div>
            <div><label className="text-xs font-bold">Toleransi (m)</label><input type="number" value={editingTambahan.toleransiMenit || 15} onChange={e => setEditingTambahan({...editingTambahan, toleransiMenit: +e.target.value})} className="w-full border p-2 rounded" /></div>
            <div className="flex items-center gap-2 mt-2"><input type="checkbox" checked={editingTambahan.isActive} onChange={e => setEditingTambahan({...editingTambahan, isActive: e.target.checked})} /> Aktif</div>
            <div className="flex justify-end gap-2 pt-2"><button onClick={() => setIsModalTambahanOpen(false)} className="px-4 py-2 border rounded">Batal</button><button onClick={handleSaveTambahan} disabled={isSubmitting} className="px-4 py-2 bg-emerald-600 text-white rounded">Simpan</button></div>
          </div>
        </div>
      )}

      {isModalTaqwimOpen && editingTaqwim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="font-bold text-lg">{editingTaqwim.id ? "Edit" : "Tambah"} Konfigurasi Taqwim</h2>
            <div><label className="text-xs font-bold">Program</label>
              <select value={editingTaqwim.programId || ""} onChange={e => setEditingTaqwim({...editingTaqwim, programId: e.target.value})} className="w-full border p-2 rounded" disabled={!!editingTaqwim.id}>
                <option value="">-- Pilih Program --</option>
                {programList.map(p => <option key={p.id} value={p.id}>{p.nama_indo}</option>)}
              </select>
            </div>
            <div><label className="text-xs font-bold">Jam Buka Sesi Taqwim</label><input type="text" placeholder="15:30" maxLength={5} value={editingTaqwim.jamBuka || ""} onChange={e => {
              let val = e.target.value.replace(/[^0-9:]/g, '');
              if (val.length === 2 && !val.includes(':') && e.target.value.length > (editingTaqwim.jamBuka || "" || '').length) val += ':';
              setEditingTaqwim({...editingTaqwim, jamBuka: val})
            }} className="w-full border p-2 rounded" /></div>
            <div><label className="text-xs font-bold">Jam Tutup Sesi Taqwim</label><input type="text" placeholder="15:30" maxLength={5} value={editingTaqwim.jamTutup || ""} onChange={e => {
              let val = e.target.value.replace(/[^0-9:]/g, '');
              if (val.length === 2 && !val.includes(':') && e.target.value.length > (editingTaqwim.jamTutup || "" || '').length) val += ':';
              setEditingTaqwim({...editingTaqwim, jamTutup: val})
            }} className="w-full border p-2 rounded" /></div>
            <div><label className="text-xs font-bold">Toleransi (m)</label><input type="number" value={editingTaqwim.toleransiMenit || 15} onChange={e => setEditingTaqwim({...editingTaqwim, toleransiMenit: +e.target.value})} className="w-full border p-2 rounded" /></div>
            <div className="flex items-center gap-2 mt-2"><input type="checkbox" checked={editingTaqwim.isActive} onChange={e => setEditingTaqwim({...editingTaqwim, isActive: e.target.checked})} /> Aktif</div>
            <div className="flex justify-end gap-2 pt-2"><button onClick={() => setIsModalTaqwimOpen(false)} className="px-4 py-2 border rounded">Batal</button><button onClick={handleSaveTaqwim} disabled={isSubmitting} className="px-4 py-2 bg-emerald-600 text-white rounded">Simpan</button></div>
          </div>
        </div>
      )}

    </div>
  );
}
