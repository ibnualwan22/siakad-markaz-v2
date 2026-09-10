"use client";

import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, MapPin } from "lucide-react";
import Swal from "sweetalert2";
import dynamic from "next/dynamic";

const LocationPickerMap = dynamic(() => import("./location-picker-map"), {
  ssr: false,
  loading: () => <div className="w-full h-[300px] bg-gray-100 flex items-center justify-center animate-pulse rounded-xl border text-sm font-semibold text-gray-500">Memuat Peta Editor...</div>
});

interface Lokasi {
  id: string;
  nama: string;
  deskripsi: string | null;
  latitude: number;
  longitude: number;
  imageUrl?: string | null;
  publicId?: string | null;
  isActive: boolean;
}

const fileToDataUri = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (e) => resolve(e.target?.result as string);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

export function DenahLokasiClient() {
  const [data, setData] = useState<Lokasi[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [existingImage, setExistingImage] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);

  const [formData, setFormData] = useState({
    nama: "",
    deskripsi: "",
    latitude: "",
    longitude: "",
    isActive: true,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/denah-lokasi");
      const json = await res.json();
      if (json.data) {
        setData(json.data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (item?: Lokasi) => {
    if (item) {
      setEditId(item.id);
      setFormData({
        nama: item.nama,
        deskripsi: item.deskripsi || "",
        latitude: item.latitude.toString(),
        longitude: item.longitude.toString(),
        isActive: item.isActive,
      });
      setExistingImage(item.imageUrl || null);
      setImageFile(null);
      setRemoveImage(false);
    } else {
      setEditId(null);
      setFormData({
        nama: "",
        deskripsi: "",
        latitude: "",
        longitude: "",
        isActive: true,
      });
      setExistingImage(null);
      setImageFile(null);
      setRemoveImage(false);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editId ? `/api/admin/denah-lokasi/${editId}` : "/api/admin/denah-lokasi";
      const method = editId ? "PUT" : "POST";

      let base64Image = undefined;
      if (imageFile) {
        base64Image = await fileToDataUri(imageFile);
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          latitude: parseFloat(formData.latitude),
          longitude: parseFloat(formData.longitude),
          base64Image,
          removeImage
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal menyimpan data");
      }

      await fetchData();
      setIsModalOpen(false);
      Swal.fire({
        icon: "success",
        title: "Berhasil",
        text: "Data lokasi berhasil disimpan",
      });
    } catch (error: any) {
      Swal.fire({
        icon: "error",
        title: "Gagal",
        text: error.message,
      });
    }
  };

  const handleDelete = async (id: string) => {
    const confirm = await Swal.fire({
      title: "Hapus Lokasi?",
      text: "Data lokasi tidak dapat dikembalikan",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ya, Hapus",
      cancelButtonText: "Batal",
      confirmButtonColor: "#e3342f",
    });

    if (!confirm.isConfirmed) return;

    try {
      const res = await fetch(`/api/admin/denah-lokasi/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal menghapus data");

      await fetchData();
      Swal.fire("Dihapus!", "Data lokasi berhasil dihapus.", "success");
    } catch (error: any) {
      Swal.fire("Error", error.message, "error");
    }
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="text-primary-600 h-6 w-6" />
            Denah Lokasi Sakan
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Kelola titik koordinat (Latitude & Longitude) gedung Sakan yang akan tampil di frontend halaman Santri.
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm hover:opacity-90 transition-opacity"
          style={{ background: "var(--color-primary)" }}
        >
          <Plus size={18} />
          Tambah Lokasi
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50/50 border-b border-gray-200 text-gray-500">
              <tr>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Nama Sakan</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Koordinat</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    Memuat data...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    Belum ada data lokasi
                  </td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{item.nama}</div>
                      {item.deskripsi && <div className="text-xs text-gray-500">{item.deskripsi}</div>}
                    </td>
                    <td className="px-6 py-4 font-mono text-[13px] text-gray-600">
                      {item.latitude}, {item.longitude}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${item.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {item.isActive ? "Aktif" : "Tidak Aktif"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(item)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                          title="Hapus"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{editId ? "Edit Lokasi" : "Tambah Lokasi Baru"}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Sakan *</label>
                <input
                  type="text"
                  required
                  value={formData.nama}
                  onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  placeholder="Misal: Sakan A"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Deskripsi</label>
                <input
                  type="text"
                  value={formData.deskripsi}
                  onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  placeholder="Opsional"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Foto Sakan</label>
                {!existingImage || removeImage ? (
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                  />
                ) : (
                  <div className="flex items-center gap-4 p-3 border rounded-lg bg-gray-50">
                    <img src={existingImage} alt="Preview" className="w-16 h-16 object-cover rounded-md shadow-sm" />
                    <button
                      type="button"
                      onClick={() => setRemoveImage(true)}
                      className="text-xs font-semibold text-red-600 hover:text-red-700 hover:underline"
                    >
                      Hapus Foto
                    </button>
                  </div>
                )}
              </div>
              
              <div className="pt-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tentukan Titik Koordinat Visual *</label>
                <LocationPickerMap
                  initialPosition={
                    formData.latitude && formData.longitude
                      ? [parseFloat(formData.latitude), parseFloat(formData.longitude)]
                      : null
                  }
                  onLocationSelect={(lat, lng) => {
                    setFormData(prev => ({
                      ...prev,
                      latitude: lat.toString(),
                      longitude: lng.toString()
                    }));
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Latitude *</label>
                  <input
                    type="number"
                    required
                    step="any"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-gray-50/50"
                    placeholder="-7.319..."
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Longitude *</label>
                  <input
                    type="number"
                    required
                    step="any"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-gray-50/50"
                    placeholder="112.730..."
                    readOnly
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-primary rounded border-gray-300"
                />
                <label htmlFor="isActive" className="text-sm font-semibold text-gray-700 cursor-pointer">
                  Aktif (Ditampilkan di Frontend)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white rounded-lg transition-colors hover:opacity-90"
                  style={{ background: "var(--color-primary)" }}
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
