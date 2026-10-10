"use client";

import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, CheckCircle2, XCircle } from "lucide-react";
import toast from "react-hot-toast";

export default function SesiTauziPage() {
  const [sesiList, setSesiList] = useState<any[]>([]);
  const [dufahList, setDufahList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ nama: "", dufahNama: "", isActive: false, copySoalDariSesiId: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [sesiRes, dufahRes] = await Promise.all([
        fetch("/api/admin/tauzi/sesi"),
        fetch("/api/admin/dufah")
      ]);
      if (sesiRes.ok) setSesiList(await sesiRes.json());
      if (dufahRes.ok) setDufahList(await dufahRes.json());
    } catch {
      toast.error("Gagal mengambil data");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const method = editingId ? "PUT" : "POST";
      const url = editingId ? `/api/admin/tauzi/sesi/${editingId}` : "/api/admin/tauzi/sesi";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      if (!res.ok) throw new Error((await res.json()).error);
      
      const saved = await res.json();
      if (!editingId && saved.soalDisalin > 0) {
        toast.success(`Sesi berhasil disimpan, ${saved.soalDisalin} soal disalin`);
      } else {
        toast.success("Sesi berhasil disimpan");
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, nama: string) => {
    if (!confirm(`Hapus sesi ${nama}? Data soal dan hasil akan terhapus juga!`)) return;
    try {
      const res = await fetch(`/api/admin/tauzi/sesi/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Sesi dihapus");
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const openForm = (sesi?: any) => {
    if (sesi) {
      setEditingId(sesi.id);
      setFormData({ nama: sesi.nama, dufahNama: sesi.dufahNama, isActive: sesi.isActive, copySoalDariSesiId: "" });
    } else {
      setEditingId(null);
      // Default: salin soal dari sesi terbaru
      const latest = sesiList.length > 0 ? sesiList[0].id : "";
      setFormData({ nama: "", dufahNama: "", isActive: false, copySoalDariSesiId: latest });
    }
    setIsModalOpen(true);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display" style={{ color: "var(--color-text)" }}>Sesi Tauzi'</h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-subtle)" }}>Kelola sesi ujian tes tulis (tauzi').</p>
        </div>
        <button onClick={() => openForm()} className="neu-button-primary px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-sm">
          <Plus size={16} /> Tambah Sesi
        </button>
      </div>

      <div className="neu-card rounded-2xl p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase" style={{ background: "var(--color-surface-hover)", color: "var(--color-text-subtle)" }}>
              <tr>
                <th className="px-6 py-4 font-bold rounded-tl-2xl">Nama Sesi</th>
                <th className="px-6 py-4 font-bold">Duf'ah</th>
                <th className="px-6 py-4 font-bold text-center">Status</th>
                <th className="px-6 py-4 font-bold text-right rounded-tr-2xl">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {sesiList.map((sesi) => (
                <tr key={sesi.id} className="border-b last:border-0" style={{ borderColor: "var(--color-surface-hover)" }}>
                  <td className="px-6 py-4 font-semibold" style={{ color: "var(--color-text)" }}>{sesi.nama}</td>
                  <td className="px-6 py-4" style={{ color: "var(--color-text-muted)" }}>{sesi.dufahNama}</td>
                  <td className="px-6 py-4 text-center">
                    {sesi.isActive ? 
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold" style={{ background: "var(--color-success-light)", color: "var(--color-success)" }}>
                        <CheckCircle2 size={12} /> Aktif
                      </span>
                      :
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold" style={{ background: "var(--color-surface-hover)", color: "var(--color-text-subtle)" }}>
                        <XCircle size={12} /> Nonaktif
                      </span>
                    }
                  </td>
                  <td className="px-6 py-4 flex gap-2 justify-end">
                    <button onClick={() => openForm(sesi)} className="p-2 rounded-lg transition-colors hover:bg-gray-100" style={{ color: "var(--color-primary)" }}><Edit2 size={16}/></button>
                    <button onClick={() => handleDelete(sesi.id, sesi.nama)} className="p-2 rounded-lg transition-colors hover:bg-red-50" style={{ color: "var(--color-danger)" }}><Trash2 size={16}/></button>
                  </td>
                </tr>
              ))}
              {sesiList.length === 0 && (
                <tr><td colSpan={4} className="px-6 py-8 text-center" style={{ color: "var(--color-text-subtle)" }}>Belum ada data sesi.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="neu-card rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4 font-display" style={{ color: "var(--color-text)" }}>
              {editingId ? "Edit Sesi" : "Tambah Sesi"}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--color-text-muted)" }}>Nama Sesi</label>
                <input required autoFocus type="text" value={formData.nama} onChange={e => setFormData({ ...formData, nama: e.target.value })} className="neu-input w-full p-3 text-sm" placeholder="Contoh: Tauzi' Duf'ah 28" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--color-text-muted)" }}>Duf'ah Target</label>
                <select required value={formData.dufahNama} onChange={e => setFormData({ ...formData, dufahNama: e.target.value })} className="neu-input w-full p-3 text-sm">
                  <option value="">-- Pilih Duf'ah --</option>
                  {dufahList.map(d => <option key={d.nama} value={d.nama}>{d.nama}</option>)}
                </select>
              </div>
              {!editingId && sesiList.length > 0 && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--color-text-muted)" }}>Salin Soal Dari Sesi</label>
                  <select value={formData.copySoalDariSesiId} onChange={e => setFormData({ ...formData, copySoalDariSesiId: e.target.value })} className="neu-input w-full p-3 text-sm">
                    <option value="">-- Jangan salin soal --</option>
                    {sesiList.map(s => <option key={s.id} value={s.id}>{s.nama} ({s.dufahNama})</option>)}
                  </select>
                  <p className="text-[11px] mt-1.5" style={{ color: "var(--color-text-subtle)" }}>
                    Soal beserta pilihan jawabannya akan disalin otomatis ke sesi baru.
                  </p>
                </div>
              )}
              <label className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer" style={{ borderColor: "var(--color-surface-hover)" }}>
                <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} className="rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)]" />
                <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Sesi Aktif</span>
              </label>
              <div className="flex gap-3 justify-end pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2.5 rounded-xl font-bold text-sm bg-gray-100 text-gray-700">Batal</button>
                <button type="submit" disabled={submitting} className="neu-button-primary px-5 py-2.5 rounded-xl font-bold text-sm">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
