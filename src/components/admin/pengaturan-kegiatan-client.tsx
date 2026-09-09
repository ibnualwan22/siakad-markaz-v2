"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { Plus, Trash2, Pencil, Check, X, ToggleLeft, ToggleRight, MapPin, Crosshair } from "lucide-react";

type Kegiatan = {
  id: string;
  nama: string;
  aktif: boolean;
};

type Lokasi = {
  id: string;
  nama: string;
  latitude: number;
  longitude: number;
  radius: number;
  aktif: boolean;
};

export function PengaturanKegiatanClient({ initialList, initialLokasi }: { initialList: Kegiatan[], initialLokasi: Lokasi[] }) {
  // ----- Kegiatan State -----
  const [list, setList] = useState<Kegiatan[]>(initialList);
  const [newNama, setNewNama] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editNama, setEditNama] = useState("");

  // ----- Lokasi State -----
  const [lokasiList, setLokasiList] = useState<Lokasi[]>(initialLokasi);
  const [newLokasi, setNewLokasi] = useState({ nama: "", latitude: "", longitude: "", radius: "150" });
  const [isAddingLokasi, setIsAddingLokasi] = useState(false);
  const [editLokasiId, setEditLokasiId] = useState<string | null>(null);
  const [editLokasiData, setEditLokasiData] = useState({ nama: "", latitude: "", longitude: "", radius: "150" });
  const [isLocating, setIsLocating] = useState(false);

  const handleAutoLocation = (target: "new" | "edit") => {
    if (!navigator.geolocation) {
      toast.error("Browser Anda tidak mendukung deteksi lokasi (GPS).");
      return;
    }
    setIsLocating(true);
    const tid = toast.loading("Mencari sinyal GPS terbaik...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const lat = pos.coords.latitude.toString();
        const lng = pos.coords.longitude.toString();
        if (target === "new") setNewLokasi(prev => ({ ...prev, latitude: lat, longitude: lng }));
        else setEditLokasiData(prev => ({ ...prev, latitude: lat, longitude: lng }));
        toast.success("Berhasil menemukan lokasi saat ini!", { id: tid });
      },
      (err) => {
        setIsLocating(false);
        toast.error("Gagal mendapatkan lokasi. Pastikan izin GPS menyala.", { id: tid });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // ===================== KEGIATAN ACTIONS =====================
  const handleAdd = async () => {
    if (!newNama.trim()) return;
    setIsAdding(true);
    try {
      const res = await fetch("/api/admin/absensi/kegiatan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama: newNama }),
      });
      const data = await res.json();
      if (data.success) {
        setList((prev) => [...prev, data.kegiatan].sort((a, b) => a.nama.localeCompare(b.nama, "id")));
        setNewNama("");
        toast.success(`Kegiatan "${data.kegiatan.nama}" berhasil ditambahkan`);
      } else {
        toast.error(data.error ?? "Gagal menambahkan kegiatan");
      }
    } catch (e) {
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setIsAdding(false);
    }
  };

  const handleSaveEdit = async (id: string) => {
    if (!editNama.trim()) return;
    try {
      const res = await fetch(`/api/admin/absensi/kegiatan/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama: editNama }),
      });
      const data = await res.json();
      if (data.success) {
        setList((prev) => prev.map((k) => (k.id === id ? { ...k, nama: data.kegiatan.nama } : k)));
        setEditId(null);
        toast.success("Nama kegiatan berhasil diubah");
      } else {
        toast.error(data.error ?? "Gagal mengubah kegiatan");
      }
    } catch {
      toast.error("Terjadi kesalahan sistem");
    }
  };

  const handleToggleAktif = async (item: Kegiatan) => {
    try {
      const res = await fetch(`/api/admin/absensi/kegiatan/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktif: !item.aktif }),
      });
      const data = await res.json();
      if (data.success) {
        setList((prev) => prev.map((k) => (k.id === item.id ? { ...k, aktif: !k.aktif } : k)));
        toast.success(`Kegiatan "${item.nama}" ${!item.aktif ? "diaktifkan" : "dinonaktifkan"}`);
      }
    } catch {
      toast.error("Terjadi kesalahan");
    }
  };

  const handleDelete = async (item: Kegiatan) => {
    if (!confirm(`Hapus kegiatan "${item.nama}"? Data absen yang sudah ada akan ikut terhapus.`)) return;
    try {
      const res = await fetch(`/api/admin/absensi/kegiatan/${item.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setList((prev) => prev.filter((k) => k.id !== item.id));
        toast.success(`Kegiatan "${item.nama}" dihapus`);
      } else {
        toast.error(data.error ?? "Gagal menghapus kegiatan");
      }
    } catch {
      toast.error("Terjadi kesalahan sistem");
    }
  };

  // ===================== LOKASI ACTIONS =====================
  const handleAddLokasi = async () => {
    if (!newLokasi.nama.trim() || !newLokasi.latitude || !newLokasi.longitude) {
      toast.error("Semua field lokasi harus diisi");
      return;
    }
    const lat = parseFloat(newLokasi.latitude);
    const lng = parseFloat(newLokasi.longitude);
    const rad = parseInt(newLokasi.radius, 10);
    if (isNaN(lat) || isNaN(lng) || isNaN(rad)) {
      toast.error("Format koordinat / radius tidak valid");
      return;
    }

    setIsAddingLokasi(true);
    try {
      const res = await fetch("/api/admin/absensi/lokasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama: newLokasi.nama, latitude: lat, longitude: lng, radius: rad }),
      });
      const data = await res.json();
      if (data.success) {
        setLokasiList((prev) => [...prev, data.lokasi].sort((a, b) => a.nama.localeCompare(b.nama, "id")));
        setNewLokasi({ nama: "", latitude: "", longitude: "", radius: "150" });
        toast.success(`Lokasi "${data.lokasi.nama}" ditambahkan`);
      } else {
        toast.error(data.error ?? "Gagal menambahkan lokasi");
      }
    } catch (e) {
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setIsAddingLokasi(false);
    }
  };

  const handleSaveLokasiEdit = async (id: string) => {
    if (!editLokasiData.nama.trim()) return;
    const lat = parseFloat(editLokasiData.latitude);
    const lng = parseFloat(editLokasiData.longitude);
    const rad = parseInt(editLokasiData.radius, 10);
    
    if (isNaN(lat) || isNaN(lng) || isNaN(rad)) {
      toast.error("Format koordinat tidak valid");
      return;
    }

    try {
      const res = await fetch(`/api/admin/absensi/lokasi/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama: editLokasiData.nama, latitude: lat, longitude: lng, radius: rad }),
      });
      const data = await res.json();
      if (data.success) {
        setLokasiList((prev) => prev.map((l) => (l.id === id ? { ...l, ...data.lokasi } : l)));
        setEditLokasiId(null);
        toast.success("Data lokasi berhasil diupdate");
      } else {
        toast.error(data.error ?? "Gagal update lokasi");
      }
    } catch {
      toast.error("Terjadi kesalahan sistem");
    }
  };

  const handleToggleLokasiAktif = async (item: Lokasi) => {
    try {
      const res = await fetch(`/api/admin/absensi/lokasi/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktif: !item.aktif }),
      });
      const data = await res.json();
      if (data.success) {
        setLokasiList((prev) => prev.map((l) => (l.id === item.id ? { ...l, aktif: !l.aktif } : l)));
        toast.success(`Lokasi "${item.nama}" ${!item.aktif ? "diaktifkan" : "dinonaktifkan"}`);
      }
    } catch {
      toast.error("Terjadi kesalahan");
    }
  };

  const handleDeleteLokasi = async (item: Lokasi) => {
    if (!confirm(`Hapus lokasi "${item.nama}"?`)) return;
    try {
      const res = await fetch(`/api/admin/absensi/lokasi/${item.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setLokasiList((prev) => prev.filter((l) => l.id !== item.id));
        toast.success(`Lokasi "${item.nama}" dihapus`);
      } else {
        toast.error(data.error ?? "Gagal menghapus lokasi");
      }
    } catch {
      toast.error("Terjadi kesalahan sistem");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black text-[var(--color-text)] md:text-4xl">
          Pengaturan Kegiatan & Lokasi
        </h1>
        <p className="text-base text-[var(--color-text-muted)] max-w-2xl">
          Kelola kategori kegiatan dan lokasi absensi mandiri santri. 
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ================= KEGIATAN SECTION ================= */}
        <section className="overflow-hidden neu-card-white flex flex-col">
          <div className="bg-[var(--color-primary)] px-6 py-4">
            <h2 className="text-white font-bold tracking-wide uppercase text-sm">Daftar Kegiatan</h2>
          </div>
          
          <div className="flex flex-col gap-3 border-b border-[var(--color-surface-dark)] p-4 bg-[var(--color-surface-light)] md:flex-row md:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                Tambah Kegiatan
              </label>
              <input
                type="text"
                placeholder="Nama (Halaqoh, dll)"
                value={newNama}
                onChange={(e) => setNewNama(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                className="w-full rounded-xl border border-[var(--color-surface-dark)] bg-white px-3 py-2 text-sm font-semibold text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={isAdding || !newNama.trim()}
              className="flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Tambah
            </button>
          </div>

          <ul className="divide-y divide-[var(--color-surface)] overflow-y-auto max-h-[600px]">
            {list.length === 0 && (
              <li className="px-6 py-8 text-center text-sm font-medium text-[var(--color-text-muted)]">
                Belum ada kategori kegiatan.
              </li>
            )}
            {list.map((item) => (
              <li key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-3.5 hover:bg-[var(--color-surface-light)]">
                {editId === item.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      type="text"
                      value={editNama}
                      onChange={(e) => setEditNama(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveEdit(item.id);
                        if (e.key === "Escape") setEditId(null);
                      }}
                      autoFocus
                      className="flex-1 rounded-lg border border-[var(--color-primary)] bg-white px-2 py-1 text-sm font-semibold text-[var(--color-text)] outline-none"
                    />
                    <button onClick={() => handleSaveEdit(item.id)} className="p-1.5 rounded bg-[var(--color-primary)] text-white"><Check size={14} /></button>
                    <button onClick={() => setEditId(null)} className="p-1.5 rounded bg-[var(--color-surface-dark)] text-[var(--color-text)]"><X size={14} /></button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <span className={`font-semibold text-sm ${!item.aktif ? "line-through text-[var(--color-text-subtle)]" : ""}`}>
                        {item.nama}
                      </span>
                      {!item.aktif && (
                        <span className="rounded bg-[var(--color-warning-light)] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[var(--color-warning)]">
                          Nonaktif
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1 justify-end">
                      <button onClick={() => handleToggleAktif(item)} title={item.aktif ? "Nonaktifkan" : "Aktifkan"} className={`rounded p-1.5 transition ${item.aktif ? "text-[var(--color-primary)] hover:bg-[var(--color-primary-50)]" : "text-[var(--color-text-subtle)] hover:bg-[var(--color-surface)]"}`}>
                        {item.aktif ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                      </button>
                      <button onClick={() => { setEditId(item.id); setEditNama(item.nama); }} className="rounded p-1.5 text-[var(--color-text-subtle)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDelete(item)} className="rounded p-1.5 text-[var(--color-text-subtle)] hover:bg-[var(--color-danger-light)] hover:text-[var(--color-danger)]">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* ================= LOKASI SECTION ================= */}
        <section className="overflow-hidden neu-card-white flex flex-col">
          <div className="bg-emerald-600 px-6 py-4 flex items-center justify-between">
            <h2 className="text-white font-bold tracking-wide uppercase text-sm">Lokasi Absensi Sesi</h2>
            <MapPin size={18} className="text-white/80" />
          </div>
          
          <div className="flex flex-col gap-3 border-b border-[var(--color-surface-dark)] p-4 bg-[var(--color-surface-light)]">
            <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              Tambah Lokasi Baru
            </label>
            <div className="grid grid-cols-2 gap-3">
               <div className="col-span-2">
                  <input
                    type="text" placeholder="Nama Lokasi" value={newLokasi.nama} onChange={(e) => setNewLokasi({...newLokasi, nama: e.target.value})}
                    className="w-full rounded-xl border border-[var(--color-surface-dark)] bg-white px-3 py-2 text-sm font-semibold outline-none transition focus:border-emerald-500"
                  />
               </div>
               <div className="col-span-2 flex gap-2">
                  <input
                    type="text" placeholder="Latitude" value={newLokasi.latitude} onChange={(e) => setNewLokasi({...newLokasi, latitude: e.target.value})}
                    className="w-full rounded-xl border border-[var(--color-surface-dark)] bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500"
                  />
                  <input
                    type="text" placeholder="Longitude" value={newLokasi.longitude} onChange={(e) => setNewLokasi({...newLokasi, longitude: e.target.value})}
                    className="w-full rounded-xl border border-[var(--color-surface-dark)] bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500"
                  />
                  <button onClick={() => handleAutoLocation("new")} disabled={isLocating} title="Dapatkan Koordinat Anda Saat Ini dari GPS" className="px-3 py-2 bg-gray-100 text-gray-700 hover:bg-emerald-100 hover:text-emerald-700 rounded-xl transition disabled:opacity-50 border border-gray-300">
                    <Crosshair size={18} className={isLocating ? "animate-spin" : ""} />
                  </button>
               </div>
               <div className="col-span-2 flex gap-3">
                  <div className="w-1/3 relative">
                    <input
                      type="number" title="Radius" value={newLokasi.radius} onChange={(e) => setNewLokasi({...newLokasi, radius: e.target.value})}
                      className="w-full rounded-xl border border-[var(--color-surface-dark)] bg-white pl-3 pr-8 py-2 text-sm font-semibold outline-none focus:border-emerald-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">m</span>
                  </div>
                  <button
                    onClick={handleAddLokasi} disabled={isAddingLokasi || !newLokasi.nama}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" /> Tambah Lokasi
                  </button>
               </div>
            </div>
          </div>

          <ul className="divide-y divide-[var(--color-surface)] overflow-y-auto max-h-[500px]">
            {lokasiList.length === 0 && (
              <li className="px-6 py-8 text-center text-sm font-medium text-[var(--color-text-muted)]">
                Belum ada data lokasi.
              </li>
            )}
            {lokasiList.map((item) => (
              <li key={item.id} className="flex flex-col p-4 hover:bg-[var(--color-surface-light)] gap-2">
                {editLokasiId === item.id ? (
                  <div className="flex flex-col gap-2">
                     <input type="text" value={editLokasiData.nama} onChange={(e) => setEditLokasiData({...editLokasiData, nama: e.target.value})} className="rounded-lg border border-emerald-500 bg-white px-2 py-1 text-sm font-bold" />
                     <div className="flex gap-2">
                        <input type="text" value={editLokasiData.latitude} onChange={(e) => setEditLokasiData({...editLokasiData, latitude: e.target.value})} className="w-1/2 rounded-lg border border-emerald-500 bg-white px-2 py-1 text-xs" />
                        <input type="text" value={editLokasiData.longitude} onChange={(e) => setEditLokasiData({...editLokasiData, longitude: e.target.value})} className="w-1/2 rounded-lg border border-emerald-500 bg-white px-2 py-1 text-xs" />
                        <button onClick={() => handleAutoLocation("edit")} title="Dapatkan Koordinat Anda Saat Ini dari GPS" className="px-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-emerald-100 hover:text-emerald-600 border border-gray-300 shrink-0">
                          <Crosshair size={14} className={isLocating ? "animate-spin" : ""} />
                        </button>
                     </div>
                     <div className="flex gap-2">
                        <input type="number" value={editLokasiData.radius} onChange={(e) => setEditLokasiData({...editLokasiData, radius: e.target.value})} className="w-16 rounded-lg border border-emerald-500 bg-white px-2 py-1 text-xs" />
                        <span className="text-xs self-center">meter</span>
                        <div className="flex ml-auto gap-2">
                          <button onClick={() => handleSaveLokasiEdit(item.id)} className="px-3 py-1 rounded bg-emerald-600 font-bold text-xs text-white">Simpan</button>
                          <button onClick={() => setEditLokasiId(null)} className="px-3 py-1 rounded bg-[var(--color-surface-dark)] font-bold text-xs">Batal</button>
                        </div>
                     </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between">
                      <div className="flex flex-col">
                         <span className={`font-bold text-sm ${!item.aktif ? "line-through text-gray-400" : "text-[var(--color-text)]"}`}>
                           {item.nama}
                         </span>
                         <span className="text-[10px] text-gray-500 font-mono mt-0.5">
                           {item.latitude}, {item.longitude} • Radius: <b>{item.radius}m</b>
                         </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {!item.aktif && (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-600 mr-2">NONAKTIF</span>
                        )}
                        <button onClick={() => handleToggleLokasiAktif(item)} className="p-1.5 text-gray-400 hover:text-emerald-600">
                           {item.aktif ? <ToggleRight size={18} className="text-emerald-600" /> : <ToggleLeft size={18} />}
                        </button>
                        <button onClick={() => { setEditLokasiId(item.id); setEditLokasiData({nama: item.nama, latitude: item.latitude.toString(), longitude: item.longitude.toString(), radius: item.radius.toString()}); }} className="p-1.5 text-gray-400 hover:text-[var(--color-text)]">
                           <Pencil size={15} />
                        </button>
                        <button onClick={() => handleDeleteLokasi(item)} className="p-1.5 text-gray-400 hover:text-red-500">
                           <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
