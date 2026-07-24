"use client";

import { useState, useEffect } from "react";
import { Loader2, Search, CheckCircle, XCircle, FileText, Check, AlertTriangle, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import TasrihModal, { TasrihDetail } from "./tasrih-modal";

type Perizinan = {
  id: string;
  tipeIzin: string;
  alasan: string;
  tanggalMulai: string;
  tanggalSelesai: string | null;
  statusIzin: string;
  tanggalKembali: string | null;
  nomorTasrih: string;
  createdAt: string;
  riwayat: {
    santri: { nama: string };
    kelas: { nama: string } | null;
  };
  batasJam?: number;
  batasJamAkhir?: string;
  petugasNama?: string | null;
  grupTasrihId: string | null;
  _isRombongan?: boolean;
  selfieUrl?: string | null;
  selfieAt?: string | null;
};

export default function PerizinanDataClient({ permissions }: { permissions: string[] }) {
  const isAdmin = permissions.includes("*");
  const canEdit = isAdmin || permissions.includes("perizinan_data_edit");
  const canDelete = isAdmin;

  const [data, setData] = useState<Perizinan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTipe, setFilterTipe] = useState("HARIAN,TABIROT");
  const [filterStatus, setFilterStatus] = useState("AKTIF,MENUNGGU");

  const [selectedTasrih, setSelectedTasrih] = useState<TasrihDetail | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  // Tabs for Types
  const TABS = [
    { id: "HARIAN,TABIROT", label: "Harian / Ta'birot" },
    { id: "KELUAR_PARE", label: "Keluar Pare" },
    { id: "BERHARI_HARI", label: "Berhari-hari" },
  ];

  useEffect(() => {
    fetchData();
  }, [filterTipe, filterStatus]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const apiStatus = filterStatus === "KADALUARSA" ? "ALL" : filterStatus;
      const res = await fetch(`/api/admin/perizinan?tipe=${filterTipe}&status=${apiStatus}`);
      if (!res.ok) throw new Error("Gagal load data");
      const json = await res.json();
      // Mark rombongan: count how many records share the same grupTasrihId
      const grupCounts: Record<string, number> = {};
      json.forEach((d: Perizinan) => {
        if (d.grupTasrihId) grupCounts[d.grupTasrihId] = (grupCounts[d.grupTasrihId] || 0) + 1;
      });
      json.forEach((d: Perizinan) => {
        d._isRombongan = !!(d.grupTasrihId && grupCounts[d.grupTasrihId] > 1);
      });
      setData(json);
    } catch (error) {
      toast.error("Gagal memuat data perizinan");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (id: string, action: "APPROVE" | "REJECT" | "KONFIRMASI" | "DELETE", grupTasrihId: string | null) => {
    const isBatch = !!grupTasrihId;
    const batchMsg = isBatch ? " (Semua santri dalam batch akan terpengaruh)" : "";
    
    if (action === "DELETE" && !confirm(`Yakin ingin menghapus izin ini? Absensi yang sudah di-set akan di-rollback.${batchMsg}`)) return;
    if (action === "KONFIRMASI" && !confirm("Konfirmasi santri sudah kembali?")) return;
    if (action === "REJECT" && !confirm(`Tolak request izin ini?${batchMsg}`)) return;
    if (action === "APPROVE" && !confirm(`Setujui request izin ini?${batchMsg}`)) return;

    try {
      let res;
      if (action === "DELETE") {
        res = await fetch(`/api/admin/perizinan/${id}`, { method: "DELETE" });
      } else if (action === "KONFIRMASI") {
        res = await fetch(`/api/admin/perizinan/${id}/konfirmasi`, { method: "POST" });
      } else {
        const newStatus = action === "APPROVE" ? "AKTIF" : "DITOLAK";
        res = await fetch(`/api/admin/perizinan/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ statusIzin: newStatus })
        });
      }

      if (!res.ok) throw new Error("Gagal melakukan aksi");
      toast.success("Aksi berhasil");
      fetchData();
    } catch (error) {
      toast.error("Terjadi kesalahan");
    }
  };

  const handleRejectSelfie = async (id: string, grupTasrihId: string | null) => {
    const isBatch = !!grupTasrihId;
    const batchMsg = isBatch ? " (Perhatian: Ini izin rombongan, tapi fitur ini khusus satuan)" : "";
    
    if (!confirm(`Tolak verifikasi selfie? Santri akan dianggap belum hadir.${batchMsg}`)) return;
    
    try {
      const res = await fetch(`/api/admin/perizinan/${id}/reject-selfie`, { method: "POST" });
      if (!res.ok) throw new Error("Gagal menolak selfie");
      toast.success("Verifikasi ditolak, status kembali AKTIF (belum kembali)");
      fetchData();
    } catch (error) {
      toast.error("Terjadi kesalahan saat menolak selfie");
    }
  };

  const viewTasrih = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/perizinan/${id}`);
      if (!res.ok) throw new Error("Gagal load tasrih");
      const json = await res.json();
      setSelectedTasrih(json);
    } catch (error) {
      toast.error("Gagal memuat detail tasrih");
    }
  };

  const isOverdue = (d: Perizinan) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const end = d.tanggalSelesai ? new Date(d.tanggalSelesai) : new Date(d.tanggalMulai);
    if (d.statusIzin === "AKTIF" && end < today && (d.tipeIzin === "BERHARI_HARI" || d.tipeIzin === "KELUAR_PARE")) return true;
    return false;
  };
  
  const isKadaluarsa = (d: Perizinan) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const m = new Date(d.tanggalMulai);
    m.setHours(0,0,0,0);
    if ((d.tipeIzin === "HARIAN" || d.tipeIzin === "TABIROT") && (d.statusIzin === "AKTIF" || d.statusIzin === "MENUNGGU") && m < today) return true;
    return false;
  };

  const filteredData = data.filter(d => {
    if (search && !d.riwayat.santri.nama.toLowerCase().includes(search.toLowerCase())) return false;
    
    // Jika user pilih KADALUARSA, hanya tampilkan yang KADALUARSA
    if (filterStatus === "KADALUARSA" && !isKadaluarsa(d)) return false;
    
    // Jangan tampilkan KADALUARSA di tab "AKTIF" atau "MENUNGGU" agar tidak campur
    if ((filterStatus.includes("AKTIF") || filterStatus.includes("MENUNGGU")) && isKadaluarsa(d)) return false;

    return true;
  }).sort((a, b) => {
    // Overdue first
    const aOverdue = isOverdue(a);
    const bOverdue = isOverdue(b);
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    // Then default by createdAt desc
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const getStatusBadge = (status: string, d: Perizinan) => {
    if (status === "MENUNGGU") return <span className="px-2 py-1 text-xs font-bold rounded-lg bg-yellow-100 text-yellow-800 border border-yellow-200">⏳ Menunggu</span>;
    if (status === "DITOLAK") return <span className="px-2 py-1 text-xs font-bold rounded-lg bg-red-100 text-red-800 border border-red-200">❌ Ditolak</span>;
    if (status === "SUDAH_KEMBALI") return <span className="px-2 py-1 text-xs font-bold rounded-lg bg-green-100 text-green-800 border border-green-200">🟢 Sudah Kembali</span>;
    if (status === "SELESAI") return <span className="px-2 py-1 text-xs font-bold rounded-lg bg-slate-100 text-slate-800 border border-slate-200">🏁 Selesai</span>;
    
    // AKTIF
    if (isOverdue(d)) {
      return <span className="px-2 py-1 text-xs font-bold rounded-lg bg-red-100 text-red-700 border border-red-200 flex items-center gap-1 w-fit"><AlertTriangle size={12}/> Belum Kembali (Lewat Batas)</span>;
    }
    if (isKadaluarsa(d)) {
      return <span className="px-2 py-1 text-xs font-bold rounded-lg bg-red-100 text-red-800 border border-red-200 flex items-center gap-1 w-fit"><XCircle size={12}/> Kadaluarsa</span>;
    }
    
    return <span className="px-2 py-1 text-xs font-bold rounded-lg bg-blue-100 text-blue-800 border border-blue-200 w-fit inline-block">🔵 Aktif</span>;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[var(--color-surface-dark)] p-6">
      
      {/* TABS */}
      <div className="flex overflow-x-auto gap-2 mb-6 hide-scrollbar pb-2">
        {TABS.map(tab => (
          <button 
            key={tab.id}
            onClick={() => setFilterTipe(tab.id)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors whitespace-nowrap ${
              filterTipe === tab.id 
                ? "bg-[var(--color-primary)] text-white" 
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
        <div className="flex gap-2 w-full md:w-auto">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none w-full md:w-auto">
            <option value="ALL">Semua Status</option>
            <option value="AKTIF,MENUNGGU">Aktif & Menunggu</option>
            <option value="MENUNGGU">Menunggu Saja</option>
            <option value="AKTIF">Aktif Saja</option>
            <option value="KADALUARSA">Kadaluarsa</option>
            <option value="SUDAH_KEMBALI">Sudah Kembali</option>
            <option value="SELESAI">Selesai</option>
            <option value="DITOLAK">Ditolak</option>
          </select>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--color-text-subtle)]" />
          <input type="text" placeholder="Cari santri..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-[var(--color-surface-dark)] rounded-xl text-sm" />
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 text-[var(--color-text-muted)] uppercase text-[10px] font-black tracking-wider">
            <tr>
              <th className="px-4 py-3 w-12 text-center">No</th>
              <th className="px-4 py-3">Nama Santri</th>
              <th className="px-4 py-3">Tipe & Tanggal</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Foto Kehadiran</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[var(--color-primary)]" /></td></tr>
            ) : filteredData.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[var(--color-text-muted)]">Tidak ada data</td></tr>
            ) : (
              filteredData.map((d, index) => (
                <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-bold text-center text-slate-500 w-12">{index + 1}</td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-[var(--color-text)] flex items-center gap-2">
                      {d.riwayat.santri.nama}
                      {d._isRombongan && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] uppercase font-bold border border-purple-200">Rombongan</span>}
                    </div>
                    <div className="text-xs text-[var(--color-text-subtle)]">{d.riwayat.kelas?.nama || "Tanpa Kelas"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-[var(--color-text)] text-xs">
                      {d.tipeIzin === "HARIAN" ? "Harian" : d.tipeIzin === "BERHARI_HARI" ? "Berhari-hari" : d.tipeIzin === "TABIROT" ? "Ta'birot" : "Keluar Pare"}
                    </div>
                    <div className="text-xs text-[var(--color-text-subtle)]">
                      {new Date(d.tanggalMulai).toLocaleDateString("id-ID")}
                      {d.tanggalSelesai && ` - ${new Date(d.tanggalSelesai).toLocaleDateString("id-ID")}`}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(d.statusIzin, d)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {d.selfieUrl ? (
                      <div className="flex flex-col items-center">
                        <img 
                          src={d.selfieUrl} 
                          alt="Selfie" 
                          className="w-12 h-12 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity border border-slate-200 shadow-sm"
                          onClick={() => setPreviewPhoto(d.selfieUrl!)}
                        />
                        {d.selfieAt && (
                          <span className="text-[10px] text-slate-500 mt-1 font-bold">
                            {new Date(d.selfieAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400 font-bold">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => viewTasrih(d.id)} className="p-1.5 text-blue-600 bg-blue-50 rounded hover:bg-blue-100 flex items-center gap-1 text-xs font-bold" title="Detail Tasrih">
                        <FileText size={16} /> Detail
                      </button>
                      
                      {canEdit && d.statusIzin === "MENUNGGU" && (
                        <>
                          <button onClick={() => handleAction(d.id, "APPROVE", d.grupTasrihId)} className="p-1.5 px-2 text-green-700 bg-green-100 rounded hover:bg-green-200 flex items-center gap-1 text-xs font-bold" title="Setujui">
                            <CheckCircle size={14} /> Setujui
                          </button>
                          <button onClick={() => handleAction(d.id, "REJECT", d.grupTasrihId)} className="p-1.5 px-2 text-red-700 bg-red-100 rounded hover:bg-red-200 flex items-center gap-1 text-xs font-bold" title="Tolak">
                            <XCircle size={14} /> Tolak
                          </button>
                        </>
                      )}
                      
                      {canEdit && d.statusIzin === "AKTIF" && (d.tipeIzin === "BERHARI_HARI" || d.tipeIzin === "KELUAR_PARE") && (
                        <button onClick={() => handleAction(d.id, "KONFIRMASI", d.grupTasrihId)} className="p-1.5 px-2 text-emerald-700 bg-emerald-100 rounded hover:bg-emerald-200 flex items-center gap-1 text-xs font-bold" title="Konfirmasi Kehadiran (Kembali)">
                          <Check size={14} /> Konfirmasi Kehadiran
                        </button>
                      )}

                      {canEdit && d.statusIzin === "SUDAH_KEMBALI" && d.selfieUrl && (
                        <button onClick={() => handleRejectSelfie(d.id, d.grupTasrihId)} className="p-1.5 px-2 text-rose-700 bg-rose-100 rounded hover:bg-rose-200 flex items-center gap-1 text-xs font-bold" title="Tolak Selfie Kehadiran">
                          <XCircle size={14} /> Tolak Foto
                        </button>
                      )}

                      {canDelete && (
                        <button onClick={() => handleAction(d.id, "DELETE", d.grupTasrihId)} className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded text-xs font-bold" title="Hapus Izin">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* TASRIH MODAL */}
      {selectedTasrih && (
        <TasrihModal tasrih={selectedTasrih} onClose={() => setSelectedTasrih(null)} />
      )}

      {/* PHOTO PREVIEW MODAL */}
      {previewPhoto && (
        <div 
          className="fixed inset-0 z-[150] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setPreviewPhoto(null)}
              className="absolute -top-10 right-0 p-1.5 bg-white/20 hover:bg-white/30 rounded-full text-white backdrop-blur-md transition-colors"
            >
              <XCircle size={24} />
            </button>
            <img src={previewPhoto} alt="Selfie Full" className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl" />
          </div>
        </div>
      )}
    </div>
  );
}
