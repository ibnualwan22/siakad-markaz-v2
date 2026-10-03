"use client";

import { useState, useEffect } from "react";
import { Images, Plus, Pencil, Trash2, Loader2, ExternalLink, X } from "lucide-react";
import toast from "react-hot-toast";

type Arsip = {
  id: string;
  judul: string;
  driveUrl: string;
  dufahNama: string;
  createdAt: string;
};

export default function ArsipGaleriPage() {
  const [dufahList, setDufahList] = useState<any[]>([]);
  const [activeDufah, setActiveDufah] = useState("");
  const [arsipList, setArsipList] = useState<Arsip[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Arsip | null>(null);
  const [judul, setJudul] = useState("");
  const [driveUrl, setDriveUrl] = useState("");
  const [formDufah, setFormDufah] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { fetchInit(); }, []);
  useEffect(() => { if (activeDufah) fetchArsip(activeDufah); }, [activeDufah]);

  const fetchInit = async () => {
    try {
      const [dufahRes, ctxRes] = await Promise.all([
        fetch("/api/admin/dufah"),
        fetch("/api/admin/active-context"),
      ]);
      const dufahData = await dufahRes.json();
      const ctxData = await ctxRes.json();
      setDufahList(Array.isArray(dufahData) ? dufahData : []);
      setActiveDufah(ctxData.activeDufah || (Array.isArray(dufahData) && dufahData[0]?.nama) || "");
    } catch {
      toast.error("Gagal memuat data dufah");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchArsip = async (dufahNama: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/arsip-galeri?dufahNama=${encodeURIComponent(dufahNama)}`);
      const data = await res.json();
      setArsipList(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Gagal memuat arsip galeri");
    } finally {
      setIsLoading(false);
    }
  };

  const openTambah = () => {
    setEditing(null);
    setJudul("");
    setDriveUrl("");
    setFormDufah(activeDufah);
    setShowModal(true);
  };

  const openEdit = (a: Arsip) => {
    setEditing(a);
    setJudul(a.judul);
    setDriveUrl(a.driveUrl);
    setFormDufah(a.dufahNama);
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!judul.trim()) return toast.error("Judul wajib diisi");
    if (!driveUrl.trim()) return toast.error("Link Google Drive wajib diisi");
    if (!driveUrl.includes("drive.google.com")) return toast.error("Link harus berupa link Google Drive (drive.google.com)");
    if (!formDufah) return toast.error("Dufah wajib dipilih");
    setIsSaving(true);
    try {
      const url = editing ? `/api/admin/arsip-galeri/${editing.id}` : "/api/admin/arsip-galeri";
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ judul: judul.trim(), driveUrl: driveUrl.trim(), dufahNama: formDufah }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      toast.success(editing ? "Arsip diperbarui" : "Arsip ditambahkan");
      setShowModal(false);
      fetchArsip(activeDufah);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (a: Arsip) => {
    if (!confirm(`Hapus arsip "${a.judul}"?`)) return;
    try {
      const res = await fetch(`/api/admin/arsip-galeri/${a.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal menghapus");
      toast.success("Arsip dihapus");
      fetchArsip(activeDufah);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <Images className="w-6 h-6" /> Arsip Galeri
        </h1>
        <button
          onClick={openTambah}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Tambah
        </button>
      </div>

      <div className="mb-4">
        <label className="text-sm text-gray-600 block mb-1">Filter Dufah</label>
        <select
          value={activeDufah}
          onChange={(e) => setActiveDufah(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm w-full md:w-72"
        >
          {dufahList.map((d: any) => (
            <option key={d.nama} value={d.nama}>{d.nama}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
      ) : arsipList.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Images className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>Belum ada arsip galeri untuk dufah ini.</p>
          <p className="text-sm">Klik tombol Tambah untuk membuat arsip baru.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {arsipList.map((a) => (
            <div key={a.id} className="border rounded-xl p-4 flex items-center justify-between gap-3 bg-white shadow-sm">
              <div className="min-w-0">
                <p className="font-semibold truncate">{a.judul}</p>
                <p className="text-xs text-gray-500 truncate">{a.dufahNama} • {new Date(a.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</p>
                <a href={a.driveUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 mt-1">
                  Buka di Google Drive <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => openEdit(a)} className="p-2 rounded-lg hover:bg-gray-100" title="Ubah">
                  <Pencil className="w-4 h-4 text-blue-600" />
                </button>
                <button onClick={() => handleDelete(a)} className="p-2 rounded-lg hover:bg-gray-100" title="Hapus">
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">{editing ? "Ubah Arsip" : "Tambah Arsip Baru"}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <label className="text-sm text-gray-600 block mb-1">Judul</label>
            <input
              value={judul}
              onChange={(e) => setJudul(e.target.value)}
              placeholder="cth: Dokumentasi Haflah Wada 1447 H"
              className="border rounded-lg px-3 py-2 text-sm w-full mb-3"
            />
            <label className="text-sm text-gray-600 block mb-1">Link Google Drive</label>
            <input
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
              placeholder="https://drive.google.com/..."
              className="border rounded-lg px-3 py-2 text-sm w-full mb-3"
            />
            <label className="text-sm text-gray-600 block mb-1">Dufah</label>
            <select
              value={formDufah}
              onChange={(e) => setFormDufah(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm w-full mb-4"
            >
              {dufahList.map((d: any) => (
                <option key={d.nama} value={d.nama}>{d.nama}</option>
              ))}
            </select>
            <button
              onClick={handleSubmit}
              disabled={isSaving}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? "Simpan Perubahan" : "Tambah Arsip"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
